import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Package,
} from "lucide-react";
import { formatCurrency } from "@/lib/auth-utils";
import { toast } from "sonner";

interface ProductForm {
  id?: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  discountPrice: number;
  categoryId: string;
  imageUrl: string;
  manufacturer: string;
  dosage: string;
  packSize: string;
  requiresPrescription: boolean;
  stockQuantity: number;
  isActive: boolean;
}

const EMPTY_FORM: ProductForm = {
  name: "",
  slug: "",
  description: "",
  price: 0,
  discountPrice: 0,
  categoryId: "",
  imageUrl: "/placeholder-medicine.svg",
  manufacturer: "",
  dosage: "",
  packSize: "",
  requiresPrescription: false,
  stockQuantity: 0,
  isActive: true,
};

export default function AdminProducts() {
  const products = useQuery(api.admin.listProducts);
  const categories = useQuery(api.categories.list);
  const upsertProduct = useMutation(api.admin.upsertProduct);
  const deleteProduct = useMutation(api.admin.deleteProduct);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);

  const filtered = products?.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.manufacturer.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (!form.name || !form.slug || !form.categoryId || form.price <= 0) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      await upsertProduct({
        ...(form.id ? { id: form.id as any } : {}),
        name: form.name,
        slug: form.slug,
        description: form.description,
        price: form.price,
        discountPrice: form.discountPrice || undefined,
        categoryId: form.categoryId as any,
        imageUrl: form.imageUrl || "/placeholder-medicine.svg",
        manufacturer: form.manufacturer,
        dosage: form.dosage,
        packSize: form.packSize,
        requiresPrescription: form.requiresPrescription,
        stockQuantity: form.stockQuantity,
        isActive: form.isActive,
      });
      toast.success(form.id ? "Product updated" : "Product created");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save product");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await deleteProduct({ productId: id as any });
      toast.success("Product deleted");
    } catch (error) {
      toast.error("Could not delete product");
    }
  };

  const openEdit = (p: any) => {
    setForm({
      id: p._id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      price: p.price,
      discountPrice: p.discountPrice || 0,
      categoryId: p.categoryId,
      imageUrl: p.imageUrl,
      manufacturer: p.manufacturer,
      dosage: p.dosage,
      packSize: p.packSize,
      requiresPrescription: p.requiresPrescription,
      stockQuantity: p.stockQuantity,
      isActive: p.isActive,
    });
    setDialogOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Products
            </h1>
            <p className="text-sm text-muted-foreground">
              {products?.length ?? 0} total products
            </p>
          </div>
          <Button
            className="font-semibold"
            onClick={() => {
              setForm(EMPTY_FORM);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4 mr-1" />
            Add Product
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or manufacturer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* Products table */}
        <Card className="border-border/60">
          <CardContent className="p-0">
            {products === undefined ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : filtered?.length === 0 ? (
              <div className="py-12 text-center">
                <Package className="size-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No products found.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/60 bg-muted/30">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-medium text-muted-foreground">Product</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">Category</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">Price</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">Stock</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered?.map((p) => (
                      <tr key={p._id} className="border-b border-border/40 last:border-0">
                        <td className="px-4 py-3">
                          <div>
                            <span className="font-medium text-foreground">{p.name}</span>
                            <p className="text-xs text-muted-foreground">{p.manufacturer}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{p.categoryName}</td>
                        <td className="px-4 py-3">
                          <span className="font-medium">{formatCurrency(p.price)}</span>
                          {p.discountPrice && p.discountPrice < p.price && (
                            <span className="ml-1 text-xs text-green-600">
                              → {formatCurrency(p.discountPrice)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={
                              p.stockQuantity < 10
                                ? "text-amber-600 font-medium"
                                : "text-foreground"
                            }
                          >
                            {p.stockQuantity}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {p.isActive ? (
                            <Badge className="text-[10px] bg-green-100 text-green-800">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              Inactive
                            </Badge>
                          )}
                          {p.requiresPrescription && (
                            <Badge variant="secondary" className="text-[10px] ml-1">
                              Rx
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(p)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(p._id, p.name)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Slug *</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="text-sm"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Category *</Label>
                <Select
                  value={form.categoryId}
                  onValueChange={(val) => setForm({ ...form, categoryId: val })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Manufacturer</Label>
                <Input
                  value={form.manufacturer}
                  onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Price (₹) *</Label>
                <Input
                  type="number"
                  value={form.price || ""}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Discount Price (₹)</Label>
                <Input
                  type="number"
                  value={form.discountPrice || ""}
                  onChange={(e) =>
                    setForm({ ...form, discountPrice: Number(e.target.value) })
                  }
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Stock</Label>
                <Input
                  type="number"
                  value={form.stockQuantity || ""}
                  onChange={(e) =>
                    setForm({ ...form, stockQuantity: Number(e.target.value) })
                  }
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Dosage</Label>
                <Input
                  value={form.dosage}
                  onChange={(e) => setForm({ ...form, dosage: e.target.value })}
                  placeholder="e.g. 500mg"
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Pack Size</Label>
                <Input
                  value={form.packSize}
                  onChange={(e) => setForm({ ...form, packSize: e.target.value })}
                  placeholder="e.g. 10 tablets"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.requiresPrescription}
                  onCheckedChange={(val) => setForm({ ...form, requiresPrescription: val })}
                />
                <Label className="text-xs">Prescription Required</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(val) => setForm({ ...form, isActive: val })}
                />
                <Label className="text-xs">Active</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" className="font-semibold" onClick={handleSave}>
                {form.id ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
