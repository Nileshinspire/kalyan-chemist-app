import { getAuthUserId } from "@convex-dev/auth/server";
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";

const RELATIONSHIPS = ["self", "father", "mother", "child", "spouse", "other"] as const;
type Relationship = (typeof RELATIONSHIPS)[number];

async function requireUser(ctx: { auth: any }) {
  const userId = await getAuthUserId(ctx as any);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

function cleanName(value: string): string {
  const name = (value ?? "").trim();
  if (name.length < 2 || name.length > 60) {
    throw new Error("Name must be between 2 and 60 characters.");
  }
  return name;
}

function cleanOptional(value: string | undefined, max: number, field: string) {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) throw new Error(`${field} is too long.`);
  return trimmed;
}

function validatePhone(phone: string | undefined) {
  if (!phone) return undefined;
  if (!/^[6-9]\d{9}$/.test(phone)) {
    throw new Error("Phone must be a 10-digit Indian mobile number starting with 6-9.");
  }
  return phone;
}

async function ownedMember(ctx: any, ownerId: Id<"users">, memberId: Id<"family_members">) {
  const member = await ctx.db.get(memberId);
  // Another customer's member must look non-existent.
  if (!member || member.ownerId !== ownerId) throw new Error("Family member not found.");
  return member;
}

/** Family Health availability (admin-controlled). */
export const getAvailability = query({
  args: {},
  handler: async (ctx) => {
    const settings = await ctx.db.query("health_tracker_settings").first();
    return {
      familyHealthEnabled: settings?.familyHealthEnabled ?? true,
      trackerEnabled: settings?.enabled ?? true,
    };
  },
});

/** List the signed-in customer's family members. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const members = await ctx.db
      .query("family_members")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    members.sort((a, b) => {
      if (a.relationship === "self" && b.relationship !== "self") return -1;
      if (b.relationship === "self" && a.relationship !== "self") return 1;
      return a.createdAt - b.createdAt;
    });

    return await Promise.all(
      members.map(async (member) => ({
        ...member,
        photoUrl: member.photoFileId
          ? await ctx.storage.getUrl(member.photoFileId)
          : null,
      })),
    );
  },
});

/**
 * Create the account holder's own profile once, reusing their account name.
 * Idempotent, so calling it on page load is safe.
 */
export const ensureSelf = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx);
    const existing = await ctx.db
      .query("family_members")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const self = existing.find((m) => m.relationship === "self");
    if (self) return { id: self._id, created: false };

    const user = await ctx.db.get(userId);
    const now = Date.now();
    const id = await ctx.db.insert("family_members", {
      ownerId: userId,
      name: user?.name?.trim() || "Self",
      relationship: "self",
      phone: user?.phone,
      createdAt: now,
      updatedAt: now,
    });
    return { id, created: true };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    relationship: v.union(
      v.literal("self"),
      v.literal("father"),
      v.literal("mother"),
      v.literal("child"),
      v.literal("spouse"),
      v.literal("other"),
    ),
    dateOfBirth: v.optional(v.number()),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("other"))),
    bloodGroup: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const members = await ctx.db
      .query("family_members")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();

    if (members.length >= 12) {
      throw new Error("You can add up to 12 family members.");
    }
    if (args.relationship === "self" && members.some((m) => m.relationship === "self")) {
      throw new Error("Your own profile already exists.");
    }
    if (
      args.dateOfBirth !== undefined &&
      (!Number.isFinite(args.dateOfBirth) || args.dateOfBirth > Date.now())
    ) {
      throw new Error("Please enter a valid date of birth.");
    }

    const now = Date.now();
    const id = await ctx.db.insert("family_members", {
      ownerId: userId,
      name: cleanName(args.name),
      relationship: args.relationship,
      dateOfBirth: args.dateOfBirth,
      gender: args.gender,
      bloodGroup: cleanOptional(args.bloodGroup, 8, "Blood group"),
      phone: validatePhone(cleanOptional(args.phone, 10, "Phone")),
      notes: cleanOptional(args.notes, 300, "Notes"),
      createdAt: now,
      updatedAt: now,
    });
    return { success: true, id };
  },
});

