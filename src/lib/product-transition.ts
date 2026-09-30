/**
 * Product navigation transition.
 *
 * Clicking a product card used to flash the old page (and its footer) before
 * the Product Details page opened: react-router v7 keeps the current route
 * mounted inside a startTransition until the next one commits, so the listing
 * — including the footer at the bottom of the page — stayed on screen for
 * every frame between the click and the commit.
 *
 * The veil is opened the instant a product navigation *starts* (before the
 * router updates the URL) and lifted once any navigation commits:
 *   - `beginProductTransition()` — synchronous, called from the click handler.
 *   - `useProductTransitionVeil()` — inside the router, lifts the veil on the
 *     first paint of the committed route (product or an auth redirect) and
 *     re-arms the state for the next click. A fallback timer guarantees the
 *     veil can never outlive a navigation that never happens.
 */
import { useLayoutEffect } from "react";
import { useLocation } from "react-router";

const VEIL_CLASS = "product-transition";
const FALLBACK_MS = 3000;

let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

function openVeil(): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.add(VEIL_CLASS);
}

function closeVeil(): void {
  if (fallbackTimer) {
    clearTimeout(fallbackTimer);
    fallbackTimer = null;
  }
  if (typeof document !== "undefined") {
    document.documentElement.classList.remove(VEIL_CLASS);
  }
}

/**
 * Called from a product click handler, before `navigate()`. Opens the veil so
 * the current page (footer included) is never visible after this moment.
 */
export function beginProductTransition(): void {
  openVeil();
  // Safety net: if the navigation is aborted (handler returns early, a guard
  // redirects and React never commits a new location) the veil lifts on its
  // own instead of freezing the page behind an opaque screen.
  if (fallbackTimer) clearTimeout(fallbackTimer);
  if (typeof setTimeout === "function") {
    fallbackTimer = setTimeout(closeVeil, FALLBACK_MS);
  }
}

/**
 * Mount inside the HashRouter. Lifts the veil as soon as the navigation
 * commits — product route or not — and clears the fallback timer.
 */
export function useProductTransitionVeil(): void {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    // Any committed navigation ends the transition. Closing an already-closed
    // veil is a no-op, so this is safe on back/forward restores too.
    closeVeil();
  }, [pathname]);
}

/** Test hook: reset the module state between tests. */
export function resetProductTransitionForTests(): void {
  if (typeof document !== "undefined") {
    document.documentElement.classList.remove(VEIL_CLASS);
  }
}
