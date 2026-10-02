/**
 * Master Product Catalog pipeline tests.
 *
 * These cover the rules the whole Auto Fill flow depends on: only an exact
 * variant may be applied (never a different strength/form/pack/variant word),
 * images may only attach to the record they were imported with, and the
 * dataset importer recognises common Indian-pharma column names without manual
 * mapping. A small sample catalog (tablet, capsule, syrup, gel, OTC, Rx,
 * strength and pack variants) doubles as the end-to-end fixture.
 */
import { describe, expect, it, vi } from "vitest";
import {
  CATALOG_IMAGE_NOT_FOUND_MESSAGE,
  CATALOG_PRODUCT_NOT_FOUND_MESSAGE,
  assessCatalogMatch,
  identityKeyOf,
  mapColumns,
  normalizeName,
  orderCatalogImages,
  parseIdentity,
  parseMoney,
  parsePrescription,
  planZipImages,
  rowToRecord,
  verificationStatusFor,
  type IdentityInput,
} from "@/convex/masterCatalogCore";
import { parseCsv, tableFromCells, readXlsx, readZipEntries, isImageFilename } from "@/lib/catalogFiles";
import {
  PROVIDER_NOT_CONFIGURED_MESSAGE,
  createProductDataProvider,
  parseProviderRecord,
  providerConfigured,
} from "@/convex/productDataProvider";

// ── Sample catalog used across the tests ──

type Sample = {
  id: string;
  name: string;
  brand?: string;
  manufacturer: string;
  composition: string;
  strength?: string;
  form?: string;
  pack?: string;
  sku?: string;
  gtin?: string;
  rx?: boolean;
  category: string;
  image: string;
};

const SAMPLE_CATALOG: Sample[] = [
  {
    id: "DP-1", name: "Dolo 650 Tablet", brand: "Dolo", manufacturer: "Micro Labs Ltd",
    composition: "Paracetamol", strength: "650 mg", form: "tablet", pack: "15 tablets",
    sku: "DP-1-SKU", gtin: "8901234567890", rx: false, category: "Pain Relief",
    image: "DP-1",
  },
  {
    id: "DP-2", name: "Dolo 500 Tablet", brand: "Dolo", manufacturer: "Micro Labs Ltd",
    composition: "Paracetamol", strength: "500 mg", form: "tablet", pack: "15 tablets",
    sku: "DP-2-SKU", gtin: "8901234567891", rx: false, category: "Pain Relief",
    image: "DP-2",
  },
  {
    id: "DP-3", name: "Dolo Cold Tablet", brand: "Dolo", manufacturer: "Micro Labs Ltd",
    composition: "Paracetamol + Phenylephrine", strength: "500 mg", form: "tablet",
    pack: "10 tablets", rx: false, category: "Cold & Cough", image: "DP-3",
  },
  {
    id: "DP-4", name: "Dolo 650 Suspension 60ml", brand: "Dolo", manufacturer: "Micro Labs Ltd",
    composition: "Paracetamol", strength: "650mg/5ml", form: "suspension",
    pack: "60 ml", rx: false, category: "Pain Relief", image: "DP-4",
  },
  {
    id: "DP-5", name: "Azithral 500 Tablet", brand: "Azithral", manufacturer: "Alembic Pharmaceuticals",
    composition: "Azithromycin", strength: "500 mg", form: "tablet", pack: "5 tablets",
    sku: "AZ-500", gtin: "8901234567900", rx: true, category: "Antibiotics",
    image: "DP-5",
  },
  {
    id: "DP-6", name: "Neurobion Forte Tablet", brand: "Neurobion", manufacturer: "Merck Ltd",
    composition: "Vitamin B Complex", strength: "10 mg", form: "tablet", pack: "30 tablets",
    rx: false, category: "Vitamins & Supplements", image: "DP-6",
  },
  {
    id: "DP-7", name: "Volini Gel 30g", brand: "Volini", manufacturer: "Sun Pharma",
    composition: "Diclofenac Diethylamine", form: "gel", pack: "30 g",
    rx: false, category: "Pain Relief", image: "DP-7",
  },
  {
    id: "DP-8", name: "Volini Spray 100ml", brand: "Volini", manufacturer: "Sun Pharma",
    composition: "Diclofenac Diethylamine", form: "spray", pack: "100 ml",
    rx: false, category: "Pain Relief", image: "DP-8",
  },
  {
    id: "DP-9", name: "Cipladine Ointment 20g", brand: "Cipladine", manufacturer: "Cipla Ltd",
    composition: "Povidone Iodine", form: "ointment", pack: "20 g",
    rx: false, category: "First Aid", image: "DP-9",
  },
  {
    id: "DP-10", name: "Telma 40 Tablet", brand: "Telma", manufacturer: "Glenmark",
    composition: "Telmisartan", strength: "40 mg", form: "tablet", pack: "15 tablets",
    rx: true, category: "Heart & Cardio", image: "DP-10",
  },
  {
    id: "DP-11", name: "Telma LN 40/10 Tablet", brand: "Telma", manufacturer: "Glenmark",
    composition: "Telmisartan + Cilnidipine", strength: "40/10 mg", form: "tablet",
    pack: "15 tablets", rx: true, category: "Heart & Cardio", image: "DP-11",
  },
  {
    id: "DP-12", name: "Glycomet 500mg Tablet 20's", brand: "Glycomet", manufacturer: "USV Ltd",
    composition: "Metformin", strength: "500 mg", form: "tablet", pack: "20",
    rx: true, category: "Diabetes Care", image: "DP-12",
  },
];

