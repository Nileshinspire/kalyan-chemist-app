import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ══════════════════════════════════════════════════════
//  WHATSAPP CONVERSATION FLOW
//  State machine: new → medicine_requested → availability_sent
//                → awaiting_response → confirmed / declined
// ══════════════════════════════════════════════════════

const CONVERSATION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Get or create a conversation for a phone number
 */
export const getOrCreate = mutation({
  args: {
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    const phone = normalizePhone(args.phone);

    // Look for an existing active conversation (not confirmed, declined, or expired)
    const existing = await ctx.db
      .query("whatsapp_conversations")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .order("desc")
      .first();

    if (existing) {
      // If conversation is still active (not terminal state)
      const activeStates = ["new", "medicine_requested", "availability_sent", "awaiting_response", "unavailable"];
      if (activeStates.includes(existing.state)) {
        // Check if conversation has timed out (30 min)
        if (Date.now() - existing.lastMessageAt > CONVERSATION_TIMEOUT_MS) {
          // Mark old conversation as expired and create new one
          await ctx.db.patch(existing._id, { state: "expired" });
          return createConversation(ctx, phone);
        }
        return existing;
      }
    }

    return createConversation(ctx, phone);
  },
});

async function createConversation(ctx: any, phone: string) {
  const now = Date.now();
  const id = await ctx.db.insert("whatsapp_conversations", {
    phone,
    state: "new",
    messageCount: 0,
    lastMessageAt: now,
    createdAt: now,
  });
  return ctx.db.get(id);
}

/**
 * Update conversation state: customer requested a medicine
 */
export const updateMedicineRequest = mutation({
  args: {
    conversationId: v.id("whatsapp_conversations"),
    productName: v.string(),
    productId: v.optional(v.id("products")),
    requestedQuantity: v.number(),
    available: v.boolean(),
    price: v.optional(v.number()),
    prescriptionRequired: v.optional(v.boolean()),
    customerName: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    enquiryId: v.optional(v.id("whatsapp_enquiries")),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const newState = args.available ? "availability_sent" : "unavailable";

    await ctx.db.patch(args.conversationId, {
      state: newState,
      productName: args.productName,
      productId: args.productId,
      requestedQuantity: args.requestedQuantity,
      available: args.available,
      price: args.price,
      prescriptionRequired: args.prescriptionRequired,
      customerName: args.customerName,
      userId: args.userId,
      enquiryId: args.enquiryId,
      messageCount: conversation.messageCount + 1,
      lastMessageAt: Date.now(),
    });

    return { success: true, state: newState };
  },
});

/**
 * Update conversation: customer responded with YES (confirm order)
 */
export const confirmOrder = mutation({
  args: {
    conversationId: v.id("whatsapp_conversations"),
    orderId: v.optional(v.id("orders")),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    // Verify we're in the right state
    if (conversation.state !== "availability_sent" && conversation.state !== "awaiting_response") {
      throw new Error(`Cannot confirm order in state: ${conversation.state}`);
    }

    // Re-check stock before confirming
    if (conversation.productId) {
      const product = await ctx.db.get(conversation.productId);
      if (!product) {
        throw new Error("Product no longer exists");
      }
      if (product.stockQuantity < (conversation.requestedQuantity ?? 1)) {
        // Update state to unavailable
        await ctx.db.patch(args.conversationId, {
          state: "unavailable",
          available: false,
          messageCount: conversation.messageCount + 1,
          lastMessageAt: Date.now(),
        });
        return { success: false, reason: "out_of_stock" };
      }
    }

    await ctx.db.patch(args.conversationId, {
      state: "confirmed",
      orderId: args.orderId,
      messageCount: conversation.messageCount + 1,
      lastMessageAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update conversation: customer declined
 */
export const declineOrder = mutation({
  args: {
    conversationId: v.id("whatsapp_conversations"),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    await ctx.db.patch(args.conversationId, {
      state: "declined",
      messageCount: conversation.messageCount + 1,
      lastMessageAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Increment message count for a conversation
 */
export const incrementMessage = mutation({
  args: {
    conversationId: v.id("whatsapp_conversations"),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    await ctx.db.patch(args.conversationId, {
      messageCount: conversation.messageCount + 1,
      lastMessageAt: Date.now(),
    });

    return { success: true };
  },
});

// ══════════════════════════════════════════════════════
//  INTERNAL (for webhook handler)
// ══════════════════════════════════════════════════════

/**
 * Search products by name (fuzzy partial match) — internal
 */
export const searchProducts = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    const term = args.searchTerm.toLowerCase().trim();

    // Get all active products and do client-side matching
    const allProducts = await ctx.db
      .query("products")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    // Score-based matching
    const scored = allProducts.map((product) => {
      const name = product.name.toLowerCase();
      const composition = (product.composition || "").toLowerCase();
      const sku = (product.sku || "").toLowerCase();

      let score = 0;

      // Exact name match
      if (name === term) score += 100;
      // Name starts with term
      else if (name.startsWith(term)) score += 80;
      // Name contains term
      else if (name.includes(term)) score += 60;

      // Composition match
      if (composition.includes(term)) score += 40;

      // SKU match
      if (sku.includes(term)) score += 30;

      // Word-level matching
      const termWords = term.split(/\s+/);
      const nameWords = name.split(/\s+/);
      for (const tw of termWords) {
        for (const nw of nameWords) {
          if (nw === tw) score += 20;
          else if (nw.startsWith(tw)) score += 10;
        }
      }

      return { product, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((s) => ({
        _id: s.product._id,
        name: s.product.name,
        price: s.product.price,
        discountPrice: s.product.discountPrice,
        composition: s.product.composition,
        stockQuantity: s.product.stockQuantity,
        prescriptionRequired: s.product.prescriptionRequired,
        slug: s.product.slug,
        score: s.score,
      }));
  },
});

/**
 * Get a product by ID — internal
 */
export const getProduct = query({
  args: { productId: v.id("products") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.productId);
  },
});

/**
 * Get delivery config for the store phone number
 */
export const getDeliveryConfig = query({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db.query("delivery_config").first();
    return config;
  },
});

// ══════════════════════════════════════════════════════
//  ADMIN QUERIES
// ══════════════════════════════════════════════════════

/**
 * List all conversations (admin)
 */
export const listConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Unauthorized");

    const conversations = await ctx.db
      .query("whatsapp_conversations")
      .withIndex("by_lastMessage")
      .order("desc")
      .collect();

    return conversations;
  },
});

/**
 * Get conversation stats (admin)
 */
export const conversationStats = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user || user.role !== "admin") throw new Error("Unauthorized");

    const all = await ctx.db.query("whatsapp_conversations").collect();

    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayMs = todayStart.getTime();

    return {
      total: all.length,
      active: all.filter((c) =>
        ["new", "medicine_requested", "availability_sent", "awaiting_response"].includes(c.state),
      ).length,
      confirmed: all.filter((c) => c.state === "confirmed").length,
      declined: all.filter((c) => c.state === "declined").length,
      unavailable: all.filter((c) => c.state === "unavailable").length,
      expired: all.filter((c) => c.state === "expired").length,
      todayCount: all.filter((c) => c.createdAt >= todayMs).length,
    };
  },
});

// ── Helpers ──

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
