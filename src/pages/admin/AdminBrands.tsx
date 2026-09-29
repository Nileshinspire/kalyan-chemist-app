import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Building2,
  Loader2,
  Sparkles,
  CheckCircle2,
  Globe,
  AlignLeft,
  RefreshCw,
} from "lucide-react";

/** Metadata resolved server-side by brandEnrichment.lookup. */
type VerifiedBrand = {
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  country: string;
};

/** Server-computed state of a stored logo (see brandEnrichment.brandLogoStatus). */
type LogoStatus = "ok" | "missing" | "broken" | "mismatch";

/** A row from adminBrands.list: the stored brand plus its computed extras. */
type AdminBrandRow = Doc<"brands"> & {
  logoStatus: LogoStatus;
  productCount: number;
};

const LOGO_STATUS_META: Record<
  LogoStatus,
  { label: string; hint: string; className: string }
> = {
  ok: {
    label: "Logo OK",
    hint: "A stored image URL that carries this brand's own name.",
    className: "bg-green-100 text-green-700",
  },
  missing: {
    label: "No logo",
    hint: "No logo is stored, so Shop By Brand shows the generic icon. Re-check to fetch one.",
    className: "bg-destructive/10 text-destructive",
  },
  broken: {
    label: "Broken URL",
    hint: "The stored logo value is not a usable http(s) image URL. Re-check to replace it.",
    className: "bg-destructive/10 text-destructive",
  },
  mismatch: {
    label: "Check logo",
    hint: "The image's file name doesn't mention this brand, so it may be a parent or sister brand's mark. Re-check to confirm or replace it.",
    className: "bg-amber-100 text-amber-700",
  },
};

function LogoStatusBadge({ status }: { status: string }) {
  const meta = LOGO_STATUS_META[status as LogoStatus] ?? LOGO_STATUS_META.mismatch;
  return (
    <Badge variant="secondary" className={`text-xs ${meta.className}`} title={meta.hint}>
      {meta.label}
    </Badge>
  );
}

