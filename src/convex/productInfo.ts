/**
 * Product-kind classification and product-appropriate product information.
 *
 * The bug this module exists to fix: directions and safety copy used to be
 * derived from the `form` field alone, so a product mislabelled
 * `form: "tablet"` — a condom, a test strip, a monitor — was handed
 * "Tablet — taken orally with water."
 *
 * Two rules shape everything here:
 *
 * 1. STRONG IDENTITY SIGNALS BEAT A WEAK FORM FIELD. A product whose *name*,
 *    category or composition clearly identifies what it is (condom, glucose
 *    meter, protein drink) is classified from that, even when `form` says
 *    "tablet". A bad `form` value can never talk us into medicine copy.
 *
 * 2. NEVER INVENT CLINICAL INFORMATION. This module writes only what follows
 *    from the product's physical type: how that object is actually used, and
 *    general handling precautions. It never states a drug dose, a therapeutic
 *    claim, a contraindication or an ingredient that we have not been given.
 *    Anything we cannot determine returns null so the UI can show an honest
 *    "information not available" state instead of a confident wrong answer.
 *
 * Pure and dependency-free so it can be unit tested and reused by the
 * enrichment action, the repair action and the admin lookup.
 */

/** How a product is actually used, which is what the copy is written around. */
export type ProductKind =
  | "oral_tablet"       // swallowed solid dose
  | "oral_capsule"
  | "oral_syrup"        // oral liquid
  | "oral_powder"       // sachet / powder dissolved in water
  | "topical"           // cream, ointment, gel, lotion, balm, oil
  | "eye_drop"
  | "ear_drop"
  | "nasal"
  | "inhaler"
  | "injection"
  | "condom"            // barrier contraceptive
  | "device"            // meter, monitor, strips, nebuliser, test kit
  | "nutrition"         // health/nutrition drink, protein, infant formula
  | "supplement"        // vitamin / mineral / herbal supplement
  | "personal_care"     // shampoo, soap, toothpaste, wipes
  | "unknown";

export interface ProductIdentity {
  name: string;
  form?: string | null;
  /** Pack size often states the dosage form outright, e.g. "10 tablets". */
  packSize?: string | null;
  categoryName?: string | null;
  composition?: string | null;
  manufacturer?: string | null;
  strength?: string | null;
}

export interface Classification {
  kind: ProductKind;
  /** True when a strong identity signal (name/category/composition) decided it. */
  confident: boolean;
  /** Short human-readable reason, surfaced in the admin review panel. */
  reason: string;
}

const has = (haystack: string | null | undefined, ...needles: string[]) => {
  if (!haystack) return false;
  const text = haystack.toLowerCase();
  return needles.some((n) => text.includes(n));
};

/**
 * Strong identity signals. These describe what the product *is* and outrank a
 * form field, which is frequently wrong for anything that is not a medicine.
 */
function classifyByIdentity(input: ProductIdentity): Classification | null {
  const { name, categoryName } = input;

  // Barrier contraception — never described as a medicine.
  if (has(name, "condom", "precaution", "sheath")) {
    return { kind: "condom", confident: true, reason: "name identifies a condom" };
  }

  // Diagnostic / monitoring devices and consumables.
  if (
    has(name, "glucose meter", "glucometer", "blood pressure monitor", "thermometer",
        "nebulizer", "nebuliser", "oximeter", "weighing scale", "hearing aid",
        "test strip", "test kit", "pregnancy test", "insulin pen", "syringe")
  ) {
    return { kind: "device", confident: true, reason: "name identifies a device" };
  }
  // "Accu-Chek Active Strips" states the form, and a strip is a consumable
  // that is used with a device — never a solid oral dose to be swallowed.
  if (/\bstrips?\b/i.test(name)) {
    return { kind: "device", confident: true, reason: "name identifies test strips" };
  }
  // Diapers and nappies are unambiguously personal care, not medicines.
  if (has(name, "diaper", "diaper", "nappy", "nappies")) {
    return { kind: "personal_care", confident: true, reason: "name identifies an absorbent hygiene product" };
  }
  if (has(name, "monitor", "meter") && !has(name, "mg", "tablet")) {
    return { kind: "device", confident: true, reason: "name identifies a device" };
  }

  // Nutrition products, distinguished from plain supplements.
  if (
    has(name, "health drink", "protein powder", "protein", "nutritional drink",
        "infant formula", "infant feed", "tonic", "energy drink", "sugar free",
        "diabetes care", "malt")
  ) {
    return { kind: "nutrition", confident: true, reason: "name identifies a nutrition product" };
  }

  // Category is a strong signal too.
  if (has(categoryName, "device")) {
    return { kind: "device", confident: true, reason: "category is a medical device" };
  }
  if (has(categoryName, "nutrition")) {
    return { kind: "nutrition", confident: true, reason: "category is nutrition" };
  }
  if (has(categoryName, "condom", "contracept", "family planning")) {
    return { kind: "condom", confident: true, reason: "category is contraception" };
  }

  return null;
}

