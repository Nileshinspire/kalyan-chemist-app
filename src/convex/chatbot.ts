import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ─── Fuzzy product search ───
// Simple Levenshtein distance for typo tolerance
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

// ─── Medical safety keywords ───
const MEDICAL_SAFETY_TRIGGERS = [
  "diagnos", "prescribe", "prescription", "dosage", "dose", "how much should i take",
  "should i stop", "should i start", "side effect", "drug interaction", "replace",
  "substitute", "instead of", "is it safe", "can i take", "which medicine for",
  "what medicine for", "treat", "cure", "symptom",
];

const MEDICAL_SAFETY_REPLY =
  "I'm sorry, but I'm not able to provide medical advice such as diagnoses, prescriptions, or dosage recommendations. " +
  "For medical questions, please consult our pharmacist or a qualified healthcare professional. " +
  "Would you like me to connect you with our pharmacist support team?";

// ─── Intent classification ───
function classifyIntent(text: string): string {
  const t = text.toLowerCase();

  // Medical safety check first
  if (MEDICAL_SAFETY_TRIGGERS.some((kw) => t.includes(kw))) {
    return "medical_question";
  }

  // Order tracking
  if (/\b(order|track|delivery|delivered|status|where is|shipment)\b/.test(t)) {
    return "order_tracking";
  }

  // Refill
  if (/\b(refill|reorder|repeat|previous.*order|again|last time)\b/.test(t)) {
    return "refill";
  }

  // Product search
  if (/\b(search|find|show|look for|available|price|cost|stock|buy|need|want|where)\b/.test(t)) {
    return "product_search";
  }

  // Navigation
  if (/\b(cart|checkout|account|profile|prescription|appointment|lab test|refill page)\b/.test(t)) {
    return "navigation";
  }

  // Complaint / frustration
  if (/\b(complaint|problem|issue|wrong|broken|terrible|worst|angry|frustrat|unaccept|refund|cancel)\b/.test(t)) {
    return "complaint";
  }

  // Greeting
  if (/\b(hello|hi|hey|good morning|good evening|namaste)\b/.test(t)) {
    return "greeting";
  }

  // Help
  if (/\b(help|how to|what can|what do you|features|guide|support)\b/.test(t)) {
    return "help";
  }

  return "general";
}

// ─── Sentiment detection ───
function detectSentiment(text: string): "positive" | "neutral" | "frustrated" {
  const t = text.toLowerCase();
  const frustrators = [
    "frustrat", "angry", "terrible", "worst", "useless", "hate", "stupid",
    "annoying", "unacceptable", "broken", "doesn't work", "did not work",
    "not working", "still waiting", "waste of time", "multiple times", "keeps happening",
  ];
  const positive = ["thank", "thanks", "great", "awesome", "love", "perfect", "excellent", "good"];

  if (frustrators.some((w) => t.includes(w))) return "frustrated";
  if (positive.some((w) => t.includes(w))) return "positive";
  return "neutral";
}

// ─── Detect language hint ───
function detectLanguage(text: string): string {
  const t = text.toLowerCase();
  if (/\b(kya hai|kaise|kahan|batao|hai|nahi|acha|theek|samajh|bhai|dost)\b/.test(t)) return "hinglish";
  if (/\b(आहे|काय|कसे|कुठे|सांगा|बरोबर|ठीक)\b/.test(t)) return "mr";
  if (/\b(है|क्या|कैसे|कहाँ|बताओ|अच्छा|ठीक|समझ)\b/.test(t)) return "hi";
  return "en";
}

