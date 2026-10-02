/**
 * Customer Referral + Wallet backend.
 *
 * Everything that decides money lives here and runs server-side:
 *  • unique referral codes and one-time, immutable attribution
 *  • an immutable wallet ledger with a cached per-customer balance
 *  • referral rewards triggered only by a delivered, first, eligible order
 *  • wallet reservation / settlement / refund around the existing payment flow
 *  • auditable admin credit / debit
 *
 * The module uses the default Convex runtime (no Node APIs), so no "use node"
 * directive is needed. Wallet balance changes are exposed as plain async
 * helpers so the existing order/payment mutations can call them directly and
 * remain part of the same transaction.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  allocateSpend,
  assessReferralRisk,
  canTransition,
  computeMaxWalletUsage,
  computeSpendableBalance,
  creditsExpiringWithin,
  eligibleOrderAmount,
  expiredCredits,
  generateReferralCode,
  isHoldSatisfied,
  isOrderEligibleForReferralReward,
  isSelfReferral,
  isTerminalReferralStatus,
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
  type ReferralRiskLevel,
  type ReferralSettings,
} from "./referralWalletCore";

type WalletTxType =
  | "REFERRAL_REWARD"
  | "WALLET_USAGE"
  | "WALLET_REFUND"
  | "ADMIN_CREDIT"
  | "ADMIN_DEBIT"
  | "REWARD_REVERSAL"
  | "REWARD_RECOVERY"
  | "REWARD_EXPIRY";

/** Abandoned checkout holds are released automatically after this long. */
const WALLET_HOLD_MINUTES = 30;
/** Window used for the referral-velocity signal. */
const REFERRAL_VELOCITY_WINDOW_DAYS = 30;
/** How close to expiry counts as "expiring soon" for the customer notice. */
const EXPIRY_NOTICE_DAYS = 7;

function shortId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ── Authorization ──

async function requireAdmin(ctx: MutationCtx | QueryCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") throw new Error("Unauthorized: admin only");
  return userId;
}

// ── Settings ──

async function loadSettings(ctx: QueryCtx | MutationCtx): Promise<ReferralSettings> {
  const doc = await ctx.db.query("referralSettings").first();
  return resolveReferralSettings(doc ?? null);
}

// ── Notifications ──

/**
 * Reuse the existing notifications table. Referral/wallet copy is written in
 * plain language for customers — no risk scoring or internal wording is ever
 * shown to them.
 */
async function notify(
  ctx: MutationCtx,
  userId: Id<"users">,
  title: string,
  body: string,
  link?: string,
): Promise<void> {
  await ctx.db.insert("notifications", {
    userId,
    type: "system",
    title,
    body,
    read: false,
    link,
    createdAt: Date.now(),
  });
}

// ── Expirable wallet credits ──

/**
 * Every credit lot created for a customer.
 *
 * The ledger's `balance` stays authoritative at all times; lots record *where*
 * that value came from, when it lapses and how much of it is left, which is
 * what makes expiring value spendable-first and fully auditable.
 */
async function loadCredits(
  ctx: MutationCtx | QueryCtx,
  customerId: Id<"users">,
): Promise<Doc<"walletCredits">[]> {
  return await ctx.db
    .query("walletCredits")
    .withIndex("by_customer", (q) => q.eq("customerId", customerId))
    .collect();
}

/** Map stored lots onto the pure allocation shape. */
function toExpirableCredits(rows: Doc<"walletCredits">[]): ExpirableCredit[] {
  return rows.map((row) => ({
    id: String(row._id),
    amount: row.originalAmount,
    remaining: row.remainingAmount,
    expiresAt: row.expiresAt ?? null,
  }));
}

/**
 * Create the credit lot backing a credit transaction, so its value can expire
 * independently later. Idempotent on (sourceType, sourceId): a repeated reward
 * for the same referral adopts the existing lot instead of minting a second
 * one.
 */
async function createCreditLot(
  ctx: MutationCtx,
  opts: {
    customerId: Id<"users">;
    sourceType: "REFERRAL_REWARD" | "ADMIN_CREDIT" | "WALLET_REFUND";
    sourceId: string;
    transactionId: Id<"walletTransactions">;
    amount: number;
    issuedAt: number;
    expiresAt?: number | null;
  },
): Promise<Doc<"walletCredits"> | undefined> {
  const existing = await ctx.db
    .query("walletCredits")
    .withIndex("by_source", (q) =>
      q.eq("sourceType", opts.sourceType).eq("sourceId", opts.sourceId),
    )
    .first();
  if (existing) return existing;

  const id = await ctx.db.insert("walletCredits", {
    customerId: opts.customerId,
    sourceType: opts.sourceType,
    sourceId: opts.sourceId,
    transactionId: opts.transactionId,
    originalAmount: opts.amount,
    remainingAmount: opts.amount,
    issuedAt: opts.issuedAt,
    expiresAt: opts.expiresAt ?? undefined,
    createdAt: opts.issuedAt,
  });
  return (await ctx.db.get(id)) ?? undefined;
}

/**
 * Move expired value out of the balance with an explicit, idempotent
 * `REWARD_EXPIRY` ledger entry, so expired rewards stop being spendable while
 * the original credit and its history remain untouched.
 *
 * Mutation-only: queries use `readWalletBalance` instead.
 */
async function sweepExpiredCredits(
  ctx: MutationCtx,
  customerId: Id<"users">,
  now = Date.now(),
): Promise<number> {
  const rows = await loadCredits(ctx, customerId);
  const lapsed = expiredCredits(toExpirableCredits(rows), now);
  let swept = 0;

  for (const credit of lapsed) {
    const row = rows.find((r) => String(r._id) === credit.id);
    if (!row || row.remainingAmount <= 0) continue;

    // The expiry debit is keyed on the credit id, so running this twice cannot
    // debit the customer twice.
    const tx = await applyWalletTransaction(ctx, {
      customerId,
      type: "REWARD_EXPIRY",
      amount: row.remainingAmount,
      direction: "debit",
      reason: "Reward expired",
      referenceType: "walletCredit",
      referenceId: String(row._id),
      allowPartialDebit: true,
      metadata: JSON.stringify({ originalAmount: row.originalAmount, issuedAt: row.issuedAt }),
    });
    if (tx.duplicate) continue;

    await ctx.db.patch(row._id, { remainingAmount: 0, expiredAt: now });
    swept += tx.amount;
  }

  return swept;
}

/**
 * Read-only wallet view. Reports the cached balance alongside how much of it is
 * actually spendable, so a caller can never be misled into offering expired
 * value at checkout.
 */
async function readWalletBalance(
  ctx: QueryCtx | MutationCtx,
  customerId: Id<"users">,
  now = Date.now(),
): Promise<{ balance: number; spendable: number; expired: number }> {
  const account = await ctx.db
    .query("walletAccounts")
    .withIndex("by_customer", (q) => q.eq("customerId", customerId))
    .first();
  const balance = account?.balance ?? 0;
  const rows = await loadCredits(ctx, customerId);
  const spendable = computeSpendableBalance(toExpirableCredits(rows), now);
  // Never claim more is spendable than the ledger actually holds.
  const capped = Math.max(0, Math.min(balance, spendable));
  return { balance, spendable: capped, expired: Math.max(0, balance - capped) };
}

/** Apply a recorded allocation to the credit lots it consumed. */
async function consumeCredits(
  ctx: MutationCtx,
  customerId: Id<"users">,
  allocation: { creditId: string; amount: number }[],
): Promise<void> {
  if (allocation.length === 0) return;
  const rows = await loadCredits(ctx, customerId);
  for (const slice of allocation) {
    const row = rows.find((r) => String(r._id) === slice.creditId);
    if (!row) continue;
    const remaining = Math.max(0, row.remainingAmount - slice.amount);
    if (remaining !== row.remainingAmount) {
      await ctx.db.patch(row._id, { remainingAmount: remaining });
    }
  }
}

/**
 * Give an allocation back to the credit lots it came from. Used when a reserved
 * hold is released or a wallet-funded order is refunded, so the lots keep
 * telling the truth about how much value each reward still holds.
 */
async function restoreCredits(
  ctx: MutationCtx,
  customerId: Id<"users">,
  allocation: { creditId: string; amount: number }[],
): Promise<void> {
  if (allocation.length === 0) return;
  const rows = await loadCredits(ctx, customerId);
  for (const slice of allocation) {
    const row = rows.find((r) => String(r._id) === slice.creditId);
    if (!row) continue;
    const restored = Math.min(row.originalAmount, row.remainingAmount + slice.amount);
    if (restored !== row.remainingAmount) {
      await ctx.db.patch(row._id, { remainingAmount: restored });
    }
  }
}

