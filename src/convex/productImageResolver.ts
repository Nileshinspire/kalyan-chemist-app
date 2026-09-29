/**
 * Product image resolution — finds the REAL commercial packshot for an exact
 * product and stores it in Convex storage.
 *
 * Rules this module deliberately enforces:
 *
 * - Search with the FULL product identity — name + brand + manufacturer +
 *   strength + dosage + form + pack size + composition + SKU — never just the
 *   generic composition or the bare brand.
 * - Several independent sources are tried, in this order, until one of them
 *   yields a verified packshot:
 *     1. the brand's/manufacturer's own website (official product page),
 *     2. a licensed Indian pharmacy catalogue (PharmEasy) whose records carry
 *        the pack name, manufacturer, pack form and per-face packshots,
 *     3. open product databases (Open Food/Beauty/Products Facts) whose images
 *        are attached to a barcode-verified product record.
 *   Every source is asked with the same full identity, and a SKU that looks like
 *   a barcode is looked up directly as well.
 * - Accept an image only when the source's own record proves it is the same
 *   product: every meaningful word of the entered name must appear as a whole
 *   word, a dose strength (mg/mcg/IU, or a bare tablet number such as "Dolo
 *   650") must match exactly, and a stated dosage form must be the same form
 *   ("syrup" may be listed as an expectorant or oral solution; a lotion is
 *   never a cream, a gel never a spray, a tablet never a capsule).
 *   Near-misses — Dolo 500,
 *   Dolo Cold, "Dolopar 650", a generic paracetamol pack, Volini Spray for
 *   Volini Gel — are rejected rather than accepted as "close enough".
 * - Never invent an image. There is no placeholder, generic icon or generated
 *   graphic anywhere in this path: when nothing can be verified the caller gets
 *   an explicit failure so the admin can retry or fix the name.
 * - Never store a third-party URL as the product image. Verified bytes are
 *   downloaded and written to Convex storage, so the customer-facing image
 *   cannot rot when the source moves.
 */
import { action, internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const USER_AGENT =
  "KalyanChemist/1.0 (https://kalyanchemist.com; product image retrieval)";

/** Licensed catalogue with per-product records: name, manufacturer, images. */
const PHARMEASY_SEARCH = "https://pharmeasy.in/search/all?name=";

/** Open product databases: product name, brand, quantity and a real packshot. */
const OPEN_FACTS_HOSTS = [
  "world.openfoodfacts.org",
  "world.openbeautyfacts.org",
  "world.openproductsfacts.org",
];

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";

const SITE_TIMEOUT_MS = 8_000;
const FETCH_TIMEOUT_MS = 12_000;
/** Card-sized render of the stored asset — crisp, small, and CDN-supported. */
const IMAGE_DIM = "600x0";
const MIN_IMAGE_BYTES = 2_000;
const MAX_IMAGE_BYTES = 4_000_000;
/** Queries per source before moving on to the next one. */
const MAX_QUERIES_PER_SOURCE = 4;
/** Product pages opened on a brand's own site before giving up on it. */
const MAX_OFFICIAL_PAGES = 3;
/** Total candidate images downloaded across every source. */
const MAX_CANDIDATE_FETCHES = 8;

// ── Text helpers ──

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function words(value: string): string[] {
  return normalize(value).split(" ").filter(Boolean);
}

/**
 * Singular/plural folding, so a product sold as "Gentle Shampoo for Babies"
 * still satisfies a search for "Baby Shampoo" ("babies" → "baby"). Only
 * plural suffixes are folded — never word roots — so different products keep
 * different names.
 */
function stemWord(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && /(ch|sh|ss|x|z|s)es$/.test(word)) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss"))
    return word.slice(0, -1);
  return word;
}

/** Every word in a text, plus its singular form, for whole-word comparison. */
function wordSet(text: string): Set<string> {
  const out = new Set<string>();
  for (const word of words(text)) {
    out.add(word);
    const stem = stemWord(word);
    if (stem !== word) out.add(stem);
  }
  return out;
}

function includesWord(set: Set<string>, word: string): boolean {
  return set.has(word) || (stemWord(word) !== word && set.has(stemWord(word)));
}

