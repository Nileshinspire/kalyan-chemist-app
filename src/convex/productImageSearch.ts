import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Product enrichment database — known manufacturers for common Indian brands.
 * Used as a reliable fallback when API search doesn't return clear results.
 */
const KNOWN_MANUFACTURERS: Record<string, string> = {
  "dolo": "Micro Labs Ltd",
  "crocin": "GlaxoSmithKline Pharmaceuticals Ltd",
  "combiflam": "Sanofi India Ltd",
  "azel": "Dr. Reddy's Laboratories Ltd",
  "pan": "Alkem Laboratories Ltd",
  "pantop": "Alkem Laboratories Ltd",
  "omez": "Dr. Reddy's Laboratories Ltd",
  "rabe": "Dr. Reddy's Laboratories Ltd",
  "shelcal": "Torrent Pharmaceuticals Ltd",
  "becosules": "Pfizer Ltd",
  "pan 40": "Alkem Laboratories Ltd",
  "pan 20": "Alkem Laboratories Ltd",
  "azel dsr": "Dr. Reddy's Laboratories Ltd",
  "pan-d": "Alkem Laboratories Ltd",
  "azee": "Cipla Ltd",
  "azithral": "Alembic Pharmaceuticals Ltd",
  "doxynord": "Mankind Pharma Ltd",
  "levoflox": "Cipla Ltd",
  "amoxicillin": "Cipla Ltd",
  "metformin": "USV Pvt Ltd",
  "glycomet": "USV Pvt Ltd",
  "gudcef": "Lupin Ltd",
  "cefuroxime": "Lupin Ltd",
  "atorvastatin": "Ranbaxy Laboratories Ltd",
  "atorva": "Sun Pharmaceutical Industries Ltd",
  "azeloc": "Dr. Reddy's Laboratories Ltd",
  "montair": "Cipla Ltd",
  "cetirizine": "Cipla Ltd",
  "zyrtec": "Johnson & Johnson Ltd",
  "sinarest": "Micro Labs Ltd",
  "decolde": "Abbott India Ltd",
  "nasivion": "Meda Pharmaceuticals India",
  "vicks": "Procter & Gamble Health Ltd",
  "benadryl": "Johnson & Johnson Ltd",
  "ensure": "Abbott India Ltd",
  "ensure diabetes": "Abbott India Ltd",
  "dextromethorphan": "Cipla Ltd",
  "pcm": "Various",
  "paracetamol": "Various",
  "ibuprofen": "Various",
};

/**
 * Benefits knowledge base — maps common drug compositions/categories to their benefits.
 * This is used to auto-generate product-specific benefits.
 */
