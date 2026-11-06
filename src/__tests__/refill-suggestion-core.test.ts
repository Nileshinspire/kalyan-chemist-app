import { describe, expect, it } from "vitest";
import {
  advanceRefillSuggestion,
  collectEligibleOrderedMedicines,
  computeNextReminderAt,
  daysUntil,
  isRefillApproaching,
  shouldNotifyRefillSuggestion,
  validateExpectedRefillDate,
  validateRefillIntervalDays,
} from "@/convex/refillSuggestionCore";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 6, 9, 0);

function order(overrides: Record<string, unknown> = {}) {
  return {
    status: "delivered",
    paymentStatus: "paid",
    createdAt: NOW - 30 * DAY,
    items: [{ productId: "p1", name: "Metformin 500 mg", quantity: 1 }],
    ...overrides,
  };
}

describe("proactive refill suggestions", () => {
  it("only uses the customer's successful, paid orders", () => {
    const result = collectEligibleOrderedMedicines([
      order(),
      order({ status: "confirmed", items: [{ productId: "p5", name: "Confirmed" }] }),
      order({ status: "processing", items: [{ productId: "p6", name: "Processing" }] }),
      order({ status: "pending", items: [{ productId: "p2", name: "Pending" }] }),
      order({ status: "delivered", paymentStatus: "failed", items: [{ productId: "p3", name: "Failed" }] }),
      order({ status: "cancelled", items: [{ productId: "p4", name: "Cancelled" }] }),
      order({ status: "refunded", items: [{ productId: "p7", name: "Refunded" }] }),
    ]);

    expect(result.map((r) => r.productId).sort()).toEqual(["p1", "p5", "p6"]);
    expect(result.find((r) => r.productId === "p1")?.orderCount).toBe(1);
  });

  it("de-duplicates a medicine and keeps the latest order date", () => {
    const result = collectEligibleOrderedMedicines([
      order({ createdAt: NOW - 60 * DAY }),
      order({ createdAt: NOW - 10 * DAY }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0].orderCount).toBe(2);
    expect(result[0].lastOrderAt).toBe(NOW - 10 * DAY);
  });

  it("requires a customer-confirmed interval within bounds", () => {
    expect(validateRefillIntervalDays(30)).toBe(30);
    expect(() => validateRefillIntervalDays(0)).toThrow(/between 1 and 365/i);
    expect(() => validateRefillIntervalDays(366)).toThrow(/between 1 and 365/i);
    expect(() => validateRefillIntervalDays(12.5)).toThrow(/whole number/i);
  });

  it("rejects past and far-future refill dates", () => {
    expect(validateExpectedRefillDate(NOW + DAY, NOW)).toBe(NOW + DAY);
    expect(() => validateExpectedRefillDate(NOW - 3 * DAY, NOW)).toThrow(/past/i);
    expect(() =>
      validateExpectedRefillDate(NOW + 800 * DAY, NOW),
    ).toThrow(/too far in the future/i);
  });

  it("counts an interval from the last delivered order, not from today", () => {
    const lastOrderAt = NOW - 40 * DAY;
    expect(computeNextReminderAt({ intervalDays: 30, from: lastOrderAt })).toBe(
      lastOrderAt + 30 * DAY,
    );
    expect(computeNextReminderAt({ expectedDate: NOW + 5 * DAY, from: lastOrderAt })).toBe(
      NOW + 5 * DAY,
    );
    expect(() => computeNextReminderAt({ from: NOW })).toThrow(/interval or an expected/i);
  });

  it("notifies at most once per due date", () => {
    const due = { status: "enabled" as const, nextReminderAt: NOW - 1 };

    expect(shouldNotifyRefillSuggestion(due, NOW)).toBe(true);
    expect(
      shouldNotifyRefillSuggestion({ ...due, lastNotifiedAt: NOW - 1 }, NOW),
    ).toBe(false);
    expect(
      shouldNotifyRefillSuggestion({ ...due, lastNotifiedAt: NOW - 2 }, NOW),
    ).toBe(true);
    expect(
      shouldNotifyRefillSuggestion({ ...due, nextReminderAt: NOW + DAY }, NOW),
    ).toBe(false);
    expect(
      shouldNotifyRefillSuggestion(
        { status: "dismissed" as const, nextReminderAt: NOW - 1 },
        NOW,
      ),
    ).toBe(false);
  });

  it("repeats interval reminders and never repeats a one-off date", () => {
    expect(advanceRefillSuggestion({ intervalDays: 30 }, NOW)).toBe(NOW + 30 * DAY);
    expect(advanceRefillSuggestion({ expectedDate: NOW }, NOW)).toBeUndefined();
  });

  it("flags only reminders that are close to due", () => {
    expect(isRefillApproaching(NOW + 2 * DAY, NOW)).toBe(true);
    expect(isRefillApproaching(NOW - DAY, NOW)).toBe(true);
    expect(isRefillApproaching(NOW + 9 * DAY, NOW)).toBe(false);
    expect(isRefillApproaching(undefined, NOW)).toBe(false);
    expect(daysUntil(NOW + 2 * DAY, NOW)).toBe(2);
  });
});
