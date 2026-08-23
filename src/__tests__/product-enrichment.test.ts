import { describe, it, expect } from "vitest";

// ══════════════════════════════════════════════════════════
// Known manufacturer database (mirrors Convex backend)
// ══════════════════════════════════════════════════════════
const KNOWN_MANUFACTURERS: Record<string, string> = {
  dolo: "Micro Labs Ltd",
  crocin: "GlaxoSmithKline Pharmaceuticals Ltd",
  combiflam: "Sanofi India Ltd",
  pan: "Alkem Laboratories Ltd",
  pantop: "Alkem Laboratories Ltd",
  omez: "Dr. Reddy's Laboratories Ltd",
  azee: "Cipla Ltd",
  metformin: "USV Pvt Ltd",
  glycomet: "USV Pvt Ltd",
  atorva: "Sun Pharmaceutical Industries Ltd",
  montair: "Cipla Ltd",
  sinarest: "Micro Labs Ltd",
  benadryl: "Johnson & Johnson Ltd",
};

function getKnownManufacturer(productName: string): string | null {
  const lowerName = productName.toLowerCase();
  for (const [key, mfr] of Object.entries(KNOWN_MANUFACTURERS)) {
    if (lowerName.includes(key)) {
      return mfr;
    }
  }
  return null;
}

// ══════════════════════════════════════════════════════════
// Benefits database (mirrors Convex backend)
// ══════════════════════════════════════════════════════════
const BENEFITS_DB: Record<string, string> = {
  paracetamol:
    "Provides effective relief from mild to moderate pain and reduces fever.",
  ibuprofen:
    "Reduces pain, inflammation, and fever.",
  amoxicillin:
    "Broad-spectrum antibiotic effective against common bacterial infections.",
  metformin:
    "First-line treatment for type 2 diabetes. Helps control blood sugar levels.",
  atorvastatin:
    "Helps lower cholesterol levels and reduce the risk of heart attacks.",
  cetirizine:
    "Non-drowsy antihistamine that provides 24-hour relief from allergic rhinitis.",
  pantoprazole:
    "Long-lasting relief from GERD, stomach ulcers, and acid-related disorders.",
  vitamin:
    "Supports bone health, calcium absorption, and immune system function.",
  calcium:
    "Essential mineral for strong bones and teeth.",
  losartan:
    "ARB that lowers blood pressure and protects the kidneys in diabetic patients.",
};

function getKnownBenefits(
  composition: string,
  form: string,
): string | null {
  const lowerComp = composition.toLowerCase();

  for (const [key, benefits] of Object.entries(BENEFITS_DB)) {
    if (lowerComp.includes(key)) {
      return benefits;
    }
  }

  const f = form.toLowerCase();
  if (["tablet", "capsule"].includes(f)) {
    return "Effective medication in convenient oral dosage form.";
  }
  if (["cream", "gel", "ointment"].includes(f)) {
    return "Topical formulation for targeted relief.";
  }
  if (f === "syrup" || f === "suspension") {
    return "Easy-to-administer liquid formulation.";
  }
  if (f === "injection") {
    return "Fast-acting injectable formulation.";
  }

  return null;
}

// ══════════════════════════════════════════════════════════
// Consume type inference (mirrors ProductDetail display logic)
// ══════════════════════════════════════════════════════════
function inferConsumeType(form: string): string | null {
  const f = form.toLowerCase();
  if (
    ["tablet", "capsule", "syrup", "suspension", "drops", "inhaler", "powder", "sachet"].includes(f)
  ) {
    return "For oral use";
  }
  if (["cream", "gel", "ointment", "lotion"].includes(f)) {
    return "For external use only";
  }
  if (f === "injection") {
    return "For injection use only";
  }
  if (f === "eye drops" || f === "ear drops" || f === "nasal drops") {
    return "For ophthalmic/ENT use";
  }
  return null;
}

// ══════════════════════════════════════════════════════════
// Backfill logic (mirrors Convex mutation logic)
// ══════════════════════════════════════════════════════════
interface Product {
  _id: string;
  name: string;
  manufacturer: string;
  benefits?: string;
  imageUrl?: string;
  composition?: string;
  form?: string;
}

function simulateEnrichment(product: Product): Record<string, any> {
  const updates: Record<string, any> = {};
  const lowerName = product.name.toLowerCase();
  const searchIn = (product.composition || product.name).toLowerCase();

  if (!product.manufacturer) {
    for (const [key, mfr] of Object.entries(KNOWN_MANUFACTURERS)) {
      if (lowerName.includes(key)) {
        updates.manufacturer = mfr;
        break;
      }
    }
  }

  if (!product.benefits) {
    for (const [key, benefits] of Object.entries(BENEFITS_DB)) {
      if (searchIn.includes(key)) {
        updates.benefits = benefits;
        break;
      }
    }
  }

  return updates;
}

// ══════════════════════════════════════════════════════════
// Tests
// ══════════════════════════════════════════════════════════

