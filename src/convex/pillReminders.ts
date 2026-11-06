import { getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import {
  dueSlotForReminder,
  formatSlotTime,
  localDayStartMs,
  normalizeDateBoundary,
  normalizePillTimes,
  slotsForLocalDay,
  todayDoseSlots,
  validateTimezoneOffset,
} from "./pillScheduleCore";

const HISTORY_LIMIT = 200;

async function requireUser(ctx: { auth: any }) {
  const userId = await getAuthUserId(ctx as any);
  if (userId === null) throw new Error("Not authenticated");
  return userId;
}

function cleanMedicineName(name: string): string {
  const value = (name ?? "").trim();
  if (value.length < 2 || value.length > 80) {
    throw new Error("Medicine name must be between 2 and 80 characters.");
  }
  return value;
}

function cleanDoctorSchedule(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 200) {
    throw new Error("Doctor-prescribed schedule must be 200 characters or fewer.");
  }
  return trimmed;
}

// ── List the signed-in customer's own pill reminders ──
export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const reminders = await ctx.db
      .query("pill_reminders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const now = Date.now();
    return reminders
      .map((reminder) => ({
        ...reminder,
        todayDoses: todayDoseSlots(reminder, now),
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  },
});

// ── Create a reminder ──
export const create = mutation({
  args: {
    medicineName: v.string(),
    doctorSchedule: v.optional(v.string()),
    times: v.array(v.string()),
    startDate: v.number(),
    endDate: v.optional(v.number()),
    timezoneOffsetMinutes: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const offset = validateTimezoneOffset(args.timezoneOffsetMinutes);
    const times = normalizePillTimes(args.times);
    const startDate = normalizeDateBoundary(args.startDate, offset);
    const endDate =
      args.endDate === undefined || args.endDate === null
        ? undefined
        : normalizeDateBoundary(args.endDate, offset);

    if (endDate !== undefined && endDate < startDate) {
      throw new Error("End date cannot be before the start date.");
    }

    const now = Date.now();
    const id = await ctx.db.insert("pill_reminders", {
      userId,
      medicineName: cleanMedicineName(args.medicineName),
      doctorSchedule: cleanDoctorSchedule(args.doctorSchedule),
      times,
      startDate,
      endDate,
      timezoneOffsetMinutes: offset,
      isActive: true,
      notes: args.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, id };
  },
});

// ── Edit / pause / resume a reminder (ownership enforced) ──
export const update = mutation({
  args: {
    reminderId: v.id("pill_reminders"),
    medicineName: v.optional(v.string()),
    doctorSchedule: v.optional(v.string()),
    times: v.optional(v.array(v.string())),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.union(v.number(), v.null())),
    isActive: v.optional(v.boolean()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const reminder = await ctx.db.get(args.reminderId);
    // A reminder that belongs to another customer must look like it does not
    // exist, so one customer can never probe another's schedule.
    if (!reminder || reminder.userId !== userId) {
      throw new Error("Reminder not found");
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.medicineName !== undefined) {
      patch.medicineName = cleanMedicineName(args.medicineName);
    }
    if (args.doctorSchedule !== undefined) {
      patch.doctorSchedule = cleanDoctorSchedule(args.doctorSchedule);
    }
    if (args.times !== undefined) {
      patch.times = normalizePillTimes(args.times);
      // The schedule changed, so a slot already notified under the old times
      // must not block the new ones.
      patch.lastNotifiedSlot = undefined;
    }
    if (args.startDate !== undefined) {
      patch.startDate = normalizeDateBoundary(args.startDate, reminder.timezoneOffsetMinutes);
    }
    if (args.endDate !== undefined) {
      patch.endDate =
        args.endDate === null
          ? undefined
          : normalizeDateBoundary(args.endDate, reminder.timezoneOffsetMinutes);
    }
    if (args.notes !== undefined) {
      patch.notes = args.notes.trim() || undefined;
    }
    if (args.isActive !== undefined) {
      patch.isActive = args.isActive;
    }

    const nextStart = (patch.startDate as number | undefined) ?? reminder.startDate;
    const nextEnd = (patch.endDate as number | undefined) ?? (args.endDate === null ? undefined : reminder.endDate);
    if (nextEnd !== undefined && nextEnd < nextStart) {
      throw new Error("End date cannot be before the start date.");
    }

    await ctx.db.patch(args.reminderId, patch);
    return { success: true };
  },
});

// ── Delete a reminder and its private history ──
export const remove = mutation({
  args: { reminderId: v.id("pill_reminders") },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder || reminder.userId !== userId) {
      throw new Error("Reminder not found");
    }

    const events = await ctx.db
      .query("pill_reminder_events")
      .withIndex("by_reminder", (q) => q.eq("reminderId", args.reminderId))
      .collect();
    for (const event of events) {
      if (event.userId === userId) await ctx.db.delete(event._id);
    }

    await ctx.db.delete(args.reminderId);
    return { success: true };
  },
});

