import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/context/AuthContext";
import { useSetBreadcrumb } from "@/hooks/useBreadcrumb";
import type { Id } from "@/convex/_generated/dataModel";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/auth-utils";
import {
  Pill,
  Clock,
  RefreshCw,
  ShoppingCart,
  Trash2,
  Bell,
  CalendarClock,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Package,
  Stethoscope,
  Loader2,
} from "lucide-react";

export default function MedicineRefill() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useSetBreadcrumb(
    { label: "Medicine Refill" },
    [{ label: "Home", href: "/" }, { label: "Medicine Refill" }]
  );



  // Backend data
  const regularMedicines = useQuery(api.refills.listRegularMedicines);
  const suggestions = useQuery(api.refills.getSuggestionsFromOrders);
  const deliveredOrders = useQuery(api.refills.getDeliveredOrderMedicines);
  const reminders = useQuery(api.refills.listReminders);
  const refillRequests = useQuery(api.refills.listMyRefillRequests);
  const orderHistory = useQuery(api.refills.getOrderHistory);

  // Mutations
  const saveRegularMedicine = useMutation(api.refills.saveRegularMedicine);
  const removeRegularMedicine = useMutation(api.refills.removeRegularMedicine);
  const createReminder = useMutation(api.refills.createReminder);
  const removeReminder = useMutation(api.refills.removeReminder);
  const addToCart = useMutation(api.refills.addToCart);
  const createRefillRequest = useMutation(api.refills.createRefillRequest);
  const postponeReminder = useMutation(api.refills.postponeReminder);
  const reminderHistory = useQuery(api.refills.getReminderHistory);

  // Per-medicine activity timeline built from existing data
  const [timelineProductId, setTimelineProductId] = useState<string | null>(null);
  const medicineTimeline = useMemo(() => {
    if (!timelineProductId) return [];
    const events: { type: string; label: string; date: number; detail?: string }[] = [];
    // Orders
    for (const h of orderHistory || []) {
      if (h.productId !== timelineProductId) continue;
      events.push({
        type: "order",
        label: h.orderStatus === "delivered" ? "Order Delivered" : "Order Placed",
        date: h.orderDate,
        detail: `Qty: ${h.quantity}`,
      });
    }
    // Reminders
    for (const r of reminders || []) {
      if (r.productId !== (timelineProductId as any)) continue;
      events.push({ type: "reminder_set", label: "Reminder Set", date: r.createdAt, detail: `Every ${r.intervalDays} days` });
      if (r.lastReminderAt > r.createdAt) {
        events.push({ type: "reminder_sent", label: "Reminder Sent", date: r.lastReminderAt });
      }
    }
    // Refill requests containing this product
    for (const req of refillRequests || []) {
      if (!req.medicines.some((m) => m.productId === timelineProductId)) continue;
      events.push({ type: "refill", label: "Customer Refilled", date: req.createdAt, detail: req.status });
    }
    return events.sort((a, b) => b.date - a.date);
  }, [timelineProductId, orderHistory, reminders, refillRequests]);

  // UI state
  const [selectedForRefill, setSelectedForRefill] = useState<Set<Id<"products">>>(new Set());
  const [reminderModal, setReminderModal] = useState<{ productId: Id<"products">; name: string } | null>(null);
  const [reminderDays, setReminderDays] = useState(30);
  const [customDays, setCustomDays] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);
  // Per-item quantity overrides for regular medicines (keyed by productId)
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const getQuantity = (productId: string, suggested: number) => quantities[productId] ?? suggested;
  const setQuantity = (productId: string, qty: number) => setQuantities((p) => ({ ...p, [productId]: Math.max(1, qty) }));
  // Previously-ordered section: which products are shown as regular candidates
  const [previouslyOrderedExpanded, setPreviouslyOrderedExpanded] = useState(true);

  // Expanded detail views
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<string | null>(null);
  const [selectedReminderDetail, setSelectedReminderDetail] = useState<string | null>(null);
  const [selectedOrderItem, setSelectedOrderItem] = useState<string | null>(null);

  // Compute refill-due-soon based on smart order history analysis
  const refillDueSoon = useMemo(() => {
    if (!deliveredOrders) return [];
    return deliveredOrders.filter(
      (item) => item.refillStatus === "due" || item.refillStatus === "soon"
    );
  }, [deliveredOrders]);

  const refillDueCount = useMemo(
    () => refillDueSoon.filter((i) => i.refillStatus === "due").length,
    [refillDueSoon]
  );
  const refillSoonCount = useMemo(
    () => refillDueSoon.filter((i) => i.refillStatus === "soon").length,
    [refillDueSoon]
  );

  // Combine regular medicines with delivered orders for full view
  const allRegularItems = useMemo(() => {
    if (!regularMedicines || !deliveredOrders) return [];

    // Start with manually saved regulars
    const items = regularMedicines.map((r) => ({
      ...r,
      source: r.source,
      daysSinceLastOrder: r.createdAt
        ? Math.floor((Date.now() - r.createdAt) / (24 * 60 * 60 * 1000))
        : 0,
    }));

    return items;
  }, [regularMedicines, deliveredOrders]);

  const toggleSelect = (productId: Id<"products">) => {
    setSelectedForRefill((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!regularMedicines) return;
    const available = regularMedicines.filter(
      (r) => r.product && (r.product as any).isActive && (r.product as any).stockQuantity > 0
    );
    setSelectedForRefill(new Set(available.map((r) => r.productId)));
  };

  const deselectAll = () => setSelectedForRefill(new Set());

  const handleSaveAsRegular = async (productId: Id<"products">, name: string) => {
    try {
      setSavingId(productId);
      await saveRegularMedicine({ productId, suggestedQuantity: 1 });
      toast.success(`${name} saved as regular medicine`);
    } catch (error: any) {
      toast.error(error.message || "Failed to save");
    } finally {
      setSavingId(null);
    }
  };

  const handleRemoveRegular = async (id: Id<"regular_medicines">) => {
    try {
      await removeRegularMedicine({ regularMedicineId: id });
      toast.success("Removed from regular medicines");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove");
    }
  };

  const handleSetReminder = async () => {
    if (!reminderModal) return;
    const days = customDays ? parseInt(customDays) : reminderDays;
    if (isNaN(days) || days < 7) {
      toast.error("Minimum interval is 7 days");
      return;
    }
    try {
      await createReminder({
        productId: reminderModal.productId as any,
        intervalDays: days,
      });
      toast.success(`Reminder set for every ${days} days`);
      setReminderModal(null);
      setCustomDays("");
    } catch (error: any) {
      toast.error(error.message || "Failed to create reminder");
    }
  };

  const handleRemoveReminder = async (id: Id<"refill_reminders">) => {
    try {
      await removeReminder({ reminderId: id });
      toast.success("Reminder removed");
    } catch (error: any) {
      toast.error(error.message || "Failed to remove");
    }
  };

  const handlePostponeReminder = async (id: Id<"refill_reminders">, extraDays: number) => {
    try {
      await postponeReminder({ reminderId: id, extraDays });
      toast.success(`Reminder postponed by ${extraDays} days`);
    } catch (error: any) {
      toast.error(error.message || "Failed to postpone");
    }
  };

  const [refillingId, setRefillingId] = useState<string | null>(null);

  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const handleRefillNow = async (productId: Id<"products">, quantity: number) => {
    if (refillingId) return; // prevent double-click
    try {
      setRefillingId(productId as string);
      const results = await addToCart({ items: [{ productId: productId as any, quantity }] });
      const added = results.some((r: any) => r.success);
      if (added) {
        toast.success("Added to cart");
        // Microtask escapes React 18 automatic batching so the navigation
        // is not swallowed by the setRefillingId(null) update in finally.
        queueMicrotask(() => {
          navigateRef.current("/cart", {
            state: {
              breadcrumbTrail: [
                { label: "Medicine Refill", href: "/refill" },
                { label: "Shopping Cart" },
              ],
            },
          });
        });
      } else {
        const failed = results.find((r: any) => !r.success);
        toast.error(failed?.error || "Unable to add this medicine to your cart. Please try again.");
      }
    } catch (error: any) {
      toast.error(error.message || "Unable to add this medicine to your cart. Please try again.");
    } finally {
      setRefillingId(null);
    }
  };

  const handleRefillAll = async () => {
    if (!regularMedicines || selectedForRefill.size === 0) return;

    const items = regularMedicines
      .filter((r) => selectedForRefill.has(r.productId))
      .map((r) => ({
        productId: r.productId as any,
        quantity: r.suggestedQuantity || 1,
      }));

    if (items.length === 0) return;

    try {
      setAddingToCart(true);
      const results = await addToCart({ items });
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      if (successCount > 0) {
        toast.success(`${successCount} medicine(s) added to cart`);
      }
      if (failCount > 0) {
        toast.error(`${failCount} medicine(s) could not be added`);
      }
      if (successCount > 0) {
        // Create refill request record
        const medicines = regularMedicines
          .filter((r) => selectedForRefill.has(r.productId) && r.product)
          .map((r) => ({
            productId: r.productId as any,
            productName: r.product!.name,
            quantity: r.suggestedQuantity || 1,
            unitPrice: (r.product as any).discountPrice || (r.product as any).price || 0,
            prescriptionRequired: (r.product as any).prescriptionRequired || false,
            available: (r.product as any).stockQuantity > 0,
          }));

        const totalAmount = medicines.reduce(
          (sum, m) => sum + m.unitPrice * m.quantity,
          0
        );

        await createRefillRequest({ medicines, totalAmount });
        setSelectedForRefill(new Set());
        navigate("/cart", {
          state: {
            breadcrumbTrail: [
              { label: "Medicine Refill", href: "/refill" },
              { label: "Shopping Cart" },
            ],
          },
        });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to add to cart");
    } finally {
      setAddingToCart(false);
    }
  };

  const handleReviewAndRefill = async (items: typeof refillDueSoon) => {
    if (items.length === 0) return;

    const cartItems = items.map((i) => ({
      productId: i.productId as any,
      quantity: i.quantity || 1,
    }));

    try {
      setAddingToCart(true);
      const results = await addToCart({ items: cartItems });
      const successCount = results.filter((r) => r.success).length;

      if (successCount > 0) {
        toast.success(`${successCount} medicine(s) added to cart`);
        const medicines = items.map((i) => ({
          productId: i.productId as any,
          productName: (i.product as any)!.name,
          quantity: i.quantity || 1,
          unitPrice: (i.product as any).discountPrice || (i.product as any).price || 0,
          prescriptionRequired: (i.product as any).prescriptionRequired || false,
          available: (i.product as any).stockQuantity > 0,
        }));

        const totalAmount = medicines.reduce(
          (sum, m) => sum + m.unitPrice * m.quantity,
          0
        );

        await createRefillRequest({ medicines, totalAmount });
        navigate("/cart", {
          state: {
            breadcrumbTrail: [
              { label: "Medicine Refill", href: "/refill" },
              { label: "Shopping Cart" },
            ],
          },
        });
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to add to cart");
    } finally {
      setAddingToCart(false);
    }
  };

  // Previously ordered: unique products from order history, excluding already-regular
  const previouslyOrdered = useMemo(() => {
    if (!orderHistory || !deliveredOrders) return [];
    const regularIds = new Set(regularMedicines?.map((r) => r.productId) ?? []);
    // Dedupe by productId, keeping latest order
    const map = new Map<string, typeof orderHistory[number]>();
    for (const h of orderHistory) {
      const existing = map.get(h.productId);
      if (!existing || h.orderDate > existing.orderDate) map.set(h.productId, h);
    }
    return Array.from(map.values())
      .filter((h) => !regularIds.has(h.productId as Id<"products">))
      .sort((a, b) => b.orderDate - a.orderDate);
  }, [orderHistory, deliveredOrders, regularMedicines]);
  const hasPreviouslyOrdered = previouslyOrdered.length > 0;

  const hasRegularMedicines = regularMedicines && regularMedicines.length > 0;
  const hasSuggestions = suggestions && suggestions.length > 0;
  const hasDueSoon = refillDueSoon.length > 0;
  const hasReminders = reminders && reminders.length > 0;
  const hasRefillHistory = refillRequests && refillRequests.length > 0;
  const hasOrderHistory = orderHistory && orderHistory.length > 0;

  const isLoading = regularMedicines === undefined || suggestions === undefined || orderHistory === undefined;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Medicine Refill" },
          ]}
        />

        {/* Page Header */}
        <div className="mt-6 mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Medicine Refill
          </h1>
          <p className="text-muted-foreground mt-2">
            Quickly refill medicines you've purchased before.
          </p>
        </div>

        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-2xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-8">
            {/* ── Refill Due Soon ── */}
            {hasDueSoon && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                    <Clock className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Refill Due Soon</h2>
                    <p className="text-sm text-muted-foreground">
                      {refillDueCount > 0 && refillSoonCount > 0
                        ? `${refillDueCount} overdue, ${refillSoonCount} coming up soon`
                        : refillDueCount > 0
                          ? `${refillDueCount} medicine(s) may be overdue for refill`
                          : `Your refill may be due soon`
                      }
                    </p>
                  </div>
                </div>
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {refillDueSoon.map((item) => (
                        <div key={item.productId} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`flex size-8 items-center justify-center rounded-lg ${
                              item.refillStatus === "due" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                            }`}>
                              <Pill className="size-4" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {(item.product as any)?.name}
                                {(item.product as any)?.strength ? ` ${(item.product as any).strength}` : ""}
                              </p>
                              {item.refillMessage ? (
                                <p className="text-xs text-muted-foreground">
                                  {item.refillMessage}
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  Last ordered: {item.daysSinceLastOrder} days ago
                                </p>
                              )}
                              <p className="text-[11px] text-muted-foreground/70">
                                {item.daysSinceLastOrder} days since last order
                                {item.averageIntervalDays > 0 && item.orderCount >= 2
                                  ? ` · Average interval: ${item.averageIntervalDays} days`
                                  : ""
                                }
                              </p>
                            </div>
                          </div>
                          {item.refillStatus === "due" && (
                            <Badge variant="outline" className="text-[9px] border-red-300 text-red-600 bg-red-50 shrink-0">
                              Overdue
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                    <Button
                      className="mt-4 gradient-primary text-white"
                      onClick={() => handleReviewAndRefill(refillDueSoon)}
                      disabled={addingToCart}
                    >
                      {addingToCart ? (
                        <RefreshCw className="size-4 mr-2 animate-spin" />
                      ) : (
                        <ArrowRight className="size-4 mr-2" />
                      )}
                      Review & Refill
                    </Button>
                  </CardContent>
                </Card>
              </section>
            )}

            {/* ── Previously Ordered Medicines ── */}
            {hasPreviouslyOrdered && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
                      <Package className="size-4" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-foreground">Previously Ordered</h2>
                      <p className="text-sm text-muted-foreground">
                        Medicines from your past orders — save as regular or refill now
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviouslyOrderedExpanded(!previouslyOrderedExpanded)}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {previouslyOrderedExpanded ? "Show less" : `Show all (${previouslyOrdered.length})`}
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(previouslyOrderedExpanded ? previouslyOrdered : previouslyOrdered.slice(0, 6)).map((item) => {
                    // Look up live product data from deliveredOrders
                    const liveData = deliveredOrders?.find((d) => d.productId === item.productId);
                    const product = liveData?.product as any ?? null;
                    if (!product) return null;
                    const currentPrice = product.discountPrice || product.price;
                    const isAvailable = product.isActive && product.stockQuantity > 0;
                    const isPrescriptionRequired = product.prescriptionRequired;
                    const isAlreadyRegular = regularMedicines?.some((r) => r.productId === item.productId);
                    const lastOrderDate = new Date(item.orderDate);
                    const daysAgo = Math.floor((Date.now() - item.orderDate) / (24 * 60 * 60 * 1000));

                    return (
                      <Card key={item.productId} className="border-border/60">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                              <Pill className="size-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-foreground line-clamp-1">
                                {product.name}
                              </h3>
                              {product.strength && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {product.strength}{product.form ? ` · ${product.form}` : ""}
                                </p>
                              )}
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                Last ordered: {daysAgo}d ago · Qty: {item.quantity}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-sm font-bold text-foreground">
                                  {formatCurrency(currentPrice)}
                                </span>
                                {product.discountPrice && product.discountPrice < product.price && (
                                  <span className="text-[11px] text-muted-foreground line-through">
                                    {formatCurrency(product.price)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                {isPrescriptionRequired ? (
                                  <Badge variant="outline" className="text-[9px] border-orange-300 text-orange-600 bg-orange-50">
                                    Rx Required
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[9px] border-green-300 text-green-600 bg-green-50">
                                    OTC
                                  </Badge>
                                )}
                                {!isAvailable ? (
                                  <Badge variant="outline" className="text-[9px] border-red-300 text-red-600 bg-red-50">
                                    Unavailable
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[9px] border-emerald-300 text-emerald-600 bg-emerald-50">
                                    Available to Refill
                                  </Badge>
                                )}
                                {liveData && (liveData as any).refillStatus === "due" && (
                                  <Badge variant="outline" className="text-[9px] border-red-300 text-red-600 bg-red-50">
                                    Refill Overdue
                                  </Badge>
                                )}
                                {liveData && (liveData as any).refillStatus === "soon" && (
                                  <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-600 bg-amber-50">
                                    Refill Due Soon
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-3">
                                {isAlreadyRegular ? (
                                  <Badge variant="secondary" className="text-[10px]">
                                    Already saved
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[10px]"
                                    onClick={() => handleSaveAsRegular(item.productId as Id<"products">, product.name)}
                                    disabled={!isAvailable || savingId === item.productId}
                                  >
                                    {savingId === item.productId ? (
                                      <RefreshCw className="size-3 mr-1 animate-spin" />
                                    ) : (
                                      <Pill className="size-3 mr-1" />
                                    )}
                                    Save as Regular
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  className="h-7 text-[10px] gradient-primary text-white"
                                  onClick={() => handleRefillNow(item.productId as Id<"products">, item.quantity || 1)}
                                  disabled={!isAvailable || refillingId === item.productId}
                                >
                                  {refillingId === item.productId ? (
                                    <Loader2 className="size-3 mr-1 animate-spin" />
                                  ) : (
                                    <ShoppingCart className="size-3 mr-1" />
                                  )}
                                  Refill Now
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Your Regular Medicines ── */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Pill className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Your Regular Medicines</h2>
                    <p className="text-sm text-muted-foreground">
                      Medicines you've saved for quick refills
                    </p>
                  </div>
                </div>
                {hasRegularMedicines && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={selectAll} className="text-xs">
                      Select All
                    </Button>
                    {selectedForRefill.size > 0 && (
                      <Button variant="outline" size="sm" onClick={deselectAll} className="text-xs">
                        Deselect All
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {!hasRegularMedicines ? (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted/50">
                      <Pill className="size-7 text-muted-foreground/40" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground">No Regular Medicines Yet</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Save a medicine for quick refills in the future.
                    </p>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => navigate("/products")}
                    >
                      View My Orders
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {regularMedicines.map((item) => {
                      const product = item.product as any;
                      if (!product) return null;
                      const currentPrice = product.discountPrice || product.price;
                      const isAvailable = product.isActive && product.stockQuantity > 0;
                      const isPrescriptionRequired = product.prescriptionRequired;

                      return (
                        <Card
                          key={item._id}
                          className={`transition-all duration-200 ${
                            selectedForRefill.has(item.productId)
                              ? "border-primary ring-1 ring-primary/20"
                              : "border-border/60"
                          }`}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start gap-3">
                              <Checkbox
                                checked={selectedForRefill.has(item.productId)}
                                onCheckedChange={() => toggleSelect(item.productId)}
                                disabled={!isAvailable}
                                className="mt-1"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                              <h3 className="text-sm font-semibold text-foreground line-clamp-1">
                                {product.name}
                              </h3>
                              {product.strength && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {product.strength}
                                  {product.form ? ` · ${product.form}` : ""}
                                </p>
                              )}
                              {product.manufacturer && (
                                <p className="text-xs text-muted-foreground">
                                  {product.manufacturer}
                                </p>
                              )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 mt-3 flex-wrap">
                                  <span className="text-base font-bold text-foreground">
                                    {formatCurrency(currentPrice)}
                                  </span>
                                  {product.discountPrice && product.discountPrice < product.price && (
                                    <span className="text-xs text-muted-foreground line-through">
                                      {formatCurrency(product.price)}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  {isPrescriptionRequired ? (
                                    <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600 bg-orange-50">
                                      Prescription Required
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] border-green-300 text-green-600 bg-green-50">
                                      OTC
                                    </Badge>
                                  )}
                                  {!isAvailable ? (
                                    <Badge variant="outline" className="text-[10px] border-red-300 text-red-600 bg-red-50">
                                      Currently Unavailable
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-600 bg-emerald-50">
                                      Available to Refill
                                    </Badge>
                                  )}
                                </div>

                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-xs text-muted-foreground">Qty:</span>
                                  <button
                                    type="button"
                                    className="size-6 rounded border border-border/60 flex items-center justify-center text-xs font-bold hover:bg-muted transition-colors"
                                    onClick={() => setQuantity(item.productId as string, getQuantity(item.productId as string, item.suggestedQuantity || 1) - 1)}
                                    disabled={!isAvailable}
                                  >
                                    −
                                  </button>
                                  <span className="text-sm font-semibold text-foreground w-6 text-center">
                                    {getQuantity(item.productId as string, item.suggestedQuantity || 1)}
                                  </span>
                                  <button
                                    type="button"
                                    className="size-6 rounded border border-border/60 flex items-center justify-center text-xs font-bold hover:bg-muted transition-colors"
                                    onClick={() => setQuantity(item.productId as string, getQuantity(item.productId as string, item.suggestedQuantity || 1) + 1)}
                                    disabled={!isAvailable}
                                  >
                                    +
                                  </button>
                                </div>

                                <div className="flex items-center gap-2 mt-3">
                                  <Button
                                    size="sm"
                                    className="flex-1 h-8 text-xs font-semibold gradient-primary text-white"
                                    onClick={() =>
                                      handleRefillNow(item.productId, getQuantity(item.productId as string, item.suggestedQuantity || 1))
                                    }
                                    disabled={!isAvailable || refillingId === (item.productId as string)}
                                  >
                                    {refillingId === (item.productId as string) ? (
                                      <Loader2 className="size-3 mr-1 animate-spin" />
                                    ) : (
                                      <ShoppingCart className="size-3 mr-1" />
                                    )}
                                    Refill Now
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                    onClick={() =>
                                      handleRemoveRegular(item._id)
                                    }
                                    title="Remove"
                                  >
                                    <Trash2 className="size-3.5 text-muted-foreground" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                    onClick={() =>
                                      setTimelineProductId(
                                        timelineProductId === (item.productId as string) ? null : (item.productId as string)
                                      )
                                    }
                                    title="Activity"
                                  >
                                    <Clock className="size-3.5 text-muted-foreground" />
                                  </Button>
                                </div>

                                {/* Inline Activity Timeline Toggle */}
                                {medicineTimeline.length > 0 && timelineProductId === (item.productId as string) && (
                                  <div className="mt-3 pt-3 border-t border-border/40 space-y-1.5">
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Activity</p>
                                    {medicineTimeline.slice(0, 5).map((evt, ei) => (
                                      <div key={ei} className="flex items-center gap-2 text-[11px]">
                                        <div className={`size-1.5 rounded-full ${
                                          evt.type === "order" ? "bg-emerald-500"
                                          : evt.type === "refill" ? "bg-blue-500"
                                          : evt.type === "reminder_sent" ? "bg-amber-500"
                                          : "bg-violet-500"
                                        }`} />
                                        <span className="text-foreground font-medium">{evt.label}</span>
                                        <span className="text-muted-foreground">
                                          {new Date(evt.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                        </span>
                                        {evt.detail && <span className="text-muted-foreground/70">· {evt.detail}</span>}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Refill All Bar */}
                  {selectedForRefill.size > 0 && (
                    <div className="mt-4 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <p className="text-sm font-medium text-foreground">
                        {selectedForRefill.size} medicine(s) selected
                      </p>
                      <Button
                        className="gradient-primary text-white"
                        onClick={handleRefillAll}
                        disabled={addingToCart}
                      >
                        {addingToCart ? (
                          <RefreshCw className="size-4 mr-2 animate-spin" />
                        ) : (
                          <ShoppingCart className="size-4 mr-2" />
                        )}
                        Refill All
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* ── Suggestions (from order history) ── */}
            {hasSuggestions && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <Stethoscope className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      Suggested Regular Medicines
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Based on your previous orders
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {suggestions.map((item) => {
                    const product = item.product as any;
                    if (!product) return null;
                    const currentPrice = product.discountPrice || product.price;
                    const isAvailable = product.isActive && product.stockQuantity > 0;
                    const isAlreadyRegular = regularMedicines?.some(
                      (r) => r.productId === item.productId
                    );

                    return (
                      <Card key={item.productId} className="border-border/60">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                              <Package className="size-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-semibold text-foreground line-clamp-1">
                                {product.name}
                              </h3>
                              {product.strength && (
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {product.strength}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Ordered {item.count} time(s)
                              </p>
                              <p className="text-sm font-bold text-foreground mt-2">
                                {formatCurrency(currentPrice)}
                              </p>
                              <div className="flex items-center gap-2 mt-3">
                                {isAlreadyRegular ? (
                                  <Badge variant="secondary" className="text-[10px]">
                                    Already saved
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs"
                                    onClick={() =>
                                      handleSaveAsRegular(item.productId as Id<"products">, (product as any).name)
                                    }
                                    disabled={!isAvailable || savingId === item.productId}
                                  >
                                    {savingId === item.productId ? (
                                      <RefreshCw className="size-3 mr-1 animate-spin" />
                                    ) : (
                                      <Pill className="size-3 mr-1" />
                                    )}
                                    Save as Regular
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  className="h-8 text-xs gradient-primary text-white"
                                  onClick={() => handleRefillNow(item.productId as Id<"products">, 1)}
                                  disabled={!isAvailable || refillingId === (item.productId as string)}
                                >
                                  {refillingId === (item.productId as string) ? (
                                    <Loader2 className="size-3 mr-1 animate-spin" />
                                  ) : (
                                    <ShoppingCart className="size-3 mr-1" />
                                  )}
                                  Refill Now
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Refill Reminders ── */}
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex size-8 items-center justify-center rounded-lg bg-violet-100 text-violet-600">
                  <Bell className="size-4" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Refill Reminders</h2>
                  <p className="text-sm text-muted-foreground">
                    Schedule reminders for your regular medicines
                  </p>
                </div>
              </div>

              {!hasReminders ? (
                <Card className="border-dashed">
                  <CardContent className="p-6 text-center">
                    <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted/50">
                      <Bell className="size-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm text-muted-foreground">No Refill Reminders</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Set a reminder on any regular medicine to get notified when it's time to refill.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {reminders.map((reminder) => {
                    const product = reminder.product as any;
                    if (!product) return null;
                    const nextDate = new Date(reminder.nextReminderAt);
                    const isDue = reminder.nextReminderAt <= Date.now();
                    const adminActions = (reminder as any).adminActions || [];
                    const isExpanded = selectedReminderDetail === reminder._id;
                    const isAlreadyOrdered = orderHistory?.some(
                      (h) => h.productId === (reminder.productId as any)
                    );
                    const lastOrderEntry = orderHistory?.find(
                      (h) => h.productId === (reminder.productId as any)
                    );

                    const isActive = reminder.isActive;
                    const lastAdminAction = adminActions.length > 0 ? adminActions[adminActions.length - 1] : null;
                    const adminStatus = !isActive && lastAdminAction
                      ? lastAdminAction.action === "paused" ? "Paused by Admin"
                      : lastAdminAction.action === "cancelled" ? "Cancelled by Admin"
                      : lastAdminAction.action === "resumed" ? "Resumed by Admin"
                      : ""
                      : "";

                    return (
                      <Card
                        key={reminder._id}
                        className={`border-border/60 cursor-pointer hover:shadow-md transition-all ${
                          !isActive ? "border-gray-300 bg-gray-50/30 opacity-80"
                          : isDue ? "border-amber-300 bg-amber-50/30"
                          : ""
                        } ${isExpanded ? "border-primary ring-1 ring-primary/20" : ""}`}
                        onClick={() => setSelectedReminderDetail(isExpanded ? null : reminder._id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`flex size-8 items-center justify-center rounded-lg ${
                                !isActive ? "bg-gray-100 text-gray-500"
                                : isDue ? "bg-amber-100 text-amber-600"
                                : "bg-violet-100 text-violet-600"
                              }`}>
                                <CalendarClock className="size-4" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {product.name}
                                  {product.strength ? ` ${product.strength}` : ""}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Every {reminder.intervalDays} days · Next:{" "}
                                  {!isActive ? "Stopped" : isDue ? "Due now" : nextDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                </p>
                                {adminStatus && (
                                  <Badge variant="outline" className="text-[9px] border-gray-300 text-gray-600 bg-gray-50 mt-1">
                                    {adminStatus}
                                    {lastAdminAction?.detail ? ` · ${lastAdminAction.detail}` : lastAdminAction?.timestamp ? ` · ${new Date(lastAdminAction.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : ""}
                                  </Badge>
                                )}
                                {!isActive && !adminStatus && (
                                  <Badge variant="outline" className="text-[9px] border-gray-300 text-gray-600 bg-gray-50 mt-1">
                                    Paused
                                  </Badge>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                              {isActive && isDue && (
                                <Button
                                  size="sm"
                                  className="h-8 text-xs gradient-primary text-white"
                                  onClick={() => handleRefillNow(reminder.productId, 1)}
                                  disabled={refillingId === (reminder.productId as string)}
                                >
                                  {refillingId === (reminder.productId as string) ? (
                                    <Loader2 className="size-3 mr-1 animate-spin" />
                                  ) : null}
                                  Refill Now
                                </Button>
                              )}
                              {isActive && !isDue && (
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[10px]"
                                    onClick={() => handlePostponeReminder(reminder._id, 3)}
                                  >
                                    +3d
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[10px]"
                                    onClick={() => handlePostponeReminder(reminder._id, 7)}
                                  >
                                    +7d
                                  </Button>
                                </div>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 w-8 p-0"
                                onClick={() => handleRemoveReminder(reminder._id)}
                              >
                                <Trash2 className="size-3.5 text-muted-foreground" />
                              </Button>
                            </div>
                          </div>
                          {/* Expanded Reminder Details */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-border/40 space-y-3">
                              <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Reminder Details</h4>
                              <div className="grid grid-cols-2 gap-2 text-[11px]">
                                <div><span className="text-muted-foreground">Frequency: </span><span className="text-foreground">Every {reminder.intervalDays} days</span></div>
                                <div><span className="text-muted-foreground">Next reminder: </span><span className="text-foreground">{isDue ? "Due now" : nextDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></div>
                                <div><span className="text-muted-foreground">Created: </span><span className="text-foreground">{new Date(reminder.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></div>
                                <div><span className="text-muted-foreground">Status: </span><span className="text-foreground">{reminder.isActive ? "Active" : "Paused"}</span></div>
                                {reminder.lastReminderAt > reminder.createdAt && (
                                  <div><span className="text-muted-foreground">Last reminder sent: </span><span className="text-foreground">{new Date(reminder.lastReminderAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></div>
                                )}
                                {lastOrderEntry && (
                                  <div><span className="text-muted-foreground">Last ordered: </span><span className="text-foreground">{new Date(lastOrderEntry.orderDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span></div>
                                )}
                              </div>
                              {product.prescriptionRequired && (
                                <Badge variant="outline" className="text-[9px] border-orange-300 text-orange-600 bg-orange-50">Rx Required</Badge>
                              )}
                              {product.strength && (
                                <p className="text-[11px] text-muted-foreground">Strength: {product.strength}{product.form ? ` · ${product.form}` : ""}</p>
                              )}
                              {/* Admin Actions */}
                              {adminActions.length > 0 && (
                                <div>
                                  <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Activity</h4>
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-2 text-[11px]">
                                      <div className="size-1.5 rounded-full bg-emerald-500" />
                                      <span className="text-foreground font-medium">Reminder Created</span>
                                      <span className="text-muted-foreground">{new Date(reminder.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                                    </div>
                                    {adminActions.map((a: any, ai: number) => (
                                      <div key={ai} className="flex items-center gap-2 text-[11px]">
                                        <div className={`size-1.5 rounded-full ${
                                          a.action === "paused" ? "bg-amber-500"
                                          : a.action === "resumed" ? "bg-emerald-500"
                                          : a.action === "rescheduled" ? "bg-blue-500"
                                          : "bg-red-500"
                                        }`} />
                                        <span className="text-foreground font-medium">
                                          Reminder {a.action} by Admin
                                        </span>
                                        <span className="text-muted-foreground">
                                          {new Date(a.timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                        </span>
                                        {a.detail && (
                                          <span className="text-muted-foreground/70">· {a.detail}</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Set Reminder CTA for regular medicines without reminders */}
              {hasRegularMedicines && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground mb-2">
                    Set a reminder on your regular medicines:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {regularMedicines.map((item) => {
                      const product = item.product as any;
                      if (!product) return null;
                      const hasActiveReminder = reminders?.some(
                        (r) => r.productId === item.productId && (r as any).isActive
                      );
                      if (hasActiveReminder) return null;

                      return (
                        <Button
                          key={item._id}
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() =>
                            setReminderModal({
                              productId: item.productId,
                              name: product.name,
                            })
                          }
                        >
                          <Bell className="size-3 mr-1" />
                          {product.name}
                          {product.strength ? ` ${product.strength}` : ""}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* ── Refill History ── */}
            {(hasRefillHistory || hasOrderHistory) && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                    <Clock className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Refill History</h2>
                    <p className="text-sm text-muted-foreground">
                      Your previous order and refill activity
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {/* Show refill requests first */}
                  {refillRequests?.slice(0, 5).map((req) => (
                    <Card
                      key={req._id}
                      className={`border-border/60 cursor-pointer hover:shadow-md transition-all ${
                        selectedHistoryItem === req._id ? "border-primary ring-1 ring-primary/20" : ""
                      }`}
                      onClick={() => setSelectedHistoryItem(selectedHistoryItem === req._id ? null : req._id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {req.medicines.map((m) => m.productName).join(", ")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(req.createdAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                              {req.totalAmount > 0 && ` · ${formatCurrency(req.totalAmount)}`}
                            </p>
                          </div>
                          <Badge
                            variant={req.status === "completed" ? "default" : "secondary"}
                            className="text-[10px] shrink-0"
                          >
                            {req.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                          </Badge>
                        </div>
                        {/* Show per-medicine detail for multi-item refills */}
                        {req.medicines.length > 1 && (
                          <div className="mt-2 space-y-1">
                            {req.medicines.map((m, mi) => (
                              <div key={mi} className="flex items-center justify-between text-[11px] text-muted-foreground">
                                <span>{m.productName} × {m.quantity}</span>
                                <span>{formatCurrency(m.unitPrice * m.quantity)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Expanded Refill Details */}
                        {selectedHistoryItem === req._id && (
                          <div className="mt-3 pt-3 border-t border-border/40 space-y-3">
                            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Refill Details</h4>
                            {req.medicines.map((m, mi) => (
                              <div key={mi} className="bg-muted/30 rounded-lg p-3 space-y-1">
                                <p className="text-sm font-medium text-foreground">{m.productName}</p>
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                                  <span>Qty: {m.quantity}</span>
                                  <span>Price: {formatCurrency(m.unitPrice)}</span>
                                  <span>Total: {formatCurrency(m.unitPrice * m.quantity)}</span>
                                  <span>Prescription: {m.prescriptionRequired ? "Required" : "OTC"}</span>
                                  <span>Available: {m.available ? "Yes" : "No"}</span>
                                </div>
                              </div>
                            ))}
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                              <span>Total: {formatCurrency(req.totalAmount)}</span>
                              <span>Created: {new Date(req.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                              <span>Status: {req.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                  {/* Show recent order history entries grouped by order */}
                  {(() => {
                    // Group order history by orderId for cleaner display
                    const grouped: Record<string, typeof orderHistory> = {};
                    for (const h of orderHistory || []) {
                      if (!grouped[h.orderId]) grouped[h.orderId] = [];
                      grouped[h.orderId].push(h);
                    }
                    const orderIds = Object.keys(grouped).slice(0, 6);
                    return orderIds.map((orderId) => {
                      const entries = grouped[orderId];
                      const first = entries[0];
                      const totalAmount = entries.reduce((sum, e) => sum + e.price * e.quantity, 0);
                      return (
                        <Card
                          key={orderId}
                          className={`border-border/60 cursor-pointer hover:shadow-md transition-all ${
                            selectedOrderItem === orderId ? "border-primary ring-1 ring-primary/20" : ""
                          }`}
                          onClick={() => setSelectedOrderItem(selectedOrderItem === orderId ? null : orderId)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {entries.length === 1 ? first.name : `${entries.length} items`}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(first.orderDate).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                  {totalAmount > 0 && ` · ${formatCurrency(totalAmount)}`}
                                </p>
                              </div>
                              <Badge
                                variant={first.orderStatus === "delivered" ? "default" : "secondary"}
                                className="text-[10px] shrink-0"
                              >
                                {first.orderStatus.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                              </Badge>
                            </div>
                            {/* Show per-medicine detail for multi-item orders */}
                            {entries.length > 1 && (
                              <div className="mt-2 space-y-1">
                                {entries.map((e, ei) => (
                                  <div key={ei} className="flex items-center justify-between text-[11px] text-muted-foreground">
                                    <span>{e.name} × {e.quantity}</span>
                                    <span>{formatCurrency(e.price * e.quantity)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Expanded Order Details */}
                            {selectedOrderItem === orderId && (
                              <div className="mt-3 pt-3 border-t border-border/40 space-y-3">
                                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Order Details</h4>
                                {entries.map((e, ei) => (
                                  <div key={ei} className="bg-muted/30 rounded-lg p-3 space-y-1">
                                    <p className="text-sm font-medium text-foreground">{e.name}</p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                                      <span>Qty: {e.quantity}</span>
                                      <span>Price: {formatCurrency(e.price)}</span>
                                      <span>Total: {formatCurrency(e.price * e.quantity)}</span>
                                    </div>
                                  </div>
                                ))}
                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                                  <span>Order Date: {new Date(first.orderDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                                  <span>Status: {first.orderStatus.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
                                  <span>Total: {formatCurrency(totalAmount)}</span>
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    });
                  })()}
                </div>
              </section>
            )}

            {/* ── Reminder History ── */}
            {reminderHistory && reminderHistory.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
                    <Bell className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Reminder History</h2>
                    <p className="text-sm text-muted-foreground">
                      Past refill reminders that were sent
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {reminderHistory.slice(0, 10).map((r) => {
                    const product = r.product as any;
                    if (!product) return null;
                    const histAdminActions = (r as any).adminActions || [];
                    const histLastAction = histAdminActions.length > 0 ? histAdminActions[histAdminActions.length - 1] : null;
                    const histStatus = !(r as any).isActive && histLastAction
                      ? histLastAction.action === "paused" ? "Paused by Admin"
                      : histLastAction.action === "cancelled" ? "Cancelled by Admin"
                      : ""
                      : (r as any).isActive ? "Active" : "Paused";

                    return (
                      <Card key={r._id} className="border-border/60">
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`flex size-7 items-center justify-center rounded-lg ${(r as any).isActive ? "bg-indigo-50 text-indigo-600" : "bg-gray-100 text-gray-500"}`}>
                              <Bell className="size-3.5" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {product.name}{product.strength ? ` ${product.strength}` : ""}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Reminder sent: {new Date(r.lastReminderAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                {!(r as any).isActive ? " · Stopped" : r.isDue ? " · Due now" : ""}
                              </p>
                              <Badge variant="outline" className="text-[9px] border-gray-300 text-gray-600 bg-gray-50 mt-1">
                                {histStatus}
                              </Badge>
                            </div>
                          </div>
                          {(r as any).isActive && r.isDue ? (
                            <Button
                              size="sm"
                              className="h-7 text-[10px] gradient-primary text-white"
                              onClick={() => handleRefillNow(r.productId, 1)}
                              disabled={refillingId === (r.productId as string)}
                            >
                              Refill Now
                            </Button>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Sent</Badge>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* ── Reminder Modal ── */}
      {reminderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-2xl border border-border/60 p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="text-base font-semibold text-foreground">Set Refill Reminder</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {reminderModal.name}
            </p>
            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {[15, 30, 60].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => {
                      setReminderDays(days);
                      setCustomDays("");
                    }}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      reminderDays === days && !customDays
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground hover:border-primary/40"
                    }`}
                  >
                    {days} days
                  </button>
                ))}
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Custom (days)</Label>
                <Input
                  type="number"
                  min={7}
                  placeholder="e.g. 45"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
            </div>
            <div className="mt-6 flex items-center gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setReminderModal(null)}>
                Cancel
              </Button>
              <Button className="flex-1 gradient-primary text-white" onClick={handleSetReminder}>
                Set Reminder
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
