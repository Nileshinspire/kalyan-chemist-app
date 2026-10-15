import { describe, expect, it } from "vitest";
import {
  isExactDiscountMatch,
  normalizeDiscountPercent,
  productDiscountPercent,
  selectDiscountProducts,
} from "@/lib/discount";

/**
 * The homepage "Minimum N% Off" section is only correct if three things agree:
 * the percentage a product card renders, the percentage the section matches on,
 * and the set of products the section returns. All three read these helpers, so
 * these tests pin the behaviour that the section depends on.
 */
describe("productDiscountPercent", () => {
  it("is 0 for a product with no discount price", () => {
    expect(productDiscountPercent(150)).toBe(0);
    expect(productDiscountPercent(150, undefined)).toBe(0);
    expect(productDiscountPercent(150, null)).toBe(0);
  });

  it("is 0 when the selling price is not actually lower than the MRP", () => {
    expect(productDiscountPercent(150, 150)).toBe(0);
    expect(productDiscountPercent(150, 200)).toBe(0);
  });

  it("computes an exact discount", () => {
    expect(productDiscountPercent(300, 150)).toBe(50);
    expect(productDiscountPercent(100, 75)).toBe(25);
    expect(productDiscountPercent(100, 63)).toBe(37);
  });

  it("rounds the same way the card badge does", () => {
    // 100 -> 74 is 26% exactly; 1000 -> 666 is 33.4% -> 33 on the badge.
    expect(productDiscountPercent(100, 74)).toBe(26);
    expect(productDiscountPercent(1000, 666)).toBe(33);
    // 1/3 off rounds up to 33 and is reported as 33, not 33.33
    expect(productDiscountPercent(300, 200)).toBe(33);
    // 24.6% rounds to 25, so a card showing "25% OFF" is matched by 25.
    expect(productDiscountPercent(1000, 754)).toBe(25);
  });

  it("never divides by a zero price", () => {
    expect(productDiscountPercent(0, 0)).toBe(0);
  });
});

describe("isExactDiscountMatch", () => {
  const product = { price: 300, discountPrice: 225 }; // exactly 25% off

  it("matches only the exact configured percentage", () => {
    expect(isExactDiscountMatch(product.price, product.discountPrice, 25)).toBe(true);
    for (const other of [20, 24, 26, 30, 37, 50]) {
      expect(isExactDiscountMatch(product.price, product.discountPrice, other)).toBe(false);
    }
  });

  it("follows the configured percentage without any code change", () => {
    const at37 = { price: 100, discountPrice: 63 };
    expect(isExactDiscountMatch(at37.price, at37.discountPrice, 37)).toBe(true);
    expect(isExactDiscountMatch(at37.price, at37.discountPrice, 25)).toBe(false);
  });

  it("rejects a product with no discount, and an inactive product", () => {
    expect(isExactDiscountMatch(100, undefined, 25)).toBe(false);
    expect(isExactDiscountMatch(100, 75, 25, false)).toBe(false);
  });

  it("rejects a percentage that could never be displayed", () => {
    expect(isExactDiscountMatch(100, 75, 0)).toBe(false);
    expect(isExactDiscountMatch(100, 75, 25.5)).toBe(false);
    expect(isExactDiscountMatch(100, 75, 101)).toBe(false);
  });
});

describe("normalizeDiscountPercent", () => {
  it("accepts any whole percentage in range", () => {
    for (const value of [1, 7, 25, 37, 63, 99, 100]) {
      expect(normalizeDiscountPercent(value)).toBe(value);
    }
  });

  it("refuses values that can never match a displayed percentage", () => {
    expect(() => normalizeDiscountPercent(25.5)).toThrow(/whole number/i);
    expect(() => normalizeDiscountPercent(0)).toThrow(/between 1 and 100/i);
    expect(() => normalizeDiscountPercent(101)).toThrow(/between 1 and 100/i);
    expect(() => normalizeDiscountPercent(Number.NaN)).toThrow(/whole number/i);
  });
});

