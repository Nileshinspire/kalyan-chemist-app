/**
 * Pure coupon rules — no Convex imports, no I/O, fully unit-testable.
 *
 * Every backend path (preview queries, order creation, direct order creation)
 * and the admin status badges go through these functions, so a coupon is
 * always evaluated the same way everywhere.
 *
 * ── Definitions used across the coupon system ── *
 *
 * Eligible subtotal: the cart subtotal AFTER product-level discounts, summed
 * over the items the coupon applies to. Both the `minOrder` threshold and the
 * percentage base use this same number, so the threshold is always measured
 * AFTER product-level discounts and is never counted twice.
 *
 * Limits: `usageLimit <= 0` and `perUserLimit <= 0` both mean "unlimited"
 * (same convention the existing system already used for `usageLimit`).
 * `maxDiscount <= 0` means "no cap" for percentage coupons.
 */

export type CouponDiscountType = "percentage" | "fixed" | "free_delivery";

/** Shape of a `coupons` row (only the fields the rules need). */
export interface CouponRecord {
  code: string;
  discountType: CouponDiscountType;
  discountPercent: number;
  fixedDiscount: number;
  maxDiscount: number;
  minOrder: number;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
  expiresAt: number;
  createdAt: number;
  startsAt?: number;
  perUserLimit?: number;
  firstOrderOnly?: boolean;
  eligibleCategoryIds?: string[];
  archived?: boolean;
}

export type CouponLifecycleStatus =
  | "active"
  | "scheduled"
  | "expired"
  | "exhausted"
  | "inactive"
  | "archived";

/** Facts about the current user + cart needed to evaluate a coupon. */
export interface CouponContext {
  /** Current time in ms. */
  now: number;
  /** Cart subtotal after product-level discounts (all items), in ₹. */
  subtotal: number;
  /** Per-item breakdown used for category restrictions; omit when the coupon
   *  applies to the whole cart. `amount` is the line's discounted total. */
  items?: { categoryId?: string | null; amount: number }[];
  /** Delivery charge before any coupon is applied (₹). */
  deliveryFee: number;
  /** True when the customer has no prior eligible (non-cancelled) order. */
  isFirstOrder: boolean;
  /** Redemptions by this customer for this coupon that still count
   *  (active + consumed). Released ones don't count. */
  userRedemptions: number;
}

export interface CouponEvaluation {
  valid: boolean;
  /** Customer-friendly reason when `valid` is false. */
  reason?: string;
  /** Item discount granted (₹, never negative). */
  discount: number;
  /** Delivery charge waived by a free-delivery coupon (₹). */
  deliveryWaived: number;
  /** Total saving = discount + deliveryWaived. */
  savings: number;
}

/** Codes are normalized to trimmed, upper-case. */
export function normalizeCouponCode(code: string): string {
  return (code ?? "").trim().toUpperCase();
}

/** Same rule the storefront security helper uses: 3-20 alphanumeric chars. */
export function isValidCouponCodeFormat(code: string): boolean {
  return /^[A-Z0-9]{3,20}$/.test(normalizeCouponCode(code));
}

/** Derived lifecycle status for display / admin filters. */
export function couponStatus(
  coupon: Pick<
    CouponRecord,
    "isActive" | "expiresAt" | "usageLimit" | "usedCount" | "archived" | "startsAt"
  >,
  now: number = Date.now()
): CouponLifecycleStatus {
  if (coupon.archived) return "archived";
  if (!coupon.isActive) return "inactive";
  if (coupon.expiresAt < now) return "expired";
  if (coupon.startsAt && coupon.startsAt > now) return "scheduled";
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) return "exhausted";
  return "active";
}

/** Statuses a customer can still redeem against. */
export function isRedeemableStatus(status: CouponLifecycleStatus): boolean {
  return status === "active";
}

/**
 * Money is always whole rupees here (the tax and totals code already rounds
 * to whole ₹), never negative, never more than the eligible amount.
 */
function clampMoney(value: number, cap: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value);
  return Math.max(0, Math.min(rounded, Math.max(0, Math.round(cap))));
}

/**
 * Compute the discount a coupon grants, without any eligibility checks.
 * - percentage: `eligibleSubtotal × percent`, capped by `maxDiscount`
 *   (0 = no cap) and by the eligible amount itself.
 * - fixed: the flat amount, capped by the eligible amount.
 * - free_delivery: waives the delivery charge only.
 */
export function computeCouponDiscount(
  coupon: CouponRecord,
  eligibleSubtotal: number,
  deliveryFee: number
): { discount: number; deliveryWaived: number } {
  const subtotal = Math.max(0, eligibleSubtotal);
  const fee = Math.max(0, deliveryFee);

  switch (coupon.discountType) {
    case "percentage": {
      const raw = (subtotal * (coupon.discountPercent || 0)) / 100;
      const capped =
        coupon.maxDiscount > 0
          ? Math.min(raw, coupon.maxDiscount)
          : raw;
      return { discount: clampMoney(capped, subtotal), deliveryWaived: 0 };
    }
    case "fixed":
      return { discount: clampMoney(coupon.fixedDiscount, subtotal), deliveryWaived: 0 };
    case "free_delivery":
      return { discount: 0, deliveryWaived: clampMoney(fee, fee) };
    default:
      return { discount: 0, deliveryWaived: 0 };
  }
}

