/**
 * Product image repair — the safe backfill for products whose stored image
 * cannot be trusted.
 *
 * A product needs repair when its image is missing, a generated `data:`
 * placeholder, a chemical structure/diagram pulled from Wikipedia, or any other
 * third-party URL. Only `imageUrl` is ever written, so names, prices, stock,
 * categories, brands and product links are untouched. When no real packshot can
 * be verified the stored value is left exactly as it was, so a repair can
 * improve an image but never blank one.
 */
import {
  action,
  internalAction,
  internalMutation,
  type ActionCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { internal as generatedInternal } from "./_generated/api";
import type { FunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";
import {
  contentHash,
  isPackshotLookingUrl,
  isVerifiedProductImage,
  resolveAndStore,
  storageIdFromImageUrl,
  MAX_PRODUCT_IMAGES,
  type ProductIdentity,
} from "./productImageResolver";

type AuditRow = {
  id: Id<"products">;
  name: string;
  imageUrl: string;
  additionalImages: string[];
  /** Source label and original image URL recorded when the packshot was stored. */
  imageSource: string;
  imageUrlSource: string;
  manufacturer: string;
  composition: string;
  form: string;
  strength: string;
  dosage: string;
  packSize: string;
  sku: string;
};

/**
 * True when the stored gallery cannot be trusted: no views at all, a blank or
 * third-party URL, a repeat of another view, or the front image listed again as
 * a thumbnail. Each of those is exactly what this backfill is meant to fix.
 */
export function needsAdditionalImagesRepair(
  images: string[],
  imageUrl: string,
): boolean {
  if (!images || images.length === 0) return true;
  const seen = new Set<string>();
  for (const raw of images) {
    const url = (raw ?? "").trim();
    if (!url) return true;
    if (url === imageUrl) return true;
    if (!isVerifiedProductImage(url)) return true;
    if (seen.has(url)) return true;
    seen.add(url);
  }
  return false;
}

/** What the audit found wrong with one product's stored image. */
export type ImageAuditReason =
  | "missing"
  | "placeholder"
  | "third-party"
  | "suspicious-source"
  | "broken-gallery"
  | "duplicate-views";

export type ImageAudit = {
  /** True when the stored image or its gallery can no longer be trusted. */
  needsFix: boolean;
  reason: ImageAuditReason | null;
  /**
   * The stored provenance URL when it gives the image away as a person /
   * hand-held / lifestyle / social / stock photo rather than a packshot.
   */
  suspiciousSource: string | null;
};

/**
 * Classify one product's stored image. Everything with a fixable image problem
 * is flagged; a product whose only issue is that no second genuine view exists
 * is not, because that is normal. Pure, so the admin audit and the tests read
 * exactly the same rules.
 */
export function auditProductImage(row: {
  imageUrl: string;
  additionalImages: string[];
  imageUrlSource?: string;
}): ImageAudit {
  const imageUrl = (row.imageUrl ?? "").trim();
  const source = (row.imageUrlSource ?? "").trim();

  // A provenance URL that fails the packshot rules gives the stored image away:
  // it was taken from a person/hand-held/lifestyle/social/stock source, which is
  // precisely the case the admin needs to see and re-resolve.
  const suspiciousSource =
    source && !isPackshotLookingUrl(source) ? source : null;
  const flag = (reason: ImageAuditReason): ImageAudit => ({
    needsFix: true,
    reason,
    suspiciousSource,
  });

  if (!imageUrl) return flag("missing");
  if (!/^https?:\/\//i.test(imageUrl)) return flag("placeholder");
  if (!isVerifiedProductImage(imageUrl)) return flag("third-party");
  if (suspiciousSource) return flag("suspicious-source");

  // A gallery that repeats the front image, repeats itself, or holds a URL that
  // is not a verified asset is broken rather than merely thin.
  const seen = new Set([imageUrl]);
  for (const raw of row.additionalImages ?? []) {
    const url = (raw ?? "").trim();
    if (!url || seen.has(url) || !isVerifiedProductImage(url)) {
      return flag("broken-gallery");
    }
    seen.add(url);
  }

  return { needsFix: false, reason: null, suspiciousSource: null };
}

/**
 * Keep only genuine, verified, distinct views — fresh results first, then any
 * still-valid stored views — and cap the total at `MAX_PRODUCT_IMAGES`. This
 * means a re-resolve can add views but never downgrade or duplicate them.
 *
 * When `hashesByUrl` is supplied, a stored view whose bytes repeat a view that
 * has already been kept is dropped too: the same photograph served from two URLs
 * would otherwise show up as two identical thumbnails.
 */
export function mergeAdditionalImages(
  existing: string[],
  incoming: string[],
  imageUrl: string,
  hashesByUrl?: Map<string, string>,
): string[] {
  const out: string[] = [];
  const seenUrls = new Set([imageUrl]);
  const seenHashes = new Set<string>();
  // The front image is already in the gallery, so a view that repeats its
  // picture is a duplicate too.
  const primaryHash = hashesByUrl?.get(imageUrl);
  if (primaryHash) seenHashes.add(primaryHash);
  for (const raw of [...incoming, ...existing]) {
    const url = (raw ?? "").trim();
    if (!url || seenUrls.has(url) || !isVerifiedProductImage(url)) continue;
    const hash = hashesByUrl?.get(url);
    if (hash) {
      if (seenHashes.has(hash)) continue;
      seenHashes.add(hash);
    }
    seenUrls.add(url);
    out.push(url);
    if (out.length >= MAX_PRODUCT_IMAGES - 1) break;
  }
  return out;
}

/** True when two of a product's stored images are the same picture. */
export function hasDuplicateViewContent(hashes: string[]): boolean {
  return hashes.length > 0 && new Set(hashes).size !== hashes.length;
}

/**
 * The generated `internal` tree contains this very module, so referring to it
 * directly would make these actions' inferred types depend on themselves. These
 * references are declared explicitly instead, which keeps every call typed
 * without the circularity.
 */
type ProductAdminRefs = {
  adminProducts: {
    isAdminUser: FunctionReference<
      "query",
      "internal",
      Record<string, never>,
      boolean
    >;
    productImageRow: FunctionReference<
      "query",
      "internal",
      { productId: Id<"products"> },
      AuditRow | null
    >;
    productsForImageAudit: FunctionReference<
      "query",
      "internal",
      Record<string, never>,
      AuditRow[]
    >;
    setProductImage: FunctionReference<
      "mutation",
      "internal",
      {
        productId: Id<"products">;
        imageUrl: string;
        additionalImages?: string[];
        imageSource?: string;
        imageUrlSource?: string;
      },
      null
    >;
  };
};

const internal = generatedInternal as unknown as ProductAdminRefs;

function identityOf(row: AuditRow): ProductIdentity {
  return {
    productName: row.name,
    manufacturer: row.manufacturer || undefined,
    composition: row.composition || undefined,
    form: row.form || undefined,
    strength: row.strength || undefined,
    dosage: row.dosage || undefined,
    packSize: row.packSize || undefined,
    sku: row.sku || undefined,
  };
}

/**
 * Remove a stale placeholder reference so no product points at a legacy
 * placeholder asset. The product card already renders its own neutral fallback
 * when there is no image, so clearing one is a tidy-up, never a downgrade.
 *
 * A verified packshot stored by the pipeline is refused outright: this can only
 * ever remove a placeholder, never a real product image.
 */
export const clearPlaceholderImage = internalMutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    const current = (product.imageUrl ?? "").trim();
    if (!current) return { cleared: false as const, reason: "no-image" };
    if (isVerifiedProductImage(current)) {
      throw new Error(
        "Refusing to clear a verified product image. Re-resolve it instead.",
      );
    }

    await ctx.db.patch(args.productId, {
      imageUrl: undefined,
      updatedAt: Date.now(),
    });
    return { cleared: true as const, previous: current };
  },
});

