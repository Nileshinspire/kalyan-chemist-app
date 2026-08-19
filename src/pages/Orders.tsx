import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Package,
  Clock,
  ChevronRight,
  ClipboardList,
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

export default function Orders() {
  const navigate = useNavigate();
  const orders = useQuery(api.orders.list);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Button
              variant="ghost"
              size="sm"
              className="mb-4 gap-1.5 text-muted-foreground rounded-xl"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>

            <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
              <ClipboardList className="size-3" />
              Order History
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
              My Orders
            </h1>
            <p className="text-sm text-muted-foreground mb-8">
              {orders === undefined
                ? "Loading…"
                : `${orders.length} order${orders.length !== 1 ? "s" : ""} total`}
            </p>
          </motion.div>

          {orders === undefined ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Skeleton className="h-28 w-full rounded-2xl" />
                </motion.div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="size-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <Package className="size-7 text-muted-foreground/40" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                No orders yet
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                Your order history will appear here once you place your first order.
              </p>
              <Button
                className="mt-5 font-semibold gradient-primary text-white rounded-xl"
                onClick={() => navigate("/products")}
              >
                Browse Medicines
              </Button>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {orders.map((order, index) => {
                const orderDate = new Date(order.createdAt).toLocaleDateString(
                  "en-IN",
                  { day: "numeric", month: "short", year: "numeric" }
                );
                const itemCount = order.items.reduce(
                  (sum, item) => sum + item.quantity,
                  0
                );

                return (
                  <motion.div
                    key={order._id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05, duration: 0.4 }}
                  >
                    <Card
                      className="border-border/60 bg-card cursor-pointer transition-all duration-300 hover:border-primary/20 hover:shadow-card-hover rounded-2xl"
                      onClick={() => navigate(`/orders/${order._id}`)}
                    >
                      <CardContent className="p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              {order.invoiceNumber && (
                                <span className="text-sm font-semibold text-foreground">
                                  {order.invoiceNumber}
                                </span>
                              )}
                              <Badge className={`text-[10px] font-medium ${getStatusColor(order.status)}`}>
                                {STATUS_LABELS[order.status] ?? order.status}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {order.paymentMethod === "cod" ? "COD" : "Online"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                              <Clock className="size-3" />
                              <span>{orderDate}</span>
                              <span>·</span>
                              <span>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
                              <span>·</span>
                              <span className="font-medium text-foreground">
                                {formatCurrency(order.totalAmount)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {order.items.map((i) => i.name).join(", ")}
                            </p>
                          </div>
                          <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-1" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
