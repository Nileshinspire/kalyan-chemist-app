/**
 * Online product metadata resolver for the Admin Auto Fill.
 *
 * The Auto Fill used to depend entirely on the curated `MEDICINES_DB`: when the
 * admin typed a name that was not in it, the pipeline fell straight through to
 * classifying the (empty) fields the admin had typed, which is why perfectly
 * real products came back as `unknown` / "no confident match".
 *
 * This module is the missing step: it identifies the EXACT product from public
 * product sources and returns the metadata that actually describes it, so
 * classification, copy generation and image resolution all run against resolved
 * data instead of guesses.
 *
 * Sources, in the order they are asked:
 *   1. The brand's / manufacturer's own product page (JSON-LD Product schema).
 *   2. The licensed pharmacy catalogue — the source that actually carries
 *      per-product records (composition, dosage form, pack size, prescription
 *      flag) for the medicines this pharmacy sells.
 *   3. openFDA drug labels — a structured regulatory database, used both as an
 *      identity source and to enrich clinical copy.
 *
 * Rules that hold for every source:
 *   - Nothing is returned that the source did not actually state. A field the
 *     source does not publish stays `null`; it is never guessed or filled from
 *     a different product.
 *   - A candidate is accepted only when it is the SAME product: the shared
 *     exact-match engine (the same one the image resolver uses) has to accept
 *     the name, and the strength / dosage form / pack count / brand the admin
 *     stated must not disagree with what the source resolved.
 *   - Community "open product" databases are deliberately not used here. They
 *     are useful for photography, but for metadata they return wrong-market
 *     entries for medicines (a French or Philippine pack of a molecule that the
 *     pharmacy sells in India), which is exactly the substitution this module
 *     must never perform.
 */
import { action } from "./_generated/server";
import { v } from "convex/values";
import {
  asString,
  single,
  words,
  nextData,
  collectRecords,
  searchVariants,
  getText,
  getJson,
  officialSite,
  productLinks,
  identityWordsOf,
  productNameMatchesIdentity,
  makerIsBrandLabel,
  imagesOf,
  jsonLdImages,
  pageImages,
  sameMaker,
  MAX_QUERIES_PER_SOURCE,
  SITE_SEARCH_PATTERNS,
  SITE_TIMEOUT_MS,
  PHARMEASY_SEARCH,
  type ProductIdentity,
  type ProductRecordImages,
  type RawRecord,
} from "./productImageResolver";
import {
  CATALOGUE_SOURCES,
  OFFICIAL_SOURCE,
  SOURCE_LABELS,
  probeCatalogueSource,
} from "./productCatalogSources";

/** Everything the Auto Fill needs, and nothing it was not given. */
export type ResolvedProductMetadata = {
  /** True only when one exact product was verified from a real source. */
  matched: boolean;
  productName: string | null;
  brand: string | null;
  manufacturer: string | null;
  composition: string | null;
  strength: string | null;
  form: string | null;
  packSize: string | null;
  description: string | null;
  benefits: string | null;
  directions: string | null;
  safety: string | null;
  storage: string | null;
  /** Only when the source actually publishes a prescription flag. */
  prescriptionRequired: boolean | null;
  /** Product code the source exposes, when it exposes one. */
  sku: string | null;
  source: string | null;
  sourceUrl: string | null;
  /**
   * The exact record that was matched, together with the image assets that same
   * record publishes. The Auto Fill stores these assets, so the packshot on the
   * product is always the packshot of the product whose metadata was just
   * resolved — never a second, independent lookup of some other product.
   */
  record: ProductRecordImages | null;
  /**
   * Every source the cascade asked and what it answered, so a failure says
   * which catalogues were checked instead of implying nothing was.
   */
  sources: SourceReport[];
  /** Sources consulted and why a candidate was rejected (admin audit trail). */
  notes: string[];
};

/** A per-product catalogue record (pharmacy catalogue). */
export type CatalogueProduct = {
  productName: string;
  brand: string | null;
  manufacturer: string | null;
  composition: string | null;
  strength: string | null;
  form: string | null;
  packSize: string | null;
  prescriptionRequired: boolean | null;
  /** Product code / SKU, when the source publishes one. */
  sku: string | null;
  slug: string | null;
  source: string;
  sourceUrl: string | null;
};

/** A product described by the brand's own page (JSON-LD). */
export type OfficialProduct = {
  productName: string;
  brand: string | null;
  manufacturer: string | null;
  description: string | null;
  category: string | null;
  source: string;
  sourceUrl: string | null;
  /** The images that page's own Product schema lists for this product. */
  images: ProductRecordImages["images"];
};

/** A structured drug label record. */
export type LabelProduct = {
  productName: string;
  brand: string | null;
  manufacturer: string | null;
  composition: string | null;
  strength: string | null;
  form: string | null;
  benefits: string | null;
  directions: string | null;
  safety: string | null;
  storage: string | null;
  source: string;
  sourceUrl: string | null;
};

const EMPTY: ResolvedProductMetadata = {
  matched: false,
  productName: null,
  brand: null,
  manufacturer: null,
  composition: null,
  strength: null,
  form: null,
  packSize: null,
  description: null,
  benefits: null,
  directions: null,
  safety: null,
  storage: null,
  prescriptionRequired: null,
  sku: null,
  source: null,
  sourceUrl: null,
  record: null,
  sources: [],
  notes: [],
};

/** A blank result: nothing resolved, and no source has been asked yet. */
export function emptyResolvedMetadata(): ResolvedProductMetadata {
  return { ...EMPTY, notes: [], sources: [] };
}

