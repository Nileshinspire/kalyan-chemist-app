import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  advanceRefillSuggestion,
  collectEligibleOrderedMedicines,
  computeNextReminderAt,
  shouldNotifyRefillSuggestion,
  validateExpectedRefillDate,
  validateRefillIntervalDays,
} from "./refillSuggestionCore";

/**
 * Proactive refill suggestions.
 *
 * This is additive to the existing manual refill reminders (`refill_reminders`):
 * it only ever creates its own `refill_suggestions` rows and never edits,
 * deletes or replaces an existing reminder. A product that already has an
 * active manual reminder is never suggested again.
 */

async function requireUser(ctx: { auth: any }) {
  const userId = await getAuthUserId(ctx as any);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

async function activeManualRemindersFor(ctx: any, userId: any) {
  return await ctx.db
    .query("refill_reminders")
    .withIndex("by_user_active", (q: any) => q.eq("userId", userId).eq("isActive", true))
    .collect();
}

// ── Suggestions derived from the customer's own successful orders ──
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const eligible = collectEligibleOrderedMedicines(
      orders.map((order) => ({
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        items: order.items.map((item) => ({
          productId: item.productId as unknown as string,
          name: item.name,
          quantity: item.quantity,
        })),
      })),
    );

    const suggestions = await ctx.db
      .query("refill_suggestions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const suggestionByProduct = new Map(
      suggestions.map((row) => [row.productId as unknown as string, row]),
    );

    const manualReminders = await activeManualRemindersFor(ctx, userId);
    const manualProductIds = new Set(
      manualReminders.map((reminder: any) => reminder.productId as unknown as string),
    );

    const rows = await Promise.all(
      eligible.map(async (item) => {
        const product = await ctx.db.get(item.productId as Id<"products">);
        if (!product) return null;
        return {
          productId: item.productId,
          lastOrderAt: item.lastOrderAt,
          orderCount: item.orderCount,
          product: {
            _id: product._id,
            name: product.name,
            slug: product.slug,
            imageUrl: product.imageUrl ?? null,
            manufacturer: product.manufacturer,
            packSize: product.packSize,
            strength: product.strength ?? null,
            price: product.price,
            discountPrice: product.discountPrice ?? null,
            stockQuantity: product.stockQuantity,
            prescriptionRequired: product.prescriptionRequired,
            isActive: product.isActive,
            expiryDate: product.expiryDate ?? null,
          },
          suggestion: suggestionByProduct.get(item.productId) ?? null,
          hasManualReminder: manualProductIds.has(item.productId),
        };
      }),
    );

    return rows.filter((row): row is NonNullable<typeof row> => row !== null);
  },
});

