/**
 * Message Center — pure helpers.
 *
 * This module deliberately has no Convex/server imports so the same rules can
 * be unit-tested and shared by backend validation and (read-only) UI copy.
 */

export const MESSAGE_CATEGORIES = [
  {
    value: "festival",
    label: "Festival Wishes",
    emoji: "🪔",
    description: "Seasonal greetings and festive wishes",
  },
  {
    value: "announcement",
    label: "Important Announcement",
    emoji: "📣",
    description: "Store timings, service updates, urgent notices",
  },
  {
    value: "health",
    label: "Health Awareness",
    emoji: "💚",
    description: "Wellness tips and preventive-care reminders",
  },
  {
    value: "offer",
    label: "Special Offer",
    emoji: "🎉",
    description: "Promotions and savings for customers",
  },
] as const;

export type MessageCategory = (typeof MESSAGE_CATEGORIES)[number]["value"];

export const MESSAGE_CATEGORY_VALUES = MESSAGE_CATEGORIES.map((c) => c.value);

export function categoryLabel(value: string): string {
  return MESSAGE_CATEGORIES.find((c) => c.value === value)?.label ?? "Message";
}

export function categoryEmoji(value: string): string {
  return MESSAGE_CATEGORIES.find((c) => c.value === value)?.emoji ?? "💬";
}

export const AUDIENCES = [
  {
    value: "all",
    label: "All registered customers",
    description: "Every registered, non-admin customer account",
  },
  {
    value: "with_orders",
    label: "Customers who have ordered",
    description: "Registered customers with at least one order",
  },
  {
    value: "no_orders",
    label: "Customers without orders",
    description: "Registered customers who have not ordered yet",
  },
  {
    value: "new_users",
    label: "New customers",
    description: "Accounts created in the last 30 days",
  },
  {
    value: "existing_users",
    label: "Existing customers",
    description: "Accounts older than 30 days",
  },
  {
    value: "category_buyers",
    label: "Buyers of a category",
    description: "Customers who ordered from a chosen category",
  },
  {
    value: "selected",
    label: "Selected customers",
    description: "Pick individual customers from the list",
  },
] as const;

export type AudienceType = (typeof AUDIENCES)[number]["value"];

export function audienceLabel(type: string): string {
  return AUDIENCES.find((a) => a.value === type)?.label ?? "Custom audience";
}

export const CHANNELS = [
  { value: "inApp", label: "Website notification" },
  { value: "popup", label: "Login popup" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
] as const;

export type CampaignChannelKey = (typeof CHANNELS)[number]["value"];

export const CAMPAIGN_STATUSES = [
  "draft",
  "scheduled",
  "processing",
  "completed",
  "partially_failed",
  "failed",
  "cancelled",
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export function statusLabel(status: string): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "scheduled":
      return "Scheduled";
    case "processing":
      return "Processing";
    case "completed":
      return "Completed";
    case "partially_failed":
      return "Partially Failed";
    case "failed":
      return "Failed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

/** Channels that leave the app and therefore require provider configuration. */
export const EXTERNAL_CHANNELS = ["whatsapp", "email"] as const;

export interface CampaignChannelSelection {
  inApp: boolean;
  popup: boolean;
  whatsapp: boolean;
  email: boolean;
}

export interface CampaignAudienceInput {
  type: AudienceType;
  categoryId?: string;
  userIds?: string[];
}

export interface CampaignInput {
  title: string;
  body: string;
  category: MessageCategory;
  channels: CampaignChannelSelection;
  audience: CampaignAudienceInput;
  imageUrl?: string;
  scheduledAt?: number;
  expiresAt?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  normalized: {
    title: string;
    body: string;
    category: MessageCategory;
    imageUrl?: string;
    channels: CampaignChannelSelection;
    audience: CampaignAudienceInput;
    scheduledAt?: number;
    expiresAt?: number;
  };
}

export const TITLE_MIN = 3;
export const TITLE_MAX = 120;
export const BODY_MIN = 3;
export const BODY_MAX = 2000;

/** Reject control characters that would corrupt provider payloads. */
function hasControlCharacters(value: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value);
}

export function validateImageUrl(raw: string | undefined): string | undefined {
  const value = (raw ?? "").trim();
  if (!value) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Banner image URL must be a full http:// or https:// URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Banner image URL must use http:// or https://.");
  }
  return value;
}

