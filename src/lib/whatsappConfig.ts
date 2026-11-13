/**
 * Central WhatsApp configuration for Kalyan Chemist.
 *
 * The business number lives here ONLY — every WhatsApp button/action in the
 * app builds its link from this module, so changing the number is a one-line
 * edit. Links use the official Click-to-Chat format
 * (`https://wa.me/<digits>?text=<encoded>`), which opens WhatsApp with a
 * pre-filled message; nothing is ever sent automatically.
 */

/** Kalyan Chemist WhatsApp number: digits only, country code included. */
export const WHATSAPP_BUSINESS_NUMBER = "919334970699";

/**
 * Normalise a phone number into the digits-only form wa.me expects.
 * Returns "" when there is nothing usable, so callers never build a broken link.
 */
export function normalizeWhatsAppNumber(phone?: string | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

/**
 * Build a Click-to-Chat URL for a pre-filled message.
 * Returns "" when the message is empty, so no empty chat links are produced.
 */
export function buildWhatsAppUrl(message: string, phone?: string | null): string {
  const text = (message ?? "").trim();
  if (!text) return "";
  const number = normalizeWhatsAppNumber(phone) || WHATSAPP_BUSINESS_NUMBER;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

/** Open WhatsApp with a pre-filled message for any number (falls back to the store). */
export function openWhatsAppChat(message: string, phone?: string | null): boolean {
  if (typeof window === "undefined") return false;
  const url = buildWhatsAppUrl(message, phone);
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}

/** Open the Kalyan Chemist WhatsApp chat (the configured business number). */
export function openStoreWhatsApp(message: string): boolean {
  return openWhatsAppChat(message, WHATSAPP_BUSINESS_NUMBER);
}
