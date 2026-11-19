import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { motion } from "framer-motion";
import {
  Ticket,
  Loader2,
  Search,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { couponStatus, type CouponLifecycleStatus } from "@/convex/couponLogic";

interface CouponForm {
  code: string;
  name: string;
  description: string;
  discountType: "percentage" | "fixed" | "free_delivery";
  discountPercent: number;
  fixedDiscount: number;
  maxDiscount: number;
  minOrder: number;
  usageLimit: number;
  isActive: boolean;
  startsAt: number | null;
  expiresAt: number;
  perUserLimit: number;
  firstOrderOnly: boolean;
  eligibleCategoryIds: string[];
  publicationStatus: "draft" | "scheduled" | "active" | "deactivated";
  showOnHomepage: boolean;
  showOnProductPages: boolean;
  showInMyCoupons: boolean;
  allowCampaignStacking: boolean;
}

const DAY = 24 * 60 * 60 * 1000;

const EMPTY_FORM: CouponForm = {
  code: "",
  name: "",
  description: "",
  discountType: "percentage",
  discountPercent: 10,
  fixedDiscount: 0,
  maxDiscount: 200,
  minOrder: 300,
  usageLimit: 100,
  isActive: true,
  startsAt: null,
  expiresAt: Date.now() + 30 * DAY,
  perUserLimit: 0,
  firstOrderOnly: false,
  eligibleCategoryIds: [],
  publicationStatus: "active",
  showOnHomepage: true,
  showOnProductPages: false,
  showInMyCoupons: true,
  allowCampaignStacking: true,
};

type StatusFilter = "all" | CouponLifecycleStatus;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "scheduled", label: "Scheduled" },
  { key: "draft", label: "Draft" },
  { key: "expired", label: "Expired" },
  { key: "exhausted", label: "Exhausted" },
  { key: "inactive", label: "Deactivated" },
  { key: "archived", label: "Archived" },
];

const STATUS_BADGES: Record<CouponLifecycleStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-green-100 text-green-800" },
  scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-800" },
  draft: { label: "Draft", className: "bg-slate-100 text-slate-700" },
  expired: { label: "Expired", className: "bg-red-100 text-red-800" },
  exhausted: { label: "Exhausted", className: "bg-orange-100 text-orange-800" },
  inactive: { label: "Deactivated", className: "bg-gray-100 text-gray-800" },
  archived: { label: "Archived", className: "bg-gray-200 text-gray-700" },
};

/** date → ms at start of day (for validity windows). */
const startOfDay = (value: string): number => {
  const ms = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(ms) ? ms : 0;
};
/** date → ms at end of day, so "valid till 31 Oct" really includes the 31st. */
const endOfDay = (value: string): number => {
  const ms = new Date(`${value}T23:59:59`).getTime();
  return Number.isFinite(ms) ? ms : 0;
};
const toDateInput = (ms: number | null | undefined): string =>
  ms ? new Date(ms).toISOString().split("T")[0] : "";

