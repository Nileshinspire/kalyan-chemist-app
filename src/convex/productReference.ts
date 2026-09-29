/**
 * Verified product reference records, and the rule for deciding when one of
 * them may be used for a given product.
 *
 * This module is the strongest data source available in the project: curated
 * per-product records carrying the real manufacturer, composition, benefits,
 * description and dosage form for well-known pharmacy products.
 *
 * The hard problem is not having the data — it is using it for the EXACT
 * product being viewed. A brand sells many variants ("Dolo 650 Tablet",
 * "Dolo Syrup", "Dolo Plus"), and each is a different medicine. A substring
 * match on the brand name alone is therefore unsafe: it silently hands the
 * 650 mg tablet's composition to a 500 mg variant, or a syrup's directions to
 * a tablet.
 *
 * So matching happens in two stages:
 *
 *   1. NAME MATCH — find the longest catalog key contained in the product name
 *      (or equal to it), so the most specific record wins.
 *   2. VARIANT GUARD — reject the record if it describes a different strength
 *      or a different dosage form than the product itself states. A rejected
 *      record is never partially applied; the next candidate is tried, and if
 *      none survives the product simply has no verified reference.
 *
 * Rejecting is the safe outcome. A product with no reference shows an honest
 * "not available" state; a product matched to the wrong variant shows a
 * confident medical error.
 *
 * Pure and dependency-free so it can be unit tested and imported by both the
 * Convex backend and the React page.
 */

import { classifyProduct, type ProductIdentity } from "./productInfo";

export interface MedicineInfo {
  manufacturer: string;
  composition: string;
  benefits: string;
  description: string;
  form: string;
  expiryDate?: string;   // e.g. "2027-06-30" — actual batch expiry from manufacturer data
  storageInformation?: string;
}

/**
 * A catalog record that has passed the variant guard, i.e. one that describes
 * the exact product being viewed. `key` is kept for the admin review panel so a
 * human can see which record was applied.
 */
export interface VerifiedReference extends MedicineInfo {
  key: string;
}

