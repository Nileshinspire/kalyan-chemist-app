import { describe, expect, it } from "vitest";
import {
  isPackshotImageCandidate,
  isPackshotLookingUrl,
  isVerifiedProductImage,
  matchesProductIdentity,
  needsProductImageRepair,
} from "@/convex/productImageResolver";

/**
 * These are the rules that stop "Dolo 650" from being given an image of Dolo
 * 500, Dolo Cold, Dolopar or a generic paracetamol pack, while still allowing
 * the same product when a source words its name or its dosage form differently.
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
    // A strength entered in its own field is part of the identity too.
    expect(
      matchesProductIdentity("Thyronorm 75Bottle Of 120Tablets", {
        productName: "Thyronorm 75",
        strength: "75mcg",
      }),
    ).toBe(true);
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

  it("matches a singular/plural difference in the same product", () => {
    expect(
      matchesProductIdentity("Mamaearth Gentle Cleansing Shampoo For Babies - 200Ml", {
        productName: "Mamaearth Baby Shampoo",
        brand: "Mamaearth",
        form: "shampoo",
      }),
    ).toBe(true);
  });
});

describe("dosage form verification", () => {
  it("accepts a source's synonym for the same dosage form", () => {
    // A syrup is routinely listed by a catalogue as an "expectorant".
    expect(
      matchesProductIdentity("Ascoril Ls Bottle Of 100Ml Expectorant", {
        productName: "Ascoril LS Syrup",
        brand: "Ascoril",
        form: "syrup",
      }),
    ).toBe(true);
  });

  it("rejects a different dosage form, including a close relative", () => {
    // A lotion is never a cream, even for the same brand.
    expect(
      matchesProductIdentity("Himalaya Gentle Baby Cream 200 Ml", {
        productName: "Himalaya Baby Lotion",
        brand: "Himalaya",
        form: "lotion",
      }),
    ).toBe(false);
    // A body wash is not a shampoo.
    expect(
      matchesProductIdentity("Mamaearth Gentle Cleansing Shampoo For Babies", {
        productName: "Mamaearth Baby Wash",
        brand: "Mamaearth",
        form: "wash",
      }),
    ).toBe(false);
    // The form stated in the admin form field counts as identity as well.
    expect(
      matchesProductIdentity("Dolo 650Mg Strip Of 15 Tablets", {
        productName: "Dolo 650",
        form: "syrup",
      }),
    ).toBe(false);
  });

  it("reads the dosage field as a form hint when the name has none", () => {
    expect(
      matchesProductIdentity("Benadryl Cough Formula Bottle Of 150Ml Syrup", {
        productName: "Benadryl",
        brand: "Benadryl",
        dosage: "2.5 ml syrup twice a day",
      }),
    ).toBe(true);
    expect(
      matchesProductIdentity("Benadryl DrMenthol Strip Of 10 Tablets", {
        productName: "Benadryl",
        brand: "Benadryl",
        dosage: "2.5 ml syrup twice a day",
      }),
    ).toBe(false);
  });
});

describe("packshot image filtering", () => {
  it("keeps a real packshot whose own product name contains a noise word", () => {
    // "Formula" is part of this product's name, not a chemical diagram.
    expect(
      isPackshotImageCandidate(
        "https://cdn01.pharmeasy.in/dam/productsnowatermark/022615/benadryl-cough-formula-bottle-of-150ml-syrup-side-6.1-1785588733-non-watermark.jpg",
        { productName: "Benadryl Cough Syrup", brand: "Benadryl" },
        "Benadryl Cough Formula Bottle Of 150Ml Syrup",
      ),
    ).toBe(true);
  });

  it("rejects logos, diagrams, placeholders and non-image files", () => {
    const identity = { productName: "Dolo 650", brand: "Dolo" };
    expect(
      isPackshotImageCandidate(
        "https://cdn01.pharmeasy.in/dam/productsnowatermark/022615/paracetamol-molecule-diagram.jpg",
        identity,
      ),
    ).toBe(false);
    expect(
      isPackshotImageCandidate(
        "https://cdn01.pharmeasy.in/dam/brand/micro-labs-logo.png",
        identity,
      ),
    ).toBe(false);
    expect(
      isPackshotImageCandidate(
        "https://cdn01.pharmeasy.in/dam/products/placeholder-product-image.jpg",
        identity,
      ),
    ).toBe(false);
    expect(
      isPackshotImageCandidate(
        "https://example.com/assets/dolo-650mg-strip-front-2.jpg",
        identity,
      ),
    ).toBe(true);
  });

  it("rejects hand-held, customer and lifestyle photos", () => {
    const identity = { productName: "Dolo 650", brand: "Dolo" };
    expect(
      isPackshotImageCandidate(
        "https://example.com/media/dolo-650-person-holding-strip.jpg",
        identity,
      ),
    ).toBe(false);
    expect(
      isPackshotImageCandidate(
        "https://example.com/media/dolo-650-in-hand.jpg",
        identity,
      ),
    ).toBe(false);
    expect(
      isPackshotImageCandidate(
        "https://example.com/uploads/customer-review-dolo-650.jpg",
        identity,
      ),
    ).toBe(false);
    expect(
      isPackshotImageCandidate(
        "https://example.com/wp-content/uploads/2023/05/dolo-650-lifestyle-shot.jpg",
        identity,
      ),
    ).toBe(false);
    expect(
      isPackshotImageCandidate(
        "https://example.com/assets/dolo-650-camera-closeup.jpg",
        identity,
      ),
    ).toBe(false);
  });

  it("rejects camera-roll and screenshot file names", () => {
    const identity = { productName: "Dolo 650", brand: "Dolo" };
    expect(
      isPackshotImageCandidate("https://example.com/uploads/IMG_2043.jpg", identity),
    ).toBe(false);
    expect(
      isPackshotImageCandidate(
        "https://example.com/uploads/PXL_20230514_093355.jpg",
        identity,
      ),
    ).toBe(false);
    expect(
      isPackshotImageCandidate(
        "https://example.com/uploads/WhatsApp_Image_2023-05-14.jpg",
        identity,
      ),
    ).toBe(false);
    // A catalogue asset whose name merely ends in a digit is untouched.
    expect(
      isPackshotImageCandidate(
        "https://example.com/assets/dolo-650mg-strip-front-2.jpg",
        identity,
      ),
    ).toBe(true);
  });

  it("rejects social, stock-photo and wiki hosts", () => {
    const identity = { productName: "Dolo 650", brand: "Dolo" };
    expect(
      isPackshotImageCandidate(
        "https://scontent.cdninstagram.com/v/t51/dolo-650-front.jpg",
        identity,
      ),
    ).toBe(false);
    expect(
      isPackshotImageCandidate("https://i.imgur.com/abc123.png", identity),
    ).toBe(false);
    expect(
      isPackshotImageCandidate(
        "https://upload.wikimedia.org/wikipedia/commons/dolo-650-3d-balls.png",
        identity,
      ),
    ).toBe(false);
    expect(
      isPackshotImageCandidate(
        "https://www.shutterstock.com/image-photo/dolo-650-strip-front.jpg",
        identity,
      ),
    ).toBe(false);
  });

  it("keeps a clean white-background packshot and name words that look like noise", () => {
    expect(
      isPackshotImageCandidate(
        "https://cdn01.pharmeasy.in/dam/productsnowatermark/022615/dolo-650mg-strip-of-15-tablets-front-2-non-watermark.jpg",
        { productName: "Dolo 650", brand: "Dolo" },
      ),
    ).toBe(true);
    // "Hand" is this product's own name, not a hand-held photo.
    expect(
      isPackshotImageCandidate(
        "https://example.com/media/dettol-hand-wash-250ml.jpg",
        { productName: "Dettol Hand Wash", brand: "Dettol" },
      ),
    ).toBe(true);
    // "Arm" belongs to "Arm Sling Support", so its packshot survives too.
    expect(
      isPackshotImageCandidate(
        "https://example.com/media/arm-sling-support.jpg",
        { productName: "Arm Sling Support" },
      ),
    ).toBe(true);
  });
});

describe("packshot provenance", () => {
  it("accepts a catalogue packshot asset", () => {
    expect(
      isPackshotLookingUrl(
        "https://cdn01.pharmeasy.in/dam/productsnowatermark/059346/dolo-650mg-strip-of-15-tablets-front-2-non-watermark.jpg",
      ),
    ).toBe(true);
  });

  it("rejects a person, lifestyle or stock-photo source", () => {
    expect(
      isPackshotLookingUrl(
        "https://scontent.cdninstagram.com/v/t51/dolo-650-front.jpg",
      ),
    ).toBe(false);
    expect(
      isPackshotLookingUrl(
        "https://example.com/media/dolo-650-person-holding-strip.jpg",
      ),
    ).toBe(false);
    expect(
      isPackshotLookingUrl("https://i.imgur.com/abc123.png"),
    ).toBe(false);
    expect(isPackshotLookingUrl("https://example.com/lifestyle-dolo.jpg")).toBe(
      false,
    );
  });

  it("treats a missing source as unknown, never as a packshot", () => {
    expect(isPackshotLookingUrl("")).toBe(false);
    expect(isPackshotLookingUrl(undefined)).toBe(false);
  });
});

describe("stored product image audit", () => {
  it("treats a Convex storage image as verified", () => {
    expect(
      isVerifiedProductImage(
        "https://dutiful-fox-804.convex.cloud/api/storage/12384adb-98cb-45ce-a547-cc07ec363b7d",
      ),
    ).toBe(true);
    expect(
      needsProductImageRepair(
        "https://dutiful-fox-804.convex.cloud/api/storage/12384adb-98cb-45ce-a547-cc07ec363b7d",
      ),
    ).toBe(false);
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