const PERIODS = [
  { label: "All time", days: 0 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

export default function AdminCoupons() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [periodDays, setPeriodDays] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponForm>(EMPTY_FORM);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ id: string; code: string } | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  const coupons = useQuery(api.admin.listCoupons);
  const viewedCoupon = useQuery(
    api.admin.couponDetails,
    viewId ? { couponId: viewId as any } : "skip"
  );
  const categories = useQuery(api.admin.listCategories);
  const analytics = useQuery(
    api.admin.couponAnalytics,
    periodDays > 0 ? { since: Date.now() - periodDays * DAY } : {}
  );
  const upsertCoupon = useMutation(api.admin.upsertCoupon);
  const deleteCoupon = useMutation(api.admin.deleteCoupon);

  const filteredCoupons = coupons?.filter((c: any) => {
    if (statusFilter !== "all" && couponStatus(c) !== statusFilter) return false;
    if (!search) return true;
    const needle = search.toLowerCase();
    return (
      c.code.toLowerCase().includes(needle) ||
      (c.name || "").toLowerCase().includes(needle)
    );
  });

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowAdvanced(false);
    setDialogOpen(true);
  };

  const openEdit = (coupon: any) => {
    setEditingId(coupon._id);
    setForm({
      code: coupon.code,
      name: coupon.name || "",
      description: coupon.description || "",
      discountType: coupon.discountType || "percentage",
      discountPercent: coupon.discountPercent,
      fixedDiscount: coupon.fixedDiscount || 0,
      maxDiscount: coupon.maxDiscount,
      minOrder: coupon.minOrder,
      usageLimit: coupon.usageLimit,
      isActive: coupon.isActive,
      startsAt: coupon.startsAt ?? null,
      expiresAt: coupon.expiresAt,
      perUserLimit: coupon.perUserLimit ?? 0,
      firstOrderOnly: !!coupon.firstOrderOnly,
      eligibleCategoryIds: coupon.eligibleCategoryIds ?? [],
      publicationStatus:
        coupon.publicationStatus ??
        (coupon.isActive ? "active" : "deactivated"),
      showOnHomepage: coupon.showOnHomepage ?? false,
      showOnProductPages: coupon.showOnProductPages ?? false,
      showInMyCoupons: coupon.showInMyCoupons ?? false,
      allowCampaignStacking: coupon.allowCampaignStacking ?? true,
    });
    setShowAdvanced(
      !!coupon.firstOrderOnly ||
        !!coupon.perUserLimit ||
        (coupon.eligibleCategoryIds?.length ?? 0) > 0 ||
        !!coupon.startsAt
    );
    setDialogOpen(true);
  };

  const buildPayload = (archived?: boolean) => ({
    code: form.code.trim(),
    discountType: form.discountType,
    discountPercent: form.discountPercent,
    fixedDiscount: form.fixedDiscount,
    maxDiscount: form.maxDiscount,
    minOrder: form.minOrder,
    usageLimit: form.usageLimit,
    isActive:
      form.publicationStatus === "active" ||
      form.publicationStatus === "scheduled",
    expiresAt: form.expiresAt,
    name: form.name,
    description: form.description,
    startsAt: form.startsAt ?? undefined,
    perUserLimit: form.perUserLimit,
    firstOrderOnly: form.firstOrderOnly,
    eligibleCategoryIds: form.eligibleCategoryIds as any,
    publicationStatus: form.publicationStatus,
    showOnHomepage: form.showOnHomepage,
    showOnProductPages: form.showOnProductPages,
    showInMyCoupons: form.showInMyCoupons,
    allowCampaignStacking: form.allowCampaignStacking,
    ...(archived !== undefined ? { archived } : {}),
  });

  const handleSave = async () => {
    if (!form.code.trim()) {
      toast.error("Coupon code is required");
      return;
    }
    if (form.discountType === "percentage" && (form.discountPercent <= 0 || form.discountPercent > 100)) {
      toast.error("Discount must be between 1 and 100%");
      return;
    }
    if (form.discountType === "fixed" && form.fixedDiscount <= 0) {
      toast.error("Flat discount must be greater than ₹0");
      return;
    }
    if (form.startsAt && form.startsAt >= form.expiresAt) {
      toast.error("Start date must be before the expiry date");
      return;
    }
    if (form.publicationStatus === "scheduled" && !form.startsAt) {
      toast.error("A scheduled coupon needs a start date");
      return;
    }

    setSaving(true);
    try {
      const payload: any = buildPayload();
      if (editingId) payload.id = editingId;
      await upsertCoupon(payload);
      toast.success(editingId ? "Coupon updated" : "Coupon created");
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save coupon");
    } finally {
      setSaving(false);
    }
  };

  /** Activate / deactivate without opening the editor. */
  const handleToggleActive = async (coupon: any) => {
    try {
      await upsertCoupon({
        id: coupon._id,
        ...buildPayloadForExisting(
          coupon,
          !coupon.isActive,
          coupon.isActive ? "deactivated" : "active"
        ),
      });
      toast.success(
        coupon.isActive ? `${coupon.code} deactivated` : `${coupon.code} activated`
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to update coupon");
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog) return;
    try {
      const result: any = await deleteCoupon({ couponId: deleteDialog.id as any });
      if (result?.archived) {
        toast.success(
          `${deleteDialog.code} archived — it is used by existing orders, so its history was preserved`
        );
      } else {
        toast.success("Coupon deleted");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to delete coupon");
    }
    setDeleteDialog(null);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Coupons</h1>
            <p className="text-sm text-muted-foreground">Create and manage discount coupons</p>
          </div>
          <Button onClick={openAdd} className="gradient-primary text-white gap-2">
            <Plus className="size-4" /> Add Coupon
          </Button>
        </motion.div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search by code or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setStatusFilter(filter.key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                  statusFilter === filter.key
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/60 text-muted-foreground hover:border-primary/40"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <BarChart3 className="size-3.5" />
            <select
              value={periodDays}
              onChange={(e) => setPeriodDays(Number(e.target.value))}
              className="h-8 rounded-md border border-border/60 bg-background px-2 text-xs text-foreground"
            >
              {PERIODS.map((p) => (
                <option key={p.days} value={p.days}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Coupons List */}
        {coupons === undefined ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !filteredCoupons || filteredCoupons.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-16 text-center">
              <Ticket className="size-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-1">No coupons found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {search || statusFilter !== "all"
                  ? "Try a different search or filter"
                  : "Create your first coupon to offer discounts"}
              </p>
              {!search && statusFilter === "all" && (
                <Button onClick={openAdd} className="gradient-primary text-white gap-2">
                  <Plus className="size-4" /> Create Coupon
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredCoupons.map((coupon: any) => {
              const status = couponStatus(coupon);
              const badge = STATUS_BADGES[status];
              const stats = analytics?.[coupon._id];
              const usageText =
                coupon.usageLimit > 0
                  ? `${coupon.usedCount}/${coupon.usageLimit}`
                  : `${coupon.usedCount} / ∞`;
              return (
                <Card key={coupon._id} className="border-border/60 hover:shadow-sm transition-all">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="size-10 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0">
                        <Ticket className="size-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-6 gap-2">
                        <div className="col-span-2 sm:col-span-1">
                          <p className="text-sm font-bold font-mono truncate">{coupon.code}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {coupon.discountType === "free_delivery"
                              ? "Free delivery"
                              : coupon.discountType === "fixed"
                                ? `₹${coupon.fixedDiscount} off`
                                : `${coupon.discountPercent}% off`}
                          </p>
                          {coupon.name && (
                            <p className="text-[11px] text-muted-foreground truncate">{coupon.name}</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Max Discount</p>
                          <p className="text-sm font-medium">
                            {coupon.discountType === "percentage"
                              ? coupon.maxDiscount > 0
                                ? `₹${coupon.maxDiscount}`
                                : "No cap"
                              : "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Min Order</p>
                          <p className="text-sm font-medium">₹{coupon.minOrder}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Usage</p>
                          <p className="text-sm font-medium">{usageText}</p>
                          {coupon.perUserLimit > 0 && (
                            <p className="text-[10px] text-muted-foreground">
                              {coupon.perUserLimit}/customer
                            </p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Validity</p>
                          <p className="text-sm font-medium">
                            {coupon.startsAt
                              ? `${new Date(coupon.startsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} → `
                              : ""}
                            {new Date(coupon.expiresAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </p>
                          {coupon.firstOrderOnly && (
                            <p className="text-[10px] text-muted-foreground">First order only</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <Badge className={`text-[10px] ${badge.className}`}>{badge.label}</Badge>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="text-[10px] gap-1" onClick={() => setViewId(coupon._id)}>
                            <Eye className="size-3" /> View
                          </Button>
                          <Button variant="outline" size="sm" className="text-[10px] gap-1" onClick={() => openEdit(coupon)}>
                            <Pencil className="size-3" /> Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-[10px] gap-1"
                            onClick={() => handleToggleActive(coupon)}
                            disabled={status === "archived"}
                          >
                            {coupon.isActive ? <X className="size-3" /> : <Check className="size-3" />}
                            {coupon.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-[10px] text-destructive hover:text-destructive hover:bg-destructive/5 gap-1"
                            onClick={() => setDeleteDialog({ id: coupon._id, code: coupon.code })}
                          >
                            <Trash2 className="size-3" /> Delete
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Analytics — computed only from stored order and
                        redemption records; no estimated or invented metrics. */}
                    {stats && (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 rounded-lg bg-muted/40 p-2.5 text-xs">
                        <div>
                          <p className="text-muted-foreground">Redemptions</p>
                          <p className="font-semibold">{stats.redemptions}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Unique customers</p>
                          <p className="font-semibold">{stats.uniqueCustomers}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Discount granted</p>
                          <p className="font-semibold">
                            ₹{(stats.totalDiscountGranted + stats.deliveryWaived).toLocaleString("en-IN")}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Orders</p>
                          <p className="font-semibold">
                            {stats.orderCount}
                            {stats.cancelledOrders > 0 && (
                              <span className="text-muted-foreground font-normal">
                                {" "}({stats.cancelledOrders} cancelled)
                              </span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Order value</p>
                          <p className="font-semibold">
                            ₹{Math.round(stats.grossOrderValue).toLocaleString("en-IN")}
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Coupon" : "Create Coupon"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Update coupon details" : "Create a new discount coupon for customers"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Coupon Code *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. SAVE20"
                maxLength={20}
              />
              <p className="text-[10px] text-muted-foreground">
                3-20 letters or numbers. Codes are unique.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Offer Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Diwali Flat ₹150 Off"
                maxLength={60}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Discount Type</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={form.discountType === "percentage" ? "default" : "outline"}
                  size="sm"
                  className={`flex-1 ${form.discountType === "percentage" ? "gradient-primary text-white" : ""}`}
                  onClick={() => setForm({ ...form, discountType: "percentage" })}
                >
                  Percentage %
                </Button>
                <Button
                  type="button"
                  variant={form.discountType === "fixed" ? "default" : "outline"}
                  size="sm"
                  className={`flex-1 ${form.discountType === "fixed" ? "gradient-primary text-white" : ""}`}
                  onClick={() => setForm({ ...form, discountType: "fixed" })}
                >
                  Flat ₹
                </Button>
                <Button
                  type="button"
                  variant={form.discountType === "free_delivery" ? "default" : "outline"}
                  size="sm"
                  className={`flex-1 ${form.discountType === "free_delivery" ? "gradient-primary text-white" : ""}`}
                  onClick={() => setForm({ ...form, discountType: "free_delivery" })}
                >
                  Free Delivery
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {form.discountType === "percentage" && (
                <div className="space-y-1.5">
                  <Label>Discount %</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={form.discountPercent}
                    onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })}
                  />
                </div>
              )}
              {form.discountType === "fixed" && (
                <div className="space-y-1.5">
                  <Label>Flat Discount (₹)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.fixedDiscount}
                    onChange={(e) => setForm({ ...form, fixedDiscount: Number(e.target.value) })}
                  />
                </div>
              )}
              {form.discountType === "percentage" && (
                <div className="space-y-1.5">
                  <Label>Max Discount (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.maxDiscount}
                    onChange={(e) => setForm({ ...form, maxDiscount: Number(e.target.value) })}
                  />
                  <p className="text-[10px] text-muted-foreground">0 = no cap</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Min Order (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.minOrder}
                  onChange={(e) => setForm({ ...form, minOrder: Number(e.target.value) })}
                />
                <p className="text-[10px] text-muted-foreground">After product discounts</p>
              </div>
              <div className="space-y-1.5">
                <Label>Usage Limit</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.usageLimit}
                  onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })}
                />
                <p className="text-[10px] text-muted-foreground">0 = unlimited</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={toDateInput(form.startsAt)}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      startsAt: e.target.value ? startOfDay(e.target.value) : null,
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Expires At</Label>
                <Input
                  type="date"
                  value={toDateInput(form.expiresAt)}
                  onChange={(e) => {
                    if (e.target.value) setForm({ ...form, expiresAt: endOfDay(e.target.value) });
                  }}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Coupon Status</Label>
              <select
                value={form.publicationStatus}
                onChange={(e) =>
                  setForm({
                    ...form,
                    publicationStatus: e.target.value as CouponForm["publicationStatus"],
                  })
                }
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="active">Active</option>
                <option value="deactivated">Deactivated</option>
              </select>
              <p className="text-[10px] text-muted-foreground">
                Draft, scheduled (before its start date), deactivated and expired coupons cannot be
                redeemed. Scheduled coupons go live automatically on the start date.
              </p>
            </div>

            {/* Customer visibility — each placement is independent. */}
            <div className="space-y-2 rounded-lg border border-border/60 p-3">
              <p className="text-sm font-medium text-foreground">Customer visibility</p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.showOnHomepage}
                  onChange={(e) => setForm({ ...form, showOnHomepage: e.target.checked })}
                  className="size-4 mt-0.5 rounded border-gray-300"
                />
                <span className="text-sm text-foreground">
                  Show on homepage Offers &amp; Coupons
                  <span className="block text-[10px] text-muted-foreground">
                    Appears in the homepage section and on the dedicated Offers page.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.showOnProductPages}
                  onChange={(e) => setForm({ ...form, showOnProductPages: e.target.checked })}
                  className="size-4 mt-0.5 rounded border-gray-300"
                />
                <span className="text-sm text-foreground">
                  Show on eligible product pages
                  <span className="block text-[10px] text-muted-foreground">
                    Only products in the coupon's eligible categories.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.showInMyCoupons}
                  onChange={(e) => setForm({ ...form, showInMyCoupons: e.target.checked })}
                  className="size-4 mt-0.5 rounded border-gray-300"
                />
                <span className="text-sm text-foreground">
                  Show in customer My Coupons
                  <span className="block text-[10px] text-muted-foreground">
                    Only customers who are eligible see it as available.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer border-t border-border/60 pt-2">
                <input
                  type="checkbox"
                  checked={form.allowCampaignStacking}
                  onChange={(e) =>
                    setForm({ ...form, allowCampaignStacking: e.target.checked })
                  }
                  className="size-4 mt-0.5 rounded border-gray-300"
                />
                <span className="text-sm text-foreground">
                  Allow combination with campaign discounts
                  <span className="block text-[10px] text-muted-foreground">
                    When off, the coupon cannot be used while a live campaign offer covers the cart.
                  </span>
                </span>
              </label>
            </div>

            {/* Advanced eligibility — optional, collapsed by default so
                creating a simple coupon stays a 10-second job. */}
            <div className="border-t border-border/60 pt-3">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex w-full items-center justify-between text-sm font-medium text-foreground"
              >
                Advanced eligibility
                {showAdvanced ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
              </button>

              {showAdvanced && (
                <div className="mt-3 space-y-4">
                  <div className="space-y-1.5">
                    <Label>Per-customer limit</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.perUserLimit}
                      onChange={(e) =>
                        setForm({ ...form, perUserLimit: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                    <p className="text-[10px] text-muted-foreground">
                      How many times each customer may use it. 0 = unlimited.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.firstOrderOnly}
                      onChange={(e) => setForm({ ...form, firstOrderOnly: e.target.checked })}
                      className="size-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-foreground">
                      First-order customers only
                      <span className="block text-[10px] text-muted-foreground">
                        Checked against the customer's real order history on the server.
                      </span>
                    </span>
                  </label>

                  <div className="space-y-1.5">
                    <Label>Description (optional)</Label>
                    <Input
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Shown to customers with the offer"
                      maxLength={120}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Eligible categories</Label>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto rounded-md border border-border/60 p-2">
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, eligibleCategoryIds: [] })}
                        className={`px-2 py-1 rounded-full text-[11px] border ${
                          form.eligibleCategoryIds.length === 0
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/60 text-muted-foreground"
                        }`}
                      >
                        All products
                      </button>
                      {(categories ?? []).map((cat: any) => {
                        const selected = form.eligibleCategoryIds.includes(cat._id);
                        return (
                          <button
                            type="button"
                            key={cat._id}
                            onClick={() =>
                              setForm({
                                ...form,
                                eligibleCategoryIds: selected
                                  ? form.eligibleCategoryIds.filter((id) => id !== cat._id)
                                  : [...form.eligibleCategoryIds, cat._id],
                              })
                            }
                            className={`px-2 py-1 rounded-full text-[11px] border ${
                              selected
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border/60 text-muted-foreground"
                            }`}
                          >
                            {cat.name}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Only products in these categories count towards the minimum order and the
                      discount. Leave as “All products” for a store-wide coupon.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="gradient-primary text-white gap-2">
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editingId ? "Update" : "Create"} Coupon
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Coupon Details + Analytics — real stored values only */}
      <Dialog open={!!viewId} onOpenChange={(open) => !open && setViewId(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-mono">
              <Ticket className="size-4 text-primary" />
              {viewedCoupon?.coupon?.code ?? "Coupon details"}
            </DialogTitle>
            <DialogDescription>
              {viewedCoupon?.coupon?.name || "Redemption and usage analytics"}
            </DialogDescription>
          </DialogHeader>

          {!viewedCoupon ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4 py-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Status</span>
                <Badge className={`text-[10px] ${STATUS_BADGES[viewedCoupon.status].className}`}>
                  {STATUS_BADGES[viewedCoupon.status].label}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded-lg bg-muted/40 p-2.5">
                  <p className="text-muted-foreground">Total redemptions</p>
                  <p className="text-base font-semibold">{viewedCoupon.analytics.totalRedemptions}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-2.5">
                  <p className="text-muted-foreground">Unique customers</p>
                  <p className="text-base font-semibold">{viewedCoupon.analytics.uniqueCustomers}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-2.5">
                  <p className="text-muted-foreground">Discount given</p>
                  <p className="text-base font-semibold">
                    ₹{(viewedCoupon.analytics.totalDiscountGranted + viewedCoupon.analytics.deliveryWaived).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 p-2.5">
                  <p className="text-muted-foreground">Successful orders</p>
                  <p className="text-base font-semibold">{viewedCoupon.analytics.successfulOrders}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {viewedCoupon.analytics.cancelledOrders} cancelled
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border/60 p-3 space-y-1.5 text-xs">
                <p className="text-sm font-medium text-foreground">Usage</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total usage limit</span>
                  <span className="font-medium">
                    {viewedCoupon.usage.usageLimit ?? "Unlimited"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Used quantity</span>
                  <span className="font-medium">{viewedCoupon.usage.usedQuantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Remaining quantity</span>
                  <span className="font-medium">
                    {viewedCoupon.usage.remainingQuantity ?? "Unlimited"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available quantity</span>
                  <span className="font-medium">
                    {viewedCoupon.usage.availableQuantity ?? "Unlimited"}
                  </span>
                </div>
              </div>

              <div className="grid gap-1.5 text-xs">
                <p className="text-sm font-medium text-foreground">Configuration</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-medium">
                    {viewedCoupon.coupon.discountType === "free_delivery"
                      ? "Free delivery"
                      : viewedCoupon.coupon.discountType === "fixed"
                        ? `Flat ₹${viewedCoupon.coupon.fixedDiscount}`
                        : `${viewedCoupon.coupon.discountPercent}% off`}
                    {viewedCoupon.coupon.discountType === "percentage" &&
                      viewedCoupon.coupon.maxDiscount > 0 &&
                      ` (up to ₹${viewedCoupon.coupon.maxDiscount})`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Minimum order</span>
                  <span className="font-medium">₹{viewedCoupon.coupon.minOrder}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Validity</span>
                  <span className="font-medium text-right">
                    {viewedCoupon.coupon.startsAt
                      ? `${new Date(viewedCoupon.coupon.startsAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} → `
                      : ""}
                    {new Date(viewedCoupon.coupon.expiresAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-muted-foreground">Eligibility</span>
                  <span className="font-medium text-right">
                    {(viewedCoupon.coupon.eligibleCategoryIds ?? []).length === 0
                      ? "All products"
                      : (viewedCoupon.coupon.eligibleCategoryIds ?? [])
                          .map(
                            (id: string) =>
                              (categories ?? []).find((c: any) => c._id === id)?.name ?? "Category"
                          )
                          .join(", ")}
                    {viewedCoupon.coupon.firstOrderOnly ? " · first order only" : ""}
                    {viewedCoupon.coupon.perUserLimit
                      ? ` · ${viewedCoupon.coupon.perUserLimit}/customer`
                      : ""}
                  </span>
                </div>
              </div>

              <div className="grid gap-1.5 text-xs">
                <p className="text-sm font-medium text-foreground">Visibility</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Homepage Offers &amp; Coupons</span>
                  <span className="font-medium">{viewedCoupon.coupon.showOnHomepage ? "Shown" : "Hidden"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Eligible product pages</span>
                  <span className="font-medium">{viewedCoupon.coupon.showOnProductPages ? "Shown" : "Hidden"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer My Coupons</span>
                  <span className="font-medium">{viewedCoupon.coupon.showInMyCoupons ? "Shown" : "Hidden"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Campaign stacking</span>
                  <span className="font-medium">
                    {viewedCoupon.coupon.allowCampaignStacking === false ? "Not allowed" : "Allowed"}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewId(null)}>Close</Button>
            {viewedCoupon && (
              <Button
                className="gradient-primary text-white gap-1"
                onClick={() => {
                  setViewId(null);
                  openEdit(viewedCoupon.coupon);
                }}
              >
                <Pencil className="size-3" /> Edit Coupon
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete / Archive Dialog */}
      <Dialog open={!!deleteDialog} onOpenChange={() => setDeleteDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Coupon?</DialogTitle>
            <DialogDescription>
              If <span className="font-mono font-semibold">{deleteDialog?.code}</span> has been used
              by any order, it will be archived instead of deleted so order history and financial
              records stay intact. Unused coupons are removed permanently.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}

/**
 * Full payload for an existing coupon with one field changed (used by the
 * quick activate/deactivate action, so it goes through the same backend
 * validation as a full edit).
 */
function buildPayloadForExisting(
  coupon: any,
  isActive: boolean,
  publicationStatus?: "draft" | "scheduled" | "active" | "deactivated"
) {
  return {
    code: coupon.code,
    discountType: coupon.discountType,
    discountPercent: coupon.discountPercent,
    fixedDiscount: coupon.fixedDiscount,
    maxDiscount: coupon.maxDiscount,
    minOrder: coupon.minOrder,
    usageLimit: coupon.usageLimit,
    isActive,
    expiresAt: coupon.expiresAt,
    name: coupon.name || "",
    description: coupon.description || "",
    startsAt: coupon.startsAt,
    perUserLimit: coupon.perUserLimit ?? 0,
    firstOrderOnly: !!coupon.firstOrderOnly,
    eligibleCategoryIds: coupon.eligibleCategoryIds ?? [],
    publicationStatus:
      publicationStatus ??
      coupon.publicationStatus ??
      (coupon.isActive ? "active" : "deactivated"),
    showOnHomepage: coupon.showOnHomepage ?? false,
    showOnProductPages: coupon.showOnProductPages ?? false,
    showInMyCoupons: coupon.showInMyCoupons ?? false,
    allowCampaignStacking: coupon.allowCampaignStacking ?? true,
    archived: coupon.archived ?? false,
  };
}