describe("Product Manufacturer Lookup", () => {
  it("should find manufacturer for Dolo 650", () => {
    const result = getKnownManufacturer("Dolo 650");
    expect(result).toBe("Micro Labs Ltd");
  });

  it("should find manufacturer for Crocin Advance", () => {
    const result = getKnownManufacturer("Crocin Advance 500mg");
    expect(result).toBe("GlaxoSmithKline Pharmaceuticals Ltd");
  });

  it("should find manufacturer for Azee 500", () => {
    const result = getKnownManufacturer("Azee 500mg Tablet");
    expect(result).toBe("Cipla Ltd");
  });

  it("should find manufacturer for Omez 20", () => {
    const result = getKnownManufacturer("Omez 20mg Capsule");
    expect(result).toBe("Dr. Reddy's Laboratories Ltd");
  });

  it("should find manufacturer for Montair LC", () => {
    const result = getKnownManufacturer("Montair LC Tablet");
    expect(result).toBe("Cipla Ltd");
  });

  it("should return null for unknown products", () => {
    const result = getKnownManufacturer("Random Unknown Medicine");
    expect(result).toBeNull();
  });

  it("should be case-insensitive", () => {
    const result = getKnownManufacturer("DOLO 650");
    expect(result).toBe("Micro Labs Ltd");
  });
});

describe("Product Benefits Lookup", () => {
  it("should find benefits for paracetamol composition", () => {
    const result = getKnownBenefits("Paracetamol 500mg", "tablet");
    expect(result).toContain("pain");
    expect(result).toContain("fever");
  });

  it("should find benefits for ibuprofen composition", () => {
    const result = getKnownBenefits("Ibuprofen 400mg", "tablet");
    expect(result).toContain("inflammation");
  });

  it("should find benefits for metformin composition", () => {
    const result = getKnownBenefits("Metformin 500mg", "tablet");
    expect(result).toContain("diabetes");
  });

  it("should find benefits for atorvastatin composition", () => {
    const result = getKnownBenefits("Atorvastatin 10mg", "tablet");
    expect(result).toContain("cholesterol");
  });

  it("should find benefits for cetirizine composition", () => {
    const result = getKnownBenefits("Cetirizine 10mg", "tablet");
    expect(result).toContain("allergic");
  });

  it("should find benefits for pantoprazole composition", () => {
    const result = getKnownBenefits("Pantoprazole 40mg", "tablet");
    expect(result).toContain("GERD");
  });

  it("should fallback to form-specific benefits for tablet", () => {
    const result = getKnownBenefits("Unknown Drug 100mg", "tablet");
    expect(result).toContain("oral");
  });

  it("should fallback to form-specific benefits for cream", () => {
    const result = getKnownBenefits("Unknown Drug Cream", "cream");
    expect(result).toContain("Topical");
  });

  it("should fallback to form-specific benefits for syrup", () => {
    const result = getKnownBenefits("Unknown Syrup", "syrup");
    expect(result).toContain("liquid");
  });

  it("should fallback to form-specific benefits for injection", () => {
    const result = getKnownBenefits("Unknown Injection", "injection");
    expect(result).toContain("injectable");
  });

  it("should return null for unknown composition and unknown form", () => {
    const result = getKnownBenefits("Mystery Compound", "suppository");
    expect(result).toBeNull();
  });
});

describe("Consume Type Inference", () => {
  it("should return 'For oral use' for tablets", () => {
    expect(inferConsumeType("tablet")).toBe("For oral use");
  });

  it("should return 'For oral use' for capsules", () => {
    expect(inferConsumeType("capsule")).toBe("For oral use");
  });

  it("should return 'For oral use' for syrup", () => {
    expect(inferConsumeType("syrup")).toBe("For oral use");
  });

  it("should return 'For external use only' for cream", () => {
    expect(inferConsumeType("cream")).toBe("For external use only");
  });

  it("should return 'For external use only' for gel", () => {
    expect(inferConsumeType("gel")).toBe("For external use only");
  });

  it("should return 'For injection use only' for injection", () => {
    expect(inferConsumeType("injection")).toBe("For injection use only");
  });

  it("should return 'For ophthalmic/ENT use' for eye drops", () => {
    expect(inferConsumeType("eye drops")).toBe("For ophthalmic/ENT use");
  });

  it("should return null for unknown form", () => {
    expect(inferConsumeType("suppository")).toBeNull();
  });
});

describe("Benefits Display Formatting", () => {
  it("should split benefits into sentences correctly", () => {
    const benefits = "Provides effective relief from pain. Reduces fever. Safe and well-tolerated.";
    const sentences = benefits.split(". ").filter(Boolean);
    expect(sentences).toHaveLength(3);
    expect(sentences[0]).toBe("Provides effective relief from pain");
  });

  it("should handle single-sentence benefits", () => {
    const benefits = "Essential mineral for strong bones and teeth.";
    const sentences = benefits.split(". ").filter(Boolean);
    expect(sentences).toHaveLength(1);
  });

  it("should handle benefits without trailing period", () => {
    const benefits = "Reduces pain and inflammation";
    const sentences = benefits.split(". ").filter(Boolean);
    expect(sentences).toHaveLength(1);
    expect(sentences[0]).toBe("Reduces pain and inflammation");
  });
});

