/**
 * Pure order-workflow rules.
 *
 * This module is the single source of truth for:
 *  - the order fulfillment progression and which event may trigger each step;
 *  - when an order may be confirmed automatically (payment + prescription);
 *  - the customer-facing label for an order awaiting prescription review;
 *  - delivery OTP validation;
 *  - mapping verified third-party courier statuses onto order events.
 *
 * It has no Convex imports so the business rules can be unit-tested and reused
 * by mutations without duplicating them.
 */

/** Ordered fulfillment progression. Cancellation/refund states sit outside it. */
export const ORDER_PROGRESSION = [
  "pending",
  "confirmed",
  "processing",
  "ready_for_dispatch",
  "out_for_delivery",
  "delivered",
] as const;

export const RX_PENDING_LABEL =
  "Order Received – Prescription Verification Pending";

const PRE_DISPATCH = [
  "pending",
  "confirmed",
  "processing",
  "ready_for_dispatch",
];

const ACTIVE_STATUSES = [...PRE_DISPATCH, "out_for_delivery"];

export type OrderEventType =
  | "order_placed"
  | "order_confirmed"
  | "payment_verified"
  | "prescription_approved"
  | "prescription_rejected"
  | "processing_started"
  | "packing_completed"
  | "driver_assigned"
  | "driver_accepted"
  | "driver_picked_up"
  | "courier_booked"
  | "courier_picked_up"
  | "courier_exception"
  | "out_for_delivery"
  | "delivered"
  | "cancelled"
  | "refund_initiated"
  | "refunded";

type EventRule = {
  /** Statuses from which this event is valid. */
  from: readonly string[];
  /** Status written to the order, or null when the event is audit-only. */
  to: string | null;
};

const EVENT_RULES: Record<OrderEventType, EventRule> = {
  order_placed: { from: [], to: null },
  order_confirmed: { from: ["pending"], to: "confirmed" },
  payment_verified: { from: ["pending", "confirmed"], to: null },
  prescription_approved: { from: ACTIVE_STATUSES, to: null },
  prescription_rejected: { from: ACTIVE_STATUSES, to: null },
  processing_started: { from: ["confirmed"], to: "processing" },
  packing_completed: { from: ["processing"], to: "ready_for_dispatch" },
  driver_assigned: { from: PRE_DISPATCH, to: null },
  driver_accepted: { from: PRE_DISPATCH, to: null },
  /**
   * Pickup may legitimately be recorded on a legacy order that was still at
   * "confirmed"/"processing" when the rider collected it. It always moves the
   * order forward to out-for-delivery, never backward.
   */
  driver_picked_up: {
    from: ["confirmed", "processing", "ready_for_dispatch"],
    to: "out_for_delivery",
  },
  courier_booked: { from: ["ready_for_dispatch", "out_for_delivery"], to: null },
  courier_picked_up: { from: ["ready_for_dispatch"], to: "out_for_delivery" },
  courier_exception: { from: ACTIVE_STATUSES, to: null },
  out_for_delivery: {
    from: ["ready_for_dispatch", "out_for_delivery"],
    to: "out_for_delivery",
  },
  /**
   * Delivery is only ever recorded against a verified confirmation (delivery
   * OTP or trusted staff action). Forward statuses are accepted so legacy
   * in-flight orders are not stranded; every path ends at the terminal
   * "delivered" status.
   */
  delivered: {
    from: ["confirmed", "processing", "ready_for_dispatch", "out_for_delivery"],
    to: "delivered",
  },
  cancelled: { from: ACTIVE_STATUSES, to: "cancelled" },
  refund_initiated: { from: ["cancelled", "delivered"], to: "refund_initiated" },
  refunded: { from: ["refund_initiated"], to: "refunded" },
};

export type OrderEventDecision =
  | { ok: true; status: string; changed: boolean }
  | { ok: false; reason: string };

/**
 * Decide the resulting status for an event. A transition may never move an
 * order backwards, and no event may move a delivered order out of delivered.
 */
