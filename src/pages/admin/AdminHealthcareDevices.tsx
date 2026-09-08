import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  Package,
  Loader2,
  X,
  Wand2,
  Activity,
  ArrowLeft,
  Eye,
} from "lucide-react";
import { useNavigate } from "react-router";

/* ─── Admin → Healthcare Devices ───
 * A SEPARATE admin management view for medical monitoring/equipment products.
 * This is NOT a second product system: it uses the EXISTING product table,
 * the EXISTING adminProducts mutations, and the EXISTING category system
 * (the 6 healthcare-device categories). Products added here appear
 * automatically under the customer-side homepage "Healthcare Devices"
 * categories. No duplicate products, inventory, pricing, or categories.
 */

const DEVICE_CATEGORIES = [
  { name: "BP Monitors", slug: "bp-monitors" },
  { name: "Glucometers", slug: "glucometers" },
  { name: "Pulse Oximeters", slug: "pulse-oximeters" },
  { name: "Nebulizers", slug: "nebulizers" },
  { name: "Digital Thermometers", slug: "digital-thermometers" },
  { name: "Weighing Scales", slug: "weighing-scales" },
];

const DEVICE_SLUGS = new Set(DEVICE_CATEGORIES.map((c) => c.slug));

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/* Device icons — same minimal line-art identity as the homepage section */
function DeviceIcon({ slug }: { slug: string }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "size-6",
    "aria-hidden": true,
  };
  switch (slug) {
    case "bp-monitors":
      return (
        <svg {...common}>
          <circle cx="12" cy="8.2" r="4.9" />
          <polyline points="9.4 8.2 10.5 8.2 11.2 6.7 12.1 9.6 12.9 8.2 14.6 8.2" />
          <path d="M12 13.1c0 1.4-.3 2-1.9 2.5" />
          <rect x="7" y="15.6" width="10" height="4.3" rx="2.1" />
          <path d="M9.8 15.6v4.3" />
          <path d="M12 15.6v4.3" />
        </svg>
      );
    case "glucometers":
      return (
        <svg {...common}>
          <rect x="4.5" y="3.5" width="11" height="16.5" rx="2.6" />
          <rect x="6.6" y="6" width="6.8" height="4.6" rx="1" />
          <path d="M8.2 8h3.6" />
          <path d="M8.2 9.6h2.2" />
          <circle cx="10" cy="14.6" r="1.2" />
          <path d="M8.3 17h3.4" />
          <path d="M18.4 10.6c1.2 1.5 2.3 2.7 2.3 3.9a2.3 2.3 0 0 1-4.6 0c0-1.2 1.1-2.4 2.3-3.9z" />
        </svg>
      );
    case "pulse-oximeters":
      return (
        <svg {...common}>
          <path d="M8.4 7.2c0-2 1.6-3.4 3.6-3.4s3.6 1.4 3.6 3.4" />
          <path d="M8.4 7.2c0 2 1.6 3.4 3.6 3.4s3.6-1.4 3.6-3.4" />
          <rect x="9.2" y="8.6" width="5.6" height="1.7" rx="0.85" />
          <polyline points="8.8 14.2 10.1 14.2 10.9 12.8 11.9 15.5 12.7 14.2 15.2 14.2" />
        </svg>
      );
    case "nebulizers":
      return (
        <svg {...common}>
          <path d="M9.8 5h1.2" />
          <path d="M12.4 3.8h1.2" />
          <path d="M14.6 5h1" />
          <path d="M9 11.6c0-2.1 1.3-3.7 3-3.7s3 1.6 3 3.7" />
          <path d="M9 11.6h6" />
          <path d="M12 11.6v1.4" />
          <rect x="6.5" y="13" width="11" height="6" rx="2.5" />
          <path d="M12 14.2v3.6" />
          <path d="M10.2 16h3.6" />
        </svg>
      );
    case "digital-thermometers":
      return (
        <svg {...common}>
          <path d="M12 8.5V5.4" />
          <rect x="7.2" y="8.5" width="9.6" height="11.5" rx="2.7" />
          <rect x="9.4" y="11" width="5.2" height="4.2" rx="1.1" />
          <path d="M10.8 13.1h2.4" />
          <path d="M10.8 14.4h1.6" />
          <circle cx="12" cy="17.4" r="0.85" />
        </svg>
      );
    case "weighing-scales":
      return (
        <svg {...common}>
          <rect x="3.8" y="8.5" width="16.4" height="11.5" rx="3" />
          <circle cx="12" cy="14.2" r="4" />
          <path d="M12 14.2l2.4-1.7" />
          <path d="M10.2 12l-.7-.9" />
          <path d="M13.9 16.4l.7.9" />
          <path d="M8.6 14.2h1" />
          <path d="M14.4 14.2h1" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="18" rx="2.5" />
          <path d="M9 3v2" />
          <path d="M15 3v2" />
          <path d="M9 21v-2" />
          <path d="M15 21v-2" />
        </svg>
      );
  }
}