// ─── Generate assistant response ───
async function generateResponse(
  ctx: any,
  intent: string,
  text: string,
  userId: string
): Promise<{ content: string; productIds?: string[]; orderIds?: string[] }> {
  const t = text.toLowerCase();

  switch (intent) {
    case "medical_question": {
      return { content: MEDICAL_SAFETY_REPLY };
    }

    case "greeting": {
      return {
        content:
          "Hello! 👋 Welcome to Kalyan Chemist. I'm here to help you with:\n\n" +
          "• **Search medicines** and check availability\n" +
          "• **Track your orders**\n" +
          "• **Refill reminders** for regular medicines\n" +
          "• **Navigate** the website\n" +
          "• **General pharmacy support**\n\n" +
          "How can I assist you today?",
      };
    }

    case "help": {
      return {
        content:
          "Here's what I can help you with:\n\n" +
          "🔍 **Product Search** — \"Find Dolo 650\" or \"search for Vitamin C\"\n" +
          "📦 **Order Tracking** — \"Where is my order?\" or \"track order\"\n" +
          "🔄 **Refills** — \"Refill my regular medicines\"\n" +
          "🧭 **Navigation** — \"Take me to cart\" or \"open my account\"\n" +
          "💊 **Availability** — \"Is Brufen 400mg available?\"\n" +
          "💰 **Pricing** — \"What's the price of Crocin?\"\n\n" +
          "For medical advice, please speak with our pharmacist. 😊",
      };
    }

    case "product_search": {
      // Extract search query - remove common stop words
      const searchTerms = t
        .replace(/\b(search|find|show|look for|available|price|cost|stock|buy|need|want|where|is|the|a|an|for|me|of|in|to|please|can|i|do|you|have|get|give)\b/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      if (!searchTerms || searchTerms.length < 2) {
        return {
          content:
            "Please tell me what medicine or product you're looking for. For example:\n\n" +
            "\"Find Dolo 650\"\n\"Search for Vitamin C\"\n\"Is Brufen available?\"",
        };
      }

      // Search products in database
      const allProducts = await ctx.db.query("products").collect();
      const searchWords = searchTerms.split(/\s+/).filter((w: string) => w.length > 1);

      const scored = allProducts
        .filter((p: any) => p.isActive && p.stockQuantity > 0)
        .map((p: any) => {
          const nameNorm = normalizeText(p.name);
          const compNorm = normalizeText(p.composition || "");
          let score = 0;

          for (const word of searchWords) {
            const wNorm = normalizeText(word);
            // Exact substring match in name
            if (nameNorm.includes(wNorm)) score += 10;
            // Exact substring match in composition
            if (compNorm.includes(wNorm)) score += 8;
            // Fuzzy match in name
            if (levenshtein(wNorm, nameNorm.substring(0, wNorm.length)) <= 2) score += 5;
            // Partial word match
            for (const nameWord of nameNorm.split(/\s+/)) {
              if (nameWord.startsWith(wNorm) || wNorm.startsWith(nameWord)) score += 3;
            }
          }
          return { product: p, score };
        })
        .filter((item: any) => item.score > 0)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 5);

      if (scored.length === 0) {
        // Also check unavailable products
        const unavailable = allProducts
          .filter((p: any) => p.isActive && p.stockQuantity === 0)
          .filter((p: any) => {
            const nameNorm = normalizeText(p.name);
            return searchWords.some((w: string) => nameNorm.includes(normalizeText(w)));
          });

        if (unavailable.length > 0) {
          const names = unavailable.slice(0, 3).map((p: any) => `• **${p.name}** (${p.manufacturer})`).join("\n");
          return {
            content:
              `I found the following products, but they are currently **out of stock**:\n\n${names}\n\n` +
              "Would you like me to notify you when they become available? You can also browse similar products.",
            productIds: unavailable.slice(0, 3).map((p: any) => p._id),
          };
        }

        return {
          content:
            `I couldn't find "${searchTerms}" in our catalogue. Here are some suggestions:\n\n` +
            "• Check the spelling of the medicine name\n" +
            "• Try searching by brand name (e.g., \"Dolo\" instead of \"Paracetamol\")\n" +
            "• Search by generic name (e.g., \"Paracetamol\" instead of \"Dolo\")\n\n" +
            "You can also browse our full catalogue or contact our pharmacist for help.",
        };
      }

      // Build response with product cards
      const productLines = scored.map(({ product: p }: any) => {
        const price = p.discountPrice && p.discountPrice < p.price
          ? `₹${p.discountPrice} (was ₹${p.price})`
          : `₹${p.price}`;
        const rx = p.prescriptionRequired ? " 📋 Rx Required" : "";
        return `• **${p.name}** — ${p.packSize} ${p.strength || ""} ${p.form || ""}\n  ${p.manufacturer} | ${price}${rx}\n  [View Product](#/products/${p.slug})`;
      });

      const content =
        `I found ${scored.length} matching product${scored.length > 1 ? "s" : ""}:\n\n` +
        productLines.join("\n\n") +
        "\n\nWould you like to add any of these to your cart, or need more details?";

      return {
        content,
        productIds: scored.map(({ product: p }: any) => p._id),
      };
    }

    case "order_tracking": {
      // Look up user's recent orders
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_user", (q: any) => q.eq("userId", userId))
        .order("desc")
        .take(5);

      if (orders.length === 0) {
        return {
          content:
            "You don't have any orders yet. Would you like to browse our catalogue and place your first order?\n\n" +
            "[Browse Medicines](#/products)",
        };
      }

      const statusEmoji: Record<string, string> = {
        pending: "⏳",
        confirmed: "✅",
        processing: "📦",
        ready_for_dispatch: "🚚",
        out_for_delivery: "🏍️",
        delivered: "🎉",
        cancelled: "❌",
        refund_initiated: "🔄",
        refunded: "💰",
      };

      const orderLines = orders.map((o: any) => {
        const items = o.items.map((i: any) => `${i.name} × ${i.quantity}`).join(", ");
        const emoji = statusEmoji[o.status] || "❓";
        const date = new Date(o.createdAt).toLocaleDateString("en-IN", {
          day: "numeric", month: "short", year: "numeric",
        });
        return `• **Order #${o._id.slice(-6).toUpperCase()}** ${emoji} ${o.status.replace(/_/g, " ")}\n  ${items}\n  ₹${o.totalAmount} • ${date}`;
      });

      return {
        content:
          `Here are your recent orders:\n\n${orderLines.join("\n\n")}\n\n` +
          "Would you like details on a specific order?",
        orderIds: orders.map((o: any) => o._id),
      };
    }

    case "refill": {
      // Get user's delivered orders to suggest refills
      const deliveredOrders = await ctx.db
        .query("orders")
        .withIndex("by_user", (q: any) => q.eq("userId", userId))
        .order("desc")
        .take(10);

      const delivered = deliveredOrders.filter((o: any) =>
        o.status === "delivered" || o.status === "confirmed"
      );

      if (delivered.length === 0) {
        return {
          content:
            "You don't have any previous orders to refill yet. Start by browsing our catalogue!\n\n" +
            "[Browse Medicines](#/products)\n\n" +
            "Once you've placed some orders, I'll help you refill your regular medicines.",
        };
      }

      // Collect unique products from delivered orders
      const productMap = new Map<string, { name: string; qty: number; lastDate: number; count: number }>();
      for (const order of delivered) {
        for (const item of order.items) {
          const pid = item.productId;
          const existing = productMap.get(pid);
          if (existing) {
            existing.count += 1;
            existing.qty = item.quantity; // latest qty
            existing.lastDate = order.createdAt;
          } else {
            productMap.set(pid, {
              name: item.name,
              qty: item.quantity,
              lastDate: order.createdAt,
              count: 1,
            });
          }
        }
      }

      const candidates = [...productMap.values()]
        .sort((a, b) => b.lastDate - a.lastDate)
        .slice(0, 4);

      if (candidates.length === 0) {
        return {
          content: "I don't have enough order history to suggest refills. Would you like to browse products?",
        };
      }

      const lines = candidates.map((c) => {
        const daysAgo = Math.round((Date.now() - c.lastDate) / 86400000);
        return `• **${c.name}** — Last ordered ${daysAgo} days ago (×${c.qty})`;
      });

      return {
        content:
          "Based on your order history, you may want to refill:\n\n" +
          lines.join("\n") +
          "\n\nVisit your **Medicine Refill** page to see full refill details and set reminders.\n\n" +
          "[Go to Medicine Refill](#/refill)",
      };
    }

    case "navigation": {
      if (t.includes("cart")) {
        return { content: "Opening your cart…\n\n[Go to Cart](#/cart)" };
      }
      if (t.includes("checkout")) {
        return { content: "Proceeding to checkout…\n\n[Go to Checkout](#/checkout)" };
      }
      if (t.includes("account") || t.includes("profile")) {
        return { content: "Opening your account…\n\n[Go to Account](#/account)" };
      }
      if (t.includes("prescription")) {
        return { content: "Opening prescriptions…\n\n[Go to Prescriptions](#/upload-prescription)" };
      }
      if (t.includes("appointment") || t.includes("doctor")) {
        return { content: "Opening doctor appointments…\n\n[Book Appointment](#/doctor-appointment)" };
      }
      if (t.includes("lab test")) {
        return { content: "Opening lab tests…\n\n[Browse Lab Tests](#/lab-tests)" };
      }
      if (t.includes("refill")) {
        return { content: "Opening medicine refill…\n\n[Go to Refill](#/refill)" };
      }
      if (t.includes("wishlist")) {
        return { content: "Opening your wishlist…\n\n[Go to Wishlist](#/wishlist)" };
      }
      if (t.includes("order")) {
        return { content: "Opening your orders…\n\n[Go to Orders](#/orders)" };
      }
      return {
        content:
          "Where would you like to go? I can help you navigate to:\n\n" +
          "• Cart\n• Orders\n• Account\n• Medicine Refill\n• Doctor Appointment\n• Lab Tests\n• Prescriptions\n• Wishlist",
      };
    }

    case "complaint": {
      return {
        content:
          "I'm sorry to hear you're experiencing an issue. I understand this is frustrating.\n\n" +
          "I'll connect you with our support team who can help resolve this for you. " +
          "In the meantime, you can also reach us at:\n\n" +
          "📞 **+91 98765 43210** (Mon–Sat, 8 AM – 10 PM)\n" +
          "💬 **WhatsApp** — Click the chat button on the website\n\n" +
          "Would you like me to connect you with our pharmacist support team?",
      };
    }

    default: {
      return {
        content:
          "I'm the Kalyan Chemist assistant! I can help you with:\n\n" +
          "• 🔍 **Search medicines** — \"Find Dolo 650\"\n" +
          "• 📦 **Track orders** — \"Where is my order?\"\n" +
          "• 🔄 **Refill medicines** — \"Refill my medicines\"\n" +
          "• 🧭 **Navigate** — \"Take me to my cart\"\n" +
          "• 💊 **Check availability** — \"Is Vitamin C available?\"\n\n" +
          "What can I help you with today?",
      };
    }
  }
}

