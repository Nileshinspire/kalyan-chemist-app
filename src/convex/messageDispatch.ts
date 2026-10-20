/**
 * Message Center dispatch worker.
 *
 * Reliable, batched execution:
 *  - `startCampaign` atomically claims a due scheduled campaign.
 *  - `materializeBatch` walks the audience in pages, creating one notification
 *    record and one delivery row per channel. A per-(campaign,user,channel)
 *    lookup makes retries idempotent.
 *  - Email/WhatsApp batches are node actions that claim each delivery before
 *    contacting the provider, so a retry can never send twice.
 *  - A cron acts as a safety net for scheduled campaigns and stuck batches.
 */
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  channelEligibility,
  isRegisteredCustomer,
  campaignOutcome,
  type CampaignAudienceInput,
} from "./messageCenterCore";

const BATCH_SIZE = 40;

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function channelLabel(channel: string): string {
  switch (channel) {
    case "email":
      return "Email";
    case "whatsapp":
      return "WhatsApp";
    case "popup":
      return "Login popup";
    default:
      return "Website notification";
  }
}

function missingProviderConfig(channels: any): string[] {
  const missing: string[] = [];
  if (channels?.email && !process.env.RESEND_API_KEY) {
    missing.push("Email is not configured (missing RESEND_API_KEY).");
  }
  if (channels?.whatsapp && !(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)) {
    missing.push(
      "WhatsApp is not configured (missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID)."
    );
  }
  if (channels?.whatsapp && !process.env.WHATSAPP_CAMPAIGN_TEMPLATE_NAME) {
    missing.push(
      "WhatsApp campaign template is not configured (missing WHATSAPP_CAMPAIGN_TEMPLATE_NAME)."
    );
  }
  return missing;
}

async function prefsFor(ctx: any, userId: any) {
  return await ctx.db
    .query("communication_prefs")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
}

/** Audience matching for a single batch. */
async function audienceSets(ctx: any, audience: CampaignAudienceInput) {
  const orderUserIds = new Set<string>();
  const categoryUserIds = new Set<string>();
  if (audience.type === "all" || audience.type === "selected") {
    return { orderUserIds, categoryUserIds };
  }
  const orders = await ctx.db.query("orders").collect();
  for (const order of orders) orderUserIds.add(String(order.userId));
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
  return { orderUserIds, categoryUserIds };
}

function matchesAudience(
  userId: string,
  audience: CampaignAudienceInput,
  sets: { orderUserIds: Set<string>; categoryUserIds: Set<string> }
): boolean {
  switch (audience.type) {
    case "all":
      return true;
    case "with_orders":
      return sets.orderUserIds.has(userId);
    case "no_orders":
      return !sets.orderUserIds.has(userId);
    case "category_buyers":
      return sets.categoryUserIds.has(userId);
    case "selected":
      return (audience.userIds ?? []).some((id: any) => String(id) === userId);
    default:
      return false;
  }
}

function notificationTypeFor(category: string): "promo" | "system" {
  return category === "offer" ? "promo" : "system";
}

// ══════════════════════════════════════════════════════════════════
//  SCHEDULING
// ══════════════════════════════════════════════════════════════════

/** Cron + exact-time scheduler entry point. Idempotent by design. */
export const dispatchScheduled = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("message_campaigns")
      .withIndex("by_status_scheduledAt", (q: any) =>
        q.eq("status", "scheduled").lte("scheduledAt", now)
      )
      .take(10);

    for (const campaign of due) {
      await startCampaignImpl(ctx, campaign._id, now);
    }
    return { checked: due.length };
  },
});

/** Claims a scheduled campaign and begins the batched audience walk. */
export const startCampaign = internalMutation({
  args: { campaignId: v.id("message_campaigns") },
  handler: async (ctx, args) => {
    return await startCampaignImpl(ctx, args.campaignId, Date.now());
  },
});

