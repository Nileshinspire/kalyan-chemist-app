/**
 * Discount engine API — configuration and storefront/admin surfaces.
 *
 * The pricing rules themselves live in the shared pure engine `@/lib/discount`
 * with the DB adapter in `./discountEngine`. This module exposes exactly three
 * things, all backed by the single `discountHighlights` config row:
 *
 *   getPublic  — what the homepage "Minimum {percent}% Off" section renders.
 *                Eligible = active, not excluded, effective discount ≥ the
 *                configured percent, or manually pinned by the admin (still
 *                with a real discount). New products appear here automatically
 *                because the engine prices them the moment they are created.
 *   getConfig  — admin-only: stored config plus a per-product state preview
 *                (which rule applies, effective price) so the Discount Manager
 *                can show auto/override/category/manual/excluded states.
 *   setConfig  — admin-only: validates every percent, normalizes ids, saves,
 *                writes one audit-log row, and reprices only the governed
 *                products. Independent admin-set selling prices are untouched.
 */
import { query, mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import { createEnricher } from "./publicProducts";
import {
  normalizeDiscountPercent,
  resolveProductDiscount,
  selectHomePageDiscounts,
  productDiscountPercent,
  type EngineConfigInput,
} from "../lib/discount";
import {
  loadEngine,
  syncGoverned,
  logEngineChange,
  validateRulePercents,
} from "./discountEngine";

/** Guard used by every admin surface in this module. */
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

/** Every product, newest first — raw material for both surfaces. */
async function productRows(ctx: QueryCtx) {
  const rows = await ctx.db.query("products").collect();
  rows.sort((a, b) => b.createdAt - a.createdAt || a.name.localeCompare(b.name));
  return rows;
}

/**
 * The storefront contract: the configured percent plus the products that
 * qualify right now. `configured` is false while no admin has saved a value,
 * so the page can distinguish "nothing qualifies" from "no rule exists yet".
 */
export const getPublic = query({
  args: {},
  handler: async (ctx) => {
    const config = await readConfig(ctx);
    if (!config) {
      return {
        configured: false,
        discountPercent: 0,
        products: [],
        autoCount: 0,
        manualCount: 0,
        windowOpen: false,
      };
    }

    const engine: EngineConfigInput = {
      isActive: config.isActive ?? true,
      discountPercent: config.discountPercent ?? 0,
      startsAt: config.startsAt ?? null,
      endsAt: config.endsAt ?? null,
      excludedProductIds: (config.excludedProductIds ?? []) as string[],
      productOverrides: (config.productOverrides ?? []) as {
        productId: string;
        discountPercent: number;
      }[],
      categoryRules: (config.categoryRules ?? []) as {
        categoryId: string;
        discountPercent: number;
      }[],
      manualProductIds: (config.manualProductIds ?? []) as string[],
    };

    const rows = (await productRows(ctx)).filter((p) => p.isActive);
    const now = Date.now();
    const selection = selectHomePageDiscounts(rows, engine, now);

    const enrich = await createEnricher(ctx);
    const products = await Promise.all(selection.products.map(enrich));

    return {
      configured: true,
      discountPercent: selection.percent,
      products,
      autoCount: selection.autoCount,
      manualCount: selection.manualCount,
      windowOpen: selection.windowOpen,
    };
  },
});

/** The editable configuration (admin only) — what the Discount Manager loads. */
export const getConfig = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const config = await readConfig(ctx);
    const engine: EngineConfigInput = config
      ? {
          isActive: config.isActive ?? true,
          discountPercent: config.discountPercent ?? 0,
          startsAt: config.startsAt ?? null,
          endsAt: config.endsAt ?? null,
          excludedProductIds: (config.excludedProductIds ?? []) as string[],
          productOverrides: (config.productOverrides ?? []) as {
            productId: string;
            discountPercent: number;
          }[],
          categoryRules: (config.categoryRules ?? []) as {
            categoryId: string;
            discountPercent: number;
          }[],
          manualProductIds: (config.manualProductIds ?? []) as string[],
        }
      : { isActive: false, discountPercent: 0 };

    const now = Date.now();
    const rows = await productRows(ctx);
    const selection = selectHomePageDiscounts(
      rows.filter((p) => p.isActive),
      engine,
      now,
    );

    // Category names for the admin's category-rule editor.
    const categories = await ctx.db.query("categories").collect();

    // Per-product state preview so the admin sees which rule prices each row.
    const productStates = rows.map((p) => {
      const res = resolveProductDiscount(
        {
          _id: p._id,
          price: p.price,
          discountPrice: p.discountPrice ?? null,
          categoryId: p.categoryId,
          isActive: p.isActive,
          discountSource: p.discountSource ?? null,
        },
        engine,
        now,
      );
      const listed = selection.products.some((s) => s._id === p._id);
      return {
        _id: p._id,
        name: p.name,
        manufacturer: p.manufacturer,
        categoryName: categories.find((c) => c._id === p.categoryId)?.name ?? "Unknown",
        isActive: p.isActive,
        price: p.price,
        discountPrice: p.discountPrice ?? null,
        discountSource: p.discountSource ?? null,
        status: res.status,
        label: res.label,
        effectivePercent: res.percent,
        effectivePrice: res.effectivePrice,
        listed,
        overriddenByOverride: (engine.productOverrides ?? []).some(
          (o) => o.productId === p._id,
        ),
      };
    });

    const statusCounts = {
      auto: 0,
      override: 0,
      category: 0,
      "manual-price": 0,
      excluded: 0,
      ineligible: 0,
    } as Record<string, number>;
    for (const state of productStates) statusCounts[state.status] += 1;

    return {
      configured: Boolean(config),
      discountPercent: engine.discountPercent ?? 0,
      isActive: config ? (config.isActive ?? true) : false,
      startsAt: config?.startsAt ?? null,
      endsAt: config?.endsAt ?? null,
      manualProductIds: (engine.manualProductIds ?? []).map(String),
      excludedProductIds: (engine.excludedProductIds ?? []).map(String),
      productOverrides: (engine.productOverrides ?? []).map((o) => ({
        productId: String(o.productId),
        discountPercent: o.discountPercent,
      })),
      categoryRules: (engine.categoryRules ?? []).map((c) => ({
        categoryId: String(c.categoryId),
        categoryName: categories.find((cat) => cat._id === c.categoryId)?.name ?? "Unknown",
        discountPercent: c.discountPercent,
      })),
      updatedAt: config?.updatedAt ?? null,
      lineCounts: {
        products: selection.products.length,
        auto: selection.autoCount,
        manual: selection.manualCount,
        droppedManualIds: selection.droppedManualIds,
      },
      windowOpen: selection.windowOpen,
      productStates,
      statusCounts,
    };
  },
});

