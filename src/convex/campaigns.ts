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

    // Return campaigns with fully resolved public image URLs for the frontend.
    return eligible.map((c) => ({
      ...c,
      // Prefer explicit desktop/mobile assets when available; otherwise fall back to the
      // primary public URL stored from upload/URL/generated source.
      bannerImage: c.desktopBannerImage ?? c.publicUrl ?? c.bannerImage,
      desktopBannerImage: c.desktopBannerImage ?? c.publicUrl ?? c.bannerImage,
      mobileBannerImage: c.mobileBannerImage ?? c.publicUrl ?? c.bannerImage,
    }));
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
    bannerImage: v.optional(v.string()),
    desktopBannerImage: v.optional(v.string()),
    mobileBannerImage: v.optional(v.string()),
    imageSource: v.optional(
      v.union(
        v.literal("upload"),
        v.literal("url"),
        v.literal("generated"),
        v.literal("none")
      )
    ),
    publicUrl: v.optional(v.string()),
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

    const campaignFields = {
      title: args.title,
      subtitle: args.subtitle,
      bannerImage: args.bannerImage,
      desktopBannerImage: args.desktopBannerImage,
      mobileBannerImage: args.mobileBannerImage,
      // The generated campaign table type defines `imageSource` and `targetType` as
      // non-optional unions, so always pass a concrete literal here.
      imageSource: args.imageSource ?? ("none" as const),
      publicUrl: args.publicUrl,
      ctaText: args.ctaText,
      ctaDestination: args.ctaDestination,
      targetType: args.targetType ?? ("none" as const),
      targetId: args.targetId,
      startDate: args.startDate,
      endDate: args.endDate,
      isActive: args.isActive,
      priority: args.priority,
      updatedAt: now,
    };

    const id =
      args.id !== undefined
        ? await ctx.db.patch(args.id, campaignFields)
        : await ctx.db.insert("campaigns", {
            ...campaignFields,
            createdAt: now,
          });

    // `ctx.db.insert` can return `void` for some generated table shapes, so guard
    // before using it as an id.
    if (id === undefined || id === null) {
      throw new Error("Campaign storage returned no record");
    }

    // Backfill the public URL field from whichever source was used, so the public
    // query can always return a single resolved banner image without changing the
    // existing bannerImage/desktopBannerImage/mobileBannerImage fields.
    if (args.publicUrl) {
      await ctx.db.patch(id as any, { publicUrl: args.publicUrl });
    }

    return id as any;
  },
});

// ── Admin: delete a campaign ──
export const remove = mutation({
  args: { campaignId: v.id("campaigns") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.campaignId);
  },
});
