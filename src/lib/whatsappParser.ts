/**
 * WhatsApp Message Parser for Kalyan Chemist
 *
 * Parses incoming WhatsApp messages to detect:
 * - Medicine/product requests (name + quantity)
 * - Positive responses (yes, confirm, order, etc.)
 * - Negative responses (no, cancel, etc.)
 *
 * Used by the conversational order flow webhook.
 */

// ── Response Intent Detection ──

const POSITIVE_RESPONSES = [
  "yes",
  "yeah",
  "yep",
  "yup",
  "y",
  "ok",
  "okay",
  "sure",
  "confirm",
  "confirmed",
  "order",
  "place order",
  "book",
  "booked",
  "buy",
  "purchase",
  "go ahead",
  "proceed",
  "please order",
  "please buy",
  "i want it",
  "i want",
  "want it",
  "need it",
  "i need it",
  "send it",
  "deliver",
  "take it",
  "done",
  "please",
  "haan",
  "ha",
  "ji",
  "bilkul",
  "thik hai",
  "theek hai",
  "ok hai",
  "order karo",
  "order kar do",
  "bhej do",
  "le loon",
  "chahiye",
  "de do",
  "kar do",
];

const NEGATIVE_RESPONSES = [
  "no",
  "nope",
  "nah",
  "nahi",
  "n",
  "cancel",
  "cancelled",
  "not now",
  "not interested",
  "skip",
  "pass",
  "nevermind",
  "never mind",
  "forget it",
  "no thanks",
  "no thank you",
  "no order",
  "nahi chahiye",
  "mat bhejo",
  "cancel karo",
  "ruko",
  "baad mein",
];

const GREETING_RESPONSES = [
  "hi",
  "hello",
  "hey",
  "hii",
  "hiiii",
  "namaste",
  "good morning",
  "good evening",
  "good afternoon",
];

export type MessageIntent =
  | { type: "medicine_request"; medicine: string; quantity: number }
  | { type: "positive_response" }
  | { type: "negative_response" }
  | { type: "greeting" }
  | { type: "unknown" };

/**
 * Detect the intent of an incoming WhatsApp message
 */
export function detectIntent(message: string): MessageIntent {
  const cleaned = message.trim().toLowerCase();

  // Check for greeting first (short messages)
  if (isGreeting(cleaned)) {
    return { type: "greeting" };
  }

  // Check for pure positive response (short or exact match)
  if (isPositiveResponse(cleaned) && !hasMedicineWords(cleaned)) {
    return { type: "positive_response" };
  }

  // Check for pure negative response — always check before medicine extraction
  if (isNegativeResponse(cleaned)) {
    return { type: "negative_response" };
  }

  // Try to extract medicine request (longer messages or containing medicine-like words)
  const medicineRequest = extractMedicineRequest(cleaned);
  if (medicineRequest) {
    return medicineRequest;
  }

  return { type: "unknown" };
}

/**
 * Check if the message is a positive/confirmation response
 */
export function isPositiveResponse(message: string): boolean {
  const cleaned = message.trim().toLowerCase();

  // Exact match
  if (POSITIVE_RESPONSES.includes(cleaned)) return true;

  // Contains a positive keyword as a standalone word
  for (const keyword of POSITIVE_RESPONSES) {
    if (keyword.length <= 3) {
      // Short words need exact match (already checked above)
      continue;
    }
    if (cleaned.includes(keyword)) return true;
  }

  // Check for "yes" variants with punctuation
  if (/^y+e*s+!*\?*$/i.test(cleaned)) return true;
  if (/^o+k+a*y*!*\?*$/i.test(cleaned)) return true;
  if (/^h+a+n+$/i.test(cleaned)) return true;

  return false;
}

/**
 * Check if the message is a negative/decline response
 */
