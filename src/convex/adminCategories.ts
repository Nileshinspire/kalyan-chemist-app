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

// ── Helper: count products for a category (direct + all descendants) ──
async function countProductsForCategory(db: any, categoryId: Id<"categories">, slug: string): Promise<number> {
  if (slug === "prescription-required") {
    const all = await db.query("products").filter((q: any) => q.eq(q.field("prescriptionRequired"), true)).collect();
    return all.length;
  }
  // Direct products
  const direct = await db.query("products").withIndex("by_category", (q: any) => q.eq("categoryId", categoryId)).collect();
  // Child categories
  const children = await db.query("categories").withIndex("by_parentId", (q: any) => q.eq("parentId", categoryId)).collect();
  let childCount = 0;
  for (const child of children) {
    childCount += await countProductsForCategory(db, child._id, child.slug);
  }
  return direct.length + childCount;
}

// ── Admin: List all top-level categories (root + subcategories organized) ──
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

    // Separate parent and child categories
    const allCategories = categories.sort((a, b) => a.sortOrder - b.sortOrder);
    const topLevel = allCategories.filter((c) => !c.parentId);
    const childrenByParent = new Map<string, typeof allCategories>();
    for (const c of allCategories) {
      if (c.parentId) {
        const key = c.parentId as string;
        if (!childrenByParent.has(key)) childrenByParent.set(key, []);
        childrenByParent.get(key)!.push(c);
      }
    }

    // Enrich with product counts
    const enriched = await Promise.all(
      topLevel.map(async (c) => {
        const productCount = await countProductsForCategory(ctx.db, c._id, c.slug);
        const children = childrenByParent.get(c._id as string) || [];
        const enrichedChildren = await Promise.all(
          children.map(async (child) => {
            const childCount = await countProductsForCategory(ctx.db, child._id, child.slug);
            return { ...child, productCount: childCount };
          })
        );
        return {
          ...c,
          productCount,
          children: enrichedChildren.sort((a, b) => a.sortOrder - b.sortOrder),
        };
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

// ── List items for a category click ──
// If category is a parent → return its subcategories
// If category is a subcategory (or standalone) → return its products
// If prescription-required → return products with prescriptionRequired=true
export const listCategoryItems = query({
  args: { categoryId: v.id("categories") },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.categoryId);
    if (!category) return { category: null, type: "empty" as const, subcategories: [], products: [] };

    // Check if this category has children (is a parent)
    const children = await ctx.db
      .query("categories")
      .withIndex("by_parentId", (q) => q.eq("parentId", args.categoryId))
      .collect();

    const sortedChildren = children.sort((a, b) => a.sortOrder - b.sortOrder);

    if (sortedChildren.length > 0) {
      // This is a PARENT category — show its subcategories
      const enrichedChildren = await Promise.all(
        sortedChildren.map(async (child) => {
          const count = await countProductsForCategory(ctx.db, child._id, child.slug);
          return {
            _id: child._id,
            name: child.name,
            slug: child.slug,
            description: child.description,
            productCount: count,
            isActive: child.isActive,
          };
        })
      );
      return {
        category: { _id: category._id, name: category.name, slug: category.slug },
        type: "parent" as const,
        subcategories: enrichedChildren,
        products: [],
      };
    }

    // This is a LEAF category — show its products
    let products;
    if (category.slug === "prescription-required") {
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
      type: "leaf" as const,
      subcategories: [],
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

// Backward-compat alias for old dialog code
export const listCategoryProducts = listCategoryItems;

// ── Admin: Create a category ──
export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    sortOrder: v.number(),
    parentId: v.optional(v.id("categories")),
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
    parentId: v.optional(v.id("categories")),
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

    // Check for child categories
    const children = await ctx.db
      .query("categories")
      .withIndex("by_parentId", (q) => q.eq("parentId", args.categoryId))
      .collect();
    if (children.length > 0) {
      throw new Error(
        `Cannot delete category: it has ${children.length} subcategory(ies). Remove subcategories first.`
      );
    }

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

// ── Get all leaf categories (for product form dropdown) ──
export const listLeafCategories = query({
  args: {},
  handler: async (ctx, args) => {
    const all = await ctx.db.query("categories").collect();
    const parentIds = new Set(all.filter((c) => c.parentId).map((c) => c.parentId));

    // Return all categories that have NO children (leaf nodes)
    const leaf = all.filter((c) => !parentIds.has(c._id) && c.isActive);
    leaf.sort((a, b) => a.sortOrder - b.sortOrder);

    // Enrich with parent name for display
    return await Promise.all(
      leaf.map(async (c) => {
        let parentName: string | undefined;
        if (c.parentId) {
          const parent = await ctx.db.get(c.parentId);
          parentName = parent?.name;
        }
        return {
          _id: c._id,
          name: c.name,
          slug: c.slug,
          parentName,
        };
      })
    );
  },
});

// ── Get all categories with hierarchy (for product form) ──
export const listHierarchical = query({
  args: {},
  handler: async (ctx, args) => {
    const all = await ctx.db.query("categories").collect();
    all.sort((a, b) => a.sortOrder - b.sortOrder);

    const topLevel = all.filter((c) => !c.parentId && c.isActive);
    const childrenByParent = new Map<string, typeof all>();
    for (const c of all) {
      if (c.parentId) {
        const key = c.parentId as string;
        if (!childrenByParent.has(key)) childrenByParent.set(key, []);
        childrenByParent.get(key)!.push(c);
      }
    }

    return topLevel.map((c) => ({
      _id: c._id,
      name: c.name,
      slug: c.slug,
      children: (childrenByParent.get(c._id as string) || [])
        .filter((child) => child.isActive)
        .map((child) => ({
          _id: child._id,
          name: child.name,
          slug: child.slug,
        })),
    }));
  },
});

// Seed all default categories with parent→subcategory hierarchy (idempotent)
export const seedAll = mutation({
  args: {},
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    // Parent categories that already exist as standalone (no change)
    const STANDALONE = [
      { name: "Pain Relief", slug: "pain-relief", description: "Analgesics, anti-inflammatory drugs, and muscle relaxants", sortOrder: 1 },
      { name: "Heart & Cardio", slug: "heart-cardio", description: "Cardiac care, blood pressure, and cholesterol management", sortOrder: 2 },
      { name: "Diabetes Care", slug: "diabetes-care", description: "Insulin, oral hypoglycaemics, and glucose monitoring supplies", sortOrder: 3 },
      { name: "Vitamins & Supplements", slug: "vitamins-supplements", description: "Daily wellness, immunity boosters, and nutritional supplements", sortOrder: 4 },
      { name: "Baby & Mother", slug: "baby-mother", description: "Infant nutrition, prenatal vitamins, and maternal care", sortOrder: 5 },
      { name: "Skin & Personal Care", slug: "skin-personal-care", description: "Dermatological products, sunscreens, and hygiene essentials", sortOrder: 6 },
      { name: "Antibiotics", slug: "antibiotics", description: "Prescription antibiotics and antimicrobial agents", sortOrder: 7 },
      { name: "Digestive Health", slug: "digestive-health", description: "Antacids, probiotics, and gastrointestinal medications", sortOrder: 8 },
    ];

    // Parent categories with subcategories
    const WITH_SUBS = [
      {
        parent: { name: "Family Care", slug: "family-care", description: "Mother and maternity care products for the whole family", sortOrder: 9 },
        children: [
          { name: "Mother & Maternity Care", slug: "mother-maternity-care", description: "Prenatal vitamins, maternity care, and infant essentials", sortOrder: 1 },
        ],
      },
      {
        parent: { name: "Sexual Wellness", slug: "sexual-wellness", description: "Contraceptives and sexual wellness products", sortOrder: 10 },
        children: [
          { name: "Contraceptives & Sexual Wellness", slug: "contraceptives-sexual-wellness", description: "Contraceptives and intimate wellness products", sortOrder: 1 },
        ],
      },
      {
        parent: { name: "Personal Care", slug: "personal-care", description: "Hair care, oral care, eye and ear care essentials", sortOrder: 11 },
        children: [
          { name: "Hair Care", slug: "hair-care", description: "Shampoos, conditioners, and hair treatment products", sortOrder: 1 },
          { name: "Oral Care", slug: "oral-care", description: "Toothpaste, mouthwash, and dental care products", sortOrder: 2 },
          { name: "Eye & Ear Care", slug: "eye-ear-care", description: "Eye drops, ear drops, and vision care products", sortOrder: 3 },
        ],
      },
      {
        parent: { name: "Health & Safety", slug: "health-safety", description: "Cold and cough remedies, first aid, medical devices, and hygiene products", sortOrder: 12 },
        children: [
          { name: "Cold & Cough", slug: "cold-cough", description: "Cold relief, cough syrups, and throat care", sortOrder: 1 },
          { name: "First Aid", slug: "first-aid", description: "Bandages, antiseptics, and emergency care supplies", sortOrder: 2 },
          { name: "Medical Devices", slug: "medical-devices", description: "Blood pressure monitors, thermometers, and diagnostic devices", sortOrder: 3 },
          { name: "Health & Hygiene", slug: "health-hygiene", description: "Sanitizers, masks, and personal hygiene essentials", sortOrder: 4 },
        ],
      },
      {
        parent: { name: "Nutrition", slug: "nutrition", description: "Nutrition and health drinks for daily wellness", sortOrder: 13 },
        children: [
          { name: "Nutrition & Health Drinks", slug: "nutrition-health-drinks", description: "Protein shakes, health beverages, and nutritional supplements", sortOrder: 1 },
        ],
      },
      {
        parent: { name: "Alternative Medicine", slug: "alternative-medicine", description: "Ayurvedic and herbal medicines for natural healing", sortOrder: 14 },
        children: [
          { name: "Ayurvedic & Herbal", slug: "ayurvedic-herbal", description: "Ayurvedic remedies and herbal supplements", sortOrder: 1 },
        ],
      },
      {
        parent: { name: "Other Healthcare", slug: "other-healthcare", description: "Home healthcare products and other healthcare essentials", sortOrder: 15 },
        children: [
          { name: "Home Healthcare", slug: "home-healthcare", description: "Home care medical products and equipment", sortOrder: 1 },
          { name: "Other Healthcare Products", slug: "other-healthcare-products", description: "Miscellaneous healthcare products", sortOrder: 2 },
        ],
      },
    ];

    // Prescription Required (standalone, independent)
    const PRESCRIPTION = { name: "Prescription Required", slug: "prescription-required", description: "Medications that require a valid prescription", sortOrder: 16 };

    let created = 0;

    // Helper to upsert a category
    const upsert = async (data: { name: string; slug: string; description: string; sortOrder: number }, parentId?: Id<"categories">) => {
      const existing = await ctx.db.query("categories").withIndex("by_slug", (q) => q.eq("slug", data.slug)).first();
      if (existing) {
        await ctx.db.patch(existing._id, { name: data.name, description: data.description, sortOrder: data.sortOrder, isActive: true, ...(parentId !== undefined ? { parentId } : {}) });
      } else {
        await ctx.db.insert("categories", { ...data, isActive: true, ...(parentId !== undefined ? { parentId } : {}) });
        created++;
      }
    };

    // Seed standalone categories
    for (const cat of STANDALONE) {
      await upsert(cat);
    }

    // Seed Prescription Required
    await upsert(PRESCRIPTION);

    // Seed parent categories with subcategories
    for (const group of WITH_SUBS) {
      // Upsert parent (no parentId)
      const existingParent = await ctx.db.query("categories").withIndex("by_slug", (q) => q.eq("slug", group.parent.slug)).first();
      let parentId: Id<"categories">;
      if (existingParent) {
        await ctx.db.patch(existingParent._id, { name: group.parent.name, description: group.parent.description, sortOrder: group.parent.sortOrder, isActive: true, parentId: undefined });
        parentId = existingParent._id;
      } else {
        parentId = await ctx.db.insert("categories", { ...group.parent, isActive: true });
        created++;
      }

      // Upsert children
      for (let i = 0; i < group.children.length; i++) {
        const child = group.children[i];
        await upsert({ ...child, sortOrder: group.parent.sortOrder * 100 + child.sortOrder }, parentId);
      }
    }

    return { created, total: created };
  },
});
