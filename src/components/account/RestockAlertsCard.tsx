import { useMutation, useQuery } from "convex/react";
import { Link } from "react-router";
import { BellRing, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * "Notify me when available" subscriptions.
 *
 * Shared by the customer dashboard and the Notifications page so the feature is
 * visible and manageable in both places. Customers subscribe from an
 * out-of-stock product page; here they can see what they are waiting for and
 * cancel without leaving the page.
 */
export function RestockAlertsCard({
  limit,
  showManageLink = false,
  className = "",
}: {
  limit?: number;
  showManageLink?: boolean;
  className?: string;
}) {
  const waitingAlerts = useQuery(api.availabilityNotifications.myWaiting, {});
  const cancelStockAlert = useMutation(api.availabilityNotifications.cancelNotification);

  async function handleCancel(productId: any) {
    try {
      await cancelStockAlert({ productId });
      toast.success("Restock alert cancelled");
    } catch (error: any) {
      toast.error(error?.message ?? "Could not cancel the restock alert");
    }
  }

  const visible = limit ? waitingAlerts?.slice(0, limit) : waitingAlerts;
  const hiddenCount = limit && waitingAlerts ? Math.max(0, waitingAlerts.length - limit) : 0;

  return (
    <Card className={`border-border/60 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-bold">
          <BellRing className="size-4" /> Restock alerts
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          We&apos;ll send a website notification when these medicines are back in stock.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {waitingAlerts === undefined ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : waitingAlerts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/60 px-3 py-3 text-xs text-muted-foreground">
            You&apos;re not waiting on any medicines. Open an out-of-stock product and tap
            “Notify Me When Available” to get a website notification when it returns.
          </p>
        ) : (
          <>
            {visible?.map((alert: any) => (
              <div
                key={alert._id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {alert.productName}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Waiting for stock</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 gap-1 px-2 text-xs text-muted-foreground"
                  onClick={() => handleCancel(alert.productId)}
                >
                  <X className="size-3" />
                  Cancel
                </Button>
              </div>
            ))}
            {hiddenCount > 0 && (
              <p className="px-1 text-[11px] text-muted-foreground">
                +{hiddenCount} more waiting
              </p>
            )}
            {showManageLink && (
              <Link
                to="/account/notifications"
                className="inline-flex items-center gap-1 px-1 pt-1 text-xs font-medium text-primary hover:underline"
              >
                Manage all restock alerts →
              </Link>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
