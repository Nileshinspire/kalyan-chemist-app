import { describe, expect, it } from "vitest";
import {
  canShareLocation,
  isTerminalDeliveryStatus,
  isTrackingStale,
  isValidAccuracy,
  isValidLatitude,
  isValidLongitude,
  normalizePhone,
  validateDeliveryAccount,
  TRACKING_STALE_MS,
} from "@/convex/deliveryTrackingCore";

describe("delivery status rules", () => {
  it("never shares location for closed orders", () => {
    for (const status of ["delivered", "cancelled", "refund_initiated", "refunded"]) {
      expect(isTerminalDeliveryStatus(status)).toBe(true);
      expect(canShareLocation(status)).toBe(false);
    }
  });

  it("allows sharing while the order is being fulfilled", () => {
    for (const status of [
      "pending",
      "confirmed",
      "processing",
      "ready_for_dispatch",
      "out_for_delivery",
    ]) {
      expect(canShareLocation(status)).toBe(true);
    }
  });
});

describe("GPS coordinate validation", () => {
  it("accepts real coordinates and rejects out-of-range values", () => {
    expect(isValidLatitude(19.076)).toBe(true);
    expect(isValidLongitude(72.8777)).toBe(true);
    expect(isValidLatitude(91)).toBe(false);
    expect(isValidLongitude(-181)).toBe(false);
    expect(isValidLatitude(Number.NaN)).toBe(false);
    expect(isValidLongitude(undefined)).toBe(false);
  });

  it("only accepts non-negative finite accuracy", () => {
    expect(isValidAccuracy(undefined)).toBe(true);
    expect(isValidAccuracy(12.5)).toBe(true);
    expect(isValidAccuracy(-1)).toBe(false);
    expect(isValidAccuracy(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe("stale delivery sessions", () => {
  const now = 1_800_000_000_000;

  it("expires an active session with no recent GPS ping", () => {
    expect(
      isTrackingStale(
        { active: true, startedAt: now - TRACKING_STALE_MS - 1 },
        now,
      ),
    ).toBe(true);
  });

  it("keeps a session that pinged recently", () => {
    expect(
      isTrackingStale(
        { active: true, startedAt: now - 60_000, lastLocationAt: now - 5_000 },
        now,
      ),
    ).toBe(false);
  });

  it("ignores sessions that are already stopped", () => {
    expect(isTrackingStale({ active: false, startedAt: 0 }, now)).toBe(false);
  });
});

describe("delivery partner accounts", () => {
  it("normalises formatted phone numbers to the same login id", () => {
    expect(normalizePhone("+91 89575 34868")).toBe("918957534868");
    expect(normalizePhone("8957534868")).toBe("8957534868");
  });

  it("requires a name, valid phone and a password of at least 8 characters", () => {
    expect(
      validateDeliveryAccount({ name: "Ravi", phone: "8957534868", password: "password1" }),
    ).toBeNull();
    expect(
      validateDeliveryAccount({ name: "", phone: "8957534868", password: "password1" }),
    ).toMatch(/name/i);
    expect(
      validateDeliveryAccount({ name: "Ravi", phone: "123", password: "password1" }),
    ).toMatch(/phone/i);
    expect(
      validateDeliveryAccount({ name: "Ravi", phone: "8957534868", password: "short" }),
    ).toMatch(/8 characters/i);
  });
});
