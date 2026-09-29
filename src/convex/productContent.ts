/**
 * Structured, product-specific content for the Product Detail page.
 *
 * Every section below the product card — Product Information, Medical
 * Benefits, Key Ingredients, Directions for Use, Safety, Information and FAQs
 * — used to be written from a handful of the product's own fields, with a
 * generic template filling whatever was missing. That is what produced wrong
 * clinical copy: a gel was told to "swallow with a glass of water", a test
 * strip was given a medicine dose, and every product repeated the same
 * "Active component contributing to the therapeutic effect" sentence.
 *
 * This module replaces those templates with one rule:
 *
 *   THE PRODUCT'S OWN IDENTITY IS THE ONLY SOURCE, AND SILENCE IS THE DEFAULT.
 *
 * Every field is resolved from verified product data — the curated reference
 * record, or metadata the product row itself carries. Where the data does not
 * exist, the field is null and the page shows an honest "not available, refer
 * to the pack or a pharmacist" state. Nothing is inferred from a dosage form,
 * a composition fragment or general medical knowledge.
 *
 * A note on the one kind of copy that is written rather than sourced: handling
 * and usage instructions. "Apply a thin layer to the affected area" for a gel
 * describes how that object is physically used, not a clinical claim about a
 * named drug, and it is emitted only once the product's type has been
 * established from strong identity signals. Everything that would be a
 * clinical assertion — a dose, an indication, a contraindication, an
 * ingredient — requires a source and is never generated.
 *
 * Pure and dependency-free, so the same builder runs in the Convex enrichment
 * pipeline and in the page, and both agree by construction.
 */

import {
  classifyProduct,
  productDirections,
  productSafety,
  formForKind,
  isMedicine,
  isOral,
  type ProductIdentity,
  type ProductKind,
} from "./productInfo";
import {
  findVerifiedReference,
  getStorageInfo,
  type VerifiedReference,
} from "./productReference";

// ── The honest-unavailable copy, shown wherever a fact is not verified ──

export const BENEFITS_UNAVAILABLE =
  "Detailed product-specific benefits are not currently available for this product. Please refer to the product packaging or consult a pharmacist.";

export const INGREDIENTS_UNAVAILABLE =
  "The composition of this product is not currently available. Please check the pack or ask your pharmacist for the full ingredient list.";

export const DIRECTIONS_UNAVAILABLE =
  "Usage instructions for this product are not currently available. Please follow the instructions printed on the pack, or ask your pharmacist.";

export const SAFETY_UNAVAILABLE =
  "Product-specific safety information is not currently available. Please read the leaflet supplied with the pack, or ask your pharmacist before use.";

export const STORAGE_UNAVAILABLE =
  "Storage conditions for this product are not currently available. Please follow the instructions printed on the pack.";

/** Where a piece of information came from, so the UI can be honest about it. */
export type ContentSource = "reference" | "product-metadata" | "product-type";

export interface ProductIngredient {
  /** Exactly as written on the pack, e.g. "Paracetamol". */
  name: string;
  /** The dose next to it, e.g. "650mg". Null when the pack states none. */
  strength: string | null;
  /**
   * What this ingredient is, only where that is reliably established.
   * Null means "not known" — never a guess, and never a claim about what it
   * does inside this particular product.
   */
  role: string | null;
}

export interface ProductFact {
  label: string;
  value: string;
}

export interface ProductFaq {
  question: string;
  answer: string;
}

export interface ProductContentInput extends ProductIdentity {
  brand?: string | null;
  prescriptionRequired?: boolean | null;
  storageInformation?: string | null;
  safetyNote?: string | null;
  /** The product's own benefits text. Only used when `benefitsSource` declares it. */
  benefits?: string | null;
  /** Provenance of `benefits`; free text is only trusted when it is declared. */
  benefitsSource?: string | null;
  expiryDate?: number | null;
  /**
   * A record already resolved by the caller. Pass `null` to force the lookup to
   * be skipped, which the admin preview uses to preview un-enriched products.
   */
  reference?: VerifiedReference | null;
}

export interface ProductContent {
  kind: ProductKind;
  kindConfident: boolean;
  /** Strongest source backing this product's content. */
  source: ContentSource;
  /** True when a verified reference record backs the clinical fields. */
  verified: boolean;

  // Product Information
  summary: string | null;
  facts: ProductFact[];

  // Medical Benefits
  benefits: string[] | null;
  benefitsIntro: string | null;
  benefitsNote: string | null;

  // Key Ingredients
  ingredients: ProductIngredient[] | null;
  ingredientsNote: string | null;

  // Directions for Use
  directions: string | null;
  directionsNote: string | null;
  timing: string | null;
  duration: string | null;
  important: string | null;