/** Forms that are genuinely oral medicines. */
const ORAL_FORMS: Array<[string, ProductKind]> = [
  ["tablet", "oral_tablet"],
  ["caplet", "oral_tablet"],
  ["pill", "oral_tablet"],
  ["lozenge", "oral_tablet"],
  ["capsule", "oral_capsule"],
  ["soft gelatin", "oral_capsule"],
  ["syrup", "oral_syrup"],
  ["suspension", "oral_syrup"],
  ["oral solution", "oral_syrup"],
  ["elixir", "oral_syrup"],
  ["sachet", "oral_powder"],
  ["powder", "oral_powder"],
  ["effervescent", "oral_powder"],
];

function classifyByForm(form: string | null | undefined): Classification | null {
  if (!form) return null;
  const text = form.toLowerCase();

  if (has(text, "eye drop", "eyedrop", "ophthalmic")) {
    return { kind: "eye_drop", confident: true, reason: "form is an eye drop" };
  }
  if (has(text, "ear drop", "eardrop", "otic")) {
    return { kind: "ear_drop", confident: true, reason: "form is an ear drop" };
  }
  if (has(text, "nasal")) {
    return { kind: "nasal", confident: true, reason: "form is nasal" };
  }
  if (has(text, "inhaler", "respule", "nebule", "aerosol", "inhalation")) {
    return { kind: "inhaler", confident: true, reason: "form is inhaled" };
  }
  if (has(text, "injection", "injectable", "vial", "ampoule", "prefilled")) {
    return { kind: "injection", confident: true, reason: "form is injectable" };
  }
  if (
    has(text, "cream", "ointment", "gel", "lotion", "balm", "topical", "oil",
        "liniment", "wax", "mask", "soap", "scrub")
  ) {
    return { kind: "topical", confident: true, reason: "form is applied to the skin" };
  }
  if (has(text, "shampoo", "conditioner", "toothpaste", "wipe", "face wash", "cleanser", "deodorant")) {
    return { kind: "personal_care", confident: true, reason: "form is a personal care product" };
  }
  if (has(text, "strip", "device", "monitor", "meter", "kit")) {
    return { kind: "device", confident: true, reason: "form is a device or consumable" };
  }

  for (const [needle, kind] of ORAL_FORMS) {
    if (has(text, needle)) {
      return { kind, confident: true, reason: `form is ${needle}` };
    }
  }
  return null;
}

/** Vitamins and minerals are supplements wherever they are sold. */
function classifyByComposition(composition: string | null | undefined): Classification | null {
  if (!composition) return null;
  if (has(composition, "vitamin", "folic acid", "calcium", "iron", "zinc", "biotin",
           "multivitamin", "mineral", "omega", "ginseng", "spirulina", "protein")) {
    return { kind: "supplement", confident: true, reason: "composition is a supplement" };
  }
  return null;
}

/**
 * Form words stated in the pack size, e.g. "10 tablets", "30g tube",
 * "100ml syrup". Very many products carry no `form` value but do state the
 * dosage form here, so this is stated data rather than a guess.
 */
const PACK_SIZE_FORM_WORDS: Array<[RegExp, ProductKind]> = [
  [/\btablets?\b/i, "oral_tablet"],
  [/\bcapsules?\b/i, "oral_capsule"],
  [/\blozenges?\b/i, "oral_tablet"],
  [/\bsachets?\b/i, "oral_powder"],
  [/\bsyrup\b|\bsuspension\b/i, "oral_syrup"],
  [/\b(eye|ophthalmic)\s*drop/i, "eye_drop"],
  [/\bnasal\s*drop/i, "nasal"],
  [/\b(cream|ointment|gel|balm|tube)\b/i, "topical"],
  [/\blotion\b/i, "topical"],
  [/\binhalers?\b/i, "inhaler"],
  [/\b(strips?|kit|kits|device|meter|monitor)\b/i, "device"],
];

