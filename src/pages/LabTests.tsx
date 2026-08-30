import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, X, Check } from "lucide-react";

/* ── Category Data ── */
interface LabTest {
  name: string;
  description: string;
}
interface HealthCategory {
  id: string;
  name: string;
  discountPercent: number;
  originalPrice: number;
  discountedPrice: number;
  description: string;
  tests: LabTest[];
}

const CATEGORIES: HealthCategory[] = [
  {
    id: "full-body",
    name: "Full Body Checkup",
    discountPercent: 40,
    originalPrice: 3999,
    discountedPrice: 2399,
    description: "Comprehensive full-body health assessment covering major organ systems to detect early signs of disease.",
    tests: [
      { name: "Complete Blood Count (CBC)", description: "Evaluates overall health and detects infections, anemia, and other disorders." },
      { name: "Lipid Profile", description: "Measures cholesterol and triglyceride levels to assess cardiovascular risk." },
      { name: "Liver Function Test (LFT)", description: "Assesses liver health including enzymes, bilirubin, and protein levels." },
      { name: "Kidney Function Test (KFT)", description: "Evaluates kidney health through creatinine, blood urea, and electrolyte levels." },
      { name: "Thyroid Profile (TSH, T3, T4)", description: "Screens for thyroid disorders including hypothyroidism and hyperthyroidism." },
      { name: "HbA1c", description: "Shows average blood glucose levels over the previous 2–3 months." },
      { name: "Fasting Blood Glucose", description: "Measures blood sugar after an overnight fast to screen for diabetes." },
      { name: "Urine Routine & Microscopy", description: "Detects infections, kidney disease, and metabolic disorders through urine analysis." },
      { name: "Vitamin D", description: "Checks vitamin D levels essential for bone health and immunity." },
      { name: "Vitamin B12", description: "Evaluates B12 levels important for nerve function and red blood cell production." },
      { name: "Iron Studies", description: "Assesses iron levels to detect deficiency or overload conditions." },
      { name: "Calcium", description: "Measures calcium levels important for bones, nerves, and muscle function." },
    ],
  },
  {
    id: "diabetes",
    name: "Diabetes",
    discountPercent: 35,
    originalPrice: 1499,
    discountedPrice: 974,
    description: "Essential tests to screen, monitor, and manage diabetes and pre-diabetic conditions.",
    tests: [
      { name: "Fasting Blood Sugar (FBS)", description: "Measures blood glucose after an overnight fast to screen for diabetes." },
      { name: "Post-Prandial Blood Sugar (PPBS)", description: "Checks blood sugar 2 hours after a meal to assess glucose metabolism." },
      { name: "HbA1c", description: "Shows average blood sugar control over the past 2–3 months." },
      { name: "Urine Sugar", description: "Detects excess sugar in urine which may indicate uncontrolled diabetes." },
      { name: "Insulin Fasting", description: "Measures insulin levels to assess insulin resistance or deficiency." },
      { name: "C-Peptide", description: "Evaluates how much insulin the pancreas is producing naturally." },
    ],
  },
  {
    id: "heart",
    name: "Heart",
    discountPercent: 30,
    originalPrice: 2499,
    discountedPrice: 1749,
    description: "Comprehensive cardiac screening to assess heart health and identify cardiovascular risk factors.",
    tests: [
      { name: "Lipid Profile", description: "Full cholesterol panel including total cholesterol, HDL, LDL, and triglycerides." },
      { name: "hs-CRP", description: "Detects inflammation linked to increased risk of heart disease." },
      { name: "Troponin I", description: "Highly specific marker for heart muscle damage or heart attack." },
      { name: "Homocysteine", description: "Elevated levels are associated with increased cardiovascular risk." },
      { name: "CK-MB", description: "Enzyme marker used to detect heart muscle injury." },
      { name: "BNP", description: "Brain natriuretic peptide helps diagnose heart failure." },
      { name: "Complete Blood Count", description: "Screens for anemia and infections that can affect heart function." },
      { name: "Blood Sugar Fasting", description: "Diabetes is a major risk factor for heart disease." },
    ],
  },
  {
    id: "blood",
    name: "Blood Studies",
    discountPercent: 25,
    originalPrice: 1299,
    discountedPrice: 974,
    description: "Detailed blood analysis to evaluate overall health, detect infections, and screen for blood disorders.",
    tests: [
      { name: "Complete Blood Count (CBC)", description: "Evaluates red blood cells, white blood cells, haemoglobin, and platelets." },
      { name: "ESR", description: "Erythrocyte sedimentation rate detects inflammation in the body." },
      { name: "Peripheral Smear", description: "Microscopic examination of blood cells to detect abnormalities." },
      { name: "Blood Grouping & Rh", description: "Determines ABO blood group and Rh factor for transfusion compatibility." },
      { name: "Reticulocyte Count", description: "Measures new red blood cell production to assess bone marrow function." },
      { name: "Iron Studies", description: "Serum iron, ferritin, and TIBC to evaluate iron status." },
    ],
  },
  {
    id: "vitamin",
    name: "Vitamin",
    discountPercent: 45,
    originalPrice: 1999,
    discountedPrice: 1099,
    description: "Essential vitamin panels to detect deficiencies affecting energy, immunity, and overall wellness.",
    tests: [
      { name: "Vitamin D (25-OH)", description: "Checks vitamin D levels critical for bone health and immunity." },
      { name: "Vitamin B12", description: "Evaluates B12 status important for nerve and brain function." },
      { name: "Vitamin B9 (Folate)", description: "Essential for cell growth and DNA formation." },
      { name: "Vitamin A", description: "Important for vision, immunity, and skin health." },
      { name: "Vitamin C", description: "Antioxidant vitamin important for tissue repair and immunity." },
      { name: "Vitamin E", description: "Fat-soluble antioxidant protecting cells from oxidative damage." },
    ],
  },
  {
    id: "thyroid",
    name: "Thyroid",
    discountPercent: 35,
    originalPrice: 1199,
    discountedPrice: 779,
    description: "Complete thyroid panel to screen for hypothyroidism, hyperthyroidism, and thyroid disorders.",
    tests: [
      { name: "TSH (Thyroid Stimulating Hormone)", description: "Primary screening test for thyroid dysfunction." },
      { name: "Free T3", description: "Active thyroid hormone that regulates metabolism." },
      { name: "Free T4", description: "Main thyroid hormone produced by the thyroid gland." },
      { name: "Anti-TPO Antibodies", description: "Detects autoimmune thyroid conditions like Hashimoto's disease." },
      { name: "Thyroglobulin", description: "Used to monitor thyroid cancer and thyroid function." },
    ],
  },
  {
    id: "kidney",
    name: "Kidney",
    discountPercent: 30,
    originalPrice: 1399,
    discountedPrice: 979,
    description: "Kidney function assessment to detect early kidney damage, stones, and chronic kidney disease.",
    tests: [
      { name: "Serum Creatinine", description: "Key marker of kidney filtration function." },
      { name: "Blood Urea Nitrogen (BUN)", description: "Measures urea nitrogen levels to assess kidney performance." },
      { name: "eGFR", description: "Estimated glomerular filtration rate indicates overall kidney function." },
      { name: "Urine Albumin-Creatinine Ratio", description: "Detects early kidney damage from diabetes or hypertension." },
      { name: "Uric Acid", description: "Elevated levels may indicate kidney stones or kidney disease." },
      { name: "Electrolytes (Na, K, Cl)", description: "Balances regulated by healthy kidney function." },
    ],
  },
  {
    id: "liver",
    name: "Liver",
    discountPercent: 30,
    originalPrice: 1399,
    discountedPrice: 979,
    description: "Liver function evaluation to detect hepatitis, fatty liver, and other liver conditions.",
    tests: [
      { name: "SGPT (ALT)", description: "Liver enzyme elevated in liver cell damage." },
      { name: "SGOT (AST)", description: "Liver enzyme indicating liver or heart tissue damage." },
      { name: "Alkaline Phosphatase (ALP)", description: "Elevated in liver disease and bone disorders." },
      { name: "Total Bilirubin", description: "Measures yellow pigment produced during red blood cell breakdown." },
      { name: "Direct Bilirubin", description: "Conjugated bilirubin elevated in liver obstruction." },
      { name: "Total Protein & Albumin", description: "Assesses liver's protein-making capacity." },
      { name: "GGT", description: "Gamma-glutamyl transferase sensitive marker of liver and bile duct disease." },
    ],
  },
  {
    id: "womens-health",
    name: "Women's Health",
    discountPercent: 35,
    originalPrice: 2199,
    discountedPrice: 1429,
    description: "Comprehensive health screening tailored for women covering hormonal, reproductive, and wellness markers.",
    tests: [
      { name: "Complete Blood Count", description: "Screens for anemia common in women due to menstruation." },
      { name: "Thyroid Profile", description: "Thyroid disorders are more common in women." },
      { name: "Iron Studies", description: "Iron deficiency is prevalent in menstruating women." },
      { name: "Vitamin D", description: "Women are at higher risk for vitamin D deficiency." },
      { name: "Blood Glucose Fasting", description: "Screens for gestational and general diabetes risk." },
      { name: "Calcium", description: "Important for bone health, especially post-menopause." },
      { name: "Lipid Profile", description: "Cardiovascular risk assessment." },
      { name: "HbA1c", description: "Long-term blood sugar monitoring." },
    ],
  },
  {
    id: "senior-citizen",
    name: "Senior Citizen",
    discountPercent: 40,
    originalPrice: 2999,
    discountedPrice: 1799,
    description: "Specialised health screening for seniors covering age-related conditions and chronic disease monitoring.",
    tests: [
      { name: "Complete Blood Count", description: "General health and infection screening." },
      { name: "Lipid Profile", description: "Cardiovascular risk assessment for age-related heart disease." },
      { name: "Kidney Function Test", description: "Age-related kidney function monitoring." },
      { name: "Liver Function Test", description: "Assesses liver health and medication impact." },
      { name: "Thyroid Profile", description: "Thyroid disorders increase with age." },
      { name: "HbA1c & Blood Glucose", description: "Diabetes screening and monitoring." },
      { name: "Vitamin D & B12", description: "Common deficiencies in elderly populations." },
      { name: "PSA (Prostate)", description: "Prostate cancer screening for males above 50." },
      { name: "Bone Density Markers", description: "Calcium and phosphorus to assess bone health." },
      { name: "Urine Routine", description: "Detects urinary tract infections and kidney issues." },
    ],
  },
  {
    id: "tax-saver",
    name: "Tax Saver",
    discountPercent: 50,
    originalPrice: 1999,
    discountedPrice: 999,
    description: "Preventive health checkup package eligible for tax benefits under Section 80D.",
    tests: [
      { name: "Complete Blood Count", description: "Essential baseline blood health assessment." },
      { name: "Fasting Blood Glucose", description: "Diabetes screening." },
      { name: "Lipid Profile", description: "Cardiovascular health check." },
      { name: "Liver Function Test", description: "Liver health assessment." },
      { name: "Kidney Function Test", description: "Kidney health screening." },
      { name: "Thyroid (TSH)", description: "Thyroid function screening." },
      { name: "Urine Routine", description: "Urinary system health check." },
    ],
  },
  {
    id: "fever",
    name: "Fever",
    discountPercent: 25,
    originalPrice: 899,
    discountedPrice: 674,
    description: "Essential tests to identify the cause of persistent or recurring fever.",
    tests: [
      { name: "Complete Blood Count", description: "Detects infections, viral or bacterial causes of fever." },
      { name: "ESR", description: "Inflammation marker to assess infection severity." },
      { name: "Malaria Test (Rapid)", description: "Screens for malarial parasite infection." },
      { name: "Widal Test", description: "Screens for typhoid fever caused by Salmonella bacteria." },
      { name: "Blood Culture", description: "Detects bacterial infection in the bloodstream." },
      { name: "CRP", description: "C-reactive protein indicates active infection or inflammation." },
    ],
  },
  {
    id: "hormone",
    name: "Hormone Screening",
    discountPercent: 30,
    originalPrice: 1999,
    discountedPrice: 1399,
    description: "Comprehensive hormone panel to evaluate endocrine function and hormonal imbalances.",
    tests: [
      { name: "Thyroid Panel (TSH, T3, T4)", description: "Screens for thyroid hormone imbalances." },
      { name: "Testosterone", description: "Male hormone affecting energy, mood, and reproductive health." },
      { name: "Estrogen", description: "Female hormone critical for reproductive health." },
      { name: "Cortisol", description: "Stress hormone that affects metabolism and immunity." },
      { name: "Insulin Fasting", description: "Evaluates insulin production and resistance." },
      { name: "FSH & LH", description: "Reproductive hormones important for fertility assessment." },
      { name: "Prolactin", description: "Hormone that can affect menstrual cycles and fertility." },
    ],
  },
  {
    id: "hairfall",
    name: "Hairfall",
    discountPercent: 30,
    originalPrice: 1499,
    discountedPrice: 1049,
    description: "Diagnostic tests to identify the root cause of excessive hair loss and thinning.",
    tests: [
      { name: "Thyroid Profile", description: "Thyroid disorders are a common cause of hair loss." },
      { name: "Iron Studies (Ferritin)", description: "Low ferritin is strongly linked to hair loss." },
      { name: "Vitamin D", description: "Deficiency is associated with alopecia." },
      { name: "Vitamin B12", description: "B12 deficiency can cause hair thinning." },
      { name: "Zinc", description: "Essential mineral for hair growth and repair." },
      { name: "Complete Blood Count", description: "Screens for anemia contributing to hair loss." },
      { name: "DHEA-S", description: "Adrenal hormone that may affect hair growth patterns." },
    ],
  },
  {
    id: "dengue",
    name: "Dengue",
    discountPercent: 20,
    originalPrice: 1299,
    discountedPrice: 1039,
    description: "Targeted tests for early detection and monitoring of dengue fever infection.",
    tests: [
      { name: "Dengue NS1 Antigen", description: "Detects dengue virus in the first 1–5 days of fever." },
      { name: "Dengue IgM Antibody", description: "Indicates recent dengue infection." },
      { name: "Dengue IgG Antibody", description: "Shows past dengue exposure or secondary infection." },
      { name: "Complete Blood Count", description: "Monitors platelet count which drops in dengue." },
      { name: "Platelet Count", description: "Critical parameter to track dengue severity." },
      { name: "ESR & CRP", description: "Inflammation markers to assess infection severity." },
    ],
  },
  {
    id: "bone-joint",
    name: "Bone and Joint",
    discountPercent: 25,
    originalPrice: 1699,
    discountedPrice: 1274,
    description: "Tests to evaluate bone health, joint inflammation, and musculoskeletal conditions.",
    tests: [
      { name: "Calcium", description: "Essential mineral for bone strength and density." },
      { name: "Vitamin D (25-OH)", description: "Critical for calcium absorption and bone health." },
      { name: "Phosphorus", description: "Works with calcium to maintain bone structure." },
      { name: "Alkaline Phosphatase (ALP)", description: "Elevated in bone disease and liver conditions." },
      { name: "Uric Acid", description: "High levels indicate gout and joint inflammation." },
      { name: "CRP & ESR", description: "Inflammation markers for rheumatoid and joint disorders." },
      { name: "Rheumatoid Factor (RF)", description: "Autoimmune marker for rheumatoid arthritis." },
    ],
  },
  {
    id: "allergy",
    name: "Allergy",
    discountPercent: 25,
    originalPrice: 1799,
    discountedPrice: 1349,
    description: "Comprehensive allergy testing to identify triggers for seasonal, food, and environmental allergies.",
    tests: [
      { name: "Total IgE", description: "Elevated in allergic conditions and asthma." },
      { name: "Specific IgE (Food Panel)", description: "Tests for common food allergens like milk, egg, peanuts." },
      { name: "Specific IgE (Inhalant Panel)", description: "Tests for dust mites, pollen, mould, and pet dander." },
      { name: "CBC with Eosinophil Count", description: "Elevated eosinophils indicate allergic reaction." },
      { name: "CRP", description: "Rules out infection as the cause of symptoms." },
    ],
  },
  {
    id: "sexual-wellness",
    name: "Sexual Wellness",
    discountPercent: 30,
    originalPrice: 1999,
    discountedPrice: 1399,
    description: "Confidential screening for sexual health, STIs, and reproductive wellness.",
    tests: [
      { name: "HIV I & II", description: "Screens for human immunodeficiency virus infection." },
      { name: "VDRL/RPR", description: "Screening test for syphilis infection." },
      { name: "Hepatitis B Surface Antigen", description: "Detects hepatitis B infection." },
      { name: "Hepatitis C Antibody", description: "Screens for hepatitis C virus exposure." },
      { name: "Complete Blood Count", description: "General health assessment." },
      { name: "Urine Routine & Culture", description: "Detects urinary tract and reproductive tract infections." },
    ],
  },
  {
    id: "immunity",
    name: "Immunity",
    discountPercent: 30,
    originalPrice: 1699,
    discountedPrice: 1189,
    description: "Evaluate your immune system strength and identify factors affecting your body's defence mechanisms.",
    tests: [
      { name: "Complete Blood Count", description: "Assesses white blood cell count and immune status." },
      { name: "Immunoglobulin IgG", description: "Main antibody providing long-term immune protection." },
      { name: "Immunoglobulin IgM", description: "First-line antibody responding to new infections." },
      { name: "Vitamin D", description: "Plays a critical role in immune regulation." },
      { name: "Zinc", description: "Essential mineral for immune cell function." },
      { name: "Iron Studies", description: "Iron deficiency impairs immune response." },
      { name: "CRP", description: "Chronic inflammation can weaken immune defence." },
    ],
  },
  {
    id: "fever-infection",
    name: "Fever and Infection",
    discountPercent: 25,
    originalPrice: 1199,
    discountedPrice: 899,
    description: "Targeted tests to identify the specific cause of fever and systemic infections.",
    tests: [
      { name: "Complete Blood Count", description: "Differentiates between viral and bacterial infections." },
      { name: "ESR & CRP", description: "Inflammation and infection severity markers." },
      { name: "Blood Culture & Sensitivity", description: "Identifies the specific bacteria causing infection." },
      { name: "Malaria Parasite Test", description: "Screens for malarial infection." },
      { name: "Typhoid (Widal/Spot)", description: "Screens for enteric fever." },
      { name: "Procalcitonin", description: "Distinguishes bacterial from viral infections." },
    ],
  },
  {
    id: "reproductive",
    name: "Reproductive & Fertility Tests",
    discountPercent: 35,
    originalPrice: 2499,
    discountedPrice: 1624,
    description: "Comprehensive fertility evaluation for both men and women to assess reproductive health.",
    tests: [
      { name: "FSH (Follicle Stimulating Hormone)", description: "Evaluates ovarian reserve and reproductive function." },
      { name: "LH (Luteinizing Hormone)", description: "Critical for ovulation and reproductive health." },
      { name: "Estradiol (E2)", description: "Estrogen level important for fertility assessment." },
      { name: "AMH (Anti-Müllerian Hormone)", description: "Best marker of ovarian reserve for women." },
      { name: "Testosterone", description: "Male fertility hormone affecting sperm production." },
      { name: "Prolactin", description: "High levels can interfere with ovulation and fertility." },
      { name: "Thyroid Panel", description: "Thyroid disorders can significantly affect fertility." },
      { name: "Complete Blood Count", description: "General reproductive health baseline." },
    ],
  },
  {
    id: "cancer-screening",
    name: "Cancer Screening",
    discountPercent: 25,
    originalPrice: 3499,
    discountedPrice: 2624,
    description: "Early cancer detection markers to identify risk factors and screen for common cancers.",
    tests: [
      { name: "PSA (Prostate Specific Antigen)", description: "Screens for prostate cancer risk in men over 50." },
      { name: "CEA (Carcinoembryonic Antigen)", description: "Tumour marker for colorectal and other cancers." },
      { name: "AFP (Alpha-Fetoprotein)", description: "Screening marker for liver cancer." },
      { name: "CA-125", description: "Ovarian cancer screening marker in women." },
      { name: "Complete Blood Count", description: "Can detect blood cancers like leukaemia." },
      { name: "LFT & KFT", description: "Assesses organ function as baseline for cancer screening." },
    ],
  },
  {
    id: "hepatitis",
    name: "Hepatitis Screening",
    discountPercent: 30,
    originalPrice: 1999,
    discountedPrice: 1399,
    description: "Comprehensive hepatitis screening to detect hepatitis A, B, and C virus infections.",
    tests: [
      { name: "Hepatitis B Surface Antigen (HBsAg)", description: "Detects active hepatitis B infection." },
      { name: "Hepatitis B Core Antibody (Anti-HBc)", description: "Indicates past or current hepatitis B exposure." },
      { name: "Hepatitis B Surface Antibody (Anti-HBs)", description: "Shows immunity from vaccination or past infection." },
      { name: "Hepatitis C Antibody (Anti-HCV)", description: "Screens for hepatitis C virus exposure." },
      { name: "Liver Function Test", description: "Assesses liver damage from hepatitis infection." },
      { name: "Hepatitis A IgM", description: "Detects acute hepatitis A infection." },
    ],
  },
  {
    id: "lungs",
    name: "Lungs",
    discountPercent: 25,
    originalPrice: 1599,
    discountedPrice: 1199,
    description: "Respiratory health assessment to evaluate lung function and detect pulmonary conditions.",
    tests: [
      { name: "Chest X-Ray (Digital)", description: "Imaging to detect pneumonia, tuberculosis, and other lung conditions." },
      { name: "Pulmonary Function Test (PFT)", description: "Measures lung capacity and airflow to diagnose respiratory conditions." },
      { name: "CBC with Differential", description: "White blood cell count to detect respiratory infections." },
      { name: "ESR & CRP", description: "Inflammation markers for lung infections." },
      { name: "Sputum Culture", description: "Identifies bacteria causing respiratory infections." },
      { name: "Spirometry", description: "Measures how well lungs inhale and exhale air." },
    ],
  },
  {
    id: "weight",
    name: "Weight Management",
    discountPercent: 30,
    originalPrice: 1799,
    discountedPrice: 1259,
    description: "Metabolic and hormonal tests to identify underlying causes of weight gain or difficulty losing weight.",
    tests: [
      { name: "Thyroid Profile", description: "Hypothyroidism is a common cause of weight gain." },
      { name: "Fasting Insulin", description: "High insulin levels promote fat storage and weight gain." },
      { name: "HbA1c & Blood Glucose", description: "Insulin resistance and diabetes affect weight management." },
      { name: "Cortisol", description: "Chronic stress hormone elevations cause abdominal weight gain." },
      { name: "Lipid Profile", description: "Assesses metabolic health and cardiovascular risk." },
      { name: "Vitamin D", description: "Low vitamin D is linked to obesity and metabolic syndrome." },
      { name: "Leptin", description: "Hunger hormone that regulates appetite and energy balance." },
    ],
  },
  {
    id: "iron",
    name: "Iron Studies",
    discountPercent: 35,
    originalPrice: 999,
    discountedPrice: 649,
    description: "Detailed iron assessment to diagnose iron deficiency, anaemia, and iron overload conditions.",
    tests: [
      { name: "Serum Iron", description: "Measures the amount of iron in your blood." },
      { name: "Serum Ferritin", description: "Best indicator of total body iron stores." },
      { name: "Total Iron Binding Capacity (TIBC)", description: "Measures transferrin's capacity to bind iron." },
      { name: "Transferrin Saturation", description: "Percentage of transferrin carrying iron." },
      { name: "Complete Blood Count", description: "Screens for iron-deficiency anaemia." },
      { name: "Reticulocyte Count", description: "Shows bone marrow response to iron deficiency." },
    ],
  },
  {
    id: "covid",
    name: "Covid 19",
    discountPercent: 20,
    originalPrice: 1499,
    discountedPrice: 1199,
    description: "COVID-19 testing and post-infection health assessment including antibody and immunity checks.",
    tests: [
      { name: "COVID-19 RT-PCR", description: "Gold-standard molecular test to detect active SARS-CoV-2 infection." },
      { name: "Rapid Antigen Test", description: "Quick screening test for current COVID-19 infection." },
      { name: "COVID-19 IgG Antibody", description: "Detects antibodies indicating past infection or immunity." },
      { name: "COVID-19 IgM Antibody", description: "Indicates recent infection or early immune response." },
      { name: "CBC with Differential", description: "Monitors white blood cell count during infection." },
      { name: "CRP & D-Dimer", description: "Inflammation and blood clotting markers for COVID severity assessment." },
    ],
  },
  {
    id: "pcod",
    name: "PCOD Screening",
    discountPercent: 30,
    originalPrice: 1999,
    discountedPrice: 1399,
    description: "Comprehensive hormonal screening to diagnose and evaluate Polycystic Ovary Syndrome (PCOS).",
    tests: [
      { name: "Testosterone (Total & Free)", description: "Elevated testosterone is a key PCOS indicator." },
      { name: "DHEA-S", description: "Adrenal androgen often elevated in PCOS." },
      { name: "LH & FSH Ratio", description: "Elevated LH:FSH ratio is characteristic of PCOS." },
      { name: "Insulin Fasting", description: "Insulin resistance is strongly linked to PCOS." },
      { name: "HbA1c & Glucose", description: "Screens for diabetes risk associated with PCOS." },
      { name: "Lipid Profile", description: "PCOS increases cardiovascular and metabolic risk." },
      { name: "Thyroid Profile", description: "Thyroid disorders can mimic or worsen PCOS symptoms." },
      { name: "AMH", description: "Elevated in PCOS due to multiple small follicles." },
    ],
  },
  {
    id: "healthy-2024",
    name: "Healthy 2024",
    discountPercent: 45,
    originalPrice: 2999,
    discountedPrice: 1649,
    description: "Start the year right with a comprehensive preventive health checkup covering all major body systems.",
    tests: [
      { name: "Complete Blood Count", description: "Complete blood health assessment." },
      { name: "Lipid Profile", description: "Heart and cardiovascular risk check." },
      { name: "Liver Function Test", description: "Liver health assessment." },
      { name: "Kidney Function Test", description: "Kidney health screening." },
      { name: "Thyroid Profile", description: "Thyroid function evaluation." },
      { name: "HbA1c & Fasting Glucose", description: "Diabetes screening." },
      { name: "Vitamin D & B12", description: "Essential vitamin levels." },
      { name: "Iron Studies", description: "Iron status and anaemia screening." },
      { name: "Urine Routine", description: "Urinary system health." },
      { name: "Calcium & Phosphorus", description: "Bone health markers." },
    ],
  },
];