/** Read the allocation recorded on a wallet-usage transaction, if any. */
function readAllocation(tx: Doc<"walletTransactions"> | undefined) {
  if (!tx?.metadata) return [] as { creditId: string; amount: number }[];
  try {
    const parsed = JSON.parse(tx.metadata) as {
      allocation?: { creditId?: string; amount?: number }[];
    };
    const rows = parsed?.allocation ?? [];
    return rows
      .filter((row) => typeof row?.creditId === "string" && typeof row?.amount === "number")
      .map((row) => ({ creditId: row.creditId as string, amount: row.amount as number }));
  } catch {
    return [] as { creditId: string; amount: number }[];
  }
}

// ── Wallet account + ledger ──

async function ensureWalletAccount(
  ctx: MutationCtx,
  customerId: Id<"users">,
): Promise<Doc<"walletAccounts">> {
  const existing = await ctx.db
    .query("walletAccounts")
    .withIndex("by_customer", (q) => q.eq("customerId", customerId))
    .first();
  if (existing) return existing;
  const now = Date.now();
  const id = await ctx.db.insert("walletAccounts", {
    customerId,
    balance: 0,
    createdAt: now,
    updatedAt: now,
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Could not create wallet account");
  return created;
}

/** Find an existing transaction of a given type against one reference id. */
async function findTransaction(
  ctx: MutationCtx,
  customerId: Id<"users">,
  type: WalletTxType,
  referenceId: string,
): Promise<Doc<"walletTransactions"> | undefined> {
  const rows = await ctx.db
    .query("walletTransactions")
    .withIndex("by_customer_reference", (q) =>
      q.eq("customerId", customerId).eq("referenceId", referenceId),
    )
    .collect();
  return rows.find((row) => row.type === type);
}

/**
 * Post one wallet transaction and update the cached balance. Idempotent when a
 * `referenceId` is supplied: a second call for the same (customer, type,
 * reference) returns the original transaction instead of double-posting.
 */
export async function applyWalletTransaction(
  ctx: MutationCtx,
  opts: {
    customerId: Id<"users">;
    type: WalletTxType;
    amount: number;
    direction: "credit" | "debit";
    reason: string;
    referenceType?: string;
    referenceId?: string;
    status?: "completed" | "reserved";
    createdBy?: Id<"users">;
    metadata?: string;
    /** Reversals/expiry may be limited to whatever balance remains. */
    allowPartialDebit?: boolean;
    /** Temporary holds expire on their own if payment never completes. */
    holdUntil?: number;
    /** When set on a credit, the value becomes a tracked, expirable lot. */
    credit?: {
      sourceType: "REFERRAL_REWARD" | "ADMIN_CREDIT" | "WALLET_REFUND";
      sourceId: string;
      expiresAt?: number | null;
    };
    /** Reports the created credit lot id back to the caller. */
    onCreditCreated?: (creditId: Id<"walletCredits">) => void;
  },
): Promise<{
  id: Id<"walletTransactions">;
  transactionId: string;
  amount: number;
  balanceAfter: number;
  duplicate: boolean;
}> {
  const amount = Math.floor(opts.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid wallet amount");
  }

  const now = Date.now();

  if (opts.referenceId) {
    const dup = await findTransaction(ctx, opts.customerId, opts.type, opts.referenceId);
    if (dup) {
      // Adopt the existing transaction. Re-running a reward, a refund, an
      // expiry sweep or a release therefore never moves money twice.
      if (opts.credit) {
        await createCreditLot(ctx, {
          customerId: opts.customerId,
          sourceType: opts.credit.sourceType,
          sourceId: opts.credit.sourceId,
          transactionId: dup._id,
          amount: dup.amount,
          issuedAt: dup.createdAt,
          expiresAt: opts.credit.expiresAt ?? null,
        });
      }
      return {
        id: dup._id,
        transactionId: dup.transactionId,
        amount: dup.amount,
        balanceAfter: dup.balanceAfter,
        duplicate: true,
      };
    }
  }

  const account = await ensureWalletAccount(ctx, opts.customerId);

  let debited = amount;
  if (opts.direction === "debit" && account.balance < amount) {
    if (!opts.allowPartialDebit) throw new Error("Insufficient wallet balance");
    debited = Math.max(0, account.balance);
    if (debited <= 0) throw new Error("Insufficient wallet balance");
  }

  const balanceAfter =
    opts.direction === "credit" ? account.balance + debited : account.balance - debited;
  if (balanceAfter < 0) throw new Error("Wallet balance cannot go negative");

  const transactionId = `WT-${now.toString(36).toUpperCase()}-${shortId()}`;
  const id = await ctx.db.insert("walletTransactions", {
    transactionId,
    customerId: opts.customerId,
    type: opts.type,
    amount: debited,
    direction: opts.direction,
    reason: opts.reason,
    referenceType: opts.referenceType,
    referenceId: opts.referenceId,
    status: opts.status ?? "completed",
    balanceAfter,
    metadata: opts.metadata,
    createdBy: opts.createdBy,
    createdAt: now,
    reservedAt: opts.status === "reserved" ? now : undefined,
    holdUntil: opts.holdUntil,
  });
  await ctx.db.patch(account._id, { balance: balanceAfter, updatedAt: now });

  if (opts.credit) {
    const lot = await createCreditLot(ctx, {
      customerId: opts.customerId,
      sourceType: opts.credit.sourceType,
      sourceId: opts.credit.sourceId,
      transactionId: id,
      amount: debited,
      issuedAt: now,
      expiresAt: opts.credit.expiresAt ?? null,
    });
    if (lot) opts.onCreditCreated?.(lot._id);
  }

  return { id, transactionId, amount: debited, balanceAfter, duplicate: false };
}

// ── Wallet reservation around checkout ──

/**
 * Reserve wallet rupees for an order. The requested amount is re-clamped
 * server-side against the configured percentage, the live balance and the
 * payable amount — the browser value is only ever a hint.
 */
export async function reserveWalletForOrder(
  ctx: MutationCtx,
  opts: {
    userId: Id<"users">;
    orderId: Id<"orders">;
    requestedAmount: number;
    payableAmount: number;
    /** COD has no payment-failure window, so the debit is final immediately. */
    settleImmediately?: boolean;
  },
): Promise<{ amount: number; balanceAfter: number }> {
  const settings = await loadSettings(ctx);

  // Lapsed rewards are moved out of the balance first, so a customer can never
  // be quoted (or charged) money that has already expired.
  await sweepExpiredCredits(ctx, opts.userId);

  const account = await ensureWalletAccount(ctx, opts.userId);
  const max = computeMaxWalletUsage({
    balance: account.balance,
    payable: opts.payableAmount,
    percent: settings.maxWalletUsagePercent,
  });
  const amount = Math.max(0, Math.min(Math.floor(opts.requestedAmount || 0), max));
  if (amount <= 0) return { amount: 0, balanceAfter: account.balance };

  // Consume the earliest-expiring value first and record which lots paid for
  // this order, so expiry stays explainable in the ledger.
  const credits = await loadCredits(ctx, opts.userId);
  const { allocation } = allocateSpend(toExpirableCredits(credits), amount, Date.now());

  const tx = await applyWalletTransaction(ctx, {
    customerId: opts.userId,
    type: "WALLET_USAGE",
    amount,
    direction: "debit",
    reason: "Used on Order",
    referenceType: "order",
    referenceId: String(opts.orderId),
    status: opts.settleImmediately ? "completed" : "reserved",
    holdUntil: opts.settleImmediately ? undefined : Date.now() + WALLET_HOLD_MINUTES * 60 * 1000,
    metadata: JSON.stringify({ allocation }),
  });

  // Idempotent: a duplicate reservation returns the original transaction and
  // must not consume the credit lots a second time.
  if (!tx.duplicate) {
    await consumeCredits(ctx, opts.userId, allocation);
    await notify(
      ctx,
      opts.userId,
      "Wallet balance applied",
      `₹${amount} from your wallet is applied to your order. If the payment does not go through, this amount stays safely in your wallet.`,
    );
  }

  return { amount, balanceAfter: tx.balanceAfter };
}

/** Mark a reservation final once the online payment has succeeded. */
export async function settleWalletReservation(
  ctx: MutationCtx,
  orderId: Id<"orders">,
): Promise<void> {
  const order = await ctx.db.get(orderId);
  if (!order) return;
  const tx = await findTransaction(ctx, order.userId, "WALLET_USAGE", String(orderId));
  // Idempotent: an already-settled or already-released hold is left alone, so a
  // repeated payment callback cannot change the money twice.
  if (tx && tx.status === "reserved") {
    await ctx.db.patch(tx._id, { status: "completed", settledAt: Date.now() });
  }
}

/** Restore a reserved amount when a payment fails or expires. */
export async function releaseWalletReservation(
  ctx: MutationCtx,
  orderId: Id<"orders">,
): Promise<void> {
  const order = await ctx.db.get(orderId);
  if (!order) return;
  const tx = await findTransaction(ctx, order.userId, "WALLET_USAGE", String(orderId));
  // Only a live hold can be released. A settled or already-released hold is a
  // no-op, so repeated failure callbacks never credit the wallet twice.
  if (!tx || tx.status !== "reserved") return;

  const account = await ensureWalletAccount(ctx, order.userId);
  const now = Date.now();
  const balanceAfter = account.balance + tx.amount;
  await ctx.db.patch(account._id, { balance: balanceAfter, updatedAt: now });
  await ctx.db.patch(tx._id, { status: "released", releasedAt: now });
  // The value never left the customer in the end, so hand the lots back.
  await restoreCredits(ctx, order.userId, readAllocation(tx));
}

/**
 * Release holds that were never settled because the customer abandoned
 * checkout. Keeps a crashed or closed payment page from holding wallet money
 * indefinitely.
 */
export async function sweepExpiredWalletHolds(
  ctx: MutationCtx,
  now = Date.now(),
): Promise<number> {
  // Bounded scan of the most recent wallet usage rows: abandoned holds are
  // always recent, and this keeps the sweep cheap on a large ledger.
  const holds = await ctx.db
    .query("walletTransactions")
    .withIndex("by_type", (q) => q.eq("type", "WALLET_USAGE"))
    .order("desc")
    .take(200);
  let released = 0;
  for (const tx of holds) {
    if (tx.status !== "reserved") continue;
    if (!tx.holdUntil || tx.holdUntil > now) continue;
    if (!tx.referenceId) continue;
    const order = await ctx.db.get(tx.referenceId as Id<"orders">);
    if (!order || order.userId !== tx.customerId) continue;
    // A paid order must never have its hold swept away.
    if (order.paymentStatus === "paid") continue;
    await releaseWalletReservation(ctx, order._id);
    released += 1;
  }
  return released;
}

/** Re-reserve a released amount so a retried payment keeps the same discount. */
export async function reReserveWallet(
  ctx: MutationCtx,
  orderId: Id<"orders">,
): Promise<number> {
  const order = await ctx.db.get(orderId);
  if (!order) return 0;
  const tx = await findTransaction(ctx, order.userId, "WALLET_USAGE", String(orderId));
  // Still reserved (or already settled) means the retry reuses the same hold,
  // so the customer is never charged twice for one order.
  if (!tx || tx.status !== "released") return tx?.amount ?? 0;

  const account = await ensureWalletAccount(ctx, order.userId);
  if (account.balance < tx.amount) return 0;
  const now = Date.now();
  await ctx.db.patch(account._id, { balance: account.balance - tx.amount, updatedAt: now });
  await ctx.db.patch(tx._id, { status: "reserved", holdUntil: now + WALLET_HOLD_MINUTES * 60 * 1000 });
  return tx.amount;
}

/**
 * Refund the wallet-paid portion of an order. The original WALLET_USAGE is
 * kept and marked reversed; the money returns as a new WALLET_REFUND.
 */
export async function refundWalletForOrder(
  ctx: MutationCtx,
  orderId: Id<"orders">,
): Promise<void> {
  const order = await ctx.db.get(orderId);
  if (!order) return;
  const usage = await findTransaction(ctx, order.userId, "WALLET_USAGE", String(orderId));
  if (!usage) return;
  if (usage.status === "released" || usage.status === "reversed") return;

  const existingRefund = await findTransaction(ctx, order.userId, "WALLET_REFUND", String(orderId));
  if (existingRefund) {
    await ctx.db.patch(usage._id, { status: "reversed" });
    return;
  }

  await applyWalletTransaction(ctx, {
    customerId: order.userId,
    type: "WALLET_REFUND",
    amount: usage.amount,
    direction: "credit",
    reason: "Refund to Wallet",
    referenceType: "order",
    referenceId: String(orderId),
    // A refunded spend does not re-enter the original expiry clock; it comes
    // back as ordinary, non-expiring wallet value.
    credit: {
      sourceType: "WALLET_REFUND",
      sourceId: String(orderId),
      expiresAt: null,
    },
  });
  await ctx.db.patch(usage._id, { status: "reversed" });
  await restoreCredits(ctx, order.userId, readAllocation(usage));
  await notify(
    ctx,
    order.userId,
    "Refund added to your wallet",
    `₹${usage.amount} from your order has been returned to your wallet.`,
  );
}

// ── Referral reward ──

/** True when this is the customer's earliest non-cancelled order. */
async function isFirstEligibleOrder(
  ctx: MutationCtx,
  order: Doc<"orders">,
): Promise<boolean> {
  const orders = await ctx.db
    .query("orders")
    .withIndex("by_user", (q) => q.eq("userId", order.userId))
    .collect();
  const earlier = orders.filter(
    (o) => o._id !== order._id && o.createdAt < order.createdAt && o.status !== "cancelled",
  );
  return earlier.length === 0;
}

/** The customer's earliest order of any kind, for the audit timeline. */
async function firstOrderFor(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"orders"> | undefined> {
  const orders = await ctx.db
    .query("orders")
    .withIndex("by_user_created", (q) => q.eq("userId", userId))
    .order("asc")
    .take(1);
  return orders[0];
}

/**
 * Gather the abuse signals for one referral.
 *
 * Every signal is something the business already stores: verified contact
 * details, order history, referral counts, payment attempts and delivery
 * addresses. IP addresses and device fingerprints are deliberately not
 * collected — they are unreliable and would be intrusive to gather.
 */
async function assessReferralRiskFor(
  ctx: MutationCtx,
  referral: Doc<"referrals">,
  order: Doc<"orders"> | null,
): Promise<{ level: ReferralRiskLevel; score: number; reasons: string[] }> {
  const now = Date.now();
  const [referrer, referred] = await Promise.all([
    ctx.db.get(referral.referrerId),
    ctx.db.get(referral.referredCustomerId),
  ]);
  const settings = await loadSettings(ctx);

  // Every referral this referrer has made, most recent first (bounded so a
  // large referrer cannot make the check expensive).
  const siblings = await ctx.db
    .query("referrals")
    .withIndex("by_referrer", (q) => q.eq("referrerId", referral.referrerId))
    .order("desc")
    .take(25);

  const windowStart = now - REFERRAL_VELOCITY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const referralsInWindow = siblings.filter((row) => row.createdAt >= windowStart).length;
  const reversedRewards = siblings.filter((row) => row.status === "REVERSED").length;

  const referredOrders = await ctx.db
    .query("orders")
    .withIndex("by_user", (q) => q.eq("userId", referral.referredCustomerId))
    .collect();

  const priorOrderBeforeAttribution = referredOrders.some(
    (row) => row.createdAt < referral.createdAt,
  );
  const cancelledQualifyingOrders = referredOrders.filter(
    (row) => row.status === "cancelled" || row.status === "refunded" || row.status === "refund_initiated",
  ).length;
  const paymentRetryCount = referredOrders.filter((row) => row.paymentStatus === "failed").length;

  // Do other customers this referrer brought in share contact details with this
  // one? That pattern (one person, many accounts) is what we look for.
  const phone = normalizePhone(referred?.phone);
  const email = normalizeEmail(referred?.email);
  let duplicateIdentityReferrals = 0;
  for (const sibling of siblings) {
    if (sibling._id === referral._id) continue;
    const other = await ctx.db.get(sibling.referredCustomerId);
    if (!other) continue;
    const otherPhone = normalizePhone(other.phone);
    const otherEmail = normalizeEmail(other.email);
    if (
      (phone.length === 10 && otherPhone === phone) ||
      (email.length > 0 && otherEmail === email)
    ) {
      duplicateIdentityReferrals += 1;
    }
  }

  return assessReferralRisk({
    samePhone:
      !!referrer &&
      phone.length === 10 &&
      normalizePhone(referrer.phone) === phone &&
      referral.referrerId !== referral.referredCustomerId,
    sameEmail:
      !!referrer &&
      email.length > 0 &&
      normalizeEmail(referrer.email) === email &&
      referral.referrerId !== referral.referredCustomerId,
    priorOrderBeforeAttribution,
    duplicateIdentityReferrals,
    repeatedAttributionAttempts: Math.max(0, siblings.length - 1),
    referralsInWindow,
    velocityLimit: settings.maxReferralsPerMonth,
    cancelledQualifyingOrders,
    reversedRewards,
    paymentRetryCount,
    // Delivery-address overlap is only ever a weak hint, and computing it
    // across every referred customer is not worth the query cost, so it is
    // deliberately left at zero rather than guessed.
    sameDeliveryAddressCount: 0,
  });
}

/**
 * Move a referral to a new lifecycle state, refusing any transition the rules
 * do not allow so the audit trail can never be skipped.
 */
async function transitionReferral(
  ctx: MutationCtx,
  referral: Doc<"referrals">,
  status: Doc<"referrals">["status"],
  patch: Record<string, unknown>,
): Promise<void> {
  if (referral.status !== status && !canTransition(referral.status, status)) return;
  await ctx.db.patch(referral._id, { ...patch, status, updatedAt: Date.now() });
}

/**
 * Issue the reward for a referral that has fully qualified.
 *
 * Idempotent three ways: it adopts an already-linked transaction, it adopts an
 * existing `REFERRAL_REWARD` row keyed on the referral id (which is how
 * rewards issued before this upgrade are recognised), and the ledger helper
 * itself de-duplicates on the same reference.
 */
async function issueReferralReward(
  ctx: MutationCtx,
  referral: Doc<"referrals">,
): Promise<void> {
  const now = Date.now();

  if (referral.status === "REWARDED") return;

  const settings = await loadSettings(ctx);
  if (settings.rewardAmount <= 0) return;

  const existingTx = await findTransaction(
    ctx,
    referral.referrerId,
    "REFERRAL_REWARD",
    String(referral._id),
  );
  if (existingTx) {
    await transitionReferral(ctx, referral, "REWARDED", {
      rewardAmount: existingTx.amount,
      rewardTransactionId: existingTx._id,
      rewardedAt: referral.rewardedAt ?? now,
      releasedAt: referral.releasedAt ?? now,
      reversedAmount: referral.reversedAmount ?? 0,
      reversalOutstanding: referral.reversalOutstanding ?? 0,
    });
    return;
  }

  const expiresAt =
    settings.rewardExpiryDays > 0
      ? now + Math.floor(settings.rewardExpiryDays) * 24 * 60 * 60 * 1000
      : undefined;

  let creditId: Id<"walletCredits"> | undefined;
  const tx = await applyWalletTransaction(ctx, {
    customerId: referral.referrerId,
    type: "REFERRAL_REWARD",
    amount: settings.rewardAmount,
    direction: "credit",
    reason: "Referral reward",
    referenceType: "referral",
    referenceId: String(referral._id),
    credit: {
      sourceType: "REFERRAL_REWARD",
      sourceId: String(referral._id),
      expiresAt: expiresAt ?? null,
    },
    onCreditCreated: (id) => {
      creditId = id;
    },
  });
  if (tx.duplicate) return;

  await transitionReferral(ctx, referral, "REWARDED", {
    qualifyingOrderId: referral.qualifyingOrderId,
    rewardAmount: tx.amount,
    rewardTransactionId: tx.id,
    rewardedAt: now,
    releasedAt: now,
    rewardExpiresAt: expiresAt,
    rewardCreditId: creditId,
    reversedAmount: 0,
    reversalOutstanding: 0,
  });

  await notify(
    ctx,
    referral.referrerId,
    "Referral reward added to your wallet",
    `₹${tx.amount} has been credited to your wallet${
      expiresAt
        ? `. It can be used until ${new Date(expiresAt).toLocaleDateString("en-IN")}.`
        : "."
    }`,
    "/account",
  );
}

/**
 * Release every referral whose protection window has elapsed.
 *
 * LOW-risk referrals release automatically. MEDIUM-risk ones release only when
 * the admin has opted in to automatic release, otherwise they wait for a person.
 * HIGH-risk ones never release automatically.
 */
export async function releaseDueRewards(
  ctx: MutationCtx,
  now = Date.now(),
): Promise<number> {
  const held = await ctx.db
    .query("referrals")
    .withIndex("by_status", (q) => q.eq("status", "ON_HOLD"))
    .collect();

  let released = 0;
  for (const referral of held) {
    if (!isHoldSatisfied(referral.holdUntil, now)) continue;
    const risk = resolveRiskLevel(referral.riskLevel);
    if (risk === "HIGH") continue;
    if (risk === "MEDIUM") {
      const settings = await loadSettings(ctx);
      if (!settings.autoReleaseMediumRisk) continue;
    }
    await issueReferralReward(ctx, referral);
    released += 1;
  }
  return released;
}

/**
 * Evaluate a delivered order against the referral rules and move the referral
 * along: qualify it, score it, then either reward it or hold it for review.
 */
async function processReferralReward(
  ctx: MutationCtx,
  order: Doc<"orders">,
): Promise<void> {
  const referral = await ctx.db
    .query("referrals")
    .withIndex("by_referred", (q) => q.eq("referredCustomerId", order.userId))
    .first();
  if (!referral) return;
  if (isTerminalReferralStatus(referral.status)) return;

  const settings = await loadSettings(ctx);

  // Signup, an opened link, an order being placed or a payment succeeding all
  // stop here. Only a delivered order at or above the minimum qualifies, and
  // only the customer's first eligible one.
  if (!isOrderEligibleForReferralReward(order, settings.minQualifyingOrder)) return;
  if (!(await isFirstEligibleOrder(ctx, order))) return;

  const now = Date.now();
  const qualifyingAmount = eligibleOrderAmount(order);
  const firstOrder = await firstOrderFor(ctx, order.userId);

  // PENDING → QUALIFIED: the first qualifying order has been delivered.
  // Writing this unconditionally keeps the record correct when an order is
  // marked delivered twice, while the customer is only told once.
  const alreadyQualified = referral.status === "QUALIFIED" || !!referral.deliveredAt;
  await transitionReferral(ctx, referral, "QUALIFIED", {
    qualifyingOrderId: order._id,
    qualifyingOrderAmount: qualifyingAmount,
    deliveredAt: referral.deliveredAt ?? now,
    firstOrderId: firstOrder?._id ?? referral.firstOrderId,
    firstOrderAmount: firstOrder ? eligibleOrderAmount(firstOrder) : referral.firstOrderAmount,
    firstOrderAt: firstOrder?.createdAt ?? referral.firstOrderAt,
  });
  if (!alreadyQualified) {
    await notify(
      ctx,
      referral.referrerId,
      "Referral qualified",
      "A referral you shared has placed their first qualifying order and it has been delivered. Your reward is being processed.",
      "/account",
    );
  }

  const risk = await assessReferralRiskFor(ctx, referral, order);
  const holdUntil = rewardHoldUntil(now, settings.rewardHoldDays);

  // Everything downstream starts from the qualified, scored record so the
  // lifecycle rules see the real status rather than the pre-transition one.
  const scored = {
    ...referral,
    status: "QUALIFIED" as const,
    riskLevel: risk.level,
    riskScore: risk.score,
    riskReasons: risk.reasons,
    riskCheckedAt: now,
  };

  // HIGH risk never pays out automatically; it waits for an admin decision.
  if (risk.level === "HIGH") {
    await transitionReferral(ctx, scored, "ON_HOLD", {
      qualifyingOrderId: order._id,
      deliveredAt: now,
      heldAt: now,
      holdReason: "Requires review before the reward is released",
      riskLevel: risk.level,
      riskScore: risk.score,
      riskReasons: risk.reasons,
      riskCheckedAt: now,
    });
    return;
  }

  // MEDIUM risk waits for a person unless the admin allows automatic release.
  if (risk.level === "MEDIUM" && !settings.autoReleaseMediumRisk) {
    await transitionReferral(ctx, scored, "ON_HOLD", {
      qualifyingOrderId: order._id,
      deliveredAt: now,
      heldAt: now,
      holdUntil,
      holdReason: "Held for a quick review",
      riskLevel: risk.level,
      riskScore: risk.score,
      riskReasons: risk.reasons,
      riskCheckedAt: now,
    });
    return;
  }

  // A configured post-delivery window protects the store from a next-day
  // cancellation taking the reward straight back.
  if (settings.rewardHoldDays > 0) {
    await transitionReferral(ctx, scored, "ON_HOLD", {
      qualifyingOrderId: order._id,
      deliveredAt: now,
      heldAt: now,
      holdUntil,
      holdReason: "Waiting for the delivery protection period",
      riskLevel: risk.level,
      riskScore: risk.score,
      riskReasons: risk.reasons,
      riskCheckedAt: now,
    });
    return;
  }

  await issueReferralReward(ctx, scored);
}

/**
 * A referral whose qualifying order was cancelled or refunded before any money
 * moved simply stops — it is never rewarded and never left half-processed.
 */
async function cancelUnrewardedReferral(
  ctx: MutationCtx,
  order: Doc<"orders">,
): Promise<void> {
  const referral = await ctx.db
    .query("referrals")
    .withIndex("by_qualifyingOrder", (q) => q.eq("qualifyingOrderId", order._id))
    .first();
  if (!referral) return;
  if (referral.status === "REWARDED" || referral.status === "REVERSED") return;
  if (isTerminalReferralStatus(referral.status)) return;

  await transitionReferral(ctx, referral, "CANCELLED", {
    cancelledAt: Date.now(),
    holdReason: "The qualifying order was cancelled or refunded",
  });
}

/**
 * Take a referral reward back after it was issued.
 *
 * The recovery is deliberately honest: only what is actually in the wallet can
 * be taken, the recovered amount is its own ledger transaction, and whatever
 * could not be recovered is recorded as outstanding on the referral. The
 * original reward transaction is never edited or deleted.
 */
async function reverseReferralReward(
  ctx: MutationCtx,
  order: Doc<"orders">,
): Promise<void> {
  const referral = await ctx.db
    .query("referrals")
    .withIndex("by_qualifyingOrder", (q) => q.eq("qualifyingOrderId", order._id))
    .first();
  if (!referral || referral.status !== "REWARDED") return;

  const now = Date.now();
  const account = await ensureWalletAccount(ctx, referral.referrerId);
  const reward = referral.rewardAmount ?? 0;
  const recoveredBefore = referral.reversedAmount ?? 0;

  const plan = planReversal({
    rewardAmount: reward,
    recoveredBefore,
    availableBalance: account.balance,
  });

  let reversalTxId = referral.reversalTransactionId;
  if (plan.recovered > 0) {
    // Keyed on the amount already recovered, so a follow-up attempt recovers
    // more while a repeated one is a no-op.
    const tx = await applyWalletTransaction(ctx, {
      customerId: referral.referrerId,
      type: "REWARD_REVERSAL",
      amount: plan.recovered,
      direction: "debit",
      reason: "Referral reward reversed",
      referenceType: "referral",
      referenceId: `${referral._id}#${recoveredBefore}`,
      allowPartialDebit: true,
      metadata: JSON.stringify({
        rewardAmount: plan.requested,
        recoveredBefore,
        outstandingAfter: plan.outstanding,
      }),
    });
    if (!tx.duplicate && !reversalTxId) reversalTxId = tx.id;
  }

  await transitionReferral(ctx, referral, "REVERSED", {
    reversalTransactionId: reversalTxId,
    reversedAmount: recoveredBefore + plan.recovered,
    reversalOutstanding: plan.outstanding,
    reversedAt: referral.reversedAt ?? now,
  });

  await notify(
    ctx,
    referral.referrerId,
    "Referral reward reversed",
    plan.outstanding > 0
      ? `₹${plan.recovered} has been taken back from your wallet for a referral reward that no longer qualifies. ₹${plan.outstanding} could not be recovered yet and remains on your record.`
      : `₹${plan.recovered} has been taken back from your wallet for a referral reward that no longer qualifies.`,
    "/account",
  );
}



/**
 * Single entry point called by the order-status flows. Decides whether the
 * new status earns a referral reward or needs a wallet refund / reward
 * reversal. Safe to call repeatedly.
 */
export async function handleOrderStatusChange(
  ctx: MutationCtx,
  orderId: Id<"orders">,
  newStatus: string,
): Promise<void> {
  const order = await ctx.db.get(orderId);
  if (!order) return;

  if (newStatus === "delivered") {
    // Release anything whose protection window has already elapsed, then judge
    // this order. Both steps are idempotent, so a repeated delivery event (or a
    // double click in the admin panel) cannot pay out twice.
    await releaseDueRewards(ctx);
    await sweepExpiredWalletHolds(ctx);
    await processReferralReward(ctx, order);
    return;
  }
  if (newStatus === "cancelled" || newStatus === "refunded" || newStatus === "refund_initiated") {
    if ((order.walletAmountUsed ?? 0) > 0) {
      await refundWalletForOrder(ctx, orderId);
    }
    // A referral that never paid out simply stops; one that did is unwound.
    await cancelUnrewardedReferral(ctx, order);
    await reverseReferralReward(ctx, order);
  }
}

// ── Referral code generation ──

async function ensureReferralCodeFor(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<string> {
  const user = await ctx.db.get(userId);
  if (!user) throw new Error("User not found");
  if (user.referralCode) return user.referralCode;

  for (let attempt = 0; attempt < 12; attempt++) {
    const seed = `${userId}${Date.now()}${attempt}${Math.random()}`;
    const code = generateReferralCode(seed);
    const clash = await ctx.db
      .query("users")
      .withIndex("by_referralCode", (q) => q.eq("referralCode", code))
      .first();
    if (!clash) {
      await ctx.db.patch(userId, { referralCode: code });
      return code;
    }
  }
  throw new Error("Could not generate a unique referral code");
}

// ── Customer queries ──

export const ensureReferralCode = mutation({
  args: {},
  handler: async (ctx): Promise<string> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    return await ensureReferralCodeFor(ctx, userId);
  },
});

/** Read-only snapshot of the settings the checkout needs to preview. */
export const getWalletSettings = query({
  args: {},
  handler: async (ctx) => {
    const settings = await loadSettings(ctx);
    return {
      rewardAmount: settings.rewardAmount,
      minQualifyingOrder: settings.minQualifyingOrder,
      maxWalletUsagePercent: settings.maxWalletUsagePercent,
      rewardExpiryDays: settings.rewardExpiryDays,
    };
  },
});

/**
 * Current customer's wallet balance.
 *
 * Returns the spendable amount rather than the raw cached balance so expired
 * reward value can never be offered at checkout.
 */
export const getWalletBalance = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return 0;
    const { spendable } = await readWalletBalance(ctx, userId);
    return spendable;
  },
});