async function startCampaignImpl(ctx: any, campaignId: any, now: number) {
  const campaign = await ctx.db.get(campaignId);
  if (!campaign) return { started: false, reason: "not_found" };
  // Only a scheduled campaign can be claimed. Once processing, the claim has
  // already happened — a duplicate scheduled call returns here.
  if (campaign.status !== "scheduled") {
    return { started: false, reason: "not_scheduled" };
  }
  // Five seconds of tolerance for scheduler jitter; anything earlier waits for
  // the next cron tick so a campaign never goes out before its configured time.
  if (!campaign.scheduledAt || campaign.scheduledAt > now + 5_000) {
    return { started: false, reason: "not_due" };
  }
  if (campaign.expiresAt !== undefined && campaign.expiresAt <= now) {
    await ctx.db.patch(campaignId, {
      status: "cancelled",
      cancelledAt: now,
      updatedAt: now,
      errorSummary: "Expired before it could be sent. Nothing was delivered.",
      scheduledJobId: undefined,
    });
    return { started: false, reason: "expired" };
  }
  const missing = missingProviderConfig(campaign.channels);
  if (missing.length > 0) {
    await ctx.db.patch(campaignId, {
      status: "failed",
      updatedAt: now,
      completedAt: now,
      errorSummary: missing.join(" "),
      scheduledJobId: undefined,
      claimedAt: now,
    });
    return { started: false, reason: "setup_required" };
  }
  if (campaign.audienceSize <= 0) {
    await ctx.db.patch(campaignId, {
      status: "failed",
      updatedAt: now,
      completedAt: now,
      errorSummary: "No eligible registered customers matched this audience.",
      scheduledJobId: undefined,
      claimedAt: now,
    });
    return { started: false, reason: "empty_audience" };
  }

  await ctx.db.patch(campaignId, {
    status: "processing",
    claimedAt: now,
    startedAt: now,
    updatedAt: now,
    scheduledJobId: undefined,
    errorSummary: undefined,
  });
  await ctx.scheduler.runAfter(0, internal.messageDispatch.materializeBatch, {
    campaignId,
    cursor: null,
  });
  return { started: true };
}

// ══════════════════════════════════════════════════════════════════
//  RECIPIENT MATERIALISATION
// ══════════════════════════════════════════════════════════════════

export const materializeBatch = internalMutation({
  args: {
    campaignId: v.id("message_campaigns"),
    cursor: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const campaign = await ctx.db.get(args.campaignId);
    if (!campaign || campaign.status !== "processing") {
      return { done: true, reason: "not_processing" };
    }
    const now = Date.now();
    if (campaign.expiresAt !== undefined && campaign.expiresAt <= now) {
      await ctx.db.patch(campaign._id, {
        status: "cancelled",
        cancelledAt: now,
        updatedAt: now,
        completedAt: now,
        errorSummary: "Campaign expired while it was being sent. Remaining recipients were skipped.",
      });
      return { done: true, reason: "expired" };
    }

    const page = await ctx.db.query("users").paginate({
      numItems: BATCH_SIZE,
      cursor: args.cursor,
    });
    const sets = await audienceSets(ctx, campaign.audience as CampaignAudienceInput);

    const emailIds: any[] = [];
    const whatsappIds: any[] = [];
    let processedThisBatch = 0;

    for (const user of page.page) {
      if (!isRegisteredCustomer(user)) continue;
      const userId = String(user._id);
      if (!matchesAudience(userId, campaign.audience as CampaignAudienceInput, sets)) {
        continue;
      }

      // Idempotency: one recipient row per campaign/customer.
      const existing = await ctx.db
        .query("campaign_recipients")
        .withIndex("by_campaign_user", (q: any) =>
          q.eq("campaignId", campaign._id).eq("userId", user._id)
        )
        .first();
      if (existing) continue;

      const prefs = await prefsFor(ctx, user._id);
      const eligibility = channelEligibility(user, prefs);

      // Every promotional email needs a working one-click unsubscribe token,
      // even for customers who have never opened notification preferences.
      if (campaign.channels.email && eligibility.email && !prefs) {
        await ctx.db.insert("communication_prefs", {
          userId: user._id,
          inApp: true,
          popup: true,
          whatsapp: user.whatsappOptIn === true,
          email: true,
          promotional: true,
          unsubscribeToken: randomToken(),
          updatedAt: now,
        });
      }

      const recipientId = await ctx.db.insert("campaign_recipients", {
        campaignId: campaign._id,
        userId: user._id,
        status: "queued",
        createdAt: now,
        updatedAt: now,
      });

      let sentAny = false;
      const skipReasons: string[] = [];

      // ── Website notification (persistent, independent of other channels) ──
      if (campaign.channels.inApp) {
        if (eligibility.inApp) {
          const duplicate = await ctx.db
            .query("notifications")
            .withIndex("by_campaign_user", (q: any) =>
              q.eq("campaignId", campaign._id).eq("userId", user._id)
            )
            .first();
          if (!duplicate) {
            await ctx.db.insert("notifications", {
              userId: user._id,
              type: notificationTypeFor(campaign.category),
              title: campaign.title,
              body: campaign.body,
              read: false,
              link: "/account/notifications",
              campaignId: campaign._id,
              category: campaign.category,
              imageUrl: campaign.imageUrl,
              expiresAt: campaign.expiresAt,
              createdAt: now,
            });
          }
          await ctx.db.insert("campaign_deliveries", {
            campaignId: campaign._id,
            userId: user._id,
            channel: "in_app",
            status: "sent",
            attempts: 1,
            createdAt: now,
            updatedAt: now,
            sentAt: now,
          });
          sentAny = true;
        } else {
          skipReasons.push(eligibility.reasons.inApp ?? "Website notifications disabled");
        }
      }

      // ── Login popup (availability only; seen/dismissed tracked separately) ──
      if (campaign.channels.popup) {
        if (eligibility.popup) {
          await ctx.db.insert("campaign_deliveries", {
            campaignId: campaign._id,
            userId: user._id,
            channel: "popup",
            status: "sent",
            attempts: 1,
            createdAt: now,
            updatedAt: now,
            sentAt: now,
          });
          sentAny = true;
        } else {
          skipReasons.push(eligibility.reasons.popup ?? "Login popups disabled");
        }
      }

      // ── External channels are queued for their own independent worker ──
      if (campaign.channels.whatsapp) {
        if (eligibility.whatsapp) {
          const id = await ctx.db.insert("campaign_deliveries", {
            campaignId: campaign._id,
            userId: user._id,
            channel: "whatsapp",
            status: "queued",
            attempts: 0,
            createdAt: now,
            updatedAt: now,
          });
          whatsappIds.push(id);
          sentAny = true;
        } else {
          skipReasons.push(eligibility.reasons.whatsapp ?? "WhatsApp unavailable");
        }
      }

      if (campaign.channels.email) {
        if (eligibility.email) {
          const id = await ctx.db.insert("campaign_deliveries", {
            campaignId: campaign._id,
            userId: user._id,
            channel: "email",
            status: "queued",
            attempts: 0,
            createdAt: now,
            updatedAt: now,
          });
          emailIds.push(id);
          sentAny = true;
        } else {
          skipReasons.push(eligibility.reasons.email ?? "Email unavailable");
        }
      }

      await ctx.db.patch(recipientId, {
        status: sentAny ? "processed" : "skipped",
        reason: sentAny ? undefined : skipReasons.join("; ").slice(0, 240),
        updatedAt: now,
      });
      processedThisBatch += 1;
    }

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

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.messageDispatch.materializeBatch, {
        campaignId: campaign._id,
        cursor: page.continueCursor,
      });
    } else {
      await finalizeCampaignImpl(ctx, campaign._id);
    }

    return { done: page.isDone, processed: processedThisBatch };
  },
});

