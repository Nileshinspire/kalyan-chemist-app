import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

/**
 * Shared restock notifier.
 *
 * Called by every admin path that can raise a product's stock from zero
 * (the Inventory adjustment and the product editor). It only ever touches rows
 * that are still `waiting`, so running it twice — or from two admin screens —
 * cannot produce a second notification for the same subscription.
 */
export async function notifyRestockWaiters(
  ctx: MutationCtx,
  productId: Id<"products">,
): Promise<{ notified: number }> {
  const product = await ctx.db.get(productId);
  if (!product || product.stockQuantity <= 0) return { notified: 0 };

  const waiting = await ctx.db
    .query("availability_notifications")
    .withIndex("by_product_status", (q) =>
      q.eq("productId", productId).eq("status", "waiting"),
    )
    .collect();

  if (waiting.length === 0) return { notified: 0 };

  const now = Date.now();
  const usersNotified = new Set<string>();
  let notified = 0;

  for (const subscription of waiting) {
    // Re-check inside the loop: a legacy duplicate row must not double-notify.
    if (subscription.status !== "waiting") continue;

    await ctx.db.patch(subscription._id, {
      status: "notified",
      notifiedAt: now,
    });

    if (subscription.userId) {
      const userKey = subscription.userId as unknown as string;
      if (!usersNotified.has(userKey)) {
        usersNotified.add(userKey);
        await ctx.db.insert("notifications", {
          userId: subscription.userId,
          type: "system",
          title: `${product.name} is back in stock`,
          body: `Good news — ${product.name} is available again at Kalyan Chemist. Order it before it sells out.`,
          read: false,
          link: `/products/${product.slug}`,
          metadata: JSON.stringify({
            kind: "restock_alert",
            productId,
            availabilityNotificationId: subscription._id,
          }),
          createdAt: now,
        });
      }
    }

    notified++;
  }

  return { notified };
}
