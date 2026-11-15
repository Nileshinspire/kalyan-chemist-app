import { getAuthUserId } from "@convex-dev/auth/server";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  canShareLocation,
  isTerminalDeliveryStatus,
  isTrackingStale,
  isValidAccuracy,
  isValidLatitude,
  isValidLongitude,
  TRACKING_STALE_MS,
} from "./deliveryTrackingCore";
import { applyOrderEventToOrder } from "./orderWorkflow";
import {
  generateDeliveryOtp,
  isValidDeliveryOtp,
  MAX_DELIVERY_OTP_ATTEMPTS,
} from "./orderWorkflowCore";

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
        assignmentStatus: order.deliveryAssignmentStatus ?? null,
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
 * Delivery partner accepts the order. This is recorded separately from the
 * fulfillment status: acceptance is not dispatch, so the order stays at
 * ready-for-dispatch until the package is actually picked up.
 */
export const acceptDelivery = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await requireDelivery(ctx);
    const order = await getAssignedOrder(ctx, userId, args.orderId);

    if (isTerminalDeliveryStatus(order.status)) {
      throw new Error("This order is closed.");
    }
    if (
      order.deliveryAssignmentStatus === "accepted" ||
      order.deliveryAssignmentStatus === "picked_up"
    ) {
      return { success: true, alreadyAccepted: true };
    }

    const now = Date.now();
    await ctx.db.patch(args.orderId, {
      deliveryMode: "own",
      deliveryAssignmentStatus: "accepted",
      deliveryAcceptedAt: now,
      updatedAt: now,
    });
    await applyOrderEventToOrder(ctx, {
      orderId: args.orderId,
      event: "driver_accepted",
      source: "delivery_partner",
      actorId: userId,
      note: "Delivery partner accepted the order",
      dedupeKey: `driver_accepted:${userId}`,
      notify: false,
      strict: false,
    });
    return { success: true, alreadyAccepted: false };
  },
});

/**
 * Delivery partner has physically collected the package. This is the event that
 * moves the order to out-for-delivery.
 */
