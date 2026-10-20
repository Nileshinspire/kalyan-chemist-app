import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/context/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { categoryEmoji, categoryLabel } from "@/convex/messageCenterCore";

/**
 * Routes where a marketing popup must never interrupt the customer:
 * checkout/payment, cart review, order detail, prescription upload, refill and
 * lab-test booking. Admin and auth screens are excluded too.
 */
const SUPPRESSED_ROUTES = [
  /^\/checkout/,
  /^\/cart/,
  /^\/orders/,
  /^\/account\/orders/,
  /^\/upload-prescription/,
  /^\/refill/,
  /^\/account\/refill/,
  /^\/lab-tests/,
  /^\/doctor-appointment/,
  /^\/account\/track-order/,
  /^\/admin/,
  /^\/auth/,
  /^\/login/,
  /^\/register/,
];

export default function LoginMessagePopup() {
  const { isAuthenticated, isAdmin, isAuthLoading } = useAuth();
  const location = useLocation();
  const suppressed = SUPPRESSED_ROUTES.some((pattern) => pattern.test(location.pathname));

  const popup = useQuery(
    api.messageCenter.activePopup,
    isAuthenticated && !isAuthLoading && !isAdmin && !suppressed ? {} : "skip"
  );
  const markSeen = useMutation(api.messageCenter.markPopupSeen);
  const dismissPopup = useMutation(api.messageCenter.dismissPopup);

  const [ready, setReady] = useState(false);
  const [sessionHidden, setSessionHidden] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const markedSeen = useRef<string | null>(null);

  // Small delay keeps the popup from competing with page load.
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  // One display per campaign per browser session.
  useEffect(() => {
    if (!popup?.campaignId) return;
    try {
      if (sessionStorage.getItem(`kc_popup_${popup.campaignId}`) === "1") {
        setSessionHidden(true);
      } else {
        setSessionHidden(false);
      }
    } catch {
      // sessionStorage may be unavailable in private mode — fail open.
    }
  }, [popup?.campaignId]);

  useEffect(() => {
    if (!popup?.campaignId || !ready || sessionHidden) return;
    if (markedSeen.current === popup.campaignId) return;
    markedSeen.current = popup.campaignId;
    try {
      sessionStorage.setItem(`kc_popup_${popup.campaignId}`, "1");
    } catch {
      // ignore
    }
    markSeen({ campaignId: popup.campaignId }).catch(() => {
      // Seen tracking is best-effort; the popup still must not block the page.
    });
  }, [popup?.campaignId, ready, sessionHidden, markSeen]);

  if (!popup || !ready || sessionHidden) return null;

  async function dismiss() {
    if (!popup?.campaignId || dismissing) return;
    setDismissing(true);
    try {
      await dismissPopup({ campaignId: popup.campaignId });
    } catch {
      // The popup closes for this session even if persistence fails.
    } finally {
      setSessionHidden(true);
      setDismissing(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && dismiss()}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto p-0 sm:max-w-md">
        {popup.imageUrl && (
          <img
            src={popup.imageUrl}
            alt=""
            className="max-h-56 w-full rounded-t-lg object-cover"
          />
        )}
        <div className="space-y-3 p-6 pt-5">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            <span aria-hidden="true">{categoryEmoji(popup.category ?? "")}</span>
            {categoryLabel(popup.category ?? "")}
          </p>
          <DialogTitle className="pr-6 text-left text-xl font-bold leading-snug">
            {popup.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Message from Kalyan Chemist. You can dismiss this popup and it will not be
            shown again.
          </DialogDescription>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {popup.body}
          </p>
          {popup.expiresAt && (
            <p className="text-[10px] text-muted-foreground/70">
              This message is available until{" "}
              {new Date(popup.expiresAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              .
            </p>
          )}
          <div className="flex justify-end pt-1">
            <Button
              className="gradient-primary text-white"
              onClick={dismiss}
              disabled={dismissing}
            >
              {dismissing ? "Closing…" : "Got it"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