/**
 * Everything the Wallet & Refer section needs, for the signed-in customer
 * only. A customer can never read another customer's wallet or referrals.
 */
export const getMyReferralDashboard = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const now = Date.now();
    const { balance, spendable, expired } = await readWalletBalance(ctx, userId, now);

    const referrals = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrerId", userId))
      .order("desc")
      .collect();

    const transactions = await ctx.db
      .query("walletTransactions")
      .withIndex("by_customer_created", (q) => q.eq("customerId", userId))
      .order("desc")
      .take(50);

    const credits = await loadCredits(ctx, userId);
    const expiringSoon = creditsExpiringWithin(toExpirableCredits(credits), now, EXPIRY_NOTICE_DAYS);

    const referralHistory = await Promise.all(
      referrals.map(async (referral) => {
        const referred = await ctx.db.get(referral.referredCustomerId);
        const risk = resolveRiskLevel(referral.riskLevel);
        // A referral sitting in its ordinary post-delivery protection window is
        // simply "Pending" to the customer. Only the ones actually awaiting a
        // review are described differently — risk wording is never shown.
        const awaitingReview = referral.status === "ON_HOLD" && risk !== "LOW";
        return {
          id: referral._id,
          name: maskCustomerName(referred?.name),
          status: referral.status,
          statusLabel: referralStatusLabel(
            referral.status === "ON_HOLD" && !awaitingReview ? "QUALIFIED" : referral.status,
          ),
          reward: referral.status === "REWARDED" ? (referral.rewardAmount ?? 0) : 0,
          createdAt: referral.createdAt,
          rewardedAt: referral.rewardedAt,
          rewardExpiresAt: referral.rewardExpiresAt,
        };
      }),
    );

    const successful = referrals.filter((r) => r.status === "REWARDED").length;
    const pending = referrals.filter(
      (r) =>
        r.status === "PENDING" ||
        r.status === "QUALIFIED" ||
        (r.status === "ON_HOLD" && resolveRiskLevel(r.riskLevel) === "LOW"),
    ).length;
    const totalRewards = referrals
      .filter((r) => r.status === "REWARDED")
      .reduce((sum, r) => sum + (r.rewardAmount ?? 0), 0);

    return {
      balance,
      spendable,
      expiredAmount: expired,
      referralCode: user.referralCode ?? null,
      referredBy: user.referredBy ? true : false,
      stats: { successful, pending, totalRewards },
      expiringSoon: expiringSoon.map((credit) => ({
        amount: credit.remaining,
        expiresAt: credit.expiresAt,
      })),
      referrals: referralHistory,
      transactions: transactions.map((tx) => ({
        id: tx._id,
        type: tx.type,
        label: transactionLabel(tx.type),
        amount: tx.amount,
        direction: tx.direction,
        status: tx.status,
        reason: tx.reason,
        createdAt: tx.createdAt,
      })),
    };
  },
});

