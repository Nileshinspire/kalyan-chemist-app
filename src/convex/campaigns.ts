import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Public: active campaigns for homepage carousel ──
export const active = query({
  handler: async (ctx) => {
    const now = Date.now();
    const campaigns = await ctx.db
      .query("campaigns")
      .withIndex("by_active_dates", (q) =>
        q.eq("isActive", true).lte("startDate", now)
      )
      .collect();

    // Filter to only campaigns within their date range
    const eligible = campaigns.filter((c) => now <= c.endDate);

    // Sort by priority ascending (lower = higher priority), then newest first
    eligible.sort((a, b) => a.priority - b.priority || b.createdAt - a.createdAt);

    return eligible;
  },
});

// ── Admin: list all campaigns ──
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("campaigns").order("desc").collect();
  },
});

// ── Admin: create or update a campaign ──
export const upsert = mutation({
  args: {
    id: v.optional(v.id("campaigns")),
    title: v.string(),
    subtitle: v.optional(v.string()),
    bannerImage: v.string(),
    desktopBannerImage: v.optional(v.string()),
    mobileBannerImage: v.optional(v.string()),
    ctaText: v.optional(v.string()),
    ctaDestination: v.optional(v.string()),
    targetType: v.union(
      v.literal("category"),
      v.literal("product"),
      v.literal("page"),
      v.literal("external"),
      v.literal("none")
    ),
    targetId: v.optional(v.string()),
    startDate: v.number(),
    endDate: v.number(),
    isActive: v.boolean(),
    priority: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    if (args.id) {
      await ctx.db.patch(args.id, {
        ...args,
        updatedAt: now,
      });
      return args.id;
    }

    return await ctx.db.insert("campaigns", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ── Admin: delete a campaign ──
export const remove = mutation({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.campaignId);
  },
});
