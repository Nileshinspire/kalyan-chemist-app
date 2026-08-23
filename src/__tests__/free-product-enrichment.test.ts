/**
 * Targeted tests for the FREE product enrichment system (no paid APIs).
 *
 * Tests the local Indian medicine database matching, manufacturer lookup,
 * benefits generation, description generation, and consume type inference.
 * All of these run purely in-memory — no API calls needed.
 */

// ── Local copy of the database for testing ──
// We test the same logic that productImageSearch.ts uses, extracted here
// so the tests are fast and don't hit Convex actions.

interface MedicineInfo {
  manufacturer: string;
  brand: string;
  composition: string;
  benefits: string;
  description: string;
  form: string;
}

const MEDICINES_DB: Record<string, MedicineInfo> = {
  dolo: {
    manufacturer: "Micro Labs Ltd", brand: "Dolo", composition: "Paracetamol 650mg",
    benefits: "Provides effective relief from mild to moderate pain and reduces fever.",
    description: "Dolo 650 is a trusted antipyretic and analgesic containing Paracetamol 650mg.",
    form: "tablet",
  },
  crocin: {
    manufacturer: "GlaxoSmithKline Pharmaceuticals Ltd", brand: "Crocin", composition: "Paracetamol 500mg / 650mg",
    benefits: "Effective pain reliever and fever reducer.",
    description: "Crocin is a trusted paracetamol brand from GSK.",
    form: "tablet",
  },
  combiflam: {
    manufacturer: "Sanofi India Ltd", brand: "Combiflam", composition: "Ibuprofen 400mg + Paracetamol 325mg",
    benefits: "Dual-action formula combining anti-inflammatory and pain-relieving properties.",
    description: "Combiflam combines Ibuprofen and Paracetamol for dual action pain relief.",
    form: "tablet",
  },
  azee: {
    manufacturer: "Cipla Ltd", brand: "Azee", composition: "Azithromycin 250mg / 500mg",
    benefits: "Effective macrolide antibiotic for respiratory infections.",
    description: "Azee contains Azithromycin, a macrolide antibiotic from Cipla Ltd.",
    form: "tablet",
  },
  pan: {
    manufacturer: "Alkem Laboratories Ltd", brand: "Pan", composition: "Pantoprazole 40mg",
    benefits: "Proton pump inhibitor for long-lasting relief from GERD.",
    description: "Pan contains Pantoprazole 40mg from Alkem Laboratories.",
    form: "tablet",
  },
  omez: {
    manufacturer: "Dr. Reddy's Laboratories Ltd", brand: "Omez", composition: "Omeprazole 20mg",
    benefits: "Proton pump inhibitor that reduces stomach acid production.",
    description: "Omez contains Omeprazole 20mg from Dr. Reddy's.",
    form: "capsule",
  },
  shelcal: {
    manufacturer: "Torrent Pharmaceuticals Ltd", brand: "Shelcal", composition: "Calcium Carbonate 500mg + Vitamin D3 250 IU",
    benefits: "Essential mineral for strong bones and teeth.",
    description: "Shelcal from Torrent Pharma provides essential calcium with Vitamin D3.",
    form: "tablet",
  },
  becosules: {
    manufacturer: "Pfizer Ltd", brand: "Becosules", composition: "Vitamin B Complex + Vitamin C",
    benefits: "Complete Vitamin B complex supplement.",
    description: "Becosules from Pfizer contains all essential B vitamins plus Vitamin C.",
    form: "capsule",
  },
  glycomet: {
    manufacturer: "USV Pvt Ltd", brand: "Glycomet", composition: "Metformin 500mg / 850mg",
    benefits: "First-line treatment for type 2 diabetes.",
    description: "Glycomet contains Metformin from USV.",
    form: "tablet",
  },
  atorva: {
    manufacturer: "Sun Pharmaceutical Industries Ltd", brand: "Atorva", composition: "Atorvastatin 10mg / 20mg / 40mg",
    benefits: "Statins help lower cholesterol levels.",
    description: "Atorva from Sun Pharma contains Atorvastatin.",
    form: "tablet",
  },
  stamlo: {
    manufacturer: "Dr. Reddy's Laboratories Ltd", brand: "Stamlo", composition: "Amlodipine 5mg / 10mg",
    benefits: "Calcium channel blocker that relaxes blood vessels.",
    description: "Stamlo from Dr. Reddy's contains Amlodipine.",
    form: "tablet",
  },
  cetirizine: {
    manufacturer: "Cipla Ltd", brand: "Cetirizine", composition: "Cetirizine 10mg",
    benefits: "Non-drowsy antihistamine for 24-hour allergy relief.",
    description: "Cetirizine from Cipla is a second-generation antihistamine.",
    form: "tablet",
  },
  montair: {
    manufacturer: "Cipla Ltd", brand: "Montair", composition: "Montelukast 10mg",
    benefits: "Leukotriene receptor blocker for asthma prevention.",
    description: "Montair from Cipla contains Montelukast.",
    form: "tablet",
  },
  sinarest: {
    manufacturer: "Micro Labs Ltd", brand: "Sinarest", composition: "Paracetamol + Phenylephrine + Chlorpheniramine",
    benefits: "Multi-symptom cold and flu relief.",
    description: "Sinarest from Micro Labs provides comprehensive cold relief.",
    form: "tablet",
  },
  asthalin: {
    manufacturer: "Cipla Ltd", brand: "Asthalin", composition: "Salbutamol 2mg / 4mg",
    benefits: "Fast-acting bronchodilator for asthma relief.",
    description: "Asthalin from Cipla contains Salbutamol.",
    form: "tablet",
  },
  enterogermina: {
    manufacturer: "Sanofi India Ltd", brand: "Enterogermina", composition: "Bacillus clausii 2 Billion Spores",
    benefits: "Probiotic that restores healthy gut bacteria.",
    description: "Enterogermina from Sanofi contains probiotic spores.",
    form: "sachet",
  },
  benadryl: {
    manufacturer: "Johnson & Johnson Ltd", brand: "Benadryl", composition: "Diphenhydramine 12.5mg",
    benefits: "Antihistamine for allergy symptoms.",
    description: "Benadryl from J&J is a trusted antihistamine.",
    form: "syrup",
  },
  duphaston: {
    manufacturer: "Abbott India Ltd", brand: "Duphaston", composition: "Dydrogesterone 10mg",
    benefits: "Progesterone hormone supplement for menstrual disorders.",
    description: "Duphaston from Abbott contains Dydrogesterone.",
    form: "tablet",
  },
};

