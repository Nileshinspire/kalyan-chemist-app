/**
 * The one discount calculation for the whole app.
 *
 * A product's discount is derived from its own price fields — never from a
 * label, a category or an admin-typed percentage. The product card, the
 * featured/best-deals queries and the homepage exact-discount section all read
 * this function, so the percentage a customer sees on a badge is by
 * construction the same number the section matches on. Rounding happens here
 * once, so matching can never contradict the displayed badge.
 *
 * A product has a discount only when `discountPrice` is present, non-zero and
 * strictly below `price` (exactly the rule the product card has always used).
 */
export function productDiscountPercent(
  price: number,
  discountPrice?: number | null,
): number {
  if (!(discountPrice && discountPrice < price) || !(price > 0)) return 0;
  return Math.round(((price - discountPrice) / price) * 100);
}

/** True when a product's real, calculated discount is exactly `percent`. */
export function isExactDiscountMatch(
  price: number,
  discountPrice: number | null | undefined,
  percent: number,
  isActive: boolean = true,
): boolean {
  if (!isActive) return false;
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) return false;
  return productDiscountPercent(price, discountPrice) === percent;
}

/** The range an admin may configure. */
export const MIN_DISCOUNT_PERCENT = 1;
export const MAX_DISCOUNT_PERCENT = 100;

/** Reject anything that is not a whole percentage inside the valid range. */
export function normalizeDiscountPercent(value: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error("Enter a whole number percentage, for example 25 or 37.");
  }
  if (value < MIN_DISCOUNT_PERCENT || value > MAX_DISCOUNT_PERCENT) {
    throw new Error(
      `Enter a percentage between ${MIN_DISCOUNT_PERCENT} and ${MAX_DISCOUNT_PERCENT}.`,
    );
  }
  return value;
}

/** A product row as far as the discount selection is concerned. */
export type DiscountRow = {
  _id: string;
  price: number;
  discountPrice?: number | null;
  isActive: boolean;
};

/**
 * The exact list the homepage section renders.
 *
 * `rows` is the whole product catalogue. A row qualifies only when its own
 * calculated discount equals `percent` exactly, so a product whose price later
 * changes drops out on its own. A hand-picked product is subject to the same
 * rule, which is why a manual pick that no longer matches is reported back
 * instead of being rendered.
 *
 * Each product appears at most once: the admin's picks come first, in the order
 * they were chosen, followed by the products that matched on their own.
 */
export function selectDiscountProducts<T extends DiscountRow>(
  rows: T[],
  percent: number,
  manualProductIds: readonly string[] = [],
): {
  products: T[];
  /** Products that matched on their own, excluding the manual picks. */
  autoCount: number;
  /** Admin picks that still match the configured percentage right now. */
  manualCount: number;
  /** Admin picks that no longer match, so they are not shown. */
  droppedManualIds: string[];
} {
  const matches = new Map<string, T>();
  for (const row of rows) {
    if (!isExactDiscountMatch(row.price, row.discountPrice, percent, row.isActive)) {
      continue;
    }
    matches.set(String(row._id), row);
  }

  const products: T[] = [];
  const taken = new Set<string>();
  let manualCount = 0;
  const droppedManualIds: string[] = [];

  for (const rawId of manualProductIds) {
    const id = String(rawId);
    if (taken.has(id)) continue; // duplicate pick — the product is shown once
    const row = matches.get(id);
    if (!row) {
      droppedManualIds.push(id);
      continue;
    }
    taken.add(id);
    manualCount += 1;
    products.push(row);
  }

  for (const [id, row] of matches) {
    if (taken.has(id)) continue;
    products.push(row);
  }

  return {
    products,
    autoCount: products.length - manualCount,
    manualCount,
    droppedManualIds,
  };
}
