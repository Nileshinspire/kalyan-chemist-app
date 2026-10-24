/**
 * Campaign management: analytics, comparison, send-time guidance, suggestions,
 * templates, audit history, retries, A/B winners and messaging policy.
 *
 * Every function re-checks that the caller is an administrator on the server.
 * Metrics are derived only from recorded delivery rows; anything the current
 * providers do not report (opens, clicks, conversions) is returned as
 * explicitly unavailable rather than estimated.
 */
import { internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { recordAudit } from "./campaignAudit";
import { requireAdmin, resolveAudience } from "./messageCenter";
import {
  DEFAULT_QUIET_HOURS,
  IST_OFFSET_MINUTES,
  STORE_TIME_ZONE,
  clampHour,
  evaluateAbTest,
  formatStoreDateTime,
  isQuietHours,
  nextAllowedSendTime,
  retryEligibility,
  storeTimeParts,
  validateImageUrl,
  type CampaignAudienceInput,
} from "./messageCenterCore";

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

const CHANNEL_LABEL: Record<string, string> = {
  in_app: "Website notification",
  popup: "Login popup",
  whatsapp: "WhatsApp",
  email: "Email",
};

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const FREQUENCY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function rate(value: number, total: number): number | null {
  return total > 0 ? Math.round((value / total) * 1000) / 1000 : null;
}

async function settingsRow(ctx: any) {
  return await ctx.db
    .query("communication_settings")
    .withIndex("by_key", (q: any) => q.eq("key", "default"))
    .first();
}

async function resolvedSettings(ctx: any) {
  const row = await settingsRow(ctx);
  return {
    quietHoursEnabled: row?.quietHoursEnabled ?? DEFAULT_QUIET_HOURS.quietHoursEnabled,
    quietStartHour: row?.quietStartHour ?? DEFAULT_QUIET_HOURS.quietStartHour,
    quietEndHour: row?.quietEndHour ?? DEFAULT_QUIET_HOURS.quietEndHour,
    maxPromotionalPerWeek:
      row?.maxPromotionalPerWeek ?? DEFAULT_QUIET_HOURS.maxPromotionalPerWeek,
  };
}

function nextWeekdayHour(weekday: number, hour: number, now: number): number {
  const parts = storeTimeParts(now);
  const base =
    Date.UTC(parts.year, parts.month, parts.day, hour, 0, 0) -
    IST_OFFSET_MINUTES * 60_000;
  const daysAhead = (weekday - parts.weekday + 7) % 7;
  let candidate = base + daysAhead * 86_400_000;
  if (candidate <= now) candidate += 7 * 86_400_000;
  return candidate;
}

// ══════════════════════════════════════════════════════════════════
//  MESSAGING POLICY — quiet hours / frequency limit
// ══════════════════════════════════════════════════════════════════

export const getMessagingSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const settings = await resolvedSettings(ctx);
    const row = await settingsRow(ctx);
    return {
      ...settings,
      timeZone: STORE_TIME_ZONE,
      updatedAt: row?.updatedAt ?? null,
    };
  },
});

export const updateMessagingSettings = mutation({
  args: {
    quietHoursEnabled: v.boolean(),
    quietStartHour: v.number(),
    quietEndHour: v.number(),
    maxPromotionalPerWeek: v.number(),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const start = clampHour(args.quietStartHour, DEFAULT_QUIET_HOURS.quietStartHour);
    const end = clampHour(args.quietEndHour, DEFAULT_QUIET_HOURS.quietEndHour);
    const cap = Math.round(args.maxPromotionalPerWeek);
    if (cap < 0 || cap > 14) {
      throw new Error("Weekly promotional limit must be between 0 and 14 (0 disables it).");
    }
    if (args.quietHoursEnabled && start === end) {
      throw new Error("Quiet hours need different start and end hours.");
    }
    const row = await settingsRow(ctx);
    const fields = {
      quietHoursEnabled: args.quietHoursEnabled,
      quietStartHour: start,
      quietEndHour: end,
      maxPromotionalPerWeek: cap,
      updatedBy: adminId,
      updatedAt: Date.now(),
    };
    if (row) await ctx.db.patch(row._id, fields);
    else await ctx.db.insert("communication_settings", { key: "default", ...fields });

    const actor: any = await ctx.db.get(adminId);
    await recordAudit(ctx, {
      action: "messaging_settings_updated",
      actorId: adminId,
      actorName: actor?.name ?? "Administrator",
      detail: `Quiet hours ${args.quietHoursEnabled ? `${start}:00–${end}:00 IST` : "off"} · promotional cap ${cap}/week`,
    });
    return { success: true };
  },
});

