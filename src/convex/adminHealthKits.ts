import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { getHealthKitAvailability, kitDiscountPercent, kitSellingPrice } from "./healthKitsCore";

async function requireAdmin(ctx: { db: any; auth: any }) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (user?.role !== "admin") throw new Error("Not authorized");
  return userId;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function cleanImageUrl(value: string | undefined): string | undefined {
  const url = (value ?? "").trim();
  if (!url) return undefined;
  if (/^(data|blob):/i.test(url)) {
    throw new Error("Upload the image (or paste a public https image URL) instead of a temporary preview.");
  }
  return url;
}

async function ensureSystemCategory(ctx: { db: any }) {
  const existing = await ctx.db
    .query("categories")
    .withIndex("by_slug", (q: any) => q.eq("slug", "health-kits-catalogue"))
    .first();
  if (existing) return existing._id as Id<"categories">;
  return await ctx.db.insert("categories", {
    name: "Health Kits",
    slug: "health-kits-catalogue",
    description: "Curated health and care kits.",
    isActive: false,
    sortOrder: 9999,
  });
}

const componentInput = v.object({
  productId: v.id("products"),
  quantity: v.number(),
});

const kitInput = {
  name: v.string(),
  slug: v.optional(v.string()),
  description: v.string(),
  categoryId: v.id("healthKitCategories"),
  sellingPrice: v.number(),
  mrp: v.optional(v.number()),
  imageUrl: v.optional(v.string()),
  additionalImages: v.optional(v.array(v.string())),
  isActive: v.boolean(),
  components: v.array(componentInput),
};

async function validateKitInput(
  ctx: { db: any },
  args: {
    name: string;
    slug?: string;
    description: string;
    categoryId: Id<"healthKitCategories">;
    sellingPrice: number;
    mrp?: number;
    imageUrl?: string;
    additionalImages?: string[];
    components: Array<{ productId: Id<"products">; quantity: number }>;
    productId?: Id<"products">;
  },
) {
  const name = args.name.trim();
  const description = args.description.trim();
  if (name.length < 2) throw new Error("Kit name is required.");
  if (description.length < 10) throw new Error("Add a short kit description (at least 10 characters).");

  const category = await ctx.db.get(args.categoryId);
  if (!category) throw new Error("Choose a valid kit category.");

  if (!Number.isFinite(args.sellingPrice) || args.sellingPrice <= 0) {
    throw new Error("Selling price must be greater than zero.");
  }
  const sellingPrice = Math.round(args.sellingPrice * 100) / 100;
  const mrp =
    args.mrp === undefined || !Number.isFinite(args.mrp)
      ? sellingPrice
      : Math.round(args.mrp * 100) / 100;
  if (mrp < sellingPrice) {
    throw new Error("Compare-at price cannot be lower than the selling price.");
  }

  if (!args.components.length) throw new Error("Select at least one product for the kit.");
  if (args.components.length > 40) throw new Error("A kit can include at most 40 products.");

  const quantities = new Map<string, { productId: Id<"products">; quantity: number }>();
  for (const component of args.components) {
    if (!Number.isInteger(component.quantity) || component.quantity < 1 || component.quantity > 99) {
      throw new Error("Each included product quantity must be a whole number between 1 and 99.");
    }
    const product = await ctx.db.get(component.productId);
    if (!product) throw new Error("One of the selected products no longer exists.");
    if (product.healthKit) {
      throw new Error("A health kit cannot include another health kit.");
    }
    if (!product.isActive) {
      throw new Error(`"${product.name}" is inactive and cannot be added to a kit.`);
    }
    if (product.prescriptionRequired) {
      throw new Error(
        `"${product.name}" requires a prescription, so it cannot be sold inside a health kit.`,
      );
    }
    const current = quantities.get(component.productId as string);
    quantities.set(component.productId as string, {
      productId: component.productId,
      quantity: (current?.quantity ?? 0) + component.quantity,
    });
  }
  for (const component of quantities.values()) {
    if (component.quantity > 99) {
      throw new Error("Each included product quantity must be between 1 and 99.");
    }
  }

  const slug = slugify(args.slug?.trim() || name);
  if (!slug) throw new Error("A valid kit URL slug is required.");
  const existing = await ctx.db
    .query("products")
    .withIndex("by_slug", (q: any) => q.eq("slug", slug))
    .first();
  if (existing && existing._id !== args.productId) {
    throw new Error("A kit or product with this URL slug already exists.");
  }

  const imageUrl = cleanImageUrl(args.imageUrl);
  const additionalImages = Array.from(
    new Set(
      (args.additionalImages ?? [])
        .map((value) => cleanImageUrl(value))
        .filter((value): value is string => !!value && value !== imageUrl),
    ),
  );

  return {
    name,
    slug,
    description,
    sellingPrice,
    mrp,
    imageUrl,
    additionalImages,
    components: [...quantities.values()],
  };
}

