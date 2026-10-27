import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { withEnginePrices } from "./discountEngine";

// ── List cart items with product details for the current user ──
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const items = await ctx.db
      .query("cart_items")
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

    // Cart totals must show the engine-resolved price checkout will charge,
    // even when the stored snapshot lags the current rules.
    const pricedProducts = await withEnginePrices(
      ctx.db,
      present.map((row) => row.product),
    );
    return present.map((row, index) => ({
      ...row.item,
      product: pricedProducts[index],
    }));
  },
});

// ── Get cart item count for current user ──
export const getCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return 0;

    const items = await ctx.db
      .query("cart_items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return items.reduce((sum, item) => sum + item.quantity, 0);
  },
});

// ── Add item to cart (or increment quantity if already exists) ──
export const addItem = mutation({
  args: {
    productId: v.id("products"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const product = await ctx.db.get(args.productId);
    if (!product || !product.isActive) throw new Error("Product not available");
    // Expired medicines must never reach the cart: expiryDate on the product
    // record is the source of truth, so a past date blocks the sale even while
    // the product is still active and has stock.
    if (product.expiryDate && product.expiryDate <= Date.now()) {
      throw new Error(`"${product.name}" has expired and can no longer be sold.`);
    }
    if (product.stockQuantity < args.quantity) throw new Error("Insufficient stock");

    // Check if item already in cart
    const existing = await ctx.db
      .query("cart_items")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId)
      )
      .first();

    if (existing) {
      const newQty = existing.quantity + args.quantity;
      if (newQty > product.stockQuantity) throw new Error("Insufficient stock");
      await ctx.db.patch(existing._id, { quantity: newQty });
      return { success: true, quantity: newQty };
    }

    await ctx.db.insert("cart_items", {
      userId,
      productId: args.productId,
      quantity: args.quantity,
    });
    return { success: true, quantity: args.quantity };
  },
});

// ── Update cart item quantity ──
export const updateQuantity = mutation({
  args: {
    cartItemId: v.id("cart_items"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const item = await ctx.db.get(args.cartItemId);
    if (!item || item.userId !== userId) throw new Error("Cart item not found");

    if (args.quantity <= 0) {
      await ctx.db.delete(args.cartItemId);
      return { success: true, removed: true };
    }

    const product = await ctx.db.get(item.productId);
    if (product && args.quantity > product.stockQuantity) {
      throw new Error("Insufficient stock");
    }

    await ctx.db.patch(args.cartItemId, { quantity: args.quantity });
    return { success: true, removed: false };
  },
});

// ── Remove an item from cart ──
export const removeItem = mutation({
  args: { cartItemId: v.id("cart_items") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const item = await ctx.db.get(args.cartItemId);
    if (!item || item.userId !== userId) throw new Error("Cart item not found");

    await ctx.db.delete(args.cartItemId);
    return { success: true };
  },
});

// ── Clear entire cart ──
export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const items = await ctx.db
      .query("cart_items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const item of items) {
      await ctx.db.delete(item._id);
    }
    return { success: true };
  },
});
