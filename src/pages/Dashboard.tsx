import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  LayoutDashboard,
  LogOut,
  ShoppingBag,
  Package,
  User,
  MapPin,
  Database,
  Loader2,
  CheckCircle,
  ClipboardList,
} from "lucide-react";
import { useNavigate } from "react-router";
import { getDisplayName, isAdmin } from "@/lib/auth-utils";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const seedAll = useAction(api.seed.seedAll);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedDone, setSeedDone] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const result = await seedAll();
      setSeedDone(true);
      toast.success("Database seeded!", {
        description: `${result.categories} categories, ${result.products} products loaded.`,
      });
      if (result.errors.length > 0) {
        toast.warning("Some items had issues", {
          description: result.errors.slice(0, 3).join("; "),
        });
      }
    } catch (error) {
      toast.error("Seeding failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
    setIsSeeding(false);
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

        {/* Seed Data Banner (Admin only) */}
        {isAdmin(user) && !seedDone && (
          <Card className="border-primary/30 bg-primary/[0.03]">
            <CardContent className="flex items-center gap-4 py-5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Database className="size-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Initialize Product Catalogue
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Seed the database with sample medicine categories and products
                  so customers can start browsing.
                </p>
              </div>
              <Button
                size="sm"
                className="font-semibold shrink-0"
                onClick={handleSeed}
                disabled={isSeeding}
              >
                {isSeeding ? (
                  <>
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    Seeding…
                  </>
                ) : (
                  <>
                    <Database className="mr-1.5 size-3.5" />
                    Seed Data
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
        {isAdmin(user) && seedDone && (
          <Card className="border-green-300/50 bg-green-50">
            <CardContent className="flex items-center gap-3 py-4">
              <CheckCircle className="size-5 text-green-600" />
              <p className="text-sm text-green-800">
                Product catalogue has been seeded. Browse the{" "}
                <span
                  className="font-semibold underline cursor-pointer"
                  onClick={() => navigate("/products")}
                >
                  medicines page
                </span>{" "}
                to see the products.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: ShoppingBag,
              title: "Shop Medicines",
              description: "Browse our full catalogue of healthcare products.",
              action: () => navigate("/products"),
            },
            {
              icon: ClipboardList,
              title: "My Orders",
              description: "Track your current and past orders in one place.",
              action: () => navigate("/orders"),
            },
            {
              icon: ShoppingBag,
              title: "Continue Shopping",
              description: "Browse our medicine catalogue and add items to cart.",
              action: () => navigate("/products"),
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
