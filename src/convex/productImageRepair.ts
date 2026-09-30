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
import { action, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal as generatedInternal } from "./_generated/api";
import type { FunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";
import {
  isVerifiedProductImage,
  needsProductImageRepair,
  resolveAndStore,
  MAX_PRODUCT_IMAGES,
  type ProductIdentity,
} from "./productImageResolver";

type AuditRow = {
  id: Id<"products">;
  name: string;
  imageUrl: string;
  additionalImages: string[];
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

/**
 * Keep only genuine, verified, distinct views — fresh results first, then any
 * still-valid stored views — and cap the total at `MAX_PRODUCT_IMAGES`. This
 * means a re-resolve can add views but never downgrade or duplicate them.
 */
export function mergeAdditionalImages(
  existing: string[],
  incoming: string[],
  imageUrl: string,
): string[] {
  const out: string[] = [];
  const seen = new Set([imageUrl]);
  for (const raw of [...incoming, ...existing]) {
    const url = (raw ?? "").trim();
    if (!url || seen.has(url) || !isVerifiedProductImage(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= MAX_PRODUCT_IMAGES - 1) break;
  }
  return out;
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

    const outcome = await resolveAndStore(ctx, identityOf(row));
    if (!outcome.ok) {
      return { ok: false as const, message: outcome.message };
    }

    const additionalImages = mergeAdditionalImages(
      row.additionalImages,
      outcome.additionalImages,
      outcome.imageUrl,
    );

    await ctx.runMutation(internal.adminProducts.setProductImage, {
      productId: row.id,
      imageUrl: outcome.imageUrl,
      additionalImages,
    });

    return {
      ok: true as const,
      imageUrl: outcome.imageUrl,
      additionalImages,
      matchedName: outcome.matchedName,
      replaced: outcome.imageUrl !== row.imageUrl,
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
      candidates = rows.filter(
        (row) =>
          needsProductImageRepair(row.imageUrl) ||
          needsAdditionalImagesRepair(row.additionalImages, row.imageUrl),
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

    for (const row of batch) {
      let outcome;
      try {
        outcome = await resolveAndStore(ctx, identityOf(row));
      } catch (error) {
        console.error("[productImageRepair] failed for", row.name, error);
        unresolved.push({
          name: row.name,
          current: row.imageUrl,
          reason: "lookup-failed",
        });
        continue;
      }

      if (!outcome.ok) {
        unresolved.push({
          name: row.name,
          current: row.imageUrl,
          reason: outcome.message,
        });
        continue;
      }

      const additionalImages = mergeAdditionalImages(
        row.additionalImages,
        outcome.additionalImages,
        outcome.imageUrl,
      );

      const imageSame = outcome.imageUrl === row.imageUrl;
      const gallerySame =
        additionalImages.length === row.additionalImages.length &&
        additionalImages.every((url, i) => url === row.additionalImages[i]);
      if (imageSame && gallerySame) {
        unchanged.push(row.name);
        continue;
      }

      repaired.push({
        name: row.name,
        from: row.imageUrl,
        to: outcome.imageUrl,
        views: additionalImages.length,
      });

      if (args.dryRun !== true) {
        await ctx.runMutation(internal.adminProducts.setProductImage, {
          productId: row.id,
          imageUrl: outcome.imageUrl,
          additionalImages,
        });
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
    };
  },
});
