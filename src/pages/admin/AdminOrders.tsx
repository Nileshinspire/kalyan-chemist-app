import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ClipboardList,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  MapPin,
  Phone,
  User,
  Package,
  CreditCard,
  Banknote,
  ExternalLink,
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

const ALL_STATUSES = ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"];

/** Generate a Google Maps embed URL for a given address */
function getMapUrl(address: string): string {
  const query = encodeURIComponent(address);
  return `https://maps.google.com/maps?q=${query}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
}

/** Parse the formatted address string to extract components */
function parseAddress(addr: string) {
  // Format: "Name, addressLine1, addressLine2, city, state — pincode"
  const parts = addr.split(",").map((s) => s.trim());
  return {
    name: parts[0] || "",
    street: parts.slice(1, -2).join(", ").replace(/—.*$/, "").trim(),
    city: parts.length >= 3 ? parts[parts.length - 2].replace(/—.*/, "").trim() : "",
    statePincode: parts.length >= 2 ? parts[parts.length - 1].trim() : "",
  };
}

export default function AdminOrders() {
  const orders = useQuery(api.admin.listOrders);
  const updateStatus = useMutation(api.admin.updateOrderStatus);
  const [filter, setFilter] = useState("all");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const filtered = orders?.filter((o) => filter === "all" || o.status === filter);

  const handleStatusChange = async (orderId: string, status: string) => {
    try {
      await updateStatus({ orderId: orderId as any, status: status as any });
      toast.success(`Order status updated to ${STATUS_LABELS[status]}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground">
            {orders?.length ?? 0} total orders · Click an order to view delivery map and details
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {ALL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filter !== "all" && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setFilter("all")}>
              Clear
            </Button>
          )}
        </div>

        {/* Orders list */}
        {orders === undefined ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : filtered?.length === 0 ? (
          <div className="text-center py-12">
            <ClipboardList className="size-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No orders match this filter.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered?.map((order) => {
              const date = new Date(order.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
              const time = new Date(order.createdAt).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
              const isExpanded = expandedOrder === order._id;
              const parsed = parseAddress(order.shippingAddress);

              return (
                <Card key={order._id} className={`border-border/60 transition-all duration-200 ${isExpanded ? "shadow-card-hover border-primary/20" : "hover:border-border"}`}>
                  <CardContent className="p-0">
                    {/* Order header - clickable */}
                    <div
                      className="w-full text-left p-4 flex items-center justify-between gap-4 flex-wrap cursor-pointer"
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedOrder(isExpanded ? null : order._id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedOrder(isExpanded ? null : order._id); }}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-foreground">
                            {order.invoiceNumber}
                          </span>
                          <Badge className={`text-[10px] font-medium ${getStatusColor(order.status)}`}>
                            {STATUS_LABELS[order.status]}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] gap-1">
                            {order.paymentMethod === "cod" ? (
                              <><Banknote className="size-3" /> COD</>
                            ) : (
                              <><CreditCard className="size-3" /> Online</>
                            )}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="size-3" />
                            {order.userName}
                          </span>
                          <span>·</span>
                          <span>{date} at {time}</span>
                          <span>·</span>
                          <span>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
                          <span>·</span>
                          <span className="font-semibold text-foreground">
                            {formatCurrency(order.totalAmount)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <Select
                          value={order.status}
                          onValueChange={(val) => handleStatusChange(order._id, val)}
                        >
                          <SelectTrigger className="w-36 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-border/50">
                        <div className="p-4 grid md:grid-cols-2 gap-6">
                          {/* Left: Delivery address + Map */}
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                                <MapPin className="size-4 text-primary" />
                                Delivery Address
                              </h4>
                              <div className="rounded-xl bg-muted/40 p-3.5 space-y-2">
                                <div className="flex items-center gap-2">
                                  <User className="size-3.5 text-muted-foreground" />
                                  <span className="text-sm font-semibold text-foreground">{parsed.name}</span>
                                </div>
                                {order.phone && (
                                  <div className="flex items-center gap-2">
                                    <Phone className="size-3.5 text-muted-foreground" />
                                    <a href={`tel:${order.phone}`} className="text-sm text-primary hover:underline">{order.phone}</a>
                                  </div>
                                )}
                                <p className="text-sm text-muted-foreground leading-relaxed pl-5.5">
                                  {parsed.street}<br />
                                  {parsed.city}, {parsed.statePincode}
                                </p>
                              </div>
                            </div>

                            {/* Google Map embed */}
                            <div className="rounded-xl overflow-hidden border border-border/60 bg-muted/20">
                              <iframe
                                title={`Delivery map for ${order.invoiceNumber}`}
                                src={getMapUrl(order.shippingAddress)}
                                width="100%"
                                height="280"
                                style={{ border: 0 }}
                                allowFullScreen
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                                className="w-full"
                              />
                            </div>

                            {/* Open in Google Maps link */}
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.shippingAddress)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                            >
                              <ExternalLink className="size-3" />
                              Open full map in Google Maps
                            </a>
                          </div>

                          {/* Right: Order items + payment */}
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                                <Package className="size-4 text-primary" />
                                Order Items ({itemCount})
                              </h4>
                              <div className="space-y-2">
                                {order.items.map((item, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-sm p-2.5 rounded-lg bg-muted/30">
                                    <div className="min-w-0">
                                      <p className="font-medium text-foreground truncate">{item.name}</p>
                                      <p className="text-xs text-muted-foreground">× {item.quantity} @ {formatCurrency(item.price)}</p>
                                    </div>
                                    <span className="font-semibold text-foreground shrink-0 ml-2">
                                      {formatCurrency(item.price * item.quantity)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <Separator className="bg-border/50" />

                            {/* Payment summary */}
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Payment Method</span>
                                <span className="font-medium text-foreground capitalize">{order.paymentMethod}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Payment Status</span>
                                <Badge variant={order.paymentStatus === "paid" ? "default" : "secondary"} className="text-[10px]">
                                  {order.paymentStatus === "paid" ? "Paid" : "Pending"}
                                </Badge>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Total Amount</span>
                                <span className="font-bold text-foreground">{formatCurrency(order.totalAmount)}</span>
                              </div>
                            </div>

                            {order.notes && (
                              <>
                                <Separator className="bg-border/50" />
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Order Notes</p>
                                  <p className="text-sm text-foreground bg-muted/30 rounded-lg p-2.5">{order.notes}</p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