/**
 * Re-resolve the image of one product. Returns the new image URL when a real
 * packshot was verified, otherwise the reason it could not be.
 *
 * `force` re-resolves even a product whose stored image is already a verified
 * Convex-storage packshot — used when a review shows the existing image is
 * unusable (a sliver, a zoomed detail crop, a washed-out shot).
 */
type RepairResult =
  | {
      status: "unresolved";
      name: string;
      current: string;
      reason: string;
    }
  | {
      /** "unchanged" when the stored packshot already matched the resolution. */
      status: "repaired" | "unchanged";
      name: string;
      from: string;
      imageUrl: string;
      additionalImages: string[];
      matchedName: string;
      /** Number of genuine extra views now stored. */
      views: number;
      /** False when fewer than `MAX_PRODUCT_IMAGES` verified views exist. */
      complete: boolean;
      /** Why the gallery is short, when it is. */
      message?: string;
      replaced: boolean;
    };

/**
 * Resolve one product's packshot and write it back together with its
 * provenance. Shared by the bulk backfill and the admin audit so both behave
 * identically. When the exact product's packshot cannot be verified, nothing is
 * written and the stored image is left exactly as it was.
 */
/**
 * Content hashes of the images a product already has stored. Passed to the
 * resolver so a re-resolve can recognise a photo that is already in the gallery
 * and skip it, instead of storing the same picture a second time under a new
 * URL.
 */
