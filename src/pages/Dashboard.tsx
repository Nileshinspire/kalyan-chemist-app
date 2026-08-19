import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  LayoutDashboard,
  ShoppingBag,
  Package,
  MapPin,
  Database,
  Loader2,
  CheckCircle,
  ClipboardList,
  Shield,
  Crown,
  Bell,
  Clock,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router";
import { getDisplayName, isAdmin } from "@/lib/auth-utils";
import { toast } from "sonner";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const seedAll = useAction(api.seed.seedAll);
  const becomeAdmin = useMutation(api.users.becomeAdmin);
  const hasAdmin = useQuery(api.users.hasAdmin);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedDone, setSeedDone] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);

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
  const showBecomeAdmin = !isAdmin(user) && hasAdmin === false;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 px-6 py-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          {/* Header */}
          <motion.header
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
                <Sparkles className="size-3" />
                {isAdmin(user) ? "Administrator Account" : "Your Account"}
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                Welcome back, {displayName}
              </h1>
            </div>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer gap-2 self-start rounded-xl"
              onClick={async () => {
                await signOut();
                navigate("/");
              }}
            >
              Sign Out
            </Button>
          </motion.header>

          {/* Become Admin Banner */}
          {showBecomeAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-amber-300/50 bg-gradient-to-r from-amber-50 to-amber-100/50 rounded-2xl">
                <CardContent className="flex items-center gap-4 py-5">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                    <Crown className="size-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      Set Up Administrator Access
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      You are the first user on Kalyan Chemist. Click below to
                      become the administrator and manage products, orders, and
                      store settings.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="font-semibold shrink-0 bg-amber-600 hover:bg-amber-700 text-white rounded-xl"
                    onClick={async () => {
                      setIsPromoting(true);
                      try {
                        await becomeAdmin();
                        toast.success("You are now an administrator!", {
                          description: "Refresh the page to see the Admin Panel link.",
                        });
                      } catch (err) {
                        toast.error("Could not promote", {
                          description: err instanceof Error ? err.message : "Unknown error",
                        });
                      }
                      setIsPromoting(false);
                    }}
                    disabled={isPromoting}
                  >
                    {isPromoting ? (
                      <>
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        Setting up…
                      </>
                    ) : (
                      <>
                        <Crown className="mr-1.5 size-3.5" />
                        Become Admin
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Seed Data Banner */}
          {isAdmin(user) && !seedDone && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-primary/30 bg-primary/[0.03] rounded-2xl">
                <CardContent className="flex items-center gap-4 py-5">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
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
                    className="font-semibold shrink-0 rounded-xl"
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
            </motion.div>
          )}
          {isAdmin(user) && seedDone && (
            <Card className="border-green-300/50 bg-green-50 rounded-2xl">
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                icon: Bell,
                title: "Notifications",
                description: "Stay updated on order status, offers, and reminders.",
                action: () => navigate("/notifications"),
              },
              {
                icon: Clock,
                title: "Reminders",
                description: "Manage medicine refill schedules and alerts.",
                action: () => navigate("/reminders"),
              },
              {
                icon: MapPin,
                title: "My Addresses",
                description: "Manage your delivery addresses for faster checkout.",
                action: () => navigate("/dashboard"),
              },
              ...(isAdmin(user)
                ? [
                    {
                      icon: Shield,
                      title: "Admin Panel",
                      description: "Manage products, orders, coupons, and site settings.",
                      action: () => navigate("/admin"),
                    },
                  ]
                : []),
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.05, duration: 0.5 }}
              >
                <Card
                  className="border-border/70 rounded-2xl cursor-pointer transition-all duration-300 hover:border-primary/30 hover:shadow-card-hover hover:-translate-y-0.5 group"
                  onClick={item.action}
                >
                  <CardHeader className="pb-2">
                    <div className="mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-white group-hover:scale-110">
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
              </motion.div>
            ))}
          </div>

          {/* Status Banner */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="border-border/70 bg-primary/[0.03] rounded-2xl">
              <CardContent className="flex items-center gap-4 py-5">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
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
          </motion.div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
