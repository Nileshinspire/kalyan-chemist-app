import { getAuthUserId } from "@convex-dev/auth/server";
import { action, query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Known manufacturers for common Indian pharmaceutical brands
const KNOWN_MANUFACTURERS: Record<string, string> = {
  "dolo": "Micro Labs Ltd",
  "crocin": "GlaxoSmithKline Pharmaceuticals Ltd",
  "combiflam": "Sanofi India Ltd",
  "pan": "Alkem Laboratories Ltd",
  "pantop": "Alkem Laboratories Ltd",
  "omez": "Dr. Reddy's Laboratories Ltd",
  "rabe": "Dr. Reddy's Laboratories Ltd",
  "shelcal": "Torrent Pharmaceuticals Ltd",
  "becosules": "Pfizer Ltd",
  "azee": "Cipla Ltd",
  "azithral": "Alembic Pharmaceuticals Ltd",
  "metformin": "USV Pvt Ltd",
  "glycomet": "USV Pvt Ltd",
  "atorva": "Sun Pharmaceutical Industries Ltd",
  "montair": "Cipla Ltd",
  "sinarest": "Micro Labs Ltd",
  "benadryl": "Johnson & Johnson Ltd",
  "ensure": "Abbott India Ltd",
  "doxynord": "Mankind Pharma Ltd",
  "gudcef": "Lupin Ltd",
  "cefuroxime": "Lupin Ltd",
  "azeloc": "Dr. Reddy's Laboratories Ltd",
  "zyrtec": "Johnson & Johnson Ltd",
  "nasivion": "Meda Pharmaceuticals India",
  "vicks": "Procter & Gamble Health Ltd",
  "decolde": "Abbott India Ltd",
};

// Known benefits for common drug compositions
const BENEFITS_DB: Record<string, string> = {
  "paracetamol": "Provides effective relief from mild to moderate pain and reduces fever. Safe and well-tolerated when used as directed.",
  "acetaminophen": "Provides effective relief from mild to moderate pain and reduces fever. Safe and well-tolerated when used as directed.",
  "ibuprofen": "Reduces pain, inflammation, and fever. Anti-inflammatory action helps with headaches, muscle aches, and joint pain.",
  "diclofenac": "Powerful anti-inflammatory and pain reliever. Effective for joint pain, back pain, dental pain, and post-surgical pain.",
  "amoxicillin": "Broad-spectrum antibiotic effective against common bacterial infections of the respiratory tract, urinary tract, and skin.",
  "azithromycin": "Effective macrolide antibiotic for respiratory infections, skin infections. Short course therapy.",
  "ciprofloxacin": "Fluoroquinolone antibiotic effective against a wide range of bacterial infections including urinary tract infections.",
  "doxycycline": "Antibiotic for respiratory infections, acne, malaria prophylaxis, and tick-borne diseases.",
  "levofloxacin": "Advanced antibiotic effective against respiratory infections, urinary tract infections, and complicated skin infections.",
  "metformin": "First-line treatment for type 2 diabetes. Helps control blood sugar levels by improving insulin sensitivity.",
  "atorvastatin": "Helps lower cholesterol levels and reduce the risk of heart attacks and strokes.",
  "rosuvastatin": "Highly effective statin for lowering LDL cholesterol and triglycerides while raising HDL cholesterol.",
  "amlodipine": "Calcium channel blocker that relaxes blood vessels to lower blood pressure and reduce chest pain.",
  "losartan": "ARB that lowers blood pressure and protects the kidneys in diabetic patients.",
  "telmisartan": "Long-acting medication for blood pressure control with additional cardiovascular protective benefits.",
  "omeprazole": "Proton pump inhibitor that reduces stomach acid production. Relief from acid reflux and stomach ulcers.",
  "pantoprazole": "Long-lasting relief from gastroesophageal reflux disease, stomach ulcers, and acid-related disorders.",
  "rabeprazole": "Fast-acting relief from acid reflux, peptic ulcers, and H. pylori eradication therapy.",
  "cetirizine": "Non-drowsy antihistamine that provides 24-hour relief from allergic rhinitis and urticaria.",
  "loratadine": "Non-drowsy antihistamine for relief from sneezing, runny nose, itchy eyes, and allergy symptoms.",
  "montelukast": "Leukotriene receptor blocker that prevents asthma attacks and relieves seasonal allergy symptoms.",
  "vitamin d": "Supports bone health, calcium absorption, and immune system function. Prevents vitamin D deficiency.",
  "vitamin b12": "Essential for nerve function, red blood cell formation, and DNA synthesis. Supports energy levels.",
  "calcium": "Essential mineral for strong bones and teeth. Helps prevent osteoporosis.",
  "iron": "Essential for making hemoglobin and preventing iron-deficiency anemia. Supports energy levels.",
  "multivitamin": "Complete daily nutrition support with essential vitamins and minerals for overall health and wellness.",
  "omega": "Essential fatty acids that support heart health, brain function, and reduce inflammation.",
  "metronidazole": "Effective against anaerobic bacteria and parasites. Used for dental and abdominal infections.",
  "nimesulide": "Fast-acting pain and inflammation reliever. Effective for acute pain and post-operative discomfort.",
  "aceclofenac": "Modern NSAID with effective pain relief and anti-inflammatory action.",
  "cetrizine": "Non-drowsy antihistamine for 24-hour allergy relief.",
  "salbutamol": "Fast-acting bronchodilator that relieves acute asthma attacks and breathing difficulties.",
  "budesonide": "Inhaled corticosteroid that reduces airway inflammation and prevents asthma attacks.",
  "levothyroxine": "Synthetic thyroid hormone for treating hypothyroidism. Helps regulate metabolism and energy.",
  "loperamide": "Effective anti-diarrheal that slows gut motility to relieve acute and chronic diarrhea.",
};

/**
 * Infer consume type from product form
 */
function inferConsumeType(form: string): string | null {
  const f = form.toLowerCase();
  if (["tablet", "capsule", "syrup", "suspension", "drops", "inhaler", "powder", "sachet"].includes(f)) {
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
// Query: list products needing enrichment (for admin UI)
// ══════════════════════════════════════════════════════════
export const listMissingInfo = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Not authorized");

    const allProducts = await ctx.db.query("products").collect();
    const missing = allProducts.filter((p) => !p.imageUrl || !p.benefits);
    return {
      total: allProducts.length,
      missingCount: missing.length,
      products: missing.slice(0, 50).map((p) => ({
        id: p._id,
        name: p.name,
        hasImage: !!p.imageUrl,
        hasBenefits: !!p.benefits,
        manufacturer: p.manufacturer,
      })),
    };
  },
});

