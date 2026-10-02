/**
 * Pure, dependency-free rules for the Customer Referral + Wallet system.
 *
 * Everything here is deterministic and free of Convex/network access so it can
 * be shared by the backend, the UI and the tests. The backend never trusts the
 * browser for any of these values — it recalculates them server-side — but
 * keeping the rules in one place means the UI can only ever *preview* what the
 * server will decide.
 *
 * Everything that decides money or risk lives in this file so the rules can be
 * pinned by tests without a database:
 *  • the canonical qualifying order amount
 *  • referral risk scoring (LOW / MEDIUM / HIGH)
 *  • the referral lifecycle and its legal transitions
 *  • the post-delivery reward hold
 *  • expirable-credit accounting (earliest-expiring-first allocation)
 *  • truthful, partial-aware reward reversal planning
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
  /**
   * Days a delivered, low-risk referral waits before the reward is released.
   * 0 releases immediately (still after delivery, never before).
   */
  rewardHoldDays: number;
  /** Referrals a single referrer may attribute per 30-day window. 0 = unlimited. */
  maxReferralsPerMonth: number;
  /** When true a MEDIUM-risk referral is released once its hold elapses. */
  autoReleaseMediumRisk: boolean;
};

/** Defaults match the product brief; the admin can override every value. */
export const DEFAULT_REFERRAL_SETTINGS: ReferralSettings = {
  rewardAmount: 100,
  minQualifyingOrder: 299,
  maxWalletUsagePercent: 20,
  rewardExpiryDays: 0, // 0 = rewards never expire
  // A short protection window stops a same-week cancellation from clawing the
  // reward back. Set 0 in settings to reward instantly on delivery.
  rewardHoldDays: 3,
  maxReferralsPerMonth: 15,
  autoReleaseMediumRisk: false,
};

/**
 * Coerce a stored settings document into safe values. Missing/NaN/negative
 * values fall back to the defaults so a bad row can never break checkout.
 *
 * Records written before these settings existed simply resolve to the
 * defaults, which is what keeps old rows working unchanged.
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
    rewardHoldDays: num(stored.rewardHoldDays, DEFAULT_REFERRAL_SETTINGS.rewardHoldDays, 0),
    maxReferralsPerMonth: num(
      stored.maxReferralsPerMonth,
      DEFAULT_REFERRAL_SETTINGS.maxReferralsPerMonth,
      0,
    ),
    autoReleaseMediumRisk:
      typeof stored.autoReleaseMediumRisk === "boolean"
        ? stored.autoReleaseMediumRisk
        : DEFAULT_REFERRAL_SETTINGS.autoReleaseMediumRisk,
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

/** The minimum shape the eligibility rules need from an order. */
export type QualifyingOrderLike = {
  totalAmount: number;
  status: string;
  /** Net merchandise value before delivery/tax, when the order model has it. */
  subtotal?: number | null;
  /** Discount already applied to the merchandise. */
  discount?: number | null;
};

/**
 * The canonical amount a referral minimum is measured against: the net
 * merchandise value *after* discounts and *before* any wallet deduction,
 * excluding unrelated charges such as the delivery fee.
 *
 * Orders written before the itemised fields existed (or any caller that only
 * knows the grand total) fall back to `totalAmount`, so old records keep
 * behaving exactly as they did.
 */
export function eligibleOrderAmount(order: QualifyingOrderLike): number {
  const subtotal = Number(order.subtotal);
  if (Number.isFinite(subtotal)) {
    const discount = Number(order.discount ?? 0);
    const net = subtotal - (Number.isFinite(discount) ? discount : 0);
    return Math.max(0, Math.floor(net));
  }
  const total = Number(order.totalAmount);
  return Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
}

/**
 * The reward only fires for the referred customer's first eligible order once
 * it reaches DELIVERED and meets the configured minimum. Anything else — a
 * below-minimum order, a cancelled order, a non-delivered order — earns
 * nothing. Signup, link clicks, placing an order and paying never do.
 */
export function isOrderEligibleForReferralReward(
  order: QualifyingOrderLike,
  minQualifyingOrder: number,
): boolean {
  if (order.status !== "delivered") return false;
  return eligibleOrderAmount(order) >= Math.max(0, minQualifyingOrder);
}

// ── Referral lifecycle ──

export type ReferralStatus =
  | "PENDING"
  | "QUALIFIED"
  | "ON_HOLD"
  | "REWARDED"
  | "CANCELLED"
  | "REVERSED"
  | "BLOCKED";

/** Statuses that will never move again without an explicit admin decision. */
export const TERMINAL_REFERRAL_STATUSES: ReferralStatus[] = [
  "REWARDED",
  "REVERSED",
  "CANCELLED",
  "BLOCKED",
];

