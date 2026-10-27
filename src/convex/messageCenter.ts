/**
 * Admin Message Center + customer-facing campaign messaging.
 *
 * All administrative operations are authorised server-side (role === "admin"),
 * never by UI visibility. Every save/schedule/send/cancel is validated here;
 * the dispatch worker in messageDispatch.ts re-checks campaign state and claims
 * work atomically so a retry can never duplicate a notification or a send.
 */
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  buildCampaignEmailHtml,
  BODY_MAX,
  BODY_MIN,
  TITLE_MAX,
  TITLE_MIN,
  categoryLabel,
  channelEligibility,
  evaluateAbTest,
  isAdminRole,
  isRegisteredCustomer,
  maskEmail,
  maskPhone,
  normalizePhone,
  plainTextEmail,
  retryEligibility,
  validateCampaignInput,
  type CampaignAudienceInput,
  type CampaignChannelSelection,
  type MessageCategory,
} from "./messageCenterCore";
import { recordAudit } from "./campaignAudit";

/** Customers registered within this window count as "new". */
const NEW_CUSTOMER_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// ── Shared validators ───────────────────────────────────────────────
const categoryArg = v.union(
  v.literal("festival"),
  v.literal("announcement"),
  v.literal("health"),
  v.literal("offer")
);

const audienceArg = v.object({
  type: v.union(
    v.literal("all"),
    v.literal("with_orders"),
    v.literal("no_orders"),
    v.literal("new_users"),
    v.literal("existing_users"),
    v.literal("category_buyers"),
    v.literal("selected")
  ),
  categoryId: v.optional(v.id("categories")),
  userIds: v.optional(v.array(v.id("users"))),
});

const channelsArg = v.object({
  inApp: v.boolean(),
  popup: v.boolean(),
  whatsapp: v.boolean(),
  email: v.boolean(),
});

// ── Authorization ───────────────────────────────────────────────────
export async function requireAdmin(ctx: any): Promise<any> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user || !isAdminRole(user.role)) {
    throw new Error("Unauthorized: admin only");
  }
  return userId;
}

/** Admin identity for actions that must audit who performed them. */
export const adminIdentity = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAdmin(ctx);
    const user: any = await ctx.db.get(userId);
    return { userId, name: user?.name ?? "Administrator" };
  },
});

/** Used by node actions (e.g. provider verification) to re-check admin. */
export const adminGuard = internalQuery({
  args: {},
  handler: async (ctx) => {
    try {
      await requireAdmin(ctx);
      return true;
    } catch {
      return false;
    }
  },
});

// ── Provider configuration (presence only — never the secret values) ─
function providerConfig() {
  const resendKey = Boolean(process.env.RESEND_API_KEY);
  // Without a Resend account, email goes through the project's own integration
  // gateway (VLY_INTEGRATION_KEY — the key that already sends sign-in codes).
  const gatewayEmail = Boolean(process.env.VLY_INTEGRATION_KEY);
  const whatsappCredentials = Boolean(
    process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID
  );
  const whatsappTemplate = Boolean(process.env.WHATSAPP_CAMPAIGN_TEMPLATE_NAME);
  return {
    email: resendKey || gatewayEmail,
    emailViaResend: resendKey,
    emailViaGateway: !resendKey && gatewayEmail,
    whatsappCredentials,
    whatsappTemplate,
    whatsapp: whatsappCredentials && whatsappTemplate,
    from: process.env.RESEND_FROM_EMAIL || "Kalyan Chemist <notifications@kalyanchemist.com>",
    templateName: process.env.WHATSAPP_CAMPAIGN_TEMPLATE_NAME || null,
    templateLanguage: process.env.WHATSAPP_CAMPAIGN_TEMPLATE_LANG || "en",
  };
}

/** Names of the settings that are missing, phrased for an admin. */
function missingProviderConfig(channels: CampaignChannelSelection): string[] {
  const config = providerConfig();
  const missing: string[] = [];
  if (channels.email && !config.email) {
    missing.push(
      "Email: add RESEND_API_KEY with a verified sending domain, or VLY_INTEGRATION_KEY to use the built-in email gateway."
    );
  }
  if (channels.whatsapp && !config.whatsappCredentials) {
    missing.push(
      "WhatsApp: add WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID from the WhatsApp Business Platform."
    );
  }
  if (channels.whatsapp && !config.whatsappTemplate) {
    missing.push(
      "WhatsApp: add WHATSAPP_CAMPAIGN_TEMPLATE_NAME for the Meta-approved campaign template."
    );
  }
  return missing;
}

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function prefsFor(ctx: any, userId: any) {
  return await ctx.db
    .query("communication_prefs")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
}

