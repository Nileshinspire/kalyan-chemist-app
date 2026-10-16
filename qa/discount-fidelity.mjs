#!/usr/bin/env bun
/**
 * Per-scenario discount-fidelity audit.
 *
 * Reads the catalog and then re-evaluates every price/discount rule in the
 * discount engine against the exact numbers a customer could see. Nothing is
 * changed.
 *
 * Scenarios:
 *   S1  globally-rediscounted item
 *   S2  manually-included item not globally rediscounted
 *   S3  manually-included item ALSO globally rediscounted
 *   S4  normally-priced item that is manually included
 *   S5  item excluded from the section
 *   S6  item with a non-matching hardcoded price label
 *   S7  item with a price lower than discountPrice
 *   S8  item with a price higher than discountPrice (wrong direction)
 *   S9  item with no discountPrice at all
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(fileURLToPath(import.meta.url), "..");

function readDir(p) {
  return readdirSync(p).filter((f) => statSync(join(p, f)).isDirectory());
}

function readJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

// A product as the storefront can actually see it: whatever the API page
// returned, minus the internal machinery.
type StoreProduct = {
  _id: string;
  name: string;
  price: number;
  discountPrice: number | null;
  signature: string;
};

// ---------------------------------------------------------------------------
// Shared loader: the storefront rules
// ---------------------------------------------------------------------------

const SECTION_PERCENT = 25; // the admin-configured page percentage

/**
 * The one function the homepage, product cards, cart and checkout all read.
 * A product has a discount only when discountPrice is present, non-zero and
 * strictly below price. Anything else is "not discounted" - the badge count,
 * the section membership, the line total and the order total are all derived
 * from it. There is no second rule, no category label and no admin-typed
 * override; if the numbers do not say 25% off, the section says 0% off.
 */
export function productDiscountPercent(price: number, discountPrice: number | null): number {
  if (!(discountPrice && discountPrice < price) || !(price > 0)) return 0;
  return Math.round(((price - discountPrice) / price) * 100);
}

export function isExactDiscountMatch(price: number, discountPrice: number | null, percent: number, isActive: boolean = true): boolean {
  if (!isActive) return false;
  if (!Number.isInteger(percent) || percent < 1 || percent > 100) return false;
  return productDiscountPercent(price, discountPrice) === percent;
}

export function selectDiscountedProducts(products: StoreProduct[], percent: number): StoreProduct[] {
  return products.filter((p) => isExactDiscountMatch(p.price, p.discountPrice, percent, p.isActive));
}

// ---------------------------------------------------------------------------
// Rule engine, intentionally identical to the storefront's
// ---------------------------------------------------------------------------

const MIN_DISCOUNT = 1;
const MAX_DISCOUNT = 100;

export function normalizeDiscountPercent(value: number): number {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new Error("Enter a whole number percentage, for example 25 or 37.");
  }
  if (value < MIN_DISCOUNT || value > MAX_DISCOUNT) {
    throw new Error(`Enter a percentage between ${MIN_DISCOUNT} and ${MAX_DISCOUNT}.`);
  }
  return value;
}

export type Rule =
  | { kind: "global"; percent: number }
  | { kind: "product"; productId: string; percent: number }
  | { kind: "include"; productId: string }
  | { kind: "exclude"; productId: string };

export type PriceState =
  | { kind: "price"; basePrice: number; userPrice: number }
  | { kind: "missingBase" }
  | { kind: "missingUser" }
  | { kind: "neverDefined" }
  | { kind: "noPrice" };

export function normalizeRuleAction(rule: Rule): { kind: "global"; percent: number } | { kind: "product"; productId: string; percent: number } | { kind: "include"; productId: string } | { kind: "exclude"; productId: string } {
  switch (rule.kind) {
    case "global":
      return { kind: "global", percent: normalizeDiscountPercent(rule.percent) };
    case "product":
      return { kind: "product", productId: rule.productId, percent: normalizeDiscountPercent(rule.percent) };
    case "include":
      return { kind: "include", productId: rule.productId };
    case "exclude":
      return { kind: "exclude", productId: rule.productId };
  }
}

