import { describe, expect, it } from "vitest";
import {
  computeCouponDiscount,
  couponStatus,
  describeOffer,
  eligibleSubtotalFor,
  evaluateCoupon,
  isValidCouponCodeFormat,
  normalizeCouponCode,
  pickBestCoupon,
  type CouponContext,
  type CouponRecord,
} from "@/convex/couponLogic";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 28);

function makeCoupon(overrides: Partial<CouponRecord> = {}): CouponRecord {
  return {
    code: "SAVE10",
    discountType: "percentage",
    discountPercent: 10,
    fixedDiscount: 0,
    maxDiscount: 200,
    minOrder: 0,
    usageLimit: 0,
    usedCount: 0,
    isActive: true,
    expiresAt: NOW + 30 * DAY,
    createdAt: NOW - DAY,
    ...overrides,
  };
}

function makeCtx(overrides: Partial<CouponContext> = {}): CouponContext {
  return {
    now: NOW,
    subtotal: 1000,
    deliveryFee: 49,
    isFirstOrder: false,
    userRedemptions: 0,
    ...overrides,
  };
}

describe("code normalization", () => {
  it("trims and upper-cases codes", () => {
    expect(normalizeCouponCode("  save10 ")).toBe("SAVE10");
  });

  it("accepts 3-20 alphanumeric codes only", () => {
    expect(isValidCouponCodeFormat("SAVE10")).toBe(true);
    expect(isValidCouponCodeFormat("SA VE")).toBe(false);
    expect(isValidCouponCodeFormat("AB")).toBe(false);
    expect(isValidCouponCodeFormat("A".repeat(21))).toBe(false);
    expect(isValidCouponCodeFormat("SAVE-10")).toBe(false);
  });
});

describe("lifecycle status", () => {
  it("reports each state in priority order", () => {
    expect(couponStatus(makeCoupon({ archived: true }), NOW)).toBe("archived");
    expect(couponStatus(makeCoupon({ isActive: false }), NOW)).toBe("inactive");
    expect(couponStatus(makeCoupon({ expiresAt: NOW - 1 }), NOW)).toBe("expired");
    expect(couponStatus(makeCoupon({ startsAt: NOW + DAY }), NOW)).toBe("scheduled");
    expect(
      couponStatus(makeCoupon({ usageLimit: 5, usedCount: 5 }), NOW)
    ).toBe("exhausted");
    expect(couponStatus(makeCoupon(), NOW)).toBe("active");
  });

  it("an exhausted coupon stays exhausted even if the window is open", () => {
    expect(
      couponStatus(
        makeCoupon({ usageLimit: 2, usedCount: 2, startsAt: NOW - DAY }),
        NOW
      )
    ).toBe("exhausted");
  });
});

describe("percentage coupons", () => {
  it("computes percent of the eligible subtotal", () => {
    const { discount } = computeCouponDiscount(
      makeCoupon({ discountPercent: 15, maxDiscount: 0 }),
      1000,
      49
    );
    expect(discount).toBe(150);
  });

  it("enforces the maximum discount cap", () => {
    const { discount } = computeCouponDiscount(
      makeCoupon({ discountPercent: 50, maxDiscount: 200 }),
      1000,
      49
    );
    expect(discount).toBe(200);
  });

  it("treats a zero cap as no cap (same convention as usage limits)", () => {
    const { discount } = computeCouponDiscount(
      makeCoupon({ discountPercent: 50, maxDiscount: 0 }),
      1000,
      49
    );
    expect(discount).toBe(500);
  });

  it("rounds to whole rupees and never exceeds the subtotal", () => {
    const { discount } = computeCouponDiscount(
      makeCoupon({ discountPercent: 10, maxDiscount: 0 }),
      999,
      49
    );
    expect(discount).toBe(100); // 99.9 → 100
    expect(discount).toBeLessThanOrEqual(999);
  });
});

