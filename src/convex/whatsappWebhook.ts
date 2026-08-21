import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import {
  detectIntent,
  extractMedicineRequest,
  formatAvailabilityMessage,
  formatAddressRequestMessage,
  formatIncompleteAddressMessage,
  formatQuantityRequestMessage,
  formatAddMoreMedicinesMessage,
  formatOrderSummaryMessage,
  formatConfirmationMessage,
  formatDeclineMessage,
  formatGreetingMessage,
  isPositiveResponse,
  isNegativeResponse,
  type MessageIntent,
} from "../lib/whatsappParser";

// ══════════════════════════════════════════════════════
//  WHATSAPP BUSINESS API WEBHOOK
//
//  Full conversational order flow:
//
//  1. Customer sends greeting → Welcome message
//  2. Customer sends medicine name(s) → Search DB → Ask for address
//  3. Customer sends address → Validate completeness → Ask for quantity
//  4. Customer sends quantity → Check stock → Send order summary
//  5. Customer confirms (YES) → Create order → Send confirmation
//  6. Customer declines (NO) → Send goodbye
//
//  Multi-medicine: Customer can add more medicines before confirmation.
//
//  Setup:
//  1. Set WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID in environment
//  2. Configure webhook URL in WhatsApp Business Manager:
//     https://<convex-deployment>/whatsapp-webhook
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
    console.log("[WhatsApp Webhook] No credentials configured — message not sent");
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

      if (body.object !== "whatsapp_business_account") {
        return new Response("OK", { status: 200 });
      }

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
      return new Response("OK", { status: 200 });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});

/**
 * Process an incoming WhatsApp message through the full conversational flow
 */
