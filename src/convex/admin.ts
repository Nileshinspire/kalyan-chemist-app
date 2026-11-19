import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import { handleOrderStatusChange } from "./referralWallet";
import { couponStatus } from "./couponLogic";
import { releaseStockForOrder } from "./stockReservations";
import {
  applyOrderEventToOrder,
  confirmOrderIfEligible,
} from "./orderWorkflow";
import {
  isTerminalOrderStatus,
  type OrderEventType,
} from "./orderWorkflowCore";

// ── Helper: verify admin ──
async function requireAdmin(ctx: { db: any; auth: any }) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") throw new Error("Unauthorized: admin only");
  return userId;
}

// ══════════════════════════════════════════════════════
//  DASHBOARD / ANALYTICS
// ══════════════════════════════════════════════════════

export const dashboardStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const allOrders = await ctx.db.query("orders").collect();
    const allProducts = await ctx.db.query("products").collect();
    const allUsers = await ctx.db.query("users").collect();
    const allPrescriptions = await ctx.db.query("prescriptions").collect();

    // ── Today's boundaries ──
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;

    const todayOrders = allOrders.filter(
      (o) => o.createdAt >= todayStart && o.createdAt < todayEnd
    );
    const todaySales = todayOrders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const totalRevenue = allOrders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const pendingOrders = allOrders.filter((o) => o.status === "pending").length;
    const deliveredOrders = allOrders.filter((o) => o.status === "delivered").length;
    const cancelledOrders = allOrders.filter((o) => o.status === "cancelled").length;
    const pendingPrescriptions = allPrescriptions.filter(
      (p) => p.status === "pending"
    ).length;

    const lowStockThreshold = 10;
    const lowStock = allProducts.filter(
      (p) => p.stockQuantity > 0 && p.stockQuantity <= lowStockThreshold && p.isActive
    ).length;
    const outOfStock = allProducts.filter(
      (p) => p.stockQuantity === 0 && p.isActive
    ).length;
    const totalProducts = allProducts.filter((p) => p.isActive).length;

    // Recent orders (last 5)
    const recentOrders = [...allOrders]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);

    // Monthly revenue (last 6 months)
    const monthlyRevenue: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = d.toLocaleString("en-IN", { month: "short" });
      const start = d.getTime();
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).getTime();
      const rev = allOrders
        .filter(
          (o) =>
            o.status !== "cancelled" && o.createdAt >= start && o.createdAt <= end
        )
        .reduce((sum, o) => sum + o.totalAmount, 0);
      monthlyRevenue.push({ month, revenue: rev });
    }

    // Order status distribution
    const statusCounts: Record<string, number> = {};
    for (const o of allOrders) {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    }

    return {
      totalRevenue,
      totalOrders: allOrders.length,
      todaySales,
      todayOrders: todayOrders.length,
      pendingOrders,
      deliveredOrders,
      cancelledOrders,
      pendingPrescriptions,
      totalProducts,
      lowStock,
      outOfStock,
      totalUsers: allUsers.length,
      recentOrders,
      monthlyRevenue,
      statusCounts,
    };
  },
});

// ══════════════════════════════════════════════════════
//  PRODUCTS
// ══════════════════════════════════════════════════════

export const listProducts = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const products = await ctx.db.query("products").collect();
    const categories = await ctx.db.query("categories").collect();
    const catMap = new Map(categories.map((c) => [c._id, c.name]));
    return products.map((p) => ({
      ...p,
      categoryName: catMap.get(p.categoryId) || "Unknown",
    }));
  },
});

/**
 * Price validation for the legacy admin product form: a base price must be
 * positive and a selling price strictly below it — the same rule the discount
 * engine and the main product form enforce, so no path can store an invalid
 * or negative price.
 */
function assertValidProductPricing(price: number, discountPrice?: number) {
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Base price (MRP) must be a number greater than zero.");
  }
  if (discountPrice !== undefined && discountPrice !== null) {
    if (!Number.isFinite(discountPrice) || discountPrice <= 0) {
      throw new Error("Selling price must be a number greater than zero.");
    }
    if (discountPrice >= price) {
      throw new Error("Selling price must be lower than the base price (MRP).");
    }
  }
}

