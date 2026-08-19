import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

/**
 * Backend-enforced check: does the user need a prescription for their cart,
 * and if so, do they have an approved one?
 *
 * Returns { needsPrescription, hasApprovedPrescription, rxProducts }
 */
export const validateCartPrescription = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return { needsPrescription: false, hasApprovedPrescription: false, rxProducts: [] };
    }

    // Get cart items
    const cartItems = await ctx.db
      .query("cart_items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Find prescription-required products in cart
    const rxProducts: string[] = [];
    for (const item of cartItems) {
      const product = await ctx.db.get(item.productId);
      if (product && product.prescriptionRequired && product.isActive) {
        rxProducts.push(product.name);
      }
    }

    const needsPrescription = rxProducts.length > 0;

    // Check for approved prescription
    let hasApprovedPrescription = false;
    if (needsPrescription) {
      const approved = await ctx.db
        .query("prescriptions")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", userId).eq("status", "approved")
        )
        .first();
      hasApprovedPrescription = approved !== null;
    }

    return {
      needsPrescription,
      hasApprovedPrescription,
      rxProducts,
    };
  },
});
