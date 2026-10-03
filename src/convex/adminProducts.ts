import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { isVerifiedProductImage } from "./productImageResolver";
import {
  CATALOG_PROMOTION_SOURCE_LABEL,
  MAX_PROMOTION_MEDIA,
  assessCatalogMatch,
  type IdentityInput,
} from "./masterCatalogCore";

// ── Helper: verify caller is admin ──
async function requireAdmin(ctx: { db: any; auth: any }) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (user?.role !== "admin") throw new Error("Not authorized");
  return userId;
}

/**
 * A generated placeholder is never a product image. Auto-enrichment writes the
 * verified packshot instead (see productImageResolver); anything starting with
 * `data:` is a generated graphic from the old flow and is refused outright.
 */
function assertRealImageUrl(imageUrl: string | undefined, required: boolean) {
  const value = (imageUrl ?? "").trim();
  if (!value) {
    if (required) {
      throw new Error(
        "A verified product image is required. Use Auto-fetch to resolve the exact product image, then save.",
      );
    }
    return;
  }
  if (/^data:/i.test(value)) {
    throw new Error(
      "Generated placeholder images are not allowed. Use Auto-fetch to resolve the real product image.",
    );
  }
}

/**
 * A NEW product is only saved with a real, verified product photograph.
 *
 * "Verified" means this project's own image pipeline downloaded that asset from
 * the exact product's catalogue record and stored it in Convex storage. A
 * pasted external URL, a stock photo, a logo or a missing image is refused,
 * because nothing has checked that it depicts THIS product — and a product page
 * whose picture belongs to some other product is the one failure an admin
 * cannot see for themselves.
 */
function assertVerifiedImageForNewProduct(imageUrl: string | undefined) {
  const value = (imageUrl ?? "").trim();
  assertRealImageUrl(value, true);
  if (!isVerifiedProductImage(value)) {
    throw new Error(
      "A new product must be saved with a verified product packshot. Run Auto Fill (or Fetch image) so the exact product record's own image is stored, then save.",
    );
  }
}

/**
 * Product promotion exactly as the admin form sends it. An image arrives
 * either as a fresh Convex storage upload (`storageId`) or as a pasted external
 * URL (`url`); the server resolves the storage upload to a durable URL. Any
 * creative with no usable image — including a temporary `blob:` preview URL —
 * is dropped, so a stored promotion never holds an empty or made-up slot.
 */
const promotionCreativeInput = v.object({
  storageId: v.optional(v.id("_storage")),
  url: v.optional(v.string()),
  heading: v.optional(v.string()),
  description: v.optional(v.string()),
});

const productPromotionInput = v.object({
  enabled: v.boolean(),
  title: v.optional(v.string()),
  /**
   * Set when the creatives were resolved automatically. The server then reads
   * the approved catalog record ITSELF and ignores any creative the browser
   * sent, so promotional media can never be reassigned to the wrong product.
   */
  catalogProductId: v.optional(v.string()),
  creatives: v.array(promotionCreativeInput),
});

/** The exact catalog record a promotion was resolved against. */
async function findCatalogRow(db: any, catalogProductId: string): Promise<any> {
  return await db
    .query("masterCatalog")
    .withIndex("by_catalogProductId", (q: any) =>
      q.eq("catalogProductId", catalogProductId),
    )
    .first();
}

/**
 * Turn the admin form's promotion into what is actually stored.
 *
 * Two sources, and the browser is never trusted for either:
 *
 *   • Automatic — the form names the catalog record, and this function re-reads
 *     that record, re-checks it against THIS product with the same strict
 *     matcher Auto Fill uses, and takes its own approved creatives. A variant
 *     that does not match yields no creatives rather than the wrong ones.
 *   • Manual — an admin upload (a Convex storage id) or a URL they supplied.
 *     Temporary `blob:` previews are never persisted.
 */