export const upsertProduct = mutation({
  args: {
    id: v.optional(v.id("products")),
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    price: v.number(),
    discountPrice: v.optional(v.number()),
    categoryId: v.id("categories"),
    imageUrl: v.optional(v.string()),
    manufacturer: v.string(),
    dosage: v.optional(v.string()),
    packSize: v.string(),
    prescriptionRequired: v.boolean(),
    stockQuantity: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = Date.now();
    assertValidProductPricing(args.price, args.discountPrice);

    if (args.id) {
      const { id: _id, ...patchData } = args;
      // An explicit selling price is an admin override ("manual", preserved
      // by the engine); clearing it hands pricing back to the discount rules.
      const patch: Record<string, unknown> = { ...patchData, updatedAt: now };
      patch.discountSource = args.discountPrice !== undefined ? "manual" : undefined;
      await ctx.db.patch(args.id, patch as any);
      const { syncProduct } = await import("./discountEngine");
      try { await syncProduct(ctx, args.id); } catch { /* never block the save on reconciliation */ }
      return { success: true, id: args.id };
    }

    const id = await ctx.db.insert("products", {
      name: args.name,
      slug: args.slug,
      description: args.description,
      price: args.price,
      discountPrice: args.discountPrice,
      // An explicit selling price is the admin's one-off override; none means
      // the product is priced by the active discount rules from birth.
      discountSource: args.discountPrice !== undefined ? ("manual" as const) : undefined,
      categoryId: args.categoryId,
      imageUrl: args.imageUrl,
      manufacturer: args.manufacturer,
      dosage: args.dosage,
      packSize: args.packSize,
      prescriptionRequired: args.prescriptionRequired,
      stockQuantity: args.stockQuantity,
      isActive: args.isActive,
      createdAt: now,
      updatedAt: now,
    });
    const { syncProduct } = await import("./discountEngine");
    try { await syncProduct(ctx, id); } catch { /* never block the save on reconciliation */ }
    return { success: true, id };
  },
});

export const deleteProduct = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.productId);
    return { success: true };
  },
});

// ══════════════════════════════════════════════════════
//  CATEGORIES
// ══════════════════════════════════════════════════════

export const listCategories = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("categories").collect();
  },
});

export const upsertCategory = mutation({
  args: {
    id: v.optional(v.id("categories")),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    sortOrder: v.number(),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    if (args.id) {
      await ctx.db.patch(args.id, {
        name: args.name,
        slug: args.slug,
        description: args.description,
        sortOrder: args.sortOrder,
        isActive: args.isActive,
      });
      return { success: true, id: args.id };
    }

    const id = await ctx.db.insert("categories", {
      name: args.name,
      slug: args.slug,
      description: args.description,
      imageUrl: "",
      isActive: args.isActive,
      sortOrder: args.sortOrder,
    });
    return { success: true, id };
  },
});

export const deleteCategory = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.categoryId);
    return { success: true };
  },
});

// ══════════════════════════════════════════════════════
//  ORDERS
// ══════════════════════════════════════════════════════

export const listOrders = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const orders = await ctx.db.query("orders").collect();
    const users = await ctx.db.query("users").collect();
    const userMap = new Map(users.map((u) => [u._id, u.name || u.email || "Unknown"]));
    const activeSessions = await ctx.db
      .query("delivery_tracking")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    const activeByOrder = new Map(
      activeSessions.map((session) => [session.orderId as string, session]),
    );
    const prescriptions = await ctx.db.query("prescriptions").collect();
    const prescriptionById = new Map(
      prescriptions.map((rx) => [rx._id as string, rx]),
    );
    return orders
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((o) => {
        const session = activeByOrder.get(o._id as string);
        const prescription = o.prescriptionId
          ? prescriptionById.get(o.prescriptionId as string)
          : undefined;
        return {
          ...o,
          userName: userMap.get(o.userId) || "Unknown",
          deliveryBoyName: o.deliveryBoyId
            ? userMap.get(o.deliveryBoyId) || "Delivery partner"
            : null,
          prescriptionStatus: prescription?.status ?? null,
          prescriptionRejectionReason: prescription?.rejectionReason ?? null,
          trackingActive: Boolean(session),
          lastLocationAt: session?.lastLocationAt ?? null,
        };
      });
  },
});

export const getOrderById = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) return null;
    const user = await ctx.db.get(order.userId);
    const itemsWithProducts = await Promise.all(
      order.items.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        return { ...item, product };
      })
    );
    const address = order.addressId ? await ctx.db.get(order.addressId) : null;
    const deliveryBoy = order.deliveryBoyId
      ? await ctx.db.get(order.deliveryBoyId)
      : null;
    const session = await ctx.db
      .query("delivery_tracking")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();
    const trackingActive = Boolean(session?.active);
    const prescription = order.prescriptionId
      ? await ctx.db.get(order.prescriptionId)
      : null;
    const shipment = await ctx.db
      .query("courier_shipments")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();
    const events = (
      await ctx.db
        .query("order_events")
        .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
        .collect()
    ).sort((a, b) => a.createdAt - b.createdAt);
    return {
      ...order,
      items: itemsWithProducts,
      userName: user?.name || user?.email || "Unknown",
      userEmail: user?.email || "",
      userPhone: user?.phone || "",
      address,
      prescriptionStatus: prescription?.status ?? null,
      prescriptionRejectionReason: prescription?.rejectionReason ?? null,
      prescriptionClarificationNote: prescription?.clarificationNote ?? null,
      prescriptionReviewedAt: prescription?.reviewedAt ?? null,
      shipment: shipment ?? null,
      events,
      deliveryBoyName: deliveryBoy?.name || deliveryBoy?.phone || null,
      deliveryBoyPhone: deliveryBoy?.phone || null,
      trackingActive,
      trackingStartedAt: trackingActive ? session?.startedAt ?? null : null,
      lastLocationAt: trackingActive ? session?.lastLocationAt ?? null : null,
    };
  },
});

