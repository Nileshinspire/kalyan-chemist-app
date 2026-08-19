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

// ── Admin: List all categories ──
export const list = query({
  args: {
    search: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let categories = await ctx.db.query("categories").collect();

    if (args.search) {
      const s = args.search.toLowerCase();
      categories = categories.filter((c) => c.name.toLowerCase().includes(s));
    }

    if (args.isActive !== undefined) {
      categories = categories.filter((c) => c.isActive === args.isActive);
    }

    // Sort by sortOrder
    categories.sort((a, b) => a.sortOrder - b.sortOrder);

    // Enrich with product count
    const enriched = await Promise.all(
      categories.map(async (c) => {
        const products = await ctx.db
          .query("products")
          .withIndex("by_category", (q) => q.eq("categoryId", c._id))
          .collect();
        return { ...c, productCount: products.length };
      })
    );

    return enriched;
  },
});

// ── Admin: Get a single category ──
export const get = query({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.categoryId);
  },
});

// ── Admin: Create a category ──
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) throw new Error("A category with this slug already exists");

    const id: Id<"categories"> = await ctx.db.insert("categories", {
      ...args,
      isActive: true,
    });
    return id;
  },
});

// ── Admin: Update a category ──
export const update = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const { categoryId, ...updates } = args;

    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing && existing._id !== categoryId) {
      throw new Error("A category with this slug already exists");
    }

    await ctx.db.patch(categoryId, updates);
    return categoryId;
  },
});

// ── Admin: Delete a category ──
export const remove = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Check if products use this category
    const products = await ctx.db
      .query("products")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .collect();
    if (products.length > 0) {
      throw new Error(
        `Cannot delete category: ${products.length} product(s) still use it. Reassign them first.`
      );
    }

    await ctx.db.delete(args.categoryId);
    return { success: true };
  },
});

// ── Admin: Toggle category active status ──
export const toggleActive = mutation({
  args: { categoryId: v.id("categories"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.categoryId, { isActive: args.isActive });
    return { success: true };
  },
});
