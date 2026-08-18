import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── List notifications for current user (newest first) ──
export const list = query({
  args: { unreadOnly: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    let q = ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc");

    if (args.unreadOnly) {
      q = ctx.db
        .query("notifications")
        .withIndex("by_user_read", (q) =>
          q.eq("userId", userId).eq("read", false)
        )
        .order("desc");
    }

    return await q.collect();
  },
});

// ── Unread notification count (for badge) ──
export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return 0;

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", userId).eq("read", false)
      )
      .collect();

    return unread.length;
  },
});

// ── Mark a single notification as read ──
export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const notif = await ctx.db.get(args.notificationId);
    if (!notif || notif.userId !== userId) throw new Error("Notification not found");

    if (!notif.read) {
      await ctx.db.patch(args.notificationId, { read: true });
    }
    return { success: true };
  },
});

// ── Mark all notifications as read ──
export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", userId).eq("read", false)
      )
      .collect();

    for (const notif of unread) {
      await ctx.db.patch(notif._id, { read: true });
    }

    return { success: true, count: unread.length };
  },
});

// ── Create a notification (called internally from other mutations) ──
export const create = mutation({
  args: {
    userId: v.id("users"),
    type: v.union(
      v.literal("order_status"),
      v.literal("refill_reminder"),
      v.literal("promo"),
      v.literal("system"),
    ),
    title: v.string(),
    body: v.string(),
    link: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("notifications", {
      userId: args.userId,
      type: args.type,
      title: args.title,
      body: args.body,
      read: false,
      link: args.link,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
    return { success: true, id };
  },
});

// ── Delete a single notification ──
export const remove = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const notif = await ctx.db.get(args.notificationId);
    if (!notif || notif.userId !== userId) throw new Error("Notification not found");

    await ctx.db.delete(args.notificationId);
    return { success: true };
  },
});
