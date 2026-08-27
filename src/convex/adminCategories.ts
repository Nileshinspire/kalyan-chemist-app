import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

async function requireAdmin(ctx: { db: any; auth: any }) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (user?.role !== "admin") throw new Error("Not authorized");
  return userId;
}

// ── Admin: List all categories ──
export const list = query({
  args: {
    search: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let categories = await ctx.db.query("categories").collect();

    if (args.search) {
      const s = args.search.toLowerCase();
      categories = categories.filter((c) => c.name.toLowerCase().includes(s));
    }

    if (args.isActive !== undefined) {
      categories = categories.filter((c) => c.isActive === args.isActive);
    }

    // Sort by sortOrder
    categories.sort((a, b) => a.sortOrder - b.sortOrder);

    // Enrich with product count
    const enriched = await Promise.all(
      categories.map(async (c) => {
        let products;
        if (c.slug === "prescription-required") {
          // Prescription Required is a virtual category based on the product flag
          products = await ctx.db
            .query("products")
            .filter((q) => q.eq(q.field("prescriptionRequired"), true))
            .collect();
        } else {
          products = await ctx.db
            .query("products")
            .withIndex("by_category", (q) => q.eq("categoryId", c._id))
            .collect();
        }
        return { ...c, productCount: products.length };
      })
    );

    return enriched;
  },
});

// ── Admin: Get a single category ──
export const get = query({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.categoryId);
  },
});

// List products for a specific category
export const listCategoryProducts = query({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.categoryId);
    if (!category) return { category: null, products: [] };

    let products;
    if (category.slug === "prescription-required") {
      // Prescription Required: show ALL products where prescriptionRequired === true
      products = await ctx.db
        .query("products")
        .filter((q) => q.eq(q.field("prescriptionRequired"), true))
        .collect();
    } else {
      products = await ctx.db
        .query("products")
        .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
        .collect();
    }

    return {
      category: { _id: category._id, name: category.name, slug: category.slug },
      products: products.map((p) => ({
        _id: p._id,
        name: p.name,
        slug: p.slug,
        price: p.price,
        stockQuantity: p.stockQuantity,
        imageUrl: p.imageUrl,
        isActive: p.isActive,
        prescriptionRequired: p.prescriptionRequired,
        manufacturer: p.manufacturer,
      })),
    };
  },
});

// ── Admin: Create a category ──
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing) throw new Error("A category with this slug already exists");

    const id: Id<"categories"> = await ctx.db.insert("categories", {
      ...args,
      isActive: true,
    });
    return id;
  },
});

// ── Admin: Update a category ──
export const update = mutation({
  args: {
    categoryId: v.id("categories"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const { categoryId, ...updates } = args;

    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
    if (existing && existing._id !== categoryId) {
      throw new Error("A category with this slug already exists");
    }

    await ctx.db.patch(categoryId, updates);
    return categoryId;
  },
});

// ── Admin: Delete a category ──
export const remove = mutation({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Check if products use this category
    const products = await ctx.db
      .query("products")
      .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId))
      .collect();
    if (products.length > 0) {
      throw new Error(
        `Cannot delete category: ${products.length} product(s) still use it. Reassign them first.`
      );
    }

    await ctx.db.delete(args.categoryId);
    return { success: true };
  },
});

// ── Admin: Toggle category active status ──
export const toggleActive = mutation({
  args: { categoryId: v.id("categories"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.patch(args.categoryId, { isActive: args.isActive });
    return { success: true };
  },
});

// Seed all default categories (idempotent — upserts by slug)
export const seedAll = mutation({
  args: {},
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const DEFAULT_CATEGORIES = [
      { name: "Pain Relief", slug: "pain-relief", description: "Analgesics, anti-inflammatory drugs, and muscle relaxants", sortOrder: 1 },
      { name: "Heart & Cardio", slug: "heart-cardio", description: "Cardiac care, blood pressure, and cholesterol management", sortOrder: 2 },
      { name: "Diabetes Care", slug: "diabetes-care", description: "Insulin, oral hypoglycaemics, and glucose monitoring supplies", sortOrder: 3 },
      { name: "Vitamins & Supplements", slug: "vitamins-supplements", description: "Daily wellness, immunity boosters, and nutritional supplements", sortOrder: 4 },
      { name: "Baby & Mother", slug: "baby-mother", description: "Infant nutrition, prenatal vitamins, and maternal care", sortOrder: 5 },
      { name: "Skin & Personal Care", slug: "skin-personal-care", description: "Dermatological products, sunscreens, and hygiene essentials", sortOrder: 6 },
      { name: "Antibiotics", slug: "antibiotics", description: "Prescription antibiotics and antimicrobial agents", sortOrder: 7 },
      { name: "Digestive Health", slug: "digestive-health", description: "Antacids, probiotics, and gastrointestinal medications", sortOrder: 8 },
      { name: "Family Care", slug: "family-care", description: "Mother and maternity care products for the whole family", sortOrder: 9 },
      { name: "Sexual Wellness", slug: "sexual-wellness", description: "Contraceptives and sexual wellness products", sortOrder: 10 },
      { name: "Personal Care", slug: "personal-care", description: "Hair care, oral care, eye and ear care essentials", sortOrder: 11 },
      { name: "Health & Safety", slug: "health-safety", description: "Cold and cough remedies, first aid, medical devices, and hygiene products", sortOrder: 12 },
      { name: "Nutrition", slug: "nutrition", description: "Nutrition and health drinks for daily wellness", sortOrder: 13 },
      { name: "Alternative Medicine", slug: "alternative-medicine", description: "Ayurvedic and herbal medicines for natural healing", sortOrder: 14 },
      { name: "Other Healthcare", slug: "other-healthcare", description: "Home healthcare products and other healthcare essentials", sortOrder: 15 },
      { name: "Prescription Required", slug: "prescription-required", description: "Medications that require a valid prescription", sortOrder: 16 },
    ];
    let created = 0;
    for (const cat of DEFAULT_CATEGORIES) {
      const existing = await ctx.db.query("categories").withIndex("by_slug", (q) => q.eq("slug", cat.slug)).first();
      if (existing) {
        await ctx.db.patch(existing._id, { name: cat.name, description: cat.description, sortOrder: cat.sortOrder, isActive: true });
      } else {
        await ctx.db.insert("categories", { ...cat, isActive: true });
        created++;
      }
    }
    return { created, total: DEFAULT_CATEGORIES.length };
  },
});
