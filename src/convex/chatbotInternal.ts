/* ══════════════════════════════════════════════════════════════
   CHATBOT INTERNAL — data access layer for the LLM engine.

   Convex actions ("use node") cannot touch ctx.db directly, so
   chatbotLlm.ts calls these internal queries/mutations to ground
   the LLM in real platform data. Every function is scoped to the
   authenticated user passed down from the action.
   ══════════════════════════════════════════════════════════════ */

import { internalQuery, internalMutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

/* ─── Conversation history (excluding the new message, which the
       action appends itself and which is persisted at the end) ─── */

export const getRecentMessages = internalQuery({
  args: {
    conversationId: v.id("chatbot_conversations"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.userId !== args.userId) return [];

    const msgs = await ctx.db
      .query("chatbot_messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .take(24);

    // Oldest → newest, user/assistant turns only (system rows never go to the LLM)
    return msgs
      .reverse()
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments,
      }));
  },
});

/* ─── Attachment URL (Convex file storage) ─── */

export const getAttachmentUrl = internalQuery({
  args: {
    fileId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Ownership was already established: the action only requests files it
    // read from this user's own conversation messages.
    return await ctx.storage.getUrl(args.fileId as any);
  },
});

/* ─── Customer snapshot for the system prompt ─── */

export const getCustomerContext = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId as Id<"users">);
    if (!user) return null;

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", args.userId as any))
      .collect();

    const reminders = await ctx.db
      .query("refill_reminders")
      .withIndex("by_user", (q) => q.eq("userId", args.userId as any))
      .collect();

    const prescriptions = await ctx.db
      .query("prescriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId as any))
      .collect();

    return {
      name: user.name ?? null,
      email: user.email ?? null,
      orderCount: orders.length,
      activeReminders: reminders.filter((r) => r.isActive).length,
      pendingPrescriptions: prescriptions.filter(
        (p) => p.status === "pending" || p.status === "under_review"
      ).length,
    };
  },
});

/* ══════════════════════════════════════════════════════════════
   TOOL QUERIES — each returns EXACTLY the shape stored in
   chatbot_messages.toolData (schema.ts) so the UI can render
   grounded rich cards from live data.
   ══════════════════════════════════════════════════════════════ */

export const searchProductsTool = internalQuery({
  args: {
    query: v.string(),
    includeOutOfStock: v.boolean(),
  },
  handler: async (ctx, args) => {
    const products = await ctx.db
      .query("products")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    const phrase = args.query.trim().toLowerCase();
    const terms = phrase.split(/\s+/).filter((t) => t.length > 1);

    const scored = products
      .filter((p) => args.includeOutOfStock || p.stockQuantity > 0)
      .map((p) => {
        const name = p.name.toLowerCase();
        const comp = (p.composition || "").toLowerCase();
        const manu = (p.manufacturer || "").toLowerCase();
        let score = 0;
        for (const t of terms) {
          if (name.includes(t)) score += 10;
          if (comp.includes(t)) score += 6;
          if (manu.includes(t)) score += 3;
        }
        if (phrase.length > 2 && name.includes(phrase)) score += 8;
        return { p, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    return scored.map(({ p }) => ({
      productId: p._id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      discountPrice: p.discountPrice,
      stockQuantity: p.stockQuantity,
      imageUrl: p.imageUrl,
      manufacturer: p.manufacturer,
      packSize: p.packSize,
      prescriptionRequired: p.prescriptionRequired,
    }));
  },
});

export const getOrdersTool = internalQuery({
  args: {
    userId: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user", (q) => q.eq("userId", args.userId as any))
      .order("desc")
      .take(Math.min(Math.max(Math.round(args.limit) || 5, 1), 10));

    return orders.map((o) => ({
      orderId: o._id,
      invoiceNumber: o.invoiceNumber,
      status: o.status,
      totalAmount: o.totalAmount,
      itemsSummary: o.items.map((i) => `${i.name} × ${i.quantity}`).join(", "),
      createdAt: o.createdAt,
    }));
  },
});

export const getRefillsTool = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const reminders = await ctx.db
      .query("refill_reminders")
      .withIndex("by_user", (q) => q.eq("userId", args.userId as any))
      .collect();

    const active = reminders
      .filter((r) => r.isActive)
      .sort((a, b) => a.nextReminderAt - b.nextReminderAt)
      .slice(0, 10);

    const detailed = [];
    for (const r of active) {
      const product = await ctx.db.get(r.productId);
      if (!product) continue;
      detailed.push({
        productName: product.name,
        slug: product.slug,
        intervalDays: r.intervalDays,
        nextReminderAt: r.nextReminderAt,
        daysUntil: Math.ceil((r.nextReminderAt - Date.now()) / 86400000),
        notes: r.notes,
      });
    }
    return { activeReminders: detailed };
  },
});

