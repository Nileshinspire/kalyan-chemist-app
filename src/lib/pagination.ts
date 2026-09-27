export type PaginationItem = number | "ellipsis";

/**
 * Result sets up to this many matching products are shown in full with NO
 * pagination; anything larger is split into pages.
 */
export const PAGINATION_THRESHOLD = 25;

export type ProductPagePlan = {
  /** True once the result set exceeds the threshold and must be paged. */
  paginationEnabled: boolean;
  /** Effective 1-based page (clamped into range once the total is known). */
  currentPage: number;
  totalPages: number;
  /** Slice to request from the backend. */
  offset: number;
  limit: number;
};

/**
 * Decide which slice of the product listing to fetch.
 *
 * - total <= 25 (or 0): show every matching product, no pagination.
 * - total > 25: paginate with `pageSize` per page, clamping the requested
 *   page into the valid range.
 * - total === null (count still loading): trust the requested page only if a
 *   page was actually asked for (?page>1 deep link), otherwise optimistically
 *   fetch the full under-threshold set so small catalogues never flash a
 *   partially-filled page.
 */
export function resolveProductPage(options: {
  total: number | null;
  pageSize: number;
  requestedPage: number;
  threshold?: number;
}): ProductPagePlan {
  const { total, pageSize, requestedPage, threshold = PAGINATION_THRESHOLD } = options;
  const totalPages = Math.max(1, Math.ceil((total ?? 0) / pageSize));
  const paginationEnabled = total !== null && total > threshold;
  const currentPage =
    total === null
      ? Math.max(1, requestedPage)
      : paginationEnabled
        ? Math.min(Math.max(1, requestedPage), totalPages)
        : 1;
  const paginating = paginationEnabled || (total === null && requestedPage > 1);
  return {
    paginationEnabled,
    currentPage,
    totalPages,
    offset: paginating ? Math.max(0, (currentPage - 1) * pageSize) : 0,
    limit: paginating ? pageSize : threshold,
  };
}

/**
 * Build the compact numbered range shown by the product-list pagination, e.g.
 * `1 2 3 4 5 … 10`, `1 … 8 9 [10] 11 12 … 20`.
 *
 * - Short ranges render every page number (no ellipsis).
 * - Near the start the window hugs the first pages: `1 2 3 4 5 … 20`.
 * - Near the end it hugs the last pages: `1 … 16 17 18 19 20`.
 * - In the middle it shows `current ± 2` between elided edges.
 *
 * @param current 1-based current page (clamped into range)
 * @param total total number of pages (>= 1)
 */
export function getPaginationRange(current: number, total: number): PaginationItem[] {
  if (!Number.isFinite(total) || total < 1) return [];
  if (total === 1) return [1];

  const cur = Math.min(Math.max(1, Math.floor(current) || 1), Math.floor(total));
  const last = Math.floor(total);

  // Small ranges fit on screen — show every page.
  if (last <= 7) {
    return Array.from({ length: last }, (_, i) => i + 1);
  }

  const pages = new Set<number>([1, last]);

  if (cur <= 3) {
    // Near the start: 1 2 3 4 5 … last
    for (let p = 2; p <= 5; p++) pages.add(p);
  } else if (cur >= last - 2) {
    // Near the end: 1 … last-4 last-3 last-2 last-1 last
    for (let p = last - 4; p <= last - 1; p++) pages.add(p);
  } else {
    // Middle: 1 … cur-2 cur-1 cur cur+1 cur+2 … last
    for (let p = cur - 2; p <= cur + 2; p++) pages.add(p);
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const items: PaginationItem[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) items.push("ellipsis");
    items.push(p);
    prev = p;
  }
  return items;
}