const BENEFITS_DB: Record<string, string> = {
  // Pain & Fever
  "paracetamol": "Provides effective relief from mild to moderate pain and reduces fever. Safe and well-tolerated when used as directed.",
  "acetaminophen": "Provides effective relief from mild to moderate pain and reduces fever. Safe and well-tolerated when used as directed.",
  "ibuprofen": "Reduces pain, inflammation, and fever. Anti-inflammatory action helps with headaches, muscle aches, and joint pain.",
  "diclofenac": "Powerful anti-inflammatory and pain reliever. Effective for joint pain, back pain, dental pain, and post-surgical pain.",
  "naproxen": "Long-lasting relief from pain and inflammation. Particularly effective for arthritis, menstrual cramps, and musculoskeletal conditions.",
  "nimesulide": "Fast-acting pain and inflammation reliever. Effective for acute pain, dental pain, and post-operative discomfort.",
  "aceclofenac": "Modern NSAID with effective pain relief and anti-inflammatory action. Lower gastrointestinal side effects compared to older NSAIDs.",

  // Antibiotics
  "amoxicillin": "Broad-spectrum antibiotic effective against common bacterial infections of the respiratory tract, urinary tract, and skin.",
  "azithromycin": "Effective macrolide antibiotic for respiratory infections, skin infections, and sexually transmitted diseases. Short course therapy.",
  "ciprofloxacin": "Fluoroquinolone antibiotic effective against a wide range of bacterial infections including urinary tract and respiratory infections.",
  "doxycycline": "Tetracycline antibiotic for respiratory infections, acne, malaria prophylaxis, and tick-borne diseases.",
  "levofloxacin": "Advanced fluoroquinolone antibiotic effective against respiratory infections, urinary tract infections, and complicated skin infections.",
  "cephalexin": "First-generation cephalosporin antibiotic effective against common skin, bone, and urinary tract infections.",
  "cefuroxime": "Second-generation cephalosporin antibiotic effective against respiratory infections, urinary tract infections, and Lyme disease.",
  "metronidazole": "Effective against anaerobic bacteria and parasites. Used for dental infections, abdominal infections, and certain parasitic infections.",

  // Diabetes
  "metformin": "First-line treatment for type 2 diabetes. Helps control blood sugar levels by improving insulin sensitivity. Supports healthy weight management.",
  "glimepiride": "Stimulates insulin release from the pancreas to help control blood sugar levels in type 2 diabetes.",
  "sitagliptin": "DPP-4 inhibitor that helps regulate blood sugar levels by increasing insulin production after meals.",
  "voglibose": "Alpha-glucosidase inhibitor that helps prevent blood sugar spikes after meals by slowing carbohydrate digestion.",

  // Cardiovascular
  "atorvastatin": "Statins help lower cholesterol levels and reduce the risk of heart attacks and strokes by blocking cholesterol production in the liver.",
  "rosuvastatin": "Highly effective statin for lowering LDL cholesterol and triglycerides while raising HDL cholesterol.",
  "amlodipine": "Calcium channel blocker that relaxes blood vessels to lower blood pressure and reduce chest pain (angina).",
  "losartan": "ARB (angiotensin receptor blocker) that lowers blood pressure and protects the kidneys in diabetic patients.",
  "telmisartan": "Long-acting ARB for blood pressure control with additional cardiovascular protective benefits.",
  "metoprolol": "Beta-blocker that reduces heart rate and blood pressure. Also used for heart failure and chest pain management.",

  // Gastric / Digestive
  "omeprazole": "Proton pump inhibitor that reduces stomach acid production. Provides relief from acid reflux, heartburn, and stomach ulcers.",
  "pantoprazole": "Proton pump inhibitor for long-lasting relief from gastroesophageal reflux disease (GERD), stomach ulcers, and acid-related disorders.",
  "rabeprazole": "Fast-acting proton pump inhibitor for acid reflux, peptic ulcers, and H. pylori eradication therapy.",
  "ranitidine": "H2 blocker that reduces stomach acid production for relief from heartburn and acid indigestion.",
  "esomeprazole": "S-isomer of omeprazole with enhanced acid suppression for GERD, erosive esophagitis, and duodenal ulcers.",

  // Allergy & Cold
  "cetirizine": "Non-drowsy antihistamine that provides 24-hour relief from allergic rhinitis, urticaria, and other allergy symptoms.",
  "loratadine": "Non-drowsy antihistamine for relief from sneezing, runny nose, itchy eyes, and other allergy symptoms.",
  "fexofenadine": "Second-generation antihistamine that provides effective allergy relief without causing drowsiness.",
  "levocetirizine": "Active enantiomer of cetirizine for potent, non-drowsy relief from chronic allergic conditions.",
  "montelukast": "Leukotriene receptor blocker that prevents asthma attacks and relieves seasonal allergy symptoms.",
  "phenylephrine": "Nasal decongestant that relieves sinus pressure and stuffy nose due to colds and allergies.",
  "pseudoephedrine": "Effective decongestant for sinus and nasal congestion associated with colds, flu, and allergies.",

  // Vitamins & Supplements
  "vitamin d": "Supports bone health, calcium absorption, and immune system function. Essential for preventing vitamin D deficiency.",
  "vitamin b12": "Essential for nerve function, red blood cell formation, and DNA synthesis. Supports energy levels and brain health.",
  "calcium": "Essential mineral for strong bones and teeth. Helps prevent osteoporosis and supports muscle and nerve function.",
  "iron": "Essential for making hemoglobin and preventing iron-deficiency anemia. Supports energy levels and oxygen transport.",
  "multivitamin": "Complete daily nutrition support with essential vitamins and minerals for overall health and wellness.",
  "omega": "Essential fatty acids that support heart health, brain function, and reduce inflammation.",

  // Skin & Topical
  "moisturizer": "Hydrates and nourishes the skin, helping to maintain the skin barrier and prevent dryness.",
  "sunscreen": "Protects skin from harmful UV rays, preventing sunburn, premature aging, and reducing skin cancer risk.",
  "antifungal": "Treats fungal infections of the skin, nails, and mucous membranes by targeting the fungal cell membrane.",

  // Gastrointestinal
  "loperamide": "Effective anti-diarrheal that slows gut motility to relieve acute and chronic diarrhea.",
  "orSaline": "Oral rehydration salts that replenish fluids and electrolytes lost during diarrhea or dehydration.",
  "ORS": "Oral rehydration salts that replenish fluids and electrolytes lost during diarrhea or dehydration.",

  // Respiratory
  "salbutamol": "Fast-acting bronchodilator that relieves acute asthma attacks and breathing difficulties.",
  "budesonide": "Inhaled corticosteroid that reduces airway inflammation and prevents asthma attacks with regular use.",

  // Hormones
  "levothyroxine": "Synthetic thyroid hormone for treating hypothyroidism. Helps regulate metabolism, energy, and body weight.",
};

