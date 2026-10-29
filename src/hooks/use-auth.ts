import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";

/**
 * Authentication state hook.
 *
 * WHY THE QUERY IS RE-KEYED
 *
 * The signed-in identity comes from `api.users.currentUser`, a Convex query
 * that resolves the `users` document for the *current* session. A Convex
 * subscription is identified by (function name, arguments), so a no-argument
 * query has nothing that changes when the session changes — the previous
 * account's document can outlive its session in the UI (sign out → still see
 * the old admin; sign in as someone else → still see the old admin).
 *
 * The fix: pass an `authKey` derived from the live auth session
 * (`useConvexAuth`). On every session transition the key changes, which
 * discards the old subscription and starts a fresh execution under whatever
 * identity the client currently holds. `undefined` is returned while that
 * fresh execution is in flight, which is the "still loading" signal consumers
 * (RequireAuth, Auth) already wait on — so a stale document is never rendered.
 *
 * `authKey` is only a cache key; authorization and the identity lookup stay
 * server-side in `users.currentUser` via `getAuthUserId`.
 */
export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();

  // Three stable keys: the session handshake in flight, signed in, signed out.
  // Any sign-in/sign-out/account-switch moves between them, re-keying the query.
  const authKey = isAuthLoading
    ? "loading"
    : isAuthenticated
      ? "authenticated"
      : "anonymous";

  // `undefined` while the (re-keyed) query executes; `null` once the server
  // confirms there is no signed-in user.
  const user = useQuery(api.users.currentUser, { authKey });

  return {
    isAuthLoading,
    isLoading: isAuthLoading || user === undefined,
    isAuthenticated,
    user,
    signIn,
    signOut,
  };
}