async function normalizeProductPromotion(
  ctx: { db: any; storage: any },
  input:
    | {
        enabled: boolean;
        title?: string;
        catalogProductId?: string;
        creatives: Array<{
          storageId?: any;
          url?: string;
          heading?: string;
          description?: string;
        }>;
      }
    | undefined,
  identity?: IdentityInput,
) {
  if (!input) return undefined;
  const title = input.title?.trim() || undefined;

  if (input.catalogProductId) {
    const row = await findCatalogRow(ctx.db, input.catalogProductId);
    if (!row) {
      return { enabled: input.enabled, title, creatives: [] };
    }
    const verdict = assessCatalogMatch(
      {
        name: row.canonicalProductName,
        strength: row.strength ?? null,
        form: row.dosageForm ?? null,
        packSize: row.packSize ?? null,
        manufacturer: row.manufacturer ?? null,
        brand: row.brand ?? null,
      },
      identity ?? { name: row.canonicalProductName },
    );
    if (verdict.verdict === "reject") {
      return { enabled: input.enabled, title, creatives: [] };
    }
    const media = Array.isArray(row.promotionalMedia) ? row.promotionalMedia : [];
    const creatives = media
      .filter(
        (item: any) =>
          item &&
          typeof item.imageUrl === "string" &&
          item.imageUrl.trim().length > 0 &&
          !/^(blob|data):/i.test(item.imageUrl.trim()),
      )
      .map((item: any, index: number) => ({
        imageUrl: item.imageUrl.trim(),
        heading: item.heading?.trim() || undefined,
        description: item.description?.trim() || undefined,
        source: item.source?.trim() || CATALOG_PROMOTION_SOURCE_LABEL,
        sourceProductId:
          item.sourceProductId?.trim() || row.sourceProductId?.trim() || undefined,
        origin: "automatic" as const,
        order: typeof item.order === "number" ? item.order : index,
      }))
      .sort((a: any, b: any) => a.order - b.order)
      .slice(0, MAX_PROMOTION_MEDIA)
      .map(({ order, ...creative }: any) => creative);

    return {
      enabled: input.enabled,
      title,
      catalogProductId: row.catalogProductId,
      matchProductName: row.canonicalProductName,
      resolvedFrom: media[0]?.source?.trim() || CATALOG_PROMOTION_SOURCE_LABEL,
      resolvedAt: Date.now(),
      creatives,
    };
  }

  const creatives: Array<{
    imageUrl: string;
    storageId?: any;
    heading?: string;
    description?: string;
    origin?: "manual";
  }> = [];
  for (const raw of input.creatives ?? []) {
    let imageUrl = (raw.url ?? "").trim();
    if (raw.storageId) {
      try {
        const resolved = await ctx.storage.getUrl(raw.storageId);
        if (resolved) imageUrl = resolved;
      } catch {
        // Fall back to any pasted URL when the upload can no longer be read.
      }
    }
    if (!imageUrl || /^blob:/i.test(imageUrl)) continue;
    creatives.push({
      imageUrl,
      storageId: raw.storageId ?? undefined,
      heading: raw.heading?.trim() || undefined,
      description: raw.description?.trim() || undefined,
      origin: "manual",
    });
  }
  return { enabled: input.enabled, title, creatives };
}

/**
 * A short-lived, admin-only upload URL for a promotion creative. Convex storage
 * is this project's own secure store, so no separate image service is added.
 * Customers can never call this — it is gated on the admin role.
 */
export const generatePromotionUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Admin check usable from actions (which cannot read the database directly). */
export const isAdminUser = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    const user = await ctx.db.get(userId);
    return user?.role === "admin";
  },
});

/** Every product with the identity fields the image pipeline needs. */
export const productsForImageAudit = internalQuery({
  args: {},
  handler: async (ctx) => {
    const products = await ctx.db.query("products").collect();
    return products.map((product) => ({
      id: product._id,
      name: product.name,
      imageUrl: (product.imageUrl ?? "").trim(),
      additionalImages: (product.additionalImages ?? []).map((url) =>
        String(url ?? "").trim(),
      ),
      imageSource: product.imageSource ?? "",
      imageUrlSource: product.imageUrlSource ?? "",
      manufacturer: product.manufacturer ?? "",
      composition: product.composition ?? "",
      form: product.form ?? "",
      strength: product.strength ?? "",
      dosage: product.dosage ?? "",
      packSize: product.packSize ?? "",
      sku: product.sku ?? "",
    }));
  },
});

