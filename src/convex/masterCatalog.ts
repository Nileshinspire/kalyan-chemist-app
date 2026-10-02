/**
 * Master Product Catalog — the verified product layer behind Admin Auto Fill.
 *
 * The admin imports a licensed dataset (CSV/XLSX + optional image ZIP) or
 * configures a licensed provider API; every row lands here as one exact
 * product variant. Auto Fill then answers from THIS table only:
 *
 *   product name → indexed catalog search → exact variant → that record's
 *   metadata + that record's stored images → the existing Auto Fill form.
 *
 * There is no independent image search anywhere in this flow: an image can
 * only reach the form through the record it was imported with. When the
 * catalog has no record for the exact name, the admin gets the honest
 * not-found message and keeps manual entry — nothing is ever guessed,
 * substituted or hotlinked.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { ActionCtx, DatabaseReader, Doc, MutationCtx } from "./_generated/server";
import type { DatabaseWriter } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  CATALOG_IMAGE_NOT_FOUND_MESSAGE,
  CATALOG_PRODUCT_NOT_FOUND_MESSAGE,
  MAX_CATALOG_IMAGES,
  assessCatalogMatch,
  identityKeyOf,
  normalizeName,
  orderCatalogImages,
  shortHash,
  slugify,
  statedForm,
  statedStrength,
  verificationStatusFor,
  type CatalogSeedRecord,
  type IdentityInput,
  type MatchVerdict,
} from "./masterCatalogCore";
import {
  PROVIDER_NOT_CONFIGURED_MESSAGE,
  createProductDataProvider,
  type ProviderProductRecord,
} from "./productDataProvider";

// ── Shared types & validators ──

const statusValidator = v.union(
  v.literal("VERIFIED"),
  v.literal("NEEDS_REVIEW"),
  v.literal("NEEDS_IMAGE"),
);

const verdictValidator = v.union(v.literal("exact"), v.literal("related"));

const suggestionValidator = v.object({
  catalogProductId: v.string(),
  name: v.string(),
  brand: v.union(v.string(), v.null()),
  manufacturer: v.union(v.string(), v.null()),
  strength: v.union(v.string(), v.null()),
  form: v.union(v.string(), v.null()),
  packSize: v.union(v.string(), v.null()),
  verificationStatus: statusValidator,
  hasImage: v.boolean(),
  verdict: verdictValidator,
  reason: v.string(),
});
type Suggestion = {
  catalogProductId: string;
  name: string;
  brand: string | null;
  manufacturer: string | null;
  strength: string | null;
  form: string | null;
  packSize: string | null;
  verificationStatus: "VERIFIED" | "NEEDS_REVIEW" | "NEEDS_IMAGE";
  hasImage: boolean;
  verdict: "exact" | "related";
  reason: string;
};

type SourceReport = {
  id: string;
  label: string;
  status: string;
  detail: string;
};

/** The identity hints the admin already typed into the form. */
const identityHintsValidator = v.optional(
  v.object({
    manufacturer: v.optional(v.string()),
    brand: v.optional(v.string()),
    composition: v.optional(v.string()),
    form: v.optional(v.string()),
    strength: v.optional(v.string()),
    packSize: v.optional(v.string()),
    sku: v.optional(v.string()),
  }),
);
type IdentityHints = {
  manufacturer?: string;
  brand?: string;
  composition?: string;
  form?: string;
  strength?: string;
  packSize?: string;
  sku?: string;
};

/** Table-shaped seed, validated on the way in. */
const seedRecordValidator = v.object({
  catalogProductId: v.string(),
  canonicalProductName: v.string(),
  normalizedName: v.string(),
  identityKey: v.string(),
  brand: v.optional(v.string()),
  manufacturer: v.optional(v.string()),
  composition: v.optional(v.string()),
  normalizedComposition: v.optional(v.string()),
  strength: v.optional(v.string()),
  dosageForm: v.optional(v.string()),
  packSize: v.optional(v.string()),
  sku: v.optional(v.string()),
  gtin: v.optional(v.string()),
  category: v.optional(v.string()),
  prescriptionRequired: v.optional(v.boolean()),
  description: v.optional(v.string()),
  benefits: v.optional(v.string()),
  directions: v.optional(v.string()),
  safety: v.optional(v.string()),
  storage: v.optional(v.string()),
  mrp: v.optional(v.number()),
  sourceProductId: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
  verificationStatus: statusValidator,
});

type CatalogRow = Doc<"masterCatalog">;

/** Only exact/related survive the matcher, so rejects never reach a hit. */
type SearchHit = {
  row: CatalogRow;
  verdict: Exclude<MatchVerdict, "reject">;
  reason: string;
};

// ── Auth helpers ──

type AdminCheckCtx = {
  db: DatabaseReader;
  auth: MutationCtx["auth"];
};

