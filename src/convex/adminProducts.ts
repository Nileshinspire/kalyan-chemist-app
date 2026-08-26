import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

// ── Helper: verify caller is admin ──
async function requireAdmin(ctx: { db: any; auth: any }) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (user?.role !== "admin") throw new Error("Not authorized");
  return userId;
}

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
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Check for duplicate slug
    const existing = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) throw new Error("A product with this slug already exists");

    const now = Date.now();
    const productId: Id<"products"> = await ctx.db.insert("products", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
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
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const { productId, ...updates } = args;

    // Check slug uniqueness (excluding this product)
    const existing = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing && existing._id !== productId) {
      throw new Error("A product with this slug already exists");
    }

    await ctx.db.patch(productId, {
      ...updates,
      updatedAt: Date.now(),
    });
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