/** Admin kit list, including inactive kits and derived availability. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [products, categories] = await Promise.all([
      ctx.db.query("products").collect(),
      ctx.db.query("healthKitCategories").collect(),
    ]);
    const categoryById = new Map(categories.map((category) => [category._id, category]));
    const kits = products.filter((product) => !!product.healthKit);
    return await Promise.all(
      kits.map(async (product) => {
        const availability = await getHealthKitAvailability(ctx.db, product);
        const category = product.healthKit
          ? categoryById.get(product.healthKit.categoryId)
          : null;
        const components = await Promise.all(
          (product.healthKit?.components ?? []).map(async (component) => {
            const included = await ctx.db.get(component.productId);
            return {
              productId: component.productId,
              quantity: component.quantity,
              name: included?.name ?? "Unavailable product",
              imageUrl: included?.imageUrl ?? null,
              packSize: included?.packSize ?? null,
            };
          }),
        );
        return {
          ...product,
          components,
          kitCategoryName: category?.name ?? "Uncategorised",
          kitCategoryId: category?._id ?? null,
          componentCount: product.healthKit?.components.length ?? 0,
          maxQuantity: availability.maxQuantity,
          available: availability.available,
          unavailableReason: availability.unavailableReason,
          sellingPrice: kitSellingPrice(product),
          discountPercent: kitDiscountPercent(product),
        };
      }),
    );
  },
});

/** Active, non-kit catalogue products for the kit contents picker. */
export const productOptions = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const search = (args.search ?? "").trim().toLowerCase();
    const [products, categories] = await Promise.all([
      ctx.db.query("products").withIndex("by_isActive", (q) => q.eq("isActive", true)).collect(),
      ctx.db.query("categories").collect(),
    ]);
    const categoryById = new Map(categories.map((category) => [category._id, category.name]));
    return products
      .filter((product) => !product.healthKit && !product.prescriptionRequired)
      .filter((product) =>
        !search
          ? true
          : [product.name, product.manufacturer, product.sku ?? ""]
              .join(" ")
              .toLowerCase()
              .includes(search),
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 100)
      .map((product) => ({
        _id: product._id,
        name: product.name,
        imageUrl: product.imageUrl ?? null,
        packSize: product.packSize,
        price: product.discountPrice ?? product.price,
        stockQuantity: product.stockQuantity,
        categoryName: categoryById.get(product.categoryId) ?? null,
      }));
  },
});

/** Admin category list with kit counts. */
export const categoryList = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [categories, products] = await Promise.all([
      ctx.db.query("healthKitCategories").collect(),
      ctx.db.query("products").collect(),
    ]);
    return categories
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
      .map((category) => ({
        ...category,
        kitCount: products.filter(
          (product) => product.healthKit?.categoryId === category._id,
        ).length,
      }));
  },
});

