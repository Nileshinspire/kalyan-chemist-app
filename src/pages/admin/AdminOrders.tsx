import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardList, ChevronRight } from "lucide-react";
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

export default function AdminOrders() {
  const orders = useQuery(api.admin.listOrders);
  const updateStatus = useMutation(api.admin.updateOrderStatus);
  const [filter, setFilter] = useState("all");

  const filtered = orders?.filter((o) => filter === "all" || o.status === filter);

  const handleStatusChange = async (orderId: string, status: string) => {
    try {
      await updateStatus({
        orderId: orderId as any,
        status: status as any,
      });
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
            {orders?.length ?? 0} total orders
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
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
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
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
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
              const itemCount = order.items.reduce((sum, i) => sum + i.quantity, 0);
              return (
                <Card key={order._id} className="border-border/60">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">
                            {order.invoiceNumber}
                          </span>
                          <Badge className={`text-[10px] font-medium ${getStatusColor(order.status)}`}>
                            {STATUS_LABELS[order.status]}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {order.paymentMethod === "cod" ? "COD" : "Online"}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span>{order.userName}</span>
                          <span>·</span>
                          <span>{date}</span>
                          <span>·</span>
                          <span>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
                          <span>·</span>
                          <span className="font-medium text-foreground">
                            {formatCurrency(order.totalAmount)}
                          </span>
                        </div>
                      </div>

                      {/* Status update */}
                      <Select
                        value={order.status}
                        onValueChange={(val) => handleStatusChange(order._id, val)}
                      >
                        <SelectTrigger className="w-36 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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