// ── Audience resolution (preview / counts; dispatch streams instead) ─
function audienceMatcher(
  audience: CampaignAudienceInput,
  orderUserIds: Set<string>,
  categoryUserIds: Set<string>,
  creationTimes: Map<string, number>,
  now: number
) {
  const selected = new Set((audience.userIds ?? []).map(String));
  return (userId: string): boolean => {
    switch (audience.type) {
      case "all":
        return true;
      case "with_orders":
        return orderUserIds.has(userId);
      case "no_orders":
        return !orderUserIds.has(userId);
      case "new_users": {
        const createdAt = creationTimes.get(userId);
        return createdAt !== undefined && now - createdAt <= NEW_CUSTOMER_WINDOW_MS;
      }
      case "existing_users": {
        const createdAt = creationTimes.get(userId);
        return createdAt !== undefined && now - createdAt > NEW_CUSTOMER_WINDOW_MS;
      }
      case "category_buyers":
        return categoryUserIds.has(userId);
      case "selected":
        return selected.has(userId);
      default:
        return false;
    }
  };
}

export async function resolveAudience(ctx: any, audience: CampaignAudienceInput) {
  const users = (await ctx.db.query("users").collect()).filter((u: any) =>
    isRegisteredCustomer(u)
  );
  const orders = await ctx.db.query("orders").collect();
  const orderUserIds = new Set<string>(orders.map((o: any) => String(o.userId)));
  const creationTimes = new Map<string, number>(
    users.map((u: any) => [String(u._id), Number(u._creationTime ?? 0)])
  );

  const categoryUserIds = new Set<string>();
  if (audience.type === "category_buyers" && audience.categoryId) {
    const products = await ctx.db.query("products").collect();
    const inCategory = new Set(
      products
        .filter((p: any) => String(p.categoryId) === String(audience.categoryId))
        .map((p: any) => String(p._id))
    );
    for (const order of orders) {
      if (order.items?.some((item: any) => inCategory.has(String(item.productId)))) {
        categoryUserIds.add(String(order.userId));
      }
    }
  }

  const matches = audienceMatcher(
    audience,
    orderUserIds,
    categoryUserIds,
    creationTimes,
    Date.now()
  );
  return {
    matched: users.filter((u: any) => matches(String(u._id))),
    orderUserIds,
    categoryUserIds,
  };
}

// ══════════════════════════════════════════════════════════════════
//  ADMIN — SETUP / AUDIENCE / PREVIEW
// ══════════════════════════════════════════════════════════════════

/** Channel readiness. Presence-based — it does not claim provider delivery. */
export const integrationStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const config = providerConfig();
    return {
      website: { configured: true },
      popup: { configured: true },
      email: {
        configured: config.email,
        credential: config.emailViaResend ? "RESEND_API_KEY" : "VLY_INTEGRATION_KEY",
        viaResend: config.emailViaResend,
        viaGateway: config.emailViaGateway,
        from: config.emailViaResend ? config.from : "Managed by the email gateway",
        note: config.emailViaResend
          ? "Sending through your Resend account. Delivery still requires a verified sending domain in Resend."
          : config.emailViaGateway
            ? "Sending through the built-in email gateway — no further setup required."
            : "Setup required: add RESEND_API_KEY (verified sending domain), or VLY_INTEGRATION_KEY for the built-in email gateway.",
      },
      whatsapp: {
        configured: config.whatsapp,
        credentialsPresent: config.whatsappCredentials,
        templateConfigured: config.whatsappTemplate,
        templateName: config.templateName,
        templateLanguage: config.templateLanguage,
        note: config.whatsapp
          ? `Credentials and template name are present. The approved template must accept two body parameters: {{1}} = message title, {{2}} = message body. It must be approved in Meta Business Manager before messages are accepted.`
          : "Setup required: WhatsApp Business Platform credentials and an approved campaign template (two body parameters) are needed.",
      },
      checkedAt: Date.now(),
    };
  },
});

/** Counts for the audience picker. Counts only — no contact details. */
export const audienceCounts = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const { matched } = await resolveAudience(ctx, { type: "all" });
    const orders = await ctx.db.query("orders").collect();
    const withOrders = new Set<string>(orders.map((o: any) => String(o.userId)));

    const products = await ctx.db.query("products").collect();
    const productCategory = new Map<string, string>(
      products.map((p: any) => [String(p._id), String(p.categoryId)])
    );
    const buyerSets = new Map<string, Set<string>>();
    for (const order of orders) {
      for (const item of order.items ?? []) {
        const categoryId = productCategory.get(String(item.productId));
        if (!categoryId) continue;
        if (!buyerSets.has(categoryId)) buyerSets.set(categoryId, new Set());
        buyerSets.get(categoryId)!.add(String(order.userId));
      }
    }

    const categories = await ctx.db.query("categories").collect();
    const now = Date.now();
    return {
      all: matched.length,
      withOrders: matched.filter((u: any) => withOrders.has(String(u._id))).length,
      noOrders: matched.filter((u: any) => !withOrders.has(String(u._id))).length,
      newUsers: matched.filter(
        (u: any) => now - Number(u._creationTime ?? 0) <= NEW_CUSTOMER_WINDOW_MS
      ).length,
      existingUsers: matched.filter(
        (u: any) => now - Number(u._creationTime ?? 0) > NEW_CUSTOMER_WINDOW_MS
      ).length,
      categories: categories
        .map((c: any) => ({
          _id: c._id,
          name: c.name,
          buyers: Array.from(buyerSets.get(String(c._id)) ?? []).filter((id) =>
            matched.some((u: any) => String(u._id) === id)
          ).length,
        }))
        .filter((c: any) => c.buyers > 0)
        .sort((a: any, b: any) => b.buyers - a.buyers),
    };
  },
});

