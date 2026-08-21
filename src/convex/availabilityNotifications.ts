import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// ══════════════════════════════════════════════════════
//  MUTATIONS
// ══════════════════════════════════════════════════════

/** Customer requests a stock availability notification */
export const requestNotification = mutation({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    // Check if already waiting for this product
    if (userId) {
      const existing = await ctx.db
        .query("availability_notifications")
        .withIndex("by_product_status")
        .filter((q) =>
          q.and(
            q.eq(q.field("productId"), args.productId),
            q.eq(q.field("status"), "waiting"),
            q.eq(q.field("userId"), userId),
          )
        )
        .first();

      if (existing) {
        return { success: true, alreadyWaiting: true };
      }
    }

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    // Get user info
    let customerName: string | undefined;
    let customerPhone: string | undefined;
    if (userId) {
      const user = await ctx.db.get(userId);
      if (user) {
        customerName = user.name ?? undefined;
        customerPhone = user.phone ?? undefined;
      }
    }

    const id = await ctx.db.insert("availability_notifications", {
      userId: userId ?? undefined,
      productId: args.productId,
      productName: product.name,
      customerPhone,
      customerName,
      status: "waiting",
      createdAt: Date.now(),
    });

    return { success: true, id };
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

/** Internal: When product stock goes from 0 to >0, auto-notify waiting customers */
export const processStockRestock = internalMutation({
  args: {
    productId: v.id("products"),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product || product.stockQuantity <= 0) return { notified: 0 };

    // Find all customers waiting for this product
    const waiting = await ctx.db
      .query("availability_notifications")
      .withIndex("by_product_status")
      .filter((q) =>
        q.and(
          q.eq(q.field("productId"), args.productId),
          q.eq(q.field("status"), "waiting"),
        )
      )
      .collect();

    if (waiting.length === 0) return { notified: 0 };

    let notified = 0;
    for (const notif of waiting) {
      // Update status to notified (will be sent via external service)
      await ctx.db.patch(notif._id, {
        status: "notified",
        notifiedAt: Date.now(),
      });

      // Create in-app notification
      if (notif.userId) {
        await ctx.db.insert("notifications", {
          userId: notif.userId,
          type: "order_status",
          title: "Medicine Available!",
          body: `Great news! ${notif.productName} is now available in stock. Order now!`,
          read: false,
          link: `/products/${product.slug}`,
          createdAt: Date.now(),
        });
      }

      notified++;
    }

    return { notified };
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

    const waiting = await ctx.db
      .query("availability_notifications")
      .withIndex("by_product_status")
      .filter((q) =>
        q.and(
          q.eq(q.field("productId"), args.productId),
          q.eq(q.field("status"), "waiting"),
          q.eq(q.field("userId"), userId),
        )
      )
      .first();

    return !!waiting;
  },
});
