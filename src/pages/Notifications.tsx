import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import {
  Bell,
  BellOff,
  CheckCheck,
  Package,
  Pill,
  Tag,
  Info,
  Trash2,
  ShoppingCart,
} from "lucide-react";
import { relativeTime } from "@/lib/security";

const typeIcons: Record<string, React.ReactNode> = {
  order_status: <Package className="size-4" />,
  refill_reminder: <Pill className="size-4" />,
  promo: <Tag className="size-4" />,
  system: <Info className="size-4" />,
};

const typeColors: Record<string, string> = {
  order_status: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  refill_reminder: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  promo: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  system: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function Notifications() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const notifications = useQuery(
    api.notifications.list,
    isAuthenticated ? { unreadOnly: filter === "unread" } : "skip"
  );
  const unreadCount = useQuery(
    api.notifications.unreadCount,
    isAuthenticated ? {} : "skip"
  );
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const removeNotif = useMutation(api.notifications.remove);

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-background px-6 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <BellOff className="mx-auto size-12 text-muted-foreground/50" />
          <h1 className="mt-4 text-2xl font-bold">Notifications</h1>
          <p className="mt-2 text-muted-foreground">
            Sign in to view your notifications.
          </p>
          <Button className="mt-4" onClick={() => navigate("/auth")}>
            Sign In
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Notifications
            </h1>
            {unreadCount !== undefined && unreadCount > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                You have {unreadCount} unread notification{unreadCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              variant={filter === "unread" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setFilter("unread")}
            >
              Unread {unreadCount !== undefined && unreadCount > 0 && `(${unreadCount})`}
            </Button>
            {unreadCount !== undefined && unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllRead()}
              >
                <CheckCheck className="mr-1.5 size-3.5" />
                Mark All Read
              </Button>
            )}
          </div>
        </header>

        {/* Notification List */}
        {!notifications ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-muted/50" />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Bell className="size-12 text-muted-foreground/30" />
              <p className="mt-4 text-muted-foreground">
                {filter === "unread"
                  ? "No unread notifications."
                  : "No notifications yet."}
              </p>
              <p className="mt-1 text-sm text-muted-foreground/70">
                Order updates and refill reminders will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif) => (
              <Card
                key={notif._id}
                className={`border-border/60 cursor-pointer transition-all hover:border-primary/30 ${
                  !notif.read
                    ? "bg-primary/[0.03] border-primary/20"
                    : "opacity-75"
                }`}
                onClick={async () => {
                  if (!notif.read) {
                    await markRead({ notificationId: notif._id });
                  }
                  if (notif.link) {
                    navigate(notif.link);
                  }
                }}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <div
                    className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${
                      typeColors[notif.type] || typeColors.system
                    }`}
                  >
                    {typeIcons[notif.type] || <Info className="size-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-snug ${
                        !notif.read ? "font-semibold" : "font-medium"
                      }`}>
                        {notif.title}
                      </p>
                      {!notif.read && (
                        <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed line-clamp-2">
                      {notif.body}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <span className="text-xs text-muted-foreground/70">
                        {relativeTime(notif.createdAt)}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {notif.type.replace("_", " ")}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground/50 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNotif({ notificationId: notif._id });
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
