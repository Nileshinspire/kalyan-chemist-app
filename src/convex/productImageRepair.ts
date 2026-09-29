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
  type ProductIdentity,
} from "./productImageResolver";

type AuditRow = {
  id: Id<"products">;
  name: string;
  imageUrl: string;
  manufacturer: string;
  composition: string;
  form: string;
  strength: string;
  dosage: string;
  packSize: string;
  sku: string;
};

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
      { productId: Id<"products">; imageUrl: string },
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

    if (outcome.imageUrl !== row.imageUrl) {
      await ctx.runMutation(internal.adminProducts.setProductImage, {
        productId: row.id,
        imageUrl: outcome.imageUrl,
      });
    }

    return {
      ok: true as const,
      imageUrl: outcome.imageUrl,
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
      candidates = rows.filter((row) => needsProductImageRepair(row.imageUrl));
    }
    const needsRepair = candidates;
    const batch = args.limit ? needsRepair.slice(0, args.limit) : needsRepair;

    const repaired: { name: string; from: string; to: string }[] = [];
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

      if (outcome.imageUrl === row.imageUrl) {
        unchanged.push(row.name);
        continue;
      }

      repaired.push({
        name: row.name,
        from: row.imageUrl,
        to: outcome.imageUrl,
      });

      if (args.dryRun !== true) {
        await ctx.runMutation(internal.adminProducts.setProductImage, {
          productId: row.id,
          imageUrl: outcome.imageUrl,
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
