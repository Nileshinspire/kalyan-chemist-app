import { query } from "./_generated/server";

// ── List active brands with product counts (public) ──
export const list = query({
  handler: async (ctx) => {
    const brands = await ctx.db
      .query("brands")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    brands.sort((a, b) => a.sortOrder - b.sortOrder);

    const enriched = await Promise.all(
      brands.map(async (b) => {
        const products = await ctx.db
          .query("products")
          .withIndex("by_brand", (q) => q.eq("brandId", b._id))
          .collect();
        const activeProducts = products.filter((p) => p.isActive);
        return { ...b, productCount: activeProducts.length };
      })
    );

    return enriched;
  },
});
