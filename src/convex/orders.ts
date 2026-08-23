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
    couponCode: v.optional(v.string()),
    couponDiscount: v.optional(v.number()),
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

    // Validate pincode serviceability
    const pincode = args.shippingAddress.match(/\b(\d{6})\b/)?.[1];
    if (pincode) {
      const configs = await ctx.db.query("delivery_config").collect();
      const dc = configs[0];
      if (dc) {
        const match = dc.pincodes.find((p) => p.pincode === pincode && p.isActive);
        if (!match) {
          throw new Error("Sorry, Kalyan Chemist does not currently deliver to this location.");
        }
      }
    }

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

    // Delivery fee — check delivery config for pincode-specific rules
    const configs = await ctx.db.query("delivery_config").collect();
    const dc = configs[0];
    let deliveryFee = 49; // default
    if (dc) {
      const pinMatch = pincode ? dc.pincodes.find((p) => p.pincode === pincode && p.isActive) : undefined;
      const fee = pinMatch?.deliveryFee ?? dc.defaultDeliveryFee;
      const threshold = dc.freeDeliveryThreshold;
      deliveryFee = subtotal >= threshold ? 0 : fee;
    } else if (subtotal >= 500) {
      deliveryFee = 0;
    }
    // Validate and apply coupon discount (server-side, never trust frontend)
    let couponDiscountAmount = 0;
    let appliedCouponCode: string | undefined;
    if (args.couponCode && args.couponDiscount && args.couponDiscount > 0) {
      const coupon = await ctx.db
        .query("coupons")
        .withIndex("by_code", (q) => q.eq("code", args.couponCode!.toUpperCase()))
        .first();
      if (coupon && coupon.isActive && coupon.expiresAt >= Date.now() &&
          (coupon.usageLimit <= 0 || coupon.usedCount < coupon.usageLimit) &&
          subtotal >= coupon.minOrder) {
        if (coupon.discountType === "percentage") {
          const computed = Math.min(
            Math.round((subtotal * coupon.discountPercent) / 100),
            coupon.maxDiscount
          );
          // Accept frontend value only if it matches server computation (±1 for rounding)
          couponDiscountAmount = Math.abs(args.couponDiscount - computed) <= 1 ? computed : computed;
        } else {
          couponDiscountAmount = Math.min(coupon.fixedDiscount, subtotal);
        }
        appliedCouponCode = coupon.code;
        // Increment usage count
        await ctx.db.patch(coupon._id, { usedCount: coupon.usedCount + 1 });
      }
    }

    // GST 12% on medicines (after coupon discount)
    const taxableAmount = subtotal - couponDiscountAmount;
    const tax = Math.round(taxableAmount * 0.12);
    const totalAmount = taxableAmount + deliveryFee + tax;

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

    // Create order with initial status history
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
      couponCode: appliedCouponCode,
      couponDiscount: couponDiscountAmount > 0 ? couponDiscountAmount : undefined,
      statusHistory: [{ status: "pending", timestamp: now, note: "Order placed" }],
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

    // Map statusHistory entries by status for timestamp lookup
    const historyMap = new Map<string, number>();
    if (order.statusHistory) {
      for (const entry of order.statusHistory) {
        historyMap.set(entry.status, entry.timestamp);
      }
    }

    // Look up delivery config for estimated time
    const pincode = order.shippingAddress.match(/\b(\d{6})\b/)?.[1];
    let estimatedDeliveryTime: string | undefined;
    let storePhone: string | undefined;
    let storeName: string | undefined;
    let storeAddress: string | undefined;
    let storeBusinessHours: string | undefined;
    const configs = await ctx.db.query("delivery_config").collect();
    const dc = configs[0];
    if (dc) {
      storeName = dc.storeName;
      storeAddress = dc.storeAddress;
      storePhone = dc.storePhone;
      storeBusinessHours = dc.businessHours;
      const pinMatch = pincode ? dc.pincodes.find((p) => p.pincode === pincode && p.isActive) : undefined;
      estimatedDeliveryTime = pinMatch?.estimatedDeliveryTime ?? dc.estimatedDeliveryTime;
    }

    // Calculate estimated delivery window based on order creation time + config
    let estimatedDeliveryWindow: { from: string; to: string } | undefined;
    if (estimatedDeliveryTime && order.status !== "delivered" && order.status !== "cancelled") {
      // Parse the estimated time string (e.g. "2-4 hours")
      const hourMatch = estimatedDeliveryTime.match(/(\d+)\s*-\s*(\d+)\s*hour/i);
      if (hourMatch) {
        const minHours = parseInt(hourMatch[1]);
        const maxHours = parseInt(hourMatch[2]);
        const fromTime = new Date(order.createdAt + minHours * 60 * 60 * 1000);
        const toTime = new Date(order.createdAt + maxHours * 60 * 60 * 1000);
        const fmt = (d: Date) => d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
        estimatedDeliveryWindow = { from: fmt(fromTime), to: fmt(toTime) };
      } else {
        // For non-hour formats like "next day", just show the string
        estimatedDeliveryWindow = { from: estimatedDeliveryTime, to: estimatedDeliveryTime };
      }
    }

    return {
      steps: steps.map((step, i) => ({
        ...step,
        completed: currentIdx >= i,
        current: currentIdx === i,
        cancelled: order.status === "cancelled",
        timestamp: historyMap.get(step.status),
      })),
      currentStep: currentIdx,
      totalSteps: steps.length,
      progressPercent: order.status === "cancelled" ? 0 : Math.round((currentIdx / (steps.length - 1)) * 100),
      estimatedDeliveryTime,
      estimatedDeliveryWindow,
      storeName,
      storeAddress,
      storePhone,
      storeBusinessHours,
      orderPlacedAt: order.createdAt,
    };
  },
});