export function isNegativeResponse(message: string): boolean {
  const cleaned = message.trim().toLowerCase();

  // Exact match
  if (NEGATIVE_RESPONSES.includes(cleaned)) return true;

  // Contains a negative keyword (also check with common separators like commas)
  const cleanedNoPunct = cleaned.replace(/[,;!]/g, " ").replace(/\s+/g, " ").trim();
  for (const keyword of NEGATIVE_RESPONSES) {
    if (keyword.length <= 2) continue;
    if (cleaned.includes(keyword) || cleanedNoPunct.includes(keyword)) return true;
  }

  // Check for "no" variants
  if (/^n+o*!*\?*$/i.test(cleaned)) return true;
  if (/^n+!*\?*$/i.test(cleaned)) return true;

  return false;
}

/**
 * Check if the message is a greeting
 */
function isGreeting(message: string): boolean {
  const cleaned = message.trim().toLowerCase();
  return GREETING_RESPONSES.some((g) => cleaned === g || cleaned.startsWith(g));
}

/**
 * Check if message contains words that suggest a medicine request
 * (numbers, dosage patterns, common suffixes, etc.)
 */
function hasMedicineWords(message: string): boolean {
  // Contains dosage patterns like 500mg, 500, 650
  if (/\d+\s*(mg|ml|g|mcg|iu)/i.test(message)) return true;
  // Contains quantity words
  if (/\d+\s*(strip|tablet|capsule|bottle|sachet|tube|box|pack)/i.test(message)) return true;
  // Contains words like 'need', 'want', 'buy', 'order', 'give', 'send', 'looking for'
  const medicineVerbs = ["need", "want", "buy", "order", "give", "send", "get", "looking", "search", "find", "show", "price", "cost", "availability"];
  for (const v of medicineVerbs) {
    if (message.startsWith(v + " ") || message.includes(" " + v + " ")) return true;
  }
  // Has a number followed by a word (likely quantity + medicine)
  if (/^\d+\s+[a-z]/.test(message)) return true;
  return false;
}

/**
 * Extract medicine name and quantity from a free-text message.
 * Supports patterns like:
 * - "paracetamol"
 * - "2 paracetamol"
 * - "paracetamol 2"
 * - "paracetamol 500mg"
 * - "need paracetamol 2 strips"
 * - "i want crocin 1 strip"
 * - "do crocin"
 * - "crocin 500"
 */
export function extractMedicineRequest(
  message: string,
): { type: "medicine_request"; medicine: string; quantity: number } | null {
  const cleaned = message.trim().toLowerCase();

  // Remove common prefixes (order matters — longest first)
  const prefixes = [
    "i want to order",
    "i want to buy",
    "i need to order",
    "looking for",
    "search for",
    "show me",
    "tell me about",
    "price of",
    "cost of",
    "availability of",
    "do you have",
    "can i get",
    "can you send",
    "please order",
    "please send",
    "please buy",
    "please give",
    "please find",
    "i want",
    "i need",
    "need",
    "want",
    "buy",
    "order",
    "get",
    "please",
    "send",
    "give",
    "find",
    "is",
  ];

  let text = cleaned;
  for (const prefix of prefixes) {
    if (text.startsWith(prefix)) {
      text = text.substring(prefix.length).trim();
    }
  }

  // Remove filler words at start
  text = text.replace(/^(a|an|the|some|me|for)\s+/i, "").trim();

  if (!text || text.length < 2) return null;

  // Try to extract quantity + medicine name
  // Pattern: "2 paracetamol" or "2x paracetamol" or "paracetamol 2"
  let quantity = 1;
  let medicineName = text;

  // "2 paracetamol" pattern — leading number
  const leadingQtyMatch = text.match(/^(\d+)\s*[x×]?\s+(.+)/);
  if (leadingQtyMatch) {
    quantity = parseInt(leadingQtyMatch[1], 10);
    medicineName = leadingQtyMatch[2].trim();
  }

  // "paracetamol 2 strips" pattern — trailing number + suffix
  const trailingQtyWithSuffix = medicineName.match(/^(.+?)\s+(\d+)\s*(strips?|tablets?|capsule?s?|piece?s?|bottles?|sachets?|tubes?|boxes?|packs?|nos?\.?)$/i);
  if (trailingQtyWithSuffix) {
    medicineName = trailingQtyWithSuffix[1].trim();
    quantity = parseInt(trailingQtyWithSuffix[2], 10);
  } else {
    // "paracetamol 2" pattern — trailing number (but not part of name like "500mg")
    // Numbers >= 100 are likely dosages (500mg, 650mg), not quantities
    const trailingQtyMatch = medicineName.match(/^(.+?)\s+(\d+)$/);
    if (
      trailingQtyMatch &&
      !trailingQtyMatch[1].match(/\d+mg|\d+ml|\d+g$/i) &&
      parseInt(trailingQtyMatch[2], 10) < 100
    ) {
      medicineName = trailingQtyMatch[1].trim();
      quantity = parseInt(trailingQtyMatch[2], 10);
    }
  }

  // Remove common suffixes like "strip", "tablet", "piece"
  medicineName = medicineName
    .replace(
      /\s+(strip|tablets?|capsule?s?|piece?s?|bottle|sachet|tube|box|pack|piece|no\.?|nos\.?)$/i,
      "",
    )
    .trim();

  // Remove trailing question marks, exclamation marks
  medicineName = medicineName.replace(/[?!.,;:]+$/, "").trim();

  // Remove price patterns
  medicineName = medicineName
    .replace(/\s*(?:rs\.?|₹|inr)\s*\d+/gi, "")
    .trim();

  // Don't process if it looks like a simple yes/no/greeting
  if (medicineName.length < 2) return null;
  if (isPositiveResponse(medicineName)) return null;
  if (isNegativeResponse(medicineName)) return null;

  // Validate quantity
  if (quantity < 1) quantity = 1;
  if (quantity > 99) quantity = 99;

  // Must contain at least some letters
  if (!/[a-zA-Z]/.test(medicineName)) return null;

  // Must have at least 3 characters and contain vowels (not random consonants)
  if (medicineName.length < 3) return null;
  if (!/[aeiou]/.test(medicineName)) return null;

  return {
    type: "medicine_request",
    medicine: medicineName,
    quantity,
  };
}

