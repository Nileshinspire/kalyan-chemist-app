/**
 * WhatsApp message utilities for Kalyan Chemist
 * Generates safe order/cart summaries for WhatsApp sharing.
 * Does NOT expose prescription information or sensitive data.
 *
 * All links use the official Click-to-Chat format built by
 * `@/lib/whatsappConfig`; messages are only pre-filled, never auto-sent.
 */

import {
  WHATSAPP_BUSINESS_NUMBER,
  buildWhatsAppUrl,
  openWhatsAppChat,
} from "./whatsappConfig";

export interface WhatsAppProduct {
  name: string;
  quantity: number;
  price: number;
  prescriptionRequired?: boolean;
}

/**
 * Generate a safe WhatsApp order message
 * Omits prescription details, doctor names, etc.
 */
export function generateOrderMessage(params: {
  orderId?: string;
  invoiceNumber?: string;
  products: WhatsAppProduct[];
  subtotal: number;
  couponDiscount?: number;
  deliveryFee: number;
  tax: number;
  total: number;
  deliveryAddress?: string;
  pharmacyPhone?: string;
}): string {
  const lines: string[] = [];

  lines.push("💊 *Kalyan Chemist — Order Request*");
  lines.push("");

  if (params.invoiceNumber) {
    lines.push(`📋 Order: ${params.invoiceNumber}`);
  }

  lines.push("🛒 *Items:*");
  for (const item of params.products) {
    const itemTotal = item.price * item.quantity;
    lines.push(`• ${item.name} × ${item.quantity} — ₹${itemTotal.toLocaleString("en-IN")}`);
  }

  lines.push("");
  lines.push(`Subtotal: ₹${params.subtotal.toLocaleString("en-IN")}`);

  if (params.couponDiscount && params.couponDiscount > 0) {
    lines.push(`Coupon Discount: -₹${params.couponDiscount.toLocaleString("en-IN")}`);
  }

  lines.push(`Delivery: ${params.deliveryFee === 0 ? "Free" : `₹${params.deliveryFee.toLocaleString("en-IN")}`}`);
  lines.push(`GST (12%): ₹${params.tax.toLocaleString("en-IN")}`);
  lines.push(`*Total: ₹${params.total.toLocaleString("en-IN")}*`);

  if (params.deliveryAddress) {
    lines.push("");
    lines.push(`📍 Delivery: ${params.deliveryAddress}`);
  }

  // Check if any items require prescription
  const rxItems = params.products.filter((p) => p.prescriptionRequired);
  if (rxItems.length > 0) {
    lines.push("");
    lines.push("⚠️ *Prescription Required for:*");
    for (const item of rxItems) {
      lines.push(`  • ${item.name}`);
    }
    lines.push("");
    lines.push("Please have a valid prescription from a registered medical practitioner ready.");
  }

  lines.push("");
  lines.push("Please confirm availability and delivery time.");

  return lines.join("\n");
}

/**
 * Generate a safe cart summary message
 * Includes availability check for each product
 */
export function generateCartMessage(params: {
  products: (WhatsAppProduct & { stockQuantity?: number })[];
  subtotal: number;
  pharmacyPhone?: string;
}): string {
  const lines: string[] = [];

  lines.push("💊 *Kalyan Chemist — Cart Order*");
  lines.push("");

  lines.push("🛒 *Items:*");
  const unavailableItems: string[] = [];
  for (const item of params.products) {
    const itemTotal = item.price * item.quantity;
    lines.push(`• ${item.name} × ${item.quantity} — ₹${itemTotal.toLocaleString("en-IN")}`);
    // Check stock availability
    if (item.stockQuantity !== undefined && item.stockQuantity < item.quantity) {
      unavailableItems.push(item.name);
    }
  }

  lines.push("");
  lines.push(`*Subtotal: ₹${params.subtotal.toLocaleString("en-IN")}*`);
  // Check for prescription-required items
  const rxItems = params.products.filter((p) => p.prescriptionRequired);
  if (rxItems.length > 0) {
    lines.push("");
    lines.push("⚠️ *Prescription Required for:*");
    for (const item of rxItems) {
      lines.push(`  • ${item.name}`);
    }
    lines.push("");
    lines.push("Please have a valid prescription ready for verification.");
  }

  lines.push("");

  // Availability auto-reply
  if (unavailableItems.length > 0) {
    lines.push("💊 Hi! Sorry, some items in your cart may be currently unavailable or have insufficient stock:");
    lines.push(`  ${unavailableItems.join(", ")}`);
    lines.push("Our team will confirm availability and assist you shortly.");
  } else {
    lines.push("💊 Hi! All items in your cart are available at Kalyan Chemist. Our team will assist you shortly.");
  }

  return lines.join("\n");
}