// Status-producing events an admin may raise directly. Refunds are handled by
// the dedicated payment actions below so fulfillment status is not rewritten.
const STATUS_EVENT: Record<string, OrderEventType> = {
  confirmed: "order_confirmed",
  processing: "processing_started",
  ready_for_dispatch: "packing_completed",
  out_for_delivery: "out_for_delivery",
  delivered: "delivered",
  cancelled: "cancelled",
};

/**
 * Legacy status entry point, kept for compatibility. It now runs through the
 * event engine, so backwards transitions and duplicate transitions are rejected
 * instead of silently corrupting the customer's tracking history.
 */
export const updateOrderStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("processing"),
      v.literal("ready_for_dispatch"),
      v.literal("out_for_delivery"),
      v.literal("delivered"),
      v.literal("cancelled"),
      v.literal("refund_initiated"),
      v.literal("refunded"),
    ),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (args.status === "pending") {
      throw new Error("An order cannot be moved back to pending.");
    }
    if (args.status === "refund_initiated" || args.status === "refunded") {
      throw new Error("Use the refund actions to manage a refund.");
    }
    if (order.status === args.status) {
      return { success: true, alreadyInStatus: true };
    }

    const reason = args.reason?.trim();
    if (args.status === "cancelled") {
      if (order.status === "delivered") {
        throw new Error("A delivered order cannot be cancelled. Use the refund action instead.");
      }
      await releaseStockForOrder(ctx, {
        orderId: args.orderId,
        reason: "Order cancelled by admin",
      });
    }

    await applyOrderEventToOrder(ctx, {
      orderId: args.orderId,
      event: STATUS_EVENT[args.status],
      source: "admin",
      actorId: adminId,
      note: reason || "Updated by staff",
      dedupeKey: `status:${args.status}`,
      extraPatch:
        args.status === "cancelled" && reason
          ? { cancellationReason: reason }
          : undefined,
    });

    return { success: true };
  },
});

/** Confirm a pending order once payment (and prescription, if any) allows it. */
export const confirmOrder = mutation({
  args: { orderId: v.id("orders"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const result = await confirmOrderIfEligible(ctx, {
      orderId: args.orderId,
      source: "admin",
      actorId: adminId,
      note: args.note?.trim() || "Order confirmed by staff",
    });

    if (result.confirmed) return { success: true, alreadyConfirmed: false };
    if (result.status === "confirmed") return { success: true, alreadyConfirmed: true };

    const messages: Record<string, string> = {
      prescription_pending:
        "The prescription must be approved before this order can be confirmed.",
      payment_pending:
        "Online payment has not been verified for this order.",
      not_pending: "This order can no longer be confirmed.",
    };
    throw new Error(messages[result.reason ?? ""] ?? "This order cannot be confirmed.");
  },
});

/** Staff action: processing has actually started. */
export const startProcessing = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (order.status === "processing") {
      return { success: true, alreadyInStatus: true };
    }
    await applyOrderEventToOrder(ctx, {
      orderId: args.orderId,
      event: "processing_started",
      source: "admin",
      actorId: adminId,
      note: "Processing started by staff",
      dedupeKey: "processing_started",
    });
    return { success: true };
  },
});

/** Staff action: packing is complete and the order is ready for dispatch. */
export const completePacking = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (order.status === "ready_for_dispatch") {
      return { success: true, alreadyInStatus: true };
    }
    await applyOrderEventToOrder(ctx, {
      orderId: args.orderId,
      event: "packing_completed",
      source: "admin",
      actorId: adminId,
      note: "Packing completed by staff",
      dedupeKey: "packing_completed",
    });
    return { success: true };
  },
});

