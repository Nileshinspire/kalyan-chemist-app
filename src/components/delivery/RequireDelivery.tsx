import { Suspense, type ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { useAuthActions } from "@convex-dev/auth/react";
import { ShieldAlert } from "lucide-react";
import RouteLoading from "@/components/RouteLoading";
import { useAuth } from "@/context/AuthContext";

/**
 * Delivery dashboard access control.
 *
 * Unauthenticated visitors are sent to the dedicated delivery login with the
 * requested path preserved. Signed-in customers/admins are denied: only the
 * `delivery` role can read assignments or share GPS.
 */
export function RequireDelivery({ children }: { children: ReactNode }) {
  const { isAuthLoading, isAuthenticated, user } = useAuth();
  const { signOut } = useAuthActions();
  const location = useLocation();
  const navigate = useNavigate();

  if (isAuthLoading || (isAuthenticated && user === undefined)) {
    return <RouteLoading />;
  }

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}`;
    return (
      <Navigate
        to={`/delivery/login?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  if (user?.role !== "delivery") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
            <ShieldAlert className="size-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Delivery access only</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This account is not registered as a delivery partner. Sign in with the
            delivery partner account created by the pharmacy.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              onClick={async () => {
                try {
                  await signOut();
                } finally {
                  navigate("/delivery/login", { replace: true });
                }
              }}
            >
              Sign in as delivery partner
            </button>
            <button
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              onClick={() => navigate("/")}
            >
              Return to store
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <Suspense fallback={<RouteLoading />}>{children}</Suspense>;
}
