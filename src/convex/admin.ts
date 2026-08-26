import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";
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

    // Delegate notification to the centralized order notification service.
    // This determines available channels (email/SMS/WhatsApp) based on the
    // customer's verified contact info and notification preferences.
    await ctx.scheduler.runAfter(0, api.orderNotifications.sendOrderStatusNotification, {
      orderId: args.orderId,
      status: args.status,
    });

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
    discountType: v.union(v.literal("percentage"), v.literal("fixed")),
    discountPercent: v.number(),
    fixedDiscount: v.number(),
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
        discountType: args.discountType,
        discountPercent: args.discountPercent,
        fixedDiscount: args.fixedDiscount,
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
      discountType: args.discountType,
      discountPercent: args.discountPercent,
      fixedDiscount: args.fixedDiscount,
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