async function storedImageHashes(
  ctx: ActionCtx,
  urls: string[],
): Promise<Map<string, string>> {
  const hashes = new Map<string, string>();
  for (const url of [urls[0], ...urls.slice(1)]) {
    const id = storageIdFromImageUrl(url);
    if (!id || hashes.has(url)) continue;
    try {
      const blob = await ctx.storage.get(id);
      if (!blob) continue;
      hashes.set(url, contentHash(new Uint8Array(await blob.arrayBuffer())));
    } catch {
      // An unreadable legacy asset is simply not compared against.
    }
  }
  return hashes;
}

async function resolveAndPatch(
  ctx: ActionCtx,
  row: AuditRow,
  patch: boolean,
): Promise<RepairResult> {
  let outcome;
  const storedHashes = await storedImageHashes(ctx, [
    row.imageUrl,
    ...row.additionalImages,
  ]);
  try {
    outcome = await resolveAndStore(ctx, identityOf(row), {
      existingHashes: new Set(storedHashes.values()),
    });
  } catch (error) {
    console.error("[productImageRepair] failed for", row.name, error);
    return {
      status: "unresolved",
      name: row.name,
      current: row.imageUrl,
      reason: "lookup-failed",
    };
  }

  if (!outcome.ok) {
    // Nothing new could be verified. A product that already holds a verified
    // packshot keeps it, but its gallery is still tidied of a repeated view —
    // that cleanup needs no new image, so it must not depend on one.
    if (isVerifiedProductImage(row.imageUrl)) {
      const tidied = mergeAdditionalImages(
        row.additionalImages,
        [],
        row.imageUrl,
        storedHashes,
      );
      if (patch && tidied.length !== row.additionalImages.length) {
        await ctx.runMutation(internal.adminProducts.setProductImage, {
          productId: row.id,
          imageUrl: row.imageUrl,
          additionalImages: tidied,
          imageSource: row.imageSource || undefined,
          imageUrlSource: row.imageUrlSource || undefined,
        });
      }
    }
    return {
      status: "unresolved",
      name: row.name,
      current: row.imageUrl,
      reason: outcome.message,
    };
  }

  const additionalImages = mergeAdditionalImages(
    row.additionalImages,
    outcome.additionalImages,
    outcome.imageUrl,
    storedHashes,
  );

  const imageSame = outcome.imageUrl === row.imageUrl;
  const gallerySame =
    additionalImages.length === row.additionalImages.length &&
    additionalImages.every((url, i) => url === row.additionalImages[i]);
  const provenanceSame = (row.imageUrlSource ?? "") === outcome.imageUrlSource;
  if (imageSame && gallerySame && provenanceSame) {
    return {
      status: "unchanged",
      name: row.name,
      from: row.imageUrl,
      imageUrl: outcome.imageUrl,
      additionalImages,
      matchedName: outcome.matchedName,
      views: additionalImages.length,
      complete: outcome.complete,
      message: outcome.message,
      replaced: false,
    };
  }

  if (patch) {
    await ctx.runMutation(internal.adminProducts.setProductImage, {
      productId: row.id,
      imageUrl: outcome.imageUrl,
      additionalImages,
      imageSource: outcome.source,
      imageUrlSource: outcome.imageUrlSource,
    });
  }

  return {
    status: "repaired",
    name: row.name,
    from: row.imageUrl,
    imageUrl: outcome.imageUrl,
    additionalImages,
    matchedName: outcome.matchedName,
    views: additionalImages.length,
    complete: outcome.complete,
    message: outcome.message,
    replaced: outcome.imageUrl !== row.imageUrl,
  };
}