// ══════════════════════════════════════════════════════════════════
//  TEMPLATES
// ══════════════════════════════════════════════════════════════════

export const listTemplates = query({
  args: { category: v.optional(categoryArg) },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("message_templates")
      .withIndex("by_createdAt")
      .order("desc")
      .take(100);
    return rows
      .filter((row: any) => !args.category || row.category === args.category)
      .map((row: any) => ({
        _id: row._id,
        name: row.name,
        category: row.category,
        title: row.title,
        body: row.body,
        imageUrl: row.imageUrl ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }));
  },
});

function validateTemplate(args: {
  name: string;
  title: string;
  body: string;
}): { name: string; title: string; body: string } {
  const name = (args.name ?? "").trim();
  const title = (args.title ?? "").trim();
  const body = (args.body ?? "").replace(/\r\n/g, "\n").trim();
  if (name.length < 2 || name.length > 80) {
    throw new Error("Template name must be 2–80 characters.");
  }
  if (title.length < 3 || title.length > 120) {
    throw new Error("Template title must be 3–120 characters.");
  }
  if (body.length < 3 || body.length > 2000) {
    throw new Error("Template message must be 3–2000 characters.");
  }
  return { name, title, body };
}

export const saveTemplate = mutation({
  args: {
    templateId: v.optional(v.id("message_templates")),
    name: v.string(),
    category: categoryArg,
    title: v.string(),
    body: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const clean = validateTemplate(args);
    const now = Date.now();
    let imageUrl: string | undefined;
    try {
      imageUrl = validateImageUrl(args.imageUrl);
    } catch (error: any) {
      throw new Error(error?.message ?? "Banner image URL is invalid.");
    }
    let templateId: any;
    if (args.templateId) {
      const existing = await ctx.db.get(args.templateId);
      if (!existing) throw new Error("Template not found.");
      await ctx.db.patch(args.templateId, {
        ...clean,
        category: args.category,
        imageUrl,
        updatedAt: now,
      });
      templateId = args.templateId;
    } else {
      templateId = await ctx.db.insert("message_templates", {
        ...clean,
        category: args.category,
        imageUrl,
        createdBy: adminId,
        createdAt: now,
        updatedAt: now,
      });
    }
    const actor: any = await ctx.db.get(adminId);
    await recordAudit(ctx, {
      action: args.templateId ? "template_updated" : "template_created",
      actorId: adminId,
      actorName: actor?.name ?? "Administrator",
      detail: `Template “${clean.name}” (${args.category})`,
    });
    return { templateId };
  },
});

export const deleteTemplate = mutation({
  args: { templateId: v.id("message_templates") },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const template = await ctx.db.get(args.templateId);
    if (!template) return { success: true };
    await ctx.db.delete(args.templateId);
    const actor: any = await ctx.db.get(adminId);
    await recordAudit(ctx, {
      action: "template_deleted",
      actorId: adminId,
      actorName: actor?.name ?? "Administrator",
      detail: `Template “${template.name}”`,
    });
    return { success: true };
  },
});

export const duplicateTemplate = mutation({
  args: { templateId: v.id("message_templates") },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const template: any = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template not found.");
    const now = Date.now();
    const templateId = await ctx.db.insert("message_templates", {
      name: `${template.name} (copy)`.slice(0, 80),
      category: template.category,
      title: template.title,
      body: template.body,
      imageUrl: template.imageUrl,
      createdBy: adminId,
      createdAt: now,
      updatedAt: now,
    });
    const actor: any = await ctx.db.get(adminId);
    await recordAudit(ctx, {
      action: "template_duplicated",
      actorId: adminId,
      actorName: actor?.name ?? "Administrator",
      detail: `Template “${template.name}” duplicated`,
    });
    return { templateId };
  },
});

// ══════════════════════════════════════════════════════════════════
//  ANALYTICS
// ══════════════════════════════════════════════════════════════════

const UNAVAILABLE_METRICS = {
  opens: "Open tracking is not available for WhatsApp or email with the current providers.",
  clicks: "Link click tracking is not enabled in the current email/WhatsApp setup.",
  conversions: "Purchases are not attributed to campaigns, so no conversion figure is shown.",
};