async function requireAdmin(ctx: AdminCheckCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (user?.role !== "admin") throw new Error("Not authorized");
  return userId;
}

async function requireAdminAction(ctx: ActionCtx) {
  const isAdmin = await ctx.runQuery(internal.adminProducts.isAdminUser, {});
  if (!isAdmin) throw new Error("Not authorized");
}

// ── Row helpers ──

const CATALOG_SOURCE_RESOLVED: SourceReport = {
  id: "master-catalog",
  label: "Master product catalog",
  status: "resolved",
  detail: "exact record found in the imported licensed catalog",
};

function catalogMissSource(detail: string): SourceReport {
  return { ...CATALOG_SOURCE_RESOLVED, status: "no-exact-match", detail };
}

function providerSource(status: string, detail: string): SourceReport {
  return {
    id: "licensed-provider",
    label: "Licensed product provider API",
    status,
    detail,
  };
}

function rowIdentity(row: CatalogRow): IdentityInput {
  return {
    name: row.canonicalProductName,
    strength: row.strength ?? null,
    form: row.dosageForm ?? null,
    packSize: row.packSize ?? null,
    manufacturer: row.manufacturer ?? null,
    brand: row.brand ?? null,
  };
}

async function findByCatalogProductId(
  db: DatabaseReader,
  catalogProductId: string,
): Promise<CatalogRow | null> {
  return await db
    .query("masterCatalog")
    .withIndex("by_catalogProductId", (q) =>
      q.eq("catalogProductId", catalogProductId),
    )
    .first();
}

function toSuggestion(hit: SearchHit): Suggestion {
  const row = hit.row;
  return {
    catalogProductId: row.catalogProductId,
    name: row.canonicalProductName,
    brand: row.brand ?? null,
    manufacturer: row.manufacturer ?? null,
    strength: row.strength ?? statedStrength(row.canonicalProductName),
    form: row.dosageForm ?? statedForm(row.canonicalProductName),
    packSize: row.packSize ?? null,
    verificationStatus: row.verificationStatus,
    hasImage: Boolean(row.primaryImage),
    verdict: hit.verdict,
    reason: hit.reason,
  };
}

function toFillRecord(row: CatalogRow) {
  return {
    catalogProductId: row.catalogProductId,
    canonicalProductName: row.canonicalProductName,
    brand: row.brand ?? null,
    manufacturer: row.manufacturer ?? null,
    composition: row.composition ?? null,
    strength: row.strength ?? statedStrength(row.canonicalProductName),
    form: row.dosageForm ?? statedForm(row.canonicalProductName),
    packSize: row.packSize ?? null,
    sku: row.sku ?? null,
    mrp: row.mrp ?? null,
    category: row.category ?? null,
    prescriptionRequired: row.prescriptionRequired ?? null,
    description: row.description ?? null,
    benefits: row.benefits ?? null,
    directions: row.directions ?? null,
    safety: row.safety ?? null,
    storage: row.storage ?? null,
    verificationStatus: row.verificationStatus,
    sourceUrl: row.sourceUrl ?? null,
    sourceProductId: row.sourceProductId ?? null,
    imageSource: row.imageSource ?? null,
    imageUrlSource: row.imageProvenance?.originalUrl ?? null,
    hasImage: Boolean(row.primaryImage),
    imageUrl: row.primaryImage ?? null,
    additionalImages: row.additionalImages ?? [],
  };
}

// ── Indexed catalog search ──

/**
 * Find catalog rows the query could refer to, using only indexed lookups:
 * stable codes (GTIN/SKU) first, then a prefix scan over the folded name,
 * then — when the typed text is thin — prefix scans over its individual
 * words (which is what tolerates harmless word order), and finally a
 * composition/salt prefix scan when the name found nothing. The full table
 * is never scanned; every candidate that comes back is then put through the
 * strict matcher, which decides exact vs related vs reject.
 */
