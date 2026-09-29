import { describe, expect, it } from "vitest";
import {
  isVerifiedProductImage,
  matchesProductIdentity,
  needsProductImageRepair,
} from "@/convex/productImageResolver";

/**
 * These are the rules that stop "Dolo 650" from being given an image of Dolo
 * 500, Dolo Cold, Dolopar or a generic paracetamol pack.
 */
describe("product image exact-match verification", () => {
  it("accepts the same product under a differently worded catalogue title", () => {
    expect(
      matchesProductIdentity("Dolo 650Mg Strip Of 15 Tablets", {
        productName: "Dolo 650",
      }),
    ).toBe(true);
    expect(
      matchesProductIdentity("Crocin 650Mg Strip Of 15 Tablets", {
        productName: "Crocin 650 Tablet",
        form: "tablet",
      }),
    ).toBe(true);
    expect(
      matchesProductIdentity("Omez 20Mg Strip Of 30 Capsules", {
        productName: "Omez 20",
        form: "capsule",
      }),
    ).toBe(true);
  });

  it("requires every meaningful word of the entered name", () => {
    expect(
      matchesProductIdentity("Volini Pain Relief | Gel | 100 Gm", {
        productName: "Volini Pain Relief Gel",
        brand: "Volini",
      }),
    ).toBe(true);
    // Missing "relief" and the strength: not the product that was asked for.
    expect(
      matchesProductIdentity("Ensure | Nutrition Drink | Vanilla | Box 950 Gm", {
        productName: "Ensure Diabetes Care 950g",
      }),
    ).toBe(false);
  });

  it("rejects a different strength", () => {
    expect(
      matchesProductIdentity("Dolo 500Mg Strip Of 15 Tablets", {
        productName: "Dolo 650",
      }),
    ).toBe(false);
    expect(
      matchesProductIdentity("Azee 250Mg Strip Of 5 Tablets", {
        productName: "Azee 500",
      }),
    ).toBe(false);
  });

  it("rejects a different product that merely starts with the brand", () => {
    // "Dolopar" contains "dolo" as a substring but is a different product.
    expect(
      matchesProductIdentity("Dolopar 650Mg Strip Of 15 Tablets", {
        productName: "Dolo 650",
        brand: "Dolo",
      }),
    ).toBe(false);
  });

  it("rejects the generic composition listing for a branded product", () => {
    expect(
      matchesProductIdentity("Paracetamol / Acetaminophen(650.0 Mg)", {
        productName: "Dolo 650",
        brand: "Dolo",
      }),
    ).toBe(false);
  });

  it("rejects a different dosage form stated in the name", () => {
    expect(
      matchesProductIdentity("Volini Pain Relief | Spray | 55 G", {
        productName: "Volini Pain Relief Gel",
        brand: "Volini",
      }),
    ).toBe(false);
  });

  it("treats the pack size as a preference, never a rejection", () => {
    // The exact 950 g pack is not always listed; the same product in another
    // pack size is still the exact product, so it is accepted.
    expect(
      matchesProductIdentity(
        "Ensure | Diabetes Care Nutrition Drink | Rich Chocolate | Box | 200 Gm",
        { productName: "Ensure Diabetes Care", packSize: "950 g" },
      ),
    ).toBe(true);
  });

  it("uses the manufacturer as a supporting signal", () => {
    expect(
      matchesProductIdentity(
        "Dolo 650Mg Strip Of 15 Tablets",
        { productName: "Dolo 650", manufacturer: "Micro Labs Ltd" },
        "MICRO LABS",
      ),
    ).toBe(true);
  });
});

describe("stored product image audit", () => {
  it("treats a Convex storage image as verified", () => {
    expect(
      isVerifiedProductImage(
        "https://dutiful-fox-804.convex.cloud/api/storage/12384adb-98cb-45ce-a547-cc07ec363b7d",
      ),
    ).toBe(true);
    expect(needsProductImageRepair(
      "https://dutiful-fox-804.convex.cloud/api/storage/12384adb-98cb-45ce-a547-cc07ec363b7d",
    )).toBe(false);
  });

  it("flags placeholders, missing values and third-party images", () => {
    // The generated placeholder the old flow wrote.
    expect(needsProductImageRepair("data:image/svg+xml,%3Csvg%3E%3C/svg%3E")).toBe(true);
    expect(needsProductImageRepair("")).toBe(true);
    expect(needsProductImageRepair(undefined)).toBe(true);
    expect(needsProductImageRepair("not-a-url")).toBe(true);
    // A chemical structure from Wikipedia, and any other external URL.
    expect(
      needsProductImageRepair(
        "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6c/Paracetamol-3D-balls.png/400px-Paracetamol-3D-balls.png",
      ),
    ).toBe(true);
  });
});