// ══════════════════════════════════════════════════════════════════
//  DELIVERY SUPPORT USED BY NODE ACTIONS
// ══════════════════════════════════════════════════════════════════

/** Server-only payload for external delivery. Never exposed to customers. */
export const getDeliveryPayloads = internalQuery({
  args: { deliveryIds: v.array(v.id("campaign_deliveries")) },
  handler: async (ctx, args) => {
    const payloads = [];
    for (const deliveryId of args.deliveryIds) {
      const delivery = await ctx.db.get(deliveryId);
      if (!delivery) continue;
      const campaign = await ctx.db.get(delivery.campaignId);
      const user = await ctx.db.get(delivery.userId);
      if (!campaign || !user) continue;
      const prefs = await prefsFor(ctx, user._id);
      payloads.push({
        deliveryId,
        campaignId: campaign._id,
        channel: delivery.channel,
        status: delivery.status,
        attempts: delivery.attempts,
        title: campaign.title,
        body: campaign.body,
        category: campaign.category,
        imageUrl: campaign.imageUrl ?? null,
        expiresAt: campaign.expiresAt ?? null,
        userEmail: user.email ?? null,
        userPhone: user.phone ?? null,
        userName: user.name ?? "Customer",
        whatsappOptIn: user.whatsappOptIn === true,
        prefs: prefs
          ? {
              email: prefs.email,
              promotional: prefs.promotional,
              whatsapp: prefs.whatsapp,
              unsubscribedAt: prefs.unsubscribedAt ?? null,
              unsubscribeToken: prefs.unsubscribeToken,
            }
          : null,
      });
    }
    return payloads;
  },
});