/**
 * Customer → admin product enquiry (Product page "Order on WhatsApp").
 *
 * Written in the customer's voice, uses only real product data (each optional
 * line is omitted when the value is missing) and never states that the product
 * is available — the admin confirms availability.
 */
export function generateProductMessage(params: {
  productName: string;
  price: number;
  requestedQuantity?: number;
  prescriptionRequired?: boolean;
  /** Real catalogue data — each line is omitted when the value is missing. */
  productId?: string;
  manufacturer?: string;
  packSize?: string;
  productUrl?: string;
}): string {
  const lines: string[] = [];

  lines.push("👋 Hello Kalyan Chemist Team!");
  lines.push("");
  lines.push("I am interested in purchasing this medicine:");
  lines.push("");
  lines.push(`💊 *${params.productName}*`);
  lines.push("");

  if (params.productId) lines.push(`• Product ID: ${params.productId}`);
  if (params.manufacturer) lines.push(`• Manufacturer: ${params.manufacturer}`);
  if (params.packSize) lines.push(`• Pack Size: ${params.packSize}`);
  lines.push(`• Quantity: ${params.requestedQuantity ?? 1}`);
  lines.push(`• Price: ₹${params.price.toLocaleString("en-IN")}`);

  if (params.productUrl) {
    lines.push("");
    lines.push(`🔗 Product Link: ${params.productUrl}`);
  }

  lines.push("");
  lines.push(
    "Could you please confirm its availability and guide me with the ordering process?"
  );

  if (params.prescriptionRequired) {
    lines.push("");
    lines.push("⚠️ A valid prescription is required for this medicine.");
  }

  lines.push("");
  lines.push("Thank you!");

  return lines.join("\n");
}

/**
 * Generate a general enquiry message for the homepage
 */
export function generateEnquiryMessage(params: {
  customerName?: string;
  enquiryType?: string;
}): string {
  const lines: string[] = [];

  lines.push("💊 *Kalyan Chemist — Enquiry*");
  lines.push("");

  if (params.customerName) {
    lines.push(`👤 Name: ${params.customerName}`);
  }

  if (params.enquiryType) {
    lines.push(`📋 Type: ${params.enquiryType}`);
  }

  lines.push("");
  lines.push("Hi, I would like to enquire about your services.");
  lines.push("");
  lines.push("Please assist me with:");
  lines.push("• Medicine availability");
  lines.push("• Pricing information");
  lines.push("• Delivery options");
  lines.push("");
  lines.push("Thank you!");

  return lines.join("\n");
}

/**
 * Open WhatsApp with a pre-filled message
 * @param phone - Phone number (with or without country code)
 * @param message - Pre-filled message text
 */
export function openWhatsApp(phone: string, message: string): void {
  // Falls back to the configured store number when the number is missing, so a
  // button never produces an empty/broken wa.me link.
  openWhatsAppChat(message, phone || WHATSAPP_BUSINESS_NUMBER);
}

/** Build (without opening) the chat URL for a message — used by tests/previews. */
export function whatsAppLinkFor(phone: string, message: string): string {
  return buildWhatsAppUrl(message, phone || WHATSAPP_BUSINESS_NUMBER);
}

/**
 * Pre-filled greeting used by the floating WhatsApp button.
 * The customer lands in the Kalyan Chemist chat, can edit this text or write
 * their own enquiry and presses Send manually.
 */
export function generateDirectChatMessage(): string {
  return [
    "👋 Hello Kalyan Chemist Team!",
    "",
    "I would like to connect with your team for assistance regarding medicines or an order.",
    "",
    "Thank you!",
  ].join("\n");
}

