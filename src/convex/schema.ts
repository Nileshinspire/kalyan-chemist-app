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

    // Users table (extended from auth)
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

    // Categories for medicines
    categories: defineTable({
      name: v.string(),
      slug: v.string(),
      description: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      isActive: v.boolean(),
      sortOrder: v.number(),
    })
      .index("by_slug", ["slug"])
      .index("by_sortOrder", ["sortOrder"]),

    // Products (medicines)
    products: defineTable({
      name: v.string(),
      slug: v.string(),
      description: v.string(),
      price: v.number(),
      discountPrice: v.optional(v.number()),
      categoryId: v.id("categories"),
      imageUrl: v.string(),
      manufacturer: v.string(),
      dosage: v.string(),
      packSize: v.string(),
      requiresPrescription: v.boolean(),
      stockQuantity: v.number(),
      isActive: v.boolean(),
    })
      .index("by_slug", ["slug"])
      .index("by_category", ["categoryId"])
      .index("by_isActive", ["isActive"])
      .index("by_price", ["price"]),

    // Shopping cart items
    cart_items: defineTable({
      userId: v.id("users"),
      productId: v.id("products"),
      quantity: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_product", ["userId", "productId"]),

    // Orders
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
      notes: v.optional(v.string()),
    })
      .index("by_user", ["userId"])
      .index("by_status", ["status"]),

    // Saved addresses
    addresses: defineTable({
      userId: v.id("users"),
      name: v.string(),
      phone: v.string(),
      addressLine1: v.string(),
      addressLine2: v.optional(v.string()),
      city: v.string(),
      state: v.string(),
      pincode: v.string(),
      isDefault: v.boolean(),
    })
      .index("by_user", ["userId"])
      .index("by_user_default", ["userId", "isDefault"]),
  },
  {
    schemaValidation: false,
  }
);

export default schema;
