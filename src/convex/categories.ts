import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// ── List active categories with product counts (public) ──
export const list = query({
  handler: async (ctx) => {
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    categories.sort((a, b) => a.sortOrder - b.sortOrder);

    const enriched = await Promise.all(
      categories.map(async (c) => {
        const products = await ctx.db
          .query("products")
          .withIndex("by_category", (q) => q.eq("categoryId", c._id))
          .collect();
        const activeProducts = products.filter((p) => p.isActive);
        return { ...c, productCount: activeProducts.length };
      })
    );

    return enriched;
  },
});

// ── Get a single category by slug ──
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

// ── Internal: upsert category (for seed) ──
export const upsertCategory = internalMutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        description: args.description,
        sortOrder: args.sortOrder,
      });
      return existing._id;
    }

    return await ctx.db.insert("categories", {
      name: args.name,
      slug: args.slug,
      description: args.description,
      isActive: true,
      sortOrder: args.sortOrder,
    });
  },
});

// ── Internal: upsert product (for seed) ──
export const upsertProduct = internalMutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    price: v.number(),
    manufacturer: v.string(),
    dosage: v.string(),
    packSize: v.string(),
    prescriptionRequired: v.boolean(),
    stockQuantity: v.number(),
    imageUrl: v.optional(v.string()),
    categoryId: v.id("categories"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    const now = Date.now();
    const data = {
      name: args.name,
      slug: args.slug,
      description: args.description,
      price: args.price,
      manufacturer: args.manufacturer,
      dosage: args.dosage,
      packSize: args.packSize,
      prescriptionRequired: args.prescriptionRequired,
      stockQuantity: args.stockQuantity,
      imageUrl: args.imageUrl,
      categoryId: args.categoryId,
      isActive: true,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }

    return await ctx.db.insert("products", {
      ...data,
      createdAt: now,
    });
  },
});