async function searchCatalog(
  db: DatabaseReader,
  rawQuery: string,
  hints: {
    manufacturer?: string | null;
    brand?: string | null;
    form?: string | null;
    strength?: string | null;
    packSize?: string | null;
  },
  take: number,
  partial: boolean,
): Promise<SearchHit[]> {
  const folded = normalizeName(rawQuery);
  if (!folded) return [];

  const rows = new Map<string, CatalogRow>();
  const collect = (iter: Iterable<CatalogRow>) => {
    for (const row of iter) {
      if (rows.size >= 240) return;
      rows.set(row._id, row);
    }
  };

  // 1. Exact stable-code lookups (an indexed equality, never a scan).
  const code = rawQuery.trim();
  if (/^[0-9A-Za-z-]{4,}$/.test(code)) {
    const gtin = code.replace(/[^0-9A-Za-z]/g, "");
    collect(
      await db
        .query("masterCatalog")
        .withIndex("by_gtin", (q) => q.eq("gtin", gtin))
        .take(8),
    );
    collect(
      await db
        .query("masterCatalog")
        .withIndex("by_sku", (q) => q.eq("sku", code))
        .take(8),
    );
    collect(
      await db
        .query("masterCatalog")
        .withIndex("by_sku", (q) => q.eq("sku", code.toUpperCase()))
        .take(8),
    );
  }

  // 2. Prefix scan over the folded product name.
  collect(
    await db
      .query("masterCatalog")
      .withIndex("by_normalizedName", (q) =>
        q.gte(folded).lt(`${folded}\uffff`),
      )
      .take(120),
  );

  // 3. Word-order tolerance: when the typed text itself was a thin prefix,
  //    scan its leading words (still an indexed prefix range each).
  if (rows.size < take + 4) {
    const tokens = folded.split(" ").filter((t) => t.length >= 2).slice(0, 4);
    for (const token of tokens) {
      if (token === folded) continue;
      collect(
        await db
          .query("masterCatalog")
          .withIndex("by_normalizedName", (q) =>
            q.gte(token).lt(`${token}\uffff`),
          )
          .take(60),
      );
      if (rows.size >= 120) break;
    }
  }

  // 4. Salt lookup when the name found nothing at all.
  if (rows.size === 0 && folded.length >= 3) {
    collect(
      await db
        .query("masterCatalog")
        .withIndex("by_normalizedComposition", (q) =>
          q.gte(folded).lt(`${folded}\uffff`),
        )
        .take(40),
    );
  }

  const queryIdentity: IdentityInput = {
    name: rawQuery,
    manufacturer: hints.manufacturer ?? null,
    brand: hints.brand ?? null,
    form: hints.form ?? null,
    strength: hints.strength ?? null,
    packSize: hints.packSize ?? null,
  };

  const hits: SearchHit[] = [];
  for (const row of rows.values()) {
    const assessment = assessCatalogMatch(rowIdentity(row), queryIdentity, {
      partial,
    });
    if (assessment.verdict === "reject") continue;
    hits.push({ row, verdict: assessment.verdict, reason: assessment.reason });
  }
  hits.sort((a, b) => {
    if (a.verdict !== b.verdict) return a.verdict === "exact" ? -1 : 1;
    const len =
      a.row.canonicalProductName.length - b.row.canonicalProductName.length;
    if (len !== 0) return len;
    return a.row.canonicalProductName.localeCompare(b.row.canonicalProductName);
  });
  return hits.slice(0, take);
}

// ── Upsert logic (re-import without duplicates) ──

/** Fields an incoming record may update. Absent values never clear what a
 *  previous import stored — a re-import with fewer columns loses nothing. */
const UPDATABLE_FIELDS = [
  "canonicalProductName",
  "normalizedName",
  "identityKey",
  "brand",
  "manufacturer",
  "composition",
  "normalizedComposition",
  "strength",
  "dosageForm",
  "packSize",
  "sku",
  "gtin",
  "category",
  "prescriptionRequired",
  "description",
  "benefits",
  "directions",
  "safety",
  "storage",
  "mrp",
  "sourceProductId",
  "sourceUrl",
] as const;

/**
 * Locate an existing catalog row for an incoming seed by the stable chain:
 * source Product ID → GTIN → SKU → our own catalogProductId → variant
 * identity key. The first hit wins, so a re-import updates in place and can
 * never create a duplicate — and the previous source mapping stays on the
 * row it was written to.
 */
async function findExistingRecord(
  db: DatabaseReader,
  seed: CatalogSeedRecord,
): Promise<CatalogRow | null> {
  if (seed.sourceProductId) {
    const row = await db
      .query("masterCatalog")
      .withIndex("by_sourceProductId", (q) =>
        q.eq("sourceProductId", seed.sourceProductId as string),
      )
      .first();
    if (row) return row;
  }
  if (seed.gtin) {
    const row = await db
      .query("masterCatalog")
      .withIndex("by_gtin", (q) => q.eq("gtin", seed.gtin as string))
      .first();
    if (row) return row;
  }
  if (seed.sku) {
    const row = await db
      .query("masterCatalog")
      .withIndex("by_sku", (q) => q.eq("sku", seed.sku as string))
      .first();
    if (row) return row;
  }
  const byId = await findByCatalogProductId(db, seed.catalogProductId);
  if (byId) return byId;
  return await db
    .query("masterCatalog")
    .withIndex("by_identityKey", (q) => q.eq("identityKey", seed.identityKey))
    .first();
}