// ── Referral attribution ──

/**
 * Attribute the current customer to a referrer. Persisted server-side and
 * written exactly once — the first valid attribution is permanent.
 */
export const claimReferral = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { success: false, reason: "unauthenticated" as const };

    const customer = await ctx.db.get(userId);
    if (!customer) return { success: false, reason: "unknown-user" as const };

    // A referral can only ever be attributed once. Once a valid attribution
    // exists it is final: a later claim with another code never replaces it.
    if (customer.referredBy) return { success: true, alreadyAttributed: true };

    const code = normalizeReferralCode(args.code);
    if (!code) return { success: false, reason: "invalid-code" as const };

    const referrer = await ctx.db
      .query("users")
      .withIndex("by_referralCode", (q) => q.eq("referralCode", code))
      .first();
    if (!referrer) return { success: false, reason: "invalid-code" as const };

    // Same account, same verified phone, or same verified email: never a
    // referral.
    if (
      isSelfReferral(
        { userId: String(referrer._id), phone: referrer.phone, email: referrer.email },
        { userId: String(customer._id), phone: customer.phone, email: customer.email },
      )
    ) {
      return { success: false, reason: "self-referral" as const };
    }

    // A second attribution attempt for this customer loses to the first, even
    // if the row and the user flag somehow disagree.
    const existing = await ctx.db
      .query("referrals")
      .withIndex("by_referred", (q) => q.eq("referredCustomerId", userId))
      .first();
    if (existing) {
      await ctx.db.patch(userId, {
        referredBy: existing.referrerId,
        referredByCode: existing.referralCode,
        referredAt: existing.createdAt,
      });
      return { success: true, alreadyAttributed: true };
    }

    // Score the referral straight away using the facts we already have. This
    // does not decide anything by itself — it simply means a referral that is
    // already suspicious is visible to an admin before the first order lands.
    const settings = await loadSettings(ctx);
    const now = Date.now();
    const windowStart = now - REFERRAL_VELOCITY_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const referrerReferrals = await ctx.db
      .query("referrals")
      .withIndex("by_referrer", (q) => q.eq("referrerId", referrer._id))
      .collect();
    const existingOrders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const risk = assessReferralRisk({
      priorOrderBeforeAttribution: existingOrders.length > 0,
      referralsInWindow: referrerReferrals.filter((row) => row.createdAt >= windowStart).length,
      velocityLimit: settings.maxReferralsPerMonth,
      reversedRewards: referrerReferrals.filter((row) => row.status === "REVERSED").length,
    });

    await ctx.db.insert("referrals", {
      referralCode: code,
      referrerId: referrer._id,
      referredCustomerId: userId,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
      riskLevel: risk.level,
      riskScore: risk.score,
      riskReasons: risk.reasons,
      riskCheckedAt: now,
    });
    await ctx.db.patch(userId, {
      referredBy: referrer._id,
      referredByCode: code,
      referredAt: now,
    });

    const firstName = maskCustomerName(customer.name);
    await notify(
      ctx,
      referrer._id,
      "New referral joined",
      `${firstName} joined Kalyan Chemist using your referral code. You will earn your reward once their first qualifying order is delivered.`,
      "/account",
    );
    await notify(
      ctx,
      userId,
      "Welcome — your referral is applied",
      "Your referral has been saved. Your friend earns their reward once you place your first qualifying order and it is delivered.",
      "/account",
    );

    return { success: true, referrerName: maskCustomerName(referrer.name) };
  },
});