/**
 * Join overlapping descriptions into one readable value: a value already
 * contained in a longer one is dropped rather than repeated.
 */
function mergeDistinct(values: Array<string | undefined>): string {
  const present = [...new Set(
    values
      .map((value) => clean(value))
      .filter((value): value is string => !!value),
  )];
  const kept = present.filter(
    (value) => !present.some((other) => other !== value && other.includes(value)),
  );
  return kept.join(" ");
}

function clean(text: string | undefined): string | null {
  if (!text) return null;
  const value = text.replace(/\s+/g, " ").trim();
  return value.length > 0 ? value : null;
}

/**
 * Sources publish names in shouty case ("GLAXOSMITHKLINE"). Normalising the
 * casing changes nothing about what the source said and keeps the admin form
 * readable.
 */
function readable(value: string | undefined | null): string | null {
  const text = clean(value ?? undefined);
  if (!text) return null;
  if (text.length > 60) return text;
  const letters = text.replace(/[^a-z]/gi, "");
  if (letters.length > 1 && letters === letters.toUpperCase()) {
    return text
      .toLowerCase()
      .replace(/(^|[\s(\-/.])\p{L}/gu, (c) => c.toUpperCase())
      .replace(/\b(Pvt|Ltd|Llp|Inc|Corp)\b/g, (c) => c.toUpperCase());
  }
  return text;
}

/**
 * The dosage form a source actually states. Pack containers ("strip", "tube",
 * "bottle") are deliberately not forms — a strip is how tablets are packed, not
 * what they are — so they never stand in for a missing form.
 */
const DOSAGE_FORMS: Array<[RegExp, string]> = [
  [/\beye\s*drop/i, "eye drops"],
  [/\bear\s*drop/i, "ear drops"],
  [/\bnasal\s*(?:drop|spray)/i, "nasal drops"],
  [/\bsoft\s*gel(?:atin)?\b/i, "softgel capsule"],
  [/\btablets?\b|\btab\b/i, "tablet"],
  [/\bcapsules?\b/i, "capsule"],
  [/\bcaplets?\b/i, "caplet"],
  [/\bsyrup\b/i, "syrup"],
  [/\bsuspension\b/i, "suspension"],
  [/\bsachets?\b|\bgranules?\b|\bpowders?\b/i, "sachet"],
  [/\binhalers?\b|\brespules?\b/i, "inhaler"],
  [/\binjections?\b|\binjectable\b/i, "injection"],
  [/\bcreams?\b/i, "cream"],
  [/\bgels?\b/i, "gel"],
  [/\bointments?\b|\bbalms?\b/i, "ointment"],
  [/\blotions?\b/i, "lotion"],
  [/\bsprays?\b/i, "spray"],
  [/\boils?\b/i, "oil"],
  // Non-medicine forms a pharmacy catalogue also stocks. Naming them keeps a
  // cleanser a cleanser and a kit a kit, instead of leaving the form blank and
  // letting the product be classified from its name alone.
  [/\bcleansers?\b|\bface\s*wash\b|\bbody\s*wash\b|\bhand\s*wash\b/i, "cleanser"],
  [/\bsoaps?\b/i, "soap"],
  [/\bshampoos?\b|\bconditioners?\b/i, "shampoo"],
  [/\bserums?\b/i, "serum"],
  [/\bsunscreens?\b|\bsun\s*block\b/i, "sunscreen"],
  [/\btoothpaste\b/i, "toothpaste"],
  [/\bwipes?\b|\bbaby\s*wipes\b/i, "wipes"],
  [/\bdiapers?\b|\bpad(s)?\b/i, "diaper"],
  [/\btest\s*kits?\b|\bkit\(s\)\b|\bdevice(s)?\b|\bmeters?\b/i, "device"],
  [/\bbandages?\b|\bband\s*aid/i, "bandage"],
];

/** The first dosage form stated anywhere in the given text, if any. */
export function dosageFormFrom(text: string): string | null {
  for (const [pattern, form] of DOSAGE_FORMS) {
    if (pattern.test(text)) return form;
  }
  return null;
}

/**
 * Strengths a source states, e.g. "Amoxicillin(500.0 Mg)+Clavulanic Acid(125.0
 * Mg)" → "500 mg + 125 mg". Container sizes (g, ml) are pack sizes, not
 * strengths, so they are not read here.
 */
export function strengthFrom(text: string): string | null {
  const found: string[] = [];
  const pattern = /(\d+(?:\.\d+)?)\s*(mg|mcg|iu|%)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const value = Number(match[1]);
    if (!Number.isFinite(value)) continue;
    const unit = match[2].toLowerCase();
    const formatted = `${value % 1 === 0 ? value : value.toFixed(1)}${
      unit === "%" ? "%" : ` ${unit}`
    }`;
    if (!found.includes(formatted)) found.push(formatted);
    if (found.length >= 3) break;
  }
  return found.length > 0 ? found.join(" + ") : null;
}

/**
 * Pack counts a text states, in either order: "strip of 10", "10 tablets",
 * "30 g", "100 ml". Strengths are not pack counts, so a mass written directly
 * against its unit ("500 mg") is never read as one.
 */
