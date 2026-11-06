import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { notifyRestockWaiters } from "./restockAlerts";

// ══════════════════════════════════════════════════════
//  MUTATIONS
// ══════════════════════════════════════════════════════

/**
 * Customer requests a stock availability notification.
 *
 * Requires a signed-in customer, only accepts an out-of-stock product, and is
 * idempotent: a second tap while the first request is still waiting returns the
 * existing row instead of creating a duplicate subscription.
 */
export const requestNotification = mutation({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Please sign in to get restock alerts.");

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");
    if (product.stockQuantity > 0) {
      throw new Error("This product is already in stock.");
    }

    const existing = await ctx.db
      .query("availability_notifications")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId),
      )
      .collect();
    const alreadyWaiting = existing.find((row) => row.status === "waiting");
    if (alreadyWaiting) {
      return { success: true, alreadyWaiting: true, id: alreadyWaiting._id };
    }

    const user = await ctx.db.get(userId);
    const id = await ctx.db.insert("availability_notifications", {
      userId,
      productId: args.productId,
      productName: product.name,
      customerName: user?.name ?? undefined,
      customerPhone: user?.phone ?? undefined,
      status: "waiting",
      createdAt: Date.now(),
    });

    return { success: true, id, alreadyWaiting: false };
  },
});

/** Customer cancels their own waiting restock subscription. */
export const cancelNotification = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const rows = await ctx.db
      .query("availability_notifications")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId),
      )
      .collect();

    const waiting = rows.filter((row) => row.status === "waiting");
    for (const row of waiting) {
      // Ownership is guaranteed by the index predicate above.
      await ctx.db.delete(row._id);
    }

    return { success: true, cancelled: waiting.length };
  },
});

/** Admin marks notification as sent (after sending WhatsApp/SMS/email) */
export const markNotified = mutation({
  args: {
    notificationId: v.id("availability_notifications"),
    method: v.union(v.literal("whatsapp"), v.literal("sms"), v.literal("email")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Unauthorized: admin only");

    await ctx.db.patch(args.notificationId, {
      status: "notified",
      notifiedAt: Date.now(),
      notificationMethod: args.method,
    });

    return { success: true };
  },
});

/**
 * Internal: when product stock goes from 0 to >0, notify waiting customers.
 * Kept for any existing caller; the actual work lives in the shared helper so
 * the Inventory and product-editor paths behave identically.
 */
export const processStockRestock = internalMutation({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    return await notifyRestockWaiters(ctx, args.productId);
  },
});

// ══════════════════════════════════════════════════════
//  QUERIES
// ══════════════════════════════════════════════════════

/** Admin: List all availability notifications */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Unauthorized: admin only");

    const notifications = await ctx.db
      .query("availability_notifications")
      .order("desc")
      .collect();

    // Enrich with product data
    return Promise.all(
      notifications.map(async (n) => {
        const product = await ctx.db.get(n.productId);
        return {
          ...n,
          productStock: product?.stockQuantity,
          productPrice: product?.price,
          productSlug: product?.slug,
          productIsActive: product?.isActive,
        };
      })
    );
  },
});

/** Admin: Summary stats for availability notifications */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Unauthorized: admin only");

    const all = await ctx.db.query("availability_notifications").collect();

    const waiting = all.filter((n) => n.status === "waiting").length;
    const notified = all.filter((n) => n.status === "notified").length;
    const expired = all.filter((n) => n.status === "expired").length;
    const total = all.length;

    return { total, waiting, notified, expired };
  },
});

/** Customer: Check if they are waiting for a product */
export const isWaiting = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const rows = await ctx.db
      .query("availability_notifications")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId),
      )
      .collect();

    return rows.some((row) => row.status === "waiting");
  },
});

/** Customer: their own waiting restock alerts, for the account area. */
export const myWaiting = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const rows = await ctx.db
      .query("availability_notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    const waiting = rows.filter((row) => row.status === "waiting");
    return Promise.all(
      waiting.map(async (row) => {
        const product = await ctx.db.get(row.productId);
        return {
          _id: row._id,
          productId: row.productId,
          productName: product?.name ?? row.productName,
          productSlug: product?.slug ?? null,
          productImage: product?.imageUrl ?? null,
          stockQuantity: product?.stockQuantity ?? 0,
          createdAt: row.createdAt,
        };
      }),
    );
  },
});
