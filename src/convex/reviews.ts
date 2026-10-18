import { query } from "./_generated/server";
import { v } from "convex/values";

// ── Get average rating for a product ──
export const getAverageRating = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();

    if (reviews.length === 0) return { average: 0, count: 0 };

    const total = reviews.reduce((sum, r) => sum + r.rating, 0);
    return {
      average: Math.round((total / reviews.length) * 10) / 10,
      count: reviews.length,
    };
  },
});
