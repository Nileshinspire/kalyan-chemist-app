import { query } from "./_generated/server";
import { v } from "convex/values";

// ── Full search across name, composition, manufacturer, brand ──
export const search = query({
  args: {
    query: v.string(),
    categoryId: v.optional(v.id("categories")),
    brandId: v.optional(v.id("brands")),
    minPrice: v.optional(v.number()),
    maxPrice: v.optional(v.number()),
    prescriptionRequired: v.optional(v.boolean()),
    inStock: v.optional(v.boolean()),
    sortBy: v.optional(v.union(
      v.literal("relevance"),
      v.literal("price_asc"),
      v.literal("price_desc"),
      v.literal("discount"),
      v.literal("newest"),
    )),
  },
  handler: async (ctx, args) => {
    const searchTerm = args.query.toLowerCase().trim();

    let products = await ctx.db
      .query("products")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    // Text search across multiple fields
    if (searchTerm) {
      products = products.filter((p) => {
        const haystack = [
          p.name,
          p.description,
          p.manufacturer,
          p.sku,
          p.composition,
          p.dosage,
          p.strength,
          p.form,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(searchTerm);
      });
    }

    // Filters
    if (args.categoryId) {
      products = products.filter((p) => p.categoryId === args.categoryId);
    }
    if (args.brandId) {
      products = products.filter((p) => p.brandId === args.brandId);
    }
    if (args.minPrice !== undefined) {
      products = products.filter(
        (p) => (p.discountPrice ?? p.price) >= args.minPrice!
      );
    }
    if (args.maxPrice !== undefined) {
      products = products.filter(
        (p) => (p.discountPrice ?? p.price) <= args.maxPrice!
      );
    }
    if (args.prescriptionRequired !== undefined) {
      products = products.filter(
        (p) => p.prescriptionRequired === args.prescriptionRequired
      );
    }
    if (args.inStock) {
      products = products.filter((p) => p.stockQuantity > 0);
    }

    // Enrich with category and brand names
    const enriched = await Promise.all(
      products.map(async (p) => {
        const category = await ctx.db.get(p.categoryId);
        const brand = p.brandId ? await ctx.db.get(p.brandId) : null;
        return {
          ...p,
          categoryName: category?.name ?? "Uncategorized",
          categorySlug: category?.slug ?? "",
          brandName: brand?.name ?? null,
          brandSlug: brand?.slug ?? null,
        };
      })
    );

    // Sort
    const sortBy = args.sortBy ?? "relevance";
    enriched.sort((a, b) => {
      switch (sortBy) {
        case "price_asc":
          return (a.discountPrice ?? a.price) - (b.discountPrice ?? b.price);
        case "price_desc":
          return (b.discountPrice ?? b.price) - (a.discountPrice ?? a.price);
        case "discount": {
          const discA = a.discountPrice ? (a.price - a.discountPrice) / a.price : 0;
          const discB = b.discountPrice ? (b.price - b.discountPrice) / b.price : 0;
          return discB - discA;
        }
        case "newest":
          return b.createdAt - a.createdAt;
        case "relevance":
        default: {
          // Name match gets priority, then recency
          if (searchTerm) {
            const aName = a.name.toLowerCase().includes(searchTerm) ? 1 : 0;
            const bName = b.name.toLowerCase().includes(searchTerm) ? 1 : 0;
            if (aName !== bName) return bName - aName;
          }
          return b.createdAt - a.createdAt;
        }
      }
    });

    return enriched;
  },
});

// ── Autocomplete suggestions ──
export const autocomplete = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const searchTerm = args.query.toLowerCase().trim();
    if (!searchTerm || searchTerm.length < 2) return [];

    const products = await ctx.db
      .query("products")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    const suggestions: Array<{ type: "product" | "category" | "brand"; name: string; slug: string; id: string }> = [];

    // Product name matches
    for (const p of products) {
      if (p.name.toLowerCase().includes(searchTerm)) {
        suggestions.push({
          type: "product",
          name: p.name,
          slug: p.slug,
          id: p._id,
        });
      }
    }

    // Category matches
    const categories = await ctx.db.query("categories").collect();
    for (const c of categories) {
      if (c.isActive && c.name.toLowerCase().includes(searchTerm)) {
        suggestions.push({
          type: "category",
          name: c.name,
          slug: c.slug,
          id: c._id,
        });
      }
    }

    // Brand matches
    const brands = await ctx.db.query("brands").collect();
    for (const b of brands) {
      if (b.isActive && b.name.toLowerCase().includes(searchTerm)) {
        suggestions.push({
          type: "brand",
          name: b.name,
          slug: b.slug,
          id: b._id,
        });
      }
    }

    return suggestions.slice(0, args.limit ?? 8);
  },
});

// ── Popular / bestseller products (by stock movement / recent orders approximation) ──
export const popular = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // Use createdAt as a proxy for featured/popular for now
    const products = await ctx.db
      .query("products")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    // Get all orders to count product popularity
    const orders = await ctx.db.query("orders").collect();
    const productOrderCount = new Map<string, number>();
    for (const order of orders) {
      for (const item of order.items) {
        const key = item.productId as string;
        productOrderCount.set(key, (productOrderCount.get(key) ?? 0) + item.quantity);
      }
    }

    // Enrich and sort by order count, then by newest
    const enriched = await Promise.all(
      products.map(async (p) => {
        const category = await ctx.db.get(p.categoryId);
        const brand = p.brandId ? await ctx.db.get(p.brandId) : null;
        return {
          ...p,
          categoryName: category?.name ?? "Uncategorized",
          categorySlug: category?.slug ?? "",
          brandName: brand?.name ?? null,
          orderCount: productOrderCount.get(p._id as string) ?? 0,
        };
      })
    );

    enriched.sort((a, b) => b.orderCount - a.orderCount || b.createdAt - a.createdAt);
    return enriched.slice(0, args.limit ?? 8);
  },
});

// ── New arrivals (products added within the last 30 days, newest first) ──
export const newArrivals = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    // Rolling ~30-day window based on the product's actual creation date.
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const products = await ctx.db
      .query("products")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    const recent = products
      .filter((p) => p.createdAt >= cutoff)
      .sort((a, b) => b.createdAt - a.createdAt);

    // Enrich with category and brand names (same shape the product cards use)
    const enriched = await Promise.all(
      recent.slice(0, args.limit ?? 10).map(async (p) => {
        const category = await ctx.db.get(p.categoryId);
        const brand = p.brandId ? await ctx.db.get(p.brandId) : null;
        return {
          ...p,
          categoryName: category?.name ?? "Uncategorized",
          categorySlug: category?.slug ?? "",
          brandName: brand?.name ?? null,
        };
      })
    );

    return enriched;
  },
});

// ── Featured products (highest discount) ──
export const featured = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    const withDiscount = products
      .filter((p) => p.discountPrice && p.discountPrice < p.price)
      .map((p) => ({
        discountPercent: Math.round(((p.price - (p.discountPrice ?? p.price)) / p.price) * 100),
        product: p,
      }))
      .sort((a, b) => b.discountPercent - a.discountPercent);

    const enriched = await Promise.all(
      withDiscount.slice(0, args.limit ?? 8).map(async (item) => {
        const category = await ctx.db.get(item.product.categoryId);
        const brand = item.product.brandId ? await ctx.db.get(item.product.brandId) : null;
        return {
          ...item.product,
          categoryName: category?.name ?? "Uncategorized",
          categorySlug: category?.slug ?? "",
          brandName: brand?.name ?? null,
          discountPercent: item.discountPercent,
        };
      })
    );

    return enriched;
  },
});