/**
 * Validate and normalise a campaign draft. Returns every problem at once so the
 * admin sees a complete list instead of fixing errors one at a time.
 */
export function validateCampaignInput(
  input: CampaignInput,
  now: number = Date.now()
): ValidationResult {
  const errors: string[] = [];
  const title = (input.title ?? "").trim();
  const body = (input.body ?? "").replace(/\r\n/g, "\n").trim();

  if (title.length < TITLE_MIN) {
    errors.push(`Title must be at least ${TITLE_MIN} characters.`);
  }
  if (title.length > TITLE_MAX) {
    errors.push(`Title must be at most ${TITLE_MAX} characters.`);
  }
  if (body.length < BODY_MIN) {
    errors.push(`Message body must be at least ${BODY_MIN} characters.`);
  }
  if (body.length > BODY_MAX) {
    errors.push(`Message body must be at most ${BODY_MAX} characters.`);
  }
  if (hasControlCharacters(title) || hasControlCharacters(body)) {
    errors.push("Message contains control characters that cannot be sent.");
  }
  if (!MESSAGE_CATEGORY_VALUES.includes(input.category)) {
    errors.push("Choose a valid message category.");
  }

  const channels: CampaignChannelSelection = {
    inApp: Boolean(input.channels?.inApp),
    popup: Boolean(input.channels?.popup),
    whatsapp: Boolean(input.channels?.whatsapp),
    email: Boolean(input.channels?.email),
  };
  if (!channels.inApp && !channels.popup && !channels.whatsapp && !channels.email) {
    errors.push("Select at least one delivery channel.");
  }

  const audienceType = input.audience?.type;
  const audience: CampaignAudienceInput = {
    type: audienceType,
    categoryId: input.audience?.categoryId,
    userIds: input.audience?.userIds,
  };
  if (!AUDIENCES.some((a) => a.value === audienceType)) {
    errors.push("Choose a valid audience.");
  }
  if (audienceType === "selected") {
    const ids = Array.from(new Set(audience.userIds ?? []));
    audience.userIds = ids;
    if (ids.length === 0) {
      errors.push("Select at least one customer for a selected audience.");
    }
    if (ids.length > 500) {
      errors.push("Select at most 500 customers for a selected audience.");
    }
  }
  if (audienceType === "category_buyers" && !audience.categoryId) {
    errors.push("Choose a category for a category-buyer audience.");
  }

  let imageUrl: string | undefined;
  try {
    imageUrl = validateImageUrl(input.imageUrl);
    if (imageUrl && imageUrl.length > 1000) {
      errors.push("Banner image URL is too long (maximum 1000 characters).");
    }
  } catch (error: any) {
    errors.push(error?.message ?? "Invalid banner image URL.");
  }

  let scheduledAt = input.scheduledAt;
  if (scheduledAt !== undefined) {
    if (!Number.isFinite(scheduledAt)) {
      errors.push("Scheduled time is invalid.");
    } else if (scheduledAt < now - 60_000) {
      errors.push("Scheduled time must be in the future.");
    }
  }

  let expiresAt = input.expiresAt;
  if (expiresAt !== undefined) {
    if (!Number.isFinite(expiresAt)) {
      errors.push("Expiry date is invalid.");
    } else {
      if (expiresAt <= now) {
        errors.push("Expiry date must be in the future.");
      }
      const sendAt = scheduledAt ?? now;
      if (expiresAt <= sendAt) {
        errors.push("Expiry date must be after the scheduled send time.");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      title,
      body,
      category: input.category,
      imageUrl,
      channels,
      audience,
      scheduledAt,
      expiresAt,
    },
  };
}

// ── Channel eligibility ─────────────────────────────────────────────

export interface CustomerLike {
  email?: string | null;
  phone?: string | null;
  emailVerified?: boolean | null;
  phoneVerified?: boolean | null;
  whatsappOptIn?: boolean | null;
  isAnonymous?: boolean | null;
  role?: string | null;
}

export interface PrefLike {
  inApp?: boolean;
  popup?: boolean;
  whatsapp?: boolean;
  email?: boolean;
  promotional?: boolean;
  unsubscribedAt?: number;
}

export interface ChannelEligibility {
  inApp: boolean;
  popup: boolean;
  whatsapp: boolean;
  email: boolean;
  /** Reason a channel is unavailable, for admin preview copy. */
  reasons: Partial<Record<CampaignChannelKey, string>>;
}

/** Normalise an Indian mobile number to E.164 digits (91XXXXXXXXXX). */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let cleaned = String(phone).replace(/[\s\-()]/g, "");
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  if (/^0\d{10}$/.test(cleaned)) cleaned = "91" + cleaned.slice(1);
  if (/^[6-9]\d{9}$/.test(cleaned)) cleaned = "91" + cleaned;
  if (/^91[6-9]\d{9}$/.test(cleaned)) return cleaned;
  return null;
}

