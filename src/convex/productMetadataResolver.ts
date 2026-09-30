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
  searchVariants,
  getText,
  getJson,
  officialSite,
  productLinks,
  identityWordsOf,
  productNameMatchesIdentity,
  makerIsBrandLabel,
  catalogueSearchRecords,
  imagesOf,
  jsonLdImages,
  sameMaker,
  MAX_QUERIES_PER_SOURCE,
  SITE_SEARCH_PATTERNS,
  SITE_TIMEOUT_MS,
  PHARMEASY_SEARCH,
  type ProductIdentity,
  type ProductRecordImages,
  type RawRecord,
} from "./productImageResolver";

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
  notes: [],
};

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

  // ── 1. The brand's own product page ──
  const official = await resolveFromOfficialSite(identity, notes);
  if (official) {
    result.matched = true;
    result.productName = official.productName;
    result.brand = official.brand;
    result.manufacturer = official.manufacturer;
    result.description = official.description;
    result.source = official.source;
    result.sourceUrl = official.sourceUrl;
    // The matched record and the images that belong to it travel together, so
    // the Auto Fill never has to look the product up a second time for a photo.
    result.record = {
      name: official.productName,
      source: official.source,
      sourceUrl: official.sourceUrl,
      pageUrl: official.sourceUrl ?? undefined,
      manufacturer: official.manufacturer,
      images: official.images,
    };
    return result;
  }

  // ── 2. The licensed pharmacy catalogue ──
  const found = await resolveFromCatalogue(identity, notes);
  const catalogue = found?.product ?? null;
  if (catalogue && found) {
    result.matched = true;
    result.productName = catalogue.productName;
    result.brand = catalogue.brand;
    result.manufacturer = catalogue.manufacturer;
    result.composition = catalogue.composition;
    result.strength = catalogue.strength;
    result.form = catalogue.form;
    result.packSize = catalogue.packSize;
    result.prescriptionRequired = catalogue.prescriptionRequired;
    result.source = catalogue.source;
    result.sourceUrl = catalogue.sourceUrl;
    // The catalogue record IS the product record: its own DAM/image fields are
    // the assets stored for this product.
    result.record = {
      name: catalogue.productName,
      source: catalogue.source,
      sourceUrl: catalogue.sourceUrl,
      pageUrl: catalogue.sourceUrl ?? undefined,
      manufacturer: catalogue.manufacturer,
      packText: catalogue.packSize,
      images: imagesOf(found.record),
    };

    // ── 3. Structured label data, to fill the clinical copy the catalogue
    //       does not publish. Only for the same substance / strength / form. ──
    const label =
      options?.includeLabels === false
        ? null
        : await resolveFromLabels(identity, catalogue, notes);
    if (label) {
      result.benefits = label.benefits;
      result.directions = label.directions;
      result.safety = label.safety;
      result.storage = label.storage;
      result.composition = result.composition ?? label.composition;
      result.strength = result.strength ?? label.strength;
      result.form = result.form ?? label.form;
      result.source = `${catalogue.source} + ${label.source}`;
    }
    return result;
  }

  // ── 3. Structured drug labels as the identity source ──
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
    return result;
  }

  notes.push("no source returned a record for this exact product");
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
      if (officialProductMatchesIdentity(product, identity)) return product;
      notes.push(`rejected own-site page: ${product.productName}`);
    }
  }
  return null;
}

async function resolveFromCatalogue(
  identity: ProductIdentity,
  notes: string[],
): Promise<{ product: CatalogueProduct; record: RawRecord } | null> {
  const queries = searchVariants(identity).slice(0, MAX_QUERIES_PER_SOURCE);
  let asked = 0;
  for (const query of queries) {
    // The catalogue answer is cached per query, so the image pass that follows
    // reads the same records instead of asking the catalogue all over again.
    const records = await catalogueSearchRecords(query);
    if (records.length === 0) continue;
    asked += 1;

    let rejected = 0;
    for (const record of records) {
      const product = parseCatalogueProduct(record);
      if (product && catalogueProductMatchesIdentity(product, identity)) {
        return { product, record };
      }
      rejected += 1;
      if (rejected >= 3) break;
    }
    if (rejected > 0) {
      notes.push(`catalogue: rejected ${rejected} near-match record(s) for "${query}"`);
    }
  }
  if (asked === 0) notes.push("catalogue: no results returned");
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
