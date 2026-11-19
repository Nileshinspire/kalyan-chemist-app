import { describe, expect, it } from "vitest";
import {
  endDateBeforeStart,
  endOfDayFromInput,
  startOfDayFromInput,
  toDateInputValue,
} from "@/lib/couponDates";

describe("coupon date inputs", () => {
  it("round-trips the selected day without a timezone shift", () => {
    for (const day of ["2026-01-01", "2026-11-19", "2026-12-31", "2027-03-29"]) {
      expect(toDateInputValue(startOfDayFromInput(day))).toBe(day);
      expect(toDateInputValue(endOfDayFromInput(day))).toBe(day);
    }
  });

  it("stores start and end on the same calendar day", () => {
    const start = new Date(startOfDayFromInput("2026-11-19"));
    const end = new Date(endOfDayFromInput("2026-11-19"));
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(10);
    expect(start.getDate()).toBe(19);
    expect(end.getDate()).toBe(19);
    expect(startOfDayFromInput("2026-11-19")).toBeLessThan(
      endOfDayFromInput("2026-11-19")
    );
  });

  it("leaves the time input empty when no date is set", () => {
    expect(toDateInputValue(null)).toBe("");
    expect(toDateInputValue(undefined)).toBe("");
    expect(toDateInputValue(0)).toBe("");
    expect(startOfDayFromInput("")).toBe(0);
    expect(endOfDayFromInput("not-a-date")).toBe(0);
  });

  it("flags an end date earlier than the start date", () => {
    const start = startOfDayFromInput("2026-11-19");
    const earlierEnd = endOfDayFromInput("2026-11-18");
    const sameDayEnd = endOfDayFromInput("2026-11-19");
    const laterEnd = endOfDayFromInput("2026-11-20");

    expect(endDateBeforeStart(start, earlierEnd)).toBe(true);
    expect(endDateBeforeStart(start, sameDayEnd)).toBe(false);
    expect(endDateBeforeStart(start, laterEnd)).toBe(false);
    expect(endDateBeforeStart(null, earlierEnd)).toBe(false);
  });
});
