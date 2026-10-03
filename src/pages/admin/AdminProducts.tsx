import { useEffect, useState, useCallback } from "react";
import { NO_CONFIDENT_MATCH_MESSAGE } from "@/convex/productInfo";
import {
  CATALOG_IMAGE_NOT_FOUND_MESSAGE,
  CATALOG_PRODUCT_NOT_FOUND_MESSAGE,
} from "@/convex/masterCatalogCore";
import MasterCatalogImportDialog from "./MasterCatalogImportDialog";
import MasterCatalogBrowser from "./MasterCatalogBrowser";
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
  RefreshCw,
  Search,
  Pencil,
  Trash2,
  Package,
  ArrowUpDown,
  X,
  Loader2,
  Wand2,
  ShieldAlert,
  CheckCircle2,
  Database,
  ChevronUp,
  ChevronDown,
  Image as ImageIcon,
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
  /** Provenance of the verified packshot, saved with the product. */
  imageSource?: string;
  imageUrlSource?: string;
  /**
   * Optional, admin-controlled promotion for THIS product only. Separate from
   * the gallery. `imageUrl` is the display value (a real URL, or a temporary
   * object URL while editing); `storageId` is set for creatives uploaded to
   * Convex storage; `url` is the pasted external URL either way.
   */
  productPromotion: {
    enabled: boolean;
    title: string;
    /**
     * "automatic" means the creatives came from the approved media catalog and
     * the server re-derives them on save from the exact catalog record. Any
     * admin edit switches to "manual" so their change is what gets stored.
     */
    mode: "automatic" | "manual";
    /** The exact catalog record Auto Fill matched / promotion resolved against. */
    catalogProductId?: string;
    matchProductName?: string;
    resolvedFrom?: string;
    status:
      | "idle"
      | "resolving"
      | "resolved"
      | "no-media"
      | "not-found"
      | "ambiguous"
      | "mismatch"
      | "error";
    statusMessage?: string;
    suggestions?: Array<{ productName: string; manufacturer?: string | null }>;
    creatives: Array<{
      imageUrl: string;
      storageId?: string;
      url?: string;
      heading: string;
      description: string;
      source?: string;
      origin?: "manual" | "automatic";
    }>;
  };
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
  productPromotion: {
    enabled: false,
    title: "From the Manufacturer",
    mode: "manual" as const,
    status: "idle" as const,
    creatives: [],
  },
  isActive: true,
};

const FORM_OPTIONS = ["tablet", "capsule", "syrup", "injection", "cream", "gel", "ointment", "lotion", "drops", "nasal drops", "spray", "inhaler", "powder", "sachet", "balm", "strip", "other"];

/**
 * Verified images wanted per product: one front packshot plus four genuinely
 * different views. Kept in step with `MAX_PRODUCT_IMAGES` in the image
 * pipeline, which is the module that decides what a real product can offer.
 */
const TARGET_GALLERY_IMAGES = 5;

/** Result of the strict product-image lookup shown next to the image field. */
type ImageStatus =
  | { state: "idle" }
  | { state: "loading" }
  | {
      state: "verified";
      matchedName: string;
      views: number;
      source: string;
      /** False when the exact product has fewer than 5 verified images. */
      complete: boolean;
      message?: string;
    }
  | { state: "unverified"; message: string };

/** What the image audit found, one entry per product that needs attention. */
type ImageAuditReport = {
  total: number;
  flagged: Array<{
    name: string;
    reason: string | null;
    imageUrl: string;
    suspiciousSource: string | null;
    /** Where the stored image came from, for the audit trail. */
    imageSource?: string;
    imageUrlSource?: string;
  }>;
  counts: Record<string, number>;
  reResolved: boolean;
  checked: number;
  repaired: Array<{ name: string; views: number; imageUrlSource?: string }>;
  /** Re-resolved products that still have fewer than the full set of views. */
  incomplete: Array<{ name: string; views: number }>;
  unresolved: Array<{ name: string; current: string; reason: string }>;
};

/** Plain-language copy for each audit reason. */
const AUDIT_REASON_COPY: Record<string, string> = {
  missing: "No image stored — resolve the exact product packshot.",
  placeholder: "A generated placeholder is stored — resolve the real packshot.",
  "third-party": "Stored from an external URL instead of a verified download.",
  "suspicious-source":
    "Stored from a person / hand-held / lifestyle / stock photo source rather than a packshot.",
  "broken-gallery":
    "The gallery repeats an image, or holds a URL that is not a verified asset.",
  "duplicate-views":
    "Two thumbnails are the same picture stored twice — re-resolve to get genuinely different views.",
};

/** One autocomplete result from the verified master catalog. */
type CatalogSuggestion = {
  catalogProductId: string;
  name: string;
  brand: string | null;
  manufacturer: string | null;
  strength: string | null;
  form: string | null;
  packSize: string | null;
  verificationStatus: "VERIFIED" | "NEEDS_REVIEW" | "NEEDS_IMAGE";
  hasImage: boolean;
  verdict: "exact" | "related";
  reason: string;
};