export function applyOrderEvent(
  currentStatus: string,
  event: OrderEventType,
): OrderEventDecision {
  const rule = EVENT_RULES[event];
  if (!rule) return { ok: false, reason: `Unknown order event: ${event}` };

  if (event === "order_placed") {
    return { ok: false, reason: "Order placement is recorded when the order is created." };
  }

  // Repeating the event that produced the current status is an idempotent
  // no-op (e.g. a repeated "delivered" callback never re-runs the transition).
  if (rule.to && rule.to === currentStatus) {
    return { ok: true, status: currentStatus, changed: false };
  }

  if (!rule.from.includes(currentStatus)) {
    if (currentStatus === "delivered" || currentStatus === "cancelled") {
      return {
        ok: false,
        reason: `This order is already ${currentStatus} and cannot be changed by "${event}".`,
      };
    }
    return {
      ok: false,
      reason: `"${event}" is not valid while the order is ${currentStatus}.`,
    };
  }

  const nextStatus = rule.to ?? currentStatus;
  return { ok: true, status: nextStatus, changed: nextStatus !== currentStatus };
}

export function isTerminalOrderStatus(status: string): boolean {
  return (
    status === "delivered" ||
    status === "cancelled" ||
    status === "refund_initiated" ||
    status === "refunded"
  );
}

// ══════════════════════════════════════════════════════
//  PRESCRIPTION VERIFICATION (separate from fulfillment)
// ══════════════════════════════════════════════════════

export type PrescriptionState =
  | "none"
  | "pending"
  | "approved"
  | "rejected"
  | "clarification";

export function resolvePrescriptionState(
  required: boolean | undefined,
  status: string | undefined | null,
): PrescriptionState {
  if (!required) return "none";
  switch (status) {
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "needs_clarification":
      return "clarification";
    default:
      return "pending";
  }
}

export function isPrescriptionVerificationPending(
  required: boolean | undefined,
  status: string | undefined | null,
): boolean {
  return resolvePrescriptionState(required, status) === "pending";
}

export type OrderCreationPlan = {
  status: "pending" | "confirmed";
  prescriptionVerificationPending: boolean;
  note: string;
};

/**
 * Initial status for a newly created order.
 *
 * - A prescription order waits for pharmacist approval, regardless of payment.
 * - An online order waits for verified payment (the payment flow confirms it).
 * - A normal COD order is confirmed immediately after the order is created.
 */
export function planOrderCreation(input: {
  requiresPrescriptionVerification: boolean;
  prescriptionStatus?: string | null;
  paymentMethod: "cod" | "online";
}): OrderCreationPlan {
  const state = resolvePrescriptionState(
    input.requiresPrescriptionVerification,
    input.prescriptionStatus,
  );

  // A prescription order is never auto-confirmed unless the pharmacist has
  // approved it. Pending, rejected and clarification all block confirmation.
  if (state === "pending" || state === "rejected" || state === "clarification") {
    return {
      status: "pending",
      prescriptionVerificationPending: state === "pending",
      note:
        state === "rejected"
          ? "Prescription rejected — the order cannot be confirmed"
          : state === "clarification"
            ? "Prescription clarification needed before confirmation"
            : RX_PENDING_LABEL,
    };
  }

  if (input.paymentMethod === "online") {
    return {
      status: "pending",
      prescriptionVerificationPending: false,
      note: "Order placed — awaiting verified online payment",
    };
  }

  return {
    status: "confirmed",
    prescriptionVerificationPending: false,
    note: "Order confirmed automatically",
  };
}

/** Payment success may confirm the order only when no prescription review is pending. */
export function canConfirmAfterPayment(input: {
  requiresPrescriptionVerification: boolean;
  prescriptionStatus?: string | null;
}): boolean {
  if (!input.requiresPrescriptionVerification) return true;
  return input.prescriptionStatus === "approved";
}

/** Approval auto-confirms COD orders, and online orders that are already paid. */
export function canConfirmAfterPrescriptionApproval(input: {
  paymentMethod: string;
  paymentStatus?: string | null;
}): boolean {
  return input.paymentMethod === "cod" || input.paymentStatus === "paid";
}

const DEFAULT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  ready_for_dispatch: "Ready for Dispatch",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refund_initiated: "Refund Initiated",
  refunded: "Refunded",
};

/**
 * Customer-facing fulfillment label. Prescription review is intentionally a
 * separate state from the fulfillment status, so a pending order awaiting
 * review is shown as such instead of a generic "Pending".
 */
