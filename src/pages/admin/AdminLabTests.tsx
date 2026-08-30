import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  FlaskConical,
  Plus,
  Search,
  Pencil,
  Trash2,
  Loader2,
  Eye,
  CalendarClock,
  Beaker,
  Menu,
  X,
} from "lucide-react";
import { toast } from "sonner";

/* ── 29 Lab Test Categories ── */
const LAB_CATEGORIES = [
  { slug: "full-body", name: "Full Body Checkup" },
  { slug: "diabetes", name: "Diabetes" },
  { slug: "heart", name: "Heart" },
  { slug: "blood", name: "Blood Studies" },
  { slug: "vitamin", name: "Vitamin" },
  { slug: "thyroid", name: "Thyroid" },
  { slug: "kidney", name: "Kidney" },
  { slug: "liver", name: "Liver" },
  { slug: "womens-health", name: "Women's Health" },
  { slug: "senior-citizen", name: "Senior Citizen" },
  { slug: "tax-saver", name: "Tax Saver" },
  { slug: "fever", name: "Fever" },
  { slug: "hormone", name: "Hormone Screening" },
  { slug: "hairfall", name: "Hairfall" },
  { slug: "dengue", name: "Dengue" },
  { slug: "bone-joint", name: "Bone and Joint" },
  { slug: "allergy", name: "Allergy" },
  { slug: "sexual-wellness", name: "Sexual Wellness" },
  { slug: "immunity", name: "Immunity" },
  { slug: "fever-infection", name: "Fever and Infection" },
  { slug: "reproductive", name: "Reproductive & Fertility Tests" },
  { slug: "cancer-screening", name: "Cancer Screening" },
  { slug: "hepatitis", name: "Hepatitis Screening" },
  { slug: "lungs", name: "Lungs" },
  { slug: "weight", name: "Weight Management" },
  { slug: "iron", name: "Iron Studies" },
  { slug: "covid", name: "Covid 19" },
  { slug: "pcod", name: "PCOD Screening" },
  { slug: "healthy-2024", name: "Healthy 2024" },
];

