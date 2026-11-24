import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  DEFAULT_EDUCATIONAL_CONTENT,
  DEFAULT_MEASUREMENT_TYPES,
  type MeasurementType,
} from "./healthTracker";

async function requireAdmin(ctx: { db: any; auth: any }) {
  const userId = await getAuthUserId(ctx as any);
  if (userId === null) throw new Error("Not authenticated");
  const user = await ctx.db.get(userId);
  if (!user || user.role !== "admin") throw new Error("Unauthorized: admin only");
  return userId;
}

function normalizeMeasurementType(type: MeasurementType): MeasurementType {
  return {
    key: type.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
    label: type.label.trim(),
    unit: type.unit.trim(),
    secondaryLabel: type.secondaryLabel?.trim() || undefined,
    secondaryUnit: type.secondaryUnit?.trim() || undefined,
    min: type.min,
    max: type.max,
    isActive: type.isActive !== false,
  };
}

function validateMeasurementTypes(types: MeasurementType[]) {
  if (types.length === 0) throw new Error("Keep at least one measurement type.");
  if (types.length > 20) throw new Error("Keep at most 20 measurement types.");

  const seen = new Set<string>();
  const seenLabels = new Set<string>();
  for (const raw of types) {
    const type = normalizeMeasurementType(raw);
    if (!type.key || type.key.length > 40) {
      throw new Error("Each measurement needs a valid key.");
    }
    if (seen.has(type.key)) throw new Error(`Duplicate measurement key: ${type.key}`);
    seen.add(type.key);
    if (type.label.length < 2 || type.label.length > 40) {
      throw new Error("Each measurement needs a label of 2–40 characters.");
    }
    const normalizedLabel = type.label.toLowerCase();
    if (seenLabels.has(normalizedLabel)) {
      throw new Error(`Duplicate measurement name: ${type.label}`);
    }
    seenLabels.add(normalizedLabel);
    if (type.unit.length < 1 || type.unit.length > 20) {
      throw new Error(`Enter a unit of up to 20 characters for ${type.label}.`);
    }
    if (
      !Number.isFinite(type.min) ||
      !Number.isFinite(type.max) ||
      type.min >= type.max
    ) {
      throw new Error(`The range for ${type.label} is invalid.`);
    }
    if (
      (type.secondaryLabel && !type.secondaryUnit) ||
      (!type.secondaryLabel && type.secondaryUnit)
    ) {
      throw new Error("A second value needs both a label and a unit.");
    }
    if (type.secondaryLabel && type.secondaryLabel.length > 40) {
      throw new Error("The second-value label is too long.");
    }
  }
  return types.map(normalizeMeasurementType);
}

export const getSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const settings = await ctx.db.query("health_tracker_settings").first();
    return {
      familyHealthEnabled: settings?.familyHealthEnabled ?? true,
      enabled: settings?.enabled ?? true,
      measurementTypes: (settings?.measurementTypes ??
        DEFAULT_MEASUREMENT_TYPES) as MeasurementType[],
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
        isActive: v.optional(v.boolean()),
      }),
    ),
    educationalContent: v.string(),
  },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const submitted = validateMeasurementTypes(
      args.measurementTypes as MeasurementType[],
    );

    const content = args.educationalContent.trim();
    if (content.length < 20 || content.length > 4000) {
      throw new Error("Educational content must be between 20 and 4000 characters.");
    }

    const existing = await ctx.db.query("health_tracker_settings").first();
    const existingTypes = (existing?.measurementTypes ??
      DEFAULT_MEASUREMENT_TYPES) as MeasurementType[];

    // Never lose a label/unit that historical readings depend on. If an admin
    // removes a configured type through an older flow, preserve it as archived.
    const submittedKeys = new Set(submitted.map((type) => type.key));
    const removed = existingTypes.filter(
      (type) => !submittedKeys.has(normalizeMeasurementType(type).key),
    );
    let normalized = submitted;
    if (removed.length > 0) {
      const readings = await ctx.db.query("health_readings").collect();
      const archived = removed
        .filter((type) =>
          readings.some(
            (reading) => reading.typeKey === normalizeMeasurementType(type).key,
          ),
        )
        .map((type) => ({
          ...normalizeMeasurementType(type),
          isActive: false,
        }));
      normalized = [...submitted, ...archived];
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        familyHealthEnabled: args.familyHealthEnabled,
        enabled: args.enabled,
        measurementTypes: normalized,
        educationalContent: content,
        updatedBy: adminId,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("health_tracker_settings", {
        familyHealthEnabled: args.familyHealthEnabled,
        enabled: args.enabled,
        measurementTypes: normalized,
        educationalContent: content,
        updatedBy: adminId,
        updatedAt: Date.now(),
      });
    }
    return { success: true, measurementTypes: normalized };
  },
});

/**
 * Safe delete control: removes an unused type, but archives any type that has
 * historical readings. The reading rows are never touched.
 */
export const deleteMeasurementType = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const adminId = await requireAdmin(ctx);
    const key = args.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const settings = await ctx.db.query("health_tracker_settings").first();
    const types = ((settings?.measurementTypes ??
      DEFAULT_MEASUREMENT_TYPES) as MeasurementType[]).map(
      normalizeMeasurementType,
    );
    const index = types.findIndex((type) => type.key === key);
    if (index < 0) throw new Error("Measurement type not found.");

    const readings = await ctx.db.query("health_readings").collect();
    const readingCount = readings.filter((row) => row.typeKey === key).length;

    let nextTypes: MeasurementType[];
    let archived = false;
    if (readingCount > 0) {
      archived = true;
      nextTypes = types.map((type, i) =>
        i === index ? { ...type, isActive: false } : type,
      );
    } else {
      nextTypes = types.filter((_, i) => i !== index);
      if (nextTypes.length === 0) {
        throw new Error("Keep at least one measurement type.");
      }
    }

    if (settings) {
      await ctx.db.patch(settings._id, {
        measurementTypes: nextTypes,
        updatedBy: adminId,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("health_tracker_settings", {
        familyHealthEnabled: true,
        enabled: true,
        measurementTypes: nextTypes,
        educationalContent: DEFAULT_EDUCATIONAL_CONTENT,
        updatedBy: adminId,
        updatedAt: Date.now(),
      });
    }
    return { archived, readingCount, measurementTypes: nextTypes };
  },
});

