import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { motion } from "framer-motion";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  LayoutDashboard,
  ShoppingBag,
  ClipboardList,
  Shield,
  Sparkles,
} from "lucide-react";
import { useNavigate } from "react-router";

export default function Dashboard() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 px-6 py-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <motion.header
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
                <Sparkles className="size-3" />
                {isAdmin ? "Administrator Account" : "Your Account"}
              </div>
              <h1 className="text-3xl font-bold tracking-tight">
                Welcome back, {user?.name || "User"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your health with Kalyan Chemist.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer gap-2 self-start rounded-xl"
              onClick={async () => {
                await logout();
                navigate("/");
              }}
            >
              Sign Out
            </Button>
          </motion.header>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: ShoppingBag,
                title: "Shop Medicines",
                description:
                  "Browse our full catalogue of healthcare products.",
                action: () => navigate("/products"),
              },
              {
                icon: ClipboardList,
                title: "My Orders",
                description:
                  "Track your current and past orders in one place.",
                action: () => navigate("/orders"),
              },
              ...(isAdmin
                ? [
                    {
                      icon: Shield,
                      title: "Admin Panel",
                      description:
                        "Manage products, orders, coupons, and site settings.",
                      action: () => navigate("/admin"),
                    },
                  ]
                : []),
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.05, duration: 0.5 }}
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

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
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
                    Start browsing our medicine catalogue to place your first
                    order.
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