  // Safety
  manufacturerNote: string | null;
  safety: ProductFact[];

  // Information
  information: ProductFact[];

  // FAQs
  faqs: ProductFaq[];
}

// ── Ingredient roles ──

/**
 * What an ingredient IS, keyed by the names that appear on Indian medicine
 * packs. These are properties of the substance, not claims about a product, so
 * they stay accurate for every product containing that ingredient.
 *
 * An ingredient absent from this table is shown with its name and strength
 * only. That is deliberate: a wrong role is worse than no role.
 */
const INGREDIENT_ROLES: Array<[RegExp, string]> = [
  // Analgesics / antipyretics
  [/\b(paracetamol|acetaminophen)\b/i, "Analgesic and antipyretic — relieves pain and reduces fever"],
  [/\bibuprofen\b/i, "Anti-inflammatory analgesic — reduces pain, swelling and fever"],
  [/\b(diclofenac)\b/i, "Anti-inflammatory analgesic — reduces pain and inflammation"],
  [/\b(mefenamic acid|fenamates)\b/i, "Non-steroidal anti-inflammatory drug (NSAID) — reduces pain and inflammation"],
  [/\b(naproxen)\b/i, "Non-steroidal anti-inflammatory drug (NSAID) — reduces pain and inflammation"],
  [/\b(aceclofenac|paracetamol \+ aceclofenac)\b/i, "Analgesic and anti-inflammatory"],
  [/\b(tramadol)\b/i, "Opioid analgesic used for moderate to severe pain"],
  [/\b(tryptophan|tramadol hydrochloride)\b/i, "Opioid analgesic used for moderate to severe pain"],
  // Antibiotics
  [/\bamoxicillin\b/i, "Penicillin antibiotic — acts against susceptible bacteria"],
  [/\b(clavulanic acid|clavulanate)\b/i, "Beta-lactamase inhibitor — stops bacteria from breaking down the amoxicillin it is paired with"],
  [/\bazithromycin\b/i, "Macrolide antibiotic — acts against susceptible bacteria"],
  [/\bcefixime\b/i, "Cephalosporin antibiotic — acts against susceptible bacteria"],
  [/\b(cefpodoxime|cefpodoxime proxetil)\b/i, "Cephalosporin antibiotic — acts against susceptible bacteria"],
  [/\b(cefuroxime)\b/i, "Cephalosporin antibiotic — acts against susceptible bacteria"],
  [/\b(ofloxacin)\b/i, "Fluoroquinolone antibiotic — acts against susceptible bacteria"],
  [/\b(ciprofloxacin)\b/i, "Fluoroquinolone antibiotic — acts against susceptible bacteria"],
  [/\btobramycin\b/i, "Aminoglycoside antibiotic — acts against susceptible bacteria"],
  [/\b(neomycin)\b/i, "Aminoglycoside antibiotic with topical and ophthalmic use"],
  [/\b(betamethasone)\b/i, "Corticosteroid — reduces inflammation"],
  [/\b(clobetasol|clobetasone)\b/i, "Topical corticosteroid — reduces skin inflammation"],
  [/\b(mupirocin)\b/i, "Topical antibiotic for skin infections"],
  [/\b(povidone[- ]iodine)\b/i, "Broad-spectrum antiseptic used on skin and wounds"],
  // Antacids / gastro
  [/\b(omeprazole|pantoprazole|rabeprazole|esomeprazole|lansoprazole|ranitidine)\b/i, "Proton pump inhibitor — reduces the amount of acid the stomach produces"],
  [/\b(simethicone)\b/i, "Anti-foaming agent — relieves gas and bloating"],
  [/\b(magaldrate|aluminum hydroxide|aluminium hydroxide|magnesium hydroxide|sodium bicarbonate|calcium carbonate)\b/i, "Antacid — neutralises stomach acid"],
  [/\b(bacillus clausii|lactobacillus|sporulating bacillus|probiotic)\b/i, "Probiotic — helps restore the balance of gut bacteria"],
  [/\b(domperidone|ondansetron|metoclopramide)\b/i, "Antiemetic — helps control nausea and vomiting"],
  [/\b(ondansetron)\b/i, "Antiemetic — helps control nausea and vomiting"],
  [/\b(orlistat)\b/i, "Lipase inhibitor — reduces the fat absorbed from food"],
  [/\b(dicyclomine|domperidone)\b/i, "Antispasmodic — relieves cramping and spasms of the gut"],
  // Respiratory / allergy
  [/\b(cetirizine)\b/i, "Antihistamine — relieves sneezing, runny nose and itchy eyes"],
  [/\b(levocetirizine)\b/i, "Antihistamine — relieves sneezing, runny nose and itchy eyes"],
  [/\b(chlorpheniramine|diphenhydramine|pheniramine)\b/i, "First-generation antihistamine — relieves allergy symptoms and may cause drowsiness"],
  [/\b(montelukast)\b/i, "Leukotriene receptor antagonist — helps prevent allergic and asthma symptoms"],
  [/\b(salbutamol|levalbutamol|levosalbutamol|terbutaline)\b/i, "Bronchodilator — relaxes the muscles of the airways"],
  [/\b(ambroxol|bromhexine|guaifenesin|acetylcysteine)\b/i, "Mucolytic — loosens and thins mucus in the airways"],
  [/\b(phenylephrine|pseudoephedrine)\b/i, "Nasal decongestant — reduces swelling inside the nose"],
  [/\b(oxymetazoline|xylometazoline)\b/i, "Nasal decongestant — reduces swelling inside the nose"],
  [/\b(dextromethorphan)\b/i, "Cough suppressant — reduces the urge to cough"],
  [/\b(montelukast)\b/i, "Leukotriene receptor antagonist — helps prevent allergic and asthma symptoms"],
  // Cardiovascular / metabolic
  [/\b(amlodipine)\b/i, "Calcium channel blocker — relaxes and widens blood vessels to lower blood pressure"],
  [/\b(losartan|telmisartan|valsartan|olmesartan)\b/i, "Angiotensin receptor blocker (ARB) — lowers blood pressure"],
  [/\b(atorvastatin|rosuvastatin|simvastatin|pravastatin)\b/i, "Statin — lowers LDL cholesterol"],
  [/\b(clopidogrel|aspirin)\b/i, "Antiplatelet — reduces the blood's ability to clot"],
  [/\b(ramipril|enalapril|lisinopril)\b/i, "ACE inhibitor — lowers blood pressure"],
  [/\b(metformin)\b/i, "Biguanide antidiabetic — lowers blood glucose levels"],
  [/\b(glimepiride|glipizide|gliclazide|glimepiride)\b/i, "Sulfonylurea antidiabetic — lowers blood glucose levels"],
  [/\b(sitagliptin|teneligliptin|vildagliptin)\b/i, "DPP-4 inhibitor antidiabetic — helps lower blood glucose levels"],
  [/\b(levothyroxine)\b/i, "Thyroid hormone replacement"],
  [/\b(atorvastatin)\b/i, "Statin — lowers LDL cholesterol"],
  [/\b(sildenafil|tadalafil)\b/i, "Phosphodiesterase-5 (PDE5) inhibitor — used for erectile dysfunction"],
  [/\b(dydrogesterone|progesterone)\b/i, "Progestogen — a form of the hormone progesterone"],
  [/\b(levetiracetam|sodium valproate|valproic acid|diazepam)\b/i, "Anti-epileptic — used to control seizures"],
  [/\b(pregabalin)\b/i, "Anti-neuropathic agent — used for nerve pain"],
  // Topical actives
  [/\b(methyl salicylate)\b/i, "Topical anti-inflammatory and warming agent"],
  [/\b(menthol)\b/i, "Topical cooling and decongestant agent"],
  [/\b(camphor)\b/i, "Topical warming and decongestant agent"],
  [/\b(eucalyptus oil)\b/i, "Topical decongestant and aromatic agent"],
  [/\b(turpentine oil)\b/i, "Topical warming agent"],
  [/\b(cedar oil|gaultheria oil|clove oil|cinnamon oil|linseed oil)\b/i, "Essential oil used as a topical aromatic base"],
  [/\b(zinc oxide)\b/i, "Topical skin protectant and mild antiseptic"],
  [/\b(permethrin)\b/i, "Scabicide and pediculicide — used against scabies and lice"],
  [/\b(clotrimazole)\b/i, "Antifungal — used against fungal skin infections"],
  [/\b(ketoconazole)\b/i, "Antifungal — used against fungal infections"],
  [/\b(silver sulfadiazine)\b/i, "Topical antibacterial cream for burns and wound infections"],
  // Vitamins and minerals
  [/\b(vitamin c|ascorbic acid)\b/i, "Vitamin C — involved in collagen formation and iron absorption"],
  [/\b(vitamin d3|cholecalciferol|calcitriol)\b/i, "Vitamin D3 — needed for calcium absorption and bone health"],
  [/\b(vitamin b1|thiamine)\b/i, "Vitamin B1 — needed for energy metabolism"],
  [/\b(vitamin b2|riboflavin)\b/i, "Vitamin B2 — needed for energy metabolism"],
  [/\b(vitamin b6|pyridoxine)\b/i, "Vitamin B6 — needed for protein and nerve metabolism"],
  [/\b(vitamin b12|cyanocobalamin|methylcobalamin)\b/i, "Vitamin B12 — needed for red blood cell formation and nerve function"],
  [/\b(calcium carbonate|calcium citrate)\b/i, "Calcium — a mineral needed for bones and teeth"],
  [/\b(ferrous fumarate|ferrous sulphate|ferrous sulfate|elemental iron|iron)\b/i, "Iron — a mineral needed for haemoglobin and oxygen transport"],
  [/\b(zinc)\b/i, "Zinc — a mineral needed for immunity and wound healing"],
  [/\b(folic acid)\b/i, "Folate — needed for cell division and red blood cell formation"],
  [/\b(biotin)\b/i, "Biotin — a B vitamin involved in fat and protein metabolism"],
  [/\b(ginseng)\b/i, "Herbal adaptogen — traditional use for stamina and fatigue"],
  [/\b(omega ?3|fish oil|epa|dha)\b/i, "Omega-3 fatty acid source"],
  [/\b(protein|protein hydrolysate)\b/i, "Protein source"],
  [/\b(multivitamin)\b/i, "Combination of vitamins"],
  [/\b(multimineral)\b/i, "Combination of minerals"],
  [/\b(b-complex|vitamin b complex)\b/i, "Combination of B vitamins"],
];