/**
 * Legal lifecycle moves. Anything not listed is rejected so a stray update can
 * never skip the audit trail (e.g. PENDING → REWARDED without a qualification
 * step, or reviving a blocked referral automatically).
 */
const LIFECYCLE_TRANSITIONS: Record<ReferralStatus, ReferralStatus[]> = {
  // customer joined
  PENDING: ["QUALIFIED", "ON_HOLD", "CANCELLED", "BLOCKED"],
  // first order met the criteria
  QUALIFIED: ["ON_HOLD", "REWARDED", "CANCELLED", "BLOCKED"],
  // risk or refund-protection window
  ON_HOLD: ["REWARDED", "CANCELLED", "BLOCKED"],
  // wallet reward issued
  REWARDED: ["REVERSED", "BLOCKED"],
  // qualifying order cancelled/refunded before a reward
  CANCELLED: ["PENDING"],
  // reward invalidated after issue
  REVERSED: ["BLOCKED"],
  // admin determined the referral was invalid
  BLOCKED: [],
};

/** True when `to` is a permitted transition out of `from`. */
export function canTransition(from: string, to: string): boolean {
  const allowed = LIFECYCLE_TRANSITIONS[from as ReferralStatus];
  if (!allowed) return false;
  return allowed.includes(to as ReferralStatus);
}

/** True when the referral will not move again on its own. */
export function isTerminalReferralStatus(status: string): boolean {
  return TERMINAL_REFERRAL_STATUSES.includes(status as ReferralStatus);
}

// ── Reward hold (post-delivery protection window) ──

/**
 * When a delivered referral becomes releasable. The hold always starts at
 * delivery, never at signup or order placement, so the customer is not
 * penalised for delivery time.
 */
export function rewardHoldUntil(deliveredAt: number, holdDays: number): number {
  const days = Math.max(0, Math.floor(holdDays || 0));
  return deliveredAt + days * 24 * 60 * 60 * 1000;
}

/** True once the protection window has elapsed. */
export function isHoldSatisfied(holdUntil: number | null | undefined, now: number): boolean {
  if (holdUntil === null || holdUntil === undefined) return true;
  return now >= holdUntil;
}

// ── Risk / abuse detection ──

export type ReferralRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export const REFERRAL_RISK_LEVELS: ReferralRiskLevel[] = ["LOW", "MEDIUM", "HIGH"];

/**
 * Privacy-conscious abuse signals.
 *
 * These are all facts the business already stores (identities, order history,
 * referral counts, payment retries). IP address and device fingerprinting are
 * deliberately NOT collected — they are neither reliable nor necessary here,
 * and a shared address is explicitly *not* treated as self-referral so family
 * members on one address can still refer each other.
 */
export type ReferralRiskSignals = {
  /** Same verified phone as the referrer. */
  samePhone?: boolean;
  /** Same verified email as the referrer. */
  sameEmail?: boolean;
  /** The referred customer already had orders before joining. */
  priorOrderBeforeAttribution?: boolean;
  /** How many of this referrer's referred customers share a phone/email with it. */
  duplicateIdentityReferrals?: number;
  /** How many times this customer re-submitted a referral claim. */
  repeatedAttributionAttempts?: number;
  /** Referrals this referrer has made in the recent window. */
  referralsInWindow?: number;
  /** Configured velocity limit; 0 disables the check. */
  velocityLimit?: number;
  /** Previously cancelled/refunded qualifying orders by the referred customer. */
  cancelledQualifyingOrders?: number;
  /** Rewards this referrer has had reversed. */
  reversedRewards?: number;
  /** Payment attempts on the referred customer's order (supporting signal). */
  paymentRetryCount?: number;
  /** Referred customers sharing one delivery address (supporting signal). */
  sameDeliveryAddressCount?: number;
};

export type RiskAssessment = {
  level: ReferralRiskLevel;
  score: number;
  /** Neutral, admin-facing explanations. Never shown to customers. */
  reasons: string[];
};

/** Score at or above which a referral needs review rather than auto-reward. */
export const MEDIUM_RISK_THRESHOLD = 25;
/** Score at or above which a referral must not be rewarded automatically. */
export const HIGH_RISK_THRESHOLD = 60;

/**
 * Score a referral from business signals.
 *
 * The result is a *review* signal, not a verdict: HIGH means "a human should
 * look before money moves", never "this customer is a fraudster".
 */
