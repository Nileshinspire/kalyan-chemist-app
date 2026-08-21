import { httpRouter } from "convex/server";
import { handleWebhook } from "./whatsappWebhook";

const http = httpRouter();

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