// ── Enable / adjust a customer-confirmed suggestion ──
export const enable = mutation({
  args: {
    productId: v.id("products"),
    intervalDays: v.optional(v.number()),
    expectedDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    if ((args.intervalDays === undefined) === (args.expectedDate === undefined)) {
      throw new Error("Choose either a refill interval or an expected refill date.");
    }

    const product = await ctx.db.get(args.productId);
    if (!product || !product.isActive) throw new Error("This medicine is no longer available.");

    // Ownership: the product must come from this customer's own successful orders.
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const eligible = collectEligibleOrderedMedicines(
      orders.map((order) => ({
        status: order.status,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt,
        items: order.items.map((item) => ({
          productId: item.productId as unknown as string,
          name: item.name,
          quantity: item.quantity,
        })),
      })),
    ).find((item) => item.productId === (args.productId as unknown as string));

    if (!eligible) {
      throw new Error("This medicine is not in your order history.");
    }

    // Never duplicate an existing manual reminder.
    const manualReminders = await activeManualRemindersFor(ctx, userId);
    if (
      manualReminders.some(
        (reminder: any) => (reminder.productId as unknown as string) === (args.productId as unknown as string),
      )
    ) {
      throw new Error(
        "You already have a refill reminder for this medicine. Adjust it in Refill Reminders instead.",
      );
    }

    const now = Date.now();
    const intervalDays =
      args.intervalDays !== undefined ? validateRefillIntervalDays(args.intervalDays) : undefined;
    const expectedDate =
      args.expectedDate !== undefined
        ? validateExpectedRefillDate(args.expectedDate, now)
        : undefined;

    const nextReminderAt = computeNextReminderAt({
      intervalDays,
      expectedDate,
      // An interval counts from the last delivered order, so an already-overdue
      // refill is surfaced immediately rather than a month from now.
      from: eligible.lastOrderAt,
    });

    const existing = await ctx.db
      .query("refill_suggestions")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "enabled",
        intervalDays,
        expectedDate,
        nextReminderAt,
        lastNotifiedAt: undefined,
        lastOrderAt: eligible.lastOrderAt,
        updatedAt: now,
      });
      return { success: true, id: existing._id, nextReminderAt, updated: true };
    }

    const id = await ctx.db.insert("refill_suggestions", {
      userId,
      productId: args.productId,
      status: "enabled",
      intervalDays,
      expectedDate,
      nextReminderAt,
      lastOrderAt: eligible.lastOrderAt,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, id, nextReminderAt, updated: false };
  },
});

// ── Dismiss a suggestion (records the choice so it does not reappear) ──
export const dismiss = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("refill_suggestions")
      .withIndex("by_user_product", (q) =>
        q.eq("userId", userId).eq("productId", args.productId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: "dismissed",
        nextReminderAt: undefined,
        updatedAt: now,
      });
      return { success: true };
    }

    await ctx.db.insert("refill_suggestions", {
      userId,
      productId: args.productId,
      status: "dismissed",
      lastOrderAt: now,
      createdAt: now,
      updatedAt: now,
    });
    return { success: true };
  },
});

// ── Cron: notify customers whose confirmed refill is due ──
export const processDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("refill_suggestions")
      .withIndex("by_status_next", (q) =>
        q.eq("status", "enabled").lte("nextReminderAt", now),
      )
      .take(200);

    let notified = 0;
    for (const suggestion of due) {
      if (!shouldNotifyRefillSuggestion(suggestion, now)) continue;

      const product = await ctx.db.get(suggestion.productId);
      if (!product || !product.isActive) {
        await ctx.db.patch(suggestion._id, { status: "completed", updatedAt: now });
        continue;
      }

      // A manual reminder added after the suggestion must win: no duplicate.
      const manualReminders = await activeManualRemindersFor(ctx, suggestion.userId);
      if (
        manualReminders.some(
          (reminder: any) =>
            (reminder.productId as unknown as string) ===
            (suggestion.productId as unknown as string),
        )
      ) {
        await ctx.db.patch(suggestion._id, { status: "completed", updatedAt: now });
        continue;
      }

      const availability =
        product.stockQuantity > 0 && !(product.expiryDate && product.expiryDate <= now)
          ? "It is in stock now."
          : "It is currently out of stock — we will only let you reorder once it is available.";

      await ctx.db.insert("notifications", {
        userId: suggestion.userId,
        type: "refill_reminder",
        title: `Refill reminder: ${product.name}`,
        body: `Your refill for ${product.name} is due. ${availability} Reorder it from your Medicine Refill page.`,
        read: false,
        link: "/account/refill",
        metadata: JSON.stringify({
          kind: "refill_suggestion",
          suggestionId: suggestion._id,
          productId: suggestion.productId,
          prescriptionRequired: product.prescriptionRequired,
        }),
        createdAt: now,
      });

      await ctx.db.patch(suggestion._id, {
        lastNotifiedAt: now,
        nextReminderAt: advanceRefillSuggestion(suggestion, now),
        updatedAt: now,
      });
      notified++;
    }

    return { notified, checked: due.length };
  },
});
