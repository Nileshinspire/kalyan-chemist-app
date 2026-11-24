import { query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  getHealthKitAvailability,
  getHealthKitQuote,
  resolveHealthKitPricing,
} from "./healthKitsCore";
import type { KitSelectionLine } from "../lib/healthKitQuote";

const sortValidator = v.optional(
  v.union(
    v.literal("featured"),
    v.literal("price_low"),
    v.literal("price_high"),
    v.literal("newest"),
    v.literal("discount"),
  ),
);

type KitProduct = Doc<"products"> & {
  healthKit: NonNullable<Doc<"products">["healthKit"]>;
};

function isKit(product: Doc<"products">): product is KitProduct {
  return !!product.healthKit;
}

async function kitCard(
  db: { get: (id: any) => Promise<any> },
  product: KitProduct,
  categoryName: string | null,
) {
  const [availability, pricing] = await Promise.all([
    getHealthKitAvailability(db, product),
    resolveHealthKitPricing(db, product),
  ]);
  const componentNames = pricing.components.map((line) => line.name);
  return {
    _id: product._id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    imageUrl:
      product.imageUrl ??
      pricing.components.find((line) => !!line.imageUrl)?.imageUrl ??
      null,
    additionalImages: product.additionalImages ?? [],
    categoryName,
    sellingPrice: pricing.sellingPrice,
    mrp: pricing.catalogueMrp,
    effectiveCatalogueValue: pricing.effectiveCatalogueValue,
    discountPercent: pricing.discountPercent,
    savings: pricing.savings,
    productSavings: pricing.productSavings,
    kitDiscountAmount: pricing.kitDiscountAmount,
    pricingMode: pricing.mode,
    kitDiscountPercent: pricing.kitDiscountPercent,
    available: availability.available,
    maxQuantity: availability.maxQuantity,
    unavailableReason: availability.unavailableReason,
    componentCount: product.healthKit.components.length,
    componentNames,
    createdAt: product.createdAt,
  };
}

