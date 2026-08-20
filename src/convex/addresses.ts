import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/** List all addresses for current user */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    return await ctx.db
      .query("addresses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

/** Get default address for current user */
export const getDefault = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    return await ctx.db
      .query("addresses")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", userId).eq("isDefault", true)
      )
      .first() ?? null;
  },
});

/** Get address by ID */
export const getById = query({
  args: { addressId: v.id("addresses") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.addressId);
  },
});

/** Create a new address */
export const create = mutation({
  args: {
    fullName: v.string(),
    phone: v.string(),
    houseFlat: v.string(),
    building: v.optional(v.string()),
    street: v.string(),
    area: v.optional(v.string()),
    city: v.string(),
    state: v.string(),
    pincode: v.string(),
    landmark: v.optional(v.string()),
    addressType: v.union(v.literal("home"), v.literal("work"), v.literal("other")),
    isDefault: v.boolean(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

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

    const now = Date.now();
    const addressId = await ctx.db.insert("addresses", {
      userId,
      fullName: args.fullName,
      phone: args.phone,
      houseFlat: args.houseFlat,
      building: args.building,
      street: args.street,
      area: args.area,
      city: args.city,
      state: args.state,
      pincode: args.pincode,
      landmark: args.landmark,
      addressType: args.addressType,
      latitude: args.latitude,
      longitude: args.longitude,
      isDefault: args.isDefault,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, addressId };
  },
});

/** Update an address */
export const update = mutation({
  args: {
    addressId: v.id("addresses"),
    fullName: v.string(),
    phone: v.string(),
    houseFlat: v.string(),
    building: v.optional(v.string()),
    street: v.string(),
    area: v.optional(v.string()),
    city: v.string(),
    state: v.string(),
    pincode: v.string(),
    landmark: v.optional(v.string()),
    addressType: v.union(v.literal("home"), v.literal("work"), v.literal("other")),
    isDefault: v.boolean(),
    latitude: v.optional(v.number()),
    longitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const address = await ctx.db.get(args.addressId);
    if (!address || address.userId !== userId) {
      throw new Error("Address not found or unauthorized");
    }

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
      fullName: args.fullName,
      phone: args.phone,
      houseFlat: args.houseFlat,
      building: args.building,
      street: args.street,
      area: args.area,
      city: args.city,
      state: args.state,
      pincode: args.pincode,
      landmark: args.landmark,
      addressType: args.addressType,
      latitude: args.latitude,
      longitude: args.longitude,
      isDefault: args.isDefault,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/** Delete an address */
export const remove = mutation({
  args: { addressId: v.id("addresses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const address = await ctx.db.get(args.addressId);
    if (!address || address.userId !== userId) {
      throw new Error("Address not found or unauthorized");
    }

    await ctx.db.delete(args.addressId);
    return { success: true };
  },
});

/** Set an address as default */
export const setDefault = mutation({
  args: { addressId: v.id("addresses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const address = await ctx.db.get(args.addressId);
    if (!address || address.userId !== userId) {
      throw new Error("Address not found or unauthorized");
    }

    const existingDefaults = await ctx.db
      .query("addresses")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", userId).eq("isDefault", true)
      )
      .collect();
    for (const addr of existingDefaults) {
      await ctx.db.patch(addr._id, { isDefault: false });
    }

    await ctx.db.patch(args.addressId, { isDefault: true, updatedAt: Date.now() });
    return { success: true };
  },
});