// ── Admin: settings ──

export const adminGetSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const settings = await loadSettings(ctx);
    return settings;
  },
});

export const adminUpdateSettings = mutation({
  args: {
    rewardAmount: v.number(),
    minQualifyingOrder: v.number(),
    maxWalletUsagePercent: v.number(),
    rewardExpiryDays: v.number(),
    rewardHoldDays: v.optional(v.number()),
    maxReferralsPerMonth: v.optional(v.number()),
    autoReleaseMediumRisk: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    if (args.rewardAmount < 0) throw new Error("Reward amount cannot be negative");
    if (args.minQualifyingOrder < 0) throw new Error("Minimum order cannot be negative");
    if (args.maxWalletUsagePercent < 0 || args.maxWalletUsagePercent > 100) {
      throw new Error("Wallet usage percentage must be between 0 and 100");
    }
    if (args.rewardExpiryDays < 0) throw new Error("Expiry days cannot be negative");
    if (args.rewardHoldDays !== undefined && args.rewardHoldDays < 0) {
      throw new Error("Reward hold days cannot be negative");
    }
    if (args.maxReferralsPerMonth !== undefined && args.maxReferralsPerMonth < 0) {
      throw new Error("Monthly referral limit cannot be negative");
    }

    const now = Date.now();
    // Keep the resolved settings canonical so a half-saved form can never leave
    // the store in an impossible state.
    const resolved = resolveReferralSettings({
      rewardAmount: args.rewardAmount,
      minQualifyingOrder: args.minQualifyingOrder,
      maxWalletUsagePercent: args.maxWalletUsagePercent,
      rewardExpiryDays: args.rewardExpiryDays,
      rewardHoldDays: args.rewardHoldDays,
      maxReferralsPerMonth: args.maxReferralsPerMonth,
      autoReleaseMediumRisk: args.autoReleaseMediumRisk,
    });

    const existing = await ctx.db.query("referralSettings").first();
    if (existing) {
      await ctx.db.patch(existing._id, { ...resolved, updatedBy: adminId, updatedAt: now });
      return { success: true };
    }
    await ctx.db.insert("referralSettings", { ...resolved, updatedBy: adminId, updatedAt: now });
    return { success: true };
  },
});

