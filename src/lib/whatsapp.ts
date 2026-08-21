/**
 * WhatsApp message utilities for Kalyan Chemist
 * Generates safe order/cart summaries for WhatsApp sharing.
 * Does NOT expose prescription information or sensitive data.
 */

export interface WhatsAppProduct {
  name: string;
  quantity: number;
  price: number;
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

  lines.push("");
  lines.push("Please confirm availability and delivery time.");

  return lines.join("\n");
}

/**
 * Generate a safe cart summary message
 */
export function generateCartMessage(params: {
  products: WhatsAppProduct[];
  subtotal: number;
  pharmacyPhone?: string;
}): string {
  const lines: string[] = [];

  lines.push("💊 *Kalyan Chemist — Cart Inquiry*");
  lines.push("");

  lines.push("🛒 *Items:*");
  for (const item of params.products) {
    const itemTotal = item.price * item.quantity;
    lines.push(`• ${item.name} × ${item.quantity} — ₹${itemTotal.toLocaleString("en-IN")}`);
  }

  lines.push("");
  lines.push(`*Subtotal: ₹${params.subtotal.toLocaleString("en-IN")}*`);
  lines.push("");
  lines.push("Please confirm availability and share the delivery options.");

  return lines.join("\n");
}

/**
 * Generate a single-product inquiry message
 */
export function generateProductMessage(params: {
  productName: string;
  price: number;
  composition?: string;
  packSize?: string;
}): string {
  const lines: string[] = [];

  lines.push("💊 *Kalyan Chemist — Product Inquiry*");
  lines.push("");
  lines.push(`Product: ${params.productName}`);
  if (params.composition) lines.push(`Composition: ${params.composition}`);
  if (params.packSize) lines.push(`Pack Size: ${params.packSize}`);
  lines.push(`Price: ₹${params.price.toLocaleString("en-IN")}`);
  lines.push("");
  lines.push("Is this product available? Please share details.");

  return lines.join("\n");
}

/**
 * Open WhatsApp with a pre-filled message
 * @param phone - Phone number (with or without country code)
 * @param message - Pre-filled message text
 */
export function openWhatsApp(phone: string, message: string): void {
  // Normalize phone: remove spaces, dashes, etc.
  let normalized = phone.replace(/[\s\-()]/g, "");

  // Add +91 if it's a 10-digit Indian number
  if (/^\d{10}$/.test(normalized)) {
    normalized = "91" + normalized;
  }

  // Remove leading + if present
  if (normalized.startsWith("+")) {
    normalized = normalized.substring(1);
  }

  const encoded = encodeURIComponent(message);
  const url = `https://wa.me/${normalized}?text=${encoded}`;

  window.open(url, "_blank", "noopener,noreferrer");
}