function summarizeRows(rows: any[]) {
  const targeted = rows.length;
  const attempted = rows.filter((r) => (r.attempts ?? 0) > 0 && r.status !== "skipped").length;
  const accepted = rows.filter((r) => r.status === "sent").length;
  const delivered = rows.filter((r) => r.status === "delivered").length;
  const read = rows.filter((r) => r.status === "read").length;
  const failed = rows.filter((r) => r.status === "failed").length;
  const skipped = rows.filter((r) => r.status === "skipped").length;
  const queued = rows.filter((r) => r.status === "queued" || r.status === "sending").length;
  const reached = accepted + delivered + read;
  return {
    targeted,
    attempted,
    queued,
    accepted,
    delivered,
    read,
    failed,
    skipped,
    reached,
    failureRate: rate(failed, targeted),
    /** Read rate is only meaningful for channels with real read tracking. */
    readRate: rate(read, targeted),
  };
}

export const campaignAnalytics = query({
  args: { campaignId: v.id("message_campaigns") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const campaign: any = await ctx.db.get(args.campaignId);
    if (!campaign) return null;
    const rows = await ctx.db
      .query("campaign_deliveries")
      .withIndex("by_campaign", (q: any) => q.eq("campaignId", args.campaignId))
      .collect();

    const channels = (["in_app", "popup", "whatsapp", "email"] as const)
      .filter((channel) => {
        const key =
          channel === "in_app"
            ? "inApp"
            : (channel as "popup" | "whatsapp" | "email");
        return campaign.channels?.[key];
      })
      .map((channel) => ({
        channel,
        label: CHANNEL_LABEL[channel],
        ...summarizeRows(rows.filter((r: any) => r.channel === channel)),
      }));

    const abCounts = (variant: "A" | "B") => {
      const variantRows = rows.filter((r: any) => r.variant === variant);
      const summary = summarizeRows(variantRows);
      return {
        targeted: summary.targeted,
        accepted: summary.accepted,
        delivered: summary.delivered,
        read: summary.read,
        failed: summary.failed,
      };
    };

    return {
      campaign: {
        _id: campaign._id,
        title: campaign.title,
        status: campaign.status,
        category: campaign.category,
        variantB: campaign.variantB ?? null,
        abSplit: campaign.abSplit ?? null,
        abWinner: campaign.abWinner ?? null,
        abWinnerDecidedBy: campaign.abWinnerDecidedBy ?? null,
        abWinnerDecidedAt: campaign.abWinnerDecidedAt ?? null,
      },
      totals: summarizeRows(rows),
      channels,
      readTrackingAvailable: channels.some(
        (c) => c.channel === "in_app" || c.channel === "popup"
      ),
      abSummary: campaign.variantB
        ? {
            splitPercent: campaign.abSplit ?? 50,
            evaluation: evaluateAbTest(abCounts("A"), abCounts("B")),
          }
        : null,
      unavailable: UNAVAILABLE_METRICS,
      timeZone: STORE_TIME_ZONE,
    };
  },
});

export const compareCampaigns = query({
  args: { from: v.number(), to: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const campaigns = await ctx.db
      .query("message_campaigns")
      .withIndex("by_createdAt", (q: any) =>
        q.gte("createdAt", args.from).lte("createdAt", args.to)
      )
      .order("desc")
      .take(25);

    const rows = [];
    const allDeliveries: any[] = [];
    for (const campaign of campaigns) {
      if (
        !["completed", "partially_failed", "failed", "processing"].includes(
          campaign.status
        )
      ) {
        continue;
      }
      const deliveries = await ctx.db
        .query("campaign_deliveries")
        .withIndex("by_campaign", (q: any) => q.eq("campaignId", campaign._id))
        .collect();
      allDeliveries.push(...deliveries);
      rows.push({
        campaignId: campaign._id,
        title: campaign.title,
        status: campaign.status,
        category: campaign.category,
        sentAt: campaign.startedAt ?? campaign.scheduledAt ?? campaign.createdAt,
        channels: campaign.channels,
        abTest: Boolean(campaign.variantB),
        ...summarizeRows(deliveries),
      });
    }

    const aggregate = summarizeRows(allDeliveries);
    const channels = (["in_app", "popup", "whatsapp", "email"] as const).map(
      (channel) => ({
        channel,
        label: CHANNEL_LABEL[channel],
        ...summarizeRows(allDeliveries.filter((r) => r.channel === channel)),
      })
    );

    // Promotional opt-outs are account-level, not attributable to one campaign.
    const prefs = await ctx.db.query("communication_prefs").collect();
    const optOuts = prefs.filter(
      (row: any) =>
        row.unsubscribedAt &&
        row.unsubscribedAt >= args.from &&
        row.unsubscribedAt <= args.to
    ).length;

    return {
      from: args.from,
      to: args.to,
      campaigns: rows,
      aggregate,
      optOuts: {
        count: optOuts,
        note: "Account-level email unsubscribes in this period. These are not attributed to a specific campaign.",
      },
      channels,
      readTrackingAvailable: channels.some(
        (c) => (c.channel === "in_app" || c.channel === "popup") && c.targeted > 0
      ),
      unavailable: UNAVAILABLE_METRICS,
      timeZone: STORE_TIME_ZONE,
    };
  },
});