export const getPrescriptionsTool = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const rx = await ctx.db
      .query("prescriptions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId as any))
      .order("desc")
      .take(10);

    return {
      prescriptions: rx.map((p) => ({
        patientName: p.patientName,
        doctorName: p.doctorName,
        status: p.status,
        fileName: p.fileName,
        adminNotes: p.adminNotes,
        rejectionReason: p.rejectionReason,
        clarificationNote: p.clarificationNote,
        uploadedAt: p.createdAt,
      })),
    };
  },
});

export const getDoctorsTool = internalQuery({
  args: { specialty: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let doctors;
    if (args.specialty) {
      const wanted = args.specialty.toLowerCase();
      doctors = await ctx.db
        .query("doctors")
        .withIndex("by_specialty_active", (q) =>
          q.eq("specialty", args.specialty!).eq("isActive", true)
        )
        .take(10);
      if (doctors.length === 0) {
        // Substring fallback so "heart" matches "Cardiologist" style entries
        const all = await ctx.db
          .query("doctors")
          .withIndex("by_isActive", (q) => q.eq("isActive", true))
          .collect();
        doctors = all
          .filter((d) => d.specialty.toLowerCase().includes(wanted))
          .slice(0, 10);
      }
    } else {
      doctors = await ctx.db
        .query("doctors")
        .withIndex("by_isActive", (q) => q.eq("isActive", true))
        .take(10);
    }

    return doctors.map((d) => ({
      doctorId: d._id,
      doctorName: d.name,
      specialty: d.specialty,
      consultationFee: d.consultationFee,
      city: d.city,
      experience: d.experience,
    }));
  },
});

export const getLabTestsTool = internalQuery({
  args: { query: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const tests = await ctx.db
      .query("lab_tests")
      .withIndex("by_active", (q) => q.eq("active", true))
      .collect();

    let selected = tests;
    if (args.query) {
      const q = args.query.toLowerCase();
      const matched = tests.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.categoryName.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      );
      if (matched.length > 0) selected = matched;
    }

    return selected.slice(0, 8).map((t) => ({
      testId: t._id,
      name: t.name,
      discountedPrice: t.discountedPrice,
      originalPrice: t.originalPrice,
      reportTime: t.reportTime,
      sampleType: t.sampleType,
    }));
  },
});

export const getStoreInfoTool = internalQuery({
  args: {},
  handler: async (ctx) => {
    const config = await ctx.db.query("delivery_config").first();
    if (!config) {
      return {
        configured: false,
        note: "Live store configuration unavailable. Use these standing defaults: Mon–Sat, 8 AM – 10 PM · +91 98765 43210 · 123 Health Street, Mumbai, Maharashtra 400001.",
      };
    }
    return {
      configured: true,
      storeName: config.storeName,
      storeAddress: config.storeAddress,
      storePhone: config.storePhone,
      storeWhatsApp: config.storeWhatsApp,
      businessHours: config.businessHours,
      deliveryFee: config.defaultDeliveryFee,
      freeDeliveryThreshold: config.freeDeliveryThreshold,
      minimumOrder: config.minimumOrder,
      estimatedDeliveryTime: config.estimatedDeliveryTime,
      codAvailable: config.defaultCodAvailable,
      paymentMethods: config.defaultCodAvailable
        ? ["Online (UPI / cards / net banking)", "Cash on Delivery"]
        : ["Online (UPI / cards / net banking)"],
      serviceablePincodes: config.pincodes
        .filter((p) => p.isActive)
        .map((p) => p.pincode),
    };
  },
});

/* ─── Support ticket (human handoff) ─── */

const TICKET_CATEGORIES = [
  "complaint",
  "refund",
  "order_issue",
  "medical_consultation",
  "other",
] as const;

