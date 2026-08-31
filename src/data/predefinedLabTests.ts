/**
 * Predefined category-specific lab tests.
 * This is the single source of truth for what tests belong to each category.
 * Admin sees these when selecting a category. Customer sees active ones.
 */

export interface PredefinedTest {
  name: string;
  description: string;
}

export interface PredefinedCategory {
  slug: string;
  name: string;
  description: string;
  tests: PredefinedTest[];
}

export const PREDEFINED_LAB_TESTS: PredefinedCategory[] = [
  {
    slug: "full-body",
    name: "Full Body Checkup",
    description: "Comprehensive health checkups covering all major organ systems.",
    tests: [
      { name: "Complete Blood Count (CBC)", description: "Measures red blood cells, white blood cells, haemoglobin, and platelets." },
      { name: "Lipid Profile", description: "Measures total cholesterol, HDL, LDL, triglycerides, and VLDL." },
      { name: "Liver Function Test (LFT)", description: "Evaluates liver enzymes SGOT, SGPT, ALP, bilirubin, and protein levels." },
      { name: "Kidney Function Test (KFT)", description: "Measures creatinine, blood urea, BUN, and eGFR to assess kidney health." },
      { name: "Thyroid Profile (TSH, T3, T4)", description: "Screens for thyroid disorders by measuring TSH, free T3, and free T4." },
      { name: "HbA1c", description: "Shows average blood glucose levels over the previous 2–3 months." },
      { name: "Fasting Blood Sugar", description: "Measures blood glucose after an overnight fast." },
      { name: "Urine Routine Examination", description: "Analyses urine for colour, specific gravity, protein, sugar, and infection markers." },
      { name: "Vitamin D (25-OH)", description: "Measures 25-hydroxyvitamin D level to assess Vitamin D status." },
      { name: "Vitamin B12", description: "Measures Vitamin B12 level to detect deficiency or pernicious anaemia." },
      { name: "Iron Studies", description: "Measures serum iron, TIBC, ferritin, and transferrin saturation." },
      { name: "Calcium", description: "Measures total serum calcium for bone and parathyroid health." },
    ],
  },
  {
    slug: "diabetes",
    name: "Diabetes",
    description: "Tests to screen, monitor, and manage diabetes and pre-diabetic conditions.",
    tests: [
      { name: "Fasting Blood Sugar (FBS)", description: "Measures blood glucose after an overnight fast (8–12 hours)." },
      { name: "Post-Prandial Blood Sugar (PPBS)", description: "Measures blood glucose 2 hours after a meal." },
      { name: "HbA1c (Glycated Haemoglobin)", description: "Shows average blood glucose over the past 2–3 months." },
      { name: "Urine Sugar", description: "Detects the presence of glucose in urine, indicating possible uncontrolled diabetes." },
      { name: "Urine Microalbumin", description: "Detects small amounts of albumin in urine, an early sign of diabetic kidney disease." },
      { name: "Insulin Fasting", description: "Measures fasting insulin to assess insulin resistance or deficiency." },
      { name: "C-Peptide", description: "Indicates how much insulin the pancreas is producing naturally." },
    ],
  },
  {
    slug: "heart",
    name: "Heart",
    description: "Cardiac screening to assess heart health and cardiovascular risk factors.",
    tests: [
      { name: "Lipid Profile", description: "Measures total cholesterol, HDL, LDL, triglycerides, and VLDL." },
      { name: "hs-CRP (High-Sensitivity C-Reactive Protein)", description: "Detects low-level inflammation linked to heart disease risk." },
      { name: "Troponin I", description: "A sensitive marker for heart muscle damage, used to rule out heart attack." },
      { name: "BNP (Brain Natriuretic Peptide)", description: "Detects heart failure and assesses its severity." },
      { name: "CK-MB (Creatine Kinase-MB)", description: "An enzyme marker that rises when heart muscle is damaged." },
      { name: "Homocysteine", description: "High levels are associated with increased cardiovascular disease risk." },
      { name: "Lp(a) – Lipoprotein(a)", description: "A genetic risk factor for atherosclerosis and heart disease." },
      { name: "Apolipoprotein B (ApoB)", description: "Measures the total number of atherogenic particles, a better predictor than LDL." },
    ],
  },
  {
    slug: "blood",
    name: "Blood Studies",
    description: "Comprehensive blood analysis for overall health assessment.",
    tests: [
      { name: "Complete Blood Count (CBC)", description: "Measures RBC, WBC, haemoglobin, haematocrit, platelets, and differential count." },
      { name: "Erythrocyte Sedimentation Rate (ESR)", description: "Detects inflammation or infection in the body." },
      { name: "Peripheral Blood Smear", description: "Microscopic examination of blood cells to detect abnormalities." },
      { name: "Blood Grouping & Rh Typing", description: "Determines ABO blood group and Rh factor." },
      { name: "Reticulocyte Count", description: "Measures young red blood cells to evaluate bone marrow activity." },
      { name: "Haemoglobin Electrophoresis", description: "Detects haemoglobin variants such as sickle cell and thalassaemia." },
    ],
  },
  {
    slug: "vitamin",
    name: "Vitamin",
    description: "Assess vitamin levels to detect deficiencies affecting overall health.",
    tests: [
      { name: "Vitamin D (25-OH)", description: "Measures 25-hydroxyvitamin D to assess bone and immune health." },
      { name: "Vitamin B12", description: "Measures B12 level to detect deficiency, fatigue, and neuropathy risk." },
      { name: "Vitamin B12 Active (Holotranscobalamin)", description: "The most accurate early indicator of Vitamin B12 deficiency." },
      { name: "Vitamin D3", description: "Measures the active form of Vitamin D3 in the blood." },
      { name: "Vitamin B9 (Folic Acid)", description: "Measures folate level, essential for cell growth and pregnancy health." },
      { name: "Vitamin A", description: "Assesses Vitamin A status for vision and immune function." },
      { name: "Vitamin C", description: "Measures ascorbic acid level for immune health and antioxidant status." },
      { name: "Vitamin E", description: "Evaluates Vitamin E level, an important antioxidant for cell protection." },
    ],
  },
  {
    slug: "thyroid",
    name: "Thyroid",
    description: "Evaluate thyroid gland function and detect thyroid disorders.",
    tests: [
      { name: "TSH (Thyroid Stimulating Hormone)", description: "The primary screening test for thyroid disorders." },
      { name: "Free T3 (Triiodothyronine)", description: "Measures the active thyroid hormone for hyperthyroidism assessment." },
      { name: "Free T4 (Thyroxine)", description: "Measures the main thyroid hormone produced by the thyroid gland." },
      { name: "Anti-TPO Antibodies", description: "Detects autoimmune thyroid conditions like Hashimoto's thyroiditis." },
      { name: "Thyroglobulin", description: "Used to monitor thyroid cancer treatment and thyroid function." },
    ],
  },
  {
    slug: "kidney",
    name: "Kidney",
    description: "Assess kidney function and detect early signs of kidney disease.",
    tests: [
      { name: "Serum Creatinine", description: "Measures creatinine level to evaluate kidney filtration function." },
      { name: "Blood Urea Nitrogen (BUN)", description: "Measures urea nitrogen in blood to assess kidney function." },
      { name: "eGFR (Estimated Glomerular Filtration Rate)", description: "Calculates how well the kidneys filter waste from the blood." },
      { name: "Urine Microalbumin", description: "Detects small amounts of albumin in urine, an early kidney damage marker." },
      { name: "Uric Acid", description: "Measures uric acid level; high levels can cause gout and kidney stones." },
      { name: "Cystatin C", description: "A more sensitive marker of kidney function than creatinine alone." },
    ],
  },
  {
    slug: "liver",
    name: "Liver",
    description: "Evaluate liver function and detect liver-related conditions.",
    tests: [
      { name: "SGPT (ALT)", description: "Liver enzyme that rises with liver cell damage." },
      { name: "SGOT (AST)", description: "Liver enzyme marker for liver and heart tissue damage." },
      { name: "Alkaline Phosphatase (ALP)", description: "Elevated in liver disease and bone disorders." },
      { name: "Total Bilirubin", description: "Measures bilirubin level to detect jaundice and liver function." },
      { name: "Direct Bilirubin", description: "Measures conjugated bilirubin to differentiate types of jaundice." },
      { name: "GGT (Gamma-GT)", description: "A sensitive marker for bile duct disease and alcohol-related liver damage." },
      { name: "Serum Albumin", description: "Measures protein produced by the liver; low levels indicate chronic liver disease." },
    ],
  },
  {
    slug: "womens-health",
    name: "Women's Health",
    description: "Comprehensive health screening tailored for women's wellness.",
    tests: [
      { name: "Complete Blood Count (CBC)", description: "Screening for anaemia and infection common in women." },
      { name: "Iron Studies (Ferritin, TIBC)", description: "Assesses iron status, important for menstruating and pregnant women." },
      { name: "Thyroid Profile (TSH, T3, T4)", description: "Thyroid disorders are more common in women." },
      { name: "Vitamin D (25-OH)", description: "Women are at higher risk of Vitamin D deficiency." },
      { name: "Vitamin B12", description: "Essential for energy, nerve function, and pregnancy health." },
      { name: "HbA1c", description: "Screens for diabetes, including gestational diabetes risk." },
      { name: "Calcium", description: "Important for bone health, especially post-menopause." },
      { name: "Urine Routine", description: "Detects urinary tract infections common in women." },
    ],
  },
  {
    slug: "senior-citizen",
    name: "Senior Citizen",
    description: "Health checkups designed for adults aged 60 and above.",
    tests: [
      { name: "Complete Blood Count (CBC)", description: "Screens for anaemia, infection, and blood disorders." },
      { name: "Lipid Profile", description: "Assesses cardiovascular risk, which increases with age." },
      { name: "HbA1c", description: "Monitors diabetes risk and control in seniors." },
      { name: "Kidney Function Test (KFT)", description: "Evaluates kidney function, which naturally declines with age." },
      { name: "Liver Function Test (LFT)", description: "Assesses liver health, especially for those on multiple medications." },
      { name: "Thyroid Profile", description: "Thyroid disorders are common in the elderly." },
      { name: "Vitamin D (25-OH)", description: "Seniors are at high risk of deficiency leading to bone loss." },
      { name: "Calcium", description: "Monitors bone mineral levels." },
      { name: "PSA (Prostate-Specific Antigen)", description: "Screens for prostate conditions in men over 60." },
      { name: "Urine Routine", description: "Detects UTIs and kidney issues common in the elderly." },
    ],
  },
  {
    slug: "tax-saver",
    name: "Tax Saver",
    description: "Preventive health checkup packages eligible under Section 80D.",
    tests: [
      { name: "Complete Blood Count (CBC)", description: "Basic blood screening for overall health." },
      { name: "Fasting Blood Sugar", description: "Screens for diabetes." },
      { name: "Lipid Profile", description: "Cardiovascular risk assessment." },
      { name: "Liver Function Test (LFT)", description: "Liver health evaluation." },
      { name: "Kidney Function Test (KFT)", description: "Kidney function assessment." },
      { name: "Thyroid Profile (TSH)", description: "Thyroid screening." },
      { name: "Urine Routine", description: "General urine analysis." },
    ],
  },
  {
    slug: "fever",
    name: "Fever",
    description: "Tests to identify the cause of fever and associated infections.",
    tests: [
      { name: "Complete Blood Count (CBC)", description: "Detects signs of infection, inflammation, or blood disorders." },
      { name: "Malaria Parasite Test (MP)", description: "Detects malaria parasites in the blood." },
      { name: "Widal Test", description: "Screens for typhoid fever caused by Salmonella bacteria." },
      { name: "Blood Culture", description: "Identifies bacteria in the bloodstream causing fever." },
      { name: "Urine Routine & Culture", description: "Detects urinary tract infection as a fever cause." },
      { name: "ESR (Erythrocyte Sedimentation Rate)", description: "Non-specific marker of inflammation or infection." },
    ],
  },
  {
    slug: "hormone",
    name: "Hormone Screening",
    description: "Evaluate hormonal levels for metabolic and reproductive health.",
    tests: [
      { name: "TSH (Thyroid Stimulating Hormone)", description: "Primary thyroid function screening." },
      { name: "Free T3 & Free T4", description: "Detailed thyroid hormone assessment." },
      { name: "Testosterone (Total)", description: "Measures male hormone levels for fertility and vitality." },
      { name: "Estradiol (E2)", description: "Measures estrogen level for female reproductive health." },
      { name: "FSH (Follicle Stimulating Hormone)", description: "Evaluates fertility and menopause status in women." },
      { name: "LH (Luteinising Hormone)", description: "Works with FSH to assess reproductive function." },
      { name: "Cortisol (Morning)", description: "Measures stress hormone level for adrenal function." },
    ],
  },
  {
    slug: "hairfall",
    name: "Hairfall",
    description: "Tests to identify the root cause of excessive hair loss.",
    tests: [
      { name: "Thyroid Profile (TSH, T3, T4)", description: "Thyroid dysfunction is a leading cause of hair loss." },
      { name: "Iron Studies (Ferritin, TIBC, Serum Iron)", description: "Iron deficiency is the most common cause of hair fall in women." },
      { name: "Vitamin D (25-OH)", description: "Low Vitamin D is linked to alopecia and hair thinning." },
      { name: "Vitamin B12", description: "B12 deficiency can cause hair loss and poor hair health." },
      { name: "Zinc", description: "Zinc deficiency contributes to hair loss and slow regrowth." },
      { name: "DHEA-S", description: "An adrenal hormone that, when elevated, is linked to female pattern hair loss." },
      { name: "Complete Blood Count (CBC)", description: "Screens for anaemia and nutritional deficiencies causing hair fall." },
    ],
  },
  {
    slug: "dengue",
    name: "Dengue",
    description: "Tests to diagnose and monitor dengue fever and its complications.",
    tests: [
      { name: "NS1 Antigen", description: "Detects dengue virus in the first 1–5 days of fever onset." },
      { name: "Dengue IgM Antibody", description: "Indicates recent or current dengue infection." },
      { name: "Dengue IgG Antibody", description: "Indicates past dengue infection or secondary infection risk." },
      { name: "Complete Blood Count (CBC)", description: "Monitors platelet count and haematocrit, critical in dengue." },
      { name: "Platelet Count", description: "Low platelets are a hallmark of dengue infection." },
      { name: "Liver Function Test (LFT)", description: "Dengue can cause liver inflammation; SGPT/SGOT rise is common." },
    ],
  },
  {
    slug: "bone-joint",
    name: "Bone and Joint",
    description: "Assess bone health, joint inflammation, and musculoskeletal conditions.",
    tests: [
      { name: "Calcium", description: "Measures serum calcium for bone mineral health." },
      { name: "Vitamin D (25-OH)", description: "Essential for calcium absorption and bone strength." },
      { name: "Phosphorus", description: "Works with calcium for bone mineralization." },
      { name: "Uric Acid", description: "Elevated levels indicate gout and joint inflammation." },
      { name: "Rheumatoid Factor (RF)", description: "Detects autoimmune joint conditions like rheumatoid arthritis." },
      { name: "Anti-CCP Antibodies", description: "Highly specific marker for rheumatoid arthritis." },
      { name: "ESR (Erythrocyte Sedimentation Rate)", description: "Non-specific marker of joint and systemic inflammation." },
    ],
  },
  {
    slug: "allergy",
    name: "Allergy",
    description: "Identify allergic triggers and immune system responses.",
    tests: [
      { name: "Total IgE", description: "Measures total immunoglobulin E to assess allergic tendency." },
      { name: "Specific IgE – Food Panel", description: "Tests for IgE antibodies against common food allergens." },
      { name: "Specific IgE – Respiratory Panel", description: "Tests for IgE against dust mites, pollen, mould, and pet dander." },
      { name: "Absolute Eosinophil Count", description: "High eosinophils indicate allergic or parasitic conditions." },
      { name: "CBC with Differential", description: "Full blood count with white cell differential for allergy assessment." },
    ],
  },
  {
    slug: "sexual-wellness",
    name: "Sexual Wellness",
    description: "Comprehensive screening for sexual health and STI detection.",
    tests: [
      { name: "HIV I & II Antibody", description: "Screens for Human Immunodeficiency Virus infection." },
      { name: "VDRL (Syphilis)", description: "Screens for syphilis infection." },
      { name: "Hepatitis B (HBsAg)", description: "Detects Hepatitis B surface antigen for HBV infection." },
      { name: "Hepatitis C (Anti-HCV)", description: "Screens for Hepatitis C virus antibodies." },
      { name: "Complete Blood Count (CBC)", description: "General blood health assessment." },
      { name: "Urine Routine & Culture", description: "Detects urinary tract and reproductive tract infections." },
    ],
  },
  {
    slug: "immunity",
    name: "Immunity",
    description: "Evaluate immune system strength and identify deficiencies.",
    tests: [
      { name: "Total IgG", description: "Measures immunoglobulin G, the most abundant antibody for long-term immunity." },
      { name: "Total IgM", description: "Measures immunoglobulin M, the first-line antibody for new infections." },
      { name: "Total IgA", description: "Measures immunoglobulin A, important for mucosal immunity." },
      { name: "Vitamin D (25-OH)", description: "Vitamin D plays a critical role in immune regulation." },
      { name: "Zinc", description: "Essential mineral for immune cell function." },
      { name: "CBC with Differential", description: "Evaluates white blood cell counts for immune health." },
      { name: "Iron Studies", description: "Iron is needed for immune cell proliferation and function." },
    ],
  },
  {
    slug: "fever-infection",
    name: "Fever and Infection",
    description: "Identify the specific cause of fever and bacterial or viral infections.",
    tests: [
      { name: "Complete Blood Count (CBC)", description: "Detects signs of bacterial or viral infection." },
      { name: "Blood Culture & Sensitivity", description: "Identifies infecting bacteria and the antibiotics it responds to." },
      { name: "Procalcitonin", description: "A specific marker for bacterial infection severity." },
      { name: "CRP (C-Reactive Protein)", description: "Detects acute inflammation and bacterial infection." },
      { name: "ESR", description: "Non-specific marker of infection and inflammation." },
      { name: "Malaria Parasite Test", description: "Rules out malaria as a cause of fever." },
    ],
  },
  {
    slug: "reproductive",
    name: "Reproductive & Fertility Tests",
    description: "Assess reproductive health and fertility in men and women.",
    tests: [
      { name: "FSH (Follicle Stimulating Hormone)", description: "Evaluates ovarian reserve and sperm production." },
      { name: "LH (Luteinising Hormone)", description: "Regulates sex hormone production and ovulation." },
      { name: "Estradiol (E2)", description: "Measures estrogen for female reproductive health." },
      { name: "Testosterone (Total & Free)", description: "Essential male hormone for sperm production and libido." },
      { name: "AMH (Anti-Müllerian Hormone)", description: "Best marker for ovarian reserve in women." },
      { name: "Prolactin", description: "High levels can interfere with ovulation and fertility." },
      { name: "Thyroid Profile", description: "Thyroid disorders can significantly affect fertility." },
      { name: "Iron Studies", description: "Iron deficiency can affect menstrual health and fertility." },
    ],
  },
  {
    slug: "cancer-screening",
    name: "Cancer Screening",
    description: "Early detection markers for common cancers.",
    tests: [
      { name: "PSA (Prostate-Specific Antigen)", description: "Screening marker for prostate cancer in men." },
      { name: "CEA (Carcinoembryonic Antigen)", description: "Tumour marker for colorectal and other cancers." },
      { name: "AFP (Alpha-Fetoprotein)", description: "Tumour marker for liver cancer and germ cell tumours." },
      { name: "CA-125", description: "Tumour marker for ovarian cancer screening." },
      { name: "CA 19-9", description: "Tumour marker for pancreatic and gastrointestinal cancers." },
      { name: "Complete Blood Count (CBC)", description: "Screens for blood cancers like leukaemia and lymphoma." },
    ],
  },
  {
    slug: "hepatitis",
    name: "Hepatitis Screening",
    description: "Screen for hepatitis virus infections and assess liver impact.",
    tests: [
      { name: "HBsAg (Hepatitis B Surface Antigen)", description: "Detects active Hepatitis B infection." },
      { name: "Anti-HCV (Hepatitis C Antibodies)", description: "Screens for Hepatitis C virus infection." },
      { name: "Hepatitis A IgM Antibody", description: "Detects acute Hepatitis A infection." },
      { name: "Liver Function Test (LFT)", description: "Assesses liver damage from hepatitis infection." },
      { name: "HBV DNA (Viral Load)", description: "Quantifies Hepatitis B viral load for treatment monitoring." },
      { name: "Anti-HBs Antibody", description: "Checks immunity to Hepatitis B after vaccination." },
    ],
  },
  {
    slug: "lungs",
    name: "Lungs",
    description: "Assess respiratory health and detect lung-related conditions.",
    tests: [
      { name: "Chest X-Ray (Digital)", description: "Imaging to detect pneumonia, tuberculosis, and lung abnormalities." },
      { name: "Pulmonary Function Test (PFT)", description: "Measures lung capacity and airflow to diagnose asthma and COPD." },
      { name: "Spirometry", description: "Measures how much and how fast you can breathe in and out." },
      { name: "Sputum Culture & Sensitivity", description: "Identifies bacteria causing respiratory infections." },
      { name: "CBC with Differential", description: "Detects eosinophilia and infection markers in respiratory conditions." },
      { name: "ESR & CRP", description: "Markers of lung inflammation and infection." },
    ],
  },
  {
    slug: "weight",
    name: "Weight Management",
    description: "Comprehensive tests to identify metabolic causes of weight gain.",
    tests: [
      { name: "Thyroid Profile (TSH, T3, T4)", description: "Hypothyroidism is a common cause of unexplained weight gain." },
      { name: "HbA1c", description: "Screens for insulin resistance and diabetes linked to weight." },
      { name: "Fasting Insulin", description: "High fasting insulin indicates insulin resistance." },
      { name: "Lipid Profile", description: "Assesses metabolic health and cardiovascular risk." },
      { name: "Cortisol (Morning)", description: "High cortisol promotes fat storage, especially abdominal." },
      { name: "Vitamin D (25-OH)", description: "Low Vitamin D is associated with obesity and metabolic syndrome." },
      { name: "Leptin", description: "The satiety hormone; high levels indicate leptin resistance." },
    ],
  },
  {
    slug: "iron",
    name: "Iron Studies",
    description: "Detailed evaluation of iron levels and iron-related disorders.",
    tests: [
      { name: "Serum Iron", description: "Measures the amount of iron circulating in your blood." },
      { name: "Ferritin", description: "Indicates total iron stores in the body." },
      { name: "TIBC (Total Iron Binding Capacity)", description: "Measures the blood's capacity to bind iron with transferrin." },
      { name: "Transferrin Saturation", description: "Percentage of transferrin carrying iron; low in deficiency." },
      { name: "Complete Blood Count (CBC)", description: "Assesses haemoglobin and red cell indices for iron deficiency anaemia." },
      { name: "Reticulocyte Count", description: "Evaluates bone marrow response to anaemia." },
    ],
  },
  {
    slug: "covid",
    name: "Covid 19",
    description: "Testing and monitoring for COVID-19 infection and immunity.",
    tests: [
      { name: "RT-PCR (SARS-CoV-2)", description: "Gold-standard molecular test to detect active COVID-19 infection." },
      { name: "Rapid Antigen Test (RAT)", description: "Quick test for detecting current COVID-19 infection." },
      { name: "COVID-19 IgG Antibody", description: "Detects past infection or post-vaccination immunity." },
      { name: "COVID-19 IgM Antibody", description: "Indicates recent or current infection." },
      { name: "D-Dimer", description: "Elevated in blood clotting complications from COVID-19." },
      { name: "CRP (C-Reactive Protein)", description: "Measures inflammation severity in COVID-19." },
    ],
  },
  {
    slug: "pcod",
    name: "PCOD Screening",
    description: "Comprehensive screening for Polycystic Ovary Syndrome.",
    tests: [
      { name: "LH (Luteinising Hormone)", description: "Elevated LH:FSH ratio is characteristic of PCOD." },
      { name: "FSH (Follicle Stimulating Hormone)", description: "Evaluated alongside LH for hormonal imbalance in PCOD." },
      { name: "Testosterone (Total)", description: "Elevated testosterone causes hirsutism and acne in PCOD." },
      { name: "DHEA-S", description: "An adrenal androgen often elevated in PCOD." },
      { name: "AMH (Anti-Müllerian Hormone)", description: "Very high AMH levels indicate polycystic ovaries." },
      { name: "Insulin Fasting", description: "Insulin resistance is a key feature of PCOD." },
      { name: "HbA1c", description: "Screens for pre-diabetes and diabetes risk in PCOD patients." },
      { name: "Lipid Profile", description: "PCOD patients have higher cardiovascular risk." },
    ],
  },
  {
    slug: "healthy-2024",
    name: "Healthy 2024",
    description: "Annual preventive health checkup for overall wellness.",
    tests: [
      { name: "Complete Blood Count (CBC)", description: "Comprehensive blood health screening." },
      { name: "Fasting Blood Sugar & HbA1c", description: "Diabetes screening and long-term glucose control." },
      { name: "Lipid Profile", description: "Cardiovascular risk assessment." },
      { name: "Liver Function Test (LFT)", description: "Liver health evaluation." },
      { name: "Kidney Function Test (KFT)", description: "Kidney health assessment." },
      { name: "Thyroid Profile (TSH)", description: "Thyroid function screening." },
      { name: "Vitamin D (25-OH)", description: "Vitamin D status check." },
      { name: "Vitamin B12", description: "Vitamin B12 level assessment." },
      { name: "Iron Studies", description: "Iron status evaluation." },
      { name: "Urine Routine", description: "General urine health screening." },
    ],
  },
];

/**
 * Get predefined tests for a given category slug.
 */
export function getPredefinedTests(categorySlug: string): PredefinedTest[] {
  const cat = PREDEFINED_LAB_TESTS.find((c) => c.slug === categorySlug);
  return cat?.tests ?? [];
}

/**
 * Get full category info by slug.
 */
export function getPredefinedCategory(categorySlug: string): PredefinedCategory | undefined {
  return PREDEFINED_LAB_TESTS.find((c) => c.slug === categorySlug);
}