/** Insert or update one catalog record; returns which happened. */
async function upsertSeed(
  db: DatabaseWriter,
  seed: CatalogSeedRecord,
  batchId: string,
  now: number,
): Promise<"created" | "updated"> {
  const existing = await findExistingRecord(db, seed);
  if (existing) {
    const patch: Partial<CatalogRow> = {};
    for (const field of UPDATABLE_FIELDS) {
      const value = seed[field];
      if (value !== undefined) {
        (patch as Record<string, unknown>)[field] = value;
      }
    }
    const merged = {
      name: seed.canonicalProductName ?? existing.canonicalProductName,
      manufacturer:
        seed.manufacturer ?? existing.manufacturer ?? null,
      composition: seed.composition ?? existing.composition ?? null,
      strength: seed.strength ?? existing.strength ?? null,
      dosageForm: seed.dosageForm ?? existing.dosageForm ?? null,
    };
    await ctx_patchRecord(db, existing._id, {
      ...patch,
      // The status always reflects the merged record AND whether a verified
      // image is stored: a re-imported row that already has its image keeps
      // VERIFIED; one still without an image stays NEEDS_IMAGE.
      verificationStatus: verificationStatusFor(
        {
          name: merged.name,
          manufacturer: merged.manufacturer,
          composition: merged.composition,
          strength: merged.strength,
          dosageForm: merged.dosageForm,
        },
        Boolean(existing.primaryImage),
      ),
      importBatchId: batchId,
      importedAt: now,
      updatedAt: now,
    });
    return "updated";
  }
  await db.insert("masterCatalog", {
    ...seed,
    verificationStatus: verificationStatusFor(
      {
        name: seed.canonicalProductName,
        manufacturer: seed.manufacturer ?? null,
        composition: seed.composition ?? null,
        strength: seed.strength ?? null,
        dosageForm: seed.dosageForm ?? null,
      },
      false,
    ),
    importBatchId: batchId,
    importedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return "created";
}

/** Thin wrapper so upsertSeed stays readable. */
async function ctx_patchRecord(
  db: DatabaseWriter,
  id: CatalogRow["_id"],
  patch: Partial<CatalogRow>,
) {
  await db.patch(id, patch);
}

// ── Image storage (licensed assets only) ──

/** Licensed packshots may be small; junk and huge payloads are refused. */
const MIN_IMPORT_IMAGE_BYTES = 300;
const MAX_IMPORT_IMAGE_BYTES = 4_000_000;

type StoredEntry = {
  /** The Convex storage URL. */
  url: string;
  /** Filename-or-URL used for front/back/side ranking. */
  label: string;
  originalUrl?: string;
  filename?: string;
};

/** Magic-byte check so a CSV error page is never stored as a packshot. */
function looksLikeImage(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true; // jpeg
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true; // png
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true; // gif
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return true; // webp
  }
  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return true; // isobmff (avif/heic)
  }
  return false;
}

