import { describe, it, expect } from "vitest";
import {
  dosageFormFrom,
  strengthFrom,
  packCounts,
  parseCatalogueProduct,
  catalogueProductMatchesIdentity,
  parseLabelProduct,
  labelProductMatchesIdentity,
  parseJsonLdProduct,
  type CatalogueProduct,
  type LabelProduct,
} from "@/convex/productMetadataResolver";
import { strengthFromProductName } from "@/convex/productBackfill";
import { findVerifiedReference } from "@/convex/productReference";
import type { ProductIdentity } from "@/convex/productImageResolver";

/** A real catalogue record shape (pharmacy catalogue search payload). */
const CATALOGUE_RECORD = {
  name: "Augmentin Duo 625Mg Strip Of 10 Tablets",
  manufacturer: "GLAXOSMITHKLINE",
  consumerBrandName: "AUGMENTIN",
  measurementUnit: "10 Tablet(s) in Strip",
  subtitleText: "10 Tablet(s) in Strip",
  shortSubtitleText: "10 Tablet(s)",
  packform: "STRIP",
  isRxRequired: 1,
  slug: "augmentin-duo-625mg-strip-of-10-tablets-11551",
  compositions: [
    { name: "Amoxycillin / Amoxicillin(500.0 Mg)+Clavulanic Acid(125.0 Mg)" },
  ],
};

describe("online product metadata — reading what a source states", () => {
  it("reads the identity fields the catalogue publishes", () => {
    const product = parseCatalogueProduct(CATALOGUE_RECORD);
    expect(product).not.toBeNull();
    expect(product!.productName).toBe("Augmentin Duo 625Mg Strip Of 10 Tablets");
    expect(product!.brand).toBe("Augmentin");
    expect(product!.manufacturer).toBe("Glaxosmithkline");
    expect(product!.composition).toContain("Amoxycillin");
    expect(product!.prescriptionRequired).toBe(true);
  });

  it("uses the product's own strength, not its ingredient amounts", () => {
    const product = parseCatalogueProduct(CATALOGUE_RECORD)!;
    // The product is sold as 625 mg; 500 mg / 125 mg are the two ingredients.
    expect(product.strength).toBe("625 mg");
  });

  it("falls back to a single unambiguous composition dose when the name states none", () => {
    const product = parseCatalogueProduct({
      ...CATALOGUE_RECORD,
      name: "Dolo",
      compositions: [{ name: "Paracetamol / Acetaminophen(650.0 Mg)" }],
    })!;
    expect(product.strength).toBe("650 mg");
  });

  it("does not invent a form for a product that states none", () => {
    const product = parseCatalogueProduct({
      ...CATALOGUE_RECORD,
      name: "Prega News One Step Urine Hcg Pregnancy Test Kit",
      measurementUnit: "1 Test Kit(s) in Packet",
      subtitleText: "1 Test Kit(s)",
      shortSubtitleText: "1 Test Kit(s)",
      packform: "PACKET",
    })!;
    expect(product.form).toBeNull();
    expect(product.packSize).toBe("1 Test Kit(s) in Packet");
  });

  it("never repeats the same pack size stated in several fields", () => {
    expect(parseCatalogueProduct(CATALOGUE_RECORD)!.packSize).toBe(
      "10 Tablet(s) in Strip",
    );
  });

  it("returns null for a record with no product name", () => {
    expect(parseCatalogueProduct({ manufacturer: "GLAXOSMITHKLINE" })).toBeNull();
  });

  it("leaves the prescription flag null when the source does not state one", () => {
    const withoutFlag: Record<string, unknown> = { ...CATALOGUE_RECORD };
    delete withoutFlag.isRxRequired;
    expect(parseCatalogueProduct(withoutFlag)!.prescriptionRequired).toBeNull();
  });
});

