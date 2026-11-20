import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Crown,
  IndianRupee,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/auth-utils";

type Plan = {
  _id: Id<"membership_plans">;
  name: string;
  description: string;
  price: number;
  durationDays: number;
  benefits: string[];
  restrictions: string[];
  isActive: boolean;
  sortOrder: number;
  highlight?: boolean;
};

type PlanForm = {
  name: string;
  description: string;
  price: string;
  durationDays: string;
  benefits: string;
  restrictions: string;
  isActive: boolean;
  sortOrder: string;
  highlight: boolean;
};

const EMPTY_FORM: PlanForm = {
  name: "",
  description: "",
  price: "0",
  durationDays: "365",
  benefits: "",
  restrictions: "",
  isActive: true,
  sortOrder: "0",
  highlight: false,
};

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminMemberships() {
  const plans = useQuery(api.adminMemberships.listPlans);
  const members = useQuery(api.adminMemberships.listMembers);
  const analytics = useQuery(api.adminMemberships.getAnalytics);
  const createPlan = useMutation(api.adminMemberships.createPlan);
  const updatePlan = useMutation(api.adminMemberships.updatePlan);
  const togglePlan = useMutation(api.adminMemberships.togglePlan);
  const removePlan = useMutation(api.adminMemberships.removePlan);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(plan: Plan) {
    setEditing(plan);
    setForm({
      name: plan.name,
      description: plan.description,
      price: String(plan.price),
      durationDays: String(plan.durationDays),
      benefits: plan.benefits.join("\n"),
      restrictions: plan.restrictions.join("\n"),
      isActive: plan.isActive,
      sortOrder: String(plan.sortOrder),
      highlight: plan.highlight ?? false,
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (form.name.trim().length < 2) {
      toast.error("Enter a plan name.");
      return;
    }
    const price = Number(form.price);
    const durationDays = Number(form.durationDays);
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Enter a valid price.");
      return;
    }
    if (!Number.isInteger(durationDays) || durationDays < 1) {
      toast.error("Enter a valid duration in days.");
      return;
    }
    const benefits = form.benefits
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean);
    if (benefits.length === 0) {
      toast.error("Add at least one benefit.");
      return;
    }
    const restrictions = form.restrictions
      .split("\n")
      .map((r) => r.trim())
      .filter(Boolean);

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        price,
        durationDays,
        benefits,
        restrictions,
        isActive: form.isActive,
        sortOrder: Number(form.sortOrder) || 0,
        highlight: form.highlight,
      };
      if (editing) {
        await updatePlan({ planId: editing._id, ...payload });
        toast.success("Membership plan updated");
      } else {
        await createPlan(payload);
        toast.success("Membership plan created");
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Could not save the plan");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await removePlan({ planId: deleteTarget._id });
      toast.success("Membership plan deleted");
      setDeleteTarget(null);
    } catch (error: any) {
      toast.error(error?.message || "Could not delete the plan");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Crown className="size-6 text-primary" /> Membership
            </h1>
            <p className="text-sm text-muted-foreground">
              Plans, benefits, active members and purchase revenue.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="size-4" /> New plan
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Active members", value: analytics?.activeMembers ?? 0, icon: Users },
            {
              label: "Membership revenue",
              value: formatCurrency(analytics?.revenue ?? 0),
              icon: IndianRupee,
            },
            { label: "Paid purchases", value: analytics?.paidPurchases ?? 0, icon: TrendingUp },
            { label: "Expiring in 30 days", value: analytics?.expiringSoon ?? 0, icon: Crown },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/[0.07]">
                  <stat.icon className="size-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xl font-bold leading-none">{stat.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plans</CardTitle>
          </CardHeader>
          <CardContent>
            {plans === undefined ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : plans.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Crown className="size-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">
                  No membership plans yet. Create the first plan to make Membership available.
                </p>
                <Button className="mt-3" onClick={openCreate}>
                  <Plus className="size-4" /> New plan
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {(plans as Plan[]).map((plan) => (
                  <div
                    key={plan._id}
                    className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{plan.name}</p>
                        <Badge variant={plan.isActive ? "secondary" : "outline"}>
                          {plan.isActive ? "Active" : "Inactive"}
                        </Badge>
                        {plan.highlight && <Badge>Highlighted</Badge>}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{plan.description}</p>
                      <p className="mt-1 text-sm font-semibold">
                        {plan.price === 0 ? "Free" : formatCurrency(plan.price)}
                        <span className="ml-1 text-xs font-normal text-muted-foreground">
                          / {plan.durationDays} days
                        </span>
                      </p>
                      <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                        {plan.benefits.join(" · ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground">Active</span>
                        <Switch
                          checked={plan.isActive}
                          onCheckedChange={async (checked) => {
                            try {
                              await togglePlan({ planId: plan._id, isActive: checked });
                            } catch (error: any) {
                              toast.error(error?.message || "Could not update the plan");
                            }
                          }}
                        />
                      </div>
                      <Button variant="ghost" size="icon" aria-label="Edit plan" onClick={() => openEdit(plan)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete plan"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(plan)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Active members</CardTitle>
            </CardHeader>
            <CardContent>
              {(members ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No active members yet.</p>
              ) : (
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {(members ?? []).map((member) => (
                    <div key={member._id} className="rounded-xl border border-border/60 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{member.customerName}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {member.customerEmail}
                          </p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 text-[10px]">
                          {member.planName}
                        </Badge>
                      </div>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        Expires {formatDate(member.expiresAt)} · {member.daysRemaining} days left
                        {member.amount > 0 ? ` · ${formatCurrency(member.amount)}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Members by plan</CardTitle>
            </CardHeader>
            <CardContent>
              {(analytics?.byPlan ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No active memberships yet.</p>
              ) : (
                <div className="space-y-3">
                  {(analytics?.byPlan ?? []).map((row) => {
                    const max = Math.max(...(analytics?.byPlan ?? []).map((r) => r.members), 1);
                    return (
                      <div key={row.planName}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium">{row.planName}</span>
                          <span className="text-muted-foreground">
                            {row.members} members · {formatCurrency(row.revenue)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${(row.members / max) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit membership plan" : "New membership plan"}</DialogTitle>
            <DialogDescription>
              Prices, benefits and restrictions are configured here and validated server-side.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="plan-name">Plan name</Label>
              <Input
                id="plan-name"
                value={form.name}
                maxLength={40}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Gold"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-description">Description</Label>
              <Input
                id="plan-description"
                value={form.description}
                maxLength={500}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Short description shown on the membership page"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="plan-price">Price (₹)</Label>
                <Input
                  id="plan-price"
                  type="number"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
                <p className="text-[11px] text-muted-foreground">0 activates without payment.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-duration">Duration (days)</Label>
                <Input
                  id="plan-duration"
                  type="number"
                  min="1"
                  max="3650"
                  value={form.durationDays}
                  onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-benefits">Benefits (one per line)</Label>
              <Textarea
                id="plan-benefits"
                rows={4}
                value={form.benefits}
                onChange={(e) => setForm({ ...form, benefits: e.target.value })}
                placeholder={"Exclusive member discounts\nFree delivery on eligible orders\nBirthday reward"}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-restrictions">Restrictions / notes (one per line)</Label>
              <Textarea
                id="plan-restrictions"
                rows={2}
                value={form.restrictions}
                onChange={(e) => setForm({ ...form, restrictions: e.target.value })}
                placeholder={"Excludes prescription medicines\nDiscounts apply to eligible categories only"}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="plan-sort">Display order</Label>
                <Input
                  id="plan-sort"
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
                />
              </div>
              <div className="space-y-3 pt-5">
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                  />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={form.highlight}
                    onCheckedChange={(checked) => setForm({ ...form, highlight: checked })}
                  />
                  Highlight as popular
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Plans with purchases cannot be deleted. Deactivate them instead so existing
              memberships stay valid.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-1 size-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