export function isValidEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const value = String(email).trim();
  // Pragmatic validation: one @, a dot in the domain, no whitespace.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/**
 * A customer is eligible for a channel when they have usable contact details,
 * have not opted out, and (for promotional campaigns) still accept promotions.
 */
export function channelEligibility(
  customer: CustomerLike,
  prefs: PrefLike | null | undefined
): ChannelEligibility {
  const inApp = prefs?.inApp !== false;
  const popup = prefs?.popup !== false;
  const promotional = prefs?.promotional !== false && !prefs?.unsubscribedAt;
  const emailWanted = prefs?.email !== false;
  const whatsappWanted =
    prefs?.whatsapp !== false && (customer.whatsappOptIn === true || prefs?.whatsapp === true);

  const email = emailWanted && promotional && isValidEmail(customer.email);
  const whatsapp = whatsappWanted && Boolean(normalizePhone(customer.phone));
  const reasons: ChannelEligibility["reasons"] = {};
  if (!inApp) reasons.inApp = "Customer disabled website notifications";
  if (!popup) reasons.popup = "Customer disabled login popups";
  if (!email) {
    reasons.email = !isValidEmail(customer.email)
      ? "No valid email on file"
      : !promotional
        ? "Customer unsubscribed from email"
        : "Customer disabled email notifications";
  }
  if (!whatsapp) {
    reasons.whatsapp = !normalizePhone(customer.phone)
      ? "No valid phone on file"
      : !whatsappWanted
        ? "Customer has not opted in to WhatsApp"
        : "Customer disabled WhatsApp notifications";
  }

  return { inApp, popup, whatsapp, email, reasons };
}

export function maskEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return "—";
  const [user, domain] = email.split("@");
  const shown = user.slice(0, 2);
  return `${shown}${"•".repeat(Math.max(2, Math.min(6, user.length - 2)))}@${domain}`;
}

export function maskPhone(phone: string | null | undefined): string {
  const normalized = normalizePhone(phone);
  if (!normalized) return "—";
  return `••••••${normalized.slice(-4)}`;
}

/** The single server-side authorization rule for Message Center admin work. */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin";
}

/** A registered customer may receive admin communications. */
export function isRegisteredCustomer(user: CustomerLike | null | undefined): boolean {
  return Boolean(user) && user?.isAnonymous !== true && !isAdminRole(user?.role);
}

