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
 * Generate a single-product inquiry message
 * Includes availability auto-reply based on current stock
 */
export function generateProductMessage(params: {
  productName: string;
  price: number;
  composition?: string;
  packSize?: string;
  stockQuantity?: number;
  requestedQuantity?: number;
  prescriptionRequired?: boolean;
  /** Real catalogue data — each line is omitted when the value is missing. */
  productId?: string;
  brand?: string;
  manufacturer?: string;
  strength?: string;
  variant?: string;
  productUrl?: string;
}): string {
  const lines: string[] = [];

  lines.push("💊 *Kalyan Chemist — Product Inquiry*");
  lines.push("");
  lines.push(`Product: ${params.productName}`);
  if (params.productId) lines.push(`Product ID: ${params.productId}`);
  if (params.brand) lines.push(`Brand: ${params.brand}`);
  if (params.manufacturer) lines.push(`Manufacturer: ${params.manufacturer}`);
  if (params.strength) lines.push(`Strength: ${params.strength}`);
  if (params.composition) lines.push(`Composition: ${params.composition}`);
  if (params.variant) lines.push(`Variant: ${params.variant}`);
  if (params.packSize) lines.push(`Pack Size: ${params.packSize}`);
  lines.push(`Quantity: ${params.requestedQuantity ?? 1}`);
  lines.push(`Price: ₹${params.price.toLocaleString("en-IN")}`);
  if (params.productUrl) lines.push(`Link: ${params.productUrl}`);
  lines.push("");

  // Prescription warning
  if (params.prescriptionRequired) {
    lines.push("⚠️ *Prescription Required* — Please have a valid prescription from a registered medical practitioner ready.");
    lines.push("");
  }

  // Availability auto-reply based on live stock
  const qty = params.requestedQuantity ?? 1;
  const stock = params.stockQuantity ?? 0;
  if (stock >= qty) {
    lines.push(`💊 Hi! Your requested medicine (Qty: ${qty}) is available at Kalyan Chemist. Our team will assist you shortly.`);
  } else {
    lines.push("💊 Hi! Sorry, the requested medicine or quantity is currently unavailable. Please let us know if you'd like an alternative.");
  }

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
 * Pre-filled message for an assistance-panel option.
 * `details` is whatever the customer typed in the panel (optional).
 */
export function generateAssistanceMessage(
  option: WhatsAppAssistanceOptionId,
  details?: string
): string {
  const lines: string[] = [];
  const trimmed = (details ?? "").trim();

  switch (option) {
    case "medicine_enquiry":
      lines.push("💊 *Kalyan Chemist — Medicine Enquiry*");
      lines.push("");
      lines.push("Hello, I would like to enquire about a medicine.");
      lines.push("");
      lines.push("Please help me with availability, price and pack size.");
      break;
    case "order_support":
      lines.push("💊 *Kalyan Chemist — Order Support*");
      lines.push("");
      lines.push("Hello, I need help with an existing order.");
      lines.push("");
      lines.push("Please check the status of my order and assist me.");
      break;
    case "prescription_help":
      lines.push("💊 *Kalyan Chemist — Prescription Help*");
      lines.push("");
      lines.push("Hello, I need help with a prescription.");
      lines.push("");
      lines.push("I can share a valid prescription from a registered medical practitioner for verification.");
      break;
    case "pharmacist":
    default:
      lines.push("💊 *Kalyan Chemist — Talk to Pharmacist*");
      lines.push("");
      lines.push("Hello, I would like to speak with your pharmacist about my medicines.");
      break;
  }

  if (trimmed) {
    lines.push("");
    lines.push(`My question: ${trimmed}`);
  }

  lines.push("");
  lines.push("— Sent from the Kalyan Chemist website");
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
