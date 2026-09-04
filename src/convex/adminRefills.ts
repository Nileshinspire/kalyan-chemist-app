import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── List all refill requests (admin) ──
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Not authorized");

    const requests = await ctx.db
      .query("refill_requests")
      .order("desc")
      .collect();

    const withUser = await Promise.all(
      requests.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        return { ...r, customer: user };
      })
    );

    return withUser;
  },
});

// ── List refill requests by status (admin) ──
export const listByStatus = query({
  args: {
    status: v.union(
      v.literal("scheduled"),
      v.literal("due_soon"),
      v.literal("pending_verification"),
      v.literal("confirmed"),
      v.literal("processed"),
      v.literal("completed"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Not authorized");

    const requests = await ctx.db
      .query("refill_requests")
      .withIndex("by_status", (q) => q.eq("status", args.status))
      .order("desc")
      .collect();

    const withUser = await Promise.all(
      requests.map(async (r) => {
        const user = await ctx.db.get(r.userId);
        return { ...r, customer: user };
      })
    );

    return withUser;
  },
});

// ── Update refill request status (admin) ──
export const updateStatus = mutation({
  args: {
    requestId: v.id("refill_requests"),
    status: v.union(
      v.literal("scheduled"),
      v.literal("due_soon"),
      v.literal("pending_verification"),
      v.literal("confirmed"),
      v.literal("processed"),
      v.literal("completed"),
    ),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Not authorized");

    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Refill request not found");

    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: Date.now(),
    };
    if (args.adminNotes !== undefined) {
      patch.adminNotes = args.adminNotes;
    }

    await ctx.db.patch(args.requestId, patch);
    return { success: true };
  },
});

// ── Get counts by status for admin dashboard ──
export const getStatusCounts = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Not authorized");

    const all = await ctx.db.query("refill_requests").collect();

    const counts: Record<string, number> = {
      scheduled: 0,
      due_soon: 0,
      pending_verification: 0,
      confirmed: 0,
      processed: 0,
      completed: 0,
    };

    for (const r of all) {
      counts[r.status] = (counts[r.status] || 0) + 1;
    }

    return { total: all.length, ...counts };
  },
});

// ── List all reminders (admin view) ──
export const listAllReminders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Not authorized");

    const reminders = await ctx.db.query("refill_reminders").collect();

    const withDetails = await Promise.all(
      reminders.map(async (r) => {
        const product = await ctx.db.get(r.productId);
        const user = await ctx.db.get(r.userId);
        return { ...r, product, customer: user };
      })
    );

    return withDetails;
  },
});

// ── Pause a reminder (admin) ──
export const pauseReminder = mutation({
  args: { reminderId: v.id("refill_reminders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Not authorized");

    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder) throw new Error("Reminder not found");

    const now = Date.now();
    const existingActions = reminder.adminActions || [];
    await ctx.db.patch(args.reminderId, {
      isActive: false,
      adminActions: [...existingActions, { action: "paused", timestamp: now }],
    });
    return { success: true };
  },
});

// ── Resume a reminder (admin) ──
export const resumeReminder = mutation({
  args: { reminderId: v.id("refill_reminders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Not authorized");

    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder) throw new Error("Reminder not found");

    const now = Date.now();
    const existingActions = reminder.adminActions || [];
    await ctx.db.patch(args.reminderId, {
      isActive: true,
      adminActions: [...existingActions, { action: "resumed", timestamp: now }],
    });
    return { success: true };
  },
});

// ── Reschedule a reminder (admin) ──
export const rescheduleReminder = mutation({
  args: {
    reminderId: v.id("refill_reminders"),
    nextReminderAt: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Not authorized");

    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder) throw new Error("Reminder not found");

    const now = Date.now();
    const oldDate = new Date(reminder.nextReminderAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const newDate = new Date(args.nextReminderAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const existingActions = reminder.adminActions || [];
    await ctx.db.patch(args.reminderId, {
      nextReminderAt: args.nextReminderAt,
      adminActions: [...existingActions, {
        action: "rescheduled",
        timestamp: now,
        detail: `Next reminder changed from ${oldDate} to ${newDate}`,
      }],
    });
    return { success: true };
  },
});

// ── Cancel a reminder (admin) ──
export const cancelReminder = mutation({
  args: { reminderId: v.id("refill_reminders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Not authorized");

    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder) throw new Error("Reminder not found");

    const now = Date.now();
    const existingActions = reminder.adminActions || [];
    await ctx.db.patch(args.reminderId, {
      isActive: false,
      adminActions: [...existingActions, { action: "cancelled", timestamp: now }],
    });
    return { success: true };
  },
});

// ── Admin insights: simple refill dashboard stats ──
export const getAdminInsights = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Not authorized");

    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    const reminders = await ctx.db.query("refill_reminders").collect();
    const refillRequests = await ctx.db.query("refill_requests").collect();

    // Reminders due this week
    const dueThisWeek = reminders.filter(
      (r) => r.isActive && r.nextReminderAt >= now && r.nextReminderAt <= now + weekMs
    ).length;

    // Reminders currently overdue
    const overdue = reminders.filter(
      (r) => r.isActive && r.nextReminderAt <= now
    ).length;

    // Total active reminders
    const activeReminders = reminders.filter((r) => r.isActive).length;

    // Customers who refilled after a reminder (have a refill_request with reminderId)
    const refilledAfterReminder = refillRequests.filter(
      (r) => r.reminderId != null
    ).length;

    return {
      dueThisWeek,
      overdue,
      activeReminders,
      refilledAfterReminder,
      totalRefillRequests: refillRequests.length,
    };
  },
});
