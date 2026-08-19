import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";

function getNotifIcon(type: string) {
  switch (type) {
    case "order_status": return <ShoppingBag className="size-4" />;
    case "promo": return <Tag className="size-4" />;
    case "refill_reminder": return <Pill className="size-4" />;
    default: return <Info className="size-4" />;
  }
}

export default function AccountNotifications() {
  const notifications = useQuery(api.notifications.list, {});

  if (notifications === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Notifications</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Stay updated on orders and offers
        </p>
      </div>

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
        <div className="space-y-3">
          {notifications.map((notif: any) => (
            <Card
              key={notif._id}
              className={`border-border/60 transition-all ${!notif.read ? "bg-primary/[0.02] border-primary/10" : ""}`}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div className={`size-9 rounded-xl flex items-center justify-center shrink-0 ${!notif.read ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {getNotifIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{notif.title}</p>
                    {!notif.read && <div className="size-2 rounded-full bg-primary" />}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{notif.body}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {new Date(notif.createdAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </motion.div>
  );
}
