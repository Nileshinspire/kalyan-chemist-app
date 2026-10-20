import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { categoryEmoji, categoryLabel } from "@/convex/messageCenterCore";

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
  const markAllRead = useMutation(api.notifications.markAllRead);
  const markRead = useMutation(api.notifications.markRead);
  const updatePreferences = useMutation(api.messageCenter.updatePreferences);
  const navigate = useNavigate();
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

  async function openNotification(notification: any) {
    if (!notification.read) {
      try {
        await markRead({ notificationId: notification._id });
      } catch {
        // Read state is best-effort; opening the link should not be blocked.
      }
    }
    if (notification.link && notification.link.startsWith("/")) {
      navigate(notification.link);
    }
  }

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
                  {notif.imageUrl ? (
                    <img
                      src={notif.imageUrl}
                      alt=""
                      className="size-12 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
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
                  )}
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
                      {notif.link && (
                        <span className="text-[11px] font-medium text-primary">View →</span>
                      )}
                    </div>
                  </div>
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