export const repairProductImage = action({
  args: { productId: v.id("products"), force: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const isAdmin = await ctx.runQuery(internal.adminProducts.isAdminUser, {});
    if (!isAdmin) throw new Error("Not authorized");

    const row: AuditRow | null = await ctx.runQuery(
      internal.adminProducts.productImageRow,
      { productId: args.productId },
    );
    if (!row) throw new Error("Product not found");

    const result = await resolveAndPatch(ctx, row, true);
    if (result.status === "unresolved") {
      return { ok: false as const, message: result.reason };
    }

    return {
      ok: true as const,
      imageUrl: result.imageUrl,
      additionalImages: result.additionalImages,
      matchedName: result.matchedName,
      complete: result.complete,
      message: result.message,
      replaced: result.replaced,
    };
  },
});

/**
 * Bulk backfill. Run with `{"dryRun": true}` first to see what would change:
 *
 *   bunx convex run productImageRepair:repairProductImages '{"dryRun":true}'
 */
export const repairProductImages = internalAction({
  args: {
    limit: v.optional(v.number()),
    dryRun: v.optional(v.boolean()),
    /** Re-resolve these products only, however their image looks. */
    productIds: v.optional(v.array(v.id("products"))),
    /** Re-resolve every product, including ones with a stored packshot. */
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const rows: AuditRow[] = await ctx.runQuery(
      internal.adminProducts.productsForImageAudit,
      {},
    );

    let candidates = rows;
    if (args.productIds) {
      const wanted = new Set(args.productIds as string[]);
      candidates = rows.filter((row) => wanted.has(row.id as string));
    } else if (!args.force) {
      // Everything the audit flags, plus a product that is still short of the
      // full set of verified views: more genuine views may exist than are
      // stored, so a re-resolve is the only way to reach them.
      candidates = rows.filter(
        (row) =>
          auditProductImage(row).needsFix ||
          needsAdditionalImagesRepair(row.additionalImages, row.imageUrl) ||
          (isVerifiedProductImage(row.imageUrl) &&
            row.additionalImages.length < MAX_PRODUCT_IMAGES - 1),
      );
    }
    const needsRepair = candidates;
    const batch = args.limit ? needsRepair.slice(0, args.limit) : needsRepair;

    const repaired: {
      name: string;
      from: string;
      to: string;
      /** Number of genuine extra views now stored (0-3). */
      views: number;
    }[] = [];
    const unresolved: { name: string; current: string; reason: string }[] = [];
    const unchanged: string[] = [];
    /** Products that still have fewer than the full set of verified views. */
    const incomplete: { name: string; views: number }[] = [];

    for (const row of batch) {
      const result = await resolveAndPatch(ctx, row, args.dryRun !== true);
      if (result.status === "unresolved") {
        unresolved.push({
          name: result.name,
          current: result.current,
          reason: result.reason,
        });
      } else if (result.status === "unchanged") {
        unchanged.push(result.name);
        if (!result.complete) {
          incomplete.push({ name: result.name, views: result.views });
        }
      } else {
        repaired.push({
          name: result.name,
          from: result.from,
          to: result.imageUrl,
          views: result.views,
        });
        if (!result.complete) {
          incomplete.push({ name: result.name, views: result.views });
        }
      }
    }

    return {
      total: rows.length,
      needed: needsRepair.length,
      checked: batch.length,
      applied: args.dryRun !== true,
      repaired,
      unresolved,
      unchanged,
      incomplete,
    };
  },
});

