import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { withEnginePrices } from "./discountEngine";
import { getHealthKitAvailability, resolveHealthKitPricing } from "./healthKitsCore";

// ── List wishlist items with product details ──
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const items = await ctx.db
      .query("wishlist_items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const itemsWithProducts = await Promise.all(
      items.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        return { item, product };
      })
    );

    const present = itemsWithProducts.filter(
      (row): row is { item: (typeof items)[number]; product: Doc<"products"> } =>
        row.product !== null,
    );

    // Wishlist cards show the same live price/availability as everywhere else.
    const standardRows = present.filter((row) => !row.product.healthKit);
    const pricedStandard = await withEnginePrices(
      ctx.db,
      standardRows.map((row) => row.product),
    );
    const standardById = new Map(
      pricedStandard.map((product) => [product._id as string, product]),
    );

    return await Promise.all(
      present.map(async (row) => {
        if (!row.product.healthKit) {
          return {
            ...row.item,
            product: standardById.get(row.product._id as string) ?? row.product,
          };
        }
        const [pricing, availability] = await Promise.all([
          resolveHealthKitPricing(ctx.db, row.product),
          getHealthKitAvailability(ctx.db, row.product),
        ]);
        return {
          ...row.item,
          product: {
            ...row.product,
            price: pricing.catalogueMrp,
            discountPrice:
              pricing.sellingPrice < pricing.catalogueMrp
                ? pricing.sellingPrice
                : undefined,
            stockQuantity: availability.maxQuantity,
          },
        };
      }),
    );
  },
});

// ── Check if a product is in the user's wishlist ──
export const isWishlisted = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return false;

    const item = await ctx.db
      .query("wishlist_items")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId)
      )
      .first();

    return item !== null;
  },
});

// ── Toggle wishlist status for a product ──
export const toggle = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("wishlist_items")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
      return { wishlisted: false };
    }

    await ctx.db.insert("wishlist_items", {
      userId,
      productId: args.productId,
    });
    return { wishlisted: true };
  },
});

// ── Remove from wishlist ──
export const remove = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("wishlist_items")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId)
      )
      .first();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return { success: true };
  },
});

// ── Move from wishlist to cart ──
export const moveToCart = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const product = await ctx.db.get(args.productId);
    if (!product || !product.isActive) throw new Error("Product not available");
    let available = product.stockQuantity;
    if (product.healthKit) {
      const availability = await getHealthKitAvailability(ctx.db, product);
      available = availability.available ? availability.maxQuantity : 0;
    }
    if (available < 1) throw new Error("Out of stock");

    // Remove from wishlist
    const wishlistItem = await ctx.db
      .query("wishlist_items")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId)
      )
      .first();

    if (wishlistItem) {
      await ctx.db.delete(wishlistItem._id);
    }

    // Add to cart (or increment if already exists). Kits use the standard
    // (uncustomized) line, which keeps this simple wishlist action unchanged.
    const existingCartItems = await ctx.db
      .query("cart_items")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId)
      )
      .collect();
    const existingCartItem = product.healthKit
      ? existingCartItems.find((item) => !item.configurationKey)
      : existingCartItems[0];

    if (existingCartItem) {
      const newQty = existingCartItem.quantity + 1;
      if (newQty > available) throw new Error("Insufficient stock");
      await ctx.db.patch(existingCartItem._id, { quantity: newQty });
    } else {
      await ctx.db.insert("cart_items", {
        userId,
        productId: args.productId,
        quantity: 1,
      });
    }

    return { success: true };
  },
});

// ── Get wishlist count ──
export const getCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return 0;
    const items = await ctx.db
      .query("wishlist_items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return items.length;
  },
});
