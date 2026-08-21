/**
 * WhatsApp message utilities for Kalyan Chemist
 * Generates safe order/cart summaries for WhatsApp sharing.
 * Does NOT expose prescription information or sensitive data.
 */

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
}): string {
  const lines: string[] = [];

  lines.push("💊 *Kalyan Chemist — Product Inquiry*");
  lines.push("");
  lines.push(`Product: ${params.productName}`);
  if (params.composition) lines.push(`Composition: ${params.composition}`);
  if (params.packSize) lines.push(`Pack Size: ${params.packSize}`);
  lines.push(`Price: ₹${params.price.toLocaleString("en-IN")}`);
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