/** Claim a queued delivery. Returns false when it is not safe to send. */
export const beginDelivery = internalMutation({
  args: { deliveryId: v.id("campaign_deliveries") },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) return { claimed: false, reason: "missing" };
    if (delivery.status !== "queued") return { claimed: false, reason: "not_queued" };
    if (delivery.attempts >= 3) {
      // Close the row so the campaign can finalize instead of staying queued
      // forever after repeated provider failures.
      await ctx.db.patch(args.deliveryId, {
        status: "failed",
        error: "Maximum delivery attempts reached.",
        updatedAt: Date.now(),
      });
      return { claimed: false, reason: "max_attempts" };
    }
    const campaign = await ctx.db.get(delivery.campaignId);
    if (!campaign || (campaign.status !== "processing" && campaign.status !== "completed")) {
      return { claimed: false, reason: "campaign_inactive" };
    }
    if (campaign.expiresAt !== undefined && campaign.expiresAt <= Date.now()) {
      await ctx.db.patch(args.deliveryId, {
        status: "skipped",
        error: "Campaign expired before delivery.",
        updatedAt: Date.now(),
      });
      return { claimed: false, reason: "expired" };
    }
    await ctx.db.patch(args.deliveryId, {
      status: "sending",
      attempts: delivery.attempts + 1,
      updatedAt: Date.now(),
    });
    return { claimed: true, attempt: delivery.attempts + 1 };
  },
});

/** Mark a delivery attempt as failed; `retryable` returns it to the queue. */
export const markDelivery = internalMutation({
  args: {
    deliveryId: v.id("campaign_deliveries"),
    status: v.union(
      v.literal("queued"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("skipped")
    ),
    providerMessageId: v.optional(v.string()),
    providerStatus: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) return { success: false };
    const now = Date.now();
    await ctx.db.patch(args.deliveryId, {
      status: args.status,
      providerMessageId: args.providerMessageId ?? delivery.providerMessageId,
      providerStatus: args.providerStatus,
      error: args.error?.slice(0, 300),
      updatedAt: now,
      sentAt: args.status === "sent" ? now : delivery.sentAt,
    });
    // The batch action calls finalizeCampaign once after its last delivery.
    // Doing it per row would rescan the whole campaign for every recipient.
    return { success: true };
  },
});

/** Finalise a campaign once every delivery has settled. */
export const finalizeCampaign = internalMutation({
  args: { campaignId: v.id("message_campaigns") },
  handler: async (ctx, args) => {
    return await finalizeCampaignImpl(ctx, args.campaignId);
  },
});

/** Safety net: resumes queued external deliveries and finalises stuck runs. */
export const resumeStuck = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const processing = await ctx.db
      .query("message_campaigns")
      .withIndex("by_status_scheduledAt", (q: any) => q.eq("status", "processing"))
      .take(20);

    let resumed = 0;
    for (const campaign of processing) {
      if (campaign.startedAt !== undefined && now - campaign.startedAt < 5 * 60_000) continue;

      // A worker that died between claiming and recording a result leaves the
      // row in `sending`. It is never retried automatically (that could send
      // twice); it is closed as failed so the campaign can finalize honestly.
      const campaignDeliveries = await ctx.db
        .query("campaign_deliveries")
        .withIndex("by_campaign", (q: any) => q.eq("campaignId", campaign._id))
        .collect();
      for (const delivery of campaignDeliveries) {
        if (
          delivery.status === "sending" &&
          now - delivery.updatedAt > 5 * 60_000
        ) {
          await ctx.db.patch(delivery._id, {
            status: "failed",
            error:
              "Delivery attempt was interrupted. Not retried automatically to avoid sending twice.",
            updatedAt: now,
          });
        }
      }
      const queued = await ctx.db
        .query("campaign_deliveries")
        .withIndex("by_campaign_channel_status", (q: any) =>
          q.eq("campaignId", campaign._id).eq("channel", "email").eq("status", "queued")
        )
        .take(20);
      if (queued.length > 0) {
        await ctx.scheduler.runAfter(0, internal.messageDelivery.sendEmailBatch, {
          campaignId: campaign._id,
          deliveryIds: queued.map((d: any) => d._id),
        });
        resumed += 1;
      }
      const queuedWa = await ctx.db
        .query("campaign_deliveries")
        .withIndex("by_campaign_channel_status", (q: any) =>
          q.eq("campaignId", campaign._id).eq("channel", "whatsapp").eq("status", "queued")
        )
        .take(20);
      if (queuedWa.length > 0) {
        await ctx.scheduler.runAfter(0, internal.messageDelivery.sendWhatsAppBatch, {
          campaignId: campaign._id,
          deliveryIds: queuedWa.map((d: any) => d._id),
        });
        resumed += 1;
      }
      await finalizeCampaignImpl(ctx, campaign._id);
    }
    return { resumed };
  },
});

