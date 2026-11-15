/**
 * Event-driven order workflow engine.
 *
 * Every fulfillment change goes through `applyOrderEventToOrder`, which:
 *  1. de-duplicates the event per order (external callbacks are retried);
 *  2. validates the transition against the pure rules in orderWorkflowCore;
 *  3. writes the status + timestamped statusHistory entry and an immutable
 *     order_events row carrying the event source;
 *  4. runs the existing delivery/wallet side-effects and customer notification.
 *
 * Payment status is never derived from fulfillment status, and prescription
 * verification remains a separate state on the linked prescription.
 */

import { internalMutation, type MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { api } from "./_generated/api";
import { handleOrderStatusChange } from "./referralWallet";
import {
  applyOrderEvent,
  canConfirmAfterPayment,
  type OrderEventType,
} from "./orderWorkflowCore";

export type OrderEventSource =
  | "admin"
  | "system"
  | "customer"
  | "pharmacist"
  | "delivery_partner"
  | "courier";

type ApplyOrderEventParams = {
  orderId: Id<"orders">;
  event: OrderEventType;
  source: OrderEventSource;
  actorId?: Id<"users">;
  note?: string;
  dedupeKey: string;
  /** Additional order fields written in the same transition (e.g. cancellationReason). */
  extraPatch?: Record<string, unknown>;
  /** Sends the standard customer status notification. Defaults to true. */
  notify?: boolean;
  /** false = stale external events are ignored instead of throwing. */
  strict?: boolean;
  occurredAt?: number;
};

export type ApplyOrderEventResult = {
  applied: boolean;
  duplicate: boolean;
  changed: boolean;
  status: string;
  reason?: string;
};

const STATUS_TIMESTAMP_FIELD: Record<string, string> = {
  confirmed: "confirmedAt",
  processing: "processingStartedAt",
  ready_for_dispatch: "packedAt",
  out_for_delivery: "dispatchedAt",
  delivered: "deliveredAt",
};

/** Ends live delivery sharing without importing from deliveryTracking (no cycle). */
async function endLiveTracking(ctx: MutationCtx, orderId: Id<"orders">, reason: string) {
  const sessions = await ctx.db
    .query("delivery_tracking")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .collect();
  const now = Date.now();
  for (const session of sessions) {
    if (!session.active) continue;
    await ctx.db.patch(session._id, {
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
}

export async function applyOrderEventToOrder(
  ctx: MutationCtx,
  params: ApplyOrderEventParams,
): Promise<ApplyOrderEventResult> {
  const strict = params.strict !== false;

  const existingEvent = await ctx.db
    .query("order_events")
    .withIndex("by_order_dedupe", (q) =>
      q.eq("orderId", params.orderId).eq("dedupeKey", params.dedupeKey),
    )
    .first();
  if (existingEvent) {
    const order = await ctx.db.get(params.orderId);
    return {
      applied: false,
      duplicate: true,
      changed: false,
      status: order?.status ?? "unknown",
      reason: "duplicate",
    };
  }

  const order = await ctx.db.get(params.orderId);
  if (!order) {
    if (!strict) {
      return {
        applied: false,
        duplicate: false,
        changed: false,
        status: "unknown",
        reason: "order_not_found",
      };
    }
    throw new Error("Order not found.");
  }

  const decision = applyOrderEvent(order.status, params.event);
  if (!decision.ok) {
    if (!strict) {
      return {
        applied: false,
        duplicate: false,
        changed: false,
        status: order.status,
        reason: decision.reason,
      };
    }
    throw new Error(decision.reason);
  }

  const now = params.occurredAt ?? Date.now();
  const patch: Record<string, unknown> = { ...params.extraPatch };

  if (decision.changed) {
    patch.status = decision.status;
    patch.statusHistory = [
      ...(order.statusHistory ?? []),
      {
        status: decision.status,
        timestamp: now,
        note: params.note,
        source: params.source,
      },
    ];
    const timestampField = STATUS_TIMESTAMP_FIELD[decision.status];
    if (timestampField) patch[timestampField] = now;
  } else if (params.note) {
    // Audit-only events keep their note on the event row; the fulfillment
    // history is only extended by actual status changes.
  }

  patch.updatedAt = now;
  await ctx.db.patch(params.orderId, patch as Partial<Doc<"orders">>);

  await ctx.db.insert("order_events", {
    orderId: params.orderId,
    type: params.event,
    fromStatus: order.status,
    toStatus: decision.changed ? decision.status : order.status,
    source: params.source,
    actorId: params.actorId,
    note: params.note,
    dedupeKey: params.dedupeKey,
    createdAt: now,
  });

  if (decision.changed) {
    if (
      ["delivered", "cancelled", "refund_initiated", "refunded"].includes(
        decision.status,
      )
    ) {
      await endLiveTracking(ctx, params.orderId, `order_${decision.status}`);
    }
    await handleOrderStatusChange(ctx, params.orderId, decision.status);

    if (params.notify !== false) {
      await ctx.scheduler.runAfter(
        0,
        api.orderNotifications.sendOrderStatusNotification,
        { orderId: params.orderId, status: decision.status },
      );
    }
  }

  return {
    applied: true,
    duplicate: false,
    changed: decision.changed,
    status: decision.status,
  };
}

/**
 * Confirms a pending order only when its payment rule and prescription review
 * both allow it. Idempotent through the `order_confirmed` dedupe key.
 */
export async function confirmOrderIfEligible(
  ctx: MutationCtx,
  params: {
    orderId: Id<"orders">;
    source: OrderEventSource;
    actorId?: Id<"users">;
    note?: string;
    notify?: boolean;
  },
): Promise<{ confirmed: boolean; status: string; reason?: string }> {
  const order = await ctx.db.get(params.orderId);
  if (!order) return { confirmed: false, status: "unknown", reason: "not_found" };
  if (order.status !== "pending") {
    return { confirmed: false, status: order.status, reason: "not_pending" };
  }

  const requiresVerification =
    order.prescriptionVerificationRequired ?? Boolean(order.prescriptionId);
  const prescription = order.prescriptionId
    ? await ctx.db.get(order.prescriptionId)
    : null;

  if (
    !canConfirmAfterPayment({
      requiresPrescriptionVerification: requiresVerification,
      prescriptionStatus: prescription?.status,
    })
  ) {
    return { confirmed: false, status: order.status, reason: "prescription_pending" };
  }

  if (order.paymentMethod === "online" && order.paymentStatus !== "paid") {
    return { confirmed: false, status: order.status, reason: "payment_pending" };
  }

  const result = await applyOrderEventToOrder(ctx, {
    orderId: params.orderId,
    event: "order_confirmed",
    source: params.source,
    actorId: params.actorId,
    note: params.note,
    dedupeKey: "order_confirmed",
    notify: params.notify,
  });

  return {
    confirmed: result.applied || result.duplicate,
    status: result.status,
    reason: result.duplicate ? "already_confirmed" : undefined,
  };
}

/** Internal entry point used by verified courier callbacks. */
export const applyExternalEvent = internalMutation({
  args: {
    orderId: v.id("orders"),
    event: v.union(
      v.literal("courier_booked"),
      v.literal("courier_picked_up"),
      v.literal("out_for_delivery"),
      v.literal("courier_exception"),
      v.literal("delivered"),
    ),
    source: v.union(v.literal("courier"), v.literal("system")),
    note: v.optional(v.string()),
    dedupeKey: v.string(),
    occurredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await applyOrderEventToOrder(ctx, {
      orderId: args.orderId,
      event: args.event,
      source: args.source,
      note: args.note,
      dedupeKey: args.dedupeKey,
      occurredAt: args.occurredAt,
      strict: false,
    });
  },
});