describe("reading dosage forms and strengths", () => {
  it.each([
    ["Dolo 650Mg Strip Of 15 Tablets", "tablet"],
    ["Azithral 500Mg Soft Gelatin Capsule", "softgel capsule"],
    ["Digene Acidity Gel 200ml", "gel"],
    ["Iodex Extra Power Cream", "cream"],
    ["Benadryl Cough Syrup", "syrup"],
    ["Toba Eye Drops", "eye drops"],
    ["Asthalin Inhaler", "inhaler"],
    ["Taxim 200 Injection", "injection"],
  ])("reads %s as a %s", (name, form) => {
    expect(dosageFormFrom(name)).toBe(form);
  });

  it("does not mistake a pack container for a dosage form", () => {
    expect(dosageFormFrom("Augmentin Duo Strip Of 10 Tablets")).toBe("tablet");
    expect(dosageFormFrom("Nivea Soft Cream Tube")).toBe("cream");
  });

  it("extracts strengths but not container sizes", () => {
    expect(strengthFrom("Amoxicillin(500.0 Mg)+Clavulanic Acid(125.0 Mg)")).toBe(
      "500 mg + 125 mg",
    );
    expect(strengthFrom("Cetaphil Gentle Skin Cleanser 125 ml")).toBeNull();
  });

  it("reads pack counts in either order", () => {
    expect(packCounts("Strip Of 10 Tablets")).toContain(10);
    expect(packCounts("10 Tablet(s) in Strip")).toContain(10);
    expect(packCounts("Augmentin Duo 625Mg Strip Of 10 Tablets")).toEqual([10]);
  });
});

describe("exact product matching", () => {
  const product = parseCatalogueProduct(CATALOGUE_RECORD)!;
  const identity: ProductIdentity = { productName: "Augmentin 625 Duo" };

  it("accepts the same product under the catalogue's own longer title", () => {
    expect(catalogueProductMatchesIdentity(product, identity)).toBe(true);
  });

  it("rejects another strength", () => {
    expect(
      catalogueProductMatchesIdentity(product, {
        productName: "Augmentin 375 Duo",
      }),
    ).toBe(false);
  });

  it("rejects another dosage form", () => {
    expect(
      catalogueProductMatchesIdentity(product, {
        productName: "Augmentin 625 Duo",
        form: "syrup",
      }),
    ).toBe(false);
  });

  it("rejects another pack size", () => {
    expect(
      catalogueProductMatchesIdentity(product, {
        productName: "Augmentin 625 Duo",
        packSize: "15 tablets",
      }),
    ).toBe(false);
  });

  it("accepts the pack size it actually offers", () => {
    expect(
      catalogueProductMatchesIdentity(product, {
        productName: "Augmentin 625 Duo",
        packSize: "10 tablets",
      }),
    ).toBe(true);
  });

  it("rejects another brand that shares a name word", () => {
    expect(
      catalogueProductMatchesIdentity(product, {
        productName: "Augmentin 625 Duo",
        brand: "Amoxil",
      }),
    ).toBe(false);
  });

  it("rejects a different manufacturer for the same molecule", () => {
    expect(
      catalogueProductMatchesIdentity(product, {
        productName: "Augmentin 625 Duo",
        manufacturer: "Ranbaxy Laboratories",
      }),
    ).toBe(false);
  });

  it("accepts a record whose manufacturer field is just the product's own brand", () => {
    // The catalogue publishes the consumer brand where it means the maker, so a
    // label must not be read as a conflicting manufacturer.
    const labelled = parseCatalogueProduct({
      name: "Volini Pain Relief | Gel | 100 Gm",
      manufacturer: "VOLINI",
      measurementUnit: "100g Gel in Tube",
    })!;
    expect(
      catalogueProductMatchesIdentity(labelled, {
        productName: "Volini Gel",
        form: "gel",
        manufacturer: "Reckitt",
      }),
    ).toBe(true);
  });

  it("rejects an unrelated product entirely", () => {
    expect(
      catalogueProductMatchesIdentity(product, { productName: "Brufen 400mg" }),
    ).toBe(false);
  });
});