export function packCounts(text: string): number[] {
  const counts: number[] = [];
  const push = (raw: string) => {
    const value = Number(raw);
    if (Number.isFinite(value) && value > 0 && !counts.includes(value)) counts.push(value);
  };
  for (const match of text.matchAll(
    /(\d{1,4})\s*(?:tablets?|capsules?|caplets?|sachets?|strips?|vials?|ampoules?|bottles?|tubes?|units?|\bml\b|\bkg\b|\bg\b)/gi,
  )) {
    push(match[1]);
  }
  for (const match of text.matchAll(
    /(?:strip|pack|box|container)\s*(?:of|pack of|x)?\s*(\d{1,4})\b/gi,
  )) {
    push(match[1]);
  }
  return counts;
}

// ── Source 2: the licensed pharmacy catalogue ──

/**
 * Read a catalogue search record. Every field here is a field the catalogue
 * itself publishes; a record missing all of them yields null rather than a
 * half-populated guess.
 */
export function parseCatalogueProduct(record: RawRecord): CatalogueProduct | null {
  const productName = asString(record.name);
  if (!productName) return null;

  const compositions = Array.isArray(record.compositions)
    ? record.compositions
        .map((entry) =>
          clean(
            typeof entry === "object" && entry !== null
              ? asString((entry as RawRecord).name)
              : asString(entry),
          ),
        )
        .filter((value): value is string => !!value)
    : [];

  const composition =
    compositions.length > 0
      ? clean(compositions.join(" + "))
      : clean(asString(record.moleculeName));

  // The catalogue states the pack size in up to three overlapping fields
  // ("10 Tablet(s) in Strip", "10 Tablet(s)"). They are merged rather than
  // concatenated, so the admin form never shows the same pack three times.
  const packText = mergeDistinct([
    asString(record.measurementUnit),
    asString(record.subtitleText),
    asString(record.shortSubtitleText),
  ]);

  const packForm = asString(record.packform);
  const form = dosageFormFrom(
    [productName, packText, packForm ?? ""].filter(Boolean).join(" "),
  );

  const slug = asString(record.slug);
  const rx = record.isRxRequired;
  const prescriptionRequired =
    rx === 1 || rx === "1" || rx === true
      ? true
      : rx === 0 || rx === "0" || rx === false
        ? false
        : null;

  return {
    productName,
    brand: readable(asString(record.consumerBrandName)),
    manufacturer: readable(asString(record.manufacturer)),
    composition,
    // The product's own strength is the dose its NAME states ("Augmentin Duo
    // 625Mg"). A composition's doses are ingredient amounts, which are not this
    // product's strength — and passing them on would make the image resolver
    // demand a 500 mg / 125 mg pack that is not what this product is. A single
    // unambiguous composition dose is used only when the name states none.
    strength:
      strengthFrom(productName) ??
      (() => {
        const fromComposition = composition ? strengthFrom(composition) : null;
        return fromComposition && !fromComposition.includes(" + ") ? fromComposition : null;
      })(),
    form,
    packSize: clean(packText),
    prescriptionRequired,
    sku:
      asString(record.sku) ??
      asString(record.productCode) ??
      asString(record.productId) ??
      null,
    slug: slug ?? null,
    source: "pharmacy-catalogue",
    sourceUrl: slug ? `${PHARMEASY_SEARCH}${encodeURIComponent(productName)}` : null,
  };
}

/**
 * Is this catalogue record the exact product the admin asked for?
 *
 * The shared exact-match engine decides the name, the strength and the dosage
 * form; this adds the two identity signals it deliberately treats as
 * preferences — the brand and the pack count — so a 10-strip record can never
 * stand in for the 15-strip product the admin typed.
 */
export function catalogueProductMatchesIdentity(
  product: CatalogueProduct,
  identity: ProductIdentity,
): boolean {
  // Weighted identity matching: capitalization, punctuation, word order,
  // marketing wording and an abbreviated manufacturer never hide a genuine
  // record, while a different strength, dosage form, pack, brand or product is
  // still refused below and by the shared exact-match engine.
  if (
    !productNameMatchesIdentity(
      product.productName,
      identity,
      product.manufacturer ?? undefined,
    )
  ) {
    return false;
  }

  // A brand the admin stated must be the brand this record belongs to.
  if (identity.brand) {
    const stated = words(identity.brand).filter((word) => word.length > 2);
    const found = words(`${product.productName} ${product.brand ?? ""}`);
    if (stated.length > 0 && !stated.every((word) => found.includes(word))) return false;
  }

  // A manufacturer the admin stated must not be contradicted by this record. A
  // catalogue that publishes the consumer brand in the manufacturer field
  // ("VOLINI" for the Volini gel made by Reckitt) is stating a label, not a
  // conflicting maker, so it never rejects an otherwise exact record.
  if (
    identity.manufacturer &&
    product.manufacturer &&
    !makerIsBrandLabel(product.productName, product.manufacturer) &&
    !sameMaker(
      { name: product.productName, manufacturer: product.manufacturer },
      { name: identity.productName, manufacturer: identity.manufacturer },
    )
  ) {
    return false;
  }

  // Pack count: a different pack is a different product variant, so it is a hard
  // rejection whenever both sides actually state one.
  const wanted = packCounts(`${identity.productName} ${identity.packSize ?? ""}`);
  const offered = packCounts(`${product.productName} ${product.packSize ?? ""}`);
  if (wanted.length > 0 && offered.length > 0) {
    const overlap = wanted.some((value: number) => offered.includes(value));
    if (!overlap) return false;
  }

  return true;
}

// ── Source 1: the brand's / manufacturer's own page ──

