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
      phoneVerificationTime: v.optional(v.number()),
      phoneVerified: v.optional(v.boolean()),
      emailVerified: v.optional(v.boolean()),
      whatsappOptIn: v.optional(v.boolean()),
      address: v.optional(v.string()),
      city: v.optional(v.string()),
      state: v.optional(v.string()),
      pincode: v.optional(v.string()),
    })
      .index("email", ["email"])
      .index("phone", ["phone"]),

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
      parentId: v.optional(v.id("categories")),
    })
      .index("by_slug", ["slug"])
      .index("by_sortOrder", ["sortOrder"])
      .index("by_isActive", ["isActive"])
      .index("by_parentId", ["parentId"]),

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
      additionalImages: v.optional(v.array(v.string())),
      manufacturer: v.string(),
      dosage: v.optional(v.string()),
      packSize: v.string(),
      packSizeVariants: v.optional(v.array(v.object({
        label: v.string(),
        price: v.number(),
        discountPrice: v.optional(v.number()),
        stockQuantity: v.number(),
        sku: v.optional(v.string()),
      }))),
      strength: v.optional(v.string()),
      form: v.optional(v.string()), // tablet, capsule, syrup, injection, cream, etc.
      sku: v.optional(v.string()),
      prescriptionRequired: v.boolean(),
      storageInformation: v.optional(v.string()),
      stockQuantity: v.number(),
      benefits: v.optional(v.string()),
      consumeType: v.optional(v.string()),
      safetyNote: v.optional(v.string()),
      expiryDate: v.optional(v.number()),
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
      // Audit trail of admin actions on this reminder
      adminActions: v.optional(v.array(v.object({
        action: v.string(),           // "paused", "resumed", "rescheduled", "cancelled"
        timestamp: v.number(),
        detail: v.optional(v.string()), // e.g. "Next reminder changed from 17 Sept to 20 Sept"
      }))),
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
        v.literal("new"),               // Initial state, no active conversation
        v.literal("medicine_requested"),  // Customer requested a medicine
        v.literal("availability_sent"),   // Availability message sent, waiting for response
        v.literal("awaiting_response"),   // Waiting for yes/no response
        v.literal("awaiting_address"),    // Waiting for delivery address
        v.literal("address_received"),    // Address received, waiting for quantity or confirmation
        v.literal("awaiting_quantity"),   // Waiting for quantity input
        v.literal("order_summary"),       // Order summary sent, waiting for final confirmation
        v.literal("add_more_medicines"),  // Customer can add more medicines
        v.literal("confirmed"),           // Customer confirmed, order created
        v.literal("declined"),            // Customer declined
        v.literal("expired"),             // Conversation timed out
        v.literal("unavailable"),         // Medicine was out of stock
      ),
      // Medicine context for current conversation
      productName: v.optional(v.string()),
      productId: v.optional(v.id("products")),
      requestedQuantity: v.optional(v.number()),
      available: v.optional(v.boolean()),
      price: v.optional(v.number()),
      prescriptionRequired: v.optional(v.boolean()),
      // Multiple medicines support (JSON stringified array)
      medicineList: v.optional(v.string()), // JSON: [{name, productId, qty, price, available, rxRequired}]
      // Delivery address
      deliveryAddress: v.optional(v.string()),
      deliveryAddressFull: v.optional(v.string()), // Full formatted address
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

    // ── Customer Testimonials / Store Reviews ──
    // General store-level reviews (not product-specific)
    testimonials: defineTable({
      userId: v.id("users"),
      displayName: v.string(),
      rating: v.number(),          // 1–5
      title: v.string(),
      message: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      ),
      featured: v.boolean(),
      adminNotes: v.optional(v.string()),
      reviewedBy: v.optional(v.id("users")),
      reviewedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_status", ["status"])
      .index("by_featured", ["featured"])
      .index("by_user", ["userId"])
      .index("by_createdAt", ["createdAt"]),

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
    // Activity / Audit Log
    auditLogs: defineTable({
    action: v.string(),
    category: v.string(),
    item: v.string(),
    details: v.optional(v.string()),
    adminId: v.id("users"),
    adminName: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_timestamp", ["timestamp"])
    .index("by_admin", ["adminId"])
    .index("by_category", ["category"]),
    // ── Doctor Appointments System ──
    doctors: defineTable({
      name: v.string(),
      specialty: v.string(),
      qualification: v.optional(v.string()),
      experience: v.optional(v.string()),
      consultationFee: v.number(),
      profilePhoto: v.optional(v.string()),
      clinicName: v.optional(v.string()),
      clinicAddress: v.optional(v.string()),
      city: v.optional(v.string()),
      state: v.optional(v.string()),
      pincode: v.optional(v.string()),
      aboutDoctor: v.optional(v.string()),
      languagesSpoken: v.optional(v.array(v.string())),
      consultationType: v.optional(v.array(v.string())),
      availableDays: v.optional(v.array(v.string())),
      availableTimeFrom: v.optional(v.string()),
      availableTimeTo: v.optional(v.string()),
      appointmentDuration: v.optional(v.number()),
      maxPatientsPerSlot: v.optional(v.number()),
      contactPhone: v.optional(v.string()),
      contactEmail: v.optional(v.string()),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_specialty", ["specialty"])
      .index("by_isActive", ["isActive"])
      .index("by_specialty_active", ["specialty", "isActive"])
      .index("by_createdAt", ["createdAt"]),

    doctor_appointments: defineTable({
      doctorId: v.id("doctors"),
      doctorName: v.string(),
      specialty: v.string(),
      clinicName: v.optional(v.string()),
      consultationFee: v.number(),
      userId: v.id("users"),
      customerName: v.string(),
      customerEmail: v.optional(v.string()),
      customerPhone: v.string(),
      appointmentDate: v.string(),
      appointmentTime: v.string(),
      consultationType: v.optional(v.string()),
      bookingDate: v.number(),
      status: v.union(
        v.literal("pending"),
        v.literal("confirmed"),
        v.literal("completed"),
        v.literal("cancelled"),
      ),
      paymentStatus: v.optional(v.union(
        v.literal("pending"),
        v.literal("paid"),
        v.literal("failed"),
        v.literal("refunded"),
      )),
      notes: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_doctor", ["doctorId"])
      .index("by_user", ["userId"])
      .index("by_status", ["status"])
      .index("by_doctor_date", ["doctorId", "appointmentDate"])
      .index("by_createdAt", ["createdAt"]),

    // ── Lab Tests ──
    lab_tests: defineTable({
      categorySlug: v.string(),
      categoryName: v.string(),
      name: v.string(),
      type: v.union(v.literal("single"), v.literal("package")),
      description: v.string(),
      detailedDescription: v.optional(v.string()),
      includedTestIds: v.array(v.string()),
      includedTestCount: v.number(),
      originalPrice: v.number(),
      discountedPrice: v.number(),
      discountPercentage: v.number(),
      reportTime: v.optional(v.string()),
      sampleType: v.optional(v.string()),
      fastingRequired: v.optional(v.boolean()),
      homeCollectionAvailable: v.optional(v.boolean()),
      serviceArea: v.optional(v.string()),
      promotionalBadges: v.array(v.string()),
      promotionalText: v.optional(v.string()),
      bestPriceEver: v.optional(v.boolean()),
      reportGuaranteeHours: v.optional(v.number()),
      active: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_category", ["categorySlug"])
      .index("by_active", ["active"])
      .index("by_type", ["type"])
      .index("by_createdAt", ["createdAt"]),

    // ── Lab Test Bookings ──
    lab_bookings: defineTable({
      userId: v.id("users"),
      customerName: v.string(),
      customerPhone: v.string(),
      customerEmail: v.string(),
      testId: v.id("lab_tests"),
      testName: v.string(),
      testType: v.union(v.literal("single"), v.literal("package")),
      categorySlug: v.string(),
      categoryName: v.string(),
      includedTests: v.array(v.string()),
      originalPrice: v.number(),
      discountedPrice: v.number(),
      finalAmount: v.number(),
      collectionDate: v.string(),
      timeSlot: v.string(),
      collectionType: v.string(),
      address: v.string(),
      pincode: v.string(),
      sampleType: v.optional(v.string()),
      fastingRequired: v.optional(v.boolean()),
      bookingStatus: v.union(
        v.literal("pending"),
        v.literal("confirmed"),
        v.literal("sample_collection_scheduled"),
        v.literal("sample_collected"),
        v.literal("report_ready"),
        v.literal("completed"),
        v.literal("cancelled"),
      ),
      paymentStatus: v.union(
        v.literal("pending"),
        v.literal("paid"),
        v.literal("failed"),
        v.literal("refunded"),
      ),
      notes: v.optional(v.string()),
      // Payment tracking
      razorpayOrderId: v.optional(v.string()),
      razorpayPaymentId: v.optional(v.string()),
      // Report management
      reportStatus: v.optional(v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("ready"),
      )),
      reportFileId: v.optional(v.string()),
      reportFileName: v.optional(v.string()),
      reportUploadedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_test", ["testId"])
      .index("by_status", ["bookingStatus"])
      .index("by_createdAt", ["createdAt"]),

    // ── Regular Medicines (for Medicine Refill feature) ──
    regular_medicines: defineTable({
      userId: v.id("users"),
      productId: v.id("products"),
      // Customer-provided quantity preference
      suggestedQuantity: v.number(),
      // Optional notes from customer
      notes: v.optional(v.string()),
      // Source: 'manual' = customer saved, 'auto' = derived from order history
      source: v.union(v.literal("manual"), v.literal("auto")),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_product", ["userId", "productId"]),

    // ── Refill Requests (customer-initiated refill to cart) ──
    refill_requests: defineTable({
      userId: v.id("users"),
      // Medicines in this refill request
      medicines: v.array(
        v.object({
          productId: v.id("products"),
          productName: v.string(),
          quantity: v.number(),
          unitPrice: v.number(),
          prescriptionRequired: v.boolean(),
          available: v.boolean(),
        })
      ),
      totalAmount: v.number(),
      // Status: scheduled, due_soon, pending_verification, confirmed, processed, completed
      status: v.union(
        v.literal("scheduled"),
        v.literal("due_soon"),
        v.literal("pending_verification"),
        v.literal("confirmed"),
        v.literal("processed"),
        v.literal("completed"),
      ),
      // Optional linked reminder
      reminderId: v.optional(v.id("refill_reminders")),
      // Admin notes
      adminNotes: v.optional(v.string()),
      // If linked to an order after checkout
      orderId: v.optional(v.id("orders")),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_status", ["status"])
      .index("by_user_status", ["userId", "status"])
      .index("by_createdAt", ["createdAt"]),

    // Store settings
    storeSettings: defineTable({
    storeName: v.string(),
    storeEmail: v.string(),
    storePhone: v.string(),
    storeAddress: v.string(),
    storeHours: v.string(),
    currency: v.string(),
    taxRate: v.number(),
    minOrderAmount: v.number(),
    deliveryFee: v.number(),
    freeDeliveryAbove: v.number(),
    whatsappNumber: v.string(),
    updatedBy: v.optional(v.id("users")),
    updatedAt: v.number(),
  }),

    // ── AI Chatbot Conversations ──
    chatbot_conversations: defineTable({
      userId: v.id("users"),
      title: v.optional(v.string()),
      lastMessageAt: v.number(),
      messageCount: v.number(),
      // Sentiment / handoff tracking
      sentiment: v.optional(v.union(
        v.literal("positive"),
        v.literal("neutral"),
        v.literal("frustrated"),
      )),
      handoffRequested: v.boolean(),
      handoffReason: v.optional(v.string()),
      language: v.optional(v.string()), // "en", "hi", "mr", "hinglish"
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_lastMessage", ["lastMessageAt"])
      .index("by_handoff", ["handoffRequested"]),

    // ── AI Chatbot Messages ──
    chatbot_messages: defineTable({
      conversationId: v.id("chatbot_conversations"),
      userId: v.id("users"),
      role: v.union(
        v.literal("user"),
        v.literal("assistant"),
        v.literal("system"),
      ),
      content: v.string(),
      // Intent classification
      intent: v.optional(v.string()), // "product_search", "order_tracking", "refill", "navigation", "medical_question", "complaint", "general"
      // Product context if relevant
      productIds: v.optional(v.array(v.id("products"))),
      // Order context if relevant
      orderIds: v.optional(v.array(v.id("orders"))),
      // Attached files (images/PDFs) — stored via Convex file storage
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
      // Language preference snapshot for this message
      language: v.optional(v.string()),
      // Result data of tool calls the assistant made for this reply (for rich UI cards)
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
      // Response metadata
      responseTimeMs: v.optional(v.number()),
      handoffTriggered: v.optional(v.boolean()),
      createdAt: v.number(),
    })
      .index("by_conversation", ["conversationId"])
      .index("by_user", ["userId"])  
      .index("by_createdAt", ["createdAt"]),

    // ── Support Tickets (customer requests routed to the pharmacy team) ──
    support_tickets: defineTable({
      userId: v.id("users"),
      conversationId: v.optional(v.id("chatbot_conversations")),
      subject: v.string(),
      description: v.string(),
      category: v.union(
        v.literal("complaint"),
        v.literal("refund"),
        v.literal("order_issue"),
        v.literal("medical_consultation"),
        v.literal("other"),
      ),
      status: v.union(
        v.literal("open"),
        v.literal("in_progress"),
        v.literal("resolved"),
        v.literal("closed"),
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_status", ["status"])
      .index("by_createdAt", ["createdAt"]),

    // ── Promotional Campaigns ──
    campaigns: defineTable({
      title: v.string(),
      subtitle: v.optional(v.string()),
      bannerImage: v.optional(v.string()),
      desktopBannerImage: v.optional(v.string()),
      mobileBannerImage: v.optional(v.string()),
      imageSource: v.union(
        v.literal("upload"),
        v.literal("url"),
        v.literal("generated"),
        v.literal("none")
      ),
      ctaText: v.optional(v.string()),
      ctaDestination: v.optional(v.string()),
      targetType: v.union(
        v.literal("category"),
        v.literal("product"),
        v.literal("page"),
        v.literal("external"),
        v.literal("none"),
      ),
      targetId: v.optional(v.string()),
      startDate: v.number(),
      endDate: v.number(),
      isActive: v.boolean(),
      priority: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
      // Public image URL for the primary banner (set from upload, URL, or generation)
      publicUrl: v.optional(v.string()),
    })
      .index("by_active_dates", ["isActive", "startDate", "endDate"])
      .index("by_priority", ["priority"]),
    // ── Admin Chatbot Analytics ──
    chatbot_analytics: defineTable({
      date: v.string(), // "YYYY-MM-DD"
      totalConversations: v.number(),
      totalMessages: v.number(),
      handoffCount: v.number(),
      topIntents: v.array(v.object({
        intent: v.string(),
        count: v.number(),
      })),
      avgResponseTimeMs: v.number(),
      humanHandoffPercentage: v.number(),
      mostSearchedProducts: v.array(v.object({
        productName: v.string(),
        searchCount: v.number(),
      })),
      unavailableSearches: v.array(v.object({
        productName: v.string(),
        searchCount: v.number(),
      })),
    })
      .index("by_date", ["date"]),
  },
  {
    schemaValidation: false,
  }
);

export default schema;