function sampleIdentity(sample: Sample): IdentityInput {
  return {
    name: sample.name,
    strength: sample.strength ?? null,
    form: sample.form ?? null,
    packSize: sample.pack ?? null,
    manufacturer: sample.manufacturer,
    brand: sample.brand ?? null,
  };
}

function verdictFor(typedName: string, sample: Sample) {
  return assessCatalogMatch(sampleIdentity(sample), { name: typedName });
}

function exactMatches(typedName: string): Sample[] {
  return SAMPLE_CATALOG.filter((sample) => verdictFor(typedName, sample).verdict === "exact");
}

describe("master catalog — harmless naming differences are accepted", () => {
  const dolo650 = SAMPLE_CATALOG[0];

  it("accepts the four spec-accepted spellings of Dolo 650 as the same exact record", () => {
    for (const typed of ["Dolo 650", "Dolo-650", "Dolo 650 Tablet", "Dolo 650 mg Tablet"]) {
      const verdict = verdictFor(typed, dolo650);
      expect(verdict.verdict, typed).toBe("exact");
    }
  });

  it("folds case, punctuation, spacing and tablet(s) into one identity", () => {
    expect(normalizeName("DOLO-650  tablets")).toBe("dolo 650 tablets");
    expect(identityKeyOf({ name: "Dolo 650 Tablet" })).toBe(
      identityKeyOf({ name: "dolo-650 tabs" }),
    );
  });

  it("computes the same identity key for a re-imported row and a different key per strength", () => {
    const a = identityKeyOf({ name: "Dolo 650 Tablet", strength: "650 mg", form: "tablet", packSize: "15 tablets" });
    const b = identityKeyOf({ name: "dolo-650 tablet", strength: "650mg", form: "tab", packSize: "15's" });
    const c = identityKeyOf({ name: "Dolo 500 Tablet", strength: "500 mg", form: "tablet", packSize: "15 tablets" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("keeps the record's own manufacturer words absorbable (Dolo 650 Micro Labs)", () => {
    expect(verdictFor("Dolo 650 Micro Labs", dolo650).verdict).toBe("exact");
  });
});

describe("master catalog — true variants are rejected, never loosened", () => {
  const dolo650 = SAMPLE_CATALOG[0];
  const dolo500 = SAMPLE_CATALOG[1];
  const doloCold = SAMPLE_CATALOG[2];
  const doloSuspension = SAMPLE_CATALOG[3];
  const telma40 = SAMPLE_CATALOG[9];
  const telmaLn = SAMPLE_CATALOG[10];

  it("rejects a different strength (Dolo 650 vs Dolo 500)", () => {
    expect(verdictFor("Dolo 650", dolo500).verdict).toBe("reject");
    expect(verdictFor("Dolo 500", dolo650).verdict).toBe("reject");
    expect(exactMatches("Dolo 650")).not.toContainEqual(expect.objectContaining({ id: "DP-2" }));
  });

  it("rejects a different variant word (Dolo 650 vs Dolo Cold)", () => {
    expect(verdictFor("Dolo 650", doloCold).verdict).toBe("reject");
    expect(verdictFor("Dolo Cold", dolo650).verdict).toBe("reject");
  });

  it("rejects a different dosage form when both the name and the record state one", () => {
    expect(assessCatalogMatch(sampleIdentity(doloSuspension), { name: "Dolo 650 Tablet" }).verdict).toBe("reject");
    expect(verdictFor("Dolo 650 Suspension", dolo650).verdict).toBe("reject");
  });

  it("never treats a syrup/suspension record as the exact answer for a bare oral name", () => {
    // "Dolo 650" plus only the suspension: offered as a suggestion at best —
    // never an exact auto-fill.
    expect(verdictFor("Dolo 650", doloSuspension).verdict).toBe("related");
  });

  it("rejects Crocin Advance style names against the plain product", () => {
    const crocin = { name: "Crocin 500 Tablet", manufacturer: "GSK", strength: "500 mg", form: "tablet" };
    expect(assessCatalogMatch(crocin, { name: "Crocin Advance 500" }).verdict).toBe("reject");
  });

  it("rejects Telma 40 against its 20 mg sibling and against Telma LN", () => {
    const telma20 = { ...sampleIdentity(telma40), name: "Telma 20 Tablet", strength: "20 mg" };
    expect(assessCatalogMatch(telma20, { name: "Telma 40 Tablet" }).verdict).toBe("reject");
    expect(verdictFor("Telma 40", telmaLn).verdict).not.toBe("exact");
    expect(verdictFor("Telma LN", telma40).verdict).toBe("reject");
  });

  it("rejects Gel vs Spray when both forms are stated", () => {
    const gel = SAMPLE_CATALOG[6];
    const spray = SAMPLE_CATALOG[7];
    expect(verdictFor("Volini Spray", gel).verdict).toBe("reject");
    expect(verdictFor("Volini Gel", spray).verdict).toBe("reject");
  });

  it("rejects an explicit pack variant against a different pack", () => {
    const pack10 = { name: "Glycomet 500mg Tablet", strength: "500 mg", form: "tablet", packSize: "10's", manufacturer: "USV Ltd" };
    expect(assessCatalogMatch(pack10, { name: "Glycomet 500mg Tablet 20's" }).verdict).toBe("reject");
  });

  it("does not auto-fill a partial name (strict mode)", () => {
    expect(assessCatalogMatch(sampleIdentity(dolo650), { name: "Dolo 65" }).verdict).toBe("reject");
    // …but while typing, the same text is allowed to suggest the record.
    expect(
      assessCatalogMatch(sampleIdentity(dolo650), { name: "Dolo 65" }, { partial: true }).verdict,
    ).not.toBe("reject");
  });
});

describe("master catalog — identity parsing", () => {
  it("reads the dose a name states, preferring explicit units", () => {
    expect(parseIdentity({ name: "Dolo 650 Tablet" }).dose).toBe("650mg");
    expect(parseIdentity({ name: "Amlong 5 Tablet" }).dose).toBe("5mg");
    expect(parseIdentity({ name: "Augmentin 625 Duo Tablet" }).dose).toBe("625mg");
    expect(parseIdentity({ name: "Dolo 650mg" }).dose).toBe("650mg");
  });

  it("reads pack counts without mistaking them for doses", () => {
    expect(parseIdentity({ name: "Dolo 650 15 tablets" }).pack).toBe("15");
    expect(parseIdentity({ name: "Glycomet 500mg Tablet 10's" }).pack).toBe("10");
    expect(parseIdentity({ name: "XYZ 100 ml Syrup" }).pack).toBe("100ml");
  });

  it("reads forms and strips them from the comparison core", () => {
    expect(parseIdentity({ name: "Volini Gel" }).form).toBe("gel");
    expect(parseIdentity({ name: "Dolo 650 Tablet" }).core).toEqual(["dolo"]);
    expect(parseIdentity({ name: "Volini Gel" }).core).toEqual(["volini"]);
  });

  it("matches an explicit admin form hint against the record", () => {
    const gel = SAMPLE_CATALOG[6];
    expect(
      assessCatalogMatch(sampleIdentity(gel), { name: "Volini", form: "spray" }).verdict,
    ).toBe("reject");
    expect(
      assessCatalogMatch(sampleIdentity(gel), { name: "Volini", form: "gel" }).verdict,
    ).toBe("exact");
  });
});

describe("master catalog — dataset column auto-mapping", () => {
  it("maps the recognised Indian-pharma column names without manual mapping", () => {
    const mapping = mapColumns([
      "Product Name", "Brand", "Manufacturer", "Composition", "Strength",
      "Dosage Form", "Pack Size", "MRP", "Product ID", "SKU", "EAN",
      "Therapeutic Class", "Prescription Required", "Uses", "How to use",
      "Warnings", "Storage", "Image URL",
    ]);
    expect(mapping.columns.productName).toBe(0);
    expect(mapping.columns.brand).toBe(1);
    expect(mapping.columns.manufacturer).toBe(2);
    expect(mapping.columns.composition).toBe(3);
    expect(mapping.columns.strength).toBe(4);
    expect(mapping.columns.form).toBe(5);
    expect(mapping.columns.packaging).toBe(6);
    expect(mapping.columns.mrp).toBe(7);
    expect(mapping.columns.productId).toBe(8);
    expect(mapping.columns.sku).toBe(9);
    expect(mapping.columns.gtin).toBe(10);
    expect(mapping.columns.category).toBe(11);
    expect(mapping.columns.prescription).toBe(12);
    expect(mapping.columns.benefits).toBe(13);
    expect(mapping.columns.directions).toBe(14);
    expect(mapping.columns.safety).toBe(15);
    expect(mapping.columns.storage).toBe(16);
    expect(mapping.imageUrlColumns).toEqual([17]);
  });

  it("maps common aliases (Medicine Name, Pack, Qty, Product Code, Barcode, Photos)", () => {
    const mapping = mapColumns([
      "Medicine Name", "Company", "Salt Composition", "Pack", "Qty",
      "Price", "Item Code", "Barcode", "Photos",
    ]);
    expect(mapping.columns.productName).toBe(0);
    expect(mapping.columns.manufacturer).toBe(1);
    expect(mapping.columns.composition).toBe(2);
    expect(mapping.columns.packaging).toBe(3);
    expect(mapping.columns.mrp).toBe(5);
    expect(mapping.columns.sku).toBe(6);
    expect(mapping.columns.gtin).toBe(7);
    expect(mapping.imageUrlColumns).toContain(8);
  });

  it("falls back to any remaining “* name” and image-ish columns", () => {
    const mapping = mapColumns(["Item Name", "Maker Details", "Front Image"]);
    expect(mapping.columns.productName).toBe(0);
    expect(mapping.columns.manufacturer).toBe(1);
    expect(mapping.imageUrlColumns).toEqual([2]);
  });

  it("claims an image-filename column for imageFilename, not for image URL", () => {
    const mapping = mapColumns(["Product Name", "Image Filename", "Image URL"]);
    expect(mapping.columns.imageFilename).toBe(1);
    expect(mapping.imageUrlColumns).toEqual([2]);
  });

  it("keeps several image URL columns, in order", () => {
    const mapping = mapColumns(["Product Name", "Image URL 1", "Image URL 2", "Image URL 3"]);
    expect(mapping.imageUrlColumns).toEqual([1, 2, 3]);
  });
});

describe("master catalog — value parsing", () => {
  it("parses MRP with currency symbols and separators", () => {
    expect(parseMoney("₹1,234.50")).toBe(1234.5);
    expect(parseMoney("30")).toBe(30);
    expect(parseMoney("")).toBeUndefined();
  });

  it("parses Rx / OTC marker columns", () => {
    expect(parsePrescription("Rx")).toBe(true);
    expect(parsePrescription("Prescription Required")).toBe(true);
    expect(parsePrescription("OTC")).toBe(false);
    expect(parsePrescription("No")).toBe(false);
    expect(parsePrescription("")).toBeUndefined();
  });

  it("uses the two mandated messages verbatim", () => {
    expect(CATALOG_PRODUCT_NOT_FOUND_MESSAGE).toBe(
      "Exact product not found in the verified product catalog.",
    );
    expect(CATALOG_IMAGE_NOT_FOUND_MESSAGE).toBe(
      "Product found, but no verified product image is available.",
    );
  });
});

// ── Row → record + verification status ──

/** Build records from the sample catalog through the real CSV importer. */
function buildSampleRecords() {
  const headers = [
    "Product Name", "Brand", "Manufacturer", "Composition", "Strength",
    "Form", "Packaging", "MRP", "Product ID", "SKU", "GTIN",
    "Category", "Prescription Required", "Image Filename",
  ];
  const cells = [headers, ...SAMPLE_CATALOG.map((sample) => [
    sample.name,
    sample.brand ?? "",
    sample.manufacturer,
    sample.composition,
    sample.strength ?? "",
    sample.form ?? "",
    sample.pack ?? "",
    "29.90",
    sample.id,
    sample.sku ?? "",
    sample.gtin ?? "",
    sample.category,
    sample.rx ? "Rx" : "OTC",
    sample.image,
  ])];
  const table = tableFromCells(cells);
  const mapping = mapColumns(table.headers);
  return table.rows.map((row) => {
    const parsed = rowToRecord(row, mapping);
    if (!parsed) throw new Error("sample row did not build a record");
    return parsed;
  });
}

describe("master catalog — dataset rows become verified records", () => {
  const parsed = buildSampleRecords();

  it("builds one record per row with the licensed fields", () => {
    expect(parsed).toHaveLength(SAMPLE_CATALOG.length);
    const dolo = parsed[0].record;
    expect(dolo.catalogProductId).toBe("src-DP-1");
    expect(dolo.canonicalProductName).toBe("Dolo 650 Tablet");
    expect(dolo.brand).toBe("Dolo");
    expect(dolo.manufacturer).toBe("Micro Labs Ltd");
    expect(dolo.composition).toBe("Paracetamol");
    expect(dolo.strength).toBe("650 mg");
    expect(dolo.dosageForm).toBe("tablet");
    expect(dolo.packSize).toBe("15 tablets");
    expect(dolo.mrp).toBe(29.9);
    expect(dolo.gtin).toBe("8901234567890");
    expect(dolo.prescriptionRequired).toBe(false);
    expect(dolo.category).toBe("Pain Relief");
    expect(parsed[0].imageFilename).toBe("DP-1");
  });

  it("carries the Rx flag through for a prescription medicine", () => {
    const azithral = parsed[4].record;
    expect(azithral.canonicalProductName).toBe("Azithral 500 Tablet");
    expect(azithral.prescriptionRequired).toBe(true);
  });

  it("covers tablet, suspension, gel and OTC rows", () => {
    const names = parsed.map((row) => row.record.canonicalProductName);
    expect(names).toContain("Dolo 650 Suspension 60ml");
    expect(names).toContain("Volini Gel 30g");
    expect(names).toContain("Neurobion Forte Tablet");
    const suspension = parsed.find(
      (row) => row.record.catalogProductId === "src-DP-4",
    )!.record;
    expect(suspension.dosageForm).toBe("suspension");
  });

  it("derives statuses: image-less rows are NEEDS_IMAGE, thin rows NEEDS_REVIEW", () => {
    expect(
      verificationStatusFor(
        {
          name: "Dolo 650 Tablet",
          manufacturer: "Micro Labs",
          composition: "Paracetamol",
          strength: "650 mg",
          dosageForm: "tablet",
        },
        false,
      ),
    ).toBe("NEEDS_IMAGE");
    expect(
      verificationStatusFor(
        {
          name: "Dolo 650 Tablet",
          manufacturer: "Micro Labs",
          composition: "Paracetamol",
          strength: "650 mg",
          dosageForm: "tablet",
        },
        true,
      ),
    ).toBe("VERIFIED");
    expect(
      verificationStatusFor({ name: "Some Product 5" }, false),
    ).toBe("NEEDS_REVIEW");
  });
});

// ── End-to-end: name → exact record → metadata + images ──

describe("master catalog — typed name resolves to one exact record with its own images", () => {
  const parsed = buildSampleRecords();
  const records = parsed.map((row) => row.record);

  /** Mimics the indexed search + strict matcher the Auto Fill runs. */
  const resolve = (typedName: string) =>
    records.filter(
      (record) =>
        assessCatalogMatch(
          {
            name: record.canonicalProductName,
            strength: record.strength ?? null,
            form: record.dosageForm ?? null,
            packSize: record.packSize ?? null,
            manufacturer: record.manufacturer ?? null,
            brand: record.brand ?? null,
          },
          { name: typedName },
        ).verdict === "exact",
    );

  it("resolves “dolo 650” to the 650 tablet and its metadata", () => {
    const exact = resolve("dolo 650");
    expect(exact).toHaveLength(1);
    expect(exact[0].catalogProductId).toBe("src-DP-1");
    expect(exact[0].composition).toBe("Paracetamol");
    expect(exact[0].strength).toBe("650 mg");
    expect(exact[0].dosageForm).toBe("tablet");
  });

  it("rejects the wrong strength — “dolo 500” never yields the 650 record", () => {
    const exact = resolve("Dolo 500");
    expect(exact.map((r) => r.catalogProductId)).toEqual(["src-DP-2"]);
    expect(exact.map((r) => r.catalogProductId)).not.toContain("src-DP-1");
  });

  it("resolves an Rx and an OTC product to their own records", () => {
    expect(resolve("Azithral 500").map((r) => r.catalogProductId)).toEqual(["src-DP-5"]);
    expect(resolve("Neurobion Forte").map((r) => r.catalogProductId)).toEqual(["src-DP-6"]);
  });

  it("links each record's own image file, never a sibling variant's", () => {
    const plan = planZipImages(
      parsed.map(({ record, imageFilename }) => ({
        catalogProductId: record.catalogProductId,
        normalizedName: record.normalizedName,
        canonicalProductName: record.canonicalProductName,
        dosageForm: record.dosageForm,
        sourceProductId: record.sourceProductId,
        sku: record.sku,
        gtin: record.gtin,
        declaredFilename: imageFilename,
      })),
      [
        { filename: "DP-1.jpg" },
        { filename: "DP-2.jpg" },
        { filename: "DP-4.jpg" },
        { filename: "DP-7.jpg" },
      ],
    );
    const byId = new Map(plan.attachments.map((a) => [a.catalogProductId, a.filenames]));
    expect(byId.get("src-DP-1")).toEqual(["DP-1.jpg"]);
    expect(byId.get("src-DP-2")).toEqual(["DP-2.jpg"]);
    expect(byId.get("src-DP-4")).toEqual(["DP-4.jpg"]);
    expect(byId.get("src-DP-7")).toEqual(["DP-7.jpg"]);
    expect(plan.unmatched).toHaveLength(0);
  });

  it("attaches an image by exact normalized name, but never a generic salt or another variant", () => {
    const minimal = [
      {
        catalogProductId: "src-DP-1",
        normalizedName: "dolo 650 tablet",
        canonicalProductName: "Dolo 650 Tablet",
        dosageForm: "tablet",
      },
      {
        catalogProductId: "src-DP-2",
        normalizedName: "dolo 500 tablet",
        canonicalProductName: "Dolo 500 Tablet",
        dosageForm: "tablet",
      },
    ];
    const plan = planZipImages(minimal, [
      { filename: "Dolo 650 Tablet-front.jpg" },
      { filename: "Dolo 500 Tablet.jpg" },
      { filename: "paracetamol-500.jpg" },
      { filename: "Dolo Cold Tablet.jpg" },
    ]);
    const byId = new Map(plan.attachments.map((a) => [a.catalogProductId, a.filenames]));
    expect(byId.get("src-DP-1")).toEqual(["Dolo 650 Tablet-front.jpg"]);
    expect(byId.get("src-DP-2")).toEqual(["Dolo 500 Tablet.jpg"]);
    expect(plan.unmatched).toEqual([
      "paracetamol-500.jpg",
      "Dolo Cold Tablet.jpg",
    ]);
  });

  it("prefers stable ids: source Product ID, then SKU/GTIN, then the declared filename", () => {
    const sampleRecords = [
      {
        catalogProductId: "src-DP-1",
        normalizedName: "dolo 650 tablet",
        canonicalProductName: "Dolo 650 Tablet",
        dosageForm: "tablet",
        sourceProductId: "DP-1",
        sku: "SKU-1",
        gtin: "8900000000001",
        declaredFilename: "dolo-front",
      },
      {
        catalogProductId: "src-DP-2",
        normalizedName: "dolo 500 tablet",
        canonicalProductName: "Dolo 500 Tablet",
        dosageForm: "tablet",
        sourceProductId: "DP-2",
        sku: "SKU-2",
        gtin: "8900000000002",
      },
    ];
    const plan = planZipImages(sampleRecords, [
      { filename: "DP-1-extra.jpg" },
      { filename: "SKU-2.png" },
      { filename: "dolo-front.jpg" },
    ]);
    const byId = new Map(plan.attachments.map((a) => [a.catalogProductId, a]));
    expect(byId.get("src-DP-1")!.filenames).toEqual([
      "DP-1-extra.jpg",
      "dolo-front.jpg",
    ]);
    expect(byId.get("src-DP-2")!.filenames).toEqual(["SKU-2.png"]);
    expect(byId.get("src-DP-1")!.matchedBy).toBe("sourceProductId");
    expect(byId.get("src-DP-2")!.matchedBy).toBe("sku-gtin");
  });

  it("leaves a name shared by two records unmatched instead of guessing", () => {
    const shared = [
      {
        catalogProductId: "a",
        normalizedName: "dolo 650 tablet",
        canonicalProductName: "Dolo 650 Tablet",
      },
      {
        catalogProductId: "b",
        normalizedName: "dolo 650 tablet",
        canonicalProductName: "Dolo 650 Tablet",
      },
    ];
    const plan = planZipImages(shared, [{ filename: "Dolo 650 Tablet.png" }]);
    expect(plan.attachments).toHaveLength(0);
    expect(plan.unmatched).toEqual(["Dolo 650 Tablet.png"]);
  });
});

describe("master catalog — gallery ordering", () => {
  it("orders front → unlabelled → detail → back/side, stably", () => {
    const ordered = orderCatalogImages([
      { url: "https://x/back-panel.jpg" },
      { url: "https://x/detail-zoom.jpg" },
      { url: "https://x/dolo-650.jpg" },
      { url: "https://x/pack-front.jpg" },
    ]);
    expect(ordered.map((image) => image.url)).toEqual([
      "https://x/pack-front.jpg",
      "https://x/dolo-650.jpg",
      "https://x/detail-zoom.jpg",
      "https://x/back-panel.jpg",
    ]);
  });

  it("keeps the dataset order when nothing is labelled", () => {
    const ordered = orderCatalogImages([
      { url: "https://x/a.jpg" },
      { url: "https://x/b.jpg" },
    ]);
    expect(ordered.map((i) => i.url)).toEqual(["https://x/a.jpg", "https://x/b.jpg"]);
  });
});

// ── File parsing (CSV / XLSX / ZIP) ──

/** Build a ZIP archive with stored (uncompressed) entries, for tests. */
function buildStoredZip(files: Array<{ name: string; text: string }>): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const write = (target: Uint8Array, start: number, value: number, width: number) => {
    for (let i = 0; i < width; i += 1) {
      target[start + i] = (value >>> (8 * i)) & 0xff;
    }
  };

  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const data = encoder.encode(file.text);
    const local = new Uint8Array(30 + nameBytes.length + data.length);
    write(local, 0, 0x04034b50, 4);
    write(local, 4, 20, 2);
    write(local, 26, nameBytes.length, 2);
    write(local, 28, 0, 2);
    local.set(nameBytes, 30);
    local.set(data, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    write(central, 0, 0x02014b50, 4);
    write(central, 4, 20, 2);
    write(central, 10, 0, 2); // stored
    write(central, 20, data.length, 4);
    write(central, 24, data.length, 4);
    write(central, 28, nameBytes.length, 2);
    write(central, 42, offset, 4);
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const eocd = new Uint8Array(22);
  write(eocd, 0, 0x06054b50, 4);
  write(eocd, 8, files.length, 2);
  write(eocd, 10, files.length, 2);
  write(eocd, 12, centralSize, 4);
  write(eocd, 16, offset, 4);

  const total = offset + centralSize + eocd.length;
  const archive = new Uint8Array(total);
  let cursor = 0;
  for (const part of localParts) {
    archive.set(part, cursor);
    cursor += part.length;
  }
  for (const part of centralParts) {
    archive.set(part, cursor);
    cursor += part.length;
  }
  archive.set(eocd, cursor);
  return archive;
}

describe("master catalog — CSV reader", () => {
  it("parses quoted fields, embedded commas and CRLF rows", () => {
    const cells = parseCsv(
      'Product Name,Composition,MRP\r\n"Dolo 650 Tablet","Paracetamol, Caffeine",30\r\n"He said ""hi""",x,1\r\n',
    );
    expect(cells).toHaveLength(3);
    expect(cells[1]).toEqual(["Dolo 650 Tablet", "Paracetamol, Caffeine", "30"]);
    expect(cells[2][0]).toBe('He said "hi"');
  });

  it("detects semicolon and tab separated files", () => {
    const semi = parseCsv("Product Name;MRP\nDolo 650;30\n");
    expect(semi[1]).toEqual(["Dolo 650", "30"]);
    const tab = parseCsv("Product Name\tMRP\nDolo 650\t30\n");
    expect(tab[1]).toEqual(["Dolo 650", "30"]);
  });
});

describe("master catalog — XLSX and ZIP readers", () => {
  it("reads the first worksheet of an XLSX dataset", async () => {
    const shared = `<?xml version="1.0"?><sst xmlns="x"><si><t>Product Name</t></si><si><t>Dolo 650 Tablet</t></si><si><t>MRP</t></si><si><t>Brand</t></si><si><t>Dolo</t></si></sst>`;
    const sheet = `<?xml version="1.0"?><worksheet xmlns="x"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>2</v></c><c r="C1" t="s"><v>3</v></c></row><row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2"><v>30</v></c><c r="C2" t="s"><v>4</v></c></row></sheetData></worksheet>`;
    const archive = buildStoredZip([
      { name: "xl/sharedStrings.xml", text: shared },
      { name: "xl/worksheets/sheet1.xml", text: sheet },
    ]);
    const table = await readXlsx(archive);
    expect(table.headers).toEqual(["Product Name", "MRP", "Brand"]);
    expect(table.rows).toEqual([["Dolo 650 Tablet", "30", "Dolo"]]);
  });

  it("extracts image entries from an image ZIP and skips non-images", async () => {
    const archive = buildStoredZip([
      { name: "images/DP-1.jpg", text: "fake-jpeg-bytes" },
      { name: "images/DP-2.png", text: "fake-png-bytes" },
      { name: "readme.txt", text: "not an image" },
      { name: "__MACOSX/._DP-1.jpg", text: "junk" },
    ]);
    const entries = await readZipEntries(archive);
    expect(entries.map((entry) => entry.filename)).toEqual([
      "images/DP-1.jpg",
      "images/DP-2.png",
      "readme.txt",
    ]);
    expect(isImageFilename("images/DP-1.jpg")).toBe(true);
    expect(isImageFilename("readme.txt")).toBe(false);
  });
});

// ── Provider abstraction ──

describe("master catalog — licensed provider abstraction", () => {
  it("stays disabled unless both env values are configured", () => {
    expect(providerConfigured({})).toBe(false);
    expect(
      providerConfigured({ LICENSED_PRODUCT_API_URL: "https://api.example.com" }),
    ).toBe(false);
    expect(providerConfigured({ LICENSED_PRODUCT_API_KEY: "key" })).toBe(false);
    expect(createProductDataProvider({})).toBeNull();
    expect(
      providerConfigured({
        LICENSED_PRODUCT_API_URL: "https://api.example.com",
        LICENSED_PRODUCT_API_KEY: "key",
      }),
    ).toBe(true);
  });

  it("maps a tolerant provider record shape", () => {
    const record = parseProviderRecord({
      product_id: "DP-1",
      productName: "Dolo 650 Tablet",
      brand: "Dolo",
      company: "Micro Labs Ltd",
      saltComposition: "Paracetamol",
      strength: "650 mg",
      dosageForm: "Tablet",
      packaging: "15 tablets",
      mrp: "30.50",
      rx: "Rx",
    });
    expect(record?.name).toBe("Dolo 650 Tablet");
    expect(record?.sourceProductId).toBe("DP-1");
    expect(record?.manufacturer).toBe("Micro Labs Ltd");
    expect(record?.composition).toBe("Paracetamol");
    expect(record?.packSize).toBe("15 tablets");
    expect(record?.mrp).toBe(30.5);
    expect(record?.prescriptionRequired).toBe(true);
  });

  it("searches a configured provider through its documented endpoints", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            results: [
              {
                productId: "DP-1",
                name: "Dolo 650 Tablet",
                manufacturer: "Micro Labs",
                strength: "650 mg",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      const provider = createProductDataProvider({
        LICENSED_PRODUCT_API_URL: "https://api.example.com/",
        LICENSED_PRODUCT_API_KEY: "secret-key",
      });
      const results = await provider!.searchProducts("Dolo 650", 5);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Dolo 650 Tablet");
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.example.com/products/search?q=Dolo%20650&limit=5",
        expect.objectContaining({
          headers: expect.objectContaining({ authorization: "Bearer secret-key" }),
        }),
      );
      expect(PROVIDER_NOT_CONFIGURED_MESSAGE).toContain("No licensed product provider");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