// ══════════════════════════════════════════════════════════════════
//  SMART SEND TIME (historical read evidence only)
// ══════════════════════════════════════════════════════════════════

export const sendTimeRecommendation = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const campaigns = await ctx.db
      .query("message_campaigns")
      .withIndex("by_createdAt")
      .order("desc")
      .take(40);

    const buckets = new Map<
      string,
      { weekday: number; hour: number; campaigns: number; deliveries: number; read: number }
    >();
    let usableCampaigns = 0;
    let usableDeliveries = 0;

    for (const campaign of campaigns) {
      if (!["completed", "partially_failed"].includes(campaign.status)) continue;
      if (!campaign.channels?.inApp && !campaign.channels?.popup) continue;
      const rows = await ctx.db
        .query("campaign_deliveries")
        .withIndex("by_campaign", (q: any) => q.eq("campaignId", campaign._id))
        .collect();
      const tracked = rows.filter(
        (r: any) => r.channel === "in_app" || r.channel === "popup"
      );
      if (tracked.length === 0) continue;

      const sentAt =
        campaign.startedAt ?? campaign.scheduledAt ?? campaign.createdAt;
      const parts = storeTimeParts(sentAt);
      const key = `${parts.weekday}-${parts.hour}`;
      const bucket =
        buckets.get(key) ?? {
          weekday: parts.weekday,
          hour: parts.hour,
          campaigns: 0,
          deliveries: 0,
          read: 0,
        };
      bucket.campaigns += 1;
      bucket.deliveries += tracked.length;
      bucket.read += tracked.filter((r: any) => r.status === "read").length;
      buckets.set(key, bucket);
      usableCampaigns += 1;
      usableDeliveries += tracked.length;
    }

    const slots = Array.from(buckets.values())
      .filter((bucket) => bucket.deliveries >= 5)
      .map((bucket) => ({
        weekday: bucket.weekday,
        weekdayLabel: WEEKDAYS[bucket.weekday],
        hour: bucket.hour,
        hourLabel: `${String(bucket.hour).padStart(2, "0")}:00–${String(
          (bucket.hour + 1) % 24
        ).padStart(2, "0")}:00 IST`,
        campaigns: bucket.campaigns,
        deliveries: bucket.deliveries,
        read: bucket.read,
        readRate: rate(bucket.read, bucket.deliveries),
        nextOccurrence: nextWeekdayHour(bucket.weekday, bucket.hour, Date.now()),
      }))
      .sort((a, b) => (b.readRate ?? 0) - (a.readRate ?? 0));

    const sufficient = usableCampaigns >= 3 && usableDeliveries >= 30;
    return {
      sufficient,
      slots: sufficient ? slots.slice(0, 3) : [],
      sample: {
        campaigns: usableCampaigns,
        deliveries: usableDeliveries,
      },
      reason: sufficient
        ? "Based on recorded website-notification and popup read rates for past campaigns. This is an estimate, not a guarantee."
        : "Not enough completed campaigns with read tracking yet. At least 3 campaigns and 30 tracked deliveries are needed before a time can be suggested.",
      timeZone: STORE_TIME_ZONE,
    };
  },
});

// ══════════════════════════════════════════════════════════════════
//  SMART SUGGESTIONS
// ══════════════════════════════════════════════════════════════════