export const createCategory = mutation({
  args: {
    name: v.string(),
    imageUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    sortOrder: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = args.name.trim();
    if (name.length < 2) throw new Error("Category name is required.");
    const slug = slugify(name);
    const existing = await ctx.db
      .query("healthKitCategories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) throw new Error("A kit category with this name already exists.");
    return await ctx.db.insert("healthKitCategories", {
      name,
      slug,
      description: args.description?.trim() || undefined,
      imageUrl: cleanImageUrl(args.imageUrl),
      isActive: args.isActive ?? true,
      sortOrder: args.sortOrder ?? Date.now(),
    });
  },
});

export const updateCategory = mutation({
  args: {
    categoryId: v.id("healthKitCategories"),
    name: v.string(),
    imageUrl: v.optional(v.string()),
    description: v.optional(v.string()),
    isActive: v.boolean(),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const name = args.name.trim();
    if (name.length < 2) throw new Error("Category name is required.");
    const slug = slugify(name);
    const duplicate = await ctx.db
      .query("healthKitCategories")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (duplicate && duplicate._id !== args.categoryId) {
      throw new Error("A kit category with this name already exists.");
    }
    await ctx.db.patch(args.categoryId, {
      name,
      slug,
      description: args.description?.trim() || undefined,
      imageUrl: cleanImageUrl(args.imageUrl),
      isActive: args.isActive,
      sortOrder: args.sortOrder,
    });
    return { success: true };
  },
});

export const removeCategory = mutation({
  args: { categoryId: v.id("healthKitCategories") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const products = await ctx.db.query("products").collect();
    const inUse = products.some(
      (product) => product.healthKit?.categoryId === args.categoryId,
    );
    if (inUse) throw new Error("Move or delete the kits in this category first.");
    await ctx.db.delete(args.categoryId);
    return { success: true };
  },
});

export const create = mutation({
  args: { ...kitInput },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const validated = await validateKitInput(ctx, args);
    const systemCategoryId = await ensureSystemCategory(ctx);
    const description =
      args.description.trim();
    const now = Date.now();
    return await ctx.db.insert("products", {
      name: validated.name,
      slug: validated.slug,
      description,
      price: validated.mrp,
      discountPrice:
        validated.sellingPrice < validated.mrp ? validated.sellingPrice : undefined,
      discountSource: "manual",
      categoryId: systemCategoryId,
      imageUrl: validated.imageUrl,
      additionalImages:
        validated.additionalImages.length > 0 ? validated.additionalImages : undefined,
      manufacturer: "Kalyan Chemist",
      packSize: `${validated.components.length} item${validated.components.length === 1 ? "" : "s"}`,
      prescriptionRequired: false,
      stockQuantity: 0,
      isActive: args.isActive,
      healthKit: {
        categoryId: args.categoryId,
        components: validated.components,
      },
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: { ...kitInput, productId: v.id("products") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const product = await ctx.db.get(args.productId);
    if (!product || !product.healthKit) throw new Error("Health kit not found.");
    const validated = await validateKitInput(ctx, args);
    await ctx.db.patch(args.productId, {
      name: validated.name,
      slug: validated.slug,
      description: validated.description,
      price: validated.mrp,
      discountPrice:
        validated.sellingPrice < validated.mrp ? validated.sellingPrice : undefined,
      discountSource: "manual",
      imageUrl: validated.imageUrl,
      additionalImages:
        validated.additionalImages.length > 0 ? validated.additionalImages : undefined,
      packSize: `${validated.components.length} item${validated.components.length === 1 ? "" : "s"}`,
      isActive: args.isActive,
      healthKit: {
        categoryId: args.categoryId,
        components: validated.components,
      },
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const toggleActive = mutation({
  args: { productId: v.id("products"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const product = await ctx.db.get(args.productId);
    if (!product || !product.healthKit) throw new Error("Health kit not found.");
    await ctx.db.patch(args.productId, {
      isActive: args.isActive,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const remove = mutation({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const product = await ctx.db.get(args.productId);
    if (!product || !product.healthKit) throw new Error("Health kit not found.");
    // Clean existing cart references so no customer is left with a broken line.
    const carts = await ctx.db.query("cart_items").collect();
    for (const item of carts) {
      if (item.productId === args.productId) await ctx.db.delete(item._id);
    }
    await ctx.db.delete(args.productId);
    return { success: true };
  },
});

/** Admin-only upload URL for a kit image. */
export const generateImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const resolveUploadedImage = mutation({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Uploaded image could not be resolved.");
    return url;
  },
});