// ══════════════════════════════════════════════════════════
// Mutation: enrich a single product using known databases
// ══════════════════════════════════════════════════════════
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
    const lowerName = product.name.toLowerCase();
    const searchIn = (product.composition || product.name).toLowerCase();

    // Manufacturer: try known DB
    if (!product.manufacturer) {
      for (const [key, mfr] of Object.entries(KNOWN_MANUFACTURERS)) {
        if (lowerName.includes(key)) {
          updates.manufacturer = mfr;
          break;
        }
      }
    }

    // Benefits: try known DB based on composition or product name
    if (!product.benefits) {
      for (const [key, benefits] of Object.entries(BENEFITS_DB)) {
        if (searchIn.includes(key)) {
          updates.benefits = benefits;
          break;
        }
      }
      // Form-specific fallback
      if (!updates.benefits && product.form) {
        const f = product.form.toLowerCase();
        if (["tablet", "capsule"].includes(f)) {
          updates.benefits = "Effective medication in convenient oral dosage form. Take as directed by your healthcare provider for best results.";
        } else if (["syrup", "suspension"].includes(f)) {
          updates.benefits = "Easy-to-administer liquid formulation suitable for patients who have difficulty swallowing tablets.";
        } else if (["cream", "gel", "ointment"].includes(f)) {
          updates.benefits = "Topical formulation for targeted relief. Apply as directed to affected area for effective local treatment.";
        } else if (f === "drops") {
          updates.benefits = "Precise dosing in liquid drop form for targeted application and easy administration.";
        } else if (f === "injection") {
          updates.benefits = "Fast-acting injectable formulation for rapid therapeutic effect when oral administration is not suitable.";
        }
      }
    }

    // Description: generate from product data if missing
    if (!product.description) {
      const parts: string[] = [];
      parts.push(`${product.name} is a ${product.form || "medication"} manufactured by ${product.manufacturer || "a pharmaceutical company"}.`);
      if (product.composition) parts.push(`It contains ${product.composition}.`);
      if (product.strength) parts.push(`Available in ${product.strength} strength.`);
      parts.push(product.prescriptionRequired ? "This is a prescription medicine." : "This is an over-the-counter product.");
      parts.push("Store in a cool, dry place away from direct sunlight.");
      updates.description = parts.join(" ");
    }

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

