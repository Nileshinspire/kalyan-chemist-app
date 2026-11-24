/**
 * Pure health-kit pricing and customization maths.
 *
 * The same module is used by the admin form, the customer kit page and the
 * Convex backend, so a displayed price and the amount actually charged are
 * always produced by one calculation. Backend callers still recompute from
 * current product prices; client-side values are only a preview.
 */
import { effectiveUnitPrice } from "./discount";

export type KitPricingMode = "auto" | "manual";

export interface KitSelectionLine {
  productId: string;
  quantity: number;
}

export interface KitPricedComponent {
  productId: string;
  name: string;
  slug?: string | null;
  imageUrl?: string | null;
  packSize?: string | null;
  /** Quantity required by the configured kit. */
  configuredQuantity: number;
  /** Regular/MRP unit price. */
  mrp: number;
  effectiveUnitPrice: number;
  stockQuantity: number;
  isActive: boolean;
  expiryDate?: number | null;
  manufacturer?: string | null;
}

export interface KitQuoteComponent {
  productId: string;
  name: string;
  slug: string | null;
  imageUrl: string | null;
  packSize: string | null;
  manufacturer: string | null;
  configuredQuantity: number;
  selectedQuantity: number;
  removedQuantity: number;
  mrp: number;
  effectiveUnitPrice: number;
  selectedMrp: number;
  selectedEffectiveValue: number;
  allocatedPrice: number;
  stockQuantity: number;
  availableKits: number;
  inStock: boolean;
  isActive: boolean;
  expiryDate: number | null;
}

export interface KitCustomizationQuote {
  basePrice: number;
  baseCatalogueMrp: number;
  baseEffectiveCatalogueValue: number;
  customizedPrice: number;
  selectedMrp: number;
  selectedEffectiveValue: number;
  savings: number;
  removedFromBasePrice: number;
  selectedProductCount: number;
  totalUnits: number;
  configuredProductCount: number;
  configuredTotalUnits: number;
  removedProductCount: number;
  isCustomized: boolean;
  available: boolean;
  maxQuantity: number;
  unavailableReason: string | null;
  configurationKey: string;
  selection: KitSelectionLine[];
  components: KitQuoteComponent[];
}

/** Round a rupee amount to paise without floating-point drift. */
export function roundMoney(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function clampKitDiscountPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(99, Math.max(0, value));
}

/** The automatic kit price after applying the kit-level discount once. */
export function computeAutoKitPrice(
  effectiveCatalogueValue: number,
  kitDiscountPercent: number,
): number {
  const catalogue = Math.max(0, effectiveCatalogueValue);
  const percent = clampKitDiscountPercent(kitDiscountPercent);
  return roundMoney((catalogue * (100 - percent)) / 100);
}

/**
 * Resolve the current base kit price.
 *
 * Auto kits follow live component prices. Manual kits keep the admin's price,
 * but can never be charged above the current effective value of their contents
 * — if catalogue prices fall later, the customer pays the lower, fair amount
 * instead of a stale bundle price.
 */
export function resolveBaseKitPrice(args: {
  mode: KitPricingMode;
  kitDiscountPercent: number;
  storedPrice: number;
  effectiveCatalogueValue: number;
}): number {
  const stored = Math.max(0, roundMoney(args.storedPrice));
  const effective = Math.max(0, roundMoney(args.effectiveCatalogueValue));
  if (args.mode === "auto") {
    return computeAutoKitPrice(effective, args.kitDiscountPercent);
  }
  if (effective <= 0) return stored;
  return roundMoney(Math.min(stored, effective));
}

/** Current effective price for a product row, mirroring the catalogue views. */
export function componentEffectivePrice(product: {
  price: number;
  discountPrice?: number | null;
}): number {
  return effectiveUnitPrice(product.price, product.discountPrice);
}

/**
 * Split one kit price across every included unit in exact paise.
 *
 * Largest-remainder rounding guarantees the shares add up to the kit price to
 * the paise, even when the proportional amounts are fractions.
 */
export function allocatePricePaise(
  price: number,
  weights: number[],
): number[] {
  if (weights.length === 0) return [];
  const totalPaise = Math.max(0, Math.round(price * 100));
  const totalWeight = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0);

  if (totalPaise === 0) return weights.map(() => 0);
  if (totalWeight <= 0) {
    const base = Math.floor(totalPaise / weights.length);
    let remainder = totalPaise - base * weights.length;
    return weights.map(() => {
      const share = base + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder -= 1;
      return share;
    });
  }

  const raw = weights.map((weight) => (totalPaise * Math.max(0, weight)) / totalWeight);
  const shares = raw.map((value) => Math.floor(value));
  let remaining = totalPaise - shares.reduce((sum, value) => sum + value, 0);

  const order = raw
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let i = 0; i < order.length && remaining > 0; i += 1) {
    shares[order[i].index] += 1;
    remaining -= 1;
  }
  return shares;
}