/* ── Colorful Icon Component ── */
function CategoryIcon({ id, className = "" }: { id: string; className?: string }) {
  const s = className || "size-8";
  const icons: Record<string, React.ReactElement> = {
    "full-body": (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="10" r="5" fill="#3B82F6" />
        <path d="M16 20h16l2 14H14l2-14z" fill="#60A5FA" />
        <path d="M18 34l-4 10h6l2-6" fill="#F59E0B" />
        <path d="M30 34l4 10h-6l-2-6" fill="#F59E0B" />
        <path d="M14 22l-6 4 3 2 5-3" fill="#10B981" />
        <path d="M34 22l6 4-3 2-5-3" fill="#10B981" />
      </svg>
    ),
    diabetes: (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <rect x="12" y="8" width="24" height="32" rx="4" fill="#3B82F6" />
        <rect x="16" y="12" width="16" height="14" rx="2" fill="#DBEAFE" />
        <text x="24" y="22" textAnchor="middle" fill="#1E40AF" fontSize="8" fontWeight="bold">120</text>
        <path d="M22 30h4v4h-4z" fill="#F59E0B" />
        <circle cx="24" cy="38" r="2" fill="#EF4444" />
      </svg>
    ),
    heart: (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <path d="M24 40S6 28 6 18c0-6 4-10 9-10 3 0 6 2 9 6 3-4 6-6 9-6 5 0 9 4 9 10 0 10-18 22-18 22z" fill="#EF4444" />
        <path d="M24 40S6 28 6 18c0-6 4-10 9-10 3 0 6 2 9 6" fill="#DC2626" />
        <path d="M18 20h12" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 16v8" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    blood: (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <path d="M24 6c-6 8-12 14-12 22a12 12 0 0024 0c0-8-6-14-12-22z" fill="#EF4444" />
        <path d="M24 6c-3 4-6 8-8 14" fill="#DC2626" />
        <ellipse cx="22" cy="26" rx="3" ry="4" fill="#FCA5A5" opacity="0.5" />
      </svg>
    ),
    vitamin: (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <rect x="10" y="16" width="12" height="20" rx="6" fill="#F59E0B" />
        <rect x="26" y="16" width="12" height="20" rx="6" fill="#10B981" />
        <rect x="10" y="16" width="12" height="10" rx="6" fill="#FBBF24" />
        <rect x="26" y="16" width="12" height="10" rx="6" fill="#34D399" />
        <circle cx="16" cy="22" r="2" fill="white" opacity="0.6" />
        <circle cx="32" cy="22" r="2" fill="white" opacity="0.6" />
      </svg>
    ),
    thyroid: (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <path d="M18 8c-4 0-7 4-7 10s3 12 7 14l-2 8h14l-2-8c4-2 7-8 7-14s-3-10-7-10-5 2-5 2-1-2-5-2z" fill="#A78BFA" />
        <path d="M18 8c-2 0-4 2-5 6" fill="#7C3AED" />
        <circle cx="22" cy="18" r="3" fill="white" opacity="0.4" />
        <circle cx="28" cy="22" r="2" fill="white" opacity="0.3" />
      </svg>
    ),
    kidney: (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <path d="M14 12c-6 0-10 5-10 12s4 14 10 14c2 0 4-2 4-6v-12c0-4-2-8-4-8z" fill="#B91C1C" />
        <path d="M34 12c6 0 10 5 10 12s-4 14-10 14c-2 0-4-2-4-6V20c0-4 2-8 4-8z" fill="#991B1B" />
        <path d="M18 18v12M30 18v12" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    liver: (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <path d="M8 20c0-8 6-14 14-14h4c6 0 10 4 12 10 2 6 0 14-6 18-4 2-8 2-12 0-6-4-12-6-12-14z" fill="#B45309" />
        <path d="M8 20c0-6 5-12 12-12" fill="#92400E" />
        <ellipse cx="22" cy="22" rx="6" ry="4" fill="#D97706" opacity="0.5" />
      </svg>
    ),
    "womens-health": (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="12" r="6" fill="#EC4899" />
        <path d="M16 22h16l2 16H14l2-16z" fill="#F472B6" />
        <circle cx="24" cy="38" r="4" fill="#F9A8D4" />
        <path d="M24 34v-8" stroke="white" strokeWidth="1.5" />
        <circle cx="24" cy="24" r="2" fill="white" opacity="0.5" />
      </svg>
    ),
    "senior-citizen": (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="10" r="5" fill="#6B7280" />
        <path d="M16 20h16l1 14H15l1-14z" fill="#9CA3AF" />
        <path d="M20 34l-3 10h4l1.5-6" fill="#6B7280" />
        <path d="M28 34l3 10h-4l-1.5-6" fill="#6B7280" />
        <path d="M15 24l-6 2" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" />
        <path d="M33 24l6 2" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" />
        <path d="M14 30l-4 4" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
        <path d="M34 30l4 4" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    "tax-saver": (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <rect x="8" y="14" width="32" height="24" rx="3" fill="#10B981" />
        <rect x="8" y="14" width="32" height="8" fill="#059669" />
        <circle cx="24" cy="26" r="5" fill="white" opacity="0.3" />
        <text x="24" y="30" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">₹</text>
        <path d="M14 14V10h20v4" stroke="#059669" strokeWidth="2" fill="none" />
      </svg>
    ),
    fever: (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <rect x="20" y="6" width="8" height="28" rx="4" fill="#FCD34D" />
        <circle cx="24" cy="38" r="6" fill="#EF4444" />
        <rect x="22" y="20" width="4" height="14" rx="2" fill="#EF4444" />
        <circle cx="24" cy="38" r="3" fill="#DC2626" />
        <text x="32" y="18" fill="#EF4444" fontSize="8" fontWeight="bold">°C</text>
      </svg>
    ),
    hormone: (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <rect x="16" y="6" width="16" height="30" rx="8" fill="#A78BFA" />
        <rect x="20" y="6" width="8" height="20" rx="4" fill="#7C3AED" />
        <circle cx="24" cy="22" r="3" fill="#DDD6FE" />
        <path d="M20 36l-6 8M28 36l6 8" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    hairfall: (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <ellipse cx="24" cy="22" rx="10" ry="12" fill="#FDE68A" />
        <path d="M14 16c-2-4 0-10 4-10 2 0 3 2 6 2s4-2 6-2c4 0 6 6 4 10" fill="#92400E" />
        <path d="M18 8c-1-3 1-6 3-6" stroke="#78350F" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M30 8c1-3-1-6-3-6" stroke="#78350F" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="20" cy="30" r="2" fill="#EF4444" />
        <circle cx="28" cy="32" r="1.5" fill="#EF4444" />
      </svg>
    ),
    dengue: (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="10" fill="#EF4444" />
        <circle cx="24" cy="24" r="7" fill="#FCA5A5" />
        <path d="M18 20l2 2-2 2" stroke="#7F1D1D" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M30 20l-2 2 2 2" stroke="#7F1D1D" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M21 28h6" stroke="#7F1D1D" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14 14l-4-4M34 14l4-4M14 34l-4 4M34 34l4 4" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    "bone-joint": (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <ellipse cx="16" cy="14" rx="6" ry="5" fill="#FEF3C7" stroke="#D97706" strokeWidth="1" />
        <rect x="14" y="14" width="4" height="16" rx="2" fill="#FEF3C7" stroke="#D97706" strokeWidth="1" />
        <ellipse cx="16" cy="34" rx="6" ry="5" fill="#FEF3C7" stroke="#D97706" strokeWidth="1" />
        <circle cx="16" cy="24" r="3" fill="#EF4444" opacity="0.4" />
        <ellipse cx="34" cy="16" rx="4" ry="4" fill="#FEF3C7" stroke="#D97706" strokeWidth="1" />
        <rect x="32" y="16" width="4" height="12" rx="2" fill="#FEF3C7" stroke="#D97706" strokeWidth="1" />
        <ellipse cx="34" cy="32" rx="4" ry="4" fill="#FEF3C7" stroke="#D97706" strokeWidth="1" />
      </svg>
    ),
    allergy: (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="12" fill="#FCD34D" />
        <path d="M24 14v20M14 24h20" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
        <path d="M18 18l12 12M30 18L18 30" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="12" r="3" fill="#EF4444" opacity="0.6" />
        <circle cx="36" cy="14" r="2" fill="#EF4444" opacity="0.4" />
      </svg>
    ),
    "sexual-wellness": (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <circle cx="20" cy="16" r="8" fill="#3B82F6" />
        <path d="M20 24v16" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" />
        <path d="M14 32h12" stroke="#3B82F6" strokeWidth="3" strokeLinecap="round" />
        <circle cx="32" cy="16" r="5" fill="#EC4899" />
        <path d="M32 21l-4 12M32 21l4 12" stroke="#EC4899" strokeWidth="2" strokeLinecap="round" />
        <path d="M32 21v8" stroke="#EC4899" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    immunity: (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <path d="M24 4L8 14v12c0 10 7 18 16 22 9-4 16-12 16-22V14L24 4z" fill="#10B981" />
        <path d="M24 4L8 14v12c0 10 7 18 16 22" fill="#059669" />
        <path d="M20 24l4 4 8-8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    "fever-infection": (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <circle cx="20" cy="20" r="10" fill="#F97316" />
        <circle cx="20" cy="20" r="6" fill="#FED7AA" />
        <rect x="28" y="10" width="6" height="20" rx="3" fill="#FCD34D" />
        <rect x="29" y="18" width="4" height="8" rx="2" fill="#EF4444" />
        <circle cx="36" cy="36" r="6" fill="#3B82F6" />
        <text x="36" y="39" textAnchor="middle" fill="white" fontSize="8" fontWeight="bold">+</text>
      </svg>
    ),
    reproductive: (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="18" r="6" fill="#EC4899" />
        <circle cx="24" cy="18" r="3" fill="#F9A8D4" />
        <path d="M20 24c-2 4-2 10 4 14 6-4 6-10 4-14" fill="#F472B6" />
        <circle cx="24" cy="32" r="3" fill="#FBBF24" />
        <path d="M16 12c-4-2-8 0-8 4s4 6 8 4" stroke="#A78BFA" strokeWidth="1.5" fill="none" />
        <path d="M32 12c4-2 8 0 8 4s-4 6-8 4" stroke="#A78BFA" strokeWidth="1.5" fill="none" />
      </svg>
    ),
    "cancer-screening": (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <path d="M24 4l4 8 8 2-6 6 2 8-8-4-8 4 2-8-6-6 8-2 4-8z" fill="#A78BFA" />
        <circle cx="24" cy="28" r="8" fill="#DDD6FE" />
        <path d="M21 28h6M24 25v6" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="36" r="4" fill="#F9A8D4" />
        <circle cx="36" cy="36" r="4" fill="#93C5FD" />
      </svg>
    ),
    hepatitis: (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <path d="M10 18c0-6 5-10 12-10h4c5 0 8 3 10 8 2 5 1 12-5 16-3 2-7 2-10 0-5-3-11-5-11-14z" fill="#F59E0B" />
        <path d="M10 18c0-4 4-8 10-8" fill="#D97706" />
        <circle cx="24" cy="24" r="4" fill="white" opacity="0.4" />
        <path d="M22 24h4M24 22v4" stroke="#92400E" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M36 32l6 6M42 32l-6 6" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    lungs: (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <path d="M24 8v12" stroke="#60A5FA" strokeWidth="3" strokeLinecap="round" />
        <path d="M24 14c-4 0-10 4-12 14-1 6 2 10 6 10s6-2 6-6V14z" fill="#93C5FD" />
        <path d="M24 14c4 0 10 4 12 14 1 6-2 10-6 10s-6-2-6-6V14z" fill="#60A5FA" />
        <path d="M20 18c-2 4-3 8-2 10" stroke="#3B82F6" strokeWidth="1" fill="none" />
        <path d="M28 18c2 4 3 8 2 10" stroke="#3B82F6" strokeWidth="1" fill="none" />
      </svg>
    ),
    weight: (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <ellipse cx="24" cy="32" rx="14" ry="6" fill="#D1D5DB" />
        <path d="M14 20c0-6 4-12 10-12s10 6 10 12" fill="#F59E0B" />
        <path d="M24 8v10" stroke="#D97706" strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="18" r="3" fill="white" opacity="0.5" />
        <path d="M18 32l6-12 6 12" fill="#FBBF24" />
      </svg>
    ),
    iron: (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <path d="M24 8c-6 8-10 14-10 20a10 10 0 0020 0c0-6-4-12-10-20z" fill="#EF4444" />
        <path d="M24 8c-3 4-6 8-8 14" fill="#DC2626" />
        <text x="24" y="30" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">Fe</text>
      </svg>
    ),
    covid: (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="10" fill="#10B981" />
        <circle cx="24" cy="24" r="6" fill="#34D399" />
        <path d="M24 10V6M24 42v-4M10 24H6M42 24h-4M14 14l-3-3M37 37l-3-3M34 14l3-3M11 37l3-3" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
        <circle cx="24" cy="24" r="2" fill="white" opacity="0.5" />
      </svg>
    ),
    pcod: (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <ellipse cx="24" cy="26" rx="12" ry="10" fill="#F9A8D4" />
        <circle cx="20" cy="24" r="3" fill="#EC4899" />
        <circle cx="28" cy="28" r="2" fill="#EC4899" />
        <circle cx="24" cy="22" r="2.5" fill="#EC4899" />
        <circle cx="18" cy="30" r="1.5" fill="#EC4899" />
        <circle cx="30" cy="24" r="1.5" fill="#EC4899" />
        <path d="M24 8c-2 4-2 8 0 12" stroke="#A78BFA" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 8c1 3 1 7 0 10" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M28 8c-1 3-1 7 0 10" stroke="#A78BFA" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    "healthy-2024": (
      <svg className={s} viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="16" fill="#10B981" />
        <circle cx="24" cy="24" r="12" fill="#34D399" />
        <path d="M18 24l4 4 8-8" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="24" cy="24" r="16" fill="none" stroke="#059669" strokeWidth="2" strokeDasharray="4 4" />
      </svg>
    ),
  };
  return icons[id] || <div className={`${s} rounded-full bg-primary/20`} />;
}

/* ── Modal Component ── */
function CategoryModal({
  category,
  onClose,
}: {
  category: HealthCategory;
  onClose: () => void;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 p-6 pb-4">
          <div className="flex-1 pr-4">
            <h2 className="text-xl font-bold text-gray-900">{category.name}</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-gray-500">
              {category.description}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable Tests */}
        <div className="flex-1 overflow-y-auto p-6 pt-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Included Tests ({category.tests.length})
          </p>
          <div className="space-y-3">
            {category.tests.map((test) => (
              <div
                key={test.name}
                className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-3.5"
              >
                <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                  <Check className="size-3" strokeWidth={3} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{test.name}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
                    {test.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer — Price + CTA */}
        <div className="border-t border-gray-100 p-6 pt-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-sm text-gray-400 line-through mr-2">
                ₹{category.originalPrice.toLocaleString("en-IN")}
              </span>
              <span className="text-2xl font-extrabold text-gray-900">
                ₹{category.discountedPrice.toLocaleString("en-IN")}
              </span>
            </div>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-600">
              {category.discountPercent}% OFF
            </span>
          </div>
          <button
            onClick={() => {
              onClose();
              navigate("/cart");
            }}
            className="w-full rounded-xl bg-[#0a3d2e] py-3 text-sm font-bold text-white hover:bg-[#082f23] transition-colors"
          >
            Book This Test
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function LabTests() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<HealthCategory | null>(null);

  const handleClose = useCallback(() => setSelectedCategory(null), []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 sm:py-14">
        {/* Back */}
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-6"
        >
          <ArrowLeft className="size-4" />
          Back to Home
        </button>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 mb-2">
          Doctor Created Health Check
        </h1>
        <p className="text-sm text-gray-500 mb-8">
          Expert-curated health packages designed by doctors for comprehensive wellness screening.
        </p>

        {/* Category Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className="relative flex items-center gap-2.5 rounded-lg border border-gray-200 bg-white p-3 text-left transition-all duration-200 hover:shadow-md hover:border-gray-300 cursor-pointer group"
            >
              {/* Icon */}
              <div className="relative size-10 shrink-0">
                <CategoryIcon id={cat.id} className="size-10" />
                {/* Orange discount badge */}
                <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-[#F5A623] text-[7px] font-bold text-white shadow-sm">
                  {cat.discountPercent}%
                </span>
              </div>

              {/* Name */}
              <span className="text-[11px] sm:text-xs font-semibold leading-tight text-gray-700 group-hover:text-gray-900 transition-colors line-clamp-2">
                {cat.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Modal */}
      {selectedCategory && (
        <CategoryModal category={selectedCategory} onClose={handleClose} />
      )}
    </div>
  );
}
