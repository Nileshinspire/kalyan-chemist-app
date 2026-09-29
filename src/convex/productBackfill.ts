import { getAuthUserId } from "@convex-dev/auth/server";
import { action, query, mutation } from "./_generated/server";
import { v } from "convex/values";
import {
  MEDICINES_DB,
  getStorageInfo,
  findVerifiedReference,
  type MedicineInfo,
} from "./productReference";
import {
  classifyProduct,
  productDirections,
  productSafety,
  neutralDescription,
  isMedicine,
  isMedicineForm,
  formForKind,
  looksLikeMedicineTemplate,
  type ProductIdentity,
} from "./productInfo";
import { buildProductContent } from "./productContent";

// ════════════════════════════════════════════════════════════════
// VERIFIED PRODUCT REFERENCE DATA
// ════════════════════════════════════════════════════════════════

// The curated per-product reference records and the exact-variant match guard
// live in ./productReference, so the page, the enrichment action and the repair
// pipeline all resolve the same record for the same product. Nothing here may
// re-derive a reference record locally.
export { MEDICINES_DB, getStorageInfo, findVerifiedReference } from "./productReference";
export type { MedicineInfo, VerifiedReference } from "./productReference";

// Known manufacturers fallback
const KNOWN_MANUFACTURERS: Record<string, string> = {
  "dolo": "Micro Labs Ltd", "crocin": "GlaxoSmithKline Pharmaceuticals Ltd",
  "combiflam": "Sanofi India Ltd", "pan": "Alkem Laboratories Ltd",
  "pantop": "Alkem Laboratories Ltd", "omez": "Dr. Reddy's Laboratories Ltd",
  "rabe": "Dr. Reddy's Laboratories Ltd", "shelcal": "Torrent Pharmaceuticals Ltd",
  "becosules": "Pfizer Ltd", "azee": "Cipla Ltd",
  "azithral": "Alembic Pharmaceuticals Ltd", "glycomet": "USV Pvt Ltd",
  "atorva": "Sun Pharmaceutical Industries Ltd", "montair": "Cipla Ltd",
  "sinarest": "Micro Labs Ltd", "benadryl": "Johnson & Johnson Ltd",
  "vicks": "Procter & Gamble Health Ltd", "nasivion": "Meda Pharmaceuticals India",
};

// Storage guidance for a composition and dosage form now lives in
// ./productReference, next to the reference records it is derived from, so the
// page and the enrichment pipeline cannot drift apart on storage copy.




