import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/* ── ADMIN: List all lab tests ── */
export const adminList = query({
  args: {
    categorySlug: v.optional(v.string()),
    type: v.optional(v.union(v.literal("single"), v.literal("package"))),
    active: v.optional(v.boolean()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("lab_tests").withIndex("by_createdAt");
    const tests = await q.collect();
    let filtered = tests;
    if (args.categorySlug) {
      filtered = filtered.filter((t) => t.categorySlug === args.categorySlug);
    }
    if (args.type) {
      filtered = filtered.filter((t) => t.type === args.type);
    }
    if (args.active !== undefined) {
      filtered = filtered.filter((t) => t.active === args.active);
    }
    if (args.search) {
      const s = args.search.toLowerCase();
      filtered = filtered.filter((t) => t.name.toLowerCase().includes(s));
    }
    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/* ── CUSTOMER: List active tests by category ── */
export const listByCategory = query({
  args: { categorySlug: v.string() },
  handler: async (ctx, args) => {
    const tests = await ctx.db
      .query("lab_tests")
      .withIndex("by_category", (q) => q.eq("categorySlug", args.categorySlug))
      .collect();
    return tests
      .filter((t) => t.active)
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/* ── Get single test ── */
export const get = query({
  args: { id: v.id("lab_tests") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/* ── ADMIN: Create lab test ── */
export const create = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("lab_tests", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/* ── ADMIN: Update lab test ── */
export const update = mutation({
  args: {
    id: v.id("lab_tests"),
    categorySlug: v.optional(v.string()),
    categoryName: v.optional(v.string()),
    name: v.optional(v.string()),
    type: v.optional(v.union(v.literal("single"), v.literal("package"))),
    description: v.optional(v.string()),
    detailedDescription: v.optional(v.string()),
    includedTestIds: v.optional(v.array(v.string())),
    includedTestCount: v.optional(v.number()),
    originalPrice: v.optional(v.number()),
    discountedPrice: v.optional(v.number()),
    discountPercentage: v.optional(v.number()),
    reportTime: v.optional(v.string()),
    sampleType: v.optional(v.string()),
    fastingRequired: v.optional(v.boolean()),
    homeCollectionAvailable: v.optional(v.boolean()),
    serviceArea: v.optional(v.string()),
    promotionalBadges: v.optional(v.array(v.string())),
    promotionalText: v.optional(v.string()),
    bestPriceEver: v.optional(v.boolean()),
    reportGuaranteeHours: v.optional(v.number()),
    active: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    const cleaned: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) cleaned[k] = v;
    }
    await ctx.db.patch(id, cleaned);
  },
});

/* ── ADMIN: Delete lab test ── */
export const remove = mutation({
  args: { id: v.id("lab_tests") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/* ── ADMIN: Toggle active status ── */
export const toggleActive = mutation({
  args: { id: v.id("lab_tests") },
  handler: async (ctx, args) => {
    const test = await ctx.db.get(args.id);
    if (!test) throw new Error("Test not found");
    await ctx.db.patch(args.id, { active: !test.active, updatedAt: Date.now() });
  },
});

/* ═══════════════════════════════════════════════════
   BOOKINGS
   ═══════════════════════════════════════════════════ */

/* ── ADMIN: List all bookings ── */
export const bookingsList = query({
  args: {
    status: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const bookings = await ctx.db
      .query("lab_bookings")
      .withIndex("by_createdAt")
      .collect();
    let filtered = bookings;
    if (args.status && args.status !== "all") {
      filtered = filtered.filter((b) => b.bookingStatus === args.status);
    }
    if (args.search) {
      const s = args.search.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.customerName.toLowerCase().includes(s) ||
          b.testName.toLowerCase().includes(s) ||
          b.customerPhone.includes(s) ||
          b.customerEmail.toLowerCase().includes(s)
      );
    }
    return filtered.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/* ── Get single booking ── */
export const getBooking = query({
  args: { id: v.id("lab_bookings") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/* ── CUSTOMER: Create booking ── */
export const createBooking = mutation({
  args: {
    testId: v.id("lab_tests"),
    collectionDate: v.string(),
    timeSlot: v.string(),
    collectionType: v.string(),
    address: v.string(),
    pincode: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const test = await ctx.db.get(args.testId);
    if (!test || !test.active) throw new Error("Test not found or inactive");

    const now = Date.now();
    return await ctx.db.insert("lab_bookings", {
      userId: user._id,
      customerName: user.name || user.email || "Customer",
      customerPhone: user.phone || "",
      customerEmail: user.email || "",
      testId: args.testId,
      testName: test.name,
      testType: test.type,
      categorySlug: test.categorySlug,
      categoryName: test.categoryName,
      includedTests: test.includedTestIds,
      originalPrice: test.originalPrice,
      discountedPrice: test.discountedPrice,
      finalAmount: test.discountedPrice,
      collectionDate: args.collectionDate,
      timeSlot: args.timeSlot,
      collectionType: args.collectionType,
      address: args.address,
      pincode: args.pincode,
      sampleType: test.sampleType,
      fastingRequired: test.fastingRequired,
      bookingStatus: "pending",
      paymentStatus: "pending",
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/* ── CUSTOMER: My bookings ── */
export const myBookings = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("lab_bookings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/* ── ADMIN: Update booking status ── */
export const updateBookingStatus = mutation({
  args: {
    id: v.id("lab_bookings"),
    bookingStatus: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("sample_collection_scheduled"),
      v.literal("sample_collected"),
      v.literal("report_ready"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      bookingStatus: args.bookingStatus,
      updatedAt: Date.now(),
    });
  },
});

/* ── ADMIN: Update payment status ── */
export const updatePaymentStatus = mutation({
  args: {
    id: v.id("lab_bookings"),
    paymentStatus: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("failed"),
      v.literal("refunded"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      paymentStatus: args.paymentStatus,
      updatedAt: Date.now(),
    });
  },
});

/* ═══════════════════════════════════════════════════
   REPORT MANAGEMENT
   ═══════════════════════════════════════════════════ */

/* ── ADMIN: Generate upload URL for report file ── */
export const generateReportUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Not authorized");
    return await ctx.storage.generateUploadUrl();
  },
});

/* ── ADMIN: Upload report for a booking ── */
export const uploadReport = mutation({
  args: {
    bookingId: v.id("lab_bookings"),
    fileId: v.string(),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Not authorized");

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Booking not found");

    await ctx.db.patch(args.bookingId, {
      reportFileId: args.fileId,
      reportFileName: args.fileName,
      reportStatus: "ready",
      reportUploadedAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/* ── ADMIN: Update report status ── */
export const updateReportStatus = mutation({
  args: {
    bookingId: v.id("lab_bookings"),
    reportStatus: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("ready"),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Not authorized");

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Booking not found");

    const update: Record<string, unknown> = {
      reportStatus: args.reportStatus,
      updatedAt: Date.now(),
    };

    // If marking as pending/processing, clear report file
    if (args.reportStatus !== "ready") {
      update.reportFileId = undefined;
      update.reportFileName = undefined;
      update.reportUploadedAt = undefined;
    }

    await ctx.db.patch(args.bookingId, update);
  },
});

/* ── CUSTOMER: Get my lab bookings with report info ── */
export const myBookingsWithReports = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("lab_bookings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/* ── CUSTOMER: Get signed report URL ── */
export const getReportUrl = query({
  args: { bookingId: v.id("lab_bookings") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) return null;

    // Determine caller role
    const caller = await ctx.db.get(userId);
    const isAdmin = caller?.role === "admin";
    const isOwner = booking.userId === userId;

    // Only allow owner or admin
    if (!isOwner && !isAdmin) return null;

    // Backend payment gate: customers must have paid to access the report
    // Admin can always access (for QA / review purposes)
    if (!isAdmin) {
      if (booking.paymentStatus !== "paid") return null;
      if (booking.reportStatus !== "ready") return null;
    }

    if (!booking.reportFileId) return null;

    const url = await ctx.storage.getUrl(booking.reportFileId);
    return url;
  },
});

/* ── CUSTOMER: Pay for a lab test booking ── */
export const payLabTestBooking = mutation({
  args: {
    bookingId: v.id("lab_bookings"),
    razorpayOrderId: v.optional(v.string()),
    razorpayPaymentId: v.optional(v.string()),
    razorpaySignature: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const booking = await ctx.db.get(args.bookingId);
    if (!booking) throw new Error("Booking not found");
    if (booking.userId !== userId) throw new Error("Not authorized");
    if (booking.paymentStatus === "paid") return { alreadyPaid: true };

    // Verify the payment with Razorpay if keys are provided
    // For now, we trust the frontend Razorpay callback and mark as paid.
    // In production, verify the signature server-side using crypto.
    if (args.razorpayPaymentId && args.razorpaySignature) {
      // TODO: Verify Razorpay signature using RAZORPAY_KEY_SECRET
      // const crypto = require("crypto");
      // const expectedSignature = crypto
      //   .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      //   .update(`${args.razorpayOrderId}|${args.razorpayPaymentId}`)
      //   .digest("hex");
      // if (expectedSignature !== args.razorpaySignature) {
      //   throw new Error("Payment verification failed");
      // }
    }

    await ctx.db.patch(args.bookingId, {
      paymentStatus: "paid",
      razorpayOrderId: args.razorpayOrderId,
      razorpayPaymentId: args.razorpayPaymentId,
      updatedAt: Date.now(),
    });

    return { success: true, paymentStatus: "paid" };
  },
});