/**
 * WhatsApp Business App greeting message.
 *
 * Configured manually inside the WhatsApp Business App (Settings → Business
 * tools → Greeting message). WhatsApp sends it automatically to new chats —
 * this website cannot set or send it through a Click-to-Chat link, so this
 * constant exists only as the exact text to copy into the app.
 */
export const WHATSAPP_GREETING_MESSAGE = [
  "Hello! 👋",
  "",
  "Welcome to Kalyan Chemist.",
  "",
  "Thank you for contacting us. How can we assist you today?",
  "",
  "💊 Medicine Enquiry",
  "📦 Order Medicines / Existing Order Support",
  "📄 Prescription Help",
  "👨‍⚕️ Pharmacist Assistance",
  "",
  "Please share your requirement, and our team will be happy to assist you.",
].join("\n");

/**
 * WhatsApp Business App away message.
 *
 * Also configured manually inside the WhatsApp Business App (Settings →
 * Business tools → Away message), together with its own schedule. The website
 * can neither install nor send it.
 */
export const WHATSAPP_AWAY_MESSAGE = [
  "Hello! 👋",
  "",
  "Thank you for contacting Kalyan Chemist.",
  "",
  "We have received your message. Our team is currently unavailable, but we will get back to you as soon as possible.",
  "",
  "Thank you for your patience!",
].join("\n");

// ── Customer assistance panel (floating button) ──

export type WhatsAppAssistanceOptionId =
  | "medicine_enquiry"
  | "order_support"
  | "prescription_help"
  | "pharmacist";

export const WHATSAPP_ASSISTANCE_OPTIONS: Array<{
  id: WhatsAppAssistanceOptionId;
  label: string;
  description: string;
}> = [
  {
    id: "medicine_enquiry",
    label: "Medicine Enquiry",
    description: "Check availability, price or an alternative",
  },
  {
    id: "order_support",
    label: "Existing Order Support",
    description: "Updates, delivery or changes to an order",
  },
  {
    id: "prescription_help",
    label: "Prescription Help",
    description: "Share or clarify a doctor's prescription",
  },
  {
    id: "pharmacist",
    label: "Talk to Pharmacist",
    description: "Ask our pharmacist about your medicines",
  },
];

/**
 * Pre-filled message for an assistance-panel option — written in the
 * customer's voice, one distinct short message per option.
 *
 * `details` is whatever the customer typed in the panel. Only "Existing Order
 * Support" has a slot for it (the Order ID line), and the line is omitted when
 * no order reference was provided — an ID is never invented.
 */
export function generateAssistanceMessage(
  option: WhatsAppAssistanceOptionId,
  details?: string
): string {
  const lines: string[] = ["👋 Hello Kalyan Chemist Team!", ""];
  const typed = (details ?? "").trim();
  // Any typed reference that contains a digit is treated as an order ID.
  const orderId = /\d/.test(typed) ? typed : "";

  switch (option) {
    case "medicine_enquiry":
      lines.push(
        "I would like to enquire about a medicine. Could you please help me with its availability and price?"
      );
      break;
    case "order_support":
      lines.push("I need an update regarding my order.");
      if (orderId) {
        lines.push("");
        lines.push(`Order ID: ${orderId}`);
      }
      lines.push("");
      lines.push("Could you please help me with the current status?");
      break;
    case "prescription_help":
      lines.push(
        "I need some assistance with my prescription. Could you please guide me?"
      );
      break;
    case "pharmacist":
    default:
      lines.push("I would like to speak with a pharmacist regarding a medicine.");
      lines.push("");
      lines.push("Could you please assist me?");
      break;
  }

  lines.push("");
  lines.push("Thank you!");
  return lines.join("\n");
}

// ── Admin → customer communication ──

export type AdminWhatsAppTemplateId =
  | "order_confirmation"
  | "order_packed"
  | "order_out_for_delivery"
  | "order_delivered"
  | "order_cancelled"
  | "refund_processed"
  | "prescription_clarification";

