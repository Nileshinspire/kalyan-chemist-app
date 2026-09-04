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

// ─── Medical safety keywords (personal-advice only) ───
// These represent decisions about the CUSTOMER's own treatment. General,
// factual product-information questions (e.g. "what is Dolo 650 used for?")
// are handled by the product_info intent and must NOT hit this list.
const MEDICAL_SAFETY_TRIGGERS = [
  "diagnos", "prescribe", "dosage", "dose", "how much should i take",
  "how many should i take", "should i stop", "should i start", "should i take",
  "should i continue", "side effect", "drug interaction", "replace", "substitute",
  "instead of", "is it safe", "are there any side", "can i take", "can i use for",
  "which medicine for", "what medicine for", "what should i take", "medicine for",
  "treatment for", "treat", "cure", "symptom",
];

const MEDICAL_SAFETY_REPLY =
  "I'm sorry, but I'm not able to provide medical advice such as diagnoses, prescriptions, or dosage recommendations. " +
  "For medical questions, please consult our pharmacist or a qualified healthcare professional. " +
  "Would you like me to connect you with our pharmacist support team?";

// ─── Intent classification ───
// Priority order matters: specific action/question checks must run BEFORE broad
// keyword checks so real queries are answered directly instead of falling into
// a generic bucket. The capability menu ("help") only fires for explicit
// capability questions or genuinely unclear messages.
function classifyIntent(text: string): string {
  const t = text.toLowerCase();

  // 0. Explicit capability question → the menu is the right answer here
  if (/\b(what can you do|what do you do|what can i ask|what are your features|your capabilities|how do you work)\b/.test(t)) {
    return "help";
  }

  // 1. Navigation commands — "open cart", "take me to my orders", "show lab tests"
  if (/\b(open|show|take me|go to|goto|navigate)\b/.test(t) &&
      /\b(cart|checkout|orders?|account|profile|prescriptions?|refill|wishlist|notifications?|appointment|doctor|lab tests?)\b/.test(t)) {
    return "navigation";
  }
  // 1b. Prescription upload requests route to the existing prescription page
  if (/\b(upload|send|share)\b/.test(t) && /\bprescription\b/.test(t)) {
    return "navigation";
  }

  // 2. Doctor appointment booking
  if (/\b(doctor|appointment|consultation)\b/.test(t) &&
      /\b(book|booking|schedule|slot|how|kaise|kese|consult)\b/.test(t)) {
    return "appointment_booking";
  }

  // 3. Lab test / package booking
  if (/\b(lab test|lab tests|blood test|checkup|health package|lab package)\b/.test(t) &&
      /\b(book|booking|how|kaise|kese|get|do|offer|available|have)\b/.test(t)) {
    return "lab_booking";
  }

  // 4. How to order / buy / book medicines (incl. Hinglish)
  //    (doctor/lab booking intents are handled above, so "book" here means medicines)
  if (/\b(order|buy|purchase|kharid|book)\b/.test(t) && /\b(how|kaise|kese|process|steps|procedure)\b/.test(t)) {
    return "how_to_order";
  }
  if (/\bhow (do|can) i (order|buy|get|purchase|book)\b/.test(t) || /\bmedicine kaise (order|kharid|book)/.test(t)) {
    return "how_to_order";
  }

  // 5. Cancel / refund requests about an order → human support
  if (/\b(cancel|refund|return)\b/.test(t) && /\border\b/.test(t)) {
    return "complaint";
  }

  // 6. Order tracking — includes explicit order refs like "#A1B2C3"
  if (/#[a-z0-9]{3,8}\b/.test(t) ||
      /\b(track|where is my|order status|my order|shipped|dispatched|out for delivery|has my order|when will my order)\b/.test(t)) {
    return "order_tracking";
  }

  // 7. Refill
  if (/\b(refill|reorder|repeat prescription|when should i refill|which medicines are due|medicines due|refill due)\b/.test(t)) {
    return "refill";
  }

  // 8. Availability — "Is Dolo 650 available?", "Do you have Brufen 400mg?"
  if (/\b(available|availability|in stock|out of stock|stock|do you have|do u have|have you got)\b/.test(t)) {
    return "availability";
  }

  // 9. Price — "What's the price of Crocin?", "How much is Dolo 650?"
  if (/\b(price|cost|rate|mrp|charges|how much)\b/.test(t)) {
    return "price";
  }

  // 10. Product INFORMATION — "What is Dolo 650 used for?", "Tell me about Brufen 400mg"
  //     Checked BEFORE personal-medical safety so factual product questions get
  //     real answers. Personal markers route treatment questions to safety instead.
  const personalMarkers = /\b(my |i have|i am feeling|should i|for me)\b/.test(t);
  const productInfoRe =
    /\b(used for|uses of|use of|used to|composition of|tell me about|details (of|about|for)|information (about|on|of)|info (about|on|of)|what does .* (do|treat))\b/;
  const whatIsRe = /\bwhat is (?!your\b|the\b|this\b|kalyan\b)[a-z0-9]/;
  // Dosage questions are personal treatment decisions, even in "what is" form
  const dosageQuestion = /\b(dosage|dose)\b/.test(t);
  if (!personalMarkers && !dosageQuestion && (productInfoRe.test(t) || whatIsRe.test(t))) {
    return "product_info";
  }
  // "Does X require prescription?" is a product attribute, not medical advice
  if (/\b(prescription required|require[s]? prescription|need[s]? prescription|prescription needed)\b/.test(t)) {
    return "product_info";
  }

  // 11. Personal medical advice → safety / pharmacist handoff
  if (MEDICAL_SAFETY_TRIGGERS.some((kw) => t.includes(kw))) {
    return "medical_question";
  }

  // 12. Product search
  if (/\b(search|find|show|look for|looking for|need|want|buy|get|get me)\b/.test(t)) {
    return "product_search";
  }

  // 13. Complaint / frustration
  if (/\b(complaint|problem|issue|wrong|broken|terrible|worst|angry|frustrat|unaccept)\b/.test(t)) {
    return "complaint";
  }

  // 14. Greeting
  if (/\b(hello|hi|hey|good morning|good evening|good afternoon|namaste)\b/.test(t)) {
    return "greeting";
  }

  // 15. Help
  if (/\b(help|guide|support|features)\b/.test(t)) {
    return "help";
  }

  // 16. Genuinely unclear → short clarifying question (handled in generateResponse)
  return "general";
}

