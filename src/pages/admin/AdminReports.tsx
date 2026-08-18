import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, TrendingUp, Package, IndianRupee } from "lucide-react";
import { formatCurrency, getStatusColor } from "@/lib/auth-utils";

export default function AdminReports() {
  const stats = useQuery(api.admin.dashboardStats);
  const products = useQuery(api.admin.listProducts);

  if (stats === undefined) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        </div>
      </AdminLayout>
    );
  }

  // Product performance data
  const categoryStock: Record<string, { count: number; totalStock: number }> = {};
  if (products) {
    for (const p of products) {
      if (!categoryStock[p.categoryName]) {
        categoryStock[p.categoryName] = { count: 0, totalStock: 0 };
      }
      categoryStock[p.categoryName].count++;
      categoryStock[p.categoryName].totalStock += p.stockQuantity;
    }
  }

  // Revenue metrics
  const avgOrderValue =
    stats.totalOrders > 0 ? stats.totalRevenue / stats.totalOrders : 0;

  const deliveredOrders = stats.statusCounts["delivered"] || 0;
  const deliveryRate =
    stats.totalOrders > 0
      ? Math.round((deliveredOrders / stats.totalOrders) * 100)
      : 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Analytics and business intelligence overview.
          </p>
        </div>

        {/* Key metrics */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <IndianRupee className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg Order Value</p>
                  <p className="text-lg font-bold">{formatCurrency(Math.round(avgOrderValue))}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-green-500/10 text-green-600">
                  <TrendingUp className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Delivery Rate</p>
                  <p className="text-lg font-bold">{deliveryRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                  <Package className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Products</p>
                  <p className="text-lg font-bold">{stats.totalProducts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                  <BarChart3 className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Low Stock Items</p>
                  <p className="text-lg font-bold">{stats.lowStock}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue chart */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Revenue Trend (Last 6 Months)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 h-48">
              {stats.monthlyRevenue.map((m) => {
                const maxRev = Math.max(...stats.monthlyRevenue.map((x) => x.revenue), 1);
                const height = Math.max((m.revenue / maxRev) * 100, 4);
                return (
                  <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">
                      {formatCurrency(m.revenue)}
                    </span>
                    <div
                      className="w-full rounded-t bg-primary/20 transition-all hover:bg-primary/30"
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

        {/* Order status breakdown */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Order Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(stats.statusCounts).map(([status, count]) => {
                const pct = stats.totalOrders > 0
                  ? Math.round((count / stats.totalOrders) * 100)
                  : 0;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <Badge className={`text-[10px] font-medium w-24 justify-center ${getStatusColor(status)}`}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Badge>
                    <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/30 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-12 text-right">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Category inventory */}
        {Object.keys(categoryStock).length > 0 && (
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Inventory by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60">
                    <tr className="text-left">
                      <th className="pb-2 font-medium text-muted-foreground">Category</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Products</th>
                      <th className="pb-2 font-medium text-muted-foreground text-right">Total Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(categoryStock)
                      .sort((a, b) => b[1].totalStock - a[1].totalStock)
                      .map(([name, data]) => (
                        <tr key={name} className="border-b border-border/40 last:border-0">
                          <td className="py-2 font-medium text-foreground">{name}</td>
                          <td className="py-2 text-right text-muted-foreground">{data.count}</td>
                          <td className="py-2 text-right text-muted-foreground">{data.totalStock}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
