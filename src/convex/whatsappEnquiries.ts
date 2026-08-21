import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ══════════════════════════════════════════════════════
//  MUTATIONS
// ══════════════════════════════════════════════════════

/** Log a WhatsApp enquiry or order attempt */
export const log = mutation({
  args: {
    type: v.union(v.literal("enquiry"), v.literal("order"), v.literal("cart"), v.literal("product")),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    message: v.string(),
    summary: v.string(),
    productId: v.optional(v.id("products")),
    productName: v.optional(v.string()),
    itemCount: v.optional(v.number()),
    totalAmount: v.optional(v.number()),
    requestedQuantity: v.optional(v.number()),
    available: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const id = await ctx.db.insert("whatsapp_enquiries", {
      userId: userId ?? undefined,
      type: args.type,
      customerName: args.customerName,
      customerPhone: args.customerPhone,
      message: args.message,
      summary: args.summary,
      productId: args.productId,
      productName: args.productName,
      itemCount: args.itemCount,
      totalAmount: args.totalAmount,
      requestedQuantity: args.requestedQuantity,
      available: args.available,
      viewed: false,
      createdAt: Date.now(),
    });

    return { success: true, id };
  },
});

/** Mark an enquiry as viewed by admin */
export const markViewed = mutation({
  args: { enquiryId: v.id("whatsapp_enquiries") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Unauthorized: admin only");

    await ctx.db.patch(args.enquiryId, {
      viewed: true,
      viewedAt: Date.now(),
    });
    return { success: true };
  },
});

/** Mark all enquiries as viewed */
export const markAllViewed = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Unauthorized: admin only");

    const unviewed = await ctx.db
      .query("whatsapp_enquiries")
      .filter((q) => q.eq(q.field("viewed"), false))
      .collect();

    for (const e of unviewed) {
      await ctx.db.patch(e._id, { viewed: true, viewedAt: Date.now() });
    }
    return { success: true, count: unviewed.length };
  },
});

/** Add admin notes to an enquiry */
export const addNotes = mutation({
  args: {
    enquiryId: v.id("whatsapp_enquiries"),
    notes: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Unauthorized: admin only");

    await ctx.db.patch(args.enquiryId, { adminNotes: args.notes });
    return { success: true };
  },
});

// ══════════════════════════════════════════════════════
//  QUERIES (Admin)
// ══════════════════════════════════════════════════════

/** Get all WhatsApp enquiries (admin) — newest first */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Unauthorized: admin only");

    const enquiries = await ctx.db
      .query("whatsapp_enquiries")
      .order("desc")
      .collect();

    return enquiries;
  },
});

/** Get summary statistics for WhatsApp enquiries (admin) */
export const stats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Unauthorized: admin only");

    const all = await ctx.db.query("whatsapp_enquiries").collect();

    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    const total = all.length;
    const unviewed = all.filter((e) => !e.viewed).length;
    const todayCount = all.filter((e) => e.createdAt >= todayMs).length;

    // By type
    const enquiries = all.filter((e) => e.type === "enquiry").length;
    const orders = all.filter((e) => e.type === "order").length;
    const cartInquiries = all.filter((e) => e.type === "cart").length;
    const productInquiries = all.filter((e) => e.type === "product").length;

    // Availability tracking
    const availableOrders = all.filter((e) => e.available === true).length;
    const unavailableOrders = all.filter((e) => e.available === false).length;

    // Last 7 days chart data
    const last7Days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 86400000;
      const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
      last7Days.push({
        date: label,
        count: all.filter((e) => e.createdAt >= dayStart && e.createdAt < dayEnd).length,
      });
    }

    return {
      total,
      unviewed,
      todayCount,
      enquiries,
      orders,
      cartInquiries,
      productInquiries,
      availableOrders,
      unavailableOrders,
      last7Days,
    };
  },
});

/** Get recent enquiries (last N, admin) */
export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Unauthorized: admin only");

    const limit = args.limit ?? 50;
    const enquiries = await ctx.db
      .query("whatsapp_enquiries")
      .order("desc")
      .take(limit);

    return enquiries;
  },
});
