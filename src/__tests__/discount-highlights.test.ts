import { describe, expect, it } from "vitest";
import {
  isExactDiscountMatch,
  normalizeDiscountPercent,
  productDiscountPercent,
  discountedPriceFor,
  resolveProductDiscount,
  selectHomePageDiscounts,
  applyDisplayPrices,
  type DiscountRow,
  type EngineConfigInput,
} from "@/lib/discount";

/**
 * The discount engine's guarantee: whatever a customer sees (card badge,
 * homepage section, cart line, checkout total) comes from ONE resolution.
 * These tests pin the badge math, the percent validation, the rule precedence
 * (never combined → never double-discounted), the rounding policy, and the
 * homepage membership rule "Minimum {percent}% Off".
 */
const NOW = 1_700_000_000_000;

function row(overrides: Partial<DiscountRow> & { _id: string }): DiscountRow {
  return {
    price: 400,
    discountPrice: null,
    categoryId: "cat-1",
    isActive: true,
    ...overrides,
  } as DiscountRow;
}

function engine(overrides: Partial<EngineConfigInput> = {}): EngineConfigInput {
  return {
    isActive: true,
    discountPercent: 25,
    manualProductIds: [],
    excludedProductIds: [],
    productOverrides: [],
    categoryRules: [],
    ...overrides,
  };
}

describe("productDiscountPercent", () => {
  it("is 0 for a product with no discount price", () => {
    expect(productDiscountPercent(150)).toBe(0);
    expect(productDiscountPercent(150, undefined)).toBe(0);
    expect(productDiscountPercent(150, null)).toBe(0);
  });

  it("is 0 when the selling price is not actually lower than the MRP", () => {
    expect(productDiscountPercent(150, 150)).toBe(0);
    expect(productDiscountPercent(150, 200)).toBe(0);
  });

  it("computes an exact discount", () => {
    expect(productDiscountPercent(300, 150)).toBe(50);
    expect(productDiscountPercent(100, 75)).toBe(25);
    expect(productDiscountPercent(100, 63)).toBe(37);
  });

  it("rounds the same way the card badge does", () => {
    expect(productDiscountPercent(100, 74)).toBe(26);
    expect(productDiscountPercent(1000, 666)).toBe(33);
    expect(productDiscountPercent(300, 200)).toBe(33);
    expect(productDiscountPercent(1000, 754)).toBe(25);
  });

  it("never divides by a zero or negative price", () => {
    expect(productDiscountPercent(0, 0)).toBe(0);
    expect(productDiscountPercent(-10, 5)).toBe(0);
  });
});

describe("isExactDiscountMatch", () => {
  const product = { price: 300, discountPrice: 225 }; // exactly 25% off

  it("matches only the exact configured percentage", () => {
    expect(isExactDiscountMatch(product.price, product.discountPrice, 25)).toBe(true);
    for (const other of [20, 24, 26, 30, 37, 50]) {
      expect(isExactDiscountMatch(product.price, product.discountPrice, other)).toBe(false);
    }
  });

  it("rejects a product with no discount, and an inactive product", () => {
    expect(isExactDiscountMatch(100, undefined, 25)).toBe(false);
    expect(isExactDiscountMatch(100, 75, 25, false)).toBe(false);
  });

  it("rejects a percentage that could never be displayed", () => {
    expect(isExactDiscountMatch(100, 75, 0)).toBe(false);
    expect(isExactDiscountMatch(100, 75, 25.5)).toBe(false);
    expect(isExactDiscountMatch(100, 75, 101)).toBe(false);
  });
});

