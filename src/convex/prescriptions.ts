import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ──────────────────────────────────────────────
// Customer functions
// ──────────────────────────────────────────────

/** List prescriptions for current user */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    return await ctx.db
      .query("prescriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

/** Get a single prescription (owner or admin only) */
export const get = query({
  args: { prescriptionId: v.id("prescriptions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const rx = await ctx.db.get(args.prescriptionId);
    if (!rx) return null;

    // Allow owner or admin
    const user = await ctx.db.get(userId);
    if (rx.userId !== userId && user?.role !== "admin") return null;

    return rx;
  },
});

/** Get a Convex download URL for a prescription file (owner or admin only) */
export const getFileUrl = query({
  args: { prescriptionId: v.id("prescriptions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;

    const rx = await ctx.db.get(args.prescriptionId);
    if (!rx) return null;

    const user = await ctx.db.get(userId);
    if (rx.userId !== userId && user?.role !== "admin") return null;

    const url = await ctx.storage.getUrl(rx.fileId);
    return url;
  },
});

/** Check if user has at least one APPROVED prescription */
export const hasApprovedPrescription = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return false;

    const approved = await ctx.db
      .query("prescriptions")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "approved")
      )
      .first();

    return approved !== null;
  },
});

/** Generate a Convex upload URL for prescription file */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

/** Upload a new prescription — customer submits after file upload */
export const upload = mutation({
  args: {
    patientName: v.string(),
    doctorName: v.string(),
    prescriptionDate: v.number(),
    notes: v.optional(v.string()),
    fileId: v.string(),       // Convex upload file ID (from client upload)
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(args.fileType)) {
      throw new Error("Invalid file type. Allowed: JPG, PNG, PDF");
    }

    // Validate file size (max 10MB)
    if (args.fileSize > 10 * 1024 * 1024) {
      throw new Error("File size must be less than 10MB");
    }

    // Validate fields
    if (args.patientName.trim().length < 2) {
      throw new Error("Patient name must be at least 2 characters");
    }
    if (args.doctorName.trim().length < 2) {
      throw new Error("Doctor name must be at least 2 characters");
    }

    const now = Date.now();
    const auditEntry = JSON.stringify([{
      status: "pending",
      timestamp: now,
      by: userId,
      note: "Prescription uploaded",
    }]);

    const prescriptionId = await ctx.db.insert("prescriptions", {
      userId,
      patientName: args.patientName.trim(),
      doctorName: args.doctorName.trim(),
      prescriptionDate: args.prescriptionDate,
      notes: args.notes?.trim(),
      fileId: args.fileId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      status: "pending",
      auditLog: auditEntry,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, prescriptionId };
  },
});

// ──────────────────────────────────────────────
// Admin functions
// ──────────────────────────────────────────────

/** List all prescriptions (admin) — filterable by status */
export const adminList = query({
  args: {
    status: v.optional(v.union(
      v.literal("pending"),
      v.literal("under_review"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("needs_clarification"),
    )),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") return [];

    let q = ctx.db
      .query("prescriptions")
      .withIndex("by_createdAt")
      .order("desc");

    if (args.status) {
      q = ctx.db
        .query("prescriptions")
        .withIndex("by_status", (iq) => iq.eq("status", args.status!))
        .order("desc");
    }

    const prescriptions = await q.collect();

    // Enrich with user names
    return Promise.all(
      prescriptions.map(async (rx) => {
        const user = await ctx.db.get(rx.userId);
        return {
          ...rx,
          userName: user?.name ?? "Unknown",
          userEmail: user?.email ?? "",
        };
      })
    );
  },
});

/** Get pending count for admin badge */
export const pendingCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return 0;

    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") return 0;

    const pending = await ctx.db
      .query("prescriptions")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    return pending.length;
  },
});

/** Admin: set status to under_review */
export const startReview = mutation({
  args: { prescriptionId: v.id("prescriptions") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Not authorized");

    const rx = await ctx.db.get(args.prescriptionId);
    if (!rx) throw new Error("Prescription not found");

    const now = Date.now();
    const audit = JSON.parse(rx.auditLog || "[]");
    audit.push({ status: "under_review", timestamp: now, by: userId, note: "Review started" });

    await ctx.db.patch(args.prescriptionId, {
      status: "under_review",
      reviewedBy: userId,
      reviewedAt: now,
      auditLog: JSON.stringify(audit),
      updatedAt: now,
    });

    return { success: true };
  },
});

/** Admin: approve prescription */
export const approve = mutation({
  args: {
    prescriptionId: v.id("prescriptions"),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Not authorized");

    const rx = await ctx.db.get(args.prescriptionId);
    if (!rx) throw new Error("Prescription not found");

    const now = Date.now();
    const audit = JSON.parse(rx.auditLog || "[]");
    audit.push({ status: "approved", timestamp: now, by: userId, note: args.adminNotes || "Approved" });

    await ctx.db.patch(args.prescriptionId, {
      status: "approved",
      reviewedBy: userId,
      reviewedAt: now,
      adminNotes: args.adminNotes?.trim() || undefined,
      auditLog: JSON.stringify(audit),
      updatedAt: now,
    });

    return { success: true };
  },
});

/** Admin: reject prescription */
export const reject = mutation({
  args: {
    prescriptionId: v.id("prescriptions"),
    rejectionReason: v.string(),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Not authorized");

    if (!args.rejectionReason.trim()) {
      throw new Error("Rejection reason is required");
    }

    const rx = await ctx.db.get(args.prescriptionId);
    if (!rx) throw new Error("Prescription not found");

    const now = Date.now();
    const audit = JSON.parse(rx.auditLog || "[]");
    audit.push({ status: "rejected", timestamp: now, by: userId, note: args.rejectionReason });

    await ctx.db.patch(args.prescriptionId, {
      status: "rejected",
      reviewedBy: userId,
      reviewedAt: now,
      rejectionReason: args.rejectionReason.trim(),
      adminNotes: args.adminNotes?.trim() || undefined,
      auditLog: JSON.stringify(audit),
      updatedAt: now,
    });

    return { success: true };
  },
});

/** Admin: request clarification */
export const requestClarification = mutation({
  args: {
    prescriptionId: v.id("prescriptions"),
    clarificationNote: v.string(),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (user?.role !== "admin") throw new Error("Not authorized");

    if (!args.clarificationNote.trim()) {
      throw new Error("Clarification note is required");
    }

    const rx = await ctx.db.get(args.prescriptionId);
    if (!rx) throw new Error("Prescription not found");

    const now = Date.now();
    const audit = JSON.parse(rx.auditLog || "[]");
    audit.push({ status: "needs_clarification", timestamp: now, by: userId, note: args.clarificationNote });

    await ctx.db.patch(args.prescriptionId, {
      status: "needs_clarification",
      reviewedBy: userId,
      reviewedAt: now,
      clarificationNote: args.clarificationNote.trim(),
      adminNotes: args.adminNotes?.trim() || undefined,
      auditLog: JSON.stringify(audit),
      updatedAt: now,
    });

    return { success: true };
  },
});