function normalizeSelection(
  components: KitPricedComponent[],
  selection?: KitSelectionLine[],
): Map<string, number> {
  const configured = new Map(components.map((line) => [line.productId, line.configuredQuantity]));
  const result = new Map<string, number>();

  if (!selection) {
    for (const line of components) result.set(line.productId, line.configuredQuantity);
    return result;
  }

  for (const line of selection) {
    if (!configured.has(line.productId)) {
      throw new Error("This product is not part of the selected health kit.");
    }
    if (result.has(line.productId)) {
      throw new Error("A product appears more than once in this kit selection.");
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 0) {
      throw new Error("Kit quantities must be whole numbers.");
    }
    if (line.quantity > (configured.get(line.productId) ?? 0)) {
      throw new Error("A kit component quantity cannot exceed the configured quantity.");
    }
    result.set(line.productId, line.quantity);
  }

  // Any omitted component is intentionally removed.
  for (const line of components) {
    if (!result.has(line.productId)) result.set(line.productId, 0);
  }
  return result;
}

function configurationKey(
  components: KitPricedComponent[],
  selected: Map<string, number>,
): string {
  return components
    .map((line) => `${line.productId}:${selected.get(line.productId) ?? 0}`)
    .join(",");
}

/**
 * Build a customer-specific kit quote.
 *
 * Allocate the full base kit price across each component unit by its current
 * effective catalogue value, then keep only the units the customer selected.
 * This makes removing a product subtract exactly that product's proportional
 * share — never its MRP — and still sums back to the kit price when the full
 * selection is restored.
 */
