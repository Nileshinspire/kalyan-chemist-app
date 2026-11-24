import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

/**
 * Default measurement types. These are only the starting configuration — the
 * admin-managed `health_tracker_settings` row overrides them, and the backend
 * always validates a reading against the live configuration.
 */
export type MeasurementType = {
  key: string;
  label: string;
  unit: string;
  secondaryLabel?: string;
  secondaryUnit?: string;
  min: number;
  max: number;
  /** Absent means active; archived types stay visible for historical readings. */
  isActive?: boolean;
};

export const DEFAULT_MEASUREMENT_TYPES: MeasurementType[] = [
  {
    key: "weight",
    label: "Weight",
    unit: "kg",
    min: 1,
    max: 400,
  },
  {
    key: "blood_pressure",
    label: "Blood pressure",
    unit: "mmHg",
    secondaryLabel: "Diastolic",
    secondaryUnit: "mmHg",
    min: 40,
    max: 300,
  },
  {
    key: "blood_sugar",
    label: "Blood sugar",
    unit: "mg/dL",
    min: 20,
    max: 800,
  },
  {
    key: "pulse",
    label: "Pulse",
    unit: "bpm",
    min: 20,
    max: 250,
  },
  {
    key: "temperature",
    label: "Body temperature",
    unit: "°F",
    min: 90,
    max: 115,
  },
  {
    key: "oxygen",
    label: "Oxygen saturation",
    unit: "%",
    min: 50,
    max: 100,
  },
];

export const DEFAULT_EDUCATIONAL_CONTENT =
  "Health Tracker is a personal record book. It helps you and your family keep measurements in one place and share them with a doctor. It is not a diagnosis, and it does not replace professional medical advice. If a reading looks unusual or you feel unwell, contact a qualified doctor.";

