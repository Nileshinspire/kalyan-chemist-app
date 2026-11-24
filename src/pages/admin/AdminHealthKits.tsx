import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  BadgePercent,
  BriefcaseMedical,
  Check,
  CircleDollarSign,
  Image as ImageIcon,
  Layers,
  Loader2,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/convex/_generated/api";
import { formatCurrency } from "@/lib/auth-utils";
import {
  clampKitDiscountPercent,
  computeAutoKitPrice,
  type KitPricingMode,
} from "@/lib/healthKitQuote";

type ComponentLine = {
  productId: string;
  quantity: number;
  name: string;
  imageUrl: string | null;
  packSize: string | null;
  mrp: number;
  effectivePrice: number;
  stockQuantity: number;
  availableKits: number;
};

type KitForm = {
  productId?: string;
  name: string;
  slug: string;
  description: string;
  categoryId: string;
  pricingMode: KitPricingMode;
  kitDiscountPercent: string;
  manualPrice: string;
  imageUrl: string;
  additionalImages: string;
  isActive: boolean;
  components: ComponentLine[];
};

const EMPTY_FORM: KitForm = {
  name: "",
  slug: "",
  description: "",
  categoryId: "",
  pricingMode: "auto",
  kitDiscountPercent: "0",
  manualPrice: "",
  imageUrl: "",
  additionalImages: "",
  isActive: true,
  components: [],
};

