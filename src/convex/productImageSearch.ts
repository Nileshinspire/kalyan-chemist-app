import { action } from "./_generated/server";
import { v } from "convex/values";

// ════════════════════════════════════════════════════════════════
// COMPREHENSIVE INDIAN MEDICINES DATABASE
// Maps product name keywords → { manufacturer, benefits, description, composition, form }
// ════════════════════════════════════════════════════════════════

interface MedicineInfo {
  manufacturer: string;
  brand: string;
  composition: string;
  benefits: string;
  description: string;
  form: string;
  /** Wikipedia article title for composition image lookup */
  wikiTitle?: string;
  /** Batch-specific expiry date as ISO string (YYYY-MM-DD). null = not available from free sources, admin must enter manually. */
  expiryDate?: string | null;
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
    wikiTitle: "Paracetamol",
  },
  "crocin": {
    manufacturer: "GlaxoSmithKline Pharmaceuticals Ltd",
    brand: "Crocin",
    composition: "Paracetamol 500mg / 650mg",
    benefits: "Effective pain reliever and fever reducer. Fast-acting formula suitable for headaches, body aches, and cold-related fever.",
    description: "Crocin is a trusted paracetamol brand from GSK, available in 500mg and 650mg strengths. It provides fast and effective relief from pain and fever. Widely recommended by doctors across India for its proven efficacy and safety profile.",
    form: "tablet",
    wikiTitle: "Paracetamol",
  },
  "combiflam": {
    manufacturer: "Sanofi India Ltd",
    brand: "Combiflam",
    composition: "Ibuprofen 400mg + Paracetamol 325mg",
    benefits: "Dual-action formula combining anti-inflammatory and pain-relieving properties. Effective for headaches, dental pain, menstrual cramps, and musculoskeletal pain.",
    description: "Combiflam is a combination of Ibuprofen and Paracetamol that provides dual action pain relief. The anti-inflammatory component addresses the source of pain while paracetamol reduces fever. Manufactured by Sanofi India, it is one of India's most popular OTC pain relievers.",
    form: "tablet",
    wikiTitle: "Ibuprofen",
  },
  "paracetamol": {
    manufacturer: "Various",
    brand: "Generic",
    composition: "Paracetamol 500mg",
    benefits: "Relieves mild to moderate pain and reduces fever. One of the safest analgesics with minimal side effects when used as directed.",
    description: "Paracetamol (Acetaminophen) is a widely used over-the-counter analgesic and antipyretic. It works by inhibiting prostaglandin synthesis in the central nervous system, providing effective relief from pain and fever.",
    form: "tablet",
    wikiTitle: "Paracetamol",
  },
  "ibugesic": {
    manufacturer: "Cipla Ltd",
    brand: "Ibugesic",
    composition: "Ibuprofen 400mg",
    benefits: "Non-steroidal anti-inflammatory drug (NSAID) that reduces pain, inflammation, and fever. Effective for headaches, muscle aches, and joint pain.",
    description: "Ibugesic contains Ibuprofen 400mg, a proven NSAID for pain and inflammation relief. Manufactured by Cipla Ltd, it provides long-lasting relief from various types of pain including dental, muscular, and joint pain.",
    form: "tablet",
    wikiTitle: "Ibuprofen",
  },
  "nise": {
    manufacturer: "Dr. Reddy's Laboratories Ltd",
    brand: "Nise",
    composition: "Nimesulide 100mg",
    benefits: "Fast-acting pain and inflammation reliever. Particularly effective for acute pain, dental pain, and post-operative discomfort.",
    description: "Nise contains Nimesulide 100mg, a fast-acting NSAID that provides quick relief from pain and inflammation. Manufactured by Dr. Reddy's Laboratories, it is effective for acute pain conditions and has a favorable GI safety profile.",
    form: "tablet",
    wikiTitle: "Nimesulide",
  },
  "volini": {
    manufacturer: "Sun Pharmaceutical Industries Ltd",
    brand: "Volini",
    composition: "Diclofenac Diethylamine + Methyl Salicylate + Menthol",
    benefits: "Topical pain relief gel that penetrates deep into muscles and joints. Provides targeted relief from sprains, strains, and muscular pain.",
    description: "Volini is a topical analgesic gel manufactured by Sun Pharma. It combines Diclofenac with Menthol and Methyl Salicylate for dual-action relief — anti-inflammatory plus cooling sensation. Ideal for sports injuries and muscular pain.",
    form: "gel",
    wikiTitle: "Diclofenac",
  },
  "meftal": {
    manufacturer: "Blue Cross Laboratories Ltd",
    brand: "Meftal",
    composition: "Mefenamic Acid 500mg",
    benefits: "NSAID effective for menstrual pain (dysmenorrhea), mild to moderate pain, and inflammatory conditions.",
    description: "Meftal contains Mefenamic Acid from Blue Cross Labs. It is particularly effective for menstrual pain and provides analgesic and anti-inflammatory action for various painful conditions.",
    form: "tablet",
    wikiTitle: "Mefenamic_acid",
  },
  "coridil": {
    manufacturer: "Micro Labs Ltd",
    brand: "Coridil",
    composition: "Serratiopeptidase + Diclofenac",
    benefits: "Anti-inflammatory enzyme combination that reduces swelling and accelerates healing after surgery or injury.",
    description: "Coridil from Micro Labs combines Serratiopeptidase with Diclofenac. The proteolytic enzyme reduces swelling and bruising while the NSAID provides pain relief, making it ideal for post-surgical recovery.",
    form: "tablet",
    wikiTitle: "Diclofenac",
  },

  // ── Antibiotics ──
  "azee": {
    manufacturer: "Cipla Ltd",
    brand: "Azee",
    composition: "Azithromycin 250mg / 500mg",
    benefits: "Effective macrolide antibiotic for respiratory infections, skin infections, and sexually transmitted diseases. Short course therapy with once-daily dosing.",
    description: "Azee contains Azithromycin, a macrolide antibiotic from Cipla Ltd. It is effective against a wide range of bacterial infections with the advantage of short-course therapy (typically 3-5 days). High tissue concentration ensures sustained antibacterial action.",
    form: "tablet",
    wikiTitle: "Azithromycin",
  },
  "moex": {
    manufacturer: "Micro Labs Ltd",
    brand: "Moex",
    composition: "Amoxicillin 500mg",
    benefits: "Broad-spectrum antibiotic effective against common bacterial infections of the respiratory tract, urinary tract, and skin.",
    description: "Moex contains Amoxicillin 500mg, a broad-spectrum penicillin antibiotic. Manufactured by Micro Labs Ltd, it is effective against various bacterial infections including respiratory, urinary, and skin infections.",
    form: "capsule",
    wikiTitle: "Amoxicillin",
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
    wikiTitle: "Amoxicillin",
  },
  "azel": {
    manufacturer: "Dr. Reddy's Laboratories Ltd",
    brand: "Azel",
    composition: "Azithromycin 250mg",
    benefits: "Macrolide antibiotic for respiratory infections, skin infections. Short course therapy with excellent tissue penetration.",
    description: "Azel from Dr. Reddy's contains Azithromycin 250mg. It provides effective treatment for respiratory and skin infections with the advantage of a short 3-5 day course and once-daily dosing.",
    form: "tablet",
    wikiTitle: "Azithromycin",
  },
  "azithral": {
    manufacturer: "Alembic Pharmaceuticals Ltd",
    brand: "Azithral",
    composition: "Azithromycin 500mg",
    benefits: "Effective macrolide antibiotic for respiratory infections. High tissue concentration enables short 3-day course.",
    description: "Azithral from Alembic contains Azithromycin 500mg. It provides effective treatment for community-acquired pneumonia, bronchitis, and sinusitis with a convenient short course.",
    form: "tablet",
    wikiTitle: "Azithromycin",
  },
  "doxynord": {
    manufacturer: "Mankind Pharma Ltd",
    brand: "Doxynord",
    composition: "Doxycycline 100mg",
    benefits: "Tetracycline antibiotic for respiratory infections, acne, malaria prophylaxis, and tick-borne diseases.",
    description: "Doxynord from Mankind contains Doxycycline 100mg. It is a broad-spectrum tetracycline antibiotic effective against respiratory infections, acne, and for malaria prophylaxis in travelers.",
    form: "capsule",
    wikiTitle: "Doxycycline",
  },
  "zifi": {
    manufacturer: "FDC Ltd",
    brand: "Zifi",
    composition: "Cefixime 200mg",
    benefits: "Third-generation cephalosporin antibiotic effective against respiratory, urinary tract, and ENT infections.",
    description: "Zifi from FDC contains Cefixime 200mg, a third-generation cephalosporin antibiotic. It provides effective treatment for various bacterial infections with once-daily dosing convenience.",
    form: "tablet",
    wikiTitle: "Cefixime",
  },
  "taxim": {
    manufacturer: "Alkem Laboratories Ltd",
    brand: "Taxim",
    composition: "Cefixime 200mg",
    benefits: "Oral cephalosporin antibiotic for respiratory infections, UTI, and typhoid fever. Well-absorbed with excellent tissue penetration.",
    description: "Taxim from Alkem contains Cefixime 200mg. It provides effective oral treatment for respiratory and urinary tract infections with excellent bioavailability and tissue penetration.",
    form: "tablet",
    wikiTitle: "Cefixime",
  },
  "monocef": {
    manufacturer: "Aristo Pharmaceuticals Ltd",
    brand: "Monocef",
    composition: "Ceftriaxone 1g",
    benefits: "Third-generation injectable cephalosporin for severe bacterial infections including meningitis and septicemia.",
    description: "Monocef from Aristo contains Ceftriaxone, a potent injectable cephalosporin. It is used for severe hospital-acquired infections, meningitis, and septicemia with once-daily dosing.",
    form: "injection",
    wikiTitle: "Ceftriaxone",
  },

  // ── Gastric / Digestive ──
  "pan": {
    manufacturer: "Alkem Laboratories Ltd",
    brand: "Pan",
    composition: "Pantoprazole 40mg",
    benefits: "Proton pump inhibitor for long-lasting relief from gastroesophageal reflux disease (GERD), stomach ulcers, and acid-related disorders.",
    description: "Pan contains Pantoprazole 40mg, a proton pump inhibitor manufactured by Alkem Laboratories. It reduces stomach acid production and provides sustained relief from acid reflux, heartburn, and peptic ulcers.",
    form: "tablet",
    wikiTitle: "Pantoprazole",
  },
  "pan-D": {
    manufacturer: "Alkem Laboratories Ltd",
    brand: "Pan-D",
    composition: "Pantoprazole 40mg + Domperidone 30mg",
    benefits: "Combination of PPI and prokinetic for GERD with nausea. Reduces acid and improves gastric motility.",
    description: "Pan-D from Alkem combines Pantoprazole with Domperidone for comprehensive acid reflux management. The PPI reduces acid while Domperidone improves gastric motility, providing relief from reflux with nausea.",
    form: "tablet",
    wikiTitle: "Pantoprazole",
  },
  "omez": {
    manufacturer: "Dr. Reddy's Laboratories Ltd",
    brand: "Omez",
    composition: "Omeprazole 20mg",
    benefits: "Proton pump inhibitor that reduces stomach acid production. Provides relief from acid reflux, heartburn, and stomach ulcers.",
    description: "Omez contains Omeprazole 20mg, a proton pump inhibitor from Dr. Reddy's Laboratories. It effectively reduces gastric acid secretion, providing relief from GERD, peptic ulcers, and H. pylori eradication therapy.",
    form: "capsule",
    wikiTitle: "Omeprazole",
  },
  "ranid": {
    manufacturer: "Dr. Reddy's Laboratories Ltd",
    brand: "Ranid",
    composition: "Ranitidine 150mg",
    benefits: "H2 blocker that reduces stomach acid production for relief from heartburn and acid indigestion.",
    description: "Ranid contains Ranitidine 150mg, an H2 receptor antagonist from Dr. Reddy's. It reduces acid secretion by blocking histamine receptors in the stomach, providing relief from heartburn and peptic ulcers.",
    form: "tablet",
    wikiTitle: "Ranitidine",
  },
  "rabecee": {
    manufacturer: "Dr. Reddy's Laboratories Ltd",
    brand: "Rabecee",
    composition: "Rabeprazole 20mg",
    benefits: "Fast-acting proton pump inhibitor for acid reflux, peptic ulcers, and H. pylori eradication therapy.",
    description: "Rabecee contains Rabeprazole 20mg from Dr. Reddy's. It is a potent proton pump inhibitor that provides rapid acid suppression for GERD, peptic ulcers, and H. pylori eradication.",
    form: "tablet",
    wikiTitle: "Rabeprazole",
  },
  "dynewell": {
    manufacturer: "Alkem Laboratories Ltd",
    brand: "Dynewell",
    composition: "Dicyclomine 20mg",
    benefits: "Antispasmodic that relieves stomach cramps, bloating, and irritable bowel syndrome (IBS) symptoms.",
    description: "Dynewell contains Dicyclomine 20mg, an antispasmodic agent from Alkem. It relaxes smooth muscles of the gastrointestinal tract, providing relief from abdominal cramps and IBS symptoms.",
    form: "tablet",
    wikiTitle: "Dicyclomine",
  },
  "neopeptine": {
    manufacturer: "Abbott India Ltd",
    brand: "Neopeptine",
    composition: "Diastase + Pepsin + Fungal Diastase",
    benefits: "Digestive enzyme supplement that aids digestion and relieves indigestion, bloating, and flatulence.",
    description: "Neopeptine is a digestive enzyme combination from Abbott India. It contains multiple enzymes that help break down carbohydrates, proteins, and fats, providing relief from indigestion and improving nutrient absorption.",
    form: "drops",
  },
  "enterogermina": {
    manufacturer: "Sanofi India Ltd",
    brand: "Enterogermina",
    composition: "Bacillus clausii 2 Billion Spores",
    benefits: "Probiotic that restores healthy gut bacteria. Effective for diarrhea, antibiotic-associated gut issues, and digestive health.",
    description: "Enterogermina from Sanofi contains Bacillus clausii spores that colonize the gut and restore healthy intestinal flora. It is effective in managing diarrhea and antibiotic-associated digestive disturbances.",
    form: "sachet",
    wikiTitle: "Bacillus_clausii",
  },

  // ── Cardiovascular ──
  "atorva": {
    manufacturer: "Sun Pharmaceutical Industries Ltd",
    brand: "Atorva",
    composition: "Atorvastatin 10mg / 20mg / 40mg",
    benefits: "Statins help lower cholesterol levels and reduce the risk of heart attacks and strokes by blocking cholesterol production in the liver.",
    description: "Atorva contains Atorvastatin, a HMG-CoA reductase inhibitor from Sun Pharma. It lowers LDL cholesterol and triglycerides while raising HDL cholesterol, significantly reducing cardiovascular risk.",
    form: "tablet",
    wikiTitle: "Atorvastatin",
  },
  "stamlo": {
    manufacturer: "Dr. Reddy's Laboratories Ltd",
    brand: "Stamlo",
    composition: "Amlodipine 5mg / 10mg",
    benefits: "Calcium channel blocker that relaxes blood vessels to lower blood pressure and reduce chest pain (angina).",
    description: "Stamlo contains Amlodipine, a dihydropyridine calcium channel blocker from Dr. Reddy's. It provides 24-hour blood pressure control with once-daily dosing and is well-tolerated by most patients.",
    form: "tablet",
    wikiTitle: "Amlodipine",
  },
  "losar": {
    manufacturer: "Torrent Pharmaceuticals Ltd",
    brand: "Losar",
    composition: "Losartan 50mg / 100mg",
    benefits: "ARB (angiotensin receptor blocker) that lowers blood pressure and protects the kidneys in diabetic patients.",
    description: "Losar contains Losartan, an angiotensin II receptor blocker from Torrent Pharmaceuticals. It effectively lowers blood pressure while providing kidney-protective benefits, especially in diabetic patients.",
    form: "tablet",
    wikiTitle: "Losartan",
  },
  "telma": {
    manufacturer: "Glenmark Pharmaceuticals Ltd",
    brand: "Telma",
    composition: "Telmisartan 40mg / 80mg",
    benefits: "Long-acting ARB for blood pressure control with additional cardiovascular protective benefits.",
    description: "Telma contains Telmisartan from Glenmark. It is a long-acting angiotensin II receptor blocker that provides 24-hour blood pressure control with additional cardioprotective properties.",
    form: "tablet",
    wikiTitle: "Telmisartan",
  },
  "amlopress": {
    manufacturer: "Sun Pharmaceutical Industries Ltd",
    brand: "Amlopress",
    composition: "Amlodipine 5mg",
    benefits: "Calcium channel blocker for hypertension and angina. Provides smooth, gradual blood pressure reduction.",
    description: "Amlopress contains Amlodipine 5mg from Sun Pharma. It provides effective 24-hour blood pressure control with a smooth onset of action and minimal reflex tachycardia.",
    form: "tablet",
    wikiTitle: "Amlodipine",
  },
  "metoprolol": {
    manufacturer: "Various",
    brand: "Generic",
    composition: "Metoprolol Succinate 50mg / 100mg",
    benefits: "Beta-blocker that reduces heart rate and blood pressure. Also used for heart failure and chest pain management.",
    description: "Metoprolol is a cardioselective beta-blocker that reduces heart rate, blood pressure, and myocardial oxygen demand. It is widely used for hypertension, angina, heart failure, and post-myocardial infarction.",
    form: "tablet",
    wikiTitle: "Metoprolol",
  },

  // ── Diabetes ──
  "glycomet": {
    manufacturer: "USV Pvt Ltd",
    brand: "Glycomet",
    composition: "Metformin 500mg / 850mg",
    benefits: "First-line treatment for type 2 diabetes. Helps control blood sugar levels by improving insulin sensitivity. Supports healthy weight management.",
    description: "Glycomet contains Metformin, a biguanide antidiabetic from USV Pvt Ltd. It reduces hepatic glucose production and improves insulin sensitivity, making it the first-line therapy for type 2 diabetes worldwide.",
    form: "tablet",
    wikiTitle: "Metformin",
  },
  "glimepiride": {
    manufacturer: "Various",
    brand: "Generic",
    composition: "Glimepiride 1mg / 2mg / 4mg",
    benefits: "Stimulates insulin release from the pancreas to help control blood sugar levels in type 2 diabetes.",
    description: "Glimepiride is a sulfonylurea antidiabetic that stimulates insulin secretion from pancreatic beta cells. It is used as an adjunct to diet and exercise for glycemic control in type 2 diabetes.",
    form: "tablet",
    wikiTitle: "Glimepiride",
  },
  "tbel": {
    manufacturer: "Zydus Cadila",
    brand: "Tbel",
    composition: "Teneligliptin 20mg",
    benefits: "DPP-4 inhibitor that helps regulate blood sugar by increasing insulin production after meals.",
    description: "Tbel contains Teneligliptin from Zydus Cadila. It is a DPP-4 inhibitor that enhances incretin-mediated insulin secretion, providing effective glycemic control in type 2 diabetes.",
    form: "tablet",
    wikiTitle: "Teneligliptin",
  },
  "glyca": {
    manufacturer: "Sun Pharmaceutical Industries Ltd",
    brand: "Glyca",
    composition: "Gliclazide 80mg",
    benefits: "Sulfonylurea that stimulates insulin secretion to control blood sugar in type 2 diabetes.",
    description: "Glyca contains Gliclazide 80mg from Sun Pharma. It stimulates pancreatic insulin secretion and is effective for glycemic control in type 2 diabetes, particularly postprandial glucose.",
    form: "tablet",
    wikiTitle: "Gliclazide",
  },

  // ── Allergy & Cold ──
  "cetirizine": {
    manufacturer: "Cipla Ltd",
    brand: "Cetirizine",
    composition: "Cetirizine 10mg",
    benefits: "Non-drowsy antihistamine that provides 24-hour relief from allergic rhinitis, urticaria, and other allergy symptoms.",
    description: "Cetirizine is a second-generation antihistamine from Cipla that provides effective 24-hour relief from allergic conditions. It has minimal sedative effects compared to first-generation antihistamines.",
    form: "tablet",
    wikiTitle: "Cetirizine",
  },
  "zyrtec": {
    manufacturer: "Johnson & Johnson Ltd",
    brand: "Zyrtec",
    composition: "Cetirizine 10mg",
    benefits: "Premium non-drowsy antihistamine for effective 24-hour allergy relief. Provides relief from sneezing, runny nose, and itchy eyes.",
    description: "Zyrtec is a premium brand of Cetirizine from Johnson & Johnson. It provides reliable 24-hour relief from allergic rhinitis and chronic urticaria with minimal drowsiness.",
    form: "tablet",
    wikiTitle: "Cetirizine",
  },
  "allegra": {
    manufacturer: "Sanofi India Ltd",
    brand: "Allegra",
    composition: "Fexofenadine 120mg / 180mg",
    benefits: "Second-generation antihistamine that provides effective allergy relief without causing drowsiness.",
    description: "Allegra contains Fexofenadine from Sanofi India. It is a non-sedating antihistamine that provides effective relief from seasonal allergic rhinitis and chronic urticaria without causing drowsiness.",
    form: "tablet",
    wikiTitle: "Fexofenadine",
  },
  "sinarest": {
    manufacturer: "Micro Labs Ltd",
    brand: "Sinarest",
    composition: "Paracetamol + Phenylephrine + Chlorpheniramine",
    benefits: "Multi-symptom cold and flu relief. Addresses headache, fever, nasal congestion, and runny nose.",
    description: "Sinarest is a combination medicine from Micro Labs that provides comprehensive relief from cold and flu symptoms. It contains Paracetamol for pain/fever, Phenylephrine for nasal congestion, and Chlorpheniramine for runny nose.",
    form: "tablet",
    wikiTitle: "Paracetamol",
  },
  "montair": {
    manufacturer: "Cipla Ltd",
    brand: "Montair",
    composition: "Montelukast 10mg",
    benefits: "Leukotriene receptor blocker that prevents asthma attacks and relieves seasonal allergy symptoms.",
    description: "Montair contains Montelukast 10mg from Cipla. It blocks leukotriene receptors to prevent airway inflammation, making it effective for asthma prevention and allergy symptom relief.",
    form: "tablet",
    wikiTitle: "Montelukast",
  },
  "decolde": {
    manufacturer: "Abbott India Ltd",
    brand: "Decolde",
    composition: "Phenylephrine + Chlorpheniramine + Paracetamol",
    benefits: "Multi-ingredient cold remedy for nasal congestion, sneezing, runny nose, and headache associated with cold.",
    description: "Decolde from Abbott is a comprehensive cold medicine that combines a decongestant, antihistamine, and analgesic for effective relief from multiple cold and flu symptoms.",
    form: "tablet",
    wikiTitle: "Paracetamol",
  },
  "benadryl": {
    manufacturer: "Johnson & Johnson Ltd",
    brand: "Benadryl",
    composition: "Diphenhydramine 12.5mg",
    benefits: "Antihistamine for allergic symptoms including runny nose, sneezing, itchy eyes, and dry cough.",
    description: "Benadryl from Johnson & Johnson is a trusted antihistamine brand. It provides effective relief from allergy symptoms and dry cough. Available in syrup form for easy administration.",
    form: "syrup",
    wikiTitle: "Diphenhydramine",
  },
  "nasivion": {
    manufacturer: "Meda Pharmaceuticals India",
    brand: "Nasivion",
    composition: "Oxymetazoline 0.025% / 0.05%",
    benefits: "Nasal decongestant spray that provides rapid relief from nasal congestion due to cold, allergies, and sinusitis.",
    description: "Nasivion from Meda Pharmaceuticals is an oxymetazoline nasal spray that provides quick relief from nasal congestion by constricting blood vessels in the nasal passages.",
    form: "nasal drops",
    wikiTitle: "Oxymetazoline",
  },

  // ── Respiratory ──
  "asthalin": {
    manufacturer: "Cipla Ltd",
    brand: "Asthalin",
    composition: "Salbutamol 2mg / 4mg",
    benefits: "Fast-acting bronchodilator that relieves acute asthma attacks and breathing difficulties.",
    description: "Asthalin contains Salbutamol from Cipla, a fast-acting beta-2 agonist bronchodilator. It provides quick relief from acute asthma symptoms and bronchospasm by relaxing airway smooth muscles.",
    form: "tablet",
    wikiTitle: "Salbutamol",
  },
  "deriphyllin": {
    manufacturer: "Dr. Reddy's Laboratories Ltd",
    brand: "Deriphyllin",
    composition: "Theophylline 100mg / 150mg",
    benefits: "Bronchodilator used for chronic asthma and COPD. Opens airways to improve breathing.",
    description: "Deriphyllin contains Theophylline from Dr. Reddy's. It is a methylxanthine bronchodilator used for the maintenance treatment of chronic asthma and COPD, helping to keep airways open.",
    form: "tablet",
    wikiTitle: "Theophylline",
  },
  "pecto": {
    manufacturer: "Lupin Ltd",
    brand: "Pecto",
    composition: "Ambroxol + Terbutaline + Guaifenesin",
    benefits: "Combination cough syrup that loosens mucus, opens airways, and provides relief from productive cough.",
    description: "Pecto from Lupin is a mucolytic and bronchodilator combination. Ambroxol loosens mucus, Terbutaline opens airways, and Guaifenesin thins secretions for effective cough relief.",
    form: "syrup",
  },
  "vicks": {
    manufacturer: "Procter & Gamble Health Ltd",
    brand: "Vicks",
    composition: "Dextromethorphan + Menthol + Camphor",
    benefits: "Effective cough suppressant and throat relief for dry and productive coughs associated with cold.",
    description: "Vicks from P&G Health provides effective cough and cold relief. The combination of Dextromethorphan for cough suppression with Menthol and Camphor for throat soothing makes it a trusted household remedy.",
    form: "syrup",
    wikiTitle: "Dextromethorphan",
  },
  "strepsils": {
    manufacturer: "Hindustan Unilever Ltd",
    brand: "Strepsils",
    composition: "Amylmetacresol + Dichlorobenzyl Alcohol",
    benefits: "Antiseptic lozenges for sore throat, mouth, and throat infections. Provides symptomatic relief from throat pain.",
    description: "Strepsils from HUL contains dual antiseptic agents that fight bacteria in the mouth and throat. It provides effective relief from sore throat, mouth ulcers, and throat infections.",
    form: "lozenge",
  },

  // ── Skin & Topical ──
  "cloben-g": {
    manufacturer: "Glenmark Pharmaceuticals Ltd",
    brand: "Cloben-G",
    composition: "Clobetasol + Gentamicin + Miconazole",
    benefits: "Combination skin cream for fungal and bacterial skin infections with anti-inflammatory action.",
    description: "Cloben-G is a triple-action cream from Glenmark containing an antifungal, antibiotic, and corticosteroid. It effectively treats mixed skin infections including fungal infections with inflammation.",
    form: "cream",
    wikiTitle: "Clobetasol",
  },
  "deriva-ms": {
    manufacturer: "Abbott India Ltd",
    brand: "Deriva MS",
    composition: "Adapalene 0.1% + Benzoyl Peroxide 2.5%",
    benefits: "Effective acne treatment that unclogs pores, reduces inflammation, and kills acne-causing bacteria.",
    description: "Deriva MS from Abbott combines Adapalene and Benzoyl Peroxide for comprehensive acne treatment. It works by unclogging pores, reducing inflammation, and eliminating bacteria that cause acne.",
    form: "gel",
    wikiTitle: "Adapalene",
  },
  "aziderm": {
    manufacturer: "Micro Labs Ltd",
    brand: "Aziderm",
    composition: "Azelaic Acid 10% / 20%",
    benefits: "Topical treatment for acne and hyperpigmentation. Reduces inflammation and normalizes skin cell turnover.",
    description: "Aziderm contains Azelaic Acid from Micro Labs. It is effective for mild to moderate acne and hyperpigmentation by normalizing keratinization and reducing inflammation.",
    form: "cream",
    wikiTitle: "Azelaic_acid",
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
    wikiTitle: "Calcium_supplement",
  },
  "shelcal-500": {
    manufacturer: "Torrent Pharmaceuticals Ltd",
    brand: "Shelcal 500",
    composition: "Calcium Carbonate 500mg + Vitamin D3 250 IU",
    benefits: "High-dose calcium supplement for osteoporosis prevention and bone health. Enhanced with Vitamin D3 for better absorption.",
    description: "Shelcal 500 is a high-dose calcium supplement from Torrent Pharmaceuticals. It provides 500mg elemental calcium with Vitamin D3 for enhanced absorption, recommended for osteoporosis prevention and calcium deficiency.",
    form: "tablet",
    wikiTitle: "Calcium_supplement",
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

  // ── Gynecological ──
  "duphaston": {
    manufacturer: "Abbott India Ltd",
    brand: "Duphaston",
    composition: "Dydrogesterone 10mg",
    benefits: "Progesterone hormone supplement used for menstrual disorders, threatened miscarriage, and hormone replacement therapy.",
    description: "Duphaston contains Dydrogesterone from Abbott. It is a bio-identical progesterone used for various gynecological conditions including menstrual irregularities, threatened miscarriage, and luteal phase defects.",
    form: "tablet",
    wikiTitle: "Dydrogesterone",
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

  // ── Nutritional Supplements ──
  "ensure": {
    manufacturer: "Abbott India Ltd",
    brand: "Ensure",
    composition: "Complete Nutritional Shake",
    benefits: "Complete balanced nutrition for adults. Provides protein, vitamins, and minerals for overall health and recovery.",
    description: "Ensure from Abbott is a scientifically designed complete nutritional supplement. It provides balanced nutrition with protein, 28 vitamins and minerals, and is ideal for nutritional supplementation during recovery or as a meal replacement.",
    form: "powder",
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
  "duphaston": "Abbott India Ltd",
  "meftal": "Blue Cross Laboratories Ltd",
  "enterogermina": "Sanofi India Ltd",
  "nise": "Dr. Reddy's Laboratories Ltd",
  "volini": "Sun Pharmaceutical Industries Ltd",
  "asthalin": "Cipla Ltd",
  "deriphyllin": "Dr. Reddy's Laboratories Ltd",
  "telma": "Glenmark Pharmaceuticals Ltd",
  "losar": "Torrent Pharmaceuticals Ltd",
  "stamlo": "Dr. Reddy's Laboratories Ltd",
  "amlopress": "Sun Pharmaceutical Industries Ltd",
  "allegra": "Sanofi India Ltd",
  "zifi": "FDC Ltd",
  "taxim": "Alkem Laboratories Ltd",
  "monocef": "Aristo Pharmaceuticals Ltd",
  "strepsils": "Hindustan Unilever Ltd",
  "pecto": "Lupin Ltd",
  "coridil": "Micro Labs Ltd",
  "aziderm": "Micro Labs Ltd",
};

// ════════════════════════════════════════════════════════════════
// BENEFITS DATABASE (fallback for unknown products)
// ════════════════════════════════════════════════════════════════

const BENEFITS_DB: Record<string, string> = {
  "paracetamol": "Provides fast and effective relief from mild to moderate pain including headaches, body aches, and toothache. Reduces fever safely and is gentle on the stomach when used as directed.",
  "acetaminophen": "Provides fast and effective relief from mild to moderate pain including headaches, body aches, and toothache. Reduces fever safely and is gentle on the stomach when used as directed.",
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
  "cephalexin": "First-generation cephalosporin antibiotic effective against common skin, bone, urinary tract, and respiratory tract infections. Convenient oral dosing.",
  "cefuroxime": "Second-generation cephalosporin with broad-spectrum coverage effective against respiratory infections, urinary tract infections, skin infections, and Lyme disease.",
  "cefixime": "Third-generation oral cephalosporin with convenient once-daily dosing. Effective for respiratory tract infections, urinary tract infections, and ENT infections.",
  "ceftriaxone": "Potent injectable cephalosporin for severe hospital-acquired infections including meningitis, septicemia, and complicated intra-abdominal infections.",
  "metronidazole": "Effective against anaerobic bacteria and parasites. Used for dental infections, abdominal infections, surgical prophylaxis, and parasitic infections including amoebiasis.",
  "metformin": "First-line treatment for type 2 diabetes that reduces liver glucose production and improves insulin sensitivity. Helps control blood sugar and supports healthy weight management.",
  "glimepiride": "Stimulates insulin release from the pancreas to help control blood sugar levels. Effective for postprandial glucose management in type 2 diabetes.",
  "gliclazide": "Sulfonylurea that stimulates pancreatic insulin secretion to control blood sugar. Also has beneficial effects on blood flow and may reduce diabetic complications.",
  "teneligliptin": "DPP-4 inhibitor with long duration of action providing once-daily blood sugar control. Low risk of hypoglycemia and well-tolerated in type 2 diabetes.",
  "sitagliptin": "DPP-4 inhibitor that increases insulin production after meals to help regulate blood sugar. Well-tolerated with low risk of hypoglycemia.",
  "voglibose": "Alpha-glucosidase inhibitor that prevents blood sugar spikes after meals by slowing carbohydrate digestion. Effective for postprandial hyperglycemia.",
  "atorvastatin": "Lowers LDL cholesterol and triglycerides while raising HDL cholesterol. Significantly reduces the risk of heart attack, stroke, and cardiovascular events.",
  "rosuvastatin": "Highly potent statin providing significant cholesterol reduction at low doses. Effectively lowers LDL and raises HDL with minimal side effects.",
  "amlodipine": "Calcium channel blocker providing smooth, gradual blood pressure reduction with 24-hour control. Also effective for angina (chest pain) relief.",
  "losartan": "Lowers blood pressure by blocking angiotensin II receptors. Provides additional kidney-protective benefits, especially useful for patients with diabetes.",
  "telmisartan": "Long-acting ARB providing sustained 24-hour blood pressure control with additional cardiovascular protective and metabolic benefits.",
  "metoprolol": "Cardioselective beta-blocker that reduces heart rate and blood pressure. Also used for heart failure, angina, and after heart attack recovery.",
  "omeprazole": "Provides lasting relief from acid reflux, heartburn, and stomach ulcers. Also used in H. pylori eradication therapy for stomach ulcers.",
  "pantoprazole": "Long-acting proton pump inhibitor providing sustained acid suppression for GERD, erosive esophagitis, and stomach ulcers. Well-tolerated for long-term use.",
  "rabeprazole": "Fast-acting proton pump inhibitor with rapid acid suppression. Effective for GERD, peptic ulcers, and H. pylori eradication therapy.",
  "ranitidine": "H2 blocker that reduces stomach acid production for relief from heartburn, acid indigestion, and peptic ulcers.",
  "esomeprazole": "Enhanced proton pump inhibitor with superior acid suppression. Effective for GERD, erosive esophagitis, and healing duodenal ulcers.",
  "cetirizine": "Non-drowsy antihistamine providing 24-hour relief from allergic rhinitis, sneezing, runny nose, itchy eyes, and chronic urticaria (skin rashes).",
  "loratadine": "Non-drowsy antihistamine providing 24-hour relief from sneezing, runny nose, itchy eyes, and other allergy symptoms without causing drowsiness.",
  "fexofenadine": "Non-sedating antihistamine providing effective relief from seasonal allergies and chronic urticaria without causing drowsiness. Suitable for daytime use.",
  "levocetirizine": "Potent non-drowsy antihistamine effective at lower doses for chronic allergic rhinitis and chronic urticaria with minimal sedation.",
  "montelukast": "Prevents asthma attacks and relieves seasonal allergy symptoms by blocking leukotriene airway inflammation. Taken once daily for long-term management.",
  "diphenhydramine": "First-generation antihistamine providing relief from allergic symptoms, runny nose, sneezing, itchy eyes, dry cough, and mild sleep aid.",
  "phenylephrine": "Nasal decongestant that shrinks swollen nasal passages to relieve sinus pressure and stuffy nose due to colds and allergies.",
  "pseudoephedrine": "Effective oral decongestant for relieving sinus and nasal congestion associated with colds, flu, and allergies.",
  "salbutamol": "Fast-acting bronchodilator providing quick relief from acute asthma attacks and breathing difficulties within minutes of use.",
  "budesonide": "Inhaled corticosteroid that reduces airway inflammation to prevent asthma attacks with regular use. Also available as nasal spray for allergic rhinitis.",
  "levothyroxine": "Replaces thyroid hormone to treat hypothyroidism. Helps regulate metabolism, energy levels, body weight, and overall thyroid function.",
  "vitamin d": "Essential for calcium absorption, bone health, and immune system function. Helps prevent vitamin D deficiency and supports muscle function.",
  "vitamin b12": "Essential for nerve function, red blood cell formation, energy production, and brain health. Important for vegetarians, vegans, and the elderly.",
  "calcium": "Essential mineral for strong bones and teeth. Supports muscle function, nerve signaling, and helps prevent osteoporosis and fractures.",
  "iron": "Essential for making hemoglobin to carry oxygen in the blood. Prevents and treats iron-deficiency anemia, reducing fatigue and weakness.",
  "multivitamin": "Complete daily nutrition with essential vitamins and minerals. Supports immunity, energy production, and fills nutritional gaps in the diet.",
  "omega": "Essential fatty acids (EPA and DHA) that support heart health, brain function, eye health, and help reduce inflammation.",
  "theophylline": "Bronchodilator that opens airways for easier breathing. Used for long-term management of chronic asthma and COPD.",
  "dextromethorphan": "Effective cough suppressant that reduces the urge to cough. Suitable for dry, irritating coughs associated with colds and flu.",
  "oxybutynin": "Relaxes bladder muscles to reduce urinary frequency, urgency, and incontinence associated with overactive bladder.",
  "dydrogesterone": "Bio-identical progesterone used for menstrual irregularities, threatened miscarriage, premenstrual syndrome, and hormone replacement therapy.",
  "prednisolone": "Corticosteroid that reduces inflammation and suppresses the immune system. Effective for allergic conditions, asthma, arthritis, and autoimmune disorders.",
  "clobetasol": "Potent topical corticosteroid for severe inflammatory skin conditions including eczema, psoriasis, and dermatitis. Reduces redness, swelling, and itching.",
  "adapalene": "Retinoid-like compound for acne treatment. Unclogs pores, prevents new acne formation, and reduces inflammation and redness associated with acne.",
};

// ════════════════════════════════════════════════════════════════
// DESCRIPTIONS DATABASE (composition-based description fallback for unknown products)
// ════════════════════════════════════════════════════════════════

const DESCRIPTIONS_DB: Record<string, string> = {
  "paracetamol": "Paracetamol (Acetaminophen) is one of the most widely used over-the-counter medicines for pain relief and fever reduction. It works by blocking pain signals in the brain and regulating body temperature. It is gentle on the stomach and suitable for most adults and children over 12 years when taken as directed.",
  "ibuprofen": "Ibuprofen is a non-steroidal anti-inflammatory drug (NSAID) that provides effective relief from pain, swelling, and fever. It works by reducing the production of prostaglandins that cause inflammation. Suitable for headaches, dental pain, menstrual cramps, muscle aches, and joint pain.",
  "amoxicillin": "Amoxicillin is a widely prescribed broad-spectrum penicillin antibiotic used to treat a variety of bacterial infections. It works by inhibiting the growth of bacteria and is effective against infections of the respiratory tract, urinary tract, ear, nose, throat, and skin. Complete the full course as prescribed.",
  "azithromycin": "Azithromycin is a macrolide antibiotic effective against a wide range of bacterial infections. It works by stopping bacterial growth and is known for its convenient short-course therapy, typically requiring only 3 to 5 days of treatment. Effective for respiratory tract infections, skin infections, and ear infections.",
  "cetirizine": "Cetirizine is a second-generation antihistamine that provides effective 24-hour relief from allergy symptoms such as sneezing, runny nose, itchy eyes, and skin rashes. It works by blocking histamine receptors and causes minimal drowsiness compared to older antihistamines.",
  "metformin": "Metformin is the most widely prescribed first-line medication for type 2 diabetes. It works by reducing glucose production in the liver and improving the body's response to insulin. It helps maintain healthy blood sugar levels and may also support weight management.",
  "amlodipine": "Amlodipine is a calcium channel blocker used to treat high blood pressure (hypertension) and angina (chest pain). It works by relaxing blood vessels, allowing blood to flow more easily, which reduces the workload on the heart. Provides steady 24-hour blood pressure control with once-daily dosing.",
  "omeprazole": "Omeprazole is a proton pump inhibitor (PPI) that effectively reduces stomach acid production. It provides relief from conditions such as acid reflux (GERD), heartburn, stomach ulcers, and is also used as part of H. pylori eradication therapy. Take before meals for best results.",
  "pantoprazole": "Pantoprazole is a proton pump inhibitor that provides long-lasting relief from excess stomach acid. It is used to treat GERD, erosive esophagitis, stomach ulcers, and Zollinger-Ellison syndrome. It works by blocking the enzyme responsible for acid secretion in the stomach lining.",
  "atorvastatin": "Atorvastatin is a statin medication that effectively lowers LDL (bad) cholesterol and triglycerides while raising HDL (good) cholesterol. It works by blocking an enzyme in the liver responsible for cholesterol production. It significantly reduces the risk of heart attack and stroke in at-risk patients.",
  "losartan": "Losartan is an angiotensin II receptor blocker (ARB) used to treat high blood pressure. It works by relaxing blood vessels, which lowers blood pressure and improves blood flow. It also provides kidney-protective benefits, making it especially useful for patients with diabetes-related high blood pressure.",
  "telmisartan": "Telmisartan is a long-acting angiotensin II receptor blocker (ARB) that provides sustained 24-hour blood pressure control. It works by blocking the action of angiotensin II, a chemical that narrows blood vessels. It also offers additional cardiovascular protective benefits beyond blood pressure lowering.",
  "dolo": "Dolo 650 contains Paracetamol 650mg and is one of the most trusted antipyretic and analgesic medicines in India. Manufactured by Micro Labs Ltd, it provides fast and effective relief from fever and mild to moderate pain. It is suitable for adults and children above 12 years when taken as directed.",
  "crocin": "Crocin is a trusted paracetamol brand from GlaxoSmithKline, available in 500mg and 650mg strengths. It provides fast and effective relief from pain and fever. Widely recommended by doctors across India for its proven efficacy, safety profile, and gentle action on the stomach.",
  "combiflam": "Combiflam combines Ibuprofen 400mg and Paracetamol 325mg for dual-action pain relief. The anti-inflammatory component addresses the source of pain while paracetamol reduces fever. Manufactured by Sanofi India, it is one of India's most popular over-the-counter pain relievers for headaches, dental pain, and menstrual cramps.",
  "shelcal": "Shelcal is a calcium and Vitamin D3 supplement from Torrent Pharmaceuticals. It provides essential calcium along with Vitamin D3 for enhanced absorption, supporting bone health, muscle function, and helping prevent osteoporosis. Recommended for patients with calcium and vitamin D deficiency.",
  "becosules": "Becosules from Pfizer is a comprehensive Vitamin B Complex with Vitamin C. It supports energy metabolism, nerve function, red blood cell formation, and immune health. Widely recommended for fatigue, nutritional deficiencies, mouth ulcers, and general weakness.",
  "glycomet": "Glycomet contains Metformin from USV Pvt Ltd and is a first-line treatment for type 2 diabetes. It reduces hepatic glucose production and improves insulin sensitivity, helping maintain healthy blood sugar levels. It is the most widely prescribed oral antidiabetic medication worldwide.",
  "clobetasol": "Clobetasol is a potent corticosteroid used to treat severe inflammatory skin conditions such as eczema, psoriasis, and dermatitis. It works by reducing redness, swelling, and itching. For external use only and should be used as directed by your dermatologist.",
  "adapalene": "Adapalene is a retinoid-like compound used for the treatment of acne. It works by promoting skin cell turnover and preventing clogged pores. It also has anti-inflammatory properties that help reduce the redness and swelling associated with acne.",
  "salbutamol": "Salbutamol is a fast-acting bronchodilator used to relieve acute symptoms of asthma and chronic obstructive pulmonary disease (COPD). It works by relaxing the muscles around the airways, allowing them to open and making breathing easier. Effects typically begin within minutes.",
  "montelukast": "Montelukast is a leukotriene receptor antagonist used to prevent asthma attacks and relieve seasonal allergy symptoms. It works by blocking leukotriene, a chemical in the body that causes airway inflammation and narrowing. It is taken once daily for long-term asthma and allergy management.",
  "ranitidine": "Ranitidine is an H2 receptor antagonist that reduces stomach acid production. It provides relief from heartburn, acid indigestion, and helps heal peptic ulcers. It works by blocking histamine receptors in the stomach lining, thereby reducing acid secretion.",
  "rabeprazole": "Rabeprazole is a proton pump inhibitor that provides rapid and effective suppression of stomach acid. It is used to treat GERD, peptic ulcers, and as part of H. pylori eradication therapy. It offers faster onset of action compared to some other PPIs.",
  "fexofenadine": "Fexofenadine is a non-sedating antihistamine that provides effective relief from seasonal allergic rhinitis and chronic urticaria. It works by blocking histamine receptors without causing drowsiness, making it suitable for use during the day. Available in 120mg and 180mg strengths.",
  "cefuroxime": "Cefuroxime is a second-generation cephalosporin antibiotic used to treat respiratory tract infections, urinary tract infections, skin infections, and Lyme disease. It works by inhibiting bacterial cell wall synthesis. It offers broad-spectrum coverage against common bacterial pathogens.",
  "cefixime": "Cefixime is a third-generation oral cephalosporin antibiotic effective against a wide range of bacterial infections. It provides convenient once-daily dosing for respiratory tract infections, urinary tract infections, and ENT infections. It has good stability against beta-lactamase-producing bacteria.",
  "ceftriaxone": "Ceftriaxone is a potent third-generation injectable cephalosporin antibiotic used for severe bacterial infections including meningitis, septicemia, and complicated intra-abdominal infections. It provides broad-spectrum coverage and once-daily dosing convenience for hospital-based treatment.",
  "metronidazole": "Metronidazole is an antibiotic and antiprotozoal agent effective against anaerobic bacteria and certain parasites. It is used to treat dental infections, abdominal infections, surgical prophylaxis, and certain parasitic infections including amoebiasis and giardiasis.",
  "glimepiride": "Glimepiride is a sulfonylurea antidiabetic that stimulates insulin secretion from pancreatic beta cells. It is used as an adjunct to diet and exercise for glycemic control in type 2 diabetes. It provides effective postprandial blood sugar management.",
  "gliclazide": "Gliclazide is a sulfonylurea antidiabetic that stimulates the pancreas to release more insulin. It helps control blood sugar levels in type 2 diabetes, particularly after meals. It also has beneficial effects on blood flow and may reduce the risk of diabetic complications.",
  "teneligliptin": "Teneligliptin is a DPP-4 inhibitor that helps regulate blood sugar by enhancing incretin-mediated insulin secretion. It provides effective glycemic control in type 2 diabetes with once-daily dosing. It has a long duration of action and is well-tolerated with a low risk of hypoglycemia.",
  "rosuvastatin": "Rosuvastatin is a highly effective statin that lowers LDL cholesterol and triglycerides while raising HDL cholesterol. It provides potent cardiovascular risk reduction and is available in low-dose strengths that offer significant cholesterol-lowering with minimal side effects.",
  "levothyroxine": "Levothyroxine is a synthetic thyroid hormone used to treat hypothyroidism (underactive thyroid). It works by replacing the thyroid hormone that the thyroid gland is not producing enough of, helping to regulate metabolism, energy levels, and body weight.",
  "prednisolone": "Prednisolone is a corticosteroid used to treat a wide range of inflammatory and autoimmune conditions. It works by suppressing the immune system and reducing inflammation. It is used for allergic conditions, asthma, arthritis, and various skin and eye conditions.",
  "diclofenac": "Diclofenac is a non-steroidal anti-inflammatory drug (NSAID) that provides effective relief from pain and inflammation. It is available in oral, topical, and injectable forms and is widely used for arthritis, joint pain, back pain, dental pain, and post-surgical pain relief.",
  "naproxen": "Naproxen is a long-acting NSAID that provides sustained relief from pain and inflammation. It is particularly effective for arthritis, menstrual cramps, musculoskeletal conditions, and gout. Its longer duration of action means fewer doses per day compared to other NSAIDs.",
  "nimesulide": "Nimesulide is a fast-acting NSAID that provides quick relief from pain and inflammation. It is particularly effective for acute pain conditions such as dental pain, post-operative pain, and menstrual cramps. It has a rapid onset of action compared to many other NSAIDs.",
  "aceclofenac": "Aceclofenac is a modern NSAID with effective pain-relieving and anti-inflammatory properties. It has a favorable gastrointestinal safety profile compared to older NSAIDs. It is widely used for osteoarthritis, rheumatoid arthritis, ankylosing spondylitis, and musculoskeletal pain.",
  "mefenamic acid": "Mefenamic acid is an NSAID particularly effective for menstrual pain (dysmenorrhea). It also provides relief from mild to moderate pain and inflammatory conditions. It works by reducing prostaglandin production, thereby reducing pain and inflammation.",
  "ciprofloxacin": "Ciprofloxacin is a fluoroquinolone antibiotic effective against a wide range of bacterial infections. It is commonly used for urinary tract infections, respiratory infections, and gastrointestinal infections. It works by inhibiting bacterial DNA replication.",
  "doxycycline": "Doxycycline is a broad-spectrum tetracycline antibiotic effective against respiratory infections, acne, malaria prophylaxis, and tick-borne diseases. It is also used for sexually transmitted infections and periodontal disease. Take with plenty of water and avoid prolonged sun exposure.",
  "levofloxacin": "Levofloxacin is an advanced fluoroquinolone antibiotic effective against respiratory infections, urinary tract infections, and complicated skin infections. It provides enhanced gram-positive coverage compared to earlier fluoroquinolones and is available in once-daily dosing.",
  "cephalexin": "Cephalexin is a first-generation cephalosporin antibiotic effective against common bacterial infections of the skin, bone, urinary tract, and respiratory tract. It works by inhibiting bacterial cell wall synthesis and is well-tolerated with convenient oral dosing.",
  "phenylephrine": "Phenylephrine is a nasal decongestant that provides temporary relief from sinus pressure and nasal congestion due to colds, flu, allergies, or sinusitis. It works by shrinking swollen blood vessels in the nasal passages, allowing easier breathing.",
  "loratadine": "Loratadine is a non-drowsy antihistamine that provides 24-hour relief from symptoms of allergic rhinitis and chronic urticaria. It effectively relieves sneezing, runny nose, itchy eyes, and skin rashes without causing significant drowsiness.",
  "levocetirizine": "Levocetirizine is the active enantiomer of cetirizine, providing potent antihistamine action for chronic allergic conditions. It provides effective relief from allergic rhinitis and chronic urticaria with minimal sedation. It is effective at lower doses compared to cetirizine.",
  "budesonide": "Budesonide is an inhaled corticosteroid used for the long-term management of asthma. It works by reducing airway inflammation and preventing asthma attacks with regular use. It is also available in nasal spray form for allergic rhinitis.",
  "theophylline": "Theophylline is a methylxanthine bronchodilator used for the maintenance treatment of chronic asthma and COPD. It works by relaxing the smooth muscles of the airways, helping to keep them open and improve breathing. Regular monitoring of blood levels is recommended.",
  "diphenhydramine": "Diphenhydramine is a first-generation antihistamine used for allergic symptoms including runny nose, sneezing, itchy eyes, and dry cough. It also has mild sedative properties and is used as a sleep aid. Available in syrup form for children and adults.",
  "vitamin d": "Vitamin D3 is essential for calcium absorption and bone health. It supports the immune system, muscle function, and overall well-being. Supplementation is particularly important for individuals with limited sun exposure or those at risk of vitamin D deficiency.",
  "vitamin b12": "Vitamin B12 is essential for nerve function, red blood cell formation, and DNA synthesis. Deficiency can cause fatigue, weakness, and neurological symptoms. Supplementation is important for vegetarians, vegans, elderly individuals, and those with absorption issues.",
  "calcium": "Calcium is an essential mineral for strong bones and teeth. It also supports muscle function, nerve signaling, and blood clotting. Adequate calcium intake helps prevent osteoporosis and fractures, especially in women and older adults.",
  "iron": "Iron is essential for making hemoglobin, the protein in red blood cells that carries oxygen throughout the body. Iron supplementation is important for preventing and treating iron-deficiency anemia, which can cause fatigue, weakness, and reduced immunity.",
  "multivitamin": "A comprehensive multivitamin and multimineral supplement provides essential nutrients needed for daily health and wellness. It supports immunity, energy production, and overall body function. Suitable for adults seeking to fill nutritional gaps in their diet.",
};

// ════════════════════════════════════════════════════════════════
// WIKIPEDIA IMAGE LOOKUP
// Maps composition names → Wikipedia article titles for image fetching
// ════════════════════════════════════════════════════════════════

const WIKI_COMPOSITION_MAP: Record<string, string> = {
  "paracetamol": "Paracetamol",
  "acetaminophen": "Paracetamol",
  "ibuprofen": "Ibuprofen",
  "azithromycin": "Azithromycin",
  "metformin": "Metformin",
  "cetirizine": "Cetirizine",
  "amlodipine": "Amlodipine",
  "losartan": "Losartan",
  "atorvastatin": "Atorvastatin",
  "pantoprazole": "Pantoprazole",
  "salbutamol": "Salbutamol",
  "diclofenac": "Diclofenac",
  "amoxicillin": "Amoxicillin",
  "cefixime": "Cefixime",
  "ceftriaxone": "Ceftriaxone",
  "diphenhydramine": "Diphenhydramine",
  "dextromethorphan": "Dextromethorphan",
  "omeprazole": "Omeprazole",
  "montelukast": "Montelukast",
  "fexofenadine": "Fexofenadine",
  "telmisartan": "Telmisartan",
  "glimepiride": "Glimepiride",
  "gliclazide": "Gliclazide",
  "theophylline": "Theophylline",
  "nimesulide": "Nimesulide",
  "clobetasol": "Clobetasol",
  "adapalene": "Adapalene",
  "azelaic acid": "Azelaic_acid",
  "calcium carbonate": "Calcium_supplement",
  "vitamin d3": "Cholecalciferol",
  "doxycycline": "Doxycycline",
  "rabeprazole": "Rabeprazole",
  "ranitidine": "Ranitidine",
  "dydrogesterone": "Dydrogesterone",
  "mefenamic acid": "Mefenamic_acid",
  "teneligliptin": "Teneligliptin",
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
  // Form-specific fallback — more specific and informative
  const f = form.toLowerCase();
  if (["tablet", "capsule"].includes(f))
    return "Convenient oral dosage form for easy administration. Take as prescribed by your healthcare provider with water, preferably after meals unless directed otherwise.";
  if (["syrup", "suspension"].includes(f))
    return "Easy-to-administer liquid formulation, ideal for children and adults who have difficulty swallowing tablets. Shake well before use and measure the dose accurately.";
  if (["cream", "gel", "ointment", "lotion"].includes(f))
    return "Topical formulation for targeted relief directly at the site of pain or inflammation. Apply a thin layer to the affected area as directed. For external use only.";
  if (f === "drops")
    return "Precise liquid drop formulation for targeted application. Easy to administer with accurate dosing for effective local treatment.";
  if (f === "injection")
    return "Fast-acting injectable formulation for rapid therapeutic effect when oral administration is not suitable. Administered by a healthcare professional.";
  if (f === "inhaler")
    return "Inhaled medication that delivers medicine directly to the lungs for fast and targeted relief of respiratory conditions. Breathe in slowly and deeply for best results.";
  if (f === "nasal drops" || f === "nasal")
    return "Nasal formulation for direct application to the nasal passages. Provides targeted relief from nasal congestion, sinus pressure, and related symptoms.";
  if (f === "powder" || f === "sachet")
    return "Dissolvable powder or sachet formulation for easy mixing with water. Suitable for patients who prefer not to swallow tablets.";
  if (f === "lozenge")
    return "Slow-dissolving lozenge that releases medicine gradually in the mouth and throat for targeted local relief.";
  return null;
}


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
 * Check if an image URL is a chemical structure SVG or diagram (not a product photo).
 */
function isChemicalStructure(url: string): boolean {
  const lower = url.toLowerCase();
  // SVG chemical structures from Wikipedia
  if (lower.endsWith(".svg") || lower.includes("skeletal")) return true;
  // Known chemical diagram patterns
  if (lower.includes("structure") && lower.includes("svg")) return true;
  // Wikimedia thumb URLs ending in SVG
  if (lower.includes(".svg/") || lower.includes(".svg?")) return true;
  return false;
}

/**
 * Check if a Wikimedia file title looks like a product photo vs a chemical diagram.
 */
function isGoodImageTitle(title: string): boolean {
  const lower = title.toLowerCase();
  // Skip chemical structure diagrams
  const badPatterns = [
    "skeletal", "structure", "chemistry", "molecule", "crystal",
    "synthesis", "metabolism", "pathway", "mechanism", "reaction",
    "formula", "diagram", "sketch", "class", "logo", "icon",
    "commons", "edit", "symbol", "who", ".svg", ".wav",
    "pd-icon", "oojs", "ambox", "text-", "padlock",
  ];
  if (badPatterns.some(p => lower.includes(p))) return false;
  // Must be an actual image file
  if (!lower.match(/\.(jpg|jpeg|png|gif|webp)/)) return false;
  return true;
}

/**
 * Fetch product image from free sources.
 * Strategy (in order):
 * 1. Wikimedia Commons search with exact product name
 * 2. Wikipedia page images for composition (reject chemical structures)
 * 3. Wikimedia Commons search with composition
 * Returns null if nothing useful found.
 */
async function fetchFreeImage(productName: string, composition: string): Promise<string | null> {
  // ── Strategy 1: Wikimedia Commons search with exact product name ──
  try {
    const searchQuery = encodeURIComponent(`${productName} medicine`);
    const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${searchQuery}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      const pages = data?.query?.pages;
      if (pages) {
        for (const page of Object.values(pages) as any[]) {
          const title = page?.title || "";
          if (!isGoodImageTitle(title)) continue;
          const ii = page?.imageinfo;
          if (ii && ii[0]?.thumburl && !isChemicalStructure(ii[0].thumburl)) {
            return ii[0].thumburl;
          }
        }
      }
    }
  } catch { /* continue */ }

  // ── Strategy 2: Wikipedia pageimages for composition ──
  const lowerComp = composition.toLowerCase();
  let wikiTitle: string | null = null;
  for (const [key, title] of Object.entries(WIKI_COMPOSITION_MAP)) {
    if (lowerComp.includes(key)) {
      wikiTitle = title;
      break;
    }
  }

  if (wikiTitle) {
    // 2a: Try pageimages API first
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(wikiTitle)}&prop=pageimages&format=json&pithumbsize=500`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const pages = data?.query?.pages;
        if (pages) {
          const page = Object.values(pages)[0] as any;
          const src = page?.thumbnail?.source?.split("?")[0] || "";
          if (src && !isChemicalStructure(src)) return src;
        }
      }
    } catch { /* continue */ }

    // 2b: Try prop=images API (get all images on article page)
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(wikiTitle)}&prop=images&format=json&imlimit=20`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const pages = data?.query?.pages;
        if (pages) {
          const page = Object.values(pages)[0] as any;
          const images = page?.images || [];
          for (const img of images) {
            const title: string = img?.title || "";
            if (!isGoodImageTitle(title)) continue;
            const imgUrl = await getWikipediaFileUrl(title);
            if (imgUrl && !isChemicalStructure(imgUrl)) return imgUrl;
          }
        }
      }
    } catch { /* continue */ }
  }

  // ── Strategy 3: Wikimedia Commons search with composition ──
  if (wikiTitle) {
    try {
      const searchQuery = encodeURIComponent(`${wikiTitle} drug tablet medicine`);
      const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${searchQuery}&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=400&format=json&origin=*`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        const pages = data?.query?.pages;
        if (pages) {
          for (const page of Object.values(pages) as any[]) {
            const title = page?.title || "";
            if (!isGoodImageTitle(title)) continue;
            const ii = page?.imageinfo;
            if (ii && ii[0]?.thumburl && !isChemicalStructure(ii[0].thumburl)) {
              return ii[0].thumburl;
            }
          }
        }
      }
    } catch { /* continue */ }
  }

  return null;
}

/**
 * Get the actual URL for a Wikipedia File: page
 */
async function getWikipediaFileUrl(fileTitle: string): Promise<string | null> {
  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url&iiurlwidth=500&format=json`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      const pages = data?.query?.pages;
      if (pages) {
        const page = Object.values(pages)[0] as any;
        if (page?.imageinfo?.[0]?.thumburl) return page.imageinfo[0].thumburl;
        if (page?.imageinfo?.[0]?.url) return page.imageinfo[0].url;
      }
    }
  } catch {
    // Continue
  }
  return null;
}