/** The same identity fields for one product, used by the per-row repair. */
export const productImageRow = internalQuery({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) return null;
    return {
      id: product._id,
      name: product.name,
      imageUrl: (product.imageUrl ?? "").trim(),
      additionalImages: (product.additionalImages ?? []).map((url) =>
        String(url ?? "").trim(),
      ),
      imageSource: product.imageSource ?? "",
      imageUrlSource: product.imageUrlSource ?? "",
      manufacturer: product.manufacturer ?? "",
      composition: product.composition ?? "",
      form: product.form ?? "",
      strength: product.strength ?? "",
      dosage: product.dosage ?? "",
      packSize: product.packSize ?? "",
      sku: product.sku ?? "",
    };
  },
});

/**
 * Write a resolved image. Only `imageUrl` is touched, so a repair can never
 * change a product's name, price, stock, category or any other field.
 */
export const setProductImage = internalMutation({
  args: {
    productId: v.id("products"),
    imageUrl: v.string(),
    /**
     * Genuine other views of the same product. Every URL is validated like the
     * primary image and de-duplicated against it, so a gallery can never hold a
     * placeholder, the front image twice, or an empty slot.
     */
    additionalImages: v.optional(v.array(v.string())),
    /** Provenance of the packshot: the source label and its original image URL. */
    imageSource: v.optional(v.string()),
    imageUrlSource: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const imageUrl = args.imageUrl.trim();
    assertRealImageUrl(imageUrl, true);

    const seen = new Set([imageUrl]);
    const additionalImages: string[] = [];
    for (const raw of args.additionalImages ?? []) {
      const url = String(raw ?? "").trim();
      if (!url || seen.has(url)) continue;
      assertRealImageUrl(url, false);
      seen.add(url);
      additionalImages.push(url);
    }

    await ctx.db.patch(args.productId, {
      imageUrl,
      additionalImages:
        additionalImages.length > 0 ? additionalImages : undefined,
      // Keep provenance in step with the image it describes, so an audit never
      // reads a stale source for a freshly replaced packshot.
      imageSource: args.imageSource?.trim() || undefined,
      imageUrlSource: args.imageUrlSource?.trim() || undefined,
      updatedAt: Date.now(),
    });
  },
});

// ── Admin: List all products (including inactive) ──
export const list = query({
  args: {
    search: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    brandId: v.optional(v.id("brands")),
    isActive: v.optional(v.boolean()),
    sortBy: v.optional(v.union(
      v.literal("name"),
      v.literal("price"),
      v.literal("stockQuantity"),
      v.literal("createdAt"),
    )),
    sortOrder: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    let products = await ctx.db.query("products").collect();

    // Filter by search term
    if (args.search) {
      const s = args.search.toLowerCase();
      products = products.filter(
        (p) =>
          p.name.toLowerCase().includes(s) ||
          (p.sku && p.sku.toLowerCase().includes(s)) ||
          p.manufacturer.toLowerCase().includes(s)
      );
    }

    // Filter by category
    if (args.categoryId) {
      products = products.filter((p) => p.categoryId === args.categoryId);
    }

    // Filter by brand
    if (args.brandId) {
      products = products.filter((p) => p.brandId === args.brandId);
    }

    // Filter by active status
    if (args.isActive !== undefined) {
      products = products.filter((p) => p.isActive === args.isActive);
    }

    // Enrich with category and brand names
    const enriched = await Promise.all(
      products.map(async (p) => {
        const category = await ctx.db.get(p.categoryId);
        const brand = p.brandId ? await ctx.db.get(p.brandId) : null;
        return {
          ...p,
          categoryName: category?.name ?? "Unknown",
          brandName: brand?.name ?? null,
        };
      })
    );

    // Sort
    const field = args.sortBy ?? "createdAt";
    const order = args.sortOrder ?? "desc";
    enriched.sort((a, b) => {
      const aVal = a[field] ?? "";
      const bVal = b[field] ?? "";
      if (typeof aVal === "number" && typeof bVal === "number") {
        return order === "asc" ? aVal - bVal : bVal - aVal;
      }
      const cmp = String(aVal).localeCompare(String(bVal));
      return order === "asc" ? cmp : -cmp;
    });

    return enriched;
  },
});