/** The first Product-shaped JSON-LD node on a page, if the site publishes one. */
export function parseJsonLdProduct(html: string): OfficialProduct | null {
  const pattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      continue;
    }
    const node = findProductNode(parsed, 0);
    if (!node) continue;
    const name = clean(asString(node.name));
    if (!name) continue;
    const brandNode = node.brand;
    const brand = clean(
      typeof brandNode === "object" && brandNode !== null
        ? asString((brandNode as RawRecord).name)
        : asString(brandNode),
    );
    const manufacturer = clean(
      asString(node.manufacturer) ??
        (typeof node.manufacturer === "object" && node.manufacturer !== null
          ? asString((node.manufacturer as RawRecord).name)
          : undefined),
    );
    return {
      productName: name,
      brand: readable(brand),
      manufacturer: readable(manufacturer),
      description: clean(asString(node.description)),
      category: clean(
        asString(node.category) ??
          (typeof node.category === "string" ? node.category : undefined),
      ),
      source: "official-site",
      sourceUrl: null,
      // The structured Product schema of this very page is the record's own
      // image list, so these are the brand's assets for this exact product.
      images: jsonLdImages(node).map((url) => ({ url })),
    };
  }
  return null;
}

function findProductNode(node: unknown, depth: number): RawRecord | null {
  if (depth > 6 || node === null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findProductNode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const record = node as RawRecord;
  const type = asString(record["@type"]) ?? "";
  // The value of `@type` is what identifies the node ("Product", "ProductGroup",
  // "schema:Product"), so the match is made against that value.
  if (/\bproduct\b/i.test(type) && asString(record.name)) {
    return record;
  }
  for (const value of Object.values(record)) {
    const found = findProductNode(value, depth + 1);
    if (found) return found;
  }
  return null;
}

export function officialProductMatchesIdentity(
  product: OfficialProduct,
  identity: ProductIdentity,
): boolean {
  return productNameMatchesIdentity(
    product.productName,
    identity,
    product.manufacturer ?? undefined,
  );
}

// ── Source 3: structured drug labels ──

/** Read a drug label record. Only fields the label states are carried over. */
export function parseLabelProduct(label: RawRecord): LabelProduct | null {
  const openfda = (label.openfda ?? {}) as RawRecord;
  const brand = readable(single(openfda.brand_name));
  const generic = readable(single(openfda.generic_name));
  const productName = brand ?? generic;
  if (!productName) return null;

  const active = clean(single(label.active_ingredient));
  const composition = clean(
    active ??
      (Array.isArray(openfda.substance_name)
        ? openfda.substance_name.filter((v): v is string => typeof v === "string").join(" + ")
        : asString(single(openfda.substance_name))),
  );
  const strengths = clean(
    Array.isArray(label.dosage_forms_and_strengths)
      ? label.dosage_forms_and_strengths.filter((v): v is string => typeof v === "string").join("; ")
      : asString(single(label.dosage_forms_and_strengths)),
  );
  const form = dosageFormFrom(
    `${asString(single(label.dosage_form)) ?? ""} ${productName}`,
  );
  const warnings = [
    single(label.warnings_and_cautions),
    single(label.warnings),
    single(label.contraindications),
  ]
    .filter((value): value is string => !!value)
    .join(" ");

  return {
    productName,
    brand,
    manufacturer: readable(
      single(openfda.manufacturer_name) ?? asString(single(label.manufacturer_name)),
    ),
    composition,
    strength:
      (composition ? strengthFrom(composition) : null) ??
      (strengths ? strengthFrom(strengths) : null),
    form,
    benefits: clean(single(label.indications_and_usage)),
    directions: clean(
      single(label.dosage_and_administration) ?? single(label.dosage_and_administration_table),
    ),
    safety: clean(warnings),
    storage: clean(single(label.storage_and_handling)),
    source: "openfda-label",
    sourceUrl: null,
  };
}

/**
 * A label is accepted only for the same substance at the same strength and in
 * the same dosage form. A label is a different market's presentation of the
 * molecule, so it must never be used to describe another product.
 */
export function labelProductMatchesIdentity(
  product: LabelProduct,
  identity: ProductIdentity,
): boolean {
  const wanted = strengthFrom(`${identity.strength ?? ""} ${identity.productName}`);
  const offered = product.strength;
  if (wanted && offered) {
    const wantedValues = wanted.split(" + ");
    const offeredValues = offered.split(" + ");
    const overlap = wantedValues.some((value) => offeredValues.includes(value));
    if (!overlap) return false;
  }
  if (identity.form && product.form) {
    if (dosageFormFrom(identity.form) !== product.form) return false;
  }
  return productNameMatchesIdentity(
    product.productName,
    { ...identity, productName: identity.productName },
    product.manufacturer ?? undefined,
  );
}

// ── Product detail pages ──

/** Structured product fields a detail page states, with the value it states. */
type PageAttributes = {
  brand?: string;
  manufacturer?: string;
  composition?: string;
  form?: string;
  strength?: string;
  packSize?: string;
  sku?: string;
};

/**
 * The label→value reader used on a product page. It only accepts a value that
 * sits directly next to a label the page itself prints, so a stray sentence
 * containing the word "composition" can never become this product's
 * composition.
 */
const PAGE_ATTRIBUTE_LABELS: Record<keyof PageAttributes, string[]> = {
  brand: ["brand", "brand name"],
  manufacturer: ["manufacturer", "manufactured by", "marketed by", "company"],
  composition: ["composition", "ingredients", "ingredient", "salt", "molecule"],
  form: ["dosage form", "form", "product type", "type"],
  strength: ["strength", "dose"],
  packSize: ["pack size", "packaging", "package size", "net quantity", "net qty", "contents"],
  sku: ["sku", "product code", "item code", "mpn"],
};

function pageAttributes(html: string): PageAttributes {
  const found: PageAttributes = {};
  const text = html.replace(/<[^>]+>/g, "\n").replace(/&amp;/g, "&");
  for (const [key, labels] of Object.entries(PAGE_ATTRIBUTE_LABELS) as Array<
    [keyof PageAttributes, string[]]
  >) {
    for (const label of labels) {
      // "Label: value" / "Label</span><span>value" / "Label — value"
      const pattern = new RegExp(
        `${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:<[^>]+>\\s*)*[\\s:\\u2014\\-–]{1,4}\\s*([^\\n<>]{2,80})`,
        "i",
      );
      const match = text.match(pattern);
      const value = match?.[1]?.trim();
      if (value && !/^(?:n\/?a|not available|-{2,})$/i.test(value)) {
        found[key] = clean(value) ?? undefined;
        break;
      }
    }
  }
  return found;
}

/**
 * Open ONE product's detail page and read the record it publishes.
 *
 * The search page only says a product exists; the detail page is the source of
 * truth for that product. Everything taken from here belongs to this page's
 * product: its JSON-LD, its own gallery, and the attributes it prints.
 */
async function openProductPage(
  url: string,
): Promise<{
  url: string;
  product: OfficialProduct | null;
  images: ProductRecordImages["images"];
  attributes: PageAttributes;
} | null> {
  const html = await getText(url, "text/html", SITE_TIMEOUT_MS);
  if (!html) return null;
  const product = parseJsonLdProduct(html);
  const images = [...(product?.images ?? []), ...pageImages(html, url)];
  return {
    url,
    product,
    images: uniqueByUrl(images),
    attributes: pageAttributes(html),
  };
}

function uniqueByUrl(
  images: ProductRecordImages["images"],
): ProductRecordImages["images"] {
  const seen = new Set<string>();
  const out: ProductRecordImages["images"] = [];
  for (const image of images) {
    const key = image.url.split("?")[0];
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(image);
  }
  return out;
}

/** Merge a record's own assets with what its detail page publishes. */
function imagesWithPage(
  recordImages: ProductRecordImages["images"],
  pageImagesList: ProductRecordImages["images"],
): ProductRecordImages["images"] {
  // The detail page's own gallery comes first, then the structured/API fields
  // the search record carried. Both belong to this one product, and ranking
  // still decides which of them is the front packshot.
  return uniqueByUrl([...pageImagesList, ...recordImages]);
}

// ── Multi-source cascade ──

/** What one source did, in words the admin can act on. */
export type SourceReport = {
  id: string;
  label: string;
  status: "resolved" | "no-exact-match" | "no-images" | "no-data" | "blocked" | "error" | "clinical";
  detail: string;
  /** The product this source resolved, when it resolved one. */
  productName?: string;
};

/** The accepted product record, and everything the resolver learned on the way. */
type AcceptedRecord = {
  metadata: {
    productName: string;
    brand: string | null;
    manufacturer: string | null;
    composition: string | null;
    strength: string | null;
    form: string | null;
    packSize: string | null;
    prescriptionRequired: boolean | null;
    sku: string | null;
    description: string | null;
  };
  record: ProductRecordImages;
  sourceLabel: string;
  sourceId: string;
  sourceUrl: string | null;
  productPageUrl: string | null;
  /** Kept so a drug label can only enrich the same substance. */
  catalogue: CatalogueProduct | null;
};

/** How a catalogue's HTML becomes product records. */
function recordsFromHtml(
  html: string,
  sourceLabel: string,
): { products: CatalogueProduct[]; records: Map<string, RawRecord> } {
  const products: CatalogueProduct[] = [];
  const records = new Map<string, RawRecord>();

  // 1. Embedded state (PharmEasy's __NEXT_DATA__ and friends).
  const blob = nextData(html);
  if (blob) {
    for (const record of collectRecords(blob)) {
      const product = parseCatalogueProduct(record);
      if (product) {
        products.push(product);
        records.set(product.productName, record);
      }
    }
  }
  // 2. Any other embedded JSON payload the site ships.
  for (const match of html.matchAll(
    /<script[^>]+application\/json[^>]*>([\s\S]{40,}?)<\/script>/gi,
  )) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1]);
    } catch {
      continue;
    }
    for (const record of collectRecords(parsed)) {
      const product = parseGenericProduct(record, sourceLabel);
      if (product && !products.some((p) => p.productName === product.productName)) {
        products.push(product);
        records.set(product.productName, record);
      }
    }
  }
  // 3. JSON-LD products published directly by the search page.
  const jsonLd = parseJsonLdProduct(html);
  if (jsonLd) {
    const product = genericFromJsonLd(jsonLd);
    if (product) products.push(product);
  }
  return { products, records };
}

