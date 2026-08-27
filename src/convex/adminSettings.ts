import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get store settings.
 */
export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("storeSettings").first();
    if (existing) return existing;
    return null;
  },
});

/**
 * Upsert store settings (admin only).
 */
export const updateSettings = mutation({
  args: {
    storeName: v.string(),
    storeEmail: v.string(),
    storePhone: v.string(),
    storeAddress: v.string(),
    storeHours: v.string(),
    currency: v.string(),
    taxRate: v.number(),
    minOrderAmount: v.number(),
    deliveryFee: v.number(),
    freeDeliveryAbove: v.number(),
    whatsappNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db.query("storeSettings").first();
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("storeSettings", {
        ...args,
        updatedAt: now,
      });
    }
  },
});

/**
 * Log an admin activity.
 */
export const logActivity = mutation({
  args: {
    action: v.string(),
    category: v.string(),
    item: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    await ctx.db.insert("auditLogs", {
      action: args.action,
      category: args.category,
      item: args.item,
      details: args.details,
      adminId: identity.subject as any,
      adminName: identity.name ?? "Admin",
      timestamp: Date.now(),
    });
  },
});

/**
 * List audit logs, newest first.
 */
export const listAuditLogs = query({
  args: {
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q: any;
    if (args.category) {
      q = ctx.db
        .query("auditLogs")
        .withIndex("by_category", (cat: any) =>
          cat.eq("category", args.category!)
        );
    } else {
      q = ctx.db.query("auditLogs").withIndex("by_timestamp");
    }
    const logs = await q.order("desc").take(args.limit ?? 100);
    return logs;
  },
});
