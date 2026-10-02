/**
 * Customer Referral + Wallet tests.
 *
 * These cover the rules that decide money: unique referral codes, self-referral
 * rejection, the wallet usage cap, referral reward eligibility and the
 * immutable-ledger presentation helpers. The Convex mutations that persist
 * these decisions are intentionally thin wrappers around this core, so testing
 * here pins the behaviour of the whole feature without a database.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_REFERRAL_SETTINGS,
  EMPTY_REFERRALS_MESSAGE,
  EMPTY_WALLET_MESSAGE,
  PENDING_REFERRAL_MESSAGE,
  REFERRAL_CODE_LENGTH,
  REFERRAL_CODE_PREFIX,
  computeMaxWalletUsage,
  computeSpendableBalance,
  allocateSpend,
  assessReferralRisk,
  canTransition,
  creditsExpiringWithin,
  directionForType,
  eligibleOrderAmount,
  expiredCredits,
  generateReferralCode,
  HIGH_RISK_THRESHOLD,
  isHoldSatisfied,
  isOrderEligibleForReferralReward,
  isSelfReferral,
  isValidReferralCode,
  maskCustomerName,
  normalizeEmail,
  normalizePhone,
  normalizeReferralCode,
  planReversal,
  referralStatusLabel,
  resolveReferralSettings,
  resolveRiskLevel,
  rewardHoldUntil,
  transactionLabel,
  type ExpirableCredit,
} from "@/convex/referralWalletCore";

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

// ── 1. Unique referral code generation ──

describe("referral codes", () => {
  it("generates a code in the KC#### format", () => {
    const code = generateReferralCode("seed-a");
    expect(code.startsWith(REFERRAL_CODE_PREFIX)).toBe(true);
    expect(code).toHaveLength(REFERRAL_CODE_PREFIX.length + REFERRAL_CODE_LENGTH);
    expect(isValidReferralCode(code)).toBe(true);
  });

  it("is deterministic for the same seed", () => {
    expect(generateReferralCode("customer-123")).toBe(generateReferralCode("customer-123"));
  });

  it("produces different codes for different seeds", () => {
    const codes = new Set(
      ["a1", "b2", "c3", "d4", "e5", "f6", "g7", "h8"].map((s) =>
        generateReferralCode(`user-${s}-timestamp`),
      ),
    );
    // Deterministic folding can collide rarely, so require most to differ.
    expect(codes.size).toBeGreaterThanOrEqual(7);
  });

  it("avoids ambiguous characters (0/O/1/I/L)", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateReferralCode(`seed-${i}`);
      expect(code.slice(2)).not.toMatch(/[01OIL]/);
    }
  });
});

// ── 2. Referral code normalisation / validation ──

describe("referral code normalisation", () => {
  it("upper-cases and trims user input", () => {
    expect(normalizeReferralCode("  kc8f4x2p ")).toBe("KC8F4X2P");
  });

  it("accepts a lower-case valid code", () => {
    const code = generateReferralCode("seed-a");
    expect(isValidReferralCode(code.toLowerCase())).toBe(true);
  });

  it("rejects codes with the wrong prefix or length", () => {
    expect(isValidReferralCode("XY8F4X2P")).toBe(false);
    expect(isValidReferralCode("KC8F4X2")).toBe(false);
  });

  it("rejects codes containing ambiguous characters", () => {
    expect(isValidReferralCode("KC0F4X2P")).toBe(false);
    expect(isValidReferralCode("KCI234567")).toBe(false);
  });
});

// ── 3. Settings: no hardcoded values ──

describe("referral settings", () => {
  it("exposes the documented defaults", () => {
    expect(DEFAULT_REFERRAL_SETTINGS).toEqual({
      rewardAmount: 100,
      minQualifyingOrder: 299,
      maxWalletUsagePercent: 20,
      rewardExpiryDays: 0,
      rewardHoldDays: 3,
      maxReferralsPerMonth: 15,
      autoReleaseMediumRisk: false,
    });
  });

  it("returns defaults when nothing is stored", () => {
    expect(resolveReferralSettings(null)).toEqual(DEFAULT_REFERRAL_SETTINGS);
  });

  it("honours admin overrides", () => {
    const resolved = resolveReferralSettings({
      rewardAmount: 250,
      minQualifyingOrder: 499,
      maxWalletUsagePercent: 35,
      rewardExpiryDays: 30,
      rewardHoldDays: 7,
      maxReferralsPerMonth: 40,
      autoReleaseMediumRisk: true,
    });
    expect(resolved).toEqual({
      rewardAmount: 250,
      minQualifyingOrder: 499,
      maxWalletUsagePercent: 35,
      rewardExpiryDays: 30,
      rewardHoldDays: 7,
      maxReferralsPerMonth: 40,
      autoReleaseMediumRisk: true,
    });
  });

  it("falls back to defaults for invalid values", () => {
    const resolved = resolveReferralSettings({
      rewardAmount: -50,
      minQualifyingOrder: Number.NaN,
      maxWalletUsagePercent: 400,
    });
    expect(resolved.rewardAmount).toBe(DEFAULT_REFERRAL_SETTINGS.rewardAmount);
    expect(resolved.minQualifyingOrder).toBe(DEFAULT_REFERRAL_SETTINGS.minQualifyingOrder);
    expect(resolved.maxWalletUsagePercent).toBe(100);
  });

  it("fills in missing settings on rows written before they existed", () => {
    // A row stored before rewardHoldDays existed must still resolve cleanly,
    // which is what keeps existing deployments working.
    const resolved = resolveReferralSettings({
      rewardAmount: 150,
      minQualifyingOrder: 500,
      maxWalletUsagePercent: 10,
      rewardExpiryDays: 0,
    });
    expect(resolved.rewardAmount).toBe(150);
    expect(resolved.rewardHoldDays).toBe(DEFAULT_REFERRAL_SETTINGS.rewardHoldDays);
    expect(resolved.autoReleaseMediumRisk).toBe(false);
  });
});

// ── 4. Self-referral / abuse prevention ──

describe("self-referral detection", () => {
  it("rejects the same user", () => {
    expect(
      isSelfReferral(
        { userId: "u1", phone: "9876543210", email: "a@b.com" },
        { userId: "u1", phone: "9876543210", email: "a@b.com" },
      ),
    ).toBe(true);
  });

  it("rejects the same phone number in a different format", () => {
    expect(
      isSelfReferral(
        { userId: "u1", phone: "+91 98765 43210" },
        { userId: "u2", phone: "9876543210" },
      ),
    ).toBe(true);
  });

  it("rejects the same email regardless of case", () => {
    expect(
      isSelfReferral(
        { userId: "u1", email: "Rahul@Example.com" },
        { userId: "u2", email: "rahul@example.com" },
      ),
    ).toBe(true);
  });

  it("allows genuinely different customers (e.g. family sharing an address)", () => {
    expect(
      isSelfReferral(
        { userId: "u1", phone: "9876543210", email: "a@b.com" },
        { userId: "u2", phone: "9876500000", email: "c@d.com" },
      ),
    ).toBe(false);
  });
});

describe("phone/email normalisation", () => {
  it("keeps only the last ten digits of a phone", () => {
    expect(normalizePhone("+91 (98765) 43210")).toBe("9876543210");
  });

  it("lower-cases and trims an email", () => {
    expect(normalizeEmail("  Rahul@Example.com ")).toBe("rahul@example.com");
  });
});

// ── 5. Wallet usage cap (20% default) ──

describe("computeMaxWalletUsage", () => {
  it("caps at 20% of the payable when that is the smallest", () => {
    expect(computeMaxWalletUsage({ balance: 300, payable: 500, percent: 20 })).toBe(100);
  });

  it("caps at the available balance when lower than the percentage", () => {
    expect(computeMaxWalletUsage({ balance: 60, payable: 500, percent: 20 })).toBe(60);
  });

  it("never exceeds the payable amount", () => {
    expect(computeMaxWalletUsage({ balance: 900, payable: 50, percent: 100 })).toBe(50);
    expect(computeMaxWalletUsage({ balance: 900, payable: 500, percent: 100 })).toBe(500);
  });

  it("returns zero for an empty wallet or zero percent", () => {
    expect(computeMaxWalletUsage({ balance: 0, payable: 500, percent: 20 })).toBe(0);
    expect(computeMaxWalletUsage({ balance: 500, payable: 500, percent: 0 })).toBe(0);
  });

  it("rounds the cap down to whole rupees", () => {
    // 20% of 333 = 66.6 -> 66
    expect(computeMaxWalletUsage({ balance: 500, payable: 333, percent: 20 })).toBe(66);
  });

  it("handles negative inputs safely", () => {
    expect(computeMaxWalletUsage({ balance: -50, payable: 500, percent: 20 })).toBe(0);
    expect(computeMaxWalletUsage({ balance: 500, payable: -5, percent: 20 })).toBe(0);
  });
});

// ── 6. Referral reward eligibility ──

describe("referral reward eligibility", () => {
  it("rewards a delivered order at or above the minimum", () => {
    expect(isOrderEligibleForReferralReward({ totalAmount: 299, status: "delivered" }, 299)).toBe(true);
    expect(isOrderEligibleForReferralReward({ totalAmount: 750, status: "delivered" }, 299)).toBe(true);
  });

  it("does not reward an order below the minimum", () => {
    expect(isOrderEligibleForReferralReward({ totalAmount: 298, status: "delivered" }, 299)).toBe(false);
  });

  it("does not reward a non-delivered order", () => {
    for (const status of ["pending", "confirmed", "processing", "out_for_delivery", "cancelled", "refunded"]) {
      expect(isOrderEligibleForReferralReward({ totalAmount: 999, status }, 299)).toBe(false);
    }
  });

  it("measures the minimum on item value after discounts, ignoring delivery", () => {
    // ₹500 of goods plus ₹60 delivery should not qualify a ₹500 minimum on the
    // strength of the delivery charge.
    expect(
      isOrderEligibleForReferralReward(
        { totalAmount: 560, subtotal: 500, discount: 0, status: "delivered" },
        500,
      ),
    ).toBe(true);
    expect(
      isOrderEligibleForReferralReward(
        { totalAmount: 560, subtotal: 480, discount: 0, status: "delivered" },
        500,
      ),
    ).toBe(false);
  });

  it("counts the discount against the qualifying amount", () => {
    expect(
      isOrderEligibleForReferralReward(
        { totalAmount: 500, subtotal: 800, discount: 320, status: "delivered" },
        500,
      ),
    ).toBe(false);
    expect(
      isOrderEligibleForReferralReward(
        { totalAmount: 800, subtotal: 800, discount: 250, status: "delivered" },
        500,
      ),
    ).toBe(true);
  });

  it("falls back to the grand total when the order has no itemised fields", () => {
    expect(eligibleOrderAmount({ totalAmount: 400, status: "delivered" })).toBe(400);
  });

  it("never returns a negative eligible amount", () => {
    expect(eligibleOrderAmount({ totalAmount: 100, subtotal: 100, discount: 500, status: "delivered" })).toBe(0);
  });
});

// ── 7. Ledger presentation helpers ──

describe("wallet transaction helpers", () => {
  it("labels each transaction type", () => {
    expect(transactionLabel("REFERRAL_REWARD")).toBe("Referral Reward");
    expect(transactionLabel("WALLET_USAGE")).toBe("Used on Order");
    expect(transactionLabel("WALLET_REFUND")).toBe("Refund to Wallet");
    expect(transactionLabel("ADMIN_CREDIT")).toBe("Wallet Credit");
    expect(transactionLabel("ADMIN_DEBIT")).toBe("Wallet Debit");
    expect(transactionLabel("REWARD_REVERSAL")).toBe("Referral Reward Reversed");
  });

  it("maps types to the correct direction", () => {
    expect(directionForType("REFERRAL_REWARD")).toBe("credit");
    expect(directionForType("WALLET_REFUND")).toBe("credit");
    expect(directionForType("ADMIN_CREDIT")).toBe("credit");
    expect(directionForType("WALLET_USAGE")).toBe("debit");
    expect(directionForType("ADMIN_DEBIT")).toBe("debit");
    expect(directionForType("REWARD_REVERSAL")).toBe("debit");
  });
});

// ── 8. Referral history privacy + labels ──

describe("referral history", () => {
  it("shows only the first name of the referred customer", () => {
    expect(maskCustomerName("Rahul Sharma")).toBe("Rahul");
    expect(maskCustomerName("Amit")).toBe("Amit");
  });

  it("never renders an empty name", () => {
    expect(maskCustomerName("")).toBe("A friend");
    expect(maskCustomerName(null)).toBe("A friend");
  });

  it("maps statuses to customer-friendly labels", () => {
    expect(referralStatusLabel("PENDING")).toBe("Pending");
    expect(referralStatusLabel("QUALIFIED")).toBe("Qualified");
    expect(referralStatusLabel("REWARDED")).toBe("Rewarded");
    expect(referralStatusLabel("CANCELLED")).toBe("Cancelled");
    expect(referralStatusLabel("REVERSED")).toBe("Reversed");
  });
});

// ── 9. Empty-state copy ──

describe("empty states", () => {
  it("uses the approved customer-friendly copy", () => {
    expect(EMPTY_WALLET_MESSAGE).toBe("Your wallet is empty.");
    expect(EMPTY_REFERRALS_MESSAGE).toBe("You haven't referred anyone yet.");
    expect(PENDING_REFERRAL_MESSAGE).toBe("Waiting for the referred customer's eligible first order.");
  });
});

// ── 10. Referral risk scoring ──

describe("referral risk scoring", () => {
  it("scores an ordinary referral as LOW", () => {
    const risk = assessReferralRisk({});
    expect(risk.level).toBe("LOW");
    expect(risk.score).toBe(0);
    expect(risk.reasons).toEqual([]);
  });

  it("blocks automatic reward when the referred phone matches the referrer", () => {
    const risk = assessReferralRisk({ samePhone: true });
    expect(risk.score).toBeGreaterThanOrEqual(HIGH_RISK_THRESHOLD);
    expect(risk.level).toBe("HIGH");
  });

  it("treats a shared email as high risk", () => {
    expect(assessReferralRisk({ sameEmail: true }).level).toBe("HIGH");
  });

  it("flags a customer who ordered before joining", () => {
    const risk = assessReferralRisk({ priorOrderBeforeAttribution: true });
    expect(risk.level).toBe("MEDIUM");
  });

  it("flags referral velocity above the configured limit", () => {
    const risk = assessReferralRisk({ referralsInWindow: 15, velocityLimit: 15 });
    expect(risk.level).toBe("MEDIUM");
    expect(risk.reasons.join(" ")).toContain("unusually high");
  });

  it("ignores velocity when no limit is configured", () => {
    expect(assessReferralRisk({ referralsInWindow: 500, velocityLimit: 0 }).level).toBe("LOW");
  });

  it("flags a referrer with repeatedly reversed rewards", () => {
    expect(assessReferralRisk({ reversedRewards: 3 }).level).toBe("HIGH");
  });

  it("flags repeated cancelled or refunded orders", () => {
    expect(assessReferralRisk({ cancelledQualifyingOrders: 4 }).level).toBe("HIGH");
  });

  it("keeps supporting signals below MEDIUM on their own", () => {
    // A shared delivery address is normal in a household and must never, by
    // itself, escalate a referral.
    const risk = assessReferralRisk({ sameDeliveryAddressCount: 4, paymentRetryCount: 9 });
    expect(risk.level).toBe("LOW");
  });

  it("treats pre-risk referrals as LOW rather than crashing", () => {
    expect(resolveRiskLevel(undefined)).toBe("LOW");
    expect(resolveRiskLevel("nonsense")).toBe("LOW");
    expect(resolveRiskLevel("high")).toBe("HIGH");
  });

  it("never uses fraud wording", () => {
    const risk = assessReferralRisk({ samePhone: true, priorOrderBeforeAttribution: true });
    expect(risk.reasons.join(" ").toLowerCase()).not.toContain("fraud");
  });
});

// ── 11. Referral lifecycle ──

describe("referral lifecycle", () => {
  it("allows the normal path through qualification and hold", () => {
    expect(canTransition("PENDING", "QUALIFIED")).toBe(true);
    expect(canTransition("QUALIFIED", "ON_HOLD")).toBe(true);
    expect(canTransition("ON_HOLD", "REWARDED")).toBe(true);
    expect(canTransition("REWARDED", "REVERSED")).toBe(true);
  });

  it("refuses to skip qualification", () => {
    expect(canTransition("PENDING", "REWARDED")).toBe(false);
  });

  it("refuses to revive a blocked referral automatically", () => {
    expect(canTransition("BLOCKED", "REWARDED")).toBe(false);
    expect(canTransition("BLOCKED", "QUALIFIED")).toBe(false);
  });

  it("keeps a reversed referral from being rewarded again", () => {
    expect(canTransition("REVERSED", "REWARDED")).toBe(false);
  });

  it("rejects unknown statuses", () => {
    expect(canTransition("PENDING", "WHATEVER")).toBe(false);
    expect(canTransition("NOT_A_STATUS", "REWARDED")).toBe(false);
  });
});

// ── 12. Reward hold window ──

describe("reward hold", () => {
  it("starts the hold at delivery, not at signup", () => {
    expect(rewardHoldUntil(T0, 3)).toBe(T0 + 3 * DAY);
  });

  it("treats a zero-day hold as immediately satisfied", () => {
    expect(rewardHoldUntil(T0, 0)).toBe(T0);
    expect(isHoldSatisfied(T0, T0)).toBe(true);
  });

  it("is not satisfied before the window elapses", () => {
    expect(isHoldSatisfied(T0 + 3 * DAY, T0 + 2 * DAY)).toBe(false);
  });

  it("is satisfied after the window elapses", () => {
    expect(isHoldSatisfied(T0 + 3 * DAY, T0 + 4 * DAY)).toBe(true);
  });

  it("treats a missing hold as satisfied", () => {
    expect(isHoldSatisfied(undefined, T0)).toBe(true);
  });
});

// ── 13. Expiring credits ──

describe("expirable wallet credits", () => {
  const credits: ExpirableCredit[] = [
    { id: "lot-soon", amount: 100, remaining: 100, expiresAt: T0 + 2 * DAY },
    { id: "lot-later", amount: 200, remaining: 200, expiresAt: T0 + 10 * DAY },
    { id: "lot-forever", amount: 50, remaining: 50, expiresAt: null },
  ];

  it("counts only unexpired value as spendable", () => {
    const expired = computeSpendableBalance(
      [{ id: "a", amount: 100, remaining: 100, expiresAt: T0 - 1 }],
      T0,
    );
    expect(expired).toBe(0);
  });

  it("keeps never-expiring credits spendable forever", () => {
    expect(computeSpendableBalance(credits, T0 + 999 * DAY)).toBe(50);
  });

  it("spends the earliest-expiring credit first", () => {
    const { allocation, allocated } = allocateSpend(credits, 150, T0);
    expect(allocation).toEqual([
      { creditId: "lot-soon", amount: 100 },
      { creditId: "lot-later", amount: 50 },
    ]);
    expect(allocated).toBe(150);
  });

  it("falls through to never-expiring credit last", () => {
    const { allocation } = allocateSpend(credits, 350, T0);
    expect(allocation.map((a) => a.creditId)).toEqual([
      "lot-soon",
      "lot-later",
      "lot-forever",
    ]);
  });

  it("never allocates more than the live balance and reports the shortfall", () => {
    const { allocated, shortfall } = allocateSpend(credits, 500, T0);
    expect(allocated).toBe(350);
    expect(shortfall).toBe(150);
  });

  it("does not spend expired value even when asked", () => {
    const { allocation } = allocateSpend(
      [{ id: "gone", amount: 100, remaining: 100, expiresAt: T0 - 1 }],
      100,
      T0,
    );
    expect(allocation).toEqual([]);
  });

  it("lists credits that have lapsed for sweeping", () => {
    expect(expiredCredits(credits, T0 + 5 * DAY).map((c) => c.id)).toEqual(["lot-soon"]);
  });

  it("lists credits expiring soon for the customer notice", () => {
    expect(creditsExpiringWithin(credits, T0, 7).map((c) => c.id)).toEqual(["lot-soon"]);
  });
});

// ── 14. Truthful reversal accounting ──

describe("reward reversal", () => {
  it("recovers the full amount when the balance is there", () => {
    const plan = planReversal({ rewardAmount: 100, availableBalance: 500 });
    expect(plan).toEqual({
      requested: 100,
      recoveredBefore: 0,
      recovered: 100,
      outstanding: 0,
    });
  });

  it("recovers only what is left and reports the rest as outstanding", () => {
    const plan = planReversal({ rewardAmount: 100, availableBalance: 30 });
    expect(plan.recovered).toBe(30);
    expect(plan.outstanding).toBe(70);
  });

  it("never drives the wallet negative", () => {
    const plan = planReversal({ rewardAmount: 100, availableBalance: 0 });
    expect(plan.recovered).toBe(0);
    expect(plan.outstanding).toBe(100);
  });

  it("does not claw back more than was already recovered", () => {
    const plan = planReversal({ rewardAmount: 100, recoveredBefore: 100, availableBalance: 900 });
    expect(plan.recovered).toBe(0);
    expect(plan.outstanding).toBe(0);
  });

  it("tops up only the remaining amount on a second attempt", () => {
    const first = planReversal({ rewardAmount: 100, availableBalance: 30 });
    const second = planReversal({
      rewardAmount: 100,
      recoveredBefore: first.recovered,
      availableBalance: 80,
    });
    expect(second.recovered).toBe(70);
    expect(second.outstanding).toBe(0);
  });
});

// ── 15. Presentation ──

describe("customer-facing labels", () => {
  it("never exposes risk wording to customers", () => {
    expect(referralStatusLabel("ON_HOLD")).toBe("In review");
    expect(referralStatusLabel("BLOCKED")).toBe("Not approved");
  });

  it("labels a new transaction type", () => {
    expect(transactionLabel("REWARD_EXPIRY")).toBe("Reward Expired");
    expect(transactionLabel("REWARD_RECOVERY")).toBe("Reversal Amount Recovered");
  });

  it("treats expiry as a debit", () => {
    expect(directionForType("REWARD_EXPIRY")).toBe("debit");
    expect(directionForType("REWARD_RECOVERY")).toBe("credit");
  });
});
