import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CalendarClock,
  Check,
  Loader2,
  Package,
  Repeat,
  ShoppingCart,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { daysUntil, isRefillApproaching } from "@/convex/refillSuggestionCore";

type SuggestionRow = {
  productId: string;
  lastOrderAt: number;
  orderCount: number;
  hasManualReminder: boolean;
  product: {
    _id: string;
    name: string;
    slug: string;
    imageUrl: string | null;
    manufacturer: string;
    packSize: string;
    strength: string | null;
    price: number;
    discountPrice: number | null;
    stockQuantity: number;
    prescriptionRequired: boolean;
    isActive: boolean;
    expiryDate: number | null;
  };
  suggestion: {
    _id: string;
    status: "enabled" | "dismissed" | "completed";
    intervalDays?: number;
    expectedDate?: number;
    nextReminderAt?: number;
    lastNotifiedAt?: number;
  } | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** Only prompt for medicines whose last delivery is old enough to plausibly be
 *  running low. This is time-since-order, not an assumed dosage. */
const PROMPT_AFTER_DAYS = 14;

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toDateInput(ts: number) {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Proactive refill suggestions.
 *
 * Deliberately additive: it never edits an existing manual refill reminder and
 * hides itself for products that already have one. Every interval/date comes
 * from the customer; nothing is inferred from the medicine or its dosage.
 */
export function RefillSuggestions() {
  const navigate = useNavigate();
  const rows = useQuery(api.refillSuggestions.list, {});
  const enable = useMutation(api.refillSuggestions.enable);
  const dismiss = useMutation(api.refillSuggestions.dismiss);
  // Reorder goes through the same cart mutation the product page uses.
  const addToCart = useMutation(api.cart.addItem);

  const [dialogRow, setDialogRow] = useState<SuggestionRow | null>(null);
  const [mode, setMode] = useState<"interval" | "date">("interval");
  const [intervalDays, setIntervalDays] = useState("30");
  const [expectedDate, setExpectedDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyProduct, setBusyProduct] = useState<string | null>(null);
  const now = Date.now();

  const { enabled, candidates } = useMemo(() => {
    const all = (rows ?? []) as unknown as SuggestionRow[];
    const enabledRows: SuggestionRow[] = [];
    const candidateRows: SuggestionRow[] = [];

    for (const row of all) {
      if (row.suggestion?.status === "dismissed") continue;
      if (row.hasManualReminder) {
        // Already covered by the existing Refill Reminders section — never show
        // a second, competing reminder for the same medicine.
        continue;
      }
      if (row.suggestion?.status === "enabled") {
        enabledRows.push(row);
        continue;
      }
      if (
        row.product.isActive &&
        now - row.lastOrderAt >= PROMPT_AFTER_DAYS * DAY_MS
      ) {
        candidateRows.push(row);
      }
    }

    enabledRows.sort(
      (a, b) => (a.suggestion?.nextReminderAt ?? 0) - (b.suggestion?.nextReminderAt ?? 0),
    );
    return { enabled: enabledRows, candidates: candidateRows.slice(0, 6) };
  }, [rows, now]);

  function openDialog(row: SuggestionRow) {
    const existing = row.suggestion;
    setDialogRow(row);
    if (existing?.expectedDate) {
      setMode("date");
      setExpectedDate(toDateInput(existing.expectedDate));
      setIntervalDays(existing.intervalDays ? String(existing.intervalDays) : "30");
    } else {
      setMode("interval");
      setIntervalDays(existing?.intervalDays ? String(existing.intervalDays) : "30");
      setExpectedDate(
        existing?.nextReminderAt ? toDateInput(existing.nextReminderAt) : "",
      );
    }
  }

  async function handleSave() {
    if (!dialogRow) return;
    const productId = dialogRow.product._id as Id<"products">;

    let payload: { productId: Id<"products">; intervalDays?: number; expectedDate?: number };
    if (mode === "interval") {
      const days = Number(intervalDays);
      if (!Number.isInteger(days) || days < 1 || days > 365) {
        toast.error("Enter a whole number of days between 1 and 365.");
        return;
      }
      payload = { productId, intervalDays: days };
    } else {
      if (!expectedDate) {
        toast.error("Choose the date you expect to need this medicine.");
        return;
      }
      const ts = new Date(`${expectedDate}T00:00:00`).getTime();
      if (!Number.isFinite(ts) || ts < new Date().setHours(0, 0, 0, 0)) {
        toast.error("Choose today or a future date.");
        return;
      }
      payload = { productId, expectedDate: ts };
    }

    setSaving(true);
    try {
      await enable(payload);
      toast.success("Refill reminder saved");
      setDialogRow(null);
    } catch (error: any) {
      toast.error(error?.message ?? "Could not save the refill reminder");
    } finally {
      setSaving(false);
    }
  }

  async function handleDismiss(row: SuggestionRow) {
    setBusyProduct(row.productId);
    try {
      await dismiss({ productId: row.product._id as Id<"products"> });
      toast.success("Refill suggestion dismissed");
    } catch (error: any) {
      toast.error(error?.message ?? "Could not dismiss the suggestion");
    } finally {
      setBusyProduct(null);
    }
  }

  async function handleReorder(row: SuggestionRow) {
    setBusyProduct(row.productId);
    try {
      await addToCart({ productId: row.product._id as Id<"products">, quantity: 1 });
      toast.success(
        row.product.prescriptionRequired
          ? "Added to cart — this medicine needs a prescription at checkout."
          : `${row.product.name} added to your cart`,
      );
      navigate("/cart");
    } catch (error: any) {
      toast.error(error?.message ?? "Could not add this medicine to your cart");
    } finally {
      setBusyProduct(null);
    }
  }

  // Nothing to show for a customer with no delivered orders and no reminders.
  if (rows !== undefined && enabled.length === 0 && candidates.length === 0) {
    return null;
  }

  if (rows === undefined) {
    return (
      <section>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
          <Sparkles className="size-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">Proactive Refill Reminders</h2>
          <p className="text-sm text-muted-foreground">
            Based on your delivered orders — you confirm the interval. Separate from your
            existing refill reminders.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {enabled.map((row) => {
          const product = row.product;
          const dueAt = row.suggestion?.nextReminderAt;
          const isDue = dueAt !== undefined && dueAt <= now;
          const approaching = isRefillApproaching(dueAt, now);
          const available =
            product.isActive &&
            product.stockQuantity > 0 &&
            !(product.expiryDate && product.expiryDate <= now);

          return (
            <Card key={row.productId} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted/60">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt=""
                        className="size-full object-contain p-1"
                        loading="lazy"
                      />
                    ) : (
                      <Package className="size-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{product.name}</h3>
                      {product.prescriptionRequired && (
                        <Badge variant="outline" className="text-[10px] text-amber-700">
                          Rx required
                        </Badge>
                      )}
                      {isDue ? (
                        <Badge className="border-0 bg-rose-50 text-[10px] text-rose-700">
                          Due now
                        </Badge>
                      ) : approaching ? (
                        <Badge className="border-0 bg-amber-50 text-[10px] text-amber-700">
                          Due soon
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {product.strength ? `${product.strength} · ` : ""}
                      {product.packSize} · {formatCurrency(product.discountPrice ?? product.price)}
                    </p>
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-foreground">
                      <CalendarClock className="size-3.5 text-muted-foreground" />
                      {dueAt !== undefined
                        ? isDue
                          ? `Refill was due on ${formatDate(dueAt)}`
                          : `Next reminder on ${formatDate(dueAt)} (in ${Math.max(
                              0,
                              daysUntil(dueAt, now),
                            )} day${daysUntil(dueAt, now) === 1 ? "" : "s"})`
                        : "One-time reminder completed"}
                      {row.suggestion?.intervalDays
                        ? ` · every ${row.suggestion.intervalDays} days`
                        : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Last delivered order {formatDate(row.lastOrderAt)} ·{" "}
                      {row.orderCount} order{row.orderCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:shrink-0">
                    <Button
                      size="sm"
                      className="h-8 gap-1.5 text-xs gradient-primary text-white"
                      disabled={!available || busyProduct === row.productId}
                      onClick={() => handleReorder(row)}
                      title={available ? undefined : "Currently out of stock"}
                    >
                      {busyProduct === row.productId ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <ShoppingCart className="size-3.5" />
                      )}
                      {available ? "Reorder" : "Out of stock"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => openDialog(row)}
                    >
                      <Repeat className="size-3.5" /> Adjust
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 gap-1 px-2 text-xs text-muted-foreground"
                      disabled={busyProduct === row.productId}
                      onClick={() => handleDismiss(row)}
                    >
                      <X className="size-3.5" /> Dismiss
                    </Button>
                  </div>
                </div>
                {product.prescriptionRequired && (
                  <p className="mt-2 text-[11px] text-amber-700">
                    Prescription required — pharmacist verification still applies at checkout.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}

        {candidates.length > 0 && (
          <div className="space-y-2">
            {candidates.map((row) => (
              <Card key={row.productId} className="border-dashed border-border/70">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-foreground">{row.product.name}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Last delivered {formatDate(row.lastOrderAt)}. Choose when you expect to
                      need it again — we won&apos;t guess.
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => openDialog(row)}
                    >
                      <Repeat className="size-3.5" /> Set refill reminder
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs text-muted-foreground"
                      disabled={busyProduct === row.productId}
                      onClick={() => handleDismiss(row)}
                      aria-label={`Dismiss ${row.product.name}`}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={Boolean(dialogRow)} onOpenChange={(open) => !open && setDialogRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Refill reminder for {dialogRow?.product.name}</DialogTitle>
            <DialogDescription>
              Confirm when you expect to need this medicine again. This is separate from
              any existing refill reminder.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={mode === "interval" ? "default" : "outline"}
                size="sm"
                className="h-auto py-2.5 text-xs"
                onClick={() => setMode("interval")}
              >
                Repeat every N days
              </Button>
              <Button
                type="button"
                variant={mode === "date" ? "default" : "outline"}
                size="sm"
                className="h-auto py-2.5 text-xs"
                onClick={() => setMode("date")}
              >
                On a specific date
              </Button>
            </div>

            {mode === "interval" ? (
              <div className="space-y-2">
                <Label htmlFor="refill-interval">Remind me every</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="refill-interval"
                    type="number"
                    min={1}
                    max={365}
                    value={intervalDays}
                    onChange={(e) => setIntervalDays(e.target.value)}
                    className="max-w-[120px]"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Counted from your last delivered order. Minimum 1 day, maximum 365.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="refill-date">Expected refill date</Label>
                <Input
                  id="refill-date"
                  type="date"
                  value={expectedDate}
                  min={toDateInput(Date.now())}
                  onChange={(e) => setExpectedDate(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  You&apos;ll get one website notification on this date.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogRow(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2 gradient-primary text-white">
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              Save reminder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
