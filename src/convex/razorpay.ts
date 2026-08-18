import { action } from "./_generated/server";
import { v } from "convex/values";

// ── Create a Razorpay order ──
export const createOrder = action({
  args: {
    amount: v.number(), // in INR
    receipt: v.string(),
  },
  handler: async (_ctx, args) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error(
        "Razorpay credentials are not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to your project's Keys tab."
      );
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
      throw new Error("RAZORPAY_KEY_ID is not configured");
    }
    return keyId;
  },
});
