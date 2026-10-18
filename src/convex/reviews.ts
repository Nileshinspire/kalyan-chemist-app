import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

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

// ── List a product's reviews, newest first, with the reviewer's display name ──
export const listByProduct = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const reviews = await ctx.db
      .query("reviews")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();

    const withUsers = await Promise.all(
      reviews.map(async (review) => {
        const user = await ctx.db.get(review.userId);
        const name =
          (user && "name" in user && typeof user.name === "string" && user.name.trim()) ||
          "Customer";
        return {
          ...review,
          userName: name,
          userInitial: name.charAt(0).toUpperCase(),
        };
      })
    );

    return withUsers.sort((a, b) => b.createdAt - a.createdAt);
  },
});

// ── Has the signed-in customer already reviewed this product? ──
export const hasReviewed = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const existing = await ctx.db
      .query("reviews")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId)
      )
      .first();

    return existing !== null;
  },
});

// ── Submit a review for a product (one per customer per product) ──
export const create = mutation({
  args: {
    productId: v.id("products"),
    rating: v.number(),
    title: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const rating = Math.round(args.rating);
    if (rating < 1 || rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }
    const title = args.title.trim();
    const body = args.body.trim();
    if (!title) throw new Error("Please enter a title");
    if (!body) throw new Error("Please enter your review");

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    const existing = await ctx.db
      .query("reviews")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId)
      )
      .first();
    if (existing) throw new Error("You have already reviewed this product");

    const id = await ctx.db.insert("reviews", {
      userId,
      productId: args.productId,
      rating,
      title,
      body,
      createdAt: Date.now(),
    });

    return id;
  },
});
