import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";

/**
 * Authentication state hook.
 *
 * `users.currentUser` resolves the user document from the *current session's*
 * token on the server (`getAuthUserId`), so the only requirement on the client
 * is that Convex holds the right token. The sign-in page guarantees that by
 * ending any previous session before signing in and rebuilding the app on the
 * new tokens afterwards — see `endActiveSession` in pages/Auth.tsx.
 *
 * `undefined` means "still loading"; `null` means "signed out".
 */

export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const user = useQuery(api.users.currentUser);

  return {
    isAuthLoading,
    isLoading: isAuthLoading || user === undefined,
    isAuthenticated,
    user,
    signIn,
    signOut,
  };
}
