import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router";
import {
  ShieldCheck,
  Users,
  Package,
  Clock,
  Sparkles,
  IndianRupee,
  ShoppingCart,
  AlertTriangle,
  TrendingUp,
  Loader2,
  ArrowRight,
  Truck,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/auth-utils";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  ready_for_dispatch: "Ready",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const stats = useQuery(api.admin.dashboardStats);

  const statCards = stats
    ? [
        {
          icon: IndianRupee,
          label: "Total Revenue",
          value: formatCurrency(stats.totalRevenue),
          color: "bg-green-500/10 text-green-600",
          link: "/admin/orders",
        },
        {
          icon: ShoppingCart,
          label: "Total Orders",
          value: stats.totalOrders,
          color: "bg-blue-500/10 text-blue-600",
          link: "/admin/orders",
        },
        {
          icon: Clock,
          label: "Pending Orders",
          value: stats.pendingOrders,
          color: "bg-amber-500/10 text-amber-600",
          link: "/admin/orders",
        },
        {
          icon: Package,
          label: "Active Products",
          value: stats.totalProducts,
          color: "bg-primary/10 text-primary",
          link: "/admin/products",
        },
        {
          icon: AlertTriangle,
          label: "Low Stock",
          value: stats.lowStock,
          color: "bg-orange-500/10 text-orange-600",
          link: "/admin/inventory",
        },
        {
          icon: Users,
          label: "Total Users",
          value: stats.totalUsers,
          color: "bg-purple-500/10 text-purple-600",
          link: "/admin/users",
        },
      ]
    : [];

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

        {/* Stats Grid */}
        {stats === undefined ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            {statCards.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: i * 0.05,
                  duration: 0.4,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <button
                  className="w-full text-left border-border/60 hover:shadow-sm hover:border-primary/20 transition-all duration-300 rounded-2xl bg-card border p-4 group"
                  onClick={() => navigate(stat.link)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex size-10 items-center justify-center rounded-xl ${stat.color}`}
                    >
                      <stat.icon className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground truncate">
                        {stat.label}
                      </p>
                      <p className="text-lg font-bold text-foreground">
                        {stat.value}
                      </p>
                    </div>
                  </div>
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Charts Row */}
        {stats && (
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Monthly Revenue */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-border/60 rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <TrendingUp className="size-4 text-primary" />
                    Monthly Revenue
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {stats.monthlyRevenue.length > 0 ? (
                    <div className="flex items-end gap-2 h-40">
                      {stats.monthlyRevenue.map((m, i) => {
                        const maxRev = Math.max(
                          ...stats.monthlyRevenue.map((x) => x.revenue),
                          1
                        );
                        const height = (m.revenue / maxRev) * 100;
                        return (
                          <div
                            key={i}
                            className="flex-1 flex flex-col items-center gap-1"
                          >
                            <p className="text-[10px] text-muted-foreground font-medium">
                              {m.revenue > 0
                                ? formatCurrency(m.revenue)
                                : ""}
                            </p>
                            <div
                              className="w-full rounded-t-md bg-primary/20 hover:bg-primary/40 transition-colors min-h-[2px]"
                              style={{ height: `${Math.max(height, 2)}%` }}
                              title={`${m.month}: ${formatCurrency(m.revenue)}`}
                            />
                            <p className="text-[10px] text-muted-foreground">
                              {m.month}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No revenue data yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Order Status Distribution */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
            >
              <Card className="border-border/60 rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <ShoppingCart className="size-4 text-primary" />
                    Order Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {Object.keys(stats.statusCounts).length > 0 ? (
                    <div className="space-y-2.5">
                      {Object.entries(stats.statusCounts)
                        .sort(([, a], [, b]) => b - a)
                        .map(([status, count]) => {
                          const total = stats.totalOrders || 1;
                          const pct = Math.round((count / total) * 100);
                          return (
                            <div key={status}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-foreground capitalize">
                                  {STATUS_LABELS[status] || status}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {count} ({pct}%)
                                </span>
                              </div>
                              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary/60 rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No orders yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {/* Recent Orders */}
        {stats && stats.recentOrders.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="border-border/60 rounded-2xl">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold">
                  Recent Orders
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs text-primary"
                  onClick={() => navigate("/admin/orders")}
                >
                  View All <ArrowRight className="size-3" />
                </Button>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {stats.recentOrders.map((order: any) => (
                  <div
                    key={order._id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => navigate("/admin/orders")}
                  >
                    <div className="size-8 rounded-lg bg-primary/[0.06] flex items-center justify-center shrink-0">
                      <ShoppingCart className="size-4 text-primary/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">
                        {order.invoiceNumber || order._id.slice(-6)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                    <Badge
                      className={`text-[10px] capitalize ${
                        order.status === "delivered"
                          ? "bg-green-100 text-green-800"
                          : order.status === "cancelled"
                          ? "bg-red-100 text-red-800"
                          : order.status === "pending"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {STATUS_LABELS[order.status] || order.status}
                    </Badge>
                    <p className="text-xs font-semibold shrink-0">
                      {formatCurrency(order.totalAmount)}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card className="border-border/60 rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    icon: Package,
                    label: "Add Product",
                    desc: "Add new medicine to catalogue",
                    link: "/admin/products",
                    color: "bg-blue-500/10 text-blue-600",
                  },
                  {
                    icon: ShoppingCart,
                    label: "View Orders",
                    desc: "Process pending orders",
                    link: "/admin/orders",
                    color: "bg-amber-500/10 text-amber-600",
                  },
                  {
                    icon: Users,
                    label: "Customers",
                    desc: "View customer accounts",
                    link: "/admin/users",
                    color: "bg-purple-500/10 text-purple-600",
                  },
                  {
                    icon: AlertTriangle,
                    label: "Low Stock",
                    desc: "Check inventory alerts",
                    link: "/admin/inventory",
                    color: "bg-orange-500/10 text-orange-600",
                  },
                ].map((action) => (
                  <button
                    key={action.label}
                    className="p-4 rounded-xl border border-border/60 hover:border-primary/20 hover:shadow-sm transition-all text-left group"
                    onClick={() => navigate(action.link)}
                  >
                    <div
                      className={`flex size-9 items-center justify-center rounded-lg ${action.color} mb-2`}
                    >
                      <action.icon className="size-4" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {action.label}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {action.desc}
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AdminLayout>
  );
}
