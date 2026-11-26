import { describe, expect, it } from "vitest";
import { buildCustomKitQuote, computeAutoKitPrice } from "../lib/healthKitQuote";
import { clampKitDiscountPercent } from "../lib/discount";
import { getHealthKitAvailability, resolveHealthKitPricing } from "../convex/healthKitsCore";
import type { Database } from "../convex/_generated/dataModel";

function product(): any {
  return {
    _id: "p1",
    name: "component",
    price: 400,
    discountPrice: 400,
    isActive: true,
    stockQuantity: 2,
    healthKit: null,
    slug: null,
    imageUrl: null,
    packSize: null,
    expiryDate: null,
    manufacturer: null,
  };
}

const db: Database = {
  get: (id: string) => Promise.resolve(product()),
  query: async () => [],
  mutate: async () => {},
};

function kitDoc(): any {
  return {
    _id: "kit-1",
    name: "Kit 1",
    price: 1000,
    discountPrice: 0,
    isActive: true,
    healthKit: {
      components: [{ productId: "p1", quantity: 2 }],
      pricing: { mode: "auto", kitDiscountPercent: 10 },
    },
  };
}

describe("Health Kits pricing / availability", () => {
  it("resolves auto kit pricing from engine prices", async () => {
    const pricing = await resolveHealthKitPricing(db, kitDoc());
    expect(pricing.mode).toBe("auto");
    expect(pricing.effectiveCatalogueValue).toBe(800);
    expect(pricing.autoPricePerUnit).toBe(800);
    expect(pricing.sellingPrice).toBe(720);
    expect(pricing.priceAfterDiscount).toBe(720);
  });

  it("resolves manual kit pricing", async () => {
    const pricing = await resolveHealthKitPricing(db, {
      _id: "kit-2",
      name: "Kit 2",
      price: 1000,
      discountPrice: 0,
      isActive: true,
      healthKit: {
        components: [{ productId: "p1", quantity: 2 }],
        pricing: { mode: "manual", kitDiscountPercent: 10, adminPrice: 2000 },
      },
    });
    expect(pricing.mode).toBe("manual");
    expect(pricing.autoPricePerUnit).toBe(800);
    expect(pricing.sellingPrice).toBe(2000);
    expect(pricing.priceAfterDiscount).toBe(1800);
  });

  it("clamps kit discount percent and auto price to effective catalogue value", () => {
    const clamped = clampKitDiscountPercent(200);
    expect(clamped).toBeLessThanOrEqual(100);

    const auto = computeAutoKitPrice(1200, 10);
    expect(auto).toBeLessThanOrEqual(1200);
  });

  it("computes per-unit allocation and availability", () => {
    const quote = buildCustomKitQuote(
      2000,
      [
        { id: "p1", basePrice: 500, effectivePrice: 400 },
        { id: "p2", basePrice: 300, effectivePrice: 250 },
      ],
      1
    );
    expect(quote.perUnitPrices).toEqual({ p1: 400, p2: 250 });
    expect(quote.effectiveKitPrice).toBe(650);

    expect(
      getHealthKitAvailability(db, {
        name: "kit",
        price: 0,
        isActive: true,
        healthKit: { components: [] },
      })
    ).toEqual({
      available: true,
      maxQuantity: 0,
      components: [],
      unavailableReason: null,
    });
  });
});
