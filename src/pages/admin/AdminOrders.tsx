import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import {
  ClipboardList,
  Loader2,
  Search,
  Eye,
  ChevronRight,
  MapPin,
  CreditCard,
  Pill,
  Package,
  User,
  FileText,
  Navigation,
  ExternalLink,
} from "lucide-react";
import { formatCurrency, getStatusColor } from "@/lib/auth-utils";
import { toast } from "sonner";
import { geocodeAddress } from "@/lib/geocode";

// ── DeliveryMap: shows a map from stored coords, or geocodes the address text on the fly ──
export function DeliveryMap({
  latitude,
  longitude,
  addressText,
}: {
  latitude: number | null;
  longitude: number | null;
  addressText: string;
}) {
  const [coords, setCoords] = useState<{
    lat: number;
    lng: number;
  } | null>(
    latitude && longitude ? { lat: latitude, lng: longitude } : null
  );
  const [geocoding, setGeocoding] = useState(false);
  const geocodingRef = useRef(false);

  // Sync when stored coords arrive later (dialog opens with new order)
  useEffect(() => {
    if (latitude && longitude) {
      setCoords({ lat: latitude, lng: longitude });
    }
  }, [latitude, longitude]);

  // If no coords, auto-geocode the address text once
  useEffect(() => {
    if (coords || geocodingRef.current || !addressText) return;
    geocodingRef.current = true;
    setGeocoding(true);
    let cancelled = false;
    geocodeAddress(addressText).then((geo) => {
      if (!cancelled) {
        if (geo) setCoords({ lat: geo.latitude, lng: geo.longitude });
        setGeocoding(false);
      }
    }).catch(() => {
      if (!cancelled) {
        setGeocoding(false);
      }
    });
    return () => { cancelled = true; };
  }, [coords, addressText]);

  const lat = coords?.lat ?? latitude;
  const lng = coords?.lng ?? longitude;
  const hasMap = lat != null && lng != null;

  const gmapUrl = hasMap
    ? `https://www.google.com/maps?q=${lat},${lng}`
    : null;
  const gmapAddrUrl = addressText
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressText)}`
    : null;
  const osmUrl = hasMap
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${(lng as number) - 0.01}%2C${(lat as number) - 0.01}%2C${(lng as number) + 0.01}%2C${(lat as number) + 0.01}&layer=mapnik&marker=${lat}%2C${lng}`
    : null;

  // Always show at least the "View Delivery Location on Map" button
  // (falls back to Google Maps address search when no coords)
  return (
    <div className="mt-3 space-y-2">
      {hasMap ? (
        <>
          <div className="relative w-full h-40 rounded-lg overflow-hidden border border-border/60">
            <iframe
              src={osmUrl!}
              className="w-full h-full border-0"
              loading="lazy"
              title="Delivery location map"
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Navigation className="size-3 text-primary" />
              Lat: {lat}, Lng: {lng}
              {geocoding && <Loader2 className="size-3 animate-spin ml-1" />}
            </p>
            <a
              href={gmapUrl!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View Delivery Location on Map <ExternalLink className="size-3" />
            </a>
          </div>
        </>
      ) : (
        <a
          href={gmapAddrUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline mt-2"
        >
          {geocoding ? (
            <>
              <Loader2 className="size-3 animate-spin" /> Finding location on map...
            </>
          ) : (
            <>
              <MapPin className="size-3" /> View Delivery Location on Map <ExternalLink className="size-3" />
            </>
          )}
        </a>
      )}
    </div>
  );
}

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

const STATUS_OPTIONS = [
  "pending", "confirmed", "processing", "ready_for_dispatch",
  "out_for_delivery", "delivered", "cancelled", "refund_initiated", "refunded",
];

export default function AdminOrders() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showDetail, setShowDetail] = useState(false);

  const orders = useQuery(api.admin.listOrders);
  const orderDetail = useQuery(
    api.admin.getOrderById,
    selectedOrder ? { orderId: selectedOrder._id } : "skip"
  );
  const updateStatus = useMutation(api.admin.updateOrderStatus);

  const filteredOrders = orders?.filter((o: any) => {
    const matchesSearch =
      !search ||
      o.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      o.userName?.toLowerCase().includes(search.toLowerCase()) ||
      o._id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === "all" || o.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await updateStatus({
        orderId: orderId as any,
        status: newStatus as any,
      });
      toast.success(`Order status updated to ${STATUS_LABELS[newStatus] || newStatus}`);
      // Refresh detail
      if (selectedOrder?._id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    }
  };

  const openDetail = (order: any) => {
    setSelectedOrder(order);
    setShowDetail(true);
  };

  // Stats
  const stats = {
    total: orders?.length || 0,
    pending: orders?.filter((o: any) => o.status === "pending").length || 0,
    processing: orders?.filter((o: any) => o.status === "processing" || o.status === "confirmed").length || 0,
    delivered: orders?.filter((o: any) => o.status === "delivered").length || 0,
    revenue: orders?.filter((o: any) => o.status !== "cancelled").reduce((s: number, o: any) => s + o.totalAmount, 0) || 0,
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground">Manage customer orders and track deliveries</p>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-foreground" },
            { label: "Pending", value: stats.pending, color: "text-yellow-600" },
            { label: "Processing", value: stats.processing, color: "text-blue-600" },
            { label: "Delivered", value: stats.delivered, color: "text-green-600" },
            { label: "Revenue", value: formatCurrency(stats.revenue), color: "text-primary" },
          ].map((stat) => (
            <div key={stat.label} className="p-3 rounded-xl bg-muted/30 border border-border/40">
              <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by invoice, customer, or order ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Orders Table */}
        {orders === undefined ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !filteredOrders || filteredOrders.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-16 text-center">
              <ClipboardList className="size-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-1">No orders found</h3>
              <p className="text-sm text-muted-foreground">
                {search || filterStatus !== "all" ? "Try adjusting your filters" : "Orders will appear here once customers start placing them"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map((order: any) => (
              <Card key={order._id} className="border-border/60 hover:shadow-sm transition-all cursor-pointer" onClick={() => openDetail(order)}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="size-10 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0">
                      <Package className="size-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <p className="text-xs text-muted-foreground">Order</p>
                        <p className="text-sm font-semibold truncate">{order.invoiceNumber || order._id.slice(-6)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Customer</p>
                        <p className="text-sm font-medium truncate">{order.userName}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="text-sm font-semibold">{formatCurrency(order.totalAmount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Date</p>
                        <p className="text-sm">{new Date(order.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                      </div>
                    </div>
                    <Badge className={`text-[10px] capitalize shrink-0 ${getStatusColor(order.status)}`}>
                      {STATUS_LABELS[order.status] || order.status}
                    </Badge>
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Order Detail Dialog */}
      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {orderDetail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Order #{orderDetail.invoiceNumber || orderDetail._id.slice(-6)}
                  <Badge className={`text-[10px] capitalize ${getStatusColor(orderDetail.status)}`}>
                    {STATUS_LABELS[orderDetail.status]}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                {/* Status Update */}
                <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Update Status</Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {STATUS_OPTIONS.map((s) => (
                      <Button
                        key={s}
                        variant={orderDetail.status === s ? "default" : "outline"}
                        size="sm"
                        className={`text-[10px] ${orderDetail.status === s ? "gradient-primary text-white" : ""}`}
                        onClick={() => handleStatusChange(orderDetail._id, s)}
                      >
                        {STATUS_LABELS[s]}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Status History Timeline */}
                {orderDetail.statusHistory && orderDetail.statusHistory.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Status History</p>
                    <div className="space-y-0">
                      {[...orderDetail.statusHistory].reverse().map((entry: any, i: number) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`size-2.5 rounded-full mt-1.5 ${i === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                            {i < (orderDetail.statusHistory?.length ?? 0) - 1 && (
                              <div className="w-px h-6 bg-border" />
                            )}
                          </div>
                          <div className="pb-3">
                            <p className="text-sm font-medium capitalize">{entry.status.replace(/_/g, " ")}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(entry.timestamp).toLocaleString("en-IN", {
                                day: "numeric", month: "short", year: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </p>
                            {entry.note && <p className="text-xs text-muted-foreground mt-0.5 italic">{entry.note}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Customer */}
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                  <User className="size-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">{orderDetail.userName}</p>
                    <p className="text-xs text-muted-foreground">{orderDetail.userEmail}</p>
                    {orderDetail.userPhone && <p className="text-xs text-muted-foreground">Phone: {orderDetail.userPhone}</p>}
                  </div>
                </div>

                {/* Items */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Items</p>
                  <div className="space-y-2">
                    {orderDetail.items?.map((item: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg">
                        <Pill className="size-4 text-primary/40 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          <p className="text-xs text-muted-foreground">Qty: {item.quantity} × {formatCurrency(item.price)}</p>
                        </div>
                        <p className="text-sm font-semibold">{formatCurrency(item.price * item.quantity)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Payment Summary */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Payment</p>
                    <p className="text-sm">Method: <span className="font-medium capitalize">{orderDetail.paymentMethod === "cod" ? "COD" : "Online"}</span></p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm">Status:</p>
                      <Badge className={`text-[10px] capitalize ${
                        orderDetail.paymentStatus === "paid" ? "bg-green-100 text-green-800" :
                        orderDetail.paymentStatus === "failed" ? "bg-red-100 text-red-800" :
                        "bg-yellow-100 text-yellow-800"
                      }`}>{orderDetail.paymentStatus || "Pending"}</Badge>
                    </div>
                    {orderDetail.razorpayPaymentId && (
                      <div className="mt-2 rounded-lg bg-muted/50 p-2">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Transaction ID</p>
                        <p className="text-xs font-mono font-medium break-all">{orderDetail.razorpayPaymentId}</p>
                      </div>
                    )}
                    {orderDetail.razorpayOrderId && (
                      <div className="mt-1.5 rounded-lg bg-muted/50 p-2">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Razorpay Order ID</p>
                        <p className="text-xs font-mono font-medium break-all">{orderDetail.razorpayOrderId}</p>
                      </div>
                    )}
                    <p className="text-sm mt-1">Subtotal: <span className="font-medium">{formatCurrency(orderDetail.subtotal)}</span></p>
                    {orderDetail.discount > 0 && <p className="text-sm">Discount: <span className="font-medium text-green-600">-{formatCurrency(orderDetail.discount)}</span></p>}
                    {orderDetail.tax > 0 && <p className="text-sm">GST: <span className="font-medium">{formatCurrency(orderDetail.tax)}</span></p>}
                    <p className="text-sm">Delivery: <span className="font-medium">{orderDetail.deliveryFee === 0 ? "Free" : formatCurrency(orderDetail.deliveryFee)}</span></p>
                    <p className="text-sm font-bold mt-1">Total: {formatCurrency(orderDetail.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                      <MapPin className="size-3" /> Delivery Address
                    </p>
                    <div className="space-y-1">
                      {orderDetail.address && (
                        <>
                          <p className="text-sm font-medium text-foreground">{orderDetail.address.fullName}</p>
                          <p className="text-xs text-muted-foreground">Phone: {orderDetail.address.phone}</p>
                        </>
                      )}
                      <p className="text-sm text-muted-foreground leading-relaxed">{orderDetail.shippingAddress}</p>
                      {orderDetail.address && (
                        <p className="text-xs text-muted-foreground capitalize">{orderDetail.address.addressType} address</p>
                      )}
                    </div>
                    {/* Delivery Map — geocodes address text when coordinates are missing */}
                    <DeliveryMap
                      latitude={orderDetail.deliveryLatitude ?? orderDetail.address?.latitude ?? null}
                      longitude={orderDetail.deliveryLongitude ?? orderDetail.address?.longitude ?? null}
                      addressText={orderDetail.shippingAddress}
                    />
                  </div>
                </div>

                {/* Prescription */}
                {orderDetail.prescriptionId && (
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                    <p className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                      <FileText className="size-3" /> Prescription linked to this order
                    </p>
                  </div>
                )}

                {/* Notes */}
                {orderDetail.notes && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
                    <p className="text-sm text-muted-foreground">{orderDetail.notes}</p>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Placed: {new Date(orderDetail.createdAt).toLocaleString("en-IN")} · Last updated: {new Date(orderDetail.updatedAt).toLocaleString("en-IN")}
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