// Known benefits fallback
const BENEFITS_DB: Record<string, string> = {
  "paracetamol": "Provides fast and effective relief from mild to moderate pain including headaches, body aches, and toothache. Reduces fever safely and is gentle on the stomach when used as directed.",
  "ibuprofen": "Dual action pain reliever and anti-inflammatory that reduces pain, swelling, and fever. Effective for headaches, dental pain, menstrual cramps, muscle aches, and joint pain.",
  "diclofenac": "Potent anti-inflammatory and pain reliever effective for arthritis, joint pain, back pain, sprains, dental pain, and post-surgical pain. Reduces both pain and swelling.",
  "naproxen": "Long-lasting pain and inflammation relief lasting up to 12 hours. Particularly effective for arthritis, gout, menstrual cramps, and musculoskeletal conditions.",
  "nimesulide": "Fast-acting pain and inflammation reliever with rapid onset of action. Effective for acute pain, dental pain, post-operative discomfort, and menstrual cramps.",
  "aceclofenac": "Modern NSAID providing effective pain relief and anti-inflammatory action with a better gastrointestinal safety profile than older NSAIDs. Suitable for arthritis and joint pain.",
  "mefenamic acid": "Particularly effective for menstrual pain (dysmenorrhea) and provides anti-inflammatory relief from mild to moderate pain. Also reduces heavy menstrual bleeding.",
  "amoxicillin": "Broad-spectrum antibiotic effective against common bacterial infections of the respiratory tract, urinary tract, ear, throat, and skin. Well-tolerated with convenient dosing.",
  "azithromycin": "Convenient short-course antibiotic requiring only 3 to 5 days of treatment. Effective for respiratory infections, skin infections, ear infections, and throat infections.",
  "ciprofloxacin": "Powerful fluoroquinolone antibiotic effective against a wide range of bacterial infections including urinary tract infections, respiratory infections, and gastrointestinal infections.",
  "doxycycline": "Versatile tetracycline antibiotic effective for respiratory infections, acne, skin infections, malaria prophylaxis, and tick-borne diseases. Also used for STDs.",
  "levofloxacin": "Advanced fluoroquinolone with enhanced gram-positive coverage. Effective for respiratory infections, urinary tract infections, complicated skin infections, and community-acquired pneumonia.",
  "cefuroxime": "Second-generation cephalosporin with broad-spectrum coverage effective against respiratory infections, urinary tract infections, skin infections, and Lyme disease.",
  "cefixime": "Third-generation oral cephalosporin with convenient once-daily dosing. Effective for respiratory tract infections, urinary tract infections, and ENT infections.",
  "metronidazole": "Effective against anaerobic bacteria and parasites. Used for dental infections, abdominal infections, surgical prophylaxis, and parasitic infections including amoebiasis.",
  "metformin": "First-line treatment for type 2 diabetes that reduces liver glucose production and improves insulin sensitivity. Helps control blood sugar and supports healthy weight management.",
  "glimepiride": "Stimulates insulin release from the pancreas to help control blood sugar levels. Effective for postprandial glucose management in type 2 diabetes.",
  "gliclazide": "Sulfonylurea that stimulates pancreatic insulin secretion to control blood sugar. Also has beneficial effects on blood flow and may reduce diabetic complications.",
  "teneligliptin": "DPP-4 inhibitor with long duration of action providing once-daily blood sugar control. Low risk of hypoglycemia and well-tolerated in type 2 diabetes.",
  "atorvastatin": "Lowers LDL cholesterol and triglycerides while raising HDL cholesterol. Significantly reduces the risk of heart attack, stroke, and cardiovascular events.",
  "rosuvastatin": "Highly potent statin providing significant cholesterol reduction at low doses. Effectively lowers LDL and raises HDL with minimal side effects.",
  "amlodipine": "Calcium channel blocker providing smooth, gradual blood pressure reduction with 24-hour control. Also effective for angina (chest pain) relief.",
  "losartan": "Lowers blood pressure by blocking angiotensin II receptors. Provides additional kidney-protective benefits, especially useful for patients with diabetes.",
  "telmisartan": "Long-acting ARB providing sustained 24-hour blood pressure control with additional cardiovascular protective and metabolic benefits.",
  "metoprolol": "Cardioselective beta-blocker that reduces heart rate and blood pressure. Also used for heart failure, angina, and after heart attack recovery.",
  "omeprazole": "Provides lasting relief from acid reflux, heartburn, and stomach ulcers. Also used in H. pylori eradication therapy for stomach ulcers.",
  "pantoprazole": "Long-acting proton pump inhibitor providing sustained acid suppression for GERD, erosive esophagitis, and stomach ulcers. Well-tolerated for long-term use.",
  "rabeprazole": "Fast-acting proton pump inhibitor with rapid acid suppression. Effective for GERD, peptic ulcers, and H. pylori eradication therapy.",
  "cetirizine": "Non-drowsy antihistamine providing 24-hour relief from allergic rhinitis, sneezing, runny nose, itchy eyes, and chronic urticaria (skin rashes).",
  "loratadine": "Non-drowsy antihistamine providing 24-hour relief from sneezing, runny nose, itchy eyes, and other allergy symptoms without causing drowsiness.",
  "fexofenadine": "Non-sedating antihistamine providing effective relief from seasonal allergies and chronic urticaria without causing drowsiness. Suitable for daytime use.",
  "montelukast": "Prevents asthma attacks and relieves seasonal allergy symptoms by blocking leukotriene airway inflammation. Taken once daily for long-term management.",
  "salbutamol": "Fast-acting bronchodilator providing quick relief from acute asthma attacks and breathing difficulties within minutes of use.",
  "levothyroxine": "Replaces thyroid hormone to treat hypothyroidism. Helps regulate metabolism, energy levels, body weight, and overall thyroid function.",
  "vitamin d": "Essential for calcium absorption, bone health, and immune system function. Helps prevent vitamin D deficiency and supports muscle function.",
  "vitamin b12": "Essential for nerve function, red blood cell formation, energy production, and brain health. Important for vegetarians, vegans, and the elderly.",
  "calcium": "Essential mineral for strong bones and teeth. Supports muscle function, nerve signaling, and helps prevent osteoporosis and fractures.",
  "iron": "Essential for making hemoglobin to carry oxygen in the blood. Prevents and treats iron-deficiency anemia, reducing fatigue and weakness.",
  "multivitamin": "Complete daily nutrition with essential vitamins and minerals. Supports immunity, energy production, and fills nutritional gaps in the diet.",
  "prednisolone": "Corticosteroid that reduces inflammation and suppresses the immune system. Effective for allergic conditions, asthma, arthritis, and autoimmune disorders.",
  "theophylline": "Bronchodilator that opens airways for easier breathing. Used for long-term management of chronic asthma and COPD.",
};

// ════════════════════════════════════════════════════════════════
// DESCRIPTIONS DATABASE (composition-based description fallback)
// ════════════════════════════════════════════════════════════════

