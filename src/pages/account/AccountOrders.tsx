import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { ClipboardList, Package, Loader2, ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/auth-utils";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-purple-100 text-purple-800",
  ready_for_dispatch: "bg-cyan-100 text-cyan-800",
  out_for_delivery: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
  refund_initiated: "bg-orange-100 text-orange-800",
  refunded: "bg-emerald-100 text-emerald-800",
};

export default function AccountOrders() {
  const navigate = useNavigate();
  const orders = useQuery(api.orders.list);

  if (orders === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">My Orders</h1>
        <p className="text-sm text-muted-foreground mt-1">Track and manage your orders</p>
      </div>

      {orders.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <ClipboardList className="size-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No orders yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start shopping to see your orders here
            </p>
            <Button onClick={() => navigate("/products")} className="gradient-primary text-white gap-2">
              Browse Medicines
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order: any) => (
            <Card
              key={order._id}
              className="border-border/60 cursor-pointer hover:shadow-card-hover transition-all"
              onClick={() => navigate(`/orders/${order._id}`)}
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-primary/[0.06] flex items-center justify-center">
                      <Package className="size-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Order #{order.invoiceNumber || order._id.slice(-6).toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={`text-[10px] capitalize ${STATUS_COLORS[order.status] || ""}`}>
                      {order.status}
                    </Badge>
                    <p className="text-sm font-bold text-foreground">{formatCurrency(order.totalAmount)}</p>
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