export const campaignSuggestions = query({
  args: {
    audience: audienceArg,
    channels: channelsArg,
    scheduledAt: v.optional(v.number()),
    category: v.optional(categoryArg),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const suggestions: { level: "info" | "warning"; title: string; detail: string }[] =
      [];
    const settings = await resolvedSettings(ctx);

    if (args.scheduledAt && isQuietHours(args.scheduledAt, settings)) {
      const resumeAt = nextAllowedSendTime(args.scheduledAt, settings);
      suggestions.push({
        level: "warning",
        title: "Sending time falls inside quiet hours",
        detail: `Promotional campaigns pause between ${settings.quietStartHour}:00 and ${settings.quietEndHour}:00 IST. This campaign would resume at ${formatStoreDateTime(
          resumeAt
        )} instead of sending during quiet hours.`,
      });
    }

    const { matched } = await resolveAudience(
      ctx,
      args.audience as CampaignAudienceInput
    );
    if (matched.length === 0) {
      suggestions.push({
        level: "warning",
        title: "No customers match this audience",
        detail: "Choose another audience before scheduling or sending.",
      });
    }

    const cap = Number(settings.maxPromotionalPerWeek) || 0;
    if (cap > 0) {
      const since = Date.now() - FREQUENCY_WINDOW_MS;
      const recent = await ctx.db
        .query("campaign_deliveries")
        .withIndex("by_createdAt", (q: any) => q.gt("createdAt", since))
        .take(3000);
      const reachedByUser = new Map<string, Set<string>>();
      for (const row of recent) {
        if (!["sent", "delivered", "read"].includes(row.status)) continue;
        const key = String(row.userId);
        if (!reachedByUser.has(key)) reachedByUser.set(key, new Set());
        reachedByUser.get(key)!.add(String(row.campaignId));
      }
      const audienceIds = new Set(matched.map((u: any) => String(u._id)));
      let capped = 0;
      for (const [userId, campaignIds] of reachedByUser) {
        if (campaignIds.size < cap) continue;
        if (audienceIds.has(userId)) capped += 1;
      }
      if (capped > 0) {
        suggestions.push({
          level: "warning",
          title: `${capped} customer${capped === 1 ? "" : "s"} may hit the weekly limit`,
          detail: `They already received ${cap} promotional campaign${
            cap === 1 ? "" : "s"
          } in the last 7 days and will be skipped when this campaign runs.`,
        });
      }
    }

    if (args.category) {
      const templates = await ctx.db
        .query("message_templates")
        .withIndex("by_category", (q: any) => q.eq("category", args.category))
        .take(5);
      if (templates.length > 0) {
        suggestions.push({
          level: "info",
          title: "Saved template available",
          detail: `“${templates[0].name}” can be reused for this category instead of rewriting the message.`,
        });
      }
    }

    const channelCount = Object.values(args.channels).filter(Boolean).length;
    if (channelCount === 0) {
      suggestions.push({
        level: "warning",
        title: "No delivery channel selected",
        detail: "Pick at least one channel before saving, scheduling or sending.",
      });
    }

    return {
      suggestions,
      audienceSize: matched.length,
      settings,
      timeZone: STORE_TIME_ZONE,
    };
  },
});

// ══════════════════════════════════════════════════════════════════
//  AUDIT TRAIL
// ══════════════════════════════════════════════════════════════════

export const listCampaignAudit = query({
  args: {
    campaignId: v.optional(v.id("message_campaigns")),
    search: v.optional(v.string()),
    action: v.optional(v.string()),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(200, Math.max(1, Math.round(args.limit ?? 60)));
    const rows = args.campaignId
      ? await ctx.db
          .query("campaign_audit_log")
          .withIndex("by_campaign", (q: any) => q.eq("campaignId", args.campaignId))
          .order("desc")
          .take(limit)
      : await ctx.db
          .query("campaign_audit_log")
          .withIndex("by_createdAt")
          .order("desc")
          .take(400);

    const term = (args.search ?? "").trim().toLowerCase();
    return rows
      .filter((row: any) => {
        if (args.action && row.action !== args.action) return false;
        if (args.from !== undefined && row.createdAt < args.from) return false;
        if (args.to !== undefined && row.createdAt > args.to) return false;
        if (!term) return true;
        const haystack = `${row.campaignTitle ?? ""} ${row.action} ${
          row.actorName ?? ""
        } ${row.detail ?? ""}`.toLowerCase();
        return haystack.includes(term);
      })
      .slice(0, limit)
      .map((row: any) => ({
        _id: row._id,
        campaignId: row.campaignId ?? null,
        campaignTitle: row.campaignTitle ?? null,
        action: row.action,
        actorName: row.actorName ?? "Administrator",
        detail: row.detail ?? null,
        createdAt: row.createdAt,
      }));
  },
});

