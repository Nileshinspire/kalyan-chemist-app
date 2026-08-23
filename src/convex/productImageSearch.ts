import { action } from "./_generated/server";
import { v } from "convex/values";

// ════════════════════════════════════════════════════════════════
// COMPREHENSIVE INDIAN MEDICINES DATABASE
// Maps product name keywords → { manufacturer, benefits, description, composition }
// This is the primary data source — no paid API required.
// ════════════════════════════════════════════════════════════════

interface MedicineInfo {
  manufacturer: string;
  brand: string;
  composition: string;
  benefits: string;
  description: string;
  form: string;
}

const MEDICINES_DB: Record<string, MedicineInfo> = {
  // ── Pain & Fever ──
  "dolo": {
    manufacturer: "Micro Labs Ltd",
    brand: "Dolo",
    composition: "Paracetamol 650mg",
    benefits: "Provides effective relief from mild to moderate pain and reduces fever. Safe and well-tolerated when used as directed.",
    description: "Dolo 650 is a trusted antipyretic and analgesic containing Paracetamol 650mg. It is one of the most widely prescribed medicines in India for fever and pain relief. Manufactured by Micro Labs Ltd, it provides rapid onset of action and is suitable for adults and children above 12 years.",
    form: "tablet",
  },
  "crocin": {
    manufacturer: "GlaxoSmithKline Pharmaceuticals Ltd",
    brand: "Crocin",
    composition: "Paracetamol 500mg / 650mg",
    benefits: "Effective pain reliever and fever reducer. Fast-acting formula suitable for headaches, body aches, and cold-related fever.",
    description: "Crocin is a trusted paracetamol brand from GSK, available in 500mg and 650mg strengths. It provides fast and effective relief from pain and fever. Widely recommended by doctors across India for its proven efficacy and safety profile.",
    form: "tablet",
  },
  "combiflam": {
    manufacturer: "Sanofi India Ltd",
    brand: "Combiflam",
    composition: "Ibuprofen 400mg + Paracetamol 325mg",
    benefits: "Dual-action formula combining anti-inflammatory and pain-relieving properties. Effective for headaches, dental pain, menstrual cramps, and musculoskeletal pain.",
    description: "Combiflam is a combination of Ibuprofen and Paracetamol that provides dual action pain relief. The anti-inflammatory component addresses the source of pain while paracetamol reduces fever. Manufactured by Sanofi India, it is one of India's most popular OTC pain relievers.",
    form: "tablet",
  },
  "paracetamol": {
    manufacturer: "Various",
    brand: "Generic",
    composition: "Paracetamol 500mg",
    benefits: "Relieves mild to moderate pain and reduces fever. One of the safest analgesics with minimal side effects when used as directed.",
    description: "Paracetamol (Acetaminophen) is a widely used over-the-counter analgesic and antipyretic. It works by inhibiting prostaglandin synthesis in the central nervous system, providing effective relief from pain and fever.",
    form: "tablet",
  },
  "ibugesic": {
    manufacturer: "Cipla Ltd",
    brand: "Ibugesic",
    composition: "Ibuprofen 400mg",
    benefits: "Non-steroidal anti-inflammatory drug (NSAID) that reduces pain, inflammation, and fever. Effective for headaches, muscle aches, and joint pain.",
    description: "Ibugesic contains Ibuprofen 400mg, a proven NSAID for pain and inflammation relief. Manufactured by Cipla Ltd, it provides long-lasting relief from various types of pain including dental, muscular, and joint pain.",
    form: "tablet",
  },
  "nise": {
    manufacturer: "Dr. Reddy's Laboratories Ltd",
    brand: "Nise",
    composition: "Nimesulide 100mg",
    benefits: "Fast-acting pain and inflammation reliever. Particularly effective for acute pain, dental pain, and post-operative discomfort.",
    description: "Nise contains Nimesulide 100mg, a fast-acting NSAID that provides quick relief from pain and inflammation. Manufactured by Dr. Reddy's Laboratories, it is effective for acute pain conditions and has a favorable GI safety profile.",
    form: "tablet",
  },
  "volini": {
    manufacturer: "Sun Pharmaceutical Industries Ltd",
    brand: "Volini",
    composition: "Diclofenac Diethylamine + Methyl Salicylate + Menthol",
    benefits: "Topical pain relief gel that penetrates deep into muscles and joints. Provides targeted relief from sprains, strains, and muscular pain.",
    description: "Volini is a topical analgesic gel manufactured by Sun Pharma. It combines Diclofenac with Menthol and Methyl Salicylate for dual-action relief — anti-inflammatory plus cooling sensation. Ideal for sports injuries and muscular pain.",
    form: "gel",
  },

  // ── Antibiotics ──
  "azee": {
    manufacturer: "Cipla Ltd",
    brand: "Azee",
    composition: "Azithromycin 250mg / 500mg",
    benefits: "Effective macrolide antibiotic for respiratory infections, skin infections, and sexually transmitted diseases. Short course therapy with once-daily dosing.",
    description: "Azee contains Azithromycin, a macrolide antibiotic from Cipla Ltd. It is effective against a wide range of bacterial infections with the advantage of short-course therapy (typically 3-5 days). High tissue concentration ensures sustained antibacterial action.",
    form: "tablet",
  },
  "moex": {
    manufacturer: "Micro Labs Ltd",
    brand: "Moex",
    composition: "Amoxicillin 500mg",
    benefits: "Broad-spectrum antibiotic effective against common bacterial infections of the respiratory tract, urinary tract, and skin.",
    description: "Moex contains Amoxicillin 500mg, a broad-spectrum penicillin antibiotic. Manufactured by Micro Labs Ltd, it is effective against various bacterial infections including respiratory, urinary, and skin infections.",
    form: "capsule",
  },
  "medrol": {
    manufacturer: "Pfizer Ltd",
    brand: "Medrol",
    composition: "Methylprednisolone 4mg / 16mg",
    benefits: "Corticosteroid that reduces inflammation and suppresses the immune system. Used for allergic conditions, asthma, and autoimmune disorders.",
    description: "Medrol contains Methylprednisolone, a synthetic corticosteroid from Pfizer. It is used to treat a wide range of inflammatory and autoimmune conditions by suppressing the immune response and reducing inflammation.",
    form: "tablet",
  },
  "augmentin": {
    manufacturer: "GlaxoSmithKline Pharmaceuticals Ltd",
    brand: "Augmentin",
    composition: "Amoxicillin 625mg + Clavulanic Acid 125mg",
    benefits: "Broad-spectrum antibiotic with beta-lactamase inhibitor. Effective against resistant bacterial infections of the respiratory tract and ENT.",
    description: "Augmentin is a combination of Amoxicillin and Clavulanic Acid from GSK. The Clavulanic Acid protects Amoxicillin from bacterial enzymes, making it effective against resistant bacteria. Widely used for respiratory and ENT infections.",
    form: "tablet",
  },

  // ── Gastric / Digestive ──
  "pan": {
    manufacturer: "Alkem Laboratories Ltd",
    brand: "Pan",
    composition: "Pantoprazole 40mg",
    benefits: "Proton pump inhibitor for long-lasting relief from gastroesophageal reflux disease (GERD), stomach ulcers, and acid-related disorders.",
    description: "Pan contains Pantoprazole 40mg, a proton pump inhibitor manufactured by Alkem Laboratories. It reduces stomach acid production and provides sustained relief from acid reflux, heartburn, and peptic ulcers.",
    form: "tablet",
  },
  "omez": {
    manufacturer: "Dr. Reddy's Laboratories Ltd",
    brand: "Omez",
    composition: "Omeprazole 20mg",
    benefits: "Proton pump inhibitor that reduces stomach acid production. Provides relief from acid reflux, heartburn, and stomach ulcers.",
    description: "Omez contains Omeprazole 20mg, a proton pump inhibitor from Dr. Reddy's Laboratories. It effectively reduces gastric acid secretion, providing relief from GERD, peptic ulcers, and H. pylori eradication therapy.",
    form: "capsule",
  },
  "ranid": {
    manufacturer: "Dr. Reddy's Laboratories Ltd",
    brand: "Ranid",
    composition: "Ranitidine 150mg",
    benefits: "H2 blocker that reduces stomach acid production for relief from heartburn and acid indigestion.",
    description: "Ranid contains Ranitidine 150mg, an H2 receptor antagonist from Dr. Reddy's. It reduces acid secretion by blocking histamine receptors in the stomach, providing relief from heartburn and peptic ulcers.",
    form: "tablet",
  },
  "dynewell": {
    manufacturer: "Alkem Laboratories Ltd",
    brand: "Dynewell",
    composition: "Dicyclomine 20mg",
    benefits: "Antispasmodic that relieves stomach cramps, bloating, and irritable bowel syndrome (IBS) symptoms.",
    description: "Dynewell contains Dicyclomine 20mg, an antispasmodic agent from Alkem. It relaxes smooth muscles of the gastrointestinal tract, providing relief from abdominal cramps and IBS symptoms.",
    form: "tablet",
  },
  "neopeptine": {
    manufacturer: "Abbott India Ltd",
    brand: "Neopeptine",
    composition: "Diastase + Pepsin + Fungal Diastase",
    benefits: "Digestive enzyme supplement that aids digestion and relieves indigestion, bloating, and flatulence.",
    description: "Neopeptine is a digestive enzyme combination from Abbott India. It contains multiple enzymes that help break down carbohydrates, proteins, and fats, providing relief from indigestion and improving nutrient absorption.",
    form: "drops",
  },

  // ── Cardiovascular ──
  "atorva": {
    manufacturer: "Sun Pharmaceutical Industries Ltd",
    brand: "Atorva",
    composition: "Atorvastatin 10mg / 20mg / 40mg",
    benefits: "Statins help lower cholesterol levels and reduce the risk of heart attacks and strokes by blocking cholesterol production in the liver.",
    description: "Atorva contains Atorvastatin, a HMG-CoA reductase inhibitor from Sun Pharma. It lowers LDL cholesterol and triglycerides while raising HDL cholesterol, significantly reducing cardiovascular risk.",
    form: "tablet",
  },
  "stamlo": {
    manufacturer: "Dr. Reddy's Laboratories Ltd",
    brand: "Stamlo",
    composition: "Amlodipine 5mg / 10mg",
    benefits: "Calcium channel blocker that relaxes blood vessels to lower blood pressure and reduce chest pain (angina).",
    description: "Stamlo contains Amlodipine, a dihydropyridine calcium channel blocker from Dr. Reddy's. It provides 24-hour blood pressure control with once-daily dosing and is well-tolerated by most patients.",
    form: "tablet",
  },
  "losar": {
    manufacturer: "Torrent Pharmaceuticals Ltd",
    brand: "Losar",
    composition: "Losartan 50mg / 100mg",
    benefits: "ARB (angiotensin receptor blocker) that lowers blood pressure and protects the kidneys in diabetic patients.",
    description: "Losar contains Losartan, an angiotensin II receptor blocker from Torrent Pharmaceuticals. It effectively lowers blood pressure while providing kidney-protective benefits, especially in diabetic patients.",
    form: "tablet",
  },
  "metoprolol": {
    manufacturer: "Various",
    brand: "Generic",
    composition: "Metoprolol Succinate 50mg / 100mg",
    benefits: "Beta-blocker that reduces heart rate and blood pressure. Also used for heart failure and chest pain management.",
    description: "Metoprolol is a cardioselective beta-blocker that reduces heart rate, blood pressure, and myocardial oxygen demand. It is widely used for hypertension, angina, heart failure, and post-myocardial infarction.",
    form: "tablet",
  },

  // ── Diabetes ──
  "glycomet": {
    manufacturer: "USV Pvt Ltd",
    brand: "Glycomet",
    composition: "Metformin 500mg / 850mg",
    benefits: "First-line treatment for type 2 diabetes. Helps control blood sugar levels by improving insulin sensitivity. Supports healthy weight management.",
    description: "Glycomet contains Metformin, a biguanide antidiabetic from USV Pvt Ltd. It reduces hepatic glucose production and improves insulin sensitivity, making it the first-line therapy for type 2 diabetes worldwide.",
    form: "tablet",
  },
  "glimepiride": {
    manufacturer: "Various",
    brand: "Generic",
    composition: "Glimepiride 1mg / 2mg / 4mg",
    benefits: "Stimulates insulin release from the pancreas to help control blood sugar levels in type 2 diabetes.",
    description: "Glimepiride is a sulfonylurea antidiabetic that stimulates insulin secretion from pancreatic beta cells. It is used as an adjunct to diet and exercise for glycemic control in type 2 diabetes.",
    form: "tablet",
  },

  // ── Allergy & Cold ──
  "cetirizine": {
    manufacturer: "Cipla Ltd",
    brand: "Cetirizine",
    composition: "Cetirizine 10mg",
    benefits: "Non-drowsy antihistamine that provides 24-hour relief from allergic rhinitis, urticaria, and other allergy symptoms.",
    description: "Cetirizine is a second-generation antihistamine from Cipla that provides effective 24-hour relief from allergic conditions. It has minimal sedative effects compared to first-generation antihistamines.",
    form: "tablet",
  },
  "zyrtec": {
    manufacturer: "Johnson & Johnson Ltd",
    brand: "Zyrtec",
    composition: "Cetirizine 10mg",
    benefits: "Premium non-drowsy antihistamine for effective 24-hour allergy relief. Provides relief from sneezing, runny nose, and itchy eyes.",
    description: "Zyrtec is a premium brand of Cetirizine from Johnson & Johnson. It provides reliable 24-hour relief from allergic rhinitis and chronic urticaria with minimal drowsiness.",
    form: "tablet",
  },
  "allegra": {
    manufacturer: "Sanofi India Ltd",
    brand: "Allegra",
    composition: "Fexofenadine 120mg / 180mg",
    benefits: "Second-generation antihistamine that provides effective allergy relief without causing drowsiness.",
    description: "Allegra contains Fexofenadine from Sanofi India. It is a non-sedating antihistamine that provides effective relief from seasonal allergic rhinitis and chronic urticaria without causing drowsiness.",
    form: "tablet",
  },
  "sinarest": {
    manufacturer: "Micro Labs Ltd",
    brand: "Sinarest",
    composition: "Paracetamol + Phenylephrine + Chlorpheniramine",
    benefits: "Multi-symptom cold and flu relief. Addresses headache, fever, nasal congestion, and runny nose.",
    description: "Sinarest is a combination medicine from Micro Labs that provides comprehensive relief from cold and flu symptoms. It contains Paracetamol for pain/fever, Phenylephrine for nasal congestion, and Chlorpheniramine for runny nose.",
    form: "tablet",
  },
  "montair": {
    manufacturer: "Cipla Ltd",
    brand: "Montair",
    composition: "Montelukast 10mg",
    benefits: "Leukotriene receptor blocker that prevents asthma attacks and relieves seasonal allergy symptoms.",
    description: "Montair contains Montelukast 10mg from Cipla. It blocks leukotriene receptors to prevent airway inflammation, making it effective for asthma prevention and allergy symptom relief.",
    form: "tablet",
  },

  // ── Vitamins & Supplements ──
  "becosules": {
    manufacturer: "Pfizer Ltd",
    brand: "Becosules",
    composition: "Vitamin B Complex + Vitamin C",
    benefits: "Complete Vitamin B complex supplement that supports energy metabolism, nerve function, and helps manage B-complex deficiency.",
    description: "Becosules is a trusted Vitamin B Complex from Pfizer containing all essential B vitamins plus Vitamin C. It supports energy metabolism, red blood cell formation, and nervous system health. Widely recommended for fatigue and nutritional deficiencies.",
    form: "capsule",
  },
  "shelcal": {
    manufacturer: "Torrent Pharmaceuticals Ltd",
    brand: "Shelcal",
    composition: "Calcium Carbonate 500mg + Vitamin D3 250 IU",
    benefits: "Essential mineral for strong bones and teeth. Helps prevent osteoporosis and supports muscle and nerve function.",
    description: "Shelcal is a calcium and Vitamin D3 supplement from Torrent Pharmaceuticals. It provides essential calcium for bone health along with Vitamin D3 for better calcium absorption. Recommended for osteoporosis prevention and bone health.",
    form: "tablet",
  },
  "supradyn": {
    manufacturer: "Bayer Zydus Pharma",
    brand: "Supradyn",
    composition: "Multivitamin + Multimineral",
    benefits: "Complete daily nutrition support with essential vitamins and minerals for overall health and wellness.",
    description: "Supradyn is a comprehensive multivitamin and multimineral supplement. It provides all essential nutrients needed for daily health, supporting immunity, energy production, and overall well-being.",
    form: "tablet",
  },
  "neurobion": {
    manufacturer: "Merck Ltd",
    brand: "Neurobion",
    composition: "Vitamin B1 + B6 + B12",
    benefits: "Essential for nerve function, red blood cell formation, and DNA synthesis. Supports energy levels and brain health.",
    description: "Neurobion contains B vitamins (B1, B6, B12) from Merck. It supports nerve health, reduces neuropathic pain, and aids in the management of vitamin B deficiency-related conditions.",
    form: "tablet",
  },
  "revital": {
    manufacturer: "Sun Pharmaceutical Industries Ltd",
    brand: "Revital",
    composition: "Multivitamin + Ginseng + Minerals",
    benefits: "Daily multivitamin with Ginseng for energy, immunity, and overall well-being. Helps fight fatigue and weakness.",
    description: "Revital is a multivitamin with Ginseng from Sun Pharma. It combines essential vitamins, minerals, and Ginseng extract to boost energy, strengthen immunity, and improve overall vitality.",
    form: "capsule",
  },

  // ── Respiratory ──
  "asthalin": {
    manufacturer: "Cipla Ltd",
    brand: "Asthalin",
    composition: "Salbutamol 2mg / 4mg",
    benefits: "Fast-acting bronchodilator that relieves acute asthma attacks and breathing difficulties.",
    description: "Asthalin contains Salbutamol from Cipla, a fast-acting beta-2 agonist bronchodilator. It provides quick relief from acute asthma symptoms and bronchospasm by relaxing airway smooth muscles.",
    form: "tablet",
  },
  "deriphyllin": {
    manufacturer: "Dr. Reddy's Laboratories Ltd",
    brand: "Deriphyllin",
    composition: "Theophylline 100mg / 150mg",
    benefits: "Bronchodilator used for chronic asthma and COPD. Opens airways to improve breathing.",
    description: "Deriphyllin contains Theophylline from Dr. Reddy's. It is a methylxanthine bronchodilator used for the maintenance treatment of chronic asthma and COPD, helping to keep airways open.",
    form: "tablet",
  },

  // ── Skin & Topical ──
  "cloben-g": {
    manufacturer: "Glenmark Pharmaceuticals Ltd",
    brand: "Cloben-G",
    composition: "Clobetasol + Gentamicin + Miconazole",
    benefits: "Combination skin cream for fungal and bacterial skin infections with anti-inflammatory action.",
    description: "Cloben-G is a triple-action cream from Glenmark containing an antifungal, antibiotic, and corticosteroid. It effectively treats mixed skin infections including fungal infections with inflammation.",
    form: "cream",
  },
  "deriva-ms": {
    manufacturer: "Abbott India Ltd",
    brand: "Deriva MS",
    composition: "Adapalene 0.1% + Benzoyl Peroxide 2.5%",
    benefits: "Effective acne treatment that unclogs pores, reduces inflammation, and kills acne-causing bacteria.",
    description: "Deriva MS from Abbott combines Adapalene and Benzoyl Peroxide for comprehensive acne treatment. It works by unclogging pores, reducing inflammation, and eliminating bacteria that cause acne.",
    form: "gel",
  },
  "aziderm": {
    manufacturer: "Micro Labs Ltd",
    brand: "Aziderm",
    composition: "Azelaic Acid 10% / 20%",
    benefits: "Topical treatment for acne and hyperpigmentation. Reduces inflammation and normalizes skin cell turnover.",
    description: "Aziderm contains Azelaic Acid from Micro Labs. It is effective for mild to moderate acne and hyperpigmentation by normalizing keratinization and reducing inflammation.",
    form: "cream",
  },

  // ── Baby Care ──
  "baby-elixir": {
    manufacturer: "Abbott India Ltd",
    brand: "Baby Elixir",
    composition: "Multivitamin Drops",
    benefits: "Pediatric multivitamin drops for infants and children. Supports growth, immunity, and overall development.",
    description: "Baby Elixir is a pediatric multivitamin supplement from Abbott. It provides essential vitamins needed for the healthy growth and development of infants and children.",
    form: "drops",
  },

  // ── Digestive / Probiotics ──
  "enterogermina": {
    manufacturer: "Sanofi India Ltd",
    brand: "Enterogermina",
    composition: "Bacillus clausii 2 Billion Spores",
    benefits: "Probiotic that restores healthy gut bacteria. Effective for diarrhea, antibiotic-associated gut issues, and digestive health.",
    description: "Enterogermina from Sanofi contains Bacillus clausii spores that colonize the gut and restore healthy intestinal flora. It is effective in managing diarrhea and antibiotic-associated digestive disturbances.",
    form: "sachet",
  },

  // ── Nutritional Supplements ──
  "ensure": {
    manufacturer: "Abbott India Ltd",
    brand: "Ensure",
    composition: "Complete Nutritional Shake",
    benefits: "Complete balanced nutrition for adults. Provides protein, vitamins, and minerals for overall health and recovery.",
    description: "Ensure from Abbott is a scientifically designed complete nutritional supplement. It provides balanced nutrition with protein, 28 vitamins and minerals, and is ideal for nutritional supplementation during recovery or as a meal replacement.",
    form: "powder",
  },

  // ── Additional Common Medicines ──
  "azel": {
    manufacturer: "Dr. Reddy's Laboratories Ltd",
    brand: "Azel",
    composition: "Azithromycin 250mg",
    benefits: "Macrolide antibiotic for respiratory infections, skin infections. Short course therapy with excellent tissue penetration.",
    description: "Azel from Dr. Reddy's contains Azithromycin 250mg. It provides effective treatment for respiratory and skin infections with the advantage of a short 3-5 day course and once-daily dosing.",
    form: "tablet",
  },
  "shelcal-500": {
    manufacturer: "Torrent Pharmaceuticals Ltd",
    brand: "Shelcal 500",
    composition: "Calcium Carbonate 500mg + Vitamin D3 250 IU",
    benefits: "High-dose calcium supplement for osteoporosis prevention and bone health. Enhanced with Vitamin D3 for better absorption.",
    description: "Shelcal 500 is a high-dose calcium supplement from Torrent Pharmaceuticals. It provides 500mg elemental calcium with Vitamin D3 for enhanced absorption, recommended for osteoporosis prevention and calcium deficiency.",
    form: "tablet",
  },
  "rabecee": {
    manufacturer: "Dr. Reddy's Laboratories Ltd",
    brand: "Rabecee",
    composition: "Rabeprazole 20mg",
    benefits: "Fast-acting proton pump inhibitor for acid reflux, peptic ulcers, and H. pylori eradication therapy.",
    description: "Rabecee contains Rabeprazole 20mg from Dr. Reddy's. It is a potent proton pump inhibitor that provides rapid acid suppression for GERD, peptic ulcers, and H. pylori eradication.",
    form: "tablet",
  },
  "telma": {
    manufacturer: "Glenmark Pharmaceuticals Ltd",
    brand: "Telma",
    composition: "Telmisartan 40mg / 80mg",
    benefits: "Long-acting ARB for blood pressure control with additional cardiovascular protective benefits.",
    description: "Telma contains Telmisartan from Glenmark. It is a long-acting angiotensin II receptor blocker that provides 24-hour blood pressure control with additional cardioprotective properties.",
    form: "tablet",
  },
  "amlopress": {
    manufacturer: "Sun Pharmaceutical Industries Ltd",
    brand: "Amlopress",
    composition: "Amlodipine 5mg",
    benefits: "Calcium channel blocker for hypertension and angina. Provides smooth, gradual blood pressure reduction.",
    description: "Amlopress contains Amlodipine 5mg from Sun Pharma. It provides effective 24-hour blood pressure control with a smooth onset of action and minimal reflex tachycardia.",
    form: "tablet",
  },
  "tbel": {
    manufacturer: "Zydus Cadila",
    brand: "Tbel",
    composition: "Teneligliptin 20mg",
    benefits: "DPP-4 inhibitor that helps regulate blood sugar by increasing insulin production after meals.",
    description: "Tbel contains Teneligliptin from Zydus Cadila. It is a DPP-4 inhibitor that enhances incretin-mediated insulin secretion, providing effective glycemic control in type 2 diabetes.",
    form: "tablet",
  },
  "glyca": {
    manufacturer: "Sun Pharmaceutical Industries Ltd",
    brand: "Glyca",
    composition: "Gliclazide 80mg",
    benefits: "Sulfonylurea that stimulates insulin secretion to control blood sugar in type 2 diabetes.",
    description: "Glyca contains Gliclazide 80mg from Sun Pharma. It stimulates pancreatic insulin secretion and is effective for glycemic control in type 2 diabetes, particularly postprandial glucose.",
    form: "tablet",
  },
  "duphaston": {
    manufacturer: "Abbott India Ltd",
    brand: "Duphaston",
    composition: "Dydrogesterone 10mg",
    benefits: "Progesterone hormone supplement used for menstrual disorders, threatened miscarriage, and hormone replacement therapy.",
    description: "Duphaston contains Dydrogesterone from Abbott. It is a bio-identical progesterone used for various gynecological conditions including menstrual irregularities, threatened miscarriage, and luteal phase defects.",
    form: "tablet",
  },
  "meftal": {
    manufacturer: "Blue Cross Laboratories Ltd",
    brand: "Meftal",
    composition: "Mefenamic Acid 500mg",
    benefits: "NSAID effective for menstrual pain (dysmenorrhea), mild to moderate pain, and inflammatory conditions.",
    description: "Meftal contains Mefenamic Acid from Blue Cross Labs. It is particularly effective for menstrual pain and provides analgesic and anti-inflammatory action for various painful conditions.",
    form: "tablet",
  },
  "pan-D": {
    manufacturer: "Alkem Laboratories Ltd",
    brand: "Pan-D",
    composition: "Pantoprazole 40mg + Domperidone 30mg",
    benefits: "Combination of PPI and prokinetic for GERD with nausea. Reduces acid and improves gastric motility.",
    description: "Pan-D from Alkem combines Pantoprazole with Domperidone for comprehensive acid reflux management. The PPI reduces acid while Domperidone improves gastric motility, providing relief from reflux with nausea.",
    form: "tablet",
  },
  "azithral": {
    manufacturer: "Alembic Pharmaceuticals Ltd",
    brand: "Azithral",
    composition: "Azithromycin 500mg",
    benefits: "Effective macrolide antibiotic for respiratory infections. High tissue concentration enables short 3-day course.",
    description: "Azithral from Alembic contains Azithromycin 500mg. It provides effective treatment for community-acquired pneumonia, bronchitis, and sinusitis with a convenient short course.",
    form: "tablet",
  },
  "doxynord": {
    manufacturer: "Mankind Pharma Ltd",
    brand: "Doxynord",
    composition: "Doxycycline 100mg",
    benefits: "Tetracycline antibiotic for respiratory infections, acne, malaria prophylaxis, and tick-borne diseases.",
    description: "Doxynord from Mankind contains Doxycycline 100mg. It is a broad-spectrum tetracycline antibiotic effective against respiratory infections, acne, and for malaria prophylaxis in travelers.",
    form: "capsule",
  },
  "zydus-cetirizine": {
    manufacturer: "Zydus Cadila",
    brand: "Cetirizine",
    composition: "Cetirizine 10mg",
    benefits: "Effective non-drowsy antihistamine for 24-hour relief from allergic rhinitis and chronic urticaria.",
    description: "Cetirizine from Zydus Cadila provides effective allergy relief with once-daily dosing. It blocks H1 histamine receptors to relieve sneezing, runny nose, and itchy eyes.",
    form: "tablet",
  },
  "decolde": {
    manufacturer: "Abbott India Ltd",
    brand: "Decolde",
    composition: "Phenylephrine + Chlorpheniramine + Paracetamol",
    benefits: "Multi-ingredient cold remedy for nasal congestion, sneezing, runny nose, and headache associated with cold.",
    description: "Decolde from Abbott is a comprehensive cold medicine that combines a decongestant, antihistamine, and analgesic for effective relief from multiple cold and flu symptoms.",
    form: "tablet",
  },
  "nasivion": {
    manufacturer: "Meda Pharmaceuticals India",
    brand: "Nasivion",
    composition: "Oxymetazoline 0.025% / 0.05%",
    benefits: "Nasal decongestant spray that provides rapid relief from nasal congestion due to cold, allergies, and sinusitis.",
    description: "Nasivion from Meda Pharmaceuticals is an oxymetazoline nasal spray that provides quick relief from nasal congestion by constricting blood vessels in the nasal passages.",
    form: "nasal drops",
  },
  "vicks": {
    manufacturer: "Procter & Gamble Health Ltd",
    brand: "Vicks",
    composition: "Dextromethorphan + Menthol + Camphor",
    benefits: "Effective cough suppressant and throat relief for dry and productive coughs associated with cold.",
    description: "Vicks from P&G Health provides effective cough and cold relief. The combination of Dextromethorphan for cough suppression with Menthol and Camphor for throat soothing makes it a trusted household remedy.",
    form: "syrup",
  },
  "benadryl": {
    manufacturer: "Johnson & Johnson Ltd",
    brand: "Benadryl",
    composition: "Diphenhydramine 12.5mg",
    benefits: "Antihistamine for allergic symptoms including runny nose, sneezing, itchy eyes, and dry cough.",
    description: "Benadryl from Johnson & Johnson is a trusted antihistamine brand. It provides effective relief from allergy symptoms and dry cough. Available in syrup form for easy administration.",
    form: "syrup",
  },
  "strepsils": {
    manufacturer: "Hindustan Unilever Ltd",
    brand: "Strepsils",
    composition: "Amylmetacresol + Dichlorobenzyl Alcohol",
    benefits: "Antiseptic lozenges for sore throat, mouth, and throat infections. Provides symptomatic relief from throat pain.",
    description: "Strepsils from HUL contains dual antiseptic agents that fight bacteria in the mouth and throat. It provides effective relief from sore throat, mouth ulcers, and throat infections.",
    form: "lozenge",
  },
  "coridil": {
    manufacturer: "Micro Labs Ltd",
    brand: "Coridil",
    composition: "Serratiopeptidase + Diclofenac",
    benefits: "Anti-inflammatory enzyme combination that reduces swelling and accelerates healing after surgery or injury.",
    description: "Coridil from Micro Labs combines Serratiopeptidase with Diclofenac. The proteolytic enzyme reduces swelling and bruising while the NSAID provides pain relief, making it ideal for post-surgical recovery.",
    form: "tablet",
  },
  "pecto": {
    manufacturer: "Lupin Ltd",
    brand: "Pecto",
    composition: "Ambroxol + Terbutaline + Guaifenesin",
    benefits: "Combination cough syrup that loosens mucus, opens airways, and provides relief from productive cough.",
    description: "Pecto from Lupin is a mucolytic and bronchodilator combination. Ambroxol loosens mucus, Terbutaline opens airways, and Guaifenesin thins secretions for effective cough relief.",
    form: "syrup",
  },
  "zifi": {
    manufacturer: "FDC Ltd",
    brand: "Zifi",
    composition: "Cefixime 200mg",
    benefits: "Third-generation cephalosporin antibiotic effective against respiratory, urinary tract, and ENT infections.",
    description: "Zifi from FDC contains Cefixime 200mg, a third-generation cephalosporin antibiotic. It provides effective treatment for various bacterial infections with once-daily dosing convenience.",
    form: "tablet",
  },
  "taxim": {
    manufacturer: "Alkem Laboratories Ltd",
    brand: "Taxim",
    composition: "Cefixime 200mg",
    benefits: "Oral cephalosporin antibiotic for respiratory infections, UTI, and typhoid fever. Well-absorbed with excellent tissue penetration.",
    description: "Taxim from Alkem contains Cefixime 200mg. It provides effective oral treatment for respiratory and urinary tract infections with excellent bioavailability and tissue penetration.",
    form: "tablet",
  },
  "monocef": {
    manufacturer: "Aristo Pharmaceuticals Ltd",
    brand: "Monocef",
    composition: "Ceftriaxone 1g",
    benefits: "Third-generation injectable cephalosporin for severe bacterial infections including meningitis and septicemia.",
    description: "Monocef from Aristo contains Ceftriaxone, a potent injectable cephalosporin. It is used for severe hospital-acquired infections, meningitis, and septicemia with once-daily dosing.",
    form: "injection",
  },
  "amikacin": {
    manufacturer: "Various",
    brand: "Generic",
    composition: "Amikacin 500mg",
    benefits: "Aminoglycoside antibiotic for serious gram-negative bacterial infections. Used when other antibiotics are ineffective.",
    description: "Amikacin is an aminoglycoside antibiotic effective against severe gram-negative bacterial infections. It is typically reserved for serious infections unresponsive to other antibiotics.",
    form: "injection",
  },
};