const DESCRIPTIONS_DB: Record<string, string> = {
  "paracetamol": "Paracetamol (Acetaminophen) is one of the most widely used over-the-counter medicines for pain relief and fever reduction. It works by blocking pain signals in the brain and regulating body temperature. It is gentle on the stomach and suitable for most adults and children over 12 years when taken as directed.",
  "ibuprofen": "Ibuprofen is a non-steroidal anti-inflammatory drug (NSAID) that provides effective relief from pain, swelling, and fever. It works by reducing the production of prostaglandins that cause inflammation. Suitable for headaches, dental pain, menstrual cramps, muscle aches, and joint pain.",
  "amoxicillin": "Amoxicillin is a widely prescribed broad-spectrum penicillin antibiotic used to treat a variety of bacterial infections. It works by inhibiting the growth of bacteria and is effective against infections of the respiratory tract, urinary tract, ear, nose, throat, and skin.",
  "azithromycin": "Azithromycin is a macrolide antibiotic effective against a wide range of bacterial infections. It works by stopping bacterial growth and is known for its convenient short-course therapy, typically requiring only 3 to 5 days of treatment.",
  "cetirizine": "Cetirizine is a second-generation antihistamine that provides effective 24-hour relief from allergy symptoms such as sneezing, runny nose, itchy eyes, and skin rashes. It works by blocking histamine receptors and causes minimal drowsiness.",
  "metformin": "Metformin is the most widely prescribed first-line medication for type 2 diabetes. It works by reducing glucose production in the liver and improving the body response to insulin.",
  "amlodipine": "Amlodipine is a calcium channel blocker used to treat high blood pressure and angina. It works by relaxing blood vessels, allowing blood to flow more easily, which reduces the workload on the heart.",
  "omeprazole": "Omeprazole is a proton pump inhibitor that effectively reduces stomach acid production. It provides relief from conditions such as acid reflux (GERD), heartburn, and stomach ulcers.",
  "pantoprazole": "Pantoprazole is a proton pump inhibitor that provides long-lasting relief from excess stomach acid. It is used to treat GERD, erosive esophagitis, and stomach ulcers.",
  "atorvastatin": "Atorvastatin is a statin medication that effectively lowers LDL cholesterol and triglycerides while raising HDL cholesterol. It significantly reduces the risk of heart attack and stroke.",
  "losartan": "Losartan is an angiotensin II receptor blocker used to treat high blood pressure. It works by relaxing blood vessels and also provides kidney-protective benefits.",
  "telmisartan": "Telmisartan is a long-acting angiotensin II receptor blocker that provides sustained 24-hour blood pressure control with additional cardiovascular protective benefits.",
  "diclofenac": "Diclofenac is an NSAID that provides effective relief from pain and inflammation. It is available in oral, topical, and injectable forms for various pain conditions.",
  "ciprofloxacin": "Ciprofloxacin is a fluoroquinolone antibiotic effective against a wide range of bacterial infections including urinary tract and respiratory infections.",
  "doxycycline": "Doxycycline is a broad-spectrum tetracycline antibiotic effective against respiratory infections, acne, malaria prophylaxis, and tick-borne diseases.",
  "salbutamol": "Salbutamol is a fast-acting bronchodilator used to relieve acute symptoms of asthma and COPD. It works by relaxing the muscles around the airways.",
  "montelukast": "Montelukast is a leukotriene receptor antagonist used to prevent asthma attacks and relieve seasonal allergy symptoms.",
  "vitamin d": "Vitamin D3 is essential for calcium absorption and bone health. It supports the immune system, muscle function, and overall well-being.",
  "vitamin b12": "Vitamin B12 is essential for nerve function, red blood cell formation, and DNA synthesis.",
  "calcium": "Calcium is an essential mineral for strong bones and teeth. It also supports muscle function, nerve signaling, and blood clotting.",
  "iron": "Iron is essential for making hemoglobin, the protein in red blood cells that carries oxygen throughout the body.",
  "multivitamin": "A comprehensive multivitamin provides essential nutrients needed for daily health and wellness.",
  "theophylline": "Theophylline is a methylxanthine bronchodilator used for the maintenance treatment of chronic asthma and COPD.",
  "levothyroxine": "Levothyroxine is a synthetic thyroid hormone used to treat hypothyroidism (underactive thyroid).",
  "prednisolone": "Prednisolone is a corticosteroid used to treat a wide range of inflammatory and autoimmune conditions.",
  "clobetasol": "Clobetasol is a potent corticosteroid used to treat severe inflammatory skin conditions such as eczema and psoriasis.",
  "adapalene": "Adapalene is a retinoid-like compound used for the treatment of acne. It works by promoting skin cell turnover and preventing clogged pores.",
};

/**
 * Look up a proper product description from the descriptions database based on composition.
 */
function getDescriptionForComposition(composition: string): string | null {
  const lowerComp = composition.toLowerCase();
  for (const [key, desc] of Object.entries(DESCRIPTIONS_DB)) {
    if (lowerComp.includes(key)) return desc;
  }
  return null;
}

// Directions are never inferred from the `form` field. A form field alone
// cannot be trusted — a condom, a test strip or a monitor stored with
// `form: "tablet"` used to be told "Tablet — taken orally with water." All
// usage copy now comes from productInfo.productDirections(), which classifies
// the product from strong identity signals first.

/**
 * The verified reference record for a product, or null.
 *
 * Delegates to the shared lookup in ./productReference so the variant guard
 * (strength and dosage form must match) applies here too. A product that only
 * shares a brand with a catalog entry gets nothing, which is correct: its
 * composition and benefits are not the same product's.
 */
function matchMedicine(
  productName: string,
  identity: Partial<ProductIdentity> = {}
): MedicineInfo | null {
  return findVerifiedReference({ ...identity, name: productName }).reference;
}

// ════════════════════════════════════════════════════════════════
// QUERIES
// ════════════════════════════════════════════════════════════════

export const listMissingInfo = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Not authorized");

    const allProducts = await ctx.db.query("products").collect();
    const missing = allProducts.filter((p) => !p.imageUrl || !p.benefits || !p.description);
    return {
      total: allProducts.length,
      missingCount: missing.length,
      products: missing.slice(0, 50).map((p) => ({
        id: p._id,
        name: p.name,
        hasImage: !!p.imageUrl,
        hasBenefits: !!p.benefits,
        hasDescription: !!p.description,
        manufacturer: p.manufacturer,
      })),
    };
  },
});

// ════════════════════════════════════════════════════════════════
// MUTATIONS
// ════════════════════════════════════════════════════════════════

/**
 * Enrich a single product using the local medicine database.
 * No paid API required — uses curated Indian medicines data.
 */
