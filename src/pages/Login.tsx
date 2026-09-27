import { useNavigate, useSearchParams } from "react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();

  // Login is handled by the unified /auth page (email OTP).
  // Forward the originally requested destination (e.g. /lab-tests, /refill)
  // so protected pages open after sign-in instead of always /dashboard.
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const returnTo = searchParams.get("returnTo");
    const target =
      returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
        ? `/auth?returnTo=${encodeURIComponent(returnTo)}`
        : "/auth?returnTo=/dashboard";
    navigate(target, { replace: true });
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-primary/[0.03] to-background">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">
          Redirecting to sign-in…
        </p>
      </div>
    </div>
  );
}
