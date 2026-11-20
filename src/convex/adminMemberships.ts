import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

async function requireAdmin(ctx: { db: any; auth: any }) {
  const userId = await getAuthUserId(ctx as any);
  if (userId === null) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") throw new Error("Unauthorized: admin only");
  return userId;
}

function validatePlan(input: {
  name: string;
  description: string;
  price: number;
  durationDays: number;
  benefits: string[];
  restrictions: string[];
}) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 40) {
    throw new Error("Plan name must be between 2 and 40 characters.");
  }
  const description = input.description.trim();
  if (description.length < 2 || description.length > 500) {
    throw new Error("Description must be between 2 and 500 characters.");
  }
  if (!Number.isFinite(input.price) || input.price < 0 || input.price > 1000000) {
    throw new Error("Enter a valid non-negative price.");
  }
  if (
    !Number.isInteger(input.durationDays) ||
    input.durationDays < 1 ||
    input.durationDays > 3650
  ) {
    throw new Error("Duration must be between 1 and 3650 days.");
  }
  const benefits = input.benefits.map((b) => b.trim()).filter(Boolean);
  if (benefits.length === 0) throw new Error("Add at least one benefit.");
  if (benefits.length > 20) throw new Error("Keep at most 20 benefits.");
  if (benefits.some((b) => b.length > 160)) throw new Error("A benefit is too long.");
  const restrictions = input.restrictions.map((r) => r.trim()).filter(Boolean);
  if (restrictions.length > 12) throw new Error("Keep at most 12 restrictions.");
  if (restrictions.some((r) => r.length > 160)) throw new Error("A restriction is too long.");
  return { name, description, benefits, restrictions };
}

export const listPlans = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const plans = await ctx.db.query("membership_plans").collect();
    return plans.sort((a, b) => a.sortOrder - b.sortOrder || a.price - b.price);
  },
});

export const createPlan = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    price: v.number(),
    durationDays: v.number(),
    benefits: v.array(v.string()),
    restrictions: v.array(v.string()),
    isActive: v.boolean(),
    sortOrder: v.number(),
    highlight: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const clean = validatePlan(args);
    const now = Date.now();
    const id = await ctx.db.insert("membership_plans", {
      ...clean,
      price: args.price,
      durationDays: args.durationDays,
      isActive: args.isActive,
      sortOrder: Math.round(args.sortOrder) || 0,
      highlight: args.highlight ?? false,
      createdAt: now,
      updatedAt: now,
    });
    return { success: true, id };
  },
});

export const updatePlan = mutation({
  args: {
    planId: v.id("membership_plans"),
    name: v.string(),
    description: v.string(),
    price: v.number(),
    durationDays: v.number(),
    benefits: v.array(v.string()),
    restrictions: v.array(v.string()),
    isActive: v.boolean(),
    sortOrder: v.number(),
    highlight: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan not found.");
    const clean = validatePlan(args);
    await ctx.db.patch(plan._id, {
      ...clean,
      isActive: args.isActive,
      sortOrder: Math.round(args.sortOrder) || 0,
      highlight: args.highlight ?? false,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const togglePlan = mutation({
  args: { planId: v.id("membership_plans"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan not found.");
    await ctx.db.patch(plan._id, { isActive: args.isActive, updatedAt: Date.now() });
    return { success: true };
  },
});

export const removePlan = mutation({
  args: { planId: v.id("membership_plans") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan not found.");
    const used = await ctx.db
      .query("membership_purchases")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .first();
    if (used) {
      throw new Error("This plan has purchases. Deactivate it instead of deleting it.");
    }
    await ctx.db.delete(plan._id);
    return { success: true };
  },
});

/** Active members with plan/expiry information (no health data). */
export const listMembers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const purchases = await ctx.db
      .query("membership_purchases")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();
    const now = Date.now();
    const active = purchases
      .filter((p) => (p.expiresAt ?? 0) > now)
      .sort((a, b) => (a.expiresAt ?? 0) - (b.expiresAt ?? 0));

    return Promise.all(
      active.map(async (p) => {
        const user = await ctx.db.get(p.userId);
        return {
          _id: p._id,
          userId: p.userId,
          customerName: user?.name ?? "Customer",
          customerEmail: user?.email ?? "",
          planName: p.planName,
          amount: p.amount,
          startedAt: p.startedAt ?? p.createdAt,
          expiresAt: p.expiresAt ?? 0,
          daysRemaining: Math.max(
            0,
            Math.ceil(((p.expiresAt ?? now) - now) / (24 * 60 * 60 * 1000)),
          ),
          paymentMethod: p.paymentMethod,
          status: p.status,
        };
      }),
    );
  },
});

/** Aggregate membership analytics. */
export const getAnalytics = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const purchases = await ctx.db.query("membership_purchases").collect();
    const now = Date.now();
    const active = purchases.filter(
      (p) => p.status === "active" && (p.expiresAt ?? 0) > now,
    );
    const revenue = purchases
      .filter((p) => p.status === "active")
      .reduce((sum, p) => sum + p.amount, 0);
    const expiringSoon = active.filter(
      (p) => (p.expiresAt ?? 0) <= now + 30 * 24 * 60 * 60 * 1000,
    ).length;

    const byPlan = new Map<string, { planName: string; members: number; revenue: number }>();
    for (const p of active) {
      const entry = byPlan.get(p.planId as string) ?? {
        planName: p.planName,
        members: 0,
        revenue: 0,
      };
      entry.members += 1;
      entry.revenue += p.amount;
      byPlan.set(p.planId as string, entry);
    }

    return {
      activeMembers: active.length,
      totalPurchases: purchases.length,
      paidPurchases: purchases.filter((p) => p.amount > 0 && p.status === "active").length,
      pendingPurchases: purchases.filter((p) => p.status === "pending").length,
      revenue,
      expiringSoon,
      byPlan: [...byPlan.values()].sort((a, b) => b.members - a.members),
    };
  },
});
