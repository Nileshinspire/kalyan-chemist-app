import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import {
  detectIntent,
  extractMedicineRequest,
  formatAvailabilityMessage,
  formatConfirmationMessage,
  formatDeclineMessage,
  formatGreetingMessage,
  isPositiveResponse,
  isNegativeResponse,
} from "../lib/whatsappParser";

// ══════════════════════════════════════════════════════
//  WHATSAPP BUSINESS API WEBHOOK
//
//  Handles incoming WhatsApp messages and manages the
//  conversational order flow:
//
//  1. Customer sends medicine request
//  2. System checks stock → sends availability
//  3. Customer responds YES/NO
//  4. System confirms order or declines gracefully
//
//  Setup:
//  1. Set WHATSAPP_VERIFY_TOKEN in environment
//  2. Configure webhook URL in WhatsApp Business Manager:
//     https://<convex-deployment>/whatsapp-webhook
//  3. Set WHATSAPP_TOKEN for sending messages
//  4. Set WHATSAPP_PHONE_NUMBER_ID
// ══════════════════════════════════════════════════════

const WHATSAPP_API = "https://graph.facebook.com/v21.0";

function getWhatsAppConfig() {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "kalyan-chemist-whatsapp-verify";
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId, verifyToken };
}

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]/g, "");
  if (/^\d{10}$/.test(cleaned)) {
    cleaned = "91" + cleaned;
  }
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.substring(1);
  }
  return cleaned;
}

/**
 * Send a text message via WhatsApp Business API
 */
