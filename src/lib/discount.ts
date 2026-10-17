/**
 * The one discount engine for the whole app — pure, shared by the backend
 * (src/convex/discountEngine.ts) and the storefront UI.
 *
 * Model
 * ─────
 *   `products.price`          — the product's base price (MRP). Never derived
 *                               from anything else, never reduced by the engine.
 *   `products.discountPrice`  — the final selling price. Written by exactly two
 *                               sources: the engine ("rule"), or an explicit
 *                               admin price ("manual"). The engine NEVER
 *                               overwrites a manual price, so repeated rule
 *                               edits cannot erode one-off product discounts.
 *
 * Rule precedence (first match wins; never combined → never double-discounted):
 *   1. `excluded`   — admin explicitly excluded the product from promotions.
 *   2. `override`   — a product-specific rule in the Discount Manager config.
 *   3. `manual-price` — a selling price the admin set themselves (saved as
 *                     "manual", or any legacy price). It always beats the
 *                     windowed rules, so changing the default can never
 *                     silently alter an independent product discount.
 *   4. `category`   — the product's category has an active category rule
 *                     (only while the promotion window is open).
 *   5. `auto`       — the global default percent (only while the window is
 *                     open). This is what prices brand-new eligible products
 *                     and anything else that has no selling price of its own.
 *   6. otherwise    — no discount (sells at base price).
 *   Rows the engine itself priced ("rule") never fall back to 3: their price
 *   belongs to rules 4/5 and is cleaned up when those rules go away.
 *
 * Rounding policy (single place, so badge and price can never disagree):
 *   effective price = products.price × (100 − percent) / 100, rounded to the
 *   nearest paisa (2 decimals). The displayed badge percentage is the actual
 *   price ratio rounded to the nearest whole point (productDiscountPercent),
 *   which equals the configured percent for every real INR price.
 */

/** Lowest configurable percent. 0 would mean "no rule", so it starts at 1. */
export const MIN_DISCOUNT_PERCENT = 1;
/** 100% off would make products free; percentages stop at 99. */
export const MAX_DISCOUNT_PERCENT = 99;

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

/**
 * The percentage a product is actually discounted (0 when it is not
 * discounted). A stored selling price only counts when it is present,
 * non-zero and strictly below the base price.
 */
export function productDiscountPercent(
  price: number,
  discountPrice?: number | null,
): number {
  if (!(price > 0) || !Number.isFinite(price)) return 0;
  if (!discountPrice || !Number.isFinite(discountPrice) || discountPrice >= price || discountPrice <= 0) {
    return 0;
  }
  return Math.round(((price - discountPrice) / price) * 100);
}

/** Kept for compatibility with older callers (same rule as above). */
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

/**
 * The engine's one price calculation: base price with a rule percent applied,
 * rounded to the nearest paisa. Guarded so a percent of 99 on a paisa price
 * can never yield ₹0 or below.
 */
export function discountedPriceFor(price: number, percent: number): number {
  if (!(price > 0) || !Number.isFinite(price)) {
    throw new Error("Product must have a valid base price.");
  }
  const p = normalizeDiscountPercent(percent);
  // Two decimals (paise) — avoids floating-point drift and keeps the ratio
  // exactly the configured percent for typical INR prices.
  const exactPrice = (price * (100 - p)) / 100;
  const rounded = Math.round(exactPrice * 100) / 100;
  if (!Number.isFinite(rounded) || rounded <= 0) {
    throw new Error("Calculated discount price is invalid.");
  }
  return Math.min(rounded, price);
}

/** The unit price a customer actually pays for a product row. */
export function effectiveUnitPrice(
  price: number,
  discountPrice?: number | null,
): number {
  if (!(price > 0) || !Number.isFinite(price)) return 0;
  if (discountPrice && Number.isFinite(discountPrice) && discountPrice > 0 && discountPrice < price) {
    return discountPrice;
  }
  return price;
}

// ─── Rule engine (pure) ──────────────────────────────────────────────────────

/** A product row as far as the rule engine is concerned. */
export type DiscountRow = {
  _id: string;
  price: number;
  discountPrice?: number | null;
  categoryId: string;
  isActive: boolean;
  /** Provenance of the stored selling price: engine-managed or admin price. */
  discountSource?: "rule" | "manual" | null;
};

