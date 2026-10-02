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
  directionForType,
  generateReferralCode,
  isOrderEligibleForReferralReward,
  isSelfReferral,
  isValidReferralCode,
  maskCustomerName,
  normalizeEmail,
  normalizePhone,
  normalizeReferralCode,
  referralStatusLabel,
  resolveReferralSettings,
  transactionLabel,
} from "@/convex/referralWalletCore";

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
    });
    expect(resolved).toEqual({
      rewardAmount: 250,
      minQualifyingOrder: 499,
      maxWalletUsagePercent: 35,
      rewardExpiryDays: 30,
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