// ─── Create a new conversation ───
export const createConversation = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = (await ctx.auth.getUserIdentity())?.subject;
    if (!userId) throw new Error("Not authenticated");

    const id = await ctx.db.insert("chatbot_conversations", {
      userId: userId as any,
      title: undefined,
      lastMessageAt: Date.now(),
      messageCount: 0,
      sentiment: "neutral",
      handoffRequested: false,
      language: "en",
      createdAt: Date.now(),
    });
    return id;
  },
});

// ─── Send a message and get AI response ───
export const sendMessage = mutation({
  args: {
    conversationId: v.id("chatbot_conversations"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = (await ctx.auth.getUserIdentity())?.subject;
    if (!userId) throw new Error("Not authenticated");

    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.userId !== userId) throw new Error("Conversation not found");

    const startTime = Date.now();
    const intent = classifyIntent(args.content);
    const sentiment = detectSentiment(args.content);
    const language = detectLanguage(args.content);

    // Check for repeated frustration → trigger handoff
    const recentMessages = await ctx.db
      .query("chatbot_messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .take(6);

    const recentFrustrated = recentMessages.filter(
      (m) => m.role === "user" && ["frustrated", "complaint", "medical_question"].includes(m.intent || "")
    );

    const shouldHandoff =
      sentiment === "frustrated" && recentFrustrated.length >= 2
        ? true
        : intent === "medical_question";

    let responseText: string;
    let productIds: string[] | undefined;
    let orderIds: string[] | undefined;

    if (shouldHandoff && intent !== "medical_question") {
      responseText =
        "I understand this is frustrating, and I want to make sure you get the help you need. " +
        "Let me connect you with a member of our team who can assist you directly.\n\n" +
        "📞 **Call us:** +91 98765 43210\n" +
        "💬 **WhatsApp:** Use the chat button on our website\n\n" +
        "Our team is available Mon–Sat, 8 AM – 10 PM.";
    } else {
      const response = await generateResponse(ctx, intent, args.content, userId);
      responseText = response.content;
      productIds = response.productIds;
      orderIds = response.orderIds;
    }

    const responseTimeMs = Date.now() - startTime;

    // Determine conversation title from first message
    const isFirstMessage = conv.messageCount === 0;
    const title = isFirstMessage
      ? args.content.slice(0, 50) + (args.content.length > 50 ? "…" : "")
      : conv.title;

    // Save user message
    await ctx.db.insert("chatbot_messages", {
      conversationId: args.conversationId,
      userId: userId as any,
      role: "user",
      content: args.content,
      intent,
      createdAt: Date.now(),
    });

    // Save assistant response
    await ctx.db.insert("chatbot_messages", {
      conversationId: args.conversationId,
      userId: userId as any,
      role: "assistant",
      content: responseText,
      intent,
      productIds: productIds as any,
      orderIds: orderIds as any,
      responseTimeMs,
      handoffTriggered: shouldHandoff,
      createdAt: Date.now(),
    });

    // Update conversation
    await ctx.db.patch(args.conversationId, {
      title: title,
      lastMessageAt: Date.now(),
      messageCount: conv.messageCount + 2,
      sentiment,
      handoffRequested: shouldHandoff,
      handoffReason: shouldHandoff
        ? intent === "medical_question"
          ? "Medical advice requested"
          : "Repeated customer frustration"
        : conv.handoffReason,
      language,
    });

    return {
      response: responseText,
      intent,
      handoffTriggered: shouldHandoff,
      productIds,
      orderIds,
    };
  },
});

// ─── Get conversation messages ───
export const getMessages = query({
  args: {
    conversationId: v.id("chatbot_conversations"),
  },
  handler: async (ctx, args) => {
    const userId = (await ctx.auth.getUserIdentity())?.subject;
    if (!userId) return [];

    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.userId !== userId) return [];

    const messages = await ctx.db
      .query("chatbot_messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .take(100);

    return messages;
  },
});

// ─── Get user's conversations ───
export const getConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = (await ctx.auth.getUserIdentity())?.subject;
    if (!userId) return [];

    const conversations = await ctx.db
      .query("chatbot_conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId as any))
      .order("desc")
      .take(20);

    return conversations;
  },
});

