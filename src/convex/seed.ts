import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const CATEGORIES = [
  { name: "Pain Relief", slug: "pain-relief", description: "Analgesics, anti-inflammatory drugs, and muscle relaxants", sortOrder: 1 },
  { name: "Heart & Cardio", slug: "heart-cardio", description: "Cardiac care, blood pressure, and cholesterol management", sortOrder: 2 },
  { name: "Diabetes Care", slug: "diabetes-care", description: "Insulin, oral hypoglycaemics, and glucose monitoring supplies", sortOrder: 3 },
  { name: "Vitamins & Supplements", slug: "vitamins-supplements", description: "Daily wellness, immunity boosters, and nutritional supplements", sortOrder: 4 },
  { name: "Baby & Mother", slug: "baby-mother", description: "Infant nutrition, prenatal vitamins, and maternal care", sortOrder: 5 },
  { name: "Skin & Personal Care", slug: "skin-personal-care", description: "Dermatological products, sunscreens, and hygiene essentials", sortOrder: 6 },
  { name: "Antibiotics", slug: "antibiotics", description: "Prescription antibiotics and antimicrobial agents", sortOrder: 7 },
  { name: "Digestive Health", slug: "digestive-health", description: "Antacids, probiotics, and gastrointestinal medications", sortOrder: 8 },
];

const PRODUCTS: {
  name: string; slug: string; description: string; price: number;
  manufacturer: string; dosage: string; packSize: string;
  requiresPrescription: boolean; stockQuantity: number; categorySlug: string;
}[] = [
  { name: "Crocin Advance 500mg", slug: "crocin-advance-500mg", description: "Fast-acting paracetamol tablet for effective relief from headaches, body aches, and fever. Trusted by millions of Indian households.", price: 30, manufacturer: "GlaxoSmithKline", dosage: "500mg", packSize: "10 tablets", requiresPrescription: false, stockQuantity: 200, categorySlug: "pain-relief" },
  { name: "Brufen 400mg", slug: "brufen-400mg", description: "Ibuprofen-based anti-inflammatory tablet for pain relief and reducing inflammation. Suitable for muscular and joint pain.", price: 45, manufacturer: "Abbott", dosage: "400mg", packSize: "15 tablets", requiresPrescription: false, stockQuantity: 150, categorySlug: "pain-relief" },
  { name: "Volini Gel", slug: "volini-gel", description: "Topical analgesic gel for quick relief from muscle sprains, joint pain, and backache. Penetrates deep for lasting comfort.", price: 120, manufacturer: "Sun Pharma", dosage: "1%", packSize: "30g tube", requiresPrescription: false, stockQuantity: 100, categorySlug: "pain-relief" },
  { name: "Dolo 650", slug: "dolo-650", description: "High-strength paracetamol for moderate to severe pain and fever. Prescribed widely by physicians across India.", price: 35, manufacturer: "Micro Labs", dosage: "650mg", packSize: "10 tablets", requiresPrescription: false, stockQuantity: 250, categorySlug: "pain-relief" },
  { name: "Atorva 10mg", slug: "atorva-10mg", description: "Atorvastatin tablet for managing cholesterol levels and reducing the risk of cardiovascular events. Take as directed by your physician.", price: 85, manufacturer: "Zydus Cadila", dosage: "10mg", packSize: "10 tablets", requiresPrescription: true, stockQuantity: 120, categorySlug: "heart-cardio" },
  { name: "Telma 40", slug: "telma-40", description: "Telmisartan tablet for the treatment of high blood pressure. Once-daily dosing for consistent blood pressure control.", price: 110, manufacturer: "Glenmark", dosage: "40mg", packSize: "10 tablets", requiresPrescription: true, stockQuantity: 90, categorySlug: "heart-cardio" },
  { name: "Ecosprin 75mg", slug: "ecosprin-75mg", description: "Low-dose aspirin for preventing blood clots and reducing the risk of heart attack and stroke. Doctor-prescribed daily therapy.", price: 25, manufacturer: "USV", dosage: "75mg", packSize: "10 tablets", requiresPrescription: true, stockQuantity: 180, categorySlug: "heart-cardio" },
  { name: "Glycomet 500", slug: "glycomet-500", description: "Metformin tablet for managing type 2 diabetes. Helps control blood sugar levels when diet and exercise alone are not enough.", price: 40, manufacturer: "USV", dosage: "500mg", packSize: "20 tablets", requiresPrescription: true, stockQuantity: 160, categorySlug: "diabetes-care" },
  { name: "Januvia 100mg", slug: "januvia-100mg", description: "Sitagliptin tablet for improving blood sugar control in adults with type 2 diabetes. Once-daily oral medication.", price: 380, manufacturer: "MSD Pharma", dosage: "100mg", packSize: "10 tablets", requiresPrescription: true, stockQuantity: 60, categorySlug: "diabetes-care" },
  { name: "Accu-Chek Active Strips", slug: "accu-chek-active-strips", description: "Blood glucose monitoring test strips compatible with Accu-Chek Active glucometer. Accurate results in 5 seconds.", price: 550, manufacturer: "Roche", dosage: "N/A", packSize: "25 strips", requiresPrescription: false, stockQuantity: 80, categorySlug: "diabetes-care" },
  { name: "Dolo Neurobion Forte", slug: "dolo-neurobion-forte", description: "Combination of B-complex vitamins for nerve health, energy metabolism, and reducing fatigue. Trusted formula recommended by doctors.", price: 95, manufacturer: "Sanofi", dosage: "N/A", packSize: "10 tablets", requiresPrescription: false, stockQuantity: 200, categorySlug: "vitamins-supplements" },
  { name: "HealthKart HK Vitals Multivitamin", slug: "healthkart-hkvitals-multivitamin", description: "Complete daily multivitamin with essential vitamins and minerals for overall health and wellness. Suitable for adults.", price: 299, manufacturer: "HealthKart", dosage: "N/A", packSize: "60 tablets", requiresPrescription: false, stockQuantity: 140, categorySlug: "vitamins-supplements" },
  { name: "Supradyn Daily Energy", slug: "supradyn-daily-energy", description: "Effervescent multivitamin tablet with 21 essential nutrients. Supports immunity, energy, and daily wellness.", price: 180, manufacturer: "Bayer", dosage: "N/A", packSize: "10 effervescent tablets", requiresPrescription: false, stockQuantity: 110, categorySlug: "vitamins-supplements" },
  { name: "Methylcobalamin 1500mcg", slug: "methylcobalamin-1500mcg", description: "Vitamin B12 supplement for nerve health and red blood cell formation. Sublingual tablet for fast absorption.", price: 150, manufacturer: "Neurobion", dosage: "1500mcg", packSize: "30 tablets", requiresPrescription: false, stockQuantity: 90, categorySlug: "vitamins-supplements" },
  { name: "Evion 400", slug: "evion-400", description: "Vitamin E capsule for skin health, antioxidant protection, and post-pregnancy recovery. Dermatologist recommended.", price: 35, manufacturer: "Merck", dosage: "400 IU", packSize: "10 capsules", requiresPrescription: false, stockQuantity: 130, categorySlug: "baby-mother" },
  { name: "Prega News Kit", slug: "prega-news-kit", description: "Early detection pregnancy test kit with high accuracy. Provides results in just 5 minutes from the comfort of home.", price: 175, manufacturer: "Mankind", dosage: "N/A", packSize: "1 kit (2 tests)", requiresPrescription: false, stockQuantity: 60, categorySlug: "baby-mother" },
  { name: "Cetaphil Gentle Cleanser", slug: "cetaphil-gentle-cleanser", description: "Mild, soap-free facial cleanser for sensitive skin. Dermatologist recommended for daily cleansing without irritation.", price: 350, manufacturer: "Galderma", dosage: "N/A", packSize: "125ml", requiresPrescription: false, stockQuantity: 80, categorySlug: "skin-personal-care" },
  { name: "Minimalist Sunscreen SPF 50+", slug: "minimalist-sunscreen-spf50", description: "Broad-spectrum SPF 50+ sunscreen with no white cast. Lightweight, non-greasy formula for daily sun protection.", price: 399, manufacturer: "Minimalist", dosage: "SPF 50+", packSize: "50ml", requiresPrescription: false, stockQuantity: 95, categorySlug: "skin-personal-care" },
  { name: "Augmentin 625 Duo", slug: "augmentin-625-duo", description: "Amoxicillin and clavulanate potassium tablet for treating bacterial infections. Broad-spectrum antibiotic prescribed by doctors.", price: 220, manufacturer: "GSK", dosage: "625mg", packSize: "10 tablets", requiresPrescription: true, stockQuantity: 100, categorySlug: "antibiotics" },
  { name: "Azithral 500", slug: "azithral-500", description: "Azithromycin tablet for treating respiratory, skin, and ear infections. Three-day course antibiotic therapy.", price: 95, manufacturer: "Alembic", dosage: "500mg", packSize: "3 tablets", requiresPrescription: true, stockQuantity: 120, categorySlug: "antibiotics" },
  { name: "Pan-D", slug: "pan-d", description: "Pantoprazole and domperidone capsule for acid reflux, GERD, and indigestion. Provides 24-hour acid control.", price: 120, manufacturer: "Alkem", dosage: "40mg + 30mg", packSize: "10 capsules", requiresPrescription: false, stockQuantity: 150, categorySlug: "digestive-health" },
  { name: "Digene Gel", slug: "digene-gel", description: "Antacid gel for instant relief from acidity, heartburn, and bloating. Fast-acting formula with natural ingredients.", price: 75, manufacturer: "Abbott", dosage: "N/A", packSize: "170ml", requiresPrescription: false, stockQuantity: 170, categorySlug: "digestive-health" },
  { name: "Bifi Yogurt Sachets", slug: "bifi-yogurt-sachets", description: "Probiotic supplement with live good bacteria for gut health. Helps restore natural intestinal flora and improve digestion.", price: 210, manufacturer: "Synlab", dosage: "N/A", packSize: "10 sachets", requiresPrescription: false, stockQuantity: 75, categorySlug: "digestive-health" },
];