function hasNumber(haystack: string, value: number): boolean {
  const text = String(value);
  return new RegExp(`(?<![0-9])${escapeRegExp(text)}(?![0-9])`).test(haystack);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function absoluteUrl(href: string, origin: string): string | null {
  const value = href.trim();
  if (!value || value.startsWith("#") || /^(mailto|tel|javascript):/i.test(value))
    return null;
  try {
    const url = new URL(value, origin);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

// ── Dosage forms ──

/** Dosage form words → one canonical form, so "Tablet(s)" matches "tablet". */
const FORM_CANONICAL: Record<string, string> = {
  tab: "tablet",
  tabs: "tablet",
  tablet: "tablet",
  tablets: "tablet",
  cap: "capsule",
  caps: "capsule",
  capsule: "capsule",
  capsules: "capsule",
  softgel: "capsule",
  softgels: "capsule",
  caplet: "tablet",
  caplets: "tablet",
  pill: "tablet",
  pills: "tablet",
  lozenge: "lozenge",
  lozenges: "lozenge",
  pastille: "lozenge",
  pastilles: "lozenge",
  infusion: "injection",
  infusions: "injection",
  foam: "foam",
  gel: "gel",
  gels: "gel",
  cream: "cream",
  creams: "cream",
  ointment: "ointment",
  lotion: "lotion",
  soap: "soap",
  shampoo: "shampoo",
  syrup: "syrup",
  syrups: "syrup",
  expectorant: "expectorant",
  susp: "suspension",
  suspension: "suspension",
  solution: "solution",
  oral: "oral",
  elixir: "elixir",
  emulsion: "emulsion",
  drop: "drops",
  drops: "drops",
  spray: "spray",
  injection: "injection",
  inj: "injection",
  powder: "powder",
  sachet: "sachet",
  granules: "granules",
  chewable: "chewable",
  mouthwash: "mouthwash",
  gummies: "gummies",
  wash: "wash",
  bodywash: "wash",
  facewash: "wash",
  handwash: "handwash",
  cleanser: "cleanser",
  serum: "serum",
  toner: "toner",
  sunscreen: "sunscreen",
  sunblock: "sunscreen",
  rollon: "roll-on",
  paste: "paste",
  jelly: "jelly",
  rub: "rub",
  vapourub: "rub",
  vaporub: "rub",
  conditioner: "conditioner",
  nebulizer: "nebulizer",
  nebuliser: "nebulizer",
  glucometer: "monitor",
  bandage: "bandage",
  bandaid: "bandage",
  syringe: "syringe",
  mask: "mask",
  gloves: "gloves",
  inhaler: "inhaler",
  rotacap: "rotacap",
  respules: "respules",
  balm: "balm",
  oil: "oil",
  patch: "patch",
  suppository: "suppository",
  pessary: "pessary",
  device: "device",
  thermometer: "thermometer",
  monitor: "monitor",
  strips: "strips",
  liquid: "liquid",
  disinfectant: "disinfectant",
  sanitizer: "sanitizer",
  toothpaste: "toothpaste",
  wipes: "wipes",
  diaper: "diaper",
  feeding: "feeding",
};

/**
 * Dosage-form equivalence. A source may describe the same product with a
 * different-but-equivalent word — a syrup is routinely listed as an
 * "expectorant" or "oral solution" — so those synonyms share one key. Nothing
 * else does: a lotion is never a cream, a gel is never a spray, a tablet is
 * never a capsule, so a wrong variant of the same brand cannot slip through.
 */
const FORM_KEY_EQUIVALENTS: Record<string, string> = {
  // Liquid oral dosage forms
  syrup: "oral-liquid",
  expectorant: "oral-liquid",
  suspension: "oral-liquid",
  suspension_sr: "oral-liquid",
  solution: "oral-liquid",
  elixir: "oral-liquid",
  emulsion: "oral-liquid",
  liquid: "oral-liquid",
  oral: "oral-liquid",
  drops: "drops",
  // Dry oral dosage forms
  sachet: "powder",
  granules: "powder",
  chewable: "tablet",
  caplet: "tablet",
  pill: "tablet",
  softgel: "capsule",
  suppository: "suppository",
  pessary: "suppository",
  // Inhaled
  rotacap: "inhaler",
  respules: "inhaler",
};

/** The comparison key for a dosage form (synonyms collapse, everything else is itself). */
function formKey(form: string | undefined | null): string | null {
  if (!form) return null;
  const canonical = FORM_CANONICAL[form] ?? form;
  return FORM_KEY_EQUIVALENTS[canonical] ?? canonical;
}

/** Pack words carry no product identity, so they never have to be matched. */
const STOP_WORDS = new Set([
  "of",
  "in",
  "and",
  "for",
  "the",
  "with",
  "a",
  "an",
  "pack",
  "packs",
  "box",
  "boxed",
  "jar",
  "bottle",
  "strip",
  "strips",
  "pouch",
  "tin",
  "refill",
  "combo",
  "set",
  "tube",
  "s",
  "ml",
  "gm",
  "g",
  "mg",
  "mcg",
  "kg",
  "iu",
  "new",
  "sealed",
  "value",
  "care",
]);

type Dose = { value: number; unit: "mg" | "mcg" | "iu" | "bare" };

/**
 * Numbers in a product name. Dose numbers (mg/mcg/IU, or a bare tablet strength
 * such as "Dolo 650") identify the product and must match exactly. Gram/kilogram
 * and millilitre numbers are pack or container sizes — preferred, not required,
 * because the same product ships in many pack sizes.
 */
function readNumbers(text: string): { doses: Dose[]; packs: number[] } {
  const lower = text.toLowerCase();
  const doses: Dose[] = [];
  const packs: number[] = [];

  const withUnit = /(\d+(?:\.\d+)?)\s*(mg|mcg|iu|gm|g|kg|ml|l|%)/g;
  let match: RegExpExecArray | null;
  const consumed: Array<[number, number]> = [];
  while ((match = withUnit.exec(lower))) {
    const value = Number(match[1]);
    const unit = match[2];
    consumed.push([match.index, match.index + match[0].length]);
    if (!Number.isFinite(value) || value <= 0) continue;
    if (unit === "mg") doses.push({ value, unit: "mg" });
    else if (unit === "mcg") doses.push({ value, unit: "mcg" });
    else if (unit === "iu") doses.push({ value, unit: "iu" });
    else packs.push(value);
  }

  // Bare numbers ("Dolo 650", "Omez 20") are tablet strengths.
  const bare = /(?<![0-9.])(\d{2,4})(?![0-9.])/g;
  while ((match = bare.exec(lower))) {
    const start = match.index;
    const end = start + match[0].length;
    if (consumed.some(([from, to]) => start >= from && end <= to)) continue;
    const value = Number(match[1]);
    if (Number.isFinite(value) && value > 0) doses.push({ value, unit: "bare" });
  }

  return { doses, packs };
}

/** Mass in mg so "650 mg" and "0.65 g" compare equal. */
function massInMg(text: string): number[] {
  const lower = text.toLowerCase();
  const out: number[] = [];
  const pattern = /(\d+(?:\.\d+)?)\s*(mg|mcg|gm|g|kg)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(lower))) {
    const value = Number(match[1]);
    if (!Number.isFinite(value)) continue;
    const unit = match[2];
    if (unit === "mg") out.push(value);
    else if (unit === "mcg") out.push(value / 1000);
    else if (unit === "gm" || unit === "g") out.push(value * 1000);
    else out.push(value * 1_000_000);
  }
  return out;
}

// ── Identity ──

export type ProductIdentity = {
  productName: string;
  brand?: string;
  manufacturer?: string;
  composition?: string;
  form?: string;
  strength?: string;
  dosage?: string;
  packSize?: string;
  sku?: string;
};

type IdentityRules = {
  /** Brand words (or the leading name word): all must appear. */
  core: string[];
  /** Remaining meaningful name words: all must appear. */
  extra: string[];
  /** Dose numbers: must appear in the candidate. */
  doses: Dose[];
  /** Pack/container sizes: preferred, not required. */
  packs: number[];
  /** Dosage forms typed in the name itself: same family required. */
  nameForms: string[];
  /** Form from the admin form: matched when the candidate states one. */
  form: string | null;
  manufacturerWords: string[];
  /** Words that belong to the product's own name (never treated as noise). */
  identityWords: Set<string>;
  normalizedQuery: string;
};

function buildRules(identity: ProductIdentity): IdentityRules {
  const nameWords = words(identity.productName);
  const nameForms = unique(
    nameWords.filter((w) => FORM_CANONICAL[w]).map((w) => FORM_CANONICAL[w]),
  );
  const meaningful = nameWords.filter(
    (w) =>
      !FORM_CANONICAL[w] &&
      !STOP_WORDS.has(w) &&
      !/^\d/.test(w) &&
      w.length > 1,
  );

  const brandWords = identity.brand
    ? words(identity.brand).filter((w) => !STOP_WORDS.has(w) && w.length > 1)
    : [];
  const core = brandWords.length > 0 ? brandWords : meaningful.slice(0, 1);
  const extra = meaningful.filter((w) => !core.includes(w));

  // Dose numbers identify the product and are matched exactly. Pack sizes are
  // a preference only: the same product ships in many pack sizes, so a
  // disagreement must never reject an otherwise exact match.
  const nameNumbers = readNumbers(identity.productName);
  const strengthNumbers = readNumbers(identity.strength ?? "");
  const packNumbers = readNumbers(identity.packSize ?? "");

  const doses: Dose[] = [...nameNumbers.doses];
  for (const dose of strengthNumbers.doses) {
    if (!doses.some((d) => d.value === dose.value && d.unit === dose.unit)) {
      doses.push(dose);
    }
  }

  // A free-text dosage ("1 tablet twice a day") is a usage instruction, so it
  // is read for a missing form/strength instead of being matched verbatim.
  const dosageWords = words(identity.dosage ?? "");
  const dosageForm = dosageWords.find((w) => FORM_CANONICAL[w]);

  return {
    core,
    extra,
    doses,
    packs: unique([
      ...nameNumbers.packs,
      ...packNumbers.packs,
      ...packNumbers.doses.map((dose) => dose.value),
    ]).filter((value) => value > 0),
    nameForms,
    form:
      (identity.form ? FORM_CANONICAL[normalize(identity.form)] : undefined) ??
      (dosageForm ? FORM_CANONICAL[dosageForm] : null),
    manufacturerWords: identity.manufacturer
      ? words(identity.manufacturer).filter((w) => w.length > 3)
      : [],
    identityWords: new Set(
      words(
        [
          identity.productName,
          identity.brand,
          identity.manufacturer,
          identity.form,
          identity.composition,
          identity.sku,
        ]
          .filter(Boolean)
          .join(" "),
      ),
    ),
    normalizedQuery: normalize(
      [
        identity.productName,
        identity.brand,
        identity.manufacturer,
        identity.strength,
      ]
        .filter(Boolean)
        .join(" "),
    ),
  };
}

// ── Candidates ──

type CandidateImage = { url: string; face?: string };

type Candidate = {
  name: string;
  slug?: string;
  manufacturer?: string;
  packText?: string;
  /** Barcode / product code when the source exposes one. */
  code?: string;
  /** Page the image was found on, for the admin's audit trail. */
  pageUrl?: string;
  source: string;
  images: CandidateImage[];
};

type RawRecord = Record<string, unknown>;

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function single(value: unknown): string | undefined {
  if (Array.isArray(value)) return asString(value[0]);
  return asString(value);
}

// ── Scoring / exact-match verification ──

/**
 * Words that mark a file as something other than a product packshot. They are
 * matched per dash/underscore-separated segment, so a product whose own name
 * contains one of them — "Benadryl Cough Formula", "Dettol Antiseptic
 * Liqu..." — keeps its real packshot instead of being filtered out.
 */
const BAD_IMAGE_WORDS = new Set([
  "logo",
  "logos",
  "logotype",
  "wordmark",
  "brandmark",
  "icon",
  "icons",
  "sprite",
  "banner",
  "promo",
  "offer",
  "discount",
  "coupon",
  "doctor",
  "nurse",
  "patient",
  "clinic",
  "hospital",
  "blog",
  "article",
  "video",
  "prescription",
  "placeholder",
  "avatar",
  "flag",
  "payment",
  "wallet",
  "illustration",
  "molecule",
  "skeletal",
  "chemical",
  "structure",
  "diagram",
  "formula",
  "packshot",
  "watermark",
]);

/** Substrings that mark a file even when glued to another word. */
const BAD_IMAGE_SUBSTRINGS = [
  "favicon",
  "bankicon",
  "site-logo",
  "placeholder",
  "no-image",
  "noimage",
];

/**
 * Can this URL be a product photo at all? Judged on the file name only, with
 * identity words exempt so a product's own name never disqualifies it.
 */
function isUsableImageUrl(url: string, identityWords: Set<string>): boolean {
  const lower = url.toLowerCase();
  if (!/^https:\/\//.test(lower)) return false;
  if (!/\.(jpg|jpeg|png|webp)(\?|$)/.test(lower)) return false;

  const file = (lower.split("?")[0].split("/").pop() ?? "")
    // The catalogue names clean assets "…-non-watermark.jpg"; those are the
    // good ones, so the marker is removed before the check runs.
    .replace(/non-watermark(ed)?/g, "")
    .replace(/productsnowatermark/g, "");

  const segments = file.split(/[^a-z0-9]+/).filter(Boolean);
  for (const segment of segments) {
    if (!BAD_IMAGE_WORDS.has(segment)) continue;
    if (identityWords.has(segment)) continue;
    return false;
  }
  for (const term of BAD_IMAGE_SUBSTRINGS) {
    if (file.includes(term) && !identityWords.has(term)) return false;
  }
  return true;
}

/** True when the file name carries `term` as a whole dash/underscore segment. */
function fileHasSegment(file: string, term: string): boolean {
  return file.split(/[^a-z0-9]+/).includes(term);
}

/** File-name markers of a cut-out packshot shot on a clean background. */
const WHITE_BACKGROUND_MARKERS = [
  "whitebg",
  "bgwhite",
  "whitebackground",
  "cutout",
  "isolated",
  "studio",
  "packshot",
  "transparent",
];

/** File-name markers of a detail, crop or non-packshot view. */
const DETAIL_MARKERS = ["zoomed", "zoom", "crop", "detail", "macro", "closeup", "texture"];

/**
 * Rank a candidate's images the way a product grid should look: a front-facing
 * packshot on a clean background first, then other usable shots, with back
 * panels, side views and zoomed detail crops ranked last.
 */
function imageScore(image: CandidateImage, name: string): number {
  const lower = image.url.toLowerCase();
  const file = (lower.split("?")[0].split("/").pop() ?? "").replace(
    /non-watermark(ed)?/g,
    "",
  );
  let score = 0;
  const face = (image.face ?? "").toLowerCase();

  // The catalogue's "front" face is the product photograph that fills the
  // frame; "box-front" is often a small, washed-out box shot, so it ranks just
  // below it. Back panels, sides and zoomed details rank last.
  if (face === "front") score += 5;
  else if (face === "box-front") score += 4;
  else if (["box-back", "back", "side", "rear", "top", "bottom"].includes(face))
    score -= 4;
  else if (fileHasSegment(file, "front")) score += 2;
  if (["back", "side", "rear", "top", "bottom"].some((t) => fileHasSegment(file, t)))
    score -= 3;

  if (WHITE_BACKGROUND_MARKERS.some((t) => fileHasSegment(file, t))) score += 3;
  if (DETAIL_MARKERS.some((t) => fileHasSegment(file, t))) score -= 3;

  if (lower.includes("productsnowatermark")) score += 2;
  else if (lower.includes("-non-watermark")) score += 2;
  if (lower.includes("/dam/products/")) score += 1;

  // The image whose file name mirrors the product name is usually the packshot.
  const nameWords = words(name).slice(0, 3);
  if (nameWords.length > 0 && nameWords.every((w) => file.includes(w))) score += 2;

  score -= Math.min(name.length / 20, 5) * 0.1;
  return score;
}

/** The best image for a candidate, normalised to a card-sized CDN render. */
type RankedImage = { url: string; meta: number };

function rankImages(
  candidate: Candidate,
  identityWords: Set<string>,
): RankedImage[] {
  // A word that is part of the product's own name is identity, not noise: the
  // packshot of "Benadryl Cough Formula" is in a file called …-cough-formula-…
  const allowed = new Set([...identityWords, ...wordSet(candidate.name)]);
  const seen = new Set<string>();
  const ranked: RankedImage[] = [];
  const images = candidate.images
    .filter((image) => isUsableImageUrl(image.url, allowed))
    .map((image) => ({ image, meta: imageScore(image, candidate.name) }))
    .sort((a, b) => b.meta - a.meta);
  for (const { image, meta } of images) {
    const url = normalizeImageUrl(image.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    ranked.push({ url, meta });
  }
  return ranked;
}

/** Card-sized render of a source image. */
function normalizeImageUrl(url: string): string | null {
  const base = url.split("?")[0];
  if (!base) return null;
  // PharEasy CDN: prefer the un-watermarked asset path and a card-sized render.
  if (base.includes("cdn01.pharmeasy.in")) {
    const clean = base.includes("-non-watermark")
      ? base.replace("/dam/products/", "/dam/productsnowatermark/")
      : base;
    return `${clean}?dim=${IMAGE_DIM}&q=80`;
  }
  return base;
}

type ScoredCandidate = { candidate: Candidate; score: number; reasons: string[] };

/**
 * Verify a candidate against the identity. Returns null when the candidate is
 * not the exact same product — this is the check that stops Dolo 500, Dolo
 * Cold, "Dolopar 650", a generic paracetamol pack or Volini Spray (for Volini
 * Gel) from being used.
 */
function scoreCandidate(
  candidate: Candidate,
  rules: IdentityRules,
): ScoredCandidate | null {
  const name = normalize(candidate.name);
  const candidateWords = wordSet(candidate.name);
  const reasons: string[] = [];

  for (const word of rules.core) {
    if (!includesWord(candidateWords, word)) return null;
  }
  reasons.push(`brand:${rules.core.join("+")}`);

  const missingExtra = rules.extra.filter(
    (word) => !includesWord(candidateWords, word),
  );
  if (missingExtra.length > 0) return null;
  if (rules.extra.length > 0) reasons.push(`name:${rules.extra.join("+")}`);

  const masses = massInMg(candidate.name);
  for (const dose of rules.doses) {
    const matched =
      dose.unit === "bare"
        ? hasNumber(name, dose.value) ||
          masses.some((mass) => Math.abs(mass - dose.value) < 0.01)
        : dose.unit === "mg"
          ? masses.some((mass) => Math.abs(mass - dose.value) < 0.01)
          : hasNumber(name, dose.value);
    if (!matched) return null;
  }
  if (rules.doses.length > 0) {
    reasons.push(`dose:${rules.doses.map((d) => `${d.value}${d.unit}`).join(",")}`);
  }

  const candidateForms = unique(
    words(candidate.name)
      .filter((w) => FORM_CANONICAL[w])
      .map((w) => FORM_CANONICAL[w]),
  );
  // The requested dosage form comes from the name and, when the name does not
  // state one, from the admin's form field. A candidate that states a different
  // dosage form is a different product, not a match.
  const requestedKeys = unique(
    [...rules.nameForms, ...(rules.form ? [rules.form] : [])]
      .map((form) => formKey(form))
      .filter((key): key is string => !!key),
  );
  if (candidateForms.length > 0 && requestedKeys.length > 0) {
    const candidateKeys = unique(
      candidateForms.map((form) => formKey(form)).filter(Boolean),
    );
    if (!candidateKeys.some((key) => requestedKeys.includes(key!))) return null;
  }
  if (rules.nameForms.length > 0) {
    reasons.push(`form:${rules.nameForms.join("+")}`);
  }

  let score = 6;
  const packText = `${candidate.packText ?? ""} ${candidate.name}`;
  if (candidateForms.length > 0 && requestedKeys.length > 0) {
    // Repeating the requested form word is a stronger signal than matching a
    // synonym of it.
    score += candidateForms.some((form) => rules.nameForms.includes(form)) ? 2 : 1;
  }

  const packHaystack = normalize(`${candidate.name} ${candidate.packText ?? ""}`);
  const matchedPacks = rules.packs.filter((value) =>
    hasNumber(packHaystack, value),
  );
  if (matchedPacks.length > 0) {
    score += 2;
    reasons.push("pack-size");
  }

  if (rules.manufacturerWords.length > 0 && candidate.manufacturer) {
    const candidateManufacturer = normalize(candidate.manufacturer);
    const overlap = rules.manufacturerWords.filter((word) =>
      candidateManufacturer.includes(word),
    );
    if (overlap.length > 0) {
      score += 3;
      reasons.push("manufacturer");
    } else {
      score -= 4;
    }
  }

  // A candidate whose record repeats the typed query almost verbatim is the
  // closest thing to the product the admin asked for.
  const extraWords = words(packText).filter((w) => !rules.core.includes(w));
  score -= Math.min(extraWords.length, 10) * 0.1;

  return { candidate, score, reasons };
}

/**
 * Exported for tests: does this candidate product name belong to this exact
 * product? Runs the same rules the pipeline applies (brand and name words as
 * whole words, dose strength exact, dosage form family compatible) and ignores
 * images.
 */
export function matchesProductIdentity(
  candidateName: string,
  identity: ProductIdentity,
  candidateManufacturer?: string,
): boolean {
  const rules = buildRules(identity);
  if (rules.core.length === 0) return false;
  return (
    scoreCandidate(
      {
        name: candidateName,
        manufacturer: candidateManufacturer,
        source: "test",
        images: [],
      },
      rules,
    ) !== null
  );
}

/**
 * Exported for tests: could this image file ever be a packshot for this
 * product? A product whose own name contains a noise word (Benadryl Cough
 * *Formula*) keeps its real packshot, while a logo, diagram or placeholder is
 * always rejected.
 */
export function isPackshotImageCandidate(
  url: string,
  identity: ProductIdentity,
  candidateName?: string,
): boolean {
  const allowed = buildRules(identity).identityWords;
  if (candidateName) for (const word of wordSet(candidateName)) allowed.add(word);
  return isUsableImageUrl(url, allowed);
}

// ── Network ──

async function fetchWithTimeout(
  url: string,
  headers: Record<string, string>,
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getText(
  url: string,
  accept = "text/html,application/xhtml+xml",
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(
      url,
      { "user-agent": USER_AGENT, accept },
      timeoutMs,
    );
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

async function getJson(url: string): Promise<unknown | null> {
  const text = await getText(url, "application/json");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function nextData(html: string): unknown | null {
  const match = html.match(
    /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

// ── Query variants ──

/**
 * Every precise identity worth searching, most specific first. A source is
 * asked all of them before the next source is tried, so a long name
 * ("Ensure Diabetes Care 950g") still finds the product whose catalogue title
 * is worded differently.
 */
function searchVariants(identity: ProductIdentity): string[] {
  const name = identity.productName.trim();
  const nameWords = words(name);
  const leading = nameWords[0] ?? name;
  const brandWords = words(identity.brand ?? "");
  const nameHasBrand =
    brandWords.length > 0 && brandWords.every((w) => nameWords.includes(w));

  const built: string[] = [];
  const push = (parts: Array<string | undefined>) => {
    const value = parts
      .filter((part) => !!part && part.trim().length > 0)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (value.length > 1 && !built.some((q) => q.toLowerCase() === value.toLowerCase())) {
      built.push(value);
    }
  };

  // 1. Brand + product name + strength + form
  push([nameHasBrand ? undefined : identity.brand, name, identity.strength, identity.form]);
  // 2. Manufacturer + product name + strength
  push([identity.manufacturer, name, identity.strength]);
  // 3. Product name + pack size + manufacturer
  push([name, identity.packSize, identity.manufacturer]);
  // 4. The exact full identity
  push([
    name,
    identity.brand,
    identity.strength,
    identity.form,
    identity.packSize,
    identity.composition,
  ]);
  // 5. Plain name, then the leading word, so a differently worded catalogue
  //    title can still be found and verified.
  push([name]);
  push([leading, identity.strength]);
  push([leading]);

  return built.slice(0, MAX_QUERIES_PER_SOURCE + 5);
}

/** A SKU that looks like a barcode can be looked up directly. */
function barcodeOf(identity: ProductIdentity): string | null {
  const digits = (identity.sku ?? "").replace(/[^0-9]/g, "");
  return digits.length >= 8 && digits.length <= 14 ? digits : null;
}

// ── Source 1: the brand's / manufacturer's own website ──

const brandSiteCache = new Map<string, string | null>();

/**
 * The official website of the brand or manufacturer. Wikidata's P856 (official
 * website) is tried first; when the brand has no Wikidata item — common for
 * younger consumer brands — the brand name itself is probed as a domain, which
 * is how Indian brand sites are usually named (mamaearth.com, volini.com).
 * A probed site is only accepted when its own page mentions the brand, and the
 * product page it later offers still has to pass the exact-match rules.
 */
async function officialSite(brand: string): Promise<string | null> {
  const key = normalize(brand);
  if (!key) return null;
  if (brandSiteCache.has(key)) return brandSiteCache.get(key) ?? null;

  const found = (await wikidataSite(brand)) ?? (await probedSite(brand));
  brandSiteCache.set(key, found);
  return found;
}

async function wikidataSite(value: string): Promise<string | null> {
  const search = await getJson(
    `${WIKIDATA_API}?action=wbsearchentities&search=${encodeURIComponent(
      value,
    )}&language=en&uselang=en&format=json&limit=5&origin=*`,
  );
  const hits = (search as { search?: Array<{ id?: string; label?: string }> })
    ?.search;
  if (!Array.isArray(hits) || hits.length === 0) return null;

  const valueWords = words(value);
  const candidates = hits.filter((hit) => {
    const label = words(hit.label ?? "");
    return (
      label.length > 0 &&
      valueWords.some((word) => label.includes(word) && word.length > 3)
    );
  });
  if (candidates.length === 0) return null;

  const ids = candidates
    .map((hit) => hit.id)
    .filter((id): id is string => !!id)
    .slice(0, 3)
    .join("|");
  const entities = await getJson(
    `${WIKIDATA_API}?action=wbgetentities&ids=${ids}&props=claims&format=json&origin=*`,
  );
  const map = (entities as { entities?: Record<string, unknown> })?.entities;
  if (!map) return null;

  for (const id of ids.split("|")) {
    const entity = map[id] as
      | {
          claims?: Record<
            string,
            Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>
          >;
        }
      | undefined;
    const claims = entity?.claims?.P856;
    if (!Array.isArray(claims)) continue;
    for (const claim of claims) {
      const raw = claim.mainsnak?.datavalue?.value;
      if (typeof raw !== "string") continue;
      try {
        const url = new URL(raw);
        if (url.protocol === "http:" || url.protocol === "https:") {
          return url.origin;
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

async function probedSite(brand: string): Promise<string | null> {
  const slug = brand.toLowerCase().replace(/[^a-z0-9]/g, "");
  // Short or generic brand strings would guess at unrelated domains.
  if (slug.length < 5) return null;

  const brandWords = words(brand);
  for (const domain of [`${slug}.com`, `${slug}.in`, `${slug}.co.in`]) {
    const html = await getText(`https://${domain}/`, "text/html", SITE_TIMEOUT_MS);
    if (!html) continue;
    const lower = html.toLowerCase();
    const mentionsBrand =
      lower.includes(slug) || brandWords.every((word) => lower.includes(word));
    if (mentionsBrand) return `https://${domain}`;
  }
  return null;
}

/** On-site search paths, tried in order — the common storefront patterns. */
const SITE_SEARCH_PATTERNS = [
  "/search?q={q}&type=product",
  "/?s={q}&post_type=product",
  "/search?q={q}",
];

/**
 * A product page is a content path ending in a slug, e.g.
 * "/products/himalaya-baby-lotion" or "/item/12345". Asset paths such as
 * "/cdn/shop/files/logo.png" are never product pages, so anything with a file
 * extension or a /cdn/ or /assets/ segment is skipped.
 */
const PRODUCT_PAGE_PATH =
  /\/(?:products?|shop|catalog|item|items|dp|item-detail|product-detail|p)\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9-]+)?\/?$/i;
const ASSET_SEGMENTS = /(^|\/)(cdn|assets|static|media|images|img|files|dist|build)(\/|$)/i;
const FILE_EXTENSION = /\.(?:css|js|mjs|png|jpe?g|gif|webp|svg|ico|woff2?|ttf|eot|json|xml|pdf|zip|mp4|webm|txt|css.map)(\?|$)/i;

/**
 * Product-page links on a brand site's search results, most relevant first: a
 * link whose slug mentions the product's own words is a far better bet than
 * whatever happened to be first in the results grid.
 */
function productLinks(
  html: string,
  origin: string,
  identityWords: Set<string>,
): string[] {
  const links: string[] = [];
  const pattern = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const absolute = absoluteUrl(match[1], origin);
    if (!absolute) continue;
    let pathname: string;
    try {
      pathname = new URL(absolute).pathname;
    } catch {
      continue;
    }
    if (ASSET_SEGMENTS.test(pathname)) continue;
    if (FILE_EXTENSION.test(absolute)) continue;
    if (!PRODUCT_PAGE_PATH.test(pathname)) continue;
    const clean = absolute.split("?")[0];
    if (!links.includes(clean)) links.push(clean);
    if (links.length >= 24) break;
  }
  const distinctive = [...identityWords].filter((word) => word.length > 3);
  const hits = (url: string) => {
    const slug = new URL(url).pathname.toLowerCase();
    return distinctive.filter((word) => slug.includes(word)).length;
  };
  const ordered = links.sort(
    (a, b) =>
      hits(b) * 10 - new URL(b).pathname.length / 100 -
      (hits(a) * 10 - new URL(a).pathname.length / 100),
  );
  // When any result mentions the product's own words, the pages that do not
  // are other products from the same site and are not worth opening.
  const relevant = ordered.filter((url) => hits(url) > 0);
  return relevant.length > 0 ? relevant : ordered;
}

function attrOf(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match?.[1]?.trim() || null;
}

function metaImage(html: string, pageUrl: string): string | null {
  const candidates = [
    attrOf(html, /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i),
    attrOf(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["']/i),
    attrOf(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i),
    attrOf(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i),
    attrOf(html, /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i),
    attrOf(html, /"image"\s*:\s*("(?:[^"\\]|\\.)*")/i)?.replace(/^"|"$/g, ""),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const absolute = absoluteUrl(candidate.replace(/\\\//g, "/"), pageUrl);
    if (absolute) return absolute;
  }
  return null;
}

function pageTitle(html: string): string | null {
  return (
    attrOf(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ??
    attrOf(html, /<title[^>]*>([^<]+)<\/title>/i)
  );
}

/**
 * The brand's own product page — the highest-priority source. The product page
 * title must satisfy the same exact-match rules as every other source, so a
 * brand's category page or a related product can never be used.
 */
async function officialSiteCandidates(
  identity: ProductIdentity,
  rules: IdentityRules,
): Promise<ScoredCandidate[]> {
  const brand = identity.brand ?? identity.manufacturer;
  if (!brand) return [];

  const origin = await officialSite(brand);
  if (!origin) return [];

  // The site already *is* the brand, so its own catalogue is searched with the
  // product name, the name without the brand, and the name's leading words —
  // a brand site's product titles rarely repeat the full admin-entered string.
  const name = identity.productName.trim();
  const brandWords = words(brand);
  const nameWords = words(name).filter((word) => !brandWords.includes(word));
  const queries = unique(
    [
      [name, identity.strength].filter(Boolean).join(" "),
      name,
      nameWords.join(" "),
      nameWords.slice(0, 2).join(" "),
    ].filter((value) => value.trim().length > 1),
  );

  const results: ScoredCandidate[] = [];
  const visited = new Set<string>();

  for (const pattern of SITE_SEARCH_PATTERNS) {
    if (results.length > 0) break;
    for (const query of queries) {
      if (results.length > 0) break;
      const html = await getText(
        `${origin}${pattern.replace("{q}", encodeURIComponent(query))}`,
        "text/html",
        SITE_TIMEOUT_MS,
      );
      if (!html) continue;
      const links = productLinks(html, origin, rules.identityWords);
      if (links.length === 0) continue;

      for (const link of links) {
        if (visited.size >= MAX_OFFICIAL_PAGES) break;
        if (visited.has(link)) continue;
        visited.add(link);

        const page = await getText(link, "text/html", SITE_TIMEOUT_MS);
        if (!page) continue;
        const title = pageTitle(page);
        const image = metaImage(page, link);
        if (!title || !image) continue;

        const scored = scoreCandidate(
          {
            name: title,
            manufacturer: identity.manufacturer,
            packText: identity.packSize,
            pageUrl: link,
            source: "official-site",
            images: [{ url: image, face: "front" }],
          },
          rules,
        );
        if (scored) results.push(scored);
      }
      // Results were found for this search path; do not keep re-querying.
      if (results.length > 0 || visited.size > 0) break;
    }
  }

  return results;
}

// ── Source 2: licensed pharmacy catalogue ──

function collectRecords(root: unknown): RawRecord[] {
  const found: RawRecord[] = [];
  const seen = new Set<object>();
  const walk = (node: unknown, depth: number) => {
    if (depth > 10 || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    const record = node as RawRecord;
    if (seen.has(record)) return;
    seen.add(record);
    if (
      asString(record.name) &&
      (asString(record.image) ||
        Array.isArray(record.damImages) ||
        asString(record.slug))
    ) {
      found.push(record);
    }
    for (const value of Object.values(record)) walk(value, depth + 1);
  };
  walk(root, 0);
  return found;
}

function imagesOf(record: RawRecord): CandidateImage[] {
  const images: CandidateImage[] = [];
  const dam = record.damImages;
  if (Array.isArray(dam)) {
    for (const entry of dam) {
      if (entry && typeof entry === "object") {
        const url = asString((entry as RawRecord).url);
        if (url) images.push({ url, face: asString((entry as RawRecord).face) });
      }
    }
  }
  const singleUrl = asString(record.image);
  if (singleUrl) images.push({ url: singleUrl });
  return images;
}

function toPharmacyCandidate(record: RawRecord): Candidate | null {
  const name = asString(record.name);
  if (!name) return null;
  const packText = [
    asString(record.measurementUnit),
    asString(record.subtitleText),
    asString(record.packQuantityValue),
  ]
    .filter(Boolean)
    .join(" ");
  return {
    name,
    slug: asString(record.slug),
    manufacturer: asString(record.manufacturer),
    packText: packText || undefined,
    source: "pharmeasy",
    images: imagesOf(record),
  };
}

async function catalogueCandidates(query: string): Promise<Candidate[]> {
  const html = await getText(
    `${PHARMEASY_SEARCH}${encodeURIComponent(query)}`,
    "text/html,application/xhtml+xml",
  );
  if (!html) return [];
  const data = nextData(html);
  if (!data) return [];
  return collectRecords(data)
    .map(toPharmacyCandidate)
    .filter((candidate): candidate is Candidate => candidate !== null);
}

// ── Source 3: open product databases ──

function toOpenFactsCandidate(record: RawRecord): Candidate | null {
  const name =
    single(record.product_name) ??
    single(record.product_name_en) ??
    single(record.generic_name);
  if (!name) return null;
  const brand = single(record.brands);
  const quantity = single(record.quantity);
  const image =
    single(record.image_front_url) ??
    single(record.image_url) ??
    single(record.image_front_small_url);
  return {
    name,
    manufacturer: brand,
    packText: [brand, quantity].filter(Boolean).join(" ") || undefined,
    code: single(record.code),
    pageUrl: single(record.code)
      ? `https://world.openfoodfacts.org/product/${record.code}`
      : undefined,
    source: "open-facts",
    images: image ? [{ url: image, face: "front" }] : [],
  };
}

async function openFactsCandidates(query: string): Promise<Candidate[]> {
  const out: Candidate[] = [];
  const url = (host: string) =>
    `https://${host}/cgi/search.pl?search_terms=${encodeURIComponent(
      query,
    )}&search_simple=1&action=process&json=1&page_size=12&fields=code,product_name,product_name_en,generic_name,brands,quantity,image_front_url,image_url`;

  for (const host of OPEN_FACTS_HOSTS) {
    const data = await getJson(url(host));
    const products = (data as { products?: unknown })?.products;
    if (!Array.isArray(products)) continue;
    for (const product of products) {
      if (!product || typeof product !== "object") continue;
      const candidate = toOpenFactsCandidate(product as RawRecord);
      if (candidate) out.push(candidate);
    }
  }
  return out;
}

/** Exact barcode lookup — the strongest possible identity match. */
async function openFactsByBarcode(code: string): Promise<Candidate[]> {
  for (const host of OPEN_FACTS_HOSTS) {
    const data = await getJson(`https://${host}/api/v2/product/${code}.json`);
    const product = (data as { product?: unknown })?.product;
    if (!product || typeof product !== "object") continue;
    const candidate = toOpenFactsCandidate(product as RawRecord);
    if (candidate) {
      candidate.code = code;
      return [candidate];
    }
  }
  return [];
}

// ── Download and store ──

function looksLikeImage(bytes: Uint8Array, contentType: string): boolean {
  if (!contentType.startsWith("image/")) {
    // Some CDNs answer without a content type; the magic bytes still decide.
    if (contentType && !contentType.startsWith("application/octet")) return false;
  }
  const [a, b, c, d] = bytes;
  const jpeg = a === 0xff && b === 0xd8 && c === 0xff;
  const png = a === 0x89 && b === 0x50 && c === 0x4e && d === 0x47;
  const gif = a === 0x47 && b === 0x49 && c === 0x46;
  const webp = a === 0x52 && b === 0x49 && c === 0x46 && d === 0x46;
  return jpeg || png || gif || webp;
}

/** Pixel dimensions read from the file header (no decoding). */
function imageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // PNG: 8-byte signature then an IHDR chunk.
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  // JPEG: walk the segments to the frame header.
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (
        (marker >= 0xc0 && marker <= 0xcf) &&
        marker !== 0xc4 &&
        marker !== 0xc8 &&
        marker !== 0xcc
      ) {
        return {
          height: view.getUint16(offset + 5),
          width: view.getUint16(offset + 7),
        };
      }
      offset += 2 + view.getUint16(offset + 2);
    }
    return null;
  }
  // WebP
  if (bytes.length > 30 && bytes[0] === 0x52 && bytes[8] === 0x57) {
    const chunk = String.fromCharCode(...Array.from(bytes.subarray(12, 16)));
    if (chunk === "VP8X") {
      return {
        width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)),
        height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)),
      };
    }
    if (chunk === "VP8 ") {
      return {
        width: view.getUint16(26) & 0x3fff,
        height: view.getUint16(28) & 0x3fff,
      };
    }
    if (chunk === "VP8L") {
      const bits = view.getUint32(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
  }
  return null;
}

/** A product photo on a card: big enough, and not a sliver or a wide banner. */
const MIN_IMAGE_EDGE = 200;
const MIN_ASPECT_RATIO = 0.34;

function isUsableShape(dimensions: { width: number; height: number } | null): boolean {
  if (!dimensions) return true; // unknown size: the bytes already passed validation
  const long = Math.max(dimensions.width, dimensions.height);
  const short = Math.min(dimensions.width, dimensions.height);
  if (long < MIN_IMAGE_EDGE) return false;
  return short / long >= MIN_ASPECT_RATIO;
}

type DownloadedImage = {
  bytes: Uint8Array;
  contentType: string;
  sourceUrl: string;
  /** False for a sliver or thumbnail: usable, but only as a last resort. */
  shapeOk: boolean;
};

async function downloadImage(
  url: string,
  originalUrl: string,
): Promise<DownloadedImage | null> {
  const attempt = async (target: string): Promise<DownloadedImage | null> => {
    let response: Response;
    try {
      response = await fetchWithTimeout(target, {
        "user-agent": USER_AGENT,
        accept: "image/*,*/*",
      });
    } catch {
      return null;
    }
    if (!response.ok) return null;
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      return null;
    }
    if (bytes.byteLength < MIN_IMAGE_BYTES) return null;
    if (bytes.byteLength > MAX_IMAGE_BYTES) return null;
    if (!looksLikeImage(bytes, contentType)) return null;
    return {
      bytes,
      contentType: contentType.startsWith("image/") ? contentType : "image/jpeg",
      sourceUrl: target,
      // A 174x600 sliver or a 200px thumbnail still identifies the product, so
      // it is kept as a fallback rather than rejected outright.
      shapeOk: isUsableShape(imageDimensions(bytes)),
    };
  };

  const resized = await attempt(url);
  if (resized) return resized;
  // Fall back to the untouched asset when the resized path is not served.
  if (originalUrl !== url) return await attempt(originalUrl);
  return null;
}

/** Write verified bytes to permanent storage and return the public URL. */
async function store(ctx: ActionCtx, image: DownloadedImage): Promise<string | null> {
  const storageId = await ctx.storage.store(
    new Blob([image.bytes.buffer as ArrayBuffer], { type: image.contentType }),
  );
  return (await ctx.storage.getUrl(storageId)) ?? null;
}

// ── Core ──

export type ProductImageOutcome =
  | {
      ok: true;
      imageUrl: string;
      matchedName: string;
      source: string;
      sourceUrl: string;
      notes: string[];
    }
  | { ok: false; message: string; considered: string[] };

/**
 * Resolve, verify, download and store the image for one product identity.
 * Shared by the admin action and the backfill pass so both behave identically.
 */
export async function resolveAndStore(
  ctx: ActionCtx,
  identity: ProductIdentity,
): Promise<ProductImageOutcome> {
  const rules = buildRules(identity);
  if (rules.core.length === 0) {
    return {
      ok: false,
      message: "Enter the product name before fetching its image.",
      considered: [],
    };
  }

  const considered: string[] = [];
  let fetches = 0;

  const tryCandidates = async (
    scored: ScoredCandidate[],
  ): Promise<ProductImageOutcome | null> => {
    scored.sort((a, b) => b.score - a.score);
    // The first image that verified but has an unusable shape is kept as a
    // fallback: a real packshot in an odd shape still beats no image at all.
    let fallback: { image: DownloadedImage; entry: ScoredCandidate } | null = null;

    for (const entry of scored) {
      if (fetches >= MAX_CANDIDATE_FETCHES) break;
      const images = rankImages(entry.candidate, rules.identityWords);
      if (images.length === 0) continue;
      fetches += 1;
      if (!considered.includes(entry.candidate.name)) {
        considered.push(entry.candidate.name);
      }

      // The best-ranked image for this product record: the front-facing
      // packshot, or a white-background cut-out when the source labels one.
      const chosen = images[0];

      const downloaded = await downloadImage(
        chosen.url,
        (entry.candidate.images[0]?.url ?? chosen.url).split("?")[0],
      );
      if (!downloaded) continue;
      if (!downloaded.shapeOk) {
        if (!fallback) fallback = { image: downloaded, entry };
        continue;
      }

      const stored = await store(ctx, downloaded);
      if (!stored) continue;
      return {
        ok: true,
        imageUrl: stored,
        matchedName: entry.candidate.name,
        source: entry.candidate.source,
        sourceUrl: entry.candidate.pageUrl ?? downloaded.sourceUrl,
        notes: entry.reasons,
      };
    }

    if (fallback) {
      const stored = await store(ctx, fallback.image);
      if (stored) {
        return {
          ok: true,
          imageUrl: stored,
          matchedName: fallback.entry.candidate.name,
          source: fallback.entry.candidate.source,
          sourceUrl:
            fallback.entry.candidate.pageUrl ?? fallback.image.sourceUrl,
          notes: [...fallback.entry.reasons, "unusual-aspect-ratio"],
        };
      }
    }
    return null;
  };

  const verifiedFrom = async (
    candidates: Candidate[],
  ): Promise<ProductImageOutcome | null> => {
    const scored: ScoredCandidate[] = [];
    for (const candidate of candidates) {
      const result = scoreCandidate(candidate, rules);
      if (result) scored.push(result);
    }
    if (scored.length === 0) return null;
    return await tryCandidates(scored);
  };

  // Source 1 — the brand's own product page.
  const fromOfficial = await tryCandidates(
    await officialSiteCandidates(identity, rules),
  );
  if (fromOfficial) return fromOfficial;

  // Source 2 — the licensed pharmacy catalogue, asked with every identity.
  for (const query of searchVariants(identity)) {
    if (fetches >= MAX_CANDIDATE_FETCHES) break;
    const found = await verifiedFrom(await catalogueCandidates(query));
    if (found) return found;
  }

  // Source 3 — open product databases, including a direct barcode lookup.
  const barcode = barcodeOf(identity);
  if (barcode) {
    const found = await verifiedFrom(await openFactsByBarcode(barcode));
    if (found) return found;
  }
  for (const query of searchVariants(identity).slice(0, MAX_QUERIES_PER_SOURCE)) {
    if (fetches >= MAX_CANDIDATE_FETCHES) break;
    const found = await verifiedFrom(await openFactsCandidates(query));
    if (found) return found;
  }

  return {
    ok: false,
    message: "Exact product image could not be verified.",
    considered: unique(considered).slice(0, 5),
  };
}

/**
 * Public entry point used by the admin Add/Edit Product dialog. Requires an
 * authenticated admin, because it writes the verified image into storage.
 */
export const resolveProductImage = action({
  args: {
    productName: v.string(),
    brand: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    composition: v.optional(v.string()),
    form: v.optional(v.string()),
    strength: v.optional(v.string()),
    dosage: v.optional(v.string()),
    packSize: v.optional(v.string()),
    sku: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const isAdmin = await ctx.runQuery(internal.adminProducts.isAdminUser, {});
    if (!isAdmin) throw new Error("Not authorized");
    return await resolveAndStore(ctx, args);
  },
});

/** Same pipeline, callable from the CLI and by the backfill pass. */
export const resolveImage = internalAction({
  args: {
    productName: v.string(),
    brand: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    composition: v.optional(v.string()),
    form: v.optional(v.string()),
    strength: v.optional(v.string()),
    dosage: v.optional(v.string()),
    packSize: v.optional(v.string()),
    sku: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await resolveAndStore(ctx, args);
  },
});

// ── Stored-image audit ──

/**
 * A verified product image is one this pipeline stored in Convex storage, so it
 * is permanent and known to be a real packshot. Everything else — empty, a
 * generated `data:` placeholder, a chemical structure pulled from Wikipedia, or
 * any other third-party URL — is an image the admin should re-resolve.
 */
export function isVerifiedProductImage(url: string | null | undefined): boolean {
  const value = (url ?? "").trim();
  return /^https:\/\/[a-z0-9-]+\.convex\.cloud\/api\/storage\//i.test(value);
}

export function needsProductImageRepair(url: string | null | undefined): boolean {
  const value = (url ?? "").trim();
  if (!value) return true;
  if (!/^https?:\/\//i.test(value)) return true;
  return !isVerifiedProductImage(value);
}