export const update = mutation({
  args: {
    memberId: v.id("family_members"),
    name: v.string(),
    relationship: v.union(
      v.literal("self"),
      v.literal("father"),
      v.literal("mother"),
      v.literal("child"),
      v.literal("spouse"),
      v.literal("other"),
    ),
    dateOfBirth: v.optional(v.union(v.number(), v.null())),
    gender: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("other"), v.null())),
    bloodGroup: v.optional(v.string()),
    phone: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const member = await ownedMember(ctx, userId, args.memberId);

    if (args.relationship === "self" && member.relationship !== "self") {
      const all = await ctx.db
        .query("family_members")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .collect();
      if (all.some((m) => m.relationship === "self")) {
        throw new Error("Your own profile already exists.");
      }
    }
    if (
      args.dateOfBirth !== undefined &&
      args.dateOfBirth !== null &&
      (!Number.isFinite(args.dateOfBirth) || args.dateOfBirth > Date.now())
    ) {
      throw new Error("Please enter a valid date of birth.");
    }

    await ctx.db.patch(member._id, {
      name: cleanName(args.name),
      relationship: args.relationship,
      dateOfBirth: args.dateOfBirth === null ? undefined : args.dateOfBirth,
      gender: args.gender === null ? undefined : args.gender,
      bloodGroup: cleanOptional(args.bloodGroup, 8, "Blood group"),
      phone: validatePhone(cleanOptional(args.phone, 10, "Phone")),
      notes: cleanOptional(args.notes, 300, "Notes"),
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const remove = mutation({
  args: { memberId: v.id("family_members") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const member = await ownedMember(ctx, userId, args.memberId);

    // Records are never silently destroyed. The customer must delete them
    // first, so a profile deletion can't erase health history by accident.
    const readings = await ctx.db
      .query("health_readings")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .first();
    const reports = await ctx.db
      .query("health_reports")
      .withIndex("by_member", (q) => q.eq("memberId", member._id))
      .first();
    if (readings || reports) {
      throw new Error(
        "This member has health records. Delete those records before removing the profile.",
      );
    }

    const reminders = await ctx.db
      .query("pill_reminders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (reminders.some((r) => r.memberId === member._id)) {
      throw new Error("This member has pill reminders. Reassign or delete them first.");
    }

    const prescriptions = await ctx.db
      .query("prescriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    if (prescriptions.some((p) => p.memberId === member._id)) {
      throw new Error("This member has prescriptions. They must be kept with a profile.");
    }

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .collect();
    if (orders.some((order) => order.familyMemberId === member._id)) {
      throw new Error("This member has orders. Keep the profile so order history stays linked.");
    }

    if (member.photoFileId) {
      try {
        await ctx.storage.delete(member.photoFileId as Id<"_storage">);
      } catch {
        // The profile can still be removed if its old photo was already gone.
      }
    }
    await ctx.db.delete(member._id);
    return { success: true };
  },
});

/** Secure upload URL for an optional family-member profile photo. */
export const generateProfilePhotoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

/** Attach/replace a member photo after validating ownership and file metadata. */
export const setProfilePhoto = mutation({
  args: {
    memberId: v.id("family_members"),
    fileId: v.string(),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const member = await ownedMember(ctx, userId, args.memberId);

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(args.fileType)) {
      throw new Error("Choose a JPG, PNG or WebP photo.");
    }
    if (!Number.isFinite(args.fileSize) || args.fileSize <= 0 || args.fileSize > 5 * 1024 * 1024) {
      throw new Error("Profile photos must be 5 MB or smaller.");
    }
    if (!args.fileId.trim()) throw new Error("Photo upload did not complete. Please try again.");

    const previousFileId = member.photoFileId;
    await ctx.db.patch(member._id, {
      photoFileId: args.fileId,
      photoFileName: args.fileName.slice(0, 200),
      photoFileType: args.fileType,
      photoUpdatedAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (previousFileId && previousFileId !== args.fileId) {
      try {
        await ctx.storage.delete(previousFileId as Id<"_storage">);
      } catch {
        // Replacing the photo must not fail because the old object expired.
      }
    }
    return { success: true };
  },
});

export const removeProfilePhoto = mutation({
  args: { memberId: v.id("family_members") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const member = await ownedMember(ctx, userId, args.memberId);
    if (member.photoFileId) {
      try {
        await ctx.storage.delete(member.photoFileId as Id<"_storage">);
      } catch {
        // The DB reference is cleared either way.
      }
    }
    await ctx.db.patch(member._id, {
      photoFileId: undefined,
      photoFileName: undefined,
      photoFileType: undefined,
      photoUpdatedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/** All readings for the signed-in customer's family, with member context. */
export const listFamilyReadings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const [members, readings] = await Promise.all([
      ctx.db
        .query("family_members")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .collect(),
      ctx.db
        .query("health_readings")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .collect(),
    ]);
    const memberById = new Map(members.map((member) => [member._id, member]));
    return readings
      .filter((reading) => memberById.has(reading.memberId))
      .sort((a, b) => b.recordedAt - a.recordedAt)
      .map((reading) => {
        const member = memberById.get(reading.memberId)!;
        return {
          _id: reading._id,
          memberId: reading.memberId,
          memberName: member.name,
          relationship: member.relationship,
          typeKey: reading.typeKey,
          value: reading.value,
          secondaryValue: reading.secondaryValue,
          unit: reading.unit,
          recordedAt: reading.recordedAt,
          notes: reading.notes,
          createdAt: reading.createdAt,
        };
      });
  },
});

/** All private reports for the signed-in customer's family, with member context. */
export const listFamilyReports = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const [members, reports] = await Promise.all([
      ctx.db
        .query("family_members")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .collect(),
      ctx.db
        .query("health_reports")
        .withIndex("by_owner", (q) => q.eq("ownerId", userId))
        .collect(),
    ]);
    const memberById = new Map(members.map((member) => [member._id, member]));
    const visible = reports
      .filter((report) => memberById.has(report.memberId))
      .sort((a, b) => b.recordedAt - a.recordedAt);
    return await Promise.all(
      visible.map(async (report) => {
        const member = memberById.get(report.memberId)!;
        return {
          _id: report._id,
          memberId: report.memberId,
          memberName: member.name,
          relationship: member.relationship,
          title: report.title,
          fileName: report.fileName,
          fileType: report.fileType,
          fileSize: report.fileSize,
          recordedAt: report.recordedAt,
          createdAt: report.createdAt,
          url: await ctx.storage.getUrl(report.fileId),
        };
      }),
    );
  },
});

/** Aggregate-only stats used by the customer's Family Health header. */
export const summary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return { members: 0, readings: 0, reports: 0 };
    const members = await ctx.db
      .query("family_members")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const readings = await ctx.db
      .query("health_readings")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    const reports = await ctx.db
      .query("health_reports")
      .withIndex("by_owner", (q) => q.eq("ownerId", userId))
      .collect();
    return { members: members.length, readings: readings.length, reports: reports.length };
  },
});
