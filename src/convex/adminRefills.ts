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