/**
 * Generate a professional placeholder image with the product name.
 */
function generatePlaceholderImage(productName: string): string {
  const initials = productName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
  const shortName = productName.length > 24 ? productName.slice(0, 24) + "…" : productName;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#e8f4f8"/>
        <stop offset="100%" style="stop-color:#d1ecf1"/>
      </linearGradient>
    </defs>
    <rect width="200" height="200" rx="16" fill="url(#bg)"/>
    <circle cx="100" cy="75" r="28" fill="#0891b2" opacity="0.15"/>
    <path d="M88 75h24M100 63v24" stroke="#0891b2" stroke-width="3" stroke-linecap="round"/>
    <text x="100" y="130" font-family="system-ui,-apple-system,sans-serif" font-size="12" font-weight="600" fill="#0e7490" text-anchor="middle">${initials}</text>
    <text x="100" y="155" font-family="system-ui,-apple-system,sans-serif" font-size="10" fill="#64748b" text-anchor="middle">${encodeURIComponent(shortName)}</text>
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
    const imageUrl = await fetchFreeImage(args.productName, args.brand || args.productName);
    if (imageUrl) {
      return { success: true, imageUrl, reason: null };
    }
    // Return placeholder
    const placeholder = generatePlaceholderImage(args.productName);
    return { success: true, imageUrl: placeholder, reason: "Using generated placeholder" };
  },
});

