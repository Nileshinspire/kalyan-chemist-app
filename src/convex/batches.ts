import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { notifyRestockWaiters } from "./restockAlerts";
import { isBatchExpired } from "./batchAllocationCore";

/**
 * Admin batch-wise inventory backend.
 *
 * This is additive: the existing Inventory Management screen still reads and
 * writes `products.stockQuantity` through `adminInventory.list` / `adjustStock`
 * and the existing Expiring Medicines screen still reads `products.expiryDate`.
 * These functions add the per-batch detail behind that total, so no screen had
 * to be redesigned.
 *
 * Guarantees:
 *  - Receiving a batch never overwrites another batch's expiry or quantity. A
 *    repeat delivery of the same batch number is added to that batch only when
 *    the expiry date agrees; a mismatch is refused for the admin to verify.
 *  - Batch numbers, manufacturing dates and expiry dates are only ever what an
 *    admin supplies — nothing is invented for existing stock.
 *  - Expired batches are kept (and reported), never deleted, and never sold.
 */

async function requireAdmin(ctx: { db: any; auth: any }) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (user?.role !== "admin") throw new Error("Not authorized");
  return userId as any;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Admin: receive a batch of a product.
 *
 * Adds a new batch row (or tops up the matching one) and raises the product's
 * sellable total by the same quantity, in one transaction.
 */
export const receiveBatch = mutation({
  args: {
    productId: v.id("products"),
    quantity: v.number(),
    batchNumber: v.optional(v.string()),
    manufacturingDate: v.optional(v.number()),
    expiryDate: v.optional(v.number()),
    purchasePrice: v.optional(v.number()),
    supplier: v.optional(v.string()),
    supplierRef: v.optional(v.string()),
    stockReceivedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
    reason: v.optional(v.string()),
    /**
     * Set only when the admin is recording stock that could not be reliably
     * mapped to a real batch. Such units are held out of selling and listed
     * for verification instead of being assigned an invented batch/expiry.
     */
    needsVerification: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const quantity = Math.floor(args.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new Error("Received quantity must be a positive whole number");
    }

    if (args.expiryDate !== undefined) {
      if (!Number.isFinite(args.expiryDate) || args.expiryDate <= 0) {
        throw new Error("Invalid expiry date");
      }
    }
    if (args.manufacturingDate !== undefined) {
      if (!Number.isFinite(args.manufacturingDate) || args.manufacturingDate <= 0) {
        throw new Error("Invalid manufacturing date");
      }
      if (args.expiryDate !== undefined && args.manufacturingDate > args.expiryDate) {
        throw new Error("Manufacturing date cannot be after the expiry date");
      }
    }
    if (args.purchasePrice !== undefined && (!Number.isFinite(args.purchasePrice) || args.purchasePrice < 0)) {
      throw new Error("Invalid purchase price");
    }

    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    const now = Date.now();
    const batchNumber = args.batchNumber?.trim() || undefined;

    // Same batch number → same physical batch. Only a matching expiry may be
    // topped up; a different expiry is a data conflict, never an overwrite.
    let existing = null as any;
    if (batchNumber) {
      const candidates = await ctx.db
        .query("product_batches")
        .withIndex("by_batchNumber", (q: any) => q.eq("batchNumber", batchNumber))
        .collect();
      existing =
        candidates.find(
          (batch: any) =>
            batch.productId === args.productId &&
            (batch.expiryDate ?? null) === (args.expiryDate ?? null),
        ) ?? null;

      const conflicting = candidates.find(
        (batch: any) =>
          batch.productId === args.productId &&
          (batch.expiryDate ?? null) !== (args.expiryDate ?? null),
      );
      if (!existing && conflicting) {
        throw new Error(
          `Batch "${batchNumber}" is already recorded for this product with a different expiry date. Verify the batch details before receiving — an existing batch's expiry is never overwritten.`,
        );
      }
    }

    let batchId;
    let previousBatchQuantity = 0;
    let newBatchQuantity = quantity;
    const needsVerification = args.needsVerification === true;

    if (existing) {
      previousBatchQuantity = existing.availableQuantity;
      newBatchQuantity = previousBatchQuantity + quantity;
      batchId = existing._id;
      await ctx.db.patch(existing._id, {
        receivedQuantity: existing.receivedQuantity + quantity,
        availableQuantity: newBatchQuantity,
        manufacturingDate: existing.manufacturingDate ?? args.manufacturingDate,
        purchasePrice: existing.purchasePrice ?? args.purchasePrice,
        supplier: existing.supplier ?? args.supplier,
        supplierRef: existing.supplierRef ?? args.supplierRef,
        notes: args.notes ?? existing.notes,
        updatedAt: now,
      });
    } else {
      batchId = await ctx.db.insert("product_batches", {
        productId: args.productId,
        batchNumber,
        manufacturingDate: args.manufacturingDate,
        expiryDate: args.expiryDate,
        receivedQuantity: quantity,
        availableQuantity: quantity,
        purchasePrice: args.purchasePrice,
        supplier: args.supplier,
        supplierRef: args.supplierRef,
        stockReceivedAt: args.stockReceivedAt ?? now,
        notes: args.notes,
        needsVerification: needsVerification || undefined,
        createdAt: now,
        updatedAt: now,
      });
    }

    const previousQuantity = product.stockQuantity;
    const newQuantity = previousQuantity + quantity;
    await ctx.db.patch(args.productId, {
      stockQuantity: newQuantity,
      updatedAt: now,
    });

    const reason = args.reason?.trim() || (existing ? "Batch received (top-up)" : "Batch received");

    await ctx.db.insert("inventory_logs", {
      productId: args.productId,
      previousQuantity,
      newQuantity,
      adjustment: quantity,
      reason,
      adminId,
      createdAt: now,
      batchId,
      batchNumber,
    });

    await ctx.db.insert("batch_stock_movements", {
      productId: args.productId,
      batchId,
      batchNumber,
      movementType: "received",
      quantity,
      previousBatchQuantity,
      newBatchQuantity,
      previousProductQuantity: previousQuantity,
      newProductQuantity: newQuantity,
      adminId,
      reason,
      createdAt: now,
    });

    // Existing restock behaviour: 0 → >0 notifies waiting customers. The shared
    // helper is idempotent, so a repeat receipt cannot duplicate a notification.
    let notifiedCount = 0;
    if (previousQuantity === 0 && newQuantity > 0) {
      const result = await notifyRestockWaiters(ctx, args.productId);
      notifiedCount = result.notified;
    }

    return {
      success: true,
      batchId,
      batchNumber: batchNumber ?? null,
      toppedUp: Boolean(existing),
      previousQuantity,
      newQuantity,
      notifiedCount,
    };
  },
});

