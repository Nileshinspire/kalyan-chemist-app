import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Razorpay payment mutations and queries.
 * Server-side actions (createOrder, verifyPayment) live in razorpayActions.ts
 * which uses the "use node" runtime for Node.js crypto access.
 *
 * Flow:
 * 1. Client calls razorpayActions.createOrder → backend creates Razorpay order via API
 * 2. Client opens Razorpay checkout widget with the order ID
 * 3. On payment success, client calls razorpayActions.verifyPayment with payment details
 * 4. verifyPayment validates HMAC signature server-side, then calls confirmPayment mutation
 *
 * The secret key NEVER leaves the server.
 */

// ── Confirm payment after signature verification ──
// Called internally by verifyPayment action after HMAC check passes
export const confirmPayment = mutation({
  args: {
    orderId: v.id("orders"),
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.string(),
    razorpaySignature: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (order.userId !== userId) throw new Error("Unauthorized");
    if (order.paymentMethod !== "online") throw new Error("Not an online payment order");

    // Prevent double-processing
    if (order.paymentStatus === "paid") {
      return { success: true, alreadyVerified: true };
    }

    // Mark as paid and confirm the order
    await ctx.db.patch(args.orderId, {
      paymentStatus: "paid",
      razorpayOrderId: args.razorpayOrderId,
      razorpayPaymentId: args.razorpayPaymentId,
      razorpaySignature: args.razorpaySignature,
      status: "confirmed",
      updatedAt: Date.now(),
    });

    await ctx.db.insert("notifications", {
      userId,
      type: "order_status",
      title: "Payment Successful ✓",
      body: `Payment of ₹${order.totalAmount.toLocaleString("en-IN")} received for order ${order.invoiceNumber || ""}. Your order has been confirmed.`,
      read: false,
      link: `/orders/${args.orderId}`,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

// ── Mark payment as failed (called by client after Razorpay error) ──
export const markPaymentFailed = mutation({
  args: {
    orderId: v.id("orders"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (order.userId !== userId) throw new Error("Unauthorized");

    // Don't overwrite if already paid
    if (order.paymentStatus === "paid") {
      return { success: true };
    }

    await ctx.db.patch(args.orderId, {
      paymentStatus: "failed",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ── Retry payment: reset a failed order so the customer can try again ──
export const resetForRetry = mutation({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const order = await ctx.db.get(args.orderId);
    if (!order) throw new Error("Order not found");
    if (order.userId !== userId) throw new Error("Unauthorized");
    if (order.paymentMethod !== "online") throw new Error("Not an online payment order");
    if (order.paymentStatus === "paid") throw new Error("Payment already completed");
    if (order.status === "cancelled") throw new Error("Order has been cancelled");

    // Reset payment details so customer can try again
    await ctx.db.patch(args.orderId, {
      paymentStatus: "pending",
      razorpayOrderId: undefined,
      razorpayPaymentId: undefined,
      razorpaySignature: undefined,
      updatedAt: Date.now(),
    });

    // Return order details needed to create a new Razorpay order
    return {
      success: true,
      amount: order.totalAmount,
      receipt: order.invoiceNumber || args.orderId,
    };
  },
});

// ── Check if Razorpay is configured ──
export const isConfigured = query({
  args: {},
  handler: async () => {
    return {
      configured: !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
    };
  },
});