/** Admin config exactly as stored in the `discountHighlights` table row. */
export type EngineConfigInput = {
  /** Master switch for rule-driven pricing. Missing row = engine off. */
  isActive?: boolean | null;
  /** Global default percent. 0/null = no automatic default. */
  discountPercent?: number | null;
  /** Optional promotion start time (epoch ms). */
  startsAt?: number | null;
  /** Optional promotion end time (epoch ms). */
  endsAt?: number | null;
  excludedProductIds?: readonly string[];
  /** Explicit per-product rule (highest active precedence). */
  productOverrides?: readonly { productId: string; discountPercent: number }[];
  /** Category-scoped rules (below override, above global default). */
  categoryRules?: readonly { categoryId: string; discountPercent: number }[];
  /** Manual homepage inclusions (pinned to the front of the section). */
  manualProductIds?: readonly string[];
};

/** Why/how the engine priced a product. */
export type DiscountStatus =
  | "excluded"      // admin excluded it from promotions
  | "override"      // product-specific rule
  | "category"      // category rule
  | "auto"          // global default rule
  | "manual-price"  // admin-set selling price (explicit, preserved)
  | "ineligible";   // inactive product / no rule / not yet MSP

export type DiscountResolution = {
  status: DiscountStatus;
  /** The rule percent, or the stored price's computed percent for manual rows. */
  percent: number;
  /** What the customer pays. */
  effectivePrice: number;
  /** Short label for the admin surfaces. */
  label: string;
};

/**
 * True when the admin has explicitly turned the promotion on and, if a window
 * is set, while it is open. A row without the flag (or a legacy row with
 * percent saved but no save through the new manager) counts as OFF — the engine
 * never launches a storefront-wide sale just because a legacy percent exists.
 */
export function isEngineWindowOpen(
  engine: EngineConfigInput,
  now: number,
): boolean {
  if (engine.isActive !== true) return false;
  if (typeof engine.startsAt === "number" && now < engine.startsAt) return false;
  if (typeof engine.endsAt === "number" && now > engine.endsAt) return false;
  return true;
}

/**
 * Resolve one product against the engine. Deterministic and side-effect free:
 * the same row always resolves to the same status/percent/price.
 */
export function resolveProductDiscount(
  product: DiscountRow,
  engine: EngineConfigInput,
  now: number,
): DiscountResolution {
  const base = product.price;
  if (!product.isActive || !(base > 0) || !Number.isFinite(base)) {
    return { status: "ineligible", percent: 0, effectivePrice: base, label: "Inactive or invalid price" };
  }

  if ((engine.excludedProductIds ?? []).includes(product._id)) {
    // Excluded from promotions: explicit admin price is honoured as-is.
    const stored = product.discountPrice ?? null;
    const pct = productDiscountPercent(base, stored);
    return {
      status: "excluded",
      percent: pct,
      effectivePrice: pct > 0 ? (stored as number) : base,
      label: "Manually excluded from promotions",
    };
  }

  const override = (engine.productOverrides ?? []).find(
    (o) => o.productId === product._id,
  );
  if (override) {
    const pct = normalizeDiscountPercent(override.discountPercent);
    return {
      status: "override",
      percent: pct,
      effectivePrice: discountedPriceFor(base, pct),
      label: `Product-specific override: ${pct}% off`,
    };
  }

  const windowOpen = isEngineWindowOpen(engine, now);

  // A selling price the admin saved explicitly ("manual") or one from a row
  // that predates the engine (no provenance) beats the windowed rules — the
  // default/category rules must never silently overwrite a product-specific
  // discount. Engine-owned rows ("rule") skip this branch: their price is
  // governed by the rules below and is cleaned up when those rules change.
  const storedPct =
    product.discountSource === "rule"
      ? 0
      : productDiscountPercent(base, product.discountPrice ?? null);
  if (storedPct > 0) {
    return {
      status: "manual-price",
      percent: storedPct,
      effectivePrice: product.discountPrice as number,
      label: "Explicit selling price (preserved)",
    };
  }

  const categoryRule = (engine.categoryRules ?? []).find(
    (c) => c.categoryId === product.categoryId,
  );
  if (windowOpen && categoryRule) {
    const pct = normalizeDiscountPercent(categoryRule.discountPercent);
    return {
      status: "category",
      percent: pct,
      effectivePrice: discountedPriceFor(base, pct),
      label: `Category promotion: ${pct}% off`,
    };
  }

  const globalPercent = engine.discountPercent ?? 0;
  if (windowOpen && Number.isInteger(globalPercent) && globalPercent >= MIN_DISCOUNT_PERCENT) {
    const pct = normalizeDiscountPercent(globalPercent);
    return {
      status: "auto",
      percent: pct,
      effectivePrice: discountedPriceFor(base, pct),
      label: `Default rule: ${pct}% off`,
    };
  }

  // No active rule governs this product and there is no explicit selling
  // price (the manual-price branch above already returned for those).
  return { status: "ineligible", percent: 0, effectivePrice: base, label: "No applicable discount" };
}