/**
 * Admin: adjust one batch (damage, expiry write-off, stock-take correction).
 *
 * The product total moves by exactly the same delta, so the Inventory screen
 * and the batch ledger can never disagree because of this path.
 */
export const adjustBatch = mutation({
  args: {
    batchId: v.id("product_batches"),
    newQuantity: v.number(),
    reason: v.string(),
    movementType: v.optional(
      v.union(
        v.literal("damaged"),
        v.literal("expired"),
        v.literal("adjustment"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const newQuantity = Math.floor(args.newQuantity);
    if (!Number.isFinite(newQuantity) || newQuantity < 0) {
      throw new Error("Batch quantity cannot be negative");
    }
    if (!args.reason.trim()) throw new Error("A reason is required");

    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new Error("Batch not found");

    const product = await ctx.db.get(batch.productId);
    if (!product) throw new Error("Product not found");

    const previousBatchQuantity = batch.availableQuantity;
    const delta = newQuantity - previousBatchQuantity;
    if (delta === 0) {
      return { success: true, changed: false, adjustment: 0 };
    }

    const previousQuantity = product.stockQuantity;
    const newProductQuantity = previousQuantity + delta;
    if (newProductQuantity < 0) {
      throw new Error("Adjustment would make the product stock negative");
    }

    const now = Date.now();
    const movementType = args.movementType ?? "adjustment";

    await ctx.db.patch(batch._id, {
      availableQuantity: newQuantity,
      updatedAt: now,
    });
    await ctx.db.patch(product._id, {
      stockQuantity: newProductQuantity,
      updatedAt: now,
    });

    await ctx.db.insert("inventory_logs", {
      productId: product._id,
      previousQuantity,
      newQuantity: newProductQuantity,
      adjustment: delta,
      reason: args.reason.trim(),
      adminId,
      createdAt: now,
      batchId: batch._id,
      batchNumber: batch.batchNumber,
    });

    await ctx.db.insert("batch_stock_movements", {
      productId: product._id,
      batchId: batch._id,
      batchNumber: batch.batchNumber,
      movementType,
      quantity: Math.abs(delta),
      previousBatchQuantity,
      newBatchQuantity: newQuantity,
      previousProductQuantity: previousQuantity,
      newProductQuantity,
      adminId,
      reason: args.reason.trim(),
      createdAt: now,
    });

    let notifiedCount = 0;
    if (previousQuantity === 0 && newProductQuantity > 0) {
      const result = await notifyRestockWaiters(ctx, product._id);
      notifiedCount = result.notified;
    }

    return {
      success: true,
      changed: true,
      adjustment: delta,
      previousBatchQuantity,
      newBatchQuantity: newQuantity,
      previousProductQuantity: previousQuantity,
      newProductQuantity,
      notifiedCount,
    };
  },
});

/** Admin: every batch of one product, newest expiry last, with derived state. */
export const listForProduct = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const batches = await ctx.db
      .query("product_batches")
      .withIndex("by_product", (q) => q.eq("productId", args.productId))
      .collect();

    const now = Date.now();
    const rows = batches
      .map((batch) => ({
        ...batch,
        expired: isBatchExpired(batch.expiryDate, now),
        daysUntilExpiry:
          batch.expiryDate !== undefined
            ? Math.ceil((batch.expiryDate - now) / DAY_MS)
            : null,
      }))
      .sort((a, b) => {
        const aExpiry = a.expiryDate ?? Number.POSITIVE_INFINITY;
        const bExpiry = b.expiryDate ?? Number.POSITIVE_INFINITY;
        if (aExpiry !== bExpiry) return aExpiry - bExpiry;
        return a.stockReceivedAt - b.stockReceivedAt;
      });

    const sellableUnits = rows
      .filter((row) => !row.expired && !row.needsVerification)
      .reduce((sum, row) => sum + row.availableQuantity, 0);
    const expiredUnits = rows
      .filter((row) => row.expired)
      .reduce((sum, row) => sum + row.availableQuantity, 0);

    return {
      batches: rows,
      sellableUnits,
      expiredUnits,
      totalAvailable: rows.reduce((sum, row) => sum + row.availableQuantity, 0),
    };
  },
});

