import { describe, it, expect } from "vitest";
import {
  classifyProduct,
  productDirections,
  productSafety,
  isMedicine,
  isOral,
  type ProductIdentity,
} from "@/convex/productInfo";

/**
 * End-to-end coverage of the reported problem across the product types the
 * pharmacy actually sells. Every product must receive information that belongs
 * to it, and medicine instructions must never leak onto a product that is not
 * taken by mouth.
 */
const PRODUCTS: Array<{ label: string; input: ProductIdentity; expectKind: string }> = [
  { label: "tablet", expectKind: "oral_tablet", input: { name: "Dolo 650", form: "tablet", composition: "Paracetamol 650mg", manufacturer: "Micro Labs" } },
  { label: "capsule", expectKind: "oral_capsule", input: { name: "Omez 20", form: "capsule", composition: "Omeprazole 20mg", manufacturer: "Dr. Reddy's" } },
  { label: "syrup", expectKind: "oral_syrup", input: { name: "Ascoril LS Syrup", form: "syrup", composition: "Levosalbutamol + Ambroxol + Cetirizine", manufacturer: "Cipla" } },
  { label: "condom", expectKind: "condom", input: { name: "manforce condom", form: "tablet", manufacturer: "JK Consumer" } },
  { label: "cream", expectKind: "topical", input: { name: "Betnovate-N Cream", form: "cream", composition: "Betamethasone valerate + Neomycin", manufacturer: "GSK" } },
  { label: "nutrition", expectKind: "nutrition", input: { name: "Ensure Diabetes Care", form: "tablet", manufacturer: "Abbott" } },
  { label: "device", expectKind: "device", input: { name: "Accu-Chek Active Test Strips", form: "tablet", manufacturer: "Roche" } },
  { label: "eye drops", expectKind: "eye_drop", input: { name: "Ciplox Eye Drops", form: "eye drops", composition: "Ciprofloxacin", manufacturer: "Cipla" } },
];

const ORAL_MARKERS = /orally|swallow|with (a glass of )?water|dose schedule|full course|miss a dose/i;

describe("product-specific information by product type", () => {
  it.each(PRODUCTS)("$label is classified correctly", ({ input, expectKind }) => {
    expect(classifyProduct(input).kind).toBe(expectKind);
  });

  it.each(PRODUCTS)("$label gets directions that belong to it", ({ input, expectKind }) => {
    const kind = classifyProduct(input).kind;
    const directions = productDirections(input, kind);
    expect(directions).toBeTruthy();

    if (isOral(kind)) {
      // Oral medicines may legitimately describe swallowing.
      expect(directions!.toLowerCase()).toMatch(/swallow|by mouth|dissolve/);
    } else {
      // Everything else must not be told to swallow anything.
      expect(directions).not.toMatch(ORAL_MARKERS);
    }
  });

  it.each(PRODUCTS)("$label gets safety that belongs to it", ({ input, expectKind }) => {
    const kind = classifyProduct(input).kind;
    const safety = productSafety(input, kind);
    expect(safety).toBeTruthy();
    if (!isMedicine(kind)) {
      expect(safety).not.toMatch(ORAL_MARKERS);
    }
  });

  it("gives a different product completely different information", () => {
    const rendered = PRODUCTS.map(({ input }) => {
      const kind = classifyProduct(input).kind;
      return `${kind}|${productDirections(input, kind)}|${productSafety(input, kind)}`;
    });
    expect(new Set(rendered).size).toBe(PRODUCTS.length);
  });

  it("never shows medicine instructions on a condom, even with a tablet form", () => {
    // The exact reported failure.
    const input: ProductIdentity = { name: "Manforce Condom", form: "tablet" };
    const kind = classifyProduct(input).kind;
    expect(kind).toBe("condom");
    const directions = productDirections(input, kind)!;
    const safety = productSafety(input, kind)!;
    expect(directions).not.toMatch(ORAL_MARKERS);
    expect(safety).not.toMatch(ORAL_MARKERS);
    expect(directions.toLowerCase()).toContain("condom");
  });

  it("never shows medicine instructions on a device", () => {
    const input: ProductIdentity = { name: "Omron HEM-7090 Blood Pressure Monitor", form: "tablet" };
    const kind = classifyProduct(input).kind;
    expect(kind).toBe("device");
    expect(productDirections(input, kind)).not.toMatch(ORAL_MARKERS);
    expect(productSafety(input, kind)).not.toMatch(ORAL_MARKERS);
  });

  it("gives a topical cream skin directions, not swallowing ones", () => {
    const input: ProductIdentity = { name: "Volini Gel", form: "gel" };
    const kind = classifyProduct(input).kind;
    expect(kind).toBe("topical");
    const directions = productDirections(input, kind)!;
    expect(directions.toLowerCase()).toMatch(/skin|apply/);
    expect(directions).not.toMatch(ORAL_MARKERS);
  });

  it("gives a syrup measuring-device directions", () => {
    const input: ProductIdentity = { name: "Benadryl Cough Syrup", form: "syrup" };
    const kind = classifyProduct(input).kind;
    expect(kind).toBe("oral_syrup");
    expect(productDirections(input, kind)!.toLowerCase()).toMatch(/measuring/);
  });

  it("gives a nutrition product preparation directions", () => {
    const input: ProductIdentity = { name: "Ensure Diabetes Care", form: "tablet" };
    const kind = classifyProduct(input).kind;
    expect(kind).toBe("nutrition");
    const directions = productDirections(input, kind)!;
    expect(directions).not.toMatch(ORAL_MARKERS);
  });
});