function decodeBase64(value: string): Uint8Array | null {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function storeBytes(
  ctx: ActionCtx,
  bytes: Uint8Array,
  contentType: string,
): Promise<string | null> {
  if (bytes.length < MIN_IMPORT_IMAGE_BYTES) return null;
  if (bytes.length > MAX_IMPORT_IMAGE_BYTES) return null;
  if (!looksLikeImage(bytes)) return null;
  const storageId = await ctx.storage.store(
    new Blob([bytes.buffer as ArrayBuffer], {
      type: contentType.startsWith("image/") ? contentType : "image/jpeg",
    }),
  );
  return (await ctx.storage.getUrl(storageId)) ?? null;
}

async function fetchImageBytes(
  url: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "image/*,*/*" },
    });
    if (!response.ok) return null;
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { bytes, contentType };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function basenameOf(url: string): string {
  return (url.split(/[?#]/)[0].split("/").pop() ?? "").trim();
}

/** Download one licensed image URL into Convex storage (copied, never hotlinked). */
async function storeImageFromUrl(
  ctx: ActionCtx,
  url: string,
): Promise<StoredEntry | null> {
  const fetched = await fetchImageBytes(url);
  if (!fetched) return null;
  const stored = await storeBytes(ctx, fetched.bytes, fetched.contentType);
  if (!stored) return null;
  const filename = basenameOf(url);
  const entry: StoredEntry = { url: stored, label: filename || url, originalUrl: url };
  if (filename) entry.filename = filename;
  return entry;
}

/** Store one image file taken from the licensed image ZIP. */
async function storeImageFromFile(
  ctx: ActionCtx,
  filename: string,
  base64: string,
): Promise<StoredEntry | null> {
  const bytes = decodeBase64(base64);
  if (!bytes) return null;
  const lower = filename.toLowerCase();
  const type = lower.endsWith(".png")
    ? "image/png"
    : lower.endsWith(".webp")
      ? "image/webp"
      : lower.endsWith(".gif")
        ? "image/gif"
        : "image/jpeg";
  const stored = await storeBytes(ctx, bytes, type);
  if (!stored) return null;
  return { url: stored, label: filename, filename };
}

/**
 * Rank stored entries front-first, cap the gallery and attach it to its
 * catalog record — the one place a catalog image is ever written.
 */
async function attachOrderedImages(
  ctx: ActionCtx,
  catalogProductId: string,
  entries: StoredEntry[],
  source: string,
  sourceProductId?: string,
): Promise<number> {
  if (entries.length === 0) return 0;
  const seen = new Set<string>();
  const unique = entries.filter((entry) => {
    if (seen.has(entry.url)) return false;
    seen.add(entry.url);
    return true;
  });
  const ordered = orderCatalogImages(unique).slice(0, MAX_CATALOG_IMAGES);
  const primary = ordered[0];
  const additional = ordered
    .slice(1)
    .map((entry) => entry.url)
    .filter((url) => url !== primary.url);
  const attached = await ctx.runMutation(internal.masterCatalog.attachImages, {
    catalogProductId,
    primaryImage: primary.url,
    additionalImages: additional,
    imageSource: `Master product catalog (${source})`,
    provenance: {
      source,
      sourceProductId,
      originalUrl: primary.originalUrl,
      filename: primary.filename,
    },
  });
  return attached ? ordered.length : 0;
}

// ── Provider record → catalog seed ──

function seedFromProvider(record: ProviderProductRecord): CatalogSeedRecord {
  const name = record.name;
  const normalizedName = normalizeName(name);
  const dosageForm =
    statedForm(record.form ?? "") ?? statedForm(name) ?? undefined;
  const identityKey = identityKeyOf({
    name,
    strength: record.strength ?? null,
    form: dosageForm ?? null,
    packSize: record.packSize ?? null,
    manufacturer: record.manufacturer ?? null,
    brand: record.brand ?? null,
  });
  const catalogProductId = record.sourceProductId
    ? `src-${record.sourceProductId}`
    : `${slugify(normalizedName) || "item"}-${shortHash(identityKey)}`;
  const seed: CatalogSeedRecord = {
    catalogProductId,
    canonicalProductName: name,
    normalizedName,
    identityKey,
    verificationStatus: verificationStatusFor(
      {
        name,
        manufacturer: record.manufacturer ?? null,
        composition: record.composition ?? null,
        strength: record.strength ?? null,
        dosageForm: dosageForm ?? null,
      },
      false,
    ),
  };
  const put = <K extends keyof CatalogSeedRecord>(
    key: K,
    value: CatalogSeedRecord[K] | undefined,
  ) => {
    if (value !== undefined && value !== null && value !== "") seed[key] = value;
  };
  put("brand", record.brand);
  put("manufacturer", record.manufacturer);
  put("composition", record.composition);
  if (record.composition) {
    seed.normalizedComposition = normalizeName(record.composition);
  }
  put("strength", record.strength);
  put("dosageForm", dosageForm);
  put("packSize", record.packSize);
  put("sku", record.sku);
  put("gtin", record.gtin);
  put("category", record.category);
  if (record.prescriptionRequired !== undefined) {
    seed.prescriptionRequired = record.prescriptionRequired;
  }
  put("description", record.description);
  put("benefits", record.benefits);
  put("directions", record.directions);
  put("safety", record.safety);
  put("storage", record.storage);
  put("mrp", record.mrp);
  put("sourceProductId", record.sourceProductId);
  put("sourceUrl", record.sourceUrl);
  return seed;
}

// ── Queries ──

/**
 * Autocomplete for the Auto Fill name field: exact and broader variants of
 * the typed text only (a different strength/form is never returned), exact
 * first. Non-admins and empty queries get an empty list, so this is safe to
 * poll on every keystroke without scanning the catalog.
 */
export const searchProducts = query({
  args: {
    query: v.string(),
    take: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") return [];
    const trimmed = args.query.trim();
    if (trimmed.length < 2) return [];
    const hits = await searchCatalog(
      ctx.db,
      trimmed,
      {},
      Math.min(args.take ?? 6, 12),
      true,
    );
    return hits.map(toSuggestion);
  },
  returns: v.array(suggestionValidator),
});

/** Catalog summary for the import dialog (admin only; never per Auto Fill). */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    // One bounded pass, only when the admin opens the import dialog. The Auto
    // Fill path itself never reads the whole catalog — it goes through the
    // indexes above.
    const rows = await ctx.db.query("masterCatalog").collect();
    const byStatus = { VERIFIED: 0, NEEDS_REVIEW: 0, NEEDS_IMAGE: 0 };
    for (const row of rows) byStatus[row.verificationStatus] += 1;
    const lastBatch = await ctx.db
      .query("masterCatalogImports")
      .withIndex("by_finishedAt")
      .order("desc")
      .take(1);
    return {
      total: rows.length,
      byStatus,
      lastImport: lastBatch[0] ?? null,
    };
  },
});

// ── Internal queries ──

