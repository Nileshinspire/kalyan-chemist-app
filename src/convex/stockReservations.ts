import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  allocateFefo,
  isBatchExpired,
  type BatchStock,
} from "./batchAllocationCore";

/**
 * Batch-aware stock reservation and restoration for customer orders.
 *
 * Everything here runs inside the caller's Convex mutation, which is a single
 * serializable transaction: reading the batches, allocating FEFO, decrementing
 * batch and product quantities and writing the order all commit together, so
 * two customers cannot both take the last unit.
 *
 * Backwards compatible by design:
 *  - `products.stockQuantity` remains the sellable total every existing screen
 *    and query reads; batch rows only add the expiry-level detail.
 *  - A product with no batch rows keeps working exactly as before — its units
 *    are treated as un-batched stock.
 *  - Restoration is idempotent: `orders.stockReleasedAt` plus the per-unit
 *    `order_stock_allocations.status` mean a unit is handed back at most once,
 *    no matter how many cancellation/payment callbacks arrive.
 */

type OrderItem = {
  productId: Id<"products">;
  name: string;
  price: number;
  quantity: number;
};

type MovementRow = {
  productId: Id<"products">;
  batchId?: Id<"product_batches">;
  batchNumber?: string;
  movementType: "received" | "reserved" | "deducted" | "restored" | "damaged" | "expired" | "adjustment";
  quantity: number;
  previousBatchQuantity: number;
  newBatchQuantity: number;
  previousProductQuantity: number;
  newProductQuantity: number;
  orderId?: Id<"orders">;
  adminId?: Id<"users">;
  reason: string;
  createdAt: number;
};

async function logMovement(ctx: MutationCtx, row: MovementRow) {
  await ctx.db.insert("batch_stock_movements", row);
}

async function loadBatches(
  ctx: MutationCtx,
  productId: Id<"products">,
): Promise<Doc<"product_batches">[]> {
  return await ctx.db
    .query("product_batches")
    .withIndex("by_product", (q) => q.eq("productId", productId))
    .collect();
}

function toBatchStock(batches: Doc<"product_batches">[]): BatchStock[] {
  return batches.map((batch) => ({
    _id: batch._id as unknown as string,
    batchNumber: batch.batchNumber ?? null,
    expiryDate: batch.expiryDate ?? null,
    availableQuantity: batch.availableQuantity,
    stockReceivedAt: batch.stockReceivedAt ?? null,
    needsVerification: batch.needsVerification ?? false,
  }));
}

/**
 * Reserve the units for an order, FEFO first, decrementing each batch and the
 * product total. Throws (rolling the whole order back) when sellable stock
 * cannot cover the request — expired batch stock never counts.
 */
