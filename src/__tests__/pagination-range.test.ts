import { describe, it, expect } from "vitest";
import { getPaginationRange } from "@/lib/pagination";

describe("getPaginationRange", () => {
  it("returns a single page when there is only one page", () => {
    expect(getPaginationRange(1, 1)).toEqual([1]);
  });

  it("returns empty for zero or invalid totals", () => {
    expect(getPaginationRange(1, 0)).toEqual([]);
    expect(getPaginationRange(1, Number.NaN)).toEqual([]);
  });

  it("shows every page for short ranges", () => {
    expect(getPaginationRange(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("shows the start window with a trailing ellipsis on page 1", () => {
    expect(getPaginationRange(1, 10)).toEqual([1, 2, 3, 4, 5, "ellipsis", 10]);
    expect(getPaginationRange(2, 10)).toEqual([1, 2, 3, 4, 5, "ellipsis", 10]);
  });

  it("shows middle pages with ellipses on both sides", () => {
    expect(getPaginationRange(10, 20)).toEqual([
      1, "ellipsis", 8, 9, 10, 11, 12, "ellipsis", 20,
    ]);
  });

  it("shows the end window with a leading ellipsis", () => {
    expect(getPaginationRange(10, 10)).toEqual([1, "ellipsis", 6, 7, 8, 9, 10]);
    expect(getPaginationRange(8, 10)).toEqual([1, "ellipsis", 6, 7, 8, 9, 10]);
  });

  it("clamps out-of-range current pages into the valid range", () => {
    expect(getPaginationRange(0, 10)).toEqual([1, 2, 3, 4, 5, "ellipsis", 10]);
    expect(getPaginationRange(99, 10)).toEqual([1, "ellipsis", 6, 7, 8, 9, 10]);
  });

  it("keeps adjacent pages contiguous (no needless ellipsis)", () => {
    const range = getPaginationRange(4, 10);
    expect(range).toEqual([1, 2, 3, 4, 5, 6, "ellipsis", 10]);
  });
});
