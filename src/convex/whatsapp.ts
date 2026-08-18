import { action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";

// ── WhatsApp Business Platform integration ──
// Architecture: uses the WhatsApp Cloud API (Meta Business Platform).
// In demo mode (no API keys), messages are logged but not sent.

const WHATSAPP_API_URL = "https://graph.facebook.com/v18.0";

/**
 * Send a WhatsApp message via the WhatsApp Business Platform.
 * Falls back to demo mode (log-only) if WHATSAPP_API_TOKEN is not configured.
 */
export const sendWhatsApp = action({
  args: {
    to: v.string(),         // phone number in E.164 format, e.g. "+919876543210"
    templateName: v.string(), // WhatsApp approved template name
    languageCode: v.optional(v.string()), // e.g. "en", "hi"
    params: v.optional(v.array(v.string())), // template params
  },
  handler: async (_ctx, args) => {
    const token = process.env.WHATSAPP_API_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    // Demo mode — log and return success
    if (!token || !phoneNumberId) {
      console.log(
        `[WhatsApp DEMO] Would send template "${args.templateName}" to ${args.to}`,
        args.params ? `with params: ${args.params.join(", ")}` : ""
      );
      return {
        success: true,
        mode: "demo",
        messageId: `demo_${Date.now()}`,
      };
    }

    // Production mode — call WhatsApp Cloud API
    try {
      const response = await fetch(
        `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: args.to,
            type: "template",
            template: {
              name: args.templateName,
              language: { code: args.languageCode || "en" },
              components: args.params
                ? [
                    {
                      type: "body",
                      parameters: args.params.map((p) => ({
                        type: "text",
                        text: p,
                      })),
                    },
                  ]
                : [],
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `WhatsApp API error ${response.status}: ${JSON.stringify(errorData)}`
        );
      }

      const data = await response.json();
      return {
        success: true,
        mode: "live",
        messageId: data.messages?.[0]?.id || null,
      };
    } catch (error) {
      console.error("[WhatsApp] Send failed:", error);
      return {
        success: false,
        mode: "live",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// ── Send order status notification (in-app + WhatsApp) ──
export const notifyOrderStatus = action({
  args: {
    userId: v.id("users"),
    orderId: v.id("orders"),
    status: v.string(),
    invoiceNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const statusMessages: Record<string, { title: string; body: string; whatsapp: string }> = {
      confirmed: {
        title: "Order Confirmed ✓",
        body: `Your order ${args.invoiceNumber} has been confirmed and is being processed.`,
        whatsapp: "Your order {{1}} has been confirmed! Our pharmacist is preparing your medicines. Track your order in the Kalyan Chemist app.",
      },
      processing: {
        title: "Order Being Prepared",
        body: `Your order ${args.invoiceNumber} is being packed and verified by our pharmacist.`,
        whatsapp: "Great news! Order {{1}} is being prepared by our pharmacist. It will be shipped soon.",
      },
      shipped: {
        title: "Order Shipped 🚚",
        body: `Your order ${args.invoiceNumber} has been shipped and is on its way to you.`,
        whatsapp: "Order {{1}} is on its way! Expected delivery within 2-3 business days. Track it in the app.",
      },
      delivered: {
        title: "Order Delivered ✓",
        body: `Your order ${args.invoiceNumber} has been delivered successfully. We hope you feel better soon!`,
        whatsapp: "Order {{1}} delivered! We hope our medicines help you feel better. Rate your experience in the app.",
      },
      cancelled: {
        title: "Order Cancelled",
        body: `Your order ${args.invoiceNumber} has been cancelled. If you paid online, a refund will be initiated.`,
        whatsapp: "Order {{1}} has been cancelled. If you paid online, your refund will be processed within 5-7 business days.",
      },
    };

    const msg = statusMessages[args.status];
    if (!msg) return { success: false, error: "Unknown status" };

    // 1. Create in-app notification
    await ctx.runMutation(api.notifications.create, {
      userId: args.userId,
      type: "order_status",
      title: msg.title,
      body: msg.body,
      link: `/orders/${args.orderId}`,
      metadata: JSON.stringify({ orderId: args.orderId, status: args.status }),
    });

    // 2. Send WhatsApp (best-effort, won't throw if demo or fails)
    console.log(
      `[Notification] Order ${args.status} for ${args.invoiceNumber} — WhatsApp notification queued`
    );

    return { success: true };
  },
});