async function sendWhatsAppMessage(
  toPhone: string,
  message: string,
): Promise<{ sent: boolean; messageId?: string; error?: string }> {
  const config = getWhatsAppConfig();
  if (!config) {
    console.log("[WhatsApp Webhook] No credentials configured");
    return { sent: false, error: "no_config" };
  }

  const phone = normalizePhone(toPhone);
  if (!phone || phone.length < 12) {
    return { sent: false, error: "invalid_phone" };
  }

  try {
    const response = await fetch(
      `${WHATSAPP_API}/${config.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "text",
          text: { preview_url: false, body: message },
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(`[WhatsApp] Send error: ${response.status} — ${JSON.stringify(data)}`);
      return { sent: false, error: data?.error?.message || "Unknown error" };
    }

    const messageId = data?.messages?.[0]?.id || `wamid_${Date.now()}`;
    console.log(`[WhatsApp] Message sent to ${phone} — ID: ${messageId}`);
    return { sent: true, messageId };
  } catch (error: any) {
    console.error(`[WhatsApp] Send failed: ${error.message}`);
    return { sent: false, error: error.message };
  }
}

/**
 * POST /whatsapp-webhook
 *
 * Receives incoming WhatsApp messages and processes them
 * through the conversational order flow.
 */
export const handleWebhook = httpAction(async (ctx, request) => {
  const url = new URL(request.url);

  // ── Webhook Verification (GET) ──
  if (request.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const config = getWhatsAppConfig();

    if (mode === "subscribe" && token === (config?.verifyToken || "kalyan-chemist-whatsapp-verify")) {
      console.log("[WhatsApp] Webhook verified successfully");
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }

    console.log("[WhatsApp] Webhook verification failed");
    return new Response("Verification failed", { status: 403 });
  }

  // ── Incoming Message (POST) ──
  if (request.method === "POST") {
    try {
      const body = await request.json();

      // Validate the webhook payload
      if (body.object !== "whatsapp_business_account") {
        return new Response("OK", { status: 200 });
      }

      // Extract the message from the webhook payload
      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field !== "messages") continue;

          const value = change.value;
          const messages = value?.messages || [];
          const contacts = value?.contacts || [];

          for (const message of messages) {
            await processIncomingMessage(ctx, message, contacts);
          }
        }
      }

      return new Response("OK", { status: 200 });
    } catch (error: any) {
      console.error(`[WhatsApp Webhook] Error processing: ${error.message}`);
      return new Response("OK", { status: 200 }); // Always return 200 to WhatsApp
    }
  }

  return new Response("Method not allowed", { status: 405 });
});

/**
 * Process an incoming WhatsApp message through the conversational flow
 */
async function processIncomingMessage(
  ctx: any,
  message: any,
  contacts: any[],
): Promise<void> {
  const from = message.from; // Phone number
  const text = message.text?.body || "";
  const messageType = message.type;

  if (!from || !text || messageType !== "text") {
    console.log(`[WhatsApp] Ignoring non-text message from ${from || "unknown"}`);
    return;
  }

  const phone = normalizePhone(from);
  const contact = contacts.find((c: any) => c.wa_id === from);
  const customerName = contact?.profile?.name || undefined;

  console.log(`[WhatsApp] Incoming from ${phone}: "${text}"`);

  // Get or create conversation
  const conversation = await ctx.runMutation(api.whatsappConversations.getOrCreate, {
    phone,
  });

  if (!conversation) {
    console.error(`[WhatsApp] Failed to get/create conversation for ${phone}`);
    return;
  }

  // Detect intent of the message
  const intent = detectIntent(text);

  console.log(`[WhatsApp] Intent detected: ${intent.type} (conversation state: ${conversation.state})`);

  // ── Route based on current conversation state and intent ──

  switch (conversation.state) {
    case "new":
    case "expired":
      await handleNewConversation(ctx, conversation, intent, phone, customerName, text);
      break;

    case "medicine_requested":
    case "availability_sent":
    case "awaiting_response":
      await handleActiveConversation(ctx, conversation, intent, phone, text);
      break;

    case "unavailable":
      // Customer might be asking for an alternative
      await handleUnavailableConversation(ctx, conversation, intent, phone, customerName, text);
      break;

    case "confirmed":
      // Order already confirmed — just log and send polite response
      await ctx.runMutation(api.whatsappConversations.incrementMessage, {
        conversationId: conversation._id,
      });
      await sendWhatsAppMessage(
        phone,
        "Your order has already been confirmed. Our team is processing it. You'll receive updates soon. 📦",
      );
      break;

    case "declined":
      // Customer declined — they might want something new
      await handleNewConversation(ctx, conversation, intent, phone, customerName, text);
      break;

    default:
      console.log(`[WhatsApp] Unknown state: ${conversation.state}`);
      break;
  }
}

/**
 * Handle a new conversation (first message from customer)
 */
async function handleNewConversation(
  ctx: any,
  conversation: any,
  intent: any,
  phone: string,
  customerName: string | undefined,
  rawText: string,
): Promise<void> {
  switch (intent.type) {
    case "medicine_request": {
      // Search for the medicine in the database
      const products = await ctx.runQuery(api.whatsappConversations.searchProducts, {
        searchTerm: intent.medicine,
      });

      if (products && products.length > 0) {
        const product = products[0]; // Best match
        const available = product.stockQuantity >= intent.quantity;
        const price = product.discountPrice || product.price;

        // Update conversation state
        const result = await ctx.runMutation(api.whatsappConversations.updateMedicineRequest, {
          conversationId: conversation._id,
          productName: product.name,
          productId: product._id,
          requestedQuantity: intent.quantity,
          available,
          price,
          prescriptionRequired: product.prescriptionRequired,
          customerName,
          userId: conversation.userId,
        });

        // Log the enquiry
        const enquiry = await ctx.runMutation(api.whatsappEnquiries.log, {
          type: "order",
          customerName,
          customerPhone: phone,
          message: rawText,
          summary: `${available ? "WhatsApp Order" : "Unavailable"} — ${product.name} (Qty: ${intent.quantity})`,
          productId: product._id,
          productName: product.name,
          requestedQuantity: intent.quantity,
          available,
          prescriptionRequired: product.prescriptionRequired,
          totalAmount: price * intent.quantity,
        });

        // Update conversation with enquiry ID
        if (enquiry?.id) {
          await ctx.runMutation(api.whatsappConversations.updateMedicineRequest, {
            conversationId: conversation._id,
            productName: product.name,
            productId: product._id,
            requestedQuantity: intent.quantity,
            available,
            price,
            prescriptionRequired: product.prescriptionRequired,
            enquiryId: enquiry.id,
          });
        }

        // Send availability response
        const responseMsg = formatAvailabilityMessage({
          productName: product.name,
          quantity: intent.quantity,
          available,
          price,
          prescriptionRequired: product.prescriptionRequired,
        });

        await sendWhatsAppMessage(phone, responseMsg);
      } else {
        // Medicine not found
        await ctx.runMutation(api.whatsappConversations.incrementMessage, {
          conversationId: conversation._id,
        });

        await sendWhatsAppMessage(
          phone,
          `🔍 Sorry, we couldn't find "*${intent.medicine}*" in our catalogue.\n\nPlease check the spelling or try a different medicine name. You can also visit our website to browse our full catalogue: kalyanchemist.com`,
        );
      }
      break;
    }

    case "greeting":
      await ctx.runMutation(api.whatsappConversations.incrementMessage, {
        conversationId: conversation._id,
      });
      await sendWhatsAppMessage(phone, formatGreetingMessage());
      break;

    case "positive_response":
    case "negative_response":
      // No context yet — send greeting
      await ctx.runMutation(api.whatsappConversations.incrementMessage, {
        conversationId: conversation._id,
      });
      await sendWhatsAppMessage(phone, formatGreetingMessage());
      break;

    default:
      // Unknown message — try to search for medicine keywords
      await ctx.runMutation(api.whatsappConversations.incrementMessage, {
        conversationId: conversation._id,
      });
      await sendWhatsAppMessage(
        phone,
        `👋 Welcome to *Kalyan Chemist*!\n\nSend us a *medicine name* to check availability, or visit our website: kalyanchemist.com`,
      );
      break;
  }
}