type DashboardView = "all" | "active" | "categories";

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function AdminHealthKits() {
  const kits = useQuery(api.adminHealthKits.list);
  const categories = useQuery(api.adminHealthKits.categoryList);
  const createKit = useMutation(api.adminHealthKits.create);
  const updateKit = useMutation(api.adminHealthKits.update);
  const removeKit = useMutation(api.adminHealthKits.remove);
  const toggleKit = useMutation(api.adminHealthKits.toggleActive);
  const generateUploadUrl = useMutation(api.adminHealthKits.generateImageUploadUrl);
  const resolveUploadedImage = useMutation(api.adminHealthKits.resolveUploadedImage);
  const createCategory = useMutation(api.adminHealthKits.createCategory);
  const updateCategory = useMutation(api.adminHealthKits.updateCategory);
  const removeCategory = useMutation(api.adminHealthKits.removeCategory);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<KitForm>(EMPTY_FORM);
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryImage, setNewCategoryImage] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [view, setView] = useState<DashboardView>("all");
  const [availabilityTarget, setAvailabilityTarget] = useState<any | null>(null);

  const productOptions = useQuery(api.adminHealthKits.productOptions, {
    search: productSearch.trim() || undefined,
  });

  const selectedIds = useMemo(
    () => new Set(form.components.map((line) => line.productId)),
    [form.components],
  );

  const pricingSummary = useMemo(() => {
    const catalogueMrp = form.components.reduce(
      (sum, line) => sum + line.mrp * line.quantity,
      0,
    );
    const effectiveCatalogueValue = form.components.reduce(
      (sum, line) => sum + line.effectivePrice * line.quantity,
      0,
    );
    const kitDiscountPercent = clampKitDiscountPercent(
      Number(form.kitDiscountPercent) || 0,
    );
    const autoPrice = computeAutoKitPrice(effectiveCatalogueValue, kitDiscountPercent);
    const manualPrice = Number(form.manualPrice);
    const finalPrice = form.pricingMode === "auto"
      ? autoPrice
      : Number.isFinite(manualPrice) && manualPrice > 0
        ? manualPrice
        : 0;
    return {
      catalogueMrp,
      effectiveCatalogueValue,
      productSavings: Math.max(0, catalogueMrp - effectiveCatalogueValue),
      kitDiscountPercent,
      kitDiscountAmount:
        form.pricingMode === "auto"
          ? Math.max(0, effectiveCatalogueValue - autoPrice)
          : 0,
      autoPrice,
      finalPrice,
      savings: Math.max(0, catalogueMrp - finalPrice),
      effectiveDiscountPercent:
        catalogueMrp > 0 ? Math.round(((catalogueMrp - finalPrice) / catalogueMrp) * 100) : 0,
      invalid:
        finalPrice <= 0 ||
        finalPrice > effectiveCatalogueValue + 0.001 ||
        (form.pricingMode === "manual" && !(manualPrice > 0)),
    };
  }, [form.components, form.kitDiscountPercent, form.pricingMode, form.manualPrice]);

  const visibleKits = useMemo(() => {
    const rows = kits ?? [];
    return view === "active" ? rows.filter((kit) => kit.isActive) : rows;
  }, [kits, view]);

  useEffect(() => {
    if (!form.categoryId && categories?.length) {
      setForm((current) => ({ ...current, categoryId: categories[0]._id }));
    }
  }, [categories, form.categoryId]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, categoryId: categories?.[0]?._id ?? "" });
    setSlugEdited(false);
    setProductSearch("");
    setDialogOpen(true);
  };

  const openEdit = (kit: any) => {
    setForm({
      productId: kit._id,
      name: kit.name,
      slug: kit.slug,
      description: kit.description,
      categoryId: kit.kitCategoryId ?? categories?.[0]?._id ?? "",
      pricingMode: kit.pricingMode === "auto" ? "auto" : "manual",
      kitDiscountPercent: String(kit.kitDiscountPercent ?? 0),
      manualPrice: String(kit.sellingPrice ?? kit.price ?? ""),
      imageUrl: kit.imageUrl ?? "",
      additionalImages: (kit.additionalImages ?? []).join("\n"),
      isActive: kit.isActive,
      components: (kit.components ?? []).map((line: any) => ({
        productId: line.productId,
        quantity: line.quantity,
        name: line.name,
        imageUrl: line.imageUrl,
        packSize: line.packSize,
        mrp: line.mrp ?? 0,
        effectivePrice: line.effectivePrice ?? line.mrp ?? 0,
        stockQuantity: line.stockQuantity ?? 0,
        availableKits: line.availableKits ?? 0,
      })),
    });
    setSlugEdited(true);
    setProductSearch("");
    setDialogOpen(true);
  };

  const addComponent = (product: any) => {
    setForm((current) => {
      if (current.components.some((line) => line.productId === product._id)) return current;
      return {
        ...current,
        components: [
          ...current.components,
          {
            productId: product._id,
            quantity: 1,
            name: product.name,
            imageUrl: product.imageUrl,
            packSize: product.packSize,
            mrp: product.mrp ?? product.price ?? 0,
            effectivePrice: product.effectivePrice ?? product.price ?? 0,
            stockQuantity: product.stockQuantity ?? 0,
            availableKits: Math.floor(
              Math.max(0, product.stockQuantity ?? 0) / Math.max(1, 1),
            ),
          },
        ],
      };
    });
  };

  const changeQuantity = (productId: string, delta: number) => {
    setForm((current) => ({
      ...current,
      components: current.components.map((line) =>
        line.productId === productId
          ? { ...line, quantity: Math.min(99, Math.max(1, line.quantity + delta)) }
          : line,
      ),
    }));
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!response.ok) throw new Error("Image upload failed");
      const body = (await response.json()) as { storageId?: string };
      if (!body.storageId) throw new Error("Image upload failed");
      const url = await resolveUploadedImage({ storageId: body.storageId as any });
      setForm((current) => ({ ...current, imageUrl: url }));
      toast.success("Kit image uploaded");
    } catch (error: any) {
      toast.error(error?.message || "Could not upload the image");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const submit = async () => {
    if (!form.categoryId) {
      toast.error("Create or select a kit category first");
      return;
    }
    if (form.components.length === 0) {
      toast.error("Add at least one product to the kit");
      return;
    }
    if (pricingSummary.invalid) {
      toast.error(
        form.pricingMode === "manual"
          ? "Enter a final price between ₹0.01 and the current effective catalogue value."
          : "This kit price is not valid. Check the kit discount.",
      );
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug || slugify(form.name),
        description: form.description,
        categoryId: form.categoryId as any,
        sellingPrice: pricingSummary.finalPrice,
        mrp: pricingSummary.catalogueMrp,
        pricingMode: form.pricingMode,
        kitDiscountPercent: pricingSummary.kitDiscountPercent,
        imageUrl: form.imageUrl.trim() || undefined,
        additionalImages: form.additionalImages
          .split("\n")
          .map((value) => value.trim())
          .filter(Boolean),
        isActive: form.isActive,
        components: form.components.map((line) => ({
          productId: line.productId as any,
          quantity: line.quantity,
        })),
      };
      if (form.productId) {
        await updateKit({ ...payload, productId: form.productId as any });
        toast.success("Health kit updated");
      } else {
        await createKit(payload);
        toast.success("Health kit created");
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast.error(error?.message || "Could not save the health kit");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await removeKit({ productId: deleteTarget._id });
      toast.success("Health kit deleted");
      setDeleteTarget(null);
    } catch (error: any) {
      toast.error(error?.message || "Could not delete the kit");
    } finally {
      setDeleting(false);
    }
  };

  const addCategory = async () => {
    setAddingCategory(true);
    try {
      await createCategory({
        name: newCategoryName,
        imageUrl: newCategoryImage.trim() || undefined,
      });
      setNewCategoryName("");
      setNewCategoryImage("");
      toast.success("Kit category added");
    } catch (error: any) {
      toast.error(error?.message || "Could not add the category");
    } finally {
      setAddingCategory(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <BriefcaseMedical className="size-6 text-primary" /> Health Kits
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Curated bundles built from existing catalogue products and inventory.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setCategoryOpen(true)}>
              <Settings2 className="size-4" /> Manage categories
            </Button>
            <Button onClick={openCreate}>
              <Plus className="size-4" /> Create Health Kit
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              key: "all" as const,
              label: "Total kits",
              description: "Every kit in the catalogue",
              value: kits?.length ?? 0,
              icon: BriefcaseMedical,
            },
            {
              key: "active" as const,
              label: "Active kits",
              description: "Visible to customers",
              value: kits?.filter((kit) => kit.isActive).length ?? 0,
              icon: Check,
            },
            {
              key: "categories" as const,
              label: "Kit categories",
              description: "Discovery groups",
              value: categories?.length ?? 0,
              icon: Layers,
            },
          ].map((stat) => {
            const Icon = stat.icon;
            const active = view === stat.key;
            return (
              <button
                key={stat.key}
                type="button"
                aria-pressed={active}
                onClick={() => setView(stat.key)}
                className={`text-left transition-all ${active ? "scale-[1.01]" : "hover:-translate-y-0.5"}`}
              >
                <Card className={active ? "border-primary/60 ring-1 ring-primary/20" : "border-border/60 hover:border-primary/30"}>
                  <CardContent className="flex items-center gap-3 pt-5">
                    <div className={`flex size-10 items-center justify-center rounded-xl ${active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="mt-0.5 text-2xl font-bold">{kits === undefined ? "—" : stat.value}</p>
                      <p className="text-[10px] text-muted-foreground">{stat.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">
                  {view === "categories"
                    ? "Kit categories"
                    : view === "active"
                      ? "Active health kits"
                      : "All health kits"}
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  {view === "categories"
                    ? "Categories and their live kit counts. Manage visibility and details with the existing category tools."
                    : `${visibleKits.length} kit${visibleKits.length === 1 ? "" : "s"} shown · Available Kits is the number of complete kits that can be fulfilled now.`}
                </p>
              </div>
              {view !== "all" && (
                <Button variant="ghost" size="sm" onClick={() => setView("all")}>
                  View all
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {kits === undefined ? (
              <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div>
            ) : view === "categories" ? (
              categories === undefined ? (
                <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-primary" /></div>
              ) : categories.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No kit categories yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Kits</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categories.map((category) => (
                        <TableRow key={category._id}>
                          <TableCell>
                            <div className="flex min-w-[180px] items-center gap-2.5">
                              <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary">
                                {category.imageUrl ? <img src={category.imageUrl} alt="" className="h-full w-full object-cover" /> : <Layers className="size-4" />}
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{category.name}</p>
                                <p className="text-[11px] text-muted-foreground">/{category.slug}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[320px] text-sm text-muted-foreground">
                            {category.description || "No description"}
                          </TableCell>
                          <TableCell className="text-sm">{category.kitCount}</TableCell>
                          <TableCell><Badge variant={category.isActive ? "default" : "secondary"}>{category.isActive ? "Visible" : "Hidden"}</Badge></TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" onClick={() => setCategoryOpen(true)}>Manage</Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : visibleKits.length === 0 ? (
              <div className="py-14 text-center">
                <BriefcaseMedical className="mx-auto size-10 text-primary/40" />
                <p className="mt-3 font-semibold">
                  {view === "active" ? "No active health kits" : "No health kits yet"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {view === "active"
                    ? "Activate a kit to make it visible to customers."
                    : "Create your first kit from existing products in the catalogue."}
                </p>
                {view === "active" ? (
                  <Button className="mt-4" variant="outline" onClick={() => setView("all")}>View all kits</Button>
                ) : (
                  <Button className="mt-4" onClick={openCreate}><Plus className="size-4" /> Create Health Kit</Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Kit</TableHead><TableHead>Category</TableHead><TableHead>Price</TableHead>
                      <TableHead>Contents</TableHead><TableHead>Available Kits</TableHead><TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleKits.map((kit) => (
                      <TableRow key={kit._id}>
                        <TableCell>
                          <div className="flex min-w-[190px] items-center gap-2.5">
                            <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white p-1">
                              {kit.imageUrl ? <img src={kit.imageUrl} alt="" className="h-full w-full object-contain" /> : <Package className="size-5 text-muted-foreground" />}
                            </div>
                            <div><p className="text-sm font-semibold">{kit.name}</p><p className="text-[11px] text-muted-foreground">/{kit.slug}</p></div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{kit.kitCategoryName}</TableCell>
                        <TableCell>
                          <p className="text-sm font-semibold">{formatCurrency(kit.sellingPrice)}</p>
                          {kit.savings > 0 && <p className="text-[11px] text-muted-foreground line-through">{formatCurrency(kit.mrp)}</p>}
                          <p className="text-[10px] text-primary">{kit.pricingMode === "auto" ? "Auto-priced" : "Manual price"}</p>
                        </TableCell>
                        <TableCell className="text-sm">{kit.componentCount} products</TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => setAvailabilityTarget(kit)}
                            className={`text-left text-xs font-medium underline-offset-2 hover:underline ${kit.available ? "text-emerald-700" : "text-destructive"}`}
                            title="Inspect the limiting included product"
                          >
                            {kit.available ? `${kit.maxQuantity} available` : "Unavailable"}
                            <span className="block text-[10px] font-normal text-muted-foreground">View breakdown</span>
                          </button>
                        </TableCell>
                        <TableCell><Badge variant={kit.isActive ? "default" : "secondary"}>{kit.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(kit)} title="Edit"><Pencil className="size-4" /></Button>
                            <Button
                              variant="ghost" size="icon" title={kit.isActive ? "Deactivate" : "Activate"}
                              onClick={() => toggleKit({ productId: kit._id, isActive: !kit.isActive }).then(() => toast.success(kit.isActive ? "Kit deactivated" : "Kit activated")).catch((error) => toast.error(error?.message || "Could not update kit"))}
                            >
                              {kit.isActive ? <X className="size-4" /> : <Check className="size-4" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(kit)} title="Delete"><Trash2 className="size-4" /></Button>
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
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>{form.productId ? "Edit Health Kit" : "Create Health Kit"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="kit-name">Kit name</Label>
              <Input id="kit-name" value={form.name} onChange={(event) => { const name = event.target.value; setForm((current) => ({ ...current, name, slug: slugEdited ? current.slug : slugify(name) })); }} placeholder="e.g. Home First Aid Kit" />
            </div>
            <div>
              <Label htmlFor="kit-slug">URL slug</Label>
              <Input id="kit-slug" value={form.slug} onChange={(event) => { setSlugEdited(true); setForm((current) => ({ ...current, slug: event.target.value })); }} />
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.categoryId} onValueChange={(value) => setForm((current) => ({ ...current, categoryId: value }))}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>{(categories ?? []).map((category) => <SelectItem key={category._id} value={category._id}>{category.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="kit-description">Description</Label>
              <Textarea id="kit-description" rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="A short description of who this kit is for and what it helps with." />
            </div>
            <div>
              <Label htmlFor="kit-price">Selling price (₹)</Label>
              <Input id="kit-price" type="number" min={0.01} step="0.01" value={form.sellingPrice} onChange={(event) => setForm((current) => ({ ...current, sellingPrice: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="kit-mrp">Compare-at price (₹, optional)</Label>
              <Input id="kit-mrp" type="number" min={0} step="0.01" value={form.mrp} onChange={(event) => setForm((current) => ({ ...current, mrp: event.target.value }))} placeholder="Leave blank for no discount" />
            </div>
            <div className="sm:col-span-2">
              <Label>Kit image</Label>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white p-1">
                  {form.imageUrl ? <img src={form.imageUrl} alt="" className="h-full w-full object-contain" /> : <ImageIcon className="size-6 text-muted-foreground" />}
                </div>
                <div className="flex-1 space-y-2">
                  <Input value={form.imageUrl} onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))} placeholder="https://… public image URL" />
                  <div className="flex items-center gap-2">
                    <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(event) => handleUpload(event.target.files?.[0])} />
                    <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
                      {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Upload image
                    </Button>
                    <span className="text-[11px] text-muted-foreground">JPG, PNG or WebP</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="kit-gallery">Additional image URLs (one per line, optional)</Label>
              <Textarea id="kit-gallery" rows={2} value={form.additionalImages} onChange={(event) => setForm((current) => ({ ...current, additionalImages: event.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} className="size-4 accent-[var(--primary)]" />
              Active — visible to customers
            </label>
          </div>

          <div className="mt-2 rounded-xl border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-sm font-semibold">Included products</p><p className="text-[11px] text-muted-foreground">Reuse existing catalogue products. Quantities are per kit.</p></div>
              <Badge variant="secondary">{form.components.length} selected</Badge>
            </div>
            {form.components.length > 0 && (
              <div className="mt-3 space-y-2">
                {form.components.map((line) => (
                  <div key={line.productId} className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2">
                    <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-white p-1">
                      {line.imageUrl ? <img src={line.imageUrl} alt="" className="h-full w-full object-contain" /> : <Package className="size-4 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{line.name}</p><p className="text-[10px] text-muted-foreground">{line.packSize}</p></div>
                    <div className="flex items-center rounded-full border bg-background">
                      <button type="button" className="flex size-7 items-center justify-center" onClick={() => changeQuantity(line.productId, -1)}><Minus className="size-3" /></button>
                      <span className="w-5 text-center text-xs font-semibold">{line.quantity}</span>
                      <button type="button" className="flex size-7 items-center justify-center" onClick={() => changeQuantity(line.productId, 1)}><Plus className="size-3" /></button>
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground" onClick={() => setForm((current) => ({ ...current, components: current.components.filter((item) => item.productId !== line.productId) }))}><X className="size-3.5" /></Button>
                  </div>
                ))}
              </div>
            )}
            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Search products to include…" className="pl-9" />
            </div>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border">
              {productOptions === undefined ? (
                <div className="flex justify-center p-4"><Loader2 className="size-4 animate-spin" /></div>
              ) : productOptions.length === 0 ? (
                <p className="p-4 text-center text-xs text-muted-foreground">No matching products.</p>
              ) : (
                productOptions.map((product) => (
                  <button key={product._id} type="button" disabled={selectedIds.has(product._id)} onClick={() => addComponent(product)} className="flex w-full items-center gap-2 border-b px-3 py-2 text-left last:border-b-0 hover:bg-muted/50 disabled:opacity-50">
                    <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded bg-white p-0.5">
                      {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-contain" /> : <Package className="size-3.5 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{product.name}</p><p className="text-[10px] text-muted-foreground">{product.packSize} · {formatCurrency(product.price)} · {product.stockQuantity} in stock</p></div>
                    {selectedIds.has(product._id) ? <Check className="size-3.5 text-primary" /> : <Plus className="size-3.5 text-muted-foreground" />}
                  </button>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}{form.productId ? "Save changes" : "Create kit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Delete “{deleteTarget?.name}”?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This removes the kit from the storefront and from customer carts. Included products and their inventory are not deleted.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>{deleting && <Loader2 className="size-4 animate-spin" />}Delete kit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={categoryOpen} onOpenChange={setCategoryOpen}>
        <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>Health kit categories</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Categories control the discovery shortcuts on the customer Health Kits page. Deactivating one hides it and its kits from the storefront.</p>
          <div className="space-y-2">
            {(categories ?? []).map((category) => (
              <div key={category._id} className="flex items-center gap-2 rounded-lg border p-2">
                <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 text-primary">
                  {category.imageUrl ? <img src={category.imageUrl} alt="" className="h-full w-full object-cover" /> : <Package className="size-4" />}
                </div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{category.name}</p><p className="text-[10px] text-muted-foreground">{category.kitCount} kits</p></div>
                <Button variant="outline" size="sm" onClick={() => updateCategory({ categoryId: category._id, name: category.name, description: category.description, imageUrl: category.imageUrl, isActive: !category.isActive, sortOrder: category.sortOrder }).then(() => toast.success(category.isActive ? "Category hidden" : "Category visible")).catch((error) => toast.error(error?.message || "Could not update category"))}>{category.isActive ? "Hide" : "Show"}</Button>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => removeCategory({ categoryId: category._id }).then(() => toast.success("Category deleted")).catch((error) => toast.error(error?.message || "Could not delete category"))}><Trash2 className="size-4" /></Button>
              </div>
            ))}
          </div>
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="mb-2 text-sm font-semibold">Add category</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Input value={newCategoryName} onChange={(event) => setNewCategoryName(event.target.value)} placeholder="Category name" />
              <Input value={newCategoryImage} onChange={(event) => setNewCategoryImage(event.target.value)} placeholder="Image URL (optional)" />
            </div>
            <Button className="mt-2" size="sm" onClick={addCategory} disabled={addingCategory || !newCategoryName.trim()}>{addingCategory && <Loader2 className="size-4 animate-spin" />}Add category</Button>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setCategoryOpen(false)}>Done</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
