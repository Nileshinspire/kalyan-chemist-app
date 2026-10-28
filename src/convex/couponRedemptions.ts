/**
 * Coupon redemption lifecycle (database side).
 *
 * These are plain functions shared by the preview queries, the order
 * mutations and the payment mutations. They follow the same reservation
 * pattern as the wallet helpers: an order holds a redemption (`active`) the
 * moment it is created, the hold becomes final (`consumed`) when the payment
 * succeeds, and it is given back (`released`) when the payment fails or the
 * order is cancelled — so a customer is never permanently charged for a
 * coupon on a checkout that did not go through, and a coupon slot is never
 * double-spent either.
 *
 * Convex mutations are transactional, so every read-modify-write below is
 * serialized with the other mutations: two customers racing for the last
 * redemption cannot both pass the `usedCount < usageLimit` check.
 */

import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  evaluateCoupon,
  normalizeCouponCode,
  type CouponContext,
  type CouponDiscountType,
  type CouponEvaluation,
  type CouponLifecycleStatus,
} from "./couponLogic";

/** Load a coupon row by its normalized code (or null). */
export async function findCouponByCode(
  ctx: QueryCtx | MutationCtx,
  code: string
): Promise<Doc<"coupons"> | null> {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return null;
  return await ctx.db
    .query("coupons")
    .withIndex("by_code", (q) => q.eq("code", normalized))
    .first();
}

/**
 * First-order eligibility, decided by real order history on the backend:
 * the customer counts as "first order" while every existing order was either
 * cancelled or left with a failed payment. Frontend flags are never consulted.
 *
 * (We deliberately do NOT try to detect multiple accounts belonging to the
 * same person — there is no privacy-compliant mechanism for that here.)
 */
export async function isFirstOrderCustomer(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">
): Promise<boolean> {
  const orders = await ctx.db
    .query("orders")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  return !orders.some(
    (order) =>
      order.status !== "cancelled" && order.paymentStatus !== "failed"
  );
}

/** How many redemptions of this coupon by this customer still count
 *  (everything except released ones). */
export async function countUserRedemptions(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  couponId: Id<"coupons">
): Promise<number> {
  const rows = await ctx.db
    .query("coupon_redemptions")
    .withIndex("by_user_coupon", (q) =>
      q.eq("userId", userId).eq("couponId", couponId)
    )
    .collect();
  return rows.filter((row) => row.status !== "released").length;
}

export interface ResolvedCoupon {
  ok: true;
  coupon: Doc<"coupons">;
  evaluation: CouponEvaluation;
}
export interface CouponRejection {
  ok: false;
  reason: string;
}

/**
 * Validate and fully evaluate a coupon code for a user + cart. Used both by
 * the customer-facing preview queries and by order creation, so what the
 * customer sees and what the server charges always follow the same rules.
 * The `reason` is always customer-safe (no internal data).
 */
export async function resolveCoupon(
  ctx: QueryCtx | MutationCtx,
  args: {
    userId: Id<"users">;
    code: string;
    subtotal: number;
    items?: { categoryId?: string | null; amount: number }[];
    deliveryFee: number;
  }
): Promise<ResolvedCoupon | CouponRejection> {
  const coupon = await findCouponByCode(ctx, args.code);
  if (!coupon) return { ok: false, reason: "Invalid coupon code" };

  const [isFirstOrder, userRedemptions] = await Promise.all([
    isFirstOrderCustomer(ctx, args.userId),
    countUserRedemptions(ctx, args.userId, coupon._id),
  ]);

  const context: CouponContext = {
    now: Date.now(),
    subtotal: args.subtotal,
    items: args.items,
    deliveryFee: args.deliveryFee,
    isFirstOrder,
    userRedemptions,
  };
  const evaluation = evaluateCoupon(coupon, context);

  if (!evaluation.valid) {
    return {
      ok: false,
      reason: evaluation.reason || "This coupon cannot be applied",
    };
  }
  return { ok: true, coupon, evaluation };
}

/**
 * Reserve the coupon against an order: insert the redemption record and
 * consume one unit of the total usage limit. Must be called inside the same
 * mutation that creates the order, so a failure rolls both back together.
 */