// ─── Get single conversation ───
export const getConversation = query({
  args: {
    conversationId: v.id("chatbot_conversations"),
  },
  handler: async (ctx, args) => {
    const userId = (await ctx.auth.getUserIdentity())?.subject;
    if (!userId) return null;

    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.userId !== userId) return null;
    return conv;
  },
});

// ─── Delete a conversation ───
export const deleteConversation = mutation({
  args: {
    conversationId: v.id("chatbot_conversations"),
  },
  handler: async (ctx, args) => {
    const userId = (await ctx.auth.getUserIdentity())?.subject;
    if (!userId) throw new Error("Not authenticated");

    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.userId !== userId) throw new Error("Not found");

    // Delete all messages in this conversation
    const messages = await ctx.db
      .query("chatbot_messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    for (const msg of messages) {
      await ctx.db.delete(msg._id);
    }

    await ctx.db.delete(args.conversationId);
  },
});

// ─── ADMIN: Get chatbot analytics ───
export const getAdminAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const userId = (await ctx.auth.getUserIdentity())?.subject;
    if (!userId) return null;

    const user = await ctx.db.get(userId as any);
    if (!user || (user as any).role !== "admin") return null;

    // Get all conversations
    const conversations = await ctx.db.query("chatbot_conversations").collect();
    const totalConversations = conversations.length;
    const handoffCount = conversations.filter((c) => c.handoffRequested).length;

    // Get all messages
    const messages = await ctx.db.query("chatbot_messages").collect();
    const totalMessages = messages.length;
    const userMessages = messages.filter((m) => m.role === "user");

    // Intent distribution
    const intentCounts: Record<string, number> = {};
    for (const msg of userMessages) {
      const intent = msg.intent || "unknown";
      intentCounts[intent] = (intentCounts[intent] || 0) + 1;
    }
    const topIntents = Object.entries(intentCounts)
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Average response time
    const assistantMessages = messages.filter((m) => m.role === "assistant" && m.responseTimeMs);
    const avgResponseTimeMs =
      assistantMessages.length > 0
        ? assistantMessages.reduce((sum, m) => sum + (m.responseTimeMs || 0), 0) / assistantMessages.length
        : 0;

    // Human handoff percentage
    const humanHandoffPercentage =
      totalConversations > 0 ? Math.round((handoffCount / totalConversations) * 100) : 0;

    // Most searched products (from product_search intent messages)
    const searchMessages = userMessages.filter((m) => m.intent === "product_search");
    const productSearchCounts: Record<string, number> = {};
    for (const msg of searchMessages) {
      const terms = msg.content.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
      const words = terms.split(/\s+/).filter((w: string) => w.length > 2);
      for (const word of words) {
        if (!["search", "find", "show", "look", "for", "available", "price", "want", "need", "buy", "where", "have"].includes(word)) {
          productSearchCounts[word] = (productSearchCounts[word] || 0) + 1;
        }
      }
    }
    const mostSearchedProducts = Object.entries(productSearchCounts)
      .map(([productName, searchCount]) => ({ productName, searchCount }))
      .sort((a, b) => b.searchCount - a.searchCount)
      .slice(0, 10);

    // Unavailable searches (messages that got "out of stock" or "not found" responses)
    const unavailableSearches: { productName: string; searchCount: number }[] = [];
    const assistantSearchResponses = messages.filter(
      (m) => m.role === "assistant" && m.content.includes("out of stock")
    );
    for (const resp of assistantSearchResponses) {
      // Find preceding user message
      const idx = messages.indexOf(resp);
      if (idx > 0) {
        const prevMsg = messages[idx - 1];
        if (prevMsg.role === "user") {
          unavailableSearches.push({
            productName: prevMsg.content.slice(0, 50),
            searchCount: 1,
          });
        }
      }
    }

    return {
      totalConversations,
      totalMessages,
      handoffCount,
      topIntents,
      avgResponseTimeMs: Math.round(avgResponseTimeMs),
      humanHandoffPercentage,
      mostSearchedProducts,
      unavailableSearches,
      recentConversations: conversations.slice(-10).reverse().map((c) => ({
        _id: c._id,
        title: c.title,
        messageCount: c.messageCount,
        sentiment: c.sentiment,
        handoffRequested: c.handoffRequested,
        language: c.language,
        createdAt: c.createdAt,
        lastMessageAt: c.lastMessageAt,
      })),
    };
  },
});