// ════════════════════════════════════════════════════════════════
// KNOWN MANUFACTURERS (fallback lookup)
// ════════════════════════════════════════════════════════════════

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
  "doxynord": "Mankind Pharma Ltd",
  "levoflox": "Cipla Ltd",
  "amoxicillin": "Cipla Ltd",
  "metformin": "USV Pvt Ltd",
  "glycomet": "USV Pvt Ltd",
  "gudcef": "Lupin Ltd",
  "cefuroxime": "Lupin Ltd",
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
};

// ════════════════════════════════════════════════════════════════
// BENEFITS DATABASE (fallback for unknown products)
// ════════════════════════════════════════════════════════════════

const BENEFITS_DB: Record<string, string> = {
  "paracetamol": "Provides effective relief from mild to moderate pain and reduces fever. Safe and well-tolerated when used as directed.",
  "acetaminophen": "Provides effective relief from mild to moderate pain and reduces fever. Safe and well-tolerated when used as directed.",
  "ibuprofen": "Reduces pain, inflammation, and fever. Anti-inflammatory action helps with headaches, muscle aches, and joint pain.",
  "diclofenac": "Powerful anti-inflammatory and pain reliever. Effective for joint pain, back pain, dental pain, and post-surgical pain.",
  "naproxen": "Long-lasting relief from pain and inflammation. Particularly effective for arthritis, menstrual cramps, and musculoskeletal conditions.",
  "nimesulide": "Fast-acting pain and inflammation reliever. Effective for acute pain, dental pain, and post-operative discomfort.",
  "aceclofenac": "Modern NSAID with effective pain relief and anti-inflammatory action. Lower gastrointestinal side effects compared to older NSAIDs.",
  "amoxicillin": "Broad-spectrum antibiotic effective against common bacterial infections of the respiratory tract, urinary tract, and skin.",
  "azithromycin": "Effective macrolide antibiotic for respiratory infections, skin infections, and sexually transmitted diseases. Short course therapy.",
  "ciprofloxacin": "Fluoroquinolone antibiotic effective against a wide range of bacterial infections including urinary tract and respiratory infections.",
  "doxycycline": "Tetracycline antibiotic for respiratory infections, acne, malaria prophylaxis, and tick-borne diseases.",
  "levofloxacin": "Advanced fluoroquinolone antibiotic effective against respiratory infections, urinary tract infections, and complicated skin infections.",
  "cephalexin": "First-generation cephalosporin antibiotic effective against common skin, bone, and urinary tract infections.",
  "cefuroxime": "Second-generation cephalosporin antibiotic effective against respiratory infections, urinary tract infections, and Lyme disease.",
  "metronidazole": "Effective against anaerobic bacteria and parasites. Used for dental infections, abdominal infections, and certain parasitic infections.",
  "metformin": "First-line treatment for type 2 diabetes. Helps control blood sugar levels by improving insulin sensitivity. Supports healthy weight management.",
  "glimepiride": "Stimulates insulin release from the pancreas to help control blood sugar levels in type 2 diabetes.",
  "sitagliptin": "DPP-4 inhibitor that helps regulate blood sugar levels by increasing insulin production after meals.",
  "voglibose": "Alpha-glucosidase inhibitor that helps prevent blood sugar spikes after meals by slowing carbohydrate digestion.",
  "atorvastatin": "Statins help lower cholesterol levels and reduce the risk of heart attacks and strokes by blocking cholesterol production in the liver.",
  "rosuvastatin": "Highly effective statin for lowering LDL cholesterol and triglycerides while raising HDL cholesterol.",
  "amlodipine": "Calcium channel blocker that relaxes blood vessels to lower blood pressure and reduce chest pain (angina).",
  "losartan": "ARB (angiotensin receptor blocker) that lowers blood pressure and protects the kidneys in diabetic patients.",
  "telmisartan": "Long-acting ARB for blood pressure control with additional cardiovascular protective benefits.",
  "metoprolol": "Beta-blocker that reduces heart rate and blood pressure. Also used for heart failure and chest pain management.",
  "omeprazole": "Proton pump inhibitor that reduces stomach acid production. Provides relief from acid reflux, heartburn, and stomach ulcers.",
  "pantoprazole": "Proton pump inhibitor for long-lasting relief from gastroesophageal reflux disease (GERD), stomach ulcers, and acid-related disorders.",
  "rabeprazole": "Fast-acting proton pump inhibitor for acid reflux, peptic ulcers, and H. pylori eradication therapy.",
  "ranitidine": "H2 blocker that reduces stomach acid production for relief from heartburn and acid indigestion.",
  "esomeprazole": "S-isomer of omeprazole with enhanced acid suppression for GERD, erosive esophagitis, and duodenal ulcers.",
  "cetirizine": "Non-drowsy antihistamine that provides 24-hour relief from allergic rhinitis, urticaria, and other allergy symptoms.",
  "loratadine": "Non-drowsy antihistamine for relief from sneezing, runny nose, itchy eyes, and other allergy symptoms.",
  "fexofenadine": "Second-generation antihistamine that provides effective allergy relief without causing drowsiness.",
  "levocetirizine": "Active enantiomer of cetirizine for potent, non-drowsy relief from chronic allergic conditions.",
  "montelukast": "Leukotriene receptor blocker that prevents asthma attacks and relieves seasonal allergy symptoms.",
  "phenylephrine": "Nasal decongestant that relieves sinus pressure and stuffy nose due to colds and allergies.",
  "pseudoephedrine": "Effective decongestant for sinus and nasal congestion associated with colds, flu, and allergies.",
  "vitamin d": "Supports bone health, calcium absorption, and immune system function. Essential for preventing vitamin D deficiency.",
  "vitamin b12": "Essential for nerve function, red blood cell formation, and DNA synthesis. Supports energy levels and brain health.",
  "calcium": "Essential mineral for strong bones and teeth. Helps prevent osteoporosis and supports muscle and nerve function.",
  "iron": "Essential for making hemoglobin and preventing iron-deficiency anemia. Supports energy levels and oxygen transport.",
  "multivitamin": "Complete daily nutrition support with essential vitamins and minerals for overall health and wellness.",
  "omega": "Essential fatty acids that support heart health, brain function, and reduce inflammation.",
  "moisturizer": "Hydrates and nourishes the skin, helping to maintain the skin barrier and prevent dryness.",
  "sunscreen": "Protects skin from harmful UV rays, preventing sunburn, premature aging, and reducing skin cancer risk.",
  "antifungal": "Treats fungal infections of the skin, nails, and mucous membranes by targeting the fungal cell membrane.",
  "loperamide": "Effective anti-diarrheal that slows gut motility to relieve acute and chronic diarrhea.",
  "ors": "Oral rehydration salts that replenish fluids and electrolytes lost during diarrhea or dehydration.",
  "salbutamol": "Fast-acting bronchodilator that relieves acute asthma attacks and breathing difficulties.",
  "budesonide": "Inhaled corticosteroid that reduces airway inflammation and prevents asthma attacks with regular use.",
  "levothyroxine": "Synthetic thyroid hormone for treating hypothyroidism. Helps regulate metabolism, energy, and body weight.",
};

