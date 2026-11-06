/**
 * Pure rules for Proactive Refill Reminders.
 *
 * These helpers are shared by the Convex backend, the refill page and the unit
 * tests. Nothing here reads the database or assumes a dosage: an interval or a
 * date only ever comes from the customer.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MIN_REFILL_INTERVAL_DAYS = 1;
export const MAX_REFILL_INTERVAL_DAYS = 365;
export const MAX_EXPECTED_DATE_AHEAD_MS = 730 * DAY_MS;
/** A reminder is "approaching" this many days before it is due. */
export const REFILL_SOON_WINDOW_DAYS = 3;

export type RefillSuggestionStatus = "enabled" | "dismissed" | "completed";

export interface OrderLike {
  status: string;
  paymentStatus?: string;
  createdAt: number;
  items: { productId: string; name: string; quantity?: number }[];
}

export interface EligibleOrderedMedicine {
  productId: string;
  name: string;
  lastOrderAt: number;
  orderCount: number;
}

/**
 * Products from the customer's own successful medicine orders: delivered, or
 * confirmed/processing (the same statuses the existing refill page treats as
 * purchased). Cancelled, refunded, pending and failed-payment orders are never
 * used. Each product appears once, tied to its latest order.
 */
export const ELIGIBLE_REFILL_ORDER_STATUSES = ["delivered", "confirmed", "processing"] as const;

export function collectEligibleOrderedMedicines(
  orders: OrderLike[],
): EligibleOrderedMedicine[] {
  const byProduct = new Map<string, EligibleOrderedMedicine>();

  for (const order of orders) {
    if (!(ELIGIBLE_REFILL_ORDER_STATUSES as readonly string[]).includes(order.status)) continue;
    if (order.paymentStatus === "failed") continue;

    for (const item of order.items) {
      if (!item?.productId) continue;
      const existing = byProduct.get(item.productId);
      if (existing) {
        existing.orderCount += 1;
        existing.lastOrderAt = Math.max(existing.lastOrderAt, order.createdAt);
        // Later orders carry the more recent product name.
        if (order.createdAt >= existing.lastOrderAt) existing.name = item.name;
      } else {
        byProduct.set(item.productId, {
          productId: item.productId,
          name: item.name,
          lastOrderAt: order.createdAt,
          orderCount: 1,
        });
      }
    }
  }

  return Array.from(byProduct.values()).sort((a, b) => b.lastOrderAt - a.lastOrderAt);
}

export function validateRefillIntervalDays(days: number): number {
  if (!Number.isFinite(days) || !Number.isInteger(days)) {
    throw new Error("Refill interval must be a whole number of days.");
  }
  if (days < MIN_REFILL_INTERVAL_DAYS || days > MAX_REFILL_INTERVAL_DAYS) {
    throw new Error(
      `Refill interval must be between ${MIN_REFILL_INTERVAL_DAYS} and ${MAX_REFILL_INTERVAL_DAYS} days.`,
    );
  }
  return days;
}

/** Validates a customer-chosen refill date and returns it unchanged. */
export function validateExpectedRefillDate(timestamp: number, now: number): number {
  if (!Number.isFinite(timestamp)) {
    throw new Error("Choose a valid refill date.");
  }
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  if (timestamp < startOfToday) {
    throw new Error("Refill date cannot be in the past.");
  }
  if (timestamp > now + MAX_EXPECTED_DATE_AHEAD_MS) {
    throw new Error("Refill date is too far in the future.");
  }
  return timestamp;
}

export function computeNextReminderAt(input: {
  intervalDays?: number;
  expectedDate?: number;
  from: number;
}): number {
  if (input.expectedDate !== undefined) return input.expectedDate;
  if (input.intervalDays !== undefined) {
    return input.from + input.intervalDays * DAY_MS;
  }
  throw new Error("Choose a refill interval or an expected refill date.");
}

/**
 * True only when an enabled reminder is due and has not already been notified
 * for this due date. This is what prevents duplicate website notifications.
 */
export function shouldNotifyRefillSuggestion(
  suggestion: {
    status: RefillSuggestionStatus;
    nextReminderAt?: number;
    lastNotifiedAt?: number;
  },
  now: number,
): boolean {
  if (suggestion.status !== "enabled") return false;
  if (suggestion.nextReminderAt === undefined) return false;
  if (suggestion.nextReminderAt > now) return false;
  if (
    suggestion.lastNotifiedAt !== undefined &&
    suggestion.lastNotifiedAt >= suggestion.nextReminderAt
  ) {
    return false;
  }
  return true;
}

/**
 * Next due time after a notification. Interval reminders repeat from the
 * current time; a one-off expected date does not repeat by itself.
 */
export function advanceRefillSuggestion(
  suggestion: { intervalDays?: number; expectedDate?: number },
  now: number,
): number | undefined {
  if (suggestion.intervalDays === undefined) return undefined;
  return now + suggestion.intervalDays * DAY_MS;
}

export function daysUntil(timestamp: number, now: number): number {
  return Math.ceil((timestamp - now) / DAY_MS);
}

export function isRefillApproaching(nextReminderAt: number | undefined, now: number): boolean {
  if (nextReminderAt === undefined) return false;
  const days = daysUntil(nextReminderAt, now);
  return days <= REFILL_SOON_WINDOW_DAYS;
}
