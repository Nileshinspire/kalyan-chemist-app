/**
 * Homepage exact-discount section — admin configuration + product discovery.
 *
 * The admin sets ONE whole percentage (any value, e.g. 25 or 37). The section
 * then shows the products whose OWN calculated discount is exactly that
 * percentage, discovered across every active product in every category, plus
 * the products the admin picked by hand — but only while those picks still
 * match. A price change therefore removes a product from the section on the
 * next read; nothing is ever shown on the strength of a label or a manual
 * typing.
 *
 * Matching uses `productDiscountPercent` from `@/lib/discount`, the same
 * function the product card renders its `% OFF` badge from, so the number a
 * customer sees and the number the section matches on cannot disagree.
 *
 * The configuration is a single row in `discountHighlights`, written only by
 * an admin (`setConfig`); the storefront reads it through `getPublic`, which
 * exposes nothing but the percentage, the resolved products and a flag saying
 * whether an admin has ever saved a value.
 */
import { query, mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { createEnricher } from "./publicProducts";
import {
  normalizeDiscountPercent,
  selectDiscountProducts,
} from "../lib/discount";

/**
 * What the section advertises until an admin saves a value. The percentage is
 * still applied dynamically — changing it in the Discount Manager changes the
 * heading and the matched products with no code change.
 */
export const DEFAULT_DISCOUNT_PERCENT = 50;

/** ── Admin guard (same pattern as the other admin-owned modules) ── */
async function requireAdmin(ctx: { db: any; auth: any }) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (user?.role !== "admin") throw new Error("Admin access required");
  return userId;
}

/** The stored configuration, or null when no admin has saved one yet. */
async function readConfig(ctx: QueryCtx) {
  return await ctx.db.query("discountHighlights").first();
}

/** Every active product, newest first — the raw material for the match. */
async function activeProductRows(ctx: QueryCtx) {
  const rows = await ctx.db
    .query("products")
    .withIndex("by_isActive", (q) => q.eq("isActive", true))
    .collect();
  rows.sort((a, b) => b.createdAt - a.createdAt || a.name.localeCompare(b.name));
  return rows;
}

/**
 * The storefront contract: the configured percentage and the products that
 * match it right now. `configured` is false while no admin has saved a value,
 * so the page can tell the difference between "nothing matches" and "nobody has
 * chosen a percentage yet".
 */
export const getPublic = query({
  args: {},
  handler: async (ctx) => {
    const config = await readConfig(ctx);
    const discountPercent = config?.discountPercent ?? DEFAULT_DISCOUNT_PERCENT;
    const manualProductIds = (config?.manualProductIds ?? []) as Id<"products">[];

    const rows = await activeProductRows(ctx);
    const selected = selectDiscountProducts(rows, discountPercent, manualProductIds);

    const enrich = await createEnricher(ctx);
    const products = await Promise.all(selected.products.map(enrich));

    return {
      configured: Boolean(config),
      discountPercent,
      products,
      autoCount: selected.autoCount,
      manualCount: selected.manualCount,
    };
  },
});

/** The editable configuration (admin only) — what the Discount Manager loads. */
export const getConfig = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const config = await readConfig(ctx);
    const discountPercent = config?.discountPercent ?? DEFAULT_DISCOUNT_PERCENT;

    const rows = await activeProductRows(ctx);
    const manualProductIds = (config?.manualProductIds ?? []) as Id<"products">[];
    const selected = selectDiscountProducts(rows, discountPercent, manualProductIds);

    return {
      configured: Boolean(config),
      discountPercent,
      manualProductIds: manualProductIds.map(String),
      updatedAt: config?.updatedAt ?? null,
      matchCount: selected.products.length,
      autoCount: selected.autoCount,
      manualCount: selected.manualCount,
      /** Picks kept even though their price no longer qualifies — shown as such. */
      droppedManualIds: selected.droppedManualIds,
    };
  },
});

/**
 * Save the configuration (admin only). The percentage is validated as a whole
 * number, duplicate picks are collapsed, and a pick that no longer exists is
 * dropped rather than stored, so the saved row always describes real products.
 */
export const setConfig = mutation({
  args: {
    discountPercent: v.number(),
    manualProductIds: v.array(v.id("products")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAdmin(ctx);
    const discountPercent = normalizeDiscountPercent(args.discountPercent);

    const manualProductIds: Id<"products">[] = [];
    const seen = new Set<string>();
    for (const id of args.manualProductIds) {
      const key = String(id);
      if (seen.has(key)) continue;
      const product = await ctx.db.get(id);
      if (!product) continue;
      seen.add(key);
      manualProductIds.push(id);
    }

    const now = Date.now();
    const existing = await readConfig(ctx);
    if (existing) {
      await ctx.db.patch(existing._id, {
        discountPercent,
        manualProductIds,
        updatedBy: userId,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("discountHighlights", {
        discountPercent,
        manualProductIds,
        updatedBy: userId,
        updatedAt: now,
      });
    }

    return { discountPercent, manualProductIds };
  },
});
