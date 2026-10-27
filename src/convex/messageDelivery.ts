"use node";

/**
 * External channel delivery for the Message Center.
 *
 * Credentials live only in server environment variables. Every attempt claims
 * its delivery row first, so retries and overlapping batches cannot send the
 * same message twice. Provider results are recorded exactly as reported —
 * "sent" means the provider accepted the request, never "delivered".
 */
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import {
  buildCampaignEmailHtml,
  isValidEmail,
  MAX_DELIVERY_ATTEMPTS,
  normalizePhone,
  plainTextEmail,
  whatsappTemplateParams,
} from "./messageCenterCore";

const WHATSAPP_API = "https://graph.facebook.com/v21.0";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function fromAddress() {
  return process.env.RESEND_FROM_EMAIL || "Kalyan Chemist <notifications@kalyanchemist.com>";
}

function unsubscribeUrl(token: string | null | undefined) {
  if (!token) return "https://kalyanchemist.com/#/account/notifications";
  return `https://kalyanchemist.com/#/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * RFC 8058 endpoint. Only advertised when Convex exposes its HTTP site URL;
 * otherwise the header would point at a page that cannot accept a POST.
 */
function oneClickUnsubscribeUrl(token: string | null | undefined) {
  const site = process.env.CONVEX_SITE_URL;
  if (!site || !token) return null;
  return `${site.replace(/\/$/, "")}/unsubscribe?token=${encodeURIComponent(token)}`;
}

function sanitizeError(value: unknown): string {
  const text =
    typeof value === "string"
      ? value
      : value && typeof value === "object" && "message" in value
        ? String((value as any).message)
        : "Delivery failed.";
  // Keep provider codes but never retain email addresses or phone numbers.
  return text
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, "[email]")
    .replace(/\+?\d{10,15}/g, "[number]")
    .slice(0, 280);
}

type AttemptResult =
  | { ok: true; providerMessageId?: string; providerStatus?: string }
  | {
      ok: false;
      error: string;
      /** True for temporary failures the worker may retry. */
      retryable: boolean;
      /**
       * True when the recipient cannot/should not receive this message
       * (consent, opt-out, missing address). This is not a provider failure,
       * so it is recorded as "skipped" rather than inflating failure counts.
       */
      skipped?: boolean;
    };

async function sendEmail(
  payload: any
): Promise<AttemptResult> {
  if (!payload.userEmail) {
    return {
      ok: false,
      retryable: false,
      skipped: true,
      error: "No email address on file.",
    };
  }
  if (payload.prefs) {
    if (payload.prefs.email === false || payload.prefs.promotional === false) {
      return {
        ok: false,
        retryable: false,
        skipped: true,
        error: "Recipient opted out of email.",
      };
    }
    if (payload.prefs.unsubscribedAt) {
      return {
        ok: false,
        retryable: false,
        skipped: true,
        error: "Recipient unsubscribed.",
      };
    }
  }

  const link = unsubscribeUrl(payload.prefs?.unsubscribeToken);
  const oneClickLink = oneClickUnsubscribeUrl(payload.prefs?.unsubscribeToken);
  const html = buildCampaignEmailHtml({
    title: payload.title,
    body: payload.body,
    category: payload.category,
    imageUrl: payload.imageUrl ?? undefined,
    unsubscribeUrl: link,
  });
  const text = plainTextEmail({
    title: payload.title,
    body: payload.body,
    unsubscribeUrl: link,
  });

  // Prefer the project's own Resend account when configured; otherwise send
  // through the built-in integration gateway (the same VLY_INTEGRATION_KEY that
  // delivers sign-in codes), so email works without separate credentials.
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    return await sendViaResend(apiKey, payload, html, text, link, oneClickLink);
  }
  if (process.env.VLY_INTEGRATION_KEY) {
    return await sendViaGateway(payload, html, text);
  }
  return {
    ok: false,
    retryable: false,
    error:
      "Email is not configured (set RESEND_API_KEY or the built-in VLY_INTEGRATION_KEY).",
  };
}

async function sendViaResend(
  apiKey: string,
  payload: any,
  html: string,
  text: string,
  link: string,
  oneClickLink: string | null
): Promise<AttemptResult> {
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  let lastError = "Email provider rejected the request.";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const headers: Record<string, string> = {
        "List-Unsubscribe": `<${oneClickLink ?? link}>`,
      };
      if (oneClickLink) {
        headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
      }

      const result: any = await resend.emails.send({
        from: fromAddress(),
        to: payload.userEmail,
        subject: payload.title,
        html,
        text,
        headers,
      });

      if (result?.error) {
        const status = Number(result.error.statusCode ?? 0);
        lastError = sanitizeError(result.error);
        const retryable = status === 429 || status >= 500;
        if (retryable && attempt < 2) {
          await sleep(1200);
          continue;
        }
        // Only an explicit rate-limit response is safe to retry later: the
        // provider rejected it without queueing a message. A 5xx response is
        // ambiguous, so it is surfaced as a failure instead of risking a
        // duplicate email.
        return {
          ok: false,
          retryable: status === 429,
          error:
            status === 429
              ? `${lastError} Rate limited; a later attempt will be scheduled.`
              : lastError,
        };
      }

      return {
        ok: true,
        providerMessageId: result?.data?.id ? String(result.data.id) : undefined,
        providerStatus: "accepted",
      };
    } catch (error: any) {
      // A thrown request is ambiguous: the provider may already have queued it.
      // Do not retry automatically, to avoid a duplicate email.
      return {
        ok: false,
        retryable: false,
        error: `Provider request failed (${sanitizeError(error)}). Not retried to avoid duplicates.`,
      };
    }
  }
  return { ok: false, retryable: false, error: lastError };
}

/**
 * Fallback transport: the project's integration gateway. It owns the sending
 * identity, so no custom `from` is passed (an unverified domain would bounce).
 * The API exposes no HTTP status, so a failed call is never auto-retried.
 */
async function sendViaGateway(
  payload: any,
  html: string,
  text: string
): Promise<AttemptResult> {
  try {
    const { vly } = await import("../lib/vly-integrations");
    const result = await vly.email.send({
      to: payload.userEmail,
      subject: payload.title,
      html,
      text,
    });
    if (result.success && result.data?.status !== "failed") {
      const id = result.data?.messageId || result.data?.id;
      return {
        ok: true,
        providerMessageId: id ? String(id) : undefined,
        providerStatus: result.data?.status ?? "accepted",
      };
    }
    return {
      ok: false,
      retryable: false,
      error: sanitizeError(
        result.error || result.data?.error || "Email gateway rejected the request."
      ),
    };
  } catch (error: any) {
    return {
      ok: false,
      retryable: false,
      error: `Email gateway request failed (${sanitizeError(error)}). Not retried to avoid duplicates.`,
    };
  }
}

async function sendWhatsApp(payload: any): Promise<AttemptResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const templateName = process.env.WHATSAPP_CAMPAIGN_TEMPLATE_NAME;
  const language = process.env.WHATSAPP_CAMPAIGN_TEMPLATE_LANG || "en";

  if (!token || !phoneNumberId) {
    return {
      ok: false,
      retryable: false,
      error: "WhatsApp is not configured (WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID missing).",
    };
  }
  if (!templateName) {
    return {
      ok: false,
      retryable: false,
      error: "No approved WhatsApp campaign template configured.",
    };
  }
  const to = normalizePhone(payload.userPhone);
  if (!to) {
    return {
      ok: false,
      retryable: false,
      skipped: true,
      error: "No valid WhatsApp phone number on file.",
    };
  }
  if (payload.whatsappOptIn !== true) {
    return {
      ok: false,
      retryable: false,
      skipped: true,
      error: "Customer has not opted in to WhatsApp.",
    };
  }
  if (payload.prefs?.whatsapp === false) {
    return {
      ok: false,
      retryable: false,
      skipped: true,
      error: "Customer disabled WhatsApp messages.",
    };
  }

  const params = whatsappTemplateParams(payload.title, payload.body);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(`${WHATSAPP_API}/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: templateName,
            language: { code: language },
            components: [
              {
                type: "body",
                parameters: [
                  { type: "text", text: params[0] },
                  { type: "text", text: params[1] },
                ],
              },
            ],
          },
        }),
      });

      let data: any = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }

      if (!response.ok) {
        const message =
          data?.error?.message ||
          `WhatsApp API error (HTTP ${response.status})`;
        // 429 and 5xx are safe to retry: the provider rejected the request.
        if ((response.status === 429 || response.status >= 500) && attempt < 2) {
          await sleep(1500);
          continue;
        }
        return {
          ok: false,
          // A 429 is rejected, never queued; 5xx may be ambiguous, so it is not
          // retried automatically to avoid sending the same template twice.
          retryable: response.status === 429,
          error:
            response.status === 429
              ? `${sanitizeError(message)} Rate limited; a later attempt will be scheduled.`
              : sanitizeError(message),
        };
      }

      const messageId = data?.messages?.[0]?.id;
      return {
        ok: true,
        providerMessageId: messageId ? String(messageId) : undefined,
        providerStatus: "accepted",
      };
    } catch (error: any) {
      return {
        ok: false,
        retryable: false,
        error: `WhatsApp request failed (${sanitizeError(error)}). Not retried to avoid duplicates.`,
      };
    }
  }
  return { ok: false, retryable: false, error: "WhatsApp delivery failed." };
}