export const MEDICINES_DB: Record<string, MedicineInfo> = {
  "dolo": { manufacturer: "Micro Labs Ltd", composition: "Paracetamol 650mg", benefits: "Provides effective relief from mild to moderate pain and reduces fever. Safe and well-tolerated when used as directed.", description: "Dolo 650 is a trusted antipyretic and analgesic containing Paracetamol 650mg. One of the most widely prescribed medicines in India for fever and pain relief. Manufactured by Micro Labs Ltd.", form: "tablet" },
  "crocin": { manufacturer: "GlaxoSmithKline Pharmaceuticals Ltd", composition: "Paracetamol 500mg / 650mg", benefits: "Effective pain reliever and fever reducer. Fast-acting formula suitable for headaches, body aches, and cold-related fever.", description: "Crocin is a trusted paracetamol brand from GSK. It provides fast and effective relief from pain and fever with a proven safety profile.", form: "tablet" },
  "combiflam": { manufacturer: "Sanofi India Ltd", composition: "Ibuprofen 400mg + Paracetamol 325mg", benefits: "Dual-action formula combining anti-inflammatory and pain-relieving properties. Effective for headaches, dental pain, menstrual cramps.", description: "Combiflam combines Ibuprofen and Paracetamol for dual action pain relief. The anti-inflammatory component addresses the source of pain while paracetamol reduces fever.", form: "tablet" },
  "azee": { manufacturer: "Cipla Ltd", composition: "Azithromycin 250mg / 500mg", benefits: "Effective macrolide antibiotic for respiratory infections, skin infections. Short course therapy with once-daily dosing.", description: "Azee contains Azithromycin, a macrolide antibiotic from Cipla Ltd. Effective against a wide range of bacterial infections with short-course therapy.", form: "tablet" },
  "pan": { manufacturer: "Alkem Laboratories Ltd", composition: "Pantoprazole 40mg", benefits: "Proton pump inhibitor for long-lasting relief from GERD, stomach ulcers, and acid-related disorders.", description: "Pan contains Pantoprazole 40mg, a proton pump inhibitor from Alkem. Reduces stomach acid production for sustained relief from acid reflux.", form: "tablet" },
  "omez": { manufacturer: "Dr. Reddy's Laboratories Ltd", composition: "Omeprazole 20mg", benefits: "Proton pump inhibitor that reduces stomach acid production. Relief from acid reflux, heartburn, and stomach ulcers.", description: "Omez contains Omeprazole 20mg from Dr. Reddy's. Effectively reduces gastric acid secretion for GERD, peptic ulcers, and H. pylori eradication.", form: "capsule" },
  "shelcal": { manufacturer: "Torrent Pharmaceuticals Ltd", composition: "Calcium Carbonate 500mg + Vitamin D3 250 IU", benefits: "Essential mineral for strong bones and teeth. Helps prevent osteoporosis and supports muscle and nerve function.", description: "Shelcal from Torrent Pharma provides essential calcium with Vitamin D3 for enhanced absorption. Recommended for bone health and osteoporosis prevention.", form: "tablet" },
  "becosules": { manufacturer: "Pfizer Ltd", composition: "Vitamin B Complex + Vitamin C", benefits: "Complete Vitamin B complex supplement that supports energy metabolism, nerve function, and helps manage B-complex deficiency.", description: "Becosules from Pfizer contains all essential B vitamins plus Vitamin C. Supports energy metabolism and nervous system health.", form: "capsule" },
  "glycomet": { manufacturer: "USV Pvt Ltd", composition: "Metformin 500mg / 850mg", benefits: "First-line treatment for type 2 diabetes. Helps control blood sugar levels by improving insulin sensitivity.", description: "Glycomet contains Metformin from USV. Reduces hepatic glucose production and improves insulin sensitivity for type 2 diabetes management.", form: "tablet" },
  "atorva": { manufacturer: "Sun Pharmaceutical Industries Ltd", composition: "Atorvastatin 10mg / 20mg / 40mg", benefits: "Statins help lower cholesterol levels and reduce the risk of heart attacks and strokes.", description: "Atorva from Sun Pharma contains Atorvastatin. Lowers LDL cholesterol and reduces cardiovascular risk significantly.", form: "tablet" },
  "stamlo": { manufacturer: "Dr. Reddy's Laboratories Ltd", composition: "Amlodipine 5mg / 10mg", benefits: "Calcium channel blocker that relaxes blood vessels to lower blood pressure and reduce chest pain.", description: "Stamlo from Dr. Reddy's contains Amlodipine. Provides 24-hour blood pressure control with once-daily dosing.", form: "tablet" },
  "cetirizine": { manufacturer: "Cipla Ltd", composition: "Cetirizine 10mg", benefits: "Non-drowsy antihistamine that provides 24-hour relief from allergic rhinitis, urticaria, and other allergy symptoms.", description: "Cetirizine from Cipla is a second-generation antihistamine providing effective 24-hour relief from allergic conditions.", form: "tablet" },
  "montair": { manufacturer: "Cipla Ltd", composition: "Montelukast 10mg", benefits: "Leukotriene receptor blocker that prevents asthma attacks and relieves seasonal allergy symptoms.", description: "Montair from Cipla contains Montelukast. Blocks leukotriene receptors to prevent airway inflammation.", form: "tablet" },
  "sinarest": { manufacturer: "Micro Labs Ltd", composition: "Paracetamol + Phenylephrine + Chlorpheniramine", benefits: "Multi-symptom cold and flu relief. Addresses headache, fever, nasal congestion, and runny nose.", description: "Sinarest from Micro Labs provides comprehensive relief from cold and flu symptoms with a triple-action formula.", form: "tablet" },
  "asthalin": { manufacturer: "Cipla Ltd", composition: "Salbutamol 2mg / 4mg", benefits: "Fast-acting bronchodilator that relieves acute asthma attacks and breathing difficulties.", description: "Asthalin from Cipla contains Salbutamol, a fast-acting bronchodilator for quick relief from asthma symptoms.", form: "tablet" },
  "rabecee": { manufacturer: "Dr. Reddy's Laboratories Ltd", composition: "Rabeprazole 20mg", benefits: "Fast-acting proton pump inhibitor for acid reflux, peptic ulcers, and H. pylori eradication therapy.", description: "Rabecee from Dr. Reddy's contains Rabeprazole. Potent PPI for GERD, peptic ulcers, and H. pylori eradication.", form: "tablet" },
  "telma": { manufacturer: "Glenmark Pharmaceuticals Ltd", composition: "Telmisartan 40mg / 80mg", benefits: "Long-acting ARB for blood pressure control with additional cardiovascular protective benefits.", description: "Telma from Glenmark contains Telmisartan. Long-acting ARB providing 24-hour BP control with cardioprotective properties.", form: "tablet" },
  "losar": { manufacturer: "Torrent Pharmaceuticals Ltd", composition: "Losartan 50mg / 100mg", benefits: "ARB that lowers blood pressure and protects the kidneys in diabetic patients.", description: "Losar from Torrent Pharma contains Losartan. Effectively lowers BP with kidney-protective benefits.", form: "tablet" },
  "supradyn": { manufacturer: "Bayer Zydus Pharma", composition: "Multivitamin + Multimineral", benefits: "Complete daily nutrition support with essential vitamins and minerals for overall health and wellness.", description: "Supradyn is a comprehensive multivitamin providing all essential nutrients for daily health and immunity.", form: "tablet" },
  "neurobion": { manufacturer: "Merck Ltd", composition: "Vitamin B1 + B6 + B12", benefits: "Essential for nerve function, red blood cell formation, and DNA synthesis. Supports energy levels and brain health.", description: "Neurobion from Merck contains B vitamins for nerve health and energy metabolism.", form: "tablet" },
  "revital": { manufacturer: "Sun Pharmaceutical Industries Ltd", composition: "Multivitamin + Ginseng + Minerals", benefits: "Daily multivitamin with Ginseng for energy, immunity, and overall well-being.", description: "Revital from Sun Pharma combines vitamins, minerals, and Ginseng for energy and vitality.", form: "capsule" },
  "duphaston": { manufacturer: "Abbott India Ltd", composition: "Dydrogesterone 10mg", benefits: "Progesterone hormone supplement for menstrual disorders, threatened miscarriage, and hormone replacement therapy.", description: "Duphaston from Abbott contains Dydrogesterone. Bio-identical progesterone for gynecological conditions.", form: "tablet" },
  "meftal": { manufacturer: "Blue Cross Laboratories Ltd", composition: "Mefenamic Acid 500mg", benefits: "NSAID effective for menstrual pain, mild to moderate pain, and inflammatory conditions.", description: "Meftal from Blue Cross contains Mefenamic Acid. Particularly effective for menstrual pain relief.", form: "tablet" },
  "enterogermina": { manufacturer: "Sanofi India Ltd", composition: "Bacillus clausii 2 Billion Spores", benefits: "Probiotic that restores healthy gut bacteria. Effective for diarrhea and antibiotic-associated gut issues.", description: "Enterogermina from Sanofi contains probiotic spores that restore healthy intestinal flora.", form: "sachet" },
  "benadryl": { manufacturer: "Johnson & Johnson Ltd", composition: "Diphenhydramine 12.5mg", benefits: "Antihistamine for allergic symptoms including runny nose, sneezing, itchy eyes, and dry cough.", description: "Benadryl from J&J is a trusted antihistamine for allergy symptoms and dry cough.", form: "syrup" },
  "vicks": { manufacturer: "Procter & Gamble Health Ltd", composition: "Dextromethorphan + Menthol + Camphor", benefits: "Effective cough suppressant and throat relief for dry and productive coughs.", description: "Vicks from P&G Health provides cough and cold relief with Dextromethorphan and soothing Menthol.", form: "syrup" },
  "nasivion": { manufacturer: "Meda Pharmaceuticals India", composition: "Oxymetazoline 0.025% / 0.05%", benefits: "Nasal decongestant spray for rapid relief from nasal congestion due to cold and allergies.", description: "Nasivion from Meda provides quick nasal decongestion via oxymetazoline nasal spray.", form: "nasal drops" },
  "zifi": { manufacturer: "FDC Ltd", composition: "Cefixime 200mg", benefits: "Third-generation cephalosporin antibiotic for respiratory, urinary, and ENT infections.", description: "Zifi from FDC contains Cefixime. Effective oral treatment for respiratory and UTIs.", form: "tablet" },
  "taxim": { manufacturer: "Alkem Laboratories Ltd", composition: "Cefixime 200mg", benefits: "Oral cephalosporin antibiotic for respiratory infections, UTI, and typhoid fever.", description: "Taxim from Alkem contains Cefixime with excellent bioavailability for bacterial infections.", form: "tablet" },
  // ── Topical / Creams / Gels / Ointments ──
  "iodex": { manufacturer: "GlaxoSmithKline Pharmaceuticals Ltd", composition: "Methyl Salicylate + Eucalyptus Oil + Turpentine Oil", benefits: "Fast-acting topical pain reliever that provides warming relief from muscular aches, back pain, joint pain, and stiffness. Penetrates deep into muscles for effective local pain relief.", description: "Iodex Extra Power from GSK is a trusted topical analgesic balm containing Methyl Salicylate, Eucalyptus Oil, and Turpentine Oil. It provides fast warming pain relief for muscular and joint discomfort.", form: "cream" },
  "volini": { manufacturer: "Sun Pharmaceutical Industries Ltd", composition: "Diclofenac Diethylamine + Methyl Salicylate + Menthol + Linseed Oil", benefits: "Topical anti-inflammatory gel that provides targeted relief from muscle pain, joint pain, sprains, and sports injuries. Reduces pain and inflammation at the site of application.", description: "Volini from Sun Pharma is a topical analgesic gel combining Diclofenac, Methyl Salicylate, and Menthol for fast, targeted pain relief from muscular and joint conditions.", form: "gel" },
  "moov": { manufacturer: "Reckitt Benckiser (India) Ltd", composition: "Menthol + Methyl Salicylate + Eucalyptus Oil", benefits: "Fast-acting topical pain relief cream that provides warming sensation and effective relief from backache, muscle pain, and joint stiffness.", description: "Moov from Reckitt Benckiser is a trusted topical pain reliever cream providing fast relief from backache, muscle pain, and joint stiffness through a warming action.", form: "cream" },
  "tiger balm": { manufacturer: "Haw Par Corporation", composition: "Menthol + Camphor + Clove Oil + Eucalyptus Oil + Cinnamon Oil", benefits: "Traditional herbal pain reliever providing warming relief from headaches, muscle aches, and nasal congestion. Natural ingredients offer gentle yet effective relief.", description: "Tiger Balm is a world-famous topical analgesic combining natural ingredients like Menthol, Camphor, and essential oils for fast relief from pain and congestion.", form: "ointment" },
  "zandu balm": { manufacturer: "Emami Ltd", composition: "Menthol + Eucalyptus Oil + Turpentine Oil + Cedar Oil + Gaultheria Oil", benefits: "Fast-acting Ayurvedic pain relief balm providing warming comfort for headaches, body ache, cold, and nasal congestion. Trusted herbal formula with natural ingredients for effective pain relief.", description: "Zandu Balm from Emami is a trusted Ayurvedic pain relief balm combining natural ingredients like Menthol, Eucalyptus Oil, and Turpentine Oil for fast relief from headaches, body ache, and cold symptoms.", form: "ointment" },
  "zandu": { manufacturer: "Emami Ltd", composition: "Menthol + Eucalyptus Oil + Turpentine Oil + Cedar Oil + Gaultheria Oil", benefits: "Fast-acting Ayurvedic pain relief balm providing warming comfort for headaches, body ache, cold, and nasal congestion. Trusted herbal formula with natural ingredients for effective pain relief.", description: "Zandu Balm from Emami is a trusted Ayurvedic pain relief balm combining natural ingredients like Menthol, Eucalyptus Oil, and Turpentine Oil for fast relief from headaches, body ache, and cold symptoms.", form: "ointment" },
  "zeet": { manufacturer: "Cipla Ltd", composition: "Diclofenac Diethylamine + Linseed Oil + Methyl Salicylate + Menthol", benefits: "Topical anti-inflammatory gel for effective relief from muscular and joint pain. Provides targeted treatment with minimal systemic side effects.", description: "Zeet from Cipla is a topical pain relief gel combining Diclofenac with natural oils for fast and effective muscular pain relief.", form: "gel" },
  "intex": { manufacturer: "Intas Pharmaceuticals Ltd", composition: "Diclofenac Diethylamine + Menthol + Methyl Salicylate", benefits: "Topical gel providing targeted anti-inflammatory and analgesic relief from muscle sprains, strains, and joint pain.", description: "Intex gel from Intas Pharmaceuticals provides topical pain relief with Diclofenac and cooling Menthol for muscle and joint conditions.", form: "gel" },
  // ── Sprays ──
  "volini spray": { manufacturer: "Sun Pharmaceutical Industries Ltd", composition: "Diclofenac Diethylamine + Menthol + Methyl Salicylate", benefits: "Convenient spray format for hands-free topical pain relief. Provides targeted anti-inflammatory action for muscle and joint pain without messy application.", description: "Volini Spray from Sun Pharma delivers Diclofenac-based pain relief in a convenient spray format for targeted muscle and joint pain treatment.", form: "spray" },
  "deepspray": { manufacturer: "Cipla Ltd", composition: "Diclofenac Diethylamine + Menthol + Methyl Salicylate", benefits: "Fast-acting pain relief spray for muscles and joints. Easy-to-use spray format provides targeted cooling and anti-inflammatory relief.", description: "Deep Spray from Cipla provides convenient topical pain relief in spray form with Diclofenac for muscle and joint conditions.", form: "spray" },
  "moov spray": { manufacturer: "Reckitt Benckiser (India) Ltd", composition: "Methyl Salicylate + Menthol + Eucalyptus Oil", benefits: "Quick-relief pain spray that provides fast warming action for backache, muscle pain, and sprains. Convenient no-touch application.", description: "Moov Spray from Reckitt Benckiser provides fast-acting pain relief in a convenient spray format for muscular and joint pain.", form: "spray" },
  // ── Drops ──
  "toba eye drops": { manufacturer: "Alcon Laboratories (India) Pvt Ltd", composition: "Tobramycin 0.3%", benefits: "Antibiotic eye drops effective against bacterial eye infections including conjunctivitis and blepharitis. Provides targeted ocular infection treatment.", description: "Toba Eye Drops from Alcon contains Tobramycin, an aminoglycoside antibiotic for treating bacterial eye infections.", form: "drops" },
  "ozidex": { manufacturer: "Micro Labs Ltd", composition: "Ofloxacin 0.3%", benefits: "Fluoroquinolone antibiotic eye drops for bacterial conjunctivitis and other ocular infections. Effective broad-spectrum coverage.", description: "Ozidex from Micro Labs contains Ofloxacin for treating bacterial eye infections with broad-spectrum antibiotic action.", form: "drops" },
  "cipladine": { manufacturer: "Cipla Ltd", composition: "Povidone Iodine 5% / 10%", benefits: "Antiseptic solution for wound cleaning and skin preparation. Effective against bacteria, fungi, and viruses. Essential first-aid antiseptic.", description: "Cipladine from Cipla contains Povidone Iodine, a broad-spectrum antiseptic for wound care and skin disinfection.", form: "drops" },
  // ── Syrups (additional) ──
  "digene": { manufacturer: "Abbott India Ltd", composition: "Magaldrate + Simethicone", benefits: "Dual-action antacid that neutralizes stomach acid and relieves gas bloating. Provides fast relief from acidity, heartburn, and indigestion.", description: "Digene from Abbott is a trusted antacid combining Magaldrate and Simethicone for complete relief from acidity and gas.", form: "syrup" },
  "ENO": { manufacturer: "GlaxoSmithKline Pharmaceuticals Ltd", composition: "Sodium Bicarbonate + Citric Acid + Sodium Carbonate", benefits: "Fast-acting effervescent antacid that neutralizes excess stomach acid in seconds. Provides quick relief from acidity, heartburn, and acid reflux.", description: "ENO from GSK is a popular fast-acting antacid powder that provides instant relief from acidity and heartburn.", form: "powder" },
  // ── Powders ──
  "gelusil": { manufacturer: "Pfizer Ltd", composition: "Aluminum Hydroxide + Magnesium Hydroxide + Simethicone", benefits: "Complete antacid providing acid neutralization plus gas relief. Effective for heartburn, acid reflux, and stomach discomfort.", description: "Gelusil from Pfizer is a complete antacid combining acid-neutralizing agents with Simethicone for gas and bloating relief.", form: "powder" },
  // ── Additional common medicines ──
  "Augmentin": { manufacturer: "GlaxoSmithKline Pharmaceuticals Ltd", composition: "Amoxicillin 1000mg + Clavulanic Acid 125mg", benefits: "Broad-spectrum antibiotic combining Amoxicillin with Clavulanic Acid to overcome bacterial resistance. Effective for respiratory, urinary, and skin infections.", description: "Augmentin from GSK combines Amoxicillin with Clavulanic Acid for enhanced broad-spectrum antibiotic activity against resistant bacteria.", form: "tablet" },
  "Panadol": { manufacturer: "GlaxoSmithKline Pharmaceuticals Ltd", composition: "Paracetamol 500mg", benefits: "Trusted paracetamol brand providing effective relief from mild to moderate pain and fever. Gentle on the stomach with a proven safety profile.", description: "Panadol from GSK is a widely trusted paracetamol brand providing safe and effective pain and fever relief.", form: "tablet" },
  "Calpol": { manufacturer: "GlaxoSmithKline Pharmaceuticals Ltd", composition: "Paracetamol 120mg / 250mg / 500mg", benefits: "Gentle and effective fever and pain reliever suitable for children and adults. Available in delicious strawberry flavor for easy administration.", description: "Calpol from GSK is a trusted pediatric paracetamol brand providing safe fever and pain relief for children.", form: "syrup" },
  "Naprosyn": { manufacturer: "Alembic Pharmaceuticals Ltd", composition: "Naproxen 250mg / 500mg", benefits: "Long-lasting NSAID providing up to 12 hours of pain and inflammation relief. Effective for arthritis, gout, menstrual cramps, and musculoskeletal pain.", description: "Naprosyn from Alembic contains Naproxen for sustained pain and inflammation relief with once or twice daily dosing.", form: "tablet" },
  "Amlogard": { manufacturer: "Pfizer Ltd", composition: "Amlodipine 5mg / 10mg", benefits: "Calcium channel blocker providing smooth, gradual blood pressure reduction with 24-hour control. Also effective for angina relief.", description: "Amlogard from Pfizer contains Amlodipine for effective once-daily blood pressure control and angina management.", form: "tablet" },
  "Gudcef": { manufacturer: "Cipla Ltd", composition: "Cefpodoxime Proxetil 200mg", benefits: "Third-generation oral cephalosporin antibiotic effective for respiratory tract infections, urinary tract infections, and ENT infections. Convenient once-daily dosing.", description: "Gudcef from Cipla contains Cefpodoxime for effective treatment of bacterial infections with convenient dosing.", form: "tablet" },
  "Mox": { manufacturer: "Cipla Ltd", composition: "Amoxicillin 500mg / 250mg", benefits: "Broad-spectrum penicillin antibiotic for common bacterial infections of the respiratory tract, urinary tract, ear, and throat. Well-tolerated and effective.", description: "Mox from Cipla contains Amoxicillin for effective treatment of common bacterial infections.", form: "capsule" },
  "Tuspel": { manufacturer: "Cipla Ltd", composition: "Ambroxol 30mg + Terbutaline 1.25mg + Guaifenesin 50mg", benefits: "Triple-action cough syrup that thins mucus, opens airways, and provides effective relief from productive and dry cough.", description: "Tuspel from Cipla is a combination cough syrup with Ambroxol, Terbutaline, and Guaifenesin for comprehensive cough relief.", form: "syrup" },
  "Ascoril": { manufacturer: "GlaxoSmithKline Pharmaceuticals Ltd", composition: "Salbutamol + Bromhexine + Guaifenesin + Menthol", benefits: "Bronchodilator cough syrup that opens airways and thins mucus for effective relief from cough associated with asthma, bronchitis, and COPD.", description: "Ascoril from GSK combines Salbutamol with mucolytics for effective cough relief in respiratory conditions.", form: "syrup" },
};

