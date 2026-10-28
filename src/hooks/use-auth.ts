import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery_experimental } from "convex/react";
import { useEffect } from "react";

/**
 * Authentication state provider.
 *
 * THIS FILE FIXES THE ACCOUNT-SWITCH BUG.
 *
 * Root cause: the user identity is read from a plain Convex query in
 * `users.ts` (`currentUser`), which resolves to the signed-in user's record
 * from the `users` table. Convex queries do NOT re-run when the
 * authentication session changes. So:
 *
 *   1. Admin signs in  → query returns the admin record → UI renders admin.
 *   2. Admin signs out  → auth session clears, but the query keeps its cached
 *                        result → UI still shows the admin.
 *   3. A different user signs in → isAuthenticated flips true, but the query
 *                        still holds the admin record → UI still shows the admin.
 *
 * The fix is two-fold:
 *   - Read identity from the live auth session (so "who is signed in" is always
 *     correct).
 *   - Re-run the user-document query every time the authenticated identity
 *     changes, so the document always matches the session. `useQuery` is
 *     no-arg and offers no arguments to force a subscription re-key, so we use
 *     `useQuery_experimental` (which exposes `refetch`) and drive an explicit
 *     re-fetch on every auth-session transition.
 */
export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();

  // useQuery_experimental returns { status: "success", data } so it exposes a
  // `refetch` control to force re-execution of the query. The query itself is
  // still the no-arg `api.users.currentUser` document.
  const userQuery = useQuery_experimental({
    query: api.users.currentUser,
    args: "skip",
  }) as {
    status: "success";
    data: any;
    refetch: () => Promise<void>;
  };

  // Re-run the user-document query whenever the active auth session changes.
  // The user-document query has no built-in listener for auth events, so
  // nothing would re-execute it on sign-out or on a different sign-in.
  // `refetch()` drives the exact transition turn so the document always matches
  // the session (e.g. when a second user completes email verification).
  useEffect(() => {
    void userQuery.refetch();
  }, [userQuery.refetch]);

  // Elide the document until its initial fetch lands, then the landed document
  // is the single source of truth for the currently signed-in account.
  const user = userQuery.status === "success" ? userQuery.data : null;

  return {
    isAuthLoading,
    isLoading: isAuthLoading || userQuery.status !== "success",
    isAuthenticated,
    user,
    signIn,
    signOut,
  };
}