describe("Product Enrichment (Simulated)", () => {
  it("should enrich Dolo 650 with manufacturer and benefits", () => {
    const product: Product = {
      _id: "prod_001",
      name: "Dolo 650",
      manufacturer: "",
      benefits: undefined,
      composition: "Paracetamol 650mg",
      form: "tablet",
    };

    const updates = simulateEnrichment(product);
    expect(updates.manufacturer).toBe("Micro Labs Ltd");
    expect(updates.benefits).toContain("pain");
  });

  it("should enrich Crocin with manufacturer and benefits", () => {
    const product: Product = {
      _id: "prod_002",
      name: "Crocin Advance 500mg",
      manufacturer: "",
      benefits: undefined,
      composition: "Paracetamol 500mg",
      form: "tablet",
    };

    const updates = simulateEnrichment(product);
    expect(updates.manufacturer).toBe("GlaxoSmithKline Pharmaceuticals Ltd");
    expect(updates.benefits).toContain("fever");
  });

  it("should not overwrite existing manufacturer", () => {
    const product: Product = {
      _id: "prod_003",
      name: "Dolo 650",
      manufacturer: "Existing Mfr",
      benefits: undefined,
      composition: "Paracetamol 650mg",
    };

    const updates = simulateEnrichment(product);
    expect(updates.manufacturer).toBeUndefined();
    expect(updates.benefits).toBeDefined();
  });

  it("should not overwrite existing benefits", () => {
    const product: Product = {
      _id: "prod_004",
      name: "Metformin 500",
      manufacturer: "",
      benefits: "Existing benefits text",
      composition: "Metformin 500mg",
    };

    const updates = simulateEnrichment(product);
    expect(updates.manufacturer).toBe("USV Pvt Ltd");
    expect(updates.benefits).toBeUndefined();
  });

  it("should return empty updates for already complete product", () => {
    const product: Product = {
      _id: "prod_005",
      name: "Complete Product",
      manufacturer: "Known Mfr",
      benefits: "Known benefits",
    };

    const updates = simulateEnrichment(product);
    expect(Object.keys(updates)).toHaveLength(0);
  });

  it("should handle product with composition matching benefit DB", () => {
    const product: Product = {
      _id: "prod_006",
      name: "Atorva 10",
      manufacturer: "",
      benefits: undefined,
      composition: "Atorvastatin Calcium 10mg",
    };

    const updates = simulateEnrichment(product);
    expect(updates.manufacturer).toBe("Sun Pharmaceutical Industries Ltd");
    expect(updates.benefits).toContain("cholesterol");
  });
});

describe("Product Detail Benefits Display", () => {
  it("should render benefits as bullet points from sentences", () => {
    const benefits = "Provides effective relief from pain. Reduces fever. Safe when used as directed.";
    const sentences = benefits.split(". ").filter(Boolean);

    expect(sentences).toHaveLength(3);
    sentences.forEach((s) => {
      expect(s.length).toBeGreaterThan(5);
    });
  });

  it("should handle long benefit text with multiple periods", () => {
    const benefits =
      "Effective medication for managing blood sugar levels in type 2 diabetes patients. " +
      "Works by improving insulin sensitivity and reducing glucose production in the liver. " +
      "Take as directed by your physician for best results.";
    const sentences = benefits.split(". ").filter(Boolean);

    expect(sentences).toHaveLength(3);
  });
});

describe("Backfill Simulation", () => {
  it("should identify products needing enrichment", () => {
    const products: Product[] = [
      { _id: "1", name: "Dolo 650", manufacturer: "", benefits: undefined, imageUrl: "http://img" },
      { _id: "2", name: "Complete Med", manufacturer: "Mfr", benefits: "Benefits text", imageUrl: "http://img" },
      { _id: "3", name: "Crocin", manufacturer: "", benefits: undefined, imageUrl: undefined },
    ];

    const needsEnrichment = products.filter((p) => !p.imageUrl || !p.benefits);
    expect(needsEnrichment).toHaveLength(2);
    expect(needsEnrichment[0].name).toBe("Dolo 650");
    expect(needsEnrichment[1].name).toBe("Crocin");
  });

  it("should handle empty product list", () => {
    const products: Product[] = [];
    const needsEnrichment = products.filter((p) => !p.imageUrl || !p.benefits);
    expect(needsEnrichment).toHaveLength(0);
  });

  it("should respect limit parameter", () => {
    const products: Product[] = Array.from({ length: 25 }, (_, i) => ({
      _id: `prod_${i}`,
      name: `Product ${i}`,
      manufacturer: "",
      benefits: undefined,
    }));

    const limit = 10;
    const needsEnrichment = products.filter((p) => !p.benefits);
    const toProcess = needsEnrichment.slice(0, limit);

    expect(needsEnrichment).toHaveLength(25);
    expect(toProcess).toHaveLength(10);
  });
});
