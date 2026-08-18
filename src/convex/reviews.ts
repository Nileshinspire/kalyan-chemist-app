import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── List reviews for a product ──
export const listByProduct = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .order("desc")
      .collect();

    const reviewsWithUsers = await Promise.all(
      reviews.map(async (review) => {
        const user = await ctx.db.get(review.userId);
        return {
          ...review,
          userName: user?.name || "Anonymous",
          userInitial: user?.name?.[0]?.toUpperCase() || "A",
        };
      })
    );

    return reviewsWithUsers;
  },
});

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

// ── Check if current user has reviewed a product ──
export const hasReviewed = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return false;

    const existing = await ctx.db
      .query("reviews")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId)
      )
      .first();

    return existing !== null;
  },
});

// ── Create a review ──
export const create = mutation({
  args: {
    productId: v.id("products"),
    rating: v.number(),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    if (args.rating < 1 || args.rating > 5) throw new Error("Rating must be 1-5");
    if (!args.title.trim()) throw new Error("Title is required");

    // Check for existing review
    const existing = await ctx.db
      .query("reviews")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId)
      )
      .first();

    if (existing) throw new Error("You have already reviewed this product");

    const reviewId = await ctx.db.insert("reviews", {
      userId,
      productId: args.productId,
      rating: args.rating,
      title: args.title.trim(),
      body: args.body.trim(),
      createdAt: Date.now(),
    });

    return { success: true, reviewId };
  },
});
