import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  couponStatus,
  describeOffer,
  evaluateCoupon,
  isRedeemableStatus,
  normalizeCouponCode,
} from "./couponLogic";
import {
  countUserRedemptions,
  findCouponByCode,
  isFirstOrderCustomer,
  resolveCoupon,
  toPreview,
} from "./couponRedemptions";

/** Cart line the client passes so category-restricted coupons can be checked. */
const cartItemValidator = v.object({
  categoryId: v.optional(v.string()),
  amount: v.number(),
});

// ── Validate a coupon code for the current user ──
// Quick validity check without cart context (kept for compatibility with the
// existing callers); the checkout uses `computeDiscount` below, which also
// knows the cart.
export const validate = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { valid: false, reason: "Please sign in to use a coupon" };

    const code = normalizeCouponCode(args.code);
    if (!code) return { valid: false, reason: "Coupon code is required" };

    const coupon = await findCouponByCode(ctx, code);
    if (!coupon) return { valid: false, reason: "Invalid coupon code" };

    const status = couponStatus(coupon);
    if (!isRedeemableStatus(status)) {
      return { valid: false, reason: statusReason(status) };
    }

    return {
      valid: true,
      couponId: coupon._id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountPercent: coupon.discountPercent,
      fixedDiscount: coupon.fixedDiscount,
      maxDiscount: coupon.maxDiscount,
      minOrder: coupon.minOrder,
      message: describeOffer(coupon),
    };
  },
});

// ── Apply coupon at checkout and compute discount ──
// Full eligibility + discount for one code against the current cart. The
// server recomputes everything; the amount returned here is only what the
// customer sees — order creation recalculates it from scratch.
export const computeDiscount = query({
  args: {
    code: v.string(),
    subtotal: v.number(),
    /** Delivery charge before the coupon (for free-delivery coupons). */
    deliveryFee: v.optional(v.number()),
    /** Per-line cart amounts, so category-restricted coupons are checked. */
    items: v.optional(v.array(cartItemValidator)),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { valid: false, reason: "Please sign in to use a coupon" };

    const code = normalizeCouponCode(args.code);
    if (!code) return { valid: false, reason: "Coupon code is required" };

    const resolved = await resolveCoupon(ctx, {
      userId,
      code,
      subtotal: args.subtotal,
      items: args.items,
      deliveryFee: Math.max(0, args.deliveryFee ?? 0),
    });

    if (!resolved.ok) {
      return { valid: false, reason: resolved.reason };
    }

    const { coupon, evaluation } = resolved;
    const message =
      coupon.discountType === "free_delivery"
        ? "Free delivery applied"
        : evaluation.discount > 0
          ? `${describeOffer(coupon)} — you save ₹${evaluation.savings}`
          : describeOffer(coupon);

    return {
      valid: true,
      couponId: coupon._id,
      code: coupon.code,
      discount: evaluation.discount,
      deliveryWaived: evaluation.deliveryWaived,
      savings: evaluation.savings,
      message,
    };
  },
});

// ── Offers available for this customer + cart ──
// Powers the "Available offers" panels and the "Apply best coupon" action.
// Sorted by actual saving (lowest payable wins), never by percentage. Codes
// that cannot be applied right now are included with their customer-safe
// reason so the storefront can explain why (e.g. "Add ₹120 more").
export const listAvailable = query({
  args: {
    subtotal: v.number(),
    deliveryFee: v.optional(v.number()),
    items: v.optional(v.array(cartItemValidator)),
    /** How many offers to return (default 20, max 50). */
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { offers: [], signInRequired: true };

    const now = Date.now();
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);
    const subtotal = Math.max(0, args.subtotal);
    const deliveryFee = Math.max(0, args.deliveryFee ?? 0);

    const [isFirstOrder, allCoupons] = await Promise.all([
      isFirstOrderCustomer(ctx, userId),
      ctx.db.query("coupons").collect(),
    ]);

    const offers = [];
    for (const coupon of allCoupons) {
      if (coupon.archived || !coupon.isActive) continue;
      // Skip long-expired coupons entirely — they are not "offers".
      if (coupon.expiresAt < now) continue;

      const userRedemptions = await countUserRedemptions(ctx, userId, coupon._id);

      const evaluation = evaluateCoupon(coupon, {
        now,
        subtotal,
        items: args.items,
        deliveryFee,
        isFirstOrder,
        userRedemptions,
      });

      const status = couponStatus(coupon, now);
      const message = !evaluation.valid
        ? evaluation.reason || ""
        : coupon.discountType === "free_delivery"
          ? "Free delivery"
          : `You save ₹${evaluation.savings}`;

      const preview = toPreview(coupon, evaluation, message);
      preview.status = status;
      preview.offerText = describeOffer(coupon);
      offers.push(preview);
    }

    // Applicable offers first, biggest saving first; ineligible ones follow
    // with their reason so the customer can see why they don't apply yet.
    offers.sort((a, b) => {
      if (a.valid !== b.valid) return a.valid ? -1 : 1;
      if (a.valid && b.valid) return b.savings - a.savings;
      return a.code.localeCompare(b.code);
    });

    return { offers: offers.slice(0, limit), signInRequired: false };
  },
});

function statusReason(status: ReturnType<typeof couponStatus>): string {
  switch (status) {
    case "scheduled":
      return "This coupon is not active yet";
    case "expired":
      return "This coupon has expired";
    case "exhausted":
      return "This coupon usage limit has been reached";
    case "inactive":
    case "archived":
      return "This coupon is no longer active";
    default:
      return "Invalid coupon code";
  }
}

// ── Mark coupon as used (called internally after order creation) ──
// Kept for compatibility; order creation now reserves through the redemption
// lifecycle in couponRedemptions.ts instead of calling this directly.
export const incrementUsage = mutation({
  args: { couponId: v.id("coupons") },
  handler: async (ctx, args) => {
    const coupon = await ctx.db.get(args.couponId);
    if (!coupon) throw new Error("Coupon not found");
    await ctx.db.patch(args.couponId, {
      usedCount: coupon.usedCount + 1,
    });
    return { success: true };
  },
});
