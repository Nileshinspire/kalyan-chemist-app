import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Pencil, Trash2, Ticket } from "lucide-react";
import { toast } from "sonner";

interface CouponForm {
  id?: string;
  code: string;
  discountPercent: number;
  maxDiscount: number;
  minOrder: number;
  usageLimit: number;
  isActive: boolean;
  expiresAt: number;
}

const EMPTY: CouponForm = {
  code: "",
  discountPercent: 10,
  maxDiscount: 500,
  minOrder: 500,
  usageLimit: 100,
  isActive: true,
  expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
};

export default function AdminCoupons() {
  const coupons = useQuery(api.admin.listCoupons);
  const upsert = useMutation(api.admin.upsertCoupon);
  const deleteCoupon = useMutation(api.admin.deleteCoupon);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CouponForm>(EMPTY);

  const handleSave = async () => {
    if (!form.code || form.discountPercent <= 0) {
      toast.error("Code and discount are required");
      return;
    }
    try {
      await upsert({
        ...(form.id ? { id: form.id as any } : {}),
        code: form.code,
        discountPercent: form.discountPercent,
        maxDiscount: form.maxDiscount,
        minOrder: form.minOrder,
        usageLimit: form.usageLimit,
        isActive: form.isActive,
        expiresAt: form.expiresAt,
      });
      toast.success(form.id ? "Coupon updated" : "Coupon created");
      setOpen(false);
      setForm(EMPTY);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this coupon?")) return;
    try {
      await deleteCoupon({ couponId: id as any });
      toast.success("Coupon deleted");
    } catch {
      toast.error("Could not delete coupon");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Coupons</h1>
            <p className="text-sm text-muted-foreground">{coupons?.length ?? 0} coupons</p>
          </div>
          <Button className="font-semibold" onClick={() => { setForm(EMPTY); setOpen(true); }}>
            <Plus className="size-4 mr-1" /> Add Coupon
          </Button>
        </div>

        {coupons === undefined ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : coupons.length === 0 ? (
          <div className="text-center py-12">
            <Ticket className="size-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No coupons yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {coupons.map((c) => {
              const expired = c.expiresAt < Date.now();
              return (
                <Card key={c._id} className="border-border/60">
                  <CardContent className="p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">{c.code}</span>
                        <Badge className="text-[10px] bg-primary/10 text-primary font-semibold">
                          {c.discountPercent}% OFF
                        </Badge>
                        {c.isActive && !expired && (
                          <Badge className="text-[10px] bg-green-100 text-green-800">Active</Badge>
                        )}
                        {expired && (
                          <Badge variant="outline" className="text-[10px] text-destructive">Expired</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Max discount: ₹{c.maxDiscount} · Min order: ₹{c.minOrder} · Used: {c.usedCount}/{c.usageLimit} · Expires:{" "}
                        {new Date(c.expiresAt).toLocaleDateString("en-IN")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setForm({
                            id: c._id,
                            code: c.code,
                            discountPercent: c.discountPercent,
                            maxDiscount: c.maxDiscount,
                            minOrder: c.minOrder,
                            usageLimit: c.usageLimit,
                            isActive: c.isActive,
                            expiresAt: c.expiresAt,
                          });
                          setOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(c._id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Coupon" : "Add Coupon"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Coupon Code *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="e.g. SAVE10"
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Discount (%) *</Label>
                <Input
                  type="number"
                  value={form.discountPercent || ""}
                  onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Max Discount (₹)</Label>
                <Input
                  type="number"
                  value={form.maxDiscount || ""}
                  onChange={(e) => setForm({ ...form, maxDiscount: Number(e.target.value) })}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Min Order (₹)</Label>
                <Input
                  type="number"
                  value={form.minOrder || ""}
                  onChange={(e) => setForm({ ...form, minOrder: Number(e.target.value) })}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Usage Limit</Label>
                <Input
                  type="number"
                  value={form.usageLimit || ""}
                  onChange={(e) => setForm({ ...form, usageLimit: Number(e.target.value) })}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Expires At</Label>
              <Input
                type="date"
                value={new Date(form.expiresAt).toISOString().split("T")[0]}
                onChange={(e) => setForm({ ...form, expiresAt: new Date(e.target.value).getTime() })}
                className="h-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label className="text-xs">Active</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" className="font-semibold" onClick={handleSave}>{form.id ? "Update" : "Create"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