// ── Storage guidance, keyed by the ingredient or dosage form it belongs to ──

const STORAGE_DB: Record<string, string> = {
  "paracetamol": "Store below 25°C in a dry place. Keep away from moisture and direct sunlight.",
  "ibuprofen": "Store in a cool, dry place below 30°C. Protect from moisture.",
  "metformin": "Store below 30°C in a dry place. Keep away from moisture.",
  "amlodipine": "Store below 25°C in a dry place. Protect from light and moisture.",
  "atorvastatin": "Store at room temperature (15–25°C) in a dry place. Keep away from direct sunlight.",
  "pantoprazole": "Store below 25°C in a dry place. Protect from moisture and light.",
  "omeprazole": "Store below 25°C in a dry place. Protect from moisture and light.",
  "cetirizine": "Store below 25°C in a dry place. Keep away from moisture.",
  "azithromycin": "Store below 25°C in a dry place. Protect from moisture.",
  "calcium": "Store below 30°C in a dry place. Keep away from moisture and direct sunlight.",
  "vitamin d": "Store below 30°C in a dry place. Protect from light and moisture.",
  "levothyroxine": "Store at room temperature (15–25°C) in a dry place. Protect from light.",
  "losartan": "Store below 30°C in a dry place. Keep away from moisture.",
  "telmisartan": "Store below 25°C in a dry place. Keep away from moisture.",
  "montelukast": "Store below 25°C in a dry place. Keep away from moisture.",
  "salbutamol": "Store below 30°C in a dry place. Keep inhaler away from open flame.",
  "ciprofloxacin": "Store below 25°C in a dark place. Protect from light and moisture.",
  "doxycycline": "Store below 25°C in a dark, dry place. Protect from light.",
  "rosuvastatin": "Store below 25°C in a dry place. Protect from moisture.",
  "cefuroxime": "Store below 25°C in a dry place. Keep away from moisture.",
  "cefixime": "Store below 25°C in a dry place. Keep away from moisture.",
  "metronidazole": "Store below 25°C in a dry place. Keep away from moisture.",
  "cream": "Store below 30°C. Do not freeze. Keep away from direct sunlight.",
  "gel": "Store below 30°C. Do not freeze. Keep away from direct sunlight.",
  "ointment": "Store below 30°C. Do not freeze.",
  "syrup": "Store below 30°C. Keep away from direct sunlight. Do not freeze. Once opened, use within 30 days.",
  "suspension": "Store below 30°C. Keep away from direct sunlight. Do not freeze. Shake well before use.",
  "drops": "Store below 25°C. Protect from light. Do not freeze.",
  "injection": "Store below 25°C. Protect from light. Do not freeze. Keep out of reach of children.",
  "inhaler": "Store below 30°C away from open flame. Do not puncture or incinerate.",
  "sachet": "Store below 30°C in a dry place. Keep away from moisture.",
};

