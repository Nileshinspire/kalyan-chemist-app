import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ══════════════════════════════════════════════════════
//  WHATSAPP CONVERSATION FLOW
//  State machine: new → medicine_requested → awaiting_address
//                → address_received → awaiting_quantity → order_summary
//                → confirmed / declined
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

    // Look for an existing active conversation
    const existing = await ctx.db
      .query("whatsapp_conversations")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .order("desc")
      .first();

    if (existing) {
      const activeStates = [
        "new", "medicine_requested", "availability_sent", "awaiting_response",
        "awaiting_address", "address_received", "awaiting_quantity",
        "order_summary", "add_more_medicines", "unavailable",
      ];
      if (activeStates.includes(existing.state)) {
        // Check if conversation has timed out
        if (Date.now() - existing.lastMessageAt > CONVERSATION_TIMEOUT_MS) {
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
    medicineList: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    const newState = args.available ? "awaiting_address" : "unavailable";

    await ctx.db.patch(args.conversationId, {
      state: newState,
      productName: args.productName,
      productId: args.productId,
      requestedQuantity: args.requestedQuantity,
      available: args.available,
      price: args.price,
      prescriptionRequired: args.prescriptionRequired,
      customerName: args.customerName ?? conversation.customerName,
      userId: args.userId ?? conversation.userId,
      enquiryId: args.enquiryId ?? conversation.enquiryId,
      medicineList: args.medicineList ?? conversation.medicineList,
      messageCount: conversation.messageCount + 1,
      lastMessageAt: Date.now(),
    });

    return { success: true, state: newState };
  },
});

/**
 * Update conversation: save delivery address
 */
export const updateDeliveryAddress = mutation({
  args: {
    conversationId: v.id("whatsapp_conversations"),
    deliveryAddress: v.string(),
    deliveryAddressFull: v.string(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    await ctx.db.patch(args.conversationId, {
      state: "address_received",
      deliveryAddress: args.deliveryAddress,
      deliveryAddressFull: args.deliveryAddressFull,
      messageCount: conversation.messageCount + 1,
      lastMessageAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update conversation: save quantity
 */
export const updateQuantity = mutation({
  args: {
    conversationId: v.id("whatsapp_conversations"),
    quantity: v.number(),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    await ctx.db.patch(args.conversationId, {
      state: "order_summary",
      requestedQuantity: args.quantity,
      messageCount: conversation.messageCount + 1,
      lastMessageAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Update conversation: switch to add_more_medicines state
 */
export const switchToAddMore = mutation({
  args: {
    conversationId: v.id("whatsapp_conversations"),
  },
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) throw new Error("Conversation not found");

    await ctx.db.patch(args.conversationId, {
      state: "add_more_medicines",
      messageCount: conversation.messageCount + 1,
      lastMessageAt: Date.now(),
    });

    return { success: true };
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
    const confirmableStates = ["availability_sent", "awaiting_response", "address_received", "order_summary"];
    if (!confirmableStates.includes(conversation.state)) {
      throw new Error(`Cannot confirm order in state: ${conversation.state}`);
    }

    // Re-check stock before confirming
    if (conversation.productId) {
      const product = await ctx.db.get(conversation.productId);
      if (!product) {
        throw new Error("Product no longer exists");
      }
      if (product.stockQuantity < (conversation.requestedQuantity ?? 1)) {
        await ctx.db.patch(args.conversationId, {
          state: "unavailable",
          available: false,
          messageCount: conversation.messageCount + 1,
          lastMessageAt: Date.now(),
        });
        return { success: false, reason: "out_of_stock" };
      }
    }

    // Re-check stock for all medicines in multi-medicine order
    if (conversation.medicineList) {
      try {
        const meds = JSON.parse(conversation.medicineList);
        for (const med of meds) {
          if (med.productId) {
            const product: any = await ctx.db.get(med.productId);
            if (!product || (product.stockQuantity ?? 0) < (med.quantity || 1)) {
              await ctx.db.patch(args.conversationId, {
                state: "unavailable",
                available: false,
                messageCount: conversation.messageCount + 1,
                lastMessageAt: Date.now(),
              });
              return { success: false, reason: "out_of_stock", medicine: med.name };
            }
          }
        }
      } catch {
        // If JSON parsing fails, continue with single product check
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
 * Search products by name (fuzzy partial match)
 */
export const searchProducts = query({
  args: { searchTerm: v.string() },
  handler: async (ctx, args) => {
    const term = args.searchTerm.toLowerCase().trim();

    const allProducts = await ctx.db
      .query("products")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    const scored = allProducts.map((product) => {
      const name = product.name.toLowerCase();
      const composition = (product.composition || "").toLowerCase();
      const sku = (product.sku || "").toLowerCase();

      let score = 0;

      if (name === term) score += 100;
      else if (name.startsWith(term)) score += 80;
      else if (name.includes(term)) score += 60;

      if (composition.includes(term)) score += 40;
      if (sku.includes(term)) score += 30;

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
        price: (s.product as any).discountPrice || (s.product as any).price || 0,
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
 * Get a product by ID
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

    const activeStates = [
      "new", "medicine_requested", "availability_sent", "awaiting_response",
      "awaiting_address", "address_received", "awaiting_quantity",
      "order_summary", "add_more_medicines",
    ];

    return {
      total: all.length,
      active: all.filter((c) => activeStates.includes(c.state)).length,
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
