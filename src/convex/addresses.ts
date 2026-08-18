import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get all addresses for current user
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return [];
    }

    return await ctx.db
      .query("addresses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

/**
 * Get default address for current user
 */
export const getDefault = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      return null;
    }

    const addresses = await ctx.db
      .query("addresses")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", userId).eq("isDefault", true)
      )
      .first();

    return addresses || null;
  },
});

/**
 * Get address by ID
 */
export const getById = query({
  args: { addressId: v.id("addresses") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.addressId);
  },
});

/**
 * Create a new address
 */
export const create = mutation({
  args: {
    name: v.string(),
    phone: v.string(),
    addressLine1: v.string(),
    addressLine2: v.optional(v.string()),
    city: v.string(),
    state: v.string(),
    pincode: v.string(),
    isDefault: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    // If marking as default, unset other defaults
    if (args.isDefault) {
      const existingDefaults = await ctx.db
        .query("addresses")
        .withIndex("by_user_default", (q) =>
          q.eq("userId", userId).eq("isDefault", true)
        )
        .collect();

      for (const addr of existingDefaults) {
        await ctx.db.patch(addr._id, { isDefault: false });
      }
    }

    const addressId = await ctx.db.insert("addresses", {
      userId,
      name: args.name,
      phone: args.phone,
      addressLine1: args.addressLine1,
      addressLine2: args.addressLine2,
      city: args.city,
      state: args.state,
      pincode: args.pincode,
      isDefault: args.isDefault,
    });

    return { success: true, addressId };
  },
});

/**
 * Update an address
 */
export const update = mutation({
  args: {
    addressId: v.id("addresses"),
    name: v.string(),
    phone: v.string(),
    addressLine1: v.string(),
    addressLine2: v.optional(v.string()),
    city: v.string(),
    state: v.string(),
    pincode: v.string(),
    isDefault: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    const address = await ctx.db.get(args.addressId);
    if (!address || address.userId !== userId) {
      throw new Error("Address not found or unauthorized");
    }

    // If marking as default, unset other defaults
    if (args.isDefault && !address.isDefault) {
      const existingDefaults = await ctx.db
        .query("addresses")
        .withIndex("by_user_default", (q) =>
          q.eq("userId", userId).eq("isDefault", true)
        )
        .collect();

      for (const addr of existingDefaults) {
        await ctx.db.patch(addr._id, { isDefault: false });
      }
    }

    await ctx.db.patch(args.addressId, {
      name: args.name,
      phone: args.phone,
      addressLine1: args.addressLine1,
      addressLine2: args.addressLine2,
      city: args.city,
      state: args.state,
      pincode: args.pincode,
      isDefault: args.isDefault,
    });

    return { success: true };
  },
});

/**
 * Delete an address
 */
export const remove = mutation({
  args: { addressId: v.id("addresses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    const address = await ctx.db.get(args.addressId);
    if (!address || address.userId !== userId) {
      throw new Error("Address not found or unauthorized");
    }

    await ctx.db.delete(args.addressId);

    return { success: true };
  },
});

/**
 * Set an address as default
 */
export const setDefault = mutation({
  args: { addressId: v.id("addresses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new Error("Not authenticated");
    }

    const address = await ctx.db.get(args.addressId);
    if (!address || address.userId !== userId) {
      throw new Error("Address not found or unauthorized");
    }

    // Unset all other defaults
    const existingDefaults = await ctx.db
      .query("addresses")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", userId).eq("isDefault", true)
      )
      .collect();

    for (const addr of existingDefaults) {
      await ctx.db.patch(addr._id, { isDefault: false });
    }

    // Set this one as default
    await ctx.db.patch(args.addressId, { isDefault: true });

    return { success: true };
  },
});
