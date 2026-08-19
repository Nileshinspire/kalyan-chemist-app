import { useNavigate } from "react-router";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Bell, Clock } from "lucide-react";

export default function Reminders() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-background px-6 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <Bell className="mx-auto size-12 text-muted-foreground/50" />
          <h1 className="mt-4 text-2xl font-bold">Refill Reminders</h1>
          <p className="mt-2 text-muted-foreground">Sign in to manage your medicine refill reminders.</p>
          <Button className="mt-4" onClick={() => navigate("/login")}>Sign In</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">Refill Reminders</h1>
        <p className="text-sm text-muted-foreground mb-8">Never run out of essential medicines.</p>
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Clock className="size-12 text-muted-foreground/30" />
            <p className="mt-4 text-muted-foreground">Refill reminders will be available in Phase 2.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