export const enrichSingleProduct = mutation({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Not authorized");

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    const updates: Record<string, any> = {};
    const matched = matchMedicine(product.name);

    if (matched) {
      // Use comprehensive database match
      if (!product.manufacturer || product.manufacturer === "Unknown") {
        updates.manufacturer = matched.manufacturer;
      }
      if (!product.benefits) {
        updates.benefits = matched.benefits;
      }
      if (!product.description) {
        updates.description = matched.description;
      }
      if (!product.composition) {
        updates.composition = matched.composition;
      }
      // Safety note — standard for all products
      if (!product.safetyNote) {
        updates.safetyNote = "Consult your doctor or pharmacist before use.";
      }
    } else {
      // Fallback: try known DBs
      const lowerName = product.name.toLowerCase();
      if (!product.manufacturer || product.manufacturer === "Unknown") {
        for (const [key, mfr] of Object.entries(KNOWN_MANUFACTURERS)) {
          if (lowerName.includes(key)) {
            updates.manufacturer = mfr;
            break;
          }
        }
      }
      if (!product.benefits) {
        const searchIn = (product.composition || product.name).toLowerCase();
        for (const [key, benefits] of Object.entries(BENEFITS_DB)) {
          if (searchIn.includes(key)) {
            updates.benefits = benefits;
            break;
          }
        }
        // Form-specific fallback
        if (!updates.benefits && product.form) {
          const f = product.form.toLowerCase();
          if (["tablet", "capsule"].includes(f))
            updates.benefits = "Effective medication in convenient oral dosage form. Take as directed by your healthcare provider for best results.";
          else if (["syrup", "suspension"].includes(f))
            updates.benefits = "Easy-to-administer liquid formulation suitable for patients who have difficulty swallowing tablets.";
          else if (["cream", "gel", "ointment"].includes(f))
            updates.benefits = "Topical formulation for targeted relief. Apply as directed to affected area for effective local treatment.";
          else if (f === "drops")
            updates.benefits = "Precise dosing in liquid drop form for targeted application and easy administration.";
          else if (f === "injection")
            updates.benefits = "Fast-acting injectable formulation for rapid therapeutic effect.";
        }
      }
      if (!product.description) {
        const parts: string[] = [];
        parts.push(`${product.name} is a ${product.form || "medication"} manufactured by ${product.manufacturer || "a pharmaceutical company"}.`);
        if (product.composition) parts.push(`It contains ${product.composition}.`);
        if (product.strength) parts.push(`Available in ${product.strength} strength.`);
        parts.push(product.prescriptionRequired ? "This is a prescription medicine." : "This is an over-the-counter product.");
        parts.push("Store in a cool, dry place away from direct sunlight.");
        updates.description = parts.join(" ");
      }
    }

    // Always set safety note if missing
    if (!product.safetyNote) {
      updates.safetyNote = "Consult your doctor or pharmacist before use.";
    }

    // Regenerate the structured Product Detail content from this product's own
    // fields, so all seven sections below the product card are rebuilt from
    // one verified source and cannot disagree with each other.
    const reference = findVerifiedReference({
      name: product.name,
      form: product.form ?? null,
      packSize: product.packSize ?? null,
      categoryName: null,
      composition: product.composition ?? null,
      manufacturer: product.manufacturer ?? null,
      strength: product.strength ?? null,
    }).reference;
    updates.productContent = {
      ...buildProductContent({
        name: product.name,
        form: product.form ?? null,
        packSize: product.packSize ?? null,
        categoryName: null,
        composition: product.composition ?? null,
        manufacturer: product.manufacturer ?? null,
        strength: product.strength ?? null,
        reference,
        brand: null,
        prescriptionRequired: product.prescriptionRequired,
        storageInformation: product.storageInformation ?? null,
        safetyNote: product.safetyNote ?? null,
        benefits: product.benefits ?? null,
        benefitsSource: product.benefitsSource ?? null,
        expiryDate: product.expiryDate ?? null,
      }),
      verifiedAt: Date.now(),
    };

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(args.productId, {
        ...updates,
        updatedAt: Date.now(),
      });
      return { success: true, updated: Object.keys(updates) };
    }

    return { success: true, updated: [], message: "Product already has complete information" };
  },
});

/**
 * Batch backfill existing products (process N at a time).
 */
export const backfillProducts = mutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Not authorized");

    const limit = args.limit ?? 20;
    const allProducts = await ctx.db.query("products").collect();
    const needsEnrichment = allProducts.filter((p: any) => !p.imageUrl || !p.benefits || !p.description);
    const toProcess = needsEnrichment.slice(0, limit);

    if (toProcess.length === 0) {
      return { processed: 0, enriched: 0, total: allProducts.length, message: "All products already have complete information" };
    }

    let enriched = 0;

    for (const product of toProcess) {
      const updates: Record<string, any> = {};
      const matched = matchMedicine(product.name);

      if (matched) {
        if (!product.manufacturer || product.manufacturer === "Unknown") updates.manufacturer = matched.manufacturer;
        if (!product.benefits) updates.benefits = matched.benefits;
        if (!product.description) updates.description = matched.description;
        if (!product.composition) updates.composition = matched.composition;
      } else {
        const lowerName = product.name.toLowerCase();
        if (!product.manufacturer || product.manufacturer === "Unknown") {
          for (const [key, mfr] of Object.entries(KNOWN_MANUFACTURERS)) {
            if (lowerName.includes(key)) { updates.manufacturer = mfr; break; }
          }
        }
        if (!product.benefits) {
          const searchIn = (product.composition || product.name).toLowerCase();
          for (const [key, benefits] of Object.entries(BENEFITS_DB)) {
            if (searchIn.includes(key)) { updates.benefits = benefits; break; }
          }
        }
        if (!product.description) {
          const descFromDb = getDescriptionForComposition(product.composition || product.name);
          if (descFromDb) {
            updates.description = descFromDb;
          } else {
            const parts: string[] = [];
            parts.push(`${product.name} is a ${product.form || "medication"}.`);
            if (product.composition) parts.push(`It contains ${product.composition}.`);
            parts.push("Consult your healthcare provider for proper dosage.");
            updates.description = parts.join(" ");
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(product._id, { ...updates, updatedAt: Date.now() });
        enriched++;
      }
    }

    return {
      processed: toProcess.length,
      enriched,
      total: allProducts.length,
      remaining: needsEnrichment.length - toProcess.length,
    };
  },
});

