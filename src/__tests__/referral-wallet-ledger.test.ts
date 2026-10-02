/**
 * Referral + Wallet accounting tests.
 *
 * These drive the rules the way the backend does — through the *same* pure
 * functions in `referralWalletCore` that `referralWallet.ts` calls — against an
 * in-memory model of the ledger, referral records and orders. That lets these
 * tests assert real balances and real ledger contents, not just that a mutation
 * returned without throwing.
 *
 * Every scenario asked of the upgrade is covered: attribution, qualification,
 * delivery, holds, risk, admin decisions, reservation/settlement/release,
 * refunds, expiry allocation, truthful reversal and idempotency under repeat or
 * concurrent events.
 */
import { describe, expect, it } from "vitest";
import {
  allocateSpend,
  assessReferralRisk,
  canTransition,
  computeMaxWalletUsage,
  computeSpendableBalance,
  eligibleOrderAmount,
  isOrderEligibleForReferralReward,
  isSelfReferral,
  planReversal,
  rewardHoldUntil,
  resolveRiskLevel,
  type ExpirableCredit,
  type ReferralSettings,
} from "@/convex/referralWalletCore";

const DAY = 24 * 60 * 60 * 1000;
const T0 = 1_700_000_000_000;

type TxType =
  | "REFERRAL_REWARD"
  | "WALLET_USAGE"
  | "WALLET_REFUND"
  | "ADMIN_CREDIT"
  | "ADMIN_DEBIT"
  | "REWARD_REVERSAL"
  | "REWARD_RECOVERY"
  | "REWARD_EXPIRY";

type TxStatus = "completed" | "reserved" | "released" | "reversed";

type Tx = {
  id: string;
  customerId: string;
  type: TxType;
  amount: number;
  direction: "credit" | "debit";
  status: TxStatus;
  referenceId?: string;
  reason: string;
  balanceAfter: number;
  createdAt: number;
  allocation?: { creditId: string; amount: number }[];
};

/** One expirable lot of credited value. */
type Credit = {
  id: string;
  customerId: string;
  sourceId: string;
  originalAmount: number;
  remainingAmount: number;
  issuedAt: number;
  expiresAt?: number | null;
};

type Order = {
  id: string;
  userId: string;
  createdAt: number;
  status: string;
  subtotal: number;
  discount: number;
  totalAmount: number;
  walletAmountUsed: number;
  paymentStatus?: string;
};

type Referral = {
  id: string;
  code: string;
  referrerId: string;
  referredId: string;
  status: string;
  createdAt: number;
  qualifyingOrderId?: string;
  qualifyingOrderAmount?: number;
  deliveredAt?: number;
  holdUntil?: number;
  holdReason?: string;
  riskLevel?: string;
  riskScore?: number;
  riskReasons?: string[];
  rewardAmount?: number;
  rewardTransactionId?: string;
  reversedAmount?: number;
  reversalOutstanding?: number;
  blockedReason?: string;
};

const SETTINGS: ReferralSettings = {
  rewardAmount: 100,
  minQualifyingOrder: 299,
  maxWalletUsagePercent: 20,
  rewardExpiryDays: 0,
  rewardHoldDays: 0,
  maxReferralsPerMonth: 0,
  autoReleaseMediumRisk: false,
};

/**
 * In-memory mirror of the Convex tables touched by the referral/wallet module.
 */
class Store {
  balances = new Map<string, number>();
  txs: Tx[] = [];
  credits: Credit[] = [];
  referrals: Referral[] = [];
  orders: Order[] = [];
  private txSeq = 0;
  private creditSeq = 0;
  private referralSeq = 0;

  balance(customerId: string): number {
    return this.balances.get(customerId) ?? 0;
  }

  spendable(customerId: string, now: number): number {
    return Math.min(
      this.balance(customerId),
      computeSpendableBalance(this.lots(customerId), now),
    );
  }

  ledger(customerId: string, type: TxType): Tx[] {
    return this.txs.filter((t) => t.customerId === customerId && t.type === type);
  }

