import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// ── Get regular medicines for the current user with live product data ──
export const listRegularMedicines = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const regulars = await ctx.db
      .query("regular_medicines")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const withProducts = await Promise.all(
      regulars.map(async (r) => {
        const product = await ctx.db.get(r.productId);
        return { ...r, product };
      })
    );

    return withProducts.filter((r) => r.product !== null);
  },
});

// ── Save a medicine as a regular medicine ──
export const saveRegularMedicine = mutation({
  args: {
    productId: v.id("products"),
    suggestedQuantity: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    // Check product exists and is active
    const product = await ctx.db.get(args.productId);
    if (!product || !product.isActive) {
      throw new Error("Product not available");
    }

    // Check if already saved
    const existing = await ctx.db
      .query("regular_medicines")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId)
      )
      .first();

    if (existing) {
      // Update existing
      await ctx.db.patch(existing._id, {
        suggestedQuantity: args.suggestedQuantity,
        notes: args.notes,
        updatedAt: Date.now(),
      });
      return { success: true, id: existing._id, updated: true };
    }

    const now = Date.now();
    const id = await ctx.db.insert("regular_medicines", {
      userId,
      productId: args.productId,
      suggestedQuantity: args.suggestedQuantity,
      notes: args.notes,
      source: "manual",
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, id, updated: false };
  },
});

// ── Remove a regular medicine ──
export const removeRegularMedicine = mutation({
  args: { regularMedicineId: v.id("regular_medicines") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const record = await ctx.db.get(args.regularMedicineId);
    if (!record || record.userId !== userId) {
      throw new Error("Not found");
    }

    await ctx.db.delete(args.regularMedicineId);
    return { success: true };
  },
});

// ── Auto-detect regular medicines from order history ──
// Called when customer visits refill page to suggest medicines
export const getSuggestionsFromOrders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    // Get all delivered orders
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const deliveredOrders = orders.filter(
      (o) => o.status === "delivered" || o.status === "confirmed" || o.status === "processing"
    );

    if (deliveredOrders.length === 0) return [];

    // Count how often each product appears across orders
    const productFrequency: Record<
      string,
      { count: number; lastOrderAt: number; lastQuantity: number; productId: string }
    > = {};

    for (const order of deliveredOrders) {
      for (const item of order.items) {
        const key = item.productId;
        if (!productFrequency[key]) {
          productFrequency[key] = {
            count: 0,
            lastOrderAt: 0,
            lastQuantity: item.quantity,
            productId: key,
          };
        }
        productFrequency[key].count++;
        productFrequency[key].lastOrderAt = Math.max(
          productFrequency[key].lastOrderAt,
          order.createdAt
        );
        productFrequency[key].lastQuantity = item.quantity;
      }
    }

    // Filter products that appear more than once (potential regulars)
    const frequentProducts = Object.values(productFrequency).filter(
      (p) => p.count >= 2
    );

    // Get existing regular medicines to exclude
    const existingRegulars = await ctx.db
      .query("regular_medicines")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const existingIds = new Set(existingRegulars.map((r) => r.productId));

    // Get product details and reminders
    const suggestions = await Promise.all(
      frequentProducts
        .filter((p) => !existingIds.has(p.productId as any))
        .map(async (p) => {
          const product = await ctx.db.get(p.productId as any);
          const reminder = await ctx.db
            .query("refill_reminders")
            .withIndex("by_user_active", (q) =>
              q.eq("userId", userId).eq("isActive", true)
            )
            .collect();
          const hasReminder = reminder.some(
            (r) => r.productId === (p.productId as any)
          );
          return {
            ...p,
            product,
            hasReminder,
          };
        })
    );

    return suggestions.filter((s) => s.product !== null && (s.product as any).isActive);
  },
});

// ── Get refill reminders for current user ──
export const listReminders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const reminders = await ctx.db
      .query("refill_reminders")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("isActive", true)
      )
      .collect();

    const withProducts = await Promise.all(
      reminders.map(async (r) => {
        const product = await ctx.db.get(r.productId);
        return { ...r, product };
      })
    );

    return withProducts.filter((r) => r.product !== null);
  },
});

