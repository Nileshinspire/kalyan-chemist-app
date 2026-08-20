"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";

// ── Resend email client (lazy init) ──
let resendClient: any = null;
function getResend() {
  if (resendClient) return resendClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  const { Resend } = require("resend");
  resendClient = new Resend(apiKey);
  return resendClient;
}

const FROM_EMAIL = "Kalyan Chemist <notifications@kalyanchemist.com>";

// ── Order status email templates ──
const ORDER_STATUS_TEMPLATES: Record<string, { subject: string; heading: string; body: string; color: string }> = {
  confirmed: {
    subject: "Order Confirmed ✓ — {invoice}",
    heading: "Your Order Has Been Confirmed!",
    body: "Great news! Your order {invoice} has been confirmed by our pharmacy team and will be prepared shortly.",
    color: "#059669",
  },
  processing: {
    subject: "Order Being Prepared — {invoice}",
    heading: "Your Order Is Being Prepared",
    body: "Your medicines for order {invoice} are being packed and verified by our pharmacist.",
    color: "#2563eb",
  },
  ready_for_dispatch: {
    subject: "Order Ready for Dispatch 📦 — {invoice}",
    heading: "Your Order Is Ready!",
    body: "Your order {invoice} has been packed and is ready for dispatch. It will be picked up by our delivery partner soon.",
    color: "#7c3aed",
  },
  out_for_delivery: {
    subject: "Order Out for Delivery 🚚 — {invoice}",
    heading: "Your Order Is On Its Way!",
    body: "Exciting news! Your order {invoice} is out for delivery and will reach you soon. Please keep your ID ready for verification.",
    color: "#ea580c",
  },
  delivered: {
    subject: "Order Delivered ✓ — {invoice}",
    heading: "Your Order Has Been Delivered!",
    body: "Your order {invoice} has been delivered successfully. We hope you feel better soon! Please rate your experience.",
    color: "#059669",
  },
  cancelled: {
    subject: "Order Cancelled — {invoice}",
    heading: "Order Cancelled",
    body: "Your order {invoice} has been cancelled.{refundNote} If you have any questions, please contact us.",
    color: "#dc2626",
  },
  refund_initiated: {
    subject: "Refund Initiated — {invoice}",
    heading: "Refund Initiated",
    body: "Your refund for order {invoice} has been initiated. It will be processed within 5-7 business days.",
    color: "#0891b2",
  },
  refunded: {
    subject: "Refund Completed ✓ — {invoice}",
    heading: "Refund Completed",
    body: "Your refund for order {invoice} has been completed. The amount has been credited to your original payment method.",
    color: "#059669",
  },
};

