/**
 * AUTOMATIC PRODUCT PROMOTION — resolver.
 *
 * The admin's only job is to switch promotion ON. Everything after that is
 * resolved SERVER-SIDE against the project's approved media source, which is
 * the licensed Master Product Catalog the existing Auto Fill already reads.
 * There is no web image search, no stock library and no hotlinking anywhere in
 * this module.
 *
 * Three rules shape the whole design:
 *
 *   1. EXACT VARIANT ONLY. Identity is resolved through the strongest
 *      identifier available, in order: the catalog product id Auto Fill already
 *      matched → GTIN → SKU → the strict name matcher. Every candidate is then
 *      re-checked with the same matcher Auto Fill uses, so "500 mg" can never
 *      receive "650 mg" artwork.
 *   2. NO SILENT CHOICE. Two possible variants produce an `ambiguous` result
 *      the admin must resolve; nothing is attached automatically.
 *   3. HONEST WHEN EMPTY. A product with no approved creative returns
 *      `no-media` and an empty list. Nothing is invented, and the product page
 *      then renders no promotion section at all.
 *
 * The browser is never trusted to decide which creative belongs to which
 * product: this action returns creatives for PREVIEW only, and the actual save
 * re-derives them from the catalog record itself (see normalizeProductPromotion
 * in adminProducts.ts).
 */
import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  CATALOG_PROMOTION_SOURCE_LABEL,
  MAX_PROMOTION_MEDIA,
  assessCatalogMatch,
  type IdentityInput,
} from "./masterCatalogCore";

/** Shown when the approved source genuinely holds no creative for a product. */
export const NO_PROMOTIONAL_MEDIA_MESSAGE =
  "Verified promotional creatives are not available for this product.";

/** Shown when two variants could match, so nothing may be attached silently. */
export const AMBIGUOUS_MATCH_MESSAGE =
  "Multiple possible product matches found. Please select the exact product.";

/** Shown when the approved source has no record for this exact variant. */
export const NO_EXACT_MATCH_MESSAGE =
  "No exact match was found in the approved product media catalog for this product.";

/** Shown when a candidate record contradicts the product being edited. */
export const VARIANT_MISMATCH_MESSAGE =
  "The matched catalog record is a different variant, so its promotional media was not used.";

export type ResolvedCreative = {
  imageUrl: string;
  heading?: string;
  description?: string;
  source: string;
  sourceProductId?: string;
};

export type PromotionResolution = {
  status: "resolved" | "no-media" | "ambiguous" | "not-found" | "mismatch";
  message: string;
  /** The exact catalog record the creatives belong to, when one matched. */
  match: null | {
    catalogProductId: string;
    productName: string;
    brand?: string | null;
    manufacturer?: string | null;
    strength?: string | null;
    form?: string | null;
    packSize?: string | null;
    gtin?: string | null;
    source: string;
  };
  creatives: ResolvedCreative[];
  /** Other records that also matched, shown when the result is ambiguous. */
  suggestions: Array<{ productName: string; manufacturer?: string | null }>;
};

/** The identity an admin form can supply, strongest signal first. */
export const promotionIdentityValidator = v.object({
  /** The exact catalog record Auto Fill already matched, when there is one. */
  catalogProductId: v.optional(v.string()),
  name: v.string(),
  gtin: v.optional(v.string()),
  sku: v.optional(v.string()),
  brand: v.optional(v.string()),
  manufacturer: v.optional(v.string()),
  strength: v.optional(v.string()),
  form: v.optional(v.string()),
  packSize: v.optional(v.string()),
});

export type PromotionIdentity = {
  catalogProductId?: string;
  name: string;
  gtin?: string;
  sku?: string;
  brand?: string;
  manufacturer?: string;
  strength?: string;
  form?: string;
  packSize?: string;
};

async function requireAdminAction(ctx: ActionCtx) {
  const isAdmin = await ctx.runQuery(internal.adminProducts.isAdminUser, {});
  if (!isAdmin) throw new Error("Not authorized");
}

function recordIdentity(row: any): IdentityInput {
  return {
    name: row.canonicalProductName,
    strength: row.strength ?? null,
    form: row.dosageForm ?? null,
    packSize: row.packSize ?? null,
    manufacturer: row.manufacturer ?? null,
    brand: row.brand ?? null,
  };
}

/** Only well-formed, non-temporary creative URLs are ever offered. */
function usableCreatives(row: any): ResolvedCreative[] {
  const media = Array.isArray(row?.promotionalMedia) ? row.promotionalMedia : [];
  return media
    .filter(
      (item: any) =>
        item &&
        typeof item.imageUrl === "string" &&
        item.imageUrl.trim().length > 0 &&
        !/^blob:/i.test(item.imageUrl.trim()) &&
        !/^data:/i.test(item.imageUrl.trim()),
    )
    .map((item: any, index: number) => ({
      imageUrl: item.imageUrl.trim(),
      heading: item.heading?.trim() || undefined,
      description: item.description?.trim() || undefined,
      source: item.source?.trim() || CATALOG_PROMOTION_SOURCE_LABEL,
      sourceProductId:
        item.sourceProductId?.trim() || row.sourceProductId?.trim() || undefined,
      order: typeof item.order === "number" ? item.order : index,
    }))
    .sort((a: any, b: any) => a.order - b.order)
    .slice(0, MAX_PROMOTION_MEDIA)
    .map((item: any) => ({
      imageUrl: item.imageUrl as string,
      heading: item.heading as string | undefined,
      description: item.description as string | undefined,
      source: item.source as string,
      sourceProductId: item.sourceProductId as string | undefined,
    }));
}