/**
 * Read a product record from a site that publishes its products in an embedded
 * payload with its own field names. Every field is optional and only ever taken
 * when the record states it.
 */
export function parseGenericProduct(
  record: RawRecord,
  sourceLabel: string,
): CatalogueProduct | null {
  const name = asString(record.name) ?? asString(record.title) ?? asString(record.productName);
  if (!name) return null;
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = single(record[key]) ?? asString(record[key]);
      if (value) return value;
    }
    return undefined;
  };
  const compositionParts = Array.isArray(record.compositions)
    ? record.compositions
        .map((entry) =>
          typeof entry === "object" && entry !== null
            ? asString((entry as RawRecord).name)
            : asString(entry),
        )
        .filter((value): value is string => !!value)
    : [];
  const composition = clean(
    compositionParts.join(" + ") ||
      pick("composition", "ingredients", "ingredient", "moleculeName", "genericName", "salt"),
  );
  const packSize = clean(
    mergeDistinct([
      pick("packSize", "measurementUnit", "subtitleText", "shortSubtitleText", "netQuantity"),
      asString(record.size),
    ]),
  );
  const form = dosageFormFrom(
    [name, packSize ?? "", pick("form", "dosageForm", "packform") ?? ""].filter(Boolean).join(" "),
  );
  const rx = record.isRxRequired ?? record.prescriptionRequired ?? record.rxRequired;
  const prescriptionRequired =
    rx === 1 || rx === "1" || rx === true
      ? true
      : rx === 0 || rx === "0" || rx === false
        ? false
        : null;
  return {
    productName: name,
    brand: readable(pick("consumerBrandName", "brand", "brandName")),
    manufacturer: readable(pick("manufacturer", "manufacturedBy", "company", "marketedBy")),
    composition,
    strength: strengthFrom(name) ?? (composition ? strengthFrom(composition) : null),
    form,
    packSize,
    prescriptionRequired,
    sku: pick("sku", "productCode", "itemCode", "productId", "id") ?? null,
    slug: asString(record.slug) ?? null,
    source: sourceLabel,
    sourceUrl: asString(record.url) ?? asString(record.deeplink) ?? null,
  };
}

