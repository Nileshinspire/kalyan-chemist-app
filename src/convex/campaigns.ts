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
// Proper large-file flow: the client requests a short-lived upload URL, POSTs
// the (already optimized) file directly to Convex storage, then calls
// attachBanner with the returned storageId. This avoids the ~1MB function
// argument limit that broke uploads of reasonably-sized images.
export const generateBannerUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const attachBanner = mutation({
  args: {
    campaignId: v.id("campaigns"),
    storageId: v.id("_storage"),
    imageSource: v.optional(
      v.union(
        v.literal("upload"),
        v.literal("url"),
        v.literal("generated"),
        v.literal("none")
      )
    ),
  },
  handler: async (ctx, args) => {
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw new Error(
        "Uploaded image could not be resolved to a public URL. Upload failed."
      );
    }

    await ctx.db.patch(args.campaignId, {
      publicUrl: url,
      bannerImage: url,
      imageSource: args.imageSource ?? "upload",
      updatedAt: Date.now(),
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

// ── Admin: is AI image generation available? ──
export const aiImageStatus = query({
  args: {},
  handler: async () => {
    return { configured: Boolean(process.env.GEMINI_API_KEY) };
  },
});

// ── Admin: generate campaign banner image with AI (Gemini image model) ──
// Server-side only: the API key never leaves the server. The generated image
// is stored in Convex file storage and attached to the campaign, so the
// returned URL is a persistent public reference (not a temporary/local URL).
export const generateCampaignImage = action({
  args: {
    campaignId: v.id("campaigns"),
    title: v.string(),
    subtitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "AI image generation is not configured. Add a GEMINI_API_KEY to enable it — meanwhile use Upload Image or Image URL."
      );
    }

    const title = args.title.trim();
    if (!title) {
      throw new Error("Campaign title is required to generate an image.");
    }

    // Careful prompt: brand-appropriate promotional banner, no medical claims,
    // no invented discount figures, no text beyond the supplied title.
    const prompt = [
      "Create a premium wide promotional e-commerce banner (21:9 landscape) for Kalyan Chemist, a modern local pharmacy.",
      `Campaign topic: "${title}".`,
      args.subtitle?.trim() ? `Campaign description: "${args.subtitle.trim()}".` : "",
      "Style: clean modern healthcare retail aesthetic, soft emerald green and deep teal gradients with subtle mint highlights, elegant studio product photography feel, generous empty space on the left half of the image for overlaid text, warm coral accent details.",
      "Rules: no medical claims, no prices, no discount percentages, no promo codes, no watermarks, no brand logos, no text or lettering other than short decorative shapes. Photorealistic, well-lit, calm and professional.",
    ]
      .filter(Boolean)
      .join(" ");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent?key=${encodeURIComponent(apiKey)}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"],
          },
        }),
      });
    } catch (err: any) {
      throw new Error(
        `Image generation service is unreachable: ${err?.message || "network error"}`
      );
    }

    if (!response.ok) {
      let detail = `status ${response.status}`;
      try {
        const errJson = await response.json();
        detail = errJson?.error?.message || detail;
      } catch {
        // keep default detail
      }
      throw new Error(`Image generation failed (${detail}).`);
    }

    const data = await response.json();
    const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
    const base64 = imagePart?.inlineData?.data || imagePart?.inline_data?.data;
    const mimeType =
      imagePart?.inlineData?.mimeType ||
      imagePart?.inline_data?.mime_type ||
      "image/png";

    if (!base64) {
      throw new Error(
        "The AI service did not return an image for this campaign. Try rephrasing the title or use Upload Image instead."
      );
    }

    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const storageId = await ctx.storage.store(
      new Blob([bytes.buffer as ArrayBuffer], { type: mimeType })
    );
    const publicUrl = await ctx.storage.getUrl(storageId);
    if (!publicUrl) {
      throw new Error("Generated image was stored but no public URL could be created.");
    }

    // Persist on the campaign record so it survives refresh.
    await ctx.runMutation(api.campaigns.attachBanner, {
      campaignId: args.campaignId,
      storageId,
      imageSource: "generated",
    });

    return publicUrl;
  },
});
