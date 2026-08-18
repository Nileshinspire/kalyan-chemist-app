import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import {
  LayoutDashboard,
  LogOut,
  ShoppingBag,
  Package,
  User,
  MapPin,
} from "lucide-react";
import { useNavigate } from "react-router";
import { getDisplayName, isAdmin } from "@/lib/auth-utils";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const displayName = getDisplayName(user);

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              {isAdmin(user) ? "Administrator Account" : "Your Account"}
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              Welcome back, {displayName}
            </h1>
          </div>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer gap-2 self-start"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" />
            Sign Out
          </Button>
        </header>

        {/* Quick Actions */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: ShoppingBag,
              title: "Shop Medicines",
              description: "Browse our full catalogue of healthcare products.",
              action: () => navigate("/"),
            },
            {
              icon: Package,
              title: "My Orders",
              description: "Track your current and past orders in one place.",
              action: () => navigate("/account"),
            },
            {
              icon: MapPin,
              title: "Delivery Addresses",
              description: "Manage your saved addresses for faster checkout.",
              action: () => navigate("/account"),
            },
            {
              icon: User,
              title: "Account Settings",
              description: "Update your profile, phone number, and preferences.",
              action: () => navigate("/account"),
            },
          ].map((item) => (
            <Card
              key={item.title}
              className="border-border/70 shadow-none cursor-pointer transition-all hover:border-primary/30 hover:shadow-sm"
              onClick={item.action}
            >
              <CardHeader className="pb-2">
                <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="size-5" />
                </div>
                <CardTitle className="text-base">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Status Banner */}
        <Card className="border-border/70 shadow-none bg-primary/[0.03]">
          <CardContent className="flex items-center gap-4 py-5">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LayoutDashboard className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Your account is ready
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Start browsing our medicine catalogue to place your first order.
                We deliver across India with cash-on-delivery available.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