/** Staff action: cancellation with the reason preserved for the customer. */
export const cancelOrder = mutation({
  args: { orderId: v.id("orders"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (isTerminalOrderStatus(order.status)) {
      throw new Error("This order is already closed.");
    }

    await releaseStockForOrder(ctx, {
      orderId: args.orderId,
      reason: "Order cancelled by admin",
    });

    const reason = args.reason?.trim();
    await applyOrderEventToOrder(ctx, {
      orderId: args.orderId,
      event: "cancelled",
      source: "admin",
      actorId: adminId,
      note: reason || "Order cancelled by staff",
      dedupeKey: "cancelled",
      extraPatch: reason ? { cancellationReason: reason } : undefined,
    });

    return { success: true };
  },
});

/** Refund tracking is a payment concern; the fulfillment status is untouched. */
export const initiateRefund = mutation({
  args: { orderId: v.id("orders"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (order.paymentStatus !== "paid") {
      throw new Error("Only a paid order can be refunded.");
    }

    const now = Date.now();
    const note = args.note?.trim() || "Refund initiated by staff";
    await ctx.db.patch(args.orderId, {
      paymentStatus: "refund_initiated",
      updatedAt: now,
    });
    await ctx.db.insert("order_events", {
      orderId: args.orderId,
      type: "refund_initiated",
      fromStatus: order.status,
      toStatus: order.status,
      source: "admin",
      actorId: adminId,
      note,
      dedupeKey: "payment_refund_initiated",
      createdAt: now,
    });
    await handleOrderStatusChange(ctx, args.orderId, "refund_initiated");
    await ctx.scheduler.runAfter(
      0,
      api.orderNotifications.sendOrderStatusNotification,
      { orderId: args.orderId, status: "refund_initiated" },
    );
    return { success: true };
  },
});

/** Trusted staff confirmation that the delivery was completed. */
export const confirmDelivery = mutation({
  args: { orderId: v.id("orders"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (order.status === "delivered") {
      return { success: true, alreadyDelivered: true };
    }
    if (order.status !== "out_for_delivery") {
      throw new Error(
        "Only an out-for-delivery order can be confirmed as delivered.",
      );
    }

    await applyOrderEventToOrder(ctx, {
      orderId: args.orderId,
      event: "delivered",
      source: "admin",
      actorId: adminId,
      note: args.note?.trim() || "Delivery verified by staff",
      dedupeKey: "delivered",
    });
    return { success: true, alreadyDelivered: false };
  },
});

export const completeRefund = mutation({
  args: { orderId: v.id("orders"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (order.paymentStatus !== "refund_initiated") {
      throw new Error("Initiate the refund before marking it complete.");
    }

    const now = Date.now();
    const note = args.note?.trim() || "Refund completed by staff";
    await ctx.db.patch(args.orderId, {
      paymentStatus: "refunded",
      updatedAt: now,
    });
    await ctx.db.insert("order_events", {
      orderId: args.orderId,
      type: "refunded",
      fromStatus: order.status,
      toStatus: order.status,
      source: "admin",
      actorId: adminId,
      note,
      dedupeKey: "payment_refunded",
      createdAt: now,
    });
    await handleOrderStatusChange(ctx, args.orderId, "refunded");
    await ctx.scheduler.runAfter(
      0,
      api.orderNotifications.sendOrderStatusNotification,
      { orderId: args.orderId, status: "refunded" },
    );
    return { success: true };
  },
});

// ══════════════════════════════════════════════════════
//  REVIEWS
// ══════════════════════════════════════════════════════

export const listReviews = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const reviews = await ctx.db.query("reviews").collect();
    const products = await ctx.db.query("products").collect();
    const users = await ctx.db.query("users").collect();
    const prodMap = new Map(products.map((p) => [p._id, p.name]));
    const userMap = new Map(users.map((u) => [u._id, u.name || u.email || "Anonymous"]));

    return reviews
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((r) => ({
        ...r,
        productName: prodMap.get(r.productId) || "Deleted Product",
        userName: userMap.get(r.userId) || "Anonymous",
      }));
  },
});

export const deleteReview = mutation({
  args: { reviewId: v.id("reviews") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.reviewId);
    return { success: true };
  },
});

// ══════════════════════════════════════════════════════
//  COUPONS
// ══════════════════════════════════════════════════════

export const listCoupons = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("coupons")
      .collect()
      .then((list) => list.sort((a, b) => b.createdAt - a.createdAt));
  },
});

/**
 * Create or update a coupon with full backend validation.
 * The UI validates too, but nothing here trusts the client: the code is
 * normalized, format-checked, de-duplicated, and every numeric field is
 * range-checked before anything is written.
 */
