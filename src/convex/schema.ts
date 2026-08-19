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
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
} as const;

export const orderStatusValidator = v.union(
  v.literal(ORDER_STATUS.PENDING),
  v.literal(ORDER_STATUS.CONFIRMED),
  v.literal(ORDER_STATUS.PROCESSING),
  v.literal(ORDER_STATUS.SHIPPED),
  v.literal(ORDER_STATUS.DELIVERED),
  v.literal(ORDER_STATUS.CANCELLED),
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
      totalAmount: v.number(),
      shippingAddress: v.string(),
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
      notes: v.optional(v.string()),
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
      discountPercent: v.number(),
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
  },
  {
    schemaValidation: false,
  }
);

export default schema;
