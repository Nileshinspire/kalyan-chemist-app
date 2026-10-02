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
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  PauseCircle,
  Ban,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

function formatRupees(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function formatDate(value?: number | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value?: number | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

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
    case "ON_HOLD":
      return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function riskClass(risk: string): string {
  switch (risk) {
    case "HIGH":
      return "bg-red-500/10 text-red-600 border-red-500/20";
    case "MEDIUM":
      return "bg-amber-500/10 text-amber-700 border-amber-500/20";
    default:
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
  }
}

type SettingsForm = {
  rewardAmount: number;
  minQualifyingOrder: number;
  maxWalletUsagePercent: number;
  rewardExpiryDays: number;
  rewardHoldDays: number;
  maxReferralsPerMonth: number;
  autoReleaseMediumRisk: boolean;
};

type ActionKind = "approve" | "hold" | "block" | "reverse" | "recover";

const ACTION_COPY: Record<ActionKind, { title: string; hint: string; cta: string }> = {
  approve: {
    title: "Approve & release reward",
    hint: "Optional note for the audit trail. The wallet credit is issued immediately.",
    cta: "Approve",
  },
  hold: {
    title: "Hold this referral",
    hint: "A held referral never releases on its own — only another action moves it.",
    cta: "Hold",
  },
  block: {
    title: "Block this referral",
    hint: "Blocking keeps the record for audit. Any reward already paid is reversed.",
    cta: "Block referral",
  },
  reverse: {
    title: "Reverse this reward",
    hint: "Only the balance actually available is recovered. Anything already spent stays recorded as outstanding.",
    cta: "Reverse reward",
  },
  recover: {
    title: "Record recovery",
    hint: "Credits the outstanding amount back and closes the reversal.",
    cta: "Record recovery",
  },
};

export default function AdminReferralWallet() {
  const stats = useQuery(api.referralWallet.adminStats);
  const savedSettings = useQuery(api.referralWallet.adminGetSettings);
  const updateSettings = useMutation(api.referralWallet.adminUpdateSettings);
  const credit = useMutation(api.referralWallet.adminCredit);
  const debit = useMutation(api.referralWallet.adminDebit);

  const approve = useMutation(api.referralWallet.adminApproveReferral);
  const hold = useMutation(api.referralWallet.adminHoldReferral);
  const block = useMutation(api.referralWallet.adminBlockReferral);
  const reverse = useMutation(api.referralWallet.adminReverseReferral);
  const recordRecovery = useMutation(api.referralWallet.adminRecordRecovery);
  const runSweep = useMutation(api.referralWallet.adminRunRewardSweep);

  const [settingsDraft, setSettingsDraft] = useState<SettingsForm | null>(null);
  const [saving, setSaving] = useState(false);
  const settingsForm = settingsDraft ?? (savedSettings ?? null);

  // Referral table filters
  const [referralSearch, setReferralSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expanded, setExpanded] = useState<Id<"referrals"> | null>(null);
  const [action, setAction] = useState<{ kind: ActionKind; referralId: Id<"referrals"> } | null>(
    null,
  );
  const [actionReason, setActionReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [sweeping, setSweeping] = useState(false);

  const referrals = useQuery(api.referralWallet.adminListReferrals, {
    search: referralSearch.trim() || undefined,
    status: statusFilter || undefined,
    risk: riskFilter || undefined,
    from: fromDate ? new Date(fromDate).getTime() : undefined,
    to: toDate ? new Date(`${toDate}T23:59:59`).getTime() : undefined,
  });

  const detail = useQuery(
    api.referralWallet.adminReferralDetail,
    action ? { referralId: action.referralId } : "skip",
  );

  const [walletSearch, setWalletSearch] = useState("");
  const wallets = useQuery(api.referralWallet.adminSearchWallets, {
    search: walletSearch.trim() || undefined,
  });
  const [selectedCustomer, setSelectedCustomer] = useState<Id<"users"> | null>(null);
  const ledger = useQuery(
    api.referralWallet.adminWalletTransactions,
    selectedCustomer ? { customerId: selectedCustomer } : "skip",
  );

  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  const setSettingsForm = (next: SettingsForm | null) => setSettingsDraft(next);

  const handleSaveSettings = async () => {
    if (!settingsForm) return;
    setSaving(true);
    try {
      await updateSettings(settingsForm);
      setSettingsDraft(null);
      toast.success("Referral & wallet settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSweep = async () => {
    setSweeping(true);
    try {
      const result = await runSweep({});
      toast.success(
        `Released ${result.released} reward(s) and returned ${result.holdsReleased} abandoned hold(s)`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sweep failed");
    } finally {
      setSweeping(false);
    }
  };

  const runAction = async () => {
    if (!action) return;
    const reason = actionReason.trim();
    if (action.kind !== "approve" && reason.length < 3) {
      toast.error("Please enter a reason");
      return;
    }
    setBusy(true);
    try {
      const { referralId } = action;
      if (action.kind === "approve") {
        await approve({ referralId, note: reason || undefined });
        toast.success("Referral approved and reward released");
      } else if (action.kind === "hold") {
        await hold({ referralId, reason });
        toast.success("Referral placed on hold");
      } else if (action.kind === "block") {
        await block({ referralId, reason });
        toast.success("Referral blocked");
      } else if (action.kind === "reverse") {
        const result = await reverse({ referralId, reason });
        toast.success(
          result.outstanding > 0
            ? `Recovered ${formatRupees(result.recovered)} — ${formatRupees(
                result.outstanding,
              )} could not be recovered yet`
            : `Reward reversed — ${formatRupees(result.recovered)} recovered`,
        );
      } else {
        await recordRecovery({ referralId });
        toast.success("Recovery recorded");
      }
      setAction(null);
      setActionReason("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary">
          <Gift className="size-3" />
          Referral &amp; Wallet
        </div>
        <Button
          size="sm"
          variant="outline"
          className="rounded-lg gap-1.5"
          onClick={handleSweep}
          disabled={sweeping}
        >
          {sweeping ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          Release due rewards
        </Button>
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                <p className="text-[11px] text-muted-foreground">
                  Measured on item value after discounts, excluding delivery.
                </p>
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
                <Label className="text-xs font-medium">Reward Hold (days)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  className="rounded-xl"
                  value={settingsForm.rewardHoldDays}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, rewardHoldDays: Number(e.target.value) })
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Wait after delivery before releasing. 0 releases straight away.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Reward Expiry (days)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  className="rounded-xl"
                  value={settingsForm.rewardExpiryDays}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, rewardExpiryDays: Number(e.target.value) })
                  }
                />
                <p className="text-[11px] text-muted-foreground">0 = rewards never expire.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Referrals per customer (30 days)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  className="rounded-xl"
                  value={settingsForm.maxReferralsPerMonth}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      maxReferralsPerMonth: Number(e.target.value),
                    })
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  0 = no limit. Higher-volume referrers go to review.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Automatic review behaviour</Label>
                <label className="flex h-9 items-center gap-2 rounded-xl border border-border/60 px-3 text-xs">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-primary"
                    checked={settingsForm.autoReleaseMediumRisk}
                    onChange={(e) =>
                      setSettingsForm({
                        ...settingsForm,
                        autoReleaseMediumRisk: e.target.checked,
                      })
                    }
                  />
                  Release medium-risk referrals automatically after the hold
                </label>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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
              <p className="text-xs font-medium text-muted-foreground">On Hold / Review</p>
              <p className="mt-1 text-xl font-bold text-foreground">{stats.byStatus.onHold}</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Rewards Given</p>
              <p className="mt-1 text-xl font-bold text-foreground">
                {formatRupees(stats.rewardsGiven)}
              </p>
              <p className="text-[11px] text-muted-foreground">{stats.byStatus.rewarded} rewarded</p>
            </CardContent>
          </Card>
          <Card className="border-border/60 rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Reversed</p>
              <p className="mt-1 text-xl font-bold text-foreground">
                {formatRupees(stats.reversedAmount)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {stats.outstandingRecovery > 0
                  ? `${formatRupees(stats.outstandingRecovery)} outstanding`
                  : `${stats.byStatus.reversed} reversed`}
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60 rounded-2xl">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Wallet Liability</p>
              <p className="mt-1 text-xl font-bold text-foreground">
                {formatRupees(stats.walletLiability)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatRupees(stats.totalWalletBalance)} available
                {stats.reservedWalletAmount > 0
                  ? ` · ${formatRupees(stats.reservedWalletAmount)} on hold`
                  : ""}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Referral monitoring */}
      <Card className="border-border/60 rounded-2xl">
        <CardHeader className="gap-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Gift className="size-4 text-primary" /> Referral Monitoring
          </CardTitle>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Customer, code or order number…"
                value={referralSearch}
                onChange={(e) => setReferralSearch(e.target.value)}
                className="rounded-xl pl-9 h-9 text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">All statuses</option>
              <option value="PENDING">Pending</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="ON_HOLD">On hold</option>
              <option value="REWARDED">Rewarded</option>
              <option value="REVERSED">Reversed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="BLOCKED">Blocked</option>
            </select>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="h-9 rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">All risk levels</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-xl h-9 text-xs"
                aria-label="From date"
              />
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-xl h-9 text-xs"
                aria-label="To date"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!referrals ? (
            <div className="h-16 animate-pulse rounded-xl bg-muted/50" />
          ) : referrals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No referrals match these filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Referred Customer</th>
                    <th className="py-2 pr-4 font-medium">Referrer</th>
                    <th className="py-2 pr-4 font-medium">Signed Up</th>
                    <th className="py-2 pr-4 font-medium">Qualifying Order</th>
                    <th className="py-2 pr-4 font-medium">Amount</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Risk</th>
                    <th className="py-2 pr-4 font-medium">Reward</th>
                    <th className="py-2 pr-4 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {referrals.map((row) => {
                    const isOpen = expanded === row.id;
                    const canReward = row.status === "ON_HOLD" || row.status === "QUALIFIED";
                    return (
                      <>
                        <tr key={row.id}>
                          <td className="py-2.5 pr-4">
                            <button
                              onClick={() => setExpanded(isOpen ? null : row.id)}
                              className="flex items-center gap-1 text-left"
                            >
                              {isOpen ? (
                                <ChevronDown className="size-3.5 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="size-3.5 text-muted-foreground" />
                              )}
                              <span>
                                <span className="font-medium text-foreground block">
                                  {row.referredName}
                                </span>
                                <span className="block text-xs text-muted-foreground">
                                  {row.referredPhone || row.referralCode}
                                </span>
                              </span>
                            </button>
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className="font-medium text-foreground">{row.referrerName}</span>
                            {row.referrerPhone && (
                              <span className="block text-xs text-muted-foreground">
                                {row.referrerPhone}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                            {formatDate(row.createdAt)}
                          </td>
                          <td className="py-2.5 pr-4 text-xs">
                            {row.orderInvoice || row.orderStatus ? (
                              <>
                                <span className="block">{row.orderInvoice || "—"}</span>
                                <span className="block text-muted-foreground">{row.orderStatus}</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">Not yet qualified</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4 text-xs">
                            {row.orderAmount > 0 ? formatRupees(row.orderAmount) : "—"}
                          </td>
                          <td className="py-2.5 pr-4">
                            <Badge
                              variant="outline"
                              className={`rounded-full text-[11px] ${statusClass(row.status)}`}
                            >
                              {row.statusLabel}
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-4">
                            <Badge
                              variant="outline"
                              className={`rounded-full text-[11px] ${riskClass(row.riskLevel)}`}
                            >
                              {row.riskLevel}
                            </Badge>
                          </td>
                          <td className="py-2.5 pr-4 font-semibold text-xs">
                            {row.rewardAmount > 0 ? formatRupees(row.rewardAmount) : "—"}
                            {row.reversalOutstanding > 0 && (
                              <span className="block text-[11px] font-normal text-red-600">
                                {formatRupees(row.reversalOutstanding)} outstanding
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4">
                            <div className="flex flex-wrap gap-1.5">
                              {canReward && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 rounded-lg px-2 text-[11px] gap-1"
                                  onClick={() => {
                                    setAction({ kind: "approve", referralId: row.id });
                                    setActionReason("");
                                  }}
                                >
                                  <CheckCircle2 className="size-3" />
                                  Approve
                                </Button>
                              )}
                              {row.status !== "REWARDED" && row.status !== "REVERSED" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 rounded-lg px-2 text-[11px] gap-1"
                                  onClick={() => {
                                    setAction({ kind: "hold", referralId: row.id });
                                    setActionReason("");
                                  }}
                                >
                                  <PauseCircle className="size-3" />
                                  Hold
                                </Button>
                              )}
                              {row.status === "REWARDED" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 rounded-lg px-2 text-[11px] gap-1 text-red-600"
                                  onClick={() => {
                                    setAction({ kind: "reverse", referralId: row.id });
                                    setActionReason("");
                                  }}
                                >
                                  <Undo2 className="size-3" />
                                  Reverse
                                </Button>
                              )}
                              {row.status === "REVERSED" && row.reversalOutstanding > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 rounded-lg px-2 text-[11px] gap-1"
                                  onClick={() => {
                                    setAction({ kind: "recover", referralId: row.id });
                                    setActionReason("");
                                  }}
                                >
                                  Record recovery
                                </Button>
                              )}
                              {row.status !== "BLOCKED" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 rounded-lg px-2 text-[11px] gap-1 text-red-600"
                                  onClick={() => {
                                    setAction({ kind: "block", referralId: row.id });
                                    setActionReason("");
                                  }}
                                >
                                  <Ban className="size-3" />
                                  Block
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr key={`${row.id}-detail`} className="bg-muted/20">
                            <td colSpan={9} className="py-3 pr-4">
                              {row.riskReasons.length > 0 ? (
                                <p className="text-xs text-muted-foreground mb-2">
                                  Review notes: {row.riskReasons.join("; ")}
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground mb-2">
                                  No review notes for this referral.
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                {row.status === "ON_HOLD" && row.holdReason
                                  ? `On hold — ${row.holdReason}`
                                  : null}
                                {row.status === "ON_HOLD" && row.holdUntil
                                  ? ` · releases ${formatDate(row.holdUntil)}`
                                  : null}
                                {row.rewardExpiresAt
                                  ? ` · reward usable until ${formatDate(row.rewardExpiresAt)}`
                                  : null}
                              </p>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action confirmation */}
      {action && (
        <Card className="border-border/60 rounded-2xl">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">
              {ACTION_COPY[action.kind].title}
            </p>
            <p className="text-xs text-muted-foreground">{ACTION_COPY[action.kind].hint}</p>
            {detail && (
              <p className="text-xs text-muted-foreground">
                {detail.referredName} · referred by {detail.referrerName} · {detail.statusLabel}
                {detail.riskLevel !== "LOW" ? ` · ${detail.riskLevel} risk` : ""}
                {detail.rewardAmount > 0 ? ` · reward ${formatRupees(detail.rewardAmount)}` : ""}
              </p>
            )}
            <Input
              placeholder={action.kind === "approve" ? "Optional note…" : "Reason (required)"}
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              className="rounded-xl h-9 text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" className="rounded-lg" onClick={runAction} disabled={busy}>
                {busy && <Loader2 className="size-3.5 animate-spin" />}
                {ACTION_COPY[action.kind].cta}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg"
                onClick={() => {
                  setAction(null);
                  setActionReason("");
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Wallet management */}
      <Card className="border-border/60 rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Wallet className="size-4 text-primary" /> Wallet Ledger
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
                <ul className="divide-y divide-border/60 rounded-xl border border-border/60 overflow-hidden max-h-96 overflow-y-auto">
                  {wallets.map((row) => (
                    <li key={row.customerId}>
                      <button
                        onClick={() => setSelectedCustomer(row.customerId)}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors ${
                          selectedCustomer === row.customerId
                            ? "bg-primary/5"
                            : "hover:bg-muted/40"
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
                        <span className="text-right shrink-0">
                          <span className="block text-sm font-semibold">
                            {formatRupees(row.spendable)}
                          </span>
                          {row.spendable !== row.balance && (
                            <span className="block text-[11px] text-muted-foreground">
                              {formatRupees(row.balance)} incl. expiring
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-border/60 p-4">
              {!selectedCustomer ? (
                <p className="text-sm text-muted-foreground">
                  Select a customer to view their wallet ledger and adjust the balance.
                </p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-foreground">Transactions</h4>
                  </div>
                  {!ledger ? (
                    <div className="h-16 animate-pulse rounded-xl bg-muted/50" />
                  ) : ledger.transactions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No wallet transactions.</p>
                  ) : (
                    <ul className="max-h-64 overflow-y-auto divide-y divide-border/60">
                      {ledger.transactions.map((tx) => (
                        <li key={tx.id} className="flex items-center justify-between gap-3 py-2">
                          <span className="min-w-0">
                            <span className="block text-xs font-medium text-foreground truncate">
                              {tx.label}
                            </span>
                            <span className="block text-[11px] text-muted-foreground truncate">
                              {formatDateTime(tx.createdAt)} · {tx.reason} · {tx.status}
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

                  {ledger && ledger.credits.some((c) => c.expiresAt) && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-1">
                          Reward credits &amp; expiry
                        </h4>
                        <ul className="space-y-1">
                          {ledger.credits
                            .filter((c) => c.expiresAt)
                            .map((c) => (
                              <li
                                key={c.id}
                                className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground"
                              >
                                <span>
                                  {formatRupees(c.originalAmount)} · issued {formatDate(c.issuedAt)}
                                </span>
                                <span>
                                  {c.remainingAmount > 0
                                    ? `${formatRupees(c.remainingAmount)} left · expires ${formatDate(c.expiresAt)}`
                                    : "expired"}
                                </span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    </>
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
                      Adjustments are recorded as auditable ADMIN_CREDIT / ADMIN_DEBIT
                      transactions with your admin identity. Debits cannot exceed the available
                      balance.
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