/** The same, for a JSON-LD product the page published. */
function genericFromJsonLd(product: OfficialProduct): CatalogueProduct | null {
  return {
    productName: product.productName,
    brand: product.brand,
    manufacturer: product.manufacturer,
    composition: null,
    strength: strengthFrom(product.productName),
    form: dosageFormFrom(product.productName),
    packSize: null,
    prescriptionRequired: null,
    sku: null,
    slug: null,
    source: product.source,
    sourceUrl: product.sourceUrl,
  };
}

/**
 * Walk every configured source until one returns the exact product.
 *
 * Rules that hold for the whole cascade:
 *   - A source that could not answer (blocked, browser-rendered, empty) is
 *     reported and stepped over. It is never treated as "no such product".
 *   - A source that answered but offered only near-matches is reported as
 *     "no exact match", and the next source is asked.
 *   - The FIRST source that returns the exact record wins, and its metadata and
 *     its images come from that one record. Later sources are only asked again
 *     for images of the same product, and only when the accepted record
 *     published none of its own.
 */
async function runCascade(
  identity: ProductIdentity,
  notes: string[],
): Promise<{ accepted: AcceptedRecord | null; sources: SourceReport[] }> {
  const sources: SourceReport[] = [];
  const queries = searchVariants(identity).slice(0, MAX_QUERIES_PER_SOURCE);
  let accepted: AcceptedRecord | null = null;

  // Ask one catalogue. Returns the exact record it found, if any.
  const askCatalogue = async (
    source: (typeof CATALOGUE_SOURCES)[number],
    firstHtml: string | null,
  ): Promise<{ accepted: AcceptedRecord | null; status: SourceReport["status"]; detail: string }> => {
    const label = source.label;
    let sawRecords = 0;
    const rejected: string[] = [];
    for (const [index, query] of queries.entries()) {
      // The first response is the one already fetched for the probe; a second
      // spelling of the name is only tried when the first had no exact record.
      const html = index === 0 ? firstHtml : (await probeCatalogueSource(source, query)).html;
      if (!html) continue;
      const { products, records } = recordsFromHtml(html, label);
      if (products.length === 0) continue;
      sawRecords += products.length;

      for (const product of products) {
        if (!catalogueProductMatchesIdentity(product, identity)) {
          if (rejected.length < 3 && !rejected.includes(product.productName)) {
            rejected.push(product.productName);
          }
          continue;
        }
        const raw = records.get(product.productName) ?? null;
        const recordImages = raw ? imagesOf(raw) : [];
        // The record's own page, when the catalogue publishes one, is the
        // source of truth for that product: its gallery leads, and whatever
        // attributes it prints fill the fields the record left empty.
        const pageUrl = productPageUrl(label, product, raw);
        let page: Awaited<ReturnType<typeof openProductPage>> = null;
        if (pageUrl) page = await openProductPage(pageUrl);
        const images = imagesWithPage(recordImages, page?.images ?? []);
        return {
          accepted: {
            metadata: {
              productName: product.productName,
              brand: product.brand,
              manufacturer:
                product.manufacturer ?? page?.attributes.manufacturer ?? null,
              composition: product.composition ?? page?.attributes.composition ?? null,
              strength: product.strength ?? page?.attributes.strength ?? null,
              form: product.form ?? page?.attributes.form ?? null,
              packSize: product.packSize ?? page?.attributes.packSize ?? null,
              prescriptionRequired: product.prescriptionRequired,
              sku: product.sku ?? page?.attributes.sku ?? null,
              description: page?.product?.description ?? null,
            },
            record: {
              name: product.productName,
              source: label,
              sourceUrl: product.sourceUrl,
              pageUrl: pageUrl ?? undefined,
              manufacturer: product.manufacturer,
              packText: product.packSize,
              images,
            },
            sourceLabel: label,
            sourceId: source.id,
            sourceUrl: product.sourceUrl,
            productPageUrl: pageUrl,
            catalogue: product,
          },
          status: images.length > 0 ? "resolved" : "no-images",
          detail:
            images.length > 0
              ? "exact product record with its own images"
              : "exact product record, but it published no images",
        };
      }
    }
    if (sawRecords === 0) {
      return {
        accepted: null,
        status: "no-data",
        detail: "the source returned no product records for this name",
      };
    }
    return {
      accepted: null,
      status: "no-exact-match",
      detail: `${sawRecords} product record(s) returned, none of them this exact product (e.g. ${rejected.join(", ") || "other variants"})`,
    };
  };

  for (const source of CATALOGUE_SOURCES) {
    if (accepted) break;
    const probe = await probeCatalogueSource(source, queries[0] ?? identity.productName);
    if (probe.status !== "ok") {
      sources.push({
        id: source.id,
        label: source.label,
        status: probe.status,
        detail: probe.detail,
      });
      continue;
    }
    const result = await askCatalogue(source, probe.html);
    sources.push({
      id: source.id,
      label: source.label,
      status: result.status,
      detail: result.detail,
      productName: result.accepted?.metadata.productName,
    });
    if (result.accepted) {
      accepted = result.accepted;
      if (result.status === "no-images") {
        notes.push(
          `${source.label} resolved the exact product but published no images; later sources are asked for this product's own views`,
        );
      }
    }
  }

  // The brand's own product page: the last structured source, and the one that
  // publishes a gallery for products no pharmacy lists.
  if (!accepted) {
    const official = await resolveFromOfficialSite(identity, notes);
    if (official) {
      const images = uniqueByUrl(official.images);
      accepted = {
        metadata: {
          productName: official.productName,
          brand: official.brand,
          manufacturer: official.manufacturer,
          composition: null,
          strength: strengthFrom(official.productName),
          form: dosageFormFrom(official.productName),
          packSize: null,
          prescriptionRequired: null,
          sku: null,
          description: official.description,
        },
        record: {
          name: official.productName,
          source: official.source,
          sourceUrl: official.sourceUrl,
          pageUrl: official.sourceUrl ?? undefined,
          manufacturer: official.manufacturer,
          images,
        },
        sourceLabel: OFFICIAL_SOURCE.label,
        sourceId: "official",
        sourceUrl: official.sourceUrl,
        productPageUrl: official.sourceUrl,
        catalogue: null,
      };
      sources.push({
        id: "official",
        label: OFFICIAL_SOURCE.label,
        status: images.length > 0 ? "resolved" : "no-images",
        detail:
          images.length > 0
            ? "exact product page with its own gallery"
            : "exact product page, but it published no images",
        productName: official.productName,
      });
    } else {
      sources.push({
        id: "official",
        label: OFFICIAL_SOURCE.label,
        status: "no-exact-match",
        detail: "no product page on the brand's own site matched this name",
      });
    }
  }

  return { accepted, sources };
}

