import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

async function requireAdmin(ctx: { db: any; auth: any }) {
  const userId = await getAuthUserId(ctx as any);
  if (userId === null) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") throw new Error("Unauthorized: admin only");
  return userId;
}

/** Normalise an admin-entered phone number into a display + tel: value. */
function toPhoneContact(raw: string | undefined | null): {
  display: string;
  tel: string;
} | null {
  const display = (raw ?? "").trim();
  if (!display) return null;
  const digits = display.replace(/\D/g, "");
  // Anything shorter than an Indian subscriber number is treated as not
  // configured — never guessed or completed with a made-up prefix.
  if (digits.length < 10) return null;
  const tel = digits.length === 10 ? `+91${digits}` : `+${digits}`;
  return { display, tel };
}

/**
 * Get store settings.
 */
export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("storeSettings").first();
    if (existing) return existing;
    return null;
  },
});

/**
 * Public contact block for the storefront.
 *
 * Deliberately exposes only the pharmacist line and the store's public contact
 * details — no tax, delivery or internal configuration. When no number is
 * configured it returns `phone: null`, so the UI can say so instead of showing
 * a fabricated number.
 */
export const getPublicContact = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("storeSettings").first();
    if (!settings) return { phone: null, storeName: null, hours: null };

    const phone =
      toPhoneContact(settings.pharmacistPhone) ?? toPhoneContact(settings.storePhone);

    return {
      phone,
      storeName: settings.storeName ?? null,
      hours: settings.storeHours ?? null,
      usingStoreLine: !toPhoneContact(settings.pharmacistPhone) && Boolean(phone),
    };
  },
});

/**
 * Upsert store settings (admin only).
 */
export const updateSettings = mutation({
  args: {
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
    /** Dedicated pharmacist line; empty means "use the store phone". */
    pharmacistPhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    const existing = await ctx.db.query("storeSettings").first();
    const now = Date.now();

    if (args.pharmacistPhone !== undefined && args.pharmacistPhone.trim()) {
      if (!toPhoneContact(args.pharmacistPhone)) {
        throw new Error("Enter a valid pharmacist contact number (at least 10 digits).");
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
        updatedBy: adminId,
        updatedAt: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("storeSettings", {
        ...args,
        updatedBy: adminId,
        updatedAt: now,
      });
    }
  },
});

/**
 * Log an admin activity.
 */
export const logActivity = mutation({
  args: {
    action: v.string(),
    category: v.string(),
    item: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return;

    await ctx.db.insert("auditLogs", {
      action: args.action,
      category: args.category,
      item: args.item,
      details: args.details,
      adminId: identity.subject as any,
      adminName: identity.name ?? "Admin",
      timestamp: Date.now(),
    });
  },
});

/**
 * List audit logs, newest first.
 */
export const listAuditLogs = query({
  args: {
    category: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let q: any;
    if (args.category) {
      q = ctx.db
        .query("auditLogs")
        .withIndex("by_category", (cat: any) =>
          cat.eq("category", args.category!)
        );
    } else {
      q = ctx.db.query("auditLogs").withIndex("by_timestamp");
    }
    const logs = await q.order("desc").take(args.limit ?? 100);
    return logs;
  },
});