// ════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ════════════════════════════════════════════════════════════════

/**
 * Match a product name against the medicines database.
 * Returns the best matching entry.
 */
function matchMedicine(productName: string): MedicineInfo | null {
  const lower = productName.toLowerCase().trim();

  // Direct match first
  if (MEDICINES_DB[lower]) return MEDICINES_DB[lower];

  // Try matching without dosage numbers
  const stripped = lower.replace(/\s*\d+\s*(mg|ml|g|mcg|iu|%)?$/i, "").trim();
  if (MEDICINES_DB[stripped]) return MEDICINES_DB[stripped];

  // Try partial matching (longest match first)
  let bestMatch: MedicineInfo | null = null;
  let bestLen = 0;
  for (const [key, info] of Object.entries(MEDICINES_DB)) {
    if (lower.includes(key) && key.length > bestLen) {
      bestMatch = info;
      bestLen = key.length;
    }
  }
  if (bestMatch) return bestMatch;

  return null;
}

/**
 * Try to match product name against known manufacturers.
 */
function getKnownManufacturer(productName: string): string | null {
  const lower = productName.toLowerCase();
  for (const [key, manufacturer] of Object.entries(KNOWN_MANUFACTURERS)) {
    if (lower.includes(key)) return manufacturer;
  }
  return null;
}

