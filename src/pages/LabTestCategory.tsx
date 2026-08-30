import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ArrowLeft, X, SlidersHorizontal, ShoppingCart, Check, FlaskConical, Beaker, Heart, Shield, Stethoscope, Pill, Activity, Calendar, MapPin, Clock, AlertTriangle, Loader2 } from "lucide-react";

/* ── Types ── */
interface IncludedTest {
  name: string;
  description: string;
}
interface LabTestItem {
  id: string;
  name: string;
  type: "single" | "package";
  includedTests: IncludedTest[];
  includedTestCount: number;
  originalPrice: number;
  discountedPrice: number;
  discountPercentage: number;
  badges?: string[];
  promotionalText?: string;
  icon?: string;
  _isFromDB?: boolean;
  _convexId?: string;
}
interface CategoryData {
  id: string;
  name: string;
  slug: string;
  description: string;
  items: LabTestItem[];
}

/* ── Category Data (all 29 categories) ── */
const ALL_CATEGORIES: CategoryData[] = [
  {
    id: "full-body",
    name: "Full Body Checkup",
    slug: "full-body",
    description: "Comprehensive health checkups covering all major organ systems.",
    items: [
      { id: "fb-1", name: "Full Body Checkup Advanced", type: "package", includedTests: [{ name: "CBC", description: "Complete blood count" }, { name: "Lipid Profile", description: "Cholesterol and triglycerides" }, { name: "LFT", description: "Liver function assessment" }, { name: "KFT", description: "Kidney function assessment" }, { name: "Thyroid Profile", description: "Thyroid hormones" }, { name: "HbA1c", description: "Average blood sugar" }, { name: "Vitamin D", description: "Vitamin D levels" }, { name: "Vitamin B12", description: "B12 levels" }, { name: "Urine Routine", description: "Urinalysis" }, { name: "Iron Studies", description: "Iron status" }, { name: "Calcium", description: "Bone health" }, { name: "Glucose Fasting", description: "Blood sugar" }], includedTestCount: 12, originalPrice: 3999, discountedPrice: 1599, discountPercentage: 60, badges: ["BEST PRICE EVER!"] },
      { id: "fb-2", name: "Full Body Checkup Basic", type: "package", includedTests: [{ name: "CBC", description: "Complete blood count" }, { name: "LFT", description: "Liver function" }, { name: "KFT", description: "Kidney function" }, { name: "Glucose Fasting", description: "Blood sugar" }, { name: "Lipid Profile", description: "Cholesterol" }, { name: "Urine Routine", description: "Urinalysis" }], includedTestCount: 6, originalPrice: 2499, discountedPrice: 999, discountPercentage: 60 },
      { id: "fb-3", name: "Full Body Checkup Premium", type: "package", includedTests: [{ name: "CBC", description: "Complete blood count" }, { name: "Lipid Profile", description: "Cholesterol panel" }, { name: "LFT", description: "Liver function" }, { name: "KFT", description: "Kidney function" }, { name: "Thyroid Profile", description: "TSH T3 T4" }, { name: "HbA1c", description: "Blood sugar average" }, { name: "Vitamin D", description: "Vitamin D" }, { name: "Vitamin B12", description: "B12" }, { name: "Iron Studies", description: "Iron status" }, { name: "Calcium", description: "Calcium" }, { name: "Urine Routine", description: "Urinalysis" }, { name: "Cardiac Risk Markers", description: "Heart risk" }, { name: "Hepatitis B", description: "Hep B screening" }, { name: "Hb", description: "Haemoglobin" }, { name: "PSA", description: "Prostate marker" }, { name: "Cortisol", description: "Stress hormone" }, { name: "Homocysteine", description: "Heart risk marker" }, { name: "hs-CRP", description: "Inflammation" }, { name: "Liver Enzymes", description: "SGPT SGOT" }, { name: "Magnesium", description: "Mineral" }], includedTestCount: 20, originalPrice: 5999, discountedPrice: 2399, discountPercentage: 60, badges: ["10-Hour Report Guarantee"] },
      { id: "fb-4", name: "Essential Full Body", type: "single", includedTests: [{ name: "CBC", description: "Complete blood count screening" }], includedTestCount: 1, originalPrice: 800, discountedPrice: 349, discountPercentage: 56 },
      { id: "fb-5", name: "Annual Health Package", type: "package", includedTests: [{ name: "CBC", description: "Blood count" }, { name: "Thyroid Profile", description: "Thyroid" }, { name: "LFT", description: "Liver" }, { name: "KFT", description: "Kidney" }, { name: "Lipid Profile", description: "Heart" }, { name: "HbA1c", description: "Diabetes" }, { name: "Vitamin D", description: "Vitamin" }, { name: "Urine Routine", description: "Urinalysis" }], includedTestCount: 8, originalPrice: 3499, discountedPrice: 1399, discountPercentage: 60, promotionalText: "Buy 2, Get EXTRA OFF!" },
    ],
  },
  {
    id: "diabetes",
    name: "Diabetes",
    slug: "diabetes",
    description: "Tests to screen, monitor, and manage diabetes and pre-diabetic conditions.",
    items: [
      { id: "db-1", name: "Diabetes Panel", type: "package", includedTests: [{ name: "Fasting Blood Sugar", description: "Blood glucose after overnight fast" }, { name: "Post-Prandial Blood Sugar", description: "Blood glucose 2 hours after meal" }, { name: "HbA1c", description: "Average blood sugar over 3 months" }, { name: "Urine Sugar", description: "Sugar in urine" }, { name: "Insulin Fasting", description: "Insulin levels" }], includedTestCount: 5, originalPrice: 1499, discountedPrice: 599, discountPercentage: 60, badges: ["BEST PRICE EVER!"] },
      { id: "db-2", name: "HbA1c Test", type: "single", includedTests: [{ name: "HbA1c", description: "Average blood glucose over 2-3 months" }], includedTestCount: 1, originalPrice: 800, discountedPrice: 299, discountPercentage: 63 },
      { id: "db-3", name: "Fasting Blood Sugar", type: "single", includedTests: [{ name: "Fasting Blood Sugar", description: "Blood glucose after overnight fast" }], includedTestCount: 1, originalPrice: 400, discountedPrice: 149, discountPercentage: 63 },
      { id: "db-4", name: "Diabetes Comprehensive", type: "package", includedTests: [{ name: "Fasting Blood Sugar", description: "Blood glucose fasting" }, { name: "Post-Prandial Blood Sugar", description: "Blood glucose PP" }, { name: "HbA1c", description: "Glycated haemoglobin" }, { name: "Insulin Fasting", description: "Fasting insulin" }, { name: "C-Peptide", description: "Pancreatic function" }, { name: "Lipid Profile", description: "Cholesterol panel" }, { name: "Urine Sugar", description: "Urine glucose" }, { name: "Urine Microalbumin", description: "Early kidney damage" }], includedTestCount: 8, originalPrice: 2999, discountedPrice: 1199, discountPercentage: 60 },
    ],
  },
  {
    id: "heart",
    name: "Heart",
    slug: "heart",
    description: "Cardiac screening to assess heart health and cardiovascular risk factors.",
    items: [
      { id: "ht-1", name: "Heart Health Package", type: "package", includedTests: [{ name: "Lipid Profile", description: "Cholesterol and triglycerides" }, { name: "hs-CRP", description: "Inflammation marker" }, { name: "Homocysteine", description: "Heart risk marker" }, { name: "Troponin I", description: "Heart muscle damage" }, { name: "BNP", description: "Heart failure marker" }, { name: "CBC", description: "Blood count" }], includedTestCount: 6, originalPrice: 2499, discountedPrice: 999, discountPercentage: 60, badges: ["10-Hour Report Guarantee"] },
      { id: "ht-2", name: "Lipid Profile", type: "single", includedTests: [{ name: "Lipid Profile", description: "Total cholesterol, HDL, LDL, triglycerides" }], includedTestCount: 1, originalPrice: 800, discountedPrice: 299, discountPercentage: 63 },
      { id: "ht-3", name: "Cardiac Risk Markers", type: "package", includedTests: [{ name: "hs-CRP", description: "High-sensitivity C-reactive protein" }, { name: "Homocysteine", description: "Amino acid linked to heart risk" }, { name: "Lipid Profile", description: "Cholesterol panel" }], includedTestCount: 3, originalPrice: 1499, discountedPrice: 599, discountPercentage: 60 },
      { id: "ht-4", name: "Complete Heart Panel", type: "package", includedTests: [{ name: "Lipid Profile", description: "Cholesterol" }, { name: "hs-CRP", description: "Inflammation" }, { name: "Troponin I", description: "Heart damage" }, { name: "BNP", description: "Heart failure" }, { name: "CK-MB", description: "Cardiac enzyme" }, { name: "Homocysteine", description: "Risk marker" }, { name: "CBC", description: "Blood count" }, { name: "HbA1c", description: "Blood sugar" }], includedTestCount: 8, originalPrice: 3499, discountedPrice: 1399, discountPercentage: 60, promotionalText: "Buy 2, Get EXTRA OFF!" },
    ],
  },
  {
    id: "blood",
    name: "Blood Studies",
    slug: "blood",
    description: "Detailed blood analysis to evaluate health and detect blood disorders.",
    items: [
      { id: "bl-1", name: "Complete Blood Count", type: "single", includedTests: [{ name: "CBC", description: "Red blood cells, white blood cells, haemoglobin, platelets" }], includedTestCount: 1, originalPrice: 600, discountedPrice: 199, discountPercentage: 67, badges: ["10-Hour Report Guarantee"] },
      { id: "bl-2", name: "Blood Studies Panel", type: "package", includedTests: [{ name: "CBC", description: "Complete blood count" }, { name: "ESR", description: "Inflammation marker" }, { name: "Blood Grouping", description: "ABO and Rh" }, { name: "Peripheral Smear", description: "Blood cell morphology" }, { name: "Iron Studies", description: "Iron status" }], includedTestCount: 5, originalPrice: 1599, discountedPrice: 599, discountPercentage: 63 },
      { id: "bl-3", name: "ESR Test", type: "single", includedTests: [{ name: "ESR", description: "Erythrocyte sedimentation rate" }], includedTestCount: 1, originalPrice: 400, discountedPrice: 149, discountPercentage: 63 },
      { id: "bl-4", name: "Blood Iron Panel", type: "package", includedTests: [{ name: "CBC", description: "Blood count" }, { name: "Iron Studies", description: "Iron, ferritin, TIBC" }, { name: "Reticulocyte Count", description: "New red blood cell production" }], includedTestCount: 3, originalPrice: 1299, discountedPrice: 499, discountPercentage: 62 },
    ],
  },
  {
    id: "vitamin",
    name: "Vitamin",
    slug: "vitamin",
    description: "Essential vitamin panels to detect deficiencies affecting energy and immunity.",
    items: [
      { id: "vt-1", name: "Vitamin C Test", type: "single", includedTests: [{ name: "Vitamin C", description: "Ascorbic acid levels" }], includedTestCount: 1, originalPrice: 12721, discountedPrice: 5149, discountPercentage: 60 },
      { id: "vt-2", name: "Vitamin E Test", type: "single", includedTests: [{ name: "Vitamin E", description: "Tocopherol levels" }], includedTestCount: 1, originalPrice: 11823, discountedPrice: 4729, discountPercentage: 60 },
      { id: "vt-3", name: "Vitamin & Deficiency Panel - Advanced", type: "package", includedTests: [{ name: "Vitamin D", description: "25-OH Vitamin D" }, { name: "Vitamin B12", description: "Cobalamin levels" }, { name: "Vitamin B9", description: "Folate levels" }, { name: "Iron Studies", description: "Iron status" }, { name: "Calcium", description: "Serum calcium" }, { name: "Ferritin", description: "Iron stores" }, { name: "CBC", description: "Blood count" }, { name: "Magnesium", description: "Mineral" }, { name: "Zinc", description: "Trace element" }, { name: "Phosphorus", description: "Bone mineral" }, { name: "Vitamin A", description: "Retinol levels" }, { name: "Vitamin B6", description: "Pyridoxine" }, { name: "Vitamin B1", description: "Thiamine" }, { name: "Vitamin K", description: "Clotting vitamin" }, { name: "Copper", description: "Trace element" }, { name: "Selenium", description: "Antioxidant mineral" }, { name: "Folate RBC", description: "Red cell folate" }, { name: "Homocysteine", description: "B-vitamin marker" }, { name: "Manganese", description: "Trace element" }, { name: "Chromium", description: "Trace element" }, { name: "Molybdenum", description: "Trace element" }, { name: "Boron", description: "Trace element" }, { name: "Iodine", description: "Thyroid mineral" }, { name: "Vitamin D3", description: "Active form" }, { name: "Vitamin D2", description: "Ergocalciferol" }, { name: "Beta Carotene", description: "Provitamin A" }, { name: "Vitamin B2", description: "Riboflavin" }, { name: "Vitamin B7", description: "Biotin" }, { name: "Vitamin C", description: "Ascorbic acid" }, { name: "Vitamin E", description: "Tocopherol" }, { name: "Vitamin K2", description: "Menquinone" }, { name: "CoQ10", description: "Coenzyme Q10" }, { name: "Omega 3", description: "Fatty acids" }, { name: "Omega 6", description: "Fatty acids" }, { name: "Omega 9", description: "Fatty acids" }, { name: "DHA", description: "Docosahexaenoic acid" }, { name: "EPA", description: "Eicosapentaenoic acid" }, { name: "ALA", description: "Alpha-linolenic acid" }, { name: "Vitamin E Alpha", description: "Alpha tocopherol" }, { name: "Vitamin E Gamma", description: "Gamma tocopherol" }, { name: "Vitamin D Total", description: "Total vitamin D" }], includedTestCount: 41, originalPrice: 9798, discountedPrice: 3919, discountPercentage: 60, badges: ["BEST PRICE EVER!"], promotionalText: "Buy 2, Get EXTRA OFF!" },
      { id: "vt-4", name: "Vitamin & Deficiency Panel - Essential", type: "package", includedTests: [{ name: "Vitamin D", description: "25-OH Vitamin D" }, { name: "Vitamin B12", description: "Cobalamin" }, { name: "Iron Studies", description: "Iron status" }, { name: "Calcium", description: "Serum calcium" }, { name: "CBC", description: "Blood count" }, { name: "Ferritin", description: "Iron stores" }, { name: "Magnesium", description: "Mineral" }, { name: "Phosphorus", description: "Bone mineral" }, { name: "Zinc", description: "Trace element" }, { name: "Folate", description: "B9 levels" }, { name: "Vitamin B6", description: "Pyridoxine" }, { name: "Vitamin A", description: "Retinol" }, { name: "Vitamin B1", description: "Thiamine" }, { name: "Vitamin K", description: "Clotting vitamin" }, { name: "Copper", description: "Trace element" }, { name: "Selenium", description: "Antioxidant mineral" }, { name: "Folate RBC", description: "Red cell folate" }, { name: "Homocysteine", description: "B-vitamin marker" }, { name: "Manganese", description: "Trace element" }, { name: "Chromium", description: "Trace element" }, { name: "Molybdenum", description: "Trace element" }, { name: "Boron", description: "Trace element" }, { name: "Iodine", description: "Thyroid mineral" }, { name: "Vitamin D3", description: "Active form" }, { name: "Vitamin D2", description: "Ergocalciferol" }, { name: "Beta Carotene", description: "Provitamin A" }, { name: "Vitamin B2", description: "Riboflavin" }, { name: "Vitamin B7", description: "Biotin" }, { name: "Vitamin C", description: "Ascorbic acid" }, { name: "Vitamin E", description: "Tocopherol" }, { name: "Vitamin K2", description: "Menquinone" }, { name: "CoQ10", description: "Coenzyme Q10" }, { name: "Omega 3", description: "Fatty acids" }, { name: "Omega 6", description: "Fatty acids" }, { name: "Omega 9", description: "Fatty acids" }, { name: "DHA", description: "DHA" }], includedTestCount: 36, originalPrice: 8997, discountedPrice: 3599, discountPercentage: 60, promotionalText: "Buy 2, Get EXTRA OFF!" },
      { id: "vt-5", name: "Vitamin & Deficiency Panel Basic", type: "package", includedTests: [{ name: "Vitamin D", description: "25-OH Vitamin D" }, { name: "Vitamin B12", description: "Cobalamin" }, { name: "Iron Studies", description: "Iron status" }], includedTestCount: 3, originalPrice: 5672, discountedPrice: 2269, discountPercentage: 60, badges: ["BEST PRICE EVER!"] },
      { id: "vt-6", name: "Vitamin D Test", type: "single", includedTests: [{ name: "Vitamin D", description: "25-Hydroxy Vitamin D" }], includedTestCount: 1, originalPrice: 5373, discountedPrice: 2149, discountPercentage: 60 },
      { id: "vt-7", name: "Vitamin B12 Test", type: "single", includedTests: [{ name: "Vitamin B12", description: "Cobalamin levels" }], includedTestCount: 1, originalPrice: 3948, discountedPrice: 1579, discountPercentage: 60, badges: ["10-Hour Report Guarantee"] },
      { id: "vt-8", name: "Calcium Test", type: "single", includedTests: [{ name: "Calcium", description: "Serum calcium" }], includedTestCount: 1, originalPrice: 823, discountedPrice: 329, discountPercentage: 60, badges: ["10-Hour Report Guarantee"] },
    ],
  },
  {
    id: "thyroid",
    name: "Thyroid",
    slug: "thyroid",
    description: "Complete thyroid screening for hypothyroidism and hyperthyroidism.",
    items: [
      { id: "ty-1", name: "Thyroid Profile (T3 T4 TSH)", type: "single", includedTests: [{ name: "T3", description: "Triiodothyronine" }, { name: "T4", description: "Thyroxine" }, { name: "TSH", description: "Thyroid stimulating hormone" }], includedTestCount: 3, originalPrice: 999, discountedPrice: 399, discountPercentage: 60, badges: ["10-Hour Report Guarantee"] },
      { id: "ty-2", name: "Thyroid Comprehensive Panel", type: "package", includedTests: [{ name: "TSH", description: "Thyroid stimulating hormone" }, { name: "Free T3", description: "Active thyroid hormone" }, { name: "Free T4", description: "Thyroid hormone" }, { name: "Anti-TPO", description: "Thyroid antibodies" }, { name: "Thyroglobulin", description: "Thyroid protein" }], includedTestCount: 5, originalPrice: 1999, discountedPrice: 799, discountPercentage: 60 },
      { id: "ty-3", name: "TSH Test", type: "single", includedTests: [{ name: "TSH", description: "Thyroid stimulating hormone" }], includedTestCount: 1, originalPrice: 500, discountedPrice: 199, discountPercentage: 60 },
      { id: "ty-4", name: "Thyroid Plus Vitamin", type: "package", includedTests: [{ name: "TSH", description: "Thyroid hormone" }, { name: "Free T3", description: "Active thyroid" }, { name: "Free T4", description: "Thyroid hormone" }, { name: "Vitamin D", description: "Vitamin D" }, { name: "Vitamin B12", description: "B12" }], includedTestCount: 5, originalPrice: 2499, discountedPrice: 999, discountPercentage: 60 },
    ],
  },
  {
    id: "kidney",
    name: "Kidney",
    slug: "kidney",
    description: "Kidney function assessment to detect early kidney damage and disease.",
    items: [
      { id: "kd-1", name: "Kidney Function Test", type: "single", includedTests: [{ name: "Creatinine", description: "Kidney filtration marker" }, { name: "Blood Urea", description: "Urea nitrogen" }, { name: "eGFR", description: "Kidney function estimate" }], includedTestCount: 3, originalPrice: 800, discountedPrice: 299, discountPercentage: 63, badges: ["10-Hour Report Guarantee"] },
      { id: "kd-2", name: "KFT with Electrolytes", type: "package", includedTests: [{ name: "Creatinine", description: "Kidney marker" }, { name: "Blood Urea", description: "Urea nitrogen" }, { name: "eGFR", description: "Kidney function" }, { name: "Sodium", description: "Electrolyte" }, { name: "Potassium", description: "Electrolyte" }, { name: "Chloride", description: "Electrolyte" }], includedTestCount: 6, originalPrice: 1299, discountedPrice: 499, discountPercentage: 62 },
      { id: "kd-3", name: "Kidney Comprehensive Panel", type: "package", includedTests: [{ name: "Creatinine", description: "Kidney marker" }, { name: "Blood Urea", description: "Urea nitrogen" }, { name: "eGFR", description: "Kidney function" }, { name: "Uric Acid", description: "Gout and kidney" }, { name: "Urine Microalbumin", description: "Early kidney damage" }, { name: "Cystatin C", description: "Precise kidney marker" }, { name: "Electrolytes", description: "Na K Cl" }], includedTestCount: 7, originalPrice: 2499, discountedPrice: 999, discountPercentage: 60 },
    ],
  },
  {
    id: "liver",
    name: "Liver",
    slug: "liver",
    description: "Liver function evaluation to detect hepatitis, fatty liver, and liver conditions.",
    items: [
      { id: "lv-1", name: "Liver Function Test", type: "single", includedTests: [{ name: "SGPT", description: "Liver enzyme" }, { name: "SGOT", description: "Liver enzyme" }, { name: "ALP", description: "Liver enzyme" }, { name: "Bilirubin", description: "Liver marker" }, { name: "Albumin", description: "Liver protein" }], includedTestCount: 5, originalPrice: 999, discountedPrice: 399, discountPercentage: 60, badges: ["10-Hour Report Guarantee"] },
      { id: "lv-2", name: "Liver Comprehensive Panel", type: "package", includedTests: [{ name: "SGPT", description: "ALT enzyme" }, { name: "SGOT", description: "AST enzyme" }, { name: "ALP", description: "Alkaline phosphatase" }, { name: "GGT", description: "Gamma GT" }, { name: "Total Bilirubin", description: "Bilirubin" }, { name: "Direct Bilirubin", description: "Conjugated bilirubin" }, { name: "Albumin", description: "Liver protein" }, { name: "Total Protein", description: "Protein levels" }], includedTestCount: 8, originalPrice: 1999, discountedPrice: 799, discountPercentage: 60 },
      { id: "lv-3", name: "Fatty Liver Screening", type: "package", includedTests: [{ name: "SGPT", description: "Liver enzyme" }, { name: "GGT", description: "Gamma GT" }, { name: "Lipid Profile", description: "Cholesterol" }, { name: "Blood Glucose", description: "Sugar levels" }], includedTestCount: 4, originalPrice: 1499, discountedPrice: 599, discountPercentage: 60 },
    ],
  },
  {
    id: "womens-health",
    name: "Women's Health",
    slug: "womens-health",
    description: "Health screening tailored for women covering hormonal, reproductive, and wellness markers.",
    items: [
      { id: "wh-1", name: "Women's Wellness Panel", type: "package", includedTests: [{ name: "CBC", description: "Blood count" }, { name: "Thyroid Profile", description: "Thyroid" }, { name: "Iron Studies", description: "Iron" }, { name: "Vitamin D", description: "Vitamin" }, { name: "Blood Glucose", description: "Sugar" }, { name: "Calcium", description: "Bone health" }, { name: "Lipid Profile", description: "Heart" }], includedTestCount: 7, originalPrice: 2499, discountedPrice: 999, discountPercentage: 60, badges: ["BEST PRICE EVER!"] },
      { id: "wh-2", name: "Iron Deficiency Panel", type: "package", includedTests: [{ name: "CBC", description: "Blood count" }, { name: "Iron Studies", description: "Iron status" }, { name: "Ferritin", description: "Iron stores" }, { name: "Vitamin B12", description: "B12" }], includedTestCount: 4, originalPrice: 1499, discountedPrice: 599, discountPercentage: 60 },
      { id: "wh-3", name: "Thyroid for Women", type: "single", includedTests: [{ name: "TSH", description: "Thyroid stimulating hormone" }], includedTestCount: 1, originalPrice: 500, discountedPrice: 199, discountPercentage: 60 },
    ],
  },
  {
    id: "senior-citizen",
    name: "Senior Citizen",
    slug: "senior-citizen",
    description: "Specialised screening for seniors covering age-related and chronic conditions.",
    items: [
      { id: "sc-1", name: "Senior Citizen Comprehensive", type: "package", includedTests: [{ name: "CBC", description: "Blood count" }, { name: "Lipid Profile", description: "Heart" }, { name: "KFT", description: "Kidney" }, { name: "LFT", description: "Liver" }, { name: "Thyroid Profile", description: "Thyroid" }, { name: "HbA1c", description: "Diabetes" }, { name: "Vitamin D", description: "Bone health" }, { name: "Vitamin B12", description: "Nerve function" }, { name: "PSA", description: "Prostate" }, { name: "Urine Routine", description: "Urinalysis" }], includedTestCount: 10, originalPrice: 3999, discountedPrice: 1599, discountPercentage: 60, badges: ["BEST PRICE EVER!"] },
      { id: "sc-2", name: "Heart & Diabetes Panel", type: "package", includedTests: [{ name: "Lipid Profile", description: "Cholesterol" }, { name: "HbA1c", description: "Blood sugar" }, { name: "Fasting Blood Sugar", description: "Glucose" }, { name: "ECG", description: "Heart rhythm" }], includedTestCount: 4, originalPrice: 1999, discountedPrice: 799, discountPercentage: 60 },
    ],
  },
  {
    id: "tax-saver",
    name: "Tax Saver",
    slug: "tax-saver",
    description: "Preventive health checkup eligible for tax benefits under Section 80D.",
    items: [
      { id: "ts-1", name: "Tax Saver Package", type: "package", includedTests: [{ name: "CBC", description: "Blood count" }, { name: "Fasting Blood Sugar", description: "Diabetes" }, { name: "Lipid Profile", description: "Heart" }, { name: "LFT", description: "Liver" }, { name: "KFT", description: "Kidney" }, { name: "TSH", description: "Thyroid" }, { name: "Urine Routine", description: "Urinalysis" }], includedTestCount: 7, originalPrice: 1999, discountedPrice: 699, discountPercentage: 65, badges: ["BEST PRICE EVER!"] },
      { id: "ts-2", name: "Tax Saver Basic", type: "package", includedTests: [{ name: "CBC", description: "Blood count" }, { name: "Fasting Blood Sugar", description: "Glucose" }, { name: "Lipid Profile", description: "Cholesterol" }, { name: "Urine Routine", description: "Urinalysis" }], includedTestCount: 4, originalPrice: 1299, discountedPrice: 499, discountPercentage: 62 },
    ],
  },
  {
    id: "fever",
    name: "Fever",
    slug: "fever",
    description: "Tests to identify the cause of persistent or recurring fever.",
    items: [
      { id: "fv-1", name: "Fever Panel", type: "package", includedTests: [{ name: "CBC", description: "Blood count" }, { name: "ESR", description: "Inflammation" }, { name: "Malaria Test", description: "Malaria screening" }, { name: "Widal Test", description: "Typhoid screening" }, { name: "CRP", description: "Inflammation marker" }], includedTestCount: 5, originalPrice: 1499, discountedPrice: 599, discountPercentage: 60 },
      { id: "fv-2", name: "Malaria Test", type: "single", includedTests: [{ name: "Malaria Parasite", description: "Malaria screening" }], includedTestCount: 1, originalPrice: 500, discountedPrice: 199, discountPercentage: 60 },
      { id: "fv-3", name: "Typhoid Test", type: "single", includedTests: [{ name: "Widal Test", description: "Typhoid screening" }], includedTestCount: 1, originalPrice: 500, discountedPrice: 199, discountPercentage: 60 },
    ],
  },
  {
    id: "hormone",
    name: "Hormone Screening",
    slug: "hormone",
    description: "Comprehensive hormone panel to evaluate endocrine function and imbalances.",
    items: [
      { id: "hm-1", name: "Hormone Panel", type: "package", includedTests: [{ name: "Thyroid Panel", description: "TSH T3 T4" }, { name: "Testosterone", description: "Male hormone" }, { name: "Cortisol", description: "Stress hormone" }, { name: "Insulin Fasting", description: "Insulin" }, { name: "FSH", description: "Reproductive hormone" }, { name: "LH", description: "Reproductive hormone" }, { name: "Prolactin", description: "Pituitary hormone" }], includedTestCount: 7, originalPrice: 2999, discountedPrice: 1199, discountPercentage: 60, badges: ["BEST PRICE EVER!"] },
      { id: "hm-2", name: "Testosterone Test", type: "single", includedTests: [{ name: "Testosterone", description: "Total testosterone levels" }], includedTestCount: 1, originalPrice: 800, discountedPrice: 299, discountPercentage: 63 },
      { id: "hm-3", name: "Cortisol Test", type: "single", includedTests: [{ name: "Cortisol", description: "Stress hormone levels" }], includedTestCount: 1, originalPrice: 700, discountedPrice: 299, discountPercentage: 57 },
    ],
  },
  {
    id: "hairfall",
    name: "Hairfall",
    slug: "hairfall",
    description: "Diagnostic tests to identify the root cause of excessive hair loss.",
    items: [
      { id: "hf-1", name: "Hairfall Panel", type: "package", includedTests: [{ name: "Thyroid Profile", description: "Thyroid" }, { name: "Iron Studies", description: "Iron" }, { name: "Ferritin", description: "Iron stores" }, { name: "Vitamin D", description: "Vitamin" }, { name: "Vitamin B12", description: "B12" }, { name: "Zinc", description: "Mineral" }, { name: "CBC", description: "Blood count" }], includedTestCount: 7, originalPrice: 2499, discountedPrice: 999, discountPercentage: 60, badges: ["BEST PRICE EVER!"] },
      { id: "hf-2", name: "Vitamin D Test", type: "single", includedTests: [{ name: "Vitamin D", description: "25-OH Vitamin D" }], includedTestCount: 1, originalPrice: 1500, discountedPrice: 599, discountPercentage: 60 },
      { id: "hf-3", name: "Ferritin Test", type: "single", includedTests: [{ name: "Ferritin", description: "Iron storage protein" }], includedTestCount: 1, originalPrice: 800, discountedPrice: 299, discountPercentage: 63 },
    ],
  },
  {
    id: "dengue",
    name: "Dengue",
    slug: "dengue",
    description: "Tests for early detection and monitoring of dengue fever infection.",
    items: [
      { id: "dg-1", name: "Dengue Panel", type: "package", includedTests: [{ name: "NS1 Antigen", description: "Early dengue detection" }, { name: "IgM Antibody", description: "Recent infection" }, { name: "IgG Antibody", description: "Past exposure" }, { name: "CBC", description: "Blood count" }, { name: "Platelet Count", description: "Platelet monitoring" }], includedTestCount: 5, originalPrice: 1999, discountedPrice: 799, discountPercentage: 60 },
      { id: "dg-2", name: "Dengue NS1 Antigen", type: "single", includedTests: [{ name: "NS1 Antigen", description: "Early dengue detection" }], includedTestCount: 1, originalPrice: 800, discountedPrice: 349, discountPercentage: 56 },
      { id: "dg-3", name: "Dengue IgM Test", type: "single", includedTests: [{ name: "Dengue IgM", description: "Recent dengue infection" }], includedTestCount: 1, originalPrice: 600, discountedPrice: 249, discountPercentage: 58 },
    ],
  },
  {
    id: "bone-joint",
    name: "Bone and Joint",
    slug: "bone-joint",
    description: "Tests to evaluate bone health, joint inflammation, and musculoskeletal conditions.",
    items: [
      { id: "bj-1", name: "Bone & Joint Panel", type: "package", includedTests: [{ name: "Calcium", description: "Bone mineral" }, { name: "Vitamin D", description: "Bone health" }, { name: "Phosphorus", description: "Bone mineral" }, { name: "ALP", description: "Bone enzyme" }, { name: "Uric Acid", description: "Gout marker" }, { name: "CRP", description: "Inflammation" }, { name: "ESR", description: "Inflammation" }], includedTestCount: 7, originalPrice: 1999, discountedPrice: 799, discountPercentage: 60 },
      { id: "bj-2", name: "Rheumatoid Panel", type: "package", includedTests: [{ name: "RF", description: "Rheumatoid factor" }, { name: "CRP", description: "Inflammation" }, { name: "ESR", description: "Inflammation" }, { name: "Anti-CCP", description: "Rheumatoid antibodies" }], includedTestCount: 4, originalPrice: 2499, discountedPrice: 999, discountPercentage: 60 },
      { id: "bj-3", name: "Uric Acid Test", type: "single", includedTests: [{ name: "Uric Acid", description: "Gout and kidney" }], includedTestCount: 1, originalPrice: 500, discountedPrice: 199, discountPercentage: 60 },
    ],
  },
  {
    id: "allergy",
    name: "Allergy",
    slug: "allergy",
    description: "Comprehensive allergy testing to identify triggers for various allergies.",
    items: [
      { id: "al-1", name: "Allergy Panel", type: "package", includedTests: [{ name: "Total IgE", description: "Allergy marker" }, { name: "Food Allergy Panel", description: "Common food allergens" }, { name: "CBC with Eosinophil", description: "Blood count" }], includedTestCount: 3, originalPrice: 1999, discountedPrice: 799, discountPercentage: 60 },
      { id: "al-2", name: "Total IgE Test", type: "single", includedTests: [{ name: "Total IgE", description: "Immunoglobulin E allergy marker" }], includedTestCount: 1, originalPrice: 800, discountedPrice: 299, discountPercentage: 63 },
    ],
  },
  {
    id: "sexual-wellness",
    name: "Sexual Wellness",
    slug: "sexual-wellness",
    description: "Confidential screening for sexual health and reproductive wellness.",
    items: [
      { id: "sw-1", name: "STI Screening Panel", type: "package", includedTests: [{ name: "HIV I & II", description: "HIV screening" }, { name: "VDRL", description: "Syphilis screening" }, { name: "Hepatitis B", description: "Hep B screening" }, { name: "Hepatitis C", description: "Hep C screening" }], includedTestCount: 4, originalPrice: 2499, discountedPrice: 999, discountPercentage: 60, badges: ["BEST PRICE EVER!"] },
      { id: "sw-2", name: "HIV Test", type: "single", includedTests: [{ name: "HIV I & II", description: "HIV screening" }], includedTestCount: 1, originalPrice: 800, discountedPrice: 299, discountPercentage: 63 },
    ],
  },
  {
    id: "immunity",
    name: "Immunity",
    slug: "immunity",
    description: "Evaluate immune system strength and identify factors affecting body defence.",
    items: [
      { id: "im-1", name: "Immunity Panel", type: "package", includedTests: [{ name: "CBC", description: "Blood count" }, { name: "IgG", description: "Long-term immunity" }, { name: "IgM", description: "Acute immunity" }, { name: "Vitamin D", description: "Immune regulation" }, { name: "Zinc", description: "Immune mineral" }, { name: "Iron Studies", description: "Iron status" }, { name: "CRP", description: "Inflammation" }], includedTestCount: 7, originalPrice: 2499, discountedPrice: 999, discountPercentage: 60 },
      { id: "im-2", name: "Immunoglobulin Test", type: "package", includedTests: [{ name: "IgG", description: "Immunoglobulin G" }, { name: "IgM", description: "Immunoglobulin M" }, { name: "IgA", description: "Immunoglobulin A" }], includedTestCount: 3, originalPrice: 1499, discountedPrice: 599, discountPercentage: 60 },
    ],
  },
  {
    id: "fever-infection",
    name: "Fever and Infection",
    slug: "fever-infection",
    description: "Tests to identify the specific cause of fever and systemic infections.",
    items: [
      { id: "fi-1", name: "Infection Panel", type: "package", includedTests: [{ name: "CBC", description: "Blood count" }, { name: "ESR", description: "Inflammation" }, { name: "CRP", description: "Inflammation" }, { name: "Blood Culture", description: "Bacterial detection" }, { name: "Procalcitonin", description: "Bacterial vs viral" }], includedTestCount: 5, originalPrice: 1999, discountedPrice: 799, discountPercentage: 60 },
      { id: "fi-2", name: "CRP Test", type: "single", includedTests: [{ name: "CRP", description: "C-reactive protein" }], includedTestCount: 1, originalPrice: 500, discountedPrice: 199, discountPercentage: 60 },
    ],
  },
  {
    id: "reproductive",
    name: "Reproductive & Fertility Tests",
    slug: "reproductive",
    description: "Comprehensive fertility evaluation for reproductive health assessment.",
    items: [
      { id: "rf-1", name: "Female Fertility Panel", type: "package", includedTests: [{ name: "FSH", description: "Ovarian reserve" }, { name: "LH", description: "Ovulation hormone" }, { name: "Estradiol", description: "Estrogen" }, { name: "AMH", description: "Ovarian reserve" }, { name: "Prolactin", description: "Pituitary hormone" }, { name: "Thyroid", description: "Thyroid" }], includedTestCount: 6, originalPrice: 2999, discountedPrice: 1199, discountPercentage: 60 },
      { id: "rf-2", name: "Male Fertility Panel", type: "package", includedTests: [{ name: "Testosterone", description: "Male hormone" }, { name: "FSH", description: "Spermatogenesis" }, { name: "LH", description: "Pituitary hormone" }, { name: "Prolactin", description: "Pituitary hormone" }], includedTestCount: 4, originalPrice: 1999, discountedPrice: 799, discountPercentage: 60 },
    ],
  },
  {
    id: "cancer-screening",
    name: "Cancer Screening",
    slug: "cancer-screening",
    description: "Early cancer detection markers to identify risk factors.",
    items: [
      { id: "cs-1", name: "Cancer Screening Panel", type: "package", includedTests: [{ name: "PSA", description: "Prostate marker" }, { name: "CEA", description: "Colon cancer marker" }, { name: "AFP", description: "Liver cancer marker" }, { name: "CA-125", description: "Ovarian cancer marker" }, { name: "CBC", description: "Blood count" }], includedTestCount: 5, originalPrice: 3999, discountedPrice: 1599, discountPercentage: 60, badges: ["BEST PRICE EVER!"] },
      { id: "cs-2", name: "PSA Test", type: "single", includedTests: [{ name: "PSA", description: "Prostate specific antigen" }], includedTestCount: 1, originalPrice: 800, discountedPrice: 299, discountPercentage: 63 },
    ],
  },
  {
    id: "hepatitis",
    name: "Hepatitis Screening",
    slug: "hepatitis",
    description: "Comprehensive hepatitis screening for A, B, and C virus infections.",
    items: [
      { id: "hs-1", name: "Hepatitis Panel", type: "package", includedTests: [{ name: "HBsAg", description: "Hepatitis B" }, { name: "Anti-HBc", description: "Hep B core" }, { name: "Anti-HBs", description: "Hep B immunity" }, { name: "Anti-HCV", description: "Hepatitis C" }, { name: "LFT", description: "Liver function" }], includedTestCount: 5, originalPrice: 2499, discountedPrice: 999, discountPercentage: 60 },
      { id: "hs-2", name: "HBsAg Test", type: "single", includedTests: [{ name: "HBsAg", description: "Hepatitis B surface antigen" }], includedTestCount: 1, originalPrice: 600, discountedPrice: 249, discountPercentage: 58 },
    ],
  },
  {
    id: "lungs",
    name: "Lungs",
    slug: "lungs",
    description: "Respiratory health assessment to evaluate lung function.",
    items: [
      { id: "lu-1", name: "Lung Health Panel", type: "package", includedTests: [{ name: "CBC", description: "Blood count" }, { name: "ESR", description: "Inflammation" }, { name: "CRP", description: "Inflammation" }, { name: "Sputum Culture", description: "Infection detection" }], includedTestCount: 4, originalPrice: 1499, discountedPrice: 599, discountPercentage: 60 },
      { id: "lu-2", name: "CRP Test", type: "single", includedTests: [{ name: "CRP", description: "C-reactive protein" }], includedTestCount: 1, originalPrice: 500, discountedPrice: 199, discountPercentage: 60 },
    ],
  },
  {
    id: "weight",
    name: "Weight Management",
    slug: "weight",
    description: "Metabolic and hormonal tests to identify causes of weight issues.",
    items: [
      { id: "wm-1", name: "Weight Management Panel", type: "package", includedTests: [{ name: "Thyroid Profile", description: "Thyroid" }, { name: "Fasting Insulin", description: "Insulin resistance" }, { name: "HbA1c", description: "Blood sugar" }, { name: "Cortisol", description: "Stress hormone" }, { name: "Lipid Profile", description: "Cholesterol" }, { name: "Vitamin D", description: "Metabolic health" }], includedTestCount: 6, originalPrice: 2499, discountedPrice: 999, discountPercentage: 60, badges: ["BEST PRICE EVER!"] },
      { id: "wm-2", name: "Thyroid Test", type: "single", includedTests: [{ name: "TSH", description: "Thyroid stimulating hormone" }], includedTestCount: 1, originalPrice: 500, discountedPrice: 199, discountPercentage: 60 },
    ],
  },
  {
    id: "iron",
    name: "Iron Studies",
    slug: "iron",
    description: "Detailed iron assessment to diagnose deficiency and overload conditions.",
    items: [
      { id: "is-1", name: "Iron Studies Panel", type: "package", includedTests: [{ name: "Serum Iron", description: "Blood iron" }, { name: "Ferritin", description: "Iron stores" }, { name: "TIBC", description: "Iron binding capacity" }, { name: "Transferrin Saturation", description: "Iron saturation" }, { name: "CBC", description: "Blood count" }], includedTestCount: 5, originalPrice: 1499, discountedPrice: 599, discountPercentage: 60 },
      { id: "is-2", name: "Ferritin Test", type: "single", includedTests: [{ name: "Ferritin", description: "Iron storage protein" }], includedTestCount: 1, originalPrice: 800, discountedPrice: 299, discountPercentage: 63 },
    ],
  },
  {
    id: "covid",
    name: "Covid 19",
    slug: "covid",
    description: "COVID-19 testing and post-infection health assessment.",
    items: [
      { id: "cv-1", name: "COVID-19 RT-PCR", type: "single", includedTests: [{ name: "RT-PCR", description: "Molecular COVID-19 test" }], includedTestCount: 1, originalPrice: 1200, discountedPrice: 499, discountPercentage: 58 },
      { id: "cv-2", name: "COVID Antibody Panel", type: "package", includedTests: [{ name: "IgG Antibody", description: "Past infection immunity" }, { name: "IgM Antibody", description: "Recent infection" }], includedTestCount: 2, originalPrice: 1499, discountedPrice: 599, discountPercentage: 60 },
      { id: "cv-3", name: "COVID Post-Recovery", type: "package", includedTests: [{ name: "CBC", description: "Blood count" }, { name: "CRP", description: "Inflammation" }, { name: "D-Dimer", description: "Clotting" }, { name: "Ferritin", description: "Iron stores" }, { name: "LFT", description: "Liver" }, { name: "KFT", description: "Kidney" }], includedTestCount: 6, originalPrice: 2999, discountedPrice: 1199, discountPercentage: 60 },
    ],
  },
  {
    id: "pcod",
    name: "PCOD Screening",
    slug: "pcod",
    description: "Hormonal screening to diagnose and evaluate PCOS.",
    items: [
      { id: "pc-1", name: "PCOD Panel", type: "package", includedTests: [{ name: "Testosterone", description: "Male hormone" }, { name: "DHEA-S", description: "Adrenal androgen" }, { name: "FSH", description: "Reproductive hormone" }, { name: "LH", description: "Reproductive hormone" }, { name: "Insulin Fasting", description: "Insulin resistance" }, { name: "HbA1c", description: "Blood sugar" }, { name: "Lipid Profile", description: "Cholesterol" }, { name: "Thyroid Profile", description: "Thyroid" }], includedTestCount: 8, originalPrice: 2999, discountedPrice: 1199, discountPercentage: 60, badges: ["BEST PRICE EVER!"] },
      { id: "pc-2", name: "AMH Test", type: "single", includedTests: [{ name: "AMH", description: "Anti-Mullerian hormone" }], includedTestCount: 1, originalPrice: 1200, discountedPrice: 499, discountPercentage: 58 },
    ],
  },
  {
    id: "healthy-2024",
    name: "Healthy 2024",
    slug: "healthy-2024",
    description: "Comprehensive preventive health checkup for the new year.",
    items: [
      { id: "hy-1", name: "Healthy 2024 Complete", type: "package", includedTests: [{ name: "CBC", description: "Blood count" }, { name: "Lipid Profile", description: "Heart" }, { name: "LFT", description: "Liver" }, { name: "KFT", description: "Kidney" }, { name: "Thyroid Profile", description: "Thyroid" }, { name: "HbA1c", description: "Diabetes" }, { name: "Vitamin D", description: "Vitamin" }, { name: "Vitamin B12", description: "B12" }, { name: "Iron Studies", description: "Iron" }, { name: "Urine Routine", description: "Urinalysis" }, { name: "Calcium", description: "Bone health" }, { name: "Phosphorus", description: "Bone mineral" }], includedTestCount: 12, originalPrice: 4999, discountedPrice: 1999, discountPercentage: 60, badges: ["BEST PRICE EVER!"] },
      { id: "hy-2", name: "Healthy 2024 Essential", type: "package", includedTests: [{ name: "CBC", description: "Blood count" }, { name: "Lipid Profile", description: "Heart" }, { name: "LFT", description: "Liver" }, { name: "KFT", description: "Kidney" }, { name: "TSH", description: "Thyroid" }, { name: "HbA1c", description: "Diabetes" }, { name: "Vitamin D", description: "Vitamin" }, { name: "Urine Routine", description: "Urinalysis" }], includedTestCount: 8, originalPrice: 3499, discountedPrice: 1399, discountPercentage: 60 },
    ],
  },
];