/**
 * Storage guidance for a composition and dosage form.
 *
 * Ingredient-specific guidance is preferred; a dosage form's own storage
 * requirement is the next best. Returns null when neither is known, so the UI
 * can say "not available" rather than assert a temperature the label never
 * stated.
 */
export function getStorageInfo(composition: string, form: string): string | null {
  const lowerComp = (composition || "").toLowerCase();
  for (const [key, info] of Object.entries(STORAGE_DB)) {
    if (lowerComp.includes(key)) return info;
  }
  const f = (form || "").toLowerCase();
  for (const [key, info] of Object.entries(STORAGE_DB)) {
    if (f === key) return info;
  }
  return null;
}

// ── Strength extraction, used by the variant guard ──

/**
 * Units that describe a drug amount, used by the variant guard. Pack weights
 * (g, ml) are deliberately excluded: "Volini Gel 30g" states a tube size, not
 * a dose, and treating it as a strength would reject a correct match.
 */

function normaliseUnit(unit: string): string {
  const u = unit.toLowerCase().replace(/\s+/g, "");
  if (u === "µg" || u === "ug") return "mcg";
  if (u === "gm" || u === "gram" || u === "grams") return "gm";
  if (u === "unit" || u === "units") return "iu";
  return u;
}

/**
 * Every dose stated in a piece of product text, as `number:unit` pairs.
 *
 * `bareNumbers` additionally reads a unit-less number as milligrams, which is
 * how brands state a strength in the product name ("Dolo 650"). That is only
 * safe for solid oral products, where a bare number in the name is a dose and
 * not a tube size, so callers decide when to enable it.
 */
