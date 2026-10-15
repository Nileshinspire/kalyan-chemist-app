import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import {
  BadgePercent,
  CheckCircle2,
  Loader2,
  Percent,
  Plus,
  Save,
  Search,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { productDiscountPercent } from "@/lib/discount";

/* ─── Discount Manager ───
 * Sets the ONE percentage the homepage "Minimum N% Off" section advertises.
 *
 * The admin can type any whole percentage, and the list below shows what the
 * homepage will show for that value BEFORE saving: every product whose own
 * calculated discount (price vs discountPrice) is exactly that percentage.
 * Hand-picked products are stored too, but they only render while their real
 * discount still matches, which is why a pick that no longer qualifies is
 * marked as hidden rather than counted.
 *
 * Reads/writes go through `api.discountHighlights` — the same table the
 * storefront section reads — and the write is admin-only on the server.
 */
export default function AdminDiscountManager() {
  const config = useQuery(api.discountHighlights.getConfig);
  const products = useQuery(api.adminProducts.list, {
    sortBy: "name",
    sortOrder: "asc",
  });
  const saveConfig = useMutation(api.discountHighlights.setConfig);

  const [percentInput, setPercentInput] = useState("");
  const [manualIds, setManualIds] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");

  // Load the saved configuration once, so a background refresh of the query
  // never overwrites what the admin is currently typing.
  useEffect(() => {
    if (config && !initialized) {
      setPercentInput(String(config.discountPercent));
      setManualIds(config.manualProductIds);
      setInitialized(true);
    }
  }, [config, initialized]);

  const percent = Number(percentInput);
  const validPercent =
    percentInput.trim() !== "" &&
    Number.isInteger(percent) &&
    percent >= 1 &&
    percent <= 100;

  const rows = useMemo(() => products ?? [], [products]);

  // Exactly the rule the storefront section applies: an active product whose
  // real, rounded discount equals the configured percentage.
  const matching = useMemo(
    () =>
      rows.filter(
        (p: any) =>
          p.isActive && productDiscountPercent(p.price, p.discountPrice) === percent,
      ),
    [rows, percent],
  );

  const manualRows = useMemo(
    () => manualIds.map((id) => rows.find((p: any) => p._id === id)).filter(Boolean) as any[],
    [manualIds, rows],
  );
  const manualHidden = manualRows.filter(
    (p) => !p.isActive || productDiscountPercent(p.price, p.discountPrice) !== percent,
  );

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (p: any) =>
        p.name.toLowerCase().includes(term) ||
        (p.manufacturer ?? "").toLowerCase().includes(term) ||
        (p.categoryName ?? "").toLowerCase().includes(term),
    );
  }, [rows, search]);

  const toggleManual = (id: string) => {
    setSaved(false);
    setManualIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    if (!validPercent) {
      toast.error("Enter a whole percentage between 1 and 100.");
      return;
    }
    setSaving(true);
    try {
      await saveConfig({
        discountPercent: percent,
        manualProductIds: manualIds as any,
      });
      setSaved(true);
      toast.success(`Homepage discount set to exactly ${percent}%`);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save the discount");
    } finally {
      setSaving(false);
    }
  };

  const discountLabel = (p: any) => {
    const pct = productDiscountPercent(p.price, p.discountPrice);
    return pct > 0 ? `${pct}% off` : "No discount";
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
            <BadgePercent className="size-3" />
            Discount Manager
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Exact Discount Deals
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose the exact discount percentage the homepage section advertises.
            Products are discovered automatically from their real price and MRP —
            no product list to maintain.
          </p>
        </motion.div>

        {/* ── The configured percentage ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Percent className="size-4 text-primary" /> Discount percentage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[200px_1fr] sm:items-end">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Exact discount (%)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={100}
                    step={1}
                    value={percentInput}
                    onChange={(e) => {
                      setPercentInput(e.target.value);
                      setSaved(false);
                    }}
                    className="rounded-xl"
                    placeholder="e.g. 37"
                  />
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    Any whole number from 1 to 100. A product is eligible only when
                    its own calculated discount is exactly this value — 24%, 26% and
                    30% off products are never shown for 25%.
                  </p>
                  <p>
                    Current homepage heading:{" "}
                    <span className="font-semibold text-foreground">
                      Minimum {validPercent ? percent : "—"}% Off
                    </span>
                    {config && !config.configured && (
                      <span className="ml-1">
                        (showing the 50% default until you save a value)
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleSave}
                  disabled={saving || !validPercent}
                  className="gradient-primary text-white rounded-xl gap-2"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {saving ? "Saving…" : "Save configuration"}
                </Button>
                {saved && (
                  <motion.span
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-1.5 text-sm text-green-600"
                  >
                    <CheckCircle2 className="size-4" /> Saved
                  </motion.span>
                )}
                {percentInput.trim() !== "" && !validPercent && (
                  <p className="text-sm text-destructive">
                    Enter a whole percentage between 1 and 100.
                  </p>
                )}
                {config?.updatedAt && (
                  <span className="text-xs text-muted-foreground">
                    Last saved {new Date(config.updatedAt).toLocaleString()}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── What the homepage will show ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Tag className="size-4 text-primary" /> Products at exactly{" "}
                {validPercent ? percent : "—"}% off
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3 text-xs">
                <Badge variant="outline" className="rounded-lg">
                  {matching.length} product{matching.length === 1 ? "" : "s"} will show
                </Badge>
                <Badge variant="outline" className="rounded-lg">
                  {matching.length - manualRows.filter((p) => matching.some((m: any) => m._id === p._id)).length} found automatically
                </Badge>
                <Badge variant="outline" className="rounded-lg">
                  {manualRows.filter((p) => matching.some((m: any) => m._id === p._id)).length} from your manual selection
                </Badge>
              </div>

              {matching.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border/70 bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
                  No product is at exactly {validPercent ? `${percent}%` : "that"} off right now, so the
                  homepage shows its empty state. Set a product's selling price to
                  match this percentage, or change the percentage above.
                </p>
              ) : (
                <div className="max-h-80 overflow-y-auto rounded-xl border border-border/60">
                  {matching.map((p: any) => (
                    <div
                      key={p._id}
                      className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-2.5 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.categoryName} · {p.manufacturer}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-semibold text-foreground">
                          ₹{p.discountPrice ?? p.price}{" "}
                          <span className="font-normal text-muted-foreground line-through">
                            ₹{p.price}
                          </span>
                        </p>
                        <p className="text-[11px] text-green-600">{discountLabel(p)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {manualHidden.length > 0 && (
                <p className="text-xs text-amber-600">
                  {manualHidden.length} of your selected product
                  {manualHidden.length === 1 ? " is" : "s are"} hidden because the real
                  discount is not {validPercent ? `${percent}%` : "the configured value"}{" "}
                  right now: {manualHidden.map((p: any) => `${p.name} (${discountLabel(p)})`).join(", ")}
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Manual selection ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Plus className="size-4 text-primary" /> Manually selected products
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Adding a product here keeps it in the section as long as its real
                discount stays exactly{" "}
                {validPercent ? `${percent}%` : "the configured percentage"}. If its price
                changes, it drops out automatically instead of showing a wrong
                discount.
              </p>

              {manualRows.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {manualRows.map((p) => {
                    const hidden = manualHidden.some((h) => h._id === p._id);
                    return (
                      <span
                        key={p._id}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
                          hidden
                            ? "border-amber-300 bg-amber-50 text-amber-700"
                            : "border-primary/20 bg-primary/5 text-primary"
                        }`}
                      >
                        {p.name}
                        <span className="text-[10px] opacity-80">({discountLabel(p)})</span>
                        <button
                          type="button"
                          aria-label={`Remove ${p.name}`}
                          className="rounded-full p-0.5 hover:bg-black/5"
                          onClick={() => toggleManual(p._id)}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products by name, manufacturer or category"
                  className="rounded-xl pl-9"
                />
              </div>

              <div className="max-h-96 overflow-y-auto rounded-xl border border-border/60">
                {filteredRows.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No products match that search.
                  </p>
                ) : (
                  filteredRows.map((p: any) => {
                    const selected = manualIds.includes(p._id);
                    const pct = productDiscountPercent(p.price, p.discountPrice);
                    const qualifies = p.isActive && pct === percent;
                    return (
                      <div
                        key={p._id}
                        className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-2.5 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {p.categoryName} · ₹{p.discountPrice ?? p.price} / ₹{p.price} ·{" "}
                            {discountLabel(p)}
                            {!p.isActive && " · inactive"}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant={selected ? "secondary" : "outline"}
                          className="shrink-0 rounded-lg text-xs"
                          onClick={() => toggleManual(p._id)}
                        >
                          {selected ? (
                            <>
                              <X className="size-3 mr-1" /> Remove
                            </>
                          ) : (
                            <>
                              <Plus className="size-3 mr-1" /> Add
                            </>
                          )}
                        </Button>
                        {selected && !qualifies && (
                          <span className="shrink-0 text-[11px] text-amber-600">
                            Hidden at {validPercent ? `${percent}%` : "this value"}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={saving || !validPercent}
                  className="gradient-primary text-white rounded-xl gap-2"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {saving ? "Saving…" : "Save configuration"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  Saved settings stay in place after a refresh or a new sign-in.
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AdminLayout>
  );
}
