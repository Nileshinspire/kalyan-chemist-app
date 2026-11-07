import { getAuthUserId } from "@convex-dev/auth/server";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { handleOrderStatusChange } from "./referralWallet";
import {
  canShareLocation,
  isTerminalDeliveryStatus,
  isTrackingStale,
  isValidAccuracy,
  isValidLatitude,
  isValidLongitude,
  TRACKING_STALE_MS,
} from "./deliveryTrackingCore";

// ══════════════════════════════════════════════════════
//  AUTHORIZATION HELPERS
// ══════════════════════════════════════════════════════

async function requireDelivery(ctx: any): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "delivery") {
    throw new Error("Delivery partner access required.");
  }
  return userId;
}

async function getAssignedOrder(ctx: any, userId: Id<"users">, orderId: Id<"orders">) {
  const order = await ctx.db.get(orderId);
  if (!order) throw new Error("Order not found.");
  if (order.deliveryBoyId !== userId) {
    throw new Error("This order is not assigned to you.");
  }
  return order;
}

async function trackingForOrder(ctx: any, orderId: Id<"orders">) {
  return await ctx.db
    .query("delivery_tracking")
    .withIndex("by_order", (q: any) => q.eq("orderId", orderId))
    .first();
}

/**
 * End an order's live session and clear its coordinates.
 *
 * Shared by the admin status update, reassignment and the stale-session cron.
 * Idempotent: calling it when nothing is active is a no-op.
 */
export async function endTrackingForOrder(
  ctx: MutationCtx,
  orderId: Id<"orders">,
  reason: string,
) {
  const tracking = await trackingForOrder(ctx, orderId);
  if (!tracking || !tracking.active) return;
  const now = Date.now();
  await ctx.db.patch(tracking._id, {
    active: false,
    stoppedAt: now,
    stopReason: reason,
    latitude: undefined,
    longitude: undefined,
    accuracy: undefined,
    heading: undefined,
    speed: undefined,
    updatedAt: now,
  });
}

// ══════════════════════════════════════════════════════
//  DELIVERY PARTNER
// ══════════════════════════════════════════════════════

/** Only the signed-in delivery partner's own assignments. */
export const myAssignments = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireDelivery(ctx);

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_delivery_boy", (q) => q.eq("deliveryBoyId", userId))
      .collect();

    const sessions = await ctx.db
      .query("delivery_tracking")
      .withIndex("by_delivery_boy", (q) => q.eq("deliveryBoyId", userId))
      .collect();
    const sessionByOrder = new Map(
      sessions.map((session) => [session.orderId as string, session]),
    );
    const now = Date.now();

    const customerIds = [...new Set(orders.map((order) => order.userId as string))];
    const customers = await Promise.all(
      customerIds.map((id) => ctx.db.get(id as Id<"users">)),
    );
    const customerById = new Map(
      customers.filter(Boolean).map((customer) => [customer!._id as string, customer!]),
    );

    const rows = orders.map((order) => {
      const session = sessionByOrder.get(order._id as string);
      const customer = customerById.get(order.userId as string);
      return {
        _id: order._id,
        invoiceNumber: order.invoiceNumber ?? null,
        status: order.status,
        totalAmount: order.totalAmount,
        itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
        shippingAddress: order.shippingAddress,
        phone: order.phone,
        customerName: customer?.name ?? "Customer",
        createdAt: order.createdAt,
        assignedAt: order.deliveryAssignedAt ?? null,
        trackingActive: Boolean(session?.active && !isTrackingStale(session, now)),
        trackingStartedAt: session?.startedAt ?? null,
        lastLocationAt: session?.lastLocationAt ?? null,
      };
    });

    // Live deliveries first, then newest orders.
    return rows.sort((a, b) => {
      if (a.trackingActive !== b.trackingActive) return a.trackingActive ? -1 : 1;
      return b.createdAt - a.createdAt;
    });
  },
});

/**
 * Start a live session. Coordinates are requested by the browser first; this
 * mutation only records that sharing has begun for an assigned order.
 */