/**
 * Enrich a product using the free enrichProduct action from productImageSearch.
 * Returns full product info including image, manufacturer, benefits, description.
 */
export const enrichProduct = action({
  args: {
    productName: v.string(),
    manufacturer: v.optional(v.string()),
    brand: v.optional(v.string()),
    composition: v.optional(v.string()),
    form: v.optional(v.string()),
    strength: v.optional(v.string()),
    dosage: v.optional(v.string()),
    packSize: v.optional(v.string()),
    sku: v.optional(v.string()),
    /** Admin's chosen category; a strong signal for product type. */
    categoryName: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    // Try the verified reference catalogue first (no API needed). The lookup
    // only returns a record that describes this exact variant, so "Dolo 500"
    // never borrows the 650 mg tablet's composition.
    const matched: MedicineInfo | null = findVerifiedReference({
      name: args.productName,
      form: args.form ?? null,
      packSize: args.packSize ?? null,
      categoryName: args.categoryName ?? null,
      composition: args.composition ?? null,
      manufacturer: args.manufacturer ?? null,
      strength: args.strength ?? null,
    }).reference;

    const result: {
      imageUrl: string | null;
      manufacturer: string | null;
      benefits: string | null;
      description: string | null;
      consumeType: string | null;
      safetyNote: string | null;
      form: string | null;
      storageInformation: string | null;
      composition: string | null;
      expiryDate: string | null;
      category: any;
      subcategory: string | null;
      /** How the product is actually used; drives all generated copy. */
      productKind: string;
      /** False when the product type could not be established with confidence. */
      kindConfident: boolean;
      kindReason: string;
      /** False when no verified reference record backs the clinical fields. */
      matchFound: boolean;
    } = {
      imageUrl: null, manufacturer: null, benefits: null, description: null,
      consumeType: null, safetyNote: null, form: null, storageInformation: null,
      composition: null, expiryDate: null, category: null, subcategory: null,
      productKind: "unknown", kindConfident: false, kindReason: "", matchFound: false,
    };

    // Category inference based on product form, composition, and name.
    // Returns { category, subcategory } matching the actual DB category hierarchy.
    function inferCategory(form: string, composition: string, name: string): { category: string; subcategory: string | null } | null {
      const f = form.toLowerCase();
      const c = composition.toLowerCase();
      const n = name.toLowerCase();

      // ── Exact medicine name mappings (highest confidence) ──
      const MEDICINE_CATEGORIES: Record<string, { category: string; subcategory: string }> = {
        // Pain Relief
        "dolo": { category: "Pain Relief", subcategory: "Pain Relief" },
        "crocin": { category: "Pain Relief", subcategory: "Pain Relief" },
        "combiflam": { category: "Pain Relief", subcategory: "Pain Relief" },
        "calpol": { category: "Pain Relief", subcategory: "Pain Relief" },
        "meftal": { category: "Pain Relief", subcategory: "Pain Relief" },
        "naprosyn": { category: "Pain Relief", subcategory: "Pain Relief" },
        "zandu balm": { category: "Pain Relief", subcategory: "Pain Relief" },
        "zandu": { category: "Pain Relief", subcategory: "Pain Relief" },
        "volini": { category: "Pain Relief", subcategory: "Pain Relief" },
        "volini spray": { category: "Pain Relief", subcategory: "Pain Relief" },
        "moov": { category: "Pain Relief", subcategory: "Pain Relief" },
        "moov spray": { category: "Pain Relief", subcategory: "Pain Relief" },
        "iodex": { category: "Pain Relief", subcategory: "Pain Relief" },
        "tiger balm": { category: "Pain Relief", subcategory: "Pain Relief" },
        "zeet": { category: "Pain Relief", subcategory: "Pain Relief" },
        "intex": { category: "Pain Relief", subcategory: "Pain Relief" },
        "deepspray": { category: "Pain Relief", subcategory: "Pain Relief" },
        // Heart & Cardio
        "atorva": { category: "Heart & Cardio", subcategory: "Heart & Cardio" },
        "amlogard": { category: "Heart & Cardio", subcategory: "Heart & Cardio" },
        "stamlo": { category: "Heart & Cardio", subcategory: "Heart & Cardio" },
        "telma": { category: "Heart & Cardio", subcategory: "Heart & Cardio" },
        "losar": { category: "Heart & Cardio", subcategory: "Heart & Cardio" },
        // Diabetes Care
        "glycomet": { category: "Diabetes Care", subcategory: "Diabetes Care" },
        // Digestive Health
        "pan": { category: "Digestive Health", subcategory: "Digestive Health" },
        "omez": { category: "Digestive Health", subcategory: "Digestive Health" },
        "rabecee": { category: "Digestive Health", subcategory: "Digestive Health" },
        "digene": { category: "Digestive Health", subcategory: "Digestive Health" },
        "gelusil": { category: "Digestive Health", subcategory: "Digestive Health" },
        "enterogermina": { category: "Digestive Health", subcategory: "Digestive Health" },
        // Vitamins & Supplements
        "shelcal": { category: "Vitamins & Supplements", subcategory: "Vitamins & Supplements" },
        "becosules": { category: "Vitamins & Supplements", subcategory: "Vitamins & Supplements" },
        "supradyn": { category: "Vitamins & Supplements", subcategory: "Vitamins & Supplements" },
        "neurobion": { category: "Vitamins & Supplements", subcategory: "Vitamins & Supplements" },
        "revital": { category: "Vitamins & Supplements", subcategory: "Vitamins & Supplements" },
        // Antibiotics
        "azee": { category: "Antibiotics", subcategory: "Antibiotics" },
        "augmentin": { category: "Antibiotics", subcategory: "Antibiotics" },
        "zifi": { category: "Antibiotics", subcategory: "Antibiotics" },
        "taxim": { category: "Antibiotics", subcategory: "Antibiotics" },
        "gudcef": { category: "Antibiotics", subcategory: "Antibiotics" },
        "mox": { category: "Antibiotics", subcategory: "Antibiotics" },
        // Cold & Cough
        "sinarest": { category: "Health & Safety", subcategory: "Cold & Cough" },
        "benadryl": { category: "Health & Safety", subcategory: "Cold & Cough" },
        "vicks": { category: "Health & Safety", subcategory: "Cold & Cough" },
        "tuspel": { category: "Health & Safety", subcategory: "Cold & Cough" },
        "ascoril": { category: "Health & Safety", subcategory: "Cold & Cough" },
        "asthalin": { category: "Health & Safety", subcategory: "Cold & Cough" },
        "nasivion": { category: "Health & Safety", subcategory: "Cold & Cough" },
        // Eye & Ear Care
        "toba eye drops": { category: "Personal Care", subcategory: "Eye & Ear Care" },
        "ozidex": { category: "Personal Care", subcategory: "Eye & Ear Care" },
        // Antiseptic / First Aid
        "cipladine": { category: "Health & Safety", subcategory: "First Aid" },
        // Duphaston → Baby & Mother
        "duphaston": { category: "Baby & Mother", subcategory: "Baby & Mother" },
      };

      // Try exact match first
      if (MEDICINE_CATEGORIES[n]) return MEDICINE_CATEGORIES[n];
      // Try stripped name
      const stripped = n.replace(/\s*\d+\s*(mg|ml|g|mcg|iu|%)?$/i, "").trim();
      if (MEDICINE_CATEGORIES[stripped]) return MEDICINE_CATEGORIES[stripped];
      // Try partial match (longest key wins)
      let bestKey = "";
      let bestMatch: { category: string; subcategory: string } | null = null;
      for (const [key, val] of Object.entries(MEDICINE_CATEGORIES)) {
        if (n.includes(key) && key.length > bestKey.length) {
          bestKey = key;
          bestMatch = val;
        }
      }
      if (bestMatch) return bestMatch;

      // ── Composition-based fallback ──
      if (c.includes("paracetamol") || c.includes("ibuprofen") || c.includes("diclofenac") || c.includes("nimesulide") || c.includes("naproxen") || c.includes("mefenamic acid") || c.includes("aceclofenac"))
        return { category: "Pain Relief", subcategory: "Pain Relief" };
      if (c.includes("amoxicillin") || c.includes("azithromycin") || c.includes("cefixime") || c.includes("ciprofloxacin") || c.includes("doxycycline") || c.includes("cefuroxime") || c.includes("metronidazole") || c.includes("ceftriaxone"))
        return { category: "Antibiotics", subcategory: "Antibiotics" };
      if (c.includes("metformin") || c.includes("glimepiride") || c.includes("gliclazide") || c.includes("teneligliptin"))
        return { category: "Diabetes Care", subcategory: "Diabetes Care" };
      if (c.includes("amlodipine") || c.includes("losartan") || c.includes("telmisartan") || c.includes("atorvastatin") || c.includes("metoprolol") || c.includes("rosuvastatin"))
        return { category: "Heart & Cardio", subcategory: "Heart & Cardio" };
      if (c.includes("pantoprazole") || c.includes("omeprazole") || c.includes("rabeprazole") || c.includes("ranitidine") || c.includes("magaldrate") || c.includes("simethicone"))
        return { category: "Digestive Health", subcategory: "Digestive Health" };
      if (c.includes("cetirizine") || c.includes("loratadine") || c.includes("fexofenadine") || c.includes("montelukast"))
        return { category: "Health & Safety", subcategory: "Cold & Cough" };
      if (c.includes("vitamin") || c.includes("calcium") || c.includes("iron") || c.includes("multivitamin") || c.includes("ginseng"))
        return { category: "Vitamins & Supplements", subcategory: "Vitamins & Supplements" };
      if (c.includes("salbutamol") || c.includes("ambroxol") || c.includes("bromhexine") || c.includes("guaifenesin") || c.includes("dextromethorphan"))
        return { category: "Health & Safety", subcategory: "Cold & Cough" };
      if (c.includes("oxymetazoline") || c.includes("xylometazoline"))
        return { category: "Health & Safety", subcategory: "Cold & Cough" };
      if (c.includes("ofloxacin") && (f === "drops" || n.includes("eye")))
        return { category: "Personal Care", subcategory: "Eye & Ear Care" };
      if (c.includes("tobramycin") && f === "drops")
        return { category: "Personal Care", subcategory: "Eye & Ear Care" };
      if (c.includes("prednisolone") || c.includes("clobetasol") || c.includes("adapalene"))
        return { category: "Skin & Personal Care", subcategory: "Skin & Personal Care" };
      if (c.includes("levothyroxine"))
        return { category: "Others", subcategory: "Other Healthcare Products" };

      // ── Form-based fallback ──
      if (["cream", "gel", "ointment", "lotion"].includes(f))
        return { category: "Skin & Personal Care", subcategory: "Skin & Personal Care" };
      if (f === "spray")
        return { category: "Pain Relief", subcategory: "Pain Relief" };
      if (f === "drops" && (n.includes("eye") || c.includes("ofloxacin") || c.includes("tobramycin")))
        return { category: "Personal Care", subcategory: "Eye & Ear Care" };
      if (f === "drops" && (n.includes("nasal") || c.includes("oxymetazoline")))
        return { category: "Health & Safety", subcategory: "Cold & Cough" };
      if (f === "nasal drops" || f === "nasal")
        return { category: "Health & Safety", subcategory: "Cold & Cough" };
      if (["syrup", "suspension"].includes(f) && (c.includes("paracetamol") || c.includes("phenylephrine")))
        return { category: "Health & Safety", subcategory: "Cold & Cough" };
      if (f === "powder" && (c.includes("sodium bicarbonate") || c.includes("antacid") || n.includes("eno") || n.includes("gelusil")))
        return { category: "Digestive Health", subcategory: "Digestive Health" };
      if (f === "sachet" && c.includes("bacillus"))
        return { category: "Digestive Health", subcategory: "Digestive Health" };
      if (f === "inhaler" || f === "respules")
        return { category: "Health & Safety", subcategory: "Cold & Cough" };
      if (c.includes("bacillus") || c.includes("probiotic"))
        return { category: "Digestive Health", subcategory: "Digestive Health" };

      return null;
    }

    // Classify what this product actually IS before writing any copy. The
    // product name outranks the `form` field, so a condom stored as
    // `form: "tablet"` is still treated as a condom and never gets oral
    // medicine instructions.
    const identity = {
      name: args.productName,
      form: matched?.form || args.form || null,
      packSize: args.packSize || null,
      categoryName: args.categoryName ?? null,
      composition: matched?.composition || args.composition || null,
      manufacturer: matched?.manufacturer || args.manufacturer || null,
      strength: args.strength ?? null,
    };
    const classification = classifyProduct(identity);
    result.productKind = classification.kind;
    result.kindConfident = classification.confident;
    result.kindReason = classification.reason;

    if (matched) {
      result.matchFound = true;
      result.manufacturer = matched.manufacturer;
      result.benefits = matched.benefits;
      result.description = matched.description;
      // Directions and safety follow the classified product type.
      result.consumeType = productDirections(identity, classification.kind);
      result.safetyNote = productSafety(identity, classification.kind);
      // Form — return for auto-select in admin form
      result.form = matched.form || args.form || null;
      // Composition — return matched composition
      result.composition = matched.composition || null;
      // Expiry Date — use if available in DB, never calculate
      result.expiryDate = matched.expiryDate || null;
      // Storage Information — use medicine-specific if available, else compose from composition/form
      result.storageInformation = matched.storageInformation || getStorageInfo(matched.composition || "", matched.form || args.form || "tablet");
      // Category inference
      result.category = inferCategory(matched.form || args.form || "", matched.composition || "", args.productName);
    } else {
      // No verified reference record. Only the manufacturer the admin supplied
      // is carried over; benefits and clinical copy are NOT invented.
      result.matchFound = false;
      if (args.manufacturer) result.manufacturer = args.manufacturer;

      const composition = args.composition || "";
      for (const [key, benefits] of Object.entries(BENEFITS_DB)) {
        if (composition.toLowerCase().includes(key)) { result.benefits = benefits; break; }
      }

      // A neutral description that never claims the product is a medication and
      // never asserts an ingredient we were not given.
      result.description = classification.confident
        ? neutralDescription(identity, classification.kind)
        : null;
      result.consumeType = productDirections(identity, classification.kind);
      result.safetyNote = productSafety(identity, classification.kind);
      result.form = args.form || null;
      result.composition = args.composition || null;
      // Expiry Date — leave null for unknown medicines
      result.expiryDate = null;
      // Storage Information — based on composition and form
      result.storageInformation = getStorageInfo(args.composition || args.productName, args.form || "");
      // Category inference
      result.category = inferCategory(args.form || "", args.composition || "", args.productName);
    }

    // No image is produced here on purpose. A chemical structure from
    // Wikimedia Commons, or a generated initials graphic, is not a product
    // packshot. Images come exclusively from the verified resolver
    // (productImageResolver), which proves the image belongs to this exact
    // product and stores it in Convex storage.
    result.imageUrl = null;

    return result;
  },
});

