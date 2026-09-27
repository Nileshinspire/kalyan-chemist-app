import { describe, it, expect } from "vitest";
import { getPaginationRange, resolveProductPage, PAGINATION_THRESHOLD } from "@/lib/pagination";

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

describe("resolveProductPage (pagination threshold)", () => {
  const pageSize = 12;

  it("uses a threshold of 25 products", () => {
    expect(PAGINATION_THRESHOLD).toBe(25);
  });

  it("shows ALL products with no pagination when total <= 25", () => {
    for (const total of [0, 7, 24, 25]) {
      const plan = resolveProductPage({ total, pageSize, requestedPage: 1 });
      expect(plan.paginationEnabled).toBe(false);
      expect(plan.offset).toBe(0);
      expect(plan.limit).toBe(25);
    }
  });

  it("enables pagination when total is 26 or more", () => {
    const plan = resolveProductPage({ total: 26, pageSize, requestedPage: 1 });
    expect(plan.paginationEnabled).toBe(true);
    expect(plan.totalPages).toBe(3);
    expect(plan.offset).toBe(0);
    expect(plan.limit).toBe(12);
  });

  it("returns the requested page's slice when paginating", () => {
    const page2 = resolveProductPage({ total: 50, pageSize, requestedPage: 2 });
    expect(page2.offset).toBe(12);
    expect(page2.limit).toBe(12);
    expect(page2.currentPage).toBe(2);

    const page3 = resolveProductPage({ total: 100, pageSize, requestedPage: 3 });
    expect(page3.offset).toBe(24);
    expect(page3.currentPage).toBe(3);
    expect(page3.totalPages).toBe(9);
  });

  it("shows every product (no pagination) even with a stale page param when total <= 25", () => {
    const plan = resolveProductPage({ total: 24, pageSize, requestedPage: 4 });
    expect(plan.paginationEnabled).toBe(false);
    expect(plan.currentPage).toBe(1);
    expect(plan.offset).toBe(0);
    expect(plan.limit).toBe(25);
  });

  it("clamps an out-of-range requested page to the last page", () => {
    const plan = resolveProductPage({ total: 26, pageSize, requestedPage: 99 });
    expect(plan.currentPage).toBe(3);
    expect(plan.offset).toBe(24);
  });

  it("uses the responsive page size (8 on mobile) for page counts", () => {
    const plan = resolveProductPage({ total: 26, pageSize: 8, requestedPage: 1 });
    expect(plan.paginationEnabled).toBe(true);
    expect(plan.totalPages).toBe(4);
    expect(plan.limit).toBe(8);
  });

  it("while the count loads, fetches the full under-threshold set for page 1", () => {
    const plan = resolveProductPage({ total: null, pageSize, requestedPage: 1 });
    expect(plan.paginationEnabled).toBe(false);
    expect(plan.offset).toBe(0);
    expect(plan.limit).toBe(25);
  });

  it("while the count loads, trusts an explicit deep-linked page (?page=3)", () => {
    const plan = resolveProductPage({ total: null, pageSize, requestedPage: 3 });
    expect(plan.offset).toBe(24);
    expect(plan.limit).toBe(12);
    expect(plan.currentPage).toBe(3);
  });
});