const KNOWN_MANUFACTURERS: Record<string, string> = {
  dolo: "Micro Labs Ltd", crocin: "GlaxoSmithKline Pharmaceuticals Ltd",
  combiflam: "Sanofi India Ltd", pan: "Alkem Laboratories Ltd",
  omez: "Dr. Reddy's Laboratories Ltd", azee: "Cipla Ltd",
  shelcal: "Torrent Pharmaceuticals Ltd", becosules: "Pfizer Ltd",
  glycomet: "USV Pvt Ltd", atorva: "Sun Pharmaceutical Industries Ltd",
  stamlo: "Dr. Reddy's Laboratories Ltd", montair: "Cipla Ltd",
  sinarest: "Micro Labs Ltd", benadryl: "Johnson & Johnson Ltd",
};

const BENEFITS_DB: Record<string, string> = {
  paracetamol: "Provides effective relief from mild to moderate pain and reduces fever.",
  ibuprofen: "Reduces pain, inflammation, and fever.",
  amoxicillin: "Broad-spectrum antibiotic effective against common bacterial infections.",
  azithromycin: "Effective macrolide antibiotic for respiratory infections.",
  metformin: "First-line treatment for type 2 diabetes.",
  atorvastatin: "Helps lower cholesterol levels and reduce cardiovascular risk.",
  amlodipine: "Calcium channel blocker that lowers blood pressure.",
  losartan: "ARB that lowers blood pressure.",
  omeprazole: "Proton pump inhibitor for acid reflux relief.",
  pantoprazole: "Long-lasting relief from GERD and stomach ulcers.",
  cetirizine: "Non-drowsy antihistamine for 24-hour allergy relief.",
  montelukast: "Leukotriene receptor blocker for asthma prevention.",
};

// ── Functions under test (same logic as productImageSearch.ts) ──

function matchMedicine(productName: string): MedicineInfo | null {
  const lower = productName.toLowerCase().trim();
  if (MEDICINES_DB[lower]) return MEDICINES_DB[lower];
  const stripped = lower.replace(/\s*\d+\s*(mg|ml|g|mcg|iu|%)?$/i, "").trim();
  if (MEDICINES_DB[stripped]) return MEDICINES_DB[stripped];
  let bestMatch: MedicineInfo | null = null;
  let bestLen = 0;
  for (const [key, info] of Object.entries(MEDICINES_DB)) {
    if (lower.includes(key) && key.length > bestLen) {
      bestMatch = info;
      bestLen = key.length;
    }
  }
  return bestMatch;
}