export const startTracking = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await requireDelivery(ctx);
    const order = await getAssignedOrder(ctx, userId, args.orderId);

    if (!canShareLocation(order.status)) {
      throw new Error("This order is already completed.");
    }

    const now = Date.now();

    // Starting the delivery also moves the order into "out for delivery", so
    // the customer's order status and the admin view always match the live
    // session instead of staying at "confirmed" while the rider is moving.
    const PRE_DISPATCH_STATUSES = [
      "pending",
      "confirmed",
      "processing",
      "ready_for_dispatch",
    ];
    if (PRE_DISPATCH_STATUSES.includes(order.status)) {
      await ctx.db.patch(args.orderId, {
        status: "out_for_delivery",
        statusHistory: [
          ...(order.statusHistory ?? []),
          { status: "out_for_delivery" as const, timestamp: now },
        ],
        updatedAt: now,
      });
      await ctx.scheduler.runAfter(
        0,
        api.orderNotifications.sendOrderStatusNotification,
        { orderId: args.orderId, status: "out_for_delivery" },
      );
    }

    // A delivery partner shares one delivery at a time. Starting a new delivery
    // ends the previous session so two orders never show the same location.
    const sessions = await ctx.db
      .query("delivery_tracking")
      .withIndex("by_delivery_boy", (q) => q.eq("deliveryBoyId", userId))
      .collect();
    for (const session of sessions) {
      if (session.active && session.orderId !== args.orderId) {
        await ctx.db.patch(session._id, {
          active: false,
          stoppedAt: now,
          stopReason: "another_delivery_started",
          latitude: undefined,
          longitude: undefined,
          accuracy: undefined,
          heading: undefined,
          speed: undefined,
          updatedAt: now,
        });
      }
    }

    const existing = await trackingForOrder(ctx, args.orderId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        deliveryBoyId: userId,
        active: true,
        latitude: undefined,
        longitude: undefined,
        accuracy: undefined,
        heading: undefined,
        speed: undefined,
        startedAt: now,
        lastLocationAt: undefined,
        stoppedAt: undefined,
        stopReason: undefined,
        updatedAt: now,
      });
      return { success: true, trackingId: existing._id, startedAt: now };
    }

    const trackingId = await ctx.db.insert("delivery_tracking", {
      orderId: args.orderId,
      deliveryBoyId: userId,
      active: true,
      startedAt: now,
      updatedAt: now,
    });
    return { success: true, trackingId, startedAt: now };
  },
});

/** Periodic GPS ping from the delivery partner's browser. */
export const updateLocation = mutation({
  args: {
    orderId: v.id("orders"),
    latitude: v.number(),
    longitude: v.number(),
    accuracy: v.optional(v.number()),
    heading: v.optional(v.number()),
    speed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireDelivery(ctx);
    const order = await getAssignedOrder(ctx, userId, args.orderId);

    if (!canShareLocation(order.status)) {
      throw new Error("Live tracking has ended for this order.");
    }
    if (!isValidLatitude(args.latitude) || !isValidLongitude(args.longitude)) {
      throw new Error("Invalid GPS coordinates.");
    }
    if (!isValidAccuracy(args.accuracy)) {
      throw new Error("Invalid GPS accuracy.");
    }

    const tracking = await trackingForOrder(ctx, args.orderId);
    if (
      !tracking ||
      !tracking.active ||
      tracking.deliveryBoyId !== userId ||
      order.deliveryBoyId !== userId
    ) {
      throw new Error("Delivery tracking is not active. Start delivery first.");
    }

    const now = Date.now();
    await ctx.db.patch(tracking._id, {
      latitude: args.latitude,
      longitude: args.longitude,
      accuracy: args.accuracy,
      heading: args.heading,
      speed: args.speed,
      lastLocationAt: now,
      updatedAt: now,
    });

    return { success: true, updatedAt: now };
  },
});

/**
 * Complete the delivery from the delivery partner's own dashboard.
 *
 * This is the delivery-side equivalent of the admin status update, so it runs
 * exactly the same order side-effects (status history, referral/wallet
 * settlement, customer notification) and ends the live session.
 */
