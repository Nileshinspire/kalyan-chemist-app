import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";
import { v } from "convex/values";

// ── List active reminders for current user ──
export const list = query({
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
export const create = mutation({
  args: {
    productId: v.id("products"),
    intervalDays: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    if (args.intervalDays < 7) {
      throw new Error("Minimum refill interval is 7 days");
    }

    // Check for existing reminder for this product
    const existing = await ctx.db
      .query("refill_reminders")
      .withIndex("by_user_active", (q) => q.eq("userId", userId).eq("isActive", true))
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

// ── Update a reminder ──
export const update = mutation({
  args: {
    reminderId: v.id("refill_reminders"),
    intervalDays: v.optional(v.number()),
    notes: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder || reminder.userId !== userId) {
      throw new Error("Reminder not found");
    }

    const patch: Record<string, unknown> = {};
    if (args.intervalDays !== undefined) {
      patch.intervalDays = args.intervalDays;
      // Recalculate next reminder
      patch.nextReminderAt =
        Date.now() + args.intervalDays * 24 * 60 * 60 * 1000;
    }
    if (args.notes !== undefined) patch.notes = args.notes;
    if (args.isActive !== undefined) patch.isActive = args.isActive;

    await ctx.db.patch(args.reminderId, patch);
    return { success: true };
  },
});

// ── Delete a reminder ──
export const remove = mutation({
  args: { reminderId: v.id("refill_reminders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder || reminder.userId !== userId) {
      throw new Error("Reminder not found");
    }

    await ctx.db.delete(args.reminderId);
    return { success: true };
  },
});

// ── Process due reminders — called by admin or cron ──
// In production, this would be triggered by a Convex scheduled function.
// For now, it's a manual action the user can trigger, or admin can batch-process.
export const processDueReminders = action({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Query all reminders where nextReminderAt <= now
    // Note: We need to scan since Convex doesn't support range queries on indexes directly
    const results = { processed: 0, errors: [] as string[] };

    // Get all active reminders
    const reminders = await ctx.runQuery(api.reminders.listAllActive);

    for (const reminder of reminders) {
      if (reminder.nextReminderAt > now) continue;

      try {
        const product = await ctx.runQuery(
          // inline to get product
          "products" as any,
          {} as any
        );

        // Create in-app notification
        await ctx.runMutation(api.notifications.create, {
          userId: reminder.userId,
          type: "refill_reminder",
          title: "Time to Refill 💊",
          body: `It's time to reorder your ${
            (reminder as any).productName || "medicine"
          }. Don't let your health routine break.`,
          link: `/products`,
          metadata: JSON.stringify({
            productId: reminder.productId,
            reminderId: reminder._id,
          }),
        });

        // Update the reminder's next fire time
        await ctx.runMutation(api.reminders.advanceReminder, {
          reminderId: reminder._id,
          intervalDays: reminder.intervalDays,
        });

        results.processed++;
      } catch (e) {
        results.errors.push(
          `Reminder ${reminder._id}: ${e instanceof Error ? e.message : "unknown"}`
        );
      }
    }

    return results;
  },
});

// ── Internal: list all active reminders (for processing) ──
export const listAllActive = query({
  args: {},
  handler: async (ctx) => {
    const allReminders = await ctx.db
      .query("refill_reminders")
      .withIndex("by_next_reminder", (q) => q)
      .collect();

    // Filter to active only
    const active = allReminders.filter((r) => r.isActive);

    const withProducts = await Promise.all(
      active.map(async (r) => {
        const product = await ctx.db.get(r.productId);
        return { ...r, productName: product?.name || "Unknown Medicine" };
      })
    );

    return withProducts;
  },
});

// ── Internal: advance a reminder's next fire time ──
export const advanceReminder = mutation({
  args: {
    reminderId: v.id("refill_reminders"),
    intervalDays: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.reminderId, {
      lastReminderAt: now,
      nextReminderAt: now + args.intervalDays * 24 * 60 * 60 * 1000,
    });
    return { success: true };
  },
});
