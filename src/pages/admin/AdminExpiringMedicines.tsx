import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/auth-utils";
import {
  AlertTriangle,
  Clock,
  PackageX,
  CalendarDays,
  Loader2,
  ArrowRight,
  Filter,
  Search,
  ShieldAlert,
  CheckCircle,
} from "lucide-react";

const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000;

/** yyyy-mm-dd in LOCAL time for <input type="date"> (IST-safe). */
function toDateInputValue(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getDaysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 30) return `${days} days`;
  if (days <= 60) return `${Math.round(days / 30)} months`;
  if (days <= 90) return `${Math.round(days / 30)} months`;
  return `${Math.round(days / 30)} months`;
}

export default function AdminExpiringMedicines() {
  const [filter, setFilter] = useState<"all" | "expired" | "expiring_soon">("all");
  const [search, setSearch] = useState("");

  const expiringProducts = useQuery(api.adminProducts.getExpiringMedicines);
  const expiringCount = useQuery(api.adminProducts.getExpiringMedicinesCount);

  // ── Manage dialog: a dedicated management view for ONE existing medicine.
  // The product is loaded by its real ID (adminProducts.get) and every save
  // patches that same row — no product is ever created from this view.
  const [manageId, setManageId] = useState<Id<"products"> | null>(null);
  const [expiryInput, setExpiryInput] = useState("");
  const [stockInput, setStockInput] = useState("");
  const [saving, setSaving] = useState(false);

  const managedProduct = useQuery(
    api.adminProducts.get,
    manageId ? { productId: manageId } : "skip"
  );
  const updateExpiry = useMutation(api.adminInventory.updateExpiry);
  const adjustStock = useMutation(api.adminInventory.adjustStock);

  // Seed the form from the loaded product whenever a DIFFERENT medicine is
  // opened. Reactive refreshes after a save do not reseed, so in-progress
  // edits are never clobbered by the subscription.
  const managedProductId = managedProduct?._id;
  useEffect(() => {
    if (!managedProduct) return;
    setExpiryInput(
      managedProduct.expiryDate ? toDateInputValue(managedProduct.expiryDate) : ""
    );
    setStockInput(String(managedProduct.stockQuantity ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managedProductId]);

  const filteredProducts = useMemo(() => {
    if (!expiringProducts) return [];
    let list = expiringProducts;
    if (filter !== "all") {
      list = list.filter((p) => p.expiryStatus === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.manufacturer.toLowerCase().includes(q) ||
          p.categoryName.toLowerCase().includes(q)
      );
    }
    return list;
  }, [expiringProducts, filter, search]);

  const expired = expiringCount?.expired ?? 0;
  const expiringSoon = expiringCount?.expiringSoon ?? 0;
  const total = expiringCount?.total ?? 0;

  // Expiry status for the open dialog — derived from the stored date with the
  // SAME rule the list and backend use, never from a manually entered label.
  const managedNow = Date.now();
  const managedExpiryDate = managedProduct?.expiryDate ?? null;
  const managedStatus: "expired" | "expiring_soon" | "ok" | null =
    managedExpiryDate === null
      ? null
      : managedExpiryDate <= managedNow
      ? "expired"
      : managedExpiryDate <= managedNow + THREE_MONTHS_MS
      ? "expiring_soon"
      : "ok";

  const handleSave = async () => {
    if (!manageId || !managedProduct) return;

    const newStock = Number(stockInput);
    if (!Number.isInteger(newStock) || newStock < 0) {
      toast.error("Stock quantity must be a whole number of 0 or more");
      return;
    }
    if (!expiryInput) {
      toast.error("Expiry date is required — status is derived from it");
      return;
    }
    const newExpiry = new Date(`${expiryInput}T00:00:00`).getTime();
    if (!Number.isFinite(newExpiry)) {
      toast.error("Enter a valid expiry date");
      return;
    }

    setSaving(true);
    try {
      let changed = false;
      if (newExpiry !== managedProduct.expiryDate) {
        await updateExpiry({ productId: manageId, expiryDate: newExpiry });
        changed = true;
      }
      if (newStock !== managedProduct.stockQuantity) {
        await adjustStock({
          productId: manageId,
          newQuantity: newStock,
          reason:
            newStock === 0 && (managedProduct.expiryDate ?? Infinity) <= Date.now()
              ? "Expired stock removed from sale (Expiring Medicines)"
              : "Stock updated from Expiring Medicines manage view",
        });
        changed = true;
      }
      toast.success(
        changed ? "Changes saved to the existing medicine" : "No changes to save"
      );
    } catch (error: any) {
      toast.error(error.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveExpiredStock = async () => {
    if (!manageId || !managedProduct || managedProduct.stockQuantity <= 0) return;
    setSaving(true);
    try {
      await adjustStock({
        productId: manageId,
        newQuantity: 0,
        reason: "Expired stock removed from sale (Expiring Medicines)",
      });
      setStockInput("0");
      toast.success("Expired stock marked as removed from sale");
    } catch (error: any) {
      toast.error(error.message || "Failed to update stock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="size-5 text-amber-500" />
              Expiring Medicines
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track medicines approaching expiry or already expired
            </p>
          </div>

          {/* Summary badges */}
          <div className="flex items-center gap-2">
            {expired > 0 && (
              <Badge className="bg-red-100 text-red-700 gap-1.5 px-3 py-1.5 text-xs font-semibold">
                <PackageX className="size-3.5" />
                {expired} Expired
              </Badge>
            )}
            {expiringSoon > 0 && (
              <Badge className="bg-amber-100 text-amber-700 gap-1.5 px-3 py-1.5 text-xs font-semibold">
                <Clock className="size-3.5" />
                {expiringSoon} Expiring Soon
              </Badge>
            )}
            {total === 0 && (
              <Badge className="bg-green-100 text-green-700 gap-1.5 px-3 py-1.5 text-xs font-semibold">
                <CheckCircle className="size-3.5" />
                All Clear
              </Badge>
            )}
          </div>
        </motion.div>

        {/* Summary Cards */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`text-left rounded-2xl border p-4 transition-all duration-200 ${
              filter === "all"
                ? "border-primary/40 bg-primary/[0.04] shadow-sm"
                : "border-border/60 bg-card hover:shadow-sm hover:border-primary/20"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-slate-100 flex items-center justify-center">
                <Filter className="size-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{total}</p>
                <p className="text-xs text-muted-foreground">Total Alert</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFilter("expiring_soon")}
            className={`text-left rounded-2xl border p-4 transition-all duration-200 ${
              filter === "expiring_soon"
                ? "border-amber-300 bg-amber-50/60 shadow-sm"
                : "border-border/60 bg-card hover:shadow-sm hover:border-amber-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <Clock className="size-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-700">{expiringSoon}</p>
                <p className="text-xs text-muted-foreground">Expiring Soon</p>
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFilter("expired")}
            className={`text-left rounded-2xl border p-4 transition-all duration-200 ${
              filter === "expired"
                ? "border-red-300 bg-red-50/60 shadow-sm"
                : "border-border/60 bg-card hover:shadow-sm hover:border-red-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-red-100 flex items-center justify-center">
                <ShieldAlert className="size-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">{expired}</p>
                <p className="text-xs text-muted-foreground">Expired</p>
              </div>
            </div>
          </button>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, manufacturer or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-border/60 bg-card focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all placeholder:text-muted-foreground/60"
            />
          </div>
        </motion.div>

        {/* Products List */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {expiringProducts === undefined ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <Card className="border-border/60">
              <CardContent className="py-16 text-center">
                <CheckCircle className="size-12 text-green-500/40 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  No {filter === "all" ? "" : filter === "expired" ? "expired " : "expiring "}
                  medicines found
                </h3>
                <p className="text-sm text-muted-foreground">
                  {search
                    ? "Try a different search term"
                    : "All medicines have valid expiry dates"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((product, index) => {
                  const isExpired = product.expiryStatus === "expired";
                  const daysLabel = getDaysLabel(product.daysUntilExpiry);

                  return (
                    <motion.div
                      key={product._id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.03 }}
                      className={`rounded-2xl border p-4 sm:p-5 transition-all hover:shadow-sm ${
                        isExpired
                          ? "border-red-200 bg-red-50/30 hover:border-red-300"
                          : "border-amber-200 bg-amber-50/30 hover:border-amber-300"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        {/* Product Image */}
                        <div className="shrink-0">
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="size-16 rounded-xl object-cover border border-border/40"
                            />
                          ) : (
                            <div className="size-16 rounded-xl bg-muted/50 flex items-center justify-center border border-border/40">
                              <PackageX className="size-7 text-muted-foreground/40" />
                            </div>
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-start gap-2 mb-1">
                            <h3 className="text-sm font-semibold text-foreground truncate">
                              {product.name}
                            </h3>
                            <Badge
                              className={`text-[10px] px-2 py-0.5 ${
                                isExpired
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {isExpired ? "Expired" : "Expiring Soon"}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="size-3" />
                              Expires: {formatDate(product.expiryDate)}
                            </span>
                            <span className="font-medium">
                              {isExpired ? (
                                <span className="text-red-600">
                                  Expired {daysLabel}
                                </span>
                              ) : (
                                <span className="text-amber-600">
                                  {daysLabel} remaining
                                </span>
                              )}
                            </span>
                            <span>
                              Stock:{" "}
                              <span
                                className={`font-semibold ${
                                  product.stockQuantity === 0
                                    ? "text-red-600"
                                    : product.stockQuantity <= 10
                                    ? "text-amber-600"
                                    : "text-foreground"
                                }`}
                              >
                                {product.stockQuantity}
                              </span>
                            </span>
                            <span className="text-muted-foreground/60 hidden sm:inline">
                              {product.manufacturer}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-xs gap-1.5 rounded-xl"
                            onClick={() => setManageId(product._id)}
                          >
                            Manage
                            <ArrowRight className="size-3" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Dedicated medicine management dialog ──
          Opens for the clicked product only, loaded by its real ID. Editing
          here updates the SAME product record (expiry + stock) — the full
          Admin Products form and product creation flow are untouched. */}
      <Dialog
        open={manageId !== null}
        onOpenChange={(open) => {
          if (!open) setManageId(null);
        }}
      >
        <DialogContent className="max-w-lg sm:max-w-xl max-h-[calc(100dvh-1.5rem)] flex flex-col overflow-hidden">
          {managedProduct === undefined ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : managedProduct === null ? (
            <div className="py-8 text-center space-y-4">
              <PackageX className="size-10 text-red-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">
                  Medicine not found
                </h3>
                <p className="text-sm text-muted-foreground">
                  This product may have been deleted. Return to the list to see
                  the current alerts.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setManageId(null)}>
                Back to list
              </Button>
            </div>
          ) : (
            managedProduct && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex flex-wrap items-center gap-2">
                    {managedProduct.name}
                    {managedStatus === "expired" ? (
                      <Badge className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5">
                        Expired
                      </Badge>
                    ) : managedStatus === "expiring_soon" ? (
                      <Badge className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5">
                        Expiring Soon
                      </Badge>
                    ) : (
                      <Badge className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5">
                        Valid
                      </Badge>
                    )}
                  </DialogTitle>
                  <DialogDescription>
                    Edit this medicine's expiry and stock. Changes save to the
                    existing product record — nothing new is created.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Product summary */}
                  <div className="flex gap-4 rounded-xl border border-border/60 p-3">
                    {managedProduct.imageUrl ? (
                      <img
                        src={managedProduct.imageUrl}
                        alt={managedProduct.name}
                        className="size-16 rounded-lg object-cover border border-border/40 shrink-0"
                      />
                    ) : (
                      <div className="size-16 rounded-lg bg-muted/50 flex items-center justify-center border border-border/40 shrink-0">
                        <PackageX className="size-6 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="min-w-0 text-xs text-muted-foreground space-y-1">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {managedProduct.name}
                      </p>
                      <p>Manufacturer: {managedProduct.manufacturer}</p>
                      <p>
                        Category: {managedProduct.categoryName}
                        {managedProduct.brandName
                          ? ` · ${managedProduct.brandName}`
                          : ""}
                      </p>
                      <p className="flex flex-wrap gap-x-3">
                        <span>
                          MRP:{" "}
                          <span className="font-semibold text-foreground">
                            {formatCurrency(managedProduct.price)}
                          </span>
                        </span>
                        {managedProduct.discountPrice &&
                          managedProduct.discountPrice < managedProduct.price && (
                            <span>
                              Selling:{" "}
                              <span className="font-semibold text-foreground">
                                {formatCurrency(managedProduct.discountPrice)}
                              </span>
                            </span>
                          )}
                        {managedProduct.packSize && <span>Pack: {managedProduct.packSize}</span>}
                      </p>
                    </div>
                  </div>

                  {/* Prominent expired status + safety note */}
                  {managedStatus === "expired" && (
                    <div className="rounded-xl bg-red-50 border border-red-200 p-3 flex items-start gap-2.5">
                      <ShieldAlert className="size-4 text-red-600 shrink-0 mt-0.5" />
                      <div className="text-xs text-red-700 space-y-1">
                        <p className="font-semibold">Expired — not available for sale</p>
                        <p>
                          While the expiry date is in the past, this medicine is
                          blocked from the storefront cart and checkout
                          automatically. The product record and past orders are
                          preserved.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Editable fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="expiry-input">Expiry date</Label>
                      <Input
                        id="expiry-input"
                        type="date"
                        value={expiryInput}
                        onChange={(e) => setExpiryInput(e.target.value)}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Status is calculated from this date — no separate label.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="stock-input">Stock quantity</Label>
                      <Input
                        id="stock-input"
                        type="number"
                        min={0}
                        step={1}
                        value={stockInput}
                        onChange={(e) => setStockInput(e.target.value)}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Current inventory stock: {managedProduct.stockQuantity}
                      </p>
                    </div>
                  </div>

                  {/* Stock-handling action for expired medicine */}
                  {managedStatus === "expired" && managedProduct.stockQuantity > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                      disabled={saving}
                      onClick={handleRemoveExpiredStock}
                    >
                      <PackageX className="size-3.5 mr-1.5" />
                      Mark expired stock as removed from sale (set stock to 0)
                    </Button>
                  )}
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <Button
                    variant="outline"
                    disabled={saving}
                    onClick={() => setManageId(null)}
                  >
                    Cancel
                  </Button>
                  <Button disabled={saving} onClick={handleSave}>
                    {saving && <Loader2 className="size-4 animate-spin mr-1.5" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              </>
            )
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
