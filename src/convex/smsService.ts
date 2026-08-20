"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { normalizeIndianPhone } from "../lib/phone";

// ── Twilio client (lazy init) ──
let twilioClient: any = null;
function getTwilio() {
  if (twilioClient) return twilioClient;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) return null;
  const twilio = require("twilio");
  twilioClient = twilio(accountSid, authToken);
  return twilioClient;
}

// ── Twilio sender number (env var) ──
function getFromNumber(): string | null {
  return process.env.TWILIO_PHONE_NUMBER || null;
}

// ── Order status SMS templates ──
const ORDER_STATUS_SMS: Record<string, (invoice: string) => string> = {
  confirmed: (inv) =>
    `Kalyan Chemist: Your order ${inv} has been confirmed ✓. We'll start preparing it shortly. Track: kalyanchemist.com/orders`,
  processing: (inv) =>
    `Kalyan Chemist: Your order ${inv} is being prepared by our pharmacist. You'll receive an update when it's ready.`,
  ready_for_dispatch: (inv) =>
    `Kalyan Chemist: Your order ${inv} is ready for dispatch 📦. Our delivery partner will pick it up soon.`,
  out_for_delivery: (inv) =>
    `Kalyan Chemist: Great news! Your order ${inv} is out for delivery 🚚 and will reach you soon.`,
  delivered: (inv) =>
    `Kalyan Chemist: Your order ${inv} has been delivered ✓. We hope you feel better soon! Rate your experience.`,
  cancelled: (inv) =>
    `Kalyan Chemist: Your order ${inv} has been cancelled. If you have questions, please contact us.`,
  refund_initiated: (inv) =>
    `Kalyan Chemist: Your refund for order ${inv} has been initiated. It will be processed within 5-7 business days.`,
  refunded: (inv) =>
    `Kalyan Chemist: Your refund for order ${inv} has been completed ✓. Amount credited to your original payment method.`,
};

// ── Send order status SMS ──
export const sendOrderStatusSms = action({
  args: {
    toPhone: v.string(),
    status: v.string(),
    invoiceNumber: v.string(),
  },
  handler: async (_ctx, args) => {
    const client = getTwilio();
    const fromNumber = getFromNumber();

    if (!client || !fromNumber) {
      console.log(
        "[SMS] No Twilio credentials configured — skipping SMS (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER)",
      );
      return { sent: false, reason: "no_twilio_config" };
    }

    // Normalize phone to E.164 for India (+91...)
    const toPhone = normalizeIndianPhone(args.toPhone);
    if (!toPhone) {
      console.log(`[SMS] Invalid phone number: ${args.toPhone}`);
      return { sent: false, reason: "invalid_phone" };
    }

    const templateFn = ORDER_STATUS_SMS[args.status];
    if (!templateFn) {
      console.log(`[SMS] No template for status: ${args.status}`);
      return { sent: false, reason: "no_template" };
    }

    const body = templateFn(args.invoiceNumber);

    try {
      const message = await client.messages.create({
        body,
        from: fromNumber,
        to: toPhone,
      });
      console.log(
        `[SMS] Sent to ${toPhone} for order ${args.invoiceNumber} — SID: ${message.sid}`,
      );
      return { sent: true, sid: message.sid };
    } catch (error: any) {
      console.error(`[SMS] Failed to send: ${error.message}`);
      return { sent: false, reason: error.message };
    }
  },
});

// ── Send generic SMS (for OTP, welcome, etc.) ──
export const sendGenericSms = action({
  args: {
    toPhone: v.string(),
    message: v.string(),
  },
  handler: async (_ctx, args) => {
    const client = getTwilio();
    const fromNumber = getFromNumber();

    if (!client || !fromNumber) {
      return { sent: false, reason: "no_twilio_config" };
    }

    const toPhone = normalizeIndianPhone(args.toPhone);
    if (!toPhone) {
      return { sent: false, reason: "invalid_phone" };
    }

    try {
      const message = await client.messages.create({
        body: args.message,
        from: fromNumber,
        to: toPhone,
      });
      return { sent: true, sid: message.sid };
    } catch (error: any) {
      console.error(`[SMS] Generic SMS failed: ${error.message}`);
      return { sent: false, reason: error.message };
    }
  },
});
