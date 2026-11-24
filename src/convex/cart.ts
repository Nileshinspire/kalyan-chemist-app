import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { withEnginePrices } from "./discountEngine";
import { getHealthKitQuote } from "./healthKitsCore";
import type { KitSelectionLine } from "../lib/healthKitQuote";

const kitSelectionValidator = v.array(
  v.object({ productId: v.id("products"), quantity: v.number() }),
);

type KitCartQuote = NonNullable<Awaited<ReturnType<typeof getHealthKitQuote>>>;

async function resolveKitCartLine(
  ctx: { db: any },
  product: Doc<"products">,
  selection?: KitSelectionLine[] | null,
): Promise<{ quote: KitCartQuote; product: Doc<"products"> } | null> {
  const quote = await getHealthKitQuote(ctx.db, product, selection ?? undefined);
  if (!quote) return null;
  return {
    quote,
    product: {
      ...product,
      price: quote.quote.selectedMrp,
      discountPrice:
        quote.quote.customizedPrice < quote.quote.selectedMrp
          ? quote.quote.customizedPrice
          : undefined,
      stockQuantity: quote.quote.maxQuantity,
    },
  };
}

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
      }),
    );

    const present = itemsWithProducts.filter(
      (row): row is { item: (typeof items)[number]; product: Doc<"products"> } =>
        row.product !== null,
    );

    // Cart totals show the engine-resolved price checkout will charge. Kits
    // use their live bundle price (including any customer customization).
    const standardRows = present.filter((row) => !row.product.healthKit);
    const pricedStandard = await withEnginePrices(
      ctx.db,
      standardRows.map((row) => row.product),
    );
    const pricedById = new Map(
      pricedStandard.map((product) => [product._id as string, product]),
    );

    return await Promise.all(
      present.map(async (row) => {
        if (!row.product.healthKit) {
          return {
            ...row.item,
            product: pricedById.get(row.product._id as string) ?? row.product,
            kitQuote: null,
          };
        }
        const resolved = await resolveKitCartLine(
          ctx,
          row.product,
          row.item.kitSelection as KitSelectionLine[] | undefined,
        );
        return {
          ...row.item,
          product: resolved?.product ?? {
            ...row.product,
            stockQuantity: 0,
          },
          kitQuote: resolved?.quote.quote ?? null,
          kitPricing: resolved?.quote.pricing ?? null,
          kitAvailability: resolved?.quote.availability ?? null,
        };
      }),
    );
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
    /** Present only when the customer customized a health kit. */
    kitSelection: v.optional(kitSelectionValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    if (!Number.isInteger(args.quantity) || args.quantity <= 0) {
      throw new Error("Quantity must be a whole number greater than zero.");
    }

    const product = await ctx.db.get(args.productId);
    if (!product || !product.isActive) throw new Error("Product not available");
    if (product.expiryDate && product.expiryDate <= Date.now() && !product.healthKit) {
      throw new Error(`"${product.name}" has expired and can no longer be sold.`);
    }

    if (!product.healthKit) {
      if (args.kitSelection) {
        throw new Error("Customized selections are only available for health kits.");
      }
      if (product.stockQuantity < args.quantity) {
        throw new Error("Insufficient stock");
      }

      const existing = await ctx.db
        .query("cart_items")
        .withIndex("by_user_product", (q) =>
          q.eq("userId", userId).eq("productId", args.productId),
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
    }

    const resolved = await resolveKitCartLine(
      ctx,
      product,
      args.kitSelection as KitSelectionLine[] | undefined,
    );
    if (!resolved) throw new Error("This health kit is no longer available.");
    const quote = resolved.quote.quote;
    if (!quote.available) {
      throw new Error(
        quote.unavailableReason ??
          removedReason(quote) ??
          `Insufficient stock for "${product.name}".`,
      );
    }
    if (args.quantity > quote.maxQuantity) {
      throw new Error(
        `Only ${quote.maxQuantity} customized kit${quote.maxQuantity === 1 ? "" : "s"} can be added right now.`,
      );
    }

    const configurationKey = quote.isCustomized ? quote.configurationKey : "";
    const existingForProduct = await ctx.db
      .query("cart_items")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId),
      )
      .collect();
    const existing = existingForProduct.find(
      (item) => (item.configurationKey ?? "") === configurationKey,
    );

    if (existing) {
      const newQty = existing.quantity + args.quantity;
      if (newQty > quote.maxQuantity) {
        throw new Error(
          `Only ${quote.maxQuantity} customized kit${quote.maxQuantity === 1 ? "" : "s"} can be added right now.`,
        );
      }
      await ctx.db.patch(existing._id, {
        quantity: newQty,
        ...(quote.isCustomized
          ? {
              configurationKey,
              kitSelection: quote.selection.map((line) => ({
                productId: line.productId as any,
                quantity: line.quantity,
              })),
            }
          : {}),
      });
      return { success: true, quantity: newQty };
    }

    await ctx.db.insert("cart_items", {
      userId,
      productId: args.productId,
      quantity: args.quantity,
      ...(quote.isCustomized
        ? {
            configurationKey,
            kitSelection: quote.selection.map((line) => ({
              productId: line.productId as any,
              quantity: line.quantity,
            })),
          }
        : {}),
    });
    return { success: true, quantity: args.quantity };
  },
});

function removedReason(quote: KitCartQuote["quote"]): string | null {
  if (quote.removedProductCount > 0 && quote.selectedProductCount === 0) {
    return "Select at least one product for this kit.";
  }
  return null;
}

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
    if (!Number.isInteger(args.quantity)) {
      throw new Error("Quantity must be a whole number.");
    }

    const product = await ctx.db.get(item.productId);
    if (product?.healthKit) {
      const resolved = await resolveKitCartLine(
        ctx,
        product,
        item.kitSelection as KitSelectionLine[] | undefined,
      );
      if (!resolved || !resolved.quote.quote.available) {
        throw new Error(
          resolved?.quote.quote.unavailableReason ??
            "This customized kit is no longer available.",
        );
      }
      if (args.quantity > resolved.quote.quote.maxQuantity) {
        throw new Error(
          `Only ${resolved.quote.quote.maxQuantity} customized kit${
            resolved.quote.quote.maxQuantity === 1 ? "" : "s"
          } can be added right now.`,
        );
      }
    } else if (product && args.quantity > product.stockQuantity) {
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
