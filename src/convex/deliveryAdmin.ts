import { createAccount, getAuthUserId } from "@convex-dev/auth/server";
import { action, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  isTerminalDeliveryStatus,
  normalizePhone,
  validateDeliveryAccount,
} from "./deliveryTrackingCore";

async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") {
    throw new Error("Administrator access required.");
  }
  return userId;
}

/**
 * Role lookup used by the create-account action. The caller's id is passed
 * explicitly so the check never depends on auth being propagated through
 * `runQuery`.
 */
export const getUserForAuthCheck = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user ? { role: user.role ?? null } : null;
  },
});

// ══════════════════════════════════════════════════════
//  DELIVERY PARTNERS
// ══════════════════════════════════════════════════════

/** Delivery partners available for assignment, with their current live order. */
export const listDeliveryBoys = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    const boys = users.filter((user) => user.role === "delivery");
    if (boys.length === 0) return [];

    const orders = await ctx.db.query("orders").collect();
    const activeSessions = await ctx.db
      .query("delivery_tracking")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();
    const activeOrderByBoy = new Map(
      activeSessions.map((session) => [
        session.deliveryBoyId as string,
        session.orderId as string,
      ]),
    );
    const orderById = new Map(orders.map((order) => [order._id as string, order]));

    return boys.map((boy) => {
      const activeOrderId = activeOrderByBoy.get(boy._id as string);
      const activeOrder = activeOrderId ? orderById.get(activeOrderId) : undefined;
      const assignedCount = orders.filter(
        (order) =>
          order.deliveryBoyId === boy._id && !isTerminalDeliveryStatus(order.status),
      ).length;
      return {
        _id: boy._id,
        name: boy.name ?? "Delivery partner",
        phone: boy.phone ?? "",
        activeOrderId: activeOrderId ?? null,
        activeOrderInvoice: activeOrder?.invoiceNumber ?? null,
        assignedCount,
      };
    });
  },
});

/**
 * Assign or reassign an order. Any previous live session is ended and its
 * coordinates are erased, so a new partner never inherits the previous
 * partner's location.
 */
export const assignOrder = mutation({
  args: {
    orderId: v.id("orders"),
    deliveryBoyId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found.");
    if (isTerminalDeliveryStatus(order.status)) {
      throw new Error("Completed or cancelled orders cannot be assigned.");
    }

    let deliveryBoy = null;
    if (args.deliveryBoyId) {
      deliveryBoy = await ctx.db.get(args.deliveryBoyId);
      if (!deliveryBoy || deliveryBoy.role !== "delivery") {
        throw new Error("Select a valid delivery partner.");
      }
    }

    const now = Date.now();
    const sessions = await ctx.db
      .query("delivery_tracking")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .collect();
    for (const session of sessions) {
      if (session.active) {
        await ctx.db.patch(session._id, {
          active: false,
          stoppedAt: now,
          stopReason: "reassigned",
          latitude: undefined,
          longitude: undefined,
          accuracy: undefined,
          heading: undefined,
          speed: undefined,
          updatedAt: now,
        });
      }
    }

    await ctx.db.patch(args.orderId, {
      deliveryBoyId: args.deliveryBoyId ?? undefined,
      deliveryAssignedAt: args.deliveryBoyId ? now : undefined,
      updatedAt: now,
    });

    return {
      success: true,
      deliveryBoyName: deliveryBoy?.name ?? null,
    };
  },
});

// ══════════════════════════════════════════════════════
//  DELIVERY PARTNER ACCOUNTS
// ══════════════════════════════════════════════════════

/**
 * Create a delivery partner login using the project's existing phone+password
 * Convex Auth provider. This is deliberately an action: Convex Auth's
 * `createAccount` hashes the password inside the auth component.
 */
export const createDeliveryBoy = action({
  args: {
    name: v.string(),
    phone: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Administrator access required.");

    const callerId = identity.subject.split("|")[0] as Id<"users">;
    const caller = await ctx.runQuery(internal.deliveryAdmin.getUserForAuthCheck, {
      userId: callerId,
    });
    if (!caller || caller.role !== "admin") {
      throw new Error("Administrator access required.");
    }

    const validationError = validateDeliveryAccount(args);
    if (validationError) throw new Error(validationError);

    const phone = normalizePhone(args.phone);
    const name = args.name.trim();

    try {
      const { user } = await createAccount(ctx, {
        provider: "phone-password",
        account: { id: phone, secret: args.password },
        profile: {
          name,
          phone,
          role: "delivery",
        },
        // Never link a delivery account to an existing customer record by
        // phone; these are separate, purpose-built logins.
        shouldLinkViaPhone: false,
        shouldLinkViaEmail: false,
      });
      return { success: true, userId: user._id as Id<"users"> };
    } catch (error: any) {
      throw new Error(
        error?.message?.includes("already")
          ? "A delivery account already exists for this phone number."
          : "Could not create the delivery account. Please check the details and try again.",
      );
    }
  },
});
