// ── Input sanitization and security helpers ──

/**
 * Strip HTML tags and potentially dangerous characters from user input.
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/<[^>]*>/g, "") // strip HTML tags
    .replace(/[<>]/g, "")   // strip angle brackets
    .trim();
}

/**
 * Validate an Indian phone number (10 digits, optional +91 prefix).
 */
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, "");
  return /^(\+91)?[6-9]\d{9}$/.test(cleaned);
}

/**
 * Validate an Indian pincode (6 digits).
 */
export function isValidPincode(pincode: string): boolean {
  return /^\d{6}$/.test(pincode.trim());
}

/**
 * Validate an email address.
 */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Validate a coupon code format (alphanumeric, 3-20 chars).
 */
export function isValidCouponCode(code: string): boolean {
  return /^[A-Z0-9]{3,20}$/i.test(code.trim());
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Format a phone number for display (masked for privacy).
 */
export function maskPhone(phone: string): string {
  if (phone.length < 4) return "****";
  return phone.slice(0, -4).replace(/./g, "*") + phone.slice(-4);
}

/**
 * Client-side rate limiting check via localStorage.
 */
export function checkClientRateLimit(
  action: string,
  minIntervalMs: number
): boolean {
  try {
    const key = `rl_${action}`;
    const last = parseInt(localStorage.getItem(key) || "0", 10);
    const now = Date.now();
    if (now - last < minIntervalMs) {
      return false;
    }
    localStorage.setItem(key, String(now));
    return true;
  } catch {
    return true;
  }
}

/**
 * Validate a slug format (lowercase, hyphens, no special chars).
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

/**
 * Truncate text to a maximum length with ellipsis.
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Calculate days remaining until a timestamp.
 */
export function daysUntil(timestamp: number): number {
  const diff = timestamp - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Format a relative time string (e.g. "2h ago", "in 3d").
 */
export function relativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = timestamp - now;
  const absDiff = Math.abs(diff);
  const future = diff > 0;

  const minutes = Math.floor(absDiff / (1000 * 60));
  const hours = Math.floor(absDiff / (1000 * 60 * 60));
  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return "just now";
  if (minutes < 60) return future ? `in ${minutes}m` : `${minutes}m ago`;
  if (hours < 24) return future ? `in ${hours}h` : `${hours}h ago`;
  if (days < 30) return future ? `in ${days}d` : `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-IN");
}
