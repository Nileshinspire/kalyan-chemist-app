import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";

export function useAuth() {
  const { isLoading: isAuthLoading, isAuthenticated } = useConvexAuth();
  const user = useQuery(api.users.currentUser);
  const { signIn, signOut } = useAuthActions();

  // Derive isLoading directly from the dependencies instead of managing separate state.
  // `isAuthLoading` tracks only the auth token handshake — the real access-control
  // signal — so callers can render route shells without waiting for the user document.
  const isLoading = isAuthLoading || user === undefined;

  return {
    isAuthLoading,
    isLoading,
    isAuthenticated,
    user,
    signIn,
    signOut,
  };
}
