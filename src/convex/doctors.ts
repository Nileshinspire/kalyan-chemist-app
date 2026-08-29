import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/* ─── Shared Specialties Data ─── */
export const SPECIALTIES = [
  { key: "general-physician", label: "General Physician" },
  { key: "dermatology", label: "Dermatology" },
  { key: "obstetrics-gynaecology", label: "Obstetrics & Gynaecology" },
  { key: "orthopaedics", label: "Orthopaedics" },
  { key: "ent", label: "ENT" },
  { key: "neurology", label: "Neurology" },
  { key: "cardiology", label: "Cardiology" },
  { key: "urology", label: "Urology" },
  { key: "gastroenterology", label: "Gastroenterology/GI" },
  { key: "psychiatry", label: "Psychiatry" },
  { key: "paediatrics", label: "Paediatrics" },
  { key: "pulmonology", label: "Pulmonology" },
  { key: "endocrinology", label: "Endocrinology" },
  { key: "nephrology", label: "Nephrology" },
  { key: "neurosurgery", label: "Neurosurgery" },
  { key: "rheumatology", label: "Rheumatology" },
  { key: "ophthalmology", label: "Ophthalmology" },
  { key: "surgical-gastroenterology", label: "Surgical Gastroenterology" },
  { key: "infectious-disease", label: "Infectious Disease" },
  { key: "general-laparoscopic-surgery", label: "General & Laparoscopic Surgery" },
  { key: "psychology", label: "Psychology" },
  { key: "medical-oncology", label: "Medical Oncology" },
  { key: "diabetology", label: "Diabetology" },
  { key: "dentist", label: "Dentist" },
] as const;

/** List all specialties */
export const listSpecialties = query({
  args: {},
  handler: () => SPECIALTIES,
});

/** List active doctors, optionally filtered by specialty */
export const listDoctors = query({
  args: {
    specialty: v.optional(v.string()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let q = ctx.db.query("doctors").withIndex("by_isActive", (q) => q.eq("isActive", true));

    if (args.specialty) {
      q = ctx.db.query("doctors").withIndex("by_specialty_active", (q) =>
        q.eq("specialty", args.specialty!).eq("isActive", true)
      );
    }

    let results = await q.collect();

    if (args.search) {
      const s = args.search.toLowerCase();
      results = results.filter(
        (d) =>
          d.name.toLowerCase().includes(s) ||
          d.clinicName?.toLowerCase().includes(s) ||
          d.city?.toLowerCase().includes(s)
      );
    }

    return results;
  },
});

/** Get a single doctor by ID */
export const getDoctor = query({
  args: { doctorId: v.id("doctors") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.doctorId);
  },
});

/** Get available time slots for a doctor on a given date */
export const getAvailableSlots = query({
  args: {
    doctorId: v.id("doctors"),
    date: v.string(),
  },
  handler: async (ctx, args) => {
    const doctor = await ctx.db.get(args.doctorId);
    if (!doctor) return [];

    // Check if date is in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const requestedDate = new Date(args.date);
    if (requestedDate < today) return [];

    // Check if the day is available
    const dayOfWeek = requestedDate.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
    if (doctor.availableDays && doctor.availableDays.length > 0) {
      if (!doctor.availableDays.some((d) => d.toLowerCase() === dayOfWeek)) return [];
    }

    // Generate time slots
    const from = doctor.availableTimeFrom || "09:00";
    const to = doctor.availableTimeTo || "17:00";
    const duration = doctor.appointmentDuration || 30;
    const maxPerSlot = doctor.maxPatientsPerSlot || 1;

    const slots: Array<{ time: string; available: boolean; remaining: number }> = [];

    let [h, m] = from.split(":").map(Number);
    const [endH, endM] = to.split(":").map(Number);

    while (h < endH || (h === endH && m < endM)) {
      const timeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

      // Count existing bookings for this slot
      const bookings = await ctx.db
        .query("doctor_appointments")
        .withIndex("by_doctor_date", (q) =>
          q.eq("doctorId", args.doctorId).eq("appointmentDate", args.date)
        )
        .collect();

      const bookedCount = bookings.filter(
        (b) => b.appointmentTime === timeStr && b.status !== "cancelled"
      ).length;

      slots.push({
        time: timeStr,
        available: bookedCount < maxPerSlot,
        remaining: Math.max(0, maxPerSlot - bookedCount),
      });

      m += duration;
      if (m >= 60) {
        h += Math.floor(m / 60);
        m = m % 60;
      }
    }

    return slots;
  },
});