export const seedAll = action({
  args: {},
  handler: async (ctx) => {
    const results = { categories: 0, products: 0, errors: [] as string[] };

    // Seed categories and build slug→id map
    const categoryMap = new Map<string, Id<"categories">>();
    for (const cat of CATEGORIES) {
      try {
        const id: Id<"categories"> = await ctx.runMutation(internal.categories.upsertCategory, {
          name: cat.name,
          slug: cat.slug,
          description: cat.description,
          sortOrder: cat.sortOrder,
        });
        categoryMap.set(cat.slug, id);
        results.categories++;
      } catch (e) {
        results.errors.push(`Category "${cat.name}": ${e}`);
      }
    }

    // Seed products
    for (const prod of PRODUCTS) {
      const catId = categoryMap.get(prod.categorySlug);
      if (!catId) {
        results.errors.push(`Product "${prod.name}": category "${prod.categorySlug}" not found`);
        continue;
      }
      try {
        const { categorySlug, ...productData } = prod;
        await ctx.runMutation(internal.categories.upsertProduct, {
          ...productData,
          imageUrl: "/placeholder-medicine.svg",
          categoryId: catId,
        });
        results.products++;
      } catch (e) {
        results.errors.push(`Product "${prod.name}": ${e}`);
      }
    }

    return results;
  },
});
