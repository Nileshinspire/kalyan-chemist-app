import { describe, expect, it } from "vitest";
import {
  applyOrderEvent,
  canConfirmAfterPayment,
  canConfirmAfterPrescriptionApproval,
  courierEventDedupeKey,
  generateDeliveryOtp,
  getOrderStatusLabel,
  isValidDeliveryOtp,
  mapCourierStatus,
  ORDER_PROGRESSION,
  planOrderCreation,
  resolvePrescriptionState,
  RX_PENDING_LABEL,
  type OrderEventType,
} from "@/convex/orderWorkflowCore";

/** Apply one event and fail loudly if the workflow rejects it. */
function step(status: string, event: OrderEventType): string {
  const result = applyOrderEvent(status, event);
  if (!result.ok) throw new Error(result.reason);
  return result.status;
}

describe("automatic order confirmation", () => {
  it("confirms a normal COD order immediately after creation", () => {
    const plan = planOrderCreation({
      requiresPrescriptionVerification: false,
      paymentMethod: "cod",
    });

    expect(plan.status).toBe("confirmed");
    expect(plan.prescriptionVerificationPending).toBe(false);
  });

  it("keeps a normal online order pending until payment is verified", () => {
    const plan = planOrderCreation({
      requiresPrescriptionVerification: false,
      paymentMethod: "online",
    });

    expect(plan.status).toBe("pending");
    expect(plan.prescriptionVerificationPending).toBe(false);
    expect(
      canConfirmAfterPayment({
        requiresPrescriptionVerification: false,
        prescriptionStatus: null,
      }),
    ).toBe(true);

    expect(step("pending", "order_confirmed")).toBe("confirmed");
  });

  it("shows the prescription-verification state for a COD prescription order", () => {
    const plan = planOrderCreation({
      requiresPrescriptionVerification: true,
      prescriptionStatus: "pending",
      paymentMethod: "cod",
    });

    expect(plan.status).toBe("pending");
    expect(plan.prescriptionVerificationPending).toBe(true);
    expect(
      getOrderStatusLabel({
        status: "pending",
        prescriptionVerificationRequired: true,
        prescriptionStatus: "pending",
      }),
    ).toBe(RX_PENDING_LABEL);
  });

  it("confirms after pharmacist approval, respecting payment rules", () => {
    // Approved prescription: a COD order confirms now, a paid online order too.
    expect(
      canConfirmAfterPrescriptionApproval({
        paymentMethod: "cod",
        paymentStatus: "pending",
      }),
    ).toBe(true);
    expect(
      canConfirmAfterPrescriptionApproval({
        paymentMethod: "online",
        paymentStatus: "paid",
      }),
    ).toBe(true);
    // An unpaid online order still waits for its payment.
    expect(
      canConfirmAfterPrescriptionApproval({
        paymentMethod: "online",
        paymentStatus: "pending",
      }),
    ).toBe(false);

    const plan = planOrderCreation({
      requiresPrescriptionVerification: true,
      prescriptionStatus: "approved",
      paymentMethod: "cod",
    });
    expect(plan.status).toBe("confirmed");
  });

  it("blocks confirmation and exposes the reason for a rejected prescription", () => {
    expect(
      resolvePrescriptionState(true, "rejected"),
    ).toBe("rejected");
    expect(
      getOrderStatusLabel({
        status: "pending",
        prescriptionVerificationRequired: true,
        prescriptionStatus: "rejected",
      }),
    ).toBe("Prescription Rejected");
    expect(
      canConfirmAfterPayment({
        requiresPrescriptionVerification: true,
        prescriptionStatus: "rejected",
      }),
    ).toBe(false);
    expect(
      planOrderCreation({
        requiresPrescriptionVerification: true,
        prescriptionStatus: "rejected",
        paymentMethod: "cod",
      }).status,
    ).toBe("pending");
  });
});