export const searchRecords = internalQuery({
  args: {
    query: v.string(),
    take: v.optional(v.number()),
    hints: v.optional(
      v.object({
        manufacturer: v.optional(v.string()),
        brand: v.optional(v.string()),
        composition: v.optional(v.string()),
        form: v.optional(v.string()),
        strength: v.optional(v.string()),
        packSize: v.optional(v.string()),
        sku: v.optional(v.string()),
      }),
    ),
    partial: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const hits = await searchCatalog(
      ctx.db,
      args.query,
      {
        manufacturer: args.hints?.manufacturer ?? null,
        brand: args.hints?.brand ?? null,
        form: args.hints?.form ?? null,
        strength: args.hints?.strength ?? null,
        packSize: args.hints?.packSize ?? null,
      },
      args.take ?? 12,
      args.partial ?? false,
    );
    return hits.map((hit) => ({
      row: hit.row,
      verdict: hit.verdict,
      reason: hit.reason,
    }));
  },
});

export const recordByProductId = internalQuery({
  args: { catalogProductId: v.string() },
  handler: async (ctx, args) => {
    return await findByCatalogProductId(ctx.db, args.catalogProductId);
  },
});

// ── Internal mutations ──

/**
 * Attach a stored image gallery to its catalog record. This is the only
 * place a primary image is written, which is what keeps metadata and images
 * linked to the same record forever.
 */
