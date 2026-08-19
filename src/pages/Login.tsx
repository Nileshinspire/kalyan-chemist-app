import { useNavigate } from "react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const navigate = useNavigate();

  // Login is handled by the unified /auth page (email OTP)
  useEffect(() => {
    navigate("/auth?returnTo=/dashboard", { replace: true });
  }, [navigate]);

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
