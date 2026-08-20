import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Helper: verify admin ──
async function requireAdmin(ctx: { db: any; auth: any }) {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") throw new Error("Unauthorized: admin only");
  return userId;
}

// ══════════════════════════════════════════════════════
//  QUERIES
// ══════════════════════════════════════════════════════

/** Get the singleton delivery config (admin) */
export const get = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const configs = await ctx.db.query("delivery_config").collect();
    return configs[0] ?? null;
  },
});

/** Get delivery config (public — for checkout pincode check) */
export const getPublic = query({
  args: {},
  handler: async (ctx) => {
    const configs = await ctx.db.query("delivery_config").collect();
    const c = configs[0];
    if (!c) return null;
    return {
      storeName: c.storeName,
      storeAddress: c.storeAddress,
      storePhone: c.storePhone,
      storeWhatsApp: c.storeWhatsApp,
      businessHours: c.businessHours,
      defaultDeliveryFee: c.defaultDeliveryFee,
      freeDeliveryThreshold: c.freeDeliveryThreshold,
      minimumOrder: c.minimumOrder,
      estimatedDeliveryTime: c.estimatedDeliveryTime,
      defaultCodAvailable: c.defaultCodAvailable,
      pincodes: c.pincodes,
    };
  },
});

/** Check if a pincode is serviceable and return delivery details */
export const checkPincode = query({
  args: { pincode: v.string() },
  handler: async (ctx, args) => {
    const configs = await ctx.db.query("delivery_config").collect();
    const c = configs[0];

    if (!c) {
      // No config = no delivery areas configured yet
      return { available: false, reason: "Delivery not configured" };
    }

    const pin = args.pincode.trim();
    const match = c.pincodes.find(
      (p) => p.pincode === pin && p.isActive
    );

    if (!match) {
      return {
        available: false,
        reason:
          "Sorry, Kalyan Chemist does not currently deliver to this location.",
      };
    }

    return {
      available: true,
      deliveryFee: match.deliveryFee ?? c.defaultDeliveryFee,
      minimumOrder: match.minimumOrder ?? c.minimumOrder,
      estimatedDeliveryTime:
        match.estimatedDeliveryTime ?? c.estimatedDeliveryTime,
      codAvailable: match.codAvailable ?? c.defaultCodAvailable,
      freeDeliveryThreshold: c.freeDeliveryThreshold,
      area: match.area,
    };
  },
});

// ══════════════════════════════════════════════════════
//  MUTATIONS
// ══════════════════════════════════════════════════════

/** Upsert the singleton delivery config */
export const upsert = mutation({
  args: {
    storeName: v.string(),
    storeAddress: v.string(),
    storePhone: v.string(),
    storeWhatsApp: v.optional(v.string()),
    businessHours: v.string(),
    defaultDeliveryFee: v.number(),
    freeDeliveryThreshold: v.number(),
    minimumOrder: v.number(),
    estimatedDeliveryTime: v.string(),
    defaultCodAvailable: v.boolean(),
    pincodes: v.array(
      v.object({
        pincode: v.string(),
        area: v.string(),
        isActive: v.boolean(),
        deliveryFee: v.optional(v.number()),
        minimumOrder: v.optional(v.number()),
        estimatedDeliveryTime: v.optional(v.string()),
        codAvailable: v.optional(v.boolean()),
      })
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const now = Date.now();
    const configs = await ctx.db.query("delivery_config").collect();

    if (configs.length > 0) {
      await ctx.db.patch(configs[0]._id, { ...args, updatedAt: now });
      return { success: true, id: configs[0]._id };
    }

    const id = await ctx.db.insert("delivery_config", {
      ...args,
      updatedAt: now,
    });
    return { success: true, id };
  },
});

/** Add a single pincode to the config */
export const addPincode = mutation({
  args: {
    pincode: v.string(),
    area: v.string(),
    isActive: v.boolean(),
    deliveryFee: v.optional(v.number()),
    minimumOrder: v.optional(v.number()),
    estimatedDeliveryTime: v.optional(v.string()),
    codAvailable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const configs = await ctx.db.query("delivery_config").collect();
    if (configs.length === 0) throw new Error("Delivery config not found. Save general settings first.");

    const config = configs[0];
    // Check for duplicate pincode
    if (config.pincodes.some((p) => p.pincode === args.pincode)) {
      throw new Error(`Pincode ${args.pincode} already exists`);
    }

    const updatedPincodes = [...config.pincodes, args];
    await ctx.db.patch(config._id, {
      pincodes: updatedPincodes,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/** Remove a pincode from the config */
export const removePincode = mutation({
  args: { pincode: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const configs = await ctx.db.query("delivery_config").collect();
    if (configs.length === 0) throw new Error("Delivery config not found.");

    const config = configs[0];
    const updatedPincodes = config.pincodes.filter(
      (p) => p.pincode !== args.pincode
    );
    await ctx.db.patch(config._id, {
      pincodes: updatedPincodes,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/** Toggle a pincode's active status */
export const togglePincode = mutation({
  args: { pincode: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const configs = await ctx.db.query("delivery_config").collect();
    if (configs.length === 0) throw new Error("Delivery config not found.");

    const config = configs[0];
    const updatedPincodes = config.pincodes.map((p) =>
      p.pincode === args.pincode ? { ...p, isActive: !p.isActive } : p
    );
    await ctx.db.patch(config._id, {
      pincodes: updatedPincodes,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});
