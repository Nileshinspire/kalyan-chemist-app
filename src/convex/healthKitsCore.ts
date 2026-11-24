import type { Doc } from "./_generated/dataModel";
import {
  buildCustomKitQuote,
  computeAutoKitPrice,
  resolveBaseKitPrice,
  roundMoney,
  type KitCustomizationQuote,
  type KitPricedComponent,
  type KitPricingMode,
  type KitSelectionLine,
} from "../lib/healthKitQuote";
import { withEnginePrices } from "./discountEngine";

/**
 * Shared health-kit rules.
 *
 * A kit is a product row with `healthKit` metadata. It owns no stock of its
 * own: every unit a customer can buy must be matchable to one unit of each
 * included product, so availability is the smallest component stock divided by
 * the quantity that kit includes.
 */

export type HealthKitComponentLine = {
  product: Doc<"products">;
  quantity: number;
  /** Complete kits this component's current stock can support. */
  availableKits: number;
  inStock: boolean;
};

export type HealthKitAvailability = {
  available: boolean;
  /** Complete kits that can be sold right now. */
  maxQuantity: number;
  components: HealthKitComponentLine[];
  /** A short, customer-facing reason when the kit cannot be sold. */
  unavailableReason: string | null;
};

export function kitSellingPrice(
  kit: Pick<Doc<"products">, "price" | "discountPrice">,
): number {
  return kit.discountPrice !== undefined && kit.discountPrice < kit.price
    ? kit.discountPrice
    : kit.price;
}

export function kitDiscountPercent(
  kit: Pick<Doc<"products">, "price" | "discountPrice">,
): number {
  if (!(kit.price > 0)) return 0;
  const selling = kitSellingPrice(kit);
  return selling < kit.price
    ? Math.round(((kit.price - selling) / kit.price) * 100)
    : 0;
}

export async function getHealthKitAvailability(
  db: { get: (id: any) => Promise<any> },
  kit: Doc<"products">,
  now = Date.now(),
): Promise<HealthKitAvailability> {
  if (!kit.healthKit) {
    return {
      available: false,
      maxQuantity: 0,
      components: [],
      unavailableReason: "This product is not a health kit.",
    };
  }

  const components: HealthKitComponentLine[] = [];
  for (const component of kit.healthKit.components) {
    const product = await db.get(component.productId);
    if (!product || !product.isActive) {
      components.push({
        product: product ?? ({ name: "Unavailable item" } as Doc<"products">),
        quantity: component.quantity,
        availableKits: 0,
        inStock: false,
      });
      continue;
    }
    const expired = !!product.expiryDate && product.expiryDate <= now;
    const availableKits = expired
      ? 0
      : Math.floor(Math.max(0, product.stockQuantity) / Math.max(1, component.quantity));
    components.push({
      product,
      quantity: component.quantity,
      availableKits,
      inStock: availableKits > 0,
    });
  }

  const maxQuantity = components.length
    ? Math.min(...components.map((line) => line.availableKits))
    : 0;
  const missing = components.find(
    (line) => !line.product._id || !line.product.isActive || line.availableKits <= 0,
  );
  const unavailableReason = missing
    ? `${missing.product.name} is currently out of stock.`
    : null;

  return {
    available: kit.isActive && maxQuantity > 0,
    maxQuantity,
    components,
    unavailableReason,
  };
}

export type HealthKitPricing = {
  mode: KitPricingMode;
  kitDiscountPercent: number;
  /** Live regular-price value of one complete kit. */
  catalogueMrp: number;
  /** Live post-product-discount value of one complete kit. */
  effectiveCatalogueValue: number;
  productSavings: number;
  kitDiscountAmount: number;
  sellingPrice: number;
  savings: number;
  discountPercent: number;
  components: KitPricedComponent[];
};

/**
 * Resolve the live price of a kit from the current catalogue prices.
 *
 * Components are decorated with the same discount engine the rest of the
 * storefront uses. Missing/inactive products are kept in the result so pricing
 * can show the truth, but they make the kit unavailable rather than silently
 * dropping value.
 */
