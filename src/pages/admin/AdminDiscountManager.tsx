import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import {
  BadgePercent,
  CalendarClock,
  CheckCircle2,
  EyeOff,
  Loader2,
  Percent,
  Pin,
  PinOff,
  Plus,
  Save,
  Search,
  Tag,
  Trash2} from "lucide-react";
import { toast } from "sonner";

/**
 * Product-state label + palette, one per engine status. The admin sees HOW each
 * product is priced: automatically by a rule, by an explicit override,
 * preserved at its explicit selling price, excluded, or out of consideration.
 */
const STATUS_META: Record<string, { label: string; className: string }> = {
  auto: { label: "Selected · promotion rule", className: "border-primary/20 bg-primary/5 text-primary" },
  override: { label: "Override rule", className: "border-violet-300 bg-violet-50 text-violet-700" },
  category: { label: "Category promotion", className: "border-sky-300 bg-sky-50 text-sky-700" },
  "manual-price": { label: "Explicit price (kept)", className: "border-emerald-300 bg-emerald-50 text-emerald-700" },
  excluded: { label: "Excluded", className: "border-amber-300 bg-amber-50 text-amber-700" },
  ineligible: { label: "Not discounted", className: "border-border bg-muted text-muted-foreground" },
};

type ProductState = {
  _id: string;
  name: string;
  manufacturer: string;
  categoryName: string;
  isActive: boolean;
  price: number;
  discountPrice: number | null;
  discountSource: string | null;
  status: string;
  label: string;
  effectivePercent: number;
  effectivePrice: number;
  listed: boolean;
};