export async function reserveStockForOrder(
  ctx: MutationCtx,
  args: {
    orderId: Id<"orders">;
    items: OrderItem[];
    reason: string;
    adminId?: Id<"users">;
  },
): Promise<{ reserved: number; batchesUsed: number }> {
  const now = Date.now();
  let reserved = 0;
  let batchesUsed = 0;

  for (const item of args.items) {
    const product = await ctx.db.get(item.productId);
    if (!product || !product.isActive) {
      throw new Error(`"${item.name}" is no longer available`);
    }

    const batches = await loadBatches(ctx, item.productId);
    // A product-level expiry date is the storefront's existing hard gate and is
    // enforced by the caller exactly as before. Batch-level expiry is an extra
    // filter here, so an expired batch can never be sold even when the product
    // total still counts its units.
    const plan = allocateFefo({
      batches: toBatchStock(batches),
      productQuantity: product.stockQuantity,
      quantity: item.quantity,
      now,
    });

    if (!plan.ok) {
      throw new Error(
        `Insufficient stock for "${product.name}". Available: ${plan.sellable}`,
      );
    }

    const previousProductQuantity = product.stockQuantity;
    const newProductQuantity = previousProductQuantity - item.quantity;

    for (const unit of plan.units) {
      if (!unit.batchId) continue;
      const batch = await ctx.db.get(unit.batchId as Id<"product_batches">);
      if (!batch) {
        throw new Error(`Batch for "${product.name}" is no longer available`);
      }
      const previousBatchQuantity = batch.availableQuantity;
      const newBatchQuantity = previousBatchQuantity - unit.quantity;
      if (newBatchQuantity < 0) {
        throw new Error(`Insufficient stock for "${product.name}".`);
      }
      await ctx.db.patch(batch._id, {
        availableQuantity: newBatchQuantity,
        updatedAt: now,
      });
      batchesUsed += 1;
    }

    await ctx.db.patch(product._id, {
      stockQuantity: newProductQuantity,
      updatedAt: now,
    });

    // Per-unit allocation rows: restoration works from these, so it can put
    // every unit back into the exact batch it came from.
    for (const unit of plan.units) {
      await ctx.db.insert("order_stock_allocations", {
        orderId: args.orderId,
        productId: product._id,
        batchId: unit.batchId ? (unit.batchId as Id<"product_batches">) : undefined,
        batchNumber: unit.batchNumber ?? undefined,
        expiryDate: unit.expiryDate ?? undefined,
        quantity: unit.quantity,
        status: "reserved",
        createdAt: now,
      });
    }

    for (const unit of plan.units) {
      const batch = unit.batchId
        ? batches.find((b) => (b._id as unknown as string) === unit.batchId)
        : undefined;
      await logMovement(ctx, {
        productId: product._id,
        batchId: batch?._id,
        batchNumber: batch?.batchNumber,
        movementType: "reserved",
        quantity: unit.quantity,
        previousBatchQuantity: batch?.availableQuantity ?? 0,
        newBatchQuantity: (batch?.availableQuantity ?? 0) - unit.quantity,
        previousProductQuantity,
        newProductQuantity,
        orderId: args.orderId,
        adminId: args.adminId,
        reason: args.reason,
        createdAt: now,
      });
    }

    reserved += item.quantity;
  }

  return { reserved, batchesUsed };
}

/**
 * Hand an order's reserved units back to their original batches.
 *
 * Idempotent: the order's `stockReleasedAt` stamp and the `reserved` status on
 * each allocation make repeated cancellation/payment-failure callbacks no-ops.
 * Orders placed before batch tracking existed have no allocation rows, so their
 * items are restored at product level exactly as before.
 */