export const ADMIN_WHATSAPP_TEMPLATES: Array<{
  id: AdminWhatsAppTemplateId;
  label: string;
  /** Only offered when the order data confirms a completed refund. */
  requiresRefundedOrder?: boolean;
}> = [
  { id: "order_confirmation", label: "Order confirmation" },
  { id: "order_packed", label: "Order packed" },
  { id: "order_out_for_delivery", label: "Order out for delivery" },
  { id: "order_delivered", label: "Order delivered" },
  { id: "order_cancelled", label: "Order cancellation" },
  { id: "refund_processed", label: "Refund processed", requiresRefundedOrder: true },
  { id: "prescription_clarification", label: "Prescription clarification" },
];

export interface AdminOrderMessageParams {
  customerName?: string;
  orderId: string;
  status?: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
  total?: number;
  paymentStatus?: string;
  hasPrescription?: boolean;
  prescriptionItems?: string[];
  notes?: string;
}

/** Customer-facing wording for an order status that actually exists on the order. */
export function orderStatusMessageBody(status?: string): string {
  switch (status) {
    case "pending":
      return "We have received your order and it is awaiting confirmation.";
    case "confirmed":
      return "Your order has been confirmed and will be prepared shortly.";
    case "processing":
      return "Your order is being prepared at our pharmacy.";
    case "ready_for_dispatch":
      return "Your order is packed and ready for dispatch.";
    case "out_for_delivery":
      return "Your order is out for delivery. Please keep your phone reachable.";
    case "delivered":
      return "Your order has been delivered. Thank you for choosing Kalyan Chemist.";
    case "cancelled":
      return "Your order has been cancelled. Please contact us if you need any help.";
    case "refund_initiated":
      return "A refund has been initiated for your order. It may take a few working days to reflect.";
    case "refunded":
      return "Your refund has been processed for this order.";
    default:
      return "Here is an update on your order.";
  }
}

function orderMessageBody(template: AdminWhatsAppTemplateId, params: AdminOrderMessageParams): string {
  switch (template) {
    case "order_confirmation":
      return "Your order has been confirmed and will be prepared shortly.";
    case "order_packed":
      return "Your order has been packed and is ready for dispatch.";
    case "order_out_for_delivery":
      return "Your order is out for delivery. Please keep your phone reachable.";
    case "order_delivered":
      return "Your order has been delivered. Thank you for choosing Kalyan Chemist.";
    case "order_cancelled":
      return "Your order has been cancelled. Please contact us if you need any help.";
    case "refund_processed":
      return params.paymentStatus === "refunded" || params.status === "refunded"
        ? "Your refund has been processed for this order."
        : "Your refund request is being processed. We will confirm once it is completed.";
    case "prescription_clarification":
      return params.hasPrescription
        ? "We have received your prescription, but we need a small clarification before dispensing. Could you please confirm the details with us?"
        : "We need a valid prescription from a registered medical practitioner before we can dispense this order. Could you please share it with us?";
    default:
      return orderStatusMessageBody(params.status);
  }
}

/**
 * Build the admin → customer WhatsApp message.
 * Uses only real order data; missing fields are skipped rather than invented.
 */
export function generateAdminOrderMessage(params: {
  template?: AdminWhatsAppTemplateId;
  order: AdminOrderMessageParams;
}): string {
  const { order } = params;
  const lines: string[] = [];

  lines.push("💊 *Kalyan Chemist*");
  lines.push("");
  lines.push(
    order.customerName
      ? `Hello ${order.customerName},`
      : "Hello,"
  );
  lines.push("");
  lines.push(
    params.template
      ? orderMessageBody(params.template, order)
      : orderStatusMessageBody(order.status)
  );

  lines.push("");
  lines.push(`📋 *Order:* #${order.orderId}`);
  if (order.status) {
    lines.push(`Status: ${order.status.replace(/_/g, " ")}`);
  }

  if (order.items && order.items.length > 0) {
    lines.push("");
    lines.push("🛒 *Items:*");
    for (const item of order.items) {
      lines.push(`• ${item.name} × ${item.quantity} — ₹${(item.price * item.quantity).toLocaleString("en-IN")}`);
    }
  }

  if (typeof order.total === "number") {
    lines.push("");
    lines.push(`*Total: ₹${order.total.toLocaleString("en-IN")}*`);
  }

  if (params.template === "prescription_clarification" && order.prescriptionItems && order.prescriptionItems.length > 0) {
    lines.push("");
    lines.push("⚠️ Prescription required for:");
    for (const name of order.prescriptionItems) {
      lines.push(`  • ${name}`);
    }
  }

  if (order.notes) {
    lines.push("");
    lines.push(`Note: ${order.notes}`);
  }

  lines.push("");
  lines.push("For any queries, reply to this message.");
  lines.push("— Kalyan Chemist");
  return lines.join("\n");
}

