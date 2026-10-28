import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { handleOrderStatusChange, reserveWalletForOrder } from "./referralWallet";
import { loadEngine } from "./discountEngine";
import { resolveProductDiscount } from "../lib/discount";
import {
  registerRedemption,
  resolveCoupon,
  type ResolvedCoupon,
} from "./couponRedemptions";

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
    /** Rupees to pay from the wallet. Server re-clamps; never trusted as-is. */
    walletAmount: v.optional(v.number()),
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
    // Per-line category + discounted amount, so category-restricted coupons
    // can be evaluated against exactly what the customer is buying.
    const couponLines: { categoryId: string | null; amount: number }[] = [];
    let subtotal = 0;
    let discount = 0;

    // One engine read for the whole order: every unit price below is settled
    // through the SAME resolver the storefront prices come from, so a rule
    // change between "add to cart" and "place order" is applied here too, and a
    // client-sent price is never trusted.
    const { engine, now: engineNow } = await loadEngine(ctx.db);

    for (const ci of cartItems) {
      const product = await ctx.db.get(ci.productId);
      if (!product || !product.isActive) {
        throw new Error(`Product "${ci.productId}" is no longer available`);
      }
      // Block expired medicines at the final checkout step: the stored expiry
      // date decides, never a label, so nothing expired can be purchased even
      // if it is still active with stock.
      if (product.expiryDate && product.expiryDate <= Date.now()) {
        throw new Error(
          `"${product.name}" has expired and cannot be sold. Please remove it from your cart.`
        );
      }
      if (product.stockQuantity < ci.quantity) {
        throw new Error(
          `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}`
        );
      }

      const originalPrice = product.price;
      const { percent: effectivePercent, effectivePrice } = resolveProductDiscount(
        {
          _id: product._id,
          price: product.price,
          discountPrice: product.discountPrice ?? null,
          categoryId: product.categoryId,
          isActive: product.isActive,
          discountSource: product.discountSource ?? null,
          createdAt: product.createdAt,
        },
        engine,
        engineNow,
      );
      void effectivePercent;

      orderItems.push({
        productId: ci.productId,
        name: product.name,
        price: effectivePrice,
        quantity: ci.quantity,
      });
      couponLines.push({
        categoryId: product.categoryId ?? null,
        amount: effectivePrice * ci.quantity,
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
    // ── Coupon: full server-side re-validation and recalculation ──
    // The client-supplied `couponDiscount` is NEVER trusted — only the code
    // is used, and the amount, the limits, the eligibility and the delivery
    // waiver are recomputed here from the live cart and order history.
    let couponDiscountAmount = 0;
    let couponDeliveryWaived = 0;
    let appliedCouponCode: string | undefined;
    let resolvedCoupon: ResolvedCoupon | null = null;
    if (args.couponCode && args.couponCode.trim()) {
      const resolved = await resolveCoupon(ctx, {
        userId,
        code: args.couponCode,
        subtotal,
        items: couponLines,
        deliveryFee,
      });
      if (!resolved.ok) {
        // Convex mutations are transactional: nothing (stock, order, wallet)
        // is written when the coupon the customer was shown no longer applies.
        throw new Error(resolved.reason);
      }
      resolvedCoupon = resolved;
      couponDiscountAmount = resolved.evaluation.discount;
      couponDeliveryWaived = resolved.evaluation.deliveryWaived;
      appliedCouponCode = resolved.coupon.code;
      if (couponDeliveryWaived > 0) deliveryFee = 0; // waive the eligible fee only
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

    // Reserve the coupon against this order (record + usage slot). Runs in
    // the same transaction as the order insert, so the two can't drift apart.
    if (resolvedCoupon) {
      await registerRedemption(ctx, {
        coupon: resolvedCoupon.coupon,
        userId,
        orderId,
        discountAmount: couponDiscountAmount,
        deliveryWaived: couponDeliveryWaived,
      });
    }

    // Apply wallet balance. The requested amount is re-clamped server-side
    // against the live balance, the configured cap and the payable amount.
    let walletAmountUsed = 0;
    if (args.walletAmount && args.walletAmount > 0) {
      const reservation = await reserveWalletForOrder(ctx, {
        userId,
        orderId,
        requestedAmount: args.walletAmount,
        payableAmount: totalAmount,
        settleImmediately: args.paymentMethod === "cod",
      });
      walletAmountUsed = reservation.amount;
      if (walletAmountUsed > 0) {
        await ctx.db.patch(orderId, { walletAmountUsed });
      }
    }

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

    return {
      success: true,
      orderId,
      invoiceNumber,
      totalAmount,
      walletAmountUsed,
      payableAmount: Math.max(0, totalAmount - walletAmountUsed),
    };
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
      const expired = !!product?.expiryDate && product.expiryDate <= Date.now();
      if (!product || !product.isActive || expired || product.stockQuantity < item.quantity) {
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

    // Restore any wallet amount tied to this order and reverse an earned reward.
    await handleOrderStatusChange(ctx, args.orderId, "cancelled");

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
    /** Rupees to pay from the wallet. Server re-clamps; never trusted as-is. */
    walletAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const product = await ctx.db.get(args.productId);
    if (!product || !product.isActive) throw new Error("Product is no longer available");
    // Buy Now bypasses the cart, so it needs the same expiry gate as checkout.
    if (product.expiryDate && product.expiryDate <= Date.now()) {
      throw new Error(`"${product.name}" has expired and cannot be sold.`);
    }
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
    // Settle through the discount engine — the same resolver every storefront
    // price uses, so Buy Now, cart and checkout always agree with each other.
    const { engine: buyNowEngine, now: buyNowNow } = await loadEngine(ctx.db);
    const buyNowResolution = resolveProductDiscount(
      {
        _id: product._id,
        price: product.price,
        discountPrice: product.discountPrice ?? null,
        categoryId: product.categoryId,
        isActive: product.isActive,
        discountSource: product.discountSource ?? null,
        createdAt: product.createdAt,
      },
      buyNowEngine,
      buyNowNow,
    );
    const effectivePrice = buyNowResolution.effectivePrice;

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

    // ── Coupon: same server-side validation as the cart checkout path ──
    // Only the code is trusted; the discount, limits and eligibility are
    // recomputed from the live product price and this customer's history.
    let couponDiscountAmount = 0;
    let couponDeliveryWaived = 0;
    let appliedCouponCode: string | undefined;
    let resolvedCoupon: ResolvedCoupon | null = null;
    if (args.couponCode && args.couponCode.trim()) {
      const resolved = await resolveCoupon(ctx, {
        userId,
        code: args.couponCode,
        subtotal,
        items: [{ categoryId: product.categoryId ?? null, amount: subtotal }],
        deliveryFee,
      });
      if (!resolved.ok) {
        // Transactional: stock and wallet writes above roll back with this.
        throw new Error(resolved.reason);
      }
      resolvedCoupon = resolved;
      couponDiscountAmount = resolved.evaluation.discount;
      couponDeliveryWaived = resolved.evaluation.deliveryWaived;
      appliedCouponCode = resolved.coupon.code;
      if (couponDeliveryWaived > 0) deliveryFee = 0; // waive the eligible fee only
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

    // Reserve the coupon against this order in the same transaction.
    if (resolvedCoupon) {
      await registerRedemption(ctx, {
        coupon: resolvedCoupon.coupon,
        userId,
        orderId,
        discountAmount: couponDiscountAmount,
        deliveryWaived: couponDeliveryWaived,
      });
    }

    // Apply wallet balance (server-clamped; never trust the browser value).
    let walletAmountUsed = 0;
    if (args.walletAmount && args.walletAmount > 0) {
      const reservation = await reserveWalletForOrder(ctx, {
        userId,
        orderId,
        requestedAmount: args.walletAmount,
        payableAmount: totalAmount,
        settleImmediately: args.paymentMethod === "cod",
      });
      walletAmountUsed = reservation.amount;
      if (walletAmountUsed > 0) {
        await ctx.db.patch(orderId, { walletAmountUsed });
      }
    }

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
    return {
      success: true,
      orderId,
      invoiceNumber,
      totalAmount,
      walletAmountUsed,
      payableAmount: Math.max(0, totalAmount - walletAmountUsed),
    };
  },
});