async function runBatch(
  ctx: any,
  channel: "email" | "whatsapp",
  args: { campaignId: any; deliveryIds: any[] }
) {
  const payloads: any[] = await ctx.runQuery(
    internal.messageDispatch.getDeliveryPayloads,
    { deliveryIds: args.deliveryIds }
  );

  let attempted = 0;
  for (const payload of payloads) {
    const claim = await ctx.runMutation(internal.messageDispatch.beginDelivery, {
      deliveryId: payload.deliveryId,
    });
    if (!claim.claimed) continue;
    attempted += 1;

    // A single unexpected provider/transport exception must not abandon the
    // rest of the batch: record it against this delivery and keep going.
    let result: AttemptResult;
    try {
      result =
        channel === "email" ? await sendEmail(payload) : await sendWhatsApp(payload);
    } catch (error: any) {
      result = {
        ok: false,
        retryable: false,
        error: `Unexpected delivery error (${sanitizeError(error)}).`,
      };
    }

    if (result.ok) {
      await ctx.runMutation(internal.messageDispatch.markDelivery, {
        deliveryId: payload.deliveryId,
        status: "sent",
        providerMessageId: result.providerMessageId,
        providerStatus: result.providerStatus ?? "accepted",
      });
    } else if (result.skipped) {
      await ctx.runMutation(internal.messageDispatch.markDelivery, {
        deliveryId: payload.deliveryId,
        status: "skipped",
        error: result.error,
      });
    } else if (result.retryable && claim.attempt < MAX_DELIVERY_ATTEMPTS) {
      // Backoff: 1 min, then 2 min. The row returns to the queue and is
      // claimed atomically again, so overlapping workers cannot double-send.
      const waitMs = Math.min(60_000 * 2 ** (claim.attempt - 1), 5 * 60_000);
      const retryArgs = {
        campaignId: payload.campaignId,
        deliveryIds: [payload.deliveryId],
      };
      await ctx.runMutation(internal.messageDispatch.markDelivery, {
        deliveryId: payload.deliveryId,
        status: "queued",
        error: `${result.error} Retrying in ${Math.round(waitMs / 60_000)} min.`,
      });
      await ctx.scheduler.runAfter(
        waitMs,
        channel === "email"
          ? internal.messageDelivery.sendEmailBatch
          : internal.messageDelivery.sendWhatsAppBatch,
        retryArgs
      );
    } else {
      await ctx.runMutation(internal.messageDispatch.markDelivery, {
        deliveryId: payload.deliveryId,
        status: "failed",
        error: result.error,
      });
    }

    // Gentle pacing keeps large campaigns inside provider rate limits
    // (Resend's default is 2 requests/second; WhatsApp is similar per number).
    await sleep(channel === "email" ? 550 : 220);
  }

  await ctx.runMutation(internal.messageDispatch.finalizeCampaign, {
    campaignId: args.campaignId,
  });
  return { attempted, total: payloads.length };
}