/** Searchable customer picker for the "selected customers" audience (masked). */
export const customerOptions = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const term = (args.search ?? "").trim().toLowerCase();
    const orders = await ctx.db.query("orders").collect();
    const withOrders = new Set<string>(orders.map((o: any) => String(o.userId)));

    const users = (await ctx.db.query("users").collect())
      .filter((u: any) => isRegisteredCustomer(u))
      .filter((u: any) => {
        if (!term) return true;
        return (
          String(u.name ?? "").toLowerCase().includes(term) ||
          String(u.email ?? "").toLowerCase().includes(term) ||
          String(u.phone ?? "").includes(term)
        );
      })
      .sort((a: any, b: any) => String(a.name ?? "").localeCompare(String(b.name ?? "")))
      .slice(0, 200);

    return users.map((u: any) => ({
      userId: u._id,
      name: u.name || "Customer",
      maskedEmail: maskEmail(u.email),
      maskedPhone: maskPhone(u.phone),
      hasOrders: withOrders.has(String(u._id)),
    }));
  },
});

/**
 * Estimated recipients and per-channel eligibility for the confirmation step.
 * Never returns an email address or phone number.
 */
export const previewAudience = query({
  args: { audience: audienceArg, channels: channelsArg },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const { matched } = await resolveAudience(ctx, args.audience as CampaignAudienceInput);

    const totals = { inApp: 0, popup: 0, whatsapp: 0, email: 0 };
    const reasonCounts: Record<string, Record<string, number>> = {
      whatsapp: {},
      email: {},
      inApp: {},
      popup: {},
    };
    let withEmail = 0;
    let withPhone = 0;

    // One preferences read for the whole preview instead of one per customer.
    const allPrefs = await ctx.db.query("communication_prefs").collect();
    const prefsByUser = new Map(
      allPrefs.map((prefs: any) => [String(prefs.userId), prefs])
    );

    for (const user of matched) {
      const prefs = prefsByUser.get(String(user._id)) ?? null;
      const eligibility = channelEligibility(user, prefs);
      if (eligibility.email) withEmail += 1;
      if (normalizePhone(user.phone)) withPhone += 1;
      for (const channel of ["inApp", "popup", "whatsapp", "email"] as const) {
        if (eligibility[channel]) {
          totals[channel] += 1;
        } else if (args.channels[channel]) {
          const reason = eligibility.reasons[channel] || "Not eligible";
          reasonCounts[channel][reason] = (reasonCounts[channel][reason] ?? 0) + 1;
        }
      }
    }

    const reasonBreakdown = Object.fromEntries(
      Object.entries(reasonCounts).map(([channel, reasons]) => [
        channel,
        Object.entries(reasons)
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count),
      ])
    );

    const selectedChannels = (["inApp", "popup", "whatsapp", "email"] as const).filter(
      (c) => args.channels[c]
    );
    const estimate = Math.max(
      0,
      ...selectedChannels.map((c) => totals[c as keyof typeof totals])
    );

    return {
      recipients: matched.length,
      estimated: estimate,
      perChannel: selectedChannels.map((channel) => ({
        channel,
        eligible: totals[channel as keyof typeof totals],
        ineligible: matched.length - totals[channel as keyof typeof totals],
      })),
      reasonBreakdown,
      contactCoverage: { withEmail, withPhone },
      missingConfig: missingProviderConfig(args.channels as CampaignChannelSelection),
    };
  },
});

/** Email preview HTML/text, generated from the same template the sender uses. */
export const renderPreview = query({
  args: {
    title: v.string(),
    body: v.string(),
    category: categoryArg,
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const unsubscribeUrl = "https://kalyanchemist.com/#/unsubscribe?token=PREVIEW";
    return {
      html: buildCampaignEmailHtml({
        title: args.title,
        body: args.body,
        category: args.category,
        imageUrl: args.imageUrl,
        unsubscribeUrl,
      }),
      text: plainTextEmail({
        title: args.title,
        body: args.body,
        unsubscribeUrl,
      }),
    };
  },
});

// ══════════════════════════════════════════════════════════════════
//  ADMIN — CAMPAIGNS
// ══════════════════════════════════════════════════════════════════

async function deliveryCounts(ctx: any, campaignId: any) {
  const rows = await ctx.db
    .query("campaign_deliveries")
    .withIndex("by_campaign", (q: any) => q.eq("campaignId", campaignId))
    .collect();
  const counts: Record<string, Record<string, number>> = {};
  for (const row of rows) {
    if (!counts[row.channel]) counts[row.channel] = {};
    counts[row.channel][row.status] = (counts[row.channel][row.status] ?? 0) + 1;
  }
  return { counts, total: rows.length };
}

function summarize(counts: Record<string, Record<string, number>>, channel: string) {
  const c = counts[channel] ?? {};
  return {
    queued: c.queued ?? 0,
    sending: c.sending ?? 0,
    sent: c.sent ?? 0,
    delivered: c.delivered ?? 0,
    read: c.read ?? 0,
    failed: c.failed ?? 0,
    skipped: c.skipped ?? 0,
    total: Object.values(c).reduce((sum, n) => sum + n, 0),
  };
}