/**
 * Resolve verified promotional creatives for one exact product.
 *
 * Admin-only. Returns creatives for the admin preview; it writes nothing.
 */
export const resolve = action({
  args: { identity: promotionIdentityValidator },
  handler: async (ctx, args): Promise<PromotionResolution> => {
    await requireAdminAction(ctx);
    const identity: PromotionIdentity = args.identity;
    const name = (identity.name ?? "").trim();

    if (!name && !identity.catalogProductId) {
      return {
        status: "not-found",
        message: "Enter the product name before resolving promotional media.",
        match: null,
        creatives: [],
        suggestions: [],
      };
    }

    const hints = {
      manufacturer: identity.manufacturer ?? undefined,
      brand: identity.brand ?? undefined,
      strength: identity.strength ?? undefined,
      form: identity.form ?? undefined,
      packSize: identity.packSize ?? undefined,
      sku: identity.sku ?? undefined,
    };

    // Strongest identifier first. Each lookup is indexed — the catalog is
    // never scanned.
    let candidates: any[] = [];
    if (identity.catalogProductId) {
      const row = await ctx.runQuery(
        internal.masterCatalog.recordByProductId,
        { catalogProductId: identity.catalogProductId },
      );
      if (row) candidates = [row];
    }
    if (candidates.length === 0 && identity.gtin) {
      candidates = await ctx.runQuery(internal.masterCatalog.recordsByGtin, {
        gtin: identity.gtin.trim(),
      });
    }
    if (candidates.length === 0 && identity.sku) {
      candidates = await ctx.runQuery(internal.masterCatalog.recordsBySku, {
        sku: identity.sku.trim(),
      });
    }
    if (candidates.length === 0 && name) {
      const hits = await ctx.runQuery(internal.masterCatalog.searchRecords, {
        query: name,
        take: 12,
        hints,
        partial: false,
      });
      candidates = hits
        .filter((hit: any) => hit.verdict === "exact")
        .map((hit: any) => hit.row);
    }

    // One record per catalog id, so a re-found row is never double-counted.
    const unique = new Map<string, any>();
    for (const row of candidates) {
      if (row && !unique.has(row.catalogProductId)) unique.set(row.catalogProductId, row);
    }
    const rows = [...unique.values()];

    if (rows.length === 0) {
      return {
        status: "not-found",
        message: NO_EXACT_MATCH_MESSAGE,
        match: null,
        creatives: [],
        suggestions: [],
      };
    }

    if (rows.length > 1) {
      return {
        status: "ambiguous",
        message: AMBIGUOUS_MATCH_MESSAGE,
        match: null,
        creatives: [],
        suggestions: rows.slice(0, 8).map((row) => ({
          productName: row.canonicalProductName,
          manufacturer: row.manufacturer ?? null,
        })),
      };
    }

    const row = rows[0];

    // Re-check the candidate against the product being edited. An id, GTIN or
    // SKU lookup is only a pointer; this is the step that stops a 500 mg
    // product from receiving 650 mg artwork.
    const verdict = assessCatalogMatch(recordIdentity(row), {
      name,
      strength: identity.strength ?? null,
      form: identity.form ?? null,
      packSize: identity.packSize ?? null,
      manufacturer: identity.manufacturer ?? null,
      brand: identity.brand ?? null,
    });
    if (verdict.verdict === "reject") {
      return {
        status: "mismatch",
        message: `${VARIANT_MISMATCH_MESSAGE} (${verdict.reason})`,
        match: null,
        creatives: [],
        suggestions: [],
      };
    }

    const match = {
      catalogProductId: row.catalogProductId,
      productName: row.canonicalProductName,
      brand: row.brand ?? null,
      manufacturer: row.manufacturer ?? null,
      strength: row.strength ?? null,
      form: row.dosageForm ?? null,
      packSize: row.packSize ?? null,
      gtin: row.gtin ?? null,
      source: CATALOG_PROMOTION_SOURCE_LABEL,
    };

    const creatives = usableCreatives(row);
    if (creatives.length === 0) {
      // The exact product matched but the approved source ships no creative for
      // it. Saying so is the whole point — nothing is substituted.
      return {
        status: "no-media",
        message: NO_PROMOTIONAL_MEDIA_MESSAGE,
        match,
        creatives: [],
        suggestions: [],
      };
    }

    return {
      status: "resolved",
      message: `Found ${creatives.length} verified promotional creative${creatives.length === 1 ? "" : "s"} for ${row.canonicalProductName}.`,
      match,
      creatives,
      suggestions: [],
    };
  },
});