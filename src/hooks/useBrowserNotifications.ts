import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Hook that requests browser notification permission and shows
 * desktop notifications when new in-app notifications arrive.
 */
export function useBrowserNotifications() {
  const notifications = useQuery(api.notifications.list, { unreadOnly: true });
  const prevCountRef = useRef<number>(0);
  const permissionRef = useRef<NotificationPermission>("default");

  // Request permission on mount
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    permissionRef.current = Notification.permission;

    if (Notification.permission === "default") {
      // Delay the prompt to avoid being intrusive
      const timer = setTimeout(() => {
        Notification.requestPermission().then((perm) => {
          permissionRef.current = perm;
        });
      }, 10000); // Ask after 10 seconds
      return () => clearTimeout(timer);
    }
  }, []);

  // Show browser notification when new unread notification arrives
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (!notifications || notifications.length === 0) return;

    const currentCount = notifications.length;

    // Only notify for NEW unread notifications (count increased)
    if (currentCount > prevCountRef.current && prevCountRef.current > 0) {
      const newest = notifications[0]; // newest first
      if (newest && !newest.read) {
        try {
          const browserNotif = new Notification(newest.title, {
            body: newest.body,
            icon: "/logo.svg",
            badge: "/logo.svg",
            tag: newest._id, // Prevent duplicates
          });
          browserNotif.onclick = () => {
            window.focus();
            if (newest.link) {
              window.location.href = newest.link;
            }
            browserNotif.close();
          };
        } catch {
          // Notification constructor can fail in some environments
        }
      }
    }

    prevCountRef.current = currentCount;
  }, [notifications]);
}
