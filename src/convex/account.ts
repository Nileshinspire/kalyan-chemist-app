import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Profile ──

/** Get current user's profile */
export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    return {
      _id: user._id,
      name: user.name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      image: user.image,
      role: user.role,
    };
  },
});

/** Update current user's profile */
export const updateProfile = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    // Validate
    if (args.name.trim().length < 2) {
      throw new Error("Name must be at least 2 characters");
    }
    if (!args.email.includes("@")) {
      throw new Error("Invalid email address");
    }
    if (args.phone && !/^[6-9]\d{9}$/.test(args.phone)) {
      throw new Error("Invalid phone number (must be 10 digits starting with 6-9)");
    }

    await ctx.db.patch(userId, {
      name: args.name.trim(),
      email: args.email.trim(),
      phone: args.phone.trim(),
    });

    return { success: true };
  },
});

// ── Addresses ──

/** List all addresses for current user */
export const listAddresses = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const addresses = await ctx.db
      .query("addresses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Sort: default first, then by creation date
    return addresses.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return b.createdAt - a.createdAt;
    });
  },
});

/** Add a new address */
export const addAddress = mutation({
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
    addressType: v.union(
      v.literal("home"),
      v.literal("work"),
      v.literal("other"),
    ),
    isDefault: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    // Validate pincode (Indian 6-digit)
    if (!/^\d{6}$/.test(args.pincode)) {
      throw new Error("Invalid pincode (must be 6 digits)");
    }

    // Validate phone
    if (!/^[6-9]\d{9}$/.test(args.phone)) {
      throw new Error("Invalid phone number");
    }

    // If setting as default, unset other defaults
    if (args.isDefault) {
      const existing = await ctx.db
        .query("addresses")
        .withIndex("by_user_default", (q) =>
          q.eq("userId", userId).eq("isDefault", true)
        )
        .collect();
      for (const addr of existing) {
        await ctx.db.patch(addr._id, { isDefault: false });
      }
    }

    const now = Date.now();
    const addressId = await ctx.db.insert("addresses", {
      userId,
      fullName: args.fullName.trim(),
      phone: args.phone.trim(),
      houseFlat: args.houseFlat.trim(),
      building: args.building?.trim(),
      street: args.street.trim(),
      area: args.area?.trim(),
      city: args.city.trim(),
      state: args.state.trim(),
      pincode: args.pincode.trim(),
      landmark: args.landmark?.trim(),
      addressType: args.addressType,
      isDefault: args.isDefault,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, addressId };
  },
});

/** Update an existing address */
export const updateAddress = mutation({
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
    addressType: v.union(
      v.literal("home"),
      v.literal("work"),
      v.literal("other"),
    ),
    isDefault: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const address = await ctx.db.get(args.addressId);
    if (!address || address.userId !== userId) {
      throw new Error("Address not found");
    }

    // Validate pincode
    if (!/^\d{6}$/.test(args.pincode)) {
      throw new Error("Invalid pincode (must be 6 digits)");
    }

    // Validate phone
    if (!/^[6-9]\d{9}$/.test(args.phone)) {
      throw new Error("Invalid phone number");
    }

    // If setting as default, unset other defaults
    if (args.isDefault && !address.isDefault) {
      const existing = await ctx.db
        .query("addresses")
        .withIndex("by_user_default", (q) =>
          q.eq("userId", userId).eq("isDefault", true)
        )
        .collect();
      for (const addr of existing) {
        await ctx.db.patch(addr._id, { isDefault: false });
      }
    }

    await ctx.db.patch(args.addressId, {
      fullName: args.fullName.trim(),
      phone: args.phone.trim(),
      houseFlat: args.houseFlat.trim(),
      building: args.building?.trim(),
      street: args.street.trim(),
      area: args.area?.trim(),
      city: args.city.trim(),
      state: args.state.trim(),
      pincode: args.pincode.trim(),
      landmark: args.landmark?.trim(),
      addressType: args.addressType,
      isDefault: args.isDefault,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/** Delete an address */
export const deleteAddress = mutation({
  args: { addressId: v.id("addresses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const address = await ctx.db.get(args.addressId);
    if (!address || address.userId !== userId) {
      throw new Error("Address not found");
    }

    await ctx.db.delete(args.addressId);
    return { success: true };
  },
});

/** Set an address as default */
export const setDefaultAddress = mutation({
  args: { addressId: v.id("addresses") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const address = await ctx.db.get(args.addressId);
    if (!address || address.userId !== userId) {
      throw new Error("Address not found");
    }

    // Unset other defaults
    const existing = await ctx.db
      .query("addresses")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", userId).eq("isDefault", true)
      )
      .collect();
    for (const addr of existing) {
      await ctx.db.patch(addr._id, { isDefault: false });
    }

    // Set this one as default
    await ctx.db.patch(args.addressId, {
      isDefault: true,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/** Get default address for current user */
export const getDefaultAddress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const defaultAddr = await ctx.db
      .query("addresses")
      .withIndex("by_user_default", (q) =>
        q.eq("userId", userId).eq("isDefault", true)
      )
      .first();

    return defaultAddr ?? null;
  },
});
