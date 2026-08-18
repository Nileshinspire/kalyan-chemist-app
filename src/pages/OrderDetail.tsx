import { useParams, useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Clock,
  Package,
  Truck,
  CheckCircle2,
  XCircle,
  Download,
  MapPin,
  Phone,
  Pill,
  FileText,
} from "lucide-react";
import { formatCurrency, getStatusColor } from "@/lib/auth-utils";
import { toast } from "sonner";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const TRACKING_ICONS: Record<string, typeof Clock> = {
  pending: Clock,
  confirmed: Package,
  processing: Package,
  shipped: Truck,
  delivered: CheckCircle2,
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const orderId = (id ?? "") as any;
  const order = useQuery(api.orders.getById, { orderId });
  const tracking = useQuery(api.orders.getTracking, { orderId });
  const cancelOrder = useMutation(api.orders.cancel);

  const handleCancel = async () => {
    if (!order) return;
    if (!confirm("Are you sure you want to cancel this order?")) return;
    try {
      await cancelOrder({ orderId: order._id });
      toast.success("Order cancelled");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not cancel order"
      );
    }
  };

  const handleDownloadInvoice = () => {
    if (!order) return;
    toast.info("Invoice download will be available soon.");
  };

  if (order === undefined) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 mx-auto max-w-4xl w-full px-4 sm:px-6 py-8">
          <Skeleton className="h-8 w-48 mb-8" />
          <div className="grid md:grid-cols-2 gap-8">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (order === null || !tracking) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <Package className="size-16 text-muted-foreground/30 mb-4" />
          <h1 className="text-2xl font-bold text-foreground">
            Order Not Found
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This order does not exist or you do not have permission to view it.
          </p>
          <Button className="mt-6" onClick={() => navigate("/orders")}>
            View All Orders
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const orderDate = new Date(order.createdAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const canCancel = order.status === "pending" || order.status === "confirmed";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8">
          <Button
            variant="ghost"
            size="sm"
            className="mb-6 gap-1.5 text-sm text-muted-foreground"
            onClick={() => navigate("/orders")}
          >
            <ArrowLeft className="size-4" />
            All Orders
          </Button>

          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {order.invoiceNumber && (
                  <h1 className="text-xl font-bold text-foreground">
                    {order.invoiceNumber}
                  </h1>
                )}
                <Badge className={`text-xs font-medium ${getStatusColor(order.status)}`}>
                  {STATUS_LABELS[order.status]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Placed on {orderDate}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1"
                onClick={handleDownloadInvoice}
              >
                <FileText className="size-3.5" />
                Invoice
              </Button>
              {canCancel && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs"
                  onClick={handleCancel}
                >
                  Cancel Order
                </Button>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Left: Tracking + Items */}
            <div className="space-y-6">
              {/* Tracking Timeline */}
              <Card className="border-border/60">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Truck className="size-4" />
                    Order Tracking
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-0">
                    {tracking.map((step, i) => {
                      const Icon = TRACKING_ICONS[step.status] ?? Clock;
                      return (
                        <div key={step.status} className="flex gap-3">
                          {/* Timeline line + dot */}
                          <div className="flex flex-col items-center">
                            <div
                              className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                                step.completed
                                  ? step.current
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-primary/15 text-primary"
                                  : "bg-muted text-muted-foreground/50"
                              }`}
                            >
                              {step.completed && !step.current ? (
                                <CheckCircle2 className="size-4" />
                              ) : step.cancelled && !step.completed ? (
                                <XCircle className="size-4" />
                              ) : (
                                <Icon className="size-4" />
                              )}
                            </div>
                            {i < tracking.length - 1 && (
                              <div
                                className={`w-0.5 flex-1 min-h-[2rem] ${
                                  step.completed && tracking[i + 1].completed
                                    ? "bg-primary/40"
                                    : "bg-border"
                                }`}
                              />
                            )}
                          </div>
                          {/* Label */}
                          <div className="pb-6">
                            <p
                              className={`text-sm font-medium ${
                                step.current
                                  ? "text-primary"
                                  : step.completed
                                  ? "text-foreground"
                                  : "text-muted-foreground/60"
                              }`}
                            >
                              {step.label}
                            </p>
                            {step.current && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {step.description}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {order.status === "cancelled" && (
                      <div className="flex gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                          <XCircle className="size-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-destructive">
                            Cancelled
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            This order has been cancelled.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Delivery Info */}
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MapPin className="size-4" />
                    Delivery Address
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-foreground leading-relaxed">
                    {order.shippingAddress}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="size-3" />
                    {order.phone}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Items + Payment */}
            <div className="space-y-6">
              {/* Items */}
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">
                    Order Items ({order.items.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/[0.05]">
                        <Pill className="size-5 text-primary/20" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          × {item.quantity} · {formatCurrency(item.price)} each
                        </p>
                      </div>
                      <span className="text-sm font-medium text-foreground shrink-0">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Payment Summary */}
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Payment Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="text-foreground">{formatCurrency(order.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery</span>
                    <span className="text-green-600 font-medium">Free</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-base font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(order.totalAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span>
                      Payment:{" "}
                      <span className="font-medium text-foreground">
                        {order.paymentMethod === "cod"
                          ? "Cash on Delivery"
                          : "Online"}
                      </span>
                    </span>
                    {order.paymentStatus && (
                      <Badge
                        variant={order.paymentStatus === "paid" ? "default" : "outline"}
                        className="text-[10px]"
                      >
                        {order.paymentStatus === "paid" ? "Paid" : order.paymentStatus}
                      </Badge>
                    )}
                  </div>
                  {order.razorpayPaymentId && (
                    <p className="text-[10px] text-muted-foreground">
                      Payment ID: {order.razorpayPaymentId}
                    </p>
                  )}
                  {order.notes && (
                    <div className="rounded-lg bg-muted/50 p-3 mt-2">
                      <p className="text-xs font-medium text-foreground mb-1">
                        Order Notes
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {order.notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
