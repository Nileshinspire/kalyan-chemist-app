import { describe, it, expect } from "vitest";

/**
 * Test the coupon discount calculation logic used in orders.ts.
 * We extract and test the pure calculation since the Convex handler
 * requires database access.
 */

interface CouponInput {
  discountType: "percentage" | "fixed";
  discountPercent: number;
  fixedDiscount: number;
  maxDiscount: number;
  minOrder: number;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
  expiresAt: number;
}

/** Mirrors the server-side coupon discount computation */
function computeCouponDiscount(coupon: CouponInput, subtotal: number): number {
  if (!coupon.isActive) return 0;
  if (coupon.expiresAt < Date.now()) return 0;
  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) return 0;
  if (subtotal < coupon.minOrder) return 0;

  let discount = 0;
  if (coupon.discountType === "percentage") {
    discount = Math.round((subtotal * coupon.discountPercent) / 100);
    discount = Math.min(discount, coupon.maxDiscount);
  } else {
    discount = Math.min(coupon.fixedDiscount, subtotal);
  }
  return discount;
}

describe("Coupon discount calculation", () => {
  const futureDate = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const pastDate = Date.now() - 24 * 60 * 60 * 1000;

  describe("percentage coupons", () => {
    it("calculates 10% discount correctly", () => {
      const discount = computeCouponDiscount(
        {
          discountType: "percentage",
          discountPercent: 10,
          fixedDiscount: 0,
          maxDiscount: 500,
          minOrder: 0,
          usageLimit: 100,
          usedCount: 0,
          isActive: true,
          expiresAt: futureDate,
        },
        500
      );
      expect(discount).toBe(50); // 10% of 500
    });

    it("caps at maxDiscount", () => {
      const discount = computeCouponDiscount(
        {
          discountType: "percentage",
          discountPercent: 50,
          fixedDiscount: 0,
          maxDiscount: 100,
          minOrder: 0,
          usageLimit: 100,
          usedCount: 0,
          isActive: true,
          expiresAt: futureDate,
        },
        1000
      );
      expect(discount).toBe(100); // 50% of 1000 = 500, but capped at 100
    });

    it("rounds discount to nearest integer", () => {
      const discount = computeCouponDiscount(
        {
          discountType: "percentage",
          discountPercent: 15,
          fixedDiscount: 0,
          maxDiscount: 1000,
          minOrder: 0,
          usageLimit: 100,
          usedCount: 0,
          isActive: true,
          expiresAt: futureDate,
        },
        333
      );
      expect(discount).toBe(50); // 15% of 333 = 49.95 → rounded to 50
    });
  });

  describe("fixed coupons", () => {
    it("applies fixed discount", () => {
      const discount = computeCouponDiscount(
        {
          discountType: "fixed",
          discountPercent: 0,
          fixedDiscount: 100,
          maxDiscount: 0,
          minOrder: 0,
          usageLimit: 100,
          usedCount: 0,
          isActive: true,
          expiresAt: futureDate,
        },
        500
      );
      expect(discount).toBe(100);
    });

    it("caps fixed discount at subtotal", () => {
      const discount = computeCouponDiscount(
        {
          discountType: "fixed",
          discountPercent: 0,
          fixedDiscount: 500,
          maxDiscount: 0,
          minOrder: 0,
          usageLimit: 100,
          usedCount: 0,
          isActive: true,
          expiresAt: futureDate,
        },
        200
      );
      expect(discount).toBe(200); // Can't discount more than subtotal
    });
  });

  describe("validation rules", () => {
    it("rejects expired coupons", () => {
      const discount = computeCouponDiscount(
        {
          discountType: "percentage",
          discountPercent: 10,
          fixedDiscount: 0,
          maxDiscount: 200,
          minOrder: 0,
          usageLimit: 100,
          usedCount: 0,
          isActive: true,
          expiresAt: pastDate,
        },
        500
      );
      expect(discount).toBe(0);
    });

    it("rejects inactive coupons", () => {
      const discount = computeCouponDiscount(
        {
          discountType: "percentage",
          discountPercent: 10,
          fixedDiscount: 0,
          maxDiscount: 200,
          minOrder: 0,
          usageLimit: 100,
          usedCount: 0,
          isActive: false,
          expiresAt: futureDate,
        },
        500
      );
      expect(discount).toBe(0);
    });

    it("rejects coupons that reached usage limit", () => {
      const discount = computeCouponDiscount(
        {
          discountType: "percentage",
          discountPercent: 10,
          fixedDiscount: 0,
          maxDiscount: 200,
          minOrder: 0,
          usageLimit: 100,
          usedCount: 100,
          isActive: true,
          expiresAt: futureDate,
        },
        500
      );
      expect(discount).toBe(0);
    });

    it("rejects coupons when subtotal below minimum", () => {
      const discount = computeCouponDiscount(
        {
          discountType: "percentage",
          discountPercent: 10,
          fixedDiscount: 0,
          maxDiscount: 200,
          minOrder: 500,
          usageLimit: 100,
          usedCount: 0,
          isActive: true,
          expiresAt: futureDate,
        },
        300
      );
      expect(discount).toBe(0);
    });

    it("allows usage when count is just below limit", () => {
      const discount = computeCouponDiscount(
        {
          discountType: "percentage",
          discountPercent: 10,
          fixedDiscount: 0,
          maxDiscount: 200,
          minOrder: 0,
          usageLimit: 100,
          usedCount: 99,
          isActive: true,
          expiresAt: futureDate,
        },
        1000
      );
      expect(discount).toBe(100); // 10% of 1000 = 100
    });

    it("allows unlimited usage when limit is 0", () => {
      const discount = computeCouponDiscount(
        {
          discountType: "percentage",
          discountPercent: 10,
          fixedDiscount: 0,
          maxDiscount: 200,
          minOrder: 0,
          usageLimit: 0, // unlimited
          usedCount: 99999,
          isActive: true,
          expiresAt: futureDate,
        },
        1000
      );
      expect(discount).toBe(100);
    });
  });
});
