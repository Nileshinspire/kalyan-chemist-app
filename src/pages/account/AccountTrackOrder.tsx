import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import {
  Package,
  Loader2,
  MapPin,
  Clock,
  CheckCircle2,
  Truck,
  Circle,
} from "lucide-react";

const STATUS_STEPS = [
  "pending",
  "confirmed",
  "processing",
  "ready_for_dispatch",
  "out_for_delivery",
  "delivered",
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Order Placed",
  confirmed: "Order Confirmed",
  processing: "Processing",
  ready_for_dispatch: "Ready for Dispatch",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  processing: "bg-purple-100 text-purple-800",
  ready_for_dispatch: "bg-cyan-100 text-cyan-800",
  out_for_delivery: "bg-indigo-100 text-indigo-800",
  delivered: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

function OrderProgressTracker({ status }: { status: string }) {
  const currentIdx = STATUS_STEPS.indexOf(status);
  const isCancelled = status === "cancelled";

  return (
    <div className="flex items-center gap-1 w-full mt-3">
      {STATUS_STEPS.map((step, idx) => {
        const isCompleted = !isCancelled && idx <= currentIdx;
        const isCurrent = !isCancelled && idx === currentIdx;

        return (
          <div key={step} className="flex items-center flex-1">
            <div className="flex flex-col items-center relative">
              <div
                className={`size-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all ${
                  isCompleted
                    ? "bg-primary text-white"
                    : isCurrent
                      ? "bg-primary/20 text-primary ring-2 ring-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isCompleted && !isCurrent ? (
                  <CheckCircle2 className="size-3.5" />
                ) : (
                  idx + 1
                )}
              </div>
              <span className="text-[9px] text-muted-foreground mt-1 text-center leading-tight hidden sm:block max-w-[60px]">
                {STATUS_LABELS[step]}
              </span>
            </div>
            {idx < STATUS_STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-1 rounded-full transition-all ${
                  !isCancelled && idx < currentIdx
                    ? "bg-primary"
                    : "bg-muted"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AccountTrackOrder() {
  const navigate = useNavigate();
  const orders = useQuery(api.orders.list);

  if (orders === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeOrders = orders.filter(
    (o: any) => o.status !== "delivered" && o.status !== "cancelled"
  );
  const pastOrders = orders.filter(
    (o: any) => o.status === "delivered" || o.status === "cancelled"
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-xl font-bold text-foreground">Track Order</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor your order status in real-time
        </p>
      </div>

      {orders.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <Package className="size-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">
              No orders to track
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Place an order to start tracking its status
            </p>
            <Button
              onClick={() => navigate("/products")}
              className="gradient-primary text-white gap-2"
            >
              Browse Medicines
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Active Orders */}
          {activeOrders.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Truck className="size-4 text-primary" />
                Active Orders ({activeOrders.length})
              </h2>
              <div className="space-y-4">
                {activeOrders.map((order: any, i: number) => (
                  <motion.div
                    key={order._id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card
                      className="border-border/60 cursor-pointer hover:shadow-card-hover transition-all"
                      onClick={() =>
                        navigate(`/account/orders/${order._id}`)
                      }
                    >
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-3">
                            <div className="size-10 rounded-xl bg-primary/[0.06] flex items-center justify-center">
                              <Package className="size-5 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                Order #
                                {order.invoiceNumber ||
                                  order._id.slice(-6).toUpperCase()}
                              </p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="size-3" />
                                {new Date(order.createdAt).toLocaleDateString(
                                  "en-IN",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  }
                                )}
                              </p>
                            </div>
                          </div>
                          <Badge
                            className={`text-[10px] capitalize ${STATUS_COLORS[order.status] || ""}`}
                          >
                            {STATUS_LABELS[order.status] || order.status}
                          </Badge>
                        </div>
                        <OrderProgressTracker status={order.status} />
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Past Orders */}
          {pastOrders.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <CheckCircle2 className="size-4 text-muted-foreground" />
                Past Orders ({pastOrders.length})
              </h2>
              <div className="space-y-3">
                {pastOrders.map((order: any) => (
                  <Card
                    key={order._id}
                    className="border-border/60 cursor-pointer hover:shadow-card-hover transition-all opacity-75 hover:opacity-100"
                    onClick={() =>
                      navigate(`/account/orders/${order._id}`)
                    }
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="size-9 rounded-xl bg-muted flex items-center justify-center">
                            <Circle className="size-4 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              Order #
                              {order.invoiceNumber ||
                                order._id.slice(-6).toUpperCase()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(order.createdAt).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                }
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={`text-[10px] capitalize ${STATUS_COLORS[order.status] || ""}`}
                          >
                            {STATUS_LABELS[order.status] || order.status}
                          </Badge>
                          <MapPin className="size-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
