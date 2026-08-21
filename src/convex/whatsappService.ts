"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

// ══════════════════════════════════════════════════════
//  WhatsApp Business API — Cloud API (Meta)
//  Requires: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
//  Free tier: 1,000 conversations/month
// ══════════════════════════════════════════════════════

const WHATSAPP_API = "https://graph.facebook.com/v21.0";

function getConfig() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId };
}

/**
 * Normalize Indian phone number to E.164 format
 */
function normalizePhone(phone: string): string | null {
  let cleaned = phone.replace(/[\s\-()]/g, "");
  if (/^\d{10}$/.test(cleaned)) {
    cleaned = "91" + cleaned;
  }
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }
  // Must be 12 digits (91 + 10 digit Indian number)
  if (!/^\d{12}$/.test(cleaned)) return null;
  return cleaned;
}

// ── Send a text message via WhatsApp Business API ──
export const sendTextMessage = action({
  args: {
    toPhone: v.string(),
    message: v.string(),
    enquiryId: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const config = getConfig();
    if (!config) {
      console.log(
        "[WhatsApp] No credentials configured — set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID",
      );
      return { sent: false, reason: "no_config" };
    }

    const toPhone = normalizePhone(args.toPhone);
    if (!toPhone) {
      console.log(`[WhatsApp] Invalid phone: ${args.toPhone}`);
      return { sent: false, reason: "invalid_phone" };
    }

    try {
      const response = await fetch(
        `${WHATSAPP_API}/${config.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: toPhone,
            type: "text",
            text: { preview_url: false, body: args.message },
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        console.error(
          `[WhatsApp] API error: ${response.status} — ${JSON.stringify(data)}`,
        );
        return {
          sent: false,
          reason: `api_error_${response.status}`,
          error: data?.error?.message || "Unknown error",
        };
      }

      const messageId =
        data?.messages?.[0]?.id || `wamid_${Date.now()}`;
      console.log(
        `[WhatsApp] Sent to ${toPhone} — ID: ${messageId}${args.enquiryId ? ` (enquiry: ${args.enquiryId})` : ""}`,
      );

      return {
        sent: true,
        messageId,
        whatsappStatus: "sent" as const,
      };
    } catch (error: any) {
      console.error(`[WhatsApp] Send failed: ${error.message}`);
      return {
        sent: false,
        reason: "network_error",
        error: error.message,
      };
    }
  },
});

// ── Send a WhatsApp order confirmation message ──
export const sendOrderConfirmation = action({
  args: {
    toPhone: v.string(),
    customerName: v.string(),
    invoiceNumber: v.string(),
    items: v.array(
      v.object({
        name: v.string(),
        quantity: v.number(),
        price: v.number(),
      }),
    ),
    totalAmount: v.number(),
    estimatedDelivery: v.optional(v.string()),
    deliveryAddress: v.optional(v.string()),
    prescriptionRequired: v.boolean(),
  },
  handler: async (_ctx, args) => {
    const config = getConfig();
    if (!config) {
      return { sent: false, reason: "no_config" };
    }

    const toPhone = normalizePhone(args.toPhone);
    if (!toPhone) {
      return { sent: false, reason: "invalid_phone" };
    }

    // Build a clean, professional confirmation message
    const lines: string[] = [];
    lines.push(`💊 *Order Confirmed — Kalyan Chemist*`);
    lines.push("");
    lines.push(`Hi ${args.customerName}! Your order has been confirmed ✓`);
    lines.push("");
    lines.push(`📋 Order: *${args.invoiceNumber}*`);
    lines.push("");

    for (const item of args.items) {
      lines.push(
        `• ${item.name} × ${item.quantity} — ₹${item.price.toLocaleString("en-IN")}`,
      );
    }

    lines.push("");
    lines.push(
      `💰 Total: *₹${args.totalAmount.toLocaleString("en-IN")}*`,
    );

    if (args.estimatedDelivery) {
      lines.push(`🚚 Estimated Delivery: ${args.estimatedDelivery}`);
    }

    if (args.deliveryAddress) {
      lines.push(`📍 Delivery: ${args.deliveryAddress}`);
    }

    if (args.prescriptionRequired) {
      lines.push("");
      lines.push(
        "⚠️ *Prescription Required*: Please keep your valid prescription ready for verification at the time of delivery.",
      );
    }

    lines.push("");
    lines.push(
      "Our pharmacist will prepare your order shortly. You'll receive updates as your order progresses.",
    );
    lines.push("");
    lines.push(
      "Track your order: kalyanchemist.com/orders",
    );

    const message = lines.join("\n");

    try {
      const response = await fetch(
        `${WHATSAPP_API}/${config.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: toPhone,
            type: "text",
            text: { preview_url: false, body: message },
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          sent: false,
          reason: `api_error_${response.status}`,
          error: data?.error?.message || "Unknown error",
        };
      }

      const messageId = data?.messages?.[0]?.id || `wamid_${Date.now()}`;
      console.log(
        `[WhatsApp] Order confirmation sent to ${toPhone} — ${args.invoiceNumber} — ID: ${messageId}`,
      );

      return { sent: true, messageId, whatsappStatus: "sent" as const };
    } catch (error: any) {
      console.error(
        `[WhatsApp] Order confirmation failed: ${error.message}`,
      );
      return { sent: false, reason: "network_error", error: error.message };
    }
  },
});