export async function registerRedemption(
  ctx: MutationCtx,
  args: {
    coupon: Doc<"coupons">;
    userId: Id<"users">;
    orderId: Id<"orders">;
    discountAmount: number;
    deliveryWaived: number;
  }
): Promise<void> {
  const now = Date.now();
  const coupon = args.coupon;
  await ctx.db.insert("coupon_redemptions", {
    couponId: coupon._id,
    code: coupon.code,
    orderId: args.orderId,
    userId: args.userId,
    discountAmount: Math.max(0, Math.round(args.discountAmount)),
    deliveryWaived: Math.max(0, Math.round(args.deliveryWaived)),
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  await ctx.db.patch(coupon._id, {
    usedCount: Math.max(0, coupon.usedCount + 1),
  });
}

/**
 * Give a redemption back after a failed payment or a cancelled order.
 * Idempotent: an already-released or already-consumed hold is left alone, so
 * repeated failure callbacks never free the same slot twice.
 */
export async function releaseRedemptionForOrder(
  ctx: MutationCtx,
  orderId: Id<"orders">,
  reason: string
): Promise<void> {
  const rows = await ctx.db
    .query("coupon_redemptions")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .collect();

  for (const row of rows) {
    if (row.status !== "active") continue;
    const now = Date.now();
    await ctx.db.patch(row._id, {
      status: "released",
      releaseReason: reason,
      updatedAt: now,
    });
    const coupon = await ctx.db.get(row.couponId);
    if (coupon) {
      await ctx.db.patch(coupon._id, {
        usedCount: Math.max(0, coupon.usedCount - 1),
      });
    }
  }
}

/**
 * Make a redemption final once the payment succeeded. Idempotent, and it
 * also re-consumes a slot that an earlier failed attempt had released, so a
 * retried payment ends up with exactly one counted redemption. Orders placed
 * before redemption tracking get their record created here.
 */
export async function consumeRedemptionForOrder(
  ctx: MutationCtx,
  orderId: Id<"orders">
): Promise<void> {
  const order = await ctx.db.get(orderId);
  if (!order || !order.couponCode) return;

  const rows = await ctx.db
    .query("coupon_redemptions")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .collect();

  const now = Date.now();

  if (rows.length === 0) {
    // Legacy order created before redemption tracking: record it now.
    const coupon = await findCouponByCode(ctx, order.couponCode);
    if (!coupon) return;
    await ctx.db.insert("coupon_redemptions", {
      couponId: coupon._id,
      code: coupon.code,
      orderId,
      userId: order.userId,
      discountAmount: Math.max(0, Math.round(order.couponDiscount ?? 0)),
      deliveryWaived: 0,
      status: "consumed",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(coupon._id, { usedCount: coupon.usedCount + 1 });
    return;
  }

  for (const row of rows) {
    if (row.status === "consumed") continue; // already final
    const wasReleased = row.status === "released";
    await ctx.db.patch(row._id, { status: "consumed", updatedAt: now });
    if (wasReleased) {
      // The slot was returned on a failed attempt; take it back exactly once.
      const coupon = await ctx.db.get(row.couponId);
      if (coupon) {
        await ctx.db.patch(coupon._id, { usedCount: coupon.usedCount + 1 });
      }
    }
  }
}

/** Customer-safe summary shape returned by the preview queries. */
export interface CouponPreview {
  couponId: Id<"coupons">;
  code: string;
  name?: string;
  description?: string;
  discountType: CouponDiscountType;
  discountPercent: number;
  fixedDiscount: number;
  maxDiscount: number;
  minOrder: number;
  startsAt?: number;
  expiresAt: number;
  firstOrderOnly: boolean;
  valid: boolean;
  reason?: string;
  discount: number;
  deliveryWaived: number;
  savings: number;
  message: string;
  /** Derived lifecycle status (only set by the offers query). */
  status?: CouponLifecycleStatus;
  /** Human-readable offer text (only set by the offers query). */
  offerText?: string;
}

/** Build the customer-facing preview for one evaluated coupon. */
export function toPreview(
  coupon: Doc<"coupons">,
  evaluation: CouponEvaluation,
  message: string
): CouponPreview {
  return {
    couponId: coupon._id,
    code: coupon.code,
    name: coupon.name,
    description: coupon.description,
    discountType: coupon.discountType,
    discountPercent: coupon.discountPercent,
    fixedDiscount: coupon.fixedDiscount,
    maxDiscount: coupon.maxDiscount,
    minOrder: coupon.minOrder,
    startsAt: coupon.startsAt,
    expiresAt: coupon.expiresAt,
    firstOrderOnly: !!coupon.firstOrderOnly,
    valid: evaluation.valid,
    reason: evaluation.reason,
    discount: evaluation.discount,
    deliveryWaived: evaluation.deliveryWaived,
    savings: evaluation.savings,
    message,
  };
}