// ── Time zone, quiet hours and frequency limits ─────────────────────

/**
 * All campaign times are presented and enforced in India Standard Time, the
 * store's operating time zone. It is a fixed offset (no DST), which keeps the
 * quiet-hours arithmetic deterministic on the server.
 */
export const STORE_TIME_ZONE = "Asia/Kolkata (IST)";
export const IST_OFFSET_MINUTES = 330;

export interface QuietHoursSettings {
  quietHoursEnabled: boolean;
  /** 0–23 in IST. */
  quietStartHour: number;
  /** 0–23 in IST; the first allowed hour. */
  quietEndHour: number;
  /** Maximum promotional campaigns one customer may receive in 7 days. */
  maxPromotionalPerWeek: number;
}

export const DEFAULT_QUIET_HOURS: QuietHoursSettings = {
  quietHoursEnabled: true,
  quietStartHour: 21,
  quietEndHour: 9,
  maxPromotionalPerWeek: 3,
};

export function clampHour(value: unknown, fallback: number): number {
  const hour = Number(value);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : fallback;
}

/** Wall-clock parts of a timestamp in IST. */
export function storeTimeParts(ts: number) {
  const date = new Date(ts + IST_OFFSET_MINUTES * 60_000);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
    weekday: date.getUTCDay(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  };
}

function minutesOfHour(hour: number): number {
  return clampHour(hour, 0) * 60;
}

/** True when the timestamp falls inside the configured quiet window (IST). */
export function isQuietHours(ts: number, settings: QuietHoursSettings): boolean {
  if (!settings.quietHoursEnabled) return false;
  const start = minutesOfHour(settings.quietStartHour);
  const end = minutesOfHour(settings.quietEndHour);
  if (start === end) return false;
  const parts = storeTimeParts(ts);
  const minute = parts.hour * 60 + parts.minute;
  if (start < end) return minute >= start && minute < end;
  // Window wraps midnight (e.g. 21:00 → 09:00).
  return minute >= start || minute < end;
}

/**
 * First instant at or after `ts` that is outside the quiet window. Hour steps
 * keep the minute offset stable, so a 21:30 campaign resumes at 09:30.
 */
export function nextAllowedSendTime(ts: number, settings: QuietHoursSettings): number {
  if (!isQuietHours(ts, settings)) return ts;
  let candidate = ts;
  for (let i = 0; i < 48 && isQuietHours(candidate, settings); i++) {
    candidate += 60 * 60 * 1000;
  }
  return candidate;
}

/** Friendly IST label used in admin copy, e.g. "27 Oct 2026, 9:30 am". */
export function formatStoreDateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ── A/B testing ─────────────────────────────────────────────────────

/** Maximum number of manual retry rounds allowed per delivery. */
export const MAX_DELIVERY_ATTEMPTS = 3;
/** Minimum per-variant sample before a winner may be suggested. */
export const AB_MIN_SAMPLE = 30;