// ── Send stock availability notification ──
export const sendStockAvailableNotification = action({
  args: {
    toPhone: v.string(),
    customerName: v.optional(v.string()),
    productName: v.string(),
    productPrice: v.number(),
  },
  handler: async (_ctx, args) => {
    const config = getConfig();
    if (!config) {
      return { sent: false, reason: "no_config" };
    }

    const toPhone = normalizePhone(args.toPhone);
    if (!toPhone) {
      return { sent: false, reason: "invalid_phone" };
    }

    const name = args.customerName || "there";
    const message = [
      `💊 *Great News from Kalyan Chemist!*`,
      "",
      `Hi ${name}!`,
      "",
      `The medicine you were interested in is now *available* in stock:`,
      "",
      `• ${args.productName} — ₹${args.productPrice.toLocaleString("en-IN")}`,
      "",
      `Order now on our website or visit us at the pharmacy.`,
      `kalyanchemist.com`,
      "",
      `Thank you for your patience! 🙏`,
    ].join("\n");

    try {
      const response = await fetch(
        `${WHATSAPP_API}/${config.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: toPhone,
            type: "text",
            text: { preview_url: false, body: message },
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          sent: false,
          reason: `api_error_${response.status}`,
          error: data?.error?.message || "Unknown error",
        };
      }

      const messageId = data?.messages?.[0]?.id || `wamid_${Date.now()}`;
      console.log(
        `[WhatsApp] Stock notification sent to ${toPhone} for ${args.productName} — ID: ${messageId}`,
      );

      return { sent: true, messageId, whatsappStatus: "sent" as const };
    } catch (error: any) {
      console.error(
        `[WhatsApp] Stock notification failed: ${error.message}`,
      );
      return { sent: false, reason: "network_error", error: error.message };
    }
  },
});

// ── Check API health / credentials ──
export const checkConfig = action({
  args: {},
  handler: async () => {
    const config = getConfig();
    if (!config) {
      return {
        configured: false,
        message: "Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID env vars",
      };
    }

    try {
      const response = await fetch(
        `${WHATSAPP_API}/${config.phoneNumberId}`,
        {
          headers: { Authorization: `Bearer ${config.token}` },
        },
      );

      if (response.ok) {
        const data = await response.json();
        return {
          configured: true,
          phoneNumber: data?.display_phone_number || "Unknown",
          qualityRating: data?.quality_rating || "Unknown",
        };
      }

      return { configured: false, message: "API credentials invalid" };
    } catch (error: any) {
      return { configured: false, message: error.message };
    }
  },
});
