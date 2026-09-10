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

    // External image URLs are stored directly as the image source — they are
    // NOT uploaded to Convex storage and must never be treated as storage IDs.
    if (args.imageSource === "url") {
      const urlValue = (args.publicUrl ?? args.bannerImage ?? "").trim();
      if (urlValue) {
        let parsed: URL;
        try {
          parsed = new URL(urlValue);
        } catch {
          throw new Error(
            "Invalid image URL. Please paste a full absolute URL starting with http:// or https://"
          );
        }
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          throw new Error(
            "Invalid image URL protocol. Only http:// and https:// image URLs are supported."
          );
        }
      }
    }

    // NOTE: ctx.db.patch() returns void, not the document id — the id for an
    // update is the one we were given. Only inserts return a new id.
    if (args.id !== undefined) {
      await ctx.db.patch(args.id, campaignFields);
      return args.id as any;
    }

    return (await ctx.db.insert("campaigns", {
      ...campaignFields,
      createdAt: now,
    })) as any;
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
// Purely syntactic validation. Convex mutations cannot perform network
// requests (fetch is only available in actions/queries), so actual
// loadability is verified by the browser preview of the image.
export const validateImageUrl = mutation({
  args: { url: v.string() },
  handler: async (_ctx, args) => {
    const trimmed = args.url.trim();
    if (!trimmed) {
      throw new Error("URL cannot be empty");
    }

    if (trimmed.startsWith("data:")) {
      throw new Error(
        "Data URLs cannot be used as banner images. Please upload the file instead."
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error(
        "Invalid URL format. Please paste a full absolute URL starting with http:// or https://"
      );
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error(
        "Only http:// and https:// image URLs are supported."
      );
    }

    if (!parsed.hostname) {
      throw new Error("Invalid URL: hostname is missing.");
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

    // ── Discover a currently supported image-generation model ──
    // The previously hardcoded preview model
    // (gemini-2.0-flash-preview-image-generation) has been shut down. Instead
    // of guessing model names, ask the Gemini API which models are actually
    // available to this key and use the best one that supports image
    // generation via generateContent.
    const allModels: Array<{
      name?: string;
      supportedGenerationMethods?: string[];
    }> = [];
    let pageToken: string | undefined;
    try {
      do {
        const pageUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
        const pageResponse = await fetch(pageUrl);
        if (!pageResponse.ok) {
          let detail = `status ${pageResponse.status}`;
          try {
            const errJson = await pageResponse.json();
            detail = errJson?.error?.message || detail;
          } catch {
            // keep default detail
          }
          throw new Error(
            `Could not list available AI models (${detail}).`
          );
        }
        const pageData = await pageResponse.json();
        if (Array.isArray(pageData?.models)) allModels.push(...pageData.models);
        pageToken = pageData?.nextPageToken;
      } while (pageToken);
    } catch (err: any) {
      if (err?.message?.startsWith("Could not list")) throw err;
      throw new Error(
        `Image generation service is unreachable: ${err?.message || "network error"}`
      );
    }

    const imageModels = allModels
      .filter(
        (m) =>
          (m.name ?? "").includes("image") &&
          (m.supportedGenerationMethods ?? []).includes("generateContent")
      )
      .map((m) => m.name!.replace(/^models\//, ""));

    // Prefer the newest generally-available image models first.
    const preference = [
      /gemini-3(\.\d+)?-flash-image$/,
      /gemini-3(\.\d+)?-flash-lite-image$/,
      /gemini-3(\.\d+)?-pro-image$/,
      /gemini-2\.5-flash-image$/,
    ];
    imageModels.sort((a, b) => {
      const rank = (n: string) => {
        const i = preference.findIndex((re) => re.test(n));
        return i === -1 ? preference.length : i;
      };
      const byRank = rank(a) - rank(b);
      if (byRank !== 0) return byRank;
      // Prefer GA names over -preview variants within the same tier.
      return Number(a.includes("preview")) - Number(b.includes("preview"));
    });

    if (imageModels.length === 0) {
      throw new Error(
        "No AI image-generation model is available for the configured Gemini API key. Use Upload Image or Image URL instead."
      );
    }

    const contents = [{ role: "user", parts: [{ text: prompt }] }];
    const headers = { "Content-Type": "application/json" };
    const buildBody = (withModalities: boolean) =>
      JSON.stringify(
        withModalities
          ? { contents, generationConfig: { responseModalities: ["IMAGE"] } }
          : { contents }
      );

    let generated: { base64: string; mimeType: string; model: string } | null =
      null;
    let lastError = "the AI service returned no usable response";

    for (const modelName of imageModels.slice(0, 4)) {
      const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(apiKey)}`;
      try {
        let response = await fetch(generateUrl, {
          method: "POST",
          headers,
          body: buildBody(true),
        });
        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          // Some image models reject an explicit responseModalities config —
          // retry once without it (they default to image output).
          if (/modalit/i.test(errText)) {
            response = await fetch(generateUrl, {
              method: "POST",
              headers,
              body: buildBody(false),
            });
          }
        }
        if (!response.ok) {
          let detail = `status ${response.status}`;
          try {
            const errJson = await response.json();
            detail = errJson?.error?.message || detail;
          } catch {
            // keep default detail
          }
          lastError = `${modelName}: ${detail}`;
          continue; // try the next available model
        }

        const result = await response.json();
        const parts: any[] = result?.candidates?.[0]?.content?.parts ?? [];
        const imagePart = parts.find(
          (p) => p.inlineData?.data || p.inline_data?.data
        );
        const base64 =
          imagePart?.inlineData?.data || imagePart?.inline_data?.data;
        if (base64) {
          generated = {
            base64,
            mimeType:
              imagePart?.inlineData?.mimeType ||
              imagePart?.inline_data?.mime_type ||
              "image/png",
            model: modelName,
          };
          break;
        }
        lastError = `${modelName}: the model returned no image (it may have refused this prompt).`;
      } catch (err: any) {
        lastError = `${modelName}: ${err?.message || "network error"}`;
      }
    }

    if (!generated) {
      throw new Error(
        `Image generation failed (${lastError}). Try rephrasing the campaign title, or use Upload Image / Image URL instead.`
      );
    }

    const bytes = Uint8Array.from(atob(generated.base64), (c) =>
      c.charCodeAt(0)
    );
    const storageId = await ctx.storage.store(
      new Blob([bytes.buffer as ArrayBuffer], { type: generated.mimeType })
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