/**
 * Handle messages when a conversation is active (medicine already requested)
 */
async function handleActiveConversation(
  ctx: any,
  conversation: any,
  intent: any,
  phone: string,
  rawText: string,
): Promise<void> {
  // Check if customer is requesting a different medicine
  if (intent.type === "medicine_request") {
    // Check if it's the same medicine (maybe confirming) or a new one
    const products = await ctx.runQuery(api.whatsappConversations.searchProducts, {
      searchTerm: intent.medicine,
    });

    if (products && products.length > 0) {
      const product = products[0];

      // If it's a different product, treat as a new medicine request
      if (product._id !== conversation.productId) {
        const available = product.stockQuantity >= intent.quantity;
        const price = product.discountPrice || product.price;

        await ctx.runMutation(api.whatsappConversations.updateMedicineRequest, {
          conversationId: conversation._id,
          productName: product.name,
          productId: product._id,
          requestedQuantity: intent.quantity,
          available,
          price,
          prescriptionRequired: product.prescriptionRequired,
        });

        const responseMsg = formatAvailabilityMessage({
          productName: product.name,
          quantity: intent.quantity,
          available,
          price,
          prescriptionRequired: product.prescriptionRequired,
        });

        await sendWhatsAppMessage(phone, responseMsg);
        return;
      }

      // Same product — maybe customer is confirming quantity change
      if (intent.quantity !== conversation.requestedQuantity) {
        const available = product.stockQuantity >= intent.quantity;
        const price = product.discountPrice || product.price;

        await ctx.runMutation(api.whatsappConversations.updateMedicineRequest, {
          conversationId: conversation._id,
          productName: product.name,
          productId: product._id,
          requestedQuantity: intent.quantity,
          available,
          price,
          prescriptionRequired: product.prescriptionRequired,
        });

        const responseMsg = formatAvailabilityMessage({
          productName: product.name,
          quantity: intent.quantity,
          available,
          price,
          prescriptionRequired: product.prescriptionRequired,
        });

        await sendWhatsAppMessage(phone, responseMsg);
        return;
      }
    }
  }

  // If medicine is available and customer says YES → confirm order
  if (conversation.available && isPositiveResponse(rawText.trim())) {
    // Double-check stock before confirming
    if (conversation.productId) {
      const product = await ctx.runQuery(api.whatsappConversations.getProduct, {
        productId: conversation.productId,
      });

      if (!product || product.stockQuantity < (conversation.requestedQuantity ?? 1)) {
        // Stock went out of stock since availability check
        await ctx.runMutation(api.whatsappConversations.updateMedicineRequest, {
          conversationId: conversation._id,
          productName: conversation.productName || "",
          productId: conversation.productId,
          requestedQuantity: conversation.requestedQuantity ?? 1,
          available: false,
          price: conversation.price,
          prescriptionRequired: conversation.prescriptionRequired,
        });

        await sendWhatsAppMessage(
          phone,
          `💊 *Sorry, the requested medicine or quantity is currently unavailable at Kalyan Chemist.*\n\nPlease let us know if you'd like an alternative or another quantity.`,
        );
        return;
      }
    }

    // Confirm the order
    const result = await ctx.runMutation(api.whatsappConversations.confirmOrder, {
      conversationId: conversation._id,
    });

    if (result.success) {
      // Send confirmation message
      const confirmMsg = formatConfirmationMessage({
        productName: conversation.productName || "your medicine",
        quantity: conversation.requestedQuantity ?? 1,
        price: conversation.price,
      });
      await sendWhatsAppMessage(phone, confirmMsg);

      // Update the enquiry record as confirmed
      if (conversation.enquiryId) {
        try {
          await ctx.runMutation(api.whatsappEnquiries.confirmWhatsAppOrder, {
            enquiryId: conversation.enquiryId,
            adminNotes: "Order auto-confirmed via WhatsApp conversational flow",
          });
        } catch (e: any) {
          console.log(`[WhatsApp] Failed to update enquiry: ${e.message}`);
        }
      }
    } else if (result.reason === "out_of_stock") {
      await sendWhatsAppMessage(
        phone,
        `💊 *Sorry, the requested medicine or quantity has become unavailable.*\n\nPlease let us know if you'd like an alternative or another quantity.`,
      );
    }
    return;
  }

  // If medicine is unavailable and customer says something → offer alternatives
  if (conversation.state === "unavailable" || !conversation.available) {
    if (isNegativeResponse(rawText.trim())) {
      await ctx.runMutation(api.whatsappConversations.declineOrder, {
        conversationId: conversation._id,
      });
      await sendWhatsAppMessage(phone, formatDeclineMessage());
      return;
    }
  }

  // If customer says NO → decline
  if (isNegativeResponse(rawText.trim())) {
    await ctx.runMutation(api.whatsappConversations.declineOrder, {
      conversationId: conversation._id,
    });
    await sendWhatsAppMessage(phone, formatDeclineMessage());
    return;
  }

  // If medicine is available but response is unclear → prompt again
  if (conversation.available) {
    await ctx.runMutation(api.whatsappConversations.incrementMessage, {
      conversationId: conversation._id,
    });
    await sendWhatsAppMessage(
      phone,
      `Would you like to place the order for *${conversation.productName}* (Qty: ${conversation.requestedQuantity ?? 1})?\n\nReply *Yes* to confirm or *No* to decline.`,
    );
    return;
  }

  // Medicine unavailable, unclear response
  await ctx.runMutation(api.whatsappConversations.incrementMessage, {
    conversationId: conversation._id,
  });
  await sendWhatsAppMessage(
    phone,
    `Would you like to try a different medicine or quantity? Send us the name and we'll check availability.`,
  );
}

