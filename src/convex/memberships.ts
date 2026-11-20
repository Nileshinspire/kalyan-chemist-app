import { getAuthUserId } from "@convex-dev/auth/server";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

async function requireUser(ctx: { auth: any }) {
  const userId = await getAuthUserId(ctx as any);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

/** Public list of purchasable plans. */
export const listPlans = query({
  args: {},
  handler: async (ctx) => {
    const plans = await ctx.db
      .query("membership_plans")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .collect();
    return plans.sort((a, b) => a.sortOrder - b.sortOrder || a.price - b.price);
  },
});

/** The signed-in customer's current membership and purchase history. */
export const getMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { current: null, history: [] };

    const purchases = await ctx.db
      .query("membership_purchases")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const now = Date.now();
    const active = purchases
      .filter((p) => p.status === "active" && (p.expiresAt ?? 0) > now)
      .sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));

    const current = active[0] ?? null;
    const plan = current ? await ctx.db.get(current.planId) : null;

    return {
      current: current
        ? {
            purchaseId: current._id,
            planId: current.planId,
            planName: plan?.name ?? current.planName,
            description: plan?.description ?? "",
            benefits: plan?.benefits ?? [],
            restrictions: plan?.restrictions ?? [],
            startedAt: current.startedAt ?? current.createdAt,
            expiresAt: current.expiresAt ?? 0,
            amount: current.amount,
            paymentMethod: current.paymentMethod,
            daysRemaining: Math.max(
              0,
              Math.ceil(((current.expiresAt ?? now) - now) / (24 * 60 * 60 * 1000)),
            ),
          }
        : null,
      history: purchases
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 20)
        .map((p) => ({
          _id: p._id,
          planName: p.planName,
          amount: p.amount,
          status: p.status,
          paymentMethod: p.paymentMethod,
          startedAt: p.startedAt ?? null,
          expiresAt: p.expiresAt ?? null,
          createdAt: p.createdAt,
        })),
    };
  },
});

/**
 * Start a membership purchase.
 *
 * Free plans activate immediately. Paid plans create a pending purchase and
 * the client must complete Razorpay checkout; only the verified payment action
 * can activate them. A paid plan is never activated by this mutation.
 */
