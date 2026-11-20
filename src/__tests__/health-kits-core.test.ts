import { describe, expect, it } from "vitest";
import {
  getHealthKitAvailability,
  kitDiscountPercent,
  kitSellingPrice,
} from "@/convex/healthKitsCore";

const NOW = Date.UTC(2026, 10, 20);
const DAY = 24 * 60 * 60 * 1000;

function product(id: string, overrides: Record<string, unknown> = {}) {
  return {
    _id: id,
    name: `Product ${id}`,
    slug: `product-${id}`,
    isActive: true,
    stockQuantity: 10,
    price: 50,
    ...overrides,
  } as any;
}

function kit(components: Array<{ productId: string; quantity: number }>) {
  return {
    _id: "kit",
    name: "Test Kit",
    isActive: true,
    price: 120,
    discountPrice: 99,
    healthKit: {
      categoryId: "cat",
      components,
    },
  } as any;
}

const dbFor = (rows: any[]) => ({
  get: async (id: string) => rows.find((row) => row._id === id) ?? null,
});

describe("health kit pricing", () => {
  it("uses the explicit kit selling price and computes savings", () => {
    expect(kitSellingPrice(kit([]))).toBe(99);
    expect(kitDiscountPercent(kit([]))).toBe(18);
    expect(
      kitSellingPrice({ price: 80, discountPrice: undefined } as any),
    ).toBe(80);
    expect(
      kitDiscountPercent({ price: 80, discountPrice: 80 } as any),
    ).toBe(0);
  });
});

describe("health kit availability", () => {
  it("is limited by the scarcest included product", async () => {
    const db = dbFor([
      product("a", { stockQuantity: 20 }),
      product("b", { stockQuantity: 7 }),
    ]);
    const availability = await getHealthKitAvailability(
      db,
      kit([
        { productId: "a", quantity: 2 },
        { productId: "b", quantity: 1 },
      ]),
      NOW,
    );

    expect(availability.available).toBe(true);
    expect(availability.maxQuantity).toBe(7);
  });

  it("accounts for multi-unit quantities inside one kit", async () => {
    const db = dbFor([
      product("a", { stockQuantity: 9 }),
      product("b", { stockQuantity: 50 }),
    ]);
    const availability = await getHealthKitAvailability(
      db,
      kit([
        { productId: "a", quantity: 3 },
        { productId: "b", quantity: 2 },
      ]),
      NOW,
    );

    expect(availability.maxQuantity).toBe(3);
  });

  it("never counts inactive, missing or expired products as sellable", async () => {
    const db = dbFor([
      product("active", { stockQuantity: 12 }),
      product("inactive", { stockQuantity: 50, isActive: false }),
      product("expired", { stockQuantity: 50, expiryDate: NOW - DAY }),
    ]);

    const inactive = await getHealthKitAvailability(
      db,
      kit([
        { productId: "active", quantity: 1 },
        { productId: "inactive", quantity: 1 },
      ]),
      NOW,
    );
    expect(inactive.available).toBe(false);
    expect(inactive.maxQuantity).toBe(0);

    const expired = await getHealthKitAvailability(
      db,
      kit([
        { productId: "active", quantity: 1 },
        { productId: "expired", quantity: 1 },
      ]),
      NOW,
    );
    expect(expired.available).toBe(false);

    const missing = await getHealthKitAvailability(
      db,
      kit([
        { productId: "active", quantity: 1 },
        { productId: "not-there", quantity: 1 },
      ]),
      NOW,
    );
    expect(missing.available).toBe(false);
    expect(missing.unavailableReason).toContain("out of stock");
  });

  it("treats an inactive kit as unavailable even when components are stocked", async () => {
    const db = dbFor([product("a", { stockQuantity: 20 })]);
    const inactiveKit = kit([{ productId: "a", quantity: 1 }]);
    inactiveKit.isActive = false;

    const availability = await getHealthKitAvailability(db, inactiveKit, NOW);
    expect(availability.available).toBe(false);
    expect(availability.maxQuantity).toBe(20);
  });
});