function getKnownManufacturer(productName: string): string | null {
  const lower = productName.toLowerCase();
  for (const [key, manufacturer] of Object.entries(KNOWN_MANUFACTURERS)) {
    if (lower.includes(key)) return manufacturer;
  }
  return null;
}

function getKnownBenefits(composition: string, form: string): string | null {
  const lowerComp = composition.toLowerCase();
  for (const [key, benefits] of Object.entries(BENEFITS_DB)) {
    if (lowerComp.includes(key)) return benefits;
  }
  const f = form.toLowerCase();
  if (["tablet", "capsule"].includes(f)) return "Effective medication in convenient oral dosage form.";
  if (["cream", "gel", "ointment"].includes(f)) return "Topical formulation for targeted relief.";
  return null;
}

function inferConsumeType(form: string): string | null {
  const f = form.toLowerCase();
  if (["tablet", "capsule", "syrup", "suspension", "drops", "inhaler", "powder", "sachet", "lozenge"].includes(f)) return "For oral use";
  if (["cream", "gel", "ointment", "lotion"].includes(f)) return "For external use only";
  if (f === "injection") return "For injection use only";
  if (f === "nasal drops" || f === "nasal") return "For nasal use";
  return null;
}

function generatePlaceholderImage(productName: string): string {
  const initials = productName.split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");
  return `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><text x="100" y="100" text-anchor="middle" font-size="42" font-weight="700" fill="%233b82f6">${initials}</text></svg>`;
}

// ════════════════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════════════════