describe("flat coupons", () => {
  it("grants the flat amount within the eligible subtotal", () => {
    const { discount } = computeCouponDiscount(
      makeCoupon({ discountType: "fixed", fixedDiscount: 150 }),
      1000,
      49
    );
    expect(discount).toBe(150);
  });

  it("never exceeds the eligible amount and never goes negative", () => {
    const { discount } = computeCouponDiscount(
      makeCoupon({ discountType: "fixed", fixedDiscount: 500 }),
      120,
      49
    );
    expect(discount).toBe(120);
    expect(
      computeCouponDiscount(
        makeCoupon({ discountType: "fixed", fixedDiscount: -50 }),
        1000,
        49
      ).discount
    ).toBe(0);
  });
});

describe("free delivery coupons", () => {
  it("waives the delivery fee only, without touching item prices", () => {
    const { discount, deliveryWaived } = computeCouponDiscount(
      makeCoupon({ discountType: "free_delivery" }),
      1000,
      49
    );
    expect(discount).toBe(0);
    expect(deliveryWaived).toBe(49);
  });

  it("waives nothing when delivery is already free", () => {
    const { deliveryWaived } = computeCouponDiscount(
      makeCoupon({ discountType: "free_delivery" }),
      1000,
      0
    );
    expect(deliveryWaived).toBe(0);
  });
});

