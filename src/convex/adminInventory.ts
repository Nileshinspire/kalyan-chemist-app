import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

async function requireAdmin(ctx: { db: any; auth: any }) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (user?.role !== "admin") throw new Error("Not authorized");
  return userId;
}

// ── Admin: List products with stock info ──
export const list = query({
  args: {
    search: v.optional(v.string()),
    lowStockThreshold: v.optional(v.number()),
    filter: v.optional(v.union(
      v.literal("all"),
      v.literal("in_stock"),
      v.literal("low_stock"),
      v.literal("out_of_stock"),
    )),
  },
  handler: async (ctx, args) => {
    let products = await ctx.db
      .query("products")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    if (args.search) {
      const s = args.search.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(s) ||
          (p.sku && p.sku.toLowerCase().includes(s))
      );
    }

    const threshold = args.lowStockThreshold ?? 10;

    // Enrich with category name and stock status
    const enriched = await Promise.all(
      products.map(async (p) => {
        const category = await ctx.db.get(p.categoryId);
        let stockStatus: "in_stock" | "low_stock" | "out_of_stock" = "in_stock";
        if (p.stockQuantity === 0) stockStatus = "out_of_stock";
        else if (p.stockQuantity <= threshold) stockStatus = "low_stock";

        return {
          ...p,
          categoryName: category?.name ?? "Unknown",
          stockStatus,
        };
      })
    );

    // Filter by stock status
    if (args.filter && args.filter !== "all") {
      return enriched.filter((p) => p.stockStatus === args.filter);
    }

    return enriched;
  },
});

// ── Admin: Get inventory logs for a product ──
export const getLogs = query({
  args: {
    productId: v.id("products"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("inventory_logs")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .order("desc")
      .take(args.limit ?? 20);

    const enriched = await Promise.all(
      logs.map(async (log) => {
        const admin = await ctx.db.get(log.adminId);
        const product = await ctx.db.get(log.productId);
        return {
          ...log,
          adminName: admin?.name ?? "Unknown",
          productName: product?.name ?? "Unknown",
        };
      })
    );

    return enriched;
  },
});

// ── Admin: Adjust stock for a product ──
export const adjustStock = mutation({
  args: {
    productId: v.id("products"),
    newQuantity: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    if (args.newQuantity < 0) {
      throw new Error("Stock quantity cannot be negative");
    }

    const previousQuantity = product.stockQuantity;
    const adjustment = args.newQuantity - previousQuantity;

    await ctx.db.patch(args.productId, {
      stockQuantity: args.newQuantity,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("inventory_logs", {
      productId: args.productId,
      previousQuantity,
      newQuantity: args.newQuantity,
      adjustment,
      reason: args.reason,
      adminId,
      createdAt: Date.now(),
    });

    // Stock availability notifications:
    // When stock goes from 0 to >0, notify customers who were waiting
    let notifiedCount = 0;
    if (previousQuantity === 0 && args.newQuantity > 0) {
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

      for (const notif of waiting) {
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
            createdAt: Date.now(),
          });
        }

        notifiedCount++;
      }
    }

    return { success: true, previousQuantity, newQuantity: args.newQuantity, adjustment, notifiedCount };
  },
});

// ── Admin: Get low stock summary ──
export const getLowStockSummary = query({
  args: {
    threshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const threshold = args.threshold ?? 10;
    const products = await ctx.db
      .query("products")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    const outOfStock = products.filter((p) => p.stockQuantity === 0);
    const lowStock = products.filter(
      (p) => p.stockQuantity > 0 && p.stockQuantity <= threshold
    );
    const inStock = products.filter((p) => p.stockQuantity > threshold);

    return {
      total: products.length,
      outOfStockCount: outOfStock.length,
      lowStockCount: lowStock.length,
      inStockCount: inStock.length,
      threshold,
    };
  },
});