/**
 * Try to extract manufacturer from known database based on product name.
 */
function getKnownManufacturer(productName: string): string | null {
  const lowerName = productName.toLowerCase();
  for (const [key, manufacturer] of Object.entries(KNOWN_MANUFACTURERS)) {
    if (lowerName.includes(key)) {
      return manufacturer;
    }
  }
  return null;
}

/**
 * Try to generate benefits from known compositions/categories.
 */
function getKnownBenefits(composition: string, form: string): string | null {
  const lowerComp = composition.toLowerCase();
  const lowerForm = form.toLowerCase();

  // Check each known benefit entry against the composition
  for (const [key, benefits] of Object.entries(BENEFITS_DB)) {
    if (lowerComp.includes(key)) {
      return benefits;
    }
  }

  // Form-specific fallback benefits
  if (lowerForm === "tablet" || lowerForm === "capsule") {
    return "Effective medication in convenient oral dosage form. Take as directed by your healthcare provider for best results.";
  }
  if (lowerForm === "syrup" || lowerForm === "suspension") {
    return "Easy-to-administer liquid formulation suitable for patients who have difficulty swallowing tablets.";
  }
  if (lowerForm === "cream" || lowerForm === "gel" || lowerForm === "ointment") {
    return "Topical formulation for targeted relief. Apply as directed to affected area for effective local treatment.";
  }
  if (lowerForm === "drops") {
    return "Precise dosing in liquid drop form for targeted application and easy administration.";
  }
  if (lowerForm === "injection") {
    return "Fast-acting injectable formulation for rapid therapeutic effect when oral administration is not suitable.";
  }

  return null;
}

/**
 * Auto-fetch product image using Google Custom Search API.
 * Requires GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID env vars.
 * Returns an image URL or null if not found.
 */
