import { getAuthUserId } from "@convex-dev/auth/server";
import { action, query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ════════════════════════════════════════════════════════════════
// COMPREHENSIVE INDIAN MEDICINES DATABASE
// ════════════════════════════════════════════════════════════════

interface MedicineInfo {
  manufacturer: string;
  composition: string;
  benefits: string;
  description: string;
  form: string;
  expiryDate?: string;   // e.g. "2027-06-30" — actual batch expiry from manufacturer data
  storageInformation?: string;
}

const MEDICINES_DB: Record<string, MedicineInfo> = {
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
};

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


// Storage information database — composition/form-based storage guidance
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
  "telmisartan": "Store below 25°C in a dry place. Protect from moisture.",
  "montelukast": "Store below 25°C in a dry place. Protect from moisture.",
  "salbutamol": "Store below 30°C in a dry place. Keep inhaler away from open flame.",
  "ciprofloxacin": "Store below 25°C in a dark place. Protect from light and moisture.",
  "doxycycline": "Store below 25°C in a dark, dry place. Protect from light.",
  "rosuvastatin": "Store below 25°C in a dry place. Protect from moisture.",
  "cefuroxime": "Store below 25°C in a dry place. Keep away from moisture.",
  "cefixime": "Store below 25°C in a dry place. Protect from moisture.",
  "metronidazole": "Store below 25°C in a dry place. Protect from moisture.",
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

function getStorageInfo(composition: string, form: string): string | null {
  const lowerComp = composition.toLowerCase();
  // Try composition-based match first
  for (const [key, info] of Object.entries(STORAGE_DB)) {
    if (lowerComp.includes(key)) return info;
  }
  // Fallback to form-based storage
  const f = form.toLowerCase();
  for (const [key, info] of Object.entries(STORAGE_DB)) {
    if (f === key) return info;
  }
  // Final fallback — generic for the form
  if (f === "tablet" || f === "capsule") return "Store below 30°C in a dry place. Keep away from moisture and direct sunlight.";
  if (f === "syrup" || f === "suspension") return "Store below 30°C. Keep away from direct sunlight. Do not freeze.";
  if (f === "cream" || f === "gel" || f === "ointment") return "Store below 30°C. Do not freeze. Keep away from direct sunlight.";
  if (f === "drops") return "Store below 25°C. Protect from light. Do not freeze.";
  if (f === "injection") return "Store below 25°C. Protect from light. Do not freeze. Keep out of reach of children.";
  if (f === "inhaler") return "Store below 30°C away from open flame. Do not puncture or incinerate.";
  if (f === "sachet" || f === "powder") return "Store below 30°C in a dry place. Keep away from moisture.";
  if (f === "nasal drops" || f === "nasal") return "Store below 25°C. Protect from light. Do not freeze.";
  return "Store in a cool, dry place away from moisture and direct sunlight.";
}

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

/**
 * Infer consume type from product form
 */
function inferConsumeType(form: string): string | null {
  const f = form.toLowerCase();
  if (["tablet", "capsule", "lozenge"].includes(f))
    return `${f.charAt(0).toUpperCase() + f.slice(1)} — taken orally with water.`;
  if (["syrup", "suspension"].includes(f))
    return `${f.charAt(0).toUpperCase() + f.slice(1)} — taken orally using the provided measuring device.`;
  if (f === "drops") return "Oral drops — taken orally or as directed by the physician.";
  if (f === "inhaler") return "Inhaler — used by inhaling the medication through the mouth.";
  if (["powder", "sachet"].includes(f)) return "Powder/Sachet — dissolved in water and taken orally.";
  if (["cream", "gel", "ointment", "lotion"].includes(f))
    return `${f.charAt(0).toUpperCase() + f.slice(1)} — applied externally to the affected area.`;
  if (f === "injection") return "Injection — administered by a healthcare professional.";
  if (f === "nasal drops" || f === "nasal") return "Nasal drops — administered through the nose as directed.";
  if (f) return `${f.charAt(0).toUpperCase() + f.slice(1)} — use as directed by your physician.`;
  return null;
}

/**
 * Match product name against the medicines database.
 */
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
  },
  handler: async (_ctx, args) => {
    // Try local database first (no API needed)
    const lower = args.productName.toLowerCase().trim();
    const stripped = lower.replace(/\s*\d+\s*(mg|ml|g|mcg|iu|%)?$/i, "").trim();

    let matched: MedicineInfo | null = null;
    if (MEDICINES_DB[lower]) matched = MEDICINES_DB[lower];
    else if (MEDICINES_DB[stripped]) matched = MEDICINES_DB[stripped];
    else {
      let bestLen = 0;
      for (const [key, info] of Object.entries(MEDICINES_DB)) {
        if (lower.includes(key) && key.length > bestLen) {
          matched = info;
          bestLen = key.length;
        }
      }
    }

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
    } = { imageUrl: null, manufacturer: null, benefits: null, description: null, consumeType: null, safetyNote: null, form: null, storageInformation: null, composition: null, expiryDate: null };

    if (matched) {
      result.manufacturer = matched.manufacturer;
      result.benefits = matched.benefits;
      result.description = matched.description;
      // Generate consumeType from form
      result.consumeType = inferConsumeType(matched.form || args.form || "tablet");
      // Safety note
      result.safetyNote = "Consult your doctor or pharmacist before use.";
      // Form — return for auto-select in admin form
      result.form = matched.form || args.form || null;
      // Composition — return matched composition
      result.composition = matched.composition || null;
      // Expiry Date — use if available in DB, never calculate
      result.expiryDate = matched.expiryDate || null;
      // Storage Information — use medicine-specific if available, else compose from composition/form
      result.storageInformation = matched.storageInformation || getStorageInfo(matched.composition || "", matched.form || args.form || "tablet");
    } else {
      // Fallback to known DBs
      for (const [key, mfr] of Object.entries(KNOWN_MANUFACTURERS)) {
        if (lower.includes(key)) { result.manufacturer = mfr; break; }
      }
      if (!result.manufacturer && args.manufacturer) result.manufacturer = args.manufacturer;

      const composition = args.composition || args.productName;
      for (const [key, benefits] of Object.entries(BENEFITS_DB)) {
        if (composition.toLowerCase().includes(key)) { result.benefits = benefits; break; }
      }

      // Generate description
      const parts: string[] = [];
      parts.push(`${args.productName} is a medication${result.manufacturer ? ` manufactured by ${result.manufacturer}` : ""}.`);
      if (args.composition) parts.push(`It contains ${args.composition}.`);
      if (args.form) parts.push(`Available as ${args.form}.`);
      parts.push("Consult your healthcare provider for proper dosage and usage instructions.");
      result.description = parts.join(" ");
      // Generate consumeType from form
      result.consumeType = inferConsumeType(args.form || "tablet");
      // Safety note
      result.safetyNote = "Consult your doctor or pharmacist before use.";
      // Form — return for auto-select in admin form
      result.form = args.form || null;
      // Composition — use args if provided
      result.composition = args.composition || null;
      // Expiry Date — leave null for unknown medicines
      result.expiryDate = null;
      // Storage Information — based on composition and form
      result.storageInformation = getStorageInfo(args.composition || args.productName, args.form || "tablet");
    }

    // Image: try Wikimedia Commons (free, no API key)
    try {
      const searchQuery = encodeURIComponent(`${args.productName} medicine`);
      const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${searchQuery}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const pages = data?.query?.pages;
        if (pages) {
          for (const page of Object.values(pages) as any[]) {
            const title = page?.title || "";
            const lower = title.toLowerCase();
            // Skip SVG/chemical structure images
            const badPatterns = ["skeletal", "structure", "chemistry", ".svg", "logo", "icon", "symbol"];
            if (badPatterns.some(p => lower.includes(p))) continue;
            if (!lower.match(/\.(jpg|jpeg|png|gif|webp)/)) continue;
            const ii = page?.imageinfo;
            if (ii && ii[0]?.thumburl) {
              const imgUrl = ii[0].thumburl;
              if (!imgUrl.toLowerCase().endsWith(".svg") && !imgUrl.includes("skeletal")) {
                result.imageUrl = imgUrl;
                break;
              }
            }
          }
        }
      }
    } catch {
      // Continue without image
    }

    // Placeholder if no image found
    if (!result.imageUrl) {
      const initials = args.productName.split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" rx="16" fill="%23f0f7ff"/><text x="100" y="85" font-family="system-ui,sans-serif" font-size="42" font-weight="700" fill="%233b82f6" text-anchor="middle">${initials}</text><text x="100" y="120" font-family="system-ui,sans-serif" font-size="12" fill="%2364748b" text-anchor="middle">${encodeURIComponent(args.productName.slice(0, 20))}</text></svg>`;
      result.imageUrl = `data:image/svg+xml,${svg}`;
    }

    return result;
  },
});
