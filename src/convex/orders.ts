import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ── List orders for current user (newest first) ──
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    return await ctx.db
      .query("orders")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

// ── Get a single order by ID (owner only) ──
export const getById = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) return null;
    if (userId === null || order.userId !== userId) return null;

    // Fetch product details for each line item
    const itemsWithProducts = await Promise.all(
      order.items.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        return { ...item, product };
      })
    );

    return { ...order, items: itemsWithProducts };
  },
});

// ── Create an order from the current user's cart ──
export const create = mutation({
  args: {
    shippingAddress: v.string(),
    phone: v.string(),
    paymentMethod: v.union(v.literal("cod"), v.literal("online")),
    notes: v.optional(v.string()),
    razorpayOrderId: v.optional(v.string()),
    razorpayPaymentId: v.optional(v.string()),
    razorpaySignature: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    // Get all cart items
    const cartItems = await ctx.db
      .query("cart_items")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (cartItems.length === 0) throw new Error("Cart is empty");

    // Build order items and compute total
    const orderItems: { productId: any; name: string; price: number; quantity: number }[] = [];
    let totalAmount = 0;

    for (const ci of cartItems) {
      const product = await ctx.db.get(ci.productId);
      if (!product || !product.isActive) {
        throw new Error(`Product "${ci.productId}" is no longer available`);
      }
      if (product.stockQuantity < ci.quantity) {
        throw new Error(`Insufficient stock for "${product.name}"`);
      }

      const effectivePrice =
        product.discountPrice && product.discountPrice < product.price
          ? product.discountPrice
          : product.price;

      orderItems.push({
        productId: ci.productId,
        name: product.name,
        price: effectivePrice,
        quantity: ci.quantity,
      });

      totalAmount += effectivePrice * ci.quantity;

      // Decrement stock
      await ctx.db.patch(product._id, {
        stockQuantity: product.stockQuantity - ci.quantity,
      });
    }

    // Generate invoice number
    const allOrders = await ctx.db.query("orders").collect();
    const orderCount = allOrders.length;
    const invoiceNumber = `KC-${String(orderCount + 1).padStart(5, "0")}`;

    // Create order
    const now = Date.now();
    const orderId = await ctx.db.insert("orders", {
      userId,
      items: orderItems,
      totalAmount,
      shippingAddress: args.shippingAddress,
      phone: args.phone,
      status: "pending",
      paymentMethod: args.paymentMethod,
      paymentStatus: args.paymentMethod === "cod" ? "pending" : "paid",
      razorpayOrderId: args.razorpayOrderId,
      razorpayPaymentId: args.razorpayPaymentId,
      razorpaySignature: args.razorpaySignature,
      invoiceNumber,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });

    // Clear cart
    for (const ci of cartItems) {
      await ctx.db.delete(ci._id);
    }

    return { success: true, orderId, invoiceNumber, totalAmount };
  },
});

// ── Confirm payment for an online order ──
export const confirmPayment = mutation({
  args: {
    orderId: v.id("orders"),
    razorpayPaymentId: v.string(),
    razorpaySignature: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const order = await ctx.db.get(args.orderId);
    if (!order || order.userId !== userId) throw new Error("Order not found");

    if (order.paymentStatus === "paid") {
      return { success: true, alreadyPaid: true };
    }

    await ctx.db.patch(args.orderId, {
      paymentStatus: "paid",
      razorpayPaymentId: args.razorpayPaymentId,
      razorpaySignature: args.razorpaySignature,
      status: "confirmed",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ── Cancel an order (only pending/confirmed) ──
export const cancel = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const order = await ctx.db.get(args.orderId);
    if (!order || order.userId !== userId) throw new Error("Order not found");
    if (order.status !== "pending" && order.status !== "confirmed") {
      throw new Error("Order cannot be cancelled at this stage");
    }

    // Restore stock
    for (const item of order.items) {
      const product = await ctx.db.get(item.productId);
      if (product) {
        await ctx.db.patch(product._id, {
          stockQuantity: product.stockQuantity + item.quantity,
        });
      }
    }

    await ctx.db.patch(args.orderId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ── Get order tracking steps ──
export const getTracking = query({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) return null;
    if (userId === null || order.userId !== userId) return null;

    const steps = [
      { status: "pending", label: "Order Placed", description: "Your order has been received and is awaiting confirmation." },
      { status: "confirmed", label: "Order Confirmed", description: "Your order has been confirmed by our pharmacy team." },
      { status: "processing", label: "Being Prepared", description: "Your medicines are being packed and verified by our pharmacist." },
      { status: "shipped", label: "Shipped", description: "Your order is on its way to your delivery address." },
      { status: "delivered", label: "Delivered", description: "Your order has been delivered successfully." },
    ];

    const statusOrder = ["pending", "confirmed", "processing", "shipped", "delivered"];
    const currentIdx = order.status === "cancelled"
      ? -1
      : statusOrder.indexOf(order.status);

    return steps.map((step, i) => ({
      ...step,
      completed: currentIdx >= i,
      current: currentIdx === i,
      cancelled: order.status === "cancelled",
    }));
  },
});