describe("normalizeDiscountPercent", () => {
  it("accepts any whole percentage in range (10, 20, 35, 42 …)", () => {
    for (const value of [1, 7, 10, 20, 25, 35, 42, 63, 99]) {
      expect(normalizeDiscountPercent(value)).toBe(value);
    }
  });

  it("refuses fractional, zero, 100 and out-of-range values", () => {
    expect(() => normalizeDiscountPercent(25.5)).toThrow(/whole number/i);
    expect(() => normalizeDiscountPercent(0)).toThrow(/between 1 and 99/i);
    expect(() => normalizeDiscountPercent(101)).toThrow(/between 1 and 99/i);
    expect(() => normalizeDiscountPercent(100)).toThrow(/between 1 and 99/i);
    expect(() => normalizeDiscountPercent(Number.NaN)).toThrow(/whole number/i);
  });
});

describe("discountedPriceFor — the single rounding policy", () => {
  it("rounds to the nearest paisa (2 decimals), never to 0 or above MRP", () => {
    expect(discountedPriceFor(99, 20)).toBe(79.2);
    expect(discountedPriceFor(59, 20)).toBe(47.2);
    expect(discountedPriceFor(35, 42)).toBe(20.3);
    expect(discountedPriceFor(9, 25)).toBe(6.75);
  });

  it("keeps the displayed badge equal to the configured percent", () => {
    for (const price of [59, 99, 149, 350, 1250]) {
      for (const percent of [10, 20, 25, 35, 42, 50, 75]) {
        const effective = discountedPriceFor(price, percent);
        expect(productDiscountPercent(price, effective)).toBe(percent);
      }
    }
  });

  it("refuses invalid input", () => {
    expect(() => discountedPriceFor(0, 20)).toThrow();
    expect(() => discountedPriceFor(-5, 20)).toThrow();
    expect(() => discountedPriceFor(100, 100)).toThrow(/between 1 and 99/i);
  });
});

