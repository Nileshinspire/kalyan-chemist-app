/**
 * Client-side session + auth-navigation hygiene for account switching.
 *
 * Two separate things used to leak the previous customer's page into the next
 * sign-in:
 *
 * 1. `logout()` only cleared the Convex session. The app stayed on the
 *    protected route, `RequireAuth` rewrote it as
 *    `/login?returnTo=<page>` → `/auth?returnTo=<page>`, and the *next* account
 *    was redirected straight back into that page.
 * 2. A stale `/auth?returnTo=/account/notifications` URL can still exist
 *    outside the current tab's state: the browser's history (Back/Forward), a
 *    second tab, or a `RequireAuth` bounce after the session expired. Signing
 *    in there restored the previous customer's private page no matter how
 *    cleanly the logout itself ran.
 *
 * So logging out clears every auth/navigation key AND marks this browser as
 * "account switch pending". The first successful sign-in after that (or any
 * sign-in whose user id differs from the last one seen) ignores `returnTo`,
 * lands on the public homepage, and rebuilds the client so no query cache from
 * the previous account survives.
 */

const AUTH_STORAGE_PREFIX = "__convexAuth";
/** Token kept by the legacy REST helper in services/api.ts. */
const LEGACY_TOKEN_KEY = "kc_token";

/** Last user id this browser authenticated (survives a tab/reload). */
const LAST_USER_KEY = "kc_auth_last_user_id";
/** Set on logout / account switch; consumed by the next successful sign-in. */
const SWITCH_PENDING_KEY = "kc_auth_switch_pending";

function storageTargets(): Storage[] {
  const targets: Storage[] = [];
  try {
    targets.push(window.localStorage);
  } catch {
    // Storage blocked (private mode / policy) — nothing to clear here.
  }
  try {
    targets.push(window.sessionStorage);
  } catch {
    // ignore
  }
  return targets;
}

function readKey(key: string): string | null {
  if (typeof window === "undefined") return null;
  for (const store of storageTargets()) {
    try {
      const value = store.getItem(key);
      if (value !== null) return value;
    } catch {
      // ignore
    }
  }
  return null;
}

function writeKey(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  for (const store of storageTargets()) {
    try {
      if (value === null) store.removeItem(key);
      else store.setItem(key, value);
    } catch {
      // ignore
    }
  }
}

/** Remove every auth token this browser stored for the signed-in account. */
export function clearStoredAuthTokens() {
  if (typeof window === "undefined") return;
  for (const store of storageTargets()) {
    try {
      for (const key of Object.keys(store)) {
        if (key.startsWith(AUTH_STORAGE_PREFIX) || key === LEGACY_TOKEN_KEY) {
          store.removeItem(key);
        }
      }
    } catch {
      // A storage error must never block signing out.
    }
  }
}

/**
 * Drop navigation state that belongs to the session that just ended: pending
 * redirect paths, the deep-linked notification id and per-account UI markers.
 * The last-user id is kept on purpose — it is what lets the next sign-in detect
 * that a *different* account is taking over.
 */
export function clearAuthNavigationState() {
  if (typeof window === "undefined") return;
  for (const store of storageTargets()) {
    try {
      for (const key of Object.keys(store)) {
        if (key === "kc_return_to" || key === "kc_selected_notification") {
          store.removeItem(key);
        }
      }
    } catch {
      // ignore
    }
  }
}

/**
 * Called on logout and whenever an existing session is ended to sign in again.
 * The marker is consumed by the next successful sign-in.
 */
export function markAccountSwitchPending() {
  clearAuthNavigationState();
  writeKey(SWITCH_PENDING_KEY, "1");
}

export interface AccountSwitchState {
  /** A logout / ended session is waiting for the next sign-in. */
  pending: boolean;
  /** User id this browser authenticated before (null for a first sign-in). */
  previousUserId: string | null;
  /** The signed-in account is different from the one seen before. */
  differentUser: boolean;
}

/**
 * Read + consume the account-switch marker and remember the new identity.
 * Called exactly once per successful sign-in.
 */
export function consumeAccountSwitch(
  newUserId?: string | null,
): AccountSwitchState {
  const pending = readKey(SWITCH_PENDING_KEY) === "1";
  const previousUserId = readKey(LAST_USER_KEY);
  const differentUser =
    Boolean(previousUserId) && Boolean(newUserId) && previousUserId !== newUserId;

  writeKey(SWITCH_PENDING_KEY, null);
  if (newUserId) writeKey(LAST_USER_KEY, newUserId);
  return { pending, previousUserId, differentUser };
}

/**
 * Send the browser back to the public home page with a fresh client.
 *
 * `location.replace` overwrites the current history entry (so the protected
 * page / auth URL cannot be reached again with the Back button) and reloads, so
 * nothing user-scoped — route, open dialog, Convex query cache — survives.
 */
export function resetClientSession(redirectTo = "/") {
  if (typeof window === "undefined") return;
  const target = redirectTo.startsWith("/") ? redirectTo : "/";
  const base = `${window.location.pathname}${window.location.search}`;
  try {
    // `replaceState` rewrites the current entry without firing a hashchange, so
    // the router cannot race us and bounce the signed-out user back to
    // `/login?returnTo=<old page>`. The reload below then starts the app clean.
    window.history.replaceState(null, "", `${base}#${target}`);
  } catch {
    window.location.hash = `#${target}`;
  }
  window.location.reload();
}

/** True between a logout / ended session and the next successful sign-in. */
export function isAccountSwitchPending(): boolean {
  return readKey(SWITCH_PENDING_KEY) === "1";
}

/**
 * Routes that show one customer's private data. A stale `returnTo` pointing at
 * one of these must never be used to land a *different* account after sign-in.
 */
const CUSTOMER_PRIVATE_ROUTE =
  /^\/(?:account(?:\/|$)|dashboard(?:\/|$)|orders(?:\/|$)|wishlist(?:\/|$)|checkout(?:\/|$)|upload-prescription(?:\/|$)|refill(?:\/|$)|chatbot(?:\/|$)|lab-tests(?:\/|$)|doctor-appointment(?:\/|$)|my-)/;

export function isCustomerPrivateRoute(path: string): boolean {
  return CUSTOMER_PRIVATE_ROUTE.test(path);
}

/**
 * Where should a just-authenticated user land?
 *
 * - After a logout / ended session: the homepage, always.
 * - A different account never restores a private customer page.
 * - A first-time guest sign-in keeps its deep link (cart, product, …).
 * - Admins keep their explicit admin destination.
 */
export function decidePostSignInDestination({
  state,
  userId,
  role,
  redirect,
}: {
  state: AccountSwitchState;
  userId?: string | null;
  role?: string | null;
  redirect: string;
}): { path: string; forceHome: boolean } {
  if (role === "admin") return { path: redirect, forceHome: false };
  // The account home is the generic dashboard every customer may see after
  // signing in — it holds no record id, so it is safe even after a switch.
  // Deeper private pages (a specific order, another account's notification)
  // keep the existing forced-home protection.
  const isAccountHome = /^\/account\/?$/.test(redirect);
  const forceHome =
    !isAccountHome &&
    (state.pending || (state.differentUser && isCustomerPrivateRoute(redirect)));
  return { path: forceHome ? "/" : redirect, forceHome };
}
