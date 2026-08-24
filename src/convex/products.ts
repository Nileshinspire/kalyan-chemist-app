import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

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

// ── Get a single product by ID ──
export const getById = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) return null;
    const category = await ctx.db.get(product.categoryId);
    return { ...product, category };
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

// ── Count how many units of a product were sold in the last 7 days ──
export const boughtInLast7Days = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const orders = await ctx.db.query("orders").collect();

    let totalSold = 0;
    for (const order of orders) {
      if (order.status === "cancelled") continue;
      if (order.createdAt < sevenDaysAgo) continue;
      for (const item of order.items) {
        if (item.productId === args.productId) {
          totalSold += item.quantity;
        }
      }
    }

    return totalSold;
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

// ── Get recent purchasers of a product (last 7 days) with optional reviews ──
export const getRecentPurchasers = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Find all recent non-cancelled orders containing this product
    const orders = await ctx.db
      .query("orders")
      .collect();

    const purchaserMap = new Map<
      string,
      { userId: string; quantity: number; purchaseDate: number }
    >();

    for (const order of orders) {
      if (order.status === "cancelled") continue;
      if (order.createdAt < sevenDaysAgo) continue;
      for (const item of order.items) {
        if (item.productId === args.productId) {
          const key = order.userId;
          const existing = purchaserMap.get(key);
          if (existing) {
            existing.quantity += item.quantity;
            // Keep the most recent purchase date
            if (order.createdAt > existing.purchaseDate) {
              existing.purchaseDate = order.createdAt;
            }
          } else {
            purchaserMap.set(key, {
              userId: order.userId,
              quantity: item.quantity,
              purchaseDate: order.createdAt,
            });
          }
        }
      }
    }

    // Build result with user names and reviews
    const results: Array<{
      customerName: string;
      purchaseDate: number;
      quantity: number;
      review: {
        rating: number;
        title: string;
        body: string;
        createdAt: number;
      } | null;
    }> = [];

    for (const entry of purchaserMap.values()) {
      const user = await ctx.db.get(entry.userId as any);
      const customerName = (user && "name" in user ? (user as any).name : undefined) || "Customer";

      // Look for a review by this user for this product
      let review: {
        rating: number;
        title: string;
        body: string;
        createdAt: number;
      } | null = null;
      try {
        const reviews = await ctx.db
          .query("reviews")
          .withIndex("by_user_product", (q) =>
            q.eq("userId", entry.userId as any).eq("productId", args.productId)
          )
          .collect();
        if (reviews.length > 0) {
          const r = reviews[0];
          review = {
            rating: r.rating,
            title: r.title,
            body: r.body,
            createdAt: r.createdAt,
          };
        }
      } catch {
        // No review found
      }

      results.push({
        customerName,
        purchaseDate: entry.purchaseDate,
        quantity: entry.quantity,
        review,
      });
    }

    // Sort by purchase date (most recent first)
    results.sort((a, b) => b.purchaseDate - a.purchaseDate);

    return results;
  },
});