// ── Admin: dashboard + management ──

export const adminStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const referrals = await ctx.db.query("referrals").collect();
    const accounts = await ctx.db.query("walletAccounts").collect();
    const settings = await loadSettings(ctx);

    // Money the store is still on the hook for: spendable balance plus wallet
    // value currently held by unsettled checkouts.
    const usageRows = await ctx.db
      .query("walletTransactions")
      .withIndex("by_type", (q) => q.eq("type", "WALLET_USAGE"))
      .collect();
    const reservedTotal = usageRows
      .filter((tx) => tx.status === "reserved")
      .reduce((sum, tx) => sum + tx.amount, 0);
    const walletBalance = accounts.reduce((sum, a) => sum + a.balance, 0);

    const byStatus = {
      pending: referrals.filter((r) => r.status === "PENDING").length,
      qualified: referrals.filter((r) => r.status === "QUALIFIED").length,
      onHold: referrals.filter((r) => r.status === "ON_HOLD").length,
      rewarded: referrals.filter((r) => r.status === "REWARDED").length,
      cancelled: referrals.filter((r) => r.status === "CANCELLED").length,
      reversed: referrals.filter((r) => r.status === "REVERSED").length,
      blocked: referrals.filter((r) => r.status === "BLOCKED").length,
    };

    const rewarded = referrals.filter((r) => r.status === "REWARDED");
    const reversed = referrals.filter((r) => r.status === "REVERSED");

    return {
      totalReferrals: referrals.length,
      byStatus,
      byRisk: {
        low: referrals.filter((r) => resolveRiskLevel(r.riskLevel) === "LOW").length,
        medium: referrals.filter((r) => resolveRiskLevel(r.riskLevel) === "MEDIUM").length,
        high: referrals.filter((r) => resolveRiskLevel(r.riskLevel) === "HIGH").length,
      },
      rewardsGiven: rewarded.reduce((sum, r) => sum + (r.rewardAmount ?? 0), 0),
      reversedAmount: reversed.reduce(
        (sum, r) => sum + (r.reversedAmount ?? 0),
        0,
      ),
      outstandingRecovery: reversed.reduce((sum, r) => sum + (r.reversalOutstanding ?? 0), 0),
      totalWalletBalance: walletBalance,
      reservedWalletAmount: reservedTotal,
      walletLiability: walletBalance + reservedTotal,
      totalWallets: accounts.length,
      settings,
    };
  },
});

