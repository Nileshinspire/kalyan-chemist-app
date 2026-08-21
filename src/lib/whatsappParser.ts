/**
 * WhatsApp Message Parser for Kalyan Chemist
 *
 * Parses incoming WhatsApp messages to detect:
 * - Medicine/product requests (single and multiple)
 * - Delivery address (with completeness check)
 * - Quantity requests
 * - Positive/negative responses
 * - Add-more / done intents
 * - Greetings
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
  "haan kardo",
  "yes please",
  "yes confirm",
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
  "rehne do",
  "nahi karna",
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

const ADD_MORE_RESPONSES = [
  "add more",
  "also need",
  "also want",
  "one more",
  "another",
  "aur bhi",
  "aur chahiye",
  "plus",
  "and",
  "with that",
  "sath mein",
  "iske sath",
  "also add",
  "i also need",
  "i also want",
  "add another",
  "kuch aur",
  "aur ek",
];

const DONE_RESPONSES = [
  "done",
  "that's all",
  "thats all",
  "nothing else",
  "bas",
  "bas itna hi",
  "no more",
  "that is all",
  "sirf itna",
  "enough",
  "no more medicines",
  "no more items",
  "complete",
  "finish",
  "done ordering",
  "no thats all",
  "no that's all",
];

export type MessageIntent =
  | { type: "medicine_request"; medicine: string; quantity: number; multiple?: boolean; allMedicines?: string[] }
  | { type: "address_message"; address: string; isComplete: boolean }
  | { type: "quantity_message"; quantity: number }
  | { type: "positive_response" }
  | { type: "negative_response" }
  | { type: "add_more_medicines" }
  | { type: "done_adding" }
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

  // Check for "add more medicines" intent
  if (isAddMoreResponse(cleaned)) {
    return { type: "add_more_medicines" };
  }

  // Check for "done adding" intent
  if (isDoneResponse(cleaned)) {
    return { type: "done_adding" };
  }

  // Check for pure positive response (short or exact match)
  // If the message starts with a positive word, treat it as positive even if it has other words
  if (isPositiveResponse(cleaned)) {
    const startsWithPositive = POSITIVE_RESPONSES.some((r) => cleaned.startsWith(r));
    if (!hasMedicineWords(cleaned) || startsWithPositive) {
      return { type: "positive_response" };
    }
  }

  // Check for pure negative response — always check before medicine extraction
  if (isNegativeResponse(cleaned)) {
    return { type: "negative_response" };
  }

  // Check for quantity-only message (e.g., "2", "3 strips", "5 tablets")
  const qtyOnly = extractQuantityOnly(cleaned);
  if (qtyOnly !== null) {
    return { type: "quantity_message", quantity: qtyOnly };
  }

  // Check for address message
  if (looksLikeAddress(cleaned)) {
    const isComplete = isAddressComplete(cleaned);
    return { type: "address_message", address: message.trim(), isComplete };
  }

  // Try to extract medicine request (single or multiple)
  const medicineRequest = extractMedicineRequest(cleaned);
  if (medicineRequest) {
    return medicineRequest;
  }

  return { type: "unknown" };
}

// ── Intent Detection Helpers ──

export function isPositiveResponse(message: string): boolean {
  const cleaned = message.trim().toLowerCase();

  // Exact match
  if (POSITIVE_RESPONSES.includes(cleaned)) return true;

  // Contains a positive keyword as a standalone word
  for (const keyword of POSITIVE_RESPONSES) {
    if (keyword.length <= 3) continue;
    if (cleaned.includes(keyword)) return true;
  }

  // Check for "yes" variants with punctuation
  if (/^y+e*s+!*\?*$/i.test(cleaned)) return true;
  if (/^o+k+a*y*!*\?*$/i.test(cleaned)) return true;
  if (/^h+a+n+$/i.test(cleaned)) return true;

  return false;
}

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

function isGreeting(message: string): boolean {
  const cleaned = message.trim().toLowerCase();
  return GREETING_RESPONSES.some((g) => cleaned === g || cleaned.startsWith(g));
}

function isAddMoreResponse(message: string): boolean {
  const cleaned = message.trim().toLowerCase();
  return ADD_MORE_RESPONSES.some((r) => cleaned === r || cleaned.startsWith(r));
}

function isDoneResponse(message: string): boolean {
  const cleaned = message.trim().toLowerCase();
  return DONE_RESPONSES.some((r) => cleaned === r || cleaned.includes(r));
}

// ── Address Detection ──

/**
 * Check if a message looks like a delivery address
 * Indian addresses typically contain pincode (6 digits), city names, state names,
 * flat/house numbers, street names, etc.
 */
