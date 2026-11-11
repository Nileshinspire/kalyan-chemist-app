/**
 * FEFO (First Expiry, First Out) allocation core.
 *
 * Pure functions only — no Convex imports — so the ordering, exclusion and
 * split-across-batches rules can be unit tested directly, and the mutation
 * layer (`stockReservations.ts`) applies the resulting plan inside a single
 * transaction.
 *
 * Rules implemented here:
 *  - Expired batches (expiry <= now) are never sellable, whatever quantity
 *    they still hold. They stay in the table for admin reporting.
 *  - Sellable units are taken from the earliest-expiring batch first, then the
 *    next one, and so on, until the requested quantity is covered.
 *  - Only what a batch actually has available is taken from it, so a single
 *    order can span several batches.
 *  - Units that are not tracked by any batch (legacy stock whose quantity is
 *    part of `product.stockQuantity`) are used last, and only up to the
 *    un-batched remainder. They are never invented as a fake batch.
 */

/** A batch row, shaped so the core can be tested without Convex types. */
export type BatchStock = {
  _id: string;
  batchNumber?: string | null;
  expiryDate?: number | null;
  availableQuantity: number;
  stockReceivedAt?: number | null;
  /** Legacy/unverified rows: counted in stock, never sold, pending admin review. */
  needsVerification?: boolean | null;
};

/** One chunk of an allocation: a batch (or the un-batched remainder). */
export type FefoUnit = {
  batchId: string | null;
  batchNumber: string | null;
  expiryDate: number | null;
  quantity: number;
};

export type FefoPlan = {
  ok: boolean;
  /** Empty when `ok` is false — an order is never partially allocated. */
  units: FefoUnit[];
  /** Units that could be allocated (equal to the request when `ok`). */
  allocated: number;
  /** Units that are sellable right now (expired batch stock excluded). */
  sellable: number;
};

export function isBatchExpired(
  expiryDate: number | null | undefined,
  now: number,
): boolean {
  return expiryDate !== null && expiryDate !== undefined && expiryDate <= now;
}

/**
 * A batch can be sold only if it holds units, has not expired, and is not
 * flagged for admin verification (stock that could not be mapped reliably).
 */
export function isBatchSellable(batch: BatchStock, now: number): boolean {
  return (
    batch.availableQuantity > 0 &&
    !batch.needsVerification &&
    !isBatchExpired(batch.expiryDate, now)
  );
}

/**
 * Sellable batches in FEFO order: earliest expiry first; batches without an
 * expiry sort last (they cannot be expired, but must not jump ahead of a dated
 * batch); ties fall back to the oldest receipt, then batch number, then id so
 * the order is stable and deterministic.
 */
export function sortBatchesFefo(batches: BatchStock[], now: number): BatchStock[] {
  return batches
    .filter((batch) => isBatchSellable(batch, now))
    .sort((a, b) => {
      const aExpiry = a.expiryDate ?? Number.POSITIVE_INFINITY;
      const bExpiry = b.expiryDate ?? Number.POSITIVE_INFINITY;
      if (aExpiry !== bExpiry) return aExpiry - bExpiry;

      const aReceived = a.stockReceivedAt ?? 0;
      const bReceived = b.stockReceivedAt ?? 0;
      if (aReceived !== bReceived) return aReceived - bReceived;

      const aNumber = a.batchNumber ?? "";
      const bNumber = b.batchNumber ?? "";
      if (aNumber !== bNumber) return aNumber < bNumber ? -1 : 1;

      return a._id < b._id ? -1 : a._id > b._id ? 1 : 0;
    });
}

/** Units on the product that no batch row accounts for (legacy stock). */
export function unbatchedQuantity(
  batches: BatchStock[],
  productQuantity: number,
): number {
  const tracked = batches.reduce(
    (sum, batch) => sum + Math.max(0, batch.availableQuantity),
    0,
  );
  return Math.max(0, productQuantity - tracked);
}

/** Everything that can actually be sold from this product right now. */
export function sellableQuantity(
  batches: BatchStock[],
  productQuantity: number,
  now: number,
): number {
  const fromBatches = batches
    .filter((batch) => isBatchSellable(batch, now))
    .reduce((sum, batch) => sum + Math.max(0, batch.availableQuantity), 0);
  return fromBatches + unbatchedQuantity(batches, productQuantity);
}

/** Units locked in expired batches — reported, never sold. */
export function expiredQuantity(batches: BatchStock[], now: number): number {
  return batches
    .filter((batch) => isBatchExpired(batch.expiryDate, now))
    .reduce((sum, batch) => sum + Math.max(0, batch.availableQuantity), 0);
}

/**
 * Plan a FEFO allocation of `quantity` units.
 *
 * The plan is all-or-nothing: if the sellable units cannot cover the request,
 * `ok` is false and no units are returned, so the caller never half-reserves.
 */
export function allocateFefo(args: {
  batches: BatchStock[];
  productQuantity: number;
  quantity: number;
  now: number;
}): FefoPlan {
  const { batches, productQuantity, now } = args;
  const quantity = Math.floor(args.quantity);
  const sellable = sellableQuantity(batches, productQuantity, now);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    return { ok: false, units: [], allocated: 0, sellable };
  }
  if (sellable < quantity) {
    return { ok: false, units: [], allocated: 0, sellable };
  }

  const units: FefoUnit[] = [];
  let remaining = quantity;

  for (const batch of sortBatchesFefo(batches, now)) {
    if (remaining <= 0) break;
    const take = Math.min(batch.availableQuantity, remaining);
    if (take <= 0) continue;
    units.push({
      batchId: batch._id,
      batchNumber: batch.batchNumber ?? null,
      expiryDate: batch.expiryDate ?? null,
      quantity: take,
    });
    remaining -= take;
  }

  if (remaining > 0) {
    // The rest of the sellable stock is un-batched legacy stock. It is never
    // attributed to a fabricated batch row.
    const legacy = unbatchedQuantity(batches, productQuantity);
    const take = Math.min(legacy, remaining);
    if (take > 0) {
      units.push({
        batchId: null,
        batchNumber: null,
        expiryDate: null,
        quantity: take,
      });
      remaining -= take;
    }
  }

  if (remaining > 0) {
    return { ok: false, units: [], allocated: 0, sellable };
  }

  return { ok: true, units, allocated: quantity, sellable };
}