export const adminListReferrals = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(v.string()),
    risk: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const referrals = await ctx.db
      .query("referrals")
      .withIndex("by_createdAt")
      .order("desc")
      .take(300);
    const term = (args.search ?? "").trim().toLowerCase();
    const status = (args.status ?? "").trim().toUpperCase();
    const risk = (args.risk ?? "").trim().toUpperCase();

    const rows = await Promise.all(
      referrals.map(async (referral) => {
        const [referrer, referred, order] = await Promise.all([
          ctx.db.get(referral.referrerId),
          ctx.db.get(referral.referredCustomerId),
          referral.qualifyingOrderId ? ctx.db.get(referral.qualifyingOrderId) : undefined,
        ]);
        return {
          id: referral._id,
          referralCode: referral.referralCode,
          status: referral.status,
          statusLabel: referralStatusLabel(referral.status),
          riskLevel: resolveRiskLevel(referral.riskLevel),
          riskReasons: referral.riskReasons ?? [],
          rewardAmount: referral.rewardAmount ?? 0,
          reversedAmount: referral.reversedAmount ?? 0,
          reversalOutstanding: referral.reversalOutstanding ?? 0,
          referrerName: referrer?.name ?? referrer?.email ?? "Unknown",
          referrerPhone: referrer?.phone ?? "",
          referredName: referred?.name ?? referred?.email ?? "Unknown",
          referredPhone: referred?.phone ?? "",
          createdAt: referral.createdAt,
          deliveredAt: referral.deliveredAt,
          rewardedAt: referral.rewardedAt,
          holdUntil: referral.holdUntil,
          holdReason: referral.holdReason,
          rewardExpiresAt: referral.rewardExpiresAt,
          qualifyingOrderId: referral.qualifyingOrderId ?? null,
          orderInvoice: order?.invoiceNumber ?? "",
          orderStatus: order?.status ?? "",
          orderAmount: referral.qualifyingOrderAmount ?? 0,
        };
      }),
    );

    return rows.filter((row) => {
      if (status && row.status !== status) return false;
      if (risk && row.riskLevel !== risk) return false;
      if (args.from !== undefined && row.createdAt < args.from) return false;
      if (args.to !== undefined && row.createdAt > args.to) return false;
      if (!term) return true;
      return [
        row.referrerName,
        row.referrerPhone,
        row.referredName,
        row.referredPhone,
        row.referralCode,
        row.orderInvoice,
      ]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term));
    });
  },
});

/**
 * Everything about one referral, as a plain timeline an admin can read at a
 * glance. Internal signal wording is included here because this view is for
 * staff only.
 */
export const adminReferralDetail = query({
  args: { referralId: v.id("referrals") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const referral = await ctx.db.get(args.referralId);
    if (!referral) return null;

    const [referrer, referred, order] = await Promise.all([
      ctx.db.get(referral.referrerId),
      ctx.db.get(referral.referredCustomerId),
      referral.qualifyingOrderId ? ctx.db.get(referral.qualifyingOrderId) : undefined,
    ]);

    const transactions = await ctx.db
      .query("walletTransactions")
      .withIndex("by_reference", (q) => q.eq("referenceId", String(referral._id)))
      .collect();

    return {
      id: referral._id,
      referralCode: referral.referralCode,
      status: referral.status,
      statusLabel: referralStatusLabel(referral.status),
      riskLevel: resolveRiskLevel(referral.riskLevel),
      riskScore: referral.riskScore ?? 0,
      riskReasons: referral.riskReasons ?? [],
      referrerName: referrer?.name ?? referrer?.email ?? "Unknown",
      referrerPhone: referrer?.phone ?? "",
      referredName: referred?.name ?? referred?.email ?? "Unknown",
      referredPhone: referred?.phone ?? "",
      referredEmail: referred?.email ?? "",
      orderInvoice: order?.invoiceNumber ?? "",
      orderStatus: order?.status ?? "",
      orderAmount: referral.qualifyingOrderAmount ?? 0,
      rewardAmount: referral.rewardAmount ?? 0,
      reversedAmount: referral.reversedAmount ?? 0,
      reversalOutstanding: referral.reversalOutstanding ?? 0,
      reviewNote: referral.reviewNote ?? "",
      holdReason: referral.holdReason ?? "",
      timeline: [
        { step: "Invited", at: referral.createdAt },
        { step: "Joined", at: referral.createdAt },
        { step: "First Order", at: referral.firstOrderAt },
        { step: "Delivered", at: referral.deliveredAt },
        { step: "Risk Check", at: referral.riskCheckedAt },
        { step: referral.status, at: referral.rewardedAt ?? referral.heldAt ?? referral.updatedAt },
      ],
      transactions: transactions.map((tx) => ({
        id: tx._id,
        type: tx.type,
        label: transactionLabel(tx.type),
        amount: tx.amount,
        direction: tx.direction,
        reason: tx.reason,
        createdAt: tx.createdAt,
      })),
    };
  },
});

// ── Admin: referral review actions ──

/** Release a held reward. Idempotent: an already-rewarded referral is a no-op. */
export const adminApproveReferral = mutation({
  args: { referralId: v.id("referrals"), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const referral = await ctx.db.get(args.referralId);
    if (!referral) throw new Error("Referral not found");
    if (referral.status === "REWARDED") return { success: true, alreadyRewarded: true };
    if (referral.status === "BLOCKED" || referral.status === "REVERSED") {
      throw new Error("This referral can no longer be released");
    }
    if (referral.status === "CANCELLED") {
      throw new Error("This referral was cancelled and cannot be released");
    }

    const now = Date.now();
    await ctx.db.patch(referral._id, {
      reviewedBy: adminId,
      reviewedAt: now,
      reviewNote: args.note?.trim() || undefined,
      updatedAt: now,
    });
    // A referral approved before its qualifying order was delivered still must
    // not pay out, so qualification is re-checked rather than assumed.
    if (!referral.qualifyingOrderId || !referral.deliveredAt) {
      throw new Error("This referral has no delivered qualifying order yet");
    }
    await issueReferralReward(ctx, referral);

    await ctx.db.insert("auditLogs", {
      action: "Referral approved",
      category: "wallet",
      item: String(referral._id),
      details: `Released referral ${referral.referralCode}${
        args.note?.trim() ? ` — ${args.note.trim()}` : ""
      }`,
      adminId,
      timestamp: now,
    });
    return { success: true };
  },
});

/** Park a referral for a later look. Idempotent while already on hold. */
export const adminHoldReferral = mutation({
  args: { referralId: v.id("referrals"), reason: v.string() },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const referral = await ctx.db.get(args.referralId);
    if (!referral) throw new Error("Referral not found");
    if (referral.status === "REWARDED") throw new Error("This referral has already been rewarded");
    if (isTerminalReferralStatus(referral.status)) {
      throw new Error("This referral can no longer be held");
    }
    const reason = args.reason.trim();
    if (reason.length < 3) throw new Error("A reason is required");

    const now = Date.now();
    await transitionReferral(ctx, referral, "ON_HOLD", {
      heldAt: now,
      holdReason: reason,
      reviewedBy: adminId,
      reviewedAt: now,
      reviewNote: reason,
      // No release time: an admin hold is released only by a person.
      holdUntil: undefined,
    });
    return { success: true };
  },
});

/** Mark a referral as invalid. The record is kept, never deleted. */
export const adminBlockReferral = mutation({
  args: { referralId: v.id("referrals"), reason: v.string() },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const referral = await ctx.db.get(args.referralId);
    if (!referral) throw new Error("Referral not found");
    const reason = args.reason.trim();
    if (reason.length < 3) throw new Error("A reason is required");
    if (referral.status === "BLOCKED") return { success: true, alreadyBlocked: true };

    const now = Date.now();
    // If a reward was already issued it must still be unwound, so the money
    // path runs first and the status change follows it.
    if (referral.status === "REWARDED") {
      const order = referral.qualifyingOrderId
        ? await ctx.db.get(referral.qualifyingOrderId)
        : undefined;
      if (order) await reverseReferralReward(ctx, order);
    }
    const refreshed = (await ctx.db.get(referral._id)) ?? referral;
    await transitionReferral(ctx, refreshed, "BLOCKED", {
      blockedReason: reason,
      reviewedBy: adminId,
      reviewedAt: now,
      reviewNote: reason,
      holdUntil: undefined,
    });

    await ctx.db.insert("auditLogs", {
      action: "Referral blocked",
      category: "wallet",
      item: String(referral._id),
      details: `Blocked referral ${referral.referralCode} — ${reason}`,
      adminId,
      timestamp: now,
    });
    return { success: true };
  },
});

/**
 * Reverse a reward an admin has judged invalid, independently of any order
 * status change. Uses the same truthful, partial-aware accounting.
 */
