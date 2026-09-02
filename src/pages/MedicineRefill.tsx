import { useState, useMemo, useCallback } from "react";
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

  /** Navigate to cart with the Medicine Refill breadcrumb trail */
  const navigateToCart = useCallback(() => {
    // Use setTimeout to ensure navigation fires after Convex mutation
    // triggers reactive re-renders and React state batching completes
    setTimeout(() => {
      navigate("/cart", {
        state: {
          breadcrumbTrail: [
            { label: "Medicine Refill", href: "/refill" },
            { label: "Shopping Cart" },
          ],
        },
      });
    }, 50);
  }, [navigate]);

  // Backend data
  const regularMedicines = useQuery(api.refills.listRegularMedicines);
  const suggestions = useQuery(api.refills.getSuggestionsFromOrders);
  const deliveredOrders = useQuery(api.refills.getDeliveredOrderMedicines);
  const reminders = useQuery(api.refills.listReminders);
  const refillRequests = useQuery(api.refills.listMyRefillRequests);

  // Mutations
  const saveRegularMedicine = useMutation(api.refills.saveRegularMedicine);
  const removeRegularMedicine = useMutation(api.refills.removeRegularMedicine);
  const createReminder = useMutation(api.refills.createReminder);
  const removeReminder = useMutation(api.refills.removeReminder);
  const addToCart = useMutation(api.refills.addToCart);
  const createRefillRequest = useMutation(api.refills.createRefillRequest);

  // UI state
  const [selectedForRefill, setSelectedForRefill] = useState<Set<Id<"products">>>(new Set());
  const [reminderModal, setReminderModal] = useState<{ productId: Id<"products">; name: string } | null>(null);
  const [reminderDays, setReminderDays] = useState(30);
  const [customDays, setCustomDays] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [addingToCart, setAddingToCart] = useState(false);

  // Compute refill-due-soon based on order history
  const refillDueSoon = useMemo(() => {
    if (!deliveredOrders) return [];
    return deliveredOrders.filter((item) => item.daysSinceLastOrder >= 20);
  }, [deliveredOrders]);

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

  const [refillingId, setRefillingId] = useState<string | null>(null);

  const handleRefillNow = async (productId: Id<"products">, quantity: number) => {
    if (refillingId) return; // prevent double-click
    try {
      setRefillingId(productId as string);
      const results = await addToCart({ items: [{ productId: productId as any, quantity }] });
      const added = results.some((r: any) => r.success);
      if (added) {
        toast.success("Added to cart");
        navigateToCart();
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
        navigateToCart();
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
        navigateToCart();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to add to cart");
    } finally {
      setAddingToCart(false);
    }
  };

  const hasRegularMedicines = regularMedicines && regularMedicines.length > 0;
  const hasSuggestions = suggestions && suggestions.length > 0;
  const hasDueSoon = refillDueSoon.length > 0;
  const hasReminders = reminders && reminders.length > 0;
  const hasRefillHistory = refillRequests && refillRequests.length > 0;

  const isLoading = regularMedicines === undefined || suggestions === undefined;

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
                    <p className="text-sm text-muted-foreground">Your refill may be due soon</p>
                  </div>
                </div>
                <Card className="border-amber-200 bg-amber-50/50">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {refillDueSoon.map((item) => (
                        <div key={item.productId} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex size-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                              <Pill className="size-4" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {(item.product as any)?.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Last ordered: {item.daysSinceLastOrder} days ago
                              </p>
                            </div>
                          </div>
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

                                <div className="flex items-center gap-2 mt-2">
                                  {isPrescriptionRequired ? (
                                    <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-600 bg-orange-50">
                                      Prescription Required
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] border-green-300 text-green-600 bg-green-50">
                                      OTC
                                    </Badge>
                                  )}
                                  {!isAvailable && (
                                    <Badge variant="outline" className="text-[10px] border-red-300 text-red-600 bg-red-50">
                                      Unavailable
                                    </Badge>
                                  )}
                                </div>

                                <p className="text-xs text-muted-foreground mt-2">
                                  Qty: {item.suggestedQuantity || 1}
                                </p>

                                <div className="flex items-center gap-2 mt-3">
                                  <Button
                                    size="sm"
                                    className="flex-1 h-8 text-xs font-semibold gradient-primary text-white"
                                    onClick={() =>
                                      handleRefillNow(item.productId, item.suggestedQuantity || 1)
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
                                </div>
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

                    return (
                      <Card key={reminder._id} className={`border-border/60 ${isDue ? "border-amber-300 bg-amber-50/30" : ""}`}>
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`flex size-8 items-center justify-center rounded-lg ${isDue ? "bg-amber-100 text-amber-600" : "bg-violet-100 text-violet-600"}`}>
                              <CalendarClock className="size-4" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">
                                {product.name}
                                {product.strength ? ` ${product.strength}` : ""}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Every {reminder.intervalDays} days · Next:{" "}
                                {isDue ? "Due now" : nextDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isDue && (
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
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 w-8 p-0"
                              onClick={() => handleRemoveReminder(reminder._id)}
                            >
                              <Trash2 className="size-3.5 text-muted-foreground" />
                            </Button>
                          </div>
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
                      const hasReminderForThis = reminders?.some(
                        (r) => r.productId === item.productId
                      );
                      if (hasReminderForThis) return null;

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
            {hasRefillHistory && (
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                    <Clock className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Refill History</h2>
                    <p className="text-sm text-muted-foreground">
                      Your previous refill activity
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  {refillRequests.slice(0, 5).map((req) => (
                    <Card key={req._id} className="border-border/60">
                      <CardContent className="p-3 flex items-center justify-between">
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
                          </p>
                        </div>
                        <Badge
                          variant={req.status === "completed" ? "default" : "secondary"}
                          className="text-[10px]"
                        >
                          {req.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
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