function classifyByPackSize(packSize: string | null | undefined): Classification | null {
  if (!packSize) return null;
  for (const [pattern, kind] of PACK_SIZE_FORM_WORDS) {
    if (pattern.test(packSize)) {
      return { kind, confident: true, reason: "pack size states the dosage form" };
    }
  }
  return null;
}

/**
 * Form words stated in the product's own name, e.g. "Volini Gel" or
 * "Ascoril LS Syrup". Many products carry no `form` value at all, and the
 * name is a reliable statement of what the product is.
 *
 * Matched on word boundaries: short tokens such as "oil" or "gel" would
 * otherwise match inside unrelated words.
 */
const NAME_FORM_WORDS: Array<[RegExp, ProductKind]> = [
  [/\b(eye|ophthalmic)\s*drop|\bdrop(s)?\s*for\s*(the\s*)?eyes?\b/i, "eye_drop"],
  [/\bear\s*drop|\botic\b/i, "ear_drop"],
  [/\bnasal\b/i, "nasal"],
  [/\binhaler\b|\brespules?\b/i, "inhaler"],
  [/\binjection\b|\binjectable\b/i, "injection"],
  [/\b(eye|ear|nasal)\b/i, "topical"],
  [/\b(cream|ointment|gel|lotion|balm|liniment|topical|scrub|wax|oil|spray)\b/i, "topical"],
  [/\b(syrup|suspension|oral\s*solution|elixir)\b/i, "oral_syrup"],
  [/\b(sachets?|powder|effervescent)\b/i, "oral_powder"],
  [/\b(capsules?)\b/i, "oral_capsule"],
  [/\b(tablets?|caplets?|pills?|lozenges?)\b/i, "oral_tablet"],
  [/\b(shampoo|conditioner|toothpaste|face\s*wash|cleanser|deodorant|wipes?)\b/i, "personal_care"],
  [/\b(diaper|diapers|nappy|nappies|kit|kits)\b/i, "device"],
];

function classifyByName(name: string | null | undefined): Classification | null {
  if (!name) return null;
  for (const [pattern, kind] of NAME_FORM_WORDS) {
    if (pattern.test(name)) {
      return { kind, confident: true, reason: "product name states the form" };
    }
  }
  return null;
}

/**
 * Decide what kind of product this is.
 *
 * Identity signals win over the form field, so a condom stored with
 * `form: "tablet"` is still classified as a condom. Only when nothing is
 * recognised do we fall back to a generic medicine, and even then the result
 * is marked not confident so callers can withhold copy.
 */
export function classifyProduct(input: ProductIdentity): Classification {
  return (
    classifyByIdentity(input) ??
    classifyByForm(input.form) ??
    classifyByPackSize(input.packSize) ??
    classifyByComposition(input.composition) ??
    classifyByName(input.name) ?? {
      kind: "unknown",
      confident: false,
      reason: "product type could not be determined from its name, form, pack size or composition",
    }
  );
}

/** True for products taken by mouth, which is what makes oral copy valid. */
export function isOral(kind: ProductKind) {
  return (
    kind === "oral_tablet" ||
    kind === "oral_capsule" ||
    kind === "oral_syrup" ||
    kind === "oral_powder"
  );
}

/** True when the product is a medicated product rather than a device or consumer good. */
export function isMedicine(kind: ProductKind) {
  return isOral(kind) || [
    "topical", "eye_drop", "ear_drop", "nasal", "inhaler", "injection",
  ].includes(kind);
}

/** Medicine forms, used to spot a non-medicine wrongly filed as a medicine. */
const MEDICINE_FORMS = [
  "tablet", "capsule", "caplet", "pill", "lozenge", "syrup", "suspension",
  "sachet", "powder", "injection", "inhaler", "drops", "eye drops", "nasal drops",
];

/** True when a stored `form` value is one that implies an oral/medicinal product. */
export function isMedicineForm(form: string | null | undefined) {
  if (!form) return false;
  const text = form.toLowerCase();
  return MEDICINE_FORMS.some((f) => text.includes(f));
}

/**
 * The `form` value that accurately describes a classified product kind.
 * Used to repair a non-medicine that was filed with a medicine form, which is
 * what made a condom display as a tablet.
 */