/** The detail page of a catalogue record, when the catalogue publishes one. */
function productPageUrl(
  label: string,
  product: CatalogueProduct,
  raw: RawRecord | null,
): string | null {
  if (label !== SOURCE_LABELS.pharmeasy) return product.sourceUrl;
  // PharmEasy detail pages are not served to a server-side request; its search
  // record's own DAM assets are the product's images instead, and asking for the
  // page would only cost a request.
  void raw;
  return null;
}

// ── Orchestration ──

/**
 * Resolve the exact product behind a typed name.
 *
 * Returns `matched: false` with every field null only after every configured
 * source has been asked; `notes` then records what was attempted, so the admin
 * is told the sources were checked rather than that a name was "not found".
 */
export async function resolveProductMetadata(
  identity: ProductIdentity,
  options?: {
    /**
     * Whether the openFDA label lookup runs. It only fills clinical copy, so a
     * caller that already has verified copy (a curated reference record) skips
     * it and spends its requests on identifying the product instead.
     */
    includeLabels?: boolean,
  },
): Promise<ResolvedProductMetadata> {
  const notes: string[] = [];
  const result: ResolvedProductMetadata = { ...EMPTY, notes };
  const name = identity.productName.trim();
  if (!name) return result;

  // ── The cascade: every configured source, in priority order ──
  const { accepted, sources } = await runCascade(identity, notes);
  result.sources = sources;

  if (accepted) {
    result.matched = true;
    result.productName = accepted.metadata.productName;
    result.brand = accepted.metadata.brand;
    result.manufacturer = accepted.metadata.manufacturer;
    result.composition = accepted.metadata.composition;
    result.strength = accepted.metadata.strength;
    result.form = accepted.metadata.form;
    result.packSize = accepted.metadata.packSize;
    result.prescriptionRequired = accepted.metadata.prescriptionRequired;
    result.sku = accepted.metadata.sku;
    result.description = accepted.metadata.description;
    result.source = accepted.sourceLabel;
    result.sourceUrl = accepted.productPageUrl ?? accepted.sourceUrl;
    // The accepted record and the images that belong to it travel together, so
    // the Auto Fill never looks the product up a second time for a photo.
    result.record = accepted.record;

    // Structured label data fills the clinical copy the catalogue does not
    // publish. It only enriches: openFDA is never the identity source for an
    // Indian product, and a label for another substance is refused.
    const label =
      options?.includeLabels === false
        ? null
        : await resolveFromLabels(identity, accepted.catalogue, notes);
    if (label) {
      result.benefits = label.benefits;
      result.directions = label.directions;
      result.safety = label.safety;
      result.storage = label.storage;
      result.composition = result.composition ?? label.composition;
      result.strength = result.strength ?? label.strength;
      result.form = result.form ?? label.form;
      result.source = `${accepted.sourceLabel} + ${label.source}`;
      result.sources.push({
        id: "openfda",
        label: "openFDA drug labels",
        status: "clinical",
        detail: "clinical copy (benefits, directions, safety, storage) only",
        productName: label.productName,
      });
    }
    return result;
  }

  // Every catalogue and the brand's own site were asked and none returned this
  // exact product. A drug label can still describe it — as clinical copy for an
  // identity nothing else claimed — but it can never stand in for an Indian
  // product record, because a foreign label may be a different market pack.
  const labelOnly =
    options?.includeLabels === false
      ? null
      : await resolveFromLabels(identity, null, notes);
  if (labelOnly) {
    result.matched = true;
    result.productName = labelOnly.productName;
    result.brand = labelOnly.brand;
    result.manufacturer = labelOnly.manufacturer;
    result.composition = labelOnly.composition;
    result.strength = labelOnly.strength;
    result.form = labelOnly.form;
    result.benefits = labelOnly.benefits;
    result.directions = labelOnly.directions;
    result.safety = labelOnly.safety;
    result.storage = labelOnly.storage;
    result.source = labelOnly.source;
    result.sourceUrl = labelOnly.sourceUrl;
    result.sources.push({
      id: "openfda",
      label: "openFDA drug labels",
      status: "clinical",
      detail: "no catalogue record; clinical copy only, no product images",
      productName: labelOnly.productName,
    });
    return result;
  }

  notes.push(
    `no source returned an exact record for "${name}" (checked ${sources.map((s) => s.label).join(", ")})`,
  );
  return result;
}

