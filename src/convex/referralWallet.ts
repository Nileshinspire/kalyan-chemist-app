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
  computeMaxWalletUsage,
  generateReferralCode,
  isOrderEligibleForReferralReward,
  isSelfReferral,
  maskCustomerName,
  normalizeReferralCode,
  referralStatusLabel,
  resolveReferralSettings,
  transactionLabel,
  type ReferralSettings,
} from "./referralWalletCore";

type WalletTxType =
  | "REFERRAL_REWARD"
  | "WALLET_USAGE"
  | "WALLET_REFUND"
  | "ADMIN_CREDIT"
  | "ADMIN_DEBIT"
  | "REWARD_REVERSAL";

const TERMINAL_REFERRAL_STATUSES = ["REWARDED", "REVERSED", "CANCELLED"];

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
    /** Reversals may be limited to whatever balance remains. */
    allowPartialDebit?: boolean;
  },
): Promise<{
  id: Id<"walletTransactions">;
  transactionId: string;
  balanceAfter: number;
  duplicate: boolean;
}> {
  const amount = Math.floor(opts.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid wallet amount");
  }

  if (opts.referenceId) {
    const dup = await findTransaction(ctx, opts.customerId, opts.type, opts.referenceId);
    if (dup) {
      return {
        id: dup._id,
        transactionId: dup.transactionId,
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

  const now = Date.now();
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
  });
  await ctx.db.patch(account._id, { balance: balanceAfter, updatedAt: now });

  return { id, transactionId, balanceAfter, duplicate: false };
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
  const account = await ensureWalletAccount(ctx, opts.userId);
  const max = computeMaxWalletUsage({
    balance: account.balance,
    payable: opts.payableAmount,
    percent: settings.maxWalletUsagePercent,
  });
  const amount = Math.max(0, Math.min(Math.floor(opts.requestedAmount || 0), max));
  if (amount <= 0) return { amount: 0, balanceAfter: account.balance };

  const tx = await applyWalletTransaction(ctx, {
    customerId: opts.userId,
    type: "WALLET_USAGE",
    amount,
    direction: "debit",
    reason: "Used on Order",
    referenceType: "order",
    referenceId: String(opts.orderId),
    status: opts.settleImmediately ? "completed" : "reserved",
  });
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
  if (tx && tx.status === "reserved") {
    await ctx.db.patch(tx._id, { status: "completed" });
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
  if (!tx || tx.status !== "reserved") return;

  const account = await ensureWalletAccount(ctx, order.userId);
  const now = Date.now();
  const balanceAfter = account.balance + tx.amount;
  await ctx.db.patch(account._id, { balance: balanceAfter, updatedAt: now });
  await ctx.db.patch(tx._id, { status: "released" });
}

/** Re-reserve a released amount so a retried payment keeps the same discount. */
export async function reReserveWallet(
  ctx: MutationCtx,
  orderId: Id<"orders">,
): Promise<number> {
  const order = await ctx.db.get(orderId);
  if (!order) return 0;
  const tx = await findTransaction(ctx, order.userId, "WALLET_USAGE", String(orderId));
  if (!tx || tx.status !== "released") return tx?.amount ?? 0;

  const account = await ensureWalletAccount(ctx, order.userId);
  if (account.balance < tx.amount) return 0;
  const now = Date.now();
  await ctx.db.patch(account._id, { balance: account.balance - tx.amount, updatedAt: now });
  await ctx.db.patch(tx._id, { status: "reserved" });
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
  });
  await ctx.db.patch(usage._id, { status: "reversed" });
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

async function processReferralReward(
  ctx: MutationCtx,
  order: Doc<"orders">,
): Promise<void> {
  const referral = await ctx.db
    .query("referrals")
    .withIndex("by_referred", (q) => q.eq("referredCustomerId", order.userId))
    .first();
  if (!referral) return;
  if (TERMINAL_REFERRAL_STATUSES.includes(referral.status)) return;

  const settings = await loadSettings(ctx);
  if (!isOrderEligibleForReferralReward(order, settings.minQualifyingOrder)) return;
  if (!(await isFirstEligibleOrder(ctx, order))) return;

  const now = Date.now();
  const existing = await findTransaction(
    ctx,
    referral.referrerId,
    "REFERRAL_REWARD",
    String(referral._id),
  );
  if (existing) {
    await ctx.db.patch(referral._id, {
      status: "REWARDED",
      qualifyingOrderId: order._id,
      rewardAmount: existing.amount,
      rewardTransactionId: existing._id,
      rewardedAt: referral.rewardedAt ?? now,
      updatedAt: now,
    });
    return;
  }

  const tx = await applyWalletTransaction(ctx, {
    customerId: referral.referrerId,
    type: "REFERRAL_REWARD",
    amount: settings.rewardAmount,
    direction: "credit",
    reason: "Referral reward",
    referenceType: "referral",
    referenceId: String(referral._id),
  });

  await ctx.db.patch(referral._id, {
    status: "REWARDED",
    qualifyingOrderId: order._id,
    rewardAmount: settings.rewardAmount,
    rewardTransactionId: tx.id,
    rewardedAt: now,
    updatedAt: now,
  });
}

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
  const existing = await findTransaction(
    ctx,
    referral.referrerId,
    "REWARD_REVERSAL",
    String(referral._id),
  );
  if (existing) {
    await ctx.db.patch(referral._id, {
      status: "REVERSED",
      reversalTransactionId: existing._id,
      reversedAt: referral.reversedAt ?? now,
      updatedAt: now,
    });
    return;
  }

  const tx = await applyWalletTransaction(ctx, {
    customerId: referral.referrerId,
    type: "REWARD_REVERSAL",
    amount: referral.rewardAmount ?? 0,
    direction: "debit",
    reason: "Referral reward reversed",
    referenceType: "referral",
    referenceId: String(referral._id),
    allowPartialDebit: true,
  });
  await ctx.db.patch(referral._id, {
    status: "REVERSED",
    reversalTransactionId: tx.id,
    reversedAt: now,
    updatedAt: now,
  });
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
    await processReferralReward(ctx, order);
    return;
  }
  if (newStatus === "cancelled" || newStatus === "refunded" || newStatus === "refund_initiated") {
    if ((order.walletAmountUsed ?? 0) > 0) {
      await refundWalletForOrder(ctx, orderId);
    }
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

/** Current customer's wallet balance. */
export const getWalletBalance = query({
  args: {},
  handler: async (ctx): Promise<number> => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return 0;
    const account = await ctx.db
      .query("walletAccounts")
      .withIndex("by_customer", (q) => q.eq("customerId", userId))
      .first();
    return account?.balance ?? 0;
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

    const account = await ctx.db
      .query("walletAccounts")
      .withIndex("by_customer", (q) => q.eq("customerId", userId))
      .first();

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

    const referralHistory = await Promise.all(
      referrals.map(async (referral) => {
        const referred = await ctx.db.get(referral.referredCustomerId);
        return {
          id: referral._id,
          name: maskCustomerName(referred?.name),
          status: referral.status,
          statusLabel: referralStatusLabel(referral.status),
          reward: referral.status === "REWARDED" ? (referral.rewardAmount ?? 0) : 0,
          createdAt: referral.createdAt,
        };
      }),
    );

    const successful = referrals.filter((r) => r.status === "REWARDED").length;
    const pending = referrals.filter(
      (r) => r.status === "PENDING" || r.status === "QUALIFIED",
    ).length;
    const totalRewards = referrals
      .filter((r) => r.status === "REWARDED")
      .reduce((sum, r) => sum + (r.rewardAmount ?? 0), 0);

    return {
      balance: account?.balance ?? 0,
      referralCode: user.referralCode ?? null,
      referredBy: user.referredBy ? true : false,
      stats: { successful, pending, totalRewards },
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

    // A referral can only ever be attributed once.
    if (customer.referredBy) return { success: true, alreadyAttributed: true };

    const code = normalizeReferralCode(args.code);
    if (!code) return { success: false, reason: "invalid-code" as const };

    const referrer = await ctx.db
      .query("users")
      .withIndex("by_referralCode", (q) => q.eq("referralCode", code))
      .first();
    if (!referrer) return { success: false, reason: "invalid-code" as const };

    if (
      isSelfReferral(
        { userId: String(referrer._id), phone: referrer.phone, email: referrer.email },
        { userId: String(customer._id), phone: customer.phone, email: customer.email },
      )
    ) {
      return { success: false, reason: "self-referral" as const };
    }

    const existing = await ctx.db
      .query("referrals")
      .withIndex("by_referred", (q) => q.eq("referredCustomerId", userId))
      .first();
    if (existing) return { success: true, alreadyAttributed: true };

    const now = Date.now();
    await ctx.db.insert("referrals", {
      referralCode: code,
      referrerId: referrer._id,
      referredCustomerId: userId,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(userId, {
      referredBy: referrer._id,
      referredByCode: code,
      referredAt: now,
    });

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
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    if (args.rewardAmount < 0) throw new Error("Reward amount cannot be negative");
    if (args.minQualifyingOrder < 0) throw new Error("Minimum order cannot be negative");
    if (args.maxWalletUsagePercent < 0 || args.maxWalletUsagePercent > 100) {
      throw new Error("Wallet usage percentage must be between 0 and 100");
    }
    if (args.rewardExpiryDays < 0) throw new Error("Expiry days cannot be negative");

    const now = Date.now();
    const existing = await ctx.db.query("referralSettings").first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        rewardAmount: args.rewardAmount,
        minQualifyingOrder: args.minQualifyingOrder,
        maxWalletUsagePercent: args.maxWalletUsagePercent,
        rewardExpiryDays: args.rewardExpiryDays,
        updatedBy: adminId,
        updatedAt: now,
      });
      return { success: true };
    }
    await ctx.db.insert("referralSettings", {
      rewardAmount: args.rewardAmount,
      minQualifyingOrder: args.minQualifyingOrder,
      maxWalletUsagePercent: args.maxWalletUsagePercent,
      rewardExpiryDays: args.rewardExpiryDays,
      updatedBy: adminId,
      updatedAt: now,
    });
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

    const byStatus = {
      pending: referrals.filter((r) => r.status === "PENDING").length,
      qualified: referrals.filter((r) => r.status === "QUALIFIED").length,
      rewarded: referrals.filter((r) => r.status === "REWARDED").length,
      cancelled: referrals.filter((r) => r.status === "CANCELLED").length,
      reversed: referrals.filter((r) => r.status === "REVERSED").length,
    };

    return {
      totalReferrals: referrals.length,
      byStatus,
      totalWalletBalance: accounts.reduce((sum, a) => sum + a.balance, 0),
      totalWallets: accounts.length,
      settings,
    };
  },
});

