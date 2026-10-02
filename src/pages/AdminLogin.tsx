import { useNavigate, useSearchParams } from "react-router";
import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

function AdminLoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, isAdmin, isLoading, user } = useAuth();

  // When the admin login page itself becomes authenticated (for example after an
  // in-page sign-in flow completes on /admin/login), keep the default landing on
  // the admin panel and still honor any explicit admin returnTo.
  const handledRef = useRef(false);

  // Determine the correct post-sign-in destination for an administrator.
  // Explicit admin `returnTo` is always honored. Otherwise an admin sign-in
  // always ends up on the admin panel, never on the customer Account page.
  const desiredAdminReturnTo = (() => {
    // Read the query from the router, not `window.location.search`: this app
    // runs on a HashRouter, so `/admin/login?returnTo=...` lives in the hash
    // fragment and would otherwise be invisible here.
    const raw = searchParams.get("returnTo");
    if (raw?.startsWith("/") && !raw.startsWith("//")) {
      return raw;
    }
    return "/admin";
  })();

  // Wait only until the user document is *known* (`undefined` = still loading).
  // A resolved `null` means "not signed in" and must redirect to sign-in, so it
  // must NOT block the decision. Guessing while the document is still loading
  // would send a real admin to the home page and lock them out of the admin
  // flow, because `handledRef.current` would already be true.
  const isUserReady = user !== undefined;

  useEffect(() => {
    if (isLoading || handledRef.current) {
      return;
    }

    if (!isUserReady) {
      // User document still loading — wait for it before deciding.
      return;
    }

    if (isAuthenticated && isAdmin) {
      handledRef.current = true;
      // Already an authenticated admin — send them to the admin panel.
      // Honor an explicit admin returnTo (e.g. /admin/products) when present,
      // otherwise land on the admin dashboard by default.
      navigate(desiredAdminReturnTo, { replace: true });
      return;
    }

    if (!isAuthenticated) {
      // Send the admin to the shared sign-in page first.
      // Preserve an explicit admin returnTo, otherwise default to /admin.
      navigate(
        `/auth?returnTo=${encodeURIComponent(desiredAdminReturnTo)}`,
        { replace: true },
      );
      return;
    }

    // Authenticated but not an admin: keep them out of the admin flow.
    // This branch is defensive; RequireAuth already blocks non-admins from
    // protected admin routes. A normal customer must not be treated as an admin.
    navigate("/", { replace: true });
  }, [isLoading, isUserReady, isAuthenticated, isAdmin, navigate, desiredAdminReturnTo]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary/[0.03] to-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Redirecting to admin sign-in…
        </p>
      </div>
    </div>
  );
}

export default AdminLoginPage;