export const pickupOrder = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await requireDelivery(ctx);
    const order = await getAssignedOrder(ctx, userId, args.orderId);

    if (isTerminalDeliveryStatus(order.status)) {
      throw new Error("This order is closed.");
    }
    if (order.status === "pending") {
      throw new Error("This order is not ready for dispatch yet.");
    }
    if (order.status === "out_for_delivery") {
      return { success: true, alreadyPickedUp: true };
    }

    const now = Date.now();
    if (order.deliveryAssignmentStatus !== "accepted") {
      await ctx.db.patch(args.orderId, {
        deliveryAssignmentStatus: "accepted",
        deliveryAcceptedAt: order.deliveryAcceptedAt ?? now,
        deliveryMode: "own",
        updatedAt: now,
      });
      await applyOrderEventToOrder(ctx, {
        orderId: args.orderId,
        event: "driver_accepted",
        source: "delivery_partner",
        actorId: userId,
        note: "Delivery partner accepted the order",
        dedupeKey: `driver_accepted:${userId}`,
        notify: false,
        strict: false,
      });
    }

    await applyOrderEventToOrder(ctx, {
      orderId: args.orderId,
      event: "driver_picked_up",
      source: "delivery_partner",
      actorId: userId,
      note: "Package picked up by delivery partner",
      dedupeKey: "driver_picked_up",
      extraPatch: {
        deliveryAssignmentStatus: "picked_up",
        deliveryPickedUpAt: now,
        deliveryOtp: order.deliveryOtp ?? generateDeliveryOtp(),
        deliveryOtpGeneratedAt: order.deliveryOtpGeneratedAt ?? now,
      },
    });

    return { success: true, alreadyPickedUp: false };
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
    if (order.status === "pending") {
      throw new Error("This order is not ready for dispatch yet.");
    }

    const now = Date.now();

    // Protecting legacy in-flight orders: starting a delivery accepts and picks
    // up the order if those events were not recorded separately. New flows do
    // both actions explicitly from the delivery dashboard.
    if (
      order.deliveryAssignmentStatus !== "accepted" &&
      order.deliveryAssignmentStatus !== "picked_up"
    ) {
      await ctx.db.patch(args.orderId, {
        deliveryMode: "own",
        deliveryAssignmentStatus: "accepted",
        deliveryAcceptedAt: now,
        updatedAt: now,
      });
      await applyOrderEventToOrder(ctx, {
        orderId: args.orderId,
        event: "driver_accepted",
        source: "delivery_partner",
        actorId: userId,
        note: "Delivery partner accepted the order",
        dedupeKey: `driver_accepted:${userId}`,
        notify: false,
        strict: false,
      });
    }
    if (order.status !== "out_for_delivery") {
      await applyOrderEventToOrder(ctx, {
        orderId: args.orderId,
        event: "driver_picked_up",
        source: "delivery_partner",
        actorId: userId,
        note: "Package picked up by delivery partner",
        dedupeKey: "driver_picked_up",
        extraPatch: {
          deliveryAssignmentStatus: "picked_up",
          deliveryPickedUpAt: now,
          deliveryOtp: order.deliveryOtp ?? generateDeliveryOtp(),
          deliveryOtpGeneratedAt: order.deliveryOtpGeneratedAt ?? now,
        },
      });
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
  args: { orderId: v.id("orders"), otp: v.string() },
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
    if (order.status !== "out_for_delivery") {
      throw new Error(
        "Accept and pick up the package before completing the delivery.",
      );
    }

    const now = Date.now();

    // Delivery is only completed with the OTP shown to the customer. A legacy
    // in-flight order has no OTP yet; one is generated and the partner is asked
    // for it instead of completing without verification.
    if (!order.deliveryOtp) {
      await ctx.db.patch(args.orderId, {
        deliveryOtp: generateDeliveryOtp(),
        deliveryOtpGeneratedAt: now,
        deliveryOtpAttempts: 0,
        updatedAt: now,
      });
      throw new Error(
        "A delivery OTP has been generated. Ask the customer for the OTP shown on their Track Order page, then enter it to complete the delivery.",
      );
    }

    if (!isValidDeliveryOtp(order.deliveryOtp, args.otp)) {
      const attempts = (order.deliveryOtpAttempts ?? 0) + 1;
      await ctx.db.patch(args.orderId, {
        deliveryOtpAttempts: attempts,
        updatedAt: now,
      });
      if (attempts >= MAX_DELIVERY_OTP_ATTEMPTS) {
        throw new Error(
          "Too many incorrect OTP attempts. Ask the pharmacy to verify this delivery.",
        );
      }
      throw new Error(
        `Incorrect delivery OTP. ${MAX_DELIVERY_OTP_ATTEMPTS - attempts} attempt(s) remaining.`,
      );
    }

    await applyOrderEventToOrder(ctx, {
      orderId: args.orderId,
      event: "delivered",
      source: "delivery_partner",
      actorId: userId,
      note: "Delivery confirmed with customer OTP",
      dedupeKey: "delivered",
      extraPatch: {
        deliveryAssignmentStatus: "picked_up",
        deliveryPickedUpAt: order.deliveryPickedUpAt ?? now,
      },
    });

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
    const prescription = order.prescriptionId
      ? await ctx.db.get(order.prescriptionId)
      : null;
    const shipment = await ctx.db
      .query("courier_shipments")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();

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
      deliveryMode: order.deliveryMode ?? null,
      deliveryAssignmentStatus: order.deliveryAssignmentStatus ?? null,
      deliveryOtp:
        order.deliveryMode === "own" &&
        !["delivered", "cancelled"].includes(order.status)
          ? order.deliveryOtp ?? null
          : null,
      courier: shipment
        ? {
            provider: shipment.provider,
            awb: shipment.awb,
            trackingUrl: shipment.trackingUrl ?? null,
            status: shipment.status,
            lastEventAt: shipment.lastEventAt ?? null,
          }
        : null,
      prescription: {
        required: Boolean(
          order.prescriptionVerificationRequired ?? order.prescriptionId,
        ),
        status: prescription?.status ?? null,
        rejectionReason: prescription?.rejectionReason ?? null,
        clarificationNote: prescription?.clarificationNote ?? null,
      },
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