interface DeviceForm {
  name: string;
  slug: string;
  description: string;
  composition: string;
  price: number;
  discountPrice: number | undefined;
  categoryId: string;
  brandId: string | undefined;
  imageUrl: string | undefined;
  manufacturer: string;
  dosage: string;
  packSize: string;
  packSizeVariants: Array<{ label: string; price: number; discountPrice?: number; stockQuantity: number; sku?: string }>;
  strength: string;
  form: string;
  sku: string;
  prescriptionRequired: boolean;
  storageInformation: string;
  stockQuantity: number;
  benefits: string;
  consumeType: string;
  safetyNote: string;
  expiryDate: string;
  additionalImages: string[];
  isActive: boolean;
}

const EMPTY_FORM: DeviceForm = {
  name: "",
  slug: "",
  description: "",
  composition: "",
  price: 0,
  discountPrice: undefined,
  categoryId: "",
  brandId: undefined,
  imageUrl: undefined,
  manufacturer: "",
  dosage: "",
  packSize: "",
  packSizeVariants: [],
  strength: "",
  form: "",
  sku: "",
  prescriptionRequired: false,
  storageInformation: "",
  stockQuantity: 0,
  benefits: "",
  consumeType: "",
  safetyNote: "",
  expiryDate: "",
  additionalImages: [],
  isActive: true,
};

const FORM_OPTIONS = ["tablet", "capsule", "syrup", "injection", "cream", "gel", "ointment", "lotion", "drops", "nasal drops", "spray", "inhaler", "powder", "sachet", "balm", "strip", "other"];

