import { useNavigate } from "react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

function AdminLoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated && isAdmin) {
      navigate("/admin", { replace: true });
    } else if (!isLoading && !isAuthenticated) {
      // Redirect to /auth page for email OTP sign-in, then to /admin
      navigate("/auth?returnTo=/admin", { replace: true });
    }
  }, [isLoading, isAuthenticated, isAdmin, navigate]);

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