export const listCampaigns = query({
  args: {
    search: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("scheduled"),
        v.literal("processing"),
        v.literal("completed"),
        v.literal("partially_failed"),
        v.literal("failed"),
        v.literal("cancelled")
      )
    ),
    channel: v.optional(
      v.union(
        v.literal("inApp"),
        v.literal("popup"),
        v.literal("whatsapp"),
        v.literal("email")
      )
    ),
    category: v.optional(categoryArg),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const term = (args.search ?? "").trim().toLowerCase();
    const campaigns = await ctx.db
      .query("message_campaigns")
      .withIndex("by_createdAt")
      .order("desc")
      .take(200);

    const filtered = campaigns.filter((campaign: any) => {
      if (args.status && campaign.status !== args.status) return false;
      if (args.category && campaign.category !== args.category) return false;
      if (args.channel && !campaign.channels?.[args.channel]) return false;
      if (term) {
        const haystack = `${campaign.title ?? ""} ${campaign.body ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      const when = campaign.scheduledAt ?? campaign.createdAt;
      if (args.from !== undefined && when < args.from) return false;
      if (args.to !== undefined && when > args.to) return false;
      return true;
    });

    return filtered.slice(0, 80).map((campaign: any) => ({
      _id: campaign._id,
      title: campaign.title,
      category: campaign.category,
      categoryLabel: categoryLabel(campaign.category),
      status: campaign.status,
      channels: campaign.channels,
      audienceType: campaign.audience.type,
      audienceSize: campaign.audienceSize,
      scheduledAt: campaign.scheduledAt,
      createdAt: campaign.createdAt,
      expiresAt: campaign.expiresAt,
      abTest: Boolean(campaign.variantB),
      abWinner: campaign.abWinner ?? null,
      stats: campaign.stats ?? null,
      errorSummary: campaign.errorSummary ?? null,
    }));
  },
});

export const getCampaign = query({
  args: { campaignId: v.id("message_campaigns") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return null;

    const { counts } = await deliveryCounts(ctx, campaign._id);

    const failures = await ctx.db
      .query("campaign_deliveries")
      .withIndex("by_campaign_channel", (q: any) => q.eq("campaignId", campaign._id))
      .collect();
    const failedRows = failures.filter((d: any) => d.status === "failed").slice(0, 10);
    const failureDetails = await Promise.all(
      failedRows.map(async (row: any) => {
        const user: any = await ctx.db.get(row.userId);
        return {
          channel: row.channel,
          error: row.error ?? "Delivery failed",
          attempts: row.attempts,
          customerName: user?.name || "Customer",
          retryable: retryEligibility(row).eligible,
        };
      })
    );

    const abCounts = (variant: "A" | "B") => {
      const rows = failures.filter((d: any) => d.variant === variant);
      return {
        targeted: rows.length,
        accepted: rows.filter((d: any) => d.status === "sent").length,
        delivered: rows.filter((d: any) => d.status === "delivered").length,
        read: rows.filter((d: any) => d.status === "read").length,
        failed: rows.filter((d: any) => d.status === "failed").length,
      };
    };
    const abSummary = campaign.variantB
      ? {
          splitPercent: campaign.abSplit ?? 50,
          evaluation: evaluateAbTest(abCounts("A"), abCounts("B")),
          winner: campaign.abWinner ?? null,
          winnerDecidedBy: campaign.abWinnerDecidedBy ?? null,
          winnerDecidedAt: campaign.abWinnerDecidedAt ?? null,
        }
      : null;

    const popupStates = await ctx.db
      .query("campaign_popup_state")
      .withIndex("by_campaign_user", (q: any) => q.eq("campaignId", campaign._id))
      .collect();
    const popupSeen = popupStates.filter((s: any) => s.seenAt).length;
    const popupDismissed = popupStates.filter((s: any) => s.dismissedAt).length;

    const notificationRows = await ctx.db
      .query("notifications")
      .withIndex("by_campaign_user", (q: any) => q.eq("campaignId", campaign._id))
      .collect();
    const notificationsRead = notificationRows.filter((n: any) => n.read).length;

    const unsubscribeUrl = "https://kalyanchemist.com/#/unsubscribe?token=PREVIEW";
    const previewHtml = buildCampaignEmailHtml({
      title: campaign.title,
      body: campaign.body,
      category: campaign.category,
      imageUrl: campaign.imageUrl,
      unsubscribeUrl,
    });

    return {
      campaign,
      summary: {
        inApp: summarize(counts, "in_app"),
        popup: summarize(counts, "popup"),
        whatsapp: summarize(counts, "whatsapp"),
        email: summarize(counts, "email"),
      },
      notifications: { total: notificationRows.length, read: notificationsRead },
      popup: { seen: popupSeen, dismissed: popupDismissed },
      failures: failureDetails,
      retryableFailures: failures.filter((row: any) => retryEligibility(row).eligible)
        .length,
      /** Only a scheduled campaign has a pending execution time. */
      nextExecutionAt:
        campaign.status === "scheduled" ? (campaign.scheduledAt ?? null) : null,
      abSummary,
      previewHtml,
    };
  },
});

/**
 * Create, edit, schedule or send a campaign.
 * `confirmed` must be true for any operation that reaches customers.
 */
export const saveCampaign = mutation({
  args: {
    campaignId: v.optional(v.id("message_campaigns")),
    requestKey: v.optional(v.string()),
    title: v.string(),
    body: v.string(),
    category: categoryArg,
    imageUrl: v.optional(v.string()),
    channels: channelsArg,
    audience: audienceArg,
    scheduledAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    /** Optional variation B; variant A is the main title/body. */
    variantB: v.optional(v.object({ title: v.string(), body: v.string() })),
    abSplit: v.optional(v.number()),
    mode: v.union(v.literal("draft"), v.literal("schedule"), v.literal("send_now")),
    confirmed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const now = Date.now();

    // Idempotent create: a retried request with the same key returns the same
    // campaign instead of creating a second one.
    if (!args.campaignId && args.requestKey) {
      const existing = await ctx.db
        .query("message_campaigns")
        .withIndex("by_requestKey", (q) => q.eq("requestKey", args.requestKey))
        .first();
      if (existing) {
        return { campaignId: existing._id, status: existing.status, deduplicated: true };
      }
    }

    const validation = validateCampaignInput(
      {
        title: args.title,
        body: args.body,
        category: args.category as MessageCategory,
        imageUrl: args.imageUrl,
        channels: args.channels as CampaignChannelSelection,
        audience: args.audience as CampaignAudienceInput,
        scheduledAt: args.mode === "schedule" ? args.scheduledAt : undefined,
        expiresAt: args.expiresAt,
      },
      now
    );
    if (!validation.valid) {
      throw new Error(validation.errors.join(" "));
    }
    const input = validation.normalized;

    let variantB: { title: string; body: string } | undefined;
    let abSplit: number | undefined;
    if (args.variantB) {
      const bTitle = (args.variantB.title ?? "").trim();
      const bBody = (args.variantB.body ?? "").replace(/\r\n/g, "\n").trim();
      if (bTitle.length < TITLE_MIN || bTitle.length > TITLE_MAX) {
        throw new Error(
          `Variant B title must be ${TITLE_MIN}–${TITLE_MAX} characters.`
        );
      }
      if (bBody.length < BODY_MIN || bBody.length > BODY_MAX) {
        throw new Error(
          `Variant B message must be ${BODY_MIN}–${BODY_MAX} characters.`
        );
      }
      if (bTitle === input.title && bBody === input.body) {
        throw new Error("Variant B must differ from variant A.");
      }
      variantB = { title: bTitle, body: bBody };
      const split = Number(args.abSplit ?? 50);
      abSplit = Number.isFinite(split)
        ? Math.min(90, Math.max(10, Math.round(split)))
        : 50;
    }

    if (args.mode !== "draft" && args.confirmed !== true) {
      throw new Error("Please confirm the audience and channels before sending.");
    }

    const missing = missingProviderConfig(input.channels);
    if (args.mode !== "draft" && missing.length > 0) {
      throw new Error(
        `Setup required before this campaign can be sent. ${missing.join(" ")}`
      );
    }
    if (args.mode === "schedule" && input.scheduledAt === undefined) {
      throw new Error("Choose a future date and time to schedule this campaign.");
    }
    if (args.mode === "schedule" && input.scheduledAt! <= now) {
      throw new Error("Scheduled time must be in the future. Use Send now instead.");
    }
    if (input.expiresAt !== undefined && input.expiresAt <= (input.scheduledAt ?? now)) {
      throw new Error("Expiry must be after the campaign's send time.");
    }

    const audience =
      args.mode === "draft"
        ? { matched: [] as any[] }
        : await resolveAudience(ctx, input.audience);
    const audienceSize = args.mode === "draft" ? 0 : audience.matched.length;
    if (args.mode !== "draft" && audienceSize === 0) {
      throw new Error("No eligible registered customers match this audience.");
    }

    // Pre-send validation: an audience can exist while nobody in it can receive
    // any selected channel (for example an email-only campaign with no email
    // addresses). Reject that honestly instead of recording a pile of skips.
    if (args.mode !== "draft" && audienceSize > 0) {
      const selectedChannels = (
        ["inApp", "popup", "whatsapp", "email"] as const
      ).filter((channel) => input.channels[channel]);
      const allPrefs = await ctx.db.query("communication_prefs").collect();
      const prefsByUser = new Map(
        allPrefs.map((prefs: any) => [String(prefs.userId), prefs])
      );
      const anyEligible = audience.matched.some((user: any) => {
        const eligibility = channelEligibility(
          user,
          prefsByUser.get(String(user._id)) ?? null
        );
        return selectedChannels.some((channel) => eligibility[channel]);
      });
      if (!anyEligible) {
        throw new Error(
          "No customer in this audience is eligible for the selected channels. Check contact details, opt-outs and channel preferences."
        );
      }
    }

    let existing: any = null;
    if (args.campaignId) {
      existing = await ctx.db.get(args.campaignId);
      if (!existing) throw new Error("Campaign not found.");
      if (existing.status !== "draft" && existing.status !== "scheduled") {
        throw new Error("Only drafts or scheduled campaigns can be edited.");
      }
    }

    // Cancel any previously scheduled execution before writing new state.
    if (existing?.scheduledJobId) {
      try {
        await ctx.scheduler.cancel(existing.scheduledJobId);
      } catch {
        // Already executed or cancelled — nothing to undo.
      }
    }

    // Send-now is also written as `scheduled` for the current instant, then the
    // worker atomically claims it. That makes a double submit harmless: the
    // second worker run finds status `processing` and returns without sending.
    const status =
      args.mode === "draft" ? ("draft" as const) : ("scheduled" as const);

    const fields: any = {
      title: input.title,
      body: input.body,
      category: input.category,
      imageUrl: input.imageUrl,
      channels: input.channels,
      popupEnabled: input.channels.popup,
      audience: input.audience,
      variantB,
      abSplit,
      // A changed message invalidates any earlier winner choice.
      abWinner: undefined,
      abWinnerDecidedBy: undefined,
      abWinnerDecidedAt: undefined,
      status,
      scheduledAt:
        args.mode === "schedule"
          ? input.scheduledAt
          : args.mode === "send_now"
            ? now
            : undefined,
      expiresAt: input.expiresAt,
      updatedAt: now,
      audienceSize,
      scheduledJobId: undefined,
      errorSummary: undefined,
    };

    let campaignId: any;
    if (existing) {
      campaignId = existing._id;
      await ctx.db.patch(campaignId, fields);
    } else {
      campaignId = await ctx.db.insert("message_campaigns", {
        ...fields,
        createdBy: adminId,
        createdAt: now,
        requestKey: args.requestKey,
      });
    }

    if (args.mode === "schedule") {
      const jobId = await ctx.scheduler.runAt(
        input.scheduledAt!,
        internal.messageDispatch.dispatchScheduled,
        {}
      );
      await ctx.db.patch(campaignId, { scheduledJobId: jobId });
    }

    if (args.mode === "send_now") {
      // The worker re-checks status, expiry, configuration and its claim, so a
      // double submit cannot start the same campaign twice.
      await ctx.scheduler.runAfter(0, internal.messageDispatch.startCampaign, {
        campaignId,
      });
    }

    const actor: any = await ctx.db.get(adminId);
    const channelNames = Object.entries(input.channels)
      .filter(([, enabled]) => enabled)
      .map(([key]) => key)
      .join(", ");
    await recordAudit(ctx, {
      campaignId,
      campaignTitle: input.title,
      action: existing
        ? args.mode === "schedule"
          ? "campaign_rescheduled"
          : "campaign_updated"
        : args.mode === "schedule"
          ? "campaign_scheduled"
          : args.mode === "send_now"
            ? "campaign_send_requested"
            : "campaign_created",
      actorId: adminId,
      actorName: actor?.name ?? "Administrator",
      detail: [
        `Mode: ${args.mode.replace("_", " ")}`,
        `Channels: ${channelNames}`,
        `Audience: ${input.audience.type} (${audienceSize})`,
        input.scheduledAt ? `Send at: ${new Date(input.scheduledAt).toISOString()}` : null,
        variantB ? `A/B split: ${abSplit}% A / ${100 - (abSplit ?? 50)}% B` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });

    return { campaignId, status, audienceSize, deduplicated: false };
  },
});

export const cancelCampaign = mutation({
  args: { campaignId: v.id("message_campaigns") },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found.");
    if (campaign.status !== "draft" && campaign.status !== "scheduled") {
      throw new Error("Only draft or scheduled campaigns can be cancelled.");
    }
    if (campaign.scheduledJobId) {
      try {
        await ctx.scheduler.cancel(campaign.scheduledJobId);
      } catch {
        // Already executed — the worker's claim still prevents a duplicate run.
      }
    }
    const actor: any = await ctx.db.get(adminId);
    await ctx.db.patch(args.campaignId, {
      status: "cancelled",
      cancelledAt: Date.now(),
      updatedAt: Date.now(),
      scheduledJobId: undefined,
      errorSummary: "Cancelled by an administrator before sending.",
    });
    await recordAudit(ctx, {
      campaignId: campaign._id,
      campaignTitle: campaign.title,
      action: "campaign_cancelled",
      actorId: adminId,
      actorName: actor?.name ?? "Administrator",
      detail: "Campaign cancelled before dispatch. Nothing further will be sent.",
    });
    return { success: true };
  },
});

export const deleteCampaign = mutation({
  args: { campaignId: v.id("message_campaigns") },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return { success: true };
    if (campaign.status !== "draft" && campaign.status !== "cancelled") {
      throw new Error("Only draft or cancelled campaigns can be deleted.");
    }
    if (campaign.scheduledJobId) {
      try {
        await ctx.scheduler.cancel(campaign.scheduledJobId);
      } catch {
        // ignore
      }
    }
    const deliveries = await ctx.db
      .query("campaign_deliveries")
      .withIndex("by_campaign", (q: any) => q.eq("campaignId", args.campaignId))
      .collect();
    for (const row of deliveries) await ctx.db.delete(row._id);
    const recipients = await ctx.db
      .query("campaign_recipients")
      .withIndex("by_campaign", (q: any) => q.eq("campaignId", args.campaignId))
      .collect();
    for (const row of recipients) await ctx.db.delete(row._id);
    const popupStates = await ctx.db
      .query("campaign_popup_state")
      .withIndex("by_campaign_user", (q: any) => q.eq("campaignId", args.campaignId))
      .collect();
    for (const row of popupStates) await ctx.db.delete(row._id);
    await ctx.db.delete(args.campaignId);
    const actor: any = await ctx.db.get(adminId);
    await recordAudit(ctx, {
      campaignTitle: campaign.title,
      action: "campaign_deleted",
      actorId: adminId,
      actorName: actor?.name ?? "Administrator",
      detail: `Deleted a ${campaign.status} campaign and its delivery records.`,
    });
    return { success: true };
  },
});

// ══════════════════════════════════════════════════════════════════
//  CUSTOMER — POPUP / PREFERENCES / UNSUBSCRIBE
// ══════════════════════════════════════════════════════════════════

async function matchesCampaignAudience(
  ctx: any,
  campaign: any,
  userId: any
): Promise<boolean> {
  const audience = campaign.audience;
  if (audience.type === "all") return true;
  if (audience.type === "selected") {
    return (audience.userIds ?? []).some((id: any) => String(id) === String(userId));
  }
  if (audience.type === "new_users" || audience.type === "existing_users") {
    const user: any = await ctx.db.get(userId);
    if (!user) return false;
    const age = Date.now() - Number(user._creationTime ?? 0);
    return audience.type === "new_users"
      ? age <= NEW_CUSTOMER_WINDOW_MS
      : age > NEW_CUSTOMER_WINDOW_MS;
  }
  if (audience.type === "category_buyers") {
    const products = await ctx.db.query("products").collect();
    const inCategory = new Set(
      products
        .filter((p: any) => String(p.categoryId) === String(audience.categoryId))
        .map((p: any) => String(p._id))
    );
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();
    return orders.some((o: any) =>
      o.items?.some((item: any) => inCategory.has(String(item.productId)))
    );
  }
  const orders = await ctx.db
    .query("orders")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .collect();
  return audience.type === "with_orders" ? orders.length > 0 : orders.length === 0;
}

/** The single popup campaign this customer should see, if any. */
export const activePopup = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;

    const prefs = await prefsFor(ctx, userId);
    if (prefs && (prefs.popup === false || prefs.promotional === false)) return null;

    const now = Date.now();
    // Popups are only relevant while they are recent, so read the newest
    // campaigns instead of every popup campaign ever created.
    const campaigns = await ctx.db
      .query("message_campaigns")
      .withIndex("by_createdAt")
      .order("desc")
      .take(80);

    const candidates = campaigns
      .filter(
        (campaign: any) =>
          campaign.channels?.popup &&
          (campaign.status === "scheduled" ||
            campaign.status === "processing" ||
            campaign.status === "completed" ||
            campaign.status === "partially_failed") &&
          campaign.scheduledAt !== undefined &&
          campaign.scheduledAt <= now &&
          (!campaign.expiresAt || campaign.expiresAt > now)
      )
      .sort((a: any, b: any) => b.createdAt - a.createdAt);

    for (const campaign of candidates) {
      const recipient = await ctx.db
        .query("campaign_recipients")
        .withIndex("by_campaign_user", (q: any) =>
          q.eq("campaignId", campaign._id).eq("userId", userId)
        )
        .first();
      if (!recipient) continue;

      // Only customers for whom the popup channel was actually delivered at
      // materialisation time are eligible, even if their preferences changed.
      const popupDelivery = await ctx.db
        .query("campaign_deliveries")
        .withIndex("by_campaign_user_channel", (q: any) =>
          q
            .eq("campaignId", campaign._id)
            .eq("userId", userId)
            .eq("channel", "popup")
        )
        .first();
      if (
        !popupDelivery ||
        popupDelivery.status === "failed" ||
        popupDelivery.status === "skipped"
      ) {
        continue;
      }

      const state = await ctx.db
        .query("campaign_popup_state")
        .withIndex("by_campaign_user", (q: any) =>
          q.eq("campaignId", campaign._id).eq("userId", userId)
        )
        .first();
      if (state?.dismissedAt) continue;

      if (!(await matchesCampaignAudience(ctx, campaign, userId))) continue;

      const variant =
        recipient.variant === "B" && campaign.variantB ? campaign.variantB : null;
      return {
        campaignId: campaign._id,
        title: variant?.title ?? campaign.title,
        body: variant?.body ?? campaign.body,
        category: campaign.category,
        variant: recipient.variant ?? null,
        imageUrl: campaign.imageUrl ?? null,
        expiresAt: campaign.expiresAt ?? null,
        seen: Boolean(state?.seenAt),
      };
    }
    return null;
  },
});

async function upsertPopupState(
  ctx: any,
  campaignId: any,
  userId: any,
  patch: { seen?: boolean; dismissed?: boolean }
) {
  const now = Date.now();
  const existing = await ctx.db
    .query("campaign_popup_state")
    .withIndex("by_campaign_user", (q: any) =>
      q.eq("campaignId", campaignId).eq("userId", userId)
    )
    .first();

  const updates: any = { updatedAt: now };
  if (patch.seen) updates.seenAt = now;
  if (patch.dismissed) {
    updates.dismissedAt = now;
    updates.seenAt = existing?.seenAt ?? now;
  }

  if (existing) {
    await ctx.db.patch(existing._id, updates);
  } else {
    await ctx.db.insert("campaign_popup_state", {
      campaignId,
      userId,
      updatedAt: now,
      ...updates,
    });
  }

  const delivery = await ctx.db
    .query("campaign_deliveries")
    .withIndex("by_campaign_user_channel", (q: any) =>
      q.eq("campaignId", campaignId).eq("userId", userId).eq("channel", "popup")
    )
    .first();
  if (delivery && (patch.dismissed || patch.seen) && delivery.status !== "failed") {
    await ctx.db.patch(delivery._id, {
      status: "read",
      updatedAt: now,
    });
  }
}

export const markPopupSeen = mutation({
  args: { campaignId: v.id("message_campaigns") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { success: false };
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign || campaign.status === "cancelled" || campaign.status === "draft") {
      return { success: false };
    }
    if (campaign.expiresAt && campaign.expiresAt <= Date.now()) {
      return { success: false };
    }
    const recipient = await ctx.db
      .query("campaign_recipients")
      .withIndex("by_campaign_user", (q: any) =>
        q.eq("campaignId", args.campaignId).eq("userId", userId)
      )
      .first();
    if (!recipient) return { success: false };
    await upsertPopupState(ctx, args.campaignId, userId, { seen: true });
    return { success: true };
  },
});

export const dismissPopup = mutation({
  args: { campaignId: v.id("message_campaigns") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { success: false };
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign) return { success: false };
    const recipient = await ctx.db
      .query("campaign_recipients")
      .withIndex("by_campaign_user", (q: any) =>
        q.eq("campaignId", args.campaignId).eq("userId", userId)
      )
      .first();
    if (!recipient) return { success: false };
    await upsertPopupState(ctx, args.campaignId, userId, { dismissed: true });
    return { success: true };
  },
});

function defaultPrefs(user: any) {
  return {
    inApp: true,
    popup: true,
    whatsapp: user.whatsappOptIn === true,
    email: true,
    promotional: true,
  };
}

export const myPreferences = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    if (!user) return null;
    const prefs = await prefsFor(ctx, userId);
    const resolved = prefs
      ? {
          inApp: prefs.inApp,
          popup: prefs.popup,
          whatsapp: prefs.whatsapp,
          email: prefs.email,
          promotional: prefs.promotional,
          unsubscribedAt: prefs.unsubscribedAt ?? null,
        }
      : { ...defaultPrefs(user), unsubscribedAt: null };
    return {
      ...resolved,
      emailMasked: maskEmail(user.email),
      phoneMasked: maskPhone(user.phone),
      emailAvailable: Boolean(user.email),
      phoneAvailable: Boolean(user.phone),
      phoneVerified: user.phoneVerified === true || Boolean(normalizePhone(user.phone)),
    };
  },
});

export const updatePreferences = mutation({
  args: {
    inApp: v.optional(v.boolean()),
    popup: v.optional(v.boolean()),
    whatsapp: v.optional(v.boolean()),
    email: v.optional(v.boolean()),
    promotional: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const now = Date.now();
    const existing = await prefsFor(ctx, userId);
    const defaults = existing
      ? {
          inApp: existing.inApp,
          popup: existing.popup,
          whatsapp: existing.whatsapp,
          email: existing.email,
          promotional: existing.promotional,
        }
      : defaultPrefs((await ctx.db.get(userId)) ?? {});

    const next = {
      inApp: args.inApp ?? defaults.inApp,
      popup: args.popup ?? defaults.popup,
      whatsapp: args.whatsapp ?? defaults.whatsapp,
      email: args.email ?? defaults.email,
      promotional: args.promotional ?? defaults.promotional,
    };

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...next,
        updatedAt: now,
        unsubscribedAt: next.email && next.promotional ? undefined : existing.unsubscribedAt,
      });
    } else {
      await ctx.db.insert("communication_prefs", {
        userId,
        ...next,
        unsubscribeToken: randomToken(),
        updatedAt: now,
      });
    }

    // Keep the existing WhatsApp opt-in field in sync for other features.
    if (args.whatsapp !== undefined) {
      await ctx.db.patch(userId, { whatsappOptIn: args.whatsapp });
    }
    return { success: true };
  },
});

/** One-click unsubscribe from promotional email. Never reveals whose token it was. */
export const unsubscribeByToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const token = args.token.trim();
    if (!token || token.length < 16) return { success: false };
    const prefs = await ctx.db
      .query("communication_prefs")
      .withIndex("by_token", (q) => q.eq("unsubscribeToken", token))
      .first();
    if (!prefs) return { success: false };
    const now = Date.now();
    await ctx.db.patch(prefs._id, {
      email: false,
      promotional: false,
      unsubscribedAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(prefs.userId, { whatsappOptIn: prefs.whatsapp });
    return { success: true };
  },
});