export default function AdminHealthcareDevices() {
  const navigate = useNavigate();
  const [selectedSlug, setSelectedSlug] = useState<string>(DEVICE_CATEGORIES[0].slug);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [form, setForm] = useState<DeviceForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);

  const categories = useQuery(api.adminCategories.list, {});
  const hierarchicalCategories = useQuery(api.adminCategories.listHierarchical);
  const brands = useQuery(api.adminBrands.list, { isActive: true });

  // The selected device category object (real category from the shared system)
  const selectedCategory =
    categories?.find((c: any) => c.slug === selectedSlug) ?? null;

  // Products in the selected device category — REAL existing product data
  const products = useQuery(
    api.adminProducts.list,
    selectedCategory
      ? { categoryId: selectedCategory._id, sortBy: "createdAt", sortOrder: "desc" }
      : "skip"
  );

  const createProduct = useMutation(api.adminProducts.create);
  const updateProduct = useMutation(api.adminProducts.update);
  const deleteProduct = useMutation(api.adminProducts.remove);
  const toggleActive = useMutation(api.adminProducts.toggleActive);
  const enrichProductAction = useAction(api.productBackfill.enrichProduct);

  // Keep the selection valid once categories load (defaults to BP Monitors)
  useEffect(() => {
    if (categories && !DEVICE_SLUGS.has(selectedSlug)) {
      setSelectedSlug(DEVICE_CATEGORIES[0].slug);
    }
  }, [categories, selectedSlug]);

  const openCreate = () => {
    if (!selectedCategory) return;
    setEditingProduct(null);
    setForm({ ...EMPTY_FORM, categoryId: selectedCategory._id });
    setDialogOpen(true);
  };

  const openEdit = (product: any) => {
    setEditingProduct(product._id);
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description,
      composition: product.composition || "",
      price: product.price,
      discountPrice: product.discountPrice,
      categoryId: product.categoryId,
      brandId: product.brandId,
      imageUrl: product.imageUrl,
      manufacturer: product.manufacturer,
      dosage: product.dosage || "",
      packSize: product.packSize,
      packSizeVariants: product.packSizeVariants || [],
      strength: product.strength || "",
      form: product.form || "",
      sku: product.sku || "",
      prescriptionRequired: product.prescriptionRequired,
      storageInformation: product.storageInformation || "",
      stockQuantity: product.stockQuantity,
      benefits: product.benefits || "",
      consumeType: product.consumeType || "",
      safetyNote: product.safetyNote || "",
      expiryDate: product.expiryDate ? new Date(product.expiryDate).toISOString().split("T")[0] : "",
      additionalImages: product.additionalImages || [],
      isActive: product.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.description || !form.categoryId || !form.manufacturer || !form.packSize) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSaving(true);
    try {
      const slug = form.slug || slugify(form.name);
      const data = {
        name: form.name,
        slug,
        description: form.description,
        composition: form.composition || undefined,
        price: form.price,
        discountPrice: form.discountPrice || undefined,
        categoryId: form.categoryId as any,
        brandId: (form.brandId || undefined) as any,
        imageUrl: form.imageUrl || undefined,
        additionalImages: form.additionalImages.length > 0 ? form.additionalImages : undefined,
        manufacturer: form.manufacturer,
        dosage: form.dosage || undefined,
        packSize: form.packSize,
        packSizeVariants: form.packSizeVariants.length > 0 ? form.packSizeVariants : undefined,
        strength: form.strength || undefined,
        form: form.form || undefined,
        sku: form.sku || undefined,
        prescriptionRequired: form.prescriptionRequired,
        storageInformation: form.storageInformation || undefined,
        stockQuantity: form.stockQuantity,
        benefits: form.benefits || undefined,
        consumeType: form.consumeType || undefined,
        safetyNote: form.safetyNote || undefined,
        expiryDate: form.expiryDate ? new Date(form.expiryDate).getTime() : undefined,
        isActive: form.isActive,
      };

      if (editingProduct) {
        await updateProduct({ productId: editingProduct as any, ...data });
        toast.success("Device updated successfully");
      } else {
        await createProduct(data);
        toast.success("Device added successfully");
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save device");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (productId: string) => {
    try {
      await deleteProduct({ productId: productId as any });
      toast.success("Device deleted");
      setDeleteConfirm(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete device");
    }
  };

  const handleAutoFillAll = async () => {
    if (!form.name.trim()) {
      toast.error("Please enter a product name first");
      return;
    }
    setAutoFilling(true);
    try {
      const brand = brands?.find((b) => b._id === form.brandId)?.name;
      const result = await enrichProductAction({
        productName: form.name,
        manufacturer: form.manufacturer || undefined,
        brand: brand || undefined,
        composition: form.composition || undefined,
        form: form.form || undefined,
      });

      const newForm = { ...form };
      const filled: string[] = [];

      if (result.imageUrl) {
        newForm.imageUrl = result.imageUrl;
        filled.push("Image");
      }
      if (result.description) {
        newForm.description = result.description;
        filled.push("Description");
      }
      if (result.benefits) {
        newForm.benefits = result.benefits;
        filled.push("Benefits");
      }
      if ((result as any).consumeType) {
        newForm.consumeType = (result as any).consumeType;
        filled.push("Consume Type");
      }
      if ((result as any).safetyNote) {
        newForm.safetyNote = (result as any).safetyNote;
        filled.push("Safety Note");
      }
      if (result.manufacturer) {
        newForm.manufacturer = result.manufacturer;
        filled.push("Manufacturer");
      }
      if ((result as any).composition) {
        newForm.composition = (result as any).composition;
        filled.push("Composition");
      }
      if ((result as any).form) {
        newForm.form = (result as any).form;
        filled.push("Form");
      }
      if ((result as any).expiryDate) {
        newForm.expiryDate = (result as any).expiryDate;
        filled.push("Expiry Date");
      }
      if ((result as any).storageInformation) {
        newForm.storageInformation = (result as any).storageInformation;
        filled.push("Storage Information");
      }

      setForm(newForm);

      if (filled.length > 0) {
        toast.success(`Auto-filled: ${filled.join(", ")} for "${form.name}"`);
      } else {
        toast.info(`Could not find reliable information for "${form.name}". Please fill in manually.`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to auto-fill product information");
    } finally {
      setAutoFilling(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Healthcare Devices</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage medical monitoring &amp; equipment products separately from medicines. These use the
              same product, category and inventory systems — products added here appear automatically on
              the customer homepage under the matching Healthcare Devices category.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate("/")} className="gap-1.5">
              <Eye className="size-4" /> View Store Section
            </Button>
            <Button onClick={openCreate} disabled={!selectedCategory} className="gradient-primary text-white shadow-glow">
              <Plus className="mr-2 size-4" /> Add Device
            </Button>
          </div>
        </motion.div>

        {/* Device category picker */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {DEVICE_CATEGORIES.map((cat) => {
            const live = categories?.find((c: any) => c.slug === cat.slug);
            const count = live?.productCount ?? 0;
            const isSelected = selectedSlug === cat.slug;
            return (
              <button
                key={cat.slug}
                type="button"
                onClick={() => setSelectedSlug(cat.slug)}
                className={`group flex flex-col items-center rounded-xl border p-4 text-center transition-all duration-300 cursor-pointer ${
                  isSelected
                    ? "border-primary/40 bg-primary/5 shadow-md"
                    : "border-border/60 bg-card shadow-sm hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md"
                }`}
              >
                <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl transition-colors duration-300 ${
                  isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                }`}>
                  <DeviceIcon slug={cat.slug} />
                </span>
                <span className={`mt-2.5 text-xs sm:text-sm font-semibold leading-snug ${isSelected ? "text-primary" : "text-foreground group-hover:text-primary"} transition-colors`}>
                  {cat.name}
                </span>
                <Badge variant="secondary" className="mt-1.5 text-[10px]">
                  {count} {count === 1 ? "device" : "devices"}
                </Badge>
              </button>
            );
          })}
        </div>

        {/* Products in the selected device category */}
        <Card className="border-border/60">
          <CardContent className="p-0">
            {products === undefined ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Activity className="size-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">No devices in {selectedCategory?.name ?? "this category"}</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                  Add a device product and it will appear automatically on the customer homepage under{" "}
                  {selectedCategory?.name ?? "this category"} — and in the normal Products listing.
                </p>
                <Button onClick={openCreate} disabled={!selectedCategory} className="mt-5 gradient-primary text-white">
                  <Plus className="mr-2 size-4" /> Add First Device
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-center">Stock</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product: any) => (
                    <TableRow key={product._id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt={product.name} className="size-10 rounded-lg object-cover bg-muted" />
                          ) : (
                            <div className="size-10 rounded-lg bg-muted flex items-center justify-center">
                              <Package className="size-4 text-muted-foreground" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-sm">{product.name}</p>
                            {product.manufacturer && (
                              <p className="text-xs text-muted-foreground">{product.manufacturer}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{product.price}
                        {product.discountPrice && product.discountPrice < product.price && (
                          <span className="block text-xs text-muted-foreground line-through">₹{product.discountPrice}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={product.stockQuantity > 0 ? "secondary" : "destructive"} className="text-xs">
                          {product.stockQuantity}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={product.isActive ? "default" : "secondary"} className={`text-xs ${product.isActive ? "bg-green-100 text-green-700" : ""}`}>
                          {product.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(product)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => toggleActive({ productId: product._id, isActive: !product.isActive })}>
                            {product.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setDeleteConfirm(product._id)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          {products?.length ?? 0} device(s) in {selectedCategory?.name ?? "selected category"} — stock and pricing are
          managed through the same inventory system as all products.
        </p>

        {/* Add/Edit Device Dialog — same product form/data structure as Products */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProduct ? "Edit Device" : "Add Device"}
                {selectedCategory ? ` — ${selectedCategory.name}` : ""}
              </DialogTitle>
            </DialogHeader>
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
              <span className="font-medium text-primary">Device Category:</span>{" "}
              <span className="text-muted-foreground">{selectedCategory?.name ?? "—"}</span>
              <span className="block text-[11px] text-muted-foreground mt-0.5">
                This device is stored in the {selectedCategory?.name ?? ""} category and appears on the customer
                homepage under Healthcare Devices.
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Name *</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1.5 h-7"
                    onClick={handleAutoFillAll}
                    disabled={autoFilling || !form.name.trim()}
                  >
                    {autoFilling ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Wand2 className="size-3" />
                    )}
                    Auto Fill
                  </Button>
                </div>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugify(e.target.value) })} placeholder="e.g. Omron HEM-7120 BP Monitor" />
                <p className="text-[11px] text-muted-foreground">Enter device name, then click Auto Fill to auto-populate product information.</p>
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="Auto-generated from name" />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Description *</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Device description" />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Composition</Label>
                <Input value={form.composition} onChange={(e) => setForm({ ...form, composition: e.target.value })} placeholder="e.g. Features / components (optional)" />
              </div>
              <div className="space-y-2">
                <Label>Brand</Label>
                <Select value={form.brandId || ""} onValueChange={(v) => setForm({ ...form, brandId: v || undefined })}>
                  <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Brand</SelectItem>
                    {brands?.map((b) => (
                      <SelectItem key={b._id} value={b._id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Manufacturer *</Label>
                <Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} placeholder="e.g. Omron Healthcare" />
              </div>
              <div className="space-y-2">
                <Label>MRP (₹) *</Label>
                <Input type="number" value={form.price || ""} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Selling Price (₹)</Label>
                <Input type="number" value={form.discountPrice || ""} onChange={(e) => setForm({ ...form, discountPrice: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="Leave empty if no discount" />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="e.g. KC-BP-7120" />
              </div>
              <div className="space-y-2">
                <Label>Pack Size *</Label>
                <Input value={form.packSize} onChange={(e) => setForm({ ...form, packSize: e.target.value })} placeholder="e.g. 1 unit" />
              </div>
              <div className="space-y-2">
                <Label>Form</Label>
                <Select value={form.form || undefined} onValueChange={(v) => setForm({ ...form, form: v })}>
                  <SelectTrigger><SelectValue placeholder="Select form (optional)" /></SelectTrigger>
                  <SelectContent>
                    {FORM_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dosage</Label>
                <Input value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="Optional" />
              </div>
              <div className="space-y-2">
                <Label>Strength</Label>
                <Input value={form.strength} onChange={(e) => setForm({ ...form, strength: e.target.value })} placeholder="e.g. 220-280 mmHg (optional)" />
              </div>
              <div className="space-y-2">
                <Label>Stock Quantity *</Label>
                <Input type="number" value={form.stockQuantity || ""} onChange={(e) => setForm({ ...form, stockQuantity: parseInt(e.target.value) || 0 })} placeholder="0" />
              </div>
              {/* Pack Size Variants */}
              <div className="sm:col-span-2 space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Pack Size Variants (optional)</Label>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1"
                    onClick={() => setForm({ ...form, packSizeVariants: [...form.packSizeVariants, { label: "", price: form.price, stockQuantity: 0 }] })}
                  >
                    + Add Variant
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Add different pack sizes with individual prices and stock. Leave empty if only one pack size.</p>
                {form.packSizeVariants.length > 0 && (
                  <div className="space-y-2 mt-2">
                    {form.packSizeVariants.map((v, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg border border-border/60 bg-muted/20">
                        <Input value={v.label} onChange={(e) => {
                          const next = [...form.packSizeVariants];
                          next[i] = { ...next[i], label: e.target.value };
                          setForm({ ...form, packSizeVariants: next });
                        }} placeholder="e.g. 27.5 ml" className="h-8 text-xs flex-1" />
                        <Input type="number" value={v.price || ""} onChange={(e) => {
                          const next = [...form.packSizeVariants];
                          next[i] = { ...next[i], price: parseFloat(e.target.value) || 0 };
                          setForm({ ...form, packSizeVariants: next });
                        }} placeholder="Price" className="h-8 text-xs w-24" />
                        <Input type="number" value={v.stockQuantity || ""} onChange={(e) => {
                          const next = [...form.packSizeVariants];
                          next[i] = { ...next[i], stockQuantity: parseInt(e.target.value) || 0 };
                          setForm({ ...form, packSizeVariants: next });
                        }} placeholder="Stock" className="h-8 text-xs w-20" />
                        <Button type="button" variant="ghost" size="icon" className="size-7 text-destructive hover:text-destructive"
                          onClick={() => setForm({ ...form, packSizeVariants: form.packSizeVariants.filter((_, j) => j !== i) })}
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Product Image</Label>
                <Input value={form.imageUrl || ""} onChange={(e) => setForm({ ...form, imageUrl: e.target.value || undefined })} placeholder="https://... or click Auto-fetch" />
                {form.imageUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="size-16 rounded-lg border border-border/60 bg-muted/30 flex items-center justify-center overflow-hidden">
                      <img src={form.imageUrl} alt="Preview" className="size-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => setForm({ ...form, imageUrl: undefined })}>
                      <X className="size-3 mr-1" /> Remove
                    </Button>
                  </div>
                )}
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Additional Product Images (Gallery)</Label>
                <p className="text-[11px] text-muted-foreground">Enter image URLs for additional product views/angles. These appear as selectable thumbnails on the product page.</p>
                {form.additionalImages.map((img, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input value={img} onChange={(e) => { const imgs = [...form.additionalImages]; imgs[idx] = e.target.value; setForm({ ...form, additionalImages: imgs }); }} placeholder="https://... additional image URL" className="flex-1" />
                    <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive shrink-0" onClick={() => { const imgs = form.additionalImages.filter((_, i) => i !== idx); setForm({ ...form, additionalImages: imgs }); }}>
                      <X className="size-3" />
                    </Button>
                  </div>
                ))}
                {form.additionalImages.length < 4 && (
                  <Button type="button" variant="outline" size="sm" className="text-xs gap-1" onClick={() => setForm({ ...form, additionalImages: [...form.additionalImages, ""] })}>
                    <Plus className="size-3" /> Add Image URL
                  </Button>
                )}
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Benefits</Label>
                <Input value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} placeholder="e.g. Accurate readings in 30 seconds" />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Consumption Type</Label>
                <Input value={form.consumeType} onChange={(e) => setForm({ ...form, consumeType: e.target.value })} placeholder="e.g. For home use only (optional)" />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Safety Note</Label>
                <Input value={form.safetyNote} onChange={(e) => setForm({ ...form, safetyNote: e.target.value })} placeholder="e.g. Consult your doctor before making treatment decisions" />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Expiry Date</Label>
                <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} placeholder="Actual product/batch expiry date" />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Storage Information</Label>
                <Input value={form.storageInformation} onChange={(e) => setForm({ ...form, storageInformation: e.target.value })} placeholder="e.g. Store in a cool, dry place" />
              </div>
              <div className="sm:col-span-2 flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.prescriptionRequired} onChange={(e) => setForm({ ...form, prescriptionRequired: e.target.checked })} className="rounded" />
                  Prescription Required (Rx)
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded" />
                  Active
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="gradient-primary text-white">
                {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                {editingProduct ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Device</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">Are you sure? This action cannot be undone.</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}