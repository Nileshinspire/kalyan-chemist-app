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

    const itemsWithProducts = await Promise.all(
      order.items.map(async (item) => {
        const product = await ctx.db.get(item.productId);
        return { ...item, product };
      })
    );

    const address = order.addressId ? await ctx.db.get(order.addressId) : null;

    return { ...order, items: itemsWithProducts, address };
  },
});

// ── Create an order from the current user's cart ──
// For online payments, order is created with paymentStatus: "pending"
// Payment is confirmed later via razorpay.verifyPayment
export const create = mutation({
  args: {
    shippingAddress: v.string(),
    phone: v.string(),
    paymentMethod: v.union(v.literal("cod"), v.literal("online")),
    addressId: v.optional(v.id("addresses")),
    notes: v.optional(v.string()),
    prescriptionId: v.optional(v.id("prescriptions")),
    razorpayOrderId: v.optional(v.string()),
    razorpayPaymentId: v.optional(v.string()),
    razorpaySignature: v.optional(v.string()),
    deliveryLatitude: v.optional(v.number()),
    deliveryLongitude: v.optional(v.number()),
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

    // Check prescription requirement
    let hasRxItems = false;
    for (const ci of cartItems) {
      const product = await ctx.db.get(ci.productId);
      if (product && product.prescriptionRequired) {
        hasRxItems = true;
        break;
      }
    }

    if (hasRxItems && !args.prescriptionId) {
      // Validate that user has an approved prescription
      const approved = await ctx.db
        .query("prescriptions")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", userId).eq("status", "approved")
        )
        .first();
      if (!approved) {
        throw new Error(
          "Prescription required for Rx medicines. Please upload an approved prescription."
        );
      }
    }

    // Build order items and compute totals
    const orderItems: { productId: any; name: string; price: number; quantity: number }[] = [];
    let subtotal = 0;
    let discount = 0;

    for (const ci of cartItems) {
      const product = await ctx.db.get(ci.productId);
      if (!product || !product.isActive) {
        throw new Error(`Product "${ci.productId}" is no longer available`);
      }
      if (product.stockQuantity < ci.quantity) {
        throw new Error(
          `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}`
        );
      }

      const originalPrice = product.price;
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

      subtotal += effectivePrice * ci.quantity;
      discount += (originalPrice - effectivePrice) * ci.quantity;

      // Decrement stock (atomic-style reservation)
      await ctx.db.patch(product._id, {
        stockQuantity: product.stockQuantity - ci.quantity,
      });
    }

    // Delivery fee (free above ₹500)
    const deliveryFee = subtotal >= 500 ? 0 : 49;
    // GST 12% on medicines
    const tax = Math.round(subtotal * 0.12);
    const totalAmount = subtotal + deliveryFee + tax;

    // Generate invoice number
    const allOrders = await ctx.db.query("orders").collect();
    const orderCount = allOrders.length;
    const invoiceNumber = `KC-${String(orderCount + 1).padStart(5, "0")}`;

    // Determine payment status based on method
    // COD: pending until delivered
    // Online: pending until payment is verified via razorpay.verifyPayment
    // If Razorpay details are provided at creation time, verify them
    let paymentStatus: "pending" | "paid" | "failed" = "pending";
    if (args.paymentMethod === "cod") {
      paymentStatus = "pending";
    }

    // Create order
    const now = Date.now();
    const orderId = await ctx.db.insert("orders", {
      userId,
      items: orderItems,
      subtotal,
      discount,
      deliveryFee,
      tax,
      totalAmount,
      shippingAddress: args.shippingAddress,
      addressId: args.addressId,
      phone: args.phone,
      deliveryLatitude: args.deliveryLatitude,
      deliveryLongitude: args.deliveryLongitude,
      status: "pending",
      paymentMethod: args.paymentMethod,
      paymentStatus,
      razorpayOrderId: args.razorpayOrderId,
      razorpayPaymentId: args.razorpayPaymentId,
      razorpaySignature: args.razorpaySignature,
      invoiceNumber,
      prescriptionId: args.prescriptionId,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });

    // Create order notification
    await ctx.db.insert("notifications", {
      userId,
      type: "order_status",
      title: "Order Placed Successfully ✓",
      body: `Your order ${invoiceNumber} has been placed. Total: ₹${totalAmount.toLocaleString("en-IN")}. You will receive updates as your order progresses.`,
      read: false,
      link: `/orders/${orderId}`,
      createdAt: now,
    });

    // Clear cart
    for (const ci of cartItems) {
      await ctx.db.delete(ci._id);
    }

    return { success: true, orderId, invoiceNumber, totalAmount };
  },
});

// ── Reorder: add eligible products from a previous order to cart ──
export const reorder = mutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const order = await ctx.db.get(args.orderId);
    if (!order || order.userId !== userId) throw new Error("Order not found");

    let added = 0;
    let skipped = 0;

    for (const item of order.items) {
      const product = await ctx.db.get(item.productId);
      if (!product || !product.isActive || product.stockQuantity < item.quantity) {
        skipped++;
        continue;
      }

      // Check if already in cart
      const existing = await ctx.db
        .query("cart_items")
        .withIndex("by_user_product", (q) =>
          q.eq("userId", userId).eq("productId", item.productId)
        )
        .first();

      if (existing) {
        const newQty = existing.quantity + item.quantity;
        if (newQty <= product.stockQuantity) {
          await ctx.db.patch(existing._id, { quantity: newQty });
          added++;
        } else {
          skipped++;
        }
      } else {
        await ctx.db.insert("cart_items", {
          userId,
          productId: item.productId,
          quantity: item.quantity,
        });
        added++;
      }
    }

    if (added === 0 && skipped > 0) {
      throw new Error("No products from this order are currently available");
    }

    return { success: true, added, skipped };
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

    await ctx.db.insert("notifications", {
      userId,
      type: "order_status",
      title: "Order Cancelled",
      body: `Your order ${order.invoiceNumber || ""} has been cancelled.${order.paymentMethod === "online" && order.paymentStatus === "paid" ? " A refund will be processed within 5-7 business days." : ""}`,
      read: false,
      link: `/orders/${args.orderId}`,
      createdAt: Date.now(),
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
      { status: "ready_for_dispatch", label: "Ready for Dispatch", description: "Your order has been packed and is ready for dispatch." },
      { status: "out_for_delivery", label: "Out for Delivery", description: "Your order is on its way to your delivery address." },
      { status: "delivered", label: "Delivered", description: "Your order has been delivered successfully." },
    ];

    const statusOrder = ["pending", "confirmed", "processing", "ready_for_dispatch", "out_for_delivery", "delivered"];
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