async function resolveFromOfficialSite(
  identity: ProductIdentity,
  notes: string[],
): Promise<OfficialProduct | null> {
  const brand = identity.brand?.trim() || words(identity.productName)[0] || "";
  if (!brand) return null;
  const origin = await officialSite(brand);
  if (!origin) return null;

  const identityWords = identityWordsOf(identity);
  const query = identity.productName.trim();
  for (const pattern of SITE_SEARCH_PATTERNS) {
    const html = await getText(
      `${origin}${pattern.replace("{q}", encodeURIComponent(query))}`,
      "text/html",
      SITE_TIMEOUT_MS,
    );
    if (!html) continue;
    const links = productLinks(html, origin, identityWords).slice(0, 2);
    for (const link of links) {
      const page = await getText(link, "text/html", SITE_TIMEOUT_MS);
      if (!page) continue;
      const product = parseJsonLdProduct(page);
      if (!product) continue;
      product.sourceUrl = link;
      // The page's own gallery travels with the record: those are the brand's
      // assets for this exact product, not pictures found by searching.
      const pageAssets = pageImages(page, link);
      if (pageAssets.length > 0) {
        const seen = new Set(product.images.map((image) => image.url.split("?")[0]));
        for (const asset of pageAssets) {
          if (seen.has(asset.url.split("?")[0])) continue;
          seen.add(asset.url.split("?")[0]);
          product.images.push(asset);
        }
      }
      if (officialProductMatchesIdentity(product, identity)) return product;
      notes.push(`rejected own-site page: ${product.productName}`);
    }
  }
  return null;
}

async function resolveFromLabels(
  identity: ProductIdentity,
  catalogue: CatalogueProduct | null,
  notes: string[],
): Promise<LabelProduct | null> {
  const term = (identity.brand?.trim() || words(identity.productName)[0] || "").toLowerCase();
  if (!term || term.length < 3) return null;

  const search = async (field: string) => {
    const url = `https://api.fda.gov/drug/label.json?search=${field}:%22${encodeURIComponent(
      term,
    )}%22&limit=3`;
    const data = (await getJson(url)) as { results?: unknown } | null;
    return Array.isArray(data?.results) ? (data!.results as RawRecord[]) : [];
  };

  let labels = await search("openfda.brand_name");
  if (labels.length === 0) labels = await search("openfda.generic_name");
  if (labels.length === 0) return null;

  for (const label of labels) {
    const product = parseLabelProduct(label);
    if (!product) continue;
    if (!labelProductMatchesIdentity(product, identity)) {
      notes.push(`rejected drug label: ${product.productName}`);
      continue;
    }
    // A label enriches a catalogue product only when it describes the same
    // substance; otherwise the catalogue record stands on its own.
    if (
      catalogue &&
      product.composition &&
      catalogue.composition &&
      !sharesSubstance(product.composition, catalogue.composition)
    ) {
      notes.push("drug label describes a different substance; not used");
      continue;
    }
    return product;
  }
  return null;
}

/**
 * Resolve product metadata for a typed name. Public so the admin Auto Fill and
 * its tests can exercise the real lookup, exactly as the enrichment action does.
 */
export const lookupProductMetadata = action({
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
  handler: async (_ctx, args) => resolveProductMetadata(args),
});

/** Do two composition strings describe at least one common substance? */
function sharesSubstance(left: string, right: string): boolean {
  const substances = (text: string) =>
    new Set(
      text
        .split(/[+,;/()]|\band\b/i)
        .map((part) =>
          part
            .replace(/\([^)]*\)/g, "")
            .replace(/\d+(\.\d+)?\s*(mg|mcg|iu|%)?/gi, "")
            .trim()
            .toLowerCase(),
        )
        .filter((part) => part.length > 3),
    );
  const a = substances(left);
  for (const part of substances(right)) {
    if (a.has(part)) return true;
  }
  return false;
}