/**
 * Full product enrichment using local database + free Wikipedia image sources.
 * Returns: imageUrl, manufacturer, benefits, description, consumeType, composition, expiryDate.
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
      expiryDate: string | null;
    } = {
      imageUrl: null,
      manufacturer: null,
      benefits: null,
      description: null,
      consumeType: null,
      composition: null,
      expiryDate: null,
    };

    // 1. Try comprehensive local database match
    const matched = matchMedicine(args.productName);
    if (matched) {
      result.manufacturer = matched.manufacturer;
      result.benefits = matched.benefits;
      result.description = matched.description;
      result.composition = matched.composition;
      // Expiry date: batch-specific dates are not available from free APIs.
      // Only use if the medicine DB has an actual date. Never calculate from entry date.
      result.expiryDate = matched.expiryDate || null;

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

      // 4. Description: try composition-based descriptions DB first, then generate
      const descFromDb = getDescriptionForComposition(args.composition || args.productName);
      if (descFromDb) {
        result.description = descFromDb;
      } else {
        const parts: string[] = [];
        parts.push(`${args.productName} is a medication${result.manufacturer ? ` manufactured by ${result.manufacturer}` : ""}.`);
        if (args.composition) parts.push(`It contains ${args.composition}.`);
        if (args.form) parts.push(`Available as ${args.form}.`);
        parts.push("Consult your healthcare provider for proper dosage and usage instructions.");
        result.description = parts.join(" ");
      }

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

    // 6. Image: try free sources (Commons + Wikipedia)
    const composition = result.composition || args.composition || args.productName;
    const imageUrl = await fetchFreeImage(args.productName, composition);
    result.imageUrl = imageUrl || generatePlaceholderImage(args.productName);

    return result;
  },
});
