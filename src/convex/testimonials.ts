import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Helper to check admin role
async function requireAdmin(ctx: any): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");
  const userId = identity.subject as any;
  const user = await ctx.db.get(userId);
  if ((user as any)?.role !== "admin") throw new Error("Admin access required");
}

// ══════════════════════════════════════════════════════
//  CUSTOMER — Submit a testimonial
// ══════════════════════════════════════════════════════

export const submit = mutation({
  args: {
    displayName: v.string(),
    rating: v.number(),
    title: v.string(),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = identity.subject as any;

    // Validate
    if (args.rating < 1 || args.rating > 5) {
      throw new Error("Rating must be between 1 and 5");
    }
    const title = args.title.trim();
    const message = args.message.trim();
    const displayName = args.displayName.trim();
    if (!title || !message || !displayName) {
      throw new Error("All fields are required");
    }
    if (title.length > 120) {
      throw new Error("Title must be 120 characters or less");
    }
    if (message.length > 2000) {
      throw new Error("Message must be 2000 characters or less");
    }
    if (displayName.length > 60) {
      throw new Error("Display name must be 60 characters or less");
    }

    // Prevent duplicate: check if user already has a pending or approved testimonial
    const existing = await ctx.db
      .query("testimonials")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .collect();
    const hasActive = existing.some(
      (t: any) => t.status === "pending" || t.status === "approved"
    );
    if (hasActive) {
      throw new Error(
        "You already have an active testimonial. You can submit a new one after your current review is resolved."
      );
    }

    const now = Date.now();
    const testimonialId = await ctx.db.insert("testimonials", {
      userId,
      displayName,
      rating: Math.round(args.rating),
      title,
      message,
      status: "pending",
      featured: false,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, testimonialId };
  },
});

// ══════════════════════════════════════════════════════
//  PUBLIC — Get featured/approved testimonials (for landing page)
// ══════════════════════════════════════════════════════

export const listFeatured = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 12;
    const all = await ctx.db
      .query("testimonials")
      .withIndex("by_status", (q: any) => q.eq("status", "approved"))
      .order("desc")
      .collect();

    // Get featured first, then most recent
    const featured = all.filter((t: any) => t.featured);
    const others = all.filter((t: any) => !t.featured);
    const combined = [...featured, ...others].slice(0, limit);

    return combined.map((t: any) => ({
      _id: t._id,
      displayName: t.displayName,
      rating: t.rating,
      title: t.title,
      message: t.message,
      featured: t.featured,
      createdAt: t.createdAt,
    }));
  },
});

// ══════════════════════════════════════════════════════
//  CUSTOMER — Get own testimonial
// ══════════════════════════════════════════════════════

export const getMyTestimonial = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const userId = identity.subject as any;
    const results = await ctx.db
      .query("testimonials")
      .withIndex("by_user", (q: any) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return results[0] ?? null;
  },
});

// ══════════════════════════════════════════════════════
//  ADMIN — List all testimonials
// ══════════════════════════════════════════════════════

export const adminList = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("approved"),
        v.literal("rejected"),
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    let results;
    if (args.status) {
      results = await ctx.db
        .query("testimonials")
        .withIndex("by_status", (q: any) => q.eq("status", args.status))
        .order("desc")
        .collect();
    } else {
      results = await ctx.db
        .query("testimonials")
        .withIndex("by_createdAt", (q: any) => q.gte("createdAt", 0))
        .order("desc")
        .collect();
    }

    // Resolve customer names from users table
    return Promise.all(
      results.map(async (t: any) => {
        let customerName = t.displayName;
        try {
          const user = await ctx.db.get(t.userId);
          if ((user as any)?.name) customerName = (user as any).name;
        } catch {}
        return {
          ...t,
          customerName,
        };
      })
    );
  },
});

// ══════════════════════════════════════════════════════
//  ADMIN — Approve
// ══════════════════════════════════════════════════════

export const adminApprove = mutation({
  args: {
    testimonialId: v.id("testimonials"),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject as any;
    const user = await ctx.db.get(userId);
    if ((user as any)?.role !== "admin") throw new Error("Admin access required");

    await ctx.db.patch(args.testimonialId, {
      status: "approved",
      reviewedBy: userId,
      reviewedAt: Date.now(),
      adminNotes: args.adminNotes?.trim() || undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ══════════════════════════════════════════════════════
//  ADMIN — Reject
// ══════════════════════════════════════════════════════

export const adminReject = mutation({
  args: {
    testimonialId: v.id("testimonials"),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject as any;
    const user = await ctx.db.get(userId);
    if ((user as any)?.role !== "admin") throw new Error("Admin access required");

    await ctx.db.patch(args.testimonialId, {
      status: "rejected",
      featured: false,
      reviewedBy: userId,
      reviewedAt: Date.now(),
      adminNotes: args.adminNotes?.trim() || undefined,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ══════════════════════════════════════════════════════
//  ADMIN — Toggle featured
// ══════════════════════════════════════════════════════

export const adminToggleFeatured = mutation({
  args: {
    testimonialId: v.id("testimonials"),
    featured: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const userId = identity.subject as any;
    const user = await ctx.db.get(userId);
    if ((user as any)?.role !== "admin") throw new Error("Admin access required");

    await ctx.db.patch(args.testimonialId, {
      featured: args.featured,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

// ══════════════════════════════════════════════════════
//  ADMIN — Delete
// ══════════════════════════════════════════════════════

export const adminDelete = mutation({
  args: {
    testimonialId: v.id("testimonials"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    await ctx.db.delete(args.testimonialId);
    return { success: true };
  },
});

// ══════════════════════════════════════════════════════
//  PUBLIC — Stats for landing page
// ══════════════════════════════════════════════════════

export const publicStats = query({
  args: {},
  handler: async (ctx) => {
    const approved = await ctx.db
      .query("testimonials")
      .withIndex("by_status", (q: any) => q.eq("status", "approved"))
      .collect();

    const total = approved.length;
    const avgRating =
      total > 0
        ? approved.reduce((sum: number, t: any) => sum + t.rating, 0) / total
        : 0;

    return {
      total,
      avgRating: Math.round(avgRating * 10) / 10,
    };
  },
});
