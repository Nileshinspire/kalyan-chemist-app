import { query, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// ── List active categories with product counts (public) ──
export const list = query({
  handler: async (ctx) => {
    const categories = await ctx.db
      .query("categories")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    categories.sort((a, b) => a.sortOrder - b.sortOrder);

    const enriched = await Promise.all(
      categories.map(async (c) => {
        const products = await ctx.db
          .query("products")
          .withIndex("by_category", (q) => q.eq("categoryId", c._id))
          .collect();
        const activeProducts = products.filter((p) => p.isActive);
        return { ...c, productCount: activeProducts.length };
      })
    );

    return enriched;
  },
});

// ── Get a single category by slug ──
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

// ── Internal: upsert category (for seed) ──
export const upsertCategory = internalMutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    sortOrder: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        description: args.description,
        sortOrder: args.sortOrder,
      });
      return existing._id;
    }

    return await ctx.db.insert("categories", {
      name: args.name,
      slug: args.slug,
      description: args.description,
      isActive: true,
      sortOrder: args.sortOrder,
    });
  },
});

// ── Internal: upsert product (for seed) ──
export const upsertProduct = internalMutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    price: v.number(),
    manufacturer: v.string(),
    dosage: v.string(),
    packSize: v.string(),
    prescriptionRequired: v.boolean(),
    stockQuantity: v.number(),
    imageUrl: v.optional(v.string()),
    categoryId: v.id("categories"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("products")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    const now = Date.now();
    const data = {
      name: args.name,
      slug: args.slug,
      description: args.description,
      price: args.price,
      manufacturer: args.manufacturer,
      dosage: args.dosage,
      packSize: args.packSize,
      prescriptionRequired: args.prescriptionRequired,
      stockQuantity: args.stockQuantity,
      imageUrl: args.imageUrl,
      categoryId: args.categoryId,
      isActive: true,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }

    return await ctx.db.insert("products", {
      ...data,
      createdAt: now,
    });
  },
});

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

export const seedDefaultCategories = internalAction({
  args: {},
  handler: async (ctx) => {
    let created = 0;
    let updated = 0;
    for (const cat of DEFAULT_CATEGORIES) {
      await ctx.runMutation(internal.categories.upsertCategory, {
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        sortOrder: cat.sortOrder,
      });
      created++;
    }
    return { created, updated, total: DEFAULT_CATEGORIES.length };
  },
});