export function assessReferralRisk(signals: ReferralRiskSignals): RiskAssessment {
  const reasons: string[] = [];
  let score = 0;
  const add = (points: number, reason: string) => {
    if (points > 0) {
      score += points;
      reasons.push(reason);
    }
  };

  if (signals.samePhone) add(60, "Referred customer uses the referrer's phone number");
  // A shared verified email is the same kind of identity signal as a shared
  // verified phone, so it is weighted the same.
  if (signals.sameEmail) add(60, "Referred customer uses the referrer's email address");

  if (signals.priorOrderBeforeAttribution) {
    add(40, "Referred customer had earlier orders before joining");
  }

  const duplicates = Math.max(0, Math.floor(signals.duplicateIdentityReferrals ?? 0));
  if (duplicates >= 2) {
    add(25, "Several referred customers share the referrer's contact details");
  } else if (duplicates === 1) {
    add(12, "A referred customer shares the referrer's contact details");
  }

  const attempts = Math.max(0, Math.floor(signals.repeatedAttributionAttempts ?? 0));
  if (attempts >= 3) add(25, "Repeated referral claims from the same customer");

  const velocityLimit = Math.max(0, Math.floor(signals.velocityLimit ?? 0));
  const inWindow = Math.max(0, Math.floor(signals.referralsInWindow ?? 0));
  if (velocityLimit > 0 && inWindow >= velocityLimit) {
    add(35, "Referrer has an unusually high number of recent referrals");
  }

  const cancelled = Math.max(0, Math.floor(signals.cancelledQualifyingOrders ?? 0));
  if (cancelled >= 4) add(60, "Referred customer has repeated cancelled or refunded orders");
  else if (cancelled >= 2) add(20, "Referred customer has cancelled or refunded orders");

  const reversed = Math.max(0, Math.floor(signals.reversedRewards ?? 0));
  if (reversed >= 3) add(60, "Referrer has repeatedly had rewards reversed");
  else if (reversed >= 1) add(20, "Referrer has had a reward reversed before");

  // Supporting signals only — never enough on their own to raise the level
  // past MEDIUM, because both are common in legitimate households.
  const retries = Math.max(0, Math.floor(signals.paymentRetryCount ?? 0));
  if (retries >= 5) add(10, "Unusual number of payment attempts on the qualifying order");

  const sharedAddress = Math.max(0, Math.floor(signals.sameDeliveryAddressCount ?? 0));
  if (sharedAddress >= 3) add(10, "Several referred customers share one delivery address");

  const level: ReferralRiskLevel =
    score >= HIGH_RISK_THRESHOLD ? "HIGH" : score >= MEDIUM_RISK_THRESHOLD ? "MEDIUM" : "LOW";

  return { level, score, reasons };
}

/** Risk level to store on a referral that predates the risk engine. */
export function resolveRiskLevel(value: string | null | undefined): ReferralRiskLevel {
  const level = (value ?? "").toUpperCase();
  return (REFERRAL_RISK_LEVELS as string[]).includes(level)
    ? (level as ReferralRiskLevel)
    : "LOW";
}

// ── Expirable wallet credits ──

/** One expirable credit lot carved out of a single ledger transaction. */
export type ExpirableCredit = {
  /** Stable id used as the allocation/idempotency reference. */
  id: string;
  /** Amount originally credited to this lot. */
  amount: number;
  /** How much of this lot is still unspent and not yet expired. */
  remaining: number;
  /** Epoch ms, or null/undefined when the credit never expires. */
  expiresAt?: number | null;
};

export type CreditAllocation = {
  creditId: string;
  amount: number;
};

/**
 * Total amount that may actually be spent right now: every credit lot that has
 * not passed its expiry date. Expired value is deliberately excluded so it can
 * never be applied at checkout.
 */
export function computeSpendableBalance(
  credits: ExpirableCredit[],
  now: number,
): number {
  return credits.reduce(
    (sum, credit) => sum + (isCreditLive(credit, now) ? Math.max(0, credit.remaining) : 0),
    0,
  );
}

/** True when a credit lot still holds spendable value at `now`. */
export function isCreditLive(credit: ExpirableCredit, now: number): boolean {
  if (credit.expiresAt === null || credit.expiresAt === undefined) return true;
  return credit.expiresAt > now;
}

/** Credit lots whose value has lapsed and must be swept out of the balance. */
export function expiredCredits(
  credits: ExpirableCredit[],
  now: number,
): ExpirableCredit[] {
  return credits.filter(
    (credit) =>
      credit.remaining > 0 &&
      credit.expiresAt !== null &&
      credit.expiresAt !== undefined &&
      credit.expiresAt <= now,
  );
}

/** Credits that lapse within `withinDays` — used for the "expiring soon" notice. */
export function creditsExpiringWithin(
  credits: ExpirableCredit[],
  now: number,
  withinDays: number,
): ExpirableCredit[] {
  const horizon = now + Math.max(0, withinDays) * 24 * 60 * 60 * 1000;
  return credits.filter(
    (credit) =>
      credit.remaining > 0 &&
      credit.expiresAt !== null &&
      credit.expiresAt !== undefined &&
      credit.expiresAt > now &&
      credit.expiresAt <= horizon,
  );
}