/**
 * Generate benefits from composition/name using the benefits DB.
 */
function getKnownBenefits(composition: string, form: string): string | null {
  const lowerComp = composition.toLowerCase();
  for (const [key, benefits] of Object.entries(BENEFITS_DB)) {
    if (lowerComp.includes(key)) return benefits;
  }
  // Form-specific fallback
  const f = form.toLowerCase();
  if (["tablet", "capsule"].includes(f))
    return "Effective medication in convenient oral dosage form. Take as directed by your healthcare provider for best results.";
  if (["syrup", "suspension"].includes(f))
    return "Easy-to-administer liquid formulation suitable for patients who have difficulty swallowing tablets.";
  if (["cream", "gel", "ointment"].includes(f))
    return "Topical formulation for targeted relief. Apply as directed to affected area for effective local treatment.";
  if (f === "drops")
    return "Precise dosing in liquid drop form for targeted application and easy administration.";
  if (f === "injection")
    return "Fast-acting injectable formulation for rapid therapeutic effect when oral administration is not suitable.";
  return null;
}

/**
 * Fetch product image from OpenFDA (free) or Wikimedia Commons (free).
 * Falls back to null if nothing found.
 */
async function fetchFreeImage(productName: string, composition?: string): Promise<string | null> {
  // Try OpenFDA first (free, no API key needed)
  const searchTerm = composition || productName;
  const openFdaUrl = `https://api.fda.gov/drug/label.json?search=openfda.brand_name:${encodeURIComponent(`"${searchTerm}"`)}&limit=1`;

  try {
    const response = await fetch(openFdaUrl);
    if (response.ok) {
      const data = await response.json();
      if (data.results?.[0]) {
        // OpenFDA doesn't have images in label data, but we can use it for metadata
        // Fall through to Wikimedia
      }
    }
  } catch {
    // Continue
  }

  // Try Wikimedia Commons API (free, no key needed)
  const wikiSearch = encodeURIComponent(`${productName} medicine tablet`);
  const wikiUrl = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${wikiSearch}&srnamespace=6&srlimit=3&format=json&origin=*`;

  try {
    const response = await fetch(wikiUrl);
    if (response.ok) {
      const data = await response.json();
      const results = data?.query?.search;
      if (results && results.length > 0) {
        // Get the image URL from the first result
        const title = results[0].title;
        const imgUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`;
        const imgResponse = await fetch(imgUrl);
        if (imgResponse.ok) {
          const imgData = await imgResponse.json();
          const pages = imgData?.query?.pages;
          if (pages) {
            const page = Object.values(pages)[0] as any;
            if (page?.imageinfo?.[0]?.thumburl) {
              return page.imageinfo[0].thumburl;
            }
            if (page?.imageinfo?.[0]?.url) {
              return page.imageinfo[0].url;
            }
          }
        }
      }
    }
  } catch {
    // Continue
  }

  return null;
}

