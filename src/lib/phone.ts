/**
 * Normalize an Indian phone number to E.164 format (+91XXXXXXXXXX).
 *
 * Handles:
 *   - 10-digit local: 9876543210 → +919876543210
 *   - With leading 0: 09876543210 → +919876543210
 *   - With country code: 919876543210 → +919876543210
 *   - Already E.164: +919876543210 → +919876543210
 *
 * Returns null if the number cannot be normalized.
 */
export function normalizeIndianPhone(phone: string): string | null {
  if (!phone || typeof phone !== "string") return null;

  const trimmed = phone.trim();
  if (!trimmed) return null;

  // Already E.164
  if (/^\+\d{10,15}$/.test(trimmed)) return trimmed;

  // Strip all non-digits
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  // 10-digit local number
  if (digits.length === 10) {
    return `+91${digits}`;
  }

  // 12 digits starting with 91 (country code without +)
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+${digits}`;
  }

  // 13 digits starting with 091 (0 + country code)
  if (digits.length === 13 && digits.startsWith("091")) {
    return `+${digits.substring(1)}`;
  }

  // Leading 0 + 10-digit
  if (digits.length === 11 && digits.startsWith("0")) {
    return `+91${digits.substring(1)}`;
  }

  return null;
}

/**
 * Validate whether a phone number looks like a valid Indian mobile number.
 * Indian mobile numbers start with 6, 7, 8, or 9 and are 10 digits.
 */
export function isValidIndianPhone(phone: string): boolean {
  const normalized = normalizeIndianPhone(phone);
  if (!normalized) return false;
  // Extract last 10 digits and check Indian mobile prefix
  const local = normalized.substring(normalized.length - 10);
  return /^[6-9]\d{9}$/.test(local);
}
