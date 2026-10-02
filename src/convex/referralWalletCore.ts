/**
 * Pure, dependency-free rules for the Customer Referral + Wallet system.
 *
 * Everything here is deterministic and free of Convex/network access so it can
 * be shared by the backend, the UI and the tests. The backend never trusts the
 * browser for any of these values — it recalculates them server-side — but
 * keeping the rules in one place means the UI can only ever *preview* what the
 * server will decide.
 */

// ── Referral codes ──

/** Ambiguous characters (0/O, 1/I/L) are excluded so codes are easy to read. */
export const REFERRAL_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const REFERRAL_CODE_LENGTH = 8;
/** Prefix makes a code recognisably a Kalyan Chemist referral. */
export const REFERRAL_CODE_PREFIX = "KC";
export const REFERRAL_CODE_PATTERN = new RegExp(
  `^${REFERRAL_CODE_PREFIX}[${REFERRAL_CODE_ALPHABET}]{${REFERRAL_CODE_LENGTH}}$`,
);

/**
 * Build a referral code from a caller-supplied random seed string. The caller
 * (a Convex mutation) passes crypto randomness; the function itself stays pure
 * so tests can pin the output. Uniqueness is enforced by the database lookup
 * the caller performs, not by this function.
 */
export function generateReferralCode(seed: string): string {
  let out = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    // Deterministic fold of the seed into the alphabet.
    const charCode = seed.charCodeAt(i % Math.max(1, seed.length)) || 0;
    const n = (charCode * (i + 7) + i * 31 + seed.length * 13) % REFERRAL_CODE_ALPHABET.length;
    out += REFERRAL_CODE_ALPHABET[Math.abs(n) % REFERRAL_CODE_ALPHABET.length];
  }
  return `${REFERRAL_CODE_PREFIX}${out}`;
}

/** Normalise a user-entered code (trim + upper-case) before lookup. */
export function normalizeReferralCode(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

export function isValidReferralCode(value: string | null | undefined): boolean {
  return REFERRAL_CODE_PATTERN.test(normalizeReferralCode(value));
}

// ── Wallet settings ──

export type ReferralSettings = {
  rewardAmount: number;
  minQualifyingOrder: number;
  maxWalletUsagePercent: number;
  rewardExpiryDays: number;
};

/** Defaults match the product brief; the admin can override every value. */
export const DEFAULT_REFERRAL_SETTINGS: ReferralSettings = {
  rewardAmount: 100,
  minQualifyingOrder: 299,
  maxWalletUsagePercent: 20,
  rewardExpiryDays: 0, // 0 = rewards never expire
};

/**
 * Coerce a stored settings document into safe values. Missing/NaN/negative
 * values fall back to the defaults so a bad row can never break checkout.
 */
export function resolveReferralSettings(
  stored: Partial<ReferralSettings> | null | undefined,
): ReferralSettings {
  if (!stored) return { ...DEFAULT_REFERRAL_SETTINGS };
  const num = (value: unknown, fallback: number, min = 0) => {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) && n >= min ? n : fallback;
  };
  return {
    rewardAmount: num(stored.rewardAmount, DEFAULT_REFERRAL_SETTINGS.rewardAmount, 0),
    minQualifyingOrder: num(
      stored.minQualifyingOrder,
      DEFAULT_REFERRAL_SETTINGS.minQualifyingOrder,
      0,
    ),
    maxWalletUsagePercent: Math.min(
      100,
      num(
        stored.maxWalletUsagePercent,
        DEFAULT_REFERRAL_SETTINGS.maxWalletUsagePercent,
        0,
      ),
    ),
    rewardExpiryDays: num(stored.rewardExpiryDays, DEFAULT_REFERRAL_SETTINGS.rewardExpiryDays, 0),
  };
}

// ── Wallet usage math ──

/**
 * Maximum wallet rupees that may be applied to an order.
 *
 * Never exceeds: the available balance, the configured percentage of the
 * payable amount, or the payable amount itself. Rounded down to whole rupees.
 */
