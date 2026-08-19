import { useNavigate } from "react-router";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, BellOff } from "lucide-react";

export default function Notifications() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-background px-6 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <BellOff className="mx-auto size-12 text-muted-foreground/50" />
          <h1 className="mt-4 text-2xl font-bold">Notifications</h1>
          <p className="mt-2 text-muted-foreground">Sign in to view your notifications.</p>
          <Button className="mt-4" onClick={() => navigate("/login")}>Sign In</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-8">Notifications</h1>
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Bell className="size-12 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground">Notifications will be available in Phase 2.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
