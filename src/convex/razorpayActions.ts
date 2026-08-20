"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import crypto from "node:crypto";

/**
 * Razorpay server-side actions that require Node.js crypto for HMAC verification.
 * These MUST run in the Node.js runtime ("use node").
 */

// ── Create a Razorpay order via their REST API ──
export const createOrder = action({
  args: {
    amount: v.number(), // in INR (we convert to paise)
    receipt: v.string(), // invoice number
  },
  handler: async (_ctx, args) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    // Demo mode: simulate a successful Razorpay order if no keys configured
    if (!keyId || !keySecret) {
      console.log("[Razorpay] No keys configured — running in demo mode");
      return {
        id: `order_demo_${Date.now()}`,
        amount: Math.round(args.amount * 100),
        currency: "INR",
        receipt: args.receipt,
        status: "created",
        _demo: true,
      };
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(args.amount * 100), // convert INR to paise
        currency: "INR",
        receipt: args.receipt,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Razorpay order creation failed: ${errorData}`);
    }

    const order = await response.json();
    return order;
  },
});

// ── Verify payment signature server-side using HMAC-SHA256 ──
export const verifyPayment = action({
  args: {
    orderId: v.id("orders"),
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.string(),
    razorpaySignature: v.string(),
  },
  handler: async (ctx, args) => {
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      // Demo mode: accept any payment without verification
      console.log("[Razorpay] Demo mode — accepting payment without signature verification");
      await ctx.runMutation("razorpay:confirmPayment" as any, {
        orderId: args.orderId,
        razorpayOrderId: args.razorpayOrderId,
        razorpayPaymentId: args.razorpayPaymentId,
        razorpaySignature: args.razorpaySignature,
      });
      return { success: true, demo: true };
    }

    // Verify HMAC signature server-side
    const hmac = crypto.createHmac("sha256", keySecret);
    hmac.update(`${args.razorpayOrderId}|${args.razorpayPaymentId}`);
    const expectedSignature = hmac.digest("hex");

    if (expectedSignature !== args.razorpaySignature) {
      throw new Error("Payment verification failed: invalid signature");
    }

    // Signature valid — confirm the payment via mutation
    await ctx.runMutation("razorpay:confirmPayment" as any, {
      orderId: args.orderId,
      razorpayOrderId: args.razorpayOrderId,
      razorpayPaymentId: args.razorpayPaymentId,
      razorpaySignature: args.razorpaySignature,
    });

    return { success: true };
  },
});

// ── Get Razorpay key ID (safe to expose to client) ──
export const getKeyId = action({
  args: {},
  handler: async () => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId) {
      return "rzp_test_demo";
    }
    return keyId;
  },
});
