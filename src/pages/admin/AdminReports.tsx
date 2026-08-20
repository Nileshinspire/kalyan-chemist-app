import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  BarChart3,
  IndianRupee,
  ShoppingCart,
  Package,
  Users,
  TrendingUp,
  Loader2,
  AlertTriangle,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { formatCurrency } from "@/lib/auth-utils";

export default function AdminReports() {
  const stats = useQuery(api.admin.dashboardStats);
  const products = useQuery(api.admin.listProducts);
  const orders = useQuery(api.admin.listOrders);

  if (stats === undefined) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  // Compute additional analytics
  const deliveredOrders = orders?.filter((o: any) => o.status === "delivered") || [];
  const avgOrderValue = deliveredOrders.length > 0
    ? deliveredOrders.reduce((s: number, o: any) => s + o.totalAmount, 0) / deliveredOrders.length
    : 0;

  const onlinePayments = orders?.filter((o: any) => o.paymentMethod === "online") || [];
  const codPayments = orders?.filter((o: any) => o.paymentMethod === "cod") || [];

  // Low stock products
  const lowStockProducts = products?.filter((p: any) => p.stockQuantity < 10 && p.isActive) || [];
  const outOfStockProducts = products?.filter((p: any) => p.stockQuantity === 0 && p.isActive) || [];

  // Top selling products
  const productSales: Record<string, { name: string; count: number; revenue: number }> = {};
  for (const order of deliveredOrders) {
    for (const item of order.items || []) {
      const key = item.productId;
      if (!productSales[key]) {
        productSales[key] = { name: item.name, count: 0, revenue: 0 };
      }
      productSales[key].count += item.quantity;
      productSales[key].revenue += item.price * item.quantity;
    }
  }
  const topProducts = Object.values(productSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Order status breakdown
  const statusBreakdown = [
    { status: "pending", label: "Pending", icon: Clock, color: "text-yellow-600", bg: "bg-yellow-500/10" },
    { status: "confirmed", label: "Confirmed", icon: CheckCircle2, color: "text-blue-600", bg: "bg-blue-500/10" },
    { status: "processing", label: "Processing", icon: Package, color: "text-blue-600", bg: "bg-blue-500/10" },
    { status: "out_for_delivery", label: "Out for Delivery", icon: Truck, color: "text-purple-600", bg: "bg-purple-500/10" },
    { status: "delivered", label: "Delivered", icon: CheckCircle2, color: "text-green-600", bg: "bg-green-500/10" },
    { status: "cancelled", label: "Cancelled", icon: XCircle, color: "text-red-600", bg: "bg-red-500/10" },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground">Business insights and performance metrics</p>
        </motion.div>

        {/* Revenue Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: IndianRupee, label: "Total Revenue", value: formatCurrency(stats.totalRevenue), color: "text-green-600" },
            { icon: ShoppingCart, label: "Total Orders", value: stats.totalOrders, color: "text-blue-600" },
            { icon: TrendingUp, label: "Avg Order Value", value: formatCurrency(avgOrderValue), color: "text-primary" },
            { icon: Users, label: "Total Customers", value: stats.totalUsers, color: "text-purple-600" },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <div className="p-4 rounded-xl bg-muted/30 border border-border/40">
                <div className="flex items-center gap-2 mb-2">
                  <s.icon className={`size-4 ${s.color}`} />
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Revenue Chart */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-border/60 rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  Monthly Revenue
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {stats.monthlyRevenue.length > 0 ? (
                  <div className="flex items-end gap-2 h-48">
                    {stats.monthlyRevenue.map((m, i) => {
                      const maxRev = Math.max(...stats.monthlyRevenue.map((x) => x.revenue), 1);
                      const height = (m.revenue / maxRev) * 100;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <p className="text-[10px] text-muted-foreground font-medium">
                            {m.revenue > 0 ? formatCurrency(m.revenue) : ""}
                          </p>
                          <div
                            className="w-full rounded-t-md bg-gradient-to-t from-primary/40 to-primary/70 hover:from-primary/50 hover:to-primary/80 transition-colors min-h-[2px]"
                            style={{ height: `${Math.max(height, 2)}%` }}
                            title={`${m.month}: ${formatCurrency(m.revenue)}`}
                          />
                          <p className="text-[10px] text-muted-foreground">{m.month}</p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">No revenue data yet</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Order Status Breakdown */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="border-border/60 rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ShoppingCart className="size-4 text-primary" />
                  Order Status Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-3">
                  {statusBreakdown.map((s) => {
                    const count = stats.statusCounts[s.status] || 0;
                    return (
                      <div key={s.status} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                        <div className={`size-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                          <s.icon className={`size-4 ${s.color}`} />
                        </div>
                        <div>
                          <p className="text-lg font-bold">{count}</p>
                          <p className="text-[10px] text-muted-foreground">{s.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Payment Method Split */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="border-border/60 rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold">Payment Methods</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold">Online Payments</p>
                    <p className="text-xs text-muted-foreground">{onlinePayments.length} orders</p>
                  </div>
                  <p className="text-sm font-bold">{formatCurrency(onlinePayments.reduce((s: number, o: any) => s + o.totalAmount, 0))}</p>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold">Cash on Delivery</p>
                    <p className="text-xs text-muted-foreground">{codPayments.length} orders</p>
                  </div>
                  <p className="text-sm font-bold">{formatCurrency(codPayments.reduce((s: number, o: any) => s + o.totalAmount, 0))}</p>
                </div>
                {onlinePayments.length + codPayments.length > 0 && (
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-primary/60 transition-all"
                      style={{ width: `${(onlinePayments.length / (onlinePayments.length + codPayments.length)) * 100}%` }}
                    />
                    <div
                      className="h-full bg-amber-400/60 transition-all"
                      style={{ width: `${(codPayments.length / (onlinePayments.length + codPayments.length)) * 100}%` }}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Top Selling Products */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <Card className="border-border/60 rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold">Top Selling Products</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {topProducts.length > 0 ? (
                  <div className="space-y-2">
                    {topProducts.map((p, i) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                        <span className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">{p.count} units sold</p>
                        </div>
                        <p className="text-sm font-semibold shrink-0">{formatCurrency(p.revenue)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No sales data yet</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Inventory Alerts */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="border-border/60 rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <AlertTriangle className="size-4 text-orange-500" />
                  Inventory Alerts
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-orange-50 border border-orange-200">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="size-4 text-orange-500" />
                      <div>
                        <p className="text-sm font-semibold text-orange-800">Low Stock</p>
                        <p className="text-xs text-orange-600">Products below 10 units</p>
                      </div>
                    </div>
                    <Badge className="text-xs bg-orange-100 text-orange-800">{lowStockProducts.length}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 border border-red-200">
                    <div className="flex items-center gap-2">
                      <XCircle className="size-4 text-red-500" />
                      <div>
                        <p className="text-sm font-semibold text-red-800">Out of Stock</p>
                        <p className="text-xs text-red-600">Products with zero inventory</p>
                      </div>
                    </div>
                    <Badge className="text-xs bg-red-100 text-red-800">{outOfStockProducts.length}</Badge>
                  </div>
                  {lowStockProducts.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {lowStockProducts.slice(0, 5).map((p: any) => (
                        <div key={p._id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30">
                          <span className="truncate">{p.name}</span>
                          <Badge className={`text-[10px] ${p.stockQuantity === 0 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                            {p.stockQuantity} left
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </AdminLayout>
  );
}