export const adminReverseReferral = mutation({
  args: { referralId: v.id("referrals"), reason: v.string() },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const referral = await ctx.db.get(args.referralId);
    if (!referral) throw new Error("Referral not found");
    if (referral.status !== "REWARDED") throw new Error("There is no reward to reverse");
    const reason = args.reason.trim();
    if (reason.length < 3) throw new Error("A reason is required");

    const now = Date.now();
    const account = await ensureWalletAccount(ctx, referral.referrerId);
    const recoveredBefore = referral.reversedAmount ?? 0;
    const plan = planReversal({
      rewardAmount: referral.rewardAmount ?? 0,
      recoveredBefore,
      availableBalance: account.balance,
    });

    let reversalTxId = referral.reversalTransactionId;
    if (plan.recovered > 0) {
      const tx = await applyWalletTransaction(ctx, {
        customerId: referral.referrerId,
        type: "REWARD_REVERSAL",
        amount: plan.recovered,
        direction: "debit",
        reason: `Referral reward reversed — ${reason}`,
        referenceType: "referral",
        referenceId: `${referral._id}#${recoveredBefore}`,
        allowPartialDebit: true,
        createdBy: adminId,
        metadata: JSON.stringify({
          rewardAmount: plan.requested,
          recoveredBefore,
          outstandingAfter: plan.outstanding,
          reason,
        }),
      });
      if (!tx.duplicate && !reversalTxId) reversalTxId = tx.id;
    }

    await transitionReferral(ctx, referral, "REVERSED", {
      reversalTransactionId: reversalTxId,
      reversedAmount: recoveredBefore + plan.recovered,
      reversalOutstanding: plan.outstanding,
      reversedAt: now,
      reviewedBy: adminId,
      reviewedAt: now,
      reviewNote: reason,
    });

    await ctx.db.insert("auditLogs", {
      action: "Referral reward reversed",
      category: "wallet",
      item: String(referral._id),
      details: `Reversed referral ${referral.referralCode}: recovered ₹${plan.recovered}, outstanding ₹${plan.outstanding} — ${reason}`,
      adminId,
      timestamp: now,
    });
    return { success: true, recovered: plan.recovered, outstanding: plan.outstanding };
  },
});

/**
 * Repay an outstanding reversal once the referrer has balance again. Keeps the
 * debt visible and closes it honestly instead of quietly writing it off.
 */
export const adminRecordRecovery = mutation({
  args: { referralId: v.id("referrals"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const referral = await ctx.db.get(args.referralId);
    if (!referral) throw new Error("Referral not found");
    if (referral.status !== "REVERSED") throw new Error("This referral has nothing outstanding");
    const outstanding = referral.reversalOutstanding ?? 0;
    if (outstanding <= 0) return { success: true, alreadySettled: true };

    const now = Date.now();
    let creditId: Id<"walletCredits"> | undefined;
    const tx = await applyWalletTransaction(ctx, {
      customerId: referral.referrerId,
      type: "REWARD_RECOVERY",
      amount: outstanding,
      direction: "credit",
      reason: "Reversal amount recovered",
      referenceType: "referral",
      // Keyed on the outstanding amount so a repeated click cannot re-credit.
      referenceId: `${referral._id}#recovery#${outstanding}`,
      createdBy: adminId,
      credit: { sourceType: "ADMIN_CREDIT", sourceId: `${referral._id}#recovery`, expiresAt: null },
      onCreditCreated: (id) => {
        creditId = id;
      },
    });
    if (tx.duplicate) return { success: true, alreadySettled: true };

    const recovered = referral.reversedAmount ?? 0;
    await ctx.db.patch(referral._id, {
      recoveryTransactionId: tx.id,
      rewardCreditId: referral.rewardCreditId ?? creditId,
      reversedAmount: recovered + outstanding,
      reversalOutstanding: 0,
      reviewedBy: adminId,
      reviewedAt: now,
      reviewNote: args.reason?.trim() || referral.reviewNote,
      updatedAt: now,
    });

    await ctx.db.insert("auditLogs", {
      action: "Reversal recovered",
      category: "wallet",
      item: String(referral._id),
      details: `Recovered ₹${outstanding} of outstanding reversal for referral ${referral.referralCode}`,
      adminId,
      timestamp: now,
    });
    return { success: true, recovered: outstanding };
  },
});

/**
 * Run the background-style sweeps by hand: release rewards whose protection
 * window has passed and give back abandoned checkout holds.
 */
export const adminRunRewardSweep = mutation({
  args: {},
  handler: async (ctx) => {
    const adminId = await requireAdmin(ctx);
    const released = await releaseDueRewards(ctx);
    const holds = await sweepExpiredWalletHolds(ctx);
    await ctx.db.insert("auditLogs", {
      action: "Reward sweep",
      category: "wallet",
      item: "referrals",
      details: `Released ${released} reward(s); released ${holds} abandoned wallet hold(s)`,
      adminId,
      timestamp: Date.now(),
    });
    return { success: true, released, holdsReleased: holds };
  },
});

export const adminSearchWallets = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const term = (args.search ?? "").trim().toLowerCase();

    let users;
    if (term) {
      const all = await ctx.db.query("users").take(500);
      users = all.filter((u) =>
        [u.name, u.email, u.phone]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term)),
      );
    } else {
      users = await ctx.db.query("users").take(100);
    }

    return await Promise.all(
      users.map(async (user) => {
        const { balance, spendable } = await readWalletBalance(ctx, user._id);
        return {
          customerId: user._id,
          name: user.name ?? user.email ?? "Unknown",
          email: user.email ?? "",
          phone: user.phone ?? "",
          balance,
          spendable,
          referralCode: user.referralCode ?? null,
        };
      }),
    );
  },
});

export const adminWalletTransactions = query({
  args: { customerId: v.id("users") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("walletTransactions")
      .withIndex("by_customer_created", (q) => q.eq("customerId", args.customerId))
      .order("desc")
      .take(100);
    const credits = await loadCredits(ctx, args.customerId);
    return {
      transactions: rows.map((tx) => ({
        id: tx._id,
        transactionId: tx.transactionId,
        type: tx.type,
        label: transactionLabel(tx.type),
        amount: tx.amount,
        direction: tx.direction,
        reason: tx.reason,
        status: tx.status,
        balanceAfter: tx.balanceAfter,
        createdBy: tx.createdBy ?? null,
        referenceType: tx.referenceType ?? null,
        referenceId: tx.referenceId ?? null,
        holdUntil: tx.holdUntil ?? null,
        createdAt: tx.createdAt,
      })),
      credits: credits.map((credit) => ({
        id: credit._id,
        sourceType: credit.sourceType,
        originalAmount: credit.originalAmount,
        remainingAmount: credit.remainingAmount,
        issuedAt: credit.issuedAt,
        expiresAt: credit.expiresAt ?? null,
        expiredAt: credit.expiredAt ?? null,
      })),
    };
  },
});

// ── Admin: manual credit / debit ──

async function manualAdjustment(
  ctx: MutationCtx,
  customerId: Id<"users">,
  amount: number,
  reason: string,
  adminId: Id<"users">,
  type: "ADMIN_CREDIT" | "ADMIN_DEBIT",
) {
  const value = Math.floor(amount);
  if (!Number.isFinite(value) || value <= 0) throw new Error("Enter a valid amount");
  const trimmedReason = reason.trim();
  if (trimmedReason.length < 3) throw new Error("A reason is required");

  await ensureWalletAccount(ctx, customerId);
  // Move any lapsed rewards out first, so a manual debit can never quietly take
  // value the customer has already lost.
  await sweepExpiredCredits(ctx, customerId);
  const { spendable } = await readWalletBalance(ctx, customerId);
  if (type === "ADMIN_DEBIT" && value > spendable) {
    throw new Error(`Cannot debit more than the available balance of ₹${spendable}`);
  }
  const now = Date.now();

  const tx = await applyWalletTransaction(ctx, {
    customerId,
    type,
    amount: value,
    direction: type === "ADMIN_CREDIT" ? "credit" : "debit",
    reason: trimmedReason,
    referenceType: "admin",
    // Unique per adjustment, but still fully traceable through createdBy.
    referenceId: `admin-${adminId}-${now}-${shortId()}`,
    createdBy: adminId,
    credit:
      type === "ADMIN_CREDIT"
        ? { sourceType: "ADMIN_CREDIT", sourceId: `admin-${adminId}-${now}`, expiresAt: null }
        : undefined,
  });

  await ctx.db.insert("auditLogs", {
    action: type === "ADMIN_CREDIT" ? "Wallet credit" : "Wallet debit",
    category: "wallet",
    item: String(customerId),
    details: `${type === "ADMIN_CREDIT" ? "Credited" : "Debited"} ₹${value} — ${trimmedReason} (balance ₹${tx.balanceAfter})`,
    adminId,
    timestamp: now,
  });

  return { success: true, balanceAfter: tx.balanceAfter };
}

export const adminCredit = mutation({
  args: {
    customerId: v.id("users"),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    return await manualAdjustment(ctx, args.customerId, args.amount, args.reason, adminId, "ADMIN_CREDIT");
  },
});

export const adminDebit = mutation({
  args: {
    customerId: v.id("users"),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    return await manualAdjustment(ctx, args.customerId, args.amount, args.reason, adminId, "ADMIN_DEBIT");
  },
});