function buildEmailHtml(
  heading: string,
  body: string,
  color: string,
  invoice: string,
  status: string,
): string {
  const trackingUrl = `https://kalyanchemist.com/orders`;
  const statusLabel = status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <!-- Header -->
        <tr><td style="background:${color};padding:32px 40px;text-align:center;">
          <h1 style="color:#ffffff;font-size:22px;margin:0;font-weight:700;">Kalyan Chemist</h1>
        </td></tr>
        <!-- Content -->
        <tr><td style="padding:40px;">
          <h2 style="color:#1a1a1a;font-size:20px;margin:0 0 16px;">${heading}</h2>
          <p style="color:#555;font-size:15px;line-height:1.6;margin:0 0 24px;">${body}</p>

          <!-- Status Badge -->
          <div style="text-align:center;margin:24px 0;">
            <span style="display:inline-block;background:${color}15;color:${color};font-size:13px;font-weight:600;padding:8px 20px;border-radius:20px;border:1px solid ${color}30;">
              ${statusLabel}
            </span>
          </div>

          <!-- Order Info -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f9fa;border-radius:8px;padding:16px 20px;margin:24px 0;">
            <tr>
              <td style="padding:4px 0;"><span style="color:#888;font-size:13px;">Order</span></td>
              <td style="padding:4px 0;text-align:right;"><span style="color:#1a1a1a;font-size:13px;font-weight:600;">${invoice}</span></td>
            </tr>
            <tr>
              <td style="padding:4px 0;"><span style="color:#888;font-size:13px;">Status</span></td>
              <td style="padding:4px 0;text-align:right;"><span style="color:${color};font-size:13px;font-weight:600;">${statusLabel}</span></td>
            </tr>
          </table>

          <!-- CTA -->
          <div style="text-align:center;margin:32px 0 0;">
            <a href="${trackingUrl}" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">
              Track Your Order
            </a>
          </div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 40px;border-top:1px solid #eee;">
          <p style="color:#999;font-size:12px;margin:0;text-align:center;">
            Kalyan Chemist — Your Trusted Local Pharmacy<br>
            Questions? Contact us at <a href="mailto:support@kalyanchemist.com" style="color:#059669;">support@kalyanchemist.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Send order status email ──
export const sendOrderStatusEmail = action({
  args: {
    toEmail: v.string(),
    toName: v.string(),
    status: v.string(),
    invoiceNumber: v.string(),
    paymentMethod: v.string(),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();
    if (!resend) {
      console.log("[Email] No RESEND_API_KEY configured — skipping email");
      return { sent: false, reason: "no_api_key" };
    }

    const template = ORDER_STATUS_TEMPLATES[args.status];
    if (!template) {
      console.log(`[Email] No template for status: ${args.status}`);
      return { sent: false, reason: "no_template" };
    }

    const subject = template.subject.replace("{invoice}", args.invoiceNumber);
    const refundNote =
      args.paymentMethod === "online"
        ? " A refund will be processed within 5-7 business days."
        : "";
    const body = template.body
      .replace(/\{invoice\}/g, args.invoiceNumber)
      .replace("{refundNote}", refundNote);

    const html = buildEmailHtml(
      template.heading,
      body,
      template.color,
      args.invoiceNumber,
      args.status,
    );

    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: args.toEmail,
        subject,
        html,
      });
      console.log(`[Email] Sent to ${args.toEmail} for order ${args.invoiceNumber}`);
      return { sent: true };
    } catch (error: any) {
      console.error(`[Email] Failed to send: ${error.message}`);
      return { sent: false, reason: error.message };
    }
  },
});

// ── Send welcome email ──
export const sendWelcomeEmail = action({
  args: {
    toEmail: v.string(),
    toName: v.string(),
  },
  handler: async (_ctx, args) => {
    const resend = getResend();
    if (!resend) return { sent: false, reason: "no_api_key" };

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:#059669;padding:32px 40px;text-align:center;">
          <h1 style="color:#fff;font-size:22px;margin:0;">Kalyan Chemist</h1>
        </td></tr>
        <tr><td style="padding:40px;">
          <h2 style="color:#1a1a1a;font-size:20px;margin:0 0 16px;">Welcome, ${args.toName}! 🎉</h2>
          <p style="color:#555;font-size:15px;line-height:1.6;">
            Thank you for joining Kalyan Chemist — your trusted local pharmacy, now online.
          </p>
          <p style="color:#555;font-size:15px;line-height:1.6;">
            You can now browse medicines, upload prescriptions, and get doorstep delivery.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="https://kalyanchemist.com/products" style="display:inline-block;background:#059669;color:#fff;text-decoration:none;padding:12px 32px;border-radius:8px;font-weight:600;font-size:14px;">
              Start Shopping
            </a>
          </div>
        </td></tr>
        <tr><td style="padding:24px 40px;border-top:1px solid #eee;">
          <p style="color:#999;font-size:12px;margin:0;text-align:center;">
            Kalyan Chemist — Your Trusted Local Pharmacy
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: args.toEmail,
        subject: "Welcome to Kalyan Chemist! 💊",
        html,
      });
      return { sent: true };
    } catch (error: any) {
      console.error(`[Email] Welcome email failed: ${error.message}`);
      return { sent: false, reason: error.message };
    }
  },
});
