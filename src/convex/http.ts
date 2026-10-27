import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
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