/**
 * Handle conversation when medicine was unavailable
 */
async function handleUnavailableConversation(
  ctx: any,
  conversation: any,
  intent: any,
  phone: string,
  customerName: string | undefined,
  rawText: string,
): Promise<void> {
  // If they're requesting a new medicine
  if (intent.type === "medicine_request") {
    const products = await ctx.runQuery(api.whatsappConversations.searchProducts, {
      searchTerm: intent.medicine,
    });

    if (products && products.length > 0) {
      const product = products[0];
      const available = product.stockQuantity >= intent.quantity;
      const price = product.discountPrice || product.price;

      await ctx.runMutation(api.whatsappConversations.updateMedicineRequest, {
        conversationId: conversation._id,
        productName: product.name,
        productId: product._id,
        requestedQuantity: intent.quantity,
        available,
        price,
        prescriptionRequired: product.prescriptionRequired,
      });

      const responseMsg = formatAvailabilityMessage({
        productName: product.name,
        quantity: intent.quantity,
        available,
        price,
        prescriptionRequired: product.prescriptionRequired,
      });

      await sendWhatsAppMessage(phone, responseMsg);
      return;
    }

    // Medicine not found
    await ctx.runMutation(api.whatsappConversations.incrementMessage, {
      conversationId: conversation._id,
    });
    await sendWhatsAppMessage(
      phone,
      `🔍 Sorry, we couldn't find "*${intent.medicine}*" in our catalogue.\n\nPlease check the spelling or try a different medicine name.`,
    );
    return;
  }

  // Positive response in unavailable state — doesn't make sense, redirect
  if (isPositiveResponse(rawText.trim())) {
    await ctx.runMutation(api.whatsappConversations.incrementMessage, {
      conversationId: conversation._id,
    });
    await sendWhatsAppMessage(
      phone,
      `The earlier medicine was unavailable. Would you like to try a different medicine or quantity?`,
    );
    return;
  }

  // Negative response — close conversation
  if (isNegativeResponse(rawText.trim())) {
    await ctx.runMutation(api.whatsappConversations.declineOrder, {
      conversationId: conversation._id,
    });
    await sendWhatsAppMessage(phone, formatDeclineMessage());
    return;
  }

  // Greeting or unknown — offer help
  await ctx.runMutation(api.whatsappConversations.incrementMessage, {
    conversationId: conversation._id,
  });
  await sendWhatsAppMessage(
    phone,
    `Send us a *medicine name* to check availability, or let us know how we can help!`,
  );
}
