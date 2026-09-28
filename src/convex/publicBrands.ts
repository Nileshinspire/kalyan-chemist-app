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

// ── Homepage "Shop By Brand" ──
/**
 * Brands the admin has explicitly published to the homepage, in their chosen
 * display order. Requires both `isActive` and `showOnHomepage`, so a brand
 * that is deactivated or unpublished leaves the section immediately.
 */
export const homepage = query({
  handler: async (ctx) => {
    const brands = await ctx.db
      .query("brands")
      .withIndex("by_homepage", (q) =>
        q.eq("isActive", true).eq("showOnHomepage", true),
      )
      .collect();

    brands.sort(
      (a, b) => (a.homepageOrder ?? 0) - (b.homepageOrder ?? 0),
    );

    const enriched = await Promise.all(
      brands.map(async (b) => {
        const products = await ctx.db
          .query("products")
          .withIndex("by_brand", (q) => q.eq("brandId", b._id))
          .collect();
        return {
          _id: b._id,
          name: b.name,
          slug: b.slug,
          logoUrl: b.logoUrl ?? null,
          description: b.description ?? null,
          country: b.country ?? null,
          productCount: products.filter((p) => p.isActive).length,
        };
      }),
    );

    return enriched;
  },
});
