// Single source of truth for the customer-facing delivery fee.
//
// Mirrors the calculation in src/convex/orders.ts (orders.create /
// orders.createDirectOrder) exactly, so Cart and Checkout always display the
// fee the server will actually charge. Both sides read the same public
// delivery configuration: the client via deliveryConfig:getPublic, the server
// by querying the same delivery_config document directly.

export type PublicDeliveryConfig = {
  defaultDeliveryFee: number;
  freeDeliveryThreshold: number;
  pincodes: {
    pincode: string;
    isActive: boolean;
    deliveryFee?: number;
  }[];
};

/**
 * Compute the delivery fee exactly the way order creation does on the server.
 *
 * @param config - `deliveryConfig:getPublic` result. `undefined` while the
 *   query is still loading (renders as free instead of flashing a stale fee),
 *   `null` when no delivery configuration exists at all (the server then falls
 *   back to ₹49 below ₹500 and free at or above ₹500).
 * @param subtotal - Cart subtotal after product discounts — the same base the
 *   server applies the free-delivery threshold to.
 * @param shippingAddress - The address string that will be sent with the
 *   order. The server extracts the 6-digit pincode from it with the same regex
 *   used here; pass nothing when no address is chosen yet (Cart) — the server
 *   then charges the default configured fee.
 */
export function computeDeliveryFee(
  config: PublicDeliveryConfig | null | undefined,
  subtotal: number,
  shippingAddress?: string
): number {
  if (config === undefined) return 0; // still loading — don't flash a stale fee
  if (!config) {
    // Server fallback when no delivery configuration exists at all
    // (orders.ts: `let deliveryFee = 49; … else if (subtotal >= 500) = 0`).
    return subtotal >= 500 ? 0 : 49;
  }
  const pincode = shippingAddress?.match(/\b(\d{6})\b/)?.[1];
  const pinMatch = pincode
    ? config.pincodes.find((p) => p.pincode === pincode && p.isActive)
    : undefined;
  const fee = pinMatch?.deliveryFee ?? config.defaultDeliveryFee;
  return subtotal >= config.freeDeliveryThreshold ? 0 : fee;
}
