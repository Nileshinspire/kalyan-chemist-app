import { httpRouter } from "convex/server";
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

export default http;