export type CorrectlyConfiguredRule = ReturnType<typeof normalizeRuleAction>;

export function applyRuleConfiguredAction(product: StoreProduct | null, rule: CorrectlyConfiguredRule, configMode: "normal" | "hardcoded" | "clockOut" | "backwards" | "missingBase" | "missingUser" | "neverDefined" | "noPrice"): {
  reason: string;
  manualActive: boolean;
  configuredPercent: number;
  userPrice: number;
  systemPrice: number | null;
  priceState: PriceState;
} {
  if (!product) {
    return { reason: "deleted product", manualActive: false, configuredPercent: 0, userPrice: 0, systemPrice: null, priceState: { kind: "noPrice" } };
  }

  switch (rule.kind) {
    case "global": {
      if (configMode === "missingBase") return { reason: "global rule on a product with no base price", manualActive: false, configuredPercent: rule.percent, userPrice: 0, systemPrice: null, priceState: { kind: "missingBase" } };
      if (configMode === "missingUser") return { reason: "global rule on a product with no displayed price", manualActive: false, configuredPercent: rule.percent, userPrice: 0, systemPrice: null, priceState: { kind: "missingUser" } };
      if (configMode === "neverDefined") return { reason: "global rule on a product whose price was never defined", manualActive: false, configuredPercent: rule.percent, userPrice: 0, systemPrice: null, priceState: { kind: "neverDefined" } };
      if (configMode === "noPrice") return { reason: "global rule on a product with no price", manualActive: false, configuredPercent: rule.percent, userPrice: 0, systemPrice: null, priceState: { kind: "noPrice" } };
      if (configMode === "clockOut") return { reason: "global rule on a product whose price runs backwards", manualActive: false, configuredPercent: rule.percent, userPrice: 0, systemPrice: null, priceState: { kind: "noPrice" } };
      return {
        reason: "global rule",
        manualActive: false,
        configuredPercent: rule.percent,
        userPrice: product.price,
        systemPrice: product.discountPrice,
        priceState: { kind: "price", basePrice: product.price, userPrice: product.price },
      };
    }
    case "product": {
      if (configMode === "missingBase") return { reason: "product rule on a product with no base price", manualActive: false, configuredPercent: rule.percent, userPrice: product.price, systemPrice: product.discountPrice, priceState: { kind: "missingBase" } };
      if (configMode === "missingUser") return { reason: "product rule on a product with no displayed price", manualActive: false, configuredPercent: rule.percent, userPrice: 0, systemPrice: product.discountPrice, priceState: { kind: "missingUser" } };
      if (configMode === "neverDefined") return { reason: "product rule on a product whose price was never defined", manualActive: false, configuredPercent: rule.percent, userPrice: product.price, systemPrice: product.discountPrice, priceState: { kind: "neverDefined" } };
      if (configMode === "noPrice") return { reason: "product rule on a product with no price", manualActive: false, configuredPercent: rule.percent, userPrice: product.price, systemPrice: product.discountPrice, priceState: { kind: "noPrice" } };
      if (configMode === "clockOut") return { reason: "product rule on a product whose price runs backwards", manualActive: false, configuredPercent: rule.percent, userPrice: product.price, systemPrice: product.discountPrice, priceState: { kind: "noPrice" } };
      return {
        reason: "product rule",
        manualActive: false,
        configuredPercent: rule.percent,
        userPrice: product.price,
        systemPrice: product.discountPrice,
        priceState: { kind: "price", basePrice: product.price, userPrice: product.price },
      };
    }
    case "include": {
      if (configMode === "missingBase") return { reason: "manual inclusion on a product with no base price", manualActive: true, configuredPercent: 0, userPrice: 0, systemPrice: null, priceState: { kind: "missingBase" } };
      if (configMode === "missingUser") return { reason: "manual inclusion on a product with no displayed price", manualActive: true, configuredPercent: 0, userPrice: 0, systemPrice: product.discountPrice, priceState: { kind: "missingUser" } };
      if (configMode === "neverDefined") return { reason: "manual inclusion on a product whose price was never defined", manualActive: true, configuredPercent: 0, userPrice: product.price, systemPrice: product.discountPrice, priceState: { kind: "neverDefined" } };
      if (configMode === "noPrice") return { reason: "manual inclusion on a product with no price", manualActive: true, configuredPercent: 0, userPrice: product.price, systemPrice: product.discountPrice, priceState: { kind: "noPrice" } };
      if (configMode === "clockOut") return { reason: "manual inclusion on a product whose price runs backwards", manualActive: true, configuredPercent: 0, userPrice: product.price, systemPrice: product.discountPrice, priceState: { kind: "noPrice" } };
      return { reason: "manual inclusion", manualActive: true, configuredPercent: 0, userPrice: product.price, systemPrice: product.discountPrice, priceState: { kind: "price", basePrice: product.price, userPrice: product.price } };
    }
    case "exclude": {
      return { reason: "manual exclusion", manualActive: false, configuredPercent: 0, userPrice: product ? product.price : 0, systemPrice: product ? product.discountPrice : null, priceState: { kind: "price", basePrice: product ? product.price : 0, userPrice: product ? product.price : 0 } };
    }
  }
}

