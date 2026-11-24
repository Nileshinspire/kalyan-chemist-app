import { describe, expect, it } from "vitest";
import {
  buildCustomKitQuote,
  computeAutoKitPrice,
  parseKitSelection,
  resolveBaseKitPrice,
  serializeKitSelection,
  type KitPricedComponent,
} from "@/lib/healthKitQuote";

function component(
  productId: string,
  configuredQuantity: number,
  effectiveUnitPrice: number,
  overrides: Partial<KitPricedComponent> = {},
): KitPricedComponent {
  return {
    productId,
    name: `Product ${productId}`,
    configuredQuantity,
    mrp: effectiveUnitPrice * 2,
    effectiveUnitPrice,
    stockQuantity: 20,
    isActive: true,
    ...overrides,
  };
}

describe("health kit proportional customization", () => {
  it("allocates the exact kit price across the included value", () => {
    const quote = buildCustomKitQuote({
      components: [
        component("a", 2, 100),
        component("b", 1, 150),
        component("c", 3, 50),
      ],
      basePrice: 500,
    });

    expect(quote.components.map((line) => line.allocatedPrice)).toEqual([
      200, 150, 150,
    ]);
    expect(quote.customizedPrice).toBe(500);
    expect(quote.isCustomized).toBe(false);
    expect(quote.available).toBe(true);
  });

  it("removes the product's proportional kit-price share, not its MRP", () => {
    const quote = buildCustomKitQuote({
      components: [
        component("a", 1, 400),
        component("b", 1, 300),
        component("c", 1, 300),
      ],
      basePrice: 1000,
      selection: [
        { productId: "a", quantity: 1 },
        { productId: "b", quantity: 1 },
        { productId: "c", quantity: 0 },
      ],
    });

    expect(quote.customizedPrice).toBe(700);
    expect(quote.basePrice).toBe(1000);
    expect(quote.isCustomized).toBe(true);
    expect(quote.selectedProductCount).toBe(2);
    expect(quote.removedProductCount).toBe(1);
  });

  it("handles paise rounding and still sums exactly to the kit price", () => {
    const quote = buildCustomKitQuote({
      components: [
        component("a", 1, 1),
        component("b", 1, 1),
        component("c", 1, 1),
      ],
      basePrice: 100,
    });
    const total = quote.components.reduce(
      (sum, line) => sum + Math.round(line.allocatedPrice * 100),
      0,
    );
    expect(total).toBe(10000);
    expect(quote.customizedPrice).toBe(100);
  });

  it("supports reducing a multi-unit line without going negative", () => {
    const quote = buildCustomKitQuote({
      components: [
        component("a", 3, 100),
        component("b", 1, 500),
      ],
      basePrice: 800,
      selection: [
        { productId: "a", quantity: 1 },
        { productId: "b", quantity: 1 },
      ],
    });

    expect(quote.totalUnits).toBe(2);
    expect(quote.customizedPrice).toBeGreaterThan(0);
    expect(quote.customizedPrice).toBeLessThan(quote.basePrice);
    expect(quote.components[0].allocatedPrice).toBeLessThan(300);
    expect(quote.components[0].removedQuantity).toBe(2);
  });

  it("recalculates availability for the selected composition", () => {
    const components = [
      component("a", 1, 100, { stockQuantity: 10 }),
      component("b", 1, 100, { stockQuantity: 2 }),
    ];
    const full = buildCustomKitQuote({ components, basePrice: 180 });
    expect(full.maxQuantity).toBe(2);
    expect(full.available).toBe(true);

    const withoutLimiting = buildCustomKitQuote({
      components,
      basePrice: 180,
      selection: [
        { productId: "a", quantity: 1 },
        { productId: "b", quantity: 0 },
      ],
    });
    expect(withoutLimiting.maxQuantity).toBe(10);
    expect(withoutLimiting.available).toBe(true);
    expect(withoutLimiting.customizedPrice).toBeGreaterThan(0);
  });

  it("marks a configuration unavailable when every product is removed", () => {
    const quote = buildCustomKitQuote({
      components: [component("a", 1, 100)],
      basePrice: 80,
      selection: [{ productId: "a", quantity: 0 }],
    });
    expect(quote.available).toBe(false);
    expect(quote.maxQuantity).toBe(0);
    expect(quote.customizedPrice).toBe(0);
  });
});

describe("health kit automatic pricing", () => {
  it("applies the kit-level discount once to effective prices", () => {
    expect(computeAutoKitPrice(500, 10)).toBe(450);
    expect(computeAutoKitPrice(500, 0)).toBe(500);
    expect(computeAutoKitPrice(500, 120)).toBe(5);
  });

  it("keeps a manual price but never charges above current catalogue value", () => {
    expect(
      resolveBaseKitPrice({
        mode: "manual",
        kitDiscountPercent: 0,
        storedPrice: 900,
        effectiveCatalogueValue: 1000,
      }),
    ).toBe(900);
    expect(
      resolveBaseKitPrice({
        mode: "manual",
        kitDiscountPercent: 0,
        storedPrice: 900,
        effectiveCatalogueValue: 800,
      }),
    ).toBe(800);
  });
});

describe("kit selection URL helpers", () => {
  it("round-trips without zero quantities", () => {
    const serialized = serializeKitSelection([
      { productId: "a", quantity: 2 },
      { productId: "b", quantity: 0 },
      { productId: "c", quantity: 1 },
    ]);
    expect(serialized).toBe("a:2,c:1");
    expect(parseKitSelection(serialized)).toEqual([
      { productId: "a", quantity: 2 },
      { productId: "c", quantity: 1 },
    ]);
  });
});
