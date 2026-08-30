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
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [detailBooking, setDetailBooking] = useState<any>(null);
  const [newTestId, setNewTestId] = useState("");

  /* Queries */
  const tests = useQuery(api.labTests.adminList, {
    categorySlug: categoryFilter || undefined,
    type: (typeFilter as "single" | "package") || undefined,
    search: search || undefined,
  });
  const bookings = useQuery(api.labTests.bookingsList, {
    status: statusFilter || undefined,
    search: search || undefined,
  });

  /* Mutations */
  const createTest = useMutation(api.labTests.create);
  const updateTest = useMutation(api.labTests.update);
  const removeTest = useMutation(api.labTests.remove);
  const toggleActive = useMutation(api.labTests.toggleActive);
  const updateBookingStatus = useMutation(api.labTests.updateBookingStatus);
  const updatePaymentStatus = useMutation(api.labTests.updatePaymentStatus);

  /* Handlers */
  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setFormOpen(true);
  }, []);

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

  /* Auto-calc discount */
  const calcDiscount = useMemo(() => {
    if (form.originalPrice > 0 && form.discountedPrice > 0) {
      return Math.round(((form.originalPrice - form.discountedPrice) / form.originalPrice) * 100);
    }
    return 0;
  }, [form.originalPrice, form.discountedPrice]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lab Tests</h1>
          <p className="text-sm text-muted-foreground">Manage lab test categories, packages, and bookings</p>
        </div>
        {tab === "manage" && (
          <Button onClick={openCreate} className="gradient-primary text-white shadow-glow">
            <Plus className="mr-2 size-4" /> Add Lab Test
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted p-1 w-fit">
        <button
          onClick={() => { setTab("manage"); setSearch(""); }}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${tab === "manage" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <FlaskConical className="size-4" /> Manage Lab Tests
        </button>
        <button
          onClick={() => { setTab("bookings"); setSearch(""); }}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${tab === "bookings" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <CalendarClock className="size-4" /> Booked Tests
        </button>
      </div>

      {/* ─── MANAGE TAB ─── */}
      {tab === "manage" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Search tests..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl" />
            </div>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm">
              <option value="">All Categories</option>
              {LAB_CATEGORIES.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm">
              <option value="">All Types</option>
              <option value="single">Single Test</option>
              <option value="package">Package</option>
            </select>
          </div>

          {/* Table */}
          <Card className="border-border/60">
            <CardContent className="p-0">
              {tests === undefined ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
              ) : tests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <FlaskConical className="size-12 text-muted-foreground/30 mb-3" />
                  <h3 className="text-lg font-semibold">No lab tests found</h3>
                  <p className="text-sm text-muted-foreground mt-1">Add your first lab test to get started</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Test / Package</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Tests</TableHead>
                        <TableHead className="text-right">MRP</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tests.map((t) => (
                        <TableRow key={t._id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {t.type === "package" ? <Beaker className="size-4 text-primary" /> : <FlaskConical className="size-4 text-blue-500" />}
                              <div>
                                <p className="font-medium text-sm">{t.name}</p>
                                {t.promotionalBadges.length > 0 && (
                                  <span className="text-[10px] text-amber-600">{t.promotionalBadges.join(", ")}</span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{t.categoryName}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-xs capitalize">{t.type}</Badge></TableCell>
                          <TableCell className="text-sm">{t.includedTestCount}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground line-through">₹{t.originalPrice}</TableCell>
                          <TableCell className="text-right text-sm font-bold">₹{t.discountedPrice}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={t.active ? "default" : "secondary"} className={`text-xs ${t.active ? "bg-green-100 text-green-700" : ""}`}>
                              {t.active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(t)}><Pencil className="size-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="size-8" onClick={() => handleToggleActive(t._id)}>
                                {t.active ? "Deactivate" : "Activate"}
                              </Button>
                              <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setDeleteId(t._id)}><Trash2 className="size-3.5" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">{tests?.length ?? 0} test(s) total</p>
        </div>
      )}

      {/* ─── BOOKINGS TAB ─── */}
      {tab === "bookings" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input placeholder="Search bookings..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl" />
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
                            <TableCell className="text-right text-sm font-bold">₹{b.finalAmount}</TableCell>
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

      {/* ─── ADD/EDIT DIALOG ─── */}
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
            {/* Included Tests (for packages) */}
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

      {/* ─── DELETE DIALOG ─── */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Lab Test</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── BOOKING DETAIL DIALOG ─── */}
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
                  <p><span className="font-medium">MRP:</span> ₹{detailBooking.originalPrice}</p>
                  <p><span className="font-medium">Price:</span> ₹{detailBooking.discountedPrice}</p>
                  <p><span className="font-medium">Final Amount:</span> ₹{detailBooking.finalAmount}</p>
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