export function stableBucket(key: string): number {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

/** Deterministic variant so retries and re-materialisation never reshuffle. */
export function abVariantFor(
  campaignId: string,
  userId: string,
  splitPercent: number
): "A" | "B" {
  const split = Math.min(90, Math.max(10, Math.round(splitPercent)));
  return stableBucket(`${campaignId}:${userId}`) < split ? "A" : "B";
}

export interface AbCounts {
  targeted: number;
  accepted: number;
  delivered: number;
  read: number;
  failed: number;
}

export interface AbEvaluation {
  a: AbCounts;
  b: AbCounts;
  sufficient: boolean;
  leading: "A" | "B" | null;
  reason: string;
  readRateA: number | null;
  readRateB: number | null;
}

function rate(value: number, total: number): number | null {
  return total > 0 ? value / total : null;
}

/**
 * Compares variants using only recorded outcomes. A winner is only suggested
 * when each variant has a real sample and the read rate differs by more than a
 * trivial margin; otherwise the result is explicitly inconclusive.
 */
export function evaluateAbTest(a: AbCounts, b: AbCounts): AbEvaluation {
  const readRateA = rate(a.read, a.targeted);
  const readRateB = rate(b.read, b.targeted);
  const sufficient =
    a.targeted >= AB_MIN_SAMPLE &&
    b.targeted >= AB_MIN_SAMPLE &&
    a.accepted + a.delivered + a.read + a.failed > 0 &&
    b.accepted + b.delivered + b.read + b.failed > 0;

  if (!sufficient) {
    return {
      a,
      b,
      sufficient: false,
      leading: null,
      reason: `Not enough data: each variant needs at least ${AB_MIN_SAMPLE} recipients before a winner can be suggested.`,
      readRateA,
      readRateB,
    };
  }
  if (readRateA === null || readRateB === null) {
    return {
      a,
      b,
      sufficient: false,
      leading: null,
      reason: "Read tracking is not available for these channels, so no winner can be suggested.",
      readRateA,
      readRateB,
    };
  }
  const gap = Math.abs(readRateA - readRateB);
  if (gap < 0.05) {
    return {
      a,
      b,
      sufficient: true,
      leading: null,
      reason: `Read rates are within 5 percentage points (${Math.round(
        readRateA * 100
      )}% vs ${Math.round(readRateB * 100)}%), so the test is inconclusive.`,
      readRateA,
      readRateB,
    };
  }
  return {
    a,
    b,
    sufficient: true,
    leading: readRateA > readRateB ? "A" : "B",
    reason: `Variant ${readRateA > readRateB ? "A" : "B"} has the higher read rate (${Math.round(
      Math.max(readRateA, readRateB) * 100
    )}% vs ${Math.round(Math.min(readRateA, readRateB) * 100)}%).`,
    readRateA,
    readRateB,
  };
}

// ── Manual retry eligibility ────────────────────────────────────────

/**
 * Failures that will fail again for the same reason. They are never offered for
 * retry, so an admin cannot accidentally repeat a permanent rejection.
 */
const PERMANENT_FAILURE =
  /opted out|unsubscribed|disabled|no email address|no valid|not opted in|not configured|approved whatsapp template|invalid|not retried to avoid duplicates|interrupted/i;

export function retryEligibility(delivery: {
  channel?: string;
  status?: string;
  attempts?: number;
  error?: string | null;
}): { eligible: boolean; reason?: string } {
  if (delivery.channel !== "email" && delivery.channel !== "whatsapp") {
    return { eligible: false, reason: "Built-in channels are delivered by the app itself." };
  }
  if (delivery.status !== "failed") {
    return { eligible: false, reason: "Only failed deliveries can be retried." };
  }
  if (PERMANENT_FAILURE.test(delivery.error ?? "")) {
    return {
      eligible: false,
      reason: "This failure is permanent (consent or configuration), so retrying would fail again.",
    };
  }
  return { eligible: true };
}

/** Promotional reach for a channel set — used for quiet hours/frequency copy. */
export function promotionalChannels(channels: CampaignChannelSelection): string[] {
  const labels: Record<keyof CampaignChannelSelection, string> = {
    inApp: "Website notification",
    popup: "Login popup",
    whatsapp: "WhatsApp",
    email: "Email",
  };
  return (Object.keys(labels) as (keyof CampaignChannelSelection)[])
    .filter((key) => channels[key])
    .map((key) => labels[key]);
}

// ── Campaign outcome ────────────────────────────────────────────────

export interface DeliveryCounts {
  queued: number;
  sending: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  skipped: number;
}

export function campaignOutcome(
  counts: DeliveryCounts
): "completed" | "partially_failed" | "failed" {
  const succeeded = counts.sent + counts.delivered + counts.read;
  if (counts.failed > 0) {
    return succeeded > 0 ? "partially_failed" : "failed";
  }
  return "completed";
}

// ── Email rendering ────────────────────────────────────────────────

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const CATEGORY_COLOR: Record<string, string> = {
  festival: "#b45309",
  announcement: "#0f766e",
  health: "#047857",
  offer: "#be123c",
};

export interface EmailTemplateInput {
  title: string;
  body: string;
  category: string;
  imageUrl?: string;
  unsubscribeUrl: string;
  preferencesUrl?: string;
}

/** Responsive, branding-consistent transactional/promotional email. */
export function buildCampaignEmailHtml(input: EmailTemplateInput): string {
  const color = CATEGORY_COLOR[input.category] ?? "#0f766e";
  const paragraphs = escapeHtml(input.body)
    .split(/\n{2,}/)
    .map((block) => block.replace(/\n/g, "<br>"))
    .filter(Boolean)
    .map(
      (block) =>
        `<p style="margin:0 0 16px;color:#414a47;font-size:15px;line-height:1.65;">${block}</p>`
    )
    .join("");

  const image = input.imageUrl
    ? `<tr><td style="padding:0;"><img src="${escapeHtml(input.imageUrl)}" alt="" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;" /></td></tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f6f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f4;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 2px 10px rgba(15,60,45,0.08);">
        <tr>
          <td style="background:${color};padding:26px 32px;">
            <div style="color:#ffffff;font-size:19px;font-weight:700;letter-spacing:-0.2px;">Kalyan Chemist</div>
            <div style="color:rgba(255,255,255,0.82);font-size:12px;margin-top:3px;letter-spacing:0.4px;text-transform:uppercase;">${escapeHtml(categoryLabel(input.category))}</div>
          </td>
        </tr>
        ${image}
        <tr>
          <td style="padding:32px 32px 8px;">
            <h1 style="margin:0 0 16px;color:#14201c;font-size:23px;line-height:1.3;font-weight:700;">${escapeHtml(input.title)}</h1>
            ${paragraphs}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 32px;">
            <a href="https://kalyanchemist.com/products" style="display:inline-block;background:${color};color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:10px;font-size:14px;font-weight:600;">Visit Kalyan Chemist</a>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px 24px;border-top:1px solid #e8eeeb;">
            <p style="margin:0 0 8px;color:#6b7772;font-size:12px;line-height:1.6;">
              You are receiving this email because you have a Kalyan Chemist account.
            </p>
            <p style="margin:0;color:#6b7772;font-size:12px;line-height:1.6;">
              <a href="${escapeHtml(input.unsubscribeUrl)}" style="color:${color};text-decoration:underline;">Unsubscribe from promotional emails</a>
              &nbsp;·&nbsp;
              <a href="${escapeHtml(input.preferencesUrl ?? "https://kalyanchemist.com/#/account/notifications")}" style="color:${color};text-decoration:underline;">Manage notification preferences</a>
            </p>
            <p style="margin:12px 0 0;color:#9aa5a0;font-size:11px;line-height:1.6;">
              Kalyan Chemist — your trusted local pharmacy. Please do not reply to this automated email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function plainTextEmail(input: {
  title: string;
  body: string;
  unsubscribeUrl: string;
}): string {
  return [
    "KALYAN CHEMIST",
    "",
    input.title,
    "",
    input.body,
    "",
    "Visit: https://kalyanchemist.com/products",
    "",
    `Unsubscribe from promotional emails: ${input.unsubscribeUrl}`,
  ].join("\n");
}

/**
 * WhatsApp template parameters must be a single line each and bounded in size.
 * Meta rejects newlines/tabs and very long parameters.
 */
export function whatsappTemplateParams(title: string, body: string): [string, string] {
  const clean = (value: string, max: number) =>
    value
      .replace(/\s+/g, " ")
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .trim()
      .slice(0, max) || "Kalyan Chemist";
  return [clean(title, 120), clean(body, 900)];
}
