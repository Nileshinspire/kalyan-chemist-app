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
  | { ok: false; error: string; retryable: boolean };

async function sendEmail(
  payload: any
): Promise<AttemptResult> {
  if (!payload.userEmail) {
    return { ok: false, retryable: false, error: "No email address on file." };
  }
  if (payload.prefs) {
    if (payload.prefs.email === false || payload.prefs.promotional === false) {
      return { ok: false, retryable: false, error: "Recipient opted out of email." };
    }
    if (payload.prefs.unsubscribedAt) {
      return { ok: false, retryable: false, error: "Recipient unsubscribed." };
    }
  }

  const link = unsubscribeUrl(payload.prefs?.unsubscribeToken);
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
    return await sendViaResend(apiKey, payload, html, text, link);
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
  link: string
): Promise<AttemptResult> {
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  let lastError = "Email provider rejected the request.";
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result: any = await resend.emails.send({
        from: fromAddress(),
        to: payload.userEmail,
        subject: payload.title,
        html,
        text,
        headers: {
          "List-Unsubscribe": `<${link}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });

      if (result?.error) {
        const status = Number(result.error.statusCode ?? 0);
        lastError = sanitizeError(result.error);
        const retryable = status === 429 || status >= 500;
        if (retryable && attempt < 2) {
          await sleep(1200);
          continue;
        }
        return { ok: false, retryable: false, error: lastError };
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
    return { ok: false, retryable: false, error: "No valid WhatsApp phone number on file." };
  }
  if (payload.whatsappOptIn !== true) {
    return { ok: false, retryable: false, error: "Customer has not opted in to WhatsApp." };
  }
  if (payload.prefs?.whatsapp === false) {
    return { ok: false, retryable: false, error: "Customer disabled WhatsApp messages." };
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
          retryable: false,
          error: sanitizeError(message),
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

    const result =
      channel === "email" ? await sendEmail(payload) : await sendWhatsApp(payload);

    if (result.ok) {
      await ctx.runMutation(internal.messageDispatch.markDelivery, {
        deliveryId: payload.deliveryId,
        status: "sent",
        providerMessageId: result.providerMessageId,
        providerStatus: result.providerStatus ?? "accepted",
      });
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