function looksLikeAddress(message: string): boolean {
  // Skip messages that are clearly medicine requests
  const medicineVerbs = ["need", "want", "buy", "order", "looking for", "search for"];
  for (const v of medicineVerbs) {
    if (message.startsWith(v + " ")) return false;
  }

  // Contains a 6-digit pincode
  if (/\b\d{6}\b/.test(message)) return true;

  // Contains Indian state names
  const states = [
    "maharashtra", "mumbai", "bangalore", "bengaluru", "delhi", "chennai",
    "hyderabad", "kolkata", "pune", "ahmedabad", "jaipur", "lucknow",
    "gujarat", "rajasthan", "karnataka", "tamil nadu", "telangana",
    "madhya pradesh", "uttar pradesh", "west bengal", "andhra pradesh",
    "kerala", "goa", "punjab", "haryana", "bihar", "jharkhand",
    "odisha", "assam", "meghalaya", "tripura", "mizoram", "manipur",
    "nagaland", "sikkim", "arunachal Pradesh", "chhattisgarh", "uttarakhand",
    "himachal pradesh", "chandigarh", "puducherry",
  ];
  if (states.some((s) => message.includes(s.toLowerCase()))) return true;

  // Contains common address indicators
  const addressIndicators = [
    "flat", "house", "apartment", "apt", "floor", "tower", "wing",
    "block", "sector", "road", "street", "lane", "nagar", "colony",
    "society", "building", "bldg", "near", "opp", "behind", "beside",
    "area", "locality", "district", "pincode", "pin", "landmark",
    "flat no", "house no", "shop no", "office",
  ];
  const indicatorCount = addressIndicators.filter((ind) =>
    message.includes(ind)
  ).length;
  if (indicatorCount >= 2) return true;

  // Contains patterns like "123, MG Road" or "Flat 4B, Sunrise Apartments"
  if (/\d+[,\s]+[a-z]/.test(message) && message.length > 15) return true;

  return false;
}

/**
 * Check if an address is "complete" enough for delivery
 * Requires: street/area + city + pincode at minimum
 */
function isAddressComplete(message: string): boolean {
  const hasPincode = /\b\d{6}\b/.test(message);
  const hasCity = /\b(mumbai|delhi|bangalore|bengaluru|chennai|hyderabad|kolkata|pune|ahmedabad|jaipur|lucknow|nagpur|indore|bhopal|patna|surat|vadodara|rajkot|udaipur|jodhpur|agra|varanasi|meerut|noida|ghaziabad|faridabad|gurgaon|gurugram|navi mumbai|thane|navi|mumbai)\b/i.test(message);
  const hasStreetOrArea = /\b(road|street|lane|nagar|colony|society|area|locality|sector|block|phase|district|ward|village|town|city)\b/i.test(message);
  const hasHouseOrFlat = /\b(flat|house|apt|apartment|tower|wing|floor|block|shop|office|building|bldg|no\.|number)\b/i.test(message);

  // Minimum: pincode + (city or street/area)
  if (hasPincode && (hasCity || hasStreetOrArea)) return true;

  // If it's a long address (>30 chars) with multiple indicators, consider it complete
  if (message.length > 30 && hasPincode && (hasHouseOrFlat || hasStreetOrArea)) return true;

  return false;
}

// ── Quantity Detection ──

/**
 * Extract quantity from a short message that only contains a number or "N strips/tablets"
 */
function extractQuantityOnly(message: string): number | null {
  const cleaned = message.trim();

  // Just a number
  if (/^\d+$/.test(cleaned)) {
    const n = parseInt(cleaned, 10);
    if (n >= 1 && n <= 99) return n;
  }

  // "N strips", "N tablets", "N capsules", etc.
  const match = cleaned.match(/^(\d+)\s*(strip|tablet|capsule|piece|bottle|sachet|tube|box|pack|nos?\.?)s?$/i);
  if (match) {
    const n = parseInt(match[1], 10);
    if (n >= 1 && n <= 99) return n;
  }

  // "N x" or "N×"
  const match2 = cleaned.match(/^(\d+)\s*[x×]$/i);
  if (match2) {
    const n = parseInt(match2[1], 10);
    if (n >= 1 && n <= 99) return n;
  }

  return null;
}

