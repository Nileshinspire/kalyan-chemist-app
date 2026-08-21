import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

// User roles
export const ROLES = {
  ADMIN: "admin",
  CUSTOMER: "customer",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.CUSTOMER),
);
export type Role = Infer<typeof roleValidator>;

// Order statuses
export const ORDER_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  READY_FOR_DISPATCH: "ready_for_dispatch",
  OUT_FOR_DELIVERY: "out_for_delivery",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  REFUND_INITIATED: "refund_initiated",
  REFUNDED: "refunded",
} as const;

export const orderStatusValidator = v.union(
  v.literal(ORDER_STATUS.PENDING),
  v.literal(ORDER_STATUS.CONFIRMED),
  v.literal(ORDER_STATUS.PROCESSING),
  v.literal(ORDER_STATUS.READY_FOR_DISPATCH),
  v.literal(ORDER_STATUS.OUT_FOR_DELIVERY),
  v.literal(ORDER_STATUS.DELIVERED),
  v.literal(ORDER_STATUS.CANCELLED),
  v.literal(ORDER_STATUS.REFUND_INITIATED),
  v.literal(ORDER_STATUS.REFUNDED),
);

// Payment methods
export const PAYMENT_METHOD = {
  COD: "cod",
  ONLINE: "online",
} as const;

export const paymentMethodValidator = v.union(
  v.literal(PAYMENT_METHOD.COD),
  v.literal(PAYMENT_METHOD.ONLINE),
);

// Prescription statuses
export const PRESCRIPTION_STATUS = {
  PENDING: "pending",
  UNDER_REVIEW: "under_review",
  APPROVED: "approved",
  REJECTED: "rejected",
  NEEDS_CLARIFICATION: "needs_clarification",
} as const;

export const prescriptionStatusValidator = v.union(
  v.literal(PRESCRIPTION_STATUS.PENDING),
  v.literal(PRESCRIPTION_STATUS.UNDER_REVIEW),
  v.literal(PRESCRIPTION_STATUS.APPROVED),
  v.literal(PRESCRIPTION_STATUS.REJECTED),
  v.literal(PRESCRIPTION_STATUS.NEEDS_CLARIFICATION),
);

