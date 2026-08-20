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
} from "lucide-react";
import { toast } from "sonner";

interface CouponForm {
  code: string;
  discountPercent: number;
  maxDiscount: number;
  minOrder: number;
  usageLimit: number;
  isActive: boolean;
  expiresAt: number;
}

const EMPTY_FORM: CouponForm = {
  code: "",
  discountPercent: 10,
  maxDiscount: 200,
  minOrder: 300,
  usageLimit: 100,
  isActive: true,
  expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
};

export default function AdminCoupons() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null);

  const coupons = useQuery(api.admin.listCoupons);
  const upsertCoupon = useMutation(api.admin.upsertCoupon);
  const deleteCoupon = useMutation(api.admin.deleteCoupon);

  const filteredCoupons = coupons?.filter((c: any) => {
    if (!search) return true;
    return c.code.toLowerCase().includes(search.toLowerCase());
  });

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (coupon: any) => {
    setEditingId(coupon._id);
    setForm({
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      maxDiscount: coupon.maxDiscount,
      minOrder: coupon.minOrder,
      usageLimit: coupon.usageLimit,
      isActive: coupon.isActive,
      expiresAt: coupon.expiresAt,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.code.trim()) {
      toast.error("Coupon code is required");
      return;
    }
    if (form.discountPercent <= 0 || form.discountPercent > 100) {
      toast.error("Discount must be between 1 and 100%");
      return;
    }

    setSaving(true);
    try {
      const payload: any = {
        code: form.code.trim(),
        discountPercent: form.discountPercent,
        maxDiscount: form.maxDiscount,
        minOrder: form.minOrder,
        usageLimit: form.usageLimit,
        isActive: form.isActive,
        expiresAt: form.expiresAt,
      };
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

  const handleDelete = async () => {
    if (!deleteDialogId) return;
    try {
      await deleteCoupon({ couponId: deleteDialogId as any });
      toast.success("Coupon deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete coupon");
    }
    setDeleteDialogId(null);
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

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search coupons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
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
                {search ? "Try a different search" : "Create your first coupon to offer discounts"}
              </p>
              {!search && (
                <Button onClick={openAdd} className="gradient-primary text-white gap-2">
                  <Plus className="size-4" /> Create Coupon
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredCoupons.map((coupon: any) => {
              const isExpired = coupon.expiresAt < Date.now();
              const isMaxed = coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit;
              return (
                <Card key={coupon._id} className="border-border/60 hover:shadow-sm transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="size-10 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0">
                        <Ticket className="size-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <div>
                          <p className="text-sm font-bold font-mono">{coupon.code}</p>
                          <p className="text-xs text-muted-foreground">{coupon.discountPercent}% off</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Max Discount</p>
                          <p className="text-sm font-medium">₹{coupon.maxDiscount}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Min Order</p>
                          <p className="text-sm font-medium">₹{coupon.minOrder}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Usage</p>
                          <p className="text-sm font-medium">{coupon.usedCount}/{coupon.usageLimit}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Expires</p>
                          <p className="text-sm font-medium">
                            {new Date(coupon.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isExpired ? (
                          <Badge className="text-[10px] bg-red-100 text-red-800">Expired</Badge>
                        ) : isMaxed ? (
                          <Badge className="text-[10px] bg-orange-100 text-orange-800">Maxed Out</Badge>
                        ) : coupon.isActive ? (
                          <Badge className="text-[10px] bg-green-100 text-green-800"><Check className="size-2.5 mr-1" /> Active</Badge>
                        ) : (
                          <Badge className="text-[10px] bg-gray-100 text-gray-800"><X className="size-2.5 mr-1" /> Inactive</Badge>
                        )}
                        <Button variant="outline" size="sm" className="text-[10px] gap-1" onClick={() => openEdit(coupon)}>
                          <Pencil className="size-3" /> Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[10px] text-destructive hover:text-destructive hover:bg-destructive/5 gap-1"
                          onClick={() => setDeleteDialogId(coupon._id)}
                        >
                          <Trash2 className="size-3" /> Delete
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
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
            </div>
            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-1.5">
                <Label>Max Discount (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.maxDiscount}
                  onChange={(e) => setForm({ ...form, maxDiscount: Number(e.target.value) })}
                />
              </div>
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
              </div>
              <div className="space-y-1.5">
                <Label>Usage Limit</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.usageLimit}
                  onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Expires At</Label>
              <Input
                type="date"
                value={new Date(form.expiresAt).toISOString().split("T")[0]}
                onChange={(e) => setForm({ ...form, expiresAt: new Date(e.target.value).getTime() })}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="size-4 rounded border-gray-300"
              />
              <span className="text-sm text-foreground">Active</span>
            </label>
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

      {/* Delete Dialog */}
      <Dialog open={!!deleteDialogId} onOpenChange={() => setDeleteDialogId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Coupon?</DialogTitle>
            <DialogDescription>This will permanently remove this coupon. Customers will no longer be able to use it.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
