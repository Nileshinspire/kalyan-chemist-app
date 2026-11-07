/**
 * Shared, side-effect-free rules for live delivery tracking.
 *
 * Keeping these in one place lets the delivery, customer and admin functions
 * apply exactly the same rules, and makes them unit-testable without a Convex
 * deployment.
 */

export const TERMINAL_DELIVERY_STATUSES = [
  "delivered",
  "cancelled",
  "refund_initiated",
  "refunded",
] as const;

/** A delivery session is considered stale after this long without a GPS ping. */
export const TRACKING_STALE_MS = 3 * 60 * 1000;

export function isTerminalDeliveryStatus(status: string): boolean {
  return (TERMINAL_DELIVERY_STATUSES as readonly string[]).includes(status);
}

/** Location may only be shared while the order is still being fulfilled. */
export function canShareLocation(status: string): boolean {
  return !isTerminalDeliveryStatus(status);
}

export function isValidLatitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= -180 && value <= 180;
}

export function isValidAccuracy(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === "number" && Number.isFinite(value) && value >= 0);
}

/** True when a still-active session has not received a GPS ping recently. */
export function isTrackingStale(
  tracking: { active: boolean; startedAt: number; lastLocationAt?: number },
  now: number,
  staleMs: number = TRACKING_STALE_MS,
): boolean {
  if (!tracking.active) return false;
  const lastSeen = tracking.lastLocationAt ?? tracking.startedAt;
  return now - lastSeen > staleMs;
}

/**
 * Phone numbers are the delivery partner's login id. Normalising both when the
 * account is created and when signing in keeps "+91 89575 34868" and
 * "8957534868" from becoming two different accounts.
 */
export function normalizePhone(input: string): string {
  return input.replace(/\D/g, "");
}

/** Returns an error message, or null when the delivery account looks valid. */
export function validateDeliveryAccount(input: {
  name: string;
  phone: string;
  password: string;
}): string | null {
  if (input.name.trim().length < 2) return "Please enter the delivery partner's name.";
  const phone = normalizePhone(input.phone);
  if (phone.length < 10 || phone.length > 15) {
    return "Enter a valid phone number (10–15 digits).";
  }
  if (input.password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  return null;
}