/**
 * The role of a named ingredient, or null when it is not one we can state.
 * Matches on the ingredient text as written on the pack, so a synonym used by
 * one manufacturer still resolves while an unknown substance does not.
 */
export function ingredientRole(name: string): string | null {
  const cleaned = name.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  for (const [pattern, role] of INGREDIENT_ROLES) {
    if (pattern.test(cleaned) || pattern.test(name)) return role;
  }
  return null;
}

/** Matches a dose written at the end of an ingredient, e.g. " 650mg", " 250 IU", " 1% w/w". */
const TRAILING_DOSE =
  /\s*(\d+(?:[.,]\d+)?\s*(?:mcg|ug|µg|mg|gm|ml|iu|units?|mcl|%)\s*(?:\/\s*ml|w\/\s*[wv])?)\s*$/i;

/**
 * Split a composition into its individual ingredients, keeping the dose that
 * belongs to each one.
 *
 * "Ibuprofen 400mg + Paracetamol 325mg" becomes two ingredients with their own
 * strengths. An ingredient with no stated dose keeps a null strength rather
 * than inheriting a number from a neighbour.
 */
export function parseComposition(composition: string | null | undefined): ProductIngredient[] {
  if (!composition) return [];
  return composition
    // Catalogs list alternate strengths as "500mg / 650mg"; keep them together
    // so the ingredient keeps the strengths that actually apply to it.
    .split(/\s*\+\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(TRAILING_DOSE);
      const strength = match ? match[0].trim().replace(/\s+/g, " ") : null;
      const name = (match ? part.slice(0, match.index) : part).trim();
      return {
        name: name || part,
        strength,
        role: ingredientRole(name || part),
      };
    })
    .filter((ingredient) => ingredient.name.length > 0);
}