// ── Create a direct order (Buy Now) — bypasses cart entirely ──
export const createDirectOrder = mutation({
  args: {
    productId: v.id("products"),
    quantity: v.number(),
    shippingAddress: v.string(),
    phone: v.string(),
    paymentMethod: v.union(v.literal("cod"), v.literal("online")),
    addressId: v.optional(v.id("addresses")),
    notes: v.optional(v.string()),
    prescriptionId: v.optional(v.id("prescriptions")),
    couponCode: v.optional(v.string()),
    couponDiscount: v.optional(v.number()),
    deliveryLatitude: v.optional(v.number()),
    deliveryLongitude: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const product = await ctx.db.get(args.productId);
    if (!product || !product.isActive) throw new Error("Product is no longer available");
    if (product.stockQuantity < args.quantity) {
      throw new Error(`Insufficient stock for "${product.name}". Available: ${product.stockQuantity}`);
    }

    // Validate pincode serviceability
    const pincode = args.shippingAddress.match(/\b(\d{6})\b/)?.[1];
    if (pincode) {
      const configs = await ctx.db.query("delivery_config").collect();
      const dc = configs[0];
      if (dc) {
        const match = dc.pincodes.find((p) => p.pincode === pincode && p.isActive);
        if (!match) {
          throw new Error("Sorry, Kalyan Chemist does not currently deliver to this location.");
        }
      }
    }

    // Prescription check
    if (product.prescriptionRequired && !args.prescriptionId) {
      const approved = await ctx.db
        .query("prescriptions")
        .withIndex("by_user_status", (q) =>
          q.eq("userId", userId).eq("status", "approved")
        ).first();
      if (!approved) {
        throw new Error("Prescription required for Rx medicines. Please upload an approved prescription.");
      }
    }

    const originalPrice = product.price;
    const effectivePrice = product.discountPrice && product.discountPrice < product.price ? product.discountPrice : product.price;

    const orderItems = [{
      productId: args.productId,
      name: product.name,
      price: effectivePrice,
      quantity: args.quantity,
    }];

    let subtotal = effectivePrice * args.quantity;
    let discount = (originalPrice - effectivePrice) * args.quantity;

    // Decrement stock
    await ctx.db.patch(product._id, { stockQuantity: product.stockQuantity - args.quantity });

    // Delivery fee
    const configs = await ctx.db.query("delivery_config").collect();
    const dc = configs[0];
    let deliveryFee = 49;
    if (dc) {
      const pinMatch = pincode ? dc.pincodes.find((p) => p.pincode === pincode && p.isActive) : undefined;
      const fee = pinMatch?.deliveryFee ?? dc.defaultDeliveryFee;
      deliveryFee = subtotal >= dc.freeDeliveryThreshold ? 0 : fee;
    } else if (subtotal >= 500) {
      deliveryFee = 0;
    }

    // Coupon validation
    let couponDiscountAmount = 0;
    let appliedCouponCode: string | undefined;
    if (args.couponCode && args.couponDiscount && args.couponDiscount > 0) {
      const coupon = await ctx.db
        .query("coupons")
        .withIndex("by_code", (q) => q.eq("code", args.couponCode!.toUpperCase()))
        .first();
      if (coupon && coupon.isActive && coupon.expiresAt >= Date.now() &&
          (coupon.usageLimit <= 0 || coupon.usedCount < coupon.usageLimit) &&
          subtotal >= coupon.minOrder) {
        if (coupon.discountType === "percentage") {
          const computed = Math.min(Math.round((subtotal * coupon.discountPercent) / 100), coupon.maxDiscount);
          couponDiscountAmount = Math.abs(args.couponDiscount - computed) <= 1 ? computed : computed;
        } else {
          couponDiscountAmount = Math.min(coupon.fixedDiscount, subtotal);
        }
        appliedCouponCode = coupon.code;
        await ctx.db.patch(coupon._id, { usedCount: coupon.usedCount + 1 });
      }
    }

    const taxableAmount = subtotal - couponDiscountAmount;
    const tax = Math.round(taxableAmount * 0.12);
    const totalAmount = taxableAmount + deliveryFee + tax;

    const allOrders = await ctx.db.query("orders").collect();
    const orderCount = allOrders.length;
    const invoiceNumber = `KC-${String(orderCount + 1).padStart(5, "0")}`;

    let paymentStatus: "pending" | "paid" | "failed" = "pending";
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
      invoiceNumber,
      prescriptionId: args.prescriptionId,
      notes: args.notes,
      couponCode: appliedCouponCode,
      couponDiscount: couponDiscountAmount > 0 ? couponDiscountAmount : undefined,
      statusHistory: [{ status: "pending", timestamp: now, note: "Order placed (Buy Now)" }],
      createdAt: now,
      updatedAt: now,
    });

    // Notification
    await ctx.db.insert("notifications", {
      userId,
      type: "order_status",
      title: "Order Placed Successfully ✓",
      body: `Your order ${invoiceNumber} has been placed. Total: ₹${totalAmount.toLocaleString("en-IN")}. You will receive updates as your order progresses.`,
      read: false,
      link: `/orders/${orderId}`,
      createdAt: now,
    });

    // Do NOT clear cart — this is a direct buy, cart stays untouched
    return { success: true, orderId, invoiceNumber, totalAmount };
  },
});
