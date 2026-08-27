import { useState, useEffect } from "react";
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
import { Plus, Search, Pencil, Trash2, Tag, Loader2, Package, ChevronRight, ArrowLeft } from "lucide-react";

function slugify(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export default function AdminCategories() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [parentId, setParentId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const categories = useQuery(api.adminCategories.list, { search: search || undefined });
  const hierarchicalCategories = useQuery(api.adminCategories.listHierarchical);
  const createCategory = useMutation(api.adminCategories.create);
  const updateCategory = useMutation(api.adminCategories.update);
  const deleteCategory = useMutation(api.adminCategories.remove);
  const toggleActive = useMutation(api.adminCategories.toggleActive);
  const seedAll = useMutation(api.adminCategories.seedAll);

  // Hierarchical navigation state
  // null = showing top-level categories
  // { type: "parent", id, name } = showing subcategories of a parent
  // { type: "subcategory", id, name, parentId, parentName } = showing products of a subcategory
  const [navState, setNavState] = useState<{
    type: "parent";
    id: string;
    name: string;
  } | {
    type: "subcategory";
    id: string;
    name: string;
    parentId: string;
    parentName: string;
  } | null>(null);

  const categoryItems = useQuery(
    api.adminCategories.listCategoryItems,
    navState ? { categoryId: navState.id as any } : "skip"
  );

  // Auto-seed default categories on first load if missing
  useEffect(() => {
    seedAll().catch(() => {});
  }, [seedAll]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setSlug("");
    setDescription("");
    setParentId("");
    setSortOrder((categories?.length ?? 0) + 1);
    setDialogOpen(true);
  };

  const openEdit = (cat: any) => {
    setEditing(cat._id);
    setName(cat.name);
    setSlug(cat.slug);
    setDescription(cat.description || "");
    setSortOrder(cat.sortOrder);
    setParentId(cat.parentId || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name) {
      toast.error("Category name is required");
      return;
    }
    setSaving(true);
    try {
      const data: any = { name, slug: slug || slugify(name), description: description || undefined, sortOrder };
      if (parentId) data.parentId = parentId;
      if (editing) {
        await updateCategory({ categoryId: editing as any, ...data });
        toast.success("Category updated");
      } else {
        await createCategory(data);
        toast.success("Category created");
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteCategory({ categoryId: deleteConfirm.id as any });
      toast.success("Category deleted");
      setDeleteConfirm(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete category");
    }
  };

  const handleCategoryClick = (cat: any) => {
    setNavState({ type: "parent", id: cat._id, name: cat.name });
  };

  const handleSubcategoryClick = (sub: any) => {
    if (!navState || navState.type !== "parent") return;
    setNavState({
      type: "subcategory",
      id: sub._id,
      name: sub.name,
      parentId: navState.id,
      parentName: navState.name,
    });
  };

  const handleBack = () => {
    if (navState?.type === "subcategory") {
      setNavState({ type: "parent", id: navState.parentId, name: navState.parentName });
    } else {
      setNavState(null);
    }
  };

  const isLoading = categories === undefined;

  // Determine which data to show in the main table
  const isShowingTopLevel = !navState;
  const isShowingSubcategories = navState?.type === "parent";
  const isShowingProducts = navState?.type === "subcategory";

  return (
    <AdminLayout>
      <div className="space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              {navState && (
                <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1 text-muted-foreground">
                  <ArrowLeft className="size-4" /> Back
                </Button>
              )}
              <div>
                <h1 className="text-2xl font-bold tracking-tight">
                  {navState?.type === "subcategory"
                    ? navState.name
                    : navState?.type === "parent"
                    ? navState.name
                    : "Categories"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {navState?.type === "subcategory"
                    ? `Products in ${navState.name}`
                    : navState?.type === "parent"
                    ? "Subcategories"
                    : "Manage your product categories"}
                </p>
              </div>
            </div>
            {navState?.type === "subcategory" && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1 ml-12">
                <span className="cursor-pointer hover:text-primary" onClick={handleBack}>
                  {navState.parentName}
                </span>
                <ChevronRight className="size-3" />
                <span>{navState.name}</span>
              </div>
            )}
          </div>
          {!navState && (
            <Button onClick={openCreate} className="gradient-primary text-white shadow-glow">
              <Plus className="mr-2 size-4" /> Add Category
            </Button>
          )}
        </motion.div>

        {!navState && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input placeholder="Search categories..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 rounded-xl" />
          </div>
        )}

        <Card className="border-border/60">
          <CardContent className="p-0">
            {isLoading || (navState && categoryItems === undefined) ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : isShowingTopLevel ? (
              // ── TOP-LEVEL CATEGORIES TABLE ──
              !categories || categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <Tag className="size-7 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold">No categories found</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {search ? "Try a different search" : "Create your first category"}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">Subcategories</TableHead>
                      <TableHead className="text-center">Products</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((cat) => (
                      <TableRow
                        key={cat._id}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => handleCategoryClick(cat)}
                      >
                        <TableCell className="font-medium hover:text-primary transition-colors">
                          <div className="flex items-center gap-2">
                            {cat.children && cat.children.length > 0 ? (
                              <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                            ) : (
                              <Package className="size-4 text-muted-foreground shrink-0 opacity-0" />
                            )}
                            {cat.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{cat.slug}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{cat.description || "—"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="text-xs">
                            {cat.children?.length ?? 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="text-xs">
                            {cat.productCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={cat.isActive ? "default" : "secondary"} className={`text-xs ${cat.isActive ? "bg-green-100 text-green-700" : ""}`}>
                            {cat.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(cat)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-8" onClick={() => toggleActive({ categoryId: cat._id, isActive: !cat.isActive })}>
                              {cat.isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setDeleteConfirm({ id: cat._id, name: cat.name })} disabled={(cat.productCount ?? 0) > 0}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            ) : isShowingSubcategories && categoryItems?.type === "parent" ? (
              // ── SUBCATEGORIES TABLE ──
              categoryItems.subcategories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="size-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                    <Package className="size-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No subcategories yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Create subcategories for this parent category.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subcategory</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">Products</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryItems.subcategories.map((sub) => (
                      <TableRow
                        key={sub._id}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => handleSubcategoryClick(sub)}
                      >
                        <TableCell className="font-medium hover:text-primary transition-colors">
                          <div className="flex items-center gap-2">
                            <Package className="size-4 text-muted-foreground shrink-0" />
                            {sub.name}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{sub.slug}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{sub.description || "—"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="text-xs">
                            {sub.productCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={sub.isActive ? "default" : "secondary"} className={`text-xs ${sub.isActive ? "bg-green-100 text-green-700" : ""}`}>
                            {sub.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="size-8" onClick={() => openEdit(sub)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-8" onClick={() => toggleActive({ categoryId: sub._id, isActive: !sub.isActive })}>
                              {sub.isActive ? "Deactivate" : "Activate"}
                            </Button>
                            <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => setDeleteConfirm({ id: sub._id, name: sub.name })} disabled={sub.productCount > 0}>
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            ) : isShowingProducts && categoryItems?.type === "leaf" ? (
              // ── PRODUCTS TABLE ──
              categoryItems.products.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="size-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
                    <Package className="size-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No products in this category yet.</p>
                  <p className="text-xs text-muted-foreground mt-1">Assign products to this category from the Products section.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-center">Stock</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryItems.products.map((product) => (
                      <TableRow key={product._id}>
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
                        <TableCell className="text-right font-medium">₹{product.price}</TableCell>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
            ) : null}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Category" : "Add Category"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input value={name} onChange={(e) => { setName(e.target.value); if (!editing) setSlug(slugify(e.target.value)); }} placeholder="e.g. Pain Relief" />
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
                <Label>Parent Category (optional)</Label>
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">None (top-level category)</option>
                  {hierarchicalCategories?.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)} />
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
              <DialogTitle>Delete Category</DialogTitle>
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
