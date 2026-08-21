import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ══════════════════════════════════════════════════════
//  MUTATIONS
// ══════════════════════════════════════════════════════

/** Log a WhatsApp enquiry or order attempt
 *  Includes duplicate prevention: same product enquiry within 5 minutes is skipped */
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
    prescriptionRequired: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    // Duplicate prevention: if same user enquired about same product within 5 minutes, skip
    if (args.productId && userId) {
      const fiveMinAgo = Date.now() - 5 * 60 * 1000;
      const recent = await ctx.db
        .query("whatsapp_enquiries")
        .withIndex("by_createdAt")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), userId),
            q.eq(q.field("productId"), args.productId),
            q.gt(q.field("createdAt"), fiveMinAgo),
          )
        )
        .first();

      if (recent) {
        // Update existing record instead of creating duplicate
        await ctx.db.patch(recent._id, {
          requestedQuantity: args.requestedQuantity,
          available: args.available,
          message: args.message,
          summary: args.summary,
          totalAmount: args.totalAmount,
        });
        return { success: true, id: recent._id, duplicate: true };
      }
    }

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
      prescriptionRequired: args.prescriptionRequired,
      viewed: false,
      deliveryStatus: "pending",
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

/** Update delivery status after WhatsApp API send attempt */
export const updateDeliveryStatus = mutation({
  args: {
    enquiryId: v.id("whatsapp_enquiries"),
    deliveryStatus: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("read"),
      v.literal("failed"),
    ),
    whatsappMessageId: v.optional(v.string()),
    deliveryError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Unauthorized: admin only");

    await ctx.db.patch(args.enquiryId, {
      deliveryStatus: args.deliveryStatus,
      whatsappMessageId: args.whatsappMessageId,
      deliveryError: args.deliveryError,
    });
    return { success: true };
  },
});

/** Retry a failed WhatsApp message */
export const retryMessage = mutation({
  args: {
    enquiryId: v.id("whatsapp_enquiries"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Unauthorized: admin only");

    const enquiry = await ctx.db.get(args.enquiryId);
    if (!enquiry) throw new Error("Enquiry not found");

    const currentRetry = enquiry.retryCount ?? 0;
    await ctx.db.patch(args.enquiryId, {
      deliveryStatus: "pending",
      deliveryError: undefined,
      retryCount: currentRetry + 1,
      lastRetryAt: Date.now(),
    });

    return { success: true, retryCount: currentRetry + 1 };
  },
});

/** Confirm a WhatsApp order (admin approves) */
export const confirmWhatsAppOrder = mutation({
  args: {
    enquiryId: v.id("whatsapp_enquiries"),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Unauthorized: admin only");

    const enquiry = await ctx.db.get(args.enquiryId);
    if (!enquiry) throw new Error("Enquiry not found");

    const now = Date.now();
    await ctx.db.patch(args.enquiryId, {
      confirmedByAdmin: true,
      confirmedAt: now,
      viewed: true,
      viewedAt: now,
      adminNotes: args.adminNotes?.trim() || enquiry.adminNotes,
    });

    // Create in-app notification for the customer
    if (enquiry.userId) {
      await ctx.db.insert("notifications", {
        userId: enquiry.userId,
        type: "order_status",
        title: "WhatsApp Order Confirmed",
        body: `Your WhatsApp order for ${enquiry.productName || "your items"} has been confirmed by our team. You'll receive updates shortly.`,
        read: false,
        createdAt: now,
      });
    }

    return { success: true };
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
