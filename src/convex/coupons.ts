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

// ── Customer-facing offer surfaces ──
// One sanitized shape re-used by the homepage section, the dedicated Offers
// page, product pages and My Coupons. No internal fields are exposed and no
// discount is calculated here — checkout still validates everything.
export interface PublicCouponOffer {
  couponId: string;
  code: string;
  name?: string;
  description?: string;
  discountType: "percentage" | "fixed" | "free_delivery";
  discountPercent: number;
  fixedDiscount: number;
  maxDiscount: number;
  minOrder: number;
  startsAt?: number;
  expiresAt: number;
  firstOrderOnly: boolean;
  perUserLimit?: number;
  eligibleCategoryIds: string[];
  offerText: string;
}

function toPublicOffer(coupon: any): PublicCouponOffer {
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
    perUserLimit: coupon.perUserLimit,
    eligibleCategoryIds: (coupon.eligibleCategoryIds ?? []).map(String),
    offerText: describeOffer(coupon),
  };
}

/**
 * Coupons customers may see in a placement. Only currently active coupons
 * with the matching admin visibility switch are returned; draft, scheduled,
 * deactivated, expired, exhausted and archived coupons never are.
 */
export const publicOffers = query({
  args: {
    placement: v.optional(v.union(v.literal("homepage"), v.literal("all"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const placement = args.placement ?? "all";
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 100);
    const now = Date.now();

    const coupons = await ctx.db.query("coupons").collect();
    const offers = coupons
      .filter((coupon) => couponStatus(coupon, now) === "active")
      .filter((coupon) => {
        if (placement === "homepage") return coupon.showOnHomepage === true;
        return (
          coupon.showOnHomepage === true ||
          coupon.showOnProductPages === true ||
          coupon.showInMyCoupons === true
        );
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map(toPublicOffer);

    return { offers };
  },
});

/**
 * Coupon for the fixed mobile homepage bar.
 *
 * Guest customers see the first live homepage coupon. For a signed-in
 * customer the SAME eligibility rules the checkout enforces are applied:
 * a coupon they have already redeemed successfully (a consumed redemption) is
 * skipped, as are first-order-only coupons after their first order and
 * coupons whose per-customer limit is used up. The next eligible coupon is
 * returned instead — or null, which hides the bar entirely.
 */
export const homepageBanner = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const now = Date.now();
    const coupons = await ctx.db.query("coupons").collect();

    const candidates = coupons
      .filter((coupon) => couponStatus(coupon, now) === "active")
      .filter((coupon) => coupon.showOnHomepage === true)
      .sort((a, b) => b.createdAt - a.createdAt);

    if (userId === null) {
      return { offer: candidates[0] ? toPublicOffer(candidates[0]) : null };
    }

    const isFirstOrder = await isFirstOrderCustomer(ctx, userId);

    for (const coupon of candidates) {
      if (coupon.firstOrderOnly && !isFirstOrder) continue;

      const rows = await ctx.db
        .query("coupon_redemptions")
        .withIndex("by_user_coupon", (q) =>
          q.eq("userId", userId).eq("couponId", coupon._id)
        )
        .collect();

      // A successful order consumes the redemption — that customer has used
      // this coupon, so the banner moves on (or disappears).
      if (rows.some((row) => row.status === "consumed")) continue;

      const perUserLimit = coupon.perUserLimit ?? 0;
      const counted = rows.filter((row) => row.status !== "released").length;
      if (perUserLimit > 0 && counted >= perUserLimit) continue;

      return { offer: toPublicOffer(coupon) };
    }

    return { offer: null };
  },
});

/**
 * Coupons relevant to one product, for the small offer hint beside the price.
 * Applies the same category eligibility the checkout enforces.
 */
export const productOffers = query({
  args: { productId: v.id("products"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product || !product.isActive) return { offers: [] };

    const limit = Math.min(Math.max(args.limit ?? 3, 1), 10);
    const now = Date.now();
    const coupons = await ctx.db.query("coupons").collect();

    const offers = coupons
      .filter((coupon) => couponStatus(coupon, now) === "active")
      .filter((coupon) => coupon.showOnProductPages === true)
      .filter((coupon) => {
        const ids = (coupon.eligibleCategoryIds ?? []).map(String);
        if (ids.length === 0) return true;
        return !!product.categoryId && ids.includes(String(product.categoryId));
      })
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit)
      .map(toPublicOffer);

    return { offers };
  },
});

/**
 * My Coupons — available / used / expired for the signed-in customer.
 * Availability honours first-order-only, per-customer limits and exhausted
 * global usage on the backend, so a coupon can never look available here and
 * still fail at checkout for eligibility reasons.
 */
export const myCoupons = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { signInRequired: true, available: [], used: [], expired: [] };
    }

    const now = Date.now();
    const [coupons, isFirstOrder] = await Promise.all([
      ctx.db.query("coupons").collect(),
      isFirstOrderCustomer(ctx, userId),
    ]);

    const available: (PublicCouponOffer & { userRedemptions: number })[] = [];
    const used: (PublicCouponOffer & { usedAt: number })[] = [];
    const expired: PublicCouponOffer[] = [];

    for (const coupon of coupons) {
      if (coupon.showInMyCoupons !== true) continue;

      const rows = await ctx.db
        .query("coupon_redemptions")
        .withIndex("by_user_coupon", (q) =>
          q.eq("userId", userId).eq("couponId", coupon._id)
        )
        .collect();
      const consumed = rows.filter((row) => row.status === "consumed");
      const counted = rows.filter((row) => row.status !== "released");
      const status = couponStatus(coupon, now);

      if (consumed.length > 0) {
        used.push({
          ...toPublicOffer(coupon),
          usedAt: Math.max(...consumed.map((row) => row.updatedAt)),
        });
        continue;
      }

      if (status === "expired") {
        expired.push(toPublicOffer(coupon));
        continue;
      }

      // Draft, deactivated, archived or fully used coupons are not shown.
      if (status !== "active") continue;

      const perUserLimit = coupon.perUserLimit ?? 0;
      const limitReached =
        perUserLimit > 0 && counted.length >= perUserLimit;
      if (limitReached) {
        used.push({
          ...toPublicOffer(coupon),
          usedAt: Math.max(...rows.map((row) => row.updatedAt)),
        });
        continue;
      }

      if (coupon.firstOrderOnly && !isFirstOrder) continue;

      available.push({ ...toPublicOffer(coupon), userRedemptions: counted.length });
    }

    return { signInRequired: false, available, used, expired };
  },
});

function statusReason(status: ReturnType<typeof couponStatus>): string {
  switch (status) {
    case "draft":
      return "This coupon is not available yet";
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
