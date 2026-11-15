import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  LogOut,
  MapPin,
  Navigation,
  Package,
  Phone,
  Play,
  Square,
  Truck,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, getStatusColor } from "@/lib/auth-utils";
import { isTerminalDeliveryStatus } from "@/convex/deliveryTrackingCore";

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

const GPS_INTERVAL_MS = 10_000;

type SharedPosition = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
};

function toSharedPosition(position: GeolocationPosition): SharedPosition {
  const { latitude, longitude, accuracy, heading, speed } = position.coords;
  return {
    latitude,
    longitude,
    accuracy: Number.isFinite(accuracy) ? accuracy : undefined,
    heading:
      typeof heading === "number" && Number.isFinite(heading) ? heading : undefined,
    speed: typeof speed === "number" && Number.isFinite(speed) ? speed : undefined,
  };
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20_000,
      maximumAge: 0,
    });
  });
}

function geoErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission was denied. Allow location access for this site in your browser settings, then try again.";
    case error.POSITION_UNAVAILABLE:
      return "GPS signal is unavailable. Move to an open area and try again.";
    case error.TIMEOUT:
      return "GPS took too long to respond. Check that location services are turned on and try again.";
    default:
      return "Could not read your GPS location. Please try again.";
  }
}

function timeAgo(timestamp: number | null | undefined, now: number): string {
  if (!timestamp) return "waiting for first GPS fix";
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 15) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr ago`;
}

export default function DeliveryDashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const assignments = useQuery(api.deliveryTracking.myAssignments, {});
  const startTracking = useMutation(api.deliveryTracking.startTracking);
  const acceptDelivery = useMutation(api.deliveryTracking.acceptDelivery);
  const pickupOrder = useMutation(api.deliveryTracking.pickupOrder);
  const updateLocation = useMutation(api.deliveryTracking.updateLocation);
  const stopTracking = useMutation(api.deliveryTracking.stopTracking);
  const markDelivered = useMutation(api.deliveryTracking.markDelivered);

  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deliveryOtp, setDeliveryOtp] = useState("");
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [lastSentAt, setLastSentAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const watchRef = useRef<number | null>(null);
  const pingTimerRef = useRef<number | null>(null);
  const latestPositionRef = useRef<SharedPosition | null>(null);
  const activeOrderRef = useRef<string | null>(null);
  const stopTrackingRef = useRef(stopTracking);
  stopTrackingRef.current = stopTracking;

  const clearGpsTimers = useCallback(() => {
    if (watchRef.current !== null && typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current);
    }
    watchRef.current = null;
    if (pingTimerRef.current !== null) {
      window.clearInterval(pingTimerRef.current);
    }
    pingTimerRef.current = null;
    latestPositionRef.current = null;
  }, []);

  const sendLocation = useCallback(
    async (orderId: string, position: SharedPosition) => {
      try {
        await updateLocation({
          orderId: orderId as Id<"orders">,
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: position.accuracy,
          heading: position.heading,
          speed: position.speed,
        });
        setLastSentAt(Date.now());
        setNetworkError(null);
      } catch (error: any) {
        const message = error?.message ?? "";
        if (/not active|has ended|not assigned|not found/i.test(message)) {
          clearGpsTimers();
          activeOrderRef.current = null;
          setActiveOrderId(null);
          toast.error(message);
        } else {
          // The browser keeps watching; the next interval retries automatically.
          setNetworkError("Location updates are failing. Retrying automatically…");
        }
      }
    },
    [updateLocation, clearGpsTimers],
  );

  const beginWatch = useCallback(
    (orderId: string) => {
      clearGpsTimers();
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        setGpsError("GPS is not supported by this browser.");
        return false;
      }

      watchRef.current = navigator.geolocation.watchPosition(
        (position) => {
          latestPositionRef.current = toSharedPosition(position);
          setGpsError(null);
        },
        (error) => {
          setGpsError(geoErrorMessage(error));
          if (error.code === error.PERMISSION_DENIED) {
            clearGpsTimers();
            activeOrderRef.current = null;
            setActiveOrderId(null);
            void stopTracking({ orderId: orderId as Id<"orders"> }).catch(() => {});
            toast.error("Location permission denied — location sharing stopped.");
          }
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
      );

      pingTimerRef.current = window.setInterval(() => {
        const position = latestPositionRef.current;
        if (position) void sendLocation(orderId, position);
      }, GPS_INTERVAL_MS);

      return true;
    },
    [clearGpsTimers, sendLocation, stopTracking],
  );

  const handleStart = useCallback(
    async (orderId: string) => {
      if (busyOrderId || activeOrderRef.current) return;
      setBusyOrderId(orderId);
      setGpsError(null);
      setNetworkError(null);
      setLastSentAt(null);

      try {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          setGpsError("GPS is not supported by this browser.");
          return;
        }

        // Permission is requested before the backend session starts, so a
        // denial never leaves a "live" order with no location.
        const firstPosition = await getCurrentPosition();
        await startTracking({ orderId: orderId as Id<"orders"> });

        activeOrderRef.current = orderId;
        setActiveOrderId(orderId);
        latestPositionRef.current = toSharedPosition(firstPosition);
        await sendLocation(orderId, latestPositionRef.current);
        beginWatch(orderId);
        toast.success("Live location sharing started.");
      } catch (error: any) {
        if (typeof error?.code === "number") {
          setGpsError(geoErrorMessage(error));
        } else {
          toast.error(error?.message ?? "Could not start delivery.");
        }
      } finally {
        setBusyOrderId(null);
      }
    },
    [busyOrderId, beginWatch, sendLocation, startTracking],
  );

  const handleResume = useCallback(
    async (orderId: string) => {
      if (busyOrderId || activeOrderRef.current) return;
      setBusyOrderId(orderId);
      setGpsError(null);
      setNetworkError(null);

      try {
        const firstPosition = await getCurrentPosition();
        activeOrderRef.current = orderId;
        setActiveOrderId(orderId);
        latestPositionRef.current = toSharedPosition(firstPosition);
        await sendLocation(orderId, latestPositionRef.current);
        beginWatch(orderId);
        toast.success("GPS sharing resumed.");
      } catch (error: any) {
        if (typeof error?.code === "number") {
          setGpsError(geoErrorMessage(error));
        } else {
          toast.error(error?.message ?? "Could not resume location sharing.");
        }
      } finally {
        setBusyOrderId(null);
      }
    },
    [busyOrderId, beginWatch, sendLocation],
  );

  const handleAccept = useCallback(
    async (orderId: string) => {
      if (busyOrderId) return;
      setBusyOrderId(orderId);
      try {
        await acceptDelivery({ orderId: orderId as Id<"orders"> });
        toast.success("Delivery accepted.");
      } catch (error: any) {
        toast.error(error?.message ?? "Could not accept the delivery.");
      } finally {
        setBusyOrderId(null);
      }
    },
    [busyOrderId, acceptDelivery],
  );

  const handlePickup = useCallback(
    async (orderId: string) => {
      if (busyOrderId) return;
      setBusyOrderId(orderId);
      try {
        await pickupOrder({ orderId: orderId as Id<"orders"> });
        toast.success("Package picked up — order is out for delivery.");
      } catch (error: any) {
        toast.error(error?.message ?? "Could not confirm the pickup.");
      } finally {
        setBusyOrderId(null);
      }
    },
    [busyOrderId, pickupOrder],
  );

  const handleMarkDelivered = useCallback(
    async (orderId: string) => {
      if (busyOrderId) return;
      if (deliveryOtp.trim().length !== 6) {
        toast.error("Enter the 6-digit OTP shown on the customer's Track Order page.");
        return;
      }
      setBusyOrderId(orderId);
      clearGpsTimers();
      activeOrderRef.current = null;
      setActiveOrderId(null);
      setNetworkError(null);
      try {
        await markDelivered({
          orderId: orderId as Id<"orders">,
          otp: deliveryOtp.trim(),
        });
        setConfirmingId(null);
        setDeliveryOtp("");
        toast.success("Delivery completed — location sharing stopped.");
      } catch (error: any) {
        toast.error(error?.message ?? "Could not mark the order delivered.");
      } finally {
        setBusyOrderId(null);
      }
    },
    [busyOrderId, clearGpsTimers, deliveryOtp, markDelivered],
  );

  const handleStop = useCallback(
    async (orderId: string) => {
      clearGpsTimers();
      activeOrderRef.current = null;
      setActiveOrderId(null);
      setNetworkError(null);
      setBusyOrderId(orderId);
      try {
        await stopTracking({ orderId: orderId as Id<"orders"> });
        toast.success("Location sharing stopped.");
      } catch (error: any) {
        toast.error(
          error?.message ??
            "Location sharing stopped on this device, but the server could not be updated.",
        );
      } finally {
        setBusyOrderId(null);
      }
    },
    [clearGpsTimers, stopTracking],
  );

  // Stop sharing locally as soon as the order is completed/cancelled or is
  // reassigned away from this partner.
  useEffect(() => {
    if (!activeOrderId || !assignments) return;
    const row = assignments.find((item) => item._id === activeOrderId);
    if (!row || isTerminalDeliveryStatus(row.status)) {
      clearGpsTimers();
      activeOrderRef.current = null;
      setActiveOrderId(null);
      if (row && isTerminalDeliveryStatus(row.status)) {
        toast.success(
          row.status === "delivered"
            ? "Delivery completed — location sharing stopped."
            : "Order closed — location sharing stopped.",
        );
      }
    }
  }, [assignments, activeOrderId, clearGpsTimers]);

  // Leaving the dashboard (or logging out) ends live sharing immediately; the
  // cron is only a safety net for a crashed browser/phone.
  useEffect(() => {
    return () => {
      clearGpsTimers();
      const orderId = activeOrderRef.current;
      if (orderId) {
        void stopTrackingRef.current({ orderId: orderId as Id<"orders"> }).catch(() => {});
      }
    };
  }, [clearGpsTimers]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  async function handleLogout() {
    const orderId = activeOrderRef.current;
    clearGpsTimers();
    activeOrderRef.current = null;
    setActiveOrderId(null);
    if (orderId) {
      await stopTracking({ orderId: orderId as Id<"orders"> }).catch(() => {});
    }
    await signOut().catch(() => {});
    navigate("/delivery/login", { replace: true });
  }

  const activeRow = assignments?.find((row) => row._id === activeOrderId);
  const activeCount = assignments?.filter((row) => row.trackingActive).length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl gradient-primary text-white">
              <Truck className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-foreground">
                Delivery Dashboard
              </h1>
              <p className="truncate text-[11px] text-muted-foreground">
                {user?.name || "Delivery partner"}
                {user?.phone ? ` · ${user.phone}` : ""}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 text-xs"
            onClick={handleLogout}
          >
            <LogOut className="size-3.5" /> Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-5">
        {activeOrderId && (
          <div className="rounded-2xl border border-emerald-300/70 bg-emerald-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <span className="relative flex size-2.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-emerald-600" />
                </span>
                Live location sharing is on
              </div>
              <span className="text-xs text-emerald-800">
                Last sent {timeAgo(lastSentAt, now)}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-emerald-800/80">
              {activeRow
                ? `Order #${activeRow.invoiceNumber || activeRow._id.slice(-6).toUpperCase()} · ${
                    activeRow.customerName
                  }`
                : "Sending your GPS to the customer's tracking page."}{" "}
              Keep this page open while delivering.
            </p>
            {activeCount > 1 && (
              <p className="mt-1 text-[11px] text-amber-700">
                Another delivery session is also marked live. Starting/stopping one
                keeps only this device&apos;s sharing accurate.
              </p>
            )}
          </div>
        )}

        {gpsError && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p className="flex-1 leading-relaxed">{gpsError}</p>
            <button
              type="button"
              onClick={() => setGpsError(null)}
              aria-label="Dismiss GPS message"
              className="rounded p-0.5 hover:bg-rose-100"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {networkError && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <WifiOff className="mt-0.5 size-4 shrink-0" />
            <p className="flex-1 leading-relaxed">{networkError}</p>
          </div>
        )}

        {assignments === undefined ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : assignments.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-16 text-center">
              <Package className="mx-auto mb-4 size-12 text-muted-foreground/30" />
              <h2 className="text-lg font-semibold text-foreground">
                No deliveries assigned
              </h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Orders assigned to you by the pharmacy will appear here. Pull to refresh
                after the admin assigns a delivery.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                My deliveries ({assignments.length})
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Only orders assigned to you
              </p>
            </div>

            {assignments.map((row) => {
              const terminal = isTerminalDeliveryStatus(row.status);
              const isActiveHere = activeOrderId === row._id;
              const isActiveElsewhere = row.trackingActive && !isActiveHere;
              const isBusy = busyOrderId === row._id;

              return (
                <Card
                  key={row._id}
                  className={`border-border/60 ${
                    isActiveHere ? "border-emerald-300 ring-1 ring-emerald-200" : ""
                  }`}
                >
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/[0.06]">
                          <Package className="size-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            Order #{row.invoiceNumber || row._id.slice(-6).toUpperCase()}
                          </p>
                          <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="size-3" />
                            {new Date(row.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                            <span>·</span>
                            {formatCurrency(row.totalAmount)}
                          </p>
                        </div>
                      </div>
                      <Badge
                        className={`text-[10px] capitalize ${getStatusColor(row.status)}`}
                      >
                        {STATUS_LABELS[row.status] || row.status}
                      </Badge>
                    </div>

                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      <div className="rounded-xl bg-muted/40 p-2.5">
                        <p className="font-medium text-foreground">{row.customerName}</p>
                        <a
                          href={`tel:${row.phone}`}
                          className="mt-0.5 inline-flex items-center gap-1 text-primary hover:underline"
                        >
                          <Phone className="size-3" /> {row.phone}
                        </a>
                      </div>
                      <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-2.5">
                        <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <p className="leading-relaxed text-muted-foreground">
                          {row.shippingAddress}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3">
                      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Navigation className="size-3" />
                        {isActiveHere
                          ? `Sharing live · last sent ${timeAgo(lastSentAt, now)}`
                          : isActiveElsewhere
                            ? "Live session is active, but this browser is not sending GPS"
                            : terminal
                              ? "Delivery closed"
                              : "Location sharing has not started"}
                        <span>· {row.itemCount} item{row.itemCount === 1 ? "" : "s"}</span>
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {terminal ? (
                          <span className="text-[11px] font-medium text-muted-foreground">
                            No action needed
                          </span>
                        ) : isActiveHere ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 border-rose-200 text-xs text-rose-700 hover:bg-rose-50"
                            disabled={isBusy}
                            onClick={() => handleStop(row._id)}
                          >
                            {isBusy ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Square className="size-3.5" />
                            )}
                            Stop Delivery
                          </Button>
                        ) : isActiveElsewhere ? (
                          <>
                            <Button
                              size="sm"
                              className="h-8 gap-1.5 text-xs gradient-primary text-white"
                              disabled={isBusy || Boolean(activeOrderId)}
                              onClick={() => handleResume(row._id)}
                            >
                              {isBusy ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Play className="size-3.5" />
                              )}
                              Resume GPS
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 border-rose-200 text-xs text-rose-700 hover:bg-rose-50"
                              disabled={isBusy}
                              onClick={() => handleStop(row._id)}
                            >
                              <Square className="size-3.5" /> Stop
                            </Button>
                          </>
                        ) : row.assignmentStatus !== "accepted" &&
                          row.assignmentStatus !== "picked_up" ? (
                          <Button
                            size="sm"
                            className="h-8 gap-1.5 text-xs gradient-primary text-white"
                            disabled={isBusy}
                            onClick={() => handleAccept(row._id)}
                          >
                            {isBusy ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-3.5" />
                            )}
                            Accept delivery
                          </Button>
                        ) : row.status !== "out_for_delivery" ? (
                          <Button
                            size="sm"
                            className="h-8 gap-1.5 text-xs gradient-primary text-white"
                            disabled={isBusy}
                            onClick={() => handlePickup(row._id)}
                          >
                            {isBusy ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Package className="size-3.5" />
                            )}
                            Confirm pickup
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            className="h-8 gap-1.5 text-xs gradient-primary text-white"
                            disabled={isBusy || Boolean(activeOrderId)}
                            title={
                              activeOrderId
                                ? "Stop the current delivery before starting another"
                                : undefined
                            }
                            onClick={() => handleStart(row._id)}
                          >
                            {isBusy ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Play className="size-3.5" />
                            )}
                            Start Delivery
                          </Button>
                        )}

                        {!terminal && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1.5 border-emerald-200 text-xs text-emerald-700 hover:bg-emerald-50"
                            disabled={isBusy}
                            onClick={() => setConfirmingId(row._id)}
                          >
                            <CheckCircle2 className="size-3.5" />
                            Mark as Delivered
                          </Button>
                        )}
                      </div>
                    </div>

                    {!terminal && confirmingId === row._id && (
                      <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-xs">
                        <p className="text-emerald-900">
                          Ask the customer for the 6-digit delivery OTP shown on their
                          Track Order page. Delivered is recorded only after it is
                          verified.
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            value={deliveryOtp}
                            onChange={(event) =>
                              setDeliveryOtp(
                                event.target.value.replace(/\D/g, "").slice(0, 6),
                              )
                            }
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            placeholder="6-digit OTP"
                            aria-label="Delivery OTP"
                            className="h-8 w-32 rounded-md border border-emerald-300 bg-white px-2 text-center font-mono text-sm tracking-[0.25em] text-emerald-900 outline-none focus:border-emerald-500"
                          />
                          <Button
                            size="sm"
                            className="h-7 gap-1 text-xs bg-emerald-600 text-white hover:bg-emerald-700"
                            disabled={isBusy || deliveryOtp.trim().length !== 6}
                            onClick={() => handleMarkDelivered(row._id)}
                          >
                            {isBusy ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-3.5" />
                            )}
                            Verify OTP &amp; complete
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs"
                            onClick={() => {
                              setConfirmingId(null);
                              setDeliveryOtp("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <p className="pb-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          Your location is shared only while a delivery is active and is deleted as soon
          as you stop or the order is completed.
        </p>
      </main>
    </div>
  );
}
