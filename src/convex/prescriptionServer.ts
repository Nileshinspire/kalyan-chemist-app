import type { QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  evaluatePrescriptionUsage,
  type PrescriptionUsage,
} from "./prescriptionCore";

/**
 * Prescription-required product IDs that this prescription has already been
 * used for in previous orders. The prescription record itself is never cloned
 * or duplicated — the link lives on the order.
 */
export async function loadLinkedRxProductIds(
  ctx: QueryCtx,
  prescriptionId: Id<"prescriptions">,
): Promise<string[]> {
  const orders = await ctx.db
    .query("orders")
    .withIndex("by_prescription", (q) => q.eq("prescriptionId", prescriptionId))
    .collect();

  const productIds = new Set<string>();
  for (const order of orders) {
    for (const item of order.items) {
      const product = await ctx.db.get(item.productId);
      if (product?.prescriptionRequired) {
        productIds.add(item.productId as string);
      }
    }
  }
  return [...productIds];
}

/**
 * Load a prescription owned by `userId` and decide whether it may be attached
 * to the order being placed. Throws when the record does not belong to the
 * customer, so a prescription ID can never be reused across accounts.
 */
export async function loadPrescriptionUsage(
  ctx: QueryCtx,
  userId: Id<"users">,
  prescriptionId: Id<"prescriptions">,
  requiredProductIds: string[],
): Promise<{
  prescription: Doc<"prescriptions">;
  usage: PrescriptionUsage;
}> {
  const prescription = await ctx.db.get(prescriptionId);
  if (!prescription || prescription.userId !== userId) {
    throw new Error("Prescription not found in your account.");
  }

  const linkedProductIds = await loadLinkedRxProductIds(ctx, prescriptionId);
  const usage = evaluatePrescriptionUsage({
    status: prescription.status,
    prescriptionDate: prescription.prescriptionDate,
    createdAt: prescription.createdAt,
    linkedProductIds,
    requiredProductIds,
    now: Date.now(),
  });

  return { prescription, usage };
}