/** Catalog suggestion → the compact “pick the exact product” row. */
function toCandidate(suggestion: CatalogSuggestion) {
  return {
    name: suggestion.name,
    manufacturer: suggestion.brand ?? suggestion.manufacturer ?? "",
    composition: [suggestion.strength, suggestion.packSize]
      .filter(Boolean)
      .join(" · "),
    form: suggestion.form,
  };
}

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
  const [importOpen, setImportOpen] = useState(false);
  const [nameQuery, setNameQuery] = useState("");
  // Which promotion creative slot is currently uploading (for the spinner).
  const [promoUploading, setPromoUploading] = useState<number | null>(null);
  const [resolvingPromotion, setResolvingPromotion] = useState(false);

  // Auto Fill and its image step read ONLY the verified master catalog — the
  // licensed-dataset layer the admin imported. The old external resolvers stay
  // for the row-level repair/audit tools, but are disconnected from this flow.
  const catalogAutoFillAction = useAction(api.masterCatalog.autoFill);
  const resolvePromotionAction = useAction(api.productPromotion.resolve);
  const lookupCatalogImageAction = useAction(api.masterCatalog.lookupImage);
  const repairProductImageAction = useAction(api.productImageRepair.repairProductImage);
  // The rerunnable image audit: it reports every stored image that cannot be
  // trusted, and re-resolves exactly those products in the same run.
  const auditProductImagesAction = useAction(api.productImageRepair.auditProductImages);
  const [imageStatus, setImageStatus] = useState<ImageStatus>({ state: "idle" });
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditReport, setAuditReport] = useState<ImageAuditReport | null>(null);
  const enrichSingleProduct = useMutation(api.productBackfill.enrichSingleProduct);
  const backfillProducts = useMutation(api.productBackfill.backfillProducts);
  const [backfilling, setBackfilling] = useState(false);
  const hierarchicalCategories = useQuery(api.adminCategories.listHierarchical);
  // What the last Auto Fill identified, so the admin can review it before
  // publishing rather than trusting a silent overwrite.
  const [matchInfo, setMatchInfo] = useState<{
    productKind: string;
    kindConfident: boolean;
    kindReason: string;
    matchFound: boolean;
    /** Where the verified record came from, so the admin knows what to trust. */
    matchSource: string | null;
    sourceUrl: string | null;
    /** Every source the catalog asked, and what it answered. */
    sources: Array<{ id: string; label: string; status: string; detail: string }>;
    /**
     * The exact message to show when nothing was matched (the mandated
     * catalog wording), instead of the legacy all-sources message.
     */
    notice?: string | null;
  } | null>(null);
  const [candidates, setCandidates] = useState<
    Array<{ name: string; manufacturer: string; composition: string; form: string | null }> | null
  >(null);
  const [findingCandidates, setFindingCandidates] = useState(false);
  const brands = useQuery(api.adminBrands.list, { isActive: true });
  const products = useQuery(api.adminProducts.list, {
    search: search || undefined,
    categoryId: filterCategory !== "all" ? (filterCategory as any) : undefined,
    isActive: filterStatus === "all" ? undefined : filterStatus === "active",
    sortBy,
    sortOrder,
  });

  const createProduct = useMutation(api.adminProducts.create);
  const generatePromotionUploadUrl = useMutation(
    api.adminProducts.generatePromotionUploadUrl,
  );
  const updateProduct = useMutation(api.adminProducts.update);
  const deleteProduct = useMutation(api.adminProducts.remove);
  const toggleActive = useMutation(api.adminProducts.toggleActive);

  // Master-catalog autocomplete: a debounced, indexed prefix search — never a
  // full-catalog scan, and skipped entirely while the dialog is closed.
  useEffect(() => {
    const handle = setTimeout(
      () => setNameQuery(dialogOpen ? form.name.trim() : ""),
      250,
    );
    return () => clearTimeout(handle);
  }, [form.name, dialogOpen]);
  const catalogSuggestions = useQuery(
    api.masterCatalog.searchProducts,
    dialogOpen && nameQuery.length >= 2 ? { query: nameQuery, take: 6 } : "skip",
  );

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
      expiryDate: product.expiryDate ? new Date(product.expiryDate).toISOString().split('T')[0] : "",
      additionalImages: product.additionalImages || [],
      imageSource: product.imageSource,
      imageUrlSource: product.imageUrlSource,
      productPromotion: {
        enabled: !!product.productPromotion?.enabled,
        title: product.productPromotion?.title || "From the Manufacturer",
        mode: product.productPromotion?.matchCatalogProductId
          ? "automatic"
          : "manual",
        catalogProductId: product.productPromotion?.matchCatalogProductId || undefined,
        matchProductName: product.productPromotion?.matchProductName || undefined,
        resolvedFrom: product.productPromotion?.resolvedFrom || undefined,
        status: product.productPromotion?.matchCatalogProductId
          ? "resolved"
          : "idle",
        creatives: (product.productPromotion?.creatives || []).map((c: any) => ({
          imageUrl: c.imageUrl || "",
          storageId: c.storageId || undefined,
          url: c.storageId ? undefined : c.imageUrl || undefined,
          heading: c.heading || "",
          description: c.description || "",
          source: c.source || undefined,
          origin: c.origin || "manual",
        })),
      },
      isActive: product.isActive,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.description || !form.categoryId || !form.manufacturer || !form.packSize) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (form.imageUrl && /^data:/i.test(form.imageUrl)) {
      toast.error(
        "A generated placeholder cannot be used as a product image. Use Fetch image to resolve the real packshot.",
      );
      return;
    }
    if (!form.imageUrl && !editingProduct) {
      toast.error(
        "A verified product image is required. Use Fetch image to resolve the exact product packshot.",
      );
      return;
    }
    setSaving(true);
    try {
      const slug = form.slug || slugify(form.name);
      // Product promotion — this product only.
      //
      // In "automatic" mode no creative is sent: the server re-reads the named
      // catalog record and stores its own approved media, so a creative can
      // never be reassigned to the wrong product by the browser. Manual mode
      // (an admin upload or a URL they supplied) is stored as supplied.
      const promo = form.productPromotion;
      const useAutomatic = promo.mode === "automatic" && Boolean(promo.catalogProductId);
      const productPromotion = {
        enabled: promo.enabled,
        title: promo.title.trim() || undefined,
        catalogProductId: useAutomatic ? promo.catalogProductId : undefined,
        creatives: useAutomatic
          ? []
          : promo.creatives
              .map((c) => ({
                storageId: (c.storageId || undefined) as any,
                url: c.storageId ? undefined : c.url?.trim() || undefined,
                heading: c.heading.trim() || undefined,
                description: c.description.trim() || undefined,
              }))
              .filter((c) => c.storageId || c.url),
      };
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
        imageSource: form.imageSource || undefined,
        imageUrlSource: form.imageUrlSource || undefined,
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
        benefits: form.benefits || undefined,      consumeType: form.consumeType || undefined,
      safetyNote: form.safetyNote || undefined,
      expiryDate: form.expiryDate ? new Date(form.expiryDate).getTime() : undefined,
      productPromotion,
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

  // ── Product promotion creative helpers (admin, this product only) ──
  /**
   * Ask the server to resolve verified promotional media for THIS exact
   * product. The browser never picks the media: it only renders the preview
   * the resolver returns, and the save re-derives the same creatives from the
   * catalog record itself.
   */
  const resolvePromotionMedia = useCallback(async () => {
    setResolvingPromotion(true);
    setForm((f) => ({
      ...f,
      productPromotion: { ...f.productPromotion, status: "resolving" },
    }));
    try {
      const result = await resolvePromotionAction({
        identity: {
          catalogProductId: form.productPromotion.catalogProductId,
          name: form.name,
          sku: form.sku || undefined,
          manufacturer: form.manufacturer || undefined,
          strength: form.strength || form.dosage || undefined,
          form: form.form || undefined,
          packSize: form.packSize || undefined,
        },
      });
      setForm((f) => ({
        ...f,
        productPromotion: {
          ...f.productPromotion,
          status: result.status,
          statusMessage: result.message,
          matchProductName: result.match?.productName ?? undefined,
          resolvedFrom: result.match?.source ?? undefined,
          catalogProductId:
            result.match?.catalogProductId ?? f.productPromotion.catalogProductId,
          suggestions: result.suggestions,
          // A successful resolve hands the promotion to the server; any
          // further admin edit below switches it back to manual.
          mode: result.status === "resolved" ? "automatic" : f.productPromotion.mode,
          creatives:
            result.status === "resolved"
              ? result.creatives.map((c) => ({
                  imageUrl: c.imageUrl,
                  heading: c.heading ?? "",
                  description: c.description ?? "",
                  source: c.source,
                  origin: "automatic" as const,
                }))
              : result.status === "no-media"
                ? []
                : f.productPromotion.creatives,
        },
      }));
    } catch (error: any) {
      setForm((f) => ({
        ...f,
        productPromotion: {
          ...f.productPromotion,
          status: "error",
          statusMessage:
            error?.message || "Could not resolve promotional media for this product.",
        },
      }));
    } finally {
      setResolvingPromotion(false);
    }
  }, [
    form.name,
    form.sku,
    form.manufacturer,
    form.strength,
    form.dosage,
    form.form,
    form.packSize,
    form.productPromotion.catalogProductId,
    resolvePromotionAction,
  ]);

  const handlePromoUpload = async (index: number, file: File) => {
    try {
      setPromoUploading(index);
      const uploadUrl = await generatePromotionUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: file.type ? { "Content-Type": file.type } : undefined,
        body: file,
      });
      if (!res.ok) throw new Error("Image upload failed");
      const { storageId } = (await res.json()) as { storageId?: string };
      if (!storageId) throw new Error("Image upload failed");
      const objectUrl = URL.createObjectURL(file);
      setForm((f) => {
        const creatives = [...f.productPromotion.creatives];
        if (!creatives[index]) return f;
        creatives[index] = {
          ...creatives[index],
          storageId,
          url: undefined,
          imageUrl: objectUrl,
          origin: "manual",
        };
        // An admin upload means the promotion is now their own set.
        return {
          ...f,
          productPromotion: {
            ...f.productPromotion,
            creatives,
            mode: "manual",
            catalogProductId: undefined,
          },
        };
      });
      toast.success("Promotional image uploaded");
    } catch (error: any) {
      toast.error(error?.message || "Failed to upload promotional image");
    } finally {
      setPromoUploading(null);
    }
  };

  const updatePromoCreative = (
    index: number,
    patch: Partial<{
      url?: string;
      imageUrl?: string;
      storageId?: string;
      heading?: string;
      description?: string;
    }>,
  ) => {
    setForm((f) => {
      const creatives = [...f.productPromotion.creatives];
      if (!creatives[index]) return f;
      creatives[index] = { ...creatives[index], ...patch };
      return {
        ...f,
        productPromotion: {
          ...f.productPromotion,
          creatives,
          // Editing a resolved creative makes this an admin-curated set.
          mode: "manual",
          catalogProductId: undefined,
        },
      };
    });
  };

  const movePromoCreative = (index: number, direction: -1 | 1) => {
    setForm((f) => {
      const creatives = [...f.productPromotion.creatives];
      const target = index + direction;
      if (target < 0 || target >= creatives.length) return f;
      [creatives[index], creatives[target]] = [creatives[target], creatives[index]];
      return {
        ...f,
        productPromotion: {
          ...f.productPromotion,
          creatives,
          mode: "manual",
          catalogProductId: undefined,
        },
      };
    });
  };

  const removePromoCreative = (index: number) => {
    setForm((f) => ({
      ...f,
      productPromotion: {
        ...f.productPromotion,
        creatives: f.productPromotion.creatives.filter((_, i) => i !== index),
        mode: "manual" as const,
        catalogProductId: undefined,
      },
    }));
  };

  const addPromoCreative = () => {
    setForm((f) =>
      f.productPromotion.creatives.length >= 4
        ? f
        : {
            ...f,
            productPromotion: {
              ...f.productPromotion,
              mode: "manual" as const,
              catalogProductId: undefined,
              creatives: [
                ...f.productPromotion.creatives,
                { imageUrl: "", heading: "", description: "" },
              ],
            },
          },
    );
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

  /**
   * Apply one verified catalog record's images to the form. This is the only
   * place the dialog writes an image: the packshot and every extra view belong
   * to the exact record that was matched, so the metadata and the photo always
   * describe the same product. Nothing is mirrored, duplicated or found by a
   * second search.
   */
  const applyCatalogRecordImages = (
    target: ProductForm,
    record: {
      hasImage: boolean;
      imageUrl: string | null;
      additionalImages: string[];
      imageSource: string | null;
      imageUrlSource: string | null;
      canonicalProductName: string;
    },
  ): string[] => {
    const filled: string[] = [];
    if (record.hasImage && record.imageUrl) {
      target.imageUrl = record.imageUrl;
      target.additionalImages = record.additionalImages;
      target.imageSource = record.imageSource ?? undefined;
      target.imageUrlSource = record.imageUrlSource ?? undefined;
      filled.push("Image");
      if (record.additionalImages.length > 0) {
        filled.push(
          `${record.additionalImages.length} more view${record.additionalImages.length === 1 ? "" : "s"}`,
        );
      }
      const views = 1 + record.additionalImages.length;
      setImageStatus({
        state: "verified",
        matchedName: record.canonicalProductName,
        views: record.additionalImages.length,
        source: record.imageSource ?? "master product catalog",
        complete: views >= TARGET_GALLERY_IMAGES,
        message:
          views >= TARGET_GALLERY_IMAGES
            ? undefined
            : `The verified catalog record ships ${views} image view${views === 1 ? "" : "s"} — no other view exists for this exact product.`,
      });
    } else {
      // The record exists but has no verified image: say exactly that, and
      // never substitute a placeholder or another product's picture.
      setImageStatus({ state: "unverified", message: CATALOG_IMAGE_NOT_FOUND_MESSAGE });
    }
    return filled;
  };

  /**
   * Fetch image — catalog only. Same exact-match rules as Auto Fill: the image
   * comes from the matched record's own stored assets, or the mandated
   * missing-image message is shown. No external image search runs any more.
   */
  const handleImageRetry = async () => {
    if (!form.name.trim()) {
      toast.error("Enter the product name first.");
      return;
    }
    setImageStatus({ state: "loading" });
    try {
      const result = await lookupCatalogImageAction({
        productName: form.name,
        hints: { sku: form.sku || undefined },
      });
      if (!result.found) {
        const message = result.message ?? CATALOG_PRODUCT_NOT_FOUND_MESSAGE;
        setImageStatus({ state: "unverified", message });
        toast.error(message, { duration: 9000 });
        return;
      }
      if (result.ambiguous) {
        setCandidates(
          result.suggestions.map((suggestion) => ({
            name: suggestion.name,
            manufacturer: suggestion.brand ?? suggestion.manufacturer ?? "",
            composition: [suggestion.strength, suggestion.packSize]
              .filter(Boolean)
              .join(" · "),
            form: suggestion.form,
          })),
        );
        setImageStatus({ state: "idle" });
        toast.info(
          "Several exact variants match this name. Select the exact product, then fetch its image.",
        );
        return;
      }
      if (!result.hasImage || !result.imageUrl) {
        const message = result.message ?? CATALOG_IMAGE_NOT_FOUND_MESSAGE;
        setImageStatus({ state: "unverified", message });
        toast.error(message, { duration: 9000 });
        return;
      }
      setForm({
        ...form,
        imageUrl: result.imageUrl,
        additionalImages: result.additionalImages,
        imageSource: result.imageSource ?? undefined,
        imageUrlSource: result.imageUrlSource ?? undefined,
      });
      const views = 1 + result.additionalImages.length;
      setImageStatus({
        state: "verified",
        matchedName: result.matchedName ?? form.name,
        views: result.additionalImages.length,
        source: result.imageSource ?? "master product catalog",
        complete: views >= TARGET_GALLERY_IMAGES,
        message:
          views >= TARGET_GALLERY_IMAGES
            ? undefined
            : `The verified catalog record ships ${views} image view${views === 1 ? "" : "s"}.`,
      });
      toast.success(
        result.additionalImages.length > 0
          ? `Verified catalog packshot + ${result.additionalImages.length} product view${result.additionalImages.length === 1 ? "" : "s"}`
          : "Verified catalog packshot applied",
      );
    } catch (error) {
      setImageStatus({
        state: "unverified",
        message:
          error instanceof Error && error.message
            ? error.message
            : "Catalog image lookup failed.",
      });
    }
  };

  /**
   * ADMIN AUTO FILL — the verified master catalog is the only source.
   *
   * The admin types the product name; the catalog answers with the exact
   * variant (or the honest not-found / pick-the-variant response); that
   * record's own metadata and its own stored images fill the existing form.
   * Nothing is guessed, nothing is published here — the admin reviews and
   * saves through the normal flow.
   */
  const runCatalogAutoFill = async (typedName: string) => {
    const name = typedName.trim();
    if (!name) {
      toast.error("Please enter a product name first");
      return;
    }
    setAutoFilling(true);
    try {
      const result = await catalogAutoFillAction({
        productName: name,
        // The SKU is the only hint passed: a stable code is an exact lookup of
        // its own. Everything else comes from the name the admin typed.
        hints: { sku: form.sku || undefined },
      });

      if (!result.found) {
        const message = result.message ?? CATALOG_PRODUCT_NOT_FOUND_MESSAGE;
        setCandidates(null);
        setMatchInfo({
          productKind: "unknown",
          kindConfident: false,
          kindReason: "",
          matchFound: false,
          matchSource: null,
          sourceUrl: null,
          sources: result.sources,
          notice: message,
        });
        toast.error(message, { duration: 9000 });
        return;
      }

      if (!result.record) {
        // Several exact variants share this name: offer them, apply nothing.
        setCandidates(result.suggestions.map(toCandidate));
        setMatchInfo({
          productKind: "unknown",
          kindConfident: false,
          kindReason: "",
          matchFound: false,
          matchSource: null,
          sourceUrl: null,
          sources: result.sources,
          notice:
            "Several exact variants match this name. Select the exact product below, then click Auto Fill again.",
        });
        toast.info("Select the exact product variant, then Auto Fill again.");
        return;
      }

      const record = result.record;
      const newForm = { ...form };
      const filled: string[] = [];
      // A placeholder left over from an earlier auto-fill is never kept.
      if (/^data:/i.test(newForm.imageUrl ?? "")) newForm.imageUrl = undefined;

      // Product name — the canonical spelling of the exact catalog record.
      newForm.name = record.canonicalProductName;
      if (!newForm.slug || newForm.slug === slugify(name)) {
        newForm.slug = slugify(record.canonicalProductName);
      }
      filled.push("Name");
      if (record.manufacturer) {
        newForm.manufacturer = record.manufacturer;
        filled.push("Manufacturer");
      }
      if (record.brand && !newForm.brandId && brands) {
        const matchedBrand = brands.find(
          (b) => b.name.toLowerCase() === record.brand?.toLowerCase(),
        );
        if (matchedBrand) {
          newForm.brandId = matchedBrand._id;
          filled.push("Brand");
        }
      }
      if (record.composition) {
        newForm.composition = record.composition;
        filled.push("Composition");
      }
      if (record.form) {
        newForm.form = record.form;
        filled.push("Form");
      }
      if (record.strength) {
        newForm.strength = record.strength;
        if (!newForm.dosage) newForm.dosage = record.strength;
        filled.push("Strength");
      }
      if (record.packSize) {
        newForm.packSize = record.packSize;
        filled.push("Pack Size");
      }
      if (record.sku) {
        newForm.sku = record.sku;
        filled.push("SKU");
      }
      if (record.mrp !== null && record.mrp > 0) {
        newForm.price = record.mrp;
        filled.push("MRP");
      }
      if (record.prescriptionRequired !== null) {
        newForm.prescriptionRequired = record.prescriptionRequired;
        filled.push("Prescription");
      }
      if (record.description) {
        newForm.description = record.description;
        filled.push("Description");
      }
      if (record.benefits) {
        newForm.benefits = record.benefits;
        filled.push("Benefits");
      }
      if (record.directions) {
        newForm.consumeType = record.directions;
        filled.push("Directions");
      }
      if (record.safety) {
        newForm.safetyNote = record.safety;
        filled.push("Safety");
      }
      if (record.storage) {
        newForm.storageInformation = record.storage;
        filled.push("Storage Information");
      }
      // Category — matched to the store's own category tree when the record
      // names one and the form does not have a choice yet.
      if (!newForm.categoryId && record.category && hierarchicalCategories) {
        const wanted = record.category.toLowerCase();
        for (const parent of hierarchicalCategories) {
          const child = parent.children?.find(
            (c) => c.name.toLowerCase() === wanted,
          );
          if (child) {
            newForm.categoryId = child._id;
            filled.push("Category");
            break;
          }
        }
        if (!newForm.categoryId) {
          for (const parent of hierarchicalCategories) {
            if (
              parent.name.toLowerCase() === wanted &&
              parent.children.length === 0
            ) {
              newForm.categoryId = parent._id;
              filled.push("Category");
              break;
            }
          }
        }
      }

      // Images: the SAME record's own verified assets (or the exact
      // missing-image message — never a substitute).
      filled.push(...applyCatalogRecordImages(newForm, record));

      // The exact record Auto Fill just matched is the identity the promotion
      // resolver reuses — no second, independent product-matching system.
      newForm.productPromotion = {
        ...newForm.productPromotion,
        catalogProductId: record.catalogProductId,
        matchProductName: record.canonicalProductName,
      };

      setForm(newForm);
      setCandidates(null);
      setMatchInfo({
        productKind: record.form ?? "unknown",
        kindConfident: record.verificationStatus === "VERIFIED",
        kindReason: "Matched the exact record in the verified product catalog.",
        matchFound: true,
        matchSource: "catalog",
        sourceUrl: record.sourceUrl,
        sources: result.sources,
        notice: null,
      });

      if (!record.hasImage) {
        toast.error(CATALOG_IMAGE_NOT_FOUND_MESSAGE, { duration: 9000 });
      }
      if (record.verificationStatus === "NEEDS_REVIEW") {
        toast.warning(
          "This catalog record is marked NEEDS_REVIEW — check the identity before publishing.",
          { duration: 9000 },
        );
      }
      if (filled.length > 0) {
        toast.success(
          `Auto-filled from the verified catalog record: ${filled.join(", ")}`,
        );
      } else {
        toast.info(
          `No catalog fields to apply for "${record.canonicalProductName}". Review the form before saving.`,
        );
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to auto-fill from the product catalog");
    } finally {
      setAutoFilling(false);
    }
  };

  const handleAutoFillAll = async () => {
    await runCatalogAutoFill(form.name);
  };

  /** Picking an autocomplete row applies that exact record immediately. */
  const handleCatalogSelect = async (suggestion: CatalogSuggestion) => {
    setForm((previous) => ({ ...previous, name: suggestion.name }));
    await runCatalogAutoFill(suggestion.name);
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

  const handleImageAudit = async () => {
    setAuditRunning(true);
    try {
      const report = await auditProductImagesAction({ reResolve: true });
      setAuditReport(report);
      if (report.flagged.length === 0) {
        toast.success(
          `Every stored image is a verified packshot (${report.total} products checked).`,
        );
      } else {
        toast.success(
          `${report.flagged.length} of ${report.total} images needed attention — ${report.repaired.length} re-resolved${report.unresolved.length > 0 ? `, ${report.unresolved.length} could not be verified` : ""}.`,
        );
      }
    } catch (error: any) {
      toast.error(error.message || "Image audit failed");
    } finally {
      setAuditRunning(false);
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
      // The metadata pass never writes images, so re-resolve the image here as
      // well — a legacy placeholder or a foreign diagram is repaired or left
      // untouched, never replaced with something invented.
      const image = await repairProductImageAction({
        productId: productId as any,
      });
      if (image.ok) {
        toast.success(`Product image set from "${image.matchedName}"`);
        if (!image.complete) {
          toast.warning(
            image.message ??
              `${TARGET_GALLERY_IMAGES} verified product images could not be found for this exact product.`,
            { duration: 9000 },
          );
        }
      } else {
        toast.error(`Product image not replaced: ${image.message}`);
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

  const isLoading = products === undefined || hierarchicalCategories === undefined;

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
              onClick={() => setImportOpen(true)}
              className="gap-2"
            >
              <Database className="size-4" />
              Import catalog
            </Button>
            <Button
              variant="outline"
              onClick={handleImageAudit}
              disabled={auditRunning}
              className="gap-2"
            >
              {auditRunning ? <Loader2 className="size-4 animate-spin" /> : <ShieldAlert className="size-4" />}
              Audit Images
            </Button>
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

        {auditReport && (
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="size-4 text-amber-500" />
                  Image audit
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setAuditReport(null)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {auditReport.total} products checked · {auditReport.flagged.length} needed attention
                {auditReport.reResolved
                  ? ` · ${auditReport.repaired.length} re-resolved`
                  : ""}
                {auditReport.flagged.some(
                  (item) => item.suspiciousSource || item.imageUrlSource,
                ) && (
                  <span className="block text-[11px] text-muted-foreground/80">
                    Each flagged image lists the source it was stored from.
                  </span>
                )}
                {auditReport.unresolved.length > 0
                  ? ` · ${auditReport.unresolved.length} could not be verified`
                  : ""}
              </p>
              {auditReport.flagged.length === 0 ? (
                <p className="flex items-center gap-1.5 text-sm text-green-600">
                  <CheckCircle2 className="size-4" /> Every stored image is a verified exact-product
                  packshot.
                </p>
              ) : (
                <div className="max-h-64 divide-y divide-border/60 overflow-y-auto rounded-lg border border-border/60">
                  {auditReport.flagged.map((item, index) => (
                    <div
                      key={`${item.name}-${item.reason}-${index}`}
                      className="flex items-start justify-between gap-3 p-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {AUDIT_REASON_COPY[item.reason ?? ""] ?? item.reason ?? "Unknown issue"}
                        </p>
                        {(item.suspiciousSource || item.imageUrlSource) && (
                          <p
                            className="truncate font-mono text-[10px] text-muted-foreground/80"
                            title={item.suspiciousSource ?? item.imageUrlSource}
                          >
                            source: {item.imageSource ? `${item.imageSource} · ` : ""}
                            {item.suspiciousSource ?? item.imageUrlSource}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" className="shrink-0 text-[10px]">
                        {item.reason ?? "unknown"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
              {auditReport.incomplete.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Short of {TARGET_GALLERY_IMAGES} verified images:{" "}
                  {auditReport.incomplete
                    .map((item) => `${item.name} (${item.views})`)
                    .join(", ")}{" "}
                  — these products do not publish that many genuine views, and
                  nothing unverified was added to fill the gap.
                </p>
              )}
              {auditReport.unresolved.length > 0 && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-2.5">
                  <p className="text-xs font-medium text-destructive">
                    Exact product packshot could not be verified
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {auditReport.unresolved.map((item) => item.name).join(", ")} — check the name,
                    strength and form, then resolve those products individually. No placeholder was
                    stored.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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
                  {hierarchicalCategories?.map((parent) => (
                    parent.children.length > 0 ? (
                      parent.children.map((child, i) => (
                        <SelectItem key={child._id} value={child._id}>
                          {i === 0 ? parent.name + " \u2192 " : ""}{child.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem key={parent._id} value={parent._id}>{parent.name}</SelectItem>
                    )
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

        {/* Read-only window into the verified catalog Auto Fill reads. */}
        <MasterCatalogBrowser />

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
                <p className="text-[11px] text-muted-foreground">Enter the exact product name, then click Auto Fill to auto-populate the details for that product.</p>

                {/* Autocomplete from the verified master catalog: every row is
                    an exact variant imported from the licensed dataset, with
                    its strength, form and pack shown so the admin picks the
                    exact record before anything is filled in. */}
                {catalogSuggestions && catalogSuggestions.length > 0 && (
                  <div className="rounded-lg border border-border bg-muted/30 p-2 space-y-1.5">
                    <p className="text-[11px] font-semibold">
                      Verified catalog records — select the exact product:
                    </p>
                    {catalogSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.catalogProductId}
                        type="button"
                        className="w-full text-left rounded-md border border-border/60 bg-card px-2 py-1.5 text-[11px] hover:border-primary/40 transition-colors"
                        onClick={() => handleCatalogSelect(suggestion)}
                        disabled={autoFilling}
                      >
                        <span className="font-medium text-foreground">{suggestion.name}</span>
                        <span className="text-muted-foreground">
                          {" "}—{" "}
                          {[suggestion.brand, suggestion.strength, suggestion.form, suggestion.packSize]
                            .filter(Boolean)
                            .join(" · ") || "no further variant details"}
                        </span>
                        {suggestion.verificationStatus !== "VERIFIED" && (
                          <span className="ml-1 text-amber-600">
                            {suggestion.verificationStatus === "NEEDS_IMAGE"
                              ? "· needs image"
                              : "· needs review"}
                          </span>
                        )}
                        {!suggestion.hasImage && (
                          <span className="ml-1 text-muted-foreground">· no verified image yet</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Review panel: the admin confirms WHAT was matched before
                    publishing, rather than trusting a silent overwrite. */}
                {matchInfo && (
                  <div
                    className={`rounded-lg border p-2.5 text-[11px] space-y-1.5 ${
                      matchInfo.matchFound
                        ? "bg-emerald-50/60 border-emerald-200"
                        : "bg-amber-50/60 border-amber-200"
                    }`}
                  >
                    <p className="font-semibold text-foreground">
                      Identified as: {matchInfo.productKind.replace(/_/g, " ")}
                    </p>
                    {matchInfo.matchFound && (
                      <p className="text-muted-foreground">
                        Verified from:{" "}
                        {matchInfo.matchSource === "catalog"
                          ? "verified product catalog"
                          : matchInfo.matchSource === "online"
                            ? "online product source"
                            : "reference catalogue"}
                        {matchInfo.sourceUrl && (
                          <>
                            {" · "}
                            <a
                              href={matchInfo.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              source page
                            </a>
                          </>
                        )}
                      </p>
                    )}
                    {matchInfo.kindReason && (
                      <p className="text-muted-foreground">Why: {matchInfo.kindReason}</p>
                    )}
                    {!matchInfo.matchFound && (
                      <p className="text-amber-800 font-medium leading-relaxed">
                        {matchInfo.notice ?? NO_CONFIDENT_MATCH_MESSAGE}
                      </p>
                    )}
                    {/* Which sources were asked, and what each one answered. A
                        blocked or empty source is shown as such, so a failure is
                        never mistaken for "this product does not exist". */}
                    {matchInfo.sources.length > 0 && (
                      <div className="text-muted-foreground">
                        <p className="font-medium text-foreground">
                          Sources checked:
                        </p>
                        <ul className="mt-0.5 space-y-0.5">
                          {matchInfo.sources.map((source, index) => (
                            <li key={`${source.id}-${index}`}>
                              {source.label} — {source.detail}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-muted-foreground">
                      Directions and safety text are written for this product type. Please
                      review every field before saving.
                    </p>
                  </div>
                )}

                {/* Ambiguous names: offer the exact variants to pick from. */}
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-[11px] h-6 px-2"
                    onClick={async () => {
                      if (!form.name.trim()) return;
                      setFindingCandidates(true);
                      try {
                        // Same catalog query as Auto Fill, but it only ever
                        // OFFERS the exact variants — it applies nothing.
                        const found = await catalogAutoFillAction({
                          productName: form.name,
                          hints: { sku: form.sku || undefined },
                        });
                        if (!found.found) {
                          setCandidates(null);
                          toast.error(
                            found.message ?? CATALOG_PRODUCT_NOT_FOUND_MESSAGE,
                            { duration: 9000 },
                          );
                        } else if (!found.record) {
                          setCandidates(found.suggestions.map(toCandidate));
                          toast.info("Select the exact product.");
                        } else {
                          setCandidates(null);
                          const canonical = found.record.canonicalProductName;
                          setForm((previous) => ({ ...previous, name: canonical }));
                          toast.info(
                            `Exact product found: "${canonical}". Click Auto Fill to apply it.`,
                          );
                        }
                      } catch (err) {
                        toast.error(
                          err instanceof Error && err.message
                            ? err.message
                            : "Lookup failed",
                        );
                      } finally {
                        setFindingCandidates(false);
                      }
                    }}
                    disabled={findingCandidates || !form.name.trim()}
                  >
                    {findingCandidates ? <Loader2 className="size-3 animate-spin" /> : <Search className="size-3" />}
                    Find matching products
                  </Button>
                </div>

                {candidates && candidates.length > 0 && (
                  <div className="rounded-lg border border-border bg-muted/30 p-2 space-y-1.5">
                    <p className="text-[11px] font-semibold">Select the exact product:</p>
                    {candidates.map((c) => (
                      <button
                        key={`${c.name}-${c.composition}`}
                        type="button"
                        className="w-full text-left rounded-md border border-border/60 bg-card px-2 py-1.5 text-[11px] hover:border-primary/40 transition-colors"
                        onClick={() => {
                          setForm((prev) => ({ ...prev, name: c.name }));
                          setCandidates(null);
                          toast.info(`Set name to "${c.name}". Click Auto Fill to apply it.`);
                        }}
                      >
                        <span className="font-medium text-foreground">{c.name}</span>
                        <span className="text-muted-foreground">
                          {" "}— {c.manufacturer}, {c.composition}
                          {c.form ? ` (${c.form})` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
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
                    {hierarchicalCategories?.map((parent) => (
                      <div key={parent._id}>
                        {parent.children.length > 0 ? (
                          parent.children.map((child, i) => (
                            <SelectItem key={child._id} value={child._id}>
                              {i === 0 ? `${parent.name} → ` : '\u00A0\u00A0\u00A0\u00A0'}{child.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem key={parent._id} value={parent._id}>{parent.name}</SelectItem>
                        )}
                      </div>
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
                <Select value={form.form || undefined} onValueChange={(v) => setForm({ ...form, form: v })}>
                  <SelectTrigger><SelectValue placeholder="Select form" /></SelectTrigger>
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
                <div className="flex items-center gap-2">
                  <Input value={form.imageUrl || ""} onChange={(e) => setForm({ ...form, imageUrl: e.target.value || undefined })} placeholder="https://... or click Fetch image" />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={handleImageRetry}
                    disabled={imageStatus.state === "loading" || !form.name.trim()}
                  >
                    {imageStatus.state === "loading" ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                    <span className="ml-1.5">{form.imageUrl ? "Re-fetch" : "Fetch image"}</span>
                  </Button>
                </div>
                {imageStatus.state === "loading" && (
                  <p className="text-xs text-muted-foreground">Finding the exact product image…</p>
                )}
                {imageStatus.state === "verified" && (
                  <p
                    className={`text-xs ${imageStatus.complete ? "text-green-600" : "text-amber-600"}`}
                  >
                    Verified packshot: {imageStatus.matchedName}
                    {imageStatus.source ? ` · source: ${imageStatus.source}` : ""}
                    {` · ${imageStatus.views + 1} of ${TARGET_GALLERY_IMAGES} verified images`}
                    {imageStatus.complete
                      ? " · gallery complete"
                      : " · not image-complete"}
                  </p>
                )}
                {imageStatus.state === "verified" && !imageStatus.complete && (
                  <p className="text-xs text-amber-600">
                    {imageStatus.message ??
                      `${TARGET_GALLERY_IMAGES} verified product images could not be found for this exact product.`}
                  </p>
                )}
                {imageStatus.state === "unverified" && (
                  <p className="text-xs text-destructive">
                    {imageStatus.message} Check the name, strength and form, then retry — a placeholder is never saved.
                  </p>
                )}
                {form.imageUrl && (
                  <div className="mt-2 flex items-center gap-3">
                    <div className="size-16 rounded-lg border border-border/60 bg-muted/30 flex items-center justify-center overflow-hidden">
                      <img src={form.imageUrl} alt="Preview" className="size-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => setForm({ ...form, imageUrl: undefined, imageSource: undefined, imageUrlSource: undefined })}>
                      <X className="size-3 mr-1" /> Remove
                    </Button>
                  </div>
                )}
              </div>
              <div className="sm:col-span-2 space-y-2">
                <Label>Additional Product Images (Gallery)</Label>
                <p className="text-[11px] text-muted-foreground">Up to {TARGET_GALLERY_IMAGES - 1} real views of this exact product ({TARGET_GALLERY_IMAGES} images in total), filled automatically by Auto Fill / Fetch image. They appear as selectable thumbnails on the product page; edit or remove any you do not want. Nothing is ever added that is not a genuine view of the same product.</p>
                {form.additionalImages.some((img) => img.trim()) && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {form.imageUrl && (
                      <div className="size-16 rounded-lg border-2 border-primary bg-muted/30 flex items-center justify-center overflow-hidden" title="Main image">
                        <img src={form.imageUrl} alt="Main" className="size-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      </div>
                    )}
                    {form.additionalImages
                      .map((img) => img.trim())
                      .filter(Boolean)
                      .map((img, idx) => (
                        <div key={`${img}-${idx}`} className="size-16 rounded-lg border border-border/60 bg-muted/30 flex items-center justify-center overflow-hidden" title={`View ${idx + 1}`}>
                          <img src={img} alt={`View ${idx + 1}`} className="size-full object-contain p-1" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        </div>
                      ))}
                  </div>
                )}
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
              {/* ── Product Promotion (optional, this product only) ── */}
              <div className="sm:col-span-2 space-y-3 rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Label className="text-sm font-semibold">Product Promotion</Label>
                    <p className="text-[11px] text-muted-foreground">
                      Optional manufacturer/promo creatives shown only on this product's page. Kept separate from the product gallery.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={form.productPromotion.enabled}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        setForm({
                          ...form,
                          productPromotion: {
                            ...form.productPromotion,
                            enabled,
                          },
                        });
                        // Switching it on triggers the automatic lookup, so the
                        // admin never has to hunt for banner images.
                        if (enabled) void resolvePromotionMedia();
                      }}
                      className="rounded"
                    />
                    Enable Product Promotion
                  </label>
                </div>

                {form.productPromotion.enabled && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] text-muted-foreground">
                        Creatives are resolved automatically for the exact product from the approved product media catalog. Manual upload is optional.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1"
                        onClick={() => void resolvePromotionMedia()}
                        disabled={resolvingPromotion}
                      >
                        {resolvingPromotion ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <RefreshCw className="size-3" />
                        )}
                        Refresh Promotional Media
                      </Button>
                    </div>

                    {form.productPromotion.status === "resolving" && (
                      <p className="text-xs text-muted-foreground">
                        Looking up verified promotional media for this exact product…
                      </p>
                    )}

                    {form.productPromotion.status === "ambiguous" &&
                      form.productPromotion.suggestions &&
                      form.productPromotion.suggestions.length > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
                          <p className="text-xs font-semibold text-amber-800">
                            Multiple possible product matches found. Please select
                            the exact product.
                          </p>
                          <ul className="space-y-0.5">
                            {form.productPromotion.suggestions.map((s) => (
                              <li key={s.productName} className="text-xs text-amber-900/80">
                                {s.productName}
                                {s.manufacturer ? ` · ${s.manufacturer}` : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                    {(form.productPromotion.status === "no-media" ||
                      form.productPromotion.status === "not-found" ||
                      form.productPromotion.status === "mismatch" ||
                      form.productPromotion.status === "error") && (
                      <div className="rounded-lg border border-border/60 bg-background p-3">
                        <p className="text-xs text-muted-foreground">
                          {form.productPromotion.statusMessage ??
                            "No verified promotional media could be resolved."}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          No promotional section will be shown on the product page until valid creatives exist. Nothing is ever substituted.
                        </p>
                      </div>
                    )}

                    {form.productPromotion.status === "resolved" && (
                      <div className="rounded-lg border border-border/60 bg-background p-3 space-y-1">
                        <p className="text-xs font-semibold">
                          Promotional creatives found:{" "}
                          {form.productPromotion.creatives.length}
                        </p>
                        {form.productPromotion.matchProductName && (
                          <p className="text-[11px] text-muted-foreground">
                            Exact product: {form.productPromotion.matchProductName}
                          </p>
                        )}
                        {form.productPromotion.resolvedFrom && (
                          <p className="text-[11px] text-muted-foreground">
                            Source: {form.productPromotion.resolvedFrom}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          {form.productPromotion.mode === "automatic"
                            ? "Saved automatically from the catalog. Editing a creative below switches to your own set."
                            : "Admin-curated set — saved as provided."}
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Promotion Section Title</Label>
                      <Input
                        value={form.productPromotion.title}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            productPromotion: {
                              ...form.productPromotion,
                              title: e.target.value,
                            },
                          })
                        }
                        placeholder="From the Manufacturer"
                      />
                    </div>

                    {form.productPromotion.creatives.map((creative, i) => (
                      <div
                        key={i}
                        className="rounded-lg border border-border/60 bg-background p-3 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground">
                              Creative {i + 1} of {form.productPromotion.creatives.length}
                            </p>
                            {creative.source && (
                              <p className="text-[10px] text-muted-foreground">
                                Source: {creative.source}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              disabled={i === 0}
                              onClick={() => movePromoCreative(i, -1)}
                              title="Move up"
                            >
                              <ChevronUp className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              disabled={i === form.productPromotion.creatives.length - 1}
                              onClick={() => movePromoCreative(i, 1)}
                              title="Move down"
                            >
                              <ChevronDown className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 text-destructive"
                              onClick={() => removePromoCreative(i)}
                              title="Remove"
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                          <div className="size-24 rounded-lg border border-border/60 bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
                            {creative.imageUrl ? (
                              <img
                                src={creative.imageUrl}
                                alt={`Promotion creative ${i + 1}`}
                                className="size-full object-contain p-1"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = "none";
                                }}
                              />
                            ) : (
                              <ImageIcon className="size-6 text-muted-foreground/40" />
                            )}
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <label className="cursor-pointer shrink-0">
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = "";
                                    if (file) handlePromoUpload(i, file);
                                  }}
                                />
                                <span className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-xs hover:bg-muted/40">
                                  {promoUploading === i ? (
                                    <Loader2 className="size-3 animate-spin" />
                                  ) : (
                                    <ImageIcon className="size-3" />
                                  )}
                                  Upload image
                                </span>
                              </label>
                              <Input
                                value={creative.url || ""}
                                onChange={(e) =>
                                  updatePromoCreative(i, {
                                    url: e.target.value,
                                    imageUrl: e.target.value,
                                    storageId: undefined,
                                  })
                                }
                                placeholder="or paste an image URL"
                                className="h-8 text-xs flex-1"
                              />
                            </div>
                            <Input
                              value={creative.heading}
                              onChange={(e) => updatePromoCreative(i, { heading: e.target.value })}
                              placeholder="Optional heading (e.g. Long-Lasting Protection)"
                              className="h-8 text-xs"
                            />
                            <Input
                              value={creative.description}
                              onChange={(e) =>
                                updatePromoCreative(i, { description: e.target.value })
                              }
                              placeholder="Optional supporting text"
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    ))}

                    {form.productPromotion.creatives.length < 4 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1"
                        onClick={addPromoCreative}
                      >
                        <Plus className="size-3" />
                        Add Creative
                      </Button>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      Up to 4 creatives, shown on the product page in this order with their size and ratio preserved. Resolved creatives stay separate from the product gallery.
                    </p>
                  </div>
                )}
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

        {/* Licensed catalog import (CSV/XLSX + optional image ZIP). The
            importer fills the master catalog; Auto Fill reads it. */}
        <MasterCatalogImportDialog open={importOpen} onOpenChange={setImportOpen} />

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