export const sendEmailBatch = internalAction({
  args: {
    campaignId: v.id("message_campaigns"),
    deliveryIds: v.array(v.id("campaign_deliveries")),
  },
  handler: async (ctx, args) => {
    return await runBatch(ctx, "email", args);
  },
});

export const sendWhatsAppBatch = internalAction({
  args: {
    campaignId: v.id("message_campaigns"),
    deliveryIds: v.array(v.id("campaign_deliveries")),
  },
  handler: async (ctx, args) => {
    return await runBatch(ctx, "whatsapp", args);
  },
});

/**
 * Test send to one explicitly entered recipient.
 *
 * This never resolves an audience: the address/number in the request is the
 * only destination, so a test can never reach the full customer list. Admin
 * identity is re-checked server-side and sends are rate limited per admin.
 */
export const sendTestMessage = action({
  args: {
    channel: v.union(v.literal("email"), v.literal("whatsapp")),
    recipient: v.string(),
    title: v.string(),
    body: v.string(),
    category: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.runQuery(internal.messageCenter.adminIdentity, {});
    const recent = await ctx.runQuery(internal.messageCampaigns.recentTestSendCount, {
      actorId: identity.userId,
    });
    if (recent >= 5) {
      throw new Error(
        "Test limit reached (5 in 10 minutes). Please wait before sending another test."
      );
    }

    const title = args.title.trim();
    const body = args.body.trim();
    if (title.length < 3 || body.length < 3) {
      throw new Error("Add a title and message before sending a test.");
    }
    const recipient = args.recipient.trim();
    if (args.channel === "email" && !isValidEmail(recipient)) {
      throw new Error("Enter a valid email address for the test.");
    }
    if (args.channel === "whatsapp" && !normalizePhone(recipient)) {
      throw new Error("Enter a valid mobile number for the test.");
    }

    const payload = {
      userEmail: args.channel === "email" ? recipient : null,
      userPhone: args.channel === "whatsapp" ? recipient : null,
      whatsappOptIn: true,
      prefs: null,
      title,
      body,
      category: args.category,
      imageUrl: args.imageUrl ?? null,
    };

    const result =
      args.channel === "email" ? await sendEmail(payload) : await sendWhatsApp(payload);

    await ctx.runMutation(internal.campaignAudit.record, {
      action: "test_send",
      actorId: identity.userId,
      actorName: identity.name,
      detail: `Test ${args.channel} sent to a manually entered recipient.`,
    });

    return result.ok
      ? {
          success: true as const,
          providerMessageId: result.providerMessageId ?? null,
          providerStatus: result.providerStatus ?? "accepted",
        }
      : { success: false as const, error: result.error };
  },
});