/** Active discovery categories, each with a real kit-image fallback. */
export const categories = query({
  args: {},
  handler: async (ctx) => {
    const [categories, products] = await Promise.all([
      ctx.db.query("healthKitCategories").collect(),
      ctx.db.query("products").withIndex("by_isActive", (q) => q.eq("isActive", true)).collect(),
    ]);
    const kits = products.filter(isKit);

    return categories
      .filter((category) => category.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((category) => {
        const categoryKits = kits.filter(
          (kit) => kit.healthKit.categoryId === category._id,
        );
        const fallbackImage = categoryKits
          .map(
            (kit) =>
              kit.imageUrl ??
              kit.additionalImages?.[0],
          )
          .find(Boolean);
        return {
          _id: category._id,
          name: category.name,
          slug: category.slug,
          description: category.description ?? null,
          imageUrl: category.imageUrl ?? fallbackImage ?? null,
          kitCount: categoryKits.length,
        };
      });
  },
});

/** Active kits in active categories, with search, filter and sort. */
export const list = query({
  args: {
    search: v.optional(v.string()),
    categorySlug: v.optional(v.string()),
    sort: sortValidator,
    inStockOnly: v.optional(v.boolean()),
    maxPrice: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const [categories, products] = await Promise.all([
      ctx.db.query("healthKitCategories").collect(),
      ctx.db.query("products").withIndex("by_isActive", (q) => q.eq("isActive", true)).collect(),
    ]);
    const activeCategories = new Map(
      categories.filter((category) => category.isActive).map((category) => [category._id, category]),
    );
    const selectedCategory = args.categorySlug
      ? categories.find((category) => category.slug === args.categorySlug && category.isActive)
      : null;
    if (args.categorySlug && !selectedCategory) return [];

    const search = (args.search ?? "").trim().toLowerCase();
    const rows = await Promise.all(
      products
        .filter(isKit)
        .filter((kit) => activeCategories.has(kit.healthKit.categoryId))
        .filter(
          (kit) =>
            !selectedCategory || kit.healthKit.categoryId === selectedCategory._id,
        )
        .map(async (kit) =>
          kitCard(
            ctx.db,
            kit,
            activeCategories.get(kit.healthKit.categoryId)?.name ?? null,
          ),
        ),
    );

    let filtered = rows.filter((kit) => {
      if (args.maxPrice !== undefined && kit.sellingPrice > args.maxPrice) return false;
      if (args.inStockOnly && !kit.available) return false;
      if (!search) return true;
      return [kit.name, kit.description, kit.categoryName ?? "", ...kit.componentNames]
        .join(" ")
        .toLowerCase()
        .includes(search);
    });

    const sort = args.sort ?? "featured";
    filtered = filtered.sort((a, b) => {
      switch (sort) {
        case "price_low":
          return a.sellingPrice - b.sellingPrice;
        case "price_high":
          return b.sellingPrice - a.sellingPrice;
        case "discount":
          return b.discountPercent - a.discountPercent;
        case "newest":
          return b.createdAt - a.createdAt;
        case "featured":
        default:
          return Number(b.available) - Number(a.available) || b.createdAt - a.createdAt;
      }
    });

    return filtered;
  },
});

/** A single active kit with its complete included-product list. */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const product = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (!product || !product.isActive || !isKit(product)) return null;

    const category = await ctx.db.get(product.healthKit.categoryId);
    if (!category || !category.isActive) return null;

    const [availability, pricing] = await Promise.all([
      getHealthKitAvailability(ctx.db, product),
      resolveHealthKitPricing(ctx.db, product),
    ]);
    return {
      ...(await kitCard(ctx.db, product, category.name)),
      category: {
        _id: category._id,
        name: category.name,
        slug: category.slug,
        description: category.description ?? null,
      },
      // If the admin has not uploaded a kit-specific image yet, use the real
      // images of the included catalogue products rather than an empty slot.
      images: Array.from(
        new Set(
          [
            product.imageUrl,
            ...(product.additionalImages ?? []),
            ...pricing.components.map((line) => line.imageUrl),
          ].filter((image): image is string => !!image),
        ),
      ),
      components: pricing.components.map((line) => {
        const availabilityLine = availability.components.find(
          (row) => row.product._id === line.productId,
        );
        return {
          productId: line.productId,
          name: line.name,
          slug: line.slug,
          imageUrl: line.imageUrl,
          quantity: line.configuredQuantity,
          packSize: line.packSize,
          manufacturer: line.manufacturer,
          stockQuantity: line.stockQuantity,
          mrp: line.mrp,
          effectiveUnitPrice: line.effectiveUnitPrice,
          expiryDate: line.expiryDate,
          isActive: line.isActive,
          inStock: availabilityLine?.inStock ?? false,
          availableKits: availabilityLine?.availableKits ?? 0,
        };
      }),
      available: availability.available,
      maxQuantity: availability.maxQuantity,
      unavailableReason: availability.unavailableReason,
      sellingPrice: pricing.sellingPrice,
      mrp: pricing.catalogueMrp,
      effectiveCatalogueValue: pricing.effectiveCatalogueValue,
      discountPercent: pricing.discountPercent,
      savings: pricing.savings,
      productSavings: pricing.productSavings,
      kitDiscountAmount: pricing.kitDiscountAmount,
      pricingMode: pricing.mode,
      kitDiscountPercent: pricing.kitDiscountPercent,
    };
  },
});

/** Authoritative preview used by custom Buy Now and the kit customizer. */
export const getQuote = query({
  args: {
    productId: v.id("products"),
    selection: v.optional(
      v.array(v.object({ productId: v.id("products"), quantity: v.number() })),
    ),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product || !product.isActive || !isKit(product)) return null;
    const result = await getHealthKitQuote(
      ctx.db,
      product,
      args.selection as KitSelectionLine[] | undefined,
    );
    if (!result) return null;
    return {
      kit: {
        _id: product._id,
        name: product.name,
        slug: product.slug,
        imageUrl: product.imageUrl ?? null,
      },
      quote: result.quote,
      available: result.quote.available,
      maxQuantity: result.quote.maxQuantity,
      unavailableReason: result.quote.unavailableReason,
    };
  },
});