export function getOrderStatusLabel(
  order: {
    status: string;
    prescriptionVerificationRequired?: boolean;
    prescriptionStatus?: string | null;
    prescriptionId?: unknown;
  },
  labels: Record<string, string> = DEFAULT_STATUS_LABELS,
): string {
  if (order.status === "pending") {
    switch (
      resolvePrescriptionState(
        order.prescriptionVerificationRequired ?? Boolean(order.prescriptionId),
        order.prescriptionStatus,
      )
    ) {
      case "pending":
        return RX_PENDING_LABEL;
      case "rejected":
        return "Prescription Rejected";
      case "clarification":
        return "Prescription Clarification Needed";
      default:
        break;
    }
  }
  return labels[order.status] ?? order.status;
}

// ══════════════════════════════════════════════════════
//  DELIVERY OTP
// ══════════════════════════════════════════════════════

export const DELIVERY_OTP_LENGTH = 6;
export const MAX_DELIVERY_OTP_ATTEMPTS = 5;

/** Six-digit delivery OTP, kept as a string so leading zeros survive. */
export function generateDeliveryOtp(random: () => number = Math.random): string {
  const value = Math.floor(random() * 10 ** DELIVERY_OTP_LENGTH);
  return String(value).padStart(DELIVERY_OTP_LENGTH, "0");
}

export function isValidDeliveryOtp(
  storedOtp: string | undefined | null,
  enteredOtp: string | undefined | null,
): boolean {
  if (!storedOtp || !enteredOtp) return false;
  return storedOtp === enteredOtp.trim();
}

// ══════════════════════════════════════════════════════
//  THIRD-PARTY COURIER STATUS MAPPING
// ══════════════════════════════════════════════════════

export type NormalizedCourierStatus =
  | "booked"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "exception"
  | "cancelled";

const COURIER_STATUS_MAP: Record<
  string,
  { status: NormalizedCourierStatus; event: OrderEventType }
> = {
  booked: { status: "booked", event: "courier_booked" },
  manifested: { status: "booked", event: "courier_booked" },
  label_generated: { status: "booked", event: "courier_booked" },
  picked_up: { status: "picked_up", event: "courier_picked_up" },
  pickup: { status: "picked_up", event: "courier_picked_up" },
  shipped: { status: "picked_up", event: "courier_picked_up" },
  in_transit: { status: "in_transit", event: "out_for_delivery" },
  intransit: { status: "in_transit", event: "out_for_delivery" },
  out_for_delivery: { status: "out_for_delivery", event: "out_for_delivery" },
  ofd: { status: "out_for_delivery", event: "out_for_delivery" },
  delivered: { status: "delivered", event: "delivered" },
  exception: { status: "exception", event: "courier_exception" },
  failed: { status: "exception", event: "courier_exception" },
  failed_delivery: { status: "exception", event: "courier_exception" },
  rto: { status: "exception", event: "courier_exception" },
  returned: { status: "exception", event: "courier_exception" },
  cancelled: { status: "cancelled", event: "courier_exception" },
  canceled: { status: "cancelled", event: "courier_exception" },
};

export type CourierStatusDecision =
  | { ok: true; status: NormalizedCourierStatus; event: OrderEventType }
  | { ok: false; reason: string };

/** Translate a courier's reported status into an order event. */
export function mapCourierStatus(rawStatus: string): CourierStatusDecision {
  const key = rawStatus.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const mapped = COURIER_STATUS_MAP[key];
  if (!mapped) {
    return { ok: false, reason: `Unsupported courier status: ${rawStatus}` };
  }
  return { ok: true, ...mapped };
}

/**
 * Stable dedupe key for a courier callback. When the courier supplies an event
 * id, that wins; otherwise provider + AWB + normalized status ensures a
 * repeated status callback cannot be applied twice.
 */
export function courierEventDedupeKey(input: {
  provider: string;
  awb: string;
  eventId?: string | null;
  status: string;
}): string {
  const provider = input.provider.trim().toLowerCase();
  const awb = input.awb.trim().toUpperCase();
  const eventId = input.eventId?.trim();
  const suffix = eventId || input.status.trim().toLowerCase();
  return `courier:${provider}:${awb}:${suffix}`;
}
