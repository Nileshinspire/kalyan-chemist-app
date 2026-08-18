import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  IndianRupee,
  ShoppingCart,
  Clock,
  Package,
  AlertTriangle,
  Users,
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

export default function AdminDashboard() {
  const stats = useQuery(api.admin.dashboardStats);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Admin Dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Overview of your pharmacy operations.
          </p>
        </div>

        {/* Stats cards */}
        {stats === undefined ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border/60">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <IndianRupee className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Revenue</p>
                    <p className="text-lg font-bold text-foreground">
                      {formatCurrency(stats.totalRevenue)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                    <ShoppingCart className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Total Orders</p>
                    <p className="text-lg font-bold text-foreground">
                      {stats.totalOrders}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                    <Clock className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pending Orders</p>
                    <p className="text-lg font-bold text-foreground">
                      {stats.pendingOrders}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border/60">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-green-500/10 text-green-600">
                    <Users className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Customers</p>
                    <p className="text-lg font-bold text-foreground">
                      {stats.totalUsers}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alert + Recent Orders */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Low stock alert */}
          {stats && stats.lowStock > 0 && (
            <Card className="border-amber-300/50 bg-amber-50">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="size-5 text-amber-600 shrink-0" />
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
          )}

          {/* Recent orders */}
          <Card className="border-border/60 lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Orders</CardTitle>
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
                  {stats.recentOrders.map((order) => {
                    const date = new Date(order.createdAt).toLocaleDateString(
                      "en-IN",
                      { day: "numeric", month: "short" }
                    );
                    return (
                      <div
                        key={order._id}
                        className="flex items-center justify-between text-sm"
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
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Revenue by month */}
        {stats && stats.monthlyRevenue.length > 0 && (
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Monthly Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3 h-40">
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
                        className="w-full rounded-t bg-primary/20 transition-all"
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
        )}

        {/* Order status breakdown */}
        {stats && Object.keys(stats.statusCounts).length > 0 && (
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {Object.entries(stats.statusCounts).map(([status, count]) => (
                  <div
                    key={status}
                    className="text-center p-3 rounded-lg border border-border/60"
                  >
                    <p className="text-lg font-bold text-foreground">{count}</p>
                    <Badge
                      className={`text-[10px] font-medium mt-1 ${getStatusColor(status)}`}
                    >
                      {STATUS_LABELS[status] || status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
