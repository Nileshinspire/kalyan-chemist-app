/**
 * Master Product Catalog — pure domain logic.
 *
 * Everything here decides WHAT a licensed-dataset row means and WHICH exact
 * record an admin query or an image file belongs to. It is deliberately
 * dependency-free: the Convex backend, the admin importer UI and the test
 * suite all share the same rules, so an image can never be attached to a
 * record the matcher would reject.
 *
 * Two hard rules encode the product requirement:
 *
 *   1. Metadata and images are only ever read from the SAME catalog record.
 *      There is no independent image search anywhere in this module.
 *   2. The matcher is strict about identity. Harmless naming differences
 *      (case, punctuation, spacing, word order, tablet(s), pack spelling) are
 *      ignored; a different strength, form, pack, manufacturer or variant word
 *      is a rejection — never loosened for a higher hit rate.
 */

/** Every status a catalog record can carry. */
export const VERIFICATION_STATUSES = ["VERIFIED", "NEEDS_REVIEW", "NEEDS_IMAGE"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** The exact strings the admin workflow must show. Never reworded. */
export const CATALOG_PRODUCT_NOT_FOUND_MESSAGE =
  "Exact product not found in the verified product catalog.";
export const CATALOG_IMAGE_NOT_FOUND_MESSAGE =
  "Product found, but no verified product image is available.";

/** A product gallery holds one front packshot plus up to four more views. */
export const MAX_CATALOG_IMAGES = 5;

// ── Text normalisation ───────────────────────────────────────────────────────

/** Lower-case, fold punctuation to spaces, keep digits/`.`/`%` (doses). */
export function splitWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.%]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** The indexed search key: "Dolo-650  mg Tablet" → "dolo 650 mg tablet". */
export function normalizeName(value: string): string {
  return splitWords(value).join(" ");
}

/** Folded composition, so a salt lookup is an indexed prefix scan. */
export function normalizeComposition(value: string): string {
  return splitWords(value).join(" ");
}

/** "650 MG" / "650mg" / "650 mg" → "650mg". Non-dose text folds to words. */
export function normalizeStrength(value: string): string | null {
  const text = (value ?? "").trim().toLowerCase();
  if (!text) return null;
  const dose = text.match(/(\d+(?:\.\d+)?)\s*(mcg|µg|ug|mg|iu|%)/);
  if (dose) return `${trimNumber(dose[1])}${dose[2]}`;
  const words = splitWords(text);
  return words.length > 0 ? words.join(" ") : null;
}

function trimNumber(n: string): string {
  const num = Number(n);
  return Number.isFinite(num) ? String(num) : n;
}

/** A short stable hash (FNV-1a) for auto-generated catalog ids. */
export function shortHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/** URL/file-safe slug. */
export function slugify(value: string): string {
  return splitWords(value).join("-").replace(/^-+|-+$/g, "").slice(0, 80);
}

// ── Identity signals ─────────────────────────────────────────────────────────

/**
 * Dosage-form words a product name can state. Every word here is removed from
 * the comparison core after the form signal is captured, so "Dolo 650 Tablet"
 * and "Dolo 650" compare as the same core identity.
 */
const FORM_WORDS: Record<string, string> = {
  tablet: "tablet", tablets: "tablet", tab: "tablet", tabs: "tablet",
  caplet: "tablet", caplets: "tablet",
  capsule: "capsule", capsules: "capsule", cap: "capsule", caps: "capsule",
  syrup: "syrup",
  suspension: "suspension", susp: "suspension",
  solution: "solution",
  drop: "drops", drops: "drops",
  cream: "cream",
  gel: "gel",
  ointment: "ointment",
  lotion: "lotion",
  spray: "spray", sprays: "spray",
  inhaler: "inhaler",
  respules: "respules",
  powder: "powder",
  granule: "granules", granules: "granules",
  sachet: "sachet", sachets: "sachet",
  injection: "injection",
  balm: "balm",
  paste: "paste",
  soap: "soap",
  shampoo: "shampoo",
  cleanser: "cleanser", cleansers: "cleanser",
  wipes: "wipes",
  kit: "kit", kits: "kit",
  mouthwash: "mouthwash",
};

/**
 * Solid oral forms that ARE the unnamed default: when the admin types
 * "Dolo 650" with no form, the catalog's tablet record is that product. Any
 * other form (syrup, suspension, gel, spray …) is a distinct marketed variant
 * and is only ever offered as a suggestion — never auto-applied.
 */
const DEFAULT_FORMS = new Set(["tablet", "capsule"]);

/** Unit words that never carry identity. */
const UNIT_WORDS = new Set([
  "mg", "mcg", "µg", "ug", "iu", "ml", "gm", "grams", "gram", "l", "kg", "%", "unit", "units",
]);

/** Full pack/count nouns — used when parsing an explicit pack-size FIELD. */
const PACK_NOUNS =
  "tablets?|capsules?|caps?|strips?|sachets?|bottles?|packs?|pieces?|units?|puffs?|syringes?|amps?|ampoules?";

