import { describe, expect, it } from "vitest";
import {
  buildCustomKitQuote,
  computeAutoKitPrice,
  clampKitDiscountPercent,
} from "../lib/healthKitQuote";
import {
  getHealthKitAvailability,
  resolveHealthKitPricing,
} from "../convex/healthKitsCore";
import type { DatabaseReader } from "../convex/_generated/server";
import type { Doc } from "../convex/_generated/dataModel";

type ProductDoc = Doc<"products">;

function product(): ProductDoc {
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
  } as any;
}

const db = {
  get: (id: string) => Promise.resolve(product()),
  query: async () => [],
  mutate: async () => {},
} as unknown as DatabaseReader;

describe("Health Kits pricing / availability", () => {
  it("resolves auto kit pricing from engine prices", async () => {
    const pricing = await resolveHealthKitPricing(db, {
      _id: "kit-1",
      name: "Kit 1",
      price: 1000,
      discountPrice: undefined,
      isActive: true,
      categoryId: "cat",
      healthKit: {
        components: [{ productId: "p1", quantity: 2 }],
        pricing: { mode: "auto", kitDiscountPercent: 10 },
      },
    } as any);
    expect(pricing.mode).toBe("auto");
    expect(pricing.sellingPrice).toBe(720);
    expect(pricing.savings).toBe(80);
    expect(pricing.discountPercent).toBe(10);
  });

  it("resolves manual kit pricing", async () => {
    const pricing = await resolveHealthKitPricing(db, {
      _id: "kit-2",
      name: "Kit 2",
      price: 1000,
      discountPrice: 0,
      isActive: true,
      categoryId: "cat",
      healthKit: {
        components: [{ productId: "p1", quantity: 2 }],
        pricing: { mode: "manual", kitDiscountPercent: 10 },
      },
    } as any);
    expect(pricing.mode).toBe("manual");
    expect(pricing.sellingPrice).toBe(2000);
    expect(pricing.savings).toBe(200);
    expect(pricing.discountPercent).toBe(20);
  });

  it("clamps kit discount percent and auto price to effective catalogue value", () => {
    const clamped = clampKitDiscountPercent(200);
    expect(clamped).toBeLessThanOrEqual(100);

    const auto = computeAutoKitPrice(1200, 10);
    expect(auto).toBeLessThanOrEqual(1200);
  });

  it("computes per-unit allocation and availability", async () => {
    const components = [
      {
        productId: "p1",
        configuredQuantity: 1,
        effectiveUnitPrice: 400,
        mrp: 500,
      } as any,
      {
        productId: "p2",
        configuredQuantity: 1,
        effectiveUnitPrice: 250,
        mrp: 300,
      } as any,
    ];
    const quote = buildCustomKitQuote({
      basePrice: 2000,
      components,
    });
    expect(quote.selectedMrp).toBe(500 + 300);
    expect(quote.selectedEffectiveValue).toBe(400 + 250);
    expect(quote.customizedPrice).toBe(2000);

    const availability = await getHealthKitAvailability(db, {
      name: "kit",
      price: 0,
      isActive: true,
      categoryId: "cat",
      healthKit: { components: [] },
    } as any);
    expect(availability).toEqual({
      available: true,
      maxQuantity: 0,
      components: [],
      unavailableReason: null,
    });
  });
});