// ─── Proactive suggestions (for use elsewhere) ───
export const getProactiveSuggestions = query({
  args: {},
  handler: async (ctx) => {
    const userId = (await ctx.auth.getUserIdentity())?.subject;
    if (!userId) return [];

    const suggestions: string[] = [];

    // Check for delivered orders without follow-up
    const recentOrders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", userId as any))
      .order("desc")
      .take(3);

    const delivered = recentOrders.filter((o) => o.status === "delivered");
    if (delivered.length > 0) {
      const latest = delivered[0];
      const daysSince = Math.round((Date.now() - latest.createdAt) / 86400000);
      if (daysSince <= 3) {
        suggestions.push(`Your recent order was delivered ${daysSince === 0 ? "today" : daysSince === 1 ? "yesterday" : `${daysSince} days ago`}. How was it?`);
      }
    }

    // Check for refill reminders due soon
    const reminders = await ctx.db
      .query("refill_reminders")
      .withIndex("by_user", (q) => q.eq("userId", userId as any))
      .collect();

    const dueReminders = reminders.filter(
      (r) => r.isActive && r.nextReminderAt <= Date.now() + 3 * 86400000
    );
    if (dueReminders.length > 0) {
      const product = await ctx.db.get(dueReminders[0].productId);
      if (product) {
        suggestions.push(
          `Your **${(product as any).name}** refill may be due. Would you like to reorder?`
        );
      }
    }

    return suggestions.slice(0, 3);
  },
});