const BOOKING_STATUSES = [
  { value: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  { value: "confirmed", label: "Confirmed", color: "bg-blue-100 text-blue-800" },
  { value: "sample_collection_scheduled", label: "Collection Scheduled", color: "bg-indigo-100 text-indigo-800" },
  { value: "sample_collected", label: "Sample Collected", color: "bg-purple-100 text-purple-800" },
  { value: "report_ready", label: "Report Ready", color: "bg-green-100 text-green-800" },
  { value: "completed", label: "Completed", color: "bg-emerald-100 text-emerald-800" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800" },
];

const PAYMENT_STATUSES = [
  { value: "pending", label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  { value: "paid", label: "Paid", color: "bg-green-100 text-green-800" },
  { value: "failed", label: "Failed", color: "bg-red-100 text-red-800" },
  { value: "refunded", label: "Refunded", color: "bg-orange-100 text-orange-800" },
];

/* ── Default form state ── */
const DEFAULT_FORM = {
  categorySlug: "",
  categoryName: "",
  name: "",
  type: "single" as "single" | "package",
  description: "",
  detailedDescription: "",
  includedTestIds: [] as string[],
  includedTestCount: 1,
  originalPrice: 0,
  discountedPrice: 0,
  discountPercentage: 0,
  reportTime: "",
  sampleType: "",
  fastingRequired: false,
  homeCollectionAvailable: false,
  serviceArea: "",
  promotionalBadges: [] as string[],
  promotionalText: "",
  active: true,
};

export default function AdminLabTests() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"manage" | "bookings">("manage");

  /* ── Manage tab state ── */
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newTestId, setNewTestId] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  /* ── Bookings tab state ── */
  const [statusFilter, setStatusFilter] = useState("");
  const [bookingSearch, setBookingSearch] = useState("");
  const [detailBooking, setDetailBooking] = useState<any>(null);

  /* ── Queries ── */
  // All tests for the selected category (used for both table and sidebar counts)
  const selectedCatTests = useQuery(
    api.labTests.adminList,
    selectedCategory ? { categorySlug: selectedCategory } : "skip"
  );

  // All tests (no filter) for sidebar category counts
  const allTests = useQuery(api.labTests.adminList, {});

  const bookings = useQuery(api.labTests.bookingsList, {
    status: statusFilter || undefined,
    search: bookingSearch || undefined,
  });

  /* ── Mutations ── */
  const createTest = useMutation(api.labTests.create);
  const updateTest = useMutation(api.labTests.update);
  const removeTest = useMutation(api.labTests.remove);
  const toggleActive = useMutation(api.labTests.toggleActive);
  const updateBookingStatus = useMutation(api.labTests.updateBookingStatus);
  const updatePaymentStatus = useMutation(api.labTests.updatePaymentStatus);

  /* ── Sidebar category counts (from allTests) ── */
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (allTests) {
      for (const t of allTests) {
        counts[t.categorySlug] = (counts[t.categorySlug] || 0) + 1;
      }
    }
    return counts;
  }, [allTests]);

  /* ── Filtered tests within selected category ── */
  const filteredTests = useMemo(() => {
    if (!selectedCatTests) return undefined;
    let items = selectedCatTests;
    if (typeFilter) {
      items = items.filter((t) => t.type === typeFilter);
    }
    if (search) {
      const s = search.toLowerCase();
      items = items.filter((t) => t.name.toLowerCase().includes(s));
    }
    return items;
  }, [selectedCatTests, typeFilter, search]);

  /* ── Handlers ── */
  const openCreate = useCallback((preselectedSlug?: string) => {
    setEditingId(null);
    const cat = LAB_CATEGORIES.find((c) => c.slug === (preselectedSlug || selectedCategory));
    setForm({
      ...DEFAULT_FORM,
      categorySlug: preselectedSlug || selectedCategory || "",
      categoryName: cat?.name || "",
    });
    setFormOpen(true);
  }, [selectedCategory]);

  const openEdit = useCallback((test: any) => {
    setEditingId(test._id);
    setForm({
      categorySlug: test.categorySlug,
      categoryName: test.categoryName,
      name: test.name,
      type: test.type,
      description: test.description,
      detailedDescription: test.detailedDescription || "",
      includedTestIds: test.includedTestIds || [],
      includedTestCount: test.includedTestCount,
      originalPrice: test.originalPrice,
      discountedPrice: test.discountedPrice,
      discountPercentage: test.discountPercentage,
      reportTime: test.reportTime || "",
      sampleType: test.sampleType || "",
      fastingRequired: test.fastingRequired || false,
      homeCollectionAvailable: test.homeCollectionAvailable || false,
      serviceArea: test.serviceArea || "",
      promotionalBadges: test.promotionalBadges || [],
      promotionalText: test.promotionalText || "",
      active: test.active,
    });
    setFormOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!form.name || !form.categorySlug) {
      toast.error("Name and category are required");
      return;
    }
    try {
      const cat = LAB_CATEGORIES.find((c) => c.slug === form.categorySlug);
      const payload = {
        ...form,
        categoryName: cat?.name || form.categorySlug,
        discountPercentage: form.originalPrice > 0
          ? Math.round(((form.originalPrice - form.discountedPrice) / form.originalPrice) * 100)
          : 0,
      };
      if (editingId) {
        await updateTest({ id: editingId as any, ...payload });
        toast.success("Lab test updated");
      } else {
        await createTest(payload);
        toast.success("Lab test created");
      }
      setFormOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    }
  }, [form, editingId, createTest, updateTest]);

  const handleDelete = useCallback(async () => {
    if (!deleteId) return;
    try {
      await removeTest({ id: deleteId as any });
      toast.success("Deleted");
      setDeleteId(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to delete");
    }
  }, [deleteId, removeTest]);

  const handleToggleActive = useCallback(async (id: string) => {
    try {
      await toggleActive({ id: id as any });
      toast.success("Status updated");
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    }
  }, [toggleActive]);

  const handleBookingStatus = useCallback(async (id: string, status: string) => {
    try {
      await updateBookingStatus({ id: id as any, bookingStatus: status as any });
      toast.success("Booking status updated");
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    }
  }, [updateBookingStatus]);

  const handlePaymentStatus = useCallback(async (id: string, status: string) => {
    try {
      await updatePaymentStatus({ id: id as any, paymentStatus: status as any });
      toast.success("Payment status updated");
    } catch (e: any) {
      toast.error(e.message || "Failed to update");
    }
  }, [updatePaymentStatus]);

  const addTestId = useCallback(() => {
    if (newTestId.trim()) {
      setForm((f) => ({
        ...f,
        includedTestIds: [...f.includedTestIds, newTestId.trim()],
        includedTestCount: f.includedTestIds.length + 1,
      }));
      setNewTestId("");
    }
  }, [newTestId]);

  const removeTestId = useCallback((idx: number) => {
    setForm((f) => ({
      ...f,
      includedTestIds: f.includedTestIds.filter((_, i) => i !== idx),
      includedTestCount: Math.max(0, f.includedTestIds.length - 1),
    }));
  }, []);

  const calcDiscount = useMemo(() => {
    if (form.originalPrice > 0 && form.discountedPrice > 0) {
      return Math.round(((form.originalPrice - form.discountedPrice) / form.originalPrice) * 100);
    }
    return 0;
  }, [form.originalPrice, form.discountedPrice]);

  const selectedCatName = LAB_CATEGORIES.find((c) => c.slug === selectedCategory)?.name || "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lab Tests</h1>
          <p className="text-sm text-muted-foreground">Manage lab test categories, packages, and bookings</p>
        </div>
        {tab === "manage" && selectedCategory && (
          <Button onClick={() => openCreate()} className="gradient-primary text-white shadow-glow">
            <Plus className="mr-2 size-4" /> Add Test
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted p-1 w-fit">
        <button
          onClick={() => { setTab("manage"); setBookingSearch(""); }}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${tab === "manage" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <FlaskConical className="size-4" /> Manage Tests
        </button>
        <button
          onClick={() => { setTab("bookings"); setSearch(""); setBookingSearch(""); }}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${tab === "bookings" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <CalendarClock className="size-4" /> Booked Tests
        </button>
      </div>

      {/* ═══════════════════════════════════════════════
          MANAGE TESTS — Category Sidebar + Test Panel
          ═══════════════════════════════════════════════ */}
      {tab === "manage" && (
        <div className="flex gap-0 rounded-xl border border-border/60 bg-card overflow-hidden min-h-[600px]">
          {/* ── LEFT SIDEBAR: Categories ── */}
          <div className="hidden lg:flex flex-col w-[280px] shrink-0 border-r border-border/60">
            <div className="px-4 py-3 border-b border-border/60 bg-muted/30">
              <h3 className="text-sm font-bold">Categories</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">{LAB_CATEGORIES.length} categories</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {LAB_CATEGORIES.map((cat) => {
                const count = categoryCounts[cat.slug] || 0;
                const isSelected = selectedCategory === cat.slug;
                return (
                  <button
                    key={cat.slug}
                    onClick={() => {
                      setSelectedCategory(cat.slug);
                      setSearch("");
                      setTypeFilter("");
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-colors border-b border-border/30 flex items-center justify-between gap-2 ${
                      isSelected
                        ? "bg-primary/10 text-primary font-medium border-l-2 border-l-primary"
                        : "text-foreground hover:bg-muted/50 border-l-2 border-l-transparent"
                    }`}
                  >
                    <span className="truncate">{cat.name}</span>
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full min-w-[22px] text-center ${
                      isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Mobile Category Selector ── */}
          <div className="lg:hidden border-b border-border/60 bg-muted/30 p-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm w-full"
            >
              <Menu className="size-4" />
              <span className="font-medium">{selectedCatName || "Select a category"}</span>
              {selectedCategory && (
                <span className="ml-auto text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                  {categoryCounts[selectedCategory] || 0}
                </span>
              )}
            </button>
          </div>

          {/* ── Mobile Category Drawer ── */}
          {mobileSidebarOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
              <div className="absolute left-0 top-0 bottom-0 w-[300px] bg-card shadow-xl overflow-y-auto">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/30 sticky top-0 z-10">
                  <h3 className="text-sm font-bold">Select Category</h3>
                  <button onClick={() => setMobileSidebarOpen(false)} className="p-1 hover:bg-muted rounded-lg">
                    <X className="size-4" />
                  </button>
                </div>
                {LAB_CATEGORIES.map((cat) => {
                  const count = categoryCounts[cat.slug] || 0;
                  const isSelected = selectedCategory === cat.slug;
                  return (
                    <button
                      key={cat.slug}
                      onClick={() => {
                        setSelectedCategory(cat.slug);
                        setSearch("");
                        setTypeFilter("");
                        setMobileSidebarOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 text-sm transition-colors border-b border-border/30 flex items-center justify-between ${
                        isSelected
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground hover:bg-muted/50"
                      }`}
                    >
                      <span>{cat.name}</span>
                      <span className="text-[11px] text-muted-foreground">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── RIGHT PANEL: Test Management ── */}
          <div className="flex-1 min-w-0">
            {!selectedCategory ? (
              /* Empty state — no category selected */
              <div className="flex flex-col items-center justify-center h-full py-20 text-center px-6">
                <FlaskConical className="size-16 text-muted-foreground/20 mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground">Select a category</h3>
                <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">
                  Choose a category from the sidebar to manage its lab tests and packages.
                </p>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                {/* Category header bar */}
                <div className="px-5 py-3 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold">{selectedCatName}</h2>
                    <p className="text-xs text-muted-foreground">
                      {filteredTests?.length ?? 0} test{filteredTests?.length !== 1 ? "s" : ""} found
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder={`Search ${selectedCatName}...`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-9 w-[200px] rounded-lg border border-border bg-background pl-8 pr-3 text-xs"
                      />
                    </div>
                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
                    >
                      <option value="">All Types</option>
                      <option value="single">Single Test</option>
                      <option value="package">Package</option>
                    </select>
                    <Button
                      onClick={() => openCreate()}
                      size="sm"
                      className="gradient-primary text-white shadow-glow text-xs h-9"
                    >
                      <Plus className="mr-1 size-3" /> Add Test
                    </Button>
                  </div>
                </div>

                {/* Test table / grid */}
                <div className="flex-1 overflow-auto">
                  {filteredTests === undefined ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="size-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : filteredTests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center px-6">
                      <Beaker className="size-12 text-muted-foreground/30 mb-3" />
                      <h3 className="text-base font-semibold">
                        {search || typeFilter
                          ? "No tests match your filters"
                          : `No tests/packages added to ${selectedCatName} yet`}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {search || typeFilter
                          ? "Try adjusting your search or filters."
                          : "Click \"Add Test\" to create the first one."}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Test / Package</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Tests</TableHead>
                            <TableHead className="text-right">MRP</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredTests.map((t) => (
                            <TableRow key={t._id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {t.type === "package" ? <Beaker className="size-4 text-primary" /> : <FlaskConical className="size-4 text-blue-500" />}
                                  <div>
                                    <p className="font-medium text-sm">{t.name}</p>
                                    {t.promotionalBadges.length > 0 && (
                                      <span className="text-[10px] text-amber-600">{t.promotionalBadges.join(", ")}</span>
                                    )}
                                    {t.promotionalText && (
                                      <span className="text-[10px] text-green-600 ml-1">{t.promotionalText}</span>
                                    )}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs capitalize">{t.type}</Badge>
                              </TableCell>
                              <TableCell className="text-sm">{t.includedTestCount}</TableCell>
                              <TableCell className="text-right text-sm text-muted-foreground line-through">₹{t.originalPrice.toLocaleString("en-IN")}</TableCell>
                              <TableCell className="text-right text-sm font-bold">₹{t.discountedPrice.toLocaleString("en-IN")}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant={t.active ? "default" : "secondary"} className={`text-xs ${t.active ? "bg-green-100 text-green-700" : ""}`}>
                                  {t.active ? "Active" : "Inactive"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(t)}>
                                    <Pencil className="size-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() => handleToggleActive(t._id)}
                                  >
                                    {t.active ? "Deactivate" : "Activate"}
                                  </Button>
                                  <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setDeleteId(t._id)}>
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          BOOKINGS TAB (unchanged)
          ═══════════════════════════════════════ */}
      {tab === "bookings" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Search bookings..." value={bookingSearch} onChange={(e) => setBookingSearch(e.target.value)} className="pl-9 h-10 rounded-xl" />
            </div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm">
              <option value="">All Statuses</option>
              {BOOKING_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <Card className="border-border/60">
            <CardContent className="p-0">
              {bookings === undefined ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
              ) : bookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <CalendarClock className="size-12 text-muted-foreground/30 mb-3" />
                  <h3 className="text-lg font-semibold">No lab test bookings yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">Bookings will appear here when customers book lab tests</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Test / Package</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-center">Payment</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookings.map((b) => {
                        const bs = BOOKING_STATUSES.find((s) => s.value === b.bookingStatus);
                        const ps = PAYMENT_STATUSES.find((s) => s.value === b.paymentStatus);
                        return (
                          <TableRow key={b._id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{b.customerName}</p>
                                <p className="text-xs text-muted-foreground">{b.customerPhone}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm">{b.testName}</p>
                                <Badge variant="secondary" className="text-[10px] capitalize mt-0.5">{b.testType}</Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{b.categoryName}</TableCell>
                            <TableCell className="text-sm">{b.collectionDate}</TableCell>
                            <TableCell className="text-right text-sm font-bold">₹{b.finalAmount.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-center">
                              <Badge className={`text-[10px] ${ps?.color || ""}`}>{ps?.label || b.paymentStatus}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge className={`text-[10px] ${bs?.color || ""}`}>{bs?.label || b.bookingStatus}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" className="size-8" onClick={() => setDetailBooking(b)}>
                                <Eye className="size-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">{bookings?.length ?? 0} booking(s) total</p>
        </div>
      )}

      {/* ═══════════════════════════════════════
          ADD/EDIT DIALOG (unchanged)
          ═══════════════════════════════════════ */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Lab Test" : "Add Lab Test"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category *</label>
                <select value={form.categorySlug} onChange={(e) => setForm((f) => ({ ...f, categorySlug: e.target.value }))} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
                  <option value="">Select Category</option>
                  {LAB_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Test Type *</label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "single" | "package" }))} className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm">
                  <option value="single">Single Test</option>
                  <option value="package">Package</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Name *</label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Vitamin D Test" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description *</label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Short description" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Detailed Description</label>
              <textarea value={form.detailedDescription} onChange={(e) => setForm((f) => ({ ...f, detailedDescription: e.target.value }))} placeholder="Detailed description..." className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm min-h-[80px]" />
            </div>
            {form.type === "package" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Included Tests ({form.includedTestIds.length})</label>
                <div className="flex gap-2">
                  <Input value={newTestId} onChange={(e) => setNewTestId(e.target.value)} placeholder="Add test name" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTestId())} />
                  <Button type="button" variant="outline" onClick={addTestId}>Add</Button>
                </div>
                {form.includedTestIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {form.includedTestIds.map((id, idx) => (
                      <Badge key={idx} variant="secondary" className="gap-1 pr-1">
                        {id}
                        <button onClick={() => removeTestId(idx)} className="ml-1 rounded-full hover:bg-muted p-0.5"><Trash2 className="size-2.5" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">MRP (₹)</label>
                <Input type="number" value={form.originalPrice || ""} onChange={(e) => setForm((f) => ({ ...f, originalPrice: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Selling Price (₹)</label>
                <Input type="number" value={form.discountedPrice || ""} onChange={(e) => setForm((f) => ({ ...f, discountedPrice: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Discount %</label>
                <Input type="number" value={calcDiscount} readOnly className="bg-muted" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Report Time</label>
                <Input value={form.reportTime} onChange={(e) => setForm((f) => ({ ...f, reportTime: e.target.value }))} placeholder="e.g. 10-24 Hours" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Sample Type</label>
                <Input value={form.sampleType} onChange={(e) => setForm((f) => ({ ...f, sampleType: e.target.value }))} placeholder="e.g. Blood" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.fastingRequired} onChange={(e) => setForm((f) => ({ ...f, fastingRequired: e.target.checked }))} className="accent-[#0a3d2e]" />
                Fasting Required
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.homeCollectionAvailable} onChange={(e) => setForm((f) => ({ ...f, homeCollectionAvailable: e.target.checked }))} className="accent-[#0a3d2e]" />
                Home Collection Available
              </label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Service Area / Pincode</label>
              <Input value={form.serviceArea} onChange={(e) => setForm((f) => ({ ...f, serviceArea: e.target.value }))} placeholder="e.g. Mumbai, 400001" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Promotional Text</label>
              <Input value={form.promotionalText} onChange={(e) => setForm((f) => ({ ...f, promotionalText: e.target.value }))} placeholder="e.g. BEST PRICE EVER!" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="accent-[#0a3d2e]" />
              Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="gradient-primary text-white">
              {editingId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════
          DELETE DIALOG (unchanged)
          ═══════════════════════════════════════ */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Lab Test</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure? This cannot be undone. Existing bookings will retain their data.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════
          BOOKING DETAIL DIALOG (unchanged)
          ═══════════════════════════════════════ */}
      <Dialog open={!!detailBooking} onOpenChange={() => setDetailBooking(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Booking Details</DialogTitle></DialogHeader>
          {detailBooking && (
            <div className="space-y-5 py-4">
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Customer</h4>
                <div className="rounded-lg border p-3 text-sm space-y-1">
                  <p><span className="font-medium">Name:</span> {detailBooking.customerName}</p>
                  <p><span className="font-medium">Phone:</span> {detailBooking.customerPhone}</p>
                  <p><span className="font-medium">Email:</span> {detailBooking.customerEmail}</p>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Test Details</h4>
                <div className="rounded-lg border p-3 text-sm space-y-1">
                  <p><span className="font-medium">Test:</span> {detailBooking.testName}</p>
                  <p><span className="font-medium">Type:</span> {detailBooking.testType}</p>
                  <p><span className="font-medium">Category:</span> {detailBooking.categoryName}</p>
                  <p><span className="font-medium">MRP:</span> ₹{detailBooking.originalPrice.toLocaleString("en-IN")}</p>
                  <p><span className="font-medium">Price:</span> ₹{detailBooking.discountedPrice.toLocaleString("en-IN")}</p>
                  <p><span className="font-medium">Final Amount:</span> ₹{detailBooking.finalAmount.toLocaleString("en-IN")}</p>
                  <p><span className="font-medium">Collection:</span> {detailBooking.collectionType}</p>
                  {detailBooking.sampleType && <p><span className="font-medium">Sample:</span> {detailBooking.sampleType}</p>}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Appointment</h4>
                <div className="rounded-lg border p-3 text-sm space-y-1">
                  <p><span className="font-medium">Date:</span> {detailBooking.collectionDate}</p>
                  <p><span className="font-medium">Time:</span> {detailBooking.timeSlot}</p>
                  <p><span className="font-medium">Address:</span> {detailBooking.address}</p>
                  <p><span className="font-medium">Pincode:</span> {detailBooking.pincode}</p>
                  <p><span className="font-medium">Booked:</span> {new Date(detailBooking.createdAt).toLocaleString("en-IN")}</p>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Status Management</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Booking Status</label>
                    <select
                      value={detailBooking.bookingStatus}
                      onChange={(e) => {
                        handleBookingStatus(detailBooking._id, e.target.value);
                        setDetailBooking({ ...detailBooking, bookingStatus: e.target.value });
                      }}
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                    >
                      {BOOKING_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Payment Status</label>
                    <select
                      value={detailBooking.paymentStatus}
                      onChange={(e) => {
                        handlePaymentStatus(detailBooking._id, e.target.value);
                        setDetailBooking({ ...detailBooking, paymentStatus: e.target.value });
                      }}
                      className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                    >
                      {PAYMENT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