describe("resolveProductDiscount — deterministic precedence", () => {
  it("never discounts a product that is merely active — being active is not eligibility", () => {
    const r = resolveProductDiscount(row({ _id: "new", price: 149 }), engine({ discountPercent: 20 }), NOW);
    expect(r.status).toBe("ineligible");
    expect(r.percent).toBe(0);
    expect(r.effectivePrice).toBe(149); // original price untouched
  });

  it("prices a product explicitly selected for the configured percent", () => {
    const r = resolveProductDiscount(
      row({ _id: "a", price: 149 }),
      engine({ discountPercent: 20, manualProductIds: ["a"] }),
      NOW,
    );
    expect(r.status).toBe("auto");
    expect(r.percent).toBe(20);
    expect(r.effectivePrice).toBe(119.2); // 149 × 0.80, paisa-rounded
  });

  it("exclusion beats even an explicit selection", () => {
    const r = resolveProductDiscount(
      row({ _id: "x", price: 100 }),
      engine({ discountPercent: 20, manualProductIds: ["x"], excludedProductIds: ["x"] }),
      NOW,
    );
    expect(r.status).toBe("excluded");
    expect(r.percent).toBe(0);
    expect(r.effectivePrice).toBe(100);
  });

  it("auto-eligibility covers only products created after it was switched on, OFF by default", () => {
    const existingProduct = row({ _id: "old", price: 100, createdAt: NOW - 10_000 });
    const laterProduct = row({ _id: "fresh", price: 100, createdAt: NOW + 5_000 });
    const off = engine({ discountPercent: 20 }); // no autoEligibleFrom ⇒ OFF
    expect(resolveProductDiscount(laterProduct, off, NOW).status).toBe("ineligible");

    const on = engine({ discountPercent: 20, autoEligibleFrom: NOW });
    const auto = resolveProductDiscount(laterProduct, on, NOW);
    expect(auto.status).toBe("auto");
    expect(auto.effectivePrice).toBe(80);
    // Switching it on never enrols products that already existed.
    expect(resolveProductDiscount(existingProduct, on, NOW).status).toBe("ineligible");
    expect(resolveProductDiscount(existingProduct, on, NOW).effectivePrice).toBe(100);
  });

  it("never combines rules: override beats category, category beats default", () => {
    const base = row({ _id: "x", price: 200 });
    const engineWithAll = engine({
      discountPercent: 25,
      manualProductIds: ["x"], // the selection that makes “auto” apply at all
      categoryRules: [{ categoryId: "cat-1", discountPercent: 35 }],
      productOverrides: [{ productId: "x", discountPercent: 42 }],
    });
    expect(resolveProductDiscount(base, engineWithAll, NOW).status).toBe("override");
    expect(resolveProductDiscount(base, engineWithAll, NOW).percent).toBe(42);

    const noOverride = { ...engineWithAll, productOverrides: [] };
    expect(resolveProductDiscount(base, noOverride, NOW).status).toBe("category");
    expect(resolveProductDiscount(base, noOverride, NOW).percent).toBe(35);

    const noCategory = { ...noOverride, categoryRules: [] };
    expect(resolveProductDiscount(base, noCategory, NOW).status).toBe("auto");
    expect(resolveProductDiscount(base, noCategory, NOW).percent).toBe(25);
  });

  it("exclusion wins over every rule", () => {
    const r = resolveProductDiscount(
      row({ _id: "x", price: 200, discountPrice: 100 }), // 50% stored
      engine({ discountPercent: 25, excludedProductIds: ["x"] }),
      NOW,
    );
    // Excluded products keep their explicit admin price, but never gain rules.
    expect(r.status).toBe("excluded");
    expect(r.effectivePrice).toBe(100);
    expect(r.percent).toBe(50);
  });

  it("a stale engine-written price never survives an exclusion", () => {
    const r = resolveProductDiscount(
      row({ _id: "x", price: 200, discountPrice: 100, discountSource: "rule" }), // 64%-style global-era leftover
      engine({ discountPercent: 40, excludedProductIds: ["x"] }),
      NOW,
    );
    expect(r.status).toBe("excluded");
    expect(r.percent).toBe(0);
    expect(r.effectivePrice).toBe(200); // original MRP, not the stale discount
  });

  it("an inactive product is never discounted", () => {
    const r = resolveProductDiscount(row({ _id: "x", isActive: false }), engine(), NOW);
    expect(r.status).toBe("ineligible");
    expect(r.effectivePrice).toBe(400);
  });

  it("preserves an explicit selling price when no rule governs the product", () => {
    const r = resolveProductDiscount(
      row({ _id: "x", price: 200, discountPrice: 150, discountSource: "manual" }),
      engine({ isActive: false, discountPercent: 25 }),
      NOW,
    );
    expect(r.status).toBe("manual-price");
    expect(r.effectivePrice).toBe(150);
    expect(r.percent).toBe(25);
  });

  it("stops rule pricing when the promotion window closes, but keeps overrides", () => {
    const engineClosed = engine({
      isActive: false,
      manualProductIds: ["x"],
      categoryRules: [{ categoryId: "cat-1", discountPercent: 30 }],
      productOverrides: [{ productId: "y", discountPercent: 42 }],
    });
    const autoRow = row({ _id: "x", price: 100 });
    const overrideRow = row({ _id: "y", price: 100 });
    expect(resolveProductDiscount(autoRow, engineClosed, NOW).status).toBe("ineligible");
    const y = resolveProductDiscount(overrideRow, engineClosed, NOW);
    expect(y.status).toBe("override");
    expect(y.effectivePrice).toBe(58);
  });

  it("honours start/end dates", () => {
    const engineWindow = engine({ startsAt: NOW + 1000, manualProductIds: ["x"] });
    const r = resolveProductDiscount(row({ _id: "x", price: 100 }), engineWindow, NOW);
    expect(r.status).toBe("ineligible"); // window not open yet
    expect(resolveProductDiscount(row({ _id: "x", price: 100 }), engineWindow, NOW + 2000).status).toBe("auto");

    const engineEnded = engine({ endsAt: NOW - 1000, manualProductIds: ["x"] });
    expect(resolveProductDiscount(row({ _id: "x", price: 100 }), engineEnded, NOW).status).toBe("ineligible");
  });

  it("resolves the admin-set selling price when the engine has no percent saved yet", () => {
    const r = resolveProductDiscount(
      row({ _id: "x", price: 300, discountPrice: 225 }),
      { isActive: false, discountPercent: 0 }, // no config saved
      NOW,
    );
    expect(r.status).toBe("manual-price");
    expect(r.percent).toBe(25);
  });
});