export const upsertCoupon = mutation({
  args: {
    id: v.optional(v.id("coupons")),
    code: v.string(),
    discountType: v.union(
      v.literal("percentage"),
      v.literal("fixed"),
      v.literal("free_delivery")
    ),
    discountPercent: v.number(),
    fixedDiscount: v.number(),
    maxDiscount: v.number(),
    minOrder: v.number(),
    usageLimit: v.number(),
    isActive: v.boolean(),
    expiresAt: v.number(),
    // ── Extended fields (all optional; existing coupons keep working) ──
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    startsAt: v.optional(v.number()),
    perUserLimit: v.optional(v.number()),
    firstOrderOnly: v.optional(v.boolean()),
    eligibleCategoryIds: v.optional(v.array(v.id("categories"))),
    archived: v.optional(v.boolean()),
    // ── Publication + customer visibility ──
    publicationStatus: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("scheduled"),
        v.literal("active"),
        v.literal("deactivated")
      )
    ),
    showOnHomepage: v.optional(v.boolean()),
    showOnProductPages: v.optional(v.boolean()),
    showInMyCoupons: v.optional(v.boolean()),
    allowCampaignStacking: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // ── Normalize + validate the code ──
    const code = (args.code || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{3,20}$/.test(code)) {
      throw new Error(
        "Coupon code must be 3-20 letters or numbers (no spaces or symbols)."
      );
    }
    const existing = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (existing && existing._id !== args.id) {
      throw new Error(`Coupon code "${code}" already exists.`);
    }

    // ── Validate the discount definition ──
    if (args.discountType === "percentage") {
      if (
        !Number.isFinite(args.discountPercent) ||
        args.discountPercent < 1 ||
        args.discountPercent > 100
      ) {
        throw new Error("Percentage discount must be between 1 and 100.");
      }
    } else if (args.discountType === "fixed") {
      if (!Number.isFinite(args.fixedDiscount) || args.fixedDiscount <= 0) {
        throw new Error("Flat discount must be greater than ₹0.");
      }
    }

    const finiteNonNegative = (value: number, label: string) => {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`${label} must be zero or more.`);
      }
    };
    finiteNonNegative(args.maxDiscount, "Maximum discount");
    finiteNonNegative(args.minOrder, "Minimum order");
    finiteNonNegative(args.usageLimit, "Usage limit");
    if (args.perUserLimit !== undefined) {
      finiteNonNegative(args.perUserLimit, "Per-customer limit");
    }
    if (!Number.isFinite(args.expiresAt) || args.expiresAt <= 0) {
      throw new Error("Expiry date is required.");
    }
    if (args.startsAt !== undefined && args.startsAt >= args.expiresAt) {
      throw new Error("Start date must be before the expiry date.");
    }
    if (args.publicationStatus === "scheduled" && args.startsAt === undefined) {
      throw new Error("A scheduled coupon needs a start date.");
    }

    // The explicit publication state (when sent) drives the legacy isActive
    // flag, so every existing customer query keeps working unchanged: only
    // active/scheduled coupons are live, draft and deactivated ones never are.
    const publicationStatus =
      args.publicationStatus ?? (args.isActive ? "active" : "deactivated");
    const effectiveIsActive =
      publicationStatus === "active" || publicationStatus === "scheduled";

    const fields = {
      code,
      discountType: args.discountType,
      discountPercent: args.discountType === "percentage" ? args.discountPercent : 0,
      fixedDiscount: args.discountType === "fixed" ? args.fixedDiscount : 0,
      maxDiscount: args.maxDiscount,
      minOrder: args.minOrder,
      usageLimit: Math.floor(args.usageLimit),
      isActive: effectiveIsActive,
      expiresAt: args.expiresAt,
      publicationStatus,
      showOnHomepage: args.showOnHomepage ?? false,
      showOnProductPages: args.showOnProductPages ?? false,
      showInMyCoupons: args.showInMyCoupons ?? false,
      allowCampaignStacking: args.allowCampaignStacking ?? true,
      name: args.name?.trim() || undefined,
      description: args.description?.trim() || undefined,
      startsAt: args.startsAt ?? undefined,
      perUserLimit:
        args.perUserLimit !== undefined ? Math.floor(args.perUserLimit) : undefined,
      firstOrderOnly: args.firstOrderOnly ?? false,
      eligibleCategoryIds:
        args.eligibleCategoryIds && args.eligibleCategoryIds.length > 0
          ? args.eligibleCategoryIds
          : undefined,
      // Only touch `archived` when the caller explicitly sends it, so an
      // ordinary edit of an archived coupon does not silently un-archive it.
      ...(args.archived !== undefined ? { archived: args.archived } : {}),
    };

    if (args.id) {
      const coupon = await ctx.db.get(args.id);
      if (!coupon) throw new Error("Coupon not found");
      await ctx.db.patch(args.id, fields);
      return { success: true, id: args.id };
    }

    const id = await ctx.db.insert("coupons", {
      ...fields,
      usedCount: 0,
      createdAt: Date.now(),
    });
    return { success: true, id };
  },
});

/**
 * Delete a coupon — but only when nothing references it. A coupon that has
 * ever been redeemed (or appears on a historical order) is archived instead
 * of deleted, so order history and financial records stay intact.
 */
export const deleteCoupon = mutation({
  args: { couponId: v.id("coupons") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const coupon = await ctx.db.get(args.couponId);
    if (!coupon) throw new Error("Coupon not found");

    const redemptions = await ctx.db
      .query("coupon_redemptions")
      .withIndex("by_coupon", (q) => q.eq("couponId", args.couponId))
      .first();

    let referencedByOrder = false;
    if (!redemptions) {
      const orders = await ctx.db.query("orders").collect();
      referencedByOrder = orders.some((o) => o.couponCode === coupon.code);
    }

    if (redemptions || referencedByOrder) {
      await ctx.db.patch(args.couponId, { isActive: false, archived: true });
      return { success: true, archived: true as const };
    }

    await ctx.db.delete(args.couponId);
    return { success: true, archived: false as const };
  },
});

/**
 * Coupon analytics — computed only from stored redemption and order records.
 * No fabricated rates: order value is reported as order value (never as
 * profit), and metrics without underlying data simply come back as 0.
 */
