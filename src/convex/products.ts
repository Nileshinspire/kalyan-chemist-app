import { query } from "./_generated/server";
import { v } from "convex/values";

// ── List active products (with optional category filter) ──
export const list = query({
  args: {
    categoryId: v.optional(v.id("categories")),
  },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("products")
      .withIndex("by_isActive", (q) => q.eq("isActive", true));

    if (args.categoryId) {
      q = q.filter((q) => q.eq(q.field("categoryId"), args.categoryId));
    }

    return await q.collect();
  },
});

// ── Get a single product by slug ──
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (!product) return null;

    const category = await ctx.db.get(product.categoryId);
    return { ...product, category };
  },
});

// ── Search products by name or description (text search) ──
export const search = query({
  args: {
    query: v.string(),
    categoryId: v.optional(v.id("categories")),
  },
  handler: async (ctx, args) => {
    const searchTerm = args.query.toLowerCase().trim();

    // Get all active products
    let q = ctx.db
      .query("products")
      .withIndex("by_isActive", (q) => q.eq("isActive", true));

    const allProducts = await q.collect();

    // Filter by search term (name, manufacturer, description)
    let filtered = allProducts;
    if (searchTerm) {
      filtered = allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm) ||
          p.manufacturer.toLowerCase().includes(searchTerm) ||
          p.description.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by category
    if (args.categoryId) {
      filtered = filtered.filter((p) => p.categoryId === args.categoryId);
    }

    return filtered;
  },
});

// ── Get products by category slug ──
export const getByCategorySlug = query({
  args: { categorySlug: v.string() },
  handler: async (ctx, args) => {
    const category = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.categorySlug))
      .first();

    if (!category) return { category: null, products: [] };

    const products = await ctx.db
      .query("products")
      .withIndex("by_category", (q) => q.eq("categoryId", category._id))
      .collect();

    return { category, products: products.filter((p) => p.isActive) };
  },
});

// ── Get related products (same category, excluding current) ──
export const getRelated = query({
  args: {
    productId: v.id("products"),
    categoryId: v.id("categories"),
  },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .collect();

    return products
      .filter((p) => p._id !== args.productId && p.isActive)
      .slice(0, 4);
  },
});