/**
 * Admin: stock that has no batch behind it, i.e. stock that cannot be reliably
 * mapped to a batch. Nothing is rewritten — these products are simply flagged
 * so the admin can verify and enter the real batch details.
 */
export const unbatchedStock = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const products = await ctx.db
      .query("products")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    const flagged: {
      productId: string;
      name: string;
      batchNumber: string | null;
      stockQuantity: number;
      unbatchedQuantity: number;
      expiryDate: number | null;
      reason: string;
    }[] = [];

    for (const product of products) {
      if (product.stockQuantity <= 0) continue;
      const batches = await ctx.db
        .query("product_batches")
        .withIndex("by_product", (q) => q.eq("productId", product._id))
        .collect();
      const tracked = batches.reduce(
        (sum, batch) => sum + Math.max(0, batch.availableQuantity),
        0,
      );
      const unbatched = Math.max(0, product.stockQuantity - tracked);
      if (unbatched > 0) {
        flagged.push({
          productId: product._id,
          name: product.name,
          batchNumber: null,
          stockQuantity: product.stockQuantity,
          unbatchedQuantity: unbatched,
          expiryDate: product.expiryDate ?? null,
          reason: batches.length === 0
            ? "Stock predates batch tracking — batch number and expiry need verification"
            : "Part of this product's stock is not covered by any batch — verify the delivered batches",
        });
      }
    }

    return flagged;
  },
});

/** Admin: batch-level movement history (receipts, reserves, restores, write-offs). */
export const movements = query({
  args: {
    productId: v.optional(v.id("products")),
    orderId: v.optional(v.id("orders")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = args.limit ?? 50;
    let rows;
    if (args.orderId) {
      rows = await ctx.db
        .query("batch_stock_movements")
        .withIndex("by_order", (q) => q.eq("orderId", args.orderId!))
        .order("desc")
        .take(limit);
    } else if (args.productId) {
      rows = await ctx.db
        .query("batch_stock_movements")
        .withIndex("by_product", (q) => q.eq("productId", args.productId!))
        .order("desc")
        .take(limit);
    } else {
      rows = await ctx.db
        .query("batch_stock_movements")
        .withIndex("by_createdAt")
        .order("desc")
        .take(limit);
    }

    return await Promise.all(
      rows.map(async (row) => {
        const admin = row.adminId ? await ctx.db.get(row.adminId) : null;
        const product = await ctx.db.get(row.productId);
        return {
          ...row,
          productName: product?.name ?? "Unknown",
          adminName: admin?.name ?? null,
          adminId: row.adminId ?? null,
        };
      }),
    );
  },
});
