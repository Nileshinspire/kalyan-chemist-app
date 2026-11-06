import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { Bell, BellRing, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

/**
 * "Notify Me When Available" — shown only while a product is out of stock.
 *
 * The subscription is a website notification only (no WhatsApp or email) and
 * is scoped to the signed-in customer. The backend rejects duplicates, so the
 * button is safe to press twice.
 */
export function StockAlertButton({
  productId,
  productName,
}: {
  productId: Id<"products">;
  productName: string;
}) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState<"subscribe" | "cancel" | null>(null);

  const waiting = useQuery(
    api.availabilityNotifications.isWaiting,
    isAuthenticated ? { productId } : "skip",
  );
  const requestNotification = useMutation(api.availabilityNotifications.requestNotification);
  const cancelNotification = useMutation(api.availabilityNotifications.cancelNotification);

  async function subscribe() {
    if (!isAuthenticated) {
      navigate(`/login?returnTo=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setPending("subscribe");
    try {
      const result = await requestNotification({ productId });
      toast.success(
        result?.alreadyWaiting
          ? "You are already on the list for this medicine."
          : `We'll notify you when ${productName} is back in stock.`,
      );
    } catch (error: any) {
      toast.error(error?.message ?? "Could not set up the restock alert");
    } finally {
      setPending(null);
    }
  }

  async function cancel() {
    setPending("cancel");
    try {
      await cancelNotification({ productId });
      toast.success("Restock alert cancelled.");
    } catch (error: any) {
      toast.error(error?.message ?? "Could not cancel the restock alert");
    } finally {
      setPending(null);
    }
  }

  if (waiting === true) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/20 bg-primary/[0.04] px-3 py-2.5">
        <BellRing className="size-4 shrink-0 text-primary" />
        <p className="min-w-0 flex-1 text-xs text-foreground">
          You&apos;ll get a website notification when{" "}
          <span className="font-medium">{productName}</span> is back in stock.
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
          onClick={cancel}
          disabled={pending !== null}
        >
          {pending === "cancel" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <X className="size-3" />
          )}
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Button
        variant="outline"
        className="gap-2 rounded-xl"
        onClick={subscribe}
        disabled={pending !== null || (isAuthenticated && waiting === undefined)}
      >
        {pending === "subscribe" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Bell className="size-4" />
        )}
        Notify Me When Available
      </Button>
      <p className="text-[11px] text-muted-foreground">
        We&apos;ll send a notification on this website only — no WhatsApp or email.
      </p>
    </div>
  );
}