/**
 * Live connection check for the admin UI. Never claims messages can be sent if
 * credentials are absent, and reports provider rejections verbatim (sanitised).
 */
export const verifyIntegrations = action({
  args: {},
  handler: async (ctx) => {
    const isAdmin: boolean = await ctx.runQuery(internal.messageCenter.adminGuard, {});
    if (!isAdmin) throw new Error("Unauthorized: admin only");

    const result: {
      email: { configured: boolean; verified: boolean; detail: string };
      whatsapp: { configured: boolean; verified: boolean; detail: string };
      checkedAt: number;
    } = {
      email: { configured: false, verified: false, detail: "" },
      whatsapp: { configured: false, verified: false, detail: "" },
      checkedAt: Date.now(),
    };

    // ── Email: the project's Resend account, or the built-in gateway ──
    const resendKey = process.env.RESEND_API_KEY;
    const gatewayKey = process.env.VLY_INTEGRATION_KEY;
    if (!resendKey && gatewayKey) {
      try {
        const { vly } = await import("../lib/vly-integrations");
        const domains: any = await vly.email.listDomains();
        if (domains?.success) {
          const list: any[] = Array.isArray(domains.data) ? domains.data : [];
          const verified = list.find((d: any) => d.verified);
          result.email = {
            configured: true,
            verified: true,
            detail: verified
              ? `Built-in email gateway connected (sending domain: ${verified.domain}).`
              : "Built-in email gateway connected. No further setup is required.",
          };
        } else {
          result.email = {
            configured: true,
            verified: false,
            detail: sanitizeError(
              domains?.error ?? "The email gateway did not respond."
            ),
          };
        }
      } catch (error: any) {
        result.email = {
          configured: true,
          verified: false,
          detail: sanitizeError(error),
        };
      }
    } else if (!resendKey) {
      result.email = {
        configured: false,
        verified: false,
        detail:
          "Set RESEND_API_KEY (your own Resend account) or VLY_INTEGRATION_KEY (built-in gateway).",
      };
    } else {
      try {
        const { Resend } = await import("resend");
        const resend = new Resend(resendKey);
        const domains: any = await resend.domains.list();
        if (domains?.error) {
          result.email = {
            configured: true,
            verified: false,
            detail: sanitizeError(domains.error),
          };
        } else {
          const list: any[] = domains?.data?.data ?? domains?.data ?? [];
          const verified = list.find((d: any) => d.status === "verified");
          result.email = {
            configured: true,
            verified: Boolean(verified),
            detail: verified
              ? `Verified sending domain: ${verified.name}`
              : "API key accepted, but no verified sending domain found.",
          };
        }
      } catch (error: any) {
        result.email = {
          configured: true,
          verified: false,
          detail: sanitizeError(error),
        };
      }
    }

    // ── WhatsApp Cloud API ──
    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const templateName = process.env.WHATSAPP_CAMPAIGN_TEMPLATE_NAME;
    if (!token || !phoneNumberId) {
      result.whatsapp = {
        configured: false,
        verified: false,
        detail: "WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required.",
      };
    } else {
      try {
        const response = await fetch(
          `${WHATSAPP_API}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data: any = await response.json().catch(() => null);
        if (!response.ok) {
          result.whatsapp = {
            configured: true,
            verified: false,
            detail: sanitizeError(data?.error?.message ?? `HTTP ${response.status}`),
          };
        } else {
          result.whatsapp = {
            configured: true,
            verified: Boolean(templateName),
            detail: templateName
              ? `Connected to ${data?.verified_name ?? "WhatsApp Business"} (${data?.display_phone_number ?? "number hidden"}). Template "${templateName}" must be approved in Meta Business Manager.`
              : "Connected, but no WHATSAPP_CAMPAIGN_TEMPLATE_NAME is configured.",
          };
        }
      } catch (error: any) {
        result.whatsapp = {
          configured: true,
          verified: false,
          detail: sanitizeError(error),
        };
      }
    }

    return result;
  },
});
