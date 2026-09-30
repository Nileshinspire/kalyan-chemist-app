/**
 * The verified product record cache used by the Admin Auto Fill.
 *
 * Resolving a product means asking several pharmacy catalogues and the brand's
 * own site. Doing that again for every product, every time Auto Fill is pressed,
 * is slow for the admin and rude to those sites — and it is also pointless: once
 * a product has been verified, the answer is the same.
 *
 * So the exact record that was verified is written here, keyed by the identity
 * the admin typed plus the variant signals (strength, pack), which is what keeps
 * "Dolo 650" and "Dolo 500" in separate rows. A later Auto Fill for the same
 * product reads the verified record and asks no catalogue anything at all.
 *
 * Only verified data is stored: a row exists because a source published that
 * record, and the image URLs it holds are that record's own assets, not the
 * images of some other product. A row is refreshed when the record has no images
 * to store, or when the identity it was verified for no longer matches.
 */
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { words, type ProductIdentity } from "./productImageResolver";

/** How long a verified record is trusted before the catalogues are asked again. */
export const CATALOG_RECORD_TTL_MS = 30 * 24 * 60 * 60_000;

/** The verified record, in the shape the resolver and the image step consume. */
export type CachedCatalogRecord = {
  cacheKey: string;
  enteredName: string;
  resolvedName: string;
  brand: string | null;
  manufacturer: string | null;
  composition: string | null;
  strength: string | null;
  form: string | null;
  packSize: string | null;
  prescriptionRequired: boolean | null;
  sku: string | null;
  source: string;
  sourceUrl: string | null;
  productPageUrl: string | null;
  /** The record's own image assets, in the record's own order. */
  recordImages: string[];
  packText: string | null;
  recordManufacturer: string | null;
  checkedAt: number;
  updatedAt: number;
};

/**
 * The identity key a record is cached under.
 *
 * Case, punctuation and word order are normalised away, because "Dolo-650" and
 * "dolo 650" are the same product and should not be resolved twice. The
 * strength and pack stay in the key, because those are what make a product a
 * DIFFERENT product: 500 and 650, a 10-strip and a 15-strip, never share a row.
 */
/**
 * The dose a product name states, so "Dolo 650", "dolo-650" and "DOLO 650" all
 * key identically even when the caller passes no strength field. Only a dose in
 * the name counts: a pack count ("strip of 15") is a pack, not a strength.
 */
function statedDose(nameWords: string[]): string | null {
  for (const word of nameWords) {
    const withUnit = word.match(/^(\d{2,4}(?:\.\d+)?)(mg|mcg|iu|%)$/);
    if (withUnit) return `${withUnit[1]}${withUnit[2]}`;
    if (/^\d{2,4}$/.test(word)) return `${word}mg`;
  }
  return null;
}

export function catalogRecordKey(identity: ProductIdentity): string {
  const nameWords = words(identity.productName);
  const name = nameWords.join(" ");
  const stated = (identity.strength ?? "").toLowerCase().replace(/[^0-9a-z.]+/g, "");
  const strength = stated || statedDose(nameWords) || "";
  const pack = (identity.packSize ?? "").toLowerCase().replace(/[^0-9a-z]+/g, "");
  const form = (identity.form ?? "").toLowerCase().replace(/[^a-z]+/g, "");
  return [name, strength, pack, form].filter(Boolean).join("|");
}

/**
 * A record is only used when it is still verified for THIS identity: same
 * product name, no contradicting strength, and — the important one — actual
 * image assets to store, because a record with no images is not worth reusing.
 */
/**
 * Form words a product name can state. Used only to decide whether a cached
 * record is still complete: a record with no form, for a product whose own name
 * says "tablet" or "gel" or "cleanser", is missing something the resolver
 * would have filled, so it is refreshed instead of being re-used.
 */
const STATED_FORM_WORDS = new Set([
  "tablet", "tablets", "tab", "capsule", "capsules", "caplet", "caplets",
  "syrup", "suspension", "sachet", "sachets", "granules", "powder",
  "inhaler", "respules", "injection", "cream", "gel", "ointment", "balm",
  "lotion", "spray", "drops", "drop", "oil", "cleanser", "cleansers",
  "soap", "shampoo", "serum", "sunscreen", "toothpaste", "wipes", "diaper",
  "kit", "kits", "device", "devices", "bandage", "mask", "gloves",
]);

/** Does this name state a dosage form of its own? */
function nameStatesForm(name: string): boolean {
  return words(name).some((word) => STATED_FORM_WORDS.has(word));
}

export function isUsableCachedRecord(
  record: CachedCatalogRecord | null,
  identity: ProductIdentity,
  now: number = Date.now(),
): record is CachedCatalogRecord {
  if (!record) return false;
  if (now - record.updatedAt > CATALOG_RECORD_TTL_MS) return false;
  if (words(record.enteredName).join(" ") !== words(identity.productName).join(" ")) {
    return false;
  }
  if (identity.strength) {
    const wanted = words(identity.strength).join(" ");
    const resolved = words(record.strength ?? "").join(" ");
    if (resolved && wanted && wanted !== resolved) return false;
  }
  if (!record.form && nameStatesForm(record.enteredName)) return false;
  return (record.recordImages?.length ?? 0) > 0;
}

export const getCatalogRecord = internalQuery({
  args: { cacheKey: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("productCatalogRecords")
      .withIndex("by_cacheKey", (q) => q.eq("cacheKey", args.cacheKey))
      .first();
    if (!row) return null;
    return {
      cacheKey: row.cacheKey,
      enteredName: row.enteredName,
      resolvedName: row.resolvedName,
      brand: row.brand ?? null,
      manufacturer: row.manufacturer ?? null,
      composition: row.composition ?? null,
      strength: row.strength ?? null,
      form: row.form ?? null,
      packSize: row.packSize ?? null,
      prescriptionRequired: row.prescriptionRequired ?? null,
      sku: row.sku ?? null,
      source: row.source,
      sourceUrl: row.sourceUrl ?? null,
      productPageUrl: row.productPageUrl ?? null,
      recordImages: row.recordImages ?? [],
      packText: row.packText ?? null,
      recordManufacturer: row.recordManufacturer ?? null,
      checkedAt: row.checkedAt,
      updatedAt: row.updatedAt,
    } satisfies CachedCatalogRecord;
  },
});

/** Remember a verified record so this product is never resolved twice. */
export const saveCatalogRecord = internalMutation({
  args: {
    cacheKey: v.string(),
    enteredName: v.string(),
    resolvedName: v.string(),
    brand: v.optional(v.string()),
    manufacturer: v.optional(v.string()),
    composition: v.optional(v.string()),
    strength: v.optional(v.string()),
    form: v.optional(v.string()),
    packSize: v.optional(v.string()),
    prescriptionRequired: v.optional(v.boolean()),
    sku: v.optional(v.string()),
    source: v.string(),
    sourceUrl: v.optional(v.string()),
    productPageUrl: v.optional(v.string()),
    recordImages: v.optional(v.array(v.string())),
    packText: v.optional(v.string()),
    recordManufacturer: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("productCatalogRecords")
      .withIndex("by_cacheKey", (q) => q.eq("cacheKey", args.cacheKey))
      .first();
    const fields = { ...args, checkedAt: now, updatedAt: now };
    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("productCatalogRecords", fields);
  },
});
