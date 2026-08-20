import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Package,
  Loader2,
  CheckCircle2,
  Circle,
  XCircle,
  MapPin,
  CreditCard,
  FileText,
  Pill,
  RefreshCw,
  X,
} from "lucide-react";
import { formatCurrency, getStatusColor } from "@/lib/auth-utils";
import { toast } from "sonner";

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

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const order = useQuery(api.orders.getById, id ? { orderId: id as any } : "skip");
  const tracking = useQuery(api.orders.getTracking, id ? { orderId: id as any } : "skip");
  const cancelOrder = useMutation(api.orders.cancel);
  const reorder = useMutation(api.orders.reorder);

  const handleCancel = async () => {
    if (!id) return;
    if (!confirm("Are you sure you want to cancel this order?")) return;
    try {
      await cancelOrder({ orderId: id as any });
      toast.success("Order cancelled successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel order");
    }
  };

  const handleReorder = async () => {
    if (!id) return;
    try {
      const result = await reorder({ orderId: id as any });
      toast.success(`${result.added} item(s) added to cart`);
      navigate("/cart");
    } catch (error: any) {
      toast.error(error.message || "Failed to reorder");
    }
  };

  if (order === undefined) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </main>
        <Footer />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <Package className="size-12 text-muted-foreground/30 mb-4" />
          <h2 className="text-xl font-bold">Order not found</h2>
          <Button className="mt-4 gradient-primary text-white" onClick={() => navigate("/orders")}>View Orders</Button>
        </main>
        <Footer />
      </div>
    );
  }

  const canCancel = order.status === "pending" || order.status === "confirmed";
  const canReorder = order.status === "delivered" || order.status === "cancelled";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 mx-auto max-w-4xl w-full px-4 sm:px-6 py-8">
        <Button variant="ghost" size="sm" className="mb-6 gap-1.5 text-sm text-muted-foreground" onClick={() => navigate("/orders")}>
          <ArrowLeft className="size-4" /> All Orders
        </Button>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Order #{order.invoiceNumber || order._id.slice(-6).toUpperCase()}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Placed on {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`text-xs capitalize ${getStatusColor(order.status)}`}>
                {STATUS_LABELS[order.status] || order.status}
              </Badge>
              {canCancel && (
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={handleCancel}>
                  <X className="size-3.5" /> Cancel
                </Button>
              )}
              {canReorder && (
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleReorder}>
                  <RefreshCw className="size-3.5" /> Reorder
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Left: Tracking + Items */}
            <div className="space-y-6">
              {/* Tracking Timeline */}
              {tracking && order.status !== "cancelled" && (
                <Card className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold">Order Tracking</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-0">
                      {tracking.map((step: any, i: number) => (
                        <div key={step.status} className="flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            {step.completed ? (
                              <CheckCircle2 className={`size-5 shrink-0 ${step.current ? "text-primary" : "text-green-500"}`} />
                            ) : (
                              <Circle className="size-5 shrink-0 text-muted-foreground/30" />
                            )}
                            {i < tracking.length - 1 && (
                              <div className={`w-px h-8 ${step.completed ? "bg-primary/30" : "bg-border"}`} />
                            )}
                          </div>
                          <div className="pb-6">
                            <p className={`text-sm font-medium ${step.completed ? "text-foreground" : "text-muted-foreground"}`}>
                              {step.label}
                            </p>
                            <p className="text-xs text-muted-foreground">{step.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Cancelled notice */}
              {order.status === "cancelled" && (
                <Card className="border-destructive/20 bg-destructive/5">
                  <CardContent className="py-4 flex items-center gap-3">
                    <XCircle className="size-5 text-destructive shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-destructive">Order Cancelled</p>
                      <p className="text-xs text-muted-foreground">This order has been cancelled.{order.paymentMethod === "online" ? " A refund will be processed." : ""}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Items */}
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold">Items ({order.items?.length || 0})</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  {order.items?.map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-primary/[0.06] flex items-center justify-center shrink-0">
                        <Pill className="size-4 text-primary/40" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Qty: {item.quantity} × {formatCurrency(item.price)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold">{formatCurrency(item.price * item.quantity)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Right: Payment + Address */}
            <div className="space-y-6">
              {/* Payment Summary */}
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold">Payment Summary</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                  {order.discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(order.discount)}</span>
                    </div>
                  )}
                  {order.tax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">GST (12%)</span>
                      <span>{formatCurrency(order.tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Delivery</span>
                    <span className={order.deliveryFee === 0 ? "text-green-600" : ""}>
                      {order.deliveryFee === 0 ? "Free" : formatCurrency(order.deliveryFee)}
                    </span>
                  </div>
                  <Separator className="my-1" />
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(order.totalAmount)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Delivery Address */}
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <MapPin className="size-4" /> Delivery Address
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground leading-relaxed">{order.shippingAddress}</p>
                </CardContent>
              </Card>

              {/* Payment Info */}
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <CreditCard className="size-4" /> Payment
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-1">
                  <p className="text-sm">Method: <span className="font-medium capitalize">{order.paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment"}</span></p>
                  <p className="text-sm">Status: <span className="font-medium capitalize">{order.paymentStatus || "Pending"}</span></p>
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