describe("event-driven fulfillment progression", () => {
  it("moves through placed → confirmed → processing → ready → shipped → delivered", () => {
    let status: string = "pending";
    expect((status = step(status, "order_confirmed"))).toBe("confirmed");
    expect((status = step(status, "processing_started"))).toBe("processing");
    expect((status = step(status, "packing_completed"))).toBe("ready_for_dispatch");
    expect((status = step(status, "driver_picked_up"))).toBe("out_for_delivery");
    expect((status = step(status, "delivered"))).toBe("delivered");
    expect(ORDER_PROGRESSION).toContain(status);
  });

  it("never moves an order backwards", () => {
    expect(applyOrderEvent("processing", "order_confirmed").ok).toBe(false);
    expect(applyOrderEvent("ready_for_dispatch", "processing_started").ok).toBe(false);
    expect(applyOrderEvent("out_for_delivery", "packing_completed").ok).toBe(false);
    expect(applyOrderEvent("delivered", "out_for_delivery").ok).toBe(false);
    expect(applyOrderEvent("cancelled", "order_confirmed").ok).toBe(false);
  });

  it("supports own-delivery accept and pickup as distinct events", () => {
    let status: string = "confirmed";
    status = step(status, "processing_started");
    status = step(status, "packing_completed");

    // Assignment and acceptance do not skip dispatch.
    expect(step(status, "driver_assigned")).toBe("ready_for_dispatch");
    expect(step(status, "driver_accepted")).toBe("ready_for_dispatch");
    // Pickup is the event that moves the order out for delivery.
    expect(step(status, "driver_picked_up")).toBe("out_for_delivery");
    expect(step("out_for_delivery", "delivered")).toBe("delivered");
  });

  it("maps third-party courier statuses onto verified order events", () => {
    const booked = mapCourierStatus("Booked");
    expect(booked).toEqual({ ok: true, status: "booked", event: "courier_booked" });

    const picked = mapCourierStatus("Picked Up");
    expect(picked.ok && picked.event).toBe("courier_picked_up");
    expect(step("ready_for_dispatch", "courier_picked_up")).toBe(
      "out_for_delivery",
    );

    const inTransit = mapCourierStatus("IN-TRANSIT");
    expect(inTransit.ok && inTransit.event).toBe("out_for_delivery");

    const delivered = mapCourierStatus("Delivered");
    expect(step("out_for_delivery", "delivered")).toBe("delivered");
    expect(delivered.ok).toBe(true);

    expect(mapCourierStatus("lost-in-space").ok).toBe(false);
  });

  it("deduplicates repeated courier callbacks by event id or status", () => {
    const first = courierEventDedupeKey({
      provider: "Delhivery",
      awb: " awb123 ",
      eventId: "evt-1",
      status: "in_transit",
    });
    const repeat = courierEventDedupeKey({
      provider: "delhivery",
      awb: "AWB123",
      eventId: "evt-1",
      status: "delivered",
    });
    expect(first).toBe(repeat);

    const statusOnly = courierEventDedupeKey({
      provider: "Blue Dart",
      awb: "BD9",
      status: "out_for_delivery",
    });
    expect(statusOnly).toBe("courier:blue dart:BD9:out_for_delivery");
  });

  it("handles cancellation and the refund flow without corrupting fulfillment", () => {
    expect(step("confirmed", "cancelled")).toBe("cancelled");
    // A delivered order is refunded through payment status, never cancelled.
    expect(applyOrderEvent("delivered", "cancelled").ok).toBe(false);
    expect(step("cancelled", "refund_initiated")).toBe("refund_initiated");
    expect(step("refund_initiated", "refunded")).toBe("refunded");
    expect(applyOrderEvent("refunded", "order_confirmed").ok).toBe(false);
  });

  it("keeps a delivered order delivered forever", () => {
    expect(step("delivered", "delivered")).toBe("delivered");
    expect(applyOrderEvent("delivered", "processing_started").ok).toBe(false);
    expect(applyOrderEvent("delivered", "packing_completed").ok).toBe(false);
    expect(applyOrderEvent("delivered", "out_for_delivery").ok).toBe(false);
    expect(
      getOrderStatusLabel({
        status: "delivered",
        prescriptionVerificationRequired: true,
        prescriptionStatus: "approved",
      }),
    ).toBe("Delivered");
  });
});

describe("delivery completion OTP", () => {
  it("generates a six-digit OTP and validates only the exact code", () => {
    const otp = generateDeliveryOtp(() => 0.123456);
    expect(otp).toBe("123456");
    expect(isValidDeliveryOtp(otp, "123456")).toBe(true);
    expect(isValidDeliveryOtp(otp, " 123456 ")).toBe(true);
    expect(isValidDeliveryOtp(otp, "123457")).toBe(false);
    expect(isValidDeliveryOtp(undefined, "123456")).toBe(false);
    expect(isValidDeliveryOtp(otp, "")).toBe(false);
  });

  it("keeps leading zeros in the OTP", () => {
    expect(generateDeliveryOtp(() => 0.000001)).toBe("000001");
  });
});