async function requireUser(ctx: { auth: any }) {
  const userId = await getAuthUserId(ctx as any);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

async function ownedMember(ctx: any, ownerId: Id<"users">, memberId: Id<"family_members">) {
  const member = await ctx.db.get(memberId);
  if (!member || member.ownerId !== ownerId) throw new Error("Family member not found.");
  return member;
}

async function loadSettings(ctx: any) {
  return await ctx.db.query("health_tracker_settings").first();
}

/** Public tracker configuration. Contains no customer data. */
export const getConfig = query({
  args: {},
  handler: async (ctx) => {
    const settings = await loadSettings(ctx);
    return {
      enabled: settings?.enabled ?? true,
      measurementTypes: settings?.measurementTypes ?? DEFAULT_MEASUREMENT_TYPES,
      educationalContent: settings?.educationalContent ?? DEFAULT_EDUCATIONAL_CONTENT,
    };
  },
});

/** Readings for one member, owned by the signed-in customer only. */
export const list = query({
  args: { memberId: v.id("family_members"), typeKey: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const member = await ctx.db.get(args.memberId);
    if (!member || member.ownerId !== userId) return [];

    const readings = await ctx.db
      .query("health_readings")
      .withIndex("by_member", (q) => q.eq("memberId", args.memberId))
      .order("desc")
      .take(300);

    const filtered = args.typeKey
      ? readings.filter((r) => r.typeKey === args.typeKey)
      : readings;
    return filtered.map((r) => ({
      _id: r._id,
      typeKey: r.typeKey,
      value: r.value,
      secondaryValue: r.secondaryValue,
      unit: r.unit,
      recordedAt: r.recordedAt,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));
  },
});

export const addReading = mutation({
  args: {
    memberId: v.id("family_members"),
    typeKey: v.string(),
    value: v.number(),
    secondaryValue: v.optional(v.number()),
    recordedAt: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await ownedMember(ctx, userId, args.memberId);

    const settings = await loadSettings(ctx);
    if (settings && !settings.enabled) {
      throw new Error("Health Tracker is currently unavailable.");
    }
    const types: MeasurementType[] = settings?.measurementTypes ?? DEFAULT_MEASUREMENT_TYPES;
    const type = types.find((t) => t.key === args.typeKey);
    if (!type || type.isActive === false) {
      throw new Error("Choose a valid active measurement type.");
    }

    if (!Number.isFinite(args.value) || args.value < type.min || args.value > type.max) {
      throw new Error(
        `${type.label} must be between ${type.min} and ${type.max} ${type.unit}.`,
      );
    }
    if (type.secondaryLabel) {
      if (args.secondaryValue === undefined || !Number.isFinite(args.secondaryValue)) {
        throw new Error(`${type.secondaryLabel} is required for ${type.label}.`);
      }
      if (args.secondaryValue < type.min || args.secondaryValue > type.max) {
        throw new Error(
          `${type.secondaryLabel} must be between ${type.min} and ${type.max} ${type.unit}.`,
        );
      }
      if (args.secondaryValue >= args.value) {
        throw new Error(`${type.secondaryLabel} must be lower than the first value.`);
      }
    } else if (args.secondaryValue !== undefined) {
      throw new Error("This measurement type does not use a second value.");
    }

    if (!Number.isFinite(args.recordedAt) || args.recordedAt > Date.now() + 5 * 60 * 1000) {
      throw new Error("Choose a valid date and time that is not in the future.");
    }
    if (args.recordedAt < Date.now() - 100 * 365 * 24 * 60 * 60 * 1000) {
      throw new Error("Choose a date within the last 100 years.");
    }
    const notes = args.notes?.trim();
    if (notes && notes.length > 500) throw new Error("Notes must be 500 characters or fewer.");

    const now = Date.now();
    const id = await ctx.db.insert("health_readings", {
      ownerId: userId,
      memberId: args.memberId,
      typeKey: type.key,
      value: args.value,
      secondaryValue: type.secondaryLabel ? args.secondaryValue : undefined,
      unit: type.unit,
      recordedAt: args.recordedAt,
      notes: notes || undefined,
      createdAt: now,
      updatedAt: now,
    });
    return { success: true, id };
  },
});

export const updateReading = mutation({
  args: {
    readingId: v.id("health_readings"),
    value: v.number(),
    secondaryValue: v.optional(v.union(v.number(), v.null())),
    recordedAt: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const reading = await ctx.db.get(args.readingId);
    if (!reading || reading.ownerId !== userId) throw new Error("Reading not found.");
    await ownedMember(ctx, userId, reading.memberId);

    const settings = await loadSettings(ctx);
    const types: MeasurementType[] = settings?.measurementTypes ?? DEFAULT_MEASUREMENT_TYPES;
    const type = types.find((t) => t.key === reading.typeKey);
    if (!type) throw new Error("This measurement type is no longer available.");

    if (!Number.isFinite(args.value) || args.value < type.min || args.value > type.max) {
      throw new Error(
        `${type.label} must be between ${type.min} and ${type.max} ${type.unit}.`,
      );
    }
    let secondaryValue: number | undefined;
    if (type.secondaryLabel) {
      if (args.secondaryValue === undefined || args.secondaryValue === null) {
        throw new Error(`${type.secondaryLabel} is required.`);
      }
      secondaryValue = args.secondaryValue;
      if (secondaryValue < type.min || secondaryValue > type.max) {
        throw new Error(`${type.secondaryLabel} is outside the allowed range.`);
      }
      if (secondaryValue >= args.value) {
        throw new Error(`${type.secondaryLabel} must be lower than the first value.`);
      }
    }
    if (!Number.isFinite(args.recordedAt) || args.recordedAt > Date.now() + 5 * 60 * 1000) {
      throw new Error("Choose a valid date and time that is not in the future.");
    }
    const notes = args.notes?.trim();
    if (notes && notes.length > 500) throw new Error("Notes must be 500 characters or fewer.");

    await ctx.db.patch(reading._id, {
      value: args.value,
      secondaryValue,
      recordedAt: args.recordedAt,
      notes: notes || undefined,
      // Keep the unit captured with the original reading. Admin unit changes
      // apply to new readings only, preserving historical records.
      unit: reading.unit,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const removeReading = mutation({
  args: { readingId: v.id("health_readings") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const reading = await ctx.db.get(args.readingId);
    if (!reading || reading.ownerId !== userId) throw new Error("Reading not found.");
    await ctx.db.delete(reading._id);
    return { success: true };
  },
});

/** Reports for one member, with short-lived private storage URLs. */
export const listReports = query({
  args: { memberId: v.id("family_members") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const member = await ctx.db.get(args.memberId);
    if (!member || member.ownerId !== userId) return [];

    const reports = await ctx.db
      .query("health_reports")
      .withIndex("by_member", (q) => q.eq("memberId", args.memberId))
      .order("desc")
      .collect();

    return Promise.all(
      reports.map(async (r) => ({
        _id: r._id,
        title: r.title,
        fileName: r.fileName,
        fileType: r.fileType,
        fileSize: r.fileSize,
        recordedAt: r.recordedAt,
        createdAt: r.createdAt,
        url: await ctx.storage.getUrl(r.fileId),
      })),
    );
  },
});

export const generateReportUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const addReport = mutation({
  args: {
    memberId: v.id("family_members"),
    title: v.string(),
    fileId: v.string(),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    recordedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    await ownedMember(ctx, userId, args.memberId);

    const allowed = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(args.fileType)) {
      throw new Error("Upload a JPG, PNG or PDF report.");
    }
    if (args.fileSize <= 0 || args.fileSize > 10 * 1024 * 1024) {
      throw new Error("Reports must be 10 MB or smaller.");
    }
    const title = args.title.trim();
    if (title.length < 2 || title.length > 80) {
      throw new Error("Report title must be between 2 and 80 characters.");
    }
    if (!Number.isFinite(args.recordedAt) || args.recordedAt > Date.now() + 5 * 60 * 1000) {
      throw new Error("Choose a valid report date.");
    }

    const id = await ctx.db.insert("health_reports", {
      ownerId: userId,
      memberId: args.memberId,
      title,
      fileId: args.fileId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      recordedAt: args.recordedAt,
      createdAt: Date.now(),
    });
    return { success: true, id };
  },
});

export const removeReport = mutation({
  args: { reportId: v.id("health_reports") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const report = await ctx.db.get(args.reportId);
    if (!report || report.ownerId !== userId) throw new Error("Report not found.");
    await ctx.storage.delete(report.fileId);
    await ctx.db.delete(report._id);
    return { success: true };
  },
});
