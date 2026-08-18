import { action } from "./_generated/server";
import { v } from "convex/values";

// ── Create a Razorpay order (or simulate in demo mode) ──
export const createOrder = action({
  args: {
    amount: v.number(), // in INR
    receipt: v.string(),
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

// ── Get the Razorpay key ID (safe to expose) ──
export const getKeyId = action({
  args: {},
  handler: async () => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId) {
      // Return demo key for demo mode
      return "rzp_test_demo";
    }
    return keyId;
  },
});