/**
 * Aggregate feature usage only. This never returns reading values, notes,
 * report files or other private clinical content.
 */
export const getUsageStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const [members, readings, reports] = await Promise.all([
      ctx.db.query("family_members").collect(),
      ctx.db.query("health_readings").collect(),
      ctx.db.query("health_reports").collect(),
    ]);

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

/** Non-clinical member metadata for the admin detail view. */
export const getMembers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [members, readings, reports] = await Promise.all([
      ctx.db.query("family_members").collect(),
      ctx.db.query("health_readings").collect(),
      ctx.db.query("health_reports").collect(),
    ]);
    const ownerIds = [...new Set(members.map((member) => member.ownerId))];
    const owners = await Promise.all(ownerIds.map((id) => ctx.db.get(id)));
    const ownerById = new Map(
      owners.filter(Boolean).map((owner: any) => [owner._id as string, owner]),
    );

    return members
      .map((member) => {
        const memberReadings = readings.filter(
          (reading) => reading.memberId === member._id,
        );
        const memberReports = reports.filter(
          (report) => report.memberId === member._id,
        );
        const owner: any = ownerById.get(member.ownerId as string);
        return {
          _id: member._id,
          name: member.name,
          relationship: member.relationship,
          ownerId: member.ownerId,
          ownerName: owner?.name ?? "Customer",
          ownerEmail: owner?.email ?? null,
          createdAt: member.createdAt,
          readingsCount: memberReadings.length,
          reportsCount: memberReports.length,
          lastReadingAt:
            memberReadings.length > 0
              ? Math.max(...memberReadings.map((row) => row.recordedAt))
              : null,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Reading activity without values or notes. Admins can see that a reading was
 * recorded and which configured type/member it belongs to, but not its content.
 */
export const getReadingsActivity = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [readings, members, settings] = await Promise.all([
      ctx.db.query("health_readings").collect(),
      ctx.db.query("family_members").collect(),
      ctx.db.query("health_tracker_settings").first(),
    ]);
    const memberById = new Map(members.map((member) => [member._id, member]));
    const typeLabels = new Map(
      ((settings?.measurementTypes ?? DEFAULT_MEASUREMENT_TYPES) as MeasurementType[]).map(
        (type) => [type.key, type.label],
      ),
    );

    return readings
      .sort((a, b) => b.recordedAt - a.recordedAt)
      .map((reading) => {
        const member = memberById.get(reading.memberId);
        return {
          _id: reading._id,
          memberName: member?.name ?? "Removed member",
          relationship: member?.relationship ?? "other",
          typeKey: reading.typeKey,
          typeLabel: typeLabels.get(reading.typeKey) ?? reading.typeKey,
          unit: reading.unit,
          recordedAt: reading.recordedAt,
          createdAt: reading.createdAt,
          hasNotes: !!reading.notes,
        };
      });
  },
});

/** Uploaded report metadata only; no file URL or content is exposed to admin. */
export const getReports = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [reports, members] = await Promise.all([
      ctx.db.query("health_reports").collect(),
      ctx.db.query("family_members").collect(),
    ]);
    const memberById = new Map(members.map((member) => [member._id, member]));
    return reports
      .sort((a, b) => b.recordedAt - a.recordedAt)
      .map((report) => {
        const member = memberById.get(report.memberId);
        return {
          _id: report._id,
          title: report.title,
          memberName: member?.name ?? "Removed member",
          relationship: member?.relationship ?? "other",
          fileName: report.fileName,
          fileType: report.fileType,
          fileSize: report.fileSize,
          recordedAt: report.recordedAt,
          createdAt: report.createdAt,
        };
      });
  },
});

/** Customers actively using Family Health, using the existing distinct-reader definition. */
export const getActiveCustomers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [members, readings, reports] = await Promise.all([
      ctx.db.query("family_members").collect(),
      ctx.db.query("health_readings").collect(),
      ctx.db.query("health_reports").collect(),
    ]);
    const activeIds = [...new Set(readings.map((reading) => reading.ownerId as string))];
    const users = await Promise.all(activeIds.map((id) => ctx.db.get(id as any)));
    const userById = new Map(
      users.filter(Boolean).map((user: any) => [user._id as string, user]),
    );

    return activeIds
      .map((ownerId) => {
        const owner: any = userById.get(ownerId);
        const ownerReadings = readings.filter(
          (reading) => (reading.ownerId as string) === ownerId,
        );
        const ownerReports = reports.filter(
          (report) => (report.ownerId as string) === ownerId,
        );
        return {
          ownerId,
          name: owner?.name ?? "Customer",
          email: owner?.email ?? null,
          membersCount: members.filter(
            (member) => (member.ownerId as string) === ownerId,
          ).length,
          readingsCount: ownerReadings.length,
          reportsCount: ownerReports.length,
          lastActivityAt:
            ownerReadings.length > 0
              ? Math.max(...ownerReadings.map((row) => row.createdAt))
              : null,
        };
      })
      .sort((a, b) => (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0));
  },
});
