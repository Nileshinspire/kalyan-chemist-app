import { useState } from "react";
import { useNavigate } from "react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Check,
  Crown,
  Gift,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/auth-utils";
import { loadRazorpayScript } from "@/lib/razorpay";
import { useLanguage } from "@/context/LanguageContext";

type Plan = {
  _id: Id<"membership_plans">;
  name: string;
  description: string;
  price: number;
  durationDays: number;
  benefits: string[];
  restrictions: string[];
  isActive: boolean;
  highlight?: boolean;
  sortOrder: number;
};

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function durationLabel(days: number) {
  if (days % 365 === 0) return `${days / 365} year${days > 365 ? "s" : ""}`;
  if (days % 30 === 0) return `${days / 30} month${days > 30 ? "s" : ""}`;
  return `${days} days`;
}

export default function Membership() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const plans = useQuery(api.memberships.listPlans);
  const mine = useQuery(api.memberships.getMine);
  const startPurchase = useMutation(api.memberships.startPurchase);
  const attachOrder = useMutation(api.memberships.attachRazorpayOrder);
  const markFailed = useMutation(api.memberships.markFailed);
  const createPaymentOrder = useAction(api.razorpayActions.createMembershipPaymentOrder);
  const verifyPayment = useAction(api.razorpayActions.verifyMembershipPayment);
  const getKeyId = useAction(api.razorpayActions.getKeyId);

  const [buyingId, setBuyingId] = useState<string | null>(null);

  async function handleChoose(plan: Plan) {
    if (buyingId) return;
    setBuyingId(plan._id);
    try {
      const started = await startPurchase({ planId: plan._id });
      if (started.activated) {
        toast.success(t("membershipActivated"));
        setBuyingId(null);
        return;
      }
      if (!started.purchaseId) throw new Error("Could not start this purchase.");

      const order = await createPaymentOrder({ purchaseId: started.purchaseId as any });
      await attachOrder({
        purchaseId: started.purchaseId as any,
        razorpayOrderId: order.id,
      });

      // Demo mode has no gateway keys. The server still records a verified
      // purchase in test mode; no real money is charged.
      if (order._demo) {
        await verifyPayment({
          purchaseId: started.purchaseId as any,
          razorpayOrderId: order.id,
          razorpayPaymentId: `pay_demo_${Date.now()}`,
          razorpaySignature: "demo",
        });
        toast.success(`${t("membershipActivated")} · ${t("demoPaymentNote")}`);
        setBuyingId(null);
        return;
      }

      const loaded = await loadRazorpayScript();
      if (!loaded || !window.Razorpay) {
        await markFailed({ purchaseId: started.purchaseId as any });
        throw new Error("Payment window could not open. Please try again.");
      }

      const options: any = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || undefined,
        amount: order.amount,
        currency: order.currency || "INR",
        name: "Kalyan Chemist",
        description: `${plan.name} membership`,
        order_id: order.id,
        handler: async (response: any) => {
          try {
            await verifyPayment({
              purchaseId: started.purchaseId as any,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            toast.success(t("membershipActivated"));
          } catch (error: any) {
            toast.error(error?.message || t("paymentFailed"));
          } finally {
            setBuyingId(null);
          }
        },
        modal: {
          confirm_close: true,
          ondismiss: async () => {
            try {
              await markFailed({ purchaseId: started.purchaseId as any });
            } catch {
              // The purchase simply stays pending; no membership was activated.
            }
            setBuyingId(null);
            toast.info(t("paymentFailed"));
          },
        },
        theme: { color: "#047857" },
      };

      if (!options.key) {
        // The action deliberately never exposes the secret. Fetch the public
        // key id through the existing safe action when keys are configured.
        options.key = await getKeyId({});
      }

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", async () => {
        await markFailed({ purchaseId: started.purchaseId as any });
        setBuyingId(null);
        toast.error(t("paymentFailed"));
      });
      rzp.open();
    } catch (error: any) {
      toast.error(error?.message || t("paymentFailed"));
      setBuyingId(null);
    }
  }

  const current = mine?.current ?? null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-5 sm:px-6 lg:py-10">
          <div className="mb-6 flex items-start gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("back")}
              className="mt-0.5 rounded-xl lg:hidden"
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/menu"))}
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
                <Crown className="size-6 text-primary" /> {t("membership")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("membershipSubtitle")}</p>
            </div>
          </div>

          {current && (
            <Card className="mb-6 overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.1] via-primary/[0.04] to-transparent">
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                      <Crown className="size-5" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                        {t("currentPlan")}
                      </p>
                      <h2 className="text-xl font-bold text-foreground">{current.planName}</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">{current.description}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-1 text-muted-foreground">
                          <CalendarDays className="size-3" />
                          {t("expiresOn")} {formatDate(current.expiresAt)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-background/80 px-2 py-1 font-medium text-primary">
                          <Sparkles className="size-3" />
                          {current.daysRemaining} {t("daysRemaining")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl bg-background/70 p-3 sm:min-w-[210px]">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("memberSavings")}
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {current.benefits.slice(0, 3).map((benefit) => (
                        <li key={benefit} className="flex items-start gap-1.5 text-xs">
                          <Check className="mt-0.5 size-3 shrink-0 text-primary" />
                          <span>{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="mb-3 flex items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">{t("plans")}</h2>
              <p className="text-xs text-muted-foreground">
                {t("renewalNote")}
              </p>
            </div>
          </div>

          {plans === undefined ? (
            <div className="flex justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : plans.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center px-6 py-14 text-center">
                <Crown className="size-9 text-muted-foreground/60" />
                <h3 className="mt-3 text-base font-semibold">{t("plans")}</h3>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Membership plans are being prepared. Please check back soon.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {(plans as Plan[]).map((plan, index) => {
                const isCurrent = current?.planId === plan._id;
                const isFree = plan.price === 0;
                return (
                  <motion.div
                    key={plan._id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card
                      className={`relative flex h-full flex-col ${
                        plan.highlight
                          ? "border-primary/40 shadow-[0_12px_40px_-18px_hsl(var(--primary)/0.45)]"
                          : "border-border/60"
                      }`}
                    >
                      {plan.highlight && (
                        <div className="absolute right-4 top-4">
                          <Badge className="gap-1 bg-primary text-primary-foreground">
                            <Star className="size-3" /> {t("mostPopular")}
                          </Badge>
                        </div>
                      )}
                      <CardContent className="flex flex-1 flex-col p-5">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/[0.08] text-primary">
                          {isFree ? <ShieldCheck className="size-5" /> : <Crown className="size-5" />}
                        </div>
                        <h3 className="mt-3 text-lg font-bold">{plan.name}</h3>
                        <p className="mt-0.5 min-h-[36px] text-xs leading-relaxed text-muted-foreground">
                          {plan.description}
                        </p>
                        <div className="mt-3 flex items-end gap-1">
                          <span className="text-2xl font-bold">
                            {isFree ? t("freePlan") : formatCurrency(plan.price)}
                          </span>
                          {!isFree && (
                            <span className="pb-0.5 text-xs text-muted-foreground">
                              / {durationLabel(plan.durationDays)}
                            </span>
                          )}
                        </div>
                        <div className="mt-4 flex-1">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {t("benefits")}
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {plan.benefits.map((benefit) => (
                              <li key={benefit} className="flex items-start gap-2 text-xs">
                                <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                                <span>{benefit}</span>
                              </li>
                            ))}
                          </ul>
                          {plan.restrictions.length > 0 && (
                            <div className="mt-3 rounded-lg bg-muted/40 p-2.5">
                              <p className="text-[10px] font-semibold text-muted-foreground">
                                {t("restrictions")}
                              </p>
                              <ul className="mt-1 space-y-0.5">
                                {plan.restrictions.map((restriction) => (
                                  <li key={restriction} className="text-[10px] text-muted-foreground">
                                    {restriction}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        <Button
                          className={`mt-5 w-full rounded-xl ${
                            plan.highlight ? "gradient-primary text-white" : ""
                          }`}
                          variant={plan.highlight ? "default" : "outline"}
                          disabled={buyingId !== null}
                          onClick={() => handleChoose(plan)}
                        >
                          {buyingId === plan._id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : isCurrent ? (
                            <RefreshCw className="size-4" />
                          ) : isFree ? (
                            <Gift className="size-4" />
                          ) : (
                            <BadgeCheck className="size-4" />
                          )}
                          {isCurrent
                            ? t("renew")
                            : isFree
                              ? t("activateFree")
                              : t("payAndActivate")}
                        </Button>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Card className="border-border/60">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold">{t("membershipHistory")}</h3>
                {mine === undefined ? (
                  <Loader2 className="mt-3 size-4 animate-spin text-muted-foreground" />
                ) : (mine?.history ?? []).length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("noMembershipHistory")}
                  </p>
                ) : (
                  <div className="mt-3 divide-y divide-border/50">
                    {(mine?.history ?? []).slice(0, 6).map((entry) => (
                      <div key={entry._id} className="flex items-center justify-between gap-2 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">{entry.planName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDate(entry.createdAt)}
                            {entry.expiresAt ? ` · ${formatDate(entry.expiresAt)}` : ""}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-semibold">
                            {entry.amount === 0 ? t("freePlan") : formatCurrency(entry.amount)}
                          </p>
                          <Badge variant="secondary" className="text-[9px] capitalize">
                            {entry.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-start gap-2 rounded-2xl border border-border/60 bg-muted/30 p-4">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="text-xs leading-relaxed text-muted-foreground">
                <p>
                  Membership is activated only after a successful payment. Prices, duration and
                  benefits are set by Kalyan Chemist and may change for future purchases.
                </p>
                <p className="mt-2">
                  {t("renewalNote")} Existing orders, coupons and account features are unaffected.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