describe("eligibility evaluation", () => {
  it("rejects inactive, expired, scheduled and exhausted coupons", () => {
    expect(evaluateCoupon(makeCoupon({ isActive: false }), makeCtx()).reason).toBe(
      "This coupon is no longer active"
    );
    expect(evaluateCoupon(makeCoupon({ expiresAt: NOW - 1 }), makeCtx()).reason).toBe(
      "This coupon has expired"
    );
    expect(evaluateCoupon(makeCoupon({ startsAt: NOW + 1 }), makeCtx()).reason).toBe(
      "This coupon is not active yet"
    );
    expect(
      evaluateCoupon(makeCoupon({ usageLimit: 1, usedCount: 1 }), makeCtx()).reason
    ).toBe("This coupon usage limit has been reached");
    expect(evaluateCoupon(makeCoupon({ archived: true }), makeCtx()).reason).toBe(
      "This coupon is no longer active"
    );
  });

  it("enforces the minimum order with an actionable message", () => {
    const result = evaluateCoupon(
      makeCoupon({ minOrder: 799, discountType: "fixed", fixedDiscount: 120 }),
      makeCtx({ subtotal: 700 })
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("Minimum order of ₹799");
    expect(result.reason).toContain("Add ₹99 more");
  });

  it("measures the minimum on the post-product-discount subtotal", () => {
    // MRP 1200, product discount brings the payable subtotal to 700 → not met.
    const result = evaluateCoupon(makeCoupon({ minOrder: 799 }), makeCtx({ subtotal: 700 }));
    expect(result.valid).toBe(false);
    const met = evaluateCoupon(makeCoupon({ minOrder: 799 }), makeCtx({ subtotal: 799 }));
    expect(met.valid).toBe(true);
  });

  it("restricts first-order coupons using backend order history", () => {
    const coupon = makeCoupon({ firstOrderOnly: true });
    expect(evaluateCoupon(coupon, makeCtx({ isFirstOrder: true })).valid).toBe(true);
    const result = evaluateCoupon(coupon, makeCtx({ isFirstOrder: false }));
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("This coupon is valid only on your first order");
  });

  it("enforces the per-customer redemption limit", () => {
    const coupon = makeCoupon({ perUserLimit: 2 });
    expect(evaluateCoupon(coupon, makeCtx({ userRedemptions: 1 })).valid).toBe(true);
    const blocked = evaluateCoupon(coupon, makeCtx({ userRedemptions: 2 }));
    expect(blocked.valid).toBe(false);
    expect(blocked.reason).toBe("You can use this coupon at most 2 times");

    const once = makeCoupon({ perUserLimit: 1 });
    expect(
      evaluateCoupon(once, makeCtx({ userRedemptions: 1 })).reason
    ).toBe("You have already used this coupon");
  });

  it("limits category-restricted coupons to eligible items", () => {
    const coupon = makeCoupon({
      minOrder: 0,
      eligibleCategoryIds: ["cat-vitamins"],
    });
    const items = [
      { categoryId: "cat-vitamins", amount: 300 },
      { categoryId: "cat-devices", amount: 700 },
    ];
    // Only the ₹300 vitamin line is eligible → 10% = ₹30, not ₹100.
    const result = evaluateCoupon(coupon, makeCtx({ subtotal: 1000, items }));
    expect(result.valid).toBe(true);
    expect(result.discount).toBe(30);
    expect(eligibleSubtotalFor(coupon, { subtotal: 1000, items })).toBe(300);
  });

  it("explains when none of the cart items are eligible", () => {
    const coupon = makeCoupon({ eligibleCategoryIds: ["cat-vitamins"] });
    const items = [{ categoryId: "cat-devices", amount: 1000 }];
    const result = evaluateCoupon(coupon, makeCtx({ subtotal: 1000, items }));
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("Coupon is not eligible for these items");
  });

  it("reports savings as discount + waived delivery, never negative", () => {
    const free = evaluateCoupon(
      makeCoupon({ discountType: "free_delivery" }),
      makeCtx({ deliveryFee: 49 })
    );
    expect(free.savings).toBe(49);

    const percent = evaluateCoupon(makeCoupon({ discountPercent: 20, maxDiscount: 0 }), makeCtx());
    expect(percent.savings).toBe(200);
    expect(percent.savings).toBeGreaterThanOrEqual(0);
  });
});

describe("best coupon selection", () => {
  const candidate = (code: string, evaluation: ReturnType<typeof evaluateCoupon>) => ({
    code,
    evaluation,
  });

  it("picks the lowest payable amount, not the biggest percentage", () => {
    // A ₹150 flat coupon beats 10% (₹100) on a ₹1000 cart.
    const flat = candidate(
      "FLAT150",
      evaluateCoupon(
        makeCoupon({ code: "FLAT150", discountType: "fixed", fixedDiscount: 150 }),
        makeCtx()
      )
    );
    const percent = candidate(
      "PCT10",
      evaluateCoupon(
        makeCoupon({ code: "PCT10", discountPercent: 10, maxDiscount: 0 }),
        makeCtx()
      )
    );
    expect(pickBestCoupon([percent, flat])?.code).toBe("FLAT150");
  });

  it("can prefer a free-delivery coupon when it saves the most", () => {
    const tiny = candidate(
      "PCT1",
      evaluateCoupon(
        makeCoupon({ code: "PCT1", discountPercent: 1, maxDiscount: 0 }),
        makeCtx({ subtotal: 200, deliveryFee: 49 })
      )
    );
    const delivery = candidate(
      "FREEDEL",
      evaluateCoupon(
        makeCoupon({ code: "FREEDEL", discountType: "free_delivery" }),
        makeCtx({ subtotal: 200, deliveryFee: 49 })
      )
    );
    expect(pickBestCoupon([tiny, delivery])?.code).toBe("FREEDEL");
  });

  it("ignores invalid coupons and returns null when none apply", () => {
    const invalid = candidate(
      "EXPIRED",
      evaluateCoupon(makeCoupon({ code: "EXPIRED", expiresAt: NOW - 1 }), makeCtx())
    );
    expect(pickBestCoupon([invalid])).toBeNull();
    expect(pickBestCoupon([])).toBeNull();
  });
});

describe("customer-safe offer descriptions", () => {
  it("describes each coupon type without leaking internals", () => {
    expect(describeOffer(makeCoupon({ discountPercent: 15, maxDiscount: 200 }))).toBe(
      "15% off (up to ₹200)"
    );
    expect(
      describeOffer(makeCoupon({ discountPercent: 15, maxDiscount: 0 }))
    ).toBe("15% off");
    expect(
      describeOffer(makeCoupon({ discountType: "fixed", fixedDiscount: 120 }))
    ).toBe("Flat ₹120 off");
    expect(describeOffer(makeCoupon({ discountType: "free_delivery" }))).toBe(
      "Free delivery"
    );
  });
});