/**
 * Returns reference candidates for a name the admin typed, so similarly named
 * variants ("Manforce Condom" vs "Manforce 100mg") are never silently merged.
 *
 * The admin picks the exact product and the enrichment is re-run for it. This
 * only ever returns options — it never applies anything on its own.
 */
export const findProductCandidates = action({
  args: {
    productName: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (_ctx, args) => {
    const limit = args.limit ?? 8;
    const query = args.productName.toLowerCase().trim();
    if (!query) return [];

    const words = query.split(/\s+/).filter((w) => w.length > 1);
    const scored: Array<{
      name: string;
      manufacturer: string;
      composition: string;
      form: string | null;
      score: number;
    }> = [];

    for (const [key, info] of Object.entries(MEDICINES_DB)) {
      const k = key.toLowerCase();
      let score = 0;
      if (k === query) score = 100;
      else if (query.includes(k)) score = 70 + k.length;
      else if (k.includes(query)) score = 60 + query.length;
      else {
        // Partial word overlap, e.g. "Manforce 100mg" for "Manforce".
        const shared = words.filter((w) => k.includes(w)).length;
        if (shared > 0) score = 30 + shared * 10;
      }
      if (score > 0) {
        scored.push({
          name: key,
          manufacturer: info.manufacturer,
          composition: info.composition,
          form: info.form ?? null,
          score,
        });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    // Collapse duplicates that resolve to the same product record.
    const seen = new Set<string>();
    return scored.filter((c) => {
      const key = `${c.manufacturer}|${c.composition}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);
  },
});

/**
 * Repairs the product information on EXISTING products.
 *
 * Existing rows were written by the old form-driven generator, so a condom
 * filed as `form: "tablet"` carries "Tablet — taken orally with water", a gel
 * is described with a tablet dose, and a test strip is given medicine safety
 * copy. This walks every product and rewrites the derived fields from what is
 * actually known about that exact product:
 *
 * - a verified reference record for this exact variant supplies composition,
 *   benefits, manufacturer and form;
 * - otherwise a confident product type supplies handling instructions only,
 *   and every clinical claim is cleared rather than invented;
 * - the structured `productContent` snapshot the Product Detail page reads is
 *   regenerated, so all seven sections below the product card are rebuilt
 *   together and cannot disagree with each other.
 *
 * Nothing else is touched: price, stock, images, category, cart and order data
 * are never written here.
 */
export const repairProductInformation = mutation({
  args: {
    dryRun: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Not authorized");

    const dryRun = args.dryRun ?? false;
    const limit = args.limit ?? 500;
    const products = await ctx.db.query("products").take(limit);

    const changes: Array<{
      id: string;
      name: string;
      kind: string;
      changes: string[];
    }> = [];

    for (const product of products) {
      const category = product.categoryId
        ? await ctx.db.get(product.categoryId)
        : null;

      const identity = {
        name: product.name,
        form: product.form ?? null,
        packSize: product.packSize ?? null,
        categoryName: category?.name ?? null,
        composition: product.composition ?? null,
        manufacturer: product.manufacturer ?? null,
        strength: product.strength ?? null,
      };
      // Only a record that describes THIS variant is applied. A brand-level
      // substring hit is not enough — see the variant guard in ./productReference.
      const reference = findVerifiedReference(identity).reference;
      const classification = classifyProduct({
        ...identity,
        form: reference?.form ?? identity.form,
        composition: reference?.composition ?? identity.composition,
      });
      const patch: Record<string, unknown> = {};
      const changed: string[] = [];

      // Directions and safety: regenerated for a known product type, cleared
      // when we cannot establish one.
      const directions = classification.confident
        ? productDirections(identity, classification.kind)
        : null;
      const safety = classification.confident
        ? productSafety(identity, classification.kind)
        : null;

      if ((product.consumeType ?? null) !== directions) {
        patch.consumeType = directions ?? undefined;
        changed.push("consumeType");
      }
      if ((product.safetyNote ?? null) !== safety) {
        patch.safetyNote = safety ?? undefined;
        changed.push("safetyNote");
      }

      // Benefits are a clinical claim. They are kept only when a verified
      // record backs them; anything the old generator produced is cleared so
      // the section falls back to its honest "not available" message.
      const verifiedBenefits = reference?.benefits ?? null;
      if ((product.benefits ?? null) !== verifiedBenefits) {
        patch.benefits = verifiedBenefits ?? undefined;
        changed.push("benefits");
      }
      const source = reference ? "reference" : undefined;
      if ((product.benefitsSource ?? null) !== source) {
        patch.benefitsSource = source;
        changed.push("benefitsSource");
      }

      // A non-medicine must not keep a medicine form, and must not keep a
      // description that calls it a medication.
      if (
        classification.confident &&
        !isMedicine(classification.kind) &&
        isMedicineForm(product.form)
      ) {
        const corrected = formForKind(classification.kind);
        if (corrected) {
          patch.form = corrected;
          changed.push("form");
        }
      }
      if (
        classification.confident &&
        !isMedicine(classification.kind) &&
        looksLikeMedicineTemplate(product.description)
      ) {
        patch.description = neutralDescription(identity, classification.kind);
        changed.push("description");
      }
      if (!classification.confident && looksLikeMedicineTemplate(product.description)) {
        // Cannot say what it is, so do not assert it is a medication.
        patch.description = undefined;
        changed.push("description");
      }

      // A condom or a test strip has no active ingredients. Rows written by the
      // old generator left real drug compositions on them (a condom listed as
      // "Paracetamol 500mg / 650mg"), which then produced a false ingredient
      // list and false storage guidance. Cleared rather than corrected: there
      // is no right answer to guess, only the pack.
      if (
        (classification.kind === "condom" || classification.kind === "device") &&
        product.composition
      ) {
        patch.composition = undefined;
        changed.push("composition");
      }
      if (
        (classification.kind === "condom" || classification.kind === "device") &&
        product.storageInformation
      ) {
        // A drug storage temperature on a condom or a test strip came from the
        // same mistaken composition, so it goes with it.
        patch.storageInformation = undefined;
        changed.push("storageInformation");
      }

      // Structured content for the Product Detail sections, built from this
      // product's own fields and the verified record.
      const content = buildProductContent({
        ...identity,
        reference,
        brand: null,
        prescriptionRequired: product.prescriptionRequired,
        storageInformation: product.storageInformation ?? null,
        safetyNote: product.safetyNote ?? null,
        benefits: product.benefits ?? null,
        benefitsSource: product.benefitsSource ?? null,
        expiryDate: product.expiryDate ?? null,
      });
      patch.productContent = { ...content, verifiedAt: Date.now() };
      changed.push("productContent");

      if (changed.length) {
        changes.push({ id: product._id, name: product.name, kind: classification.kind, changes: changed });
        if (!dryRun) await ctx.db.patch(product._id, patch);
      }
    }

    return {
      scanned: products.length,
      updated: changes.length,
      dryRun,
      changes,
    };
  },
});
