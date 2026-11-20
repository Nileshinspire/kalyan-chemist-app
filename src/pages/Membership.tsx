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
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-4 sm:px-6 sm:pt-5 lg:py-10">
          <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-emerald-700 to-emerald-900 p-4 text-white shadow-[0_18px_50px_-24px_hsl(var(--primary)/0.65)] sm:p-7">
            <div className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-16 right-12 size-32 rounded-full border border-white/10" />
            <div className="relative flex items-start gap-2 sm:gap-3">
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("back")}
                className="-ml-1 size-9 shrink-0 rounded-xl text-white hover:bg-white/10 hover:text-white lg:hidden"
                onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/menu"))}
              >
                <ArrowLeft className="size-5" />
              </Button>
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/20 sm:size-14">
                <Crown className="size-5 sm:size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/70">
                  Kalyan Chemist
                </p>
                <h1 className="text-xl font-bold tracking-tight sm:text-3xl">
                  {t("membership")}
                </h1>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-white/80 sm:text-sm">
                  {t("membershipSubtitle")}
                </p>
              </div>
            </div>
          </div>

          {current && (
            <Card className="mb-6 overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.075] via-card to-card shadow-sm">
              <CardContent className="p-0">
                <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                      <Crown className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                          {t("currentPlan")}
                        </p>
                        <Badge className="rounded-full bg-primary/10 px-2 py-0 text-[9px] font-semibold text-primary hover:bg-primary/10">
                          {t("active")}
                        </Badge>
                      </div>
                      <h2 className="mt-0.5 break-words text-xl font-bold text-foreground sm:text-2xl">
                        {current.planName}
                      </h2>
                      <p className="mt-0.5 break-words text-xs leading-relaxed text-muted-foreground">
                        {current.description}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] sm:text-[11px]">
                        <span className="inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-muted-foreground ring-1 ring-border/50">
                          <CalendarDays className="size-3 shrink-0" />
                          {t("expiresOn")} {formatDate(current.expiresAt)}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/[0.07] px-2 py-1 font-medium text-primary">
                          <Sparkles className="size-3 shrink-0" />
                          {current.daysRemaining} {t("daysRemaining")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/75 p-3.5 lg:w-64 lg:shrink-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("memberSavings")}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {current.benefits.slice(0, 3).map((benefit) => (
                        <li key={benefit} className="flex items-start gap-2 text-xs leading-snug">
                          <Check className="mt-0.5 size-3 shrink-0 text-primary" />
                          <span className="break-words">{benefit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="mb-3 flex items-end justify-between gap-2 px-0.5">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">{t("plans")}</h2>
              <p className="mt-0.5 break-words text-[11px] leading-relaxed text-muted-foreground">
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
              <CardContent className="flex flex-col items-center px-5 py-10 text-center sm:py-14">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/[0.07]">
                  <Crown className="size-7 text-primary/70" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{t("plans")}</h3>
                <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
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
                      className={`group relative flex h-full flex-col overflow-hidden rounded-2xl transition-all duration-200 ${
                        plan.highlight
                          ? "border-primary/40 shadow-[0_18px_44px_-22px_hsl(var(--primary)/0.55)]"
                          : "border-border/60 hover:border-primary/20 hover:shadow-card-hover"
                      } ${isCurrent ? "ring-1 ring-primary/30" : ""}`}
                    >
                      {(plan.highlight || isCurrent) && (
                        <div className="h-1 w-full bg-gradient-to-r from-primary via-emerald-500 to-primary" />
                      )}
                      <CardContent className="flex flex-1 flex-col p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/[0.08] text-primary ring-1 ring-primary/10">
                            {isFree ? <ShieldCheck className="size-5" /> : <Crown className="size-5" />}
                          </div>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {isCurrent && (
                              <Badge className="rounded-full bg-primary px-2 py-0 text-[9px] text-primary-foreground">
                                {t("active")}
                              </Badge>
                            )}
                            {plan.highlight && (
                              <Badge className="gap-1 rounded-full bg-primary/10 px-2 py-0 text-[9px] text-primary hover:bg-primary/10">
                                <Star className="size-2.5" /> {t("mostPopular")}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <h3 className="mt-3 break-words text-lg font-bold leading-tight">{plan.name}</h3>
                        <p className="mt-1 min-h-[2.25rem] break-words text-xs leading-relaxed text-muted-foreground">
                          {plan.description}
                        </p>
                        <div className="mt-4 flex flex-wrap items-end gap-x-1.5 gap-y-1 border-y border-border/50 py-3">
                          <span className="text-2xl font-bold tracking-tight">
                            {isFree ? t("freePlan") : formatCurrency(plan.price)}
                          </span>
                          {!isFree && (
                            <span className="pb-0.5 text-[11px] text-muted-foreground">
                              / {durationLabel(plan.durationDays)}
                            </span>
                          )}
                        </div>
                        <div className="mt-4 flex-1">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            {t("benefits")}
                          </p>
                          <ul className="mt-2 space-y-2">
                            {plan.benefits.map((benefit) => (
                              <li key={benefit} className="flex items-start gap-2 text-xs leading-snug">
                                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                  <Check className="size-2.5 text-primary" />
                                </span>
                                <span className="break-words">{benefit}</span>
                              </li>
                            ))}
                          </ul>
                          {plan.restrictions.length > 0 && (
                            <div className="mt-3 rounded-xl bg-muted/40 p-2.5">
                              <p className="text-[10px] font-semibold text-muted-foreground">
                                {t("restrictions")}
                              </p>
                              <ul className="mt-1 space-y-1">
                                {plan.restrictions.map((restriction) => (
                                  <li key={restriction} className="break-words text-[10px] leading-relaxed text-muted-foreground">
                                    {restriction}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                        <Button
                          className={`mt-5 h-10 w-full rounded-xl text-xs font-semibold ${
                            plan.highlight || isCurrent ? "gradient-primary text-white" : ""
                          }`}
                          variant={plan.highlight || isCurrent ? "default" : "outline"}
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
              <CardContent className="p-4 sm:p-5">
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
                      <div key={entry._id} className="flex items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="break-words text-xs font-medium leading-snug">
                            {entry.planName}
                          </p>
                          <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                            {formatDate(entry.createdAt)}
                            {entry.expiresAt ? ` · ${formatDate(entry.expiresAt)}` : ""}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xs font-semibold">
                            {entry.amount === 0 ? t("freePlan") : formatCurrency(entry.amount)}
                          </p>
                          <Badge variant="secondary" className="mt-0.5 text-[9px] capitalize">
                            {entry.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex items-start gap-3 rounded-2xl border border-primary/10 bg-primary/[0.035] p-4 sm:p-5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Info className="size-4 text-primary" />
              </div>
              <div className="min-w-0 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                <p className="break-words">
                  Membership is activated only after a successful payment. Prices, duration and
                  benefits are set by Kalyan Chemist and may change for future purchases.
                </p>
                <p className="mt-2 break-words">
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