describe("a product must not inherit a different variant's local record", () => {
  it("reads the strength the admin wrote into the name", () => {
    expect(strengthFromProductName("Augmentin 625 Duo")).toBe("625 mg");
    expect(strengthFromProductName("Dolo 650")).toBe("650 mg");
    expect(strengthFromProductName("Brufen 400mg")).toBe("400 mg");
    expect(strengthFromProductName("Cetaphil Gentle Cleanser")).toBeUndefined();
  });

  it("keeps the 1000mg reference record away from the 625mg product", () => {
    // The catalogue lists "Augmentin" at 1000 mg; the 625 Duo is a different
    // product and must not inherit that composition.
    const naive = findVerifiedReference({ name: "Augmentin 625 Duo" });
    const guarded = findVerifiedReference({
      name: "Augmentin 625 Duo",
      strength: strengthFromProductName("Augmentin 625 Duo") ?? null,
    });
    expect(naive.reference?.composition).toContain("1000mg");
    expect(guarded.reference).toBeNull();
  });

  it("still matches a reference record that does state this strength", () => {
    const found = findVerifiedReference({
      name: "Dolo 650",
      strength: strengthFromProductName("Dolo 650") ?? null,
    });
    expect(found.reference?.composition).toBe("Paracetamol 650mg");
  });
});

describe("structured drug labels", () => {
  const label = {
    openfda: {
      brand_name: ["Augmentin"],
      generic_name: ["AMOXICILLIN AND CLAVULANATE POTASSIUM"],
      manufacturer_name: ["Chartwell RX, LLC"],
    },
    active_ingredient: "AMOXICILLIN 500mg and CLAVULANATE POTASSIUM 125mg",
    dosage_form: ["TABLET"],
    indications_and_usage: ["Indicated for treatment of bacterial infections."],
    warnings: ["May cause allergic reactions."],
    storage_and_handling: ["Store at 20 to 25 degrees C."],
  };

  it("carries over only the fields the label states", () => {
    const product = parseLabelProduct(label)!;
    expect(product.productName).toBe("Augmentin");
    // A name a source states in mixed case is left exactly as stated.
    expect(product.manufacturer).toBe("Chartwell RX, LLC");
    expect(product.form).toBe("tablet");
    expect(product.benefits).toContain("bacterial infections");
    expect(product.storage).toContain("20 to 25");
    expect(product.directions).toBeNull();
  });

  it("rejects a label for a different strength or form", () => {
    const product = parseLabelProduct(label)! as LabelProduct;
    expect(
      labelProductMatchesIdentity(product, {
        productName: "Augmentin",
        strength: "875 mg",
      }),
    ).toBe(false);
    expect(
      labelProductMatchesIdentity(product, {
        productName: "Augmentin",
        form: "syrup",
      }),
    ).toBe(false);
  });

  it("returns null for a label with no product name", () => {
    expect(parseLabelProduct({ openfda: {} })).toBeNull();
  });
});

describe("a brand's own product page", () => {
  it("reads the product it publishes", () => {
    const html = `<script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: "Volini Pain Relief Gel",
      brand: { "@type": "Brand", name: "Volini" },
      description: "Volini is a topical pain relief gel.",
      category: "Health",
    })}</script>`;
    const product = parseJsonLdProduct(html)!;
    expect(product.productName).toBe("Volini Pain Relief Gel");
    expect(product.brand).toBe("Volini");
    expect(product.description).toContain("topical pain relief gel");
  });

  it("returns null for a page with no product schema", () => {
    expect(parseJsonLdProduct("<html><body>No schema here</body></html>")).toBeNull();
  });
});

describe("catalogue records for other kinds of product", () => {
  it("keeps a syrup a syrup and a cream a cream", () => {
    const syrup = parseCatalogueProduct({
      name: "Benadryl Cough Formula Syrup 100ml",
      manufacturer: "JOHNSON AND JOHNSON",
      measurementUnit: "100ml Bottle",
      packform: "BOTTLE",
    }) as CatalogueProduct;
    expect(syrup.form).toBe("syrup");

    const cream = parseCatalogueProduct({
      name: "Iodex Extra Power Pain Relief Cream",
      manufacturer: "GLAXOSMITHKLINE",
      measurementUnit: "Tube Of 60 G",
      packform: "TUBE",
    }) as CatalogueProduct;
    expect(cream.form).toBe("cream");
  });
});