/**
 * Nouns that can only ever mean a pack inside a product NAME.
 *
 * Deliberately excludes the dosage-form words (tablet, capsule …): in an
 * Indian product name the number before the form is the STRENGTH
 * ("Telma 40 Tablet" is the 40 mg tablet). Reading it as a pack is how
 * "Telma 40" would silently match a "Telma 20 Tablet" record.
 */
const PACK_ONLY_NOUNS =
  "strips?|sachets?|bottles?|packs?|pieces?|puffs?|syringes?|amps?|ampoules?|boxes|cartons?";

type NameScan = {
  /** First dose the name states, canonicalised: "650" / "650mg" → "650mg". */
  dose: string | null;
  /** Pack the name states: "10" (tablets) or "100ml". */
  pack: string | null;
  form: string | null;
  /** Identity tokens left once dose/pack/form/unit signals are removed. */
  core: string[];
};

/**
 * Pull dose, pack, form and core tokens out of a product name in one masked
 * pass. Each signal consumes its span, so a later pattern can never re-read a
 * number that an earlier pattern already explained — "Dolo 650 Tablet" keeps
 * 650 as the dose while "15 tablets" becomes the pack.
 */
function scanName(rawName: string): NameScan {
  let work = ` ${ (rawName ?? "").toLowerCase() } `;
  const doses: string[] = [];
  const packs: string[] = [];
  let form: string | null = null;

  const consume = (re: RegExp, handle: (match: RegExpExecArray) => void) => {
    const pattern = new RegExp(re.source, "g");
    let match: RegExpExecArray | null;
    const spans: Array<[number, number]> = [];
    while ((match = pattern.exec(work)) !== null) {
      handle(match);
      spans.push([match.index, match.index + match[0].length]);
      if (match[0].length === 0) pattern.lastIndex += 1;
    }
    // Mask from the end so earlier offsets stay valid.
    for (let i = spans.length - 1; i >= 0; i -= 1) {
      const [start, end] = spans[i];
      work = work.slice(0, start) + " ".repeat(end - start) + work.slice(end);
    }
  };

  // 1. Concentrations like "125mg/5ml": the numerator is the dose, and the
  //    whole span must be consumed so "5ml" is never read as a pack size.
  consume(
    /(\d+(?:\.\d+)?)\s*(mcg|mg|g|ml)\s*\/\s*\d+(?:\.\d+)?\s*(?:ml|mg|g)/,
    (m) => {
      const unit = m[2];
      if (unit === "mg" || unit === "mcg") doses.push(`${trimNumber(m[1])}${unit}`);
    },
  );
  // 2. Dose with an explicit unit.
  consume(/(\d+(?:\.\d+)?)\s*(mcg|µg|ug|mg|iu|%)/, (m) => {
    doses.push(`${trimNumber(m[1])}${m[2]}`);
  });
  // 3. Explicit pack phrases: "strip of 15", "pack of 10".
  consume(/\b(?:strip|pack|box|bottle|carton)(?:\s+of)?\s+(\d+)\s*['’]?s?\b/, (m) => {
    packs.push(m[1]);
  });
  // 4. "1x10" / "1*10" combo packs.
  consume(/\b(\d+)\s*[x*]\s*(\d+)\b/, (m) => {
    packs.push(m[2]);
  });
  // 5. Numbers that can only be packs: "10 strips", "2 bottles", "5 sachets".
  consume(new RegExp(`\\b(\\d+(?:\\.\\d+)?)\\s*(?:${PACK_ONLY_NOUNS})\\b`), (m) => {
    packs.push(trimNumber(m[1]));
  });
  // 6. Trailing-'s' pack spelling: "10's", "15s".
  consume(/\b(\d+)\s*['’]s\b/, (m) => {
    packs.push(m[1]);
  });
  // 7. Volumes and weights: "100 ml", "60ml", "30g" (a gel's 30 g tube is a
  //    pack, not a dose — mg/ml doses were already consumed above).
  consume(/(\d+(?:\.\d+)?)\s*(ml|l|gm|g)\b/, (m) => {
    packs.push(`${trimNumber(m[1])}${m[2]}`);
  });
  // 8. Remaining bare numbers. The first one not already explained by an
  //    explicit unit is the dose ("Telma 40", "Dolo 650"); once a dose is
  //    known, every later number is a pack count ("Dolo 650 15 tablets"). A
  //    number before the dosage form still enters here, so "Telma 40 Tablet"
  //    reads as the 40 mg tablet — a strict reading that can only produce an
  //    occasional false rejection, never a wrong-variant match.
  let doseAssigned = doses.length > 0;
  consume(/\b(\d+(?:\.\d+)?)\b/, (m) => {
    const value = trimNumber(m[1]);
    if (!doseAssigned) {
      doses.push(`${value}mg`);
      doseAssigned = true;
    } else {
      packs.push(value);
    }
  });

  // 9. Dosage form, first word that states one.
  const formPattern = new RegExp(
    `\\b(${Object.keys(FORM_WORDS).join("|")})\\b`,
    "g",
  );
  let formMatch: RegExpExecArray | null;
  while ((formMatch = formPattern.exec(work)) !== null) {
    const canonical = FORM_WORDS[formMatch[1]];
    if (canonical) {
      form = canonical;
      work = work.slice(0, formMatch.index) + " ".repeat(formMatch[0].length) + work.slice(formMatch.index + formMatch[0].length);
      break;
    }
  }

  const core = splitWords(work).filter((token) => !UNIT_WORDS.has(token));
  return {
    dose: doses.length > 0 ? doses[0] : null,
    pack: packs.length > 0 ? packKeyOf(packs) : null,
    form,
    core,
  };
}

