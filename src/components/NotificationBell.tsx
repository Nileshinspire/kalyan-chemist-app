import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, CheckCheck, Megaphone, ShoppingBag, Pill, Info } from "lucide-react";
import { categoryEmoji } from "@/convex/messageCenterCore";

function iconFor(type: string, campaignId?: string, category?: string) {
  if (campaignId) {
    return <span aria-hidden="true">{categoryEmoji(category ?? "")}</span>;
  }
  switch (type) {
    case "order_status":
      return <ShoppingBag className="size-3.5" />;
    case "refill_reminder":
      return <Pill className="size-3.5" />;
    case "promo":
      return <Megaphone className="size-3.5" />;
    default:
      return <Info className="size-3.5" />;
  }
}

export default function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const notifications = useQuery(
    api.notifications.list,
    isAuthenticated ? {} : "skip"
  );
  const unreadCount = useQuery(
    api.notifications.unreadCount,
    isAuthenticated ? {} : "skip"
  );
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);

  if (!isAuthenticated) return null;

  const recent = (notifications ?? []).slice(0, 6);
  const unread = typeof unreadCount === "number" ? unreadCount : 0;

  async function openNotification(notification: any) {
    if (!notification.read) {
      try {
        await markRead({ notificationId: notification._id });
      } catch {
        // Never block opening a notification on the read-state call.
      }
    }
    if (notification.link?.startsWith("/")) {
      navigate(notification.link);
    } else {
      navigate("/account/notifications");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-xl hover:bg-primary/5"
          aria-label={
            unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
          }
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E53935] px-0.5 text-[9px] font-semibold leading-none text-white ring-[1.5px] ring-background">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[21rem] overflow-hidden rounded-xl border-border/60 p-0 shadow-lg"
      >
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-[10px] text-muted-foreground">
              {unread > 0 ? `${unread} unread` : "You're all caught up"}
            </p>
          </div>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => markAllRead()}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/5"
            >
              <CheckCheck className="size-3" />
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto p-1">
          {recent.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Bell className="mx-auto size-6 text-muted-foreground/40" />
              <p className="mt-2 text-xs text-muted-foreground">
                No notifications yet. Order updates and messages will appear here.
              </p>
            </div>
          ) : (
            recent.map((notification: any) => (
              <button
                key={notification._id}
                type="button"
                onClick={() => openNotification(notification)}
                className={`flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition-colors hover:bg-muted/60 ${
                  notification.read ? "" : "bg-primary/[0.03]"
                }`}
              >
                <span
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg ${
                    notification.read
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  {iconFor(notification.type, notification.campaignId, notification.category)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`truncate text-xs ${
                        notification.read ? "font-medium" : "font-semibold"
                      }`}
                    >
                      {notification.title}
                    </span>
                    {!notification.read && (
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-muted-foreground">
                    {notification.body}
                  </span>
                  <span className="mt-1 block text-[9.5px] text-muted-foreground/70">
                    {new Date(notification.createdAt).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>

        <div className="border-t border-border/60 p-1">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-xs"
            onClick={() => navigate("/account/notifications")}
          >
            View all notifications
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