export const couponAnalytics = query({
  args: {
    /** Only count orders placed at or after this timestamp. */
    since: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const since = args.since ?? 0;

    const [coupons, orders] = await Promise.all([
      ctx.db.query("coupons").collect(),
      ctx.db.query("orders").collect(),
    ]);

    const now = Date.now();
    const stats: Record<
      string,
      {
        couponId: string;
        status: string;
        redemptions: number;
        released: number;
        uniqueCustomers: number;
        totalDiscountGranted: number;
        deliveryWaived: number;
        orderCount: number;
        cancelledOrders: number;
        grossOrderValue: number;
        lastUsedAt: number | null;
      }
    > = {};

    for (const coupon of coupons) {
      const related = orders.filter(
        (o) => o.couponCode === coupon.code && o.createdAt >= since
      );
      const live = related.filter((o) => o.status !== "cancelled");
      const redemptions = await ctx.db
        .query("coupon_redemptions")
        .withIndex("by_coupon", (q) => q.eq("couponId", coupon._id))
        .collect();
      const counted = redemptions.filter((r) => r.status !== "released");

      stats[coupon._id] = {
        couponId: coupon._id,
        status: couponStatus(coupon, now),
        redemptions: counted.length,
        released: redemptions.length - counted.length,
        uniqueCustomers: new Set(live.map((o) => o.userId)).size,
        // Actual discount recorded on the orders themselves.
        totalDiscountGranted: live.reduce(
          (sum, o) => sum + (o.couponDiscount ?? 0),
          0
        ),
        // Delivery waived by free-delivery coupons (orders store this
        // separately, because it never enters the item discount).
        deliveryWaived: counted.reduce((sum, r) => sum + r.deliveryWaived, 0),
        orderCount: related.length,
        cancelledOrders: related.length - live.length,
        grossOrderValue: live.reduce((sum, o) => sum + o.totalAmount, 0),
        lastUsedAt:
          related.length > 0
            ? Math.max(...related.map((o) => o.createdAt))
            : null,
      };
    }

    return stats;
  },
});

/**
 * Full detail for one coupon — the data-backed numbers behind the admin View
 * panel. Everything here is read from stored coupons, redemption rows and
 * orders; no estimates and no demo values.
 *
 * A redemption is counted once the order has actually gone through: released
 * holds (failed payment / cancellation) are excluded, cancelled orders are
 * reported separately, and analytics never double-count a repeated callback.
 */
export const couponDetails = query({
  args: { couponId: v.id("coupons") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const coupon = await ctx.db.get(args.couponId);
    if (!coupon) throw new Error("Coupon not found");

    const [redemptions, orders] = await Promise.all([
      ctx.db
        .query("coupon_redemptions")
        .withIndex("by_coupon", (q) => q.eq("couponId", args.couponId))
        .collect(),
      ctx.db.query("orders").collect(),
    ]);

    const relatedOrders = orders.filter((o) => o.couponCode === coupon.code);
    const liveOrders = relatedOrders.filter((o) => o.status !== "cancelled");
    const counted = redemptions.filter((r) => r.status !== "released");
    const uniqueCouponOrders = new Set(counted.map((r) => r.orderId));

    const usageLimit = coupon.usageLimit;
    const usedQuantity = coupon.usedCount;
    const remaining =
      usageLimit > 0 ? Math.max(0, usageLimit - usedQuantity) : null;

    return {
      coupon,
      status: couponStatus(coupon, Date.now()),
      analytics: {
        totalRedemptions: counted.length,
        releasedRedemptions: redemptions.length - counted.length,
        uniqueCustomers: new Set(counted.map((r) => r.userId)).size,
        totalDiscountGranted: counted.reduce(
          (sum, r) => sum + r.discountAmount,
          0
        ),
        deliveryWaived: counted.reduce((sum, r) => sum + r.deliveryWaived, 0),
        successfulOrders: uniqueCouponOrders.size,
        orderCount: relatedOrders.length,
        cancelledOrders: relatedOrders.length - liveOrders.length,
        lastUsedAt:
          counted.length > 0
            ? Math.max(...counted.map((r) => r.updatedAt))
            : null,
      },
      usage: {
        // 0 / undefined means unlimited in the existing coupon convention.
        usageLimit: usageLimit > 0 ? usageLimit : null,
        usedQuantity,
        remainingQuantity: remaining,
        /** Quantity that can still be handed out/used; null = unlimited. */
        availableQuantity: remaining,
      },
    };
  },
});

// ══════════════════════════════════════════════════════
//  USERS
// ══════════════════════════════════════════════════════

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const orders = await ctx.db.query("orders").collect();
    const orderCounts = new Map<string, number>();
    const orderTotals = new Map<string, number>();
    for (const o of orders) {
      const uid = o.userId as string;
      orderCounts.set(uid, (orderCounts.get(uid) || 0) + 1);
      orderTotals.set(uid, (orderTotals.get(uid) || 0) + o.totalAmount);
    }
    return users.map((u) => ({
      ...u,
      orderCount: orderCounts.get(u._id as string) || 0,
      totalSpent: orderTotals.get(u._id as string) || 0,
    }));
  },
});

export const toggleUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("customer")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.userId, { role: args.role });
    return { success: true };
  },
});

// ══════════════════════════════════════════════════════
//  SALES REPORT
// ══════════════════════════════════════════════════════