// ---------------------------------------------------------------------------
// Harness entry points
// ---------------------------------------------------------------------------

export function scenarioTargetMenu(manual: boolean, exclude: boolean): "target_menu" | "manual_incl" | "manual_excl" {
  if (manual && exclude) return "manual_excl";
  if (manual) return "manual_incl";
  if (exclude) return "manual_excl";
  return "target_menu";
}

export function evalScenario(
  products: StoreProduct[],
  configMode: "normal" | "hardcoded" | "clockOut" | "backwards" | "missingBase" | "missingUser" | "neverDefined" | "noPrice",
): {
  scenario: string;
  targetMenu: "target_menu" | "manual_incl" | "manual_excl";
  menuEval: boolean;
  manualInclEval: boolean;
  manualExclEval: boolean;
  targetManualEval: boolean;
  targetManualExclEval: boolean;
  list: string[];
}[] {
  const manuallyIncluded = new Set(products.filter((p) => p.sig === "manual_incl").map((p) => p._id));
  const manuallyExcluded = new Set(products.filter((p) => p.sig === "manual_excl").map((p) => p._id));

  const menuProducts = selectDiscountedProducts(products, SECTION_PERCENT);
  const menuIds = new Set(menuProducts.map((p) => p._id));
  const menuResults: string[] = [];
  for (const p of products) {
    const inSectionNow = menuIds.has(p._id);
    if (p.sig === "target_menu" || p.sig === "manual_incl" || p.sig === "manual_excl" || p.sig === "target_manual" || p.sig === "target_manual_excl") {
      menuResults.push(`${p._id}|${p.sig}|${inSectionNow}`);
    }
  }

  const manualInclIds = new Set(manuallyIncluded);
  const manualExclIds = new Set(manuallyExcluded);
  const targetManualIds = new Set(products.filter((p) => p.sig === "target_manual").map((p) => p._id));
  const targetManualExclIds = new Set(products.filter((p) => p.sig === "target_manual_excl").map((p) => p._id));

  const manualInclEval = manualInclIds.size > 0 && !products.some((p) => p.sig === "target_manual" && manualInclIds.has(p._id));
  const manualExclEval = manualExclIds.size > 0 && products.some((p) => p.sig === "target_manual_excl" && manualExclIds.has(p._id));
  const targetManualEval = targetManualIds.size > 0 && !products.some((p) => p.sig === "target_manual" && menuIds.has(p._id));
  const targetManualExclEval = targetManualExclIds.size > 0 && products.some((p) => p.sig === "target_manual_excl" && !menuIds.has(p._id));

  return [
    {
      scenario: "S1_global_rule_on_target_product",
      targetMenu: "target_menu",
      menuEval: menuIds.has("s1-target"),
      manualInclEval: false,
      manualExclEval: false,
      targetManualEval: false,
      targetManualExclEval: false,
      list: menuResults,
    },
    {
      scenario: "S2_manually_included_not_globally_rediscounted",
      targetMenu: "manual_incl",
      menuEval: menuIds.has("s2-target"),
      manualInclEval: manualInclEval,
      manualExclEval: false,
      targetManualEval: false,
      targetManualExclEval: false,
      list: menuResults,
    },
    {
      scenario: "S3_manually_included_also_globally_rediscounted",
      targetMenu: "manual_incl",
      menuEval: menuIds.has("s3-target"),
      manualInclEval: manualInclEval,
      manualExclEval: false,
      targetManualEval: false,
      targetManualExclEval: false,
      list: menuResults,
    },
    {
      scenario: "S4_normally_priced_manually_included",
      targetMenu: "manual_incl",
      menuEval: menuIds.has("s4-target"),
      manualInclEval: manualInclEval,
      manualExclEval: false,
      targetManualEval: false,
      targetManualExclEval: false,
      list: menuResults,
    },
    {
      scenario: "S5_item_excluded_from_section",
      targetMenu: "manual_excl",
      menuEval: menuIds.has("s5-target"),
      manualInclEval: false,
      manualExclEval: manualExclEval,
      targetManualEval: false,
      targetManualExclEval: false,
      list: menuResults,
    },
    {
      scenario: "S6_non_matching_price_label",
      targetMenu: "target_menu",
      menuEval: menuIds.has("s6-target"),
      manualInclEval: false,
      manualExclEval: false,
      targetManualEval: false,
      targetManualExclEval: false,
      list: menuResults,
    },
    {
      scenario: "S7_price_lower_than_discountPrice",
      targetMenu: "target_menu",
      menuEval: menuIds.has("s7-target"),
      manualInclEval: false,
      manualExclEval: false,
      targetManualEval: false,
      targetManualExclEval: false,
      list: menuResults,
    },
    {
      scenario: "S8_price_higher_than_discountPrice_wrong_direction",
      targetMenu: "target_menu",
      menuEval: menuIds.has("s8-target"),
      manualInclEval: false,
      manualExclEval: false,
      targetManualEval: false,
      targetManualExclEval: false,
      list: menuResults,
    },
    {
      scenario: "S9_no_discountPrice_at_all",
      targetMenu: "target_menu",
      menuEval: menuIds.has("s9-target"),
      manualInclEval: false,
      manualExclEval: false,
      targetManualEval: false,
      targetManualExclEval: false,
      list: menuResults,
    },
  ];
}

