import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import {
  ShieldCheck,
  Users,
  Package,
  Clock,
  Sparkles,
} from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
            <Sparkles className="size-3" />
            Overview
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Kalyan Chemist
          </h1>
          <p className="text-sm text-muted-foreground">
            Welcome, Admin{user?.name ? ` ${user.name}` : ""} — Here&apos;s
            your system overview.
          </p>
        </motion.div>

        {/* System info cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: ShieldCheck,
              label: "System Status",
              value: "Active",
              color: "bg-green-500/10 text-green-600",
            },
            {
              icon: Users,
              label: "Your Role",
              value: "Administrator",
              color: "bg-primary/10 text-primary",
            },
            {
              icon: Package,
              label: "Products",
              value: "Coming Soon",
              color: "bg-blue-500/10 text-blue-600",
            },
            {
              icon: Clock,
              label: "Orders",
              value: "Coming Soon",
              color: "bg-amber-500/10 text-amber-600",
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: i * 0.1,
                duration: 0.5,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <Card className="border-border/60 hover:shadow-card-hover hover:border-primary/20 transition-all duration-300 rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex size-10 items-center justify-center rounded-xl ${stat.color}`}
                    >
                      <stat.icon className="size-5" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {stat.label}
                      </p>
                      <p className="text-lg font-bold text-foreground">
                        {stat.value}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Welcome card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border-border/60 rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                Admin Dashboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Welcome to the Kalyan Chemist admin panel. This is your
                  central hub for managing products, orders, customers, and
                  pharmacy operations.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border border-border/60 hover:border-primary/20 transition-colors">
                    <h3 className="text-sm font-semibold text-foreground mb-1">
                      📦 Product Management
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Add, edit, and manage your medicine catalogue. Set
                      pricing, stock levels, and categories.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-border/60 hover:border-primary/20 transition-colors">
                    <h3 className="text-sm font-semibold text-foreground mb-1">
                      🛒 Order Processing
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      View and process customer orders. Track status from
                      placement to delivery.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-border/60 hover:border-primary/20 transition-colors">
                    <h3 className="text-sm font-semibold text-foreground mb-1">
                      👥 Customer Management
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      View customer accounts, manage access, and track order
                      history.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl border border-border/60 hover:border-primary/20 transition-colors">
                    <h3 className="text-sm font-semibold text-foreground mb-1">
                      📊 Reports & Analytics
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      View sales reports, inventory status, and business
                      insights.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AdminLayout>
  );
}