/**
 * Generate a safe placeholder image URL with the product name.
 * Uses a clean SVG data URI so the product card always shows something.
 */
function generatePlaceholderImage(productName: string): string {
  const initials = productName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="200" height="200" rx="16" fill="%23f0f7ff"/>
    <text x="100" y="85" font-family="system-ui,sans-serif" font-size="42" font-weight="700" fill="%233b82f6" text-anchor="middle">${initials}</text>
    <text x="100" y="120" font-family="system-ui,sans-serif" font-size="12" fill="%2364748b" text-anchor="middle">${encodeURIComponent(productName.slice(0, 20))}</text>
  </svg>`;
  return `data:image/svg+xml,${svg}`;
}

// ════════════════════════════════════════════════════════════════
// ACTIONS (called from frontend)
// ════════════════════════════════════════════════════════════════

/**
 * Fetch product image from free sources.
 */
export const fetchProductImage = action({
  args: {
    productName: v.string(),
    manufacturer: v.optional(v.string()),
    brand: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const imageUrl = await fetchFreeImage(args.productName, args.brand);
    if (imageUrl) {
      return { success: true, imageUrl, reason: null };
    }
    // Return placeholder
    const placeholder = generatePlaceholderImage(args.productName);
    return { success: true, imageUrl: placeholder, reason: "Using generated placeholder" };
  },
});

/**
 * Full product enrichment using local database + free image sources.
 * Returns: imageUrl, manufacturer, benefits, description, consumeType, composition.
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
    const result: {
      imageUrl: string | null;
      manufacturer: string | null;
      benefits: string | null;
      description: string | null;
      consumeType: string | null;
      composition: string | null;
    } = {
      imageUrl: null,
      manufacturer: null,
      benefits: null,
      description: null,
      consumeType: null,
      composition: null,
    };

    // 1. Try comprehensive local database match
    const matched = matchMedicine(args.productName);
    if (matched) {
      result.manufacturer = matched.manufacturer;
      result.benefits = matched.benefits;
      result.description = matched.description;
      result.composition = matched.composition;

      // Consume type from form
      const form = (matched.form || args.form || "").toLowerCase();
      if (["tablet", "capsule", "syrup", "suspension", "drops", "inhaler", "powder", "sachet", "lozenge"].includes(form)) {
        result.consumeType = "For oral use";
      } else if (["cream", "gel", "ointment", "lotion"].includes(form)) {
        result.consumeType = "For external use only";
      } else if (form === "injection") {
        result.consumeType = "For injection use only";
      } else if (form === "nasal drops" || form === "nasal") {
        result.consumeType = "For nasal use";
      }
    } else {
      // 2. Fallback: try known manufacturer DB
      const mfg = getKnownManufacturer(args.productName);
      if (mfg) result.manufacturer = mfg;
      else if (args.manufacturer) result.manufacturer = args.manufacturer;

      // 3. Fallback: try benefits DB based on composition
      const composition = args.composition || args.productName;
      const benefits = getKnownBenefits(composition, args.form || "tablet");
      if (benefits) result.benefits = benefits;

      // 4. Generate description from available info
      const parts: string[] = [];
      parts.push(`${args.productName} is a medication${args.manufacturer ? ` manufactured by ${args.manufacturer}` : ""}.`);
      if (args.composition) parts.push(`It contains ${args.composition}.`);
      if (args.form) parts.push(`Available as ${args.form}.`);
      parts.push("Consult your healthcare provider for proper dosage and usage instructions.");
      result.description = parts.join(" ");

      // 5. Consume type from form
      const form = (args.form || "").toLowerCase();
      if (["tablet", "capsule", "syrup", "suspension", "drops", "inhaler", "powder", "sachet"].includes(form)) {
        result.consumeType = "For oral use";
      } else if (["cream", "gel", "ointment", "lotion"].includes(form)) {
        result.consumeType = "For external use only";
      } else if (form === "injection") {
        result.consumeType = "For injection use only";
      }
    }

    // 6. Image: try free sources
    const imageUrl = await fetchFreeImage(args.productName, result.composition || args.composition);
    result.imageUrl = imageUrl || generatePlaceholderImage(args.productName);

    return result;
  },
});