export function formForKind(kind: ProductKind): string | null {
  switch (kind) {
    case "oral_tablet": return "tablet";
    case "oral_capsule": return "capsule";
    case "oral_syrup": return "syrup";
    case "oral_powder": return "sachet";
    case "topical": return "topical";
    case "eye_drop": return "eye drops";
    case "ear_drop": return "ear drops";
    case "nasal": return "nasal drops";
    case "inhaler": return "inhaler";
    case "injection": return "injection";
    case "condom": return "condom";
    case "device": return "device";
    case "nutrition": return "nutrition";
    case "supplement": return "supplement";
    case "personal_care": return "personal care";
    case "unknown":
    default: return null;
  }
}

/**
 * True when copy is medicine-templated and therefore cannot belong to a
 * product of this kind. Used to clear inherited template text.
 */
export function looksLikeMedicineTemplate(text: string | null | undefined) {
  if (!text) return false;
  return /\b(is a medication|is a medicine|therapeutic (use|benefit|action)|active ingredient|analgesic|antibiotic|antipyretic)\b/i.test(
    text
  );
}

const doseCaveat =
  "Follow the dosage on the pack or as directed by your doctor or pharmacist.";

/**
 * Directions for use, written for how this product is physically used.
 * Returns null when the product type is unknown so nothing generic is shown.
 */
export function productDirections(
  input: ProductIdentity,
  kind: ProductKind = classifyProduct(input).kind
): string | null {
  switch (kind) {
    case "oral_tablet":
      return `Swallow the tablet whole with water. Do not crush, chew or break unless the pack states otherwise. ${doseCaveat}`;
    case "oral_capsule":
      return `Swallow the capsule whole with water unless the pack states otherwise. Do not open the capsule. ${doseCaveat}`;
    case "oral_syrup":
      return `Take the syrup by mouth using the measuring cup or syringe supplied with the pack. Shake the bottle well before use. ${doseCaveat}`;
    case "oral_powder":
      return `Dissolve the contents of the sachet or the measured powder in the quantity of water shown on the pack and drink it. Use the contents of one sachet per dose unless directed otherwise. ${doseCaveat}`;
    case "topical":
      return `Apply a thin layer to the affected area of the skin as needed, following the instructions on the pack. Wash your hands before and after use unless the pack states otherwise. Do not apply to broken skin, eyes or mucous membranes.`;
    case "eye_drop":
      return `Instil the drops into the clean eye as directed on the pack. Wash your hands before use, avoid touching the dropper tip to the eye, and close the eye gently after instilling. Do not share the bottle.`;
    case "ear_drop":
      return `Instil the drops into the ear canal as directed on the pack, after cleaning and drying the outer ear. Lie on your side while the drops are in place. Do not use if the eardrum is perforated.`;
    case "nasal":
      return `Blow your nose gently, then use the nasal drops or spray as directed on the pack. Do not exceed the number of doses stated on the pack.`;
    case "inhaler":
      return `Use the inhaler as directed on the pack, in an upright position, taking slow deep breaths. Rinse your mouth after use if the pack states it is steroid-based.`;
    case "injection":
      return `This product is given by injection. It must be prepared and administered by a trained healthcare professional or self-injected only if you have been trained and instructed to do so.`;
    case "condom":
      return `Check the expiry date and tear the foil wrapper only at the moment of use. Put the condom on the erect penis before any genital contact, roll it to the base, and leave a small space at the tip. Withdraw immediately after ejaculation and remove the condom, wrapping it and disposing of it safely. Use a new condom for every act and for each partner.`;
    case "device":
      return `Read the instruction manual supplied with the device before use. Insert test strips, cartridges or samples only as directed, and follow the cleaning and storage instructions for the device. Recalibrate or replace the consumables at the interval stated in the manual.`;
    case "nutrition":
      return `Use as directed on the pack. For a health drink, shake well and serve the stated serving size once or twice daily as part of a balanced diet. Do not exceed the daily amount on the pack.`;
    case "supplement":
      return `Take as directed on the pack, usually with food or as stated on the label. Do not exceed the stated daily dose. ${doseCaveat}`;
    case "personal_care":
      return `Use as directed on the pack for external use only. Avoid contact with the eyes. Stop use if irritation occurs.`;
    case "unknown":
    default:
      return null;
  }
}

/**
 * Safety and precautions, appropriate to the product type.
 * Returns null when the product type is unknown.
 */