describe("selectHomePageDiscounts — the storefront section", () => {
  const rows: DiscountRow[] = [
    row({ _id: "a", price: 400, discountPrice: 300 }), // 25%
    row({ _id: "b", price: 100, discountPrice: 74 }), // 26%
    row({ _id: "c", price: 100, discountPrice: 75 }), // 25%
    row({ _id: "d", price: 300, discountPrice: 150 }), // 50%
    row({ _id: "e", price: 1000, discountPrice: 750 }), // 25%
    row({ _id: "g", price: 100, discountPrice: 75, isActive: false }), // inactive
    row({ _id: "h", price: 100 }), // no discount
  ];

  it("lists only the products the rule is assigned to — never others by percentage", () => {
    const cfg = engine({ discountPercent: 25, manualProductIds: ["d"] });
    const { products, autoCount, manualCount } = selectHomePageDiscounts(rows, cfg, NOW);
    // "d" is selected and shows its ACTUAL 50%. "a", "b", "c" and "e" carry
    // their own 25–50% discounts but were never selected — a percentage
    // threshold would wrongly pull them in; they must stay out.
    expect(products.map((p) => p._id)).toEqual(["d"]);
    expect(manualCount).toBe(1);
    expect(autoCount).toBe(0);
    // "h" (no selling price of its own) gets NO discount: eligibility is the
    // selection, not "active product, rule configured".
    const h = resolveProductDiscount(rows[6]!, cfg, NOW);
    expect(h.status).toBe("ineligible");
    expect(h.effectivePrice).toBe(100);
  });

  it("keeps explicit stored prices ahead of the default rule", () => {
    // "b" is at 26% off; the default rule says 25%. The stored, admin-set
    // selling price wins — the rule must never silently rewrite it.
    const res = resolveProductDiscount(rows[1]!, engine({ discountPercent: 25 }), NOW);
    expect(res.status).toBe("manual-price");
    expect(res.percent).toBe(26);
    expect(res.effectivePrice).toBe(74);
  });

  it("changing the configured percent updates only products assigned to the rule", () => {
    const at42 = engine({ discountPercent: 42, manualProductIds: ["h"] });
    // The assigned product follows the configured percent …
    const h = resolveProductDiscount(rows[6]!, at42, NOW);
    expect(h.status).toBe("auto");
    expect(h.effectivePrice).toBe(58); // 100 × 0.58

    // … while everything else keeps the price it already had.
    expect(resolveProductDiscount(rows[3]!, at42, NOW)).toMatchObject({
      status: "manual-price",
      effectivePrice: 150,
    }); // own 50%
    expect(resolveProductDiscount(rows[0]!, at42, NOW).effectivePrice).toBe(300); // own 25%

    const at50 = engine({ discountPercent: 50, manualProductIds: ["h"] });
    expect(resolveProductDiscount(rows[6]!, at50, NOW).effectivePrice).toBe(50);
    expect(resolveProductDiscount(rows[3]!, at50, NOW).effectivePrice).toBe(150);

    // Section membership follows the selection in both cases.
    expect(selectHomePageDiscounts(rows, at42, NOW).products.map((p) => p._id)).toEqual(["h"]);
    expect(selectHomePageDiscounts(rows, at50, NOW).products.map((p) => p._id)).toEqual(["h"]);
  });

  it("keeps the admin's selection order and never duplicates a row", () => {
    const { products, autoCount, manualCount } = selectHomePageDiscounts(
      rows,
      engine({ discountPercent: 25, manualProductIds: ["e", "c", "e"] }),
      NOW,
    );
    // Selected rows are listed first in the chosen order, each exactly once;
    // nothing else is assigned to the rule, so the auto pass adds no rows.
    expect(products.map((p) => p._id)).toEqual(["e", "c"]);
    expect(manualCount).toBe(2);
    expect(autoCount).toBe(0);
  });

  it("reports selected rows that cannot be shown instead of listing them", () => {
    const { products, droppedManualIds, manualCount } = selectHomePageDiscounts(
      rows,
      // "g" is inactive and "missing" no longer exists in the catalog.
      engine({ discountPercent: 42, manualProductIds: ["h", "g", "missing"] }),
      NOW,
    );
    expect(products.map((p) => p._id)).toEqual(["h"]); // h is assigned → 42%
    expect(droppedManualIds.sort()).toEqual(["g", "missing"]);
    expect(manualCount).toBe(1);
  });

  it("keeps a selected product listed at its ACTUAL discount, even below the headline percent", () => {
    const repriced = rows.map((r) =>
      r._id === "a" ? { ...r, discountPrice: 380, discountSource: "manual" as const } : r,
    ); // its own explicit 5% price
    const cfg = engine({ discountPercent: 25, manualProductIds: ["a"] });
    const { products, droppedManualIds } = selectHomePageDiscounts(repriced, cfg, NOW);
    // Membership follows the selection, not a minimum threshold — and the card
    // must show the real 5%, never an assumed 25%.
    expect(products.map((p) => p._id)).toContain("a");
    expect(droppedManualIds).toEqual([]);
    const listedA = products.find((p) => p._id === "a")!;
    const [served] = applyDisplayPrices([listedA], cfg, NOW);
    expect(productDiscountPercent(served!.price, served!.discountPrice)).toBe(5);
  });

  it("lists a duplicated manual pick only once", () => {
    const { products, manualCount } = selectHomePageDiscounts(
      rows,
      engine({ discountPercent: 25, manualProductIds: ["a", "a"] }),
      NOW,
    );
    expect(products.filter((p) => p._id === "a")).toHaveLength(1);
    expect(manualCount).toBe(1);
  });

  it("never lists excluded products even when selected, and reports the pick", () => {
    const { products, droppedManualIds } = selectHomePageDiscounts(
      rows,
      engine({ discountPercent: 25, manualProductIds: ["d", "g"], excludedProductIds: ["d"] }),
      NOW,
    );
    // "d" is excluded (exclusion beats everything) and "g" is inactive —
    // both are reported instead of shown.
    expect(products.map((p) => p._id)).toEqual([]);
    expect(droppedManualIds.sort()).toEqual(["d", "g"]);
  });

  it("adds a newly created product only when auto-eligibility is explicitly on", () => {
    const late = row({ _id: "new", price: 149, createdAt: NOW + 5_000 });
    const fresh = [...rows, late];
    const selection = ["h"]; // pretend the admin selected "h"

    // OFF (the default): nothing new becomes eligible, anywhere.
    const off = engine({ discountPercent: 20, manualProductIds: selection });
    expect(resolveProductDiscount(late, off, NOW).status).toBe("ineligible");
    expect(selectHomePageDiscounts(fresh, off, NOW).products.map((p) => p._id)).toEqual(["h"]);

    // ON: products added from that moment are eligible and join the section;
    // older rows — including ones carrying their own discounts — stay out.
    const on = engine({ discountPercent: 20, manualProductIds: selection, autoEligibleFrom: NOW });
    const autoRow = resolveProductDiscount(late, on, NOW);
    expect(autoRow.status).toBe("auto");
    expect(autoRow.effectivePrice).toBe(119.2);
    expect(selectHomePageDiscounts(fresh, on, NOW).products.map((p) => p._id)).toEqual(["h", "new"]);
    // The pre-existing "a" keeps its own stored price and is not enrolled.
    expect(resolveProductDiscount(rows[0]!, on, NOW).status).toBe("manual-price");
  });

  it("returns nothing when no admin has configured a percent", () => {
    const { products } = selectHomePageDiscounts(rows, engine({ discountPercent: 0 }), NOW);
    expect(products).toEqual([]);
  });
});