/**
 * Spread a spend across credit lots, consuming the **earliest-expiring value
 * first** so customers always lose the value that is about to lapse. The
 * returned allocation is what gets recorded against the debit, which keeps the
 * ledger explainable ("which ₹ of which reward paid for this order?").
 *
 * The caller must clamp `amount` to `spendable` — this function never allocates
 * more than the live balance holds and reports the shortfall instead.
 */
export function allocateSpend(
  credits: ExpirableCredit[],
  amount: number,
  now: number,
): { allocation: CreditAllocation[]; allocated: number; shortfall: number } {
  const requested = Math.max(0, Math.floor(amount || 0));
  const live = credits
    .filter((credit) => credit.remaining > 0 && isCreditLive(credit, now))
    .sort((a, b) => {
      // Earliest expiry first; never-expiring lots last.
      const ax = a.expiresAt ?? Number.POSITIVE_INFINITY;
      const bx = b.expiresAt ?? Number.POSITIVE_INFINITY;
      if (ax !== bx) return ax - bx;
      return a.id.localeCompare(b.id);
    });

  const allocation: CreditAllocation[] = [];
  let left = requested;
  for (const credit of live) {
    if (left <= 0) break;
    const take = Math.min(left, Math.max(0, Math.floor(credit.remaining)));
    if (take <= 0) continue;
    allocation.push({ creditId: credit.id, amount: take });
    left -= take;
  }

  const allocated = requested - left;
  return { allocation, allocated, shortfall: left };
}

// ── Truthful reward reversal ──

export type ReversalPlan = {
  /** The reward value that should have been taken back. */
  requested: number;
  /** Amount already recovered by earlier reversal attempts. */
  recoveredBefore: number;
  /** Amount actually recovered by this attempt. */
  recovered: number;
  /** Value still owed back but not recoverable right now. */
  outstanding: number;
};

/**
 * Plan a reward reversal that can only ever recover what is actually there.
 *
 * A referrer who already spent the reward is NOT allowed to have a negative
 * wallet: only the available balance is recovered and the remainder is
 * reported as outstanding so it can be chased later. The caller must record
 * `recovered` as a new transaction and `outstanding` on the referral — it must
 * never present an unrecovered amount as fully reversed.
 */
export function planReversal(opts: {
  rewardAmount: number;
  recoveredBefore?: number;
  availableBalance: number;
}): ReversalPlan {
  const reward = Math.max(0, Math.floor(opts.rewardAmount || 0));
  const recoveredBefore = Math.min(reward, Math.max(0, Math.floor(opts.recoveredBefore ?? 0)));
  const stillOwed = Math.max(0, reward - recoveredBefore);
  const available = Math.max(0, Math.floor(opts.availableBalance || 0));
  const recovered = Math.min(stillOwed, available);
  return {
    requested: reward,
    recoveredBefore,
    recovered,
    outstanding: Math.max(0, stillOwed - recovered),
  };
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
  REWARD_RECOVERY: "Reversal Amount Recovered",
  REWARD_EXPIRY: "Reward Expired",
};

export function transactionLabel(type: string): string {
  return TRANSACTION_LABELS[type] ?? "Wallet Transaction";
}

/** Credits increase the balance, debits reduce it. */
export function directionForType(type: string): "credit" | "debit" {
  return type === "WALLET_USAGE" ||
    type === "ADMIN_DEBIT" ||
    type === "REWARD_REVERSAL" ||
    type === "REWARD_EXPIRY"
    ? "debit"
    : "credit";
}

// ── Empty-state copy (kept in one place so wording stays consistent) ──

export const EMPTY_WALLET_MESSAGE = "Your wallet is empty.";
export const EMPTY_REFERRALS_MESSAGE = "You haven't referred anyone yet.";
export const PENDING_REFERRAL_MESSAGE =
  "Waiting for the referred customer's eligible first order.";
export const REFERRAL_REVERSED_MESSAGE = "This referral reward was reversed.";

/** Customer-facing status labels for referral history. */
export function referralStatusLabel(status: ReferralStatus | string): string {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "QUALIFIED":
      return "Qualified";
    case "ON_HOLD":
      return "In review";
    case "REWARDED":
      return "Rewarded";
    case "CANCELLED":
      return "Cancelled";
    case "REVERSED":
      return "Reversed";
    case "BLOCKED":
      return "Not approved";
    default:
      return "Pending";
  }
}

/** The three customer-facing steps of "Refer & Earn". */
export const HOW_IT_WORKS_STEPS: string[] = [
  "Refer a friend",
  "Your friend places their first qualifying order",
  "After the order is delivered, your reward is added to your wallet",
];