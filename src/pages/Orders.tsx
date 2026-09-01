import { useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import { ClipboardList, Package, Loader2, ArrowRight, RefreshCw } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
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

export default function Orders() {
  const navigate = useNavigate();
  const orders = useQuery(api.orders.list);
  const reorder = useMutation(api.orders.reorder);

  const handleReorder = async (orderId: string) => {
    try {
      const result = await reorder({ orderId: orderId as any });
      toast.success(`${result.added} item(s) added to cart${result.skipped > 0 ? `. ${result.skipped} unavailable.` : ""}`);
      navigate("/cart");
    } catch (error: any) {
      toast.error(error.message || "Failed to reorder");
    }
  };

  if (orders === undefined) {
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

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 mx-auto max-w-4xl w-full px-4 sm:px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Breadcrumb items={[
            { label: "Account", href: "/account" },
            { label: "My Orders" },
          ]} />
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
            <ClipboardList className="size-3" /> Order History
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-8">My Orders</h1>
        </motion.div>

        {orders.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-16 text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
                <Package className="size-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">No orders yet</h3>
              <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                Your order history will appear here once you place your first order.
              </p>
              <Button className="mt-5 font-semibold gradient-primary text-white rounded-xl" onClick={() => navigate("/products")}>
                Browse Medicines
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {orders.map((order: any) => (
              <motion.div key={order._id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="border-border/60 hover:shadow-card-hover transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="size-10 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0">
                          <Package className="size-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground">
                              Order #{order.invoiceNumber || order._id.slice(-6).toUpperCase()}
                            </p>
                            <Badge className={`text-[10px] capitalize ${getStatusColor(order.status)}`}>
                              {STATUS_LABELS[order.status] || order.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(order.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric", month: "short", year: "numeric",
                            })}
                            {" · "}
                            {order.items?.length || 0} item(s)
                          </p>
                          <p className="text-sm font-bold text-foreground mt-1">{formatCurrency(order.totalAmount)}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {(order.status === "delivered" || order.status === "cancelled") && (
                          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => handleReorder(order._id)}>
                            <RefreshCw className="size-3" /> Reorder
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/orders/${order._id}`)}>
                          <ArrowRight className="size-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Item preview */}
                    {order.items && order.items.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-border/40">
                        <p className="text-xs text-muted-foreground truncate">
                          {order.items.map((item: any) => item.name).join(" · ")}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
