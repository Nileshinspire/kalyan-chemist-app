import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  Settings,
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

function getNotifIcon(type: string) {
  switch (type) {
    case "order_status": return <ShoppingBag className="size-4" />;
    case "promo": return <Tag className="size-4" />;
    case "refill_reminder": return <Pill className="size-4" />;
    default: return <Info className="size-4" />;
  }
}

function getNotifColor(type: string) {
  switch (type) {
    case "order_status": return "bg-blue-50 text-blue-600";
    case "promo": return "bg-purple-50 text-purple-600";
    case "refill_reminder": return "bg-amber-50 text-amber-600";
    default: return "bg-muted text-muted-foreground";
  }
}

export default function AccountNotifications() {
  const notifications = useQuery(api.notifications.list, {});
  const markAllRead = useMutation(api.notifications.markAllRead);
  const [markingAll, setMarkingAll] = useState(false);

  // Notification preferences (stored in localStorage)
  const [emailEnabled, setEmailEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("kc_email_notifications") !== "false";
    }
    return true;
  });
  const [browserEnabled, setBrowserEnabled] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("kc_browser_notifications") !== "false";
    }
    return true;
  });

  // Save preferences to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("kc_email_notifications", String(emailEnabled));
    }
  }, [emailEnabled]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("kc_browser_notifications", String(browserEnabled));
    }
  }, [browserEnabled]);

  const handleBrowserToggle = async (checked: boolean) => {
    if (checked && "Notification" in window && Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        toast.error("Browser notification permission denied");
        return;
      }
    }
    setBrowserEnabled(checked);
    toast.success(checked ? "Browser notifications enabled" : "Browser notifications disabled");
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllRead();
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark notifications");
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = notifications?.filter((n: any) => !n.read).length || 0;

  if (notifications === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Notifications</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Stay updated on orders and offers
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
            {markingAll ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />}
            Mark all read ({unreadCount})
          </Button>
        )}
      </div>

      {/* Notification Preferences */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Settings className="size-4" /> Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <Mail className="size-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Email Notifications</p>
                <p className="text-xs text-muted-foreground">Receive order updates via email</p>
              </div>
            </div>
            <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-purple-50 flex items-center justify-center">
                <Globe className="size-4 text-purple-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Browser Notifications</p>
                <p className="text-xs text-muted-foreground">Get desktop push notifications</p>
              </div>
            </div>
            <Switch checked={browserEnabled} onCheckedChange={handleBrowserToggle} />
          </div>
        </CardContent>
      </Card>

      {/* Notification List */}
      {notifications.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="py-16 text-center">
            <BellOff className="size-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">No notifications</h3>
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
              <CardContent className="p-3.5 flex items-start gap-3">
                <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${
                  !notif.read ? getNotifColor(notif.type) : "bg-muted text-muted-foreground"
                }`}>
                  {getNotifIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-sm ${!notif.read ? "font-semibold" : "font-medium"} text-foreground`}>
                      {notif.title}
                    </p>
                    {!notif.read && (
                      <Badge className="text-[10px] bg-primary/10 text-primary border-0 px-1.5 py-0">New</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{notif.body}</p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <p className="text-[11px] text-muted-foreground/60">
                      {new Date(notif.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {notif.link && (
                      <a
                        href={notif.link}
                        className="text-[11px] text-primary font-medium hover:underline"
                      >
                        View →
                      </a>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