function extractStrengths(text: string | null | undefined, bareNumbers = false): string[] {
  if (!text) return [];
  const source = text.toLowerCase();
  const found = new Set<string>();
  const withUnit = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(mcg|ug|µg|mg|gm|iu|units?|%)\\b`, "g");
  for (const m of source.matchAll(withUnit)) {
    found.add(`${m[1].replace(",", ".")}:${normaliseUnit(m[2])}`);
  }
  if (bareNumbers) {
    // A number that is not already part of a matched "650mg" token.
    const stripped = source.replace(withUnit, " ");
    for (const m of stripped.matchAll(/(?:^|[^0-9a-z.])(\d+)(?![0-9a-z%])/g)) {
      found.add(`${m[1]}:mg`);
    }
  }
  return [...found];
}

/** All dose values a product states for itself, across name/strength/composition. */
export function productStrengths(identity: ProductIdentity): string[] {
  const solidOral = classifyProduct(identity).kind === "oral_tablet" ||
    classifyProduct(identity).kind === "oral_capsule";
  const found = new Set<string>();
  for (const s of extractStrengths(identity.composition)) found.add(s);
  for (const s of extractStrengths(identity.strength, true)) found.add(s);
  for (const s of extractStrengths(identity.name, solidOral)) found.add(s);
  return [...found];
}

/** All dose values a catalog record states in its composition. */
export function recordStrengths(record: MedicineInfo): string[] {
  return extractStrengths(record.composition);
}

/**
 * True when a record describes a different strength to the product.
 *
 * A record may list several strengths ("Paracetamol 500mg / 650mg") because the
 * brand is sold in each of them; a product stating one of those is the same
 * product. A product stating a strength the record never mentions is a
 * different variant, and must not borrow the record's composition.
 */
export function strengthConflicts(identity: ProductIdentity, record: MedicineInfo): boolean {
  const mine = productStrengths(identity);
  if (mine.length === 0) return false;
  const theirs = new Set(recordStrengths(record));
  if (theirs.size === 0) return false; // record states no dose, nothing to clash
  return mine.some((s) => !theirs.has(s));
}

/** The broad route a dosage form belongs to; two different routes are different products. */
function routeGroup(text: string | null | undefined): string {
  if (!text) return "";
  const t = text.toLowerCase();
  if (/(tablet|caplet|pill|lozenge|capsule)/.test(t)) return "oral-solid";
  if (/(syrup|suspension|oral solution|elixir)/.test(t)) return "oral-liquid";
  if (/(sachet|powder|effervescent)/.test(t)) return "oral-powder";
  if (/(eye|ophthalmic)/.test(t)) return "eye";
  if (/(ear|otic)/.test(t)) return "ear";
  if (/(nasal)/.test(t)) return "nasal";
  if (/(inhaler|respule|nebule|aerosol|inhalation|dry powder)/.test(t)) return "inhaler";
  if (/(injection|inj\.|injectable|vial|ampoule)/.test(t)) return "injection";
  if (/(cream|ointment|gel|lotion|balm|topical|liniment)/.test(t)) return "topical";
  if (/(condom|device|meter|monitor|kit|strip)/.test(t)) return "device";
  // A bare "spray" says nothing about the route: a pain-relief spray, a nasal
  // spray and a steroid inhaler spray all share the word. An undecidable form
  // is not evidence of a conflict, so it never blocks a match.
  return "";
}

/**
 * True when the product's own name/category/composition clearly identify a
 * different dosage form from the record's.
 *
 * This is what stops a "Volini Gel" from inheriting a tablet record, or a
 * condom from inheriting an oral tablet record, when both happen to share a
 * brand key. It only fires on a confident classification, so a product with a
 * vague name is never blocked by it.
 */
export function routeConflicts(identity: ProductIdentity, record: MedicineInfo): boolean {
  const classification = classifyProduct({
    name: identity.name,
    form: null, // the stored form is exactly the field that is often wrong
    packSize: identity.packSize ?? null,
    categoryName: identity.categoryName ?? null,
    composition: identity.composition ?? null,
    manufacturer: identity.manufacturer ?? null,
    strength: identity.strength ?? null,
  });
  if (!classification.confident) return false;
  const mine = routeGroup(classification.kind);
  const theirs = routeGroup(record.form);
  if (!mine || !theirs) return false;
  return mine !== theirs;
}

/**
 * Catalog keys contained in the product name, most specific first.
 * "Dolo 650" yields the "dolo" key; a longer key such as "volini spray" wins
 * over "volini" whenever the longer one is also present.
 */
function candidateKeys(productName: string): string[] {
  const lower = productName.toLowerCase().trim();
  if (!lower) return [];
  const exact = Object.keys(MEDICINES_DB).find((k) => k.toLowerCase() === lower);
  const contained = Object.keys(MEDICINES_DB)
    .filter((k) => k.length > 1 && lower.includes(k.toLowerCase()))
    .sort((a, b) => b.length - a.length);
  return exact ? [exact, ...contained.filter((k) => k !== exact)] : contained;
}

/**
 * True when the product name contains more than one distinct catalogued brand.
 *
 * "Dolo Neurobion Forte" contains both "dolo" and "neurobion", but it is a
 * different product from either. No single record describes it, so applying one
 * would state another product's benefits. A key that is merely a longer form
 * of another ("zandu" and "zandu balm") counts as one brand, not two.
 */
function namesMoreThanOneProduct(productName: string): boolean {
  const keys = candidateKeys(productName);
  for (const key of keys) {
    // Keys that extend one another ("volini" / "volini spray") are the same
    // product family, so only a key unrelated to this one makes the name
    // ambiguous.
    const others = keys.filter(
      (k) =>
        k.toLowerCase() !== key.toLowerCase() &&
        !key.toLowerCase().startsWith(k.toLowerCase()) &&
        !k.toLowerCase().startsWith(key.toLowerCase())
    );
    if (others.length > 0) return true;
  }
  return false;
}

export interface ReferenceLookup {
  /** The record proven to describe this exact product, or null. */
  reference: VerifiedReference | null;
  /** Candidate keys that were considered, longest first. */
  candidates: string[];
  /** Why the best candidate was rejected, when it was. */
  rejected: string | null;
}

/**
 * Find the catalog record that describes this exact product, or null.
 *
 * Returns a `rejected` reason when a candidate matched by name but was refused
 * by the variant guard, so the admin panel can explain why a familiar-looking
 * product shows no reference data.
 */
export function findVerifiedReference(identity: ProductIdentity): ReferenceLookup {
  const candidates = candidateKeys(identity.name);
  let rejected: string | null = null;

  // A name that names two catalogued brands is a combination product; no single
  // record describes it, so nothing may be borrowed.
  if (namesMoreThanOneProduct(identity.name)) {
    return {
      reference: null,
      candidates,
      rejected: `"${identity.name}" names more than one catalogued product, so no single record describes it`,
    };
  }

  for (const key of candidates) {
    const record = MEDICINES_DB[key];
    if (!record) continue;
    if (strengthConflicts(identity, record)) {
      rejected = `"${key}" states ${record.composition}, which is a different strength to this product`;
      continue;
    }
    if (routeConflicts(identity, record)) {
      rejected = `"${key}" is a ${record.form} product, but this product is not`;
      continue;
    }
    return { reference: { ...record, key }, candidates, rejected: null };
  }
  return { reference: null, candidates, rejected };
}
