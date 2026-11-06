import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";
import {
  Bell,
  BellOff,
  CheckCheck,
  Loader2,
  ShoppingBag,
  Tag,
  Info,
  Pill,
  Mail,
  Globe,
  MessageSquare,
  MessageCircle,
  Megaphone,
  Settings,
  BellRing,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { categoryEmoji, categoryLabel } from "@/convex/messageCenterCore";
import { NotificationMessage } from "@/components/notifications/NotificationMessage";
import { isLoadableImageUrl } from "@/components/notifications/notificationTemplate";

function getNotifIcon(type: string) {
  switch (type) {
    case "order_status":
      return <ShoppingBag className="size-4" />;
    case "promo":
      return <Megaphone className="size-4" />;
    case "refill_reminder":
      return <Pill className="size-4" />;
    default:
      return <Info className="size-4" />;
  }
}

/** List thumbnail: renders only a real image; otherwise the category glyph. */
function NotificationListThumb({ notif }: { notif: any }) {
  const [failed, setFailed] = useState(false);
  if (isLoadableImageUrl(notif.imageUrl) && !failed) {
    return (
      <img
        src={notif.imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="size-12 shrink-0 rounded-xl object-cover"
      />
    );
  }
  return (
    <div
      className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
        !notif.read ? getNotifColor(notif.type) : "bg-muted text-muted-foreground"
      }`}
    >
      {notif.campaignId ? (
        <span aria-hidden="true">{categoryEmoji(notif.category ?? "")}</span>
      ) : (
        getNotifIcon(notif.type)
      )}
    </div>
  );
}

function getNotifColor(type: string) {
  switch (type) {
    case "order_status":
      return "bg-blue-50 text-blue-600";
    case "promo":
      return "bg-purple-50 text-purple-600";
    case "refill_reminder":
      return "bg-amber-50 text-amber-600";
    default:
      return "bg-muted text-muted-foreground";
  }
}


type PrefKey = "inApp" | "popup" | "email" | "whatsapp" | "promotional";

export default function AccountNotifications() {
  const notifications = useQuery(api.notifications.list, {});
  const prefs = useQuery(api.messageCenter.myPreferences, {});
  const waitingAlerts = useQuery(api.availabilityNotifications.myWaiting, {});
  const markAllRead = useMutation(api.notifications.markAllRead);
  const cancelStockAlert = useMutation(api.availabilityNotifications.cancelNotification);
  const markRead = useMutation(api.notifications.markRead);
  const updatePreferences = useMutation(api.messageCenter.updatePreferences);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Deep links (e.g. from the bell) carry the real notification id. It only
  // seeds the open id: the dialog's open/closed state stays owned by React so
  // closing it can never be undone by the URL.
  const linkedNotificationId = searchParams.get("notification");
  const [openNotificationId, setOpenNotificationId] = useState<string | null>(
    linkedNotificationId
  );
  const detail = useQuery(
    api.notifications.get,
    openNotificationId ? { notificationId: openNotificationId } : "skip"
  );
  const [markingAll, setMarkingAll] = useState(false);
  const [savingPref, setSavingPref] = useState<PrefKey | null>(null);

  // Browser (desktop push) notifications remain a device-local preference.
  const [browserEnabled, setBrowserEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("kc_browser_notifications") !== "false";
    }
    return true;
  });

  async function handlePreference(key: PrefKey, checked: boolean) {
    setSavingPref(key);
    try {
      await updatePreferences({ [key]: checked });
      toast.success(
        checked ? "Notification preference updated" : "Preference updated — channel disabled"
      );
    } catch (error: any) {
      toast.error(error?.message ?? "Could not update preference");
    } finally {
      setSavingPref(null);
    }
  }

  async function handleBrowserToggle(checked: boolean) {
    if (checked && "Notification" in window && Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        toast.error("Browser notification permission denied");
        return;
      }
    }
    setBrowserEnabled(checked);
    localStorage.setItem("kc_browser_notifications", String(checked));
    toast.success(checked ? "Browser notifications enabled" : "Browser notifications disabled");
  }

  async function handleCancelStockAlert(productId: any) {
    try {
      await cancelStockAlert({ productId });
      toast.success("Restock alert cancelled");
    } catch (error: any) {
      toast.error(error?.message ?? "Could not cancel the restock alert");
    }
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      const result = await markAllRead();
      toast.success(
        result?.count ? `${result.count} notification(s) marked read` : "No unread notifications"
      );
    } catch {
      toast.error("Failed to mark notifications");
    } finally {
      setMarkingAll(false);
    }
  }

  /** Single close path for the ×, the footer button and Esc/overlay dismiss. */
  function closeNotification() {
    setOpenNotificationId(null);
    if (linkedNotificationId) {
      // Drop the deep-link id too, otherwise the effect below would reopen it.
      const next = new URLSearchParams(searchParams);
      next.delete("notification");
      setSearchParams(next, { replace: true });
    }
  }

  async function openNotification(notification: any) {
    setOpenNotificationId(notification._id);
    if (!notification.read) {
      try {
        await markRead({ notificationId: notification._id });
      } catch {
        // Read state is best-effort; opening the message should never be blocked.
      }
    }
  }

  // Re-seed the open id when the page is reached through a bell deep link.
  useEffect(() => {
    if (linkedNotificationId) setOpenNotificationId(linkedNotificationId);
  }, [linkedNotificationId]);

  // A notification arriving from the bell is opened by its real id. If it was
  // deleted (e.g. the campaign was removed) or expired, say so and clear the id
  // instead of leaving a dead link in the URL.
  useEffect(() => {
    if (!linkedNotificationId || detail === undefined) return;
    if (detail === null) {
      toast.error("That notification is no longer available.");
      closeNotification();
      return;
    }
    if (!detail.read) {
      markRead({ notificationId: detail._id }).catch(() => {
        // Read state is best-effort.
      });
    }
    // closeNotification is stable enough for this one-shot read/cleanup effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedNotificationId, detail, markRead]);

  const unreadCount = notifications?.filter((n: any) => !n.read).length || 0;

  if (notifications === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const channels: {
    key: PrefKey;
    icon: typeof Bell;
    tone: string;
    title: string;
    description: string;
    disabled?: boolean;
  }[] = [
    {
      key: "inApp",
      icon: Bell,
      tone: "bg-blue-50 text-blue-600",
      title: "Website notifications",
      description: "Messages and campaign updates inside your account",
    },
    {
      key: "popup",
      icon: MessageSquare,
      tone: "bg-purple-50 text-purple-600",
      title: "Login popups",
      description: "Important announcements shown once after sign-in",
    },
    {
      key: "email",
      icon: Mail,
      tone: "bg-emerald-50 text-emerald-600",
      title: "Email updates",
      description: `Promotions and announcements${
        prefs?.emailMasked && prefs.emailMasked !== "—" ? ` to ${prefs.emailMasked}` : ""
      }`,
      disabled: prefs?.emailAvailable === false,
    },
    {
      key: "whatsapp",
      icon: MessageCircle,
      tone: "bg-green-50 text-green-600",
      title: "WhatsApp messages",
      description: prefs?.phoneVerified
        ? "Only messages you have opted in to receive"
        : "Add and verify a phone number to enable WhatsApp",
      disabled: !prefs?.phoneVerified,
    },
    {
      key: "promotional",
      icon: Tag,
      tone: "bg-amber-50 text-amber-600",
      title: "Offers and promotions",
      description: "Festival wishes, health tips and special offers",
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Messages from Kalyan Chemist and your communication preferences
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={handleMarkAllRead}
            disabled={markingAll}
          >
            {markingAll ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCheck className="size-3.5" />
            )}
            Mark all read ({unreadCount})
          </Button>
        )}
      </div>

      {/* Communication preferences */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <Settings className="size-4" /> Communication Preferences
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Turning a channel off stops new campaign messages on it immediately. Order
            and prescription updates still follow your account settings.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {channels.map((channel, index) => {
            const value = prefs ? Boolean((prefs as any)[channel.key]) : true;
            return (
              <div key={channel.key}>
                {index > 0 && <Separator className="mb-4" />}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex size-9 items-center justify-center rounded-xl ${channel.tone}`}
                    >
                      <channel.icon className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{channel.title}</p>
                      <p className="text-xs text-muted-foreground">{channel.description}</p>
                    </div>
                  </div>
                  {savingPref === channel.key ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch
                      checked={value}
                      disabled={channel.disabled || !prefs}
                      onCheckedChange={(checked) => handlePreference(channel.key, checked)}
                      aria-label={channel.title}
                    />
                  )}
                </div>
              </div>
            );
          })}

          <Separator />
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Globe className="size-4" />
              </div>
              <div>
                <p className="text-sm font-medium">Browser notifications</p>
                <p className="text-xs text-muted-foreground">Desktop alerts on this device</p>
              </div>
            </div>
            <Switch checked={browserEnabled} onCheckedChange={handleBrowserToggle} />
          </div>

          {prefs?.unsubscribedAt && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
              You previously unsubscribed from promotional email. Re-enable Email and
              Offers above to receive them again.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Restock alerts — always visible so the feature is discoverable */}
      {waitingAlerts !== undefined && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <BellRing className="size-4" /> Restock alerts
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              We&apos;ll send a website notification when these medicines are back in
              stock.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {waitingAlerts.length === 0 && (
              <p className="rounded-xl border border-dashed border-border/60 px-3 py-3 text-xs text-muted-foreground">
                You&apos;re not waiting on any medicines. Open an out-of-stock product
                and tap “Notify Me When Available” to get a website notification when
                it returns.
              </p>
            )}
            {waitingAlerts.map((alert: any) => (
              <div
                key={alert._id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {alert.productName}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Waiting for stock
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 shrink-0 gap-1 px-2 text-xs text-muted-foreground"
                  onClick={() => handleCancelStockAlert(alert.productId)}
                >
                  <X className="size-3" />
                  Cancel
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Notification list */}
      {notifications.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <BellOff className="mx-auto mb-4 size-12 text-muted-foreground/30" />
            <h3 className="mb-1 text-lg font-semibold text-foreground">No notifications</h3>
            <p className="text-sm text-muted-foreground">
              You&apos;re all caught up! We&apos;ll notify you when something happens.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((notif: any) => (
            <Card
              key={notif._id}
              className={`border transition-all ${
                !notif.read
                  ? "border-primary/15 bg-primary/[0.02]"
                  : "border-border/40 bg-card"
              }`}
            >
              <CardContent className="p-3.5">
                <button
                  type="button"
                  onClick={() => openNotification(notif)}
                  className="flex w-full items-start gap-3 text-left"
                >
                  <NotificationListThumb notif={notif} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={`text-sm ${
                          !notif.read ? "font-semibold" : "font-medium"
                        } text-foreground`}
                      >
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <Badge className="border-0 bg-primary/10 px-1.5 py-0 text-[10px] text-primary">
                          New
                        </Badge>
                      )}
                      {notif.campaignId && notif.category && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          {categoryLabel(notif.category)}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {notif.body}
                    </p>
                    <div className="mt-1.5 flex items-center gap-3">
                      <p className="text-[11px] text-muted-foreground/60">
                        {new Date(notif.createdAt).toLocaleString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <span className="text-[11px] font-medium text-primary">View →</span>
                    </div>
                  </div>
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(openNotificationId)}
        onOpenChange={(open) => {
          if (!open) closeNotification();
        }}
      >
        <DialogContent className="flex max-h-[90dvh] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden rounded-2xl border-border/60 p-0 shadow-2xl [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:bg-white/85 [&_[data-slot=dialog-close]]:p-1 [&_[data-slot=dialog-close]]:text-foreground [&_[data-slot=dialog-close]]:shadow-sm [&_[data-slot=dialog-close]]:ring-1 [&_[data-slot=dialog-close]]:ring-black/5 [&_[data-slot=dialog-close]]:hover:bg-white sm:max-w-md">
          {/* Radix needs a title/description for the dialog's a11y tree; the
              visible heading lives inside the context-aware template. */}
          <DialogHeader className="sr-only">
            <DialogTitle>{detail?.title ?? "Notification"}</DialogTitle>
            <DialogDescription>Notification details</DialogDescription>
          </DialogHeader>

          {detail && <NotificationMessage notification={detail} />}

          {!detail && (
            <div className="min-h-0 flex-1 px-5 py-10 text-center sm:px-7">
              {detail === undefined ? (
                <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading notification…
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This notification is no longer available. It may have been removed or
                  expired.
                </p>
              )}
            </div>
          )}

          {/* ── Sticky action bar ── */}
          <DialogFooter className="mx-0 mb-0 flex-row items-center justify-end gap-2 border-t border-border/60 bg-muted/30 px-4 py-3 sm:px-6">
            <Button
              variant="outline"
              size="sm"
              className="w-full rounded-lg border-border/70 bg-background font-medium shadow-sm sm:w-auto"
              onClick={closeNotification}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