export const fetchProductImage = action({
  args: {
    productName: v.string(),
    manufacturer: v.optional(v.string()),
    brand: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!apiKey || !engineId) {
      return { success: false, imageUrl: null, reason: "API keys not configured" };
    }

    // Build a targeted search query for Indian medicine images
    const queryParts = [args.productName];
    if (args.brand) queryParts.push(args.brand);
    if (args.manufacturer) queryParts.push(args.manufacturer);
    queryParts.push("medicine tablet image");

    const query = encodeURIComponent(queryParts.join(" "));
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&searchType=image&q=${query}&num=5&imgType=photo&safe=active`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { success: false, imageUrl: null, reason: `API error: ${response.status}` };
      }

      const data = await response.json();
      const items = data.items;

      if (!items || items.length === 0) {
        return { success: false, imageUrl: null, reason: "No images found" };
      }

      // Try to find the best match by checking if the image title/link contains the product name
      const productNameLower = args.productName.toLowerCase();
      let bestMatch = items[0];

      for (const item of items) {
        const title = (item.title || "").toLowerCase();
        const link = (item.link || "").toLowerCase();
        if (title.includes(productNameLower) || link.includes(productNameLower.replace(/\s+/g, "-"))) {
          bestMatch = item;
          break;
        }
      }

      return {
        success: true,
        imageUrl: bestMatch.link,
        thumbnail: bestMatch.image?.thumbnailLink || bestMatch.link,
        title: bestMatch.title,
      };
    } catch (error: any) {
      return { success: false, imageUrl: null, reason: error.message || "Search failed" };
    }
  },
});

/**
 * Enrich a product with full information: image, manufacturer, benefits, consume type.
 * Uses Google Custom Search for images + known databases for manufacturer and benefits.
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
      consumeType: string | null;
    } = {
      imageUrl: null,
      manufacturer: null,
      benefits: null,
      consumeType: null,
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
        // Image fetch failed — continue with other fields
      }

      // 2. Web search for manufacturer info
      const webQuery = encodeURIComponent(`${args.productName} medicine manufacturer India site:1mg.com OR site:pharmeasy.in OR site:netmeds.com`);
      const webUrl = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&q=${webQuery}&num=3`;

      try {
        const response = await fetch(webUrl);
        if (response.ok) {
          const data = await response.json();
          const items = data.items;
          if (items) {
            for (const item of items) {
              const snippet = (item.snippet || "").toLowerCase();
              const title = (item.title || "").toLowerCase();

              // Try to find manufacturer in snippet/title
              const mfgMatch = snippet.match(/manufactured?\s+(?:by|at|in)\s+([A-Z][a-zA-Z\s&.]+(?:Ltd|Limited|Pharma|Laboratories|Industries|Pvt|Inc|Corp|Co\.))/i)
                || title.match(/manufactured?\s+(?:by|at|in)\s+([A-Z][a-zA-Z\s&.]+(?:Ltd|Limited|Pharma|Laboratories|Industries|Pvt|Inc|Corp|Co\.))/i);
              if (mfgMatch && !result.manufacturer) {
                result.manufacturer = mfgMatch[1].trim();
              }

              // Try to find benefits/uses in snippet
              const usesMatch = snippet.match(/(?:used?|benefits?|treats?|helps?\s+(?:in|with|to)|indicated?\s+(?:for|in))\s+(.{20,200}?)(?:\.|$)/i);
              if (usesMatch && !result.benefits) {
                result.benefits = usesMatch[1].trim().charAt(0).toUpperCase() + usesMatch[1].trim().slice(1);
              }
            }
          }
        }
      } catch {
        // Web search failed
      }
    }

    // 3. Manufacturer fallback: known database
    if (!result.manufacturer) {
      const known = getKnownManufacturer(args.productName);
      if (known) {
        result.manufacturer = known;
      } else if (args.manufacturer) {
        result.manufacturer = args.manufacturer;
      }
    }

    // 4. Benefits fallback: known database
    if (!result.benefits) {
      const composition = args.composition || args.productName;
      const knownBenefits = getKnownBenefits(composition, args.form || "tablet");
      if (knownBenefits) {
        result.benefits = knownBenefits;
      }
    }

    // 5. Consume type: infer from form
    const form = (args.form || "").toLowerCase();
    if (["tablet", "capsule", "syrup", "suspension", "drops", "inhaler", "powder", "sachet"].includes(form)) {
      result.consumeType = "For oral use";
    } else if (["cream", "gel", "ointment", "lotion"].includes(form)) {
      result.consumeType = "For external use only";
    } else if (form === "injection") {
      result.consumeType = "For injection use only";
    } else if (form === "eye drops" || form === "ear drops" || form === "nasal drops") {
      result.consumeType = "For ophthalmic/ENT use";
    }

    return result;
  },
});