export const createSupportTicketTool = internalMutation({
  args: {
    userId: v.string(),
    conversationId: v.optional(v.id("chatbot_conversations")),
    subject: v.string(),
    description: v.string(),
    category: v.string(),
  },
  handler: async (ctx, args) => {
    const category = (TICKET_CATEGORIES as readonly string[]).includes(args.category)
      ? (args.category as (typeof TICKET_CATEGORIES)[number])
      : "other";

    const ticketId = await ctx.db.insert("support_tickets", {
      userId: args.userId as any,
      conversationId: args.conversationId,
      subject: args.subject.slice(0, 200),
      description: args.description.slice(0, 4000),
      category,
      status: "open",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Visible confirmation in the customer's notification centre
    await ctx.db.insert("notifications", {
      userId: args.userId as any,
      type: "system",
      title: "Support request received",
      body: `We've logged your request ("${args.subject.slice(0, 80)}") and our team will contact you soon (Mon–Sat, 8 AM – 10 PM).`,
      read: false,
      createdAt: Date.now(),
    });

    return { ticketId };
  },
});

/* ══════════════════════════════════════════════════════════════
   PERSISTENCE — save the completed exchange after the agentic
   LLM loop finishes. toolData mirrors the schema so the UI can
   render rich grounded cards.
   ══════════════════════════════════════════════════════════════ */

export const persistMessages = internalMutation({
  args: {
    conversationId: v.id("chatbot_conversations"),
    userId: v.string(),
    userContent: v.string(),
    assistantContent: v.string(),
    attachments: v.optional(
      v.array(
        v.object({
          fileId: v.string(),
          fileName: v.string(),
          fileType: v.string(),
          fileSize: v.number(),
        })
      )
    ),
    handoffTriggered: v.boolean(),
    responseTimeMs: v.optional(v.number()),
    toolData: v.optional(
      v.object({
        products: v.optional(
          v.array(
            v.object({
              productId: v.id("products"),
              name: v.string(),
              slug: v.string(),
              price: v.number(),
              discountPrice: v.optional(v.number()),
              stockQuantity: v.number(),
              imageUrl: v.optional(v.string()),
              manufacturer: v.optional(v.string()),
              packSize: v.optional(v.string()),
              prescriptionRequired: v.optional(v.boolean()),
            })
          )
        ),
        orders: v.optional(
          v.array(
            v.object({
              orderId: v.id("orders"),
              invoiceNumber: v.optional(v.string()),
              status: v.string(),
              totalAmount: v.number(),
              itemsSummary: v.optional(v.string()),
              createdAt: v.number(),
            })
          )
        ),
        appointments: v.optional(
          v.array(
            v.object({
              doctorId: v.id("doctors"),
              doctorName: v.string(),
              specialty: v.string(),
              consultationFee: v.number(),
              city: v.optional(v.string()),
              experience: v.optional(v.string()),
            })
          )
        ),
        labTests: v.optional(
          v.array(
            v.object({
              testId: v.id("lab_tests"),
              name: v.string(),
              discountedPrice: v.number(),
              originalPrice: v.number(),
              reportTime: v.optional(v.string()),
              sampleType: v.optional(v.string()),
            })
          )
        ),
      })
    ),
    preferredLanguage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const conv = await ctx.db.get(args.conversationId);
    if (!conv || conv.userId !== args.userId) {
      throw new Error("Conversation not found");
    }

    const now = Date.now();

    await ctx.db.insert("chatbot_messages", {
      conversationId: args.conversationId,
      userId: args.userId as any,
      role: "user",
      content: args.userContent,
      attachments: args.attachments,
      intent: "ai_assistant",
      language: args.preferredLanguage,
      createdAt: now,
    });

    const assistantMessageId = await ctx.db.insert("chatbot_messages", {
      conversationId: args.conversationId,
      userId: args.userId as any,
      role: "assistant",
      content: args.assistantContent,
      intent: "ai_assistant",
      productIds: args.toolData?.products?.map((p) => p.productId) as any,
      orderIds: args.toolData?.orders?.map((o) => o.orderId) as any,
      toolData: args.toolData,
      responseTimeMs: args.responseTimeMs,
      handoffTriggered: args.handoffTriggered,
      createdAt: now,
    });

    const isFirstMessage = conv.messageCount === 0;
    await ctx.db.patch(args.conversationId, {
      title: isFirstMessage
        ? args.userContent.slice(0, 50) + (args.userContent.length > 50 ? "…" : "")
        : conv.title,
      lastMessageAt: now,
      messageCount: conv.messageCount + 2,
      handoffRequested: args.handoffTriggered ? true : conv.handoffRequested,
      handoffReason: args.handoffTriggered
        ? "Customer requested human/pharmacist support"
        : conv.handoffReason,
      language: args.preferredLanguage ?? conv.language,
    });

    return { assistantMessageId };
  },
});