// ── Admin: Get a single product by ID ──
export const get = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) return null;
    const category = await ctx.db.get(product.categoryId);
    const brand = product.brandId ? await ctx.db.get(product.brandId) : null;
    return { ...product, categoryName: category?.name ?? "Unknown", brandName: brand?.name ?? null };
  },
});

// ── Admin: Create a new product ──
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    brandId: v.optional(v.id("brands")),
    composition: v.optional(v.string()),
    description: v.string(),
    price: v.number(),
    discountPrice: v.optional(v.number()),
    categoryId: v.id("categories"),
    imageUrl: v.optional(v.string()),
    additionalImages: v.optional(v.array(v.string())),
    /** Where the packshot came from, recorded by the image pipeline. */
    imageSource: v.optional(v.string()),
    imageUrlSource: v.optional(v.string()),
    manufacturer: v.string(),
    dosage: v.optional(v.string()),
    packSize: v.string(),
    packSizeVariants: v.optional(v.array(v.object({
      label: v.string(),
      price: v.number(),
      discountPrice: v.optional(v.number()),
      stockQuantity: v.number(),
      sku: v.optional(v.string()),
    }))),
    strength: v.optional(v.string()),
    form: v.optional(v.string()),
    sku: v.optional(v.string()),
    prescriptionRequired: v.boolean(),
    storageInformation: v.optional(v.string()),
    stockQuantity: v.number(),
    benefits: v.optional(v.string()),
    consumeType: v.optional(v.string()),
    safetyNote: v.optional(v.string()),
    expiryDate: v.optional(v.number()),
    /** Optional admin-controlled promotion; omitted means no promotion. */
    productPromotion: v.optional(productPromotionInput),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertVerifiedImageForNewProduct(args.imageUrl);

    // Check for duplicate slug
    const existing = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) throw new Error("A product with this slug already exists");

    const { productPromotion: promoInput, ...rest } = args;
    const productPromotion = await normalizeProductPromotion(ctx, promoInput, {
      name: args.name,
      strength: args.strength ?? null,
      form: args.form ?? null,
      packSize: args.packSize ?? null,
      manufacturer: args.manufacturer ?? null,
    });

    const now = Date.now();
    const doc: any = { ...rest, createdAt: now, updatedAt: now };
    if (productPromotion) doc.productPromotion = productPromotion;
    const productId: Id<"products"> = await ctx.db.insert("products", doc);
    return productId;
  },
});

// ── Admin: Update an existing product ──
export const update = mutation({
  args: {
    productId: v.id("products"),
    name: v.string(),
    slug: v.string(),
    brandId: v.optional(v.id("brands")),
    composition: v.optional(v.string()),
    description: v.string(),
    price: v.number(),
    discountPrice: v.optional(v.number()),
    categoryId: v.id("categories"),
    imageUrl: v.optional(v.string()),
    additionalImages: v.optional(v.array(v.string())),
    /** Where the packshot came from, recorded by the image pipeline. */
    imageSource: v.optional(v.string()),
    imageUrlSource: v.optional(v.string()),
    manufacturer: v.string(),
    dosage: v.optional(v.string()),
    packSize: v.string(),
    packSizeVariants: v.optional(v.array(v.object({
      label: v.string(),
      price: v.number(),
      discountPrice: v.optional(v.number()),
      stockQuantity: v.number(),
      sku: v.optional(v.string()),
    }))),
    strength: v.optional(v.string()),
    form: v.optional(v.string()),
    sku: v.optional(v.string()),
    prescriptionRequired: v.boolean(),
    storageInformation: v.optional(v.string()),
    stockQuantity: v.number(),
    benefits: v.optional(v.string()),
    consumeType: v.optional(v.string()),
    safetyNote: v.optional(v.string()),
    expiryDate: v.optional(v.number()),
    /** Optional admin-controlled promotion; omitted means no promotion. */
    productPromotion: v.optional(productPromotionInput),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    assertRealImageUrl(args.imageUrl, false);

    // An edit never downgrades a product that already has a verified packshot:
    // if the incoming form carries no new verified image, the stored one and its
    // provenance are kept exactly as they are. A verified replacement does take
    // over, because that is the point of re-resolving.
    const current = await ctx.db.get(args.productId);
    const stored = (current?.imageUrl ?? "").trim();
    const incoming = (args.imageUrl ?? "").trim();
    if (
      current &&
      isVerifiedProductImage(stored) &&
      !isVerifiedProductImage(incoming)
    ) {
      args = {
        ...args,
        imageUrl: stored,
        additionalImages: current.additionalImages,
        imageSource: current.imageSource,
        imageUrlSource: current.imageUrlSource,
      };
    }

    const { productId, productPromotion: promoInput, ...updates } = args;
    const productPromotion = await normalizeProductPromotion(ctx, promoInput, {
      name: args.name,
      strength: args.strength ?? null,
      form: args.form ?? null,
      packSize: args.packSize ?? null,
      manufacturer: args.manufacturer ?? null,
    });

    // Check slug uniqueness (excluding this product)
    const existing = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing && existing._id !== productId) {
      throw new Error("A product with this slug already exists");
    }

    const patch: any = { ...updates, updatedAt: Date.now() };
    if (productPromotion) patch.productPromotion = productPromotion;
    await ctx.db.patch(productId, patch);
    return productId;
  },
});