/** Test-send throttle input for the node action. Admin-only. */
export const recentTestSendCount = internalQuery({
  args: { actorId: v.id("users") },
  handler: async (ctx, args) => {
    const since = Date.now() - 10 * 60_000;
    const rows = await ctx.db
      .query("campaign_audit_log")
      .withIndex("by_createdAt", (q: any) => q.gt("createdAt", since))
      .take(200);
    return rows.filter(
      (row: any) => row.action === "test_send" && row.actorId === args.actorId
    ).length;
  },
});

// ══════════════════════════════════════════════════════════════════
//  RETRY + A/B WINNER
// ══════════════════════════════════════════════════════════════════

export const retryFailedDeliveries = mutation({
  args: {
    campaignId: v.id("message_campaigns"),
    deliveryIds: v.optional(v.array(v.id("campaign_deliveries"))),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const campaign: any = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found.");
    if (
      !["completed", "partially_failed", "failed"].includes(campaign.status)
    ) {
      throw new Error("Only a finished campaign with failures can be retried.");
    }

    const requested = args.deliveryIds ? new Set(args.deliveryIds.map(String)) : null;
    const rows = await ctx.db
      .query("campaign_deliveries")
      .withIndex("by_campaign", (q: any) => q.eq("campaignId", args.campaignId))
      .collect();

    const emailIds: any[] = [];
    const whatsappIds: any[] = [];
    let retried = 0;
    for (const row of rows) {
      if (requested && !requested.has(String(row._id))) continue;
      if (!retryEligibility(row).eligible) continue;
      await ctx.db.patch(row._id, {
        status: "queued",
        attempts: 0,
        error: undefined,
        updatedAt: Date.now(),
      });
      if (row.channel === "email") emailIds.push(row._id);
      else whatsappIds.push(row._id);
      retried += 1;
    }

    if (retried === 0) {
      return {
        retried: 0,
        message:
          "No retryable failures: consent, configuration and address problems would fail again.",
      };
    }

    await ctx.db.patch(args.campaignId, {
      status: "processing",
      completedAt: undefined,
      updatedAt: Date.now(),
      lastRetriedAt: Date.now(),
      errorSummary: undefined,
    });

    if (emailIds.length > 0) {
      await ctx.scheduler.runAfter(0, internal.messageDelivery.sendEmailBatch, {
        campaignId: campaign._id,
        deliveryIds: emailIds,
      });
    }
    if (whatsappIds.length > 0) {
      await ctx.scheduler.runAfter(0, internal.messageDelivery.sendWhatsAppBatch, {
        campaignId: campaign._id,
        deliveryIds: whatsappIds,
      });
    }

    const actor: any = await ctx.db.get(adminId);
    await recordAudit(ctx, {
      campaignId: campaign._id,
      campaignTitle: campaign.title,
      action: "deliveries_retried",
      actorId: adminId,
      actorName: actor?.name ?? "Administrator",
      detail: `${retried} failed ${
        retried === 1 ? "delivery" : "deliveries"
      } re-queued (email ${emailIds.length}, WhatsApp ${whatsappIds.length}).`,
    });

    return { retried };
  },
});

export const chooseAbWinner = mutation({
  args: {
    campaignId: v.id("message_campaigns"),
    winner: v.union(v.literal("A"), v.literal("B")),
    source: v.union(v.literal("manual"), v.literal("rule")),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const campaign: any = await ctx.db.get(args.campaignId);
    if (!campaign) throw new Error("Campaign not found.");
    if (!campaign.variantB) throw new Error("This campaign has no A/B test.");
    if (!["completed", "partially_failed"].includes(campaign.status)) {
      throw new Error("Choose a winner only after the test has run.");
    }
    const now = Date.now();
    await ctx.db.patch(args.campaignId, {
      abWinner: args.winner,
      abWinnerDecidedBy: args.source,
      abWinnerDecidedAt: now,
      updatedAt: now,
    });
    const actor: any = await ctx.db.get(adminId);
    await recordAudit(ctx, {
      campaignId: campaign._id,
      campaignTitle: campaign.title,
      action: "ab_winner_selected",
      actorId: adminId,
      actorName: actor?.name ?? "Administrator",
      detail: `Variant ${args.winner} selected as winner (${args.source}).`,
    });
    return { success: true };
  },
});