// ── Medicine Detection ──

function hasMedicineWords(message: string): boolean {
  if (/\d+\s*(mg|ml|g|mcg|iu)/i.test(message)) return true;
  if (/\d+\s*(strip|tablet|capsule|bottle|sachet|tube|box|pack)/i.test(message)) return true;
  const medicineVerbs = ["need", "want", "buy", "order", "give", "send", "get", "looking", "search", "find", "show", "price", "cost", "availability"];
  for (const v of medicineVerbs) {
    if (message.startsWith(v + " ") || message.includes(" " + v + " ")) return true;
  }
  if (/^\d+\s+[a-z]/.test(message)) return true;
  return false;
}

/**
 * Split a message into multiple medicine names.
 * Handles: "dolo and crocin", "dolo, crocin, paracetamol", "dolo crocin"
 */
function splitMultipleMedicines(text: string): string[] {
  // Try comma-separated first
  if (text.includes(",")) {
    return text.split(",").map((s) => s.trim()).filter((s) => s.length > 1);
  }

  // Try "and" separated: "dolo and crocin"
  if (/\s+and\s+/.test(text)) {
    return text.split(/\s+and\s+/).map((s) => s.trim()).filter((s) => s.length > 1);
  }

  // Try "&" separated
  if (text.includes("&")) {
    return text.split("&").map((s) => s.trim()).filter((s) => s.length > 1);
  }

  return [text];
}

/**
 * Extract medicine name and quantity from a free-text message.
 * Supports patterns like:
 * - "paracetamol"
 * - "2 paracetamol"
 * - "paracetamol 2"
 * - "need paracetamol 2 strips"
 * - "i want crocin 1 strip"
 * - "dolo and crocin"
 * - "dolo, crocin, paracetamol"
 */
export function extractMedicineRequest(
  message: string,
): { type: "medicine_request"; medicine: string; quantity: number; multiple?: boolean; allMedicines?: string[] } | null {
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

  // Check for multiple medicines
  const medicineParts = splitMultipleMedicines(text);

  if (medicineParts.length > 1) {
    // Multiple medicines: extract each one
    const allMedicines: string[] = [];
    let firstMedicine = "";
    let firstQty = 1;

    for (const part of medicineParts) {
      const extracted = extractSingleMedicine(part.trim());
      if (extracted) {
        allMedicines.push(extracted.medicine);
        if (!firstMedicine) {
          firstMedicine = extracted.medicine;
          firstQty = extracted.quantity;
        }
      }
    }

    if (allMedicines.length > 0) {
      return {
        type: "medicine_request",
        medicine: firstMedicine,
        quantity: firstQty,
        multiple: allMedicines.length > 1,
        allMedicines,
      };
    }
  }

  // Single medicine
  const result = extractSingleMedicine(text);
  return result ? { ...result, type: "medicine_request" as const } : null;
}

/**
 * Extract a single medicine name and quantity from text
 */
function extractSingleMedicine(text: string): { medicine: string; quantity: number } | null {
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

  // Remove common suffixes
  medicineName = medicineName
    .replace(
      /\s+(strip|tablets?|capsule?s?|piece?s?|bottle|sachet|tube|box|pack|piece|no\.?|nos\.?)$/i,
      "",
    )
    .trim();

  // Remove trailing punctuation
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

  return { medicine: medicineName, quantity };
}

// ── Message Formatters ──

/**
 * Format the welcome/greeting response
 */
export function formatGreetingMessage(): string {
  return `💊 *Namaste! Welcome to Kalyan Chemist.*

We're your trusted local pharmacy, now online.

Please share your *prescription* or type the *name of the medicine(s)* or health essentials you need.

You can also say things like:
• "Dolo"
• "I need Crocin"
• "Paracetamol and Crocin"

We're here to help! 🏥`;
}

/**
 * Format the address request message
 */
