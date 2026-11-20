import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  DEFAULT_EDUCATIONAL_CONTENT,
  DEFAULT_MEASUREMENT_TYPES,
} from "./healthTracker";

async function requireAdmin(ctx: { db: any; auth: any }) {
  const userId = await getAuthUserId(ctx as any);
  if (userId === null) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") throw new Error("Unauthorized: admin only");
  return userId;
}

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const settings = await ctx.db.query("health_tracker_settings").first();
    return {
      familyHealthEnabled: settings?.familyHealthEnabled ?? true,
      enabled: settings?.enabled ?? true,
      measurementTypes: settings?.measurementTypes ?? DEFAULT_MEASUREMENT_TYPES,
      educationalContent:
        settings?.educationalContent ?? DEFAULT_EDUCATIONAL_CONTENT,
      updatedAt: settings?.updatedAt ?? null,
    };
  },
});

export const updateSettings = mutation({
  args: {
    familyHealthEnabled: v.boolean(),
    enabled: v.boolean(),
    measurementTypes: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        unit: v.string(),
        secondaryLabel: v.optional(v.string()),
        secondaryUnit: v.optional(v.string()),
        min: v.number(),
        max: v.number(),
      }),
    ),
    educationalContent: v.string(),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);

    if (args.measurementTypes.length === 0) {
      throw new Error("Keep at least one measurement type.");
    }
    if (args.measurementTypes.length > 12) {
      throw new Error("Keep at most 12 measurement types.");
    }
    const seen = new Set<string>();
    for (const type of args.measurementTypes) {
      const key = type.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
      if (!key || key.length > 40) throw new Error("Each measurement needs a valid key.");
      if (seen.has(key)) throw new Error(`Duplicate measurement key: ${key}`);
      seen.add(key);
      if (type.label.trim().length < 2 || type.label.trim().length > 40) {
        throw new Error("Each measurement needs a label of 2–40 characters.");
      }
      if (type.unit.trim().length < 1 || type.unit.trim().length > 20) {
        throw new Error("Each measurement needs a unit.");
      }
      if (!Number.isFinite(type.min) || !Number.isFinite(type.max) || type.min >= type.max) {
        throw new Error(`The range for ${type.label} is invalid.`);
      }
      if (
        type.secondaryLabel !== undefined &&
        type.secondaryLabel.trim().length > 40
      ) {
        throw new Error("The second-value label is too long.");
      }
    }

    const content = args.educationalContent.trim();
    if (content.length < 20 || content.length > 4000) {
      throw new Error("Educational content must be between 20 and 4000 characters.");
    }

    const normalized = args.measurementTypes.map((type) => ({
      key: type.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
      label: type.label.trim(),
      unit: type.unit.trim(),
      secondaryLabel: type.secondaryLabel?.trim() || undefined,
      secondaryUnit: type.secondaryUnit?.trim() || undefined,
      min: type.min,
      max: type.max,
    }));

    const existing = await ctx.db.query("health_tracker_settings").first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        familyHealthEnabled: args.familyHealthEnabled,
        enabled: args.enabled,
        measurementTypes: normalized,
        educationalContent: content,
        updatedBy: adminId,
        updatedAt: Date.now(),
      });
      return { success: true };
    }
    await ctx.db.insert("health_tracker_settings", {
      familyHealthEnabled: args.familyHealthEnabled,
      enabled: args.enabled,
      measurementTypes: normalized,
      educationalContent: content,
      updatedBy: adminId,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * Aggregate feature usage only. This deliberately never returns readings,
 * notes, member names, report files or any other private health content.
 */
export const getUsageStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const members = await ctx.db.query("family_members").collect();
    const readings = await ctx.db.query("health_readings").collect();
    const reports = await ctx.db.query("health_reports").collect();

    const byType = new Map<string, number>();
    const activeUsers = new Set<string>();
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let recentReadings = 0;
    for (const reading of readings) {
      byType.set(reading.typeKey, (byType.get(reading.typeKey) ?? 0) + 1);
      activeUsers.add(reading.ownerId as string);
      if (reading.createdAt >= thirtyDaysAgo) recentReadings += 1;
    }

    return {
      totalMembers: members.length,
      totalReadings: readings.length,
      totalReports: reports.length,
      activeCustomers: activeUsers.size,
      readingsLast30Days: recentReadings,
      byType: [...byType.entries()]
        .map(([typeKey, count]) => ({ typeKey, count }))
        .sort((a, b) => b.count - a.count),
    };
  },
});