export const adminListReferrals = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const referrals = await ctx.db
      .query("referrals")
      .withIndex("by_createdAt")
      .order("desc")
      .take(200);
    const term = (args.search ?? "").trim().toLowerCase();

    const rows = await Promise.all(
      referrals.map(async (referral) => {
        const referrer = await ctx.db.get(referral.referrerId);
        const referred = await ctx.db.get(referral.referredCustomerId);
        return {
          id: referral._id,
          referralCode: referral.referralCode,
          status: referral.status,
          rewardAmount: referral.rewardAmount ?? 0,
          referrerName: referrer?.name ?? referrer?.email ?? "Unknown",
          referrerPhone: referrer?.phone ?? "",
          referredName: referred?.name ?? referred?.email ?? "Unknown",
          referredPhone: referred?.phone ?? "",
          createdAt: referral.createdAt,
          rewardedAt: referral.rewardedAt,
        };
      }),
    );

    if (!term) return rows;
    return rows.filter((row) =>
      [row.referrerName, row.referrerPhone, row.referredName, row.referredPhone, row.referralCode]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term)),
    );
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
        const account = await ctx.db
          .query("walletAccounts")
          .withIndex("by_customer", (q) => q.eq("customerId", user._id))
          .first();
        return {
          customerId: user._id,
          name: user.name ?? user.email ?? "Unknown",
          email: user.email ?? "",
          phone: user.phone ?? "",
          balance: account?.balance ?? 0,
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
    return rows.map((tx) => ({
      id: tx._id,
      transactionId: tx.transactionId,
      type: tx.type,
      label: transactionLabel(tx.type),
      amount: tx.amount,
      direction: tx.direction,
      reason: tx.reason,
      status: tx.status,
      balanceAfter: tx.balanceAfter,
      createdAt: tx.createdAt,
    }));
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
  const now = Date.now();

  const tx = await applyWalletTransaction(ctx, {
    customerId,
    type,
    amount: value,
    direction: type === "ADMIN_CREDIT" ? "credit" : "debit",
    reason: trimmedReason,
    referenceType: "admin",
    referenceId: `admin-${now}-${shortId()}`,
    createdBy: adminId,
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


