import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

async function requireAdmin(ctx: { db: any; auth: any }) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (user?.role !== "admin") throw new Error("Not authorized");
  return userId;
}

// ── Admin: List all brands ──
export const list = query({
  args: {
    search: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let brands = await ctx.db.query("brands").collect();

    if (args.search) {
      const s = args.search.toLowerCase();
      brands = brands.filter((b) => b.name.toLowerCase().includes(s));
    }

    if (args.isActive !== undefined) {
      brands = brands.filter((b) => b.isActive === args.isActive);
    }

    brands.sort((a, b) => a.sortOrder - b.sortOrder);

    // Enrich with product count
    const enriched = await Promise.all(
      brands.map(async (b) => {
        const products = await ctx.db
          .query("products")
          .withIndex("by_brand", (q) => q.eq("brandId", b._id))
          .collect();
        return { ...b, productCount: products.length };
      })
    );

    return enriched;
  },
});

// ── Admin: Get a single brand ──
export const get = query({
  args: { brandId: v.id("brands") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.brandId);
  },
});

// ── Admin: Create a brand ──
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const existing = await ctx.db
      .query("brands")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) throw new Error("A brand with this slug already exists");

    // Get next sort order
    const allBrands = await ctx.db.query("brands").collect();
    const maxSort = allBrands.reduce((max, b) => Math.max(max, b.sortOrder), 0);

    const id: Id<"brands"> = await ctx.db.insert("brands", {
      ...args,
      isActive: true,
      sortOrder: maxSort + 1,
    });
    return id;
  },
});

// ── Admin: Update a brand ──
export const update = mutation({
  args: {
    brandId: v.id("brands"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const { brandId, ...updates } = args;

    const existing = await ctx.db
      .query("brands")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing && existing._id !== brandId) {
      throw new Error("A brand with this slug already exists");
    }

    await ctx.db.patch(brandId, updates);
    return brandId;
  },
});

// ── Admin: Delete a brand ──
export const remove = mutation({
  args: { brandId: v.id("brands") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const products = await ctx.db
      .query("products")
      .withIndex("by_brand", (q) => q.eq("brandId", args.brandId))
      .collect();
    if (products.length > 0) {
      throw new Error(
        `Cannot delete brand: ${products.length} product(s) still use it. Reassign them first.`
      );
    }

    await ctx.db.delete(args.brandId);
    return { success: true };
  },
});

// ── Admin: Toggle brand active status ──
export const toggleActive = mutation({
  args: { brandId: v.id("brands"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.brandId, { isActive: args.isActive });
    return { success: true };
  },
});