/**
 * Rerunnable admin audit of every stored product image.
 *
 *   bunx convex run productImageRepair:auditProductImages '{"reResolve":true}'
 *
 * Reports every image that cannot be trusted: missing, a generated placeholder,
 * a third-party URL, a gallery that repeats itself or the front image, and a
 * packshot whose stored source is a person / hand-held / lifestyle / social /
 * stock photograph rather than a product packshot. With `reResolve` the same
 * safe repair runs over exactly the flagged products, so one click both finds
 * and fixes them — and an image that cannot be verified is never blanked or
 * replaced with something invented.
 */
async function runImageAudit(
  ctx: ActionCtx,
  args: {
    limit?: number;
    reResolve?: boolean;
    productIds?: Id<"products">[];
    checkDuplicates?: boolean;
  },
) {
  {
    const rows: AuditRow[] = await ctx.runQuery(
      internal.adminProducts.productsForImageAudit,
      {},
    );
    const wanted = args.productIds ? new Set(args.productIds as string[]) : null;
    const scoped = wanted
      ? rows.filter((row) => wanted.has(row.id as string))
      : rows;

    const flagged: Array<{ row: AuditRow; audit: ImageAudit }> = [];
    for (const row of scoped) {
      const audit = auditProductImage(row);
      // A gallery that repeats the same picture under two different URLs is
      // invisible to the pure classifier, so the stored bytes are compared here.
      if (
        !audit.needsFix &&
        args.checkDuplicates !== false &&
        isVerifiedProductImage(row.imageUrl)
      ) {
        const hashes = await storedImageHashes(ctx, [
          row.imageUrl,
          ...row.additionalImages,
        ]);
        if (hasDuplicateViewContent([...hashes.values()])) {
          flagged.push({
            row,
            audit: {
              needsFix: true,
              reason: "duplicate-views",
              suspiciousSource: null,
            },
          });
          continue;
        }
      }
      if (audit.needsFix) flagged.push({ row, audit });
    }

    const counts: Record<string, number> = {};
    for (const entry of flagged) {
      const reason = entry.audit.reason ?? "unknown";
      counts[reason] = (counts[reason] ?? 0) + 1;
    }

    const flaggedReport = flagged.map((entry) => ({
      name: entry.row.name,
      reason: entry.audit.reason,
      imageUrl: entry.row.imageUrl,
      suspiciousSource: entry.audit.suspiciousSource,
    }));

    const repaired: { name: string; views: number }[] = [];
    const incomplete: { name: string; views: number }[] = [];
    const unresolved: { name: string; current: string; reason: string }[] = [];
    const batch = args.reResolve === true
      ? args.limit
        ? flagged.slice(0, args.limit)
        : flagged
      : [];

    for (const entry of batch) {
      const result = await resolveAndPatch(ctx, entry.row, true);
      if (result.status === "unresolved") {
        unresolved.push({
          name: result.name,
          current: result.current,
          reason: result.reason,
        });
      } else {
        repaired.push({ name: result.name, views: result.views });
        if (!result.complete) {
          incomplete.push({ name: result.name, views: result.views });
        }
      }
    }

    return {
      total: scoped.length,
      flagged: flaggedReport,
      counts,
      reResolved: args.reResolve === true,
      checked: batch.length,
      repaired,
      incomplete,
      unresolved,
    };
  }
}

const imageAuditArgs = {
  limit: v.optional(v.number()),
  /** Re-resolve the flagged products instead of only reporting them. */
  reResolve: v.optional(v.boolean()),
  /** Audit just these products. */
  productIds: v.optional(v.array(v.id("products"))),
  /** Compare stored bytes to spot a repeated view. On by default. */
  checkDuplicates: v.optional(v.boolean()),
};

export const auditProductImages = action({
  args: imageAuditArgs,
  handler: async (ctx, args) => {
    const isAdmin = await ctx.runQuery(internal.adminProducts.isAdminUser, {});
    if (!isAdmin) throw new Error("Not authorized");
    return await runImageAudit(ctx, args);
  },
});

/** Same audit for the CLI and ops scripts, without a signed-in admin. */
export const auditProductImagesInternal = internalAction({
  args: imageAuditArgs,
  handler: runImageAudit,
});
