import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Gift,
  Wallet,
  Search,
  Save,
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";
import { toast } from "sonner";

function formatRupees(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

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

export default function AdminReferralWallet() {
  const stats = useQuery(api.referralWallet.adminStats);
  const savedSettings = useQuery(api.referralWallet.adminGetSettings);
  const updateSettings = useMutation(api.referralWallet.adminUpdateSettings);
  const credit = useMutation(api.referralWallet.adminCredit);
  const debit = useMutation(api.referralWallet.adminDebit);

  const [settingsDraft, setSettingsDraft] = useState<{
    rewardAmount: number;
    minQualifyingOrder: number;
    maxWalletUsagePercent: number;
    rewardExpiryDays: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  // Server settings are the source of truth until the admin edits a field.
  const settingsForm = settingsDraft ?? savedSettings ?? null;

  const [referralSearch, setReferralSearch] = useState("");
  const referrals = useQuery(api.referralWallet.adminListReferrals, {
    search: referralSearch.trim() || undefined,
  });

  const [walletSearch, setWalletSearch] = useState("");
  const wallets = useQuery(api.referralWallet.adminSearchWallets, {
    search: walletSearch.trim() || undefined,
  });
  const [selectedCustomer, setSelectedCustomer] = useState<Id<"users"> | null>(null);
  const transactions = useQuery(
    api.referralWallet.adminWalletTransactions,
    selectedCustomer ? { customerId: selectedCustomer } : "skip",
  );

  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const setSettingsForm = (next: typeof settingsForm) => setSettingsDraft(next);

  const handleSaveSettings = async () => {
    if (!settingsForm) return;
    setSaving(true);
    try {
      await updateSettings(settingsForm);
      toast.success("Referral & wallet settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAdjust = async (kind: "credit" | "debit") => {
    if (!selectedCustomer) {
      toast.error("Select a customer first");
      return;
    }
    const amount = Number(adjustAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (adjustReason.trim().length < 3) {
      toast.error("Please enter a reason");
      return;
    }
    setAdjusting(true);
    try {
      if (kind === "credit") {
        await credit({ customerId: selectedCustomer, amount, reason: adjustReason.trim() });
        toast.success("Wallet credited");
      } else {
        await debit({ customerId: selectedCustomer, amount, reason: adjustReason.trim() });
        toast.success("Wallet debited");
      }
      setAdjustAmount("");
      setAdjustReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Adjustment failed");
    } finally {
      setAdjusting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary">
        <Gift className="size-3" />
        Referral &amp; Wallet
      </div>

      {/* Settings */}
      <Card className="border-border/60 rounded-2xl">
        <CardHeader>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Gift className="size-4 text-primary" /> Referral &amp; Wallet Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!settingsForm ? (
            <div className="h-20 animate-pulse rounded-xl bg-muted/50" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium">Referral Reward (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  step={10}
                  className="rounded-xl"
                  value={settingsForm.rewardAmount}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, rewardAmount: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Minimum Qualifying Order (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  step={10}
                  className="rounded-xl"
                  value={settingsForm.minQualifyingOrder}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, minQualifyingOrder: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Max Wallet Usage (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className="rounded-xl"
                  value={settingsForm.maxWalletUsagePercent}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      maxWalletUsagePercent: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Reward Expiry</Label>
                <Input
                  className="rounded-xl"
                  value={settingsForm.rewardExpiryDays === 0 ? "OFF (never expires)" : `${settingsForm.rewardExpiryDays} days`}
                  readOnly
                />
              </div>
            </div>
          )}
          <div className="mt-4 flex items-center gap-3">
            <Button
              onClick={handleSaveSettings}
              disabled={saving || !settingsForm}
              className="gradient-primary text-white rounded-xl gap-2"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {saving ? "Saving…" : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      {stats && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/60 rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Total Referrals</p>
              <p className="mt-1 text-xl font-bold text-foreground">{stats.totalReferrals}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Pending</p>
              <p className="mt-1 text-xl font-bold text-foreground">
                {stats.byStatus.pending + stats.byStatus.qualified}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60 rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Rewarded</p>
              <p className="mt-1 text-xl font-bold text-foreground">{stats.byStatus.rewarded}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Reversed</p>
              <p className="mt-1 text-xl font-bold text-foreground">{stats.byStatus.reversed}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Referral history */}
      <Card className="border-border/60 rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Gift className="size-4 text-primary" /> Referral History
          </CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by customer…"
              value={referralSearch}
              onChange={(e) => setReferralSearch(e.target.value)}
              className="rounded-xl pl-9 h-9 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {!referrals ? (
            <div className="h-16 animate-pulse rounded-xl bg-muted/50" />
          ) : referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No referrals yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Referrer</th>
                    <th className="py-2 pr-4 font-medium">Referred</th>
                    <th className="py-2 pr-4 font-medium">Code</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Reward</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {referrals.map((row) => (
                    <tr key={row.id}>
                      <td className="py-2.5 pr-4">
                        <span className="font-medium text-foreground">{row.referrerName}</span>
                        {row.referrerPhone && (
                          <span className="block text-xs text-muted-foreground">{row.referrerPhone}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="font-medium text-foreground">{row.referredName}</span>
                        {row.referredPhone && (
                          <span className="block text-xs text-muted-foreground">{row.referredPhone}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-xs tracking-wider text-muted-foreground">
                        {row.referralCode}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge variant="outline" className={`rounded-full text-[11px] ${statusClass(row.status)}`}>
                          {row.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4 font-semibold">
                        {row.status === "REWARDED" ? formatRupees(row.rewardAmount) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Wallet management */}
      <Card className="border-border/60 rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Wallet className="size-4 text-primary" /> Wallet Balances
          </CardTitle>
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by customer…"
              value={walletSearch}
              onChange={(e) => setWalletSearch(e.target.value)}
              className="rounded-xl pl-9 h-9 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              {!wallets ? (
                <div className="h-16 animate-pulse rounded-xl bg-muted/50" />
              ) : wallets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No customers found.</p>
              ) : (
                <ul className="divide-y divide-border/60 rounded-xl border border-border/60 overflow-hidden">
                  {wallets.map((row) => (
                    <li key={row.customerId}>
                      <button
                        onClick={() => setSelectedCustomer(row.customerId)}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors ${
                          selectedCustomer === row.customerId ? "bg-primary/5" : "hover:bg-muted/40"
                        }`}
                      >
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-foreground truncate">
                            {row.name}
                          </span>
                          <span className="block text-xs text-muted-foreground truncate">
                            {row.email || row.phone}
                          </span>
                        </span>
                        <span className="text-sm font-semibold shrink-0">{formatRupees(row.balance)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-border/60 p-4">
              {!selectedCustomer ? (
                <p className="text-sm text-muted-foreground">
                  Select a customer to view wallet transactions and adjust the balance.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">Transactions</h4>
                  </div>
                  {!transactions ? (
                    <div className="h-16 animate-pulse rounded-xl bg-muted/50" />
                  ) : transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No wallet transactions.</p>
                  ) : (
                    <ul className="max-h-64 overflow-y-auto divide-y divide-border/60">
                      {transactions.map((tx) => (
                        <li key={tx.id} className="flex items-center justify-between gap-3 py-2">
                          <span className="min-w-0">
                            <span className="block text-xs font-medium text-foreground truncate">
                              {tx.label}
                            </span>
                            <span className="block text-[11px] text-muted-foreground truncate">
                              {tx.reason} · {tx.status}
                            </span>
                          </span>
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

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Manual Adjustment</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="Amount (₹)"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      className="rounded-xl h-9"
                    />
                    <Input
                      placeholder="Reason (required)"
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      className="rounded-xl h-9"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="gap-1.5 rounded-lg"
                        disabled={adjusting}
                        onClick={() => handleAdjust("credit")}
                      >
                        <ArrowUpCircle className="size-3.5" /> Credit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 rounded-lg text-red-600"
                        disabled={adjusting}
                        onClick={() => handleAdjust("debit")}
                      >
                        <ArrowDownCircle className="size-3.5" /> Debit
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Adjustments are recorded as auditable ADMIN_CREDIT / ADMIN_DEBIT transactions.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