const schema = defineSchema(
  {
    // Default auth tables (DO NOT MODIFY)
    ...authTables,

    // Kalyan Chemist user profiles (extends auth)
    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),
      phone: v.optional(v.string()),
      address: v.optional(v.string()),
      city: v.optional(v.string()),
      state: v.optional(v.string()),
      pincode: v.optional(v.string()),
    }).index("email", ["email"]),

    // ── Brands ──
    brands: defineTable({
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      logoUrl: v.optional(v.string()),
      country: v.optional(v.string()),
      isActive: v.boolean(),
      sortOrder: v.number(),
    })
      .index("by_slug", ["slug"])
      .index("by_isActive", ["isActive"])
      .index("by_sortOrder", ["sortOrder"]),

    // Medicine categories (e.g. Pain Relief, Diabetes Care)
    categories: defineTable({
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      isActive: v.boolean(),
      sortOrder: v.number(),
    })
      .index("by_slug", ["slug"])
      .index("by_sortOrder", ["sortOrder"])
      .index("by_isActive", ["isActive"]),

    // Product catalogue — medicines, supplements, devices
    products: defineTable({
      name: v.string(),
      slug: v.string(),
      brandId: v.optional(v.id("brands")),
      composition: v.optional(v.string()),
      description: v.string(),
      price: v.number(),
      discountPrice: v.optional(v.number()),
      categoryId: v.id("categories"),
      imageUrl: v.optional(v.string()),
      manufacturer: v.string(),
      dosage: v.optional(v.string()),
      packSize: v.string(),
      strength: v.optional(v.string()),
      form: v.optional(v.string()), // tablet, capsule, syrup, injection, cream, etc.
      sku: v.optional(v.string()),
      prescriptionRequired: v.boolean(),
      storageInformation: v.optional(v.string()),
      stockQuantity: v.number(),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_slug", ["slug"])
      .index("by_category", ["categoryId"])
      .index("by_brand", ["brandId"])
      .index("by_isActive", ["isActive"])
      .index("by_price", ["price"])
      .index("by_sku", ["sku"])
      .index("by_createdAt", ["createdAt"]),

    // ── Inventory adjustment logs ──
    inventory_logs: defineTable({
      productId: v.id("products"),
      previousQuantity: v.number(),
      newQuantity: v.number(),
      adjustment: v.number(), // positive = restock, negative = reduction
      reason: v.string(),
      adminId: v.id("users"),
      createdAt: v.number(),
    })
      .index("by_product", ["productId"])
      .index("by_admin", ["adminId"])
      .index("by_createdAt", ["createdAt"]),

    // Per-user shopping cart
    cart_items: defineTable({
      userId: v.id("users"),
      productId: v.id("products"),
      quantity: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_product", ["userId", "productId"]),

    // Customer orders with line items
    orders: defineTable({
      userId: v.id("users"),
      items: v.array(
        v.object({
          productId: v.id("products"),
          name: v.string(),
          price: v.number(),
          quantity: v.number(),
        })
      ),
      subtotal: v.number(),
      discount: v.number(),
      deliveryFee: v.number(),
      tax: v.number(),
      totalAmount: v.number(),
      shippingAddress: v.string(),
      addressId: v.optional(v.id("addresses")),
      phone: v.string(),
      status: orderStatusValidator,
      paymentMethod: paymentMethodValidator,
      paymentStatus: v.optional(v.union(
        v.literal("pending"),
        v.literal("paid"),
        v.literal("failed"),
        v.literal("refunded"),
      )),
      razorpayOrderId: v.optional(v.string()),
      razorpayPaymentId: v.optional(v.string()),
      razorpaySignature: v.optional(v.string()),
      invoiceNumber: v.optional(v.string()),
      prescriptionId: v.optional(v.id("prescriptions")),
      notes: v.optional(v.string()),
      couponCode: v.optional(v.string()),
      couponDiscount: v.optional(v.number()),
      deliveryLatitude: v.optional(v.number()),
      deliveryLongitude: v.optional(v.number()),
      // Audit trail of status changes
      statusHistory: v.optional(
        v.array(
          v.object({
            status: v.string(),
            timestamp: v.number(),
            note: v.optional(v.string()),
          })
        )
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_status", ["status"])
      .index("by_user_created", ["userId", "createdAt"]),

    // Delivery addresses saved to a user's account
    addresses: defineTable({
      userId: v.id("users"),
      fullName: v.string(),
      phone: v.string(),
      houseFlat: v.string(),
      building: v.optional(v.string()),
      street: v.string(),
      area: v.optional(v.string()),
      city: v.string(),
      state: v.string(),
      pincode: v.string(),
      landmark: v.optional(v.string()),
      addressType: v.union(
        v.literal("home"),
        v.literal("work"),
        v.literal("other"),
      ),
      latitude: v.optional(v.number()),
      longitude: v.optional(v.number()),
      isDefault: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_default", ["userId", "isDefault"]),

    // Wishlist — saved products a user intends to buy later
    wishlist_items: defineTable({
      userId: v.id("users"),
      productId: v.id("products"),
    })
      .index("by_user", ["userId"])
      .index("by_user_product", ["userId", "productId"]),

    // Product reviews and ratings
    reviews: defineTable({
      userId: v.id("users"),
      productId: v.id("products"),
      rating: v.number(),
      title: v.string(),
      body: v.string(),
      createdAt: v.number(),
    })
      .index("by_product", ["productId"])
      .index("by_user_product", ["userId", "productId"]),

    // Discount coupons
    coupons: defineTable({
      code: v.string(),
      // Discount type: percentage or fixed amount
      discountType: v.union(v.literal("percentage"), v.literal("fixed")),
      // For percentage coupons: percentage off (e.g. 10 = 10% off)
      discountPercent: v.number(),
      // For fixed coupons: fixed amount off in ₹
      fixedDiscount: v.number(),
      // Max discount cap (only applies to percentage coupons)
      maxDiscount: v.number(),
      minOrder: v.number(),
      usageLimit: v.number(),
      usedCount: v.number(),
      isActive: v.boolean(),
      expiresAt: v.number(),
      createdAt: v.number(),
    })
      .index("by_code", ["code"])
      .index("by_isActive", ["isActive"]),

    // In-app notifications + WhatsApp message log
    notifications: defineTable({
      userId: v.id("users"),
      type: v.union(
        v.literal("order_status"),
        v.literal("refill_reminder"),
        v.literal("promo"),
        v.literal("system"),
      ),
      title: v.string(),
      body: v.string(),
      read: v.boolean(),
      // WhatsApp delivery tracking
      whatsappStatus: v.optional(v.union(
        v.literal("pending"),
        v.literal("sent"),
        v.literal("delivered"),
        v.literal("failed"),
      )),
      // Link to related entity
      link: v.optional(v.string()),
      metadata: v.optional(v.string()), // JSON string for extra data
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_read", ["userId", "read"])
      .index("by_user_created", ["userId", "createdAt"]),

    // Medicine refill reminders
    refill_reminders: defineTable({
      userId: v.id("users"),
      productId: v.id("products"),
      intervalDays: v.number(),       // days between reminders
      lastReminderAt: v.number(),     // timestamp of last reminder
      nextReminderAt: v.number(),     // timestamp when next reminder fires
      isActive: v.boolean(),
      notes: v.optional(v.string()),   // e.g. "Take after breakfast"
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_active", ["userId", "isActive"])
      .index("by_next_reminder", ["nextReminderAt"]),

    // Customer prescriptions — uploaded documents for Rx medicines
    prescriptions: defineTable({
      userId: v.id("users"),
      patientName: v.string(),
      doctorName: v.string(),
      prescriptionDate: v.number(),   // timestamp
      notes: v.optional(v.string()),
      // File storage — Convex file storage ID (private)
      fileId: v.string(),             // Convex storage file ID
      fileName: v.string(),
      fileType: v.string(),           // image/jpeg, image/png, application/pdf
      fileSize: v.number(),           // bytes
      // Review workflow
      status: prescriptionStatusValidator,
      reviewedBy: v.optional(v.id("users")),
      reviewedAt: v.optional(v.number()),
      adminNotes: v.optional(v.string()),
      rejectionReason: v.optional(v.string()),
      clarificationNote: v.optional(v.string()),
      // Audit trail — JSON array of status changes
      auditLog: v.optional(v.string()), // JSON stringified array
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_status", ["status"])
      .index("by_user_status", ["userId", "status"])
      .index("by_createdAt", ["createdAt"]),

    // ── Store / Delivery configuration (singleton) ──
    delivery_config: defineTable({
      storeName: v.string(),
      storeAddress: v.string(),
      storePhone: v.string(),
      storeWhatsApp: v.optional(v.string()),
      businessHours: v.string(),
      // Default delivery settings
      defaultDeliveryFee: v.number(),
      freeDeliveryThreshold: v.number(),
      minimumOrder: v.number(),
      estimatedDeliveryTime: v.string(),
      defaultCodAvailable: v.boolean(),
      // Per-pincode overrides
      pincodes: v.array(
        v.object({
          pincode: v.string(),
          area: v.string(),
          isActive: v.boolean(),
          deliveryFee: v.optional(v.number()),
          minimumOrder: v.optional(v.number()),
          estimatedDeliveryTime: v.optional(v.string()),
          codAvailable: v.optional(v.boolean()),
        })
      ),
      updatedAt: v.number(),
    }),
    // ── WhatsApp Enquiries & Orders Tracking ──
    whatsapp_enquiries: defineTable({
      userId: v.optional(v.id("users")),
      type: v.union(v.literal("enquiry"), v.literal("order"), v.literal("cart"), v.literal("product")),
      customerName: v.optional(v.string()),
      customerPhone: v.optional(v.string()),
      message: v.string(),
      summary: v.string(),
      // For product-specific enquiries
      productId: v.optional(v.id("products")),
      productName: v.optional(v.string()),
      // For cart/order enquiries
      itemCount: v.optional(v.number()),
      totalAmount: v.optional(v.number()),
      // For availability tracking
      requestedQuantity: v.optional(v.number()),
      available: v.optional(v.boolean()),
      // Prescription handling
      prescriptionRequired: v.optional(v.boolean()),
      // Admin tracking
      viewed: v.boolean(),
      viewedAt: v.optional(v.number()),
      adminNotes: v.optional(v.string()),
      // WhatsApp Business API delivery tracking
      whatsappMessageId: v.optional(v.string()),
      deliveryStatus: v.optional(v.union(
        v.literal("pending"),
        v.literal("sent"),
        v.literal("delivered"),
        v.literal("read"),
        v.literal("failed"),
      )),
      deliveryError: v.optional(v.string()),
      retryCount: v.optional(v.number()),
      lastRetryAt: v.optional(v.number()),
      // Order confirmation tracking
      confirmedByAdmin: v.optional(v.boolean()),
      confirmedAt: v.optional(v.number()),
      createdAt: v.number(),
    })
      .index("by_type", ["type"])
      .index("by_createdAt", ["createdAt"])
      .index("by_viewed", ["viewed"])
      .index("by_deliveryStatus", ["deliveryStatus"]),

    // ── WhatsApp Conversational Flow ──
    // Tracks per-phone conversation state for the automated order flow
    whatsapp_conversations: defineTable({
      phone: v.string(),
      // Conversation state machine
      state: v.union(
        v.literal("new"),              // Initial state, no active conversation
        v.literal("medicine_requested"), // Customer requested a medicine
        v.literal("availability_sent"),  // Availability message sent, waiting for response
        v.literal("awaiting_response"),  // Waiting for yes/no response
        v.literal("confirmed"),          // Customer confirmed, order created
        v.literal("declined"),           // Customer declined
        v.literal("expired"),            // Conversation timed out
        v.literal("unavailable"),        // Medicine was out of stock
      ),
      // Medicine context for current conversation
      productName: v.optional(v.string()),
      productId: v.optional(v.id("products")),
      requestedQuantity: v.optional(v.number()),
      available: v.optional(v.boolean()),
      price: v.optional(v.number()),
      prescriptionRequired: v.optional(v.boolean()),
      // Customer info
      customerName: v.optional(v.string()),
      userId: v.optional(v.id("users")),
      // Related enquiry ID
      enquiryId: v.optional(v.id("whatsapp_enquiries")),
      // Related order ID (set after confirmation)
      orderId: v.optional(v.id("orders")),
      // Message history count
      messageCount: v.number(),
      // Timestamps
      lastMessageAt: v.number(),
      createdAt: v.number(),
    })
      .index("by_phone", ["phone"])
      .index("by_phone_state", ["phone", "state"])
      .index("by_state", ["state"])
      .index("by_lastMessage", ["lastMessageAt"]),

    // ── Stock Availability Notifications ──
    // Tracks customers waiting for out-of-stock items
    availability_notifications: defineTable({
      userId: v.optional(v.id("users")),
      productId: v.id("products"),
      productName: v.string(),
      customerPhone: v.optional(v.string()),
      customerName: v.optional(v.string()),
      // Status
      status: v.union(
        v.literal("waiting"),
        v.literal("notified"),
        v.literal("expired"),
      ),
      notifiedAt: v.optional(v.number()),
      notificationMethod: v.optional(v.union(
        v.literal("whatsapp"),
        v.literal("sms"),
        v.literal("email"),
      )),
      createdAt: v.number(),
    })
      .index("by_product", ["productId"])
      .index("by_status", ["status"])
      .index("by_product_status", ["productId", "status"]),
  },
  {
    schemaValidation: false,
  }
);

export default schema;
