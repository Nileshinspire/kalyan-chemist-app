import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Auto-fetch product image using Google Custom Search API.
 * Requires GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_ENGINE_ID env vars.
 * Returns an image URL or null if not found.
 */
export const fetchProductImage = action({
  args: {
    productName: v.string(),
    manufacturer: v.optional(v.string()),
    brand: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const engineId = process.env.GOOGLE_SEARCH_ENGINE_ID;

    if (!apiKey || !engineId) {
      return { success: false, imageUrl: null, reason: "API keys not configured" };
    }

    // Build a targeted search query for Indian medicine images
    const queryParts = [args.productName];
    if (args.brand) queryParts.push(args.brand);
    if (args.manufacturer) queryParts.push(args.manufacturer);
    queryParts.push("medicine tablet image");

    const query = encodeURIComponent(queryParts.join(" "));
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${engineId}&searchType=image&q=${query}&num=5&imgType=photo&safe=active`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { success: false, imageUrl: null, reason: `API error: ${response.status}` };
      }

      const data = await response.json();
      const items = data.items;

      if (!items || items.length === 0) {
        return { success: false, imageUrl: null, reason: "No images found" };
      }

      // Try to find the best match by checking if the image title/link contains the product name
      const productNameLower = args.productName.toLowerCase();
      let bestMatch = items[0];

      for (const item of items) {
        const title = (item.title || "").toLowerCase();
        const link = (item.link || "").toLowerCase();
        if (title.includes(productNameLower) || link.includes(productNameLower.replace(/\s+/g, "-"))) {
          bestMatch = item;
          break;
        }
      }

      return {
        success: true,
        imageUrl: bestMatch.link,
        thumbnail: bestMatch.image?.thumbnailLink || bestMatch.link,
        title: bestMatch.title,
      };
    } catch (error: any) {
      return { success: false, imageUrl: null, reason: error.message || "Search failed" };
    }
  },
});