describe("selectDiscountProducts", () => {
  const rows = [
    { _id: "a", price: 400, discountPrice: 300, isActive: true }, // 25%
    { _id: "b", price: 100, discountPrice: 74, isActive: true }, // 26%
    { _id: "c", price: 100, discountPrice: 75, isActive: true }, // 25%
    { _id: "d", price: 300, discountPrice: 150, isActive: true }, // 50%
    { _id: "e", price: 1000, discountPrice: 750, isActive: true }, // 25%
    { _id: "f", price: 200, discountPrice: 150, isActive: true }, // 25%
    { _id: "g", price: 100, discountPrice: 75, isActive: false }, // 25% but inactive
    { _id: "h", price: 100, isActive: true }, // no discount
  ];

  it("discovers every exactly matching product across categories, and nothing else", () => {
    const { products, autoCount, manualCount } = selectDiscountProducts(rows, 25);
    expect(products.map((p) => p._id)).toEqual(["a", "c", "e", "f"]);
    expect(autoCount).toBe(4);
    expect(manualCount).toBe(0);
  });

  it("never returns a product at a different discount", () => {
    const { products } = selectDiscountProducts(rows, 25);
    expect(products.some((p) => p._id === "b" || p._id === "h")).toBe(false);
    const at26 = selectDiscountProducts(rows, 26);
    expect(at26.products.map((p) => p._id)).toEqual(["b"]);
  });

  it("updates the whole set when the percentage changes", () => {
    expect(selectDiscountProducts(rows, 50).products.map((p) => p._id)).toEqual(["d"]);
    expect(selectDiscountProducts(rows, 37).products).toEqual([]);
  });

  it("includes a manual pick that matches, exactly once, ahead of the auto matches", () => {
    const { products, autoCount, manualCount } = selectDiscountProducts(rows, 25, ["e", "c"]);
    expect(products.map((p) => p._id)).toEqual(["e", "c", "a", "f"]);
    expect(products.filter((p) => p._id === "c")).toHaveLength(1);
    expect(products.filter((p) => p._id === "e")).toHaveLength(1);
    expect(manualCount).toBe(2);
    expect(autoCount).toBe(2);
  });

  it("hides a manual pick whose price no longer matches and reports it", () => {
    // Pick "d" (50% off) while the section advertises 25%: it must not render,
    // and it must be reported so the admin can see why.
    const { products, droppedManualIds, manualCount } = selectDiscountProducts(rows, 25, ["d", "f"]);
    expect(products.map((p) => p._id)).toEqual(["f", "a", "c", "e"]);
    expect(droppedManualIds).toEqual(["d"]);
    expect(manualCount).toBe(1);
  });

  it("drops a manual pick as soon as its price changes", () => {
    const before = selectDiscountProducts(rows, 25, ["f"]);
    expect(before.products.map((p) => p._id)).toContain("f");
    const repriced = rows.map((r) => (r._id === "f" ? { ...r, discountPrice: 190 } : r)); // now 5%
    const after = selectDiscountProducts(repriced, 25, ["f"]);
    expect(after.products.map((p) => p._id)).not.toContain("f");
    expect(after.droppedManualIds).toEqual(["f"]);
  });

  it("lists a duplicated manual pick only once", () => {
    const { products, manualCount } = selectDiscountProducts(rows, 25, ["a", "a"]);
    expect(products.filter((p) => p._id === "a")).toHaveLength(1);
    expect(manualCount).toBe(1);
  });

  it("ignores an inactive product even when it matches and was picked by hand", () => {
    const { products, droppedManualIds } = selectDiscountProducts(rows, 25, ["g"]);
    expect(products.map((p) => p._id)).not.toContain("g");
    expect(droppedManualIds).toEqual(["g"]);
  });

  it("returns nothing when the catalogue has no such discount", () => {
    const { products } = selectDiscountProducts(rows, 63);
    expect(products).toEqual([]);
  });
});