/** Argument shape for setConfig (arrays omitted preserve the stored values). */
const setConfigArgs = {
  discountPercent: v.number(),
  manualProductIds: v.array(v.id("products")),
  isActive: v.optional(v.boolean()),
  startsAt: v.optional(v.number()),
  endsAt: v.optional(v.number()),
  /** Omitted = keep the stored list; empty array = clear the list. */
  excludedProductIds: v.optional(v.array(v.id("products"))),
  productOverrides: v.optional(
    v.array(
      v.object({
        productId: v.id("products"),
        discountPercent: v.number(),
      }),
    ),
  ),
  categoryRules: v.optional(
    v.array(
      v.object({
        categoryId: v.id("categories"),
        discountPercent: v.number(),
      }),
    ),
  ),
};

export const setConfig = mutation({
  args: setConfigArgs,
  handler: async (ctx, args) => {
    const userId = await requireAdmin(ctx);
    const now = Date.now();

    // ── Validate every percent the payload carries ──
    const overridePercentValues = (args.productOverrides ?? []).map((o) => o.discountPercent);
    const categoryRulePercentValues = (args.categoryRules ?? []).map((c) => c.discountPercent);
    validateRulePercents([args.discountPercent, ...overridePercentValues], "Discount percentage");
    validateRulePercents(categoryRulePercentValues, "Category promotion percentage");

    if (args.startsAt !== undefined && args.endsAt !== undefined && args.endsAt < args.startsAt) {
      throw new Error("Promotion end date must be after its start date.");
    }

    // ── Normalize manual picks: unique, real products only ──
    const manualProductIds: Id<"products">[] = [];
    const seenManual = new Set<string>();
    for (const id of args.manualProductIds) {
      const key = String(id);
      if (seenManual.has(key)) continue;
      const product = await ctx.db.get(id);
      if (!product) continue;
      seenManual.add(key);
      manualProductIds.push(id);
    }

    // ── Exclusions: unique, real products ──
    let excludedProductIds: Id<"products">[] | undefined;
    if (args.excludedProductIds !== undefined) {
      const seen = new Set<string>();
      excludedProductIds = [];
      for (const id of args.excludedProductIds) {
        const key = String(id);
        if (seen.has(key)) continue;
        const product = await ctx.db.get(id);
        if (!product) continue;
        seen.add(key);
        excludedProductIds.push(id);
      }
    }

    // ── Overrides: unique product, existing product, validated percent ──
    let productOverrides:
      | { productId: Id<"products">; discountPercent: number }[]
      | undefined;
    if (args.productOverrides !== undefined) {
      const seen = new Set<string>();
      productOverrides = [];
      for (const o of args.productOverrides) {
        const key = String(o.productId);
        if (seen.has(key)) continue;
        const product = await ctx.db.get(o.productId);
        if (!product || product.price <= 0) continue; // stale or invalid rows are dropped
        seen.add(key);
        productOverrides.push({
          productId: o.productId,
          discountPercent: normalizeDiscountPercent(o.discountPercent),
        });
      }
    }

    // ── Category rules: unique category, existing category, validated percent ──
    let categoryRules:
      | { categoryId: Id<"categories">; discountPercent: number }[]
      | undefined;
    if (args.categoryRules !== undefined) {
      const seen = new Set<string>();
      categoryRules = [];
      for (const c of args.categoryRules) {
        const key = String(c.categoryId);
        if (seen.has(key)) continue;
        const category = await ctx.db.get(c.categoryId);
        if (!category) continue;
        seen.add(key);
        categoryRules.push({
          categoryId: c.categoryId,
          discountPercent: normalizeDiscountPercent(c.discountPercent),
        });
      }
    }

    const existing = await readConfig(ctx);
    const previousPercent = existing?.discountPercent ?? 0;

    const patch: Record<string, unknown> = {
      discountPercent: normalizeDiscountPercent(args.discountPercent),
      manualProductIds,
      updatedBy: userId,
      updatedAt: now,
    };
    if (args.isActive !== undefined) patch.isActive = args.isActive;
    if (args.startsAt !== undefined) patch.startsAt = args.startsAt;
    if (args.endsAt !== undefined) patch.endsAt = args.endsAt;
    if (excludedProductIds !== undefined) patch.excludedProductIds = excludedProductIds;
    if (productOverrides !== undefined) patch.productOverrides = productOverrides;
    if (categoryRules !== undefined) patch.categoryRules = categoryRules;

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("discountHighlights", patch as any);
    }

    // ── Reprice only the governed products; manual prices are untouched ──
    const sync = await syncGoverned(ctx);

    // ── Audit trail (existing auditLogs table) ──
    const changes: string[] = [
      `Default rule: ${previousPercent}% → ${patch.discountPercent}%, window ${
        args.isActive === undefined ? "unchanged" : args.isActive ? "active" : "paused"
      }`,
      `${manualProductIds.length} pinned, ${
        excludedProductIds?.length ?? "(unchanged)"
      } excluded ids, ${productOverrides?.length ?? "(unchanged)"} overrides, ${
        categoryRules?.length ?? "(unchanged)"
      } category rules`,
      `Engine repriced ${sync.priced} product(s), cleaned ${sync.cleaned}`,
    ];
    const admin = await ctx.db.get(userId);
    await logEngineChange(ctx, userId, admin?.name ?? admin?.email ?? null, changes.join(" · "));

    return {
      discountPercent: patch.discountPercent,
      manualCount: manualProductIds.length,
      sync,
    };
  },
});

/**
 * Legacy-compat helper kept for any caller still formatting a percent label
 * with the stored price fields (same rounding as the engine badge).
 */
export const labelForStoredPrice = productDiscountPercent;
