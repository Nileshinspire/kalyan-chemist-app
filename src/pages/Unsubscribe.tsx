import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import BrandMark from "@/components/BrandMark";
import { CheckCircle2, Loader2, MailX, ShieldCheck } from "lucide-react";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const unsubscribe = useMutation(api.messageCenter.unsubscribeByToken);
  const [state, setState] = useState<"checking" | "success" | "invalid">("checking");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) {
      setState("invalid");
      return;
    }
    unsubscribe({ token })
      .then((result) => setState(result.success ? "success" : "invalid"))
      .catch(() => setState("invalid"));
  }, [token, unsubscribe]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 via-background to-teal-50 px-4 py-12">
      <Card className="w-full max-w-md border-border/60 shadow-lg">
        <CardContent className="p-8 text-center">
          <div className="mx-auto mb-5 flex items-center justify-center gap-2">
            <BrandMark className="size-9" />
            <span className="text-lg font-bold tracking-tight">Kalyan Chemist</span>
          </div>

          {state === "checking" && (
            <>
              <Loader2 className="mx-auto size-8 animate-spin text-primary" />
              <h1 className="mt-4 text-lg font-semibold">Updating your preferences…</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                One moment while we process your unsubscribe request.
              </p>
            </>
          )}

          {state === "success" && (
            <>
              <CheckCircle2 className="mx-auto size-12 text-emerald-600" />
              <h1 className="mt-4 text-lg font-semibold">You&apos;re unsubscribed</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                You will no longer receive promotional emails from Kalyan Chemist.
                Order and prescription updates will continue as needed for your account.
              </p>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3" />
                Changed your mind? Re-enable email in Account → Notifications.
              </p>
              <Button asChild className="mt-6 w-full gradient-primary text-white">
                <Link to="/">Back to Kalyan Chemist</Link>
              </Button>
            </>
          )}

          {state === "invalid" && (
            <>
              <MailX className="mx-auto size-12 text-muted-foreground/60" />
              <h1 className="mt-4 text-lg font-semibold">This link is not valid</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                The unsubscribe link may have expired or already been used. You can
                manage all communication preferences from your account at any time.
              </p>
              <Button asChild variant="outline" className="mt-6 w-full">
                <Link to="/account/notifications">Manage notification preferences</Link>
              </Button>
              <Button asChild variant="ghost" className="mt-2 w-full">
                <Link to="/">Back to home</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