// ══════════════════════════════════════════════════════════════════
//  STATS / FINALISATION
// ══════════════════════════════════════════════════════════════════

async function computeAndStoreStats(ctx: any, campaignId: any) {
  const rows = await ctx.db
    .query("campaign_deliveries")
    .withIndex("by_campaign", (q: any) => q.eq("campaignId", campaignId))
    .collect();

  const count = (channel: string, statuses: string[]) =>
    rows.filter((r: any) => r.channel === channel && statuses.includes(r.status)).length;

  const stats = {
    inAppSent: count("in_app", ["sent", "delivered", "read"]),
    inAppRead: count("in_app", ["read"]),
    popupSent: count("popup", ["sent", "delivered", "read"]),
    popupSeen: count("popup", ["read"]),
    whatsappQueued: count("whatsapp", ["queued", "sending"]),
    whatsappSent: count("whatsapp", ["sent", "delivered", "read"]),
    whatsappDelivered: count("whatsapp", ["delivered"]),
    whatsappFailed: count("whatsapp", ["failed"]),
    emailQueued: count("email", ["queued", "sending"]),
    emailSent: count("email", ["sent", "delivered"]),
    emailDelivered: count("email", ["delivered"]),
    emailFailed: count("email", ["failed"]),
  };

  const recipients = await ctx.db
    .query("campaign_recipients")
    .withIndex("by_campaign", (q: any) => q.eq("campaignId", campaignId))
    .collect();

  await ctx.db.patch(campaignId, {
    stats,
    audienceSize: recipients.length,
    updatedAt: Date.now(),
  });
  return { stats, recipients: recipients.length };
}

async function finalizeCampaignImpl(ctx: any, campaignId: any) {
  const campaign = await ctx.db.get(campaignId);
  if (!campaign) return { finalized: false };
  if (campaign.status !== "processing") return { finalized: false, reason: "not_processing" };

  const pendingRecipients = await ctx.db
    .query("campaign_recipients")
    .withIndex("by_campaign_status", (q: any) =>
      q.eq("campaignId", campaignId).eq("status", "queued")
    )
    .first();
  if (pendingRecipients) return { finalized: false, reason: "recipients_pending" };

  const deliveries = await ctx.db
    .query("campaign_deliveries")
    .withIndex("by_campaign", (q: any) => q.eq("campaignId", campaignId))
    .collect();
  if (deliveries.some((d: any) => d.status === "queued" || d.status === "sending")) {
    return { finalized: false, reason: "deliveries_pending" };
  }

  const { stats, recipients } = await computeAndStoreStats(ctx, campaignId);
  if (recipients === 0) {
    await ctx.db.patch(campaignId, {
      status: "failed",
      completedAt: Date.now(),
      updatedAt: Date.now(),
      stats,
      errorSummary:
        "No eligible registered customers matched this audience when the campaign ran.",
    });
    return { finalized: true, status: "failed" };
  }
  const counts = {
    queued: 0,
    sending: 0,
    sent: deliveries.filter((d: any) => d.status === "sent").length,
    delivered: deliveries.filter((d: any) => d.status === "delivered").length,
    read: deliveries.filter((d: any) => d.status === "read").length,
    failed: deliveries.filter((d: any) => d.status === "failed").length,
    skipped: deliveries.filter((d: any) => d.status === "skipped").length,
  };
  const outcome = campaignOutcome(counts);

  const errors = Array.from(
    new Set(
      deliveries
        .filter((d: any) => d.status === "failed" && d.error)
        .map((d: any) => `${channelLabel(d.channel)}: ${d.error}`)
    )
  ).slice(0, 3);

  // Nobody could be reached (e.g. every customer opted out). This is not a
  // provider failure, so the campaign is complete but the reason is recorded.
  const skippedRecipient = await ctx.db
    .query("campaign_recipients")
    .withIndex("by_campaign_status", (q: any) =>
      q.eq("campaignId", campaignId).eq("status", "skipped")
    )
    .first();
  const unreachableNote =
    deliveries.length === 0 && skippedRecipient
      ? "Completed, but no selected recipient was eligible for any chosen channel."
      : undefined;

  await ctx.db.patch(campaignId, {
    status: outcome,
    completedAt: Date.now(),
    updatedAt: Date.now(),
    errorSummary: errors.length
      ? errors.join(" · ").slice(0, 500)
      : unreachableNote,
    stats,
  });
  return { finalized: true, status: outcome };
}