export const attachImages = internalMutation({
  args: {
    catalogProductId: v.string(),
    primaryImage: v.string(),
    additionalImages: v.array(v.string()),
    imageSource: v.string(),
    provenance: v.object({
      source: v.string(),
      sourceProductId: v.optional(v.string()),
      originalUrl: v.optional(v.string()),
      filename: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const row = await findByCatalogProductId(ctx.db, args.catalogProductId);
    if (!row) return false;
    const now = Date.now();
    const additional = args.additionalImages.filter(
      (url) => url && url !== args.primaryImage,
    );
    await ctx.db.patch(row._id, {
      primaryImage: args.primaryImage,
      additionalImages: additional.length > 0 ? additional : undefined,
      imageSource: args.imageSource,
      imageProvenance: {
        source: args.provenance.source,
        sourceProductId: args.provenance.sourceProductId,
        originalUrl: args.provenance.originalUrl,
        filename: args.provenance.filename,
        importedAt: now,
        processedAt: now,
      },
      verificationStatus: verificationStatusFor(
        {
          name: row.canonicalProductName,
          manufacturer: row.manufacturer,
          composition: row.composition,
          strength: row.strength,
          dosageForm: row.dosageForm,
        },
        true,
      ),
      updatedAt: now,
    });
    return true;
  },
});

/** Persist one record returned by the configured licensed provider. */
export const upsertFromProvider = internalMutation({
  args: { seed: seedRecordValidator, batchId: v.string() },
  handler: async (ctx, args) => {
    return await upsertSeed(
      ctx.db,
      args.seed as CatalogSeedRecord,
      args.batchId,
      Date.now(),
    );
  },
});

// ── Mutations (admin) ──

/**
 * Bulk import of one chunk of licensed-dataset records. Upserts through the
 * stable identity chain, so a re-import updates in place, preserves the
 * previous source mapping and any stored images, and never duplicates.
 */
export const importRecords = mutation({
  args: {
    batchId: v.string(),
    fileName: v.optional(v.string()),
    records: v.array(seedRecordValidator),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = Date.now();
    let created = 0;
    let updated = 0;
    for (const record of args.records) {
      const result = await upsertSeed(
        ctx.db,
        record as CatalogSeedRecord,
        args.batchId,
        now,
      );
      if (result === "created") created += 1;
      else updated += 1;
    }
    return { created, updated };
  },
});

/** Write the audit row for a finished import run. */
export const recordImportBatch = mutation({
  args: {
    batchId: v.string(),
    fileName: v.optional(v.string()),
    imageFileName: v.optional(v.string()),
    recordsCreated: v.number(),
    recordsUpdated: v.number(),
    imagesStored: v.number(),
    imagesUnmatched: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db.insert("masterCatalogImports", {
      batchId: args.batchId,
      fileName: args.fileName,
      imageFileName: args.imageFileName,
      recordsCreated: args.recordsCreated,
      recordsUpdated: args.recordsUpdated,
      imagesStored: args.imagesStored,
      imagesUnmatched: args.imagesUnmatched,
      finishedAt: Date.now(),
    });
  },
});

// ── Actions (admin) ──

/**
 * Store a chunk of matched images (dataset URLs and/or licensed-ZIP files)
 * into Convex storage and attach them to their catalog record. Ranking,
 * dedupe and provenance happen here, so a record can never end up with a
 * mirrored, duplicated or foreign image.
 */
export const storeImportedImages = action({
  args: {
    batchId: v.string(),
    source: v.optional(v.string()),
    items: v.array(
      v.object({
        catalogProductId: v.string(),
        sourceProductId: v.optional(v.string()),
        urls: v.optional(v.array(v.string())),
        files: v.optional(
          v.array(v.object({ filename: v.string(), base64: v.string() })),
        ),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdminAction(ctx);
    const source = args.source ?? "licensed dataset";
    const results: Array<{ catalogProductId: string; stored: number }> = [];
    let stored = 0;
    for (const item of args.items) {
      const entries: StoredEntry[] = [];
      for (const url of item.urls ?? []) {
        const entry = await storeImageFromUrl(ctx, url);
        if (entry) entries.push(entry);
        if (entries.length >= MAX_CATALOG_IMAGES) break;
      }
      for (const file of item.files ?? []) {
        const entry = await storeImageFromFile(ctx, file.filename, file.base64);
        if (entry) entries.push(entry);
        if (entries.length >= MAX_CATALOG_IMAGES) break;
      }
      const count = await attachOrderedImages(
        ctx,
        item.catalogProductId,
        entries,
        source,
        item.sourceProductId,
      );
      stored += count;
      results.push({ catalogProductId: item.catalogProductId, stored: count });
    }
    return { items: results, stored };
  },
});

/**
 * ADMIN AUTO FILL — catalog first, licensed provider second, never a guess.
 *
 * Returns one of:
 *   - found + unique exact record → full fill payload (metadata AND images of
 *     THAT record) for the existing Auto Fill form;
 *   - found + ambiguous           → suggestions to pick from, nothing applied;
 *   - not found                   → the exact mandated message, manual entry
 *     stays available, sources reported honestly.
 */
export const autoFill = action({
  args: {
    productName: v.string(),
    hints: identityHintsValidator,
  },
  handler: async (ctx, args) => {
    await requireAdminAction(ctx);
    const name = args.productName.trim();
    const hints: IdentityHints = args.hints ?? {};
    const sources: SourceReport[] = [];
    if (!name) {
      return {
        found: false,
        message: CATALOG_PRODUCT_NOT_FOUND_MESSAGE,
        suggestions: [] as Suggestion[],
        sources: [catalogMissSource("no product name was given")],
      };
    }

    let hits = await ctx.runQuery(internal.masterCatalog.searchRecords, {
      query: name,
      take: 12,
      hints,
      partial: false,
    });
    // A stable code typed into the SKU field is an exact lookup of its own.
    if (hits.length === 0 && hints.sku) {
      hits = await ctx.runQuery(internal.masterCatalog.searchRecords, {
        query: hints.sku,
        take: 12,
        hints,
        partial: false,
      });
    }

    const exact = hits.filter((hit) => hit.verdict === "exact");
    const related = hits.filter((hit) => hit.verdict === "related");

    if (exact.length === 1) {
      const row = exact[0].row;
      sources.push({
        ...CATALOG_SOURCE_RESOLVED,
        detail: `record ${row.catalogProductId} matched exactly (${exact[0].reason}); status ${row.verificationStatus}`,
      });
      return {
        found: true,
        record: toFillRecord(row),
        suggestions: [] as Suggestion[],
        sources,
      };
    }

    if (exact.length > 1 || (exact.length === 0 && related.length > 0)) {
      const chosen = [...exact, ...related].slice(0, 8);
      sources.push(
        catalogMissSource(
          exact.length > 1
            ? `${exact.length} exact variants share this name — select the specific product`
            : "the name is broader than a single catalog record — select the specific variant",
        ),
      );
      return {
        found: true,
        record: null,
        suggestions: chosen.map((hit) => toSuggestion(hit)),
        sources,
      };
    }

    // Nothing in the local catalog. A configured licensed provider is the only
    // other source allowed to answer; otherwise the honest not-found message.
    sources.push(catalogMissSource("no record for this exact product name"));
    const provider = createProductDataProvider(process.env);
    if (!provider) {
      sources.push(providerSource("disabled", PROVIDER_NOT_CONFIGURED_MESSAGE));
      return {
        found: false,
        message: CATALOG_PRODUCT_NOT_FOUND_MESSAGE,
        suggestions: [] as Suggestion[],
        sources,
      };
    }

    try {
      const results = await provider.searchProducts(name, 8);
      const queryIdentity: IdentityInput = {
        name,
        manufacturer: hints.manufacturer ?? null,
        brand: hints.brand ?? null,
        form: hints.form ?? null,
        strength: hints.strength ?? null,
        packSize: hints.packSize ?? null,
      };
      const providerExact = results.filter(
        (record) =>
          assessCatalogMatch(
            {
              name: record.name,
              manufacturer: record.manufacturer ?? null,
              brand: record.brand ?? null,
              form: record.form ?? null,
              strength: record.strength ?? null,
              packSize: record.packSize ?? null,
            },
            queryIdentity,
          ).verdict === "exact",
      );

      if (providerExact.length === 1) {
        const record = providerExact[0];
        const seed = seedFromProvider(record);
        await ctx.runMutation(internal.masterCatalog.upsertFromProvider, {
          seed,
          batchId: `provider-${Date.now()}`,
        });
        sources.push(
          providerSource("resolved", "exact record returned by the licensed provider"),
        );

        // Images come from that same provider record — never a separate search.
        if (record.sourceProductId) {
          try {
            const assets = await provider.getProductImages(record.sourceProductId);
            const entries: StoredEntry[] = [];
            for (const asset of assets) {
              if (!asset.url || entries.length >= MAX_CATALOG_IMAGES) continue;
              const entry = await storeImageFromUrl(ctx, asset.url);
              if (entry) entries.push(entry);
            }
            if (entries.length > 0) {
              await attachOrderedImages(
                ctx,
                seed.catalogProductId,
                entries,
                provider.label,
                record.sourceProductId,
              );
            }
          } catch {
            // Metadata is kept; the record simply stays NEEDS_IMAGE.
          }
        }

        const row = await ctx.runQuery(internal.masterCatalog.recordByProductId, {
          catalogProductId: seed.catalogProductId,
        });
        if (row) {
          return {
            found: true,
            record: toFillRecord(row),
            suggestions: [] as Suggestion[],
            sources,
          };
        }
      }

      if (results.length > 0) {
        sources.push(
          providerSource(
            "no-exact-match",
            `${results.length} provider record(s) checked; none was this exact variant`,
          ),
        );
        if (providerExact.length > 1) {
          return {
            found: true,
            record: null,
            suggestions: providerExact.slice(0, 8).map((record, index) => ({
              catalogProductId: `provider-${index}`,
              name: record.name,
              brand: record.brand ?? null,
              manufacturer: record.manufacturer ?? null,
              strength: record.strength ?? statedStrength(record.name),
              form: record.form ?? statedForm(record.name),
              packSize: record.packSize ?? null,
              verificationStatus: "NEEDS_REVIEW",
              hasImage: false,
              verdict: "exact",
              reason: "returned by the licensed provider",
            })),
            sources,
          };
        }
      } else {
        sources.push(providerSource("no-exact-match", "the provider returned no records"));
      }
      return {
        found: false,
        message: CATALOG_PRODUCT_NOT_FOUND_MESSAGE,
        suggestions: [] as Suggestion[],
        sources,
      };
    } catch (error) {
      sources.push(
        providerSource(
          "error",
          error instanceof Error && error.message
            ? error.message
            : "the licensed provider request failed",
        ),
      );
      return {
        found: false,
        message: CATALOG_PRODUCT_NOT_FOUND_MESSAGE,
        suggestions: [] as Suggestion[],
        sources,
      };
    }
  },
});

/**
 * Catalog image lookup for the dialog's Fetch image button. Same exact-match
 * rules as Auto Fill; only images of the matched record are ever returned,
 * and the two mandated messages are used verbatim. Nothing is fetched from
 * an external search when the record ships no image.
 */
export const lookupImage = action({
  args: {
    productName: v.string(),
    hints: identityHintsValidator,
  },
  handler: async (ctx, args) => {
    await requireAdminAction(ctx);
    const name = args.productName.trim();
    const hints: IdentityHints = args.hints ?? {};
    const empty = {
      found: false as const,
      ambiguous: false as const,
      hasImage: false as const,
      message: CATALOG_PRODUCT_NOT_FOUND_MESSAGE as string,
      imageUrl: null,
      additionalImages: [] as string[],
      imageSource: null,
      imageUrlSource: null,
      matchedName: null,
      suggestions: [] as Suggestion[],
    };
    if (!name) return empty;

    const hits = await ctx.runQuery(internal.masterCatalog.searchRecords, {
      query: name,
      take: 12,
      hints,
      partial: false,
    });
    const exact = hits.filter((hit) => hit.verdict === "exact");

    if (exact.length !== 1) {
      if (exact.length > 1 || hits.length > 0) {
        return {
          ...empty,
          found: true as const,
          message: null,
          suggestions: [
            ...exact,
            ...hits.filter((hit) => hit.verdict === "related"),
          ]
            .slice(0, 8)
            .map((hit) => toSuggestion(hit)),
        };
      }
      return empty;
    }

    const row = exact[0].row;
    if (!row.primaryImage) {
      return {
        ...empty,
        found: true as const,
        message: CATALOG_IMAGE_NOT_FOUND_MESSAGE as string,
        matchedName: row.canonicalProductName,
      };
    }
    return {
      ...empty,
      found: true as const,
      hasImage: true as const,
      message: null,
      imageUrl: row.primaryImage,
      additionalImages: row.additionalImages ?? [],
      imageSource: row.imageSource ?? null,
      imageUrlSource: row.imageProvenance?.originalUrl ?? null,
      matchedName: row.canonicalProductName,
    };
  },
});