describe("applyDisplayPrices — read-path pricing (what you see = what checkout charges)", () => {
  it("prices a row the rules govern but whose stored snapshot is empty", () => {
    const [priced] = applyDisplayPrices(
      [row({ _id: "fresh", price: 120 })], // no discountPrice at all
      engine({ discountPercent: 80, manualProductIds: ["fresh"] }),
      NOW,
    );
    expect(priced!.discountPrice).toBe(24); // 120 × 0.20
    expect(productDiscountPercent(120, priced!.discountPrice)).toBe(80);
  });

  it("returns a row whose stored price already matches untouched (identity)", () => {
    const stored = row({
      _id: "synced",
      price: 400,
      discountPrice: 300,
      discountSource: "rule",
    });
    const [out] = applyDisplayPrices([stored], engine({ discountPercent: 25, manualProductIds: ["synced"] }), NOW);
    expect(out).toBe(stored); // no rewrite → subscribers don't churn
  });

  it("never replaces an admin's manual selling price with a rule price", () => {
    const manual = row({
      _id: "manual",
      price: 400,
      discountPrice: 380, // deliberately 5% off
      discountSource: "manual",
    });
    const [out] = applyDisplayPrices([manual], engine({ discountPercent: 80, manualProductIds: ["manual"] }), NOW);
    expect(out!.discountPrice).toBe(380);
    expect(productDiscountPercent(400, out!.discountPrice)).toBe(5);
  });

  it("clears an engine-owned price once its promotion window has closed", () => {
    const stale = row({
      _id: "stale",
      price: 400,
      discountPrice: 300, // written when the 25% sale was live
      discountSource: "rule",
    });
    const [out] = applyDisplayPrices(
      [stale],
      engine({ discountPercent: 25, endsAt: NOW - 1 }), // window shut
      NOW,
    );
    expect(out!.discountPrice).toBeUndefined();
    expect(productDiscountPercent(400, out!.discountPrice)).toBe(0);
  });

  it("keeps a legacy stored price (no provenance) when the engine is off", () => {
    const legacy = row({ _id: "legacy", price: 400, discountPrice: 300 });
    const [out] = applyDisplayPrices(
      [legacy],
      engine({ isActive: false, discountPercent: 0 }),
      NOW,
    );
    expect(out).toBe(legacy);
    expect(productDiscountPercent(400, out!.discountPrice)).toBe(25);
  });

  it("serves every section-listed row with a real, correctly calculated discount", () => {
    const rows = [
      row({ _id: "a", price: 400 }), // fresh → rule-priced when selected
      row({ _id: "b", price: 100, discountPrice: 74 }), // own 26% — NOT selected
      row({ _id: "c", price: 300, discountPrice: 150, discountSource: "manual" }), // own 50%, selected
      row({ _id: "d", price: 300 }), // fresh → rule-priced when selected
    ];
    const cfg = engine({ discountPercent: 80, manualProductIds: ["c", "d"] });
    const { products, percent } = selectHomePageDiscounts(rows, cfg, NOW);
    // Selection order first; "b" is never assigned to the rule, so its own 26%
    // discount alone does NOT admit it to the section.
    expect(products.map((p) => p._id)).toEqual(["c", "d"]);
    expect(percent).toBe(80);

    const served = applyDisplayPrices(products, cfg, NOW);
    for (const p of served) {
      expect(p.discountPrice).toBeDefined();
      expect(p.discountPrice!).toBeGreaterThan(0);
      expect(p.discountPrice!).toBeLessThan(p.price);
      // The badge shows the ACTUAL resolved discount (c keeps its own 50%,
      // d runs at the 80% rule) — never an assumed uniform percent.
      expect(productDiscountPercent(p.price, p.discountPrice)).toBe(
        resolveProductDiscount(p, cfg, NOW).percent,
      );
    }
    // The unselected row is untouched — same object in, same object out.
    const [untouched] = applyDisplayPrices([rows[1]!], cfg, NOW);
    expect(untouched).toBe(rows[1]);
  });
});
