import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  IndianRupee,
  ShoppingCart,
  Clock,
  Package,
  AlertTriangle,
  Users,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import { formatCurrency, getStatusColor } from "@/lib/auth-utils";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STAT_COLORS = [
  { bg: "bg-primary/10", text: "text-primary", hoverBg: "group-hover:bg-primary", hoverText: "group-hover:text-white" },
  { bg: "bg-blue-500/10", text: "text-blue-600", hoverBg: "group-hover:bg-blue-500", hoverText: "group-hover:text-white" },
  { bg: "bg-amber-500/10", text: "text-amber-600", hoverBg: "group-hover:bg-amber-500", hoverText: "group-hover:text-white" },
  { bg: "bg-green-500/10", text: "text-green-600", hoverBg: "group-hover:bg-green-500", hoverText: "group-hover:text-white" },
];

export default function AdminDashboard() {
  const stats = useQuery(api.admin.dashboardStats);

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
            Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Overview of your pharmacy operations.
          </p>
        </motion.div>

        {/* Stats cards */}
        {stats === undefined ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: IndianRupee,
                label: "Revenue",
                value: formatCurrency(stats.totalRevenue),
                iconIdx: 0,
              },
              {
                icon: ShoppingCart,
                label: "Total Orders",
                value: stats.totalOrders.toString(),
                iconIdx: 1,
              },
              {
                icon: Clock,
                label: "Pending Orders",
                value: stats.pendingOrders.toString(),
                iconIdx: 2,
              },
              {
                icon: Users,
                label: "Customers",
                value: stats.totalUsers.toString(),
                iconIdx: 3,
              },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <Card className="border-border/60 group hover:shadow-card-hover hover:border-primary/20 transition-all duration-300 cursor-default rounded-2xl">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3">
                      <div className={`flex size-10 items-center justify-center rounded-xl ${STAT_COLORS[stat.iconIdx].bg} ${STAT_COLORS[stat.iconIdx].text} transition-all duration-300 ${STAT_COLORS[stat.iconIdx].hoverBg} ${STAT_COLORS[stat.iconIdx].hoverText} group-hover:scale-110`}>
                        <stat.icon className="size-5" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">{stat.label}</p>
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
        )}

        {/* Alert + Recent Orders */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Low stock alert */}
          {stats && stats.lowStock > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-amber-300/50 bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                      <AlertTriangle className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-amber-800">
                        Low Stock Alert
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5">
                        {stats.lowStock} product{stats.lowStock !== 1 ? "s" : ""} with
                        fewer than 10 units remaining.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Recent orders */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className={stats && stats.lowStock > 0 ? "" : "lg:col-span-3"}
          >
            <Card className="border-border/60 rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  Recent Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats === undefined ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : stats.recentOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No orders yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {stats.recentOrders.map((order, idx) => {
                      const date = new Date(order.createdAt).toLocaleDateString(
                        "en-IN",
                        { day: "numeric", month: "short" }
                      );
                      return (
                        <motion.div
                          key={order._id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.5 + idx * 0.05 }}
                          className="flex items-center justify-between text-sm p-2.5 rounded-xl hover:bg-muted/50 transition-colors"
                        >
                          <div>
                            <span className="font-medium text-foreground">
                              {order.invoiceNumber || "N/A"}
                            </span>
                            <span className="text-muted-foreground ml-2">
                              {date}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-foreground font-medium">
                              {formatCurrency(order.totalAmount)}
                            </span>
                            <Badge
                              className={`text-[10px] font-medium ${getStatusColor(order.status)}`}
                            >
                              {STATUS_LABELS[order.status]}
                            </Badge>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Revenue by month */}
        {stats && stats.monthlyRevenue.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Card className="border-border/60 rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  Monthly Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3 h-44">
                  {stats.monthlyRevenue.map((m) => {
                    const maxRev = Math.max(
                      ...stats.monthlyRevenue.map((x) => x.revenue),
                      1
                    );
                    const height = Math.max((m.revenue / maxRev) * 100, 4);
                    return (
                      <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[10px] text-muted-foreground">
                          {formatCurrency(m.revenue)}
                        </span>
                        <div
                          className="w-full rounded-t-lg bg-gradient-to-t from-primary/30 to-primary/60 transition-all hover:from-primary/40 hover:to-primary/70"
                          style={{ height: `${height}%` }}
                        />
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {m.month}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Order status breakdown */}
        {stats && Object.keys(stats.statusCounts).length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <Card className="border-border/60 rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="size-4 text-primary" />
                  Order Status Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {Object.entries(stats.statusCounts).map(([status, count]) => (
                    <motion.div
                      key={status}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="text-center p-4 rounded-xl border border-border/60 hover:border-primary/20 hover:shadow-sm transition-all"
                    >
                      <p className="text-xl font-bold text-foreground">{count}</p>
                      <Badge
                        className={`text-[10px] font-medium mt-1.5 ${getStatusColor(status)}`}
                      >
                        {STATUS_LABELS[status] || status}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </AdminLayout>
  );
}
