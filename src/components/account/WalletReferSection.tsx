import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Wallet,
  Users,
  Gift,
  Copy,
  Check,
  Share2,
  MessageCircle,
  TrendingUp,
  Clock,
  Link2,
  Send,
  MoreHorizontal,
  Facebook,
  Twitter,
  Linkedin,
  Mail,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { HOW_IT_WORKS_STEPS } from "@/convex/referralWalletCore";

function formatRupees(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function formatDate(value: number): string {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Colour a referral status pill without changing the app-wide Badge styles. */
function statusClass(status: string): string {
  switch (status) {
    case "REWARDED":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    case "REVERSED":
    case "CANCELLED":
    case "BLOCKED":
      return "bg-red-500/10 text-red-600 border-red-500/20";
    case "QUALIFIED":
      return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    default:
      return "bg-amber-500/10 text-amber-700 border-amber-500/20";
  }
}

type ReferralRow = {
  id: string;
  name: string;
  status: string;
  statusLabel: string;
  reward: number;
  createdAt: number;
  rewardedAt?: number;
  rewardExpiresAt?: number;
};

type TransactionRow = {
  id: string;
  label: string;
  amount: number;
  direction: "credit" | "debit";
  status: string;
  reason: string;
  createdAt: number;
};

export default function WalletReferSection() {
  const dashboard = useQuery(api.referralWallet.getMyReferralDashboard);
  const ensureReferralCode = useMutation(api.referralWallet.ensureReferralCode);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  // Every authenticated customer automatically gets a referral code. The
  // dashboard reads it; if it has not been generated yet, ask the server to
  // create one (uniqueness is enforced server-side).
  useEffect(() => {
    if (dashboard && dashboard.referralCode === null) {
      ensureReferralCode().catch(() => undefined);
    }
  }, [dashboard, ensureReferralCode]);

  const referralCode = dashboard?.referralCode ?? "";
  const referralLink = useMemo(() => {
    if (!referralCode || typeof window === "undefined") return "";
    return `${window.location.origin}/#/auth?ref=${referralCode}`;
  }, [referralCode]);

  const copy = async (value: string, which: "code" | "link") => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      toast.success(which === "code" ? "Referral code copied" : "Referral link copied");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Couldn't copy. Please copy it manually.");
    }
  };

  // Message used by the existing "Share on WhatsApp" button — unchanged.
  const shareText = `Get your medicines from Kalyan Chemist. Use my referral code ${referralCode}: ${referralLink}`;

  // Slightly more professional copy used by the in-app share popover. Both are
  // built from the customer's own generated code/link — nothing is hardcoded.
  const shareMessage =
    "Join Kalyan Chemist using my referral link and get started with easy online pharmacy shopping:";
  const popoverShareText = `${shareMessage}\n\n${referralLink}`;

  const handleWhatsApp = () => {
    if (!referralLink) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener");
  };

  const openShareUrl = (url: string) => {
    if (!referralLink) return;
    setShareOpen(false);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleShareCopyLink = async () => {
    setShareOpen(false);
    await copy(referralLink, "link");
  };

  /**
   * "More Apps" — the only place the OS/browser share sheet is used, for apps
   * that have no reliable web share URL. Never the primary desktop action.
   */
  const handleShareMore = async () => {
    setShareOpen(false);
    const nav =
      typeof navigator !== "undefined"
        ? (navigator as Navigator & { share?: (data: ShareData) => Promise<void> })
        : undefined;
    if (!nav?.share) {
      toast.error("Sharing isn't supported on this device. Please copy the link instead.");
      return;
    }
    try {
      await nav.share({ title: "Kalyan Chemist", text: popoverShareText, url: referralLink });
    } catch {
      // Customer dismissed the share sheet — nothing to do.
    }
  };

  /**
   * Every entry shares the customer's real referral link. WhatsApp is
   * deliberately absent: it has its own dedicated button next to "Share".
   */
  const shareTargets = [
    {
      key: "telegram",
      label: "Telegram",
      icon: Send,
      iconClass: "text-sky-600",
      onSelect: () =>
        openShareUrl(
          `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(
            shareMessage,
          )}`,
        ),
    },
    {
      key: "facebook",
      label: "Facebook",
      icon: Facebook,
      iconClass: "text-[#1877F2]",
      onSelect: () =>
        openShareUrl(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`,
        ),
    },
    {
      key: "x",
      label: "X / Twitter",
      icon: Twitter,
      iconClass: "text-foreground",
      onSelect: () =>
        openShareUrl(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}&url=${encodeURIComponent(
            referralLink,
          )}`,
        ),
    },
    {
      key: "linkedin",
      label: "LinkedIn",
      icon: Linkedin,
      iconClass: "text-[#0A66C2]",
      onSelect: () =>
        openShareUrl(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`,
        ),
    },
    {
      key: "email",
      label: "Email",
      icon: Mail,
      iconClass: "text-amber-600",
      onSelect: () => {
        if (!referralLink) return;
        setShareOpen(false);
        window.location.href = `mailto:?subject=${encodeURIComponent(
          "Shop medicines online with Kalyan Chemist",
        )}&body=${encodeURIComponent(`${shareMessage}\n\n${referralLink}`)}`;
      },
    },
    {
      key: "sms",
      label: "SMS / Messages",
      icon: MessageSquare,
      iconClass: "text-emerald-600",
      onSelect: () => {
        if (!referralLink) return;
        setShareOpen(false);
        window.location.href = `sms:?&body=${encodeURIComponent(
          `${shareMessage} ${referralLink}`,
        )}`;
      },
    },
  ];

  if (dashboard === undefined) {
    return (
      <Card className="border-border/60 rounded-2xl">
        <CardContent className="p-5">
          <div className="h-24 animate-pulse rounded-xl bg-muted/50" />
        </CardContent>
      </Card>
    );
  }

  // Not signed in — the account route is protected, so this is only a guard.
  if (dashboard === null) return null;

  const referrals: ReferralRow[] = dashboard.referrals;
  const transactions: TransactionRow[] = dashboard.transactions;

  return (
    <div className="space-y-4">
      {/* Balance + referral code */}
      <Card className="border-border/60 rounded-2xl overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center gap-2 text-primary">
            <Wallet className="size-4" />
            <h3 className="text-sm font-bold text-foreground">Wallet &amp; Refer</h3>
          </div>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Available Wallet Balance
              </p>
              <p className="text-3xl font-extrabold tracking-tight text-foreground mt-1">
                {formatRupees(dashboard.spendable)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Refer &amp; Earn
              </p>
              <p className="text-lg font-bold text-foreground">
                {dashboard.stats.totalRewards > 0
                  ? formatRupees(dashboard.stats.totalRewards)
                  : "Refer a friend"}
              </p>
            </div>
          </div>

          {dashboard.expiringSoon.length > 0 && (
            <p className="mt-2 text-xs text-amber-700">
              {formatRupees(
                dashboard.expiringSoon.reduce((sum, credit) => sum + credit.amount, 0),
              )}{" "}
              of your wallet balance expires on{" "}
              {formatDate(Math.min(...dashboard.expiringSoon.map((c) => c.expiresAt ?? Infinity)))}.
              Use it before then to make the most of it.
            </p>
          )}

          {/* How it works — three plain steps, nothing technical. */}
          <ol className="mt-4 space-y-1.5">
            {HOW_IT_WORKS_STEPS.map((step, index) => (
              <li key={step} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>

          {/* Referral code + link */}
          {/* [&>*]:min-w-0 lets the grid tracks shrink on narrow screens (and
              mid-size tablets) so the Copy buttons stay inside the card; at
              ≥lg the tracks already size to content, so nothing changes. */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 [&>*]:min-w-0">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Your Referral Code
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="text-lg font-bold tracking-[0.15em] text-foreground">
                  {referralCode || "—"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 rounded-lg"
                  onClick={() => copy(referralCode, "code")}
                  disabled={!referralCode}
                >
                  {copied === "code" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  Copy
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Your Referral Link
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-muted-foreground">{referralLink || "—"}</span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0 gap-1.5 rounded-lg"
                  onClick={() => copy(referralLink, "link")}
                  disabled={!referralLink}
                >
                  {copied === "link" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  Copy
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {/* The primary Share button opens our own compact popover instead of
                the browser's generic share dialog. */}
            <Popover open={shareOpen} onOpenChange={setShareOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" className="gap-1.5 rounded-lg" disabled={!referralLink}>
                  <Share2 className="size-3.5" aria-hidden="true" />
                  Share
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                sideOffset={6}
                className="w-[17.5rem] max-w-[calc(100vw-2rem)] rounded-xl p-2"
              >
                <div className="px-2 pb-1.5 pt-1">
                  <p className="text-xs font-semibold text-foreground">Share your referral link</p>
                  <p className="truncate text-[11px] text-muted-foreground">{referralLink}</p>
                </div>
                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={handleShareCopyLink}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {copied === "link" ? (
                      <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    ) : (
                      <Link2 className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    )}
                    Copy Link
                  </button>
                  {shareTargets.map((target) => {
                    const Icon = target.icon;
                    return (
                      <button
                        key={target.key}
                        type="button"
                        onClick={target.onSelect}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Icon className={`size-4 shrink-0 ${target.iconClass}`} aria-hidden="true" />
                        {target.label}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={handleShareMore}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MoreHorizontal className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    More Apps
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 rounded-lg text-emerald-700"
              onClick={handleWhatsApp}
              disabled={!referralLink}
            >
              <MessageCircle className="size-3.5" aria-hidden="true" />
              Share on WhatsApp
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/60 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="size-3.5" />
              <span className="text-xs font-medium">Successful Referrals</span>
            </div>
            <p className="mt-1 text-xl font-bold text-foreground">{dashboard.stats.successful}</p>
            <p className="text-[11px] text-muted-foreground">reward added to your wallet</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-3.5" />
              <span className="text-xs font-medium">Pending Referrals</span>
            </div>
            <p className="mt-1 text-xl font-bold text-foreground">{dashboard.stats.pending}</p>
            <p className="text-[11px] text-muted-foreground">waiting on their first order</p>
          </CardContent>
        </Card>
        <Card className="border-border/60 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="size-3.5" />
              <span className="text-xs font-medium">Total Rewards Earned</span>
            </div>
            <p className="mt-1 text-xl font-bold text-foreground">
              {formatRupees(dashboard.stats.totalRewards)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Referral history */}
      <Card className="border-border/60 rounded-2xl">
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <Gift className="size-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Referral History</h3>
          </div>
          {referrals.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">You haven&apos;t referred anyone yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border/60">
              {referrals.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{row.name}</p>
                    {row.status === "PENDING" && (
                      <p className="text-xs text-muted-foreground">
                        Waiting for the referred customer&apos;s eligible first order.
                      </p>
                    )}
                    {row.status === "QUALIFIED" && (
                      <p className="text-xs text-muted-foreground">
                        First qualifying order delivered — your reward is on its way.
                      </p>
                    )}
                    {row.status === "ON_HOLD" && (
                      <p className="text-xs text-muted-foreground">
                        Your reward is being confirmed and will be added shortly.
                      </p>
                    )}
                    {row.status === "REWARDED" && row.rewardExpiresAt && (
                      <p className="text-xs text-muted-foreground">
                        Reward usable until {formatDate(row.rewardExpiresAt)}.
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-semibold text-foreground">
                      {row.status === "REWARDED" ? formatRupees(row.reward) : "₹0"}
                    </span>
                    <Badge variant="outline" className={`rounded-full text-[11px] ${statusClass(row.status)}`}>
                      {row.statusLabel}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Wallet transactions */}
      <Card className="border-border/60 rounded-2xl">
        <CardContent className="p-5">
          <div className="flex items-center gap-2">
            <Wallet className="size-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Wallet Transactions</h3>
          </div>
          {transactions.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Your wallet is empty.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border/60">
              {transactions.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{tx.label}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {formatDate(tx.createdAt)}
                      {tx.status === "released" ? " · Released" : ""}
                    </p>
                  </div>
                  <span
                    className={`text-sm font-semibold shrink-0 ${
                      tx.direction === "credit" ? "text-emerald-600" : "text-foreground"
                    }`}
                  >
                    {tx.direction === "credit" ? "+" : "-"} {formatRupees(tx.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-muted-foreground">
            Wallet credit is usable on eligible Kalyan Chemist orders only. It is not cash and cannot
            be withdrawn or transferred. If a reward has an expiry date, we use the credit that
            expires soonest first.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