export function productSafety(
  input: ProductIdentity,
  kind: ProductKind = classifyProduct(input).kind
): string | null {
  switch (kind) {
    case "oral_tablet":
    case "oral_capsule":
      return `Do not take more than the dose stated on the pack. Check the ingredients if you are allergic to any of them, and check with a doctor before use if you are pregnant or breastfeeding, have a liver or kidney condition, or take any other regular medicine. Store out of reach of children, in a cool dry place.`;
    case "oral_syrup":
      return `Use the measuring device supplied and do not exceed the dose on the pack. Store the bottle tightly closed, away from light, and keep it out of reach of children.`;
    case "oral_powder":
      return `Do not exceed one sachet per dose or the daily amount on the pack. Use the exact quantity of water stated. Keep the sachets dry and out of reach of children.`;
    case "topical":
      return `For external use only. Do not apply to the face, broken or infected skin unless the pack states it is intended for that use. Stop use if you develop a rash or irritation. Keep out of reach of children and avoid contact with the eyes.`;
    case "eye_drop":
      return `Do not use if you are wearing contact lenses unless the pack allows it. Do not touch the dropper tip to the eye or to your fingers. Discard the bottle as directed on the pack, and do not use if the solution is not clear or the seal is broken.`;
    case "ear_drop":
      return `Do not use if the eardrum is perforated or if the ear is discharging. Do not use cotton swabs or other objects in the ear canal. Stop use if pain increases.`;
    case "nasal":
      return `Do not use for more than the number of days stated on the pack without medical advice. Avoid contact with the eyes. Stop use if nosebleeds occur.`;
    case "inhaler":
      return `Use only as directed. Do not exceed the number of puffs on the pack. Rinse your mouth after each use if the pack states this. Stop use and seek advice if you feel unwell after use.`;
    case "injection":
      return `This product must be stored and handled as directed on the pack, and it is given by a healthcare professional or by a trained person at home. Never inject into a vein unless the pack specifically states that this is intended.`;
    case "condom":
      return `Condoms are single use. Do not reuse a condom, and do not use one that has expired, is torn, or was stored in heat or direct sunlight. Check the pack for damage before opening. A condom reduces but does not eliminate the risk of pregnancy and sexually transmitted infection. Do not use oil-based products such as Vaseline with a condom, as they can weaken the latex. Keep out of reach of children.`;
    case "device":
      return `This is a medical device, not a medicine, and it does not replace professional diagnosis. Follow the manufacturer's instructions, do not open or modify the device, and dispose of used strips, lancets and sharps in a puncture-proof container. Do not use results to change any treatment without speaking to your doctor.`;
    case "nutrition":
      return `This is a nutrition product, not a medicine. It is not a substitute for a varied diet. Check the ingredients for allergies, and follow the preparation instructions on the pack. Use within the stated period after opening.`;
    case "supplement":
      return `Supplements are not a substitute for a balanced diet. Do not exceed the daily dose on the pack. Speak to a doctor before use if you are pregnant, breastfeeding, taking other medicines, or managing a medical condition. Keep out of reach of children.`;
    case "personal_care":
      return `For external use only. Avoid contact with the eyes. Stop use if irritation occurs. Keep out of reach of children.`;
    case "unknown":
    default:
      return null;
  }
}

/**
 * True when the copy for this product is only known from its physical type.
 * The UI uses this to tell the admin that a field is type-derived rather than
 * taken from official labelling.
 */
export function isTypeDerivedCopy(kind: ProductKind) {
  return kind !== "unknown";
}

/**
 * A neutral description for a product we cannot otherwise describe.
 * Deliberately says nothing about ingredients, dose or therapeutic effect.
 */
export function neutralDescription(input: ProductIdentity, kind: ProductKind): string {
  const name = input.name.trim();
  const form = (input.form ?? "").trim();
  const maker = (input.manufacturer ?? "").trim();

  const parts: string[] = [];
  if (kind === "device") {
    parts.push(`${name} is a medical device.`);
  } else if (kind === "condom") {
    parts.push(`${name} is a barrier contraceptive.`);
  } else if (kind === "nutrition") {
    parts.push(`${name} is a nutrition product.`);
  } else if (kind === "personal_care") {
    parts.push(`${name} is a personal care product.`);
  } else if (kind !== "unknown") {
    parts.push(form ? `${name} is available as ${form}.` : `${name} is a healthcare product.`);
  } else {
    parts.push(`${name} is a healthcare product.`);
  }
  if (maker) parts.push(`It is marketed by ${maker}.`);
  parts.push("Refer to the pack or to a pharmacist for details of its use.");
  return parts.join(" ");
}

/** The copy required when a product could not be identified with confidence. */
export const NO_CONFIDENT_MATCH_MESSAGE =
  "Product match not confidently found. Please select a matching product or enter/verify the required information manually.";