export function formatAddressRequestMessage(params: {
  productName: string;
  quantity: number;
  multiple?: boolean;
  allMedicines?: string[];
}): string {
  const medicineList = params.multiple && params.allMedicines
    ? params.allMedicines.join(", ")
    : params.productName;

  let msg = `💊 I'll help you order *${medicineList}*.`;
  msg += `\n\nTo check availability, price, and arrange doorstep delivery, please share your *complete delivery address*, including:`;
  msg += `\n\n• Door/Flat number`;
  msg += `\n• Building/Society name`;
  msg += `\n• Area or landmark`;
  msg += `\n• City`;
  msg += `\n• Full Pincode`;
  msg += `\n\nYou may also share your location on WhatsApp if you prefer.`;
  return msg;
}

/**
 * Format the incomplete address response
 */
export function formatIncompleteAddressMessage(): string {
  return `Thank you! To arrange accurate delivery, could you please share your *complete delivery address* including your area, city, and pincode? 💊

Example:
• Flat 4B, Sunrise Apartments
• MG Road, Andheri West
• Mumbai, Maharashtra — 400058`;
}

/**
 * Format the quantity request message
 */
export function formatQuantityRequestMessage(params: {
  productName: string;
  price?: number;
}): string {
  let msg = `How many units would you like to order? 💊`;
  msg += `\n\n📦 *${params.productName}*`;
  if (params.price) {
    msg += `\n💰 Price: ₹${params.price.toLocaleString("en-IN")} per unit`;
  }
  msg += `\n\nPlease reply with the quantity (e.g., "2", "3 strips", "1 box").`;
  return msg;
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
      msg += `\n💰 Price: ₹${(params.price * params.quantity).toLocaleString("en-IN")}`;
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
 * Format the "add more medicines?" prompt
 */
export function formatAddMoreMedicinesMessage(params: {
  currentMedicines: string[];
  totalPrice: number;
}): string {
  let msg = `Got it! I've added *${params.currentMedicines.join(", ")}* to your request.`;
  msg += `\n\n💰 Current total: ₹${params.totalPrice.toLocaleString("en-IN")}`;
  msg += `\n\nWould you like to *add any other medicines*?`;
  msg += `\n\n• Send another *medicine name* to add it`;
  msg += `\n• Reply *Done* to proceed to delivery address`;
  return msg;
}

/**
 * Format the order summary message
 */
export function formatOrderSummaryMessage(params: {
  medicines: Array<{ name: string; quantity: number; price: number }>;
  deliveryAddress: string;
  prescriptionRequired?: boolean;
  hasRxItems?: boolean;
  rxItems?: string[];
}): string {
  let msg = `💊 *Please confirm your order:*\n`;
  msg += `\n📋 *Medicines:*\n`;

  let total = 0;
  for (const med of params.medicines) {
    const itemTotal = med.price * med.quantity;
    total += itemTotal;
    msg += `• ${med.name} × ${med.quantity} — ₹${itemTotal.toLocaleString("en-IN")}\n`;
  }

  msg += `\n💰 *Total: ₹${total.toLocaleString("en-IN")}*`;
  msg += `\n\n📍 *Delivery Address:*`;
  msg += `\n${params.deliveryAddress}`;

  if (params.hasRxItems && params.rxItems && params.rxItems.length > 0) {
    msg += `\n\n⚠️ *Prescription Required for:*`;
    for (const rx of params.rxItems) {
      msg += `\n  • ${rx}`;
    }
    msg += `\nPlease have your valid prescription ready for verification.`;
  }

  msg += `\n\nWould you like to *place this order*?`;
  msg += `\nReply *Yes* to confirm or *No* to cancel.`;
  return msg;
}

/**
 * Format the confirmation message sent after customer says YES
 */
export function formatConfirmationMessage(params: {
  productName?: string;
  quantity?: number;
  price?: number;
  medicines?: Array<{ name: string; quantity: number; price: number }>;
}): string {
  let msg = `✅ *Your order has been confirmed successfully!*`;
  msg += `\n\nThank you for choosing *Kalyan Chemist*. We'll process your order shortly.`;

  if (params.medicines && params.medicines.length > 0) {
    msg += `\n\n📦 *Order Summary:*\n`;
    for (const med of params.medicines) {
      msg += `• ${med.name} × ${med.quantity}\n`;
    }
  } else if (params.productName) {
    msg += `\n\n📦 *${params.productName}* × ${params.quantity ?? 1}`;
    if (params.price) {
      msg += `\n💰 ₹${(params.price * (params.quantity ?? 1)).toLocaleString("en-IN")}`;
    }
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