export function buildCustomKitQuote(args: {
  components: KitPricedComponent[];
  basePrice: number;
  selection?: KitSelectionLine[];
  /** Base catalogue values, used for savings and damaged-data safeguards. */
  baseCatalogueMrp?: number;
  baseEffectiveCatalogueValue?: number;
}): KitCustomizationQuote {
  const { components } = args;
  const selected = normalizeSelection(components, args.selection);

  const units: Array<{ productId: string; weight: number }> = [];
  for (const line of components) {
    for (let index = 0; index < line.configuredQuantity; index += 1) {
      units.push({ productId: line.productId, weight: Math.max(0, line.effectiveUnitPrice) });
    }
  }

  const shares = allocatePricePaise(
    Math.max(0, args.basePrice),
    units.map((unit) => unit.weight),
  );

  const allocatedByProduct = new Map<string, number>();
  const selectedUnitsByProduct = new Map<string, number>();
  units.forEach((unit, index) => {
    const productSelected = selected.get(unit.productId) ?? 0;
    if (productSelected > (selectedUnitsByProduct.get(unit.productId) ?? 0)) {
      selectedUnitsByProduct.set(
        unit.productId,
        (selectedUnitsByProduct.get(unit.productId) ?? 0) + 1,
      );
      allocatedByProduct.set(
        unit.productId,
        (allocatedByProduct.get(unit.productId) ?? 0) + shares[index],
      );
    }
  });

  let customizedPaise = 0;
  let selectedMrp = 0;
  let selectedEffectiveValue = 0;
  let selectedProductCount = 0;
  let totalUnits = 0;
  let configuredTotalUnits = 0;
  let removedProductCount = 0;
  let available = components.length > 0;
  let maxQuantity = Number.POSITIVE_INFINITY;
  let unavailableReason: string | null = null;

  const quoteComponents: KitQuoteComponent[] = components.map((line) => {
    const selectedQuantity = selected.get(line.productId) ?? 0;
    const allocatedPaise = allocatedByProduct.get(line.productId) ?? 0;
    const lineMrp = roundMoney(line.mrp * selectedQuantity);
    const lineEffective = roundMoney(line.effectiveUnitPrice * selectedQuantity);
    const availableKits = selectedQuantity > 0
      ? Math.max(
          0,
          Math.floor(
            Math.max(0, line.stockQuantity) /
              Math.max(1, selectedQuantity),
          ),
        )
      : 0;
    const inStock = selectedQuantity === 0
      ? true
      : line.stockQuantity >= selectedQuantity;
    const lineIsSellable = line.isActive &&
      (line.expiryDate == null || line.expiryDate > Date.now()) &&
      inStock;

    customizedPaise += allocatedPaise;
    selectedMrp += lineMrp;
    selectedEffectiveValue += lineEffective;
    configuredTotalUnits += line.configuredQuantity;

    if (selectedQuantity > 0) {
      selectedProductCount += 1;
      totalUnits += selectedQuantity;
      if (!lineIsSellable) {
        available = false;
        unavailableReason =
          unavailableReason ??
          (!line.isActive
            ? `${line.name} is currently unavailable.`
            : line.stockQuantity < selectedQuantity
              ? `${line.name} does not have enough stock for this configuration.`
              : `${line.name} has expired and cannot be included.`);
      } else {
        maxQuantity = Math.min(maxQuantity, availableKits);
      }
    } else {
      removedProductCount += 1;
    }

    return {
      productId: line.productId,
      name: line.name,
      slug: line.slug ?? null,
      imageUrl: line.imageUrl ?? null,
      packSize: line.packSize ?? null,
      manufacturer: line.manufacturer ?? null,
      configuredQuantity: line.configuredQuantity,
      selectedQuantity,
      removedQuantity: Math.max(0, line.configuredQuantity - selectedQuantity),
      mrp: line.mrp,
      effectiveUnitPrice: line.effectiveUnitPrice,
      selectedMrp: lineMrp,
      selectedEffectiveValue: lineEffective,
      allocatedPrice: allocatedPaise / 100,
      stockQuantity: line.stockQuantity,
      availableKits,
      inStock,
      isActive: line.isActive,
      expiryDate: line.expiryDate ?? null,
    };
  });

  if (components.length === 0) {
    available = false;
    unavailableReason = "This kit has no included products.";
  } else if (selectedProductCount === 0) {
    available = false;
    maxQuantity = 0;
    unavailableReason = "Select at least one product for this kit.";
  } else if (!Number.isFinite(maxQuantity)) {
    maxQuantity = 0;
  }

  const baseCatalogueMrp = args.baseCatalogueMrp ??
    roundMoney(components.reduce((sum, line) => sum + line.mrp * line.configuredQuantity, 0));
  const baseEffectiveCatalogueValue = args.baseEffectiveCatalogueValue ??
    roundMoney(
      components.reduce(
        (sum, line) => sum + line.effectiveUnitPrice * line.configuredQuantity,
        0,
      ),
    );
  const basePrice = roundMoney(Math.max(0, args.basePrice));
  const customizedPrice = roundMoney(customizedPaise / 100);
  const isCustomized = components.some(
    (line) => (selected.get(line.productId) ?? 0) !== line.configuredQuantity,
  );

  return {
    basePrice,
    baseCatalogueMrp,
    baseEffectiveCatalogueValue,
    customizedPrice,
    selectedMrp: roundMoney(selectedMrp),
    selectedEffectiveValue: roundMoney(selectedEffectiveValue),
    savings: roundMoney(Math.max(0, selectedMrp - customizedPrice)),
    removedFromBasePrice: roundMoney(Math.max(0, basePrice - customizedPrice)),
    selectedProductCount,
    totalUnits,
    configuredProductCount: components.length,
    configuredTotalUnits,
    removedProductCount,
    isCustomized,
    available,
    maxQuantity: Math.max(0, maxQuantity),
    unavailableReason,
    configurationKey: configurationKey(components, selected),
    selection: components.map((line) => ({
      productId: line.productId,
      quantity: selected.get(line.productId) ?? 0,
    })),
    components: quoteComponents,
  };
}

/** Compact, URL-safe representation used by the Buy Now hand-off. */
export function serializeKitSelection(selection: KitSelectionLine[]): string {
  return selection
    .filter((line) => Number.isInteger(line.quantity) && line.quantity > 0)
    .map((line) => `${line.productId}:${line.quantity}`)
    .join(",");
}

export function parseKitSelection(value: string | null | undefined): KitSelectionLine[] {
  if (!value) return [];
  const result: KitSelectionLine[] = [];
  for (const part of value.split(",")) {
    const separator = part.lastIndexOf(":");
    if (separator <= 0) continue;
    const productId = part.slice(0, separator);
    const quantity = Number(part.slice(separator + 1));
    if (!productId || !Number.isInteger(quantity) || quantity < 0) continue;
    if (result.some((line) => line.productId === productId)) continue;
    result.push({ productId, quantity });
  }
  return result;
}