/**
 * Format the availability response message
 */
export function formatAvailabilityMessage(params: {
  productName: string;
  quantity: number;
  available: boolean;
  price?: number;
  prescriptionRequired?: boolean;
}): string {
  if (params.available) {
    let msg = `💊 *Yes, we have your requested medicine and quantity available at Kalyan Chemist.*`;
    msg += `\n\n📦 *${params.productName}* — Qty: ${params.quantity}`;
    if (params.price) {
      msg += `\n💰 Price: ₹${params.price.toLocaleString("en-IN")}`;
    }
    if (params.prescriptionRequired) {
      msg += `\n\n⚠️ *Prescription Required* — Please have a valid prescription from a registered medical practitioner ready.`;
    }
    msg += `\n\nWould you like to place the order? Reply *Yes* to confirm or *No* to decline.`;
    return msg;
  } else {
    return `💊 *Sorry, the requested medicine or quantity is currently unavailable at Kalyan Chemist.*\n\nPlease let us know if you'd like an alternative or another quantity.`;
  }
}

/**
 * Format the confirmation message sent after customer says YES
 */
export function formatConfirmationMessage(params: {
  productName: string;
  quantity: number;
  price?: number;
}): string {
  let msg = `✅ *Your order has been confirmed successfully!*`;
  msg += `\n\nThank you for choosing *Kalyan Chemist*. We'll process your order shortly.`;
  msg += `\n\n📦 *${params.productName}* × ${params.quantity}`;
  if (params.price) {
    msg += `\n💰 ₹${params.price.toLocaleString("en-IN")}`;
  }
  msg += `\n\nYou will receive updates as your order progresses. For any queries, feel free to message us here.`;
  return msg;
}

/**
 * Format the decline/goodbye message
 */
export function formatDeclineMessage(): string {
  return `Thank you for reaching out to *Kalyan Chemist*. We're always happy to help.\n\nWishing you good health! 💊`;
}

/**
 * Format the greeting response when customer sends hi/hello
 */
export function formatGreetingMessage(): string {
  return `👋 *Welcome to Kalyan Chemist!*\n\nWe're your trusted local pharmacy, now online.\n\nHow can we help you today?\n\n• Send us a *medicine name* to check availability\n• Reply with your enquiry\n• Visit our website: kalyanchemist.com`;
}
