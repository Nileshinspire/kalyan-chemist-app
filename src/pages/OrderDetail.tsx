import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation, useAction } from "convex/react";
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
  RotateCcw,
  Lock,
  Navigation,
  ExternalLink,
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
  const resetForRetry = useMutation(api.razorpay.resetForRetry);
  const createRazorpayOrder = useAction(api.razorpayActions.createOrder);
  const verifyPayment = useAction(api.razorpayActions.verifyPayment);
  const getRazorpayKeyId = useAction(api.razorpayActions.getKeyId);
  const markPaymentFailed = useMutation(api.razorpay.markPaymentFailed);

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

  const handleRetryPayment = async () => {
    if (!id) return;
    try {
      const resetResult = await resetForRetry({ orderId: id as any });
      // Create a new Razorpay order
      const rpOrder = await createRazorpayOrder({
        amount: resetResult.amount,
        receipt: resetResult.receipt,
      });

      const options: any = {
        key: rpOrder._demo ? "rzp_test_demo" : await getRazorpayKeyId(),
        amount: rpOrder.amount,
        currency: rpOrder.currency || "INR",
        name: "Kalyan Chemist",
        description: `Order ${resetResult.receipt}`,
        order_id: rpOrder.id,
        handler: async (response: any) => {
          try {
            await verifyPayment({
              orderId: id as any,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success("Payment verified! Order confirmed.");
          } catch (err: any) {
            toast.error(err.message || "Payment verification failed");
          }
        },
        theme: { color: "#059669" },
        modal: {
          ondismiss: async () => {
            toast.info("Payment not completed. You can retry again.");
          },
        },
      };

      if (typeof window !== "undefined" && window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", async (response: any) => {
          try {
            await markPaymentFailed({ orderId: id as any, reason: response?.error?.description });
          } catch { /* non-critical */ }
          toast.error(response?.error?.description || "Payment failed. You can retry again.");
        });
        rzp.open();
      } else if (rpOrder._demo) {
        toast.success("Demo mode: Payment simulated.");
      } else {
        throw new Error("Razorpay not loaded. Please refresh.");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to retry payment");
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
  const canRetryPayment = order.paymentMethod === "online" && order.paymentStatus === "failed" && order.status !== "cancelled";

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
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`text-xs capitalize ${getStatusColor(order.status)}`}>
                {STATUS_LABELS[order.status] || order.status}
              </Badge>
              {canCancel && (
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5" onClick={handleCancel}>
                  <X className="size-3.5" /> Cancel
                </Button>
              )}
              {canRetryPayment && (
                <Button variant="outline" size="sm" className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50" onClick={handleRetryPayment}>
                  <RotateCcw className="size-3.5" /> Retry Payment
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
                <CardContent className="pt-0 space-y-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">{order.shippingAddress}</p>
                  {order.address && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>Contact: {order.address.fullName} · {order.address.phone}</p>
                    </div>
                  )}
                  {((order.deliveryLatitude && order.deliveryLongitude) ||
                    (order.address?.latitude && order.address?.longitude)) && (
                    <div className="space-y-2">
                      {(() => {
                        const lat = order.deliveryLatitude ?? order.address?.latitude;
                        const lng = order.deliveryLongitude ?? order.address?.longitude;
                        const osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${(lng as number) - 0.01}%2C${(lat as number) - 0.01}%2C${(lng as number) + 0.01}%2C${(lat as number) + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`;
                        const gmapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
                        return (
                          <>
                            <div className="relative w-full h-40 rounded-lg overflow-hidden border border-border/60">
                              <iframe
                                src={osmUrl}
                                className="w-full h-full border-0"
                                loading="lazy"
                                title="Delivery location map"
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Navigation className="size-3 text-primary" />
                                {lat}, {lng}
                              </p>
                              <a
                                href={gmapUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                              >
                                View on Google Maps <ExternalLink className="size-3" />
                              </a>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payment Info */}
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <CreditCard className="size-4" /> Payment
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-2">
                  <p className="text-sm">Method: <span className="font-medium capitalize">{order.paymentMethod === "cod" ? "Cash on Delivery" : "Online Payment"}</span></p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm">Status:</p>
                    <Badge className={`text-[10px] capitalize ${
                      order.paymentStatus === "paid" ? "bg-green-100 text-green-800" :
                      order.paymentStatus === "failed" ? "bg-red-100 text-red-800" :
                      "bg-yellow-100 text-yellow-800"
                    }`}>{order.paymentStatus || "Pending"}</Badge>
                  </div>
                  {order.razorpayPaymentId && (
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Transaction ID</p>
                      <p className="text-xs font-mono font-medium break-all">{order.razorpayPaymentId}</p>
                    </div>
                  )}
                  {order.razorpayOrderId && (
                    <div className="rounded-lg bg-muted/50 p-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Razorpay Order</p>
                      <p className="text-xs font-mono font-medium break-all">{order.razorpayOrderId}</p>
                    </div>
                  )}
                  {canRetryPayment && (
                    <Button variant="outline" size="sm" className="w-full gap-1.5 mt-2" onClick={handleRetryPayment}>
                      <RotateCcw className="size-3.5" /> Retry Payment
                    </Button>
                  )}
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
