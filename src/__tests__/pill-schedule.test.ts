import { describe, expect, it } from "vitest";
import {
  dueSlotForReminder,
  localDayStartMs,
  nextDoseAfter,
  normalizePillTimes,
  reminderCoversTimestamp,
  slotTimestamp,
  todayDoseSlots,
  PILL_NOTIFY_WINDOW_MS,
} from "@/convex/pillScheduleCore";

const IST = -330; // Date.prototype.getTimezoneOffset() in India
const DAY = 24 * 60 * 60 * 1000;

// A wall-clock time in India is 5h30m ahead of UTC, so its epoch is earlier.
function ist(y: number, m: number, d: number, h = 0, min = 0) {
  return Date.UTC(y, m - 1, d, h, min) - 330 * 60 * 1000;
}

const baseReminder = {
  times: ["09:00", "21:00"],
  startDate: ist(2026, 1, 1),
  timezoneOffsetMinutes: IST,
  isActive: true,
};

describe("pill reminder schedule", () => {
  it("sorts and de-duplicates valid 24-hour times", () => {
    expect(normalizePillTimes(["21:00", "09:00", "21:00"])).toEqual(["09:00", "21:00"]);
  });

  it("rejects invalid, empty and too-close times", () => {
    expect(() => normalizePillTimes([])).toThrow(/at least one/i);
    expect(() => normalizePillTimes(["9:00"])).toThrow(/HH:MM/i);
    expect(() => normalizePillTimes(["24:00"])).toThrow(/HH:MM/i);
    expect(() => normalizePillTimes(["09:00", "09:10"])).toThrow(/at least 30 minutes/i);
    expect(() =>
      normalizePillTimes(["01:00", "03:00", "05:00", "07:00", "09:00", "11:00", "13:00"]),
    ).toThrow(/at most 6/i);
  });

  it("computes local midnight and slots in the customer's timezone", () => {
    const noonUtc = Date.UTC(2026, 10, 6, 12, 0);
    const dayStart = localDayStartMs(noonUtc, IST);
    expect(dayStart).toBe(Date.UTC(2026, 10, 5, 18, 30));
    expect(slotTimestamp(dayStart, "09:00")).toBe(ist(2026, 11, 6, 9));
  });

  it("treats the end date as inclusive and honours the start date", () => {
    const reminder = {
      ...baseReminder,
      startDate: ist(2026, 11, 6),
      endDate: ist(2026, 11, 6),
    };
    expect(reminderCoversTimestamp(reminder, ist(2026, 11, 6, 23, 0))).toBe(true);
    expect(reminderCoversTimestamp(reminder, ist(2026, 11, 7, 0, 1))).toBe(false);
    expect(reminderCoversTimestamp(reminder, ist(2026, 11, 5, 23, 0))).toBe(false);
  });

  it("notifies a due slot once, and only within the notify window", () => {
    const due = ist(2026, 11, 6, 9, 5);
    const expectedSlot = ist(2026, 11, 6, 9);

    expect(dueSlotForReminder({ ...baseReminder, startDate: ist(2026, 11, 6) }, due)).toBe(
      expectedSlot,
    );
    expect(
      dueSlotForReminder(
        { ...baseReminder, startDate: ist(2026, 11, 6), lastNotifiedSlot: expectedSlot },
        due,
      ),
    ).toBeNull();
    expect(
      dueSlotForReminder({ ...baseReminder, isActive: false }, due),
    ).toBeNull();
    expect(
      dueSlotForReminder(
        { ...baseReminder, startDate: ist(2026, 11, 6) },
        expectedSlot + PILL_NOTIFY_WINDOW_MS + 60_000,
      ),
    ).toBeNull();
    expect(
      dueSlotForReminder(
        { ...baseReminder, startDate: ist(2026, 11, 6) },
        ist(2026, 11, 6, 8, 59),
      ),
    ).toBeNull();
  });

  it("rolls the next dose over to the following day and stops after the end date", () => {
    const reminder = { ...baseReminder, startDate: ist(2026, 11, 1) };
    expect(nextDoseAfter(reminder, ist(2026, 11, 6, 10, 0))).toBe(ist(2026, 11, 6, 21));
    expect(nextDoseAfter(reminder, ist(2026, 11, 6, 22, 0))).toBe(
      ist(2026, 11, 7, 9),
    );

    const ended = { ...reminder, endDate: ist(2026, 11, 6) };
    expect(nextDoseAfter(ended, ist(2026, 11, 6, 22, 0))).toBeNull();
  });

  it("returns today's slots with past flags for the Taken/Skipped UI", () => {
    const doses = todayDoseSlots(
      { ...baseReminder, startDate: ist(2026, 11, 6) },
      ist(2026, 11, 6, 10, 0),
    );
    expect(doses).toHaveLength(2);
    expect(doses[0]).toMatchObject({ time: "09:00", isPast: true });
    expect(doses[1]).toMatchObject({ time: "21:00", isPast: false });
  });

  it("keeps slot arithmetic across a day boundary", () => {
    const start = localDayStartMs(ist(2026, 11, 6, 23, 30), IST);
    expect(start + DAY).toBe(localDayStartMs(ist(2026, 11, 7, 0, 30), IST));
  });
});
