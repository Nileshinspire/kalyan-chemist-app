import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  History,
  Package,
  ShoppingCart,
  Star,
  Ticket,
  Settings,
  Truck,
  Users,
  Loader2,
  Filter,
  User,
  Clock,
  ArrowRight,
} from "lucide-react";

const CATEGORY_CONFIG: Record<string, { icon: typeof Package; color: string; label: string }> = {
  product: { icon: Package, color: "bg-blue-500/10 text-blue-600", label: "Product" },
  order: { icon: ShoppingCart, color: "bg-amber-500/10 text-amber-600", label: "Order" },
  review: { icon: Star, color: "bg-purple-500/10 text-purple-600", label: "Review" },
  coupon: { icon: Ticket, color: "bg-green-500/10 text-green-600", label: "Coupon" },
  settings: { icon: Settings, color: "bg-gray-500/10 text-gray-600", label: "Settings" },
  delivery: { icon: Truck, color: "bg-indigo-500/10 text-indigo-600", label: "Delivery" },
  user: { icon: Users, color: "bg-pink-500/10 text-pink-600", label: "User" },
  other: { icon: ArrowRight, color: "bg-muted text-muted-foreground", label: "Other" },
};

const CATEGORIES = ["all", "product", "order", "review", "coupon", "settings", "delivery", "user"];

function formatTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminActivityLog() {
  const [categoryFilter, setCategoryFilter] = useState("all");
  const logs = useQuery(
    api.adminSettings.listAuditLogs,
    categoryFilter === "all" ? { limit: 200 } : { category: categoryFilter, limit: 200 }
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
            <History className="size-3" />
            Activity Log
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Activity / Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review all admin actions and system changes
          </p>
        </motion.div>

        {/* Category Filters */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="size-4 text-muted-foreground" />
            {CATEGORIES.map((cat) => (
              <Button
                key={cat}
                variant={categoryFilter === cat ? "default" : "outline"}
                size="sm"
                className={`text-xs capitalize rounded-xl ${categoryFilter === cat ? "gradient-primary text-white" : ""}`}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat === "all" ? "All Activity" : cat}
              </Button>
            ))}
          </div>
        </motion.div>

        {/* Log Entries */}
        {logs === undefined ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-16 text-center">
              <History className="size-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-1">No activity yet</h3>
              <p className="text-sm text-muted-foreground">
                {categoryFilter === "all"
                  ? "Admin actions will appear here as they are performed"
                  : `No ${categoryFilter} activity recorded yet`}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {logs.map((log: any, i: number) => {
              const config = CATEGORY_CONFIG[log.category] ?? CATEGORY_CONFIG.other;
              const Icon = config.icon;

              return (
                <motion.div
                  key={log._id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.5) }}
                >
                  <Card className="border-border/60 hover:shadow-sm transition-all">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${config.color}`}>
                          <Icon className="size-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-foreground">{log.action}</span>
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {log.category}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {log.item}
                            {log.details ? ` — ${log.details}` : ""}
                          </p>
                          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="size-3" />
                              {log.adminName ?? "Admin"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {formatTime(log.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
