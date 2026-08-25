import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Search,
  Pencil,
  Trash2,
  Package,
  Filter,
  ArrowUpDown,
  X,
  Loader2,
  Image,
  Wand2,
} from "lucide-react";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

interface ProductForm {
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
  isActive: boolean;
}

const EMPTY_FORM: ProductForm = {
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
  strength: "",
  form: "tablet",
  sku: "",
  prescriptionRequired: false,
  storageInformation: "",
  stockQuantity: 0,
  benefits: "",
  consumeType: "",
  safetyNote: "",
  expiryDate: "",
  isActive: true,
};

const FORM_OPTIONS = ["tablet", "capsule", "syrup", "injection", "cream", "gel", "drops", "inhaler", "powder", "sachet", "strip", "other"];

export default function AdminProducts() {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "price" | "stockQuantity" | "createdAt">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);

  const enrichProductAction = useAction(api.productBackfill.enrichProduct);
  const enrichSingleProduct = useMutation(api.productBackfill.enrichSingleProduct);
  const backfillProducts = useMutation(api.productBackfill.backfillProducts);
  const [backfilling, setBackfilling] = useState(false);
  const categories = useQuery(api.categories.list);
  const brands = useQuery(api.adminBrands.list, { isActive: true });
  const products = useQuery(api.adminProducts.list, {
    search: search || undefined,
    categoryId: filterCategory !== "all" ? (filterCategory as any) : undefined,
    isActive: filterStatus === "all" ? undefined : filterStatus === "active",
    sortBy,
    sortOrder,
  });

  const createProduct = useMutation(api.adminProducts.create);
  const updateProduct = useMutation(api.adminProducts.update);
  const deleteProduct = useMutation(api.adminProducts.remove);
  const toggleActive = useMutation(api.adminProducts.toggleActive);

  const openCreate = () => {
    setEditingProduct(null);
    setForm(EMPTY_FORM);
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
      strength: product.strength || "",
      form: product.form || "tablet",
      sku: product.sku || "",
      prescriptionRequired: product.prescriptionRequired,
      storageInformation: product.storageInformation || "",
      stockQuantity: product.stockQuantity,
      benefits: product.benefits || "",
      consumeType: product.consumeType || "",
      safetyNote: product.safetyNote || "",
      expiryDate: product.expiryDate ? new Date(product.expiryDate).toISOString().split('T')[0] : "",
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
        manufacturer: form.manufacturer,
        dosage: form.dosage || undefined,
        packSize: form.packSize,
        strength: form.strength || undefined,
        form: form.form || undefined,
        sku: form.sku || undefined,
        prescriptionRequired: form.prescriptionRequired,
        storageInformation: form.storageInformation || undefined,
        stockQuantity: form.stockQuantity,
        benefits: form.benefits || undefined,      consumeType: form.consumeType || undefined,
      safetyNote: form.safetyNote || undefined,
      expiryDate: form.expiryDate ? new Date(form.expiryDate).getTime() : undefined,
      isActive: form.isActive,
      };

      if (editingProduct) {
        await updateProduct({ productId: editingProduct as any, ...data });
        toast.success("Product updated successfully");
      } else {
        await createProduct(data);
        toast.success("Product created successfully");
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (productId: string) => {
    try {
      await deleteProduct({ productId: productId as any });
      toast.success("Product deleted");
      setDeleteConfirm(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete product");
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

      // Image
      if (result.imageUrl) {
        newForm.imageUrl = result.imageUrl;
        filled.push("Image");
      }
      // Description
      if (result.description && !form.description) {
        newForm.description = result.description;
        filled.push("Description");
      }
      // Benefits — always overwrite with fresh generation
      if (result.benefits) {
        newForm.benefits = result.benefits;
        filled.push("Benefits");
      }
      // Consume Type — always overwrite
      if ((result as any).consumeType) {
        newForm.consumeType = (result as any).consumeType;
        filled.push("Consume Type");
      }
      // Safety Note — always overwrite
      if ((result as any).safetyNote) {
        newForm.safetyNote = (result as any).safetyNote;
        filled.push("Safety Note");
      }
      // Manufacturer
      if (result.manufacturer && !form.manufacturer) {
        newForm.manufacturer = result.manufacturer;
        filled.push("Manufacturer");
      }
      // Composition
      if ((result as any).composition && !form.composition) {
        newForm.composition = (result as any).composition;
        filled.push("Composition");
      }
      // Form — auto-select based on product name/composition
      if ((result as any).form && !form.form) {
        newForm.form = (result as any).form;
        filled.push("Form");
      }
      // Expiry Date
      if ((result as any).expiryDate && !form.expiryDate) {
        newForm.expiryDate = (result as any).expiryDate;
        filled.push("Expiry Date");
      }
      // Storage Information — always overwrite with product-specific storage
      if ((result as any).storageInformation && !form.storageInformation) {
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

  const handleBackfillAll = async () => {
    setBackfilling(true);
    try {
      const result = await backfillProducts({ limit: 20 });
      if (result.enriched > 0) {
        toast.success(`Enriched ${result.enriched} products! ${result.remaining} remaining.`);
      } else {
        toast.info(result.message || "No products needed enrichment");
      }
    } catch (err: any) {
      toast.error(err.message || "Backfill failed");
    } finally {
      setBackfilling(false);
    }
  };

  const handleEnrichSingle = async (productId: string) => {
    try {
      const result = await enrichSingleProduct({ productId: productId as any });
      if (result.updated.length > 0) {
        toast.success(`Enriched: ${result.updated.join(", ")}`);
      } else {
        toast.info(result.message || "Product already complete");
      }
    } catch (err: any) {
      toast.error(err.message || "Enrichment failed");
    }
  };

  const handleToggleActive = async (productId: string, isActive: boolean) => {
    try {
      await toggleActive({ productId: productId as any, isActive });
      toast.success(isActive ? "Product activated" : "Product deactivated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update product");
    }
  };

  const isLoading = products === undefined || categories === undefined;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Products</h1>
            <p className="text-sm text-muted-foreground">Manage your medicine catalogue</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleBackfillAll}
              disabled={backfilling}
              className="gap-2"
            >
              {backfilling ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
              Auto-fill Missing Info
            </Button>
            <Button onClick={openCreate} className="gradient-primary text-white shadow-glow">
              <Plus className="mr-2 size-4" /> Add Product
            </Button>
          </div>
        </motion.div>

        {/* Filters */}
        <Card className="border-border/60">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl" />
              </div>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px] rounded-xl">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories?.map((c) => (
                    <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] rounded-xl">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Select value={`${sortBy}-${sortOrder}`} onValueChange={(v) => {
                const [field, order] = v.split("-") as [typeof sortBy, typeof sortOrder];
                setSortBy(field);
                setSortOrder(order);
              }}>
                <SelectTrigger className="w-[180px] rounded-xl">
                  <ArrowUpDown className="mr-2 size-3" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="createdAt-desc">Newest First</SelectItem>
                  <SelectItem value="createdAt-asc">Oldest First</SelectItem>
                  <SelectItem value="name-asc">Name A-Z</SelectItem>
                  <SelectItem value="name-desc">Name Z-A</SelectItem>
                  <SelectItem value="price-asc">Price Low-High</SelectItem>
                  <SelectItem value="price-desc">Price High-Low</SelectItem>
                  <SelectItem value="stockQuantity-asc">Stock Low-High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-border/60">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : !products || products.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Package className="size-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">No products found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {search ? "Try a different search term" : "Add your first product to get started"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>SKU</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-center">Stock</TableHead>
                      <TableHead className="text-center">Rx/OTC</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {products.map((product) => (
                      <TableRow key={product._id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-xs text-muted-foreground">{product.manufacturer}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {product.sku || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">
                            {product.categoryName}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div>
                            <span className="font-semibold">₹{product.price}</span>
                            {product.discountPrice && product.discountPrice < product.price && (
                              <span className="ml-1 text-xs text-muted-foreground line-through">
                                ₹{product.discountPrice}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={product.stockQuantity === 0 ? "destructive" : product.stockQuantity <= 10 ? "outline" : "secondary"}
                            className="text-xs"
                          >
                            {product.stockQuantity === 0 ? "Out of Stock" : product.stockQuantity}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={product.prescriptionRequired ? "destructive" : "outline"} className="text-xs">
                            {product.prescriptionRequired ? "Rx" : "OTC"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={product.isActive ? "default" : "secondary"} className={`text-xs ${product.isActive ? "bg-green-100 text-green-700" : ""}`}>
                            {product.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {(!product.imageUrl || !product.benefits) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-blue-600 hover:text-blue-700"
                                onClick={() => handleEnrichSingle(product._id)}
                                title="Auto-fill missing info"
                              >
                                <Wand2 className="size-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(product)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`size-8 ${product.isActive ? "text-amber-600 hover:text-amber-700" : "text-green-600 hover:text-green-700"}`}
                              onClick={() => handleToggleActive(product._id, !product.isActive)}
                            >
                              {product.isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(product._id)}>
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
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">{products?.length ?? 0} product(s) total</p>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProduct ? "Edit Product" : "Add Product"}</DialogTitle>
            </DialogHeader>
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
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: slugify(e.target.value) })} placeholder="e.g. Crocin Advance 500mg" />
                <p className="text-[11px] text-muted-foreground">Enter medicine name, then click Auto Fill to auto-populate all product information.</p>
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="Auto-generated from name" />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Description *</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Product description" />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Composition</Label>
                <Input value={form.composition} onChange={(e) => setForm({ ...form, composition: e.target.value })} placeholder="e.g. Paracetamol 500mg + Chlorpheniramine 2mg" />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories?.map((c) => (
                      <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                <Label>MRP (₹) *</Label>
                <Input type="number" value={form.price || ""} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Selling Price (₹)</Label>
                <Input type="number" value={form.discountPrice || ""} onChange={(e) => setForm({ ...form, discountPrice: e.target.value ? parseFloat(e.target.value) : undefined })} placeholder="Leave empty if no discount" />
              </div>
              <div className="space-y-2">
                <Label>Manufacturer *</Label>
                <Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} placeholder="e.g. GlaxoSmithKline" />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="e.g. KC-CRC-500" />
              </div>
              <div className="space-y-2">
                <Label>Form</Label>
                <Select value={form.form} onValueChange={(v) => setForm({ ...form, form: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FORM_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pack Size *</Label>
                <Input value={form.packSize} onChange={(e) => setForm({ ...form, packSize: e.target.value })} placeholder="e.g. 10 tablets" />
              </div>
              <div className="space-y-2">
                <Label>Dosage</Label>
                <Input value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="e.g. 500mg" />
              </div>
              <div className="space-y-2">
                <Label>Strength</Label>
                <Input value={form.strength} onChange={(e) => setForm({ ...form, strength: e.target.value })} placeholder="e.g. 500mg" />
              </div>
              <div className="space-y-2">
                <Label>Stock Quantity *</Label>
                <Input type="number" value={form.stockQuantity || ""} onChange={(e) => setForm({ ...form, stockQuantity: parseInt(e.target.value) || 0 })} placeholder="0" />
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
                <Label>Benefits</Label>
                <Input value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} placeholder="e.g. Provides fast relief from pain and fever" />
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Consumption Type</Label>
                <Input value={form.consumeType} onChange={(e) => setForm({ ...form, consumeType: e.target.value })} placeholder="e.g. For oral use, For external use only" />
                <p className="text-[11px] text-muted-foreground">Auto-filled based on product form type (tablet, cream, etc.)</p>
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Safety Note</Label>
                <Input value={form.safetyNote} onChange={(e) => setForm({ ...form, safetyNote: e.target.value })} placeholder="e.g. Consult your doctor or pharmacist before use" />
                <p className="text-[11px] text-muted-foreground">Auto-filled with standard safety information.</p>
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Expiry Date</Label>
                <Input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} placeholder="Actual product/batch expiry date" />
                <p className="text-[11px] text-muted-foreground">Enter the actual expiry date printed on the product/batch. Leave empty if unavailable.</p>
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
              <DialogTitle>Delete Product</DialogTitle>
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
