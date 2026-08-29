import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/** Book an appointment (customer) */
export const bookAppointment = mutation({
  args: {
    doctorId: v.id("doctors"),
    appointmentDate: v.string(),
    appointmentTime: v.string(),
    consultationType: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Get user
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();
    if (!user) throw new Error("User not found");

    // Get doctor
    const doctor = await ctx.db.get(args.doctorId);
    if (!doctor || !doctor.isActive) throw new Error("Doctor not available");

    // Check slot availability
    const existingBookings = await ctx.db
      .query("doctor_appointments")
      .withIndex("by_doctor_date", (q) =>
        q.eq("doctorId", args.doctorId).eq("appointmentDate", args.appointmentDate)
      )
      .collect();

    const bookedCount = existingBookings.filter(
      (b) => b.appointmentTime === args.appointmentTime && b.status !== "cancelled"
    ).length;

    const maxPerSlot = doctor.maxPatientsPerSlot || 1;
    if (bookedCount >= maxPerSlot) {
      throw new Error("This time slot is no longer available");
    }

    const now = Date.now();
    const appointmentId = await ctx.db.insert("doctor_appointments", {
      doctorId: args.doctorId,
      doctorName: doctor.name,
      specialty: doctor.specialty,
      clinicName: doctor.clinicName,
      consultationFee: doctor.consultationFee,
      userId: user._id,
      customerName: user.name || "Customer",
      customerEmail: user.email,
      customerPhone: user.phone || "",
      appointmentDate: args.appointmentDate,
      appointmentTime: args.appointmentTime,
      consultationType: args.consultationType,
      bookingDate: now,
      status: "pending",
      paymentStatus: "pending",
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });

    return appointmentId;
  },
});

/** Get customer's appointments */
export const myAppointments = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();
    if (!user) return [];

    const appointments = await ctx.db
      .query("doctor_appointments")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();

    return appointments;
  },
});

/* ─── Admin Queries & Mutations ─── */

/** List all appointments (admin) */
export const adminListAppointments = query({
  args: {
    status: v.optional(v.string()),
    specialty: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let results = await ctx.db
      .query("doctor_appointments")
      .order("desc")
      .collect();

    if (args.status && args.status !== "all") {
      results = results.filter((a) => a.status === args.status);
    }

    if (args.specialty && args.specialty !== "all") {
      results = results.filter((a) => a.specialty === args.specialty);
    }

    if (args.search) {
      const s = args.search.toLowerCase();
      results = results.filter(
        (a) =>
          a.customerName.toLowerCase().includes(s) ||
          a.doctorName.toLowerCase().includes(s) ||
          a.customerEmail?.toLowerCase().includes(s) ||
          a.customerPhone.includes(s)
      );
    }

    return results;
  },
});

/** Update appointment status (admin) */
export const updateAppointmentStatus = mutation({
  args: {
    appointmentId: v.id("doctor_appointments"),
    status: v.union(
      v.literal("pending"),
      v.literal("confirmed"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.appointmentId, {
      status: args.status,
      updatedAt: Date.now(),
    });
  },
});

/** Get appointment by ID */
export const getAppointment = query({
  args: { appointmentId: v.id("doctor_appointments") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.appointmentId);
  },
});