/**
 * Subtotal of the cart lines this coupon actually applies to.
 * With no category restriction the whole (post-product-discount) subtotal is
 * eligible; otherwise only lines whose category is in the allow-list.
 */
export function eligibleSubtotalFor(
  coupon: CouponRecord,
  ctx: Pick<CouponContext, "subtotal" | "items">
): number {
  const restricted = coupon.eligibleCategoryIds && coupon.eligibleCategoryIds.length > 0;
  if (!restricted) return Math.max(0, ctx.subtotal);
  if (!ctx.items || ctx.items.length === 0) return Math.max(0, ctx.subtotal);

  const allowed = new Set<string>(coupon.eligibleCategoryIds!.map(String));
  let sum = 0;
  for (const item of ctx.items) {
    const cat = item.categoryId ? String(item.categoryId) : "";
    if (cat && allowed.has(cat)) sum += item.amount;
  }
  return Math.max(0, sum);
}

/**
 * Full evaluation: lifecycle + customer eligibility + actual discount.
 * Returns `reason` as a customer-safe message (no internal data leaks).
 */
export function evaluateCoupon(
  coupon: CouponRecord,
  ctx: CouponContext
): CouponEvaluation {
  const status = couponStatus(coupon, ctx.now);

  if (status === "archived") {
    return invalid("This coupon is no longer active");
  }
  if (status === "inactive") {
    return invalid("This coupon is no longer active");
  }
  if (status === "scheduled") {
    return invalid("This coupon is not active yet");
  }
  if (status === "expired") {
    return invalid("This coupon has expired");
  }
  if (status === "exhausted") {
    return invalid("This coupon usage limit has been reached");
  }

  const eligibleSubtotal = eligibleSubtotalFor(coupon, ctx);

  if (eligibleSubtotal < coupon.minOrder) {
    const shortfall = coupon.minOrder - eligibleSubtotal;
    return invalid(
      `Minimum order of ₹${coupon.minOrder} required. Add ₹${Math.max(1, Math.round(shortfall))} more.`
    );
  }

  if (coupon.firstOrderOnly && !ctx.isFirstOrder) {
    return invalid("This coupon is valid only on your first order");
  }

  const perUserLimit = coupon.perUserLimit ?? 0;
  if (perUserLimit > 0 && ctx.userRedemptions >= perUserLimit) {
    return invalid(
      perUserLimit === 1
        ? "You have already used this coupon"
        : `You can use this coupon at most ${perUserLimit} times`
    );
  }

  const restricted = coupon.eligibleCategoryIds && coupon.eligibleCategoryIds.length > 0;
  if (restricted && eligibleSubtotal <= 0) {
    return invalid("Coupon is not eligible for these items");
  }

  const { discount, deliveryWaived } = computeCouponDiscount(
    coupon,
    eligibleSubtotal,
    ctx.deliveryFee
  );

  return {
    valid: true,
    discount,
    deliveryWaived,
    savings: discount + deliveryWaived,
  };
}

function invalid(reason: string): CouponEvaluation {
  return { valid: false, reason, discount: 0, deliveryWaived: 0, savings: 0 };
}

/** The saving a customer would get, used for "best coupon" ranking. */
export function savingsOf(evaluation: CouponEvaluation): number {
  return evaluation.savings;
}

/**
 * Best coupon = the one that produces the lowest final payable amount, i.e.
 * the largest total saving. NOT the largest percentage — a flat ₹150 off can
 * beat 10% on a small cart, and a free-delivery coupon can beat both when the
 * delivery fee is the only thing left. Returns `null` when nothing is valid.
 */
export function pickBestCoupon<T extends { evaluation: CouponEvaluation }>(
  candidates: T[]
): T | null {
  let best: T | null = null;
  for (const candidate of candidates) {
    if (!candidate.evaluation.valid) continue;
    if (
      !best ||
      candidate.evaluation.savings > best.evaluation.savings
    ) {
      best = candidate;
    }
  }
  return best;
}

/** Human-readable one-line description of a coupon's offer (customer-safe). */
export function describeOffer(coupon: CouponRecord): string {
  switch (coupon.discountType) {
    case "percentage":
      return coupon.maxDiscount > 0
        ? `${coupon.discountPercent}% off (up to ₹${coupon.maxDiscount})`
        : `${coupon.discountPercent}% off`;
    case "fixed":
      return `Flat ₹${coupon.fixedDiscount} off`;
    case "free_delivery":
      return "Free delivery";
    default:
      return "Coupon";
  }
}