// ── Taken / Skipped for one scheduled dose ──
export const recordDose = mutation({
  args: {
    reminderId: v.id("pill_reminders"),
    scheduledFor: v.number(),
    status: v.union(v.literal("taken"), v.literal("skipped")),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);

    const reminder = await ctx.db.get(args.reminderId);
    if (!reminder || reminder.userId !== userId) {
      throw new Error("Reminder not found");
    }

    // The slot must be one this reminder actually schedules, and a future dose
    // cannot be marked before it is due.
    if (!Number.isFinite(args.scheduledFor)) throw new Error("Invalid dose time");
    if (args.scheduledFor > Date.now() + 2 * 60 * 1000) {
      throw new Error("This dose is not due yet.");
    }
    const validSlots = slotsForLocalDay(reminder, args.scheduledFor);
    if (!validSlots.includes(args.scheduledFor)) {
      throw new Error("That dose does not match this reminder's schedule.");
    }
    if (args.scheduledFor < localDayStartMs(reminder.startDate, reminder.timezoneOffsetMinutes)) {
      throw new Error("That dose is before the reminder start date.");
    }

    const existing = await ctx.db
      .query("pill_reminder_events")
      .withIndex("by_reminder_slot", (q) =>
        q.eq("reminderId", args.reminderId).eq("scheduledFor", args.scheduledFor),
      )
      .first();

    if (existing) {
      if (existing.userId !== userId) throw new Error("Reminder not found");
      await ctx.db.patch(existing._id, {
        status: args.status,
        recordedAt: Date.now(),
      });
      return { success: true, id: existing._id, updated: true };
    }

    const id = await ctx.db.insert("pill_reminder_events", {
      userId,
      reminderId: args.reminderId,
      scheduledFor: args.scheduledFor,
      status: args.status,
      recordedAt: Date.now(),
    });
    return { success: true, id, updated: false };
  },
});

// ── Private dose history (the customer's own events only) ──
export const history = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];

    const events = await ctx.db
      .query("pill_reminder_events")
      .withIndex("by_user_recorded", (q) => q.eq("userId", userId))
      .order("desc")
      .take(HISTORY_LIMIT);

    const reminderInfo = new Map<string, { name: string; offset: number }>();
    return Promise.all(
      events.map(async (event) => {
        const key = event.reminderId as unknown as string;
        if (!reminderInfo.has(key)) {
          const reminder = await ctx.db.get(event.reminderId);
          reminderInfo.set(key, {
            name: reminder?.medicineName ?? "Medicine",
            offset: reminder?.timezoneOffsetMinutes ?? -330,
          });
        }
        const info = reminderInfo.get(key)!;
        return {
          ...event,
          medicineName: info.name,
          timezoneOffsetMinutes: info.offset,
        };
      }),
    );
  },
});

// ── Cron: create a website notification for each due dose ──
// Idempotent: a slot is only notified once regardless of how often this runs.
export const processDue = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const reminders = await ctx.db
      .query("pill_reminders")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    let notified = 0;
    for (const reminder of reminders) {
      const slot = dueSlotForReminder(reminder, now);
      if (slot === null) continue;

      // If the customer already recorded this dose, do not notify for it.
      const recorded = await ctx.db
        .query("pill_reminder_events")
        .withIndex("by_reminder_slot", (q) =>
          q.eq("reminderId", reminder._id).eq("scheduledFor", slot),
        )
        .first();

      if (!recorded) {
        const time = formatSlotTime(slot, reminder.timezoneOffsetMinutes);
        const schedule = reminder.doctorSchedule
          ? ` (${reminder.doctorSchedule})`
          : "";
        await ctx.db.insert("notifications", {
          userId: reminder.userId,
          type: "system",
          title: `Pill reminder: ${reminder.medicineName}`,
          body: `It is ${time} — time for ${reminder.medicineName}${schedule}. Mark it Taken or Skipped in your Pill Reminders.`,
          read: false,
          link: "/account/pill-reminders",
          metadata: JSON.stringify({
            kind: "pill_reminder",
            pillReminderId: reminder._id,
            scheduledFor: slot,
          }),
          createdAt: now,
        });
        notified++;
      }

      await ctx.db.patch(reminder._id, {
        lastNotifiedSlot: slot,
        updatedAt: now,
      });
    }

    return { notified, checked: reminders.length };
  },
});