export function computeMaxWalletUsage(opts: {
  balance: number;
  payable: number;
  percent: number;
}): number {
  const balance = Math.max(0, Math.floor(opts.balance || 0));
  const payable = Math.max(0, Math.floor(opts.payable || 0));
  const percent = Math.min(100, Math.max(0, opts.percent || 0));
  const percentCap = Math.floor((payable * percent) / 100);
  return Math.max(0, Math.min(balance, percentCap, payable));
}

// ── Self-referral detection ──

/** Last 10 digits of a phone number, ignoring country code/formatting. */
export function normalizePhone(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export type ReferralIdentity = {
  userId: string;
  phone?: string | null;
  email?: string | null;
};

/**
 * True when a referral would be obvious self-referral: the same account, or
 * the same verified phone/email. Sharing a delivery address is deliberately
 * NOT checked, so family members on one address can still refer each other.
 */
export function isSelfReferral(referrer: ReferralIdentity, referred: ReferralIdentity): boolean {
  if (referrer.userId === referred.userId) return true;

  const rPhone = normalizePhone(referrer.phone);
  const dPhone = normalizePhone(referred.phone);
  if (rPhone.length === 10 && rPhone === dPhone) return true;

  const rEmail = normalizeEmail(referrer.email);
  const dEmail = normalizeEmail(referred.email);
  if (rEmail.length > 0 && rEmail === dEmail) return true;

  return false;
}

// ── Referral eligibility ──

/**
 * The reward only fires for the referred customer's first eligible order once
 * it reaches DELIVERED and meets the configured minimum. Anything else — a
 * below-minimum order, a cancelled order, a non-delivered order — earns
 * nothing.
 */
export function isOrderEligibleForReferralReward(
  order: { totalAmount: number; status: string },
  minQualifyingOrder: number,
): boolean {
  if (order.status !== "delivered") return false;
  return order.totalAmount >= Math.max(0, minQualifyingOrder);
}

// ── Presentation helpers (safe for the customer to see) ──

/** Show only the first name / first word — never full customer details. */
export function maskCustomerName(name: string | null | undefined): string {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return "A friend";
  return trimmed.split(/\s+/)[0];
}

const TRANSACTION_LABELS: Record<string, string> = {
  REFERRAL_REWARD: "Referral Reward",
  WALLET_USAGE: "Used on Order",
  WALLET_REFUND: "Refund to Wallet",
  ADMIN_CREDIT: "Wallet Credit",
  ADMIN_DEBIT: "Wallet Debit",
  REWARD_REVERSAL: "Referral Reward Reversed",
};

export function transactionLabel(type: string): string {
  return TRANSACTION_LABELS[type] ?? "Wallet Transaction";
}

/** Credits increase the balance, debits reduce it. */
export function directionForType(type: string): "credit" | "debit" {
  return type === "WALLET_USAGE" || type === "ADMIN_DEBIT" || type === "REWARD_REVERSAL"
    ? "debit"
    : "credit";
}

// ── Empty-state copy (kept in one place so wording stays consistent) ──

export const EMPTY_WALLET_MESSAGE = "Your wallet is empty.";
export const EMPTY_REFERRALS_MESSAGE = "You haven't referred anyone yet.";
export const PENDING_REFERRAL_MESSAGE =
  "Waiting for the referred customer's eligible first order.";
export const REFERRAL_REVERSED_MESSAGE = "This referral reward was reversed.";

export type ReferralStatus =
  | "PENDING"
  | "QUALIFIED"
  | "REWARDED"
  | "CANCELLED"
  | "REVERSED";

/** Customer-facing status labels for referral history. */
export function referralStatusLabel(status: ReferralStatus | string): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "QUALIFIED":
      return "Qualified";
    case "REWARDED":
      return "Rewarded";
    case "CANCELLED":
      return "Cancelled";
    case "REVERSED":
      return "Reversed";
    default:
      return "Pending";
  }
}