export async function releaseStockForOrder(
  ctx: MutationCtx,
  args: {
    orderId: Id<"orders">;
    reason: string;
    adminId?: Id<"users">;
  },
): Promise<{ restored: number; alreadyReleased: boolean }> {
  const order = await ctx.db.get(args.orderId);
  if (!order) return { restored: 0, alreadyReleased: false };
  if (order.stockReleasedAt) return { restored: 0, alreadyReleased: true };

  const now = Date.now();
  const allocations = await ctx.db
    .query("order_stock_allocations")
    .withIndex("by_order", (q) => q.eq("orderId", args.orderId))
    .collect();
  const reservedRows = allocations.filter((row) => row.status === "reserved");

  let restored = 0;
  const restoredByProduct = new Map<Id<"products">, number>();

  // 1. Put every reserved unit back into the batch it came from.
  for (const row of reservedRows) {
    if (row.batchId) {
      const batch = await ctx.db.get(row.batchId);
      if (batch) {
        const previousBatchQuantity = batch.availableQuantity;
        const newBatchQuantity = previousBatchQuantity + row.quantity;
        await ctx.db.patch(batch._id, {
          availableQuantity: newBatchQuantity,
          updatedAt: now,
        });
        const product = await ctx.db.get(row.productId);
        await logMovement(ctx, {
          productId: row.productId,
          batchId: batch._id,
          batchNumber: batch.batchNumber,
          movementType: "restored",
          quantity: row.quantity,
          previousBatchQuantity,
          newBatchQuantity,
          previousProductQuantity: product?.stockQuantity ?? 0,
          newProductQuantity: (product?.stockQuantity ?? 0) + row.quantity,
          orderId: args.orderId,
          adminId: args.adminId,
          reason: args.reason,
          createdAt: now,
        });
      }
    }
    await ctx.db.patch(row._id, {
      status: "released",
      releasedAt: now,
      releaseReason: args.reason,
    });
    restored += row.quantity;
    restoredByProduct.set(
      row.productId,
      (restoredByProduct.get(row.productId) ?? 0) + row.quantity,
    );
  }

  // 2. The product total moves by every restored unit — batched or not — so it
  //    keeps matching the batches plus the un-batched remainder.
  const coveredByProduct = new Map<string, number>();
  for (const row of reservedRows) {
    const key = row.productId as unknown as string;
    coveredByProduct.set(key, (coveredByProduct.get(key) ?? 0) + row.quantity);
  }

  const legacyByProduct = new Map<Id<"products">, number>();
  for (const item of order.items as OrderItem[]) {
    const covered = coveredByProduct.get(item.productId as unknown as string) ?? 0;
    const legacy = item.quantity - covered;
    if (legacy > 0) {
      legacyByProduct.set(
        item.productId,
        (legacyByProduct.get(item.productId) ?? 0) + legacy,
      );
      restoredByProduct.set(
        item.productId,
        (restoredByProduct.get(item.productId) ?? 0) + legacy,
      );
    }
    coveredByProduct.set(item.productId as unknown as string, item.quantity);
  }

  for (const [productId, quantity] of restoredByProduct) {
    if (quantity <= 0) continue;
    const product = await ctx.db.get(productId);
    if (!product) continue;
    await ctx.db.patch(productId, {
      stockQuantity: product.stockQuantity + quantity,
      updatedAt: now,
    });
  }

  // 3. The un-batched portion has no batch row, so it gets its own history row.
  for (const [productId, quantity] of legacyByProduct) {
    const product = await ctx.db.get(productId);
    if (!product) continue;
    await logMovement(ctx, {
      productId,
      movementType: "restored",
      quantity,
      previousBatchQuantity: 0,
      newBatchQuantity: 0,
      previousProductQuantity: product.stockQuantity - quantity,
      newProductQuantity: product.stockQuantity,
      orderId: args.orderId,
      adminId: args.adminId,
      reason: args.reason,
      createdAt: now,
    });
  }

  await ctx.db.patch(args.orderId, { stockReleasedAt: now });
  return { restored, alreadyReleased: false };
}

/**
 * Re-reserve an order whose stock was released after a failed payment, so a
 * customer retrying payment is allocated fresh FEFO units instead of confirming
 * an order that no longer holds stock. Failure rolls the retry back.
 */
export async function ensureStockReserved(
  ctx: MutationCtx,
  args: { orderId: Id<"orders">; reason: string },
): Promise<{ reserved: boolean }> {
  const order = await ctx.db.get(args.orderId);
  if (!order || !order.stockReleasedAt) return { reserved: false };

  await ctx.db.patch(args.orderId, { stockReleasedAt: undefined });
  await reserveStockForOrder(ctx, {
    orderId: args.orderId,
    items: order.items as OrderItem[],
    reason: args.reason,
  });
  return { reserved: true };
}

/** Expired units still held by a product's batches (reported, never sold). */
export async function expiredBatchUnits(
  ctx: MutationCtx,
  productId: Id<"products">,
): Promise<number> {
  const batches = await loadBatches(ctx, productId);
  const now = Date.now();
  return batches
    .filter((batch) => isBatchExpired(batch.expiryDate, now))
    .reduce((sum, batch) => sum + Math.max(0, batch.availableQuantity), 0);
}
