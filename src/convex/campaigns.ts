import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

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

    if (id === undefined || id === null) {
      throw new Error("Campaign storage returned no record");
    }

    // Backfill the public URL field from whichever source was used.
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

// ── Admin: upload campaign banner image to Convex file storage ──
// Accepts the file as a Blob and returns the public URL.
export const uploadBanner = action({
  args: {
    campaignId: v.id("campaigns"),
    blob: v.bytes(),
    contentType: v.string(),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    // Store the file in Convex file storage
    const storageId = await ctx.storage.store(
      new Blob([args.blob], { type: args.contentType })
    );

    // Get a public URL for the stored file
    const url = await ctx.storage.getUrl(storageId);
    if (!url) {
      throw new Error("Failed to generate public URL for uploaded banner");
    }

    // Update the campaign record with the real public URL using a mutation
    await ctx.runMutation(api.campaigns.updateBannerUrl, {
      campaignId: args.campaignId,
      publicUrl: url,
      bannerImage: url,
    });

    return url;
  },
});

// ── Internal mutation: update campaign banner URL after upload ──
export const updateBannerUrl = mutation({
  args: {
    campaignId: v.id("campaigns"),
    publicUrl: v.string(),
    bannerImage: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.campaignId, {
      publicUrl: args.publicUrl,
      bannerImage: args.bannerImage,
      imageSource: "upload",
      updatedAt: Date.now(),
    });
  },
});

// ── Admin: validate an image URL ──
export const validateImageUrl = mutation({
  args: { url: v.string() },
  handler: async (_ctx, args) => {
    const trimmed = args.url.trim();
    if (!trimmed) {
      throw new Error("URL cannot be empty");
    }

    // Basic URL format check
    try {
      new URL(trimmed);
    } catch {
      throw new Error("Invalid URL format");
    }

    // Check that it looks like an image URL
    const imageExtensions = /\.(jpg|jpeg|png|webp|gif|svg)(\?.*)?$/i;
    const isImageByExtension = imageExtensions.test(trimmed);
    const isDataUrl = trimmed.startsWith("data:image/");

    // Allow data URLs for preview, but warn they won't work as public URLs
    if (isDataUrl) {
      throw new Error(
        "Data URLs cannot be used as public banner images. Please upload the file instead."
      );
    }

    if (!isImageByExtension) {
      // Could be a valid image hosting URL without extension, just warn
      // The actual validation happens when the browser tries to load it
    }

    // Try to HEAD the URL to check accessibility
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(trimmed, {
        method: "HEAD",
        signal: controller.signal,
        mode: "cors",
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Image URL returned status ${response.status}. The URL may be invalid or the image may not be accessible.`
        );
      }

      // Check content type if available
      const contentType = response.headers.get("content-type");
      if (contentType && !contentType.startsWith("image/")) {
        throw new Error(
          `URL does not point to an image (content type: ${contentType})`
        );
      }
    } catch (fetchError: any) {
      if (fetchError.name === "AbortError") {
        throw new Error(
          "Image URL validation timed out. The server may be slow or unreachable."
        );
      }
      // CORS might block HEAD requests, but the URL might still be valid
      // for <img> tags. Only throw if it's not a CORS issue.
      if (!fetchError.message?.includes("Failed to fetch")) {
        throw fetchError;
      }
      // CORS blocked the HEAD request, but it could still work in an <img> tag
    }

    return { valid: true };
  },
});

// ── Admin: generate campaign banner image with AI ──
// Placeholder for future AI image generation integration.
export const generateCampaignImage = action({
  args: {
    title: v.string(),
    subtitle: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    // AI image generation is not yet configured.
    // When an image generation service is available (e.g. OpenAI DALL-E, Stability AI),
    // implement it here and return the public URL of the generated image.
    throw new Error(
      "AI image generation is not configured yet. Please use Upload Image or Image URL instead."
    );
  },
});