async function processIncomingMessage(
  ctx: any,
  message: any,
  contacts: any[],
): Promise<void> {
  const from = message.from;
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

  // Detect intent
  const intent = detectIntent(text);

  console.log(`[WhatsApp] Intent: ${intent.type} | State: ${conversation.state}`);

  // ── Route based on conversation state and intent ──

  switch (conversation.state) {
    case "new":
    case "expired":
      await handleNewConversation(ctx, conversation, intent, phone, customerName, text);
      break;

    case "medicine_requested":
      // Customer sent medicine → now ask for address
      await handleMedicineRequested(ctx, conversation, intent, phone, customerName, text);
      break;

    case "availability_sent":
    case "awaiting_response":
      // Customer responding to availability — YES/NO or new medicine
      await handleAvailabilityResponse(ctx, conversation, intent, phone, text);
      break;

    case "awaiting_address":
      // Waiting for address
      await handleAwaitingAddress(ctx, conversation, intent, phone, text);
      break;

    case "address_received":
      // Address received — ask for quantity
      await handleAddressReceived(ctx, conversation, intent, phone, text);
      break;

    case "awaiting_quantity":
      // Waiting for quantity
      await handleAwaitingQuantity(ctx, conversation, intent, phone, text);
      break;

    case "add_more_medicines":
      // Customer can add more medicines or say done
      await handleAddMoreMedicines(ctx, conversation, intent, phone, customerName, text);
      break;

    case "order_summary":
      // Waiting for final YES/NO
      await handleOrderSummary(ctx, conversation, intent, phone, text);
      break;

    case "unavailable":
      await handleUnavailableConversation(ctx, conversation, intent, phone, customerName, text);
      break;

    case "confirmed":
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

// ══════════════════════════════════════════════════════
//  STATE HANDLERS
// ══════════════════════════════════════════════════════

/**
 * Handle a new conversation (first message)
 */
async function handleNewConversation(
  ctx: any,
  conversation: any,
  intent: MessageIntent,
  phone: string,
  customerName: string | undefined,
  rawText: string,
): Promise<void> {
  switch (intent.type) {
    case "medicine_request": {
      await processMedicineRequest(ctx, conversation, intent, phone, customerName, rawText);
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
      await ctx.runMutation(api.whatsappConversations.incrementMessage, {
        conversationId: conversation._id,
      });
      await sendWhatsAppMessage(phone, formatGreetingMessage());
      break;

    default:
      await ctx.runMutation(api.whatsappConversations.incrementMessage, {
        conversationId: conversation._id,
      });
      await sendWhatsAppMessage(
        phone,
        `👋 Welcome to *Kalyan Chemist*!\n\nPlease share your *prescription* or type the *name of the medicine(s)* you need.`,
      );
      break;
  }
}

/**
 * Handle when medicine was requested (medicine_requested state)
 */
async function handleMedicineRequested(
  ctx: any,
  conversation: any,
  intent: MessageIntent,
  phone: string,
  customerName: string | undefined,
  rawText: string,
): Promise<void> {
  // If they're sending another medicine, add it
  if (intent.type === "medicine_request") {
    await processMedicineRequest(ctx, conversation, intent, phone, customerName, rawText);
    return;
  }

  // If they're responding to availability (already got medicine) — route to address
  if (intent.type === "address_message") {
    // They're providing an address — good, process it
    await processAddress(ctx, conversation, intent, phone);
    return;
  }

  // If positive, redirect to address
  if (isPositiveResponse(rawText.trim())) {
    // Check if we already have the medicine context
    if (conversation.productName) {
      // Ask for address
      await ctx.runMutation(api.whatsappConversations.incrementMessage, {
        conversationId: conversation._id,
      });
      await sendWhatsAppMessage(
        phone,
        formatAddressRequestMessage({
          productName: conversation.productName,
          quantity: conversation.requestedQuantity || 1,
          multiple: !!conversation.medicineList,
          allMedicines: conversation.medicineList ? parseMedicineListNames(conversation.medicineList) : undefined,
        }),
      );
      await ctx.runMutation(api.whatsappConversations.updateMedicineRequest, {
        conversationId: conversation._id,
        productName: conversation.productName,
        productId: conversation.productId,
        requestedQuantity: conversation.requestedQuantity || 1,
        available: conversation.available ?? true,
        price: conversation.price,
        prescriptionRequired: conversation.prescriptionRequired,
      });
      return;
    }
  }

  // Default: ask for medicine
  await ctx.runMutation(api.whatsappConversations.incrementMessage, {
    conversationId: conversation._id,
  });
  await sendWhatsAppMessage(
    phone,
    `Please share the *name of the medicine(s)* you need. 💊`,
  );
}

/**
 * Process a medicine request — search DB, check stock, ask for address
 */
async function processMedicineRequest(
  ctx: any,
  conversation: any,
  intent: MessageIntent,
  phone: string,
  customerName: string | undefined,
  rawText: string,
): Promise<void> {
  const medicineNames = (intent as any).allMedicines || [(intent as any).medicine];
  const searchedProducts: any[] = [];
  const unavailableMeds: string[] = [];
  const availableMeds: Array<{ name: string; productId: any; price: number; qty: number; rxRequired: boolean; stockQty: number }> = [];

  for (const medName of medicineNames) {
    const products = await ctx.runQuery(api.whatsappConversations.searchProducts, {
      searchTerm: medName,
    });

    if (products && products.length > 0) {
      const product = products[0];
      const available = product.stockQuantity >= (intent as any).quantity;
      const price = product.discountPrice || product.price;

      searchedProducts.push(product);

      if (available) {
        availableMeds.push({
          name: product.name,
          productId: product._id,
          price,
          qty: (intent as any).quantity,
          rxRequired: product.prescriptionRequired || false,
          stockQty: product.stockQuantity,
        });
      } else {
        unavailableMeds.push(product.name);
      }
    } else {
      unavailableMeds.push(medName);
    }
  }

  if (availableMeds.length === 0 && unavailableMeds.length > 0) {
    // None found or all unavailable
    const firstUnavailable = unavailableMeds[0];
    const wasNotFound = searchedProducts.length === 0;

    await ctx.runMutation(api.whatsappConversations.incrementMessage, {
      conversationId: conversation._id,
    });

    if (wasNotFound) {
      await sendWhatsAppMessage(
        phone,
        `🔍 Sorry, we couldn't find "*${firstUnavailable}*" in our catalogue.\n\nPlease check the spelling or try a different medicine name. You can also visit our website to browse our full catalogue: kalyanchemist.com`,
      );
    } else {
      const responseMsg = formatAvailabilityMessage({
        productName: firstUnavailable,
        quantity: (intent as any).quantity || 1,
        available: false,
      });
      await sendWhatsAppMessage(phone, responseMsg);
    }
    return;
  }

  // We have available medicines — now ask for address
  const firstMed = availableMeds[0];
  const medicineList = availableMeds.length > 1
    ? JSON.stringify(availableMeds)
    : undefined;

  // Update conversation with medicine info and move to awaiting_address
  const result = await ctx.runMutation(api.whatsappConversations.updateMedicineRequest, {
    conversationId: conversation._id,
    productName: firstMed.name,
    productId: firstMed.productId,
    requestedQuantity: firstMed.qty,
    available: true,
    price: firstMed.price,
    prescriptionRequired: firstMed.rxRequired,
    customerName,
    medicineList,
  });

  // Log enquiry
  const enquiry = await ctx.runMutation(api.whatsappEnquiries.log, {
    type: "order",
    customerName,
    customerPhone: phone,
    message: rawText,
    summary: `WhatsApp Order — ${availableMeds.map((m) => m.name).join(", ")} (Qty: ${(intent as any).quantity || 1})`,
    productId: firstMed.productId,
    productName: availableMeds.map((m) => m.name).join(", "),
    requestedQuantity: (intent as any).quantity || 1,
    available: true,
    prescriptionRequired: firstMed.rxRequired,
    totalAmount: availableMeds.reduce((sum, m) => sum + m.price * m.qty, 0),
  });

  if (enquiry?.id) {
    await ctx.runMutation(api.whatsappConversations.updateMedicineRequest, {
      conversationId: conversation._id,
      productName: firstMed.name,
      productId: firstMed.productId,
      requestedQuantity: firstMed.qty,
      available: true,
      price: firstMed.price,
      prescriptionRequired: firstMed.rxRequired,
      enquiryId: enquiry.id,
      medicineList,
    });
  }

  // If there are unavailable meds, mention them
  if (unavailableMeds.length > 0) {
    await sendWhatsAppMessage(
      phone,
      `⚠️ Note: "*${unavailableMeds.join(", ")}*" could not be found or is currently unavailable.`,
    );
  }

  // If Rx required, mention it
  const rxMeds = availableMeds.filter((m) => m.rxRequired);
  if (rxMeds.length > 0) {
    await sendWhatsAppMessage(
      phone,
      `⚠️ *Prescription Required* for: ${rxMeds.map((m) => m.name).join(", ")}\nPlease have a valid prescription ready.`,
    );
  }

  // Ask for address
  const addressMsg = formatAddressRequestMessage({
    productName: firstMed.name,
    quantity: firstMed.qty,
    multiple: availableMeds.length > 1,
    allMedicines: availableMeds.map((m) => m.name),
  });
  await sendWhatsAppMessage(phone, addressMsg);
}

/**
 * Handle when customer responds to availability (YES/NO)
 */
async function handleAvailabilityResponse(
  ctx: any,
  conversation: any,
  intent: MessageIntent,
  phone: string,
  rawText: string,
): Promise<void> {
  if (conversation.available && isPositiveResponse(rawText.trim())) {
    // Customer wants to order — now ask for address
    await ctx.runMutation(api.whatsappConversations.incrementMessage, {
      conversationId: conversation._id,
    });
    await sendWhatsAppMessage(
      phone,
      formatAddressRequestMessage({
        productName: conversation.productName || "your medicine",
        quantity: conversation.requestedQuantity || 1,
        multiple: !!conversation.medicineList,
        allMedicines: conversation.medicineList ? parseMedicineListNames(conversation.medicineList) : undefined,
      }),
    );
    // Move to awaiting_address
    await ctx.runMutation(api.whatsappConversations.updateMedicineRequest, {
      conversationId: conversation._id,
      productName: conversation.productName || "",
      productId: conversation.productId,
      requestedQuantity: conversation.requestedQuantity || 1,
      available: true,
      price: conversation.price,
      prescriptionRequired: conversation.prescriptionRequired,
    });
    return;
  }

  if (isNegativeResponse(rawText.trim())) {
    await ctx.runMutation(api.whatsappConversations.declineOrder, {
      conversationId: conversation._id,
    });
    await sendWhatsAppMessage(phone, formatDeclineMessage());
    return;
  }

  // Unclear response — prompt again
  await ctx.runMutation(api.whatsappConversations.incrementMessage, {
    conversationId: conversation._id,
  });
  await sendWhatsAppMessage(
    phone,
    `Would you like to place the order for *${conversation.productName}* (Qty: ${conversation.requestedQuantity ?? 1})?\n\nReply *Yes* to confirm or *No* to decline.`,
  );
}

/**
 * Handle address input when awaiting_address
 */
async function handleAwaitingAddress(
  ctx: any,
  conversation: any,
  intent: MessageIntent,
  phone: string,
  rawText: string,
): Promise<void> {
  if (intent.type === "address_message") {
    if (intent.isComplete) {
      await processAddress(ctx, conversation, intent, phone);
    } else {
      // Incomplete address — ask for more details
      await ctx.runMutation(api.whatsappConversations.incrementMessage, {
        conversationId: conversation._id,
      });
      await sendWhatsAppMessage(phone, formatIncompleteAddressMessage());
    }
    return;
  }

  // If they send a medicine request while awaiting address, handle it as a new medicine
  if (intent.type === "medicine_request") {
    await processMedicineRequest(ctx, conversation, intent, phone, conversation.customerName, rawText);
    return;
  }

  // If positive/negative — guide them
  if (isPositiveResponse(rawText.trim()) || isNegativeResponse(rawText.trim())) {
    await ctx.runMutation(api.whatsappConversations.incrementMessage, {
      conversationId: conversation._id,
    });
    await sendWhatsAppMessage(
      phone,
      `Please share your *complete delivery address* so we can arrange doorstep delivery. 💊\n\nInclude: flat/house number, building, area, city, and pincode.`,
    );
    return;
  }

  // Unknown — might be an address without pincode
  if (rawText.length > 10) {
    // Treat as potential address and ask for pincode
    await ctx.runMutation(api.whatsappConversations.incrementMessage, {
      conversationId: conversation._id,
    });
    await sendWhatsAppMessage(
      phone,
      `Thank you! Could you also add your *pincode* (6 digits) and *city* to complete the address? 💊`,
    );
    return;
  }

  // Short unknown message
  await ctx.runMutation(api.whatsappConversations.incrementMessage, {
    conversationId: conversation._id,
  });
  await sendWhatsAppMessage(
    phone,
    `Please share your *complete delivery address* with flat/house number, area, city, and pincode. 📍`,
  );
}

/**
 * Process a valid address — save it and ask for quantity
 */
async function processAddress(
  ctx: any,
  conversation: any,
  intent: MessageIntent,
  phone: string,
): Promise<void> {
  if (intent.type !== "address_message") return;

  // Save address
  await ctx.runMutation(api.whatsappConversations.updateDeliveryAddress, {
    conversationId: conversation._id,
    deliveryAddress: intent.address,
    deliveryAddressFull: intent.address,
  });

  // Ask for quantity
  await sendWhatsAppMessage(
    phone,
    formatQuantityRequestMessage({
      productName: conversation.productName || "your medicine",
      price: conversation.price,
    }),
  );

  // Move to awaiting_quantity
  const conversation2 = await ctx.runQuery(api.whatsappConversations.getProduct, {
    productId: conversation.productId,
  }).catch(() => null);

  await ctx.runMutation(api.whatsappConversations.updateQuantity, {
    conversationId: conversation._id,
    quantity: conversation.requestedQuantity || 1,
  });
}

/**
 * Handle address_received state
 */
async function handleAddressReceived(
  ctx: any,
  conversation: any,
  intent: MessageIntent,
  phone: string,
  rawText: string,
): Promise<void> {
  if (intent.type === "quantity_message") {
    await processQuantity(ctx, conversation, intent, phone);
    return;
  }

  if (intent.type === "positive_response") {
    // They might be confirming with default quantity
    await processQuantity(ctx, conversation, { type: "quantity_message", quantity: conversation.requestedQuantity || 1 }, phone);
    return;
  }

  // Try to extract quantity from any message
  if (intent.type === "unknown" || intent.type === "greeting" || intent.type === "medicine_request" || intent.type === "address_message") {
    const numMatch = rawText.trim().match(/^(\d+)/);
    if (numMatch) {
      const qty = parseInt(numMatch[1], 10);
      if (qty >= 1 && qty <= 99) {
        await processQuantity(ctx, conversation, { type: "quantity_message", quantity: qty }, phone);
        return;
      }
    }
  }

  // Negative — decline
  if (isNegativeResponse(rawText.trim())) {
    await ctx.runMutation(api.whatsappConversations.declineOrder, {
      conversationId: conversation._id,
    });
    await sendWhatsAppMessage(phone, formatDeclineMessage());
    return;
  }

  await ctx.runMutation(api.whatsappConversations.incrementMessage, {
    conversationId: conversation._id,
  });
  await sendWhatsAppMessage(
    phone,
    `How many units would you like to order? Please reply with a number (e.g., "2", "3 strips"). 💊`,
  );
}

/**
 * Handle awaiting_quantity state
 */
async function handleAwaitingQuantity(
  ctx: any,
  conversation: any,
  intent: MessageIntent,
  phone: string,
  rawText: string,
): Promise<void> {
  if (intent.type === "quantity_message") {
    await processQuantity(ctx, conversation, intent, phone);
    return;
  }

  // Try to extract number from message
  const numMatch = rawText.trim().match(/^(\d+)/);
  if (numMatch) {
    const qty = parseInt(numMatch[1], 10);
    if (qty >= 1 && qty <= 99) {
      await processQuantity(ctx, conversation, { type: "quantity_message", quantity: qty }, phone);
      return;
    }
  }

  if (isNegativeResponse(rawText.trim())) {
    await ctx.runMutation(api.whatsappConversations.declineOrder, {
      conversationId: conversation._id,
    });
    await sendWhatsAppMessage(phone, formatDeclineMessage());
    return;
  }

  await ctx.runMutation(api.whatsappConversations.incrementMessage, {
    conversationId: conversation._id,
  });
  await sendWhatsAppMessage(
    phone,
    `Please reply with the quantity (e.g., "1", "2", "3 strips"). 💊`,
  );
}

/**
 * Process quantity — check stock, show order summary
 */
async function processQuantity(
  ctx: any,
  conversation: any,
  intent: MessageIntent,
  phone: string,
): Promise<void> {
  if (intent.type !== "quantity_message") return;

  let qty = intent.quantity;
  if (qty < 1) qty = 1;
  if (qty > 99) qty = 99;

  // Check stock
  let available = true;
  let stockProduct = null;

  if (conversation.productId) {
    stockProduct = await ctx.runQuery(api.whatsappConversations.getProduct, {
      productId: conversation.productId,
    });
    if (stockProduct) {
      available = stockProduct.stockQuantity >= qty;
    }
  }

  if (!available) {
    await ctx.runMutation(api.whatsappConversations.incrementMessage, {
      conversationId: conversation._id,
    });
    await sendWhatsAppMessage(
      phone,
      `💊 Sorry, we only have *${stockProduct?.stockQuantity || 0} units* of *${conversation.productName}* available.\n\nWould you like to order ${stockProduct?.stockQuantity || 0} instead? Reply with the quantity.`,
    );
    return;
  }

  // Update quantity
  await ctx.runMutation(api.whatsappConversations.updateQuantity, {
    conversationId: conversation._id,
    quantity: qty,
  });

  // Build order summary
  const medicines = buildMedicineList(conversation, qty);
  const hasRxItems = medicines.some((m) => m.rxRequired);
  const rxItems = medicines.filter((m) => m.rxRequired).map((m) => m.name);

  const summaryMsg = formatOrderSummaryMessage({
    medicines: medicines.map((m) => ({ name: m.name, quantity: m.quantity, price: m.price })),
    deliveryAddress: conversation.deliveryAddressFull || conversation.deliveryAddress || "Not provided",
    hasRxItems,
    rxItems,
  });

  await sendWhatsAppMessage(phone, summaryMsg);
}

/**
 * Handle add_more_medicines state
 */
async function handleAddMoreMedicines(
  ctx: any,
  conversation: any,
  intent: MessageIntent,
  phone: string,
  customerName: string | undefined,
  rawText: string,
): Promise<void> {
  if (intent.type === "done_adding" || isPositiveResponse(rawText.trim())) {
    // Done adding — go to address
    await ctx.runMutation(api.whatsappConversations.incrementMessage, {
      conversationId: conversation._id,
    });
    await sendWhatsAppMessage(
      phone,
      formatAddressRequestMessage({
        productName: conversation.productName || "your medicines",
        quantity: conversation.requestedQuantity || 1,
        multiple: !!conversation.medicineList,
        allMedicines: conversation.medicineList ? parseMedicineListNames(conversation.medicineList) : undefined,
      }),
    );
    // Move to awaiting_address
    await ctx.runMutation(api.whatsappConversations.updateMedicineRequest, {
      conversationId: conversation._id,
      productName: conversation.productName || "",
      productId: conversation.productId,
      requestedQuantity: conversation.requestedQuantity || 1,
      available: true,
      price: conversation.price,
      prescriptionRequired: conversation.prescriptionRequired,
    });
    return;
  }

  if (intent.type === "medicine_request") {
    // Add another medicine
    await processMedicineRequest(ctx, conversation, intent, phone, customerName, rawText);
    return;
  }

  if (isNegativeResponse(rawText.trim())) {
    await ctx.runMutation(api.whatsappConversations.declineOrder, {
      conversationId: conversation._id,
    });
    await sendWhatsAppMessage(phone, formatDeclineMessage());
    return;
  }

  await ctx.runMutation(api.whatsappConversations.incrementMessage, {
    conversationId: conversation._id,
  });
  await sendWhatsAppMessage(
    phone,
    `Send another *medicine name* to add it, or reply *Done* to proceed. 💊`,
  );
}

/**
 * Handle order_summary state — final YES/NO
 */
async function handleOrderSummary(
  ctx: any,
  conversation: any,
  intent: MessageIntent,
  phone: string,
  rawText: string,
): Promise<void> {
  if (isPositiveResponse(rawText.trim())) {
    // FINAL CONFIRMATION — create order
    await confirmAndCreateOrder(ctx, conversation, phone);
    return;
  }

  if (isNegativeResponse(rawText.trim())) {
    await ctx.runMutation(api.whatsappConversations.declineOrder, {
      conversationId: conversation._id,
    });
    await sendWhatsAppMessage(phone, formatDeclineMessage());
    return;
  }

  await ctx.runMutation(api.whatsappConversations.incrementMessage, {
    conversationId: conversation._id,
  });
  await sendWhatsAppMessage(
    phone,
    `Would you like to *place this order*?\n\nReply *Yes* to confirm or *No* to cancel.`,
  );
}

/**
 * Confirm and create the WhatsApp order
 */
async function confirmAndCreateOrder(
  ctx: any,
  conversation: any,
  phone: string,
): Promise<void> {
  // Re-check stock one final time
  if (conversation.productId) {
    const product = await ctx.runQuery(api.whatsappConversations.getProduct, {
      productId: conversation.productId,
    });
    if (!product || product.stockQuantity < (conversation.requestedQuantity ?? 1)) {
      await ctx.runMutation(api.whatsappConversations.incrementMessage, {
        conversationId: conversation._id,
      });
      await sendWhatsAppMessage(
        phone,
        `💊 *Sorry, the requested medicine has become unavailable.*\n\nPlease let us know if you'd like an alternative.`,
      );
      await ctx.runMutation(api.whatsappConversations.updateMedicineRequest, {
        conversationId: conversation._id,
        productName: conversation.productName || "",
        productId: conversation.productId,
        requestedQuantity: conversation.requestedQuantity || 1,
        available: false,
        price: conversation.price,
        prescriptionRequired: conversation.prescriptionRequired,
      });
      return;
    }
  }

  // Build medicine list for order
  const medicines = buildMedicineList(conversation, conversation.requestedQuantity || 1);
  const totalAmount = medicines.reduce((sum, m) => sum + m.price * m.quantity, 0);

  // Confirm conversation
  const result = await ctx.runMutation(api.whatsappConversations.confirmOrder, {
    conversationId: conversation._id,
  });

  if (result.success) {
    // Send confirmation
    const confirmMsg = formatConfirmationMessage({
      medicines: medicines.map((m) => ({ name: m.name, quantity: m.quantity, price: m.price })),
    });
    await sendWhatsAppMessage(phone, confirmMsg);

    // Update enquiry record
    if (conversation.enquiryId) {
      try {
        await ctx.runMutation(api.whatsappEnquiries.confirmWhatsAppOrder, {
          enquiryId: conversation.enquiryId,
          adminNotes: `Order auto-confirmed via WhatsApp conversational flow. Address: ${conversation.deliveryAddressFull || conversation.deliveryAddress || "N/A"}`,
        });
      } catch (e: any) {
        console.log(`[WhatsApp] Failed to update enquiry: ${e.message}`);
      }
    }
  } else if (result.reason === "out_of_stock") {
    await sendWhatsAppMessage(
      phone,
      `💊 *Sorry, the requested medicine has become unavailable.*\n\nPlease let us know if you'd like an alternative.`,
    );
  }
}

/**
 * Handle conversation when medicine was unavailable
 */
async function handleUnavailableConversation(
  ctx: any,
  conversation: any,
  intent: MessageIntent,
  phone: string,
  customerName: string | undefined,
  rawText: string,
): Promise<void> {
  if (intent.type === "medicine_request") {
    await processMedicineRequest(ctx, conversation, intent, phone, customerName, rawText);
    return;
  }

  if (isPositiveResponse(rawText.trim())) {
    await ctx.runMutation(api.whatsappConversations.incrementMessage, {
      conversationId: conversation._id,
    });
    await sendWhatsAppMessage(
      phone,
      `The earlier medicine was unavailable. Would you like to try a different medicine? Send us the name. 💊`,
    );
    return;
  }

  if (isNegativeResponse(rawText.trim())) {
    await ctx.runMutation(api.whatsappConversations.declineOrder, {
      conversationId: conversation._id,
    });
    await sendWhatsAppMessage(phone, formatDeclineMessage());
    return;
  }

  await ctx.runMutation(api.whatsappConversations.incrementMessage, {
    conversationId: conversation._id,
  });
  await sendWhatsAppMessage(
    phone,
    `Send us a *medicine name* to check availability, or let us know how we can help! 💊`,
  );
}

// ══════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════

function parseMedicineListNames(medicineListJson: string): string[] {
  try {
    const meds = JSON.parse(medicineListJson);
    return meds.map((m: any) => m.name || "").filter(Boolean);
  } catch {
    return [];
  }
}

function buildMedicineList(
  conversation: any,
  qty: number,
): Array<{ name: string; quantity: number; price: number; rxRequired: boolean }> {
  if (conversation.medicineList) {
    try {
      const meds = JSON.parse(conversation.medicineList);
      return meds.map((m: any) => ({
        name: m.name,
        quantity: m.quantity || qty,
        price: m.price || 0,
        rxRequired: m.rxRequired || false,
      }));
    } catch {
      // Fallback
    }
  }

  return [{
    name: conversation.productName || "Medicine",
    quantity: qty,
    price: conversation.price || 0,
    rxRequired: conversation.prescriptionRequired || false,
  }];
}
