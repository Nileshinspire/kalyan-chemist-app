import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

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

    const totalRevenue = allOrders
      .filter((o) => o.status !== "cancelled")
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const pendingOrders = allOrders.filter((o) => o.status === "pending").length;
    const lowStock = allProducts.filter(
      (p) => p.stockQuantity < 10 && p.isActive
    ).length;
    const totalProducts = allProducts.filter((p) => p.isActive).length;

    // Recent orders (last 5)
    const recentOrders = [...allOrders]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5);

    // Monthly revenue (last 6 months)
    const now = Date.now();
    const monthlyRevenue: { month: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now - i * 30 * 24 * 60 * 60 * 1000);
      const month = d.toLocaleString("en-IN", { month: "short" });
      const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
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
      pendingOrders,
      totalProducts,
      lowStock,
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

    if (args.id) {
      const { id: _id, ...patchData } = args;
      await ctx.db.patch(args.id, { ...patchData, updatedAt: now });
      return { success: true, id: args.id };
    }

    const id = await ctx.db.insert("products", {
      name: args.name,
      slug: args.slug,
      description: args.description,
      price: args.price,
      discountPrice: args.discountPrice,
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
    return orders
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((o) => ({
        ...o,
        userName: userMap.get(o.userId) || "Unknown",
      }));
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
    return {
      ...order,
      items: itemsWithProducts,
      userName: user?.name || user?.email || "Unknown",
      userEmail: user?.email || "",
      userPhone: user?.phone || "",
      address,
    };
  },
});

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
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");

    // If cancelling, restore stock
    if (args.status === "cancelled" && order.status !== "cancelled") {
      for (const item of order.items) {
        const product = await ctx.db.get(item.productId);
        if (product) {
          await ctx.db.patch(product._id, {
            stockQuantity: product.stockQuantity + item.quantity,
          });
        }
      }
    }

    const now = Date.now();
    const existingHistory = order.statusHistory || [];
    await ctx.db.patch(args.orderId, {
      status: args.status,
      statusHistory: [...existingHistory, { status: args.status, timestamp: now }],
      updatedAt: now,
    });

    // Notify the customer of the status change
    const statusTitles: Record<string, string> = {
      confirmed: "Order Confirmed ✓",
      processing: "Order Being Prepared",
      ready_for_dispatch: "Ready for Dispatch 📦",
      out_for_delivery: "Out for Delivery 🚚",
      delivered: "Order Delivered ✓",
      cancelled: "Order Cancelled",
      refund_initiated: "Refund Initiated",
      refunded: "Refund Completed ✓",
    };
    const statusBodies: Record<string, string> = {
      confirmed: `Your order ${order.invoiceNumber || ""} has been confirmed and is being processed.`,
      processing: `Your order ${order.invoiceNumber || ""} is being packed by our pharmacist.`,
      ready_for_dispatch: `Your order ${order.invoiceNumber || ""} has been packed and is ready for dispatch.`,
      out_for_delivery: `Your order ${order.invoiceNumber || ""} is on its way to you.`,
      delivered: `Your order ${order.invoiceNumber || ""} has been delivered. We hope you feel better soon!`,
      cancelled: `Your order ${order.invoiceNumber || ""} has been cancelled.${order.paymentMethod === "online" ? " A refund will be initiated." : ""}`,
      refund_initiated: `Your refund for order ${order.invoiceNumber || ""} has been initiated. It will be processed within 5-7 business days.`,
      refunded: `Your refund for order ${order.invoiceNumber || ""} has been completed.`,
    };
    if (statusTitles[args.status]) {
      await ctx.db.insert("notifications", {
        userId: order.userId,
        type: "order_status",
        title: statusTitles[args.status],
        body: statusBodies[args.status],
        read: false,
        link: `/orders/${args.orderId}`,
        metadata: JSON.stringify({ orderId: args.orderId, status: args.status }),
        createdAt: Date.now(),
      });
    }

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

export const upsertCoupon = mutation({
  args: {
    id: v.optional(v.id("coupons")),
    code: v.string(),
    discountPercent: v.number(),
    maxDiscount: v.number(),
    minOrder: v.number(),
    usageLimit: v.number(),
    isActive: v.boolean(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    if (args.id) {
      await ctx.db.patch(args.id, {
        code: args.code.toUpperCase(),
        discountPercent: args.discountPercent,
        maxDiscount: args.maxDiscount,
        minOrder: args.minOrder,
        usageLimit: args.usageLimit,
        isActive: args.isActive,
        expiresAt: args.expiresAt,
      });
      return { success: true, id: args.id };
    }

    const id = await ctx.db.insert("coupons", {
      code: args.code.toUpperCase(),
      discountPercent: args.discountPercent,
      maxDiscount: args.maxDiscount,
      minOrder: args.minOrder,
      usageLimit: args.usageLimit,
      usedCount: 0,
      isActive: args.isActive,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    });
    return { success: true, id };
  },
});

export const deleteCoupon = mutation({
  args: { couponId: v.id("coupons") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.couponId);
    return { success: true };
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