// ── Small formatting helpers ──

const clean = (value: string | null | undefined) => (value ?? "").trim();

/** Split verified benefit copy into individual claims, dropping empty fragments. */
function toClaims(text: string): string[] {
  return text
    .split(/(?<=\.)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => (/[.!?]$/.test(s) ? s : `${s}.`));
}

function formatExpiry(expiryDate: number | null | undefined): string | null {
  if (!expiryDate) return null;
  const d = new Date(expiryDate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const rxStatus = (prescriptionRequired: boolean | null | undefined) =>
  prescriptionRequired ? "Prescription only (Rx)" : "Over the counter (OTC)";

/** A short, plain-language name for what the product is, used in facts and FAQs. */
function productTypeLabel(kind: ProductKind, form: string | null | undefined): string {
  if (clean(form)) return clean(form);
  return formForKind(kind) ?? "Product";
}

/**
 * Storage guidance for this product: the product's own recorded value, then the
 * reference record's, then ingredient- and form-level guidance. Null when none
 * of those exist, so a storage temperature is never asserted without a source.
 */
function resolveStorage(
  identity: ProductContentInput,
  reference: VerifiedReference | null,
  kind: ProductKind
): string | null {
  // Neither a condom nor a diagnostic device has a medicine storage
  // specification, and rows for them still carry one — a condom recorded as
  // "Store below 25°C", copied from the drug whose composition it was
  // mistakenly given. A storage temperature is only stated when it belongs to
  // something that actually has one.
  if (kind === "condom" || kind === "device") {
    return "Keep the pack sealed, dry and undamaged, and store it as described on the pack. Do not store it in direct sunlight or where it may freeze.";
  }
  const stored = clean(identity.storageInformation);
  if (stored) return stored;
  const fromRecord = clean(reference?.storageInformation);
  if (fromRecord) return fromRecord;
  const composition = reference?.composition || clean(identity.composition);
  const form = reference?.form || clean(identity.form);
  const derived = getStorageInfo(composition, form);
  if (derived) return derived;
  return null;
}

// ── Per-type usage copy, written only for the product's physical type ──

/** What to say about dose and schedule, which is never inferred. */
function resolveTiming(identity: ProductContentInput, kind: ProductKind): string | null {
  if (kind === "unknown") return null;
  if (identity.prescriptionRequired) {
    return "Use only as directed by your doctor or pharmacist. The dose and schedule for this product are not published here, and should be taken from your prescription or the pack.";
  }
  if (isOral(kind)) {
    return "Follow the dose and schedule printed on this pack. Do not take more often or in larger amounts than the pack states.";
  }
  if (isMedicine(kind)) {
    return "Follow the dose and schedule printed on this pack or given by your doctor or pharmacist.";
  }
  return "Use no more often than the pack instructions allow.";
}

function resolveDuration(identity: ProductContentInput, kind: ProductKind): string | null {
  if (kind === "unknown") return null;
  if (identity.prescriptionRequired) {
    return "Use for the period your doctor prescribes, and do not stop early even if you feel better, without checking with them first.";
  }
  if (kind === "oral_tablet" || kind === "oral_capsule" || kind === "oral_syrup" || kind === "oral_powder") {
    return "Continue only as long as advised on the pack. If your symptoms persist or get worse, stop and speak to a doctor or pharmacist.";
  }
  if (kind === "topical" || kind === "personal_care") {
    return "Use as needed within the limits on the pack, and stop as soon as the area is settled.";
  }
  if (kind === "device") {
    return "Use the device for as long as your clinician advises. Replace strips, lancets and other consumables at the interval given in the device manual.";
  }
  if (kind === "nutrition" || kind === "supplement") {
    return "Use consistently as described on the pack. This is a nutrition product, not a treatment for a medical condition.";
  }
  if (kind === "condom") {
    return "Single use only. Use a new condom for every act of intercourse.";
  }
  return null;
}

function resolveImportant(kind: ProductKind, prescriptionRequired: boolean | null | undefined): string | null {
  if (kind === "unknown") return null;
  const points: string[] = [];
  if (prescriptionRequired) {
    points.push("This product is prescription-only. Do not self-medicate, and do not share it with anyone else.");
  }
  switch (kind) {
    case "device":
      points.push("This is a medical device or consumable, not a medicine. It does not replace a diagnosis, and its results should not change your treatment without speaking to your doctor.");
      break;
    case "condom":
      points.push("Check the expiry date and the pack for damage before use. A condom reduces but does not eliminate the risk of pregnancy and sexually transmitted infection.");
      break;
    case "nutrition":
    case "supplement":
      points.push("This is a nutrition product and is not a substitute for a varied, balanced diet.");
      break;
    case "injection":
      points.push("This product is given by injection, by a trained healthcare professional or by someone who has been trained and instructed in how to do it.");
      break;
    case "inhaler":
      points.push("Use this product only in the position shown in its instructions, and do not exceed the number of puffs stated on the pack.");
      break;
    case "eye_drop":
    case "ear_drop":
    case "nasal":
      points.push("Do not share this product with anyone else, and do not touch the tip of the bottle or nozzle to the eye, ear or inside of the nose.");
      break;
    case "topical":
      points.push("For external use only. Do not use on broken or infected skin unless the pack states that this product is intended for it.");
      break;
    case "personal_care":
      points.push("For external use only. Stop using if you develop irritation.");
      break;
    default:
      break;
  }
  return points.length ? points.join(" ") : null;
}

/** Expiry guidance written for the kind of product, not for "medications" in general. */
function expiryWarning(kind: ProductKind, expiry: string | null): string {
  if (kind === "device") {
    return `Do not use this product after the expiry date printed on the pack, and do not use test strips from an opened vial past the date given on that vial. Expired consumables can give unreliable results. ${expiry ? `The batch supplied expires on ${expiry}.` : ""}`.trim();
  }
  if (kind === "condom") {
    return `Do not use this condom after the expiry date printed on the wrapper. Expired latex loses strength and can tear during use. ${expiry ? `The batch supplied expires on ${expiry}.` : ""}`.trim();
  }
  if (!isMedicine(kind)) {
    return `Do not use this product after the expiry date printed on the pack. ${expiry ? `The batch supplied expires on ${expiry}.` : ""}`.trim();
  }
  return `Do not use this product after the expiry date printed on the pack. Expired medicines can lose their effect and may be unsafe. ${expiry ? `The batch supplied expires on ${expiry}.` : ""}`.trim();
}

/** Allergy guidance that names this product's own ingredients when known. */
function allergyWarning(ingredients: ProductIngredient[] | null, kind: ProductKind): string {
  if (kind === "device") {
    return "This is a medical device, not a medicine, and it contains no active drug. Stop using it and contact the manufacturer or your pharmacist if the device malfunctions, the strips give an unexpected result, or the skin is irritated where a sensor is used.";
  }
  if (ingredients && ingredients.length > 0) {
    const names = ingredients.map((i) => i.name).join(", ");
    return `This product contains ${names}. Check that you are not allergic to any of them before use. If you develop a rash, swelling, breathing difficulty or any other unusual reaction, stop using it and seek medical help.`;
  }
  if (isMedicine(kind)) {
    return "The full ingredient list for this product is not available here. Check the pack for the ingredients, and do not use it if you are allergic to any of them. If you develop a rash, swelling or breathing difficulty, stop use and seek medical help.";
  }
  return "This product is not a medicine. Stop using it if you develop irritation, and check the pack for the full ingredient list if you have a known allergy.";
}

/** Precautions for the product type, plus the prescription position where it applies. */
function precautionWarning(
  kind: ProductKind,
  prescriptionRequired: boolean | null | undefined,
  safety: string | null
): string {
  if (kind === "unknown") return SAFETY_UNAVAILABLE;
  const base =
    safety ??
    (isMedicine(kind)
      ? "Read the leaflet supplied with the pack before use, and ask your doctor or pharmacist if anything on it is unclear."
      : "Follow the handling instructions supplied with the pack, and ask a pharmacist if anything is unclear.");
  if (prescriptionRequired) {
    return `This is a prescription medicine. Do not start, stop or change how you take it without speaking to your doctor, and tell your doctor about any other medicines you are taking. ${base}`.trim();
  }
  return base;
}

// ── The builder ──

/**
 * Build every Product Detail section's content for one exact product.
 *
 * The returned object is the only thing the page renders. A null field means
 * "not verified" and the page must show its unavailable message rather than a
 * substitute — that is the whole point of this module.
 */
export function buildProductContent(input: ProductContentInput): ProductContent {
  const name = clean(input.name) || "This product";
  const manufacturer = clean(input.manufacturer) || clean(input.reference?.manufacturer);
  const brand = clean(input.brand);
  const strength = clean(input.strength);
  const packSize = clean(input.packSize);
  const categoryName = clean(input.categoryName);

  const reference =
    input.reference !== undefined
      ? input.reference
      : findVerifiedReference(input).reference;

  // Classification prefers the record's verified dosage form over the stored
  // `form`, which is the field most often wrong. Strong identity signals
  // (name, category, composition) still outrank both.
  const withReference = classifyProduct({
    name: input.name,
    form: reference?.form ?? input.form ?? null,
    packSize: input.packSize ?? null,
    categoryName: input.categoryName ?? null,
    composition: reference?.composition ?? input.composition ?? null,
    manufacturer: input.manufacturer ?? null,
    strength: input.strength ?? null,
  });
  // A record is sometimes a brand-level entry that covers one format ("Volini"
  // is listed as a gel) while the product in front of us is a different format
  // of that brand. The product's own form then wins, because a format the shop
  // itself recorded is more specific than a record matched on the brand name.
  const onItsOwn = classifyProduct({
    name: input.name,
    form: input.form ?? null,
    packSize: input.packSize ?? null,
    categoryName: input.categoryName ?? null,
    composition: input.composition ?? null,
    manufacturer: input.manufacturer ?? null,
    strength: input.strength ?? null,
  });
  const classification =
    onItsOwn.confident && withReference.confident && onItsOwn.kind !== withReference.kind
      ? onItsOwn
      : withReference;
  const kind = classification.kind;
  const confident = classification.confident;
  const verified = Boolean(reference);
  const source: ContentSource = verified ? "reference" : confident ? "product-type" : "product-metadata";

  const typeLabel = productTypeLabel(kind, reference?.form ?? input.form);
  const expiry = formatExpiry(input.expiryDate);

  // ── Composition and ingredients ──
  // The product's own composition wins over the record's: it is the value
  // stored against this exact variant, including its strength.
  //
  // A condom and a diagnostic device have no active ingredients. Some rows
  // still carry a drug composition left behind by the old generator — a condom
  // recorded as "Paracetamol 500mg / 650mg" — and displaying it would invent an
  // ingredient list for a product that has none, along with storage guidance
  // derived from a drug. The composition is ignored here rather than trusted.
  const hasIngredients = kind !== "condom" && kind !== "device";
  const compositionText = hasIngredients
    ? clean(input.composition) || clean(reference?.composition)
    : null;
  const ingredients = parseComposition(compositionText);

  // ── Benefits ──
  // Only declared-verified copy is used. A benefits string of unknown origin is
  // ignored, because the old form-driven generator produced convincing
  // sentences that were not true of the product.
  const declaredBenefits =
    input.benefitsSource && /^(reference|packaging|manufacturer|official)$/i.test(input.benefitsSource)
      ? clean(input.benefits)
      : "";
  const benefitsText = reference?.benefits || declaredBenefits;
  const benefits = benefitsText ? toClaims(benefitsText) : null;

  // ── Directions ──
  // Route-specific handling instructions, gated on a confident product type.
  // Never derived from the `form` field alone.
  const directions = confident ? productDirections(input, kind) : null;
  const directionsNote = directions
    ? confident && !verified
      ? `This is general guidance for a ${typeLabel} product. The instructions printed on the pack always take precedence, and no dose or schedule is stated here because none has been verified for this product.`
      : null
    : DIRECTIONS_UNAVAILABLE;

  const safetyCopy = confident ? productSafety(input, kind) : null;
  const storage = resolveStorage(input, reference, kind);

  // ── Product Information ──
  const summaryParts: string[] = [];
  if (benefits && isMedicine(kind) && verified) {
    summaryParts.push(`${name} is a ${typeLabel} from ${manufacturer || brand || "its manufacturer"}.`);
  } else if (confident) {
    summaryParts.push(
      `${name} is supplied as ${typeLabel}${strength ? ` at ${strength}` : ""}.`
    );
  } else {
    summaryParts.push(`${name} is sold at Kalyan Chemist.`);
  }
  if (manufacturer) summaryParts.push(`It is manufactured and marketed by ${manufacturer}.`);
  if (brand && brand !== manufacturer) summaryParts.push(`It is sold under the ${brand} brand.`);
  if (strength) summaryParts.push(`Each unit is ${strength}.`);
  if (packSize) summaryParts.push(`It is supplied in a pack of ${packSize}.`);
  summaryParts.push(
    rxStatus(input.prescriptionRequired) === "Prescription only (Rx)"
      ? "It is a prescription-only product."
      : "It is available over the counter."
  );

  const facts: ProductFact[] = [];
  const addFact = (label: string, value: string | null | undefined) => {
    const v = clean(value);
    if (v) facts.push({ label, value: v });
  };
  addFact("Product type", confident ? typeLabel : clean(input.form) || "Not specified");
  addFact("Category", categoryName);
  addFact("Strength", strength);
  addFact("Pack size", packSize);
  addFact("Manufacturer", manufacturer);
  addFact("Brand", brand);
  addFact("Composition", compositionText);
  addFact("Prescription status", rxStatus(input.prescriptionRequired));
  addFact("Storage", storage);
  addFact("Expiry", expiry);

  const primaryUse = benefits ? benefits[0].replace(/\.$/, "") : null;

  // ── Safety ──
  const safety: ProductFact[] = [
    { label: "Storage", value: storage ?? STORAGE_UNAVAILABLE },
    { label: "Expiry", value: expiryWarning(kind, expiry) },
    { label: kind === "device" ? "Device faults" : "Allergies and reactions", value: allergyWarning(ingredients, kind) },
    { label: "Precautions", value: precautionWarning(kind, input.prescriptionRequired, safetyCopy) },
  ];
  // The manufacturer note is only shown when it is the product's own recorded
  // note, not a type-derived sentence repeated across the catalogue.
  const storedNote = clean(input.safetyNote);
  const manufacturerNote =
    storedNote && storedNote === safetyCopy ? null : storedNote || null;

  // ── Information: verified product facts, never website or service copy ──
  const information: ProductFact[] = [];
  const addInfo = (label: string, value: string | null | undefined) => {
    const v = clean(value);
    if (v) information.push({ label, value: v });
  };
  addInfo("Manufacturer", manufacturer);
  addInfo("Brand", brand);
  addInfo("Product type", confident ? typeLabel : clean(input.form));
  addInfo("Category", categoryName);
  addInfo("Strength", strength);
  addInfo("Composition", compositionText);
  addInfo("Pack size", packSize);
  addInfo("Prescription status", rxStatus(input.prescriptionRequired));
  addInfo("Storage", storage);
  addInfo("Expiry", expiry);
  addInfo("Handling route", routeLabel(kind));

  // ── FAQs, built from this product's own data ──
  const faqs = buildFaqs({
    name,
    typeLabel,
    confident,
    verified,
    manufacturer,
    brand,
    strength,
    packSize,
    rx: rxStatus(input.prescriptionRequired),
    benefits,
    ingredients,
    directions,
    primaryUse,
    precaution: safety[3].value,
  });

  return {
    kind,
    kindConfident: confident,
    source,
    verified,
    summary: summaryParts.join(" "),
    facts,
    benefits,
    benefitsIntro: benefits
      ? `${name} — the following benefits are recorded for this exact product.`
      : null,
    benefitsNote: verified
      ? "This information is taken from the product's published product information. It is a summary and does not replace the leaflet supplied with the pack."
      : null,
    ingredients: ingredients.length ? ingredients : null,
    ingredientsNote: compositionText
      ? "Only the ingredients stated for this product are listed. The pack also contains excipients (binders, fillers and coatings) that are not listed here."
      : null,
    directions,
    directionsNote,
    timing: resolveTiming(input, kind),
    duration: resolveDuration(input, kind),
    important: resolveImportant(kind, input.prescriptionRequired),
    manufacturerNote,
    safety,
    information,
    faqs,
  };
}

/** Plain description of how this product enters the body, for the Information section. */
function routeLabel(kind: ProductKind): string | null {
  switch (kind) {
    case "oral_tablet":
    case "oral_capsule":
    case "oral_syrup":
    case "oral_powder":
      return "Taken by mouth";
    case "topical":
    case "personal_care":
      return "Applied to the skin (external use)";
    case "eye_drop":
      return "Instilled into the eye";
    case "ear_drop":
      return "Instilled into the ear";
    case "nasal":
      return "Used in the nose";
    case "inhaler":
      return "Inhaled";
    case "injection":
      return "Given by injection";
    case "condom":
      return "Used as a barrier contraceptive";
    case "device":
      return "Used as a medical device or diagnostic consumable";
    case "nutrition":
    case "supplement":
      return "Taken as a nutrition product";
    case "unknown":
    default:
      return null;
  }
}

interface FaqInput {
  name: string;
  typeLabel: string;
  confident: boolean;
  verified: boolean;
  manufacturer: string | null;
  brand: string | null;
  strength: string | null;
  packSize: string | null;
  rx: string;
  benefits: string[] | null;
  ingredients: ProductIngredient[] | null;
  directions: string | null;
  primaryUse: string | null;
  precaution: string;
}

/**
 * Six questions about this exact product.
 *
 * Every answer is assembled from the fields resolved above, so an answer is
 * either specific to this product or it is the honest unavailable message.
 * There is no shared answer text between unrelated products.
 */
function buildFaqs(input: FaqInput): ProductFaq[] {
  const { name } = input;
  const identityParts = [
    input.manufacturer ? `It is manufactured by ${input.manufacturer}.` : null,
    input.brand && input.brand !== input.manufacturer ? `It is sold under the ${input.brand} brand.` : null,
    input.strength ? `Its strength is ${input.strength}.` : null,
    input.packSize ? `It is supplied in a pack of ${input.packSize}.` : null,
  ].filter(Boolean) as string[];

  const usedFor = input.benefits ? input.benefits.join(" ") : BENEFITS_UNAVAILABLE;

  const compositionAnswer = input.ingredients && input.ingredients.length
    ? `${name} contains ${input.ingredients
        .map((i) => (i.strength ? `${i.name} (${i.strength})` : i.name))
        .join(", ")}.`
    : INGREDIENTS_UNAVAILABLE;

  return [
    {
      question: `What is ${name}?`,
      answer:
        identityParts.length && input.confident
          ? `${name} is a ${input.typeLabel}${input.strength ? ` (${input.strength})` : ""}. ${identityParts.join(" ")}`
          : `${name} is listed at Kalyan Chemist. ${identityParts.join(" ")} We do not have verified product information for it, so please refer to the pack for what it is and how to use it.`,
    },
    {
      question: `What is ${name} used for?`,
      answer: usedFor,
    },
    {
      question: `How should ${name} be used?`,
      answer: input.directions ?? DIRECTIONS_UNAVAILABLE,
    },
    {
      question: `What is the composition of ${name}?`,
      answer: compositionAnswer,
    },
    {
      question: `Is ${name} a prescription-only medicine?`,
      answer: `${name} is recorded as ${input.rx} on our records.${
        input.rx.startsWith("Prescription")
          ? " You will need to upload a valid prescription at checkout, and our pharmacist will verify it before the order is dispatched."
          : " No prescription is needed to order it, though a pharmacist can advise you on whether it is suitable for you."
      }`,
    },
    {
      question: `What precautions should I take with ${name}?`,
      answer: input.precaution,
    },
    {
      question: `What is the strength and pack size of ${name}?`,
      answer: [
        input.strength ? `It is supplied at ${input.strength}.` : null,
        input.packSize ? `The pack contains ${input.packSize}.` : null,
      ]
        .filter(Boolean)
        .join(" ") ||
        `The strength and pack size for ${name} are not recorded. Please check the pack, or ask a pharmacist before ordering.`,
    },
  ];
}