/** One pack value wins: an explicit volume beats a bare count. */
function packKeyOf(values: string[]): string {
  const volume = values.find((v) => /ml$|l$/.test(v) && /\d(ml|l)$/.test(v));
  return volume ?? values[0];
}

/** Canonical pack key from a pack-size field: "10 tablets" → "10". */
export function statedPack(value: string): string | null {
  const text = (value ?? "").trim().toLowerCase();
  if (!text) return null;
  const volume = text.match(/(\d+(?:\.\d+)?)\s*(ml|l|gm|g)\b/);
  if (volume) return `${trimNumber(volume[1])}${volume[2]}`;
  const combo = text.match(/\b(\d+)\s*[x*]\s*(\d+)\b/);
  if (combo) return combo[2];
  const count = text.match(new RegExp(`\\b(\\d+)\\s*(?:${PACK_NOUNS})\\b`));
  if (count) return count[1];
  const ofPhrase = text.match(/\b(?:strip|pack|box|bottle)(?:\s+of)?\s+(\d+)/);
  if (ofPhrase) return ofPhrase[1];
  const trailing = text.match(/\b(\d+)\s*['’]s\b/);
  if (trailing) return trailing[1];
  const bare = text.match(/\b(\d+(?:\.\d+)?)\b/);
  if (bare) return trimNumber(bare[1]);
  return null;
}

/** The canonical dosage form a free-text field states, if any. */
export function statedForm(value: string): string | null {
  const text = (value ?? "").toLowerCase();
  if (!text.trim()) return null;
  for (const word of splitWords(text)) {
    const canonical = FORM_WORDS[word];
    if (canonical) return canonical;
  }
  return null;
}

/** The dose a free-text strength field states, canonicalised. */
export function statedStrength(value: string): string | null {
  const text = (value ?? "").trim().toLowerCase();
  if (!text) return null;
  const dose = text.match(/(\d+(?:\.\d+)?)\s*(mcg|µg|ug|mg|iu|%)/);
  if (dose) return `${trimNumber(dose[1])}${dose[2]}`;
  const bare = text.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
  if (bare) return `${trimNumber(bare[1])}mg`;
  return null;
}

/** Everything the matcher compares, derived from any identity-ish input. */
export type IdentityInput = {
  name: string;
  strength?: string | null;
  form?: string | null;
  packSize?: string | null;
  manufacturer?: string | null;
  brand?: string | null;
};

export type ParsedIdentity = {
  core: string[];
  dose: string | null;
  form: string | null;
  pack: string | null;
};

export function parseIdentity(input: IdentityInput): ParsedIdentity {
  const scan = scanName(input.name ?? "");
  const fieldDose = statedStrength(input.strength ?? "");
  const fieldForm = statedForm(input.form ?? "");
  const fieldPack = statedPack(input.packSize ?? "");
  return {
    core: scan.core,
    dose: fieldDose ?? scan.dose,
    form: fieldForm ?? scan.form,
    pack: fieldPack ?? scan.pack,
  };
}

/**
 * The stable dedupe key for a record: name core (order-independent) + dose +
 * form + pack + manufacturer. Two variants can never collide, and the same
 * variant re-imported without a source id lands on the same row.
 */
export function identityKeyOf(input: IdentityInput): string {
  const parsed = parseIdentity(input);
  const maker = normalizeName(input.manufacturer ?? "").replace(/\s+/g, "");
  return [
    [...parsed.core].sort().join(" "),
    parsed.dose ?? "",
    parsed.form ?? "",
    parsed.pack ?? "",
    maker,
  ].join("|");
}

// ── Exact matching ───────────────────────────────────────────────────────────

export type MatchVerdict = "exact" | "related" | "reject";

export type MatchResult = {
  verdict: MatchVerdict;
  /** Plain words for the admin review panel. */
  reason: string;
};

export type MatchOptions = {
  /**
   * True while the admin is still typing: a truncated dose/pack/word is
   * treated as compatible with the record it is heading towards, so the
   * autocomplete list does not flicker away at "dolo 65". Auto Fill itself
   * always runs in strict mode — a half-typed name never matches.
   */
  partial?: boolean;
};

/** The numeric head of a dose/pack key: "650mg" → "650". */
function numericHead(value: string): string {
  return value.match(/^\d+(?:\.\d+)?/)?.[0] ?? value;
}

/** Is the typed value a truncation of the record's value? */
function typedPrefix(typed: string, actual: string): boolean {
  if (typed === actual) return true;
  const typedNum = numericHead(typed);
  const actualNum = numericHead(actual);
  return typedNum.length > 0 && actualNum.startsWith(typedNum);
}

/** Company suffixes that never distinguish one product from another. */
const COMPANY_WORDS = new Set([
  "ltd", "limited", "inc", "co", "company", "pharma", "pharmaceutical",
  "pharmaceuticals", "laboratories", "laboratory", "labs", "lab",
  "industries", "industry", "healthcare", "medicals", "internationals",
]);

/**
 * Decide whether a catalog record is the exact product the admin asked for.
 *
 * - "exact": identity signals agree; safe to auto-fill when unique.
 * - "related": no contradicting signal, but the record is a broader or
 *   different-form variant — offered as a suggestion only, never auto-applied.
 * - "reject": a true variant (different strength/form/pack/name) — never
 *   returned as a match, however similar it looks.
 */
export function assessCatalogMatch(
  record: IdentityInput,
  query: IdentityInput,
  options: MatchOptions = {},
): MatchResult {
  const partial = options.partial === true;
  const r = parseIdentity(record);
  const q = parseIdentity(query);

  if (q.core.length === 0 && !q.dose) {
    return { verdict: "reject", reason: "the typed name carries no product identity" };
  }

  // Conflicting identity signals are rejections, whatever the names look like.
  if (
    q.dose &&
    r.dose &&
    q.dose !== r.dose &&
    !(partial && typedPrefix(q.dose, r.dose))
  ) {
    return { verdict: "reject", reason: `different strength (${q.dose} vs ${r.dose})` };
  }
  if (q.form && r.form && q.form !== r.form) {
    return { verdict: "reject", reason: `different dosage form (${q.form} vs ${r.form})` };
  }
  if (
    q.pack &&
    r.pack &&
    q.pack !== r.pack &&
    !(partial && typedPrefix(q.pack, r.pack))
  ) {
    return { verdict: "reject", reason: `different pack size (${q.pack} vs ${r.pack})` };
  }

  // Extra name tokens may only be the record's own manufacturer/brand words —
  // never another variant's distinguishing word ("Cold", "Advance", "LN").
  const absorb = new Set([
    ...splitWords(record.manufacturer ?? ""),
    ...splitWords(record.brand ?? ""),
    ...COMPANY_WORDS,
  ]);
  const absorbList = [...absorb];
  const tokenMatches = (token: string, pool: Set<string>, poolList: string[]): boolean => {
    if (pool.has(token)) return true;
    if (!partial) return false;
    const candidates = poolList.length > 0 ? poolList : [...pool];
    return candidates.some((word) => word.startsWith(token));
  };

  const rCore = new Set(r.core);
  const qCore = new Set(q.core);
  const extraQuery = q.core.filter(
    (t) =>
      !rCore.has(t) &&
      !absorb.has(t) &&
      !tokenMatches(t, rCore, r.core) &&
      !tokenMatches(t, absorb, absorbList),
  );
  if (extraQuery.length > 0) {
    return {
      verdict: "reject",
      reason: `the typed name names a different product (${extraQuery.join(", ")})`,
    };
  }
  const extraRecord = r.core.filter(
    (t) =>
      !qCore.has(t) &&
      !absorb.has(t) &&
      !tokenMatches(t, qCore, q.core) &&
      !tokenMatches(t, absorb, absorbList),
  );

  if (extraRecord.length === 0) {
    // Same core identity. A form the record states that the admin did not is
    // only the default solid-oral form; anything else is a real variant.
    if (!q.form && r.form && !DEFAULT_FORMS.has(r.form)) {
      return {
        verdict: "related",
        reason: `the record is the ${r.form} variant of this name`,
      };
    }
    return { verdict: "exact", reason: "exact variant match" };
  }

  return {
    verdict: "related",
    reason: `the record is a broader variant (${extraRecord.join(", ")})`,
  };
}

// ── Dataset column mapping ───────────────────────────────────────────────────

export const CATALOG_FIELDS = [
  "productName", "brand", "manufacturer", "composition", "strength", "form",
  "packaging", "mrp", "productId", "sku", "gtin", "category",
  "prescription", "description", "benefits", "directions", "safety",
  "storage", "imageFilename",
] as const;
export type CatalogField = (typeof CATALOG_FIELDS)[number];

export type ColumnMapping = {
  columns: Record<CatalogField, number | null>;
  /** Every column that holds an image URL for its row (first is primary). */
  imageUrlColumns: number[];
};

/** Folded header → field. Order decides which field claims a header first. */
const EXACT_ALIASES: Array<[CatalogField, string[]]> = [
  ["productName", ["product name", "productname", "medicine name", "drug name", "item name", "product title", "name", "item"]],
  ["brand", ["brand", "brand name", "brandname", "trade name"]],
  ["manufacturer", ["manufacturer", "manufactured by", "mfr", "maker", "company", "company name", "marketed by", "packed by", "marketer", "manufacturer name"]],
  ["composition", ["composition", "composition s", "ingredients", "ingredient", "generic name", "salt composition", "salt", "formula", "contents"]],
  ["strength", ["strength", "potency", "dosage strength"]],
  ["form", ["form", "dosage form", "dosage forms", "product form", "form type"]],
  ["packaging", ["packaging", "package", "pack size", "pack size s", "pack", "quantity", "qty", "pack quantity", "strip", "units per pack", "volume"]],
  ["mrp", ["mrp", "maximum retail price", "retail price", "market price", "price", "cost"]],
  ["productId", ["product id", "productid", "item id", "source product id", "catalog id", "catalogue id", "reference id", "pack id", "id"]],
  ["sku", ["sku", "sku code", "item code", "product code", "pack code"]],
  ["gtin", ["gtin", "barcode", "bar code", "ean", "ean 13", "upc", "upc code"]],
  ["category", ["category", "product category", "therapeutic class", "therapeutic category", "therapy area", "drug category", "segment"]],
  ["prescription", ["prescription", "prescription required", "rx", "rx otc", "rx / otc", "drug type", "schedule"]],
  ["description", ["description", "product description", "about", "about product", "product details", "details"]],
  ["benefits", ["benefits", "uses", "use", "indications", "indication"]],
  ["directions", ["directions", "how to use", "usage", "dosage instructions", "dosage and administration", "directions for use"]],
  ["safety", ["safety", "warnings", "warning", "side effects", "precautions", "side effect", "safety information"]],
  ["storage", ["storage", "storage instructions", "how to store", "storage information"]],
  ["imageFilename", ["image filename", "image file name", "filename", "file name", "image name", "photo name", "picture name"]],
];

/** Substring rules, only applied to headers no exact alias claimed. */
const CONTAINS_RULES: Array<[CatalogField, string[]]> = [
  ["gtin", ["gtin", "barcode", "ean"]],
  ["sku", ["sku", "item code", "product code", "pack code"]],
  ["productId", ["product id", "item id", "reference id", "catalog id"]],
  ["prescription", ["prescription", "rx required"]],
  ["manufacturer", ["manufacturer", "marketed by", "manufactured by", "packed by", "maker"]],
  ["composition", ["composition", "ingredient", "generic name"]],
  ["strength", ["strength", "potency"]],
  ["form", ["dosage form", "product form"]],
  ["packaging", ["packaging", "pack size", "package", "quantity"]],
  ["mrp", ["mrp", "maximum retail price"]],
  ["imageFilename", ["image filename", "image file", "photo filename", "file name", "image name"]],
  ["brand", ["brand"]],
  ["category", ["category", "therapeutic"]],
  ["description", ["description"]],
  ["benefits", ["benefit", "uses", "indication"]],
  ["directions", ["how to use", "direction", "usage", "dosage instruction"]],
  ["safety", ["side effect", "warning", "precaution", "safety"]],
  ["storage", ["storage"]],
  ["productName", ["product name", "medicine name", "item name"]],
];

const IMAGE_TOKENS = ["image", "img", "photo", "picture", "pic", "packshot", "hero"];
const URL_TOKENS = ["url", "link", "src", "href"];
const BARE_IMAGE_HEADERS = new Set([
  "image", "img", "photo", "picture", "packshot", "product image",
  "product photo", "main image", "hero image", "packshot url",
]);

function foldHeader(header: string): string {
  return normalizeName(header ?? "");
}

/** Is this folded header an image-URL column? */
function isImageUrlHeader(folded: string): boolean {
  if (BARE_IMAGE_HEADERS.has(folded)) return true;
  const tokens = new Set(folded.split(" ").filter(Boolean));
  const hasImage = IMAGE_TOKENS.some((t) => tokens.has(t));
  const hasUrl = URL_TOKENS.some((t) => tokens.has(t));
  return hasImage && hasUrl;
}

/**
 * Map dataset headers onto catalog fields automatically. Recognisable column
 * names ("Product Name", "MRP", "Image URL", "SKU / GTIN" …) are claimed
 * without any manual mapping; only genuinely ambiguous headers are left
 * unmapped, and a light fallback recognises plain "name"/"image" columns.
 */
export function mapColumns(headers: string[]): ColumnMapping {
  const folded = headers.map(foldHeader);
  const claimed = new Array(headers.length).fill(false);
  const columns: Record<CatalogField, number | null> = Object.fromEntries(
    CATALOG_FIELDS.map((f) => [f, null]),
  ) as Record<CatalogField, number | null>;

  const claim = (field: CatalogField, index: number) => {
    if (columns[field] === null) {
      columns[field] = index;
      claimed[index] = true;
    }
  };

  // 1. Exact header aliases.
  for (const [field, aliases] of EXACT_ALIASES) {
    if (columns[field] !== null) continue;
    for (const alias of aliases) {
      const index = folded.findIndex((h, i) => !claimed[i] && h === alias);
      if (index >= 0) {
        claim(field, index);
        break;
      }
    }
  }
  // 2. Substring rules.
  for (const [field, needles] of CONTAINS_RULES) {
    if (columns[field] !== null) continue;
    for (const needle of needles) {
      const index = folded.findIndex((h, i) => !claimed[i] && h.includes(needle));
      if (index >= 0) {
        claim(field, index);
        break;
      }
    }
  }
  // 3. Image URL columns (all of them — a dataset may ship several).
  const imageUrlColumns: number[] = [];
  folded.forEach((h, i) => {
    if (!claimed[i] && isImageUrlHeader(h)) {
      imageUrlColumns.push(i);
      claimed[i] = true;
    }
  });
  // 4. Fallbacks: any remaining "* name" column is the product name; any
  //    remaining image-ish column is an image URL.
  if (columns.productName === null) {
    const index = folded.findIndex(
      (h, i) =>
        !claimed[i] &&
        h.includes("name") &&
        !h.includes("brand") &&
        !h.includes("manufacturer") &&
        !h.includes("file"),
    );
    if (index >= 0) claim("productName", index);
  }
  folded.forEach((h, i) => {
    if (!claimed[i] && IMAGE_TOKENS.some((t) => h.includes(t))) {
      imageUrlColumns.push(i);
      claimed[i] = true;
    }
  });

  return { columns, imageUrlColumns };
}

// ── Row → catalog record ─────────────────────────────────────────────────────

/** The table fields a dataset row produces (server adds timestamps/ids). */
export type CatalogSeedRecord = {
  catalogProductId: string;
  canonicalProductName: string;
  normalizedName: string;
  identityKey: string;
  brand?: string;
  manufacturer?: string;
  composition?: string;
  normalizedComposition?: string;
  strength?: string;
  dosageForm?: string;
  packSize?: string;
  sku?: string;
  gtin?: string;
  category?: string;
  prescriptionRequired?: boolean;
  description?: string;
  benefits?: string;
  directions?: string;
  safety?: string;
  storage?: string;
  mrp?: number;
  sourceProductId?: string;
  sourceUrl?: string;
  verificationStatus: VerificationStatus;
};

export type ParsedRow = {
  record: CatalogSeedRecord;
  /** Image URLs declared on the row itself (stored into Convex storage). */
  imageUrls: string[];
  /** Image filename declared on the row (matched against the ZIP). */
  imageFilename: string | null;
};

function text(value: string | undefined): string | undefined {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function parseMoney(value: string | undefined): number | undefined {
  // Strip currency symbols, thousands separators and spaces first, so
  // "₹1,234.50" never becomes 1.
  const cleaned = (value ?? "").replace(/[^0-9.]/g, "");
  const match = cleaned.match(/\d+(?:\.\d+)?/);
  if (!match) return undefined;
  const num = Number(match[0]);
  return Number.isFinite(num) && num > 0 ? num : undefined;
}

/** "Rx" / "Prescription required" → true, "OTC" / "No" → false. */
export function parsePrescription(value: string | undefined): boolean | undefined {
  const folded = foldHeader(value ?? "");
  if (!folded) return undefined;
  if (
    ["rx", "rx only", "rx required", "prescription", "prescription required",
     "prescription drug", "prescription only", "yes", "true", "1", "required",
     "schedule h", "h"].includes(folded)
  ) {
    return true;
  }
  if (
    ["otc", "otc only", "over the counter", "non prescription", "nonprescription",
     "no", "false", "0", "not required"].includes(folded)
  ) {
    return false;
  }
  if (folded.startsWith("rx ")) return true;
  if (folded.startsWith("otc")) return false;
  return undefined;
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/** Basename of a path/URL, lower-cased, without extension. */
export function imageStem(value: string): string {
  const base = (value ?? "").trim().split(/[?#]/)[0].split("/").pop() ?? "";
  return base.replace(/\.[a-z0-9]{2,5}$/i, "").toLowerCase();
}

/** Face markers a filename may carry after the product name. */
const FACE_SUFFIX =
  /[-_ ](front|back|side|label|rear|left|right|top|bottom|alt|alternate|view|detail|zoom|closeup|close-up)$/;

/**
 * Exact-name candidates for one image filename: the stem itself, and the
 * stem with a face marker or an index suffix removed ("dolo-650-tablet-1",
 * "dolo 650 tablet front"). Still an EXACT name comparison — no fuzzy,
 * substring or salt matching happens here.
 */
function nameStemVariants(stem: string): string[] {
  const variants = [stem];
  const face = stem.match(FACE_SUFFIX);
  if (face) variants.push(stem.slice(0, stem.length - face[0].length));
  const index = stem.match(/[-_ ]\d{1,2}$/);
  if (index) variants.push(stem.slice(0, stem.length - index[0].length));
  return [...new Set(variants.filter((variant) => variant.length > 0))];
}

/**
 * Build one catalog record from a dataset row. Returns null when the row has
 * no product name — such rows are skipped, never guessed at.
 */
export function rowToRecord(cells: string[], mapping: ColumnMapping): ParsedRow | null {
  const get = (field: CatalogField): string => {
    const index = mapping.columns[field];
    if (index === null || index === undefined) return "";
    return (cells[index] ?? "").trim();
  };

  const name = get("productName");
  if (!name) return null;

  const manufacturer = text(get("manufacturer"));
  const brand = text(get("brand"));
  const composition = text(get("composition"));
  const strength = text(get("strength"));
  const dosageForm = statedForm(get("form")) ?? statedForm(name) ?? undefined;
  const packSize = text(get("packaging"));
  const sku = text(get("sku"));
  const gtin = text(get("gtin"))?.replace(/[^0-9A-Za-z]/g, "") || undefined;
  const sourceProductId = text(get("productId"));

  const normalizedName = normalizeName(name);
  const identityKey = identityKeyOf({
    name,
    strength: strength ?? null,
    form: dosageForm ?? null,
    packSize: packSize ?? null,
    manufacturer: manufacturer ?? null,
    brand: brand ?? null,
  });

  const catalogProductId = sourceProductId
    ? `src-${sourceProductId}`
    : `${slugify(normalizedName) || "item"}-${shortHash(identityKey)}`;

  const record: CatalogSeedRecord = {
    catalogProductId,
    canonicalProductName: name,
    normalizedName,
    identityKey,
    verificationStatus: "NEEDS_REVIEW",
  };
  const put = <K extends keyof CatalogSeedRecord>(key: K, value: CatalogSeedRecord[K]) => {
    if (value !== undefined && value !== null && value !== "") record[key] = value;
  };

  put("brand", brand);
  put("manufacturer", manufacturer);
  put("composition", composition);
  if (composition) record.normalizedComposition = normalizeComposition(composition);
  put("strength", strength);
  put("dosageForm", dosageForm);
  put("packSize", packSize);
  put("sku", sku);
  put("gtin", gtin);
  put("category", text(get("category")));
  const rx = parsePrescription(get("prescription"));
  if (rx !== undefined) record.prescriptionRequired = rx;
  put("description", text(get("description")));
  put("benefits", text(get("benefits")));
  put("directions", text(get("directions")));
  put("safety", text(get("safety")));
  put("storage", text(get("storage")));
  const mrp = parseMoney(get("mrp"));
  if (mrp !== undefined) record.mrp = mrp;
  put("sourceProductId", sourceProductId);

  const imageUrls = mapping.imageUrlColumns
    .map((index) => (cells[index] ?? "").trim())
    .filter((value) => isHttpUrl(value));

  return {
    record,
    imageUrls,
    imageFilename: text(get("imageFilename")) ?? null,
  };
}

/**
 * The verification status a record earns from the licensed row itself.
 *
 * Identity is "sufficiently supported" when the record identifies its maker or
 * formula AND states a strength or dosage form (directly or in its own name).
 * A record with supported identity but no image is NEEDS_IMAGE — the one thing
 * the admin still needs before publishing.
 */
export function verificationStatusFor(
  input: {
    name: string;
    manufacturer?: string | null;
    composition?: string | null;
    strength?: string | null;
    dosageForm?: string | null;
  },
  hasImage: boolean,
): VerificationStatus {
  const identitySupported = Boolean(input.manufacturer || input.composition);
  const variantStated = Boolean(
    input.strength ||
    input.dosageForm ||
    statedStrength(input.name) ||
    statedForm(input.name),
  );
  if (!identitySupported || !variantStated) return "NEEDS_REVIEW";
  return hasImage ? "VERIFIED" : "NEEDS_IMAGE";
}

// ── Image → record matching ──────────────────────────────────────────────────

/** The slice of a record the image matcher is allowed to read. */
export type RecordForImages = {
  catalogProductId: string;
  normalizedName: string;
  canonicalProductName: string;
  dosageForm?: string;
  sourceProductId?: string;
  sku?: string;
  gtin?: string;
  /** The image filename this row itself declared (exact binding). */
  declaredFilename?: string | null;
};

export type ZipImageAsset = { filename: string };

export type ImageAttachment = {
  catalogProductId: string;
  sourceProductId?: string;
  filenames: string[];
  /** Which priority step matched the image. */
  matchedBy: "sourceProductId" | "sku-gtin" | "filename" | "name";
};

export type ImagePlan = {
  attachments: ImageAttachment[];
  /** Filenames that could not be tied to exactly one record. */
  unmatched: string[];
};

function lower(value: string | undefined | null): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Tie every image file in the licensed ZIP to exactly one catalog record.
 *
 * Priority, in order: source Product ID → SKU/GTIN → the exact filename the
 * dataset row declared → the exact normalized product name. An image that
 * matches nothing at that exact level stays unmatched. A generic salt or
 * shared word ("paracetamol", "dolo") is NEVER enough — that is how
 * "Dolo 650" would end up wearing "Dolo 500" or "Dolo Cold".
 */
export function planZipImages(
  records: RecordForImages[],
  assets: ZipImageAsset[],
): ImagePlan {
  const bySourceId = new Map<string, RecordForImages[]>();
  const byCode = new Map<string, RecordForImages[]>();
  const byDeclared = new Map<string, RecordForImages[]>();
  const byName = new Map<string, RecordForImages[]>();
  const push = <T>(map: Map<string, T[]>, key: string, value: T) => {
    if (!key) return;
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
  };

  for (const record of records) {
    push(bySourceId, lower(record.sourceProductId), record);
    push(byCode, lower(record.sku), record);
    push(byCode, lower(record.gtin), record);
    if (record.declaredFilename) {
      push(byDeclared, lower(record.declaredFilename), record);
      push(byDeclared, imageStem(record.declaredFilename), record);
    }
    push(byName, record.normalizedName, record);
    const withForm = normalizeName(
      `${record.canonicalProductName} ${record.dosageForm ?? ""}`,
    );
    push(byName, withForm, record);
  }

  const unique = (list: RecordForImages[] | undefined): RecordForImages[] => {
    if (!list || list.length === 0) return [];
    const seen = new Set<string>();
    return list.filter((r) => {
      if (seen.has(r.catalogProductId)) return false;
      seen.add(r.catalogProductId);
      return true;
    });
  };

  /**
   * Resolve a code map for one stem: an exact id wins; otherwise a stem that
   * starts with the id plus a separator ("dp-1-extra") is still that id. More
   * than one candidate means a guess, and a guess is never attached.
   */
  const resolveById = (
    map: Map<string, RecordForImages[]>,
    stemValue: string,
  ): RecordForImages | null => {
    const exact = unique(map.get(stemValue));
    if (exact.length === 1) return exact[0];
    if (exact.length > 1) return null;
    const prefixed: RecordForImages[] = [];
    for (const [key, list] of map) {
      if (
        stemValue.startsWith(`${key}-`) ||
        stemValue.startsWith(`${key}_`) ||
        stemValue.startsWith(`${key}.`)
      ) {
        prefixed.push(...list);
      }
    }
    const deduped = unique(prefixed);
    return deduped.length === 1 ? deduped[0] : null;
  };

  const attachments = new Map<string, ImageAttachment>();
  const unmatched: string[] = [];

  for (const asset of assets) {
    const filename = asset.filename;
    const stem = imageStem(filename);
    const base = lower(filename.split("/").pop());
    const stemUpper = stem.toUpperCase();

    let hit: RecordForImages | null = null;
    let matchedBy: ImageAttachment["matchedBy"] | null = null;

    // 1. Source Product ID (exact, or id + separator + index/extra).
    hit = resolveById(bySourceId, stem) ?? resolveById(bySourceId, stemUpper);
    if (hit) matchedBy = "sourceProductId";
    // 2. SKU / GTIN.
    if (!hit) {
      hit = resolveById(byCode, stem) ?? resolveById(byCode, stemUpper);
      if (hit) matchedBy = "sku-gtin";
    }
    // 3. The exact filename the dataset row declared for its image.
    if (!hit) {
      const candidates = unique(byDeclared.get(base)).concat(
        unique(byDeclared.get(stem)),
      );
      if (candidates.length === 1) {
        hit = candidates[0];
        matchedBy = "filename";
      } else if (candidates.length > 1) {
        unmatched.push(filename);
        continue;
      }
    }
    // 4. Exact normalized product name (name, or name + this record's form),
    //    allowing only a face or index suffix on the filename.
    if (!hit) {
      const nameHits = new Set<string>();
      let ambiguous = false;
      for (const variant of nameStemVariants(stem)) {
        const byExactName = unique(byName.get(variant));
        if (byExactName.length > 1) {
          ambiguous = true;
          break;
        }
        if (byExactName.length === 1) nameHits.add(byExactName[0].catalogProductId);
      }
      if (ambiguous || nameHits.size > 1) {
        // Two records share the name: attaching would be a guess.
        unmatched.push(filename);
        continue;
      }
      if (nameHits.size === 1) {
        hit = records.find((r) => r.catalogProductId === [...nameHits][0]) ?? null;
        if (hit) matchedBy = "name";
      }
    }

    if (!hit || !matchedBy) {
      unmatched.push(filename);
      continue;
    }

    const existing = attachments.get(hit.catalogProductId);
    if (existing) {
      if (!existing.filenames.includes(filename) && existing.filenames.length < MAX_CATALOG_IMAGES) {
        existing.filenames.push(filename);
      }
    } else {
      attachments.set(hit.catalogProductId, {
        catalogProductId: hit.catalogProductId,
        sourceProductId: hit.sourceProductId,
        filenames: [filename],
        matchedBy,
      });
    }
  }

  return { attachments: [...attachments.values()], unmatched };
}

// ── Gallery ordering ─────────────────────────────────────────────────────────

const FRONT_MARKERS = ["front", "box-front", "frente"];
const BACK_SIDE_MARKERS = ["back", "rear", "side", "bottom", "top", "left", "right", "reverse"];
const DETAIL_MARKERS = ["detail", "zoom", "macro", "close", "closeup", "close-up"];

/**
 * Rank the images that belong to ONE record: front packshot first, then
 * unlabelled pack views, then genuine detail shots, then explicit back/side
 * panels. Stable, so the dataset's own order decides ties. The first entry
 * becomes the primary image; no image is ever mirrored, duplicated or
 * manufactured to fill the gallery.
 */
export function orderCatalogImages<T extends { url: string }>(images: T[]): T[] {
  const tier = (url: string): number => {
    const segments = imageStem(url).split(/[-_.\s]+/).filter(Boolean);
    if (segments.some((s) => FRONT_MARKERS.includes(s))) return 3;
    if (segments.some((s) => BACK_SIDE_MARKERS.includes(s))) return 0;
    if (segments.some((s) => DETAIL_MARKERS.some((d) => s.includes(d)))) return 1;
    return 2;
  };
  return images
    .map((image, index) => ({ image, index, tier: tier(image.url) }))
    .sort((a, b) => (b.tier - a.tier) || (a.index - b.index))
    .map((entry) => entry.image);
}
