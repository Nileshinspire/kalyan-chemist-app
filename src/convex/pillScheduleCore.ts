/**
 * Pure schedule helpers for the Pill Reminder feature.
 *
 * No Convex or React imports live here so the exact same rules are used by the
 * backend cron, the customer UI and the unit tests. Times are stored as local
 * "HH:MM" strings plus the customer's UTC offset, which is why every function
 * takes `timezoneOffsetMinutes` (the value of `Date.prototype.getTimezoneOffset`
 * at the time the reminder was created).
 */

export const DAY_MS = 24 * 60 * 60 * 1000;
export const MAX_PILL_TIMES = 6;
export const MIN_PILL_TIME_GAP_MINUTES = 30;
/** A due dose is notified only within this window, so a stale cron run can never
 *  flood the customer with every slot of the day. */
export const PILL_NOTIFY_WINDOW_MS = 90 * 60 * 1000;

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface PillReminderLike {
  times: string[];
  startDate: number;
  endDate?: number;
  timezoneOffsetMinutes: number;
  isActive: boolean;
  lastNotifiedSlot?: number;
}

export function isValidPillTime(value: string): boolean {
  return TIME_RE.test(value);
}

export function pillTimeToMinutes(value: string): number {
  const match = TIME_RE.exec(value);
  if (!match) throw new Error(`Invalid reminder time: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Validate, de-duplicate and sort the customer's reminder times.
 * Throws a customer-readable error for anything the UI cannot render.
 */
export function normalizePillTimes(times: string[]): string[] {
  if (!Array.isArray(times) || times.length === 0) {
    throw new Error("Add at least one reminder time.");
  }
  if (times.length > MAX_PILL_TIMES) {
    throw new Error(`You can add at most ${MAX_PILL_TIMES} reminder times per medicine.`);
  }

  const unique = Array.from(new Set(times.map((t) => (t ?? "").trim())));
  for (const time of unique) {
    if (!isValidPillTime(time)) {
      throw new Error("Reminder times must use the 24-hour HH:MM format.");
    }
  }

  const sorted = unique.sort((a, b) => pillTimeToMinutes(a) - pillTimeToMinutes(b));
  for (let i = 1; i < sorted.length; i++) {
    const gap = pillTimeToMinutes(sorted[i]) - pillTimeToMinutes(sorted[i - 1]);
    if (gap < MIN_PILL_TIME_GAP_MINUTES) {
      throw new Error(
        `Reminder times must be at least ${MIN_PILL_TIME_GAP_MINUTES} minutes apart.`,
      );
    }
  }
  return sorted;
}

/** Epoch ms of the customer's local midnight for the day containing `timestamp`. */
export function localDayStartMs(timestamp: number, timezoneOffsetMinutes: number): number {
  const localAsUtc = timestamp - timezoneOffsetMinutes * 60 * 1000;
  return Math.floor(localAsUtc / DAY_MS) * DAY_MS + timezoneOffsetMinutes * 60 * 1000;
}

/** Epoch ms of a "HH:MM" slot on the local day that starts at `dayStartMs`. */
export function slotTimestamp(dayStartMs: number, time: string): number {
  return dayStartMs + pillTimeToMinutes(time) * 60 * 1000;
}

/** Local calendar day key, e.g. 2026-11-06, used to compare days without time. */
export function localDayKey(timestamp: number, timezoneOffsetMinutes: number): string {
  const local = new Date(timestamp - timezoneOffsetMinutes * 60 * 1000);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(
    local.getUTCDate(),
  ).padStart(2, "0")}`;
}

/** True when the reminder's start/end window covers the local day of `timestamp`. */
export function reminderCoversTimestamp(
  reminder: Pick<PillReminderLike, "startDate" | "endDate" | "timezoneOffsetMinutes">,
  timestamp: number,
): boolean {
  const day = localDayStartMs(timestamp, reminder.timezoneOffsetMinutes);
  if (day < localDayStartMs(reminder.startDate, reminder.timezoneOffsetMinutes)) return false;
  if (reminder.endDate === undefined) return true;
  // The end date is inclusive: it covers its whole local day.
  return day <= localDayStartMs(reminder.endDate, reminder.timezoneOffsetMinutes);
}

/** All dose timestamps configured for the local day containing `timestamp`. */
export function slotsForLocalDay(
  reminder: Pick<PillReminderLike, "times" | "timezoneOffsetMinutes">,
  timestamp: number,
): number[] {
  const dayStart = localDayStartMs(timestamp, reminder.timezoneOffsetMinutes);
  return reminder.times.map((time) => slotTimestamp(dayStart, time));
}

/**
 * The single slot the website notification cron should fire for right now.
 * Returns null when nothing is due, when the reminder is paused, when the slot
 * was already notified, or when the slot is older than the notify window.
 */
export function dueSlotForReminder(
  reminder: PillReminderLike,
  now: number,
): number | null {
  if (!reminder.isActive) return null;
  if (!reminderCoversTimestamp(reminder, now)) return null;

  const candidates = slotsForLocalDay(reminder, now)
    .filter((slot) => slot <= now)
    .filter((slot) => now - slot <= PILL_NOTIFY_WINDOW_MS)
    .filter((slot) => reminder.lastNotifiedSlot === undefined || slot > reminder.lastNotifiedSlot)
    .sort((a, b) => a - b);

  return candidates[0] ?? null;
}

/**
 * Next upcoming dose at or after `now` (used by the account UI).
 * Searches up to 14 days ahead and respects a paused/deleted schedule window.
 */
export function nextDoseAfter(
  reminder: PillReminderLike,
  now: number,
): number | null {
  if (!reminder.isActive) return null;
  for (let offset = 0; offset <= 14; offset++) {
    const day = localDayStartMs(now, reminder.timezoneOffsetMinutes) + offset * DAY_MS;
    const slots = reminder.times.map((time) => slotTimestamp(day, time));
    const upcoming = slots.filter((slot) => slot >= now);
    if (upcoming.length > 0) {
      if (!reminderCoversTimestamp(reminder, upcoming[0])) return null;
      return upcoming[0];
    }
  }
  return null;
}

/** Today's slots with a simple past/upcoming flag, oldest first. */
export function todayDoseSlots(
  reminder: Pick<PillReminderLike, "times" | "startDate" | "endDate" | "timezoneOffsetMinutes">,
  now: number,
): { scheduledFor: number; time: string; isPast: boolean }[] {
  if (!reminderCoversTimestamp(reminder, now)) return [];
  const dayStart = localDayStartMs(now, reminder.timezoneOffsetMinutes);
  return reminder.times.map((time) => {
    const scheduledFor = slotTimestamp(dayStart, time);
    return { scheduledFor, time, isPast: scheduledFor <= now };
  });
}

/** Format an epoch ms as the reminder's local "HH:MM" (for notifications). */
export function formatSlotTime(slot: number, timezoneOffsetMinutes: number): string {
  const local = new Date(slot - timezoneOffsetMinutes * 60 * 1000);
  return `${String(local.getUTCHours()).padStart(2, "0")}:${String(
    local.getUTCMinutes(),
  ).padStart(2, "0")}`;
}

export function validateTimezoneOffset(minutes: number): number {
  if (!Number.isFinite(minutes) || Math.abs(minutes) > 14 * 60) {
    throw new Error("Invalid timezone offset.");
  }
  return Math.trunc(minutes);
}

export function normalizeDateBoundary(timestamp: number, timezoneOffsetMinutes: number): number {
  if (!Number.isFinite(timestamp)) throw new Error("Invalid date.");
  return localDayStartMs(timestamp, timezoneOffsetMinutes);
}
