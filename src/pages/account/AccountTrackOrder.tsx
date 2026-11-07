import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router";
import { motion } from "framer-motion";
import {
  Package,
  Loader2,
  MapPin,
  Clock,
  CheckCircle2,
  Truck,
  Circle,
  Navigation,
  ArrowLeft,
} from "lucide-react";
import { LiveDeliveryMap } from "@/components/tracking/LiveDeliveryMap";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedOrderId = searchParams.get("orderId");
  // Convex validates ids on the server; a malformed deep link should show a
  // friendly message instead of throwing the page into an error boundary.
  const isPlausibleOrderId = Boolean(
    selectedOrderId && /^[a-z0-9]{20,40}$/.test(selectedOrderId),
  );

  // Live tracking for one of the customer's own orders. Coordinates are only
  // returned while sharing is active, matching what the delivery partner
  // actually pushed to the backend.
  const customerTracking = useQuery(
    api.deliveryTracking.getCustomerTracking,
    isPlausibleOrderId ? { orderId: selectedOrderId as any } : "skip",
  );

  // Assigned delivery partner + order status, read from the customer's own
  // order document so the page never resolves another account's assignment.
  const order = useQuery(
    api.orders.getById,
    isPlausibleOrderId ? { orderId: selectedOrderId as any } : "skip",
  );
  const currentUser = useAuth()?.user;
  const isOwnOrder = Boolean(
    Boolean(currentUser) &&
      selectedOrderId &&
      order &&
      order.userId === (currentUser as { id?: string })?.id,
  );
  const orderForCustomer = isOwnOrder ? order : null;

  const thisOrders = useQuery(api.orders.list);

  // The active (live) orders list for the customer's own account.
  const activeOrders = thisOrders
    ? orderForCustomer
      ? thisOrders.filter((o: any) => o._id === orderForCustomer._id && o.status !== "delivered" && o.status !== "cancelled")
      : []
    : [];
  const pastOrders = thisOrders
    ? orderForCustomer
      ? thisOrders.filter((o: any) => o._id === orderForCustomer._id && (o.status === "delivered" || o.status === "cancelled"))
      : []
    : [];

  const orderUnavailable = (
    <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-4 text-center">
      <p className="text-sm font-medium text-foreground">Order not available</p>
      <p className="mt-1 text-xs text-muted-foreground">
        This order could not be found in your account.
      </p>
    </div>
  );

  // A customer who is not signed in never sees anyone's tracking data.
  if (!useAuth()?.user) {
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
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/[0.08] text-primary">
                  <Truck className="size-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Live delivery tracking
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Sign in to an account to see your orders
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="text-[10px] capitalize bg-muted-foreground/10 text-muted-foreground">
                  Not signed in
                </Badge>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center pt-2">
              <div className="flex flex-col items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  Your order is being prepared by the pharmacy. Sign in to see your
                  delivery partner and live location.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/login", { replace: true })}
                >
                  Sign in to track this order
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

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

      {selectedOrderId && (
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/[0.08] text-primary">
                  <Truck className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Live delivery tracking
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Order #{selectedOrderId.slice(-6).toUpperCase()}
                  </p>
                </div>
              </div>
              {customerTracking && (
                <Badge
                  className={`text-[10px] capitalize ${STATUS_COLORS[customerTracking.orderStatus] || ""}`}
                >
                  {STATUS_LABELS[customerTracking.orderStatus] ||
                    customerTracking.orderStatus}
                </Badge>
              )}
            </div>

            {customerTracking === undefined ? (
              isPlausibleOrderId ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                orderUnavailable
              )
            ) : customerTracking === null ? (
              orderUnavailable
            ) : customerTracking.trackingActive ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/40 px-3 py-2 text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Navigation className="size-3.5 text-emerald-600" />
                    {customerTracking.deliveryBoyName
                      ? `${customerTracking.deliveryBoyName} is on the way`
                      : "Your delivery partner is on the way"}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="size-3" />
                    {customerTracking.lastLocationAt
                      ? `Updated ${new Date(customerTracking.lastLocationAt).toLocaleTimeString(
                          "en-IN",
                          { hour: "2-digit", minute: "2-digit" },
                        )}`
                      : "Waiting for the first GPS update"}
                  </span>
                </div>

                <LiveDeliveryMap
                  latitude={customerTracking.location?.latitude ?? null}
                  longitude={customerTracking.location?.longitude ?? null}
                  label={
                    customerTracking.deliveryBoyName
                      ? `${customerTracking.deliveryBoyName} — delivery partner`
                      : "Delivery partner"
                  }
                  heightClass="h-64 sm:h-80"
                />

                <p className="text-[11px] text-muted-foreground">
                  Live location is shared only during an active delivery. Sharing ends
                  automatically when the order is marked delivered.
                </p>

                {!isOwnOrder && (
                  <div className="mt-2 rounded-xl border border-dashed border-border/60 bg-muted/30 p-3 text-xs text-amber-700">
                    <p className="font-medium">Tracking not available for this order</p>
                    <p className="mt-0.5 leading-relaxed">
                      This order does not belong to your account, so tracking is hidden
                      for your security.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-4">
                <p className="text-sm font-medium text-foreground">
                  {customerTracking.orderStatus === "delivered"
                    ? "Delivery completed"
                    : "Live map not active right now"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {customerTracking.orderStatus === "delivered"
                    ? "The order was delivered and the delivery partner's location is no longer shared."
                    : customerTracking.assigned
                      ? "A delivery partner is assigned. The map appears here as soon as they start delivery."
                      : "The map appears here once a delivery partner is assigned and starts the delivery."}
                </p>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="gap-1 px-0 text-xs text-muted-foreground"
              onClick={() => setSearchParams({})}
            >
              <ArrowLeft className="size-3.5" /> All orders
            </Button>
          </CardContent>
        </Card>
      )}

      {thisOrders?.length === 0 ? (
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
          {activeOrders?.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Truck className="size-4 text-primary" />
                Active Orders ({activeOrders.length})
              </h2>
              <div className="space-y-4">
                {activeOrders?.map((order: any, i: number) => (
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
          {pastOrders?.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <CheckCircle2 className="size-4 text-muted-foreground" />
                Past Orders ({pastOrders.length})
              </h2>
              <div className="space-y-3">
                {pastOrders?.map((order: any) => (
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