const toLocalInput = (ms: number | null | undefined) =>
  ms ? new Date(ms - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

const fromLocalInput = (value: string) => {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : undefined;
};

export default function AdminDiscountManager() {
  const config = useQuery(api.discountHighlights.getConfig);
  const categories = useQuery(api.admin.listCategories);
  const saveConfig = useMutation(api.discountHighlights.setConfig);

  // ── Local editing state, loaded once from the saved config ──
  const [percentInput, setPercentInput] = useState("");
  const [engineActive, setEngineActive] = useState(true);
  const [autoEligible, setAutoEligible] = useState(false);
  const [startsAtInput, setStartsAtInput] = useState("");
  const [endsAtInput, setEndsAtInput] = useState("");
  const [manualIds, setManualIds] = useState<string[]>([]);
  const [excludedIds, setExcludedIds] = useState<string[]>([]);
  const [overridePercents, setOverridePercents] = useState<Record<string, string>>({});
  const [categoryRules, setCategoryRules] = useState<{ categoryId: string; discountPercent: string }[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState("");
  const [newRuleCategory, setNewRuleCategory] = useState("");
  const [newRulePercent, setNewRulePercent] = useState("");

  // Load the saved configuration once so background refreshes never clobber
  // what the admin is typing.
  useEffect(() => {
    if (config && !initialized) {
      setPercentInput(String(config.discountPercent));
      setEngineActive(config.isActive);
      setAutoEligible((config.autoEligibleFrom ?? 0) > 0);
      setStartsAtInput(toLocalInput(config.startsAt));
      setEndsAtInput(toLocalInput(config.endsAt));
      setManualIds(config.manualProductIds);
      setExcludedIds(config.excludedProductIds);
      setOverridePercents(
        Object.fromEntries(
          config.productOverrides.map((o) => [o.productId, String(o.discountPercent)]),
        ),
      );
      setCategoryRules(
        config.categoryRules.map((c) => ({
          categoryId: c.categoryId,
          discountPercent: String(c.discountPercent),
        })),
      );
      setInitialized(true);
    }
  }, [config, initialized]);

  const percent = Number(percentInput);
  const validPercent =
    percentInput.trim() !== "" && Number.isInteger(percent) && percent >= 1 && percent <= 99;

  const states = useMemo(() => (config?.productStates ?? []) as ProductState[], [config]);
  const statusCounts = config?.statusCounts ?? {};

  const filteredStates = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return states;
    return states.filter(
      (p: ProductState) =>
        p.name.toLowerCase().includes(term) ||
        p.manufacturer.toLowerCase().includes(term),
    );
  }, [states, search]);

  const dirtyOverride = (id: string) => overridePercents[id]?.trim() ?? "";

  const addCategoryRule = () => {
    if (!newRuleCategory) {
      toast.error("Choose a category first.");
      return;
    }
    const p = Number(newRulePercent);
    if (!Number.isInteger(p) || p < 1 || p > 99) {
      toast.error("Category percent must be a whole number from 1 to 99.");
      return;
    }
    if (categoryRules.some((r) => r.categoryId === newRuleCategory)) {
      toast.error("That category already has a promotion.");
      return;
    }
    setSaved(false);
    setCategoryRules((prev) => [...prev, { categoryId: newRuleCategory, discountPercent: newRulePercent }]);
    setNewRuleCategory("");
    setNewRulePercent("");
  };

  const handleSave = async () => {
    if (!validPercent) {
      toast.error("Enter a whole percentage between 1 and 99.");
      return;
    }
    const rulePercentBad = categoryRules.find(
      (r) => !Number.isInteger(Number(r.discountPercent)) || Number(r.discountPercent) < 1 || Number(r.discountPercent) > 99,
    );
    if (rulePercentBad) {
      toast.error("Every category promotion needs a whole percent between 1 and 99.");
      return;
    }
    const overrideBad = Object.entries(overridePercents).find(
      ([, v]) => v.trim() !== "" && (!Number.isInteger(Number(v)) || Number(v) < 1 || Number(v) > 99),
    );
    if (overrideBad) {
      toast.error("Every product override needs a whole percent between 1 and 99, or an empty value to remove it.");
      return;
    }
    const startsAt = fromLocalInput(startsAtInput);
    const endsAt = fromLocalInput(endsAtInput);
    if (startsAt && endsAt && endsAt < startsAt) {
      toast.error("The promotion end must be after its start.");
      return;
    }
    setSaving(true);
    try {
      await saveConfig({
        discountPercent: percent,
        manualProductIds: manualIds as never,
        isActive: engineActive,
        autoEligible,
        startsAt,
        endsAt,
        excludedProductIds: excludedIds as never,
        productOverrides: Object.entries(overridePercents)
          .filter(([, v]) => v.trim() !== "")
          .map(([productId, v]) => ({ productId: productId as never, discountPercent: Number(v) })),
        categoryRules: categoryRules.map((r) => ({
          categoryId: r.categoryId as never,
          discountPercent: Number(r.discountPercent),
        })),
      });
      setSaved(true);
      toast.success(
        `Promotion saved: ${engineActive ? "active" : "paused"}, ${percent}% on ${manualIds.length} selected product(s)${autoEligible ? ", new products auto-eligible" : ""}`,
      );
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save the discount rules");
    } finally {
      setSaving(false);
    }
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
            Discount engine
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure one promotion percent, then choose exactly which products
            receive it. Per-product overrides, category promotions and
            exclusions keep working as separate rules — nothing is discounted
            just for being active, and unselected products keep their own
            pricing.
          </p>
        </motion.div>

        {/* ── Rule priority card ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Tag className="size-4 text-primary" /> Which rule wins
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 text-xs">
                {[
                  ["1 · Exclusion", "excluded"],
                  ["2 · Product override", "override"],
                  ["3 · Explicit price kept", "manual-price"],
                  ["4 · Category promotion", "category"],
                  ["5 · Selected products", "auto"],
                ].map(([label]) => (
                  <Badge key={label} variant="outline" className="rounded-lg">{label}</Badge>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                One rule per product — never combined, so nothing is ever
                discounted twice. Prices always rebuild from the product's MRP.
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Default rule + promotion window ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Percent className="size-4 text-primary" /> Default discount rule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[160px_1fr] sm:items-end">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Promotion discount (%)</Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={99}
                    step={1}
                    value={percentInput}
                    onChange={(e) => { setPercentInput(e.target.value); setSaved(false); }}
                    className="rounded-xl"
                    placeholder="e.g. 20"
                  />
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>
                    Configures the rule only — it never applies to every active
                    product. Select in the table below exactly which products
                    receive it; everything else keeps its own pricing. The
                    homepage section advertises
                    {" "}<span className="font-semibold text-foreground">Minimum {validPercent ? percent : "—"}% Off</span>{" "}
                    and lists exactly those selected products.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border/60 bg-muted/30 p-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={engineActive}
                    onCheckedChange={(v) => { setEngineActive(v); setSaved(false); }}
                    id="engine-active"
                  />
                  <Label htmlFor="engine-active" className="text-xs font-medium cursor-pointer">
                    {engineActive ? "Promotion active" : "Promotion paused"}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={autoEligible}
                    onCheckedChange={(v) => { setAutoEligible(v); setSaved(false); }}
                    id="auto-eligible"
                  />
                  <Label htmlFor="auto-eligible" className="text-xs font-medium cursor-pointer">
                    Newly added products are auto-eligible {autoEligible ? "(on)" : "(off)"}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarClock className="size-4 text-muted-foreground" />
                  <Label className="text-xs text-muted-foreground">Starts</Label>
                  <Input
                    type="datetime-local"
                    value={startsAtInput}
                    onChange={(e) => { setStartsAtInput(e.target.value); setSaved(false); }}
                    className="h-8 w-44 rounded-lg text-xs"
                  />
                  <Label className="text-xs text-muted-foreground">Ends</Label>
                  <Input
                    type="datetime-local"
                    value={endsAtInput}
                    onChange={(e) => { setEndsAtInput(e.target.value); setSaved(false); }}
                    className="h-8 w-44 rounded-lg text-xs"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground w-full sm:w-auto">
                  Off by default: a new product gets no discount until you
                  select it. Switch it on and products added from that moment
                  are included automatically — existing products stay out.
                  A paused or expired window stops the configured and category
                  rules; overrides and explicit prices stay as they are.
                </p>
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
                    Enter a whole percentage between 1 and 99.
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

        {/* ── Category promotions ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Tag className="size-4 text-primary" /> Category promotions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                While the window is open, products in these categories get the
                category percent (overridden products keep their override).
              </p>

              {categoryRules.length > 0 && (
                <div className="space-y-2">
                  {categoryRules.map((r) => {
                    const catList = Array.isArray(categories) ? (categories as any[]) : [];
                    const name = catList.find((c) => c._id === r.categoryId)?.name ?? r.categoryId;
                    return (
                      <div key={r.categoryId} className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2">
                        <span className="text-sm font-medium flex-1 min-w-0 truncate">{name}</span>
                        <Input
                          type="number"
                          min={1}
                          max={99}
                          value={r.discountPercent}
                          onChange={(e) => {
                            setSaved(false);
                            setCategoryRules((prev) =>
                              prev.map((x) => (x.categoryId === r.categoryId ? { ...x, discountPercent: e.target.value } : x)),
                            );
                          }}
                          className="h-8 w-20 rounded-lg text-xs"
                        />
                        <span className="text-xs text-muted-foreground">% off</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => { setSaved(false); setCategoryRules((prev) => prev.filter((x) => x.categoryId !== r.categoryId)); }}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={newRuleCategory || undefined}
                  onValueChange={(v) => setNewRuleCategory(v)}
                >
                  <SelectTrigger className="h-9 w-56 rounded-xl">
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Array.isArray(categories) ? categories : []).map((c: any) => (
                      <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  placeholder="%"
                  value={newRulePercent}
                  onChange={(e) => setNewRulePercent(e.target.value)}
                  className="h-9 w-20 rounded-xl"
                />
                <Button size="sm" variant="outline" className="rounded-xl gap-1.5" onClick={addCategoryRule}>
                  <Plus className="size-3.5" /> Add rule
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Product states ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-border/60 rounded-2xl">
            <CardHeader>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Search className="size-4 text-primary" /> Products — how each one is priced
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="rounded-lg">
                  {config?.lineCounts?.auto ?? 0} in the homepage section ({config?.lineCounts?.manual ?? 0} selected)
                </Badge>
                <Badge variant="outline" className="rounded-lg">{statusCounts.auto ?? 0} selected</Badge>
                <Badge variant="outline" className="rounded-lg">{statusCounts.override ?? 0} override</Badge>
                <Badge variant="outline" className="rounded-lg">{statusCounts.category ?? 0} category</Badge>
                <Badge variant="outline" className="rounded-lg">{statusCounts["manual-price"] ?? 0} explicit price</Badge>
                <Badge variant="outline" className="rounded-lg">{statusCounts.excluded ?? 0} excluded</Badge>
                <Badge variant="outline" className="rounded-lg">{statusCounts.ineligible ?? 0} not discounted</Badge>
                {config && !config.windowOpen && (
                  <Badge variant="outline" className="rounded-lg border-amber-300 bg-amber-50 text-amber-700">
                    Promotion window closed
                  </Badge>
                )}
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products by name or manufacturer"
                  className="rounded-xl pl-9"
                />
              </div>

              {config === undefined ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="max-h-[28rem] overflow-y-auto rounded-xl border border-border/60">
                  {filteredStates.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No products match that search.
                    </p>
                  ) : (
                    filteredStates.map((p) => {
                      const meta = STATUS_META[p.status] ?? STATUS_META.ineligible;
                      const pinned = manualIds.includes(p._id);
                      const excluded = excludedIds.includes(p._id);
                      const overrideValue = dirtyOverride(p._id);
                      return (
                        <div
                          key={p._id}
                          className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/50 px-4 py-2.5 last:border-b-0"
                        >
                          <div className="min-w-0 flex-1 basis-56">
                            <p className="truncate text-sm font-medium text-foreground">
                              {p.name}
                              {p.listed && (
                                <span className="ml-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">on homepage</span>
                              )}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {p.categoryName} · {p.manufacturer}
                              {!p.isActive && " · inactive"}
                            </p>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={`rounded-lg text-[10px] ${meta.className}`}>
                              {meta.label}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              ₹{p.effectivePrice}
                              {p.effectivePercent > 0 && (
                                <span className="text-green-600"> · {p.effectivePercent}% off</span>
                              )}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              min={1}
                              max={99}
                              placeholder="override %"
                              value={overrideValue}
                              onChange={(e) => { setOverridePercents((prev) => ({ ...prev, [p._id]: e.target.value })); setSaved(false); }}
                              className="h-7 w-24 rounded-lg text-xs"
                              title="Set a product-specific override percent; clear it to remove the override"
                            />
                            <Button
                              size="icon"
                              variant={pinned ? "secondary" : "ghost"}
                              className="size-7"
                              title={pinned ? "Deselect from the promotion" : "Select this product for the promotion (also adds it to the homepage section)"}
                              onClick={() => { setSaved(false); setManualIds((prev) => (pinned ? prev.filter((x) => x !== p._id) : [...prev, p._id])); }}
                            >
                              {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                            </Button>
                            <Button
                              size="icon"
                              variant={excluded ? "secondary" : "ghost"}
                              className={`size-7 ${excluded ? "text-amber-700" : "text-muted-foreground"}`}
                              title={excluded ? "Remove the exclusion" : "Exclude from all automatic discounts"}
                              onClick={() => { setSaved(false); setExcludedIds((prev) => (excluded ? prev.filter((x) => x !== p._id) : [...prev, p._id])); }}
                            >
                              {excluded ? <EyeOff className="size-3.5" /> : <EyeOff className="size-3.5 opacity-40" />}
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={saving || !validPercent}
                  className="gradient-primary text-white rounded-xl gap-2"
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {saving ? "Saving…" : "Save configuration"}
                </Button>
                {overridePercents && Object.values(overridePercents).some((v) => v.trim() === "") && (
                  <span className="text-xs text-muted-foreground">
                    Clearing an override percent removes that override on save.
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  Saved settings persist after a refresh or a new sign-in, and every change is written to the audit log.
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </AdminLayout>
  );
}
