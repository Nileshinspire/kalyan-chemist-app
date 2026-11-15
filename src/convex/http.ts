import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { auth } from "./auth";
import { handleWebhook } from "./whatsappWebhook";

const http = httpRouter();

// ── Convex Auth routes (OIDC discovery, JWT validation, session management) ──
// This serves /.well-known/openid-configuration and validates JWTs.
// Required for email-otp and anonymous auth to function correctly.
auth.addHttpRoutes(http);

// ── WhatsApp Business API Webhook ──
// GET  /whatsapp-webhook — Verification handshake
// POST /whatsapp-webhook — Incoming messages
http.route({
  path: "/whatsapp-webhook",
  method: "GET",
  handler: handleWebhook,
});

http.route({
  path: "/whatsapp-webhook",
  method: "POST",
  handler: handleWebhook,
});

// ── Third-party courier webhook ──
// POST /courier-webhook with header `x-courier-secret` matching
// COURIER_WEBHOOK_SECRET. Body: { awb, status, provider?, eventId?, note?, occurredAt? }.
// Only verified callbacks are applied; no tracking data is generated locally.
http.route({
  path: "/courier-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.COURIER_WEBHOOK_SECRET;
    if (!secret) {
      return Response.json(
        {
          error:
            "Courier webhook is not configured. Set COURIER_WEBHOOK_SECRET to enable verified courier updates.",
        },
        { status: 501 },
      );
    }
    if (request.headers.get("x-courier-secret") !== secret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const payload =
      body && typeof body === "object"
        ? (body as Record<string, unknown>)
        : {};

    const awb =
      typeof payload.awb === "string" ? payload.awb.trim() : "";
    const status =
      typeof payload.status === "string" ? payload.status.trim() : "";
    if (!awb || !status) {
      return Response.json(
        { error: "Both awb and status are required" },
        { status: 400 },
      );
    }

    try {
      const result = await ctx.runMutation(internal.courier.applyCourierEvent, {
        awb,
        status,
        provider:
          typeof payload.provider === "string" ? payload.provider : undefined,
        eventId:
          typeof payload.eventId === "string" ? payload.eventId : undefined,
        note: typeof payload.note === "string" ? payload.note : undefined,
        occurredAt:
          typeof payload.occurredAt === "number"
            ? payload.occurredAt
            : undefined,
      });
      return Response.json(result);
    } catch (error: unknown) {
      return Response.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Could not apply the courier event",
        },
        { status: 400 },
      );
    }
  }),
});

// ── RFC 8058 one-click unsubscribe ──
// Mail clients POST here (no browser session). Uses the same token lookup as
// the account page; no personal information is returned in the response.
http.route({
  path: "/unsubscribe",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    let token = url.searchParams.get("token") ?? "";

    if (!token) {
      const contentType = request.headers.get("content-type") ?? "";
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const form = await request.formData();
        token = String(form.get("token") ?? "");
      }
    }

    const result = await ctx.runMutation(api.messageCenter.unsubscribeByToken, {
      token,
    });

    return new Response(
      result.success
        ? "You have been unsubscribed from promotional email."
        : "This unsubscribe link is not valid.",
      {
        status: result.success ? 200 : 400,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  }),
});

export default http;