export const salesReport = query({
  args: {
    period: v.union(
      v.literal("today"),
      v.literal("week"),
      v.literal("month"),
      v.literal("year"),
      v.literal("all"),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const allOrders = await ctx.db.query("orders").collect();
    const allProducts = await ctx.db.query("products").collect();
    const allCategories = await ctx.db.query("categories").collect();

    const now = Date.now();
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;

    let start = 0;
    if (args.period === "today") {
      start = todayStart;
    } else if (args.period === "week") {
      start = now - 7 * 24 * 60 * 60 * 1000;
    } else if (args.period === "month") {
      start = now - 30 * 24 * 60 * 60 * 1000;
    } else if (args.period === "year") {
      start = now - 365 * 24 * 60 * 60 * 1000;
    }
    // "all" => start = 0

    const filtered = args.period === "all"
      ? allOrders
      : allOrders.filter((o) => o.createdAt >= start);

    const nonCancelled = filtered.filter((o) => o.status !== "cancelled");
    const cancelled = filtered.filter((o) => o.status === "cancelled");
    const refunded = filtered.filter((o) => o.paymentStatus === "refunded");

    const revenue = nonCancelled.reduce((s, o) => s + o.totalAmount, 0);
    const totalRefunds = refunded.reduce((s, o) => s + o.totalAmount, 0);
    const avgOrderValue = nonCancelled.length > 0 ? revenue / nonCancelled.length : 0;

    // Payment methods
    const onlinePayments = filtered.filter((o) => o.paymentMethod === "online");
    const codPayments = filtered.filter((o) => o.paymentMethod === "cod");
    const onlineRevenue = onlinePayments
      .filter((o) => o.status !== "cancelled")
      .reduce((s, o) => s + o.totalAmount, 0);
    const codRevenue = codPayments
      .filter((o) => o.status !== "cancelled")
      .reduce((s, o) => s + o.totalAmount, 0);

    // Top products
    const prodMap = new Map(allProducts.map((p) => [p._id, p]));
    const catMap = new Map(allCategories.map((c) => [c._id, c.name]));
    const productSales: Record<string, { name: string; count: number; revenue: number; category: string }> = {};
    for (const order of nonCancelled) {
      for (const item of order.items || []) {
        const key = item.productId as string;
        if (!productSales[key]) {
          const prod = prodMap.get(item.productId as any);
          productSales[key] = {
            name: item.name,
            count: 0,
            revenue: 0,
            category: prod ? (catMap.get(prod.categoryId) || "Unknown") : "Unknown",
          };
        }
        productSales[key].count += item.quantity;
        productSales[key].revenue += item.price * item.quantity;
      }
    }
    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Top categories
    const categorySales: Record<string, { name: string; count: number; revenue: number }> = {};
    for (const p of topProducts) {
      const cat = p.category;
      if (!categorySales[cat]) {
        categorySales[cat] = { name: cat, count: 0, revenue: 0 };
      }
      categorySales[cat].count += p.count;
      categorySales[cat].revenue += p.revenue;
    }
    const topCategories = Object.values(categorySales)
      .sort((a, b) => b.revenue - a.revenue);

    // Status distribution
    const statusCounts: Record<string, number> = {};
    for (const o of filtered) {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    }

    // Daily revenue for chart (last 30 days if period is week/month/year)
    const dailyRevenue: { date: string; revenue: number; orders: number }[] = [];
    const chartDays = args.period === "today" ? 1 : args.period === "week" ? 7 : args.period === "month" ? 30 : args.period === "year" ? 12 : 30;
    if (args.period === "year") {
      // Monthly buckets
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const month = d.toLocaleString("en-IN", { month: "short", year: "2-digit" });
        const mStart = d.getTime();
        const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).getTime();
        const periodOrders = nonCancelled.filter((o) => o.createdAt >= mStart && o.createdAt <= mEnd);
        dailyRevenue.push({
          date: month,
          revenue: periodOrders.reduce((s, o) => s + o.totalAmount, 0),
          orders: periodOrders.length,
        });
      }
    } else {
      for (let i = chartDays - 1; i >= 0; i--) {
        const d = new Date(now - i * 24 * 60 * 60 * 1000);
        const date = d.toLocaleString("en-IN", { day: "numeric", month: "short" });
        const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const dEnd = dStart + 24 * 60 * 60 * 1000;
        const dayOrders = nonCancelled.filter((o) => o.createdAt >= dStart && o.createdAt < dEnd);
        dailyRevenue.push({
          date,
          revenue: dayOrders.reduce((s, o) => s + o.totalAmount, 0),
          orders: dayOrders.length,
        });
      }
    }

    return {
      period: args.period,
      revenue,
      totalOrders: filtered.length,
      deliveredOrders: filtered.filter((o) => o.status === "delivered").length,
      cancelledOrders: cancelled.length,
      totalRefunds,
      avgOrderValue,
      onlinePayments: { count: onlinePayments.length, revenue: onlineRevenue },
      codPayments: { count: codPayments.length, revenue: codRevenue },
      topProducts,
      topCategories,
      statusCounts,
      dailyRevenue,
    };
  },
});

// ══════════════════════════════════════════════════════
//  INVENTORY REPORT
// ══════════════════════════════════════════════════════

