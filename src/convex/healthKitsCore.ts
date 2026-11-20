import type { Doc } from "./_generated/dataModel";

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