export default function AdminBrands() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  // The only field the admin actually types.
  const [name, setName] = useState("");
  // Logo / description / country — filled by the server, shown read-only.
  const [verified, setVerified] = useState<VerifiedBrand | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [isActive, setIsActive] = useState(true);
  const [showOnHomepage, setShowOnHomepage] = useState(false);
  const [homepageOrder, setHomepageOrder] = useState("1");

  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  // Brand id whose logo is currently being re-verified ("Check logo").
  const [rechecking, setRechecking] = useState<string | null>(null);

  const brands = useQuery(api.adminBrands.list, { search: search || undefined });
  const lookupBrand = useAction(api.brandEnrichment.lookup);
  const createBrand = useMutation(api.adminBrands.create);
  const updateBrand = useMutation(api.adminBrands.update);
  const deleteBrand = useMutation(api.adminBrands.remove);
  const toggleActive = useMutation(api.adminBrands.toggleActive);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setVerified(null);
    setVerifyError(null);
    setIsActive(true);
    setShowOnHomepage(false);
    setHomepageOrder(
      String((brands?.length ?? 0) + 1),
    );
    setDialogOpen(true);
  };

  const openEdit = (brand: any) => {
    setEditing(brand._id);
    setName(brand.name);
    // Existing brands already carry verified metadata, so editing does not
    // force a re-verification unless the name actually changes.
    setVerified({
      name: brand.name,
      slug: brand.slug,
      description: brand.description ?? "",
      logoUrl: brand.logoUrl ?? "",
      country: brand.country ?? "",
    });
    setVerifyError(null);
    setIsActive(brand.isActive);
    setShowOnHomepage(brand.showOnHomepage ?? false);
    setHomepageOrder(String(brand.homepageOrder ?? 0));
    setDialogOpen(true);
  };

  // Editing the name invalidates the resolved metadata: the details must always
  // match the brand they were fetched for.
  const handleNameChange = (value: string) => {
    setName(value);
    if (verified && value.trim() !== verified.name) {
      setVerified(null);
      setVerifyError(null);
    }
  };

  const handleVerify = async () => {
    const query = name.trim();
    if (!query) {
      setVerifyError("Please enter a brand name first.");
      return;
    }
    setVerifying(true);
    setVerifyError(null);
    try {
      const result = await lookupBrand({ name: query });
      setVerified({
        name: result.name,
        slug: result.slug,
        description: result.description,
        logoUrl: result.logoUrl,
        country: result.country,
      });
      setName(result.name);
      toast.success(`Verified ${result.name}`);
    } catch (error: any) {
      // Nothing is saved on failure — the admin can correct the name and retry.
      setVerified(null);
      setVerifyError(
        error?.message ||
          "This brand could not be verified automatically. Check the spelling and try again.",
      );
    } finally {
      setVerifying(false);
    }
  };

  const handleSave = async () => {
    if (!verified) {
      toast.error("Verify the brand to fetch its logo, description and country first.");
      return;
    }
    setSaving(true);
    try {
      const data = {
        name: verified.name,
        slug: verified.slug,
        description: verified.description,
        logoUrl: verified.logoUrl,
        country: verified.country,
        isActive,
        showOnHomepage,
        homepageOrder: Math.max(1, Number(homepageOrder) || 0),
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

  /**
   * Re-run the logo pipeline for one stored brand. The freshly verified logo
   * replaces the stored one when it differs; if no source can prove a logo for
   * this brand, nothing is written and the reason is shown instead. Stored
   * name, description, country and product links are left untouched.
   */
  const handleRecheck = async (brand: AdminBrandRow) => {
    setRechecking(brand._id);
    try {
      const result = await lookupBrand({ name: brand.name });
      if (result.logoUrl === brand.logoUrl) {
        toast.success(`${brand.name}: logo verified`);
        return;
      }
      await updateBrand({
        brandId: brand._id,
        name: brand.name,
        slug: brand.slug,
        description: (brand.description ?? "").trim() || result.description,
        country: (brand.country ?? "").trim() || result.country,
        logoUrl: result.logoUrl,
        isActive: brand.isActive,
        showOnHomepage: brand.showOnHomepage ?? false,
        homepageOrder: brand.homepageOrder ?? 0,
      });
      toast.success(`${brand.name}: logo updated`);
    } catch (error) {
      toast.error(
        `${brand.name}: ${
          error instanceof Error && error.message
            ? error.message
            : "logo could not be verified"
        }`,
      );
    } finally {
      setRechecking(null);
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

  // Rows whose stored logo needs a look: missing, unusable, or not naming the
  // brand. Everything here is decided server-side from the stored row alone.
  const logoIssues = (brands ?? []).filter((brand) => brand.logoStatus !== "ok");

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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Brand</TableHead>
                      <TableHead className="text-center">Logo</TableHead>
                      <TableHead>Country</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">Products</TableHead>
                      <TableHead className="text-center">On Homepage</TableHead>
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
                              <img src={brand.logoUrl} alt={brand.name} className="size-8 rounded-lg object-contain" />
                            ) : (
                              <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <Building2 className="size-4 text-primary" />
                              </div>
                            )}
                            <span className="font-medium">{brand.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <LogoStatusBadge status={brand.logoStatus} />
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{brand.country || "—"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{brand.description || "—"}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary" className="text-xs">{brand.productCount}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {brand.showOnHomepage ? (
                            <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">
                              #{brand.homepageOrder ?? 0}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Hidden</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={brand.isActive ? "default" : "secondary"} className={`text-xs ${brand.isActive ? "bg-green-100 text-green-700" : ""}`}>
                            {brand.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {brand.logoStatus !== "ok" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-amber-600"
                                title="Re-check logo"
                                onClick={() => handleRecheck(brand)}
                                disabled={rechecking === brand._id}
                              >
                                {rechecking === brand._id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <RefreshCw className="size-3.5" />
                                )}
                              </Button>
                            )}
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
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">{brands?.length ?? 0} brand(s) total</p>
          {logoIssues.length > 0 && (
            <p className="text-xs text-amber-600">
              Needs a logo check: {logoIssues.map((brand) => brand.name).join(", ")} — use
              the refresh action on the row (or Edit → Verify) to re-run the logo lookup.
            </p>
          )}
        </div>

        {/* Add / Edit Dialog — brand name is the only typed field. */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Brand" : "Add Brand"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Brand Name *</Label>
                <div className="flex gap-2">
                  <Input
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="e.g. Cipla"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void handleVerify();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleVerify}
                    disabled={verifying || !name.trim()}
                    className="shrink-0"
                  >
                    {verifying ? (
                      <Loader2 className="mr-1.5 size-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1.5 size-4" />
                    )}
                    Verify
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  The logo, description and country are fetched automatically from the brand name.
                </p>
              </div>

              {verifyError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5">
                  <p className="text-sm text-destructive">{verifyError}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    No brand was created. Correct the name and verify again.
                  </p>
                </div>
              )}

              {verified && (
                <div className="rounded-xl border border-border/60 bg-muted/40 p-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-white p-1.5">
                      <img
                        src={verified.logoUrl}
                        alt={verified.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <CheckCircle2 className="size-4 shrink-0 text-green-600" />
                        {verified.name}
                      </p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Globe className="size-3 shrink-0" />
                        {verified.country}
                      </p>
                    </div>
                  </div>
                  <p className="flex gap-1.5 text-xs leading-relaxed text-muted-foreground">
                    <AlignLeft className="mt-0.5 size-3 shrink-0" />
                    {verified.description}
                  </p>
                  <p className="text-[11px] text-muted-foreground/80">
                    These details are managed automatically and cannot be edited by hand.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
                <Label htmlFor="brand-active" className="text-sm font-normal">
                  Active
                </Label>
                <Switch id="brand-active" checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
                <div>
                  <Label htmlFor="brand-homepage" className="text-sm font-normal">
                    Show on Homepage
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Appears in the Shop By Brand section
                  </p>
                </div>
                <Switch
                  id="brand-homepage"
                  checked={showOnHomepage}
                  onCheckedChange={setShowOnHomepage}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="brand-order">Homepage Display Order</Label>
                <Input
                  id="brand-order"
                  type="number"
                  min={1}
                  value={homepageOrder}
                  onChange={(e) => setHomepageOrder(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Lower numbers appear first. 1, 2, 3, 4…
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || verifying || !verified} className="gradient-primary text-white">
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