// ── Admin → customer WhatsApp Business quick replies ──
//
// These are the exact texts the admin can paste into WhatsApp Business App →
// Settings → Business tools → Quick replies, one per enquiry type. The admin
// reviews the details, fills any [placeholder] and presses Send manually; no
// availability, price or order status is ever confirmed automatically.

export type WhatsAppQuickReplyId =
  | "medicine_enquiry"
  | "order_support"
  | "prescription_help"
  | "pharmacist"
  | "product_order"
  | "medicine_available"
  | "medicine_unavailable";

export const WHATSAPP_QUICK_REPLIES: Array<{
  id: WhatsAppQuickReplyId;
  label: string;
  /** Suggested WhatsApp Business App quick-reply shortcut. */
  shortcut: string;
}> = [
  { id: "medicine_enquiry", label: "Medicine Enquiry", shortcut: "/medicine" },
  { id: "order_support", label: "Existing Order Support", shortcut: "/order" },
  { id: "prescription_help", label: "Prescription Help", shortcut: "/prescription" },
  { id: "pharmacist", label: "Pharmacist Assistance", shortcut: "/pharmacist" },
  { id: "product_order", label: "Product Order", shortcut: "/product" },
  { id: "medicine_available", label: "Medicine Available", shortcut: "/available" },
  { id: "medicine_unavailable", label: "Medicine Unavailable", shortcut: "/unavailable" },
];

/**
 * Build one admin quick reply.
 *
 * Only "Medicine Available" has a value slot (the verified price) and keeps a
 * visible [Verified Price] placeholder when the admin has not typed one. Nothing
 * about availability, price or order status is ever confirmed by the website.
 */
export function generateQuickReply(params: {
  id: WhatsAppQuickReplyId;
  price?: string;
}): string {
  const price = params.price?.trim() || "[Verified Price]";

  switch (params.id) {
    case "medicine_enquiry":
      return [
        "Hello! 👋",
        "",
        "Thank you for contacting Kalyan Chemist.",
        "",
        "Please share the medicine name so we can check its availability and price.",
        "",
        "We are happy to assist you!",
      ].join("\n");
    case "order_support":
      return [
        "Hello! 👋",
        "",
        "Thank you for reaching out to Kalyan Chemist.",
        "",
        "Please share your order ID so we can check the latest order status and assist you.",
      ].join("\n");
    case "prescription_help":
      return [
        "Hello! 👋",
        "",
        "We would be happy to assist you with your prescription.",
        "",
        "Please share a clear image of your prescription so our team can guide you further.",
      ].join("\n");
    case "pharmacist":
      return [
        "Hello! 👋",
        "",
        "Thank you for contacting Kalyan Chemist.",
        "",
        "We will help connect you with our pharmacist for your medicine-related query.",
      ].join("\n");
    case "product_order":
      return [
        "Hello! 👋",
        "",
        "Thank you for your interest in our product.",
        "",
        "Please allow us a moment to verify its availability and price. We will assist you with the ordering process.",
      ].join("\n");
    case "medicine_available":
      return [
        "Hello! 👋",
        "",
        `Good news! The requested medicine is currently available at ${price}.`,
        "",
        "Would you like us to assist you with placing your order?",
      ].join("\n");
    case "medicine_unavailable":
    default:
      return [
        "Hello! 👋",
        "",
        "We are sorry, but the requested medicine is currently unavailable.",
        "",
        "Please let us know if you would like us to check for an alternative.",
      ].join("\n");
  }
}