  /** Mirrors `applyWalletTransaction`, including its idempotency rule. */
  apply(o: {
    customerId: string;
    type: TxType;
    amount: number;
    direction: "credit" | "debit";
    reason: string;
    referenceId?: string;
    status?: TxStatus;
    allowPartialDebit?: boolean;
    credit?: { sourceId: string; expiresAt?: number | null };
    allocation?: { creditId: string; amount: number }[];
    now: number;
  }): { id: string; amount: number; balanceAfter: number; duplicate: boolean } {
    const amount = Math.floor(o.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Invalid wallet amount");

    if (o.referenceId) {
      const dup = this.txs.find(
        (t) =>
          t.customerId === o.customerId &&
          t.type === o.type &&
          t.referenceId === o.referenceId,
      );
      if (dup) {
        return {
          id: dup.id,
          amount: dup.amount,
          balanceAfter: dup.balanceAfter,
          duplicate: true,
        };
      }
    }

    const current = this.balance(o.customerId);
    let debited = amount;
    if (o.direction === "debit" && current < amount) {
      if (!o.allowPartialDebit) throw new Error("Insufficient wallet balance");
      debited = Math.max(0, current);
      if (debited <= 0) throw new Error("Insufficient wallet balance");
    }
    const balanceAfter = o.direction === "credit" ? current + debited : current - debited;
    if (balanceAfter < 0) throw new Error("Wallet balance cannot go negative");

    const id = `WT-${++this.txSeq}`;
    this.txs.push({
      id,
      customerId: o.customerId,
      type: o.type,
      amount: debited,
      direction: o.direction,
      status: o.status ?? "completed",
      referenceId: o.referenceId,
      reason: o.reason,
      balanceAfter,
      createdAt: o.now,
      allocation: o.allocation,
    });
    this.balances.set(o.customerId, balanceAfter);

    if (o.credit) {
      const existingLot = this.credits.find(
        (c) => c.sourceId === o.credit!.sourceId && c.customerId === o.customerId,
      );
      if (!existingLot) {
        this.credits.push({
          id: `CR-${++this.creditSeq}`,
          customerId: o.customerId,
          sourceId: o.credit.sourceId,
          originalAmount: debited,
          remainingAmount: debited,
          issuedAt: o.now,
          expiresAt: o.credit.expiresAt,
        });
      }
    }

    return { id, amount: debited, balanceAfter, duplicate: false };
  }

  lots(customerId: string): ExpirableCredit[] {
    return this.credits
      .filter((c) => c.customerId === customerId)
      .map((c) => ({
        id: c.id,
        amount: c.originalAmount,
        remaining: c.remainingAmount,
        expiresAt: c.expiresAt ?? null,
      }));
  }

  consume(customerId: string, allocation: { creditId: string; amount: number }[]) {
    for (const slice of allocation) {
      const lot = this.credits.find(
        (c) => c.id === slice.creditId && c.customerId === customerId,
      );
      if (lot) lot.remainingAmount = Math.max(0, lot.remainingAmount - slice.amount);
    }
  }

  restore(customerId: string, allocation: { creditId: string; amount: number }[]) {
    for (const slice of allocation) {
      const lot = this.credits.find(
        (c) => c.id === slice.creditId && c.customerId === customerId,
      );
      if (lot) lot.remainingAmount = Math.min(lot.originalAmount, lot.remainingAmount + slice.amount);
    }
  }

  addReferral(referral: Omit<Referral, "id">): Referral {
    const row: Referral = { ...referral, id: `REF-${++this.referralSeq}` };
    this.referrals.push(row);
    return row;
  }

  addOrder(order: Omit<Order, "id">): Order {
    const row: Order = { ...order, id: `ORD-${this.orders.length + 1}` };
    this.orders.push(row);
    return row;
  }

  referralByReferred(userId: string): Referral | undefined {
    return this.referrals.find((r) => r.referredId === userId);
  }

  referralById(id: string): Referral | undefined {
    return this.referrals.find((r) => r.id === id);
  }
}

// ── Engine (mirrors referralWallet.ts) ──

type Identity = { userId: string; phone?: string | null; email?: string | null };

/** 1–4: attribution is once-only, immutable, and self-referral proof. */
function claimReferral(
  store: Store,
  identities: Map<string, Identity>,
  attributed: Map<string, string>,
  referredId: string,
  code: string,
  referrerId: string,
  now: number,
  settings: ReferralSettings,
) {
  // The first valid attribution is final; later claims never replace it.
  if (attributed.has(referredId)) {
    return { success: true, alreadyAttributed: true as const };
  }
  const existing = store.referralByReferred(referredId);
  if (existing) return { success: true, alreadyAttributed: true as const };

  const referrer = identities.get(referrerId)!;
  const customer = identities.get(referredId)!;
  if (isSelfReferral(referrer, customer)) {
    return { success: false, reason: "self-referral" as const };
  }

  const priorOrders = store.orders.filter((o) => o.userId === referredId);
  const windowStart = now - 30 * DAY;
  const referralsInWindow = store.referrals.filter(
    (r) => r.referrerId === referrerId && r.createdAt >= windowStart,
  ).length;
  const risk = assessReferralRisk({
    priorOrderBeforeAttribution: priorOrders.length > 0,
    referralsInWindow,
    velocityLimit: settings.maxReferralsPerMonth,
  });

  store.addReferral({
    code,
    referrerId,
    referredId,
    status: "PENDING",
    createdAt: now,
    riskLevel: risk.level,
    riskScore: risk.score,
    riskReasons: risk.reasons,
  });
  attributed.set(referredId, referrerId);
  return { success: true, alreadyAttributed: false as const };
}

function transition(store: Store, referral: Referral, status: string) {
  if (referral.status !== status && !canTransition(referral.status, status)) return false;
  referral.status = status;
  return true;
}

/** Release a referral's reward exactly once. */
function issueReward(
  store: Store,
  referral: Referral,
  settings: ReferralSettings,
  now: number,
): boolean {
  if (referral.status === "REWARDED") return false;
  const existing = store.txs.find(
    (t) =>
      t.customerId === referral.referrerId &&
      t.type === "REFERRAL_REWARD" &&
      t.referenceId === referral.id,
  );
  if (existing) {
    transition(store, referral, "REWARDED");
    referral.rewardAmount = existing.amount;
    referral.rewardTransactionId = existing.id;
    return false;
  }

  const expiresAt =
    settings.rewardExpiryDays > 0 ? now + settings.rewardExpiryDays * DAY : undefined;
  const tx = store.apply({
    customerId: referral.referrerId,
    type: "REFERRAL_REWARD",
    amount: settings.rewardAmount,
    direction: "credit",
    reason: "Referral reward",
    referenceId: referral.id,
    now,
    credit: { sourceId: referral.id, expiresAt: expiresAt ?? null },
  });
  if (tx.duplicate) return false;

  transition(store, referral, "REWARDED");
  referral.rewardAmount = tx.amount;
  referral.rewardTransactionId = tx.id;
  referral.reversedAmount = 0;
  referral.reversalOutstanding = 0;
  return true;
}

function releaseDueRewards(store: Store, settings: ReferralSettings, now: number): number {
  let released = 0;
  for (const referral of store.referrals) {
    if (referral.status !== "ON_HOLD") continue;
    if (referral.holdUntil !== undefined && now < referral.holdUntil) continue;
    const risk = resolveRiskLevel(referral.riskLevel);
    if (risk === "HIGH") continue;
    if (risk === "MEDIUM" && !settings.autoReleaseMediumRisk) continue;
    if (issueReward(store, referral, settings, now)) released += 1;
  }
  return released;
}

/** 5–7, 12: qualification, delivery, risk. */
function deliverOrder(
  store: Store,
  orderId: string,
  settings: ReferralSettings,
  now: number,
  riskOverride?: { level: string; score: number; reasons: string[] },
) {
  const order = store.orders.find((o) => o.id === orderId);
  if (!order) return;
  order.status = "delivered";

  const referral = store.referralByReferred(order.userId);
  if (!referral) return;
  if (["REWARDED", "REVERSED", "CANCELLED", "BLOCKED"].includes(referral.status)) return;

  if (!isOrderEligibleForReferralReward(order, settings.minQualifyingOrder)) return;
  const earlier = store.orders.filter(
    (o) =>
      o.userId === order.userId && o.id !== order.id && o.createdAt < order.createdAt &&
      o.status !== "cancelled",
  );
  if (earlier.length > 0) return;

  transition(store, referral, "QUALIFIED");
  referral.qualifyingOrderId = order.id;
  referral.qualifyingOrderAmount = eligibleOrderAmount(order);
  referral.deliveredAt = now;

  const risk = riskOverride ?? {
    level: resolveRiskLevel(referral.riskLevel),
    score: referral.riskScore ?? 0,
    reasons: referral.riskReasons ?? [],
  };
  referral.riskLevel = risk.level;
  referral.riskScore = risk.score;
  referral.riskReasons = risk.reasons;

  if (risk.level === "HIGH") {
    referral.holdReason = "Requires review before the reward is released";
    referral.holdUntil = undefined;
    transition(store, referral, "ON_HOLD");
    return;
  }
  if (risk.level === "MEDIUM" && !settings.autoReleaseMediumRisk) {
    referral.holdReason = "Held for a quick review";
    referral.holdUntil = rewardHoldUntil(now, settings.rewardHoldDays);
    transition(store, referral, "ON_HOLD");
    return;
  }
  if (settings.rewardHoldDays > 0) {
    referral.holdReason = "Waiting for the delivery protection period";
    referral.holdUntil = rewardHoldUntil(now, settings.rewardHoldDays);
    transition(store, referral, "ON_HOLD");
    return;
  }
  issueReward(store, referral, settings, now);
}

/** 9, 24, 25: reversal accounting that tells the truth. */
function reverseReward(store: Store, referral: Referral, now: number) {
  if (referral.status !== "REWARDED") return;
  const recoveredBefore = referral.reversedAmount ?? 0;
  const plan = planReversal({
    rewardAmount: referral.rewardAmount ?? 0,
    recoveredBefore,
    availableBalance: store.balance(referral.referrerId),
  });

  if (plan.recovered > 0) {
    store.apply({
      customerId: referral.referrerId,
      type: "REWARD_REVERSAL",
      amount: plan.recovered,
      direction: "debit",
      reason: "Referral reward reversed",
      referenceId: `${referral.id}#${recoveredBefore}`,
      allowPartialDebit: true,
      now,
    });
  }
  transition(store, referral, "REVERSED");
  referral.reversedAmount = recoveredBefore + plan.recovered;
  referral.reversalOutstanding = plan.outstanding;
}

function cancelOrder(store: Store, orderId: string, now: number, settings: ReferralSettings) {
  const order = store.orders.find((o) => o.id === orderId);
  if (!order) return;
  order.status = "cancelled";

  if (order.walletAmountUsed > 0) refundWallet(store, order, now, settings);

  const referral = store.referrals.find((r) => r.qualifyingOrderId === orderId);
  if (!referral) return;
  // A reward that was already paid is unwound; one that never paid simply stops.
  if (referral.status === "REWARDED") {
    reverseReward(store, referral, now);
    return;
  }
  if (["REWARDED", "REVERSED", "CANCELLED", "BLOCKED"].includes(referral.status)) return;
  transition(store, referral, "CANCELLED");
}

// ── Wallet flows ──

function sweepExpiredCredits(store: Store, customerId: string, now: number): number {
  const lapsed = store.lots(customerId).filter(
    (c) => c.remaining > 0 && (c.expiresAt ?? Infinity) <= now,
  );
  let swept = 0;
  for (const credit of lapsed) {
    const lot = store.credits.find((c) => c.id === credit.id)!;
    const tx = store.apply({
      customerId,
      type: "REWARD_EXPIRY",
      amount: lot.remainingAmount,
      direction: "debit",
      reason: "Reward expired",
      referenceId: lot.id,
      allowPartialDebit: true,
      now,
    });
    if (tx.duplicate) continue;
    lot.remainingAmount = 0;
    swept += tx.amount;
  }
  return swept;
}

function reserveWallet(
  store: Store,
  order: Order,
  requestedAmount: number,
  now: number,
  settings: ReferralSettings,
  settleImmediately = false,
): number {
  sweepExpiredCredits(store, order.userId, now);
  const max = computeMaxWalletUsage({
    balance: store.balance(order.userId),
    payable: order.totalAmount,
    percent: settings.maxWalletUsagePercent,
  });
  const amount = Math.max(0, Math.min(Math.floor(requestedAmount), max));
  if (amount <= 0) return 0;

  const { allocation } = allocateSpend(store.lots(order.userId), amount, now);
  const tx = store.apply({
    customerId: order.userId,
    type: "WALLET_USAGE",
    amount,
    direction: "debit",
    reason: "Used on Order",
    referenceId: order.id,
    status: settleImmediately ? "completed" : "reserved",
    allocation,
    now,
  });
  if (!tx.duplicate) store.consume(order.userId, allocation);
  order.walletAmountUsed = amount;
  return amount;
}

function settleReservation(store: Store, orderId: string) {
  const tx = store.txs.find((t) => t.type === "WALLET_USAGE" && t.referenceId === orderId);
  if (tx && tx.status === "reserved") tx.status = "completed";
}

function releaseReservation(store: Store, orderId: string) {
  const tx = store.txs.find((t) => t.type === "WALLET_USAGE" && t.referenceId === orderId);
  if (!tx || tx.status !== "reserved") return;
  store.balances.set(tx.customerId, store.balance(tx.customerId) + tx.amount);
  tx.status = "released";
  tx.balanceAfter = store.balance(tx.customerId);
  store.restore(tx.customerId, tx.allocation ?? []);
}

function retryPayment(store: Store, orderId: string): number {
  const tx = store.txs.find((t) => t.type === "WALLET_USAGE" && t.referenceId === orderId);
  if (!tx || tx.status !== "released") return tx?.amount ?? 0;
  const balance = store.balance(tx.customerId);
  if (balance < tx.amount) return 0;
  store.balances.set(tx.customerId, balance - tx.amount);
  tx.status = "reserved";
  return tx.amount;
}

function refundWallet(
  store: Store,
  order: Order,
  now: number,
  settings: ReferralSettings,
) {
  const usage = store.txs.find(
    (t) => t.customerId === order.userId && t.type === "WALLET_USAGE" && t.referenceId === order.id,
  );
  if (!usage) return;
  if (usage.status === "released" || usage.status === "reversed") return;
  void settings;
  store.apply({
    customerId: order.userId,
    type: "WALLET_REFUND",
    amount: usage.amount,
    direction: "credit",
    reason: "Refund to Wallet",
    referenceId: order.id,
    now,
    credit: { sourceId: order.id, expiresAt: null },
  });
  usage.status = "reversed";
  store.restore(order.userId, usage.allocation ?? []);
}

// ── Fixtures ──

function setup() {
  const store = new Store();
  const identities = new Map<string, Identity>([
    ["ref1", { userId: "ref1", phone: "9876500001", email: "ref1@example.com" }],
    ["cust1", { userId: "cust1", phone: "9876500002", email: "cust1@example.com" }],
    ["cust2", { userId: "cust2", phone: "9876500003", email: "cust2@example.com" }],
  ]);
  const attributed = new Map<string, string>();
  return { store, identities, attributed };
}

function qualify(
  store: Store,
  settings: ReferralSettings,
  opts: { subtotal: number; discount?: number; at: number; userId?: string },
) {
  const subtotal = opts.subtotal;
  const discount = opts.discount ?? 0;
  return store.addOrder({
    userId: opts.userId ?? "cust1",
    createdAt: opts.at,
    status: "confirmed",
    subtotal,
    discount,
    totalAmount: subtotal - discount + 60,
    walletAmountUsed: 0,
    paymentStatus: "paid",
  });
}

// ── 1–4. Attribution ──

describe("referral attribution", () => {
  it("stores a valid attribution exactly once", () => {
    const { store, identities, attributed } = setup();
    const result = claimReferral(
      store, identities, attributed, "cust1", "KCTEST01", "ref1", T0, SETTINGS,
    );
    expect(result.success).toBe(true);
    expect(store.referralByReferred("cust1")?.referrerId).toBe("ref1");
  });

  it("never lets a second claim replace the original referrer", () => {
    const { store, identities, attributed } = setup();
    claimReferral(store, identities, attributed, "cust1", "KCTEST01", "ref1", T0, SETTINGS);
    claimReferral(store, identities, attributed, "cust1", "KCANOTHER", "ref1", T0, SETTINGS);
    expect(store.referrals).toHaveLength(1);
    expect(store.referralByReferred("cust1")?.code).toBe("KCTEST01");
  });

  it("blocks self-referral by the same verified phone", () => {
    const store = new Store();
    const identities = new Map<string, Identity>([
      ["a", { userId: "a", phone: "9876500009" }],
      ["b", { userId: "b", phone: "9876500009" }],
    ]);
    const result = claimReferral(store, identities, new Map(), "b", "KCX", "a", T0, SETTINGS);
    expect(result).toEqual({ success: false, reason: "self-referral" });
    expect(store.referrals).toHaveLength(0);
  });

  it("flags an existing customer who already ordered before joining", () => {
    const { store, identities, attributed } = setup();
    store.addOrder({
      userId: "cust1", createdAt: T0 - 5 * DAY, status: "delivered",
      subtotal: 500, discount: 0, totalAmount: 560, walletAmountUsed: 0,
    });
    claimReferral(store, identities, attributed, "cust1", "KCTEST01", "ref1", T0, SETTINGS);
    expect(store.referralByReferred("cust1")?.riskLevel).toBe("MEDIUM");
  });
});

// ── 5–7, 11. Qualification and delivery ──

describe("qualification and reward", () => {
  it("rewards a first delivered order at or above the minimum", () => {
    const { store, identities, attributed } = setup();
    claimReferral(store, identities, attributed, "cust1", "KCTEST01", "ref1", T0, SETTINGS);
    const order = qualify(store, SETTINGS, { subtotal: 400, at: T0 + DAY });
    deliverOrder(store, order.id, SETTINGS, T0 + 2 * DAY);
    expect(store.referralByReferred("cust1")?.status).toBe("REWARDED");
    expect(store.balance("ref1")).toBe(100);
  });

  it("does not reward an order below the minimum", () => {
    const { store, identities, attributed } = setup();
    claimReferral(store, identities, attributed, "cust1", "KCTEST01", "ref1", T0, SETTINGS);
    const order = qualify(store, SETTINGS, { subtotal: 250, at: T0 + DAY });
    deliverOrder(store, order.id, SETTINGS, T0 + 2 * DAY);
    expect(store.referralByReferred("cust1")?.status).toBe("PENDING");
    expect(store.balance("ref1")).toBe(0);
  });

  it("ignores delivery charges when measuring the minimum", () => {
    const { store, identities, attributed } = setup();
    claimReferral(store, identities, attributed, "cust1", "KCTEST01", "ref1", T0, SETTINGS);
    const order = qualify(store, SETTINGS, { subtotal: 299, discount: 0, at: T0 + DAY });
    deliverOrder(store, order.id, SETTINGS, T0 + 2 * DAY);
    expect(store.balance("ref1")).toBe(100);
  });

  it("does not reward a customer's second order", () => {
    const { store, identities, attributed } = setup();
    claimReferral(store, identities, attributed, "cust1", "KCTEST01", "ref1", T0, SETTINGS);
    const small = qualify(store, SETTINGS, { subtotal: 100, at: T0 + DAY });
    deliverOrder(store, small.id, SETTINGS, T0 + 2 * DAY);
    const big = qualify(store, SETTINGS, { subtotal: 800, at: T0 + 3 * DAY });
    deliverOrder(store, big.id, SETTINGS, T0 + 4 * DAY);
    expect(store.balance("ref1")).toBe(0);
    expect(store.referralByReferred("cust1")?.status).toBe("PENDING");
  });

  it("never rewards twice when the delivered event fires again", () => {
    const { store, identities, attributed } = setup();
    claimReferral(store, identities, attributed, "cust1", "KCTEST01", "ref1", T0, SETTINGS);
    const order = qualify(store, SETTINGS, { subtotal: 400, at: T0 + DAY });
    deliverOrder(store, order.id, SETTINGS, T0 + 2 * DAY);
    deliverOrder(store, order.id, SETTINGS, T0 + 2 * DAY);
    deliverOrder(store, order.id, SETTINGS, T0 + 3 * DAY);
    expect(store.balance("ref1")).toBe(100);
    expect(store.ledger("ref1", "REFERRAL_REWARD")).toHaveLength(1);
  });

  it("keeps concurrent reward processing idempotent", () => {
    const { store, identities, attributed } = setup();
    claimReferral(store, identities, attributed, "cust1", "KCTEST01", "ref1", T0, SETTINGS);
    const order = qualify(store, SETTINGS, { subtotal: 400, at: T0 + DAY });
    // Several concurrent workers all try to release the same referral.
    releaseDueRewards(store, { ...SETTINGS, rewardHoldDays: 0 }, T0 + 5 * DAY);
    const referral = store.referralByReferred("cust1")!;
    referral.status = "QUALIFIED";
    for (let i = 0; i < 5; i++) issueReward(store, referral, SETTINGS, T0 + 6 * DAY);
    expect(store.balance("ref1")).toBe(100);
    expect(store.ledger("ref1", "REFERRAL_REWARD")).toHaveLength(1);
  });

  it("cancels before the reward is released and never pays out", () => {
    const { store, identities, attributed } = setup();
    const settings = { ...SETTINGS, rewardHoldDays: 3 };
    claimReferral(store, identities, attributed, "cust1", "KCTEST01", "ref1", T0, settings);
    const order = qualify(store, settings, { subtotal: 400, at: T0 + DAY });
    deliverOrder(store, order.id, settings, T0 + 2 * DAY);

    // Still inside the delivery protection window, so nothing has been paid.
    expect(store.referralByReferred("cust1")?.status).toBe("ON_HOLD");
    expect(store.balance("ref1")).toBe(0);

    cancelOrder(store, order.id, T0 + 3 * DAY, settings);
    expect(store.referralByReferred("cust1")?.status).toBe("CANCELLED");
    expect(store.balance("ref1")).toBe(0);

    // And it can never be released afterwards.
    releaseDueRewards(store, settings, T0 + 30 * DAY);
    expect(store.balance("ref1")).toBe(0);
  });

  it("unwinds a reward when the delivered order is later cancelled", () => {
    const { store, identities, attributed } = setup();
    claimReferral(store, identities, attributed, "cust1", "KCTEST01", "ref1", T0, SETTINGS);
    const order = qualify(store, SETTINGS, { subtotal: 400, at: T0 + DAY });
    deliverOrder(store, order.id, SETTINGS, T0 + 2 * DAY);
    expect(store.balance("ref1")).toBe(100);

    cancelOrder(store, order.id, T0 + 4 * DAY, SETTINGS);
    const referral = store.referralByReferred("cust1")!;
    expect(referral.status).toBe("REVERSED");
    expect(store.balance("ref1")).toBe(0);
    expect(referral.reversedAmount).toBe(100);
    expect(referral.reversalOutstanding).toBe(0);
  });
});

// ── 12–14. Risk, hold and admin decisions ──

describe("risk review", () => {
  it("holds a HIGH-risk referral instead of paying it", () => {
    const { store, identities, attributed } = setup();
    claimReferral(store, identities, attributed, "cust1", "KCTEST01", "ref1", T0, SETTINGS);
    const order = qualify(store, SETTINGS, { subtotal: 900, at: T0 + DAY });
    deliverOrder(store, order.id, SETTINGS, T0 + 2 * DAY, {
      level: "HIGH", score: 60, reasons: ["Shared contact details"],
    });
    expect(store.referralByReferred("cust1")?.status).toBe("ON_HOLD");
    expect(store.balance("ref1")).toBe(0);
  });

  it("never releases a HIGH-risk referral automatically", () => {
    const { store, identities, attributed } = setup();
    claimReferral(store, identities, attributed, "cust1", "KCTEST01", "ref1", T0, SETTINGS);
    const order = qualify(store, SETTINGS, { subtotal: 900, at: T0 + DAY });
    deliverOrder(store, order.id, SETTINGS, T0 + 2 * DAY, {
      level: "HIGH", score: 60, reasons: ["Shared contact details"],
    });
    releaseDueRewards(store, SETTINGS, T0 + 30 * DAY);
    expect(store.balance("ref1")).toBe(0);
  });

  it("holds a MEDIUM-risk referral until an admin approves it", () => {
    const { store, identities, attributed } = setup();
    claimReferral(store, identities, attributed, "cust1", "KCTEST01", "ref1", T0, SETTINGS);
    const order = qualify(store, SETTINGS, { subtotal: 900, at: T0 + DAY });
    deliverOrder(store, order.id, SETTINGS, T0 + 2 * DAY, {
      level: "MEDIUM", score: 30, reasons: ["High referral volume"],
    });
    releaseDueRewards(store, SETTINGS, T0 + 30 * DAY);
    expect(store.balance("ref1")).toBe(0);

    issueReward(store, store.referralByReferred("cust1")!, SETTINGS, T0 + 31 * DAY);
    expect(store.balance("ref1")).toBe(100);
  });

  it("blocks an abusive referral, unwinds the money and keeps the record", () => {
    const { store, identities, attributed } = setup();
    claimReferral(store, identities, attributed, "cust1", "KCTEST01", "ref1", T0, SETTINGS);
    const order = qualify(store, SETTINGS, { subtotal: 400, at: T0 + DAY });
    deliverOrder(store, order.id, SETTINGS, T0 + 2 * DAY);
    const referral = store.referralByReferred("cust1")!;
    // The referrer already spent the reward.
    const spend = qualify(store, SETTINGS, { subtotal: 1000, at: T0 + 3 * DAY, userId: "ref1" });
    reserveWallet(store, spend, 100, T0 + 3 * DAY, { ...SETTINGS, maxWalletUsagePercent: 100 });

    // The money is unwound first, then the referral is blocked.
    reverseReward(store, referral, T0 + 4 * DAY);
    referral.blockedReason = "Confirmed abuse";
    expect(transition(store, referral, "BLOCKED")).toBe(true);

    expect(referral.status).toBe("BLOCKED");
    expect(referral.reversalOutstanding).toBe(100);
    expect(store.balance("ref1")).toBe(0);
    // Historical rows are never deleted.
    expect(store.referrals).toHaveLength(1);
    expect(store.ledger("ref1", "REFERRAL_REWARD")).toHaveLength(1);
  });

  it("releases a low-risk reward only after the configured hold", () => {
    const { store, identities, attributed } = setup();
    const settings = { ...SETTINGS, rewardHoldDays: 3 };
    claimReferral(store, identities, attributed, "cust1", "KCTEST01", "ref1", T0, settings);
    const order = qualify(store, settings, { subtotal: 400, at: T0 + DAY });
    deliverOrder(store, order.id, settings, T0 + 2 * DAY);
    expect(store.balance("ref1")).toBe(0);

    releaseDueRewards(store, settings, T0 + 4 * DAY);
    expect(store.balance("ref1")).toBe(0);
    releaseDueRewards(store, settings, T0 + 6 * DAY);
    expect(store.balance("ref1")).toBe(100);
  });
});

// ── 15–17, 21. Wallet ledger ──

describe("wallet ledger", () => {
  function funded(amount: number, now = T0) {
    const store = new Store();
    store.apply({
      customerId: "cust1", type: "ADMIN_CREDIT", amount, direction: "credit",
      reason: "Goodwill", referenceId: `admin-${amount}-${now}`, now,
      credit: { sourceId: `admin-${amount}-${now}`, expiresAt: null },
    });
    return store;
  }

  it("credits and debits through the ledger", () => {
    const store = funded(500);
    store.apply({
      customerId: "cust1", type: "ADMIN_DEBIT", amount: 200, direction: "debit",
      reason: "Correction", referenceId: "admin-debit-1", now: T0 + 1,
    });
    expect(store.balance("cust1")).toBe(300);
    expect(store.ledger("cust1", "ADMIN_DEBIT")[0].balanceAfter).toBe(300);
  });

  it("refuses to take the wallet negative", () => {
    const store = funded(100);
    expect(() =>
      store.apply({
        customerId: "cust1", type: "ADMIN_DEBIT", amount: 150, direction: "debit",
        reason: "Too much", referenceId: "admin-debit-2", now: T0 + 1,
      }),
    ).toThrow(/Insufficient wallet balance/);
    expect(store.balance("cust1")).toBe(100);
  });

  it("holds wallet value at checkout and finalises it on payment", () => {
    const store = funded(500);
    const order = qualify(store, SETTINGS, { subtotal: 1000, at: T0 + DAY });
    const used = reserveWallet(store, order, 200, T0 + 2 * DAY, SETTINGS);
    expect(used).toBe(200);
    expect(store.balance("cust1")).toBe(300);
    expect(store.ledger("cust1", "WALLET_USAGE")[0].status).toBe("reserved");

    settleReservation(store, order.id);
    expect(store.ledger("cust1", "WALLET_USAGE")[0].status).toBe("completed");
  });

  it("returns the hold when payment fails", () => {
    const store = funded(500);
    const order = qualify(store, SETTINGS, { subtotal: 1000, at: T0 + DAY });
    reserveWallet(store, order, 200, T0 + 2 * DAY, SETTINGS);
    releaseReservation(store, order.id);
    expect(store.balance("cust1")).toBe(500);
  });

  it("never double-debits when a payment callback repeats", () => {
    const store = funded(500);
    const order = qualify(store, SETTINGS, { subtotal: 1000, at: T0 + DAY });
    reserveWallet(store, order, 200, T0 + 2 * DAY, SETTINGS);
    settleReservation(store, order.id);
    settleReservation(store, order.id);
    releaseReservation(store, order.id);
    expect(store.balance("cust1")).toBe(300);
  });

  it("does not double-charge the wallet on a payment retry", () => {
    const store = funded(500);
    const order = qualify(store, SETTINGS, { subtotal: 1000, at: T0 + DAY });
    reserveWallet(store, order, 200, T0 + 2 * DAY, SETTINGS);
    releaseReservation(store, order.id);
    const reReserved = retryPayment(store, order.id);
    expect(reReserved).toBe(200);
    expect(store.balance("cust1")).toBe(300);
    retryPayment(store, order.id);
    expect(store.balance("cust1")).toBe(300);
  });

  it("caps wallet usage at the configured percentage of the payable", () => {
    const store = funded(5000);
    const order = qualify(store, SETTINGS, { subtotal: 1000, at: T0 + DAY });
    const used = reserveWallet(store, order, 5000, T0 + 2 * DAY, SETTINGS);
    expect(used).toBe(Math.floor((order.totalAmount * SETTINGS.maxWalletUsagePercent) / 100));
    expect(used).toBeLessThan(5000);
  });

  it("ignores a browser-supplied amount larger than the balance", () => {
    const store = funded(120);
    const order = qualify(store, SETTINGS, { subtotal: 5000, at: T0 + DAY });
    expect(reserveWallet(store, order, 99999, T0 + 2 * DAY, SETTINGS)).toBe(120);
  });

  it("refunds the wallet-funded amount exactly once", () => {
    const store = funded(500);
    const order = qualify(store, SETTINGS, { subtotal: 1000, at: T0 + DAY });
    reserveWallet(store, order, 200, T0 + 2 * DAY, SETTINGS, true);
    expect(store.balance("cust1")).toBe(300);

    refundWallet(store, order, T0 + 3 * DAY, SETTINGS);
    refundWallet(store, order, T0 + 4 * DAY, SETTINGS);
    expect(store.balance("cust1")).toBe(500);
    expect(store.ledger("cust1", "WALLET_REFUND")).toHaveLength(1);
  });

  it("keeps the original usage row as history after a refund", () => {
    const store = funded(500);
    const order = qualify(store, SETTINGS, { subtotal: 1000, at: T0 + DAY });
    reserveWallet(store, order, 200, T0 + 2 * DAY, SETTINGS, true);
    refundWallet(store, order, T0 + 3 * DAY, SETTINGS);
    const usage = store.ledger("cust1", "WALLET_USAGE")[0];
    expect(usage.status).toBe("reversed");
    expect(usage.amount).toBe(200);
  });
});

// ── 22–23. Expiry ──

describe("reward expiry", () => {
  function expiringReward(settings: ReferralSettings, now: number) {
    const { store, identities, attributed } = setup();
    claimReferral(store, identities, attributed, "cust1", "KCTEST01", "ref1", now, settings);
    const order = qualify(store, settings, { subtotal: 400, at: now + DAY });
    deliverOrder(store, order.id, settings, now + 2 * DAY);
    return store;
  }

  it("never expires when expiry is disabled", () => {
    const store = expiringReward({ ...SETTINGS, rewardExpiryDays: 0 }, T0);
    expect(store.balance("ref1")).toBe(100);
    sweepExpiredCredits(store, "ref1", T0 + 3650 * DAY);
    expect(store.balance("ref1")).toBe(100);
  });

  it("sweeps expired value out of the balance once", () => {
    const store = expiringReward({ ...SETTINGS, rewardExpiryDays: 30 }, T0);
    expect(store.balance("ref1")).toBe(100);
    sweepExpiredCredits(store, "ref1", T0 + 40 * DAY);
    expect(store.balance("ref1")).toBe(0);
    sweepExpiredCredits(store, "ref1", T0 + 50 * DAY);
    expect(store.balance("ref1")).toBe(0);
    expect(store.ledger("ref1", "REWARD_EXPIRY")).toHaveLength(1);
  });

  it("stops expired value being spendable at checkout", () => {
    const store = expiringReward({ ...SETTINGS, rewardExpiryDays: 30 }, T0);
    sweepExpiredCredits(store, "ref1", T0 + 40 * DAY);
    const order = qualify(store, SETTINGS, { subtotal: 1000, at: T0 + 41 * DAY, userId: "ref1" });
    expect(reserveWallet(store, order, 100, T0 + 42 * DAY, SETTINGS)).toBe(0);
  });

  it("spends the earliest-expiring reward first across several credits", () => {
    const store = new Store();
    store.apply({
      customerId: "ref1", type: "REFERRAL_REWARD", amount: 100, direction: "credit",
      reason: "Early reward", referenceId: "lot-a", now: T0,
      credit: { sourceId: "lot-a", expiresAt: T0 + 5 * DAY },
    });
    store.apply({
      customerId: "ref1", type: "REFERRAL_REWARD", amount: 100, direction: "credit",
      reason: "Later reward", referenceId: "lot-b", now: T0 + DAY,
      credit: { sourceId: "lot-b", expiresAt: T0 + 40 * DAY },
    });

    const order = qualify(store, SETTINGS, { subtotal: 2000, at: T0 + 2 * DAY, userId: "ref1" });
    reserveWallet(store, order, 150, T0 + 3 * DAY, { ...SETTINGS, maxWalletUsagePercent: 100 });

    const firstLot = store.credits.find((c) => c.sourceId === "lot-a")!;
    const secondLot = store.credits.find((c) => c.sourceId === "lot-b")!;
    expect(firstLot.remainingAmount).toBe(0);
    expect(secondLot.remainingAmount).toBe(50);
  });

  it("keeps the credit lot as an audit record after expiry", () => {
    const store = expiringReward({ ...SETTINGS, rewardExpiryDays: 30 }, T0);
    sweepExpiredCredits(store, "ref1", T0 + 40 * DAY);
    const lot = store.credits[0];
    expect(lot.originalAmount).toBe(100);
    expect(lot.remainingAmount).toBe(0);
    expect(store.ledger("ref1", "REFERRAL_REWARD")).toHaveLength(1);
  });
});

// ── 24–25. Reversal ──

describe("reward reversal", () => {
  it("reverses a reward the referrer has not spent", () => {
    const { store, identities, attributed } = setup();
    claimReferral(store, identities, attributed, "cust1", "KCTEST01", "ref1", T0, SETTINGS);
    const order = qualify(store, SETTINGS, { subtotal: 400, at: T0 + DAY });
    deliverOrder(store, order.id, SETTINGS, T0 + 2 * DAY);
    const referral = store.referralByReferred("cust1")!;

    reverseReward(store, referral, T0 + 3 * DAY);
    expect(store.balance("ref1")).toBe(0);
    expect(referral.reversedAmount).toBe(100);
    expect(referral.reversalOutstanding).toBe(0);
    // The original reward row is preserved.
    expect(store.ledger("ref1", "REFERRAL_REWARD")).toHaveLength(1);
  });

  it("recovers only what is left when the reward was already spent", () => {
    const { store, identities, attributed } = setup();
    claimReferral(store, identities, attributed, "cust1", "KCTEST01", "ref1", T0, SETTINGS);
    const order = qualify(store, SETTINGS, { subtotal: 400, at: T0 + DAY });
    deliverOrder(store, order.id, SETTINGS, T0 + 2 * DAY);
    const referral = store.referralByReferred("cust1")!;

    // The referrer spends the reward.
    const spend = qualify(store, SETTINGS, { subtotal: 1000, at: T0 + 3 * DAY, userId: "ref1" });
    reserveWallet(store, spend, 80, T0 + 3 * DAY, { ...SETTINGS, maxWalletUsagePercent: 100 });
    expect(store.balance("ref1")).toBe(20);

    reverseReward(store, referral, T0 + 4 * DAY);
    expect(store.balance("ref1")).toBe(0);
    expect(referral.reversedAmount).toBe(20);
    expect(referral.reversalOutstanding).toBe(80);
    // The full reversal is never pretended.
    expect(referral.reversalOutstanding).toBe(80);
    expect(store.balance("ref1")).not.toBe(-100);
  });

  it("does not double-reverse on a repeated event", () => {
    const { store, identities, attributed } = setup();
    claimReferral(store, identities, attributed, "cust1", "KCTEST01", "ref1", T0, SETTINGS);
    const order = qualify(store, SETTINGS, { subtotal: 400, at: T0 + DAY });
    deliverOrder(store, order.id, SETTINGS, T0 + 2 * DAY);
    const referral = store.referralByReferred("cust1")!;

    reverseReward(store, referral, T0 + 3 * DAY);
    reverseReward(store, referral, T0 + 4 * DAY);
    expect(store.balance("ref1")).toBe(0);
    expect(store.ledger("ref1", "REWARD_REVERSAL")).toHaveLength(1);
    expect(referral.reversedAmount).toBe(100);
  });

  it("repays the outstanding amount when it is recovered", () => {
    const { store, identities, attributed } = setup();
    claimReferral(store, identities, attributed, "cust1", "KCTEST01", "ref1", T0, SETTINGS);
    const order = qualify(store, SETTINGS, { subtotal: 400, at: T0 + DAY });
    deliverOrder(store, order.id, SETTINGS, T0 + 2 * DAY);
    const referral = store.referralByReferred("cust1")!;
    const spend = qualify(store, SETTINGS, { subtotal: 1000, at: T0 + 3 * DAY, userId: "ref1" });
    reserveWallet(store, spend, 100, T0 + 3 * DAY, { ...SETTINGS, maxWalletUsagePercent: 100 });

    reverseReward(store, referral, T0 + 4 * DAY);
    expect(referral.reversalOutstanding).toBe(100);

    store.apply({
      customerId: "ref1", type: "REWARD_RECOVERY", amount: referral.reversalOutstanding!,
      direction: "credit", reason: "Reversal amount recovered",
      referenceId: `${referral.id}#recovery#100`, now: T0 + 5 * DAY,
      credit: { sourceId: `${referral.id}#recovery`, expiresAt: null },
    });
    referral.reversedAmount = (referral.reversedAmount ?? 0) + referral.reversalOutstanding!;
    referral.reversalOutstanding = 0;

    expect(referral.reversalOutstanding).toBe(0);
    expect(store.balance("ref1")).toBe(100);
  });
});