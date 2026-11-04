/**
 * Client-side session hygiene for account switching.
 *
 * Logging out used to clear only the Convex session. The app stayed on the
 * current protected route, so `RequireAuth` re-rendered the signed-out user as
 * `/login?returnTo=<previous user's page>` — and the *next* account was then
 * redirected straight back into that page (e.g. the Notifications screen) with
 * the previous user's client-side query cache still in memory.
 *
 * `resetClientSession` lands the browser on a public route and rebuilds the app
 * so nothing user-scoped (route, dialog state, Convex query cache) survives.
 */

const AUTH_STORAGE_PREFIX = "__convexAuth";
/** Token kept by the legacy REST helper in services/api.ts. */
const LEGACY_TOKEN_KEY = "kc_token";

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
 * Send the browser back to the public home page with a fresh client.
 *
 * The hash is rewritten *before* the reload so a `returnTo` written during the
 * auth-state flip cannot be reloaded, and the resulting document starts with no
 * in-memory Convex cache from the previous account.
 */
export function resetClientSession(redirectTo = "/") {
  if (typeof window === "undefined") return;
  const target = redirectTo.startsWith("/") ? redirectTo : "/";
  window.location.hash = `#${target}`;
  window.location.reload();
}
