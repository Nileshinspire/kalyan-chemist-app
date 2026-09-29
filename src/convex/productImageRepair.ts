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
import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal as generatedInternal } from "./_generated/api";
import type { FunctionReference } from "convex/server";
import type { Id } from "./_generated/dataModel";
import {
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
  packSize: string;
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
    packSize: row.packSize || undefined,
  };
}

/**
 * Re-resolve the image of one product. Returns the new image URL when a real
 * packshot was verified, otherwise the reason it could not be.
 */
export const repairProductImage = action({
  args: { productId: v.id("products") },
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
  },
  handler: async (ctx, args) => {
    const rows: AuditRow[] = await ctx.runQuery(
      internal.adminProducts.productsForImageAudit,
      {},
    );

    const needsRepair = rows.filter((row) =>
      needsProductImageRepair(row.imageUrl),
    );
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
