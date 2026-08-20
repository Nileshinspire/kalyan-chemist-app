import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Download,
  RotateCcw,
} from "lucide-react";
import { formatCurrency } from "@/lib/auth-utils";
import { exportToCsv } from "@/lib/csv-export";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
} from "recharts";

const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
] as const;

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  ready_for_dispatch: "Ready for Dispatch",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refund_initiated: "Refund Initiated",
  refunded: "Refunded",
};

const PIE_COLORS = ["#22c55e", "#eab308", "#ef4444", "#3b82f6", "#a855f7", "#f97316", "#06b6d4", "#ec4899", "#6366f1"];

export default function AdminReports() {
  const [period, setPeriod] = useState<"today" | "week" | "month" | "year" | "all">("month");
  const report = useQuery(api.admin.salesReport, { period });
  const products = useQuery(api.admin.listProducts);

  if (report === undefined || products === undefined) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  const lowStockProducts = products?.filter((p: any) => p.stockQuantity < 10 && p.isActive) || [];
  const outOfStockProducts = products?.filter((p: any) => p.stockQuantity === 0 && p.isActive) || [];

  const handleExportSalesReport = () => {
    exportToCsv(
      [
        { metric: "Period", value: report.period },
        { metric: "Total Revenue", value: formatCurrency(report.revenue) },
        { metric: "Total Orders", value: String(report.totalOrders) },
        { metric: "Delivered Orders", value: String(report.deliveredOrders) },
        { metric: "Cancelled Orders", value: String(report.cancelledOrders) },
        { metric: "Total Refunds", value: formatCurrency(report.totalRefunds) },
        { metric: "Avg Order Value", value: formatCurrency(report.avgOrderValue) },
        ...report.topProducts.map((p: any, i: number) => ({
          metric: `Top Product #${i + 1}`,
          value: `${p.name} — ${p.count} units — ${formatCurrency(p.revenue)}`,
        })),
      ],
      "sales-report"
    );
  };

  const handleExportDailyRevenue = () => {
    exportToCsv(
      report.dailyRevenue.map((d: any) => ({
        date: d.date,
        revenue: d.revenue,
        orders: d.orders,
      })),
      "daily-revenue"
    );
  };

  const handleExportTopProducts = () => {
    exportToCsv(
      report.topProducts.map((p: any) => ({
        name: p.name,
        category: p.category,
        unitsSold: p.count,
        revenue: p.revenue,
      })),
      "top-products"
    );
  };

  const handleExportTopCategories = () => {
    exportToCsv(
      report.topCategories.map((c: any) => ({
        name: c.name,
        unitsSold: c.count,
        revenue: c.revenue,
      })),
      "top-categories"
    );
  };

  const totalPaymentMethods = report.onlinePayments.count + report.codPayments.count;
  const onlinePct = totalPaymentMethods > 0 ? (report.onlinePayments.count / totalPaymentMethods) * 100 : 0;
  const codPct = 100 - onlinePct;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Reports & Analytics</h1>
            <p className="text-sm text-muted-foreground">Business insights and performance metrics</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {PERIOD_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={period === opt.value ? "default" : "outline"}
                size="sm"
                className={`text-xs ${period === opt.value ? "gradient-primary text-white" : ""}`}
                onClick={() => setPeriod(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </motion.div>

        {/* Revenue Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { icon: IndianRupee, label: "Revenue", value: formatCurrency(report.revenue), color: "text-green-600" },
            { icon: ShoppingCart, label: "Orders", value: report.totalOrders, color: "text-blue-600" },
            { icon: CheckCircle2, label: "Delivered", value: report.deliveredOrders, color: "text-emerald-600" },
            { icon: XCircle, label: "Cancelled", value: report.cancelledOrders, color: "text-red-600" },
            { icon: TrendingUp, label: "Avg Order Value", value: formatCurrency(report.avgOrderValue), color: "text-primary" },
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

        {/* Export Buttons */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExportSalesReport}>
              <Download className="size-3.5" /> Export Sales Report
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExportDailyRevenue}>
              <Download className="size-3.5" /> Export Daily Revenue
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExportTopProducts}>
              <Download className="size-3.5" /> Export Top Products
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleExportTopCategories}>
              <Download className="size-3.5" /> Export Top Categories
            </Button>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Sales Over Time - Area Chart */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="border-border/60 rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  Sales Over Time
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {report.dailyRevenue.some((d: any) => d.revenue > 0) ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <AreaChart data={report.dailyRevenue} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} formatter={(value: number) => [formatCurrency(value), "Revenue"]} />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">No sales data for this period</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Orders Over Time - Bar Chart */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
            <Card className="border-border/60 rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <BarChart3 className="size-4 text-primary" />
                  Orders Over Time
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {report.dailyRevenue.some((d: any) => d.orders > 0) ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={report.dailyRevenue} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} />
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} />
                      <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.8} name="Orders" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">No order data for this period</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Order Status Pie Chart */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="border-border/60 rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <ShoppingCart className="size-4 text-primary" />
                  Order Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {Object.keys(report.statusCounts).length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={Object.entries(report.statusCounts).map(([status, count]) => ({
                          name: STATUS_LABELS[status] || status,
                          value: count,
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {Object.entries(report.statusCounts).map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 12 }} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-12">No orders yet</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Payment Methods */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <Card className="border-border/60 rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold">Payment Methods</CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold">Online Payments</p>
                    <p className="text-xs text-muted-foreground">{report.onlinePayments.count} orders</p>
                  </div>
                  <p className="text-sm font-bold">{formatCurrency(report.onlinePayments.revenue)}</p>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold">Cash on Delivery</p>
                    <p className="text-xs text-muted-foreground">{report.codPayments.count} orders</p>
                  </div>
                  <p className="text-sm font-bold">{formatCurrency(report.codPayments.revenue)}</p>
                </div>
                {totalPaymentMethods > 0 && (
                  <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex">
                    <div className="h-full bg-primary/60 transition-all" style={{ width: `${onlinePct}%` }} />
                    <div className="h-full bg-amber-400/60 transition-all" style={{ width: `${codPct}%` }} />
                  </div>
                )}
                {totalPaymentMethods > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Online: {Math.round(onlinePct)}%</span>
                    <span>COD: {Math.round(codPct)}%</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Top Selling Products */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <Card className="border-border/60 rounded-2xl">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold">Top Selling Products</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={handleExportTopProducts}>
                  <Download className="size-3" /> Export
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {report.topProducts.length > 0 ? (
                  <div className="space-y-2">
                    {report.topProducts.slice(0, 5).map((p: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                        <span className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <p className="text-[10px] text-muted-foreground">{p.category} — {p.count} units</p>
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

          {/* Top Categories */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
            <Card className="border-border/60 rounded-2xl">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold">Top Categories</CardTitle>
                <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={handleExportTopCategories}>
                  <Download className="size-3" /> Export
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                {report.topCategories.length > 0 ? (
                  <div className="space-y-2">
                    {report.topCategories.map((c: any, i: number) => {
                      const maxRev = Math.max(...report.topCategories.map((x: any) => x.revenue), 1);
                      const pct = (c.revenue / maxRev) * 100;
                      return (
                        <div key={i} className="p-2 rounded-lg hover:bg-muted/30 transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{c.name}</span>
                            <span className="text-xs text-muted-foreground">{c.count} units — {formatCurrency(c.revenue)}</span>
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary/50 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">No category data yet</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Inventory Alerts */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
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

          {/* Refunds */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
            <Card className="border-border/60 rounded-2xl">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <RotateCcw className="size-4 text-red-500" />
                  Refunds
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold">Total Refunds</p>
                    <p className="text-xs text-muted-foreground">Refunded payments in this period</p>
                  </div>
                  <p className="text-sm font-bold text-red-600">{formatCurrency(report.totalRefunds)}</p>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold">Cancelled Orders</p>
                    <p className="text-xs text-muted-foreground">Orders cancelled in this period</p>
                  </div>
                  <p className="text-sm font-bold text-red-600">{report.cancelledOrders}</p>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div>
                    <p className="text-sm font-semibold">Net Revenue</p>
                    <p className="text-xs text-muted-foreground">After refunds</p>
                  </div>
                  <p className="text-sm font-bold text-green-600">{formatCurrency(report.revenue - report.totalRefunds)}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </AdminLayout>
  );
}
