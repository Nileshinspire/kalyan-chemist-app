import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import { toast } from "sonner";

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

  const shareText = `Get your medicines from Kalyan Chemist. Use my referral code ${referralCode}: ${referralLink}`;

  const handleShare = async () => {
    const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }) : undefined;
    if (nav?.share) {
      try {
        await nav.share({ title: "Kalyan Chemist", text: shareText });
        return;
      } catch {
        // User cancelled or share unavailable — fall through to copy.
      }
    }
    await copy(referralLink, "link");
  };

  const handleWhatsApp = () => {
    if (!referralLink) return;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener");
  };

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
                {formatRupees(dashboard.balance)}
              </p>
            </div>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Refer a friend → they place their first eligible order → you earn wallet credit you can
            use on future orders.
          </p>

          {/* Referral code + link */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
            <Button size="sm" className="gap-1.5 rounded-lg" onClick={handleShare} disabled={!referralLink}>
              <Share2 className="size-3.5" />
              Share
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 rounded-lg text-emerald-700"
              onClick={handleWhatsApp}
              disabled={!referralLink}
            >
              <MessageCircle className="size-3.5" />
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
          </CardContent>
        </Card>
        <Card className="border-border/60 rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-3.5" />
              <span className="text-xs font-medium">Pending Referrals</span>
            </div>
            <p className="mt-1 text-xl font-bold text-foreground">{dashboard.stats.pending}</p>
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
            be withdrawn or transferred.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