// ── Admin: Delete a product ──
export const remove = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.productId);
    return { success: true };
  },
});

// ── Admin: Toggle product active status ──
export const toggleActive = mutation({
  args: { productId: v.id("products"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.productId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

// ── Admin: Bulk update products ──
export const bulkUpdate = mutation({
  args: {
    productIds: v.array(v.id("products")),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    for (const id of args.productIds) {
      await ctx.db.patch(id, { isActive: args.isActive, updatedAt: Date.now() });
    }
    return { success: true, count: args.productIds.length };
  },
});

// ── Admin: Get expiring/expired medicines ──
const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000; // ~3 months in ms

type ExpiryStatus = "expired" | "expiring_soon";

type ExpiringProduct = {
  _id: Id<"products">;
  name: string;
  imageUrl: string | undefined;
  expiryDate: number;
  stockQuantity: number;
  expiryStatus: ExpiryStatus;
  daysUntilExpiry: number;
  categoryName: string;
  manufacturer: string;
};

export const getExpiringMedicines = query({
  args: {},
  handler: async (ctx): Promise<ExpiringProduct[]> => {
    const now = Date.now();
    const allProducts = await ctx.db.query("products").collect();

    const expiringProducts: ExpiringProduct[] = [];

    for (const product of allProducts) {
      if (!product.expiryDate) continue;

      const daysUntilExpiry = Math.floor(
        (product.expiryDate - now) / (1000 * 60 * 60 * 24)
      );

      let expiryStatus: ExpiryStatus | null = null;

      if (product.expiryDate <= now) {
        expiryStatus = "expired";
      } else if (product.expiryDate <= now + THREE_MONTHS_MS) {
        expiryStatus = "expiring_soon";
      }

      if (expiryStatus) {
        const category = await ctx.db.get(product.categoryId);
        expiringProducts.push({
          _id: product._id,
          name: product.name,
          imageUrl: product.imageUrl,
          expiryDate: product.expiryDate,
          stockQuantity: product.stockQuantity,
          expiryStatus,
          daysUntilExpiry,
          categoryName: category?.name ?? "Unknown",
          manufacturer: product.manufacturer,
        });
      }
    }

    // Sort: expired first (most overdue first), then expiring soon (soonest first)
    expiringProducts.sort((a, b) => a.expiryDate - b.expiryDate);

    return expiringProducts;
  },
});

// ── Admin: Get count of expiring products (for notification badge) ──
export const getExpiringMedicinesCount = query({
  args: {},
  handler: async (ctx): Promise<{ expired: number; expiringSoon: number; total: number }> => {
    const now = Date.now();
    const allProducts = await ctx.db.query("products").collect();

    let expired = 0;
    let expiringSoon = 0;

    for (const product of allProducts) {
      if (!product.expiryDate) continue;

      if (product.expiryDate <= now) {
        expired++;
      } else if (product.expiryDate <= now + THREE_MONTHS_MS) {
        expiringSoon++;
      }
    }

    return { expired, expiringSoon, total: expired + expiringSoon };
  },
});
