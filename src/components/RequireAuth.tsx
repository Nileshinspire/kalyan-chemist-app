import { Suspense, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useBrowserNotifications } from "@/hooks/useBrowserNotifications";
import { Navigate, useLocation, useNavigate } from "react-router";
import RouteLoading from "@/components/RouteLoading";

interface RequireAuthProps {
  children: ReactNode;
  adminOnly?: boolean;
}

export function RequireAuth({ children, adminOnly = false }: RequireAuthProps) {
  const { isAuthLoading, isAuthenticated, isAdmin, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Must run on every render (rules of hooks) — the guard moves inside the hook.
  useBrowserNotifications(isAuthenticated && !isAuthLoading);

  // Wait only for the auth token handshake — the real access-control signal.
  // We deliberately do NOT wait for the user document here, so a protected
  // page shell renders immediately and fills its own data in progressively.
  if (isAuthLoading) {
    return <RouteLoading />;
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    if (adminOnly) {
      return (
        <Navigate
          to={`/admin/login?returnTo=${encodeURIComponent(returnTo)}`}
          replace
        />
      );
    }
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  if (adminOnly) {
    // Admin access is derived from the user document, so wait for that one
    // query before deciding. This never weakens the check — it only orders it
    // correctly — and it applies to admin screens only.
    if (user === undefined) {
      return <RouteLoading />;
    }

    if (!isAdmin) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
          <div className="text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
              <svg className="size-8 text-destructive" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-foreground">Access Denied</h1>
            <p className="text-sm text-muted-foreground mt-1">
              You do not have administrator privileges.
            </p>
            <button
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              onClick={() => navigate("/")}
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }
  }

  // Scope the Suspense boundary to this route's content so the lazy admin/auth
  // screens can never blank out the whole application. Eager customer routes
  // never suspend, so they render with no loading state at all.
  return <Suspense fallback={<RouteLoading />}>{children}</Suspense>;
}
