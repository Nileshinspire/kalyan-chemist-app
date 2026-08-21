import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Validate a coupon code for the current user ──
export const validate = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { valid: false, reason: "Please sign in to use a coupon" };

    const code = args.code.trim().toUpperCase();
    if (!code) return { valid: false, reason: "Coupon code is required" };

    // Find coupon
    const coupon = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();

    if (!coupon) return { valid: false, reason: "Invalid coupon code" };
    if (!coupon.isActive) return { valid: false, reason: "This coupon is no longer active" };
    if (coupon.expiresAt < Date.now()) return { valid: false, reason: "This coupon has expired" };
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      return { valid: false, reason: "This coupon has reached its usage limit" };
    }

    // Calculate the discount for display
    // We can't know the order total yet, so just show the type and max discount
    return {
      valid: true,
      couponId: coupon._id,
      code: coupon.code,
      discountType: coupon.discountType,
      discountPercent: coupon.discountPercent,
      fixedDiscount: coupon.fixedDiscount,
      maxDiscount: coupon.maxDiscount,
      minOrder: coupon.minOrder,
      message: coupon.discountType === "percentage"
        ? `${coupon.discountPercent}% off (max ₹${coupon.maxDiscount})`
        : `₹${coupon.fixedDiscount} off`,
    };
  },
});

// ── Apply coupon at checkout and compute discount ──
// This is called from the checkout to calculate the actual coupon discount
export const computeDiscount = query({
  args: {
    code: v.string(),
    subtotal: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { valid: false, reason: "Not authenticated" };

    const code = args.code.trim().toUpperCase();
    const coupon = await ctx.db
      .query("coupons")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();

    if (!coupon) return { valid: false, reason: "Invalid coupon code" };
    if (!coupon.isActive) return { valid: false, reason: "This coupon is no longer active" };
    if (coupon.expiresAt < Date.now()) return { valid: false, reason: "This coupon has expired" };
    if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
      return { valid: false, reason: "This coupon has reached its usage limit" };
    }
    if (args.subtotal < coupon.minOrder) {
      return {
        valid: false,
        reason: `Minimum order of ₹${coupon.minOrder} required. Add ₹${coupon.minOrder - args.subtotal} more.`,
      };
    }

    let discount = 0;
    if (coupon.discountType === "percentage") {
      discount = Math.round((args.subtotal * coupon.discountPercent) / 100);
      discount = Math.min(discount, coupon.maxDiscount);
    } else {
      discount = Math.min(coupon.fixedDiscount, args.subtotal);
    }

    return {
      valid: true,
      couponId: coupon._id,
      code: coupon.code,
      discount,
      discountType: coupon.discountType,
      message: coupon.discountType === "percentage"
        ? `${coupon.discountPercent}% off — you save ₹${discount}`
        : `₹${coupon.fixedDiscount} off applied`,
    };
  },
});

// ── Mark coupon as used (called internally after order creation) ──
export const incrementUsage = mutation({
  args: { couponId: v.id("coupons") },
  handler: async (ctx, args) => {
    const coupon = await ctx.db.get(args.couponId);
    if (!coupon) throw new Error("Coupon not found");
    await ctx.db.patch(args.couponId, {
      usedCount: coupon.usedCount + 1,
    });
    return { success: true };
  },
});