describe("Free Product Enrichment — Local Medicine Database", () => {
  describe("Direct medicine name matching", () => {
    it("should match Dolo 650 exactly", () => {
      const result = matchMedicine("Dolo 650");
      expect(result).not.toBeNull();
      expect(result!.manufacturer).toBe("Micro Labs Ltd");
      expect(result!.composition).toBe("Paracetamol 650mg");
      expect(result!.form).toBe("tablet");
    });

    it("should match Crocin", () => {
      const result = matchMedicine("Crocin");
      expect(result).not.toBeNull();
      expect(result!.manufacturer).toBe("GlaxoSmithKline Pharmaceuticals Ltd");
      expect(result!.brand).toBe("Crocin");
    });

    it("should match Combiflam", () => {
      const result = matchMedicine("Combiflam");
      expect(result).not.toBeNull();
      expect(result!.manufacturer).toBe("Sanofi India Ltd");
      expect(result!.composition).toContain("Ibuprofen");
    });

    it("should match Azee 500", () => {
      const result = matchMedicine("Azee 500");
      expect(result).not.toBeNull();
      expect(result!.manufacturer).toBe("Cipla Ltd");
      expect(result!.composition).toContain("Azithromycin");
    });

    it("should match Pan 40", () => {
      const result = matchMedicine("Pan 40");
      expect(result).not.toBeNull();
      expect(result!.manufacturer).toBe("Alkem Laboratories Ltd");
    });

    it("should match Omez 20", () => {
      const result = matchMedicine("Omez 20");
      expect(result).not.toBeNull();
      expect(result!.manufacturer).toBe("Dr. Reddy's Laboratories Ltd");
    });

    it("should match Shelcal 500", () => {
      const result = matchMedicine("Shelcal 500");
      expect(result).not.toBeNull();
      expect(result!.manufacturer).toBe("Torrent Pharmaceuticals Ltd");
      expect(result!.composition).toContain("Calcium");
    });

    it("should match Becosules", () => {
      const result = matchMedicine("Becosules");
      expect(result).not.toBeNull();
      expect(result!.manufacturer).toBe("Pfizer Ltd");
      expect(result!.composition).toContain("Vitamin B");
    });

    it("should match Glycomet 500", () => {
      const result = matchMedicine("Glycomet 500");
      expect(result).not.toBeNull();
      expect(result!.manufacturer).toBe("USV Pvt Ltd");
      expect(result!.composition).toContain("Metformin");
    });

    it("should match Atorva 20", () => {
      const result = matchMedicine("Atorva 20");
      expect(result).not.toBeNull();
      expect(result!.manufacturer).toBe("Sun Pharmaceutical Industries Ltd");
    });
  });

  describe("Case-insensitive matching", () => {
    it("should match 'dolo 650' (lowercase)", () => {
      const result = matchMedicine("dolo 650");
      expect(result).not.toBeNull();
      expect(result!.manufacturer).toBe("Micro Labs Ltd");
    });

    it("should match 'DOLO 650' (uppercase)", () => {
      const result = matchMedicine("DOLO 650");
      expect(result).not.toBeNull();
      expect(result!.manufacturer).toBe("Micro Labs Ltd");
    });

    it("should match 'Cetirizine 10mg'", () => {
      const result = matchMedicine("Cetirizine 10mg");
      expect(result).not.toBeNull();
      expect(result!.manufacturer).toBe("Cipla Ltd");
    });

    it("should match 'enterogermina sachet'", () => {
      const result = matchMedicine("enterogermina sachet");
      expect(result).not.toBeNull();
      expect(result!.manufacturer).toBe("Sanofi India Ltd");
      expect(result!.form).toBe("sachet");
    });
  });

  describe("Partial name matching (longest match wins)", () => {
    it("should match 'Montair LC' to Montair", () => {
      const result = matchMedicine("Montair LC");
      expect(result).not.toBeNull();
      expect(result!.manufacturer).toBe("Cipla Ltd");
      expect(result!.composition).toContain("Montelukast");
    });

    it("should match 'Sinarest tablet' to Sinarest", () => {
      const result = matchMedicine("Sinarest tablet");
      expect(result).not.toBeNull();
      expect(result!.manufacturer).toBe("Micro Labs Ltd");
    });

    it("should match 'Benadryl cough syrup'", () => {
      const result = matchMedicine("Benadryl cough syrup");
      expect(result).not.toBeNull();
      expect(result!.manufacturer).toBe("Johnson & Johnson Ltd");
    });
  });

  describe("Unknown products — fallback behavior", () => {
    it("should return null for completely unknown products", () => {
      const result = matchMedicine("Xyzaborel 200mg");
      expect(result).toBeNull();
    });

    it("should return null for empty string", () => {
      const result = matchMedicine("");
      expect(result).toBeNull();
    });
  });

  describe("Benefits are product-specific", () => {
    it("Dolo 650 should have pain/fever benefits", () => {
      const result = matchMedicine("Dolo 650");
      expect(result!.benefits).toContain("pain");
      expect(result!.benefits).toContain("fever");
    });

    it("Azee should have antibiotic benefits", () => {
      const result = matchMedicine("Azee 500");
      expect(result!.benefits).toContain("antibiotic");
    });

    it("Pan should have acid/GERD benefits", () => {
      const result = matchMedicine("Pan 40");
      expect(result!.benefits).toContain("GERD");
    });

    it("Glycomet should have diabetes benefits", () => {
      const result = matchMedicine("Glycomet 500");
      expect(result!.benefits).toContain("diabetes");
    });

    it("Atorva should have cholesterol benefits", () => {
      const result = matchMedicine("Atorva 20");
      expect(result!.benefits).toContain("cholesterol");
    });

    it("Cetirizine should have allergy benefits", () => {
      const result = matchMedicine("Cetirizine 10mg");
      expect(result!.benefits).toContain("allergy");
    });

    it("Enterogermina should have probiotic benefits", () => {
      const result = matchMedicine("Enterogermina");
      expect(result!.benefits.toLowerCase()).toContain("probiotic");
    });

    it("Duphaston should have hormone-related benefits", () => {
      const result = matchMedicine("Duphaston");
      expect(result!.benefits).toContain("menstrual");
    });
  });

  describe("Descriptions are product-specific and detailed", () => {
    it("Dolo 650 should describe as Paracetamol", () => {
      const result = matchMedicine("Dolo 650");
      expect(result!.description).toContain("Dolo 650");
      expect(result!.description).toContain("Paracetamol");
      expect(result!.manufacturer).toBe("Micro Labs Ltd");
    });

    it("Azee should describe as Azithromycin", () => {
      const result = matchMedicine("Azee 500");
      expect(result!.description).toContain("Azithromycin");
      expect(result!.description).toContain("Cipla");
    });

    it("Combiflam should describe dual action", () => {
      const result = matchMedicine("Combiflam");
      expect(result!.description).toContain("Ibuprofen");
      expect(result!.description).toContain("Paracetamol");
    });
  });

  describe("Known Manufacturers fallback", () => {
    it("should find Dolo manufacturer", () => {
      expect(getKnownManufacturer("Dolo 650")).toBe("Micro Labs Ltd");
    });

    it("should find Crocin manufacturer", () => {
      expect(getKnownManufacturer("Crocin Plus")).toBe("GlaxoSmithKline Pharmaceuticals Ltd");
    });

    it("should find Montair manufacturer", () => {
      expect(getKnownManufacturer("Montair LC")).toBe("Cipla Ltd");
    });

    it("should return null for unknown brand", () => {
      expect(getKnownManufacturer("Xyzaborel")).toBeNull();
    });
  });

  describe("Known Benefits fallback", () => {
    it("should find paracetamol benefits", () => {
      const result = getKnownBenefits("Paracetamol 500mg", "tablet");
      expect(result).toContain("pain");
      expect(result).toContain("fever");
    });

    it("should find metformin benefits", () => {
      const result = getKnownBenefits("Metformin 850mg", "tablet");
      expect(result).toContain("diabetes");
    });

    it("should find amlodipine benefits", () => {
      const result = getKnownBenefits("Amlodipine 5mg", "tablet");
      expect(result).toContain("blood pressure");
    });

    it("should fall back to form-based for unknown composition", () => {
      const result = getKnownBenefits("Xyzaborel 100mg", "tablet");
      expect(result).toContain("oral dosage");
    });

    it("should fall back to form-based for cream", () => {
      const result = getKnownBenefits("Xyzaborel Cream", "cream");
      expect(result).toContain("Topical");
    });
  });

  describe("Consume Type inference", () => {
    it("tablet → For oral use", () => {
      expect(inferConsumeType("tablet")).toBe("For oral use");
    });

    it("capsule → For oral use", () => {
      expect(inferConsumeType("capsule")).toBe("For oral use");
    });

    it("syrup → For oral use", () => {
      expect(inferConsumeType("syrup")).toBe("For oral use");
    });

    it("cream → For external use only", () => {
      expect(inferConsumeType("cream")).toBe("For external use only");
    });

    it("gel → For external use only", () => {
      expect(inferConsumeType("gel")).toBe("For external use only");
    });

    it("injection → For injection use only", () => {
      expect(inferConsumeType("injection")).toBe("For injection use only");
    });

    it("nasal drops → For nasal use", () => {
      expect(inferConsumeType("nasal drops")).toBe("For nasal use");
    });

    it("sachet → For oral use", () => {
      expect(inferConsumeType("sachet")).toBe("For oral use");
    });

    it("lozenge → For oral use", () => {
      expect(inferConsumeType("lozenge")).toBe("For oral use");
    });

    it("unknown form → null", () => {
      expect(inferConsumeType("suppository")).toBeNull();
    });
  });

  describe("Placeholder image generation", () => {
    it("should generate SVG data URI with product initials", () => {
      const url = generatePlaceholderImage("Dolo 650");
      expect(url).toContain("data:image/svg+xml");
      // First letters of first two words: Dolo → D, 650 → 6
      expect(url).toContain("D");
    });

    it("should handle single-word products", () => {
      const url = generatePlaceholderImage("Crocin");
      expect(url).toContain("data:image/svg+xml");
      expect(url).toContain("C");
    });

    it("should always produce a valid URL", () => {
      const url = generatePlaceholderImage("Test Product 123");
      expect(url.startsWith("data:image/svg+xml")).toBe(true);
    });
  });

  describe("End-to-end enrichment flow (simulated)", () => {
    it("enrichment of 'Dolo 650' should return complete info", () => {
      const matched = matchMedicine("Dolo 650");
      expect(matched).not.toBeNull();
      expect(matched!.manufacturer).toBeTruthy();
      expect(matched!.benefits).toBeTruthy();
      expect(matched!.description).toBeTruthy();
      expect(matched!.composition).toBeTruthy();
      expect(matched!.form).toBeTruthy();
    });

    it("enrichment of unknown product should use fallbacks", () => {
      const matched = matchMedicine("UnknownMed 100mg");
      expect(matched).toBeNull();
      const mfg = getKnownManufacturer("UnknownMed 100mg");
      expect(mfg).toBeNull();
      const benefits = getKnownBenefits("Paracetamol 100mg", "tablet");
      expect(benefits).toContain("pain");
      const consumeType = inferConsumeType("tablet");
      expect(consumeType).toBe("For oral use");
    });

    it("enrichment should provide manufacturer for all 18 database products", () => {
      const productNames = [
        "Dolo 650", "Crocin", "Combiflam", "Azee 500", "Pan 40",
        "Omez 20", "Shelcal", "Becosules", "Glycomet 500", "Atorva 20",
        "Stamlo", "Cetirizine 10mg", "Montair", "Sinarest", "Asthalin",
        "Enterogermina", "Benadryl", "Duphaston",
      ];
      for (const name of productNames) {
        const result = matchMedicine(name);
        expect(result).not.toBeNull();
        expect(result!.manufacturer).toBeTruthy();
        expect(result!.benefits).toBeTruthy();
        expect(result!.description).toBeTruthy();
      }
    });
  });
});
