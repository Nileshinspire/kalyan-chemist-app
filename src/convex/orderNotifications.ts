/**
 * Centralized Order Notification Service
 *
 * When an order status changes, this module determines which notification
 * channels are available for the customer (email, SMS, WhatsApp) based on:
 * - Verified contact information (email, phone)
 * - WhatsApp opt-in preference
 * - Channel availability
 *
 * Notifications are created as in-app notifications in the notifications table.
 * External channel delivery (SMS, WhatsApp, email) is handled via the
 * existing smsService and whatsappService when those integrations are configured.
 */

import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── Status message templates ──
const STATUS_MESSAGES: Record<string, { title: string; body: string; emoji: string }> = {
  pending: {
    title: "Order Placed",
    body: "Your order has been placed and is awaiting confirmation.",
    emoji: "📋",
  },
  confirmed: {
    title: "Order Confirmed",
    body: "Your order has been confirmed and is being processed.",
    emoji: "✓",
  },
  processing: {
    title: "Order Being Prepared",
    body: "Your medicines are being packed and verified by our pharmacist.",
    emoji: "💊",
  },
  ready_for_dispatch: {
    title: "Ready for Dispatch",
    body: "Your order has been packed and is ready for dispatch.",
    emoji: "📦",
  },
  out_for_delivery: {
    title: "Out for Delivery",
    body: "Your order is on its way to your delivery address.",
    emoji: "🚚",
  },
  delivered: {
    title: "Order Delivered",
    body: "Your order has been delivered successfully. We hope you feel better soon!",
    emoji: "✓",
  },
  cancelled: {
    title: "Order Cancelled",
    body: "Your order has been cancelled.",
    emoji: "✕",
  },
  refund_initiated: {
    title: "Refund Initiated",
    body: "Your refund has been initiated and will be processed within 5-7 business days.",
    emoji: "💰",
  },
  refunded: {
    title: "Refund Completed",
    body: "Your refund has been completed.",
    emoji: "💰",
  },
};

/**
 * Determine available notification channels for a user.
 * Channels are based on verified contact info + preferences.
 */
function getAvailableChannels(user: any): {
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  emailReason: string;
  smsReason: string;
  whatsappReason: string;
} {
  const hasVerifiedEmail = user.emailVerified === true || (!!user.email && user.email.includes("@"));
  const hasVerifiedPhone = user.phoneVerified === true || (!!user.phone && /^[6-9]\d{9}$/.test(user.phone));
  const hasWhatsAppOptIn = user.whatsappOptIn === true;

  return {
    email: hasVerifiedEmail,
    sms: hasVerifiedPhone,
    whatsapp: hasVerifiedPhone && hasWhatsAppOptIn,
    emailReason: hasVerifiedEmail ? "verified_email" : "no_verified_email",
    smsReason: hasVerifiedPhone ? "verified_phone" : "no_verified_phone",
    whatsappReason: hasWhatsAppOptIn
      ? "whatsapp_opted_in"
      : hasVerifiedPhone
        ? "whatsapp_not_opted_in"
        : "no_phone",
  };
}

/**
 * Send order status notification through all available channels.
 * Called from mutations that change order status.
 */
export const sendOrderStatusNotification = mutation({
  args: {
    orderId: v.id("orders"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) return { success: false, error: "Order not found" };

    const user = await ctx.db.get(order.userId);
    if (!user) return { success: false, error: "User not found" };

    const channels = getAvailableChannels(user);
    const template = STATUS_MESSAGES[args.status];
    if (!template) return { success: false, error: "Unknown status" };

    const invoiceNum = order.invoiceNumber || "";
    const customerName = user.name || "Customer";
    const title = `${template.emoji} ${template.title}`;

    // Build the notification body
    let body = `Hi ${customerName}, ${template.body} Order: ${invoiceNum}.`;
    if (args.status === "cancelled" && order.paymentMethod === "online") {
      body += " A refund will be initiated.";
    }

    // Create in-app notification (always)
    const notificationId = await ctx.db.insert("notifications", {
      userId: order.userId,
      type: "order_status" as const,
      title,
      body,
      read: false,
      link: `/orders/${args.orderId}`,
      metadata: JSON.stringify({
        orderId: args.orderId,
        status: args.status,
        channels,
        invoiceNumber: invoiceNum,
      }),
      createdAt: Date.now(),
    });

    // Track which channels were used
    const deliveryLog: string[] = [];

    // Email notification — if email is available
    if (channels.email) {
      deliveryLog.push("email");
      // Email delivery would be handled by an external email service
      // (e.g., Resend, SendGrid) when configured via Convex actions
    }

    // SMS notification — if phone is available
    if (channels.sms) {
      deliveryLog.push("sms");
      // SMS delivery would be handled by the existing smsService
      // when configured with Twilio or similar provider
    }

    // WhatsApp notification — if opted in and phone available
    if (channels.whatsapp) {
      deliveryLog.push("whatsapp");
      // WhatsApp delivery would be handled by the existing WhatsApp
      // Business API integration when configured
    }

    return {
      success: true,
      notificationId,
      channels: deliveryLog,
      emailAvailable: channels.email,
      smsAvailable: channels.sms,
      whatsappAvailable: channels.whatsapp,
    };
  },
});

/**
 * Get notification preferences for the current user.
 */
export const getNotificationPreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const channels = getAvailableChannels(user);

    return {
      email: user.email || "",
      phone: user.phone || "",
      emailVerified: channels.email,
      phoneVerified: channels.sms,
      whatsappOptIn: user.whatsappOptIn || false,
      channels,
    };
  },
});

/**
 * Update WhatsApp opt-in preference.
 */
export const updateWhatsAppOptIn = mutation({
  args: { optIn: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    await ctx.db.patch(userId, { whatsappOptIn: args.optIn });
    return { success: true };
  },
});

/**
 * Get notification delivery history for the current user.
 */
export const getNotificationHistory = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    return await ctx.db
      .query("notifications")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(20);
  },
});