export async function resolveHealthKitPricing(
  db: any,
  kit: Doc<"products">,
  now = Date.now(),
): Promise<HealthKitPricing> {
  const metadata = kit.healthKit?.pricing;
  const mode: KitPricingMode = metadata?.mode ?? "manual";
  const kitPct = metadata?.kitDiscountPercent ?? 0;

  const rows = await Promise.all(
    (kit.healthKit?.components ?? []).map((line) => db.get(line.productId)),
  );
  const found = rows.filter(Boolean) as Doc<"products">[];
  const priced = found.length ? await withEnginePrices(db, found) : [];
  const priceById = new Map(priced.map((row) => [row._id, row]));

  const components: KitPricedComponent[] = (kit.healthKit?.components ?? []).map(
    (line, index) => {
      const raw = rows[index] as Doc<"products"> | null;
      const product = raw ? priceById.get(raw._id) ?? raw : null;
      return {
        productId: line.productId as string,
        name: product?.name ?? "Unavailable item",
        slug: product?.slug ?? null,
        imageUrl: product?.imageUrl ?? null,
        packSize: product?.packSize ?? null,
        configuredQuantity: line.quantity,
        mrp: product?.price ?? 0,
        effectiveUnitPrice: product
          ? product.discountPrice && product.discountPrice < product.price
            ? product.discountPrice
            : product.price
          : 0,
        stockQuantity: product?.stockQuantity ?? 0,
        isActive: !!product?.isActive,
        expiryDate: product?.expiryDate ?? null,
        manufacturer: product?.manufacturer ?? null,
      };
    },
  );

  const catalogueMrp = roundMoney(
    components.reduce((sum, line) => sum + line.mrp * line.configuredQuantity, 0),
  );
  const effectiveCatalogueValue = roundMoney(
    components.reduce(
      (sum, line) => sum + line.effectiveUnitPrice * line.configuredQuantity,
      0,
    ),
  );
  const storedPrice = kitSellingPrice(kit);
  const sellingPrice = resolveBaseKitPrice({
    mode,
    kitDiscountPercent: kitPct,
    storedPrice,
    effectiveCatalogueValue,
  });
  const productSavings = roundMoney(
    Math.max(0, catalogueMrp - effectiveCatalogueValue),
  );
  const kitDiscountAmount =
    mode === "auto"
      ? roundMoney(Math.max(0, effectiveCatalogueValue - sellingPrice))
      : roundMoney(Math.max(0, effectiveCatalogueValue - sellingPrice));
  const savings = roundMoney(Math.max(0, catalogueMrp - sellingPrice));
  const discountPercent = catalogueMrp > 0
    ? Math.round((savings / catalogueMrp) * 100)
    : 0;

  return {
    mode,
    kitDiscountPercent: kitPct,
    catalogueMrp,
    effectiveCatalogueValue,
    productSavings,
    kitDiscountAmount,
    sellingPrice,
    savings,
    discountPercent,
    components,
  };
}

/** Automatic price preview for the admin form, before a kit is saved. */
export function autoKitPriceFor(
  effectiveCatalogueValue: number,
  kitDiscountPercent: number,
): number {
  return computeAutoKitPrice(effectiveCatalogueValue, kitDiscountPercent);
}

/** Authoritative per-kit quote used by the kit page, cart, checkout and orders. */
export async function getHealthKitQuote(
  db: any,
  kit: Doc<"products">,
  selection?: KitSelectionLine[],
  now = Date.now(),
): Promise<({
  pricing: HealthKitPricing;
  quote: KitCustomizationQuote;
  availability: HealthKitAvailability;
}) | null> {
  if (!kit.healthKit || !kit.isActive) return null;
  const pricing = await resolveHealthKitPricing(db, kit, now);
  const quote = buildCustomKitQuote({
    components: pricing.components,
    basePrice: pricing.sellingPrice,
    selection,
    baseCatalogueMrp: pricing.catalogueMrp,
    baseEffectiveCatalogueValue: pricing.effectiveCatalogueValue,
  });
  const availability = await getHealthKitAvailability(db, kit, now);
  return { pricing, quote, availability };
}