export const inventoryReport = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const products = await ctx.db.query("products").collect();
    const categories = await ctx.db.query("categories").collect();
    const logs = await ctx.db.query("inventory_logs").collect();

    const catMap = new Map(categories.map((c) => [c._id, c.name]));

    const active = products.filter((p) => p.isActive);
    const lowStockThreshold = 10;
    const lowStock = active.filter((p) => p.stockQuantity > 0 && p.stockQuantity <= lowStockThreshold);
    const outOfStock = active.filter((p) => p.stockQuantity === 0);
    const inStock = active.filter((p) => p.stockQuantity > lowStockThreshold);
    const totalStock = active.reduce((s, p) => s + p.stockQuantity, 0);
    const totalValue = active.reduce((s, p) => s + p.stockQuantity * p.price, 0);

    // Recent stock movements
    const recentLogs = [...logs]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 50);

    const enrichedLogs = await Promise.all(
      recentLogs.map(async (log) => {
        const product = await ctx.db.get(log.productId);
        const admin = await ctx.db.get(log.adminId);
        return {
          ...log,
          productName: product?.name || "Unknown",
          categoryName: product ? (catMap.get(product.categoryId) || "Unknown") : "Unknown",
          adminName: admin?.name || "Unknown",
        };
      })
    );

    // Stock by category
    const catStock: Record<string, { name: string; count: number; totalStock: number; totalValue: number }> = {};
    for (const p of active) {
      const cat = catMap.get(p.categoryId) || "Unknown";
      if (!catStock[cat]) catStock[cat] = { name: cat, count: 0, totalStock: 0, totalValue: 0 };
      catStock[cat].count++;
      catStock[cat].totalStock += p.stockQuantity;
      catStock[cat].totalValue += p.stockQuantity * p.price;
    }

    return {
      totalProducts: active.length,
      totalStock,
      totalValue,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      inStockCount: inStock.length,
      lowStockProducts: lowStock.map((p) => ({
        _id: p._id,
        name: p.name,
        sku: p.sku,
        stockQuantity: p.stockQuantity,
        categoryName: catMap.get(p.categoryId) || "Unknown",
        price: p.price,
      })),
      outOfStockProducts: outOfStock.map((p) => ({
        _id: p._id,
        name: p.name,
        sku: p.sku,
        categoryName: catMap.get(p.categoryId) || "Unknown",
        price: p.price,
      })),
      recentLogs: enrichedLogs,
      stockByCategory: Object.values(catStock).sort((a, b) => b.totalValue - a.totalValue),
    };
  },
});

// ══════════════════════════════════════════════════════
//  CSV EXPORT DATA
// ══════════════════════════════════════════════════════

export const exportOrders = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const orders = await ctx.db.query("orders").collect();
    const users = await ctx.db.query("users").collect();
    const userMap = new Map(users.map((u) => [u._id, u]));

    return orders.sort((a, b) => b.createdAt - a.createdAt).map((o) => {
      const user = userMap.get(o.userId);
      return {
        invoiceNumber: o.invoiceNumber || o._id.slice(-8),
        customerName: user?.name || "Unknown",
        customerEmail: user?.email || "",
        customerPhone: user?.phone || o.phone,
        status: o.status,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus || "pending",
        subtotal: o.subtotal,
        discount: o.discount,
        deliveryFee: o.deliveryFee,
        tax: o.tax,
        totalAmount: o.totalAmount,
        itemCount: o.items.length,
        shippingAddress: o.shippingAddress,
        createdAt: new Date(o.createdAt).toISOString(),
        updatedAt: new Date(o.updatedAt).toISOString(),
      };
    });
  },
});

export const exportProducts = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const products = await ctx.db.query("products").collect();
    const categories = await ctx.db.query("categories").collect();
    const catMap = new Map(categories.map((c) => [c._id, c.name]));

    return products.sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({
      name: p.name,
      sku: p.sku || "",
      category: catMap.get(p.categoryId) || "Unknown",
      manufacturer: p.manufacturer,
      price: p.price,
      discountPrice: p.discountPrice || "",
      stockQuantity: p.stockQuantity,
      packSize: p.packSize,
      prescriptionRequired: p.prescriptionRequired ? "Yes" : "No",
      isActive: p.isActive ? "Yes" : "No",
      createdAt: new Date(p.createdAt).toISOString(),
    }));
  },
});

export const exportInventory = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const products = await ctx.db.query("products").collect();
    const categories = await ctx.db.query("categories").collect();
    const logs = await ctx.db.query("inventory_logs").collect();
    const catMap = new Map(categories.map((c) => [c._id, c.name]));
    const logMap = new Map<string, any>();
    for (const l of logs) {
      const key = l.productId as string;
      if (!logMap.has(key) || l.createdAt > logMap.get(key).createdAt) {
        logMap.set(key, l);
      }
    }

    return products
      .filter((p) => p.isActive)
      .sort((a, b) => a.stockQuantity - b.stockQuantity)
      .map((p) => {
        const lastLog = logMap.get(p._id as string);
        return {
          name: p.name,
          sku: p.sku || "",
          category: catMap.get(p.categoryId) || "Unknown",
          stockQuantity: p.stockQuantity,
          price: p.price,
          stockValue: p.stockQuantity * p.price,
          lastAdjusted: lastLog ? new Date(lastLog.createdAt).toISOString() : "Never",
          lastReason: lastLog?.reason || "",
        };
      });
  },
});