/* ── Category slug map ── */
const SLUG_MAP: Record<string, string> = {};
ALL_CATEGORIES.forEach((c) => { SLUG_MAP[c.slug] = c.id; });

/* ── Test icon per type ── */
function TestIcon({ type }: { type: "single" | "package" }) {
  if (type === "package") {
    return (
      <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[#0a3d2e]/10">
        <Beaker className="size-7 text-[#0a3d2e]" />
      </div>
    );
  }
  return (
    <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-blue-50">
      <FlaskConical className="size-7 text-blue-500" />
    </div>
  );
}

/* ── Mobile Filter Drawer ── */
function FilterDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Filters</h3>
          <button onClick={onClose} className="flex size-8 items-center justify-center rounded-lg hover:bg-gray-100">
            <X className="size-5 text-gray-500" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ── Main Page ── */
export default function LabTestCategory() {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();

  const categoryData = useMemo(() => {
    if (!category) return null;
    const id = SLUG_MAP[category];
    return ALL_CATEGORIES.find((c) => c.id === id) || null;
  }, [category]);
  /* DB lab tests for this category */
  const dbTests = useQuery(
    api.labTests.listByCategory,
    category ? { categorySlug: category } : "skip"
  );

  /* Merge DB tests with hardcoded data */
  const mergedCategoryData = useMemo(() => {
    if (!categoryData) return null;
    const dbItems: LabTestItem[] = (dbTests || []).map((t) => ({
      id: t._id,
      name: t.name,
      type: t.type,
      includedTests: t.includedTestIds.map((id, i) => ({
        name: t.includedTestIds[i],
        description: "",
      })),
      includedTestCount: t.includedTestCount,
      originalPrice: t.originalPrice,
      discountedPrice: t.discountedPrice,
      discountPercentage: t.discountPercentage,
      badges: t.promotionalBadges.length > 0 ? t.promotionalBadges : undefined,
      promotionalText: t.promotionalText,
      _isFromDB: true,
      _convexId: t._id,
    }));
    const allItems = [...dbItems, ...categoryData.items];
    return { ...categoryData, items: allItems };
  }, [categoryData, dbTests]);

  const effectiveCategoryData = mergedCategoryData || categoryData;

  /* Filters */
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [testFilters, setTestFilters] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);

  /* Cart (local state since lab tests aren't products) */
  const [cartItems, setCartItems] = useState<Set<string>>(new Set());

  /* Booking modal */
  const [bookingTest, setBookingTest] = useState<LabTestItem | null>(null);
  const [bookingDate, setBookingDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [bookingTime, setBookingTime] = useState("");
  const [bookingType, setBookingType] = useState<"home" | "lab">("home");
  const [bookingAddress, setBookingAddress] = useState("");
  const [bookingPincode, setBookingPincode] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingError, setBookingError] = useState("");
  const createBooking = useMutation(api.labTests.createBooking);



  const toggleTestFilter = useCallback((testName: string) => {
    setTestFilters((prev) => {
      const next = new Set(prev);
      if (next.has(testName)) next.delete(testName);
      else next.add(testName);
      return next;
    });
  }, []);

  const clearAllFilters = useCallback(() => {
    setTypeFilter(null);
    setTestFilters(new Set());
  }, []);

  const toggleCart = useCallback((itemId: string) => {
    setCartItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }, []);

  /* Compute unique "Must Have Tests" from category items */
  const availableTests = useMemo(() => {
    if (!effectiveCategoryData) return [];
    const testMap = new Map<string, string>();
    effectiveCategoryData.items.forEach((item) => {
      item.includedTests.forEach((t) => {
        if (!testMap.has(t.name)) testMap.set(t.name, t.description);
      });
    });
    return Array.from(testMap.entries()).map(([name, description]) => ({ name, description }));
  }, [effectiveCategoryData]);

  /* Compute unique "Type of Tests" */
  const availableTypes = useMemo(() => {
    if (!effectiveCategoryData) return [];
    const types = new Set(effectiveCategoryData.items.map((i) => i.type));
    return Array.from(types);
  }, [effectiveCategoryData]);

  /* Filtered items */
  const filteredItems = useMemo(() => {
    if (!effectiveCategoryData) return [];
    let items = effectiveCategoryData.items;

    if (typeFilter) {
      items = items.filter((i) => i.type === typeFilter);
    }

    if (testFilters.size > 0) {
      items = items.filter((i) =>
        Array.from(testFilters).every((f) =>
          i.includedTests.some((t) => t.name === f)
        )
      );
    }

    return items;
  }, [effectiveCategoryData, typeFilter, testFilters]);

  if (!effectiveCategoryData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-16 text-center">
          <p className="text-gray-500">Category not found.</p>
          <button onClick={() => navigate("/lab-tests")} className="mt-4 text-sm text-[#0a3d2e] font-semibold hover:underline">
            Back to Lab Tests
          </button>
        </div>
      </div>
    );
  }

  /* Booking handlers */
  /* Body scroll lock when modal open */
  useEffect(() => {
    if (bookingTest) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [bookingTest]);

  const openBookingModal = useCallback((item: LabTestItem) => {
    setBookingTest(item);
    setBookingError("");
    setBookingTime("");
    setBookingAddress("");
    setBookingPincode("");
    setBookingNotes("");
    const d = new Date();
    d.setDate(d.getDate() + 1);
    setBookingDate(d.toISOString().split("T")[0]);
  }, []);

  const closeBookingModal = useCallback(() => {
    setBookingTest(null);
    setBookingError("");
  }, []);

  const handleBookingSubmit = useCallback(async () => {
    if (!bookingTest) return;
    if (!bookingDate || !bookingTime || !bookingAddress.trim() || !bookingPincode.trim()) {
      setBookingError("Please fill in all required fields.");
      return;
    }
    if (bookingPincode.trim().length < 6) {
      setBookingError("Please enter a valid 6-digit pincode.");
      return;
    }
    try {
      const testId = bookingTest._convexId as any;
      await createBooking({
        testId,
        collectionDate: bookingDate,
        timeSlot: bookingTime,
        collectionType: bookingType,
        address: bookingAddress.trim(),
        pincode: bookingPincode.trim(),
        notes: bookingNotes.trim() || undefined,
      });
      setBookingTest(null);
      setBookingError("");
      setCartItems((prev) => {
        const next = new Set(prev);
        next.delete(bookingTest.id);
        return next;
      });
    } catch (err: any) {
      setBookingError(err?.message || "Failed to book. Please try again.");
    }
  }, [bookingTest, bookingDate, bookingTime, bookingType, bookingAddress, bookingPincode, bookingNotes, createBooking]);

  const TIME_SLOTS = [
    "07:00 AM - 09:00 AM",
    "09:00 AM - 11:00 AM",
    "11:00 AM - 01:00 PM",
    "01:00 PM - 03:00 PM",
    "03:00 PM - 05:00 PM",
    "05:00 PM - 07:00 PM",
  ];

  const sidebarContent = (
    <>
      {/* Type of Tests */}
      {availableTypes.length > 0 && (
        <div className="mb-6">
          <h4 className="mb-3 text-sm font-bold text-gray-900">Type of Tests</h4>
          <div className="space-y-2">
            {availableTypes.map((t) => (
              <label key={t} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={typeFilter === t}
                  onChange={() => setTypeFilter(typeFilter === t ? null : t)}
                  className="size-4 rounded border-gray-300 text-[#0a3d2e] accent-[#0a3d2e]"
                />
                <span className="text-sm text-gray-700 capitalize">{t === "package" ? "Health Packages" : "Single Tests"}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Must Have Tests */}
      {availableTests.length > 0 && (
        <div>
          <h4 className="mb-3 text-sm font-bold text-gray-900">Must Have Tests</h4>
          <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
            {availableTests.map((t) => (
              <label key={t.name} className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={testFilters.has(t.name)}
                  onChange={() => toggleTestFilter(t.name)}
                  className="size-4 rounded border-gray-300 text-[#0a3d2e] accent-[#0a3d2e]"
                />
                <span className="text-sm text-gray-700">{t.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-10">
        {/* Back */}
        <button
          onClick={() => navigate("/lab-tests")}
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors mb-4"
        >
          <ArrowLeft className="size-4" />
          Back to Health Check
        </button>

        {/* Title */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {effectiveCategoryData.name} <span className="text-gray-400 font-normal">({filteredItems.length})</span>
          </h1>
          {/* Mobile filter button */}
          <button
            onClick={() => setFilterOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 lg:hidden"
          >
            <SlidersHorizontal className="size-4" />
            Filters
          </button>
        </div>

        <div className="flex gap-8">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block w-[240px] shrink-0">
            <div className="sticky top-24 rounded-xl border border-gray-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900">Filters</h3>
                {(typeFilter || testFilters.size > 0) && (
                  <button onClick={clearAllFilters} className="text-xs font-semibold text-[#0a3d2e] hover:underline">
                    Clear All
                  </button>
                )}
              </div>
              {sidebarContent}
            </div>
          </aside>

          {/* Mobile filter drawer */}
          <FilterDrawer open={filterOpen} onClose={() => setFilterOpen(false)}>
            <div className="mb-4 flex items-center justify-between">
              {(typeFilter || testFilters.size > 0) && (
                <button onClick={clearAllFilters} className="text-xs font-semibold text-[#0a3d2e] hover:underline">
                  Clear All
                </button>
              )}
            </div>
            {sidebarContent}
            <button
              onClick={() => setFilterOpen(false)}
              className="mt-6 w-full rounded-xl bg-[#0a3d2e] py-3 text-sm font-bold text-white hover:bg-[#082f23] transition-colors"
            >
              Show {filteredItems.length} Results
            </button>
          </FilterDrawer>

          {/* Test Grid */}
          <div className="flex-1 min-w-0">
            {filteredItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
                <FlaskConical className="mx-auto size-10 text-gray-300 mb-3" />
                <p className="text-sm text-gray-500">
                  {typeFilter || testFilters.size > 0
                    ? "No tests match your selected filters."
                    : "No lab tests available in this category yet."}
                </p>
                {(typeFilter || testFilters.size > 0) && (
                  <button onClick={clearAllFilters} className="mt-3 text-sm font-semibold text-[#0a3d2e] hover:underline">
                    Clear Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredItems.map((item) => {
                  const inCart = cartItems.has(item.id);
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 transition-all hover:shadow-md hover:border-gray-300"
                    >
                      {/* Header row: icon + name */}
                      <div className="flex items-start gap-3 mb-3">
                        <TestIcon type={item.type} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {item.type === "package" && (
                              <span className="inline-flex items-center rounded bg-[#0a3d2e] px-1.5 py-0.5 text-[9px] font-bold text-white uppercase">
                                Package
                              </span>
                            )}
                            <h3 className="text-sm font-bold text-gray-900 leading-tight">{item.name}</h3>
                          </div>
                          <p className="mt-1 text-xs text-gray-500">{item.includedTestCount} Test{item.includedTestCount > 1 ? "s" : ""} Included</p>
                        </div>
                      </div>

                      {/* Badges */}
                      {item.badges && item.badges.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1.5">
                          {item.badges.map((b) => (
                            <span key={b} className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                              {b}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Promotional text */}
                      {item.promotionalText && (
                        <p className="mb-3 text-xs font-semibold text-[#0a3d2e]">{item.promotionalText}</p>
                      )}

                      {/* Spacer */}
                      <div className="flex-1" />

                      {/* Price + CTA */}
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                        <div>
                          <span className="text-lg font-extrabold text-gray-900">
                            ₹{item.discountedPrice.toLocaleString("en-IN")}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-gray-400 line-through">
                              ₹{item.originalPrice.toLocaleString("en-IN")}
                            </span>
                            <span className="text-xs font-bold text-emerald-600">
                              {item.discountPercentage}% off
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (item._isFromDB && item._convexId) {
                              openBookingModal(item);
                            } else {
                              toggleCart(item.id);
                            }
                          }}
                          className={`rounded-lg px-5 py-2.5 text-sm font-bold transition-colors ${
                            inCart
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-[#0a3d2e] text-white hover:bg-[#082f23]"
                          }`}
                        >
                          {inCart ? (
                            <span className="flex items-center gap-1.5">
                              <Check className="size-4" />
                              Added
                            </span>
                          ) : (
                            "Add"
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating cart indicator */}
      {cartItems.size > 0 && (
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={() => navigate("/cart")}
            className="flex items-center gap-2.5 rounded-full bg-[#0a3d2e] px-5 py-3 text-sm font-bold text-white shadow-lg hover:bg-[#082f23] transition-colors"
          >
            <ShoppingCart className="size-5" />
            <span>{cartItems.size} item{cartItems.size > 1 ? "s" : ""}</span>
          </button>
        </div>
      )}

      {/* Booking Modal */}
      {bookingTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Book Test</h2>
                <p className="text-sm text-gray-500 mt-0.5">{bookingTest.name}</p>
              </div>
              <button onClick={closeBookingModal} className="flex size-8 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
                <X className="size-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              <div className="rounded-xl bg-gray-50 p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-900">{bookingTest.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{bookingTest.includedTestCount} test{bookingTest.includedTestCount > 1 ? "s" : ""} included</p>
                </div>
                <p className="text-lg font-extrabold text-[#0a3d2e]">₹{bookingTest.discountedPrice.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Collection Type *</label>
                <div className="flex gap-3">
                  <button onClick={() => setBookingType("home")} className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-colors ${bookingType === "home" ? "border-[#0a3d2e] bg-[#0a3d2e]/5 text-[#0a3d2e]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                    <MapPin className="size-4 inline mr-1.5" />Home Collection
                  </button>
                  <button onClick={() => setBookingType("lab")} className={`flex-1 rounded-xl border-2 px-4 py-3 text-sm font-medium transition-colors ${bookingType === "lab" ? "border-[#0a3d2e] bg-[#0a3d2e]/5 text-[#0a3d2e]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
                    <FlaskConical className="size-4 inline mr-1.5" />Visit Lab
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2"><Calendar className="size-4 inline mr-1.5" />Preferred Date *</label>
                <input type="date" value={bookingDate} min={new Date(Date.now() + 86400000).toISOString().split("T")[0]} onChange={(e) => setBookingDate(e.target.value)} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 focus:border-[#0a3d2e] focus:ring-1 focus:ring-[#0a3d2e] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2"><Clock className="size-4 inline mr-1.5" />Preferred Time Slot *</label>
                <div className="grid grid-cols-2 gap-2">
                  {TIME_SLOTS.map((slot) => (
                    <button key={slot} onClick={() => setBookingTime(slot)} className={`rounded-xl border-2 px-3 py-2.5 text-xs font-medium transition-colors ${bookingTime === slot ? "border-[#0a3d2e] bg-[#0a3d2e]/5 text-[#0a3d2e]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>{slot}</button>
                  ))}
                </div>
              </div>
              {bookingType === "home" && (
                <div>
                  <label className="block text-sm font-bold text-gray-900 mb-2"><MapPin className="size-4 inline mr-1.5" />Collection Address *</label>
                  <textarea value={bookingAddress} onChange={(e) => setBookingAddress(e.target.value)} placeholder="Enter full address with landmark" rows={3} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#0a3d2e] focus:ring-1 focus:ring-[#0a3d2e] outline-none resize-none" />
                </div>
              )}
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Pincode *</label>
                <input type="text" value={bookingPincode} onChange={(e) => setBookingPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit pincode" maxLength={6} className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#0a3d2e] focus:ring-1 focus:ring-[#0a3d2e] outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Special Instructions (optional)</label>
                <input type="text" value={bookingNotes} onChange={(e) => setBookingNotes(e.target.value)} placeholder="Any special instructions" className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#0a3d2e] focus:ring-1 focus:ring-[#0a3d2e] outline-none" />
              </div>
              {bookingError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
                  <AlertTriangle className="size-4 shrink-0" />{bookingError}
                </div>
              )}
            </div>
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 rounded-b-2xl">
              <button onClick={handleBookingSubmit} className="w-full rounded-xl bg-[#0a3d2e] py-3.5 text-sm font-bold text-white hover:bg-[#082f23] transition-colors flex items-center justify-center gap-2">
                <Calendar className="size-4" />Confirm Booking — ₹{bookingTest.discountedPrice.toLocaleString("en-IN")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