// ─── Search-term extraction (strips question/stop words, keeps brand + strength) ───
function extractSearchTerms(t: string): string {
  return t
    .replace(/\b(what|whats|which|is|are|was|the|a|an|of|for|about|tell|me|details|detail|information|info|composition|used|use|uses|does|do|did|you|u|your|have|has|had|get|give|show|price|prices|cost|rate|mrp|charges|how|much|many|available|availability|stock|in|on|at|please|can|could|would|will|i|my|it|its|this|that|there|medicine|medicines|product|products|item|items|brand|any|need|want|know|and|or|with|to|search|find|finds|looking|look|help|something|anything|seeking|check|checking)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Shared product lookup (fuzzy, typo-tolerant) ───
async function findProducts(
  ctx: any,
  searchTerms: string,
  opts?: { includeOutOfStock?: boolean; limit?: number }
): Promise<{ product: any; score: number }[]> {
  const allProducts = await ctx.db.query("products").collect();
  const searchWords = searchTerms.split(/\s+/).filter((w: string) => w.length > 1);
  const includeOutOfStock = opts?.includeOutOfStock ?? false;
  const limit = opts?.limit ?? 5;

  return allProducts
    .filter((p: any) => p.isActive && (includeOutOfStock || p.stockQuantity > 0))
    .map((p: any) => {
      const nameNorm = normalizeText(p.name);
      const compNorm = normalizeText(p.composition || "");
      let score = 0;

      for (const word of searchWords) {
        const wNorm = normalizeText(word);
        if (nameNorm.includes(wNorm)) score += 10;
        if (compNorm.includes(wNorm)) score += 8;
        if (levenshtein(wNorm, nameNorm.substring(0, wNorm.length)) <= 2) score += 5;
        for (const nameWord of nameNorm.split(/\s+/)) {
          if (nameWord.startsWith(wNorm) || wNorm.startsWith(nameWord)) score += 3;
        }
      }
      return { product: p, score };
    })
    .filter((item: any) => item.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, limit);
}

// ─── Context fallback: resolve products from the previous assistant message ───
// Lets follow-ups like "how much is it?" / "is it available?" work without
// forcing the customer to repeat the medicine name.
async function resolveContextProducts(
  ctx: any,
  contextProductIds: string[] | undefined
): Promise<{ product: any; score: number }[]> {
  if (contextProductIds?.length) {
    const docs = await Promise.all(
      contextProductIds.slice(0, 3).map((id: string) => ctx.db.get(id as any))
    );
    return docs.filter(Boolean).map((p: any) => ({ product: p, score: 0 }));
  }
  return [];
}

// ─── Formatting helpers ───
function priceLabel(p: any): string {
  return p.discountPrice && p.discountPrice < p.price
    ? `₹${p.discountPrice} (MRP ₹${p.price})`
    : `₹${p.price}`;
}

function stockLabel(p: any): string {
  return p.stockQuantity > 0 ? "In Stock" : "Out of Stock";
}

function trimText(s: string, max: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.lastIndexOf(" ", max);
  return clean.slice(0, cut > 0 ? cut : max) + "…";
}

function formatOrder(o: any): string {
  const statusEmoji: Record<string, string> = {
    pending: "⏳", confirmed: "✅", processing: "📦", ready_for_dispatch: "🚚",
    out_for_delivery: "🏍️", delivered: "🎉", cancelled: "❌",
    refund_initiated: "🔄", refunded: "💰",
  };
  const items = o.items.map((i: any) => `${i.name} × ${i.quantity}`).join(", ");
  const date = new Date(o.createdAt).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
  const emoji = statusEmoji[o.status] || "❓";
  return (
    `• **Order #${o._id.slice(-6).toUpperCase()}** ${emoji} ${o.status.replace(/_/g, " ")}\n` +
    `  ${items}\n` +
    `  ₹${o.totalAmount} • ${date}`
  );
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
  userId: string,
  contextProductIds?: string[]
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
      const searchTerms = extractSearchTerms(t);

      // Ambiguous request like "I need medicine" → short clarifying question,
      // not a capability list and not a empty-result error.
      if (!searchTerms || searchTerms.length < 2) {
        return {
          content:
            'Sure — which medicine are you looking for? Just type its name (for example, "Dolo 650" or "Vitamin C") ' +
            "and I'll check availability and price for you.",
        };
      }

      const scored = await findProducts(ctx, searchTerms, { includeOutOfStock: false, limit: 5 });

      if (scored.length === 0) {
        // Also check out-of-stock products for the same terms
        const unavailable = await findProducts(ctx, searchTerms, { includeOutOfStock: true, limit: 3 });
        if (unavailable.length > 0) {
          const names = unavailable
            .map(({ product: p }: any) => `• **${p.name}** (${p.manufacturer})`)
            .join("\n");
          return {
            content:
              `I found the following products, but they are currently **out of stock**:\n\n${names}\n\n` +
              "You can tap **Notify Me** on the product page to be alerted when they're back.",
            productIds: unavailable.map(({ product: p }: any) => p._id),
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
        const rx = p.prescriptionRequired ? " 📋 Rx Required" : "";
        return `• **${p.name}** — ${p.packSize} ${p.strength || ""} ${p.form || ""}\n  ${p.manufacturer} | ${priceLabel(p)}${rx}\n  [View Product](#/products/${p.slug})`;
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

    // ── How to order medicines (the REAL Kalyan Chemist flow) ──
    case "how_to_order": {
      return {
        content:
          "Ordering medicines on Kalyan Chemist is simple:\n\n" +
          "1. **Search** for your medicine in our catalogue.\n" +
          "2. Open the product to check details, price and availability.\n" +
          "3. Tap **Add to Cart**.\n" +
          "4. Open your **Cart** and review quantities.\n" +
          "5. Continue to **Checkout** and confirm your delivery address.\n" +
          "6. Choose a payment option and **place your order**.\n\n" +
          "For prescription-required medicines, our standard prescription verification applies before dispatch.\n\n" +
          "[Search Medicines](#/products) · [Go to Cart](#/cart)",
      };
    }

    // ── Doctor appointment booking (the REAL flow) ──
    case "appointment_booking": {
      return {
        content:
          "Booking a doctor appointment on Kalyan Chemist:\n\n" +
          "1. Open **Doctor Appointment** and choose a category.\n" +
          "2. Browse the available doctors in that category.\n" +
          "3. Open a doctor's profile to see qualifications, fees and availability.\n" +
          "4. Pick a convenient date and time slot.\n" +
          "5. Confirm your details to complete the booking.\n\n" +
          "[Book Appointment](#/doctor-appointment)",
      };
    }

    // ── Lab test booking (the REAL flow) ──
    case "lab_booking": {
      return {
        content:
          "Booking a lab test or health package on Kalyan Chemist:\n\n" +
          "1. Open **Lab Tests** and pick a category, or browse all tests.\n" +
          "2. Choose a single test or a package and open its details.\n" +
          "3. Review what's included, sample type and report time.\n" +
          "4. Proceed to booking and complete payment.\n\n" +
          "[Browse Lab Tests](#/lab-tests)",
      };
    }

    // ── Specific product information, from real catalogue data ──
    case "product_info": {
      const terms = extractSearchTerms(t);
      let found =
        terms.length >= 2
          ? await findProducts(ctx, terms, { includeOutOfStock: true, limit: 3 })
          : [];
      if (found.length === 0 && contextProductIds?.length) {
        found = await resolveContextProducts(ctx, contextProductIds);
      }

      if (found.length === 0) {
        return {
          content:
            "I couldn't find that product in our catalogue. Could you share the exact medicine name " +
            '(for example, "Dolo 650" or "Brufen 400mg")? I can then share its details, price and availability.',
        };
      }

      if (found.length > 1) {
        const options = found
          .map(({ product: p }: any) => `• **${p.name}** — ${priceLabel(p)} | ${stockLabel(p)}`)
          .join("\n");
        return {
          content: `I found a few matching products:\n\n${options}\n\nWhich one would you like to know more about?`,
        };
      }

      const p = found[0].product;
      const category = p.categoryId ? await ctx.db.get(p.categoryId).catch(() => null) : null;

      let info =
        `Here's what I can tell you about **${p.name}**:\n\n` +
        (p.composition ? `• **Composition:** ${p.composition}\n` : "") +
        (p.manufacturer ? `• **Manufacturer:** ${p.manufacturer}\n` : "") +
        (p.packSize ? `• **Pack size:** ${p.packSize}\n` : "") +
        (p.strength || p.form ? `• **Form:** ${[p.strength, p.form].filter(Boolean).join(" · ")}\n` : "") +
        (category ? `• **Category:** ${(category as any).name}\n` : "") +
        `• **Price:** ${priceLabel(p)}\n` +
        `• **Availability:** ${stockLabel(p)}\n` +
        `• **Prescription:** ${p.prescriptionRequired ? "Required" : "Not required"}`;

      if (p.description) info += `\n\n**About:** ${trimText(p.description, 260)}`;
      if (p.benefits) info += `\n\n**As labelled:** ${trimText(p.benefits, 200)}`;

      info +=
        "\n\nThis is general product information from our catalogue, not medical advice. " +
        "For personal guidance, please consult our pharmacist.";

      return { content: info, productIds: [p._id] };
    }

    // ── Availability from real inventory ──
    case "availability": {
      const terms = extractSearchTerms(t);
      let found =
        terms.length >= 2
          ? await findProducts(ctx, terms, { includeOutOfStock: true, limit: 4 })
          : [];
      if (found.length === 0 && contextProductIds?.length) {
        found = await resolveContextProducts(ctx, contextProductIds);
      }

      if (found.length === 0) {
        return {
          content:
            'I couldn\'t find that medicine in our catalogue. Please type the exact medicine name (e.g., "Dolo 650") ' +
            "and I'll check availability for you.",
        };
      }

      if (found.length > 1) {
        const options = found
          .map(({ product: p }: any) => `• **${p.name}** — ${priceLabel(p)} | ${stockLabel(p)}`)
          .join("\n");
        return {
          content: `I found a few matching products:\n\n${options}\n\nWhich one would you like me to check?`,
        };
      }

      const p = found[0].product;
      if (p.stockQuantity > 0) {
        return {
          content:
            `Yes, **${p.name}** is currently available.\n\n` +
            `• **Price:** ${priceLabel(p)}\n` +
            `• **Prescription:** ${p.prescriptionRequired ? "Required" : "Not required"}\n\n` +
            `[View Product](#/products/${p.slug})`,
          productIds: [p._id],
        };
      }
      return {
        content:
          `**${p.name}** is currently **out of stock**.\n\n` +
          `You can tap **Notify Me** on the product page to be alerted when it's back. ` +
          `I can also help you find similar products in our catalogue.\n\n` +
          `[View Product](#/products/${p.slug})`,
        productIds: [p._id],
      };
    }

    // ── Current price from real catalogue data ──
    case "price": {
      const terms = extractSearchTerms(t);
      let found =
        terms.length >= 2
          ? await findProducts(ctx, terms, { includeOutOfStock: true, limit: 4 })
          : [];
      if (found.length === 0 && contextProductIds?.length) {
        found = await resolveContextProducts(ctx, contextProductIds);
      }

      if (found.length === 0) {
        return {
          content:
            'I couldn\'t find that product. Please share the medicine name (e.g., "Crocin Advance") ' +
            "and I'll get its current price for you.",
        };
      }

      if (found.length > 1) {
        const options = found
          .map(({ product: p }: any) => `• **${p.name}** — ${priceLabel(p)}`)
          .join("\n");
        return {
          content: `Here are the matching products and prices:\n\n${options}\n\nWhich one would you like details for?`,
        };
      }

      const p = found[0].product;
      return {
        content:
          `**${p.name}** is ${priceLabel(p)}.\n\n` +
          `• **Availability:** ${stockLabel(p)}\n\n` +
          `[View Product](#/products/${p.slug})`,
        productIds: [p._id],
      };
    }

    case "order_tracking": {
      const orders = await ctx.db
        .query("orders")
        .withIndex("by_user", (q: any) => q.eq("userId", userId))
        .order("desc")
        .take(20);

      if (orders.length === 0) {
        return {
          content:
            "You don't have any orders yet. Once you place an order, I can show its live status right here.\n\n" +
            "[Browse Medicines](#/products)",
        };
      }

      // Explicit order reference? e.g. "where is order #A1B2C3", "status of order 123456"
      const refMatch =
        text.match(/#\s?([a-zA-Z0-9]{3,8})\b/) ||
        text.match(/order\s+(?:number\s+|no\.?\s*|id\s+)?([a-zA-Z0-9]{3,8})\b/i);

      if (refMatch) {
        const ref = refMatch[1].toUpperCase();
        const matched = orders.find(
          (o: any) =>
            o._id.slice(-6).toUpperCase() === ref ||
            o._id.toUpperCase().includes(ref) ||
            (o.invoiceNumber || "").toUpperCase() === ref
        );
        if (!matched) {
          return {
            content:
              `I couldn't find an order matching **${refMatch[1]}** in your account. ` +
              'Please double-check the order number — or ask "Where is my order?" and I\'ll show your recent orders.',
          };
        }
        return {
          content: `Here's the latest on your order:\n\n${formatOrder(matched)}\n\n[View Order](#/orders/${matched._id})`,
          orderIds: [matched._id],
        };
      }

      // Single order → answer directly about THAT order
      if (orders.length === 1) {
        return {
          content: `Here's the latest on your order:\n\n${formatOrder(orders[0])}\n\n[View Order](#/orders/${orders[0]._id})`,
          orderIds: [orders[0]._id],
        };
      }

      // Multiple orders → show recent ones and offer to drill into a specific one
      const recent = orders.slice(0, 4);
      return {
        content:
          `You have ${orders.length} orders. Here are your most recent ones:\n\n` +
          recent.map((o: any) => formatOrder(o)).join("\n\n") +
          `\n\nAsk about a specific order number (e.g., "Where is order #${recent[0]._id.slice(-6).toUpperCase()}?") for full details.`,
        orderIds: recent.map((o: any) => o._id),
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
      // Genuinely unclear message → short clarifying question, NOT a capability dump.
      if (/\b(medicine|tablet|capsule|syrup|drug|pill)\b/.test(t)) {
        return {
          content:
            'Sure — which medicine are you looking for? Just type its name (for example, "Dolo 650") ' +
            "and I'll check availability and price for you.",
        };
      }
      return {
        content:
          "I want to make sure I help you correctly. Could you tell me a bit more — for example, " +
          "a medicine you're looking for, your order status, or a refill?",
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
      // Conversation context: remember the last products the assistant showed,
      // so follow-ups like "how much is it?" resolve without repeating the name.
      const lastProductMsg = recentMessages.find(
        (m) => m.role === "assistant" && m.productIds && m.productIds.length > 0
      ) as any;
      const contextProductIds: string[] | undefined = lastProductMsg?.productIds;

      const response = await generateResponse(ctx, intent, args.content, userId, contextProductIds);
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