/** Shape of a product row as display pricing needs to read it. */
export type DisplayPriceRow = {
  _id: string;
  price: number;
  categoryId: string;
  isActive: boolean;
  discountPrice?: number | null | undefined;
  discountSource?: "rule" | "manual" | null | undefined;
};

/**
 * Read-path display pricing: the price fields every storefront surface serves
 * for a row, resolved from the rules RIGHT NOW instead of the stored snapshot.
 *
 * `products.discountPrice` is written only by the engine's write pass, so a
 * row can be listed by a rule before (or after) that pass touches it — for
 * example when a promotion window opens by itself, or a config row that predates
 * the current manager. Serving the resolved value means card badges, listing
 * filters/sorts, section membership and the checkout charge can never disagree:
 * they all read the same number the engine resolves.
 *
 * Pure and deterministic; a row whose stored price already matches is returned
 * untouched (object identity preserved, so subscriptions don't churn).
 */
export function applyDisplayPrices<T extends DisplayPriceRow>(
  rows: readonly T[],
  engine: EngineConfigInput,
  now: number,
): T[] {
  if (rows.length === 0) return rows as T[];
  return rows.map((row) => {
    const res = resolveProductDiscount(
      {
        _id: row._id,
        price: row.price,
        discountPrice: row.discountPrice ?? null,
        categoryId: row.categoryId,
        isActive: row.isActive,
        discountSource: row.discountSource ?? null,
      },
      engine,
      now,
    );
    // What the customer pays, only when it is actually a discount.
    const target =
      Number.isFinite(res.effectivePrice) && res.effectivePrice < row.price
        ? res.effectivePrice
        : undefined;
    const stored =
      typeof row.discountPrice === "number" &&
      Number.isFinite(row.discountPrice) &&
      row.discountPrice > 0 &&
      row.discountPrice < row.price
        ? row.discountPrice
        : undefined;
    if (target === stored) return row;
    return { ...row, discountPrice: target } as T;
  });
}

/**
 * The homepage discount listing. Deterministic; manual picks come first in the
 * admin's chosen order, everything else follows catalog recency.
 *
 * Membership: the section advertises "Minimum {percent}% Off", so a product
 * qualifies when it is active, not excluded, and its effective discount is at
 * least the configured percent — which automatically includes every product the
 * default/category/override rules discount, including ones created after the
 * rule was saved. Duplicate picks (manual ∪ automatic) collapse to one row, and
 * manual picks with too small a discount are reported instead of shown.
 */
export function selectHomePageDiscounts<T extends DiscountRow & { createdAt?: number }>(
  rows: T[],
  engine: EngineConfigInput,
  now: number,
): {
  percent: number;
  products: T[];
  autoCount: number;
  manualCount: number;
  /** Manual picks that no longer qualify, so they are not shown. */
  droppedManualIds: string[];
  /** Whether the rule window is open (for admin surfaces). */
  windowOpen: boolean;
} {
  const featuredPercent = Math.max(0, Math.floor(engine.discountPercent ?? 0));
  const excluded = new Set(engine.excludedProductIds ?? []);
  const manualPicks = [...(engine.manualProductIds ?? [])];

  const products: T[] = [];
  const taken = new Set<string>();
  let manualCount = 0;
  const droppedManualIds: string[] = [];

  // Manual picks first, newest-catalog order afterwards.
  for (const rawId of manualPicks) {
    const id = String(rawId);
    if (taken.has(id)) continue; // dedupe picks and picks ∪ automatic
    const row = rows.find((r) => r._id === id);
    if (!row || excluded.has(id)) {
      droppedManualIds.push(id);
      continue;
    }
    const res = resolveProductDiscount(row, engine, now);
    if (!row.isActive || res.percent < featuredPercent || !(featuredPercent > 0)) {
      droppedManualIds.push(id);
      continue;
    }
    taken.add(id);
    manualCount += 1;
    products.push(row);
  }

  if (featuredPercent > 0) {
    for (const row of rows) {
      const id = row._id;
      if (taken.has(id) || excluded.has(id)) continue;
      const res = resolveProductDiscount(row, engine, now);
      if (res.percent >= featuredPercent) {
        taken.add(id);
        products.push(row);
      }
    }
  }

  return {
    percent: featuredPercent,
    products,
    autoCount: products.length - manualCount,
    manualCount,
    droppedManualIds,
    windowOpen: isEngineWindowOpen(engine, now),
  };
}