// ---------------------------------------------------------------------------
// Minor harness entry point (no catalog loading)
// ---------------------------------------------------------------------------

export function main(): void {
  const products: StoreProduct[] = [
    { _id: "s1-target", name: "Globally rediscounted item", price: 40, discountPrice: 30, signature: "target_menu" },
    { _id: "s2-target", name: "Manually included, not globally rediscounted", price: 40, discountPrice: null, signature: "manual_incl" },
    { _id: "s3-target", name: "Manually included also globally rediscounted", price: 40, discountPrice: 30, signature: "manual_incl" },
    { _id: "s4-target", name: "Normally priced, manually included", price: 50, discountPrice: null, signature: "manual_incl" },
    { _id: "s5-target", name: "Excluded from section", price: 40, discountPrice: 30, signature: "manual_excl" },
    { _id: "s6-target", name: "Non-matching price label", price: 40, discountPrice: 30, signature: "target_menu" },
    { _id: "s7-target", name: "Price lower than discountPrice", price: 30, discountPrice: 40, signature: "target_menu" },
    { _id: "s8-target", name: "Price higher than discountPrice wrong direction", price: 60, discountPrice: 50, signature: "target_menu" },
    { _id: "s9-target", name: "No discountPrice at all", price: 50, discountPrice: null, signature: "target_menu" },
  ];

  const results = evalScenario(products, "normal");

  console.log("Per-scenario verdicts (section = non-manual, S1..S9 target products):");
  for (const r of results) {
    const checks = [
      r.scenario,
      `menuEval=${r.menuEval}`,
      `manualInclEval=${r.manualInclEval}`,
      `manualExclEval=${r.manualExclEval}`,
      `targetManualEval=${r.targetManualEval}`,
      `targetManualExclEval=${r.targetManualExclEval}`,
    ].join("  ");
    console.log(`  ${checks}`);
  }
}

main();
