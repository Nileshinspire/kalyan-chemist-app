import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Plus, Search, Pencil, Trash2, Building2, Loader2 } from "lucide-react";

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function AdminBrands() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [country, setCountry] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const brands = useQuery(api.adminBrands.list, { search: search || undefined });
  const createBrand = useMutation(api.adminBrands.create);
  const updateBrand = useMutation(api.adminBrands.update);
  const deleteBrand = useMutation(api.adminBrands.remove);
  const toggleActive = useMutation(api.adminBrands.toggleActive);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setSlug("");
    setDescription("");
    setLogoUrl("");
    setCountry("");
    setDialogOpen(true);
  };

  const openEdit = (brand: any) => {
    setEditing(brand._id);
    setName(brand.name);
    setSlug(brand.slug);
    setDescription(brand.description || "");
    setLogoUrl(brand.logoUrl || "");
    setCountry(brand.country || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name) {
      toast.error("Brand name is required");
      return;
    }
    setSaving(true);
    try {
      const data = {
        name,
        slug: slug || slugify(name),
        description: description || undefined,
        logoUrl: logoUrl || undefined,
        country: country || undefined,
      };
      if (editing) {
        await updateBrand({ brandId: editing as any, ...data });
        toast.success("Brand updated");
      } else {
        await createBrand(data);
        toast.success("Brand created");
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save brand");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteBrand({ brandId: deleteConfirm.id as any });
      toast.success("Brand deleted");
      setDeleteConfirm(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete brand");
    }
  };

  const isLoading = brands === undefined;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Brands</h1>
            <p className="text-sm text-muted-foreground">Manage product brands and manufacturers</p>
          </div>
          <Button onClick={openCreate} className="gradient-primary text-white shadow-glow">
            <Plus className="mr-2 size-4" /> Add Brand
          </Button>
        </motion.div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input placeholder="Search brands..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl" />
        </div>

        <Card className="border-border/60">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : !brands || brands.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Building2 className="size-7 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">No brands found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {search ? "Try a different search" : "Create your first brand"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Brand</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Country</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Products</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brands.map((brand) => (
                    <TableRow key={brand._id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {brand.logoUrl ? (
                            <img src={brand.logoUrl} alt={brand.name} className="size-8 rounded-lg object-cover" />
                          ) : (
                            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Building2 className="size-4 text-primary" />
                            </div>
                          )}
                          <span className="font-medium">{brand.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{brand.slug}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{brand.country || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{brand.description || "—"}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-xs">{brand.productCount}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={brand.isActive ? "default" : "secondary"} className={`text-xs ${brand.isActive ? "bg-green-100 text-green-700" : ""}`}>
                          {brand.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(brand)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => toggleActive({ brandId: brand._id, isActive: !brand.isActive })}>
                            {brand.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setDeleteConfirm({ id: brand._id, name: brand.name })} disabled={brand.productCount > 0}>
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

        <p className="text-xs text-muted-foreground">{brands?.length ?? 0} brand(s) total</p>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Brand" : "Add Brand"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={name} onChange={(e) => { setName(e.target.value); if (!editing) setSlug(slugify(e.target.value)); }} placeholder="e.g. Sun Pharmaceutical" />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="Auto-generated from name" />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" />
              </div>
              <div className="space-y-2">
                <Label>Logo URL</Label>
                <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label>Country</Label>
                <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. India" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving} className="gradient-primary text-white">
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {editing ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete Brand</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete "{deleteConfirm?.name}"? This cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDelete}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