export const startPurchase = mutation({
  args: { planId: v.id("membership_plans") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const plan = await ctx.db.get(args.planId);
    if (!plan || !plan.isActive) throw new Error("This membership plan is not available.");
    if (plan.price < 0 || !Number.isFinite(plan.price)) {
      throw new Error("This membership plan has an invalid price.");
    }
    if (plan.durationDays < 1 || plan.durationDays > 3650) {
      throw new Error("This membership plan has an invalid duration.");
    }

    const purchases = await ctx.db
      .query("membership_purchases")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const now = Date.now();
    const current = purchases
      .filter((p) => p.status === "active" && (p.expiresAt ?? 0) > now)
      .sort((a, b) => (b.expiresAt ?? 0) - (a.expiresAt ?? 0))[0];
    const base = current ? Math.max(now, current.expiresAt ?? now) : now;
    const expiresAt = base + plan.durationDays * 24 * 60 * 60 * 1000;

    if (plan.price === 0) {
      // Never silently downgrade an active paid membership to a free plan.
      if (current && current.amount > 0) {
        throw new Error("You already have an active paid membership. Renew that plan instead.");
      }
      // Free plans never require a payment.
      const id = await ctx.db.insert("membership_purchases", {
        userId,
        planId: plan._id,
        planName: plan.name,
        amount: 0,
        durationDays: plan.durationDays,
        status: "active",
        paymentMethod: "free",
        startedAt: now,
        expiresAt,
        createdAt: now,
        updatedAt: now,
      });
      return { success: true, activated: true, purchaseId: id };
    }

    const id = await ctx.db.insert("membership_purchases", {
      userId,
      planId: plan._id,
      planName: plan.name,
      amount: plan.price,
      durationDays: plan.durationDays,
      status: "pending",
      paymentMethod: "razorpay",
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      activated: false,
      purchaseId: id,
      amount: plan.price,
      planName: plan.name,
      durationDays: plan.durationDays,
      /** Base used server-side; shown only for information. */
      baseExpiresAt: base,
    };
  },
});

/** Attach the Razorpay order id to a pending purchase (owner only). */
export const attachRazorpayOrder = mutation({
  args: {
    purchaseId: v.id("membership_purchases"),
    razorpayOrderId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const purchase = await ctx.db.get(args.purchaseId);
    if (!purchase || purchase.userId !== userId) throw new Error("Purchase not found.");
    if (purchase.status !== "pending") throw new Error("This purchase is no longer pending.");
    if (!args.razorpayOrderId.trim()) throw new Error("Missing payment order.");
    await ctx.db.patch(purchase._id, {
      razorpayOrderId: args.razorpayOrderId,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/** Mark a pending purchase failed (owner only, no activation). */
export const markFailed = mutation({
  args: { purchaseId: v.id("membership_purchases") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const purchase = await ctx.db.get(args.purchaseId);
    if (!purchase || purchase.userId !== userId) throw new Error("Purchase not found.");
    if (purchase.status === "pending") {
      await ctx.db.patch(purchase._id, { status: "failed", updatedAt: Date.now() });
    }
    return { success: true };
  },
});

/** Internal read used by the authenticated payment action. */
export const getPurchaseForPayment = internalQuery({
  args: { purchaseId: v.id("membership_purchases") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const purchase = await ctx.db.get(args.purchaseId);
    if (userId === null || !purchase || purchase.userId !== userId) {
      throw new Error("Purchase not found.");
    }
    return { amount: purchase.amount, status: purchase.status };
  },
});

/**
 * Internal activation called only after Razorpay signature verification.
 * Idempotent: a second valid callback cannot extend the membership twice.
 */
export const confirmPurchase = internalMutation({
  args: {
    purchaseId: v.id("membership_purchases"),
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.string(),
    razorpaySignature: v.string(),
  },
  handler: async (ctx, args) => {
    const purchase = await ctx.db.get(args.purchaseId);
    if (!purchase) throw new Error("Purchase not found.");
    if (purchase.status === "active") return { success: true, alreadyActive: true };
    if (purchase.status !== "pending") throw new Error("This purchase cannot be activated.");
    if (!purchase.razorpayOrderId || purchase.razorpayOrderId !== args.razorpayOrderId) {
      throw new Error("Payment does not match this membership purchase.");
    }

    const plan = await ctx.db.get(purchase.planId);
    if (!plan) throw new Error("Membership plan not found.");

    const now = Date.now();
    const purchases = await ctx.db
      .query("membership_purchases")
      .withIndex("by_user", (q) => q.eq("userId", purchase.userId))
      .collect();
    const current = purchases
      .filter(
        (p) =>
          p._id !== purchase._id &&
          p.status === "active" &&
          (p.expiresAt ?? 0) > now,
      )
      .sort((a, b) => (b.expiresAt ?? 0) - (a.expiresAt ?? 0))[0];
    const base = current ? Math.max(now, current.expiresAt ?? now) : now;

    await ctx.db.patch(purchase._id, {
      status: "active",
      razorpayPaymentId: args.razorpayPaymentId,
      razorpaySignature: args.razorpaySignature,
      startedAt: now,
      expiresAt: base + purchase.durationDays * 24 * 60 * 60 * 1000,
      updatedAt: now,
    });
    return { success: true };
  },
});

/** Safe summary for the checkout confirmation screen. */
export const getPurchaseStatus = query({
  args: { purchaseId: v.id("membership_purchases") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const purchase = await ctx.db.get(args.purchaseId);
    if (!purchase || purchase.userId !== userId) return null;
    return {
      status: purchase.status,
      planName: purchase.planName,
      expiresAt: purchase.expiresAt ?? null,
      amount: purchase.amount,
    };
  },
});

/** Membership is available to signed-in customers only. */
export const isMember = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return false;
    const purchases = await ctx.db
      .query("membership_purchases")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const now = Date.now();
    return purchases.some(
      (p) =>
        p.status === "active" &&
        (p.expiresAt ?? 0) > now &&
        p.amount > 0,
    );
  },
});

// Keep the Id import meaningful for generated-type consumers.
export type MembershipPurchaseId = Id<"membership_purchases">;
