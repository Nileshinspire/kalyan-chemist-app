/**
 * Third-party courier shipments.
 *
 * Booking and status updates are deliberately honest:
 *  - the pharmacy staff record the real courier, AWB and tracking URL after
 *    booking with the courier (no courier credentials are bundled here);
 *  - order status only changes from verified courier callbacks delivered to
 *    /courier-webhook, authenticated with COURIER_WEBHOOK_SECRET;
 *  - no tracking event or location is ever generated locally.
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import {
  internalMutation,
  mutation,
  type MutationCtx,
} from "./_generated/server";
import { v } from "convex/values";
import { applyOrderEventToOrder } from "./orderWorkflow";
import { courierEventDedupeKey, mapCourierStatus } from "./orderWorkflowCore";

async function requireAdmin(ctx: MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") {
    throw new Error("Administrator access required.");
  }
  return userId;
}

/** Record a real courier booking made by staff. */
export const bookCourier = mutation({
  args: {
    orderId: v.id("orders"),
    provider: v.string(),
    awb: v.string(),
    trackingUrl: v.optional(v.string()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found.");
    if (!["ready_for_dispatch", "out_for_delivery"].includes(order.status)) {
      throw new Error("Complete packing before booking a courier.");
    }
    if (order.deliveryBoyId) {
      throw new Error(
        "Remove the internal delivery partner before booking a third-party courier.",
      );
    }

    const provider = args.provider.trim();
    const awb = args.awb.trim().toUpperCase();
    const trackingUrl = args.trackingUrl?.trim() || undefined;
    if (provider.length < 2) throw new Error("Select a courier.");
    if (awb.length < 4) throw new Error("Enter the courier's AWB / tracking number.");

    const now = Date.now();
    const existing = await ctx.db
      .query("courier_shipments")
      .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        provider,
        awb,
        trackingUrl,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert("courier_shipments", {
        orderId: args.orderId,
        provider,
        awb,
        trackingUrl,
        status: "booked",
        createdAt: now,
        updatedAt: now,
      });
    }

    await ctx.db.patch(args.orderId, {
      deliveryMode: "courier",
      courierProvider: provider,
      courierAwb: awb,
      courierTrackingUrl: trackingUrl,
      updatedAt: now,
    });

    await applyOrderEventToOrder(ctx, {
      orderId: args.orderId,
      event: "courier_booked",
      source: "admin",
      actorId: adminId,
      note: args.note?.trim() || `Courier booked: ${provider} · AWB ${awb}`,
      dedupeKey: `courier_booked:${provider}:${awb}`,
      notify: false,
      strict: false,
    });

    await ctx.db.insert("notifications", {
      userId: order.userId,
      type: "order_status",
      title: "Courier Booked 📦",
      body: `Your order ${order.invoiceNumber || ""} has been booked with ${provider}. AWB: ${awb}.`,
      read: false,
      link: `/orders/${args.orderId}`,
      createdAt: now,
    });

    return { success: true, provider, awb };
  },
});

/**
 * Verified courier callback. Deduped by event id (or provider+AWB+status when
 * the courier does not send one), so retried webhooks cannot repeat a
 * transition or move an order backwards.
 */
export const applyCourierEvent = internalMutation({
  args: {
    awb: v.string(),
    status: v.string(),
    provider: v.optional(v.string()),
    eventId: v.optional(v.string()),
    note: v.optional(v.string()),
    occurredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const awb = args.awb.trim().toUpperCase();
    const shipment = await ctx.db
      .query("courier_shipments")
      .withIndex("by_awb", (q) => q.eq("awb", awb))
      .first();
    if (!shipment) throw new Error("Unknown AWB: no shipment is booked with this number.");

    if (args.provider && args.provider.trim() !== shipment.provider) {
      throw new Error("Courier provider does not match the booked shipment.");
    }

    const mapped = mapCourierStatus(args.status);
    if (!mapped.ok) throw new Error(mapped.reason);

    const now = args.occurredAt ?? Date.now();
    await ctx.db.patch(shipment._id, {
      status: mapped.status,
      lastEventAt: now,
      lastEventNote: args.note?.trim() || args.status,
      updatedAt: Date.now(),
    });

    const result = await applyOrderEventToOrder(ctx, {
      orderId: shipment.orderId,
      event: mapped.event,
      source: "courier",
      note: args.note?.trim() || `Courier status: ${args.status}`,
      dedupeKey: courierEventDedupeKey({
        provider: shipment.provider,
        awb,
        eventId: args.eventId,
        status: mapped.status,
      }),
      occurredAt: now,
      notify: mapped.event !== "courier_booked" && mapped.event !== "courier_exception",
      strict: false,
    });

    // Keep the order's courier snapshot in step with verified events.
    await ctx.db.patch(shipment.orderId, {
      courierProvider: shipment.provider,
      courierAwb: shipment.awb,
      courierTrackingUrl: shipment.trackingUrl,
      updatedAt: Date.now(),
    });

    return {
      success: true,
      status: mapped.status,
      orderStatus: result.status,
      applied: result.applied,
      duplicate: result.duplicate,
    };
  },
});