// ── Create a refill reminder ──
export const createReminder = mutation({
  args: {
    productId: v.id("products"),
    intervalDays: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const product = await ctx.db.get(args.productId);
    if (!product || !product.isActive) {
      throw new Error("Product not available");
    }

    if (args.intervalDays < 7) {
      throw new Error("Minimum interval is 7 days");
    }

    // Check for existing active reminder
    const existing = await ctx.db
      .query("refill_reminders")
      .withIndex("by_user_active", (q) =>
        q.eq("userId", userId).eq("isActive", true)
      )
      .collect();

    const alreadyExists = existing.find((r) => r.productId === args.productId);
    if (alreadyExists) {
      throw new Error("A reminder already exists for this medicine");
    }

    const now = Date.now();
    const nextReminder = now + args.intervalDays * 24 * 60 * 60 * 1000;

    const id = await ctx.db.insert("refill_reminders", {
      userId,
      productId: args.productId,
      intervalDays: args.intervalDays,
      lastReminderAt: now,
      nextReminderAt: nextReminder,
      isActive: true,
      notes: args.notes,
      createdAt: now,
    });

    return { success: true, id };
  },
});

// ── Delete a refill reminder ──
export const removeReminder = mutation({
  args: { reminderId: v.id("refill_reminders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder || reminder.userId !== userId) {
      throw new Error("Not found");
    }

    await ctx.db.delete(args.reminderId);
    return { success: true };
  },
});

// ── Add selected medicines to cart (refill flow) ──
export const addToCart = mutation({
  args: {
    items: v.array(
      v.object({
        productId: v.id("products"),
        quantity: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const results: { productId: string; success: boolean; error?: string }[] = [];

    for (const item of args.items) {
      const product = await ctx.db.get(item.productId);
      if (!product || !product.isActive) {
        results.push({
          productId: item.productId,
          success: false,
          error: "Product not available",
        });
        continue;
      }

      if (product.stockQuantity < item.quantity) {
        results.push({
          productId: item.productId,
          success: false,
          error: "Insufficient stock",
        });
        continue;
      }

      // Check if already in cart
      const existing = await ctx.db
        .query("cart_items")
        .withIndex("by_user_product", (q) =>
          q.eq("userId", userId).eq("productId", item.productId)
        )
        .first();

      if (existing) {
        const newQty = existing.quantity + item.quantity;
        if (newQty > product.stockQuantity) {
          results.push({
            productId: item.productId,
            success: false,
            error: "Insufficient stock",
          });
          continue;
        }
        await ctx.db.patch(existing._id, { quantity: newQty });
      } else {
        await ctx.db.insert("cart_items", {
          userId,
          productId: item.productId,
          quantity: item.quantity,
        });
      }

      results.push({ productId: item.productId, success: true });
    }

    return results;
  },
});

// ── Create a refill request record ──
export const createRefillRequest = mutation({
  args: {
    medicines: v.array(
      v.object({
        productId: v.id("products"),
        productName: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        prescriptionRequired: v.boolean(),
        available: v.boolean(),
      })
    ),
    totalAmount: v.number(),
    reminderId: v.optional(v.id("refill_reminders")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const now = Date.now();
    const id = await ctx.db.insert("refill_requests", {
      userId,
      medicines: args.medicines,
      totalAmount: args.totalAmount,
      status: "confirmed",
      reminderId: args.reminderId,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, id };
  },
});

// ── List refill requests for current user ──
export const listMyRefillRequests = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    return await ctx.db
      .query("refill_requests")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

// ── Get medicines from delivered orders for suggestion ──
export const getDeliveredOrderMedicines = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Get all items from delivered orders
    const items: {
      productId: string;
      name: string;
      quantity: number;
      lastOrderDate: number;
    }[] = [];

    for (const order of orders) {
      if (order.status !== "delivered" && order.status !== "confirmed" && order.status !== "processing") {
        continue;
      }
      for (const item of order.items) {
        const existing = items.find((i) => i.productId === item.productId);
        if (existing) {
          existing.lastOrderDate = Math.max(existing.lastOrderDate, order.createdAt);
        } else {
          items.push({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            lastOrderDate: order.createdAt,
          });
        }
      }
    }

    // Get full product data and availability
    const withProducts = await Promise.all(
      items.map(async (item) => {
        const product = await ctx.db.get(item.productId as any);
        return {
          ...item,
          product,
          daysSinceLastOrder: Math.floor(
            (Date.now() - item.lastOrderDate) / (24 * 60 * 60 * 1000)
          ),
        };
      })
    );

    return withProducts.filter((i) => i.product !== null && (i.product as any).isActive);
  },
});