/** Get doctor count by specialty */
export const doctorCountBySpecialty = query({
  args: {},
  handler: async (ctx) => {
    const doctors = await ctx.db
      .query("doctors")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .collect();

    const counts: Record<string, number> = {};
    for (const d of doctors) {
      counts[d.specialty] = (counts[d.specialty] || 0) + 1;
    }
    return counts;
  },
});

/* ─── Admin Mutations ─── */

/** List all doctors (admin, including inactive) */
export const adminListDoctors = query({
  args: {
    specialty: v.optional(v.string()),
    search: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    let results: any[];

    if (args.specialty) {
      results = await ctx.db
        .query("doctors")
        .withIndex("by_specialty", (q) => q.eq("specialty", args.specialty!))
        .collect();
    } else {
      results = await ctx.db.query("doctors").collect();
    }

    if (args.isActive !== undefined) {
      results = results.filter((d) => d.isActive === args.isActive);
    }

    if (args.search) {
      const s = args.search.toLowerCase();
      results = results.filter(
        (d) =>
          d.name.toLowerCase().includes(s) ||
          d.clinicName?.toLowerCase().includes(s) ||
          d.city?.toLowerCase().includes(s)
      );
    }

    return results;
  },
});

/** Create a doctor */
export const createDoctor = mutation({
  args: {
    name: v.string(),
    specialty: v.string(),
    qualification: v.optional(v.string()),
    experience: v.optional(v.string()),
    consultationFee: v.number(),
    profilePhoto: v.optional(v.string()),
    clinicName: v.optional(v.string()),
    clinicAddress: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    pincode: v.optional(v.string()),
    aboutDoctor: v.optional(v.string()),
    languagesSpoken: v.optional(v.array(v.string())),
    consultationType: v.optional(v.array(v.string())),
    availableDays: v.optional(v.array(v.string())),
    availableTimeFrom: v.optional(v.string()),
    availableTimeTo: v.optional(v.string()),
    appointmentDuration: v.optional(v.number()),
    maxPatientsPerSlot: v.optional(v.number()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("doctors", { ...args, createdAt: now, updatedAt: now });
  },
});

/** Update a doctor */
export const updateDoctor = mutation({
  args: {
    doctorId: v.id("doctors"),
    name: v.string(),
    specialty: v.string(),
    qualification: v.optional(v.string()),
    experience: v.optional(v.string()),
    consultationFee: v.number(),
    profilePhoto: v.optional(v.string()),
    clinicName: v.optional(v.string()),
    clinicAddress: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    pincode: v.optional(v.string()),
    aboutDoctor: v.optional(v.string()),
    languagesSpoken: v.optional(v.array(v.string())),
    consultationType: v.optional(v.array(v.string())),
    availableDays: v.optional(v.array(v.string())),
    availableTimeFrom: v.optional(v.string()),
    availableTimeTo: v.optional(v.string()),
    appointmentDuration: v.optional(v.number()),
    maxPatientsPerSlot: v.optional(v.number()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { doctorId, ...data } = args;
    await ctx.db.patch(doctorId, { ...data, updatedAt: Date.now() });
  },
});

/** Toggle doctor active status */
export const toggleDoctorActive = mutation({
  args: { doctorId: v.id("doctors"), isActive: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.doctorId, { isActive: args.isActive, updatedAt: Date.now() });
  },
});

/** Delete a doctor */
export const deleteDoctor = mutation({
  args: { doctorId: v.id("doctors") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.doctorId);
  },
});