// ══════════════════════════════════════════════════════════
// Mutation: batch backfill existing products (process N at a time)
// ══════════════════════════════════════════════════════════
export const backfillProducts = mutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Not authorized");

    const limit = args.limit ?? 10;
    const allProducts = await ctx.db.query("products").collect();

    // Filter to products that need enrichment
    const needsEnrichment = allProducts.filter((p: any) => !p.imageUrl || !p.benefits);
    const toProcess = needsEnrichment.slice(0, limit);

    if (toProcess.length === 0) {
      return {
        processed: 0,
        enriched: 0,
        total: allProducts.length,
        message: "All products already have complete information",
      };
    }

    let enriched = 0;

    for (const product of toProcess) {
      const updates: Record<string, any> = {};
      const lowerName = product.name.toLowerCase();
      const searchIn = (product.composition || product.name).toLowerCase();

      // Manufacturer
      if (!product.manufacturer) {
        for (const [key, mfr] of Object.entries(KNOWN_MANUFACTURERS)) {
          if (lowerName.includes(key)) {
            updates.manufacturer = mfr;
            break;
          }
        }
      }

      // Benefits
      if (!product.benefits) {
        for (const [key, benefits] of Object.entries(BENEFITS_DB)) {
          if (searchIn.includes(key)) {
            updates.benefits = benefits;
            break;
          }
        }
        if (!updates.benefits && product.form) {
          const f = product.form.toLowerCase();
          if (["tablet", "capsule"].includes(f)) {
            updates.benefits = "Effective medication in convenient oral dosage form. Take as directed by your healthcare provider for best results.";
          } else if (["cream", "gel", "ointment"].includes(f)) {
            updates.benefits = "Topical formulation for targeted relief. Apply as directed to affected area.";
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(product._id, {
          ...updates,
          updatedAt: Date.now(),
        });
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
 * Enrich a single product with full information via web search.
 * Uses Google Custom Search API for images + web data.
 */
export const enrichProduct = action({
  args: {
    productName: v.string(),
    manufacturer: v.optional(v.string()),
    brand: v.optional(v.string()),
    composition: v.optional(v.string()),
    form: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    const result: {
      imageUrl: string | null;
      manufacturer: string | null;
      benefits: string | null;
    } = {
      imageUrl: null,
      manufacturer: null,
      benefits: null,
    };

    // 1. Image: Google Custom Search
    if (apiKey && engineId) {
      const queryParts = [args.productName];
      if (args.brand) queryParts.push(args.brand);
      if (args.manufacturer) queryParts.push(args.manufacturer);
      queryParts.push("medicine india");

      const query = encodeURIComponent(queryParts.join(" "));
      const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&searchType=image&q=${query}&num=5&imgType=photo&safe=active`;

      try {
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          const items = data.items;
          if (items && items.length > 0) {
            const productNameLower = args.productName.toLowerCase();
            let bestMatch = items[0];
            for (const item of items) {
              const title = (item.title || "").toLowerCase();
              if (title.includes(productNameLower)) {
                bestMatch = item;
                break;
              }
            }
            result.imageUrl = bestMatch.link;
          }
        }
      } catch {
        // Continue
      }

      // 2. Web search for manufacturer info
      const webQuery = encodeURIComponent(`${args.productName} medicine manufacturer India site:1mg.com OR site:pharmeasy.in`);
      const webUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${webQuery}&num=3`;

      try {
        const response = await fetch(webUrl);
        if (response.ok) {
          const data = await response.json();
          const items = data.items;
          if (items) {
            for (const item of items) {
              const snippet = (item.snippet || "").toLowerCase();
              const mfgMatch = snippet.match(/manufactured?\s+(?:by|at)\s+([A-Z][a-zA-Z\s&.]+(?:Ltd|Limited|Pharma|Laboratories))/i);
              if (mfgMatch && !result.manufacturer) {
                result.manufacturer = mfgMatch[1].trim();
              }
              const usesMatch = snippet.match(/(?:used?|benefits?|treats?|helps?\s+in)\s+(.{20,200}?)(?:\.|$)/i);
              if (usesMatch && !result.benefits) {
                result.benefits = usesMatch[1].trim().charAt(0).toUpperCase() + usesMatch[1].trim().slice(1);
              }
            }
          }
        }
      } catch {
        // Continue
      }
    }

    // 3. Manufacturer fallback: known database
    if (!result.manufacturer) {
      const lowerName = args.productName.toLowerCase();
      for (const [key, mfr] of Object.entries(KNOWN_MANUFACTURERS)) {
        if (lowerName.includes(key)) {
          result.manufacturer = mfr;
          break;
        }
      }
      if (!result.manufacturer && args.manufacturer) {
        result.manufacturer = args.manufacturer;
      }
    }

    // 4. Benefits fallback: known database
    if (!result.benefits) {
      const searchIn = (args.composition || args.productName).toLowerCase();
      for (const [key, benefits] of Object.entries(BENEFITS_DB)) {
        if (searchIn.includes(key)) {
          result.benefits = benefits;
          break;
        }
      }
    }

    return result;
  },
});
