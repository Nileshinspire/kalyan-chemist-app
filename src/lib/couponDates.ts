/**
 * Date <-> `<input type="date">` helpers for the admin coupon form.
 *
 * The date input speaks plain calendar dates (YYYY-MM-DD) with no timezone.
 * Converting those through UTC (`toISOString`) shifts the day for any zone
 * that is not UTC, so everything here is built from LOCAL calendar parts:
 * a date picked in the UI is stored as local start-of-day / end-of-day and is
 * read back with the same local parts. No day ever shifts by one.
 */

const pad = (value: number) => String(value).padStart(2, "0");

/** "YYYY-MM-DD" → local timestamp at the start of that day (00:00:00.000). */
export function startOfDayFromInput(value: string): number {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!parts) return 0;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

/** "YYYY-MM-DD" → local timestamp at the end of that day (23:59:59.999). */
export function endOfDayFromInput(value: string): number {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!parts) return 0;
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const date = new Date(year, month - 1, day, 23, 59, 59, 999);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

/**
 * Local timestamp → "YYYY-MM-DD" for the date input's value.
 * Uses local parts (never UTC) so the field always shows the day that was
 * picked/saved, including when editing an existing coupon.
 */
export function toDateInputValue(ms: number | null | undefined): string {
  if (!ms) return "";
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** True when the end date is earlier than the start date (day-level check). */
export function endDateBeforeStart(
  startsAt: number | null | undefined,
  expiresAt: number | null | undefined
): boolean {
  if (!startsAt || !expiresAt) return false;
  return expiresAt < startsAt;
}
