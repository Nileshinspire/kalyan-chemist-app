import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/context/AuthContext";
import { clearPendingCart, readPendingCart } from "@/lib/pending-cart";

/**
 * Hands a guest's staged cart selections to the signed-in account.
 *
 * Mounted once at the app root. When an authenticated user appears, every line
 * the guest staged before signing in is added through the existing
 * `cart.addItem` mutation — the customer's normal server cart, no parallel
 * cart. The staged list is cleared before the calls so a re-render (or a
 * StrictMode remount) can never add the same product twice.
 */
export default function CartHandoff() {
  const { isAuthenticated, isAuthLoading, user } = useAuth();
  const addItem = useMutation(api.cart.addItem);
  const handledFor = useRef<string | null>(null);

  useEffect(() => {
    if (isAuthLoading || !isAuthenticated || !user?._id) return;
    if (handledFor.current === user._id) return;
    handledFor.current = user._id;

    const pending = readPendingCart();
    if (pending.length === 0) return;
    clearPendingCart();

    let cancelled = false;
    (async () => {
      for (const line of pending) {
        if (cancelled) return;
        try {
          await addItem({
            productId: line.productId as any,
            quantity: line.quantity,
            ...(line.kitSelection ? { kitSelection: line.kitSelection as any } : {}),
          });
        } catch {
          // The product may have gone out of stock meanwhile; the rest of the
          // hand-off still runs and the cart page reports its real state.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [addItem, isAuthLoading, isAuthenticated, user?._id]);

  return null;
}