export const markDelivered = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await requireDelivery(ctx);
    const order = await getAssignedOrder(ctx, userId, args.orderId);

    if (order.status === "delivered") {
      await endTrackingForOrder(ctx, args.orderId, "order_delivered");
      return { success: true, alreadyDelivered: true, deliveredAt: null };
    }
    if (isTerminalDeliveryStatus(order.status)) {
      throw new Error("This order is closed and cannot be marked delivered.");
    }

    const now = Date.now();
    await ctx.db.patch(args.orderId, {
      status: "delivered",
      statusHistory: [
        ...(order.statusHistory ?? []),
        { status: "delivered" as const, timestamp: now },
      ],
      updatedAt: now,
    });

    await endTrackingForOrder(ctx, args.orderId, "order_delivered");
    await handleOrderStatusChange(ctx, args.orderId, "delivered");
    await ctx.scheduler.runAfter(
      0,
      api.orderNotifications.sendOrderStatusNotification,
      { orderId: args.orderId, status: "delivered" },
    );

    return { success: true, alreadyDelivered: false, deliveredAt: now };
  },
});

/** Stop sharing immediately and erase the stored coordinates. */
export const stopTracking = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await requireDelivery(ctx);
    await getAssignedOrder(ctx, userId, args.orderId);

    const tracking = await trackingForOrder(ctx, args.orderId);
    if (!tracking || tracking.deliveryBoyId !== userId) {
      return { success: true, alreadyStopped: true };
    }
    if (!tracking.active) {
      return { success: true, alreadyStopped: true };
    }

    const now = Date.now();
    await ctx.db.patch(tracking._id, {
      active: false,
      stoppedAt: now,
      stopReason: "stopped_by_delivery_partner",
      latitude: undefined,
      longitude: undefined,
      accuracy: undefined,
      heading: undefined,
      speed: undefined,
      updatedAt: now,
    });
    return { success: true, stoppedAt: now };
  },
});

// ══════════════════════════════════════════════════════
//  CUSTOMER
// ══════════════════════════════════════════════════════

/**
 * Live tracking for one of the customer's own orders.
 *
 * Returns null when the order does not exist or belongs to someone else, so a
 * signed-in customer can never read another customer's delivery location.
 * Coordinates are omitted unless sharing is currently active.
 */
export const getCustomerTracking = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const order = await ctx.db.get(args.orderId);
    if (!order || order.userId !== userId) return null;

    const tracking = await trackingForOrder(ctx, args.orderId);
    const deliveryBoy = order.deliveryBoyId
      ? await ctx.db.get(order.deliveryBoyId)
      : null;

    const now = Date.now();
    const active = Boolean(
      tracking &&
        tracking.active &&
        !isTrackingStale(tracking, now) &&
        tracking.deliveryBoyId === order.deliveryBoyId &&
        canShareLocation(order.status),
    );

    return {
      orderId: order._id,
      invoiceNumber: order.invoiceNumber ?? null,
      orderStatus: order.status,
      assigned: Boolean(order.deliveryBoyId),
      deliveryBoyName: deliveryBoy?.name ?? deliveryBoy?.phone ?? null,
      deliveryBoyPhone: order.deliveryBoyId ? deliveryBoy?.phone ?? null : null,
      assignedAt: order.deliveryAssignedAt ?? null,
      trackingActive: active,
      startedAt: active ? tracking?.startedAt ?? null : null,
      lastLocationAt: active ? tracking?.lastLocationAt ?? null : null,
      location:
        active && tracking?.latitude !== undefined && tracking?.longitude !== undefined
          ? {
              latitude: tracking.latitude,
              longitude: tracking.longitude,
              accuracy: tracking.accuracy ?? null,
            }
          : null,
    };
  },
});

// ══════════════════════════════════════════════════════
//  MAINTENANCE
// ══════════════════════════════════════════════════════

/**
 * Safety net for crashed browsers / lost phones: a session that has not sent a
 * GPS ping for a few minutes is ended and its coordinates are erased.
 */
export const expireStale = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const active = await ctx.db
      .query("delivery_tracking")
      .withIndex("by_active", (q) => q.eq("active", true))
      .take(200);

    let expired = 0;
    for (const tracking of active) {
      if (!isTrackingStale(tracking, now, TRACKING_STALE_MS)) continue;
      await ctx.db.patch(tracking._id, {
        active: false,
        stoppedAt: now,
        stopReason: "stale_no_gps",
        latitude: undefined,
        longitude: undefined,
        accuracy: undefined,
        heading: undefined,
        speed: undefined,
        updatedAt: now,
      });
      expired += 1;
    }
    return { checked: active.length, expired };
  },
});
