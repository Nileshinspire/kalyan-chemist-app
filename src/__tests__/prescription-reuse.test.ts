import { describe, expect, it } from "vitest";
import {
  PRESCRIPTION_VALIDITY_DAYS,
  evaluatePrescriptionUsage,
  prescriptionExpiresAt,
} from "@/convex/prescriptionCore";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 0, 10);

const base = {
  status: "approved" as const,
  prescriptionDate: NOW - 10 * DAY,
  createdAt: NOW - 9 * DAY,
  linkedProductIds: [] as string[],
  requiredProductIds: ["medicine-a"],
  now: NOW,
};

describe("prescription validity", () => {
  it("uses the prescription date when deciding expiry", () => {
    expect(prescriptionExpiresAt(base.prescriptionDate, base.createdAt)).toBe(
      base.prescriptionDate! + PRESCRIPTION_VALIDITY_DAYS * DAY,
    );
  });

  it("falls back to upload time when no prescription date was provided", () => {
    expect(prescriptionExpiresAt(undefined, base.createdAt)).toBe(
      base.createdAt + PRESCRIPTION_VALIDITY_DAYS * DAY,
    );
  });

  it("rejects an approved prescription older than the validity window", () => {
    const usage = evaluatePrescriptionUsage({
      ...base,
      prescriptionDate: NOW - (PRESCRIPTION_VALIDITY_DAYS + 1) * DAY,
    });
    expect(usage.usable).toBe(false);
    expect(usage.expired).toBe(true);
    expect(usage.reason).toMatch(/more than 180 days/);
  });

  it("accepts a recent approved prescription for its first order", () => {
    const usage = evaluatePrescriptionUsage(base);
    expect(usage.usable).toBe(true);
    expect(usage.firstUse).toBe(true);
    expect(usage.expired).toBe(false);
  });
});

describe("prescription medicine scope", () => {
  it("reuses a prescription for the medicines it was already approved for", () => {
    const usage = evaluatePrescriptionUsage({
      ...base,
      linkedProductIds: ["medicine-a", "medicine-b"],
      requiredProductIds: ["medicine-a"],
    });
    expect(usage.usable).toBe(true);
    expect(usage.firstUse).toBe(false);
  });

  it("does not reuse a prescription for a different medicine", () => {
    const usage = evaluatePrescriptionUsage({
      ...base,
      linkedProductIds: ["medicine-a"],
      requiredProductIds: ["medicine-b"],
    });
    expect(usage.usable).toBe(false);
    expect(usage.reason).toMatch(/different medicines/);
  });

  it("requires every prescription medicine in the cart to be covered", () => {
    const usage = evaluatePrescriptionUsage({
      ...base,
      linkedProductIds: ["medicine-a"],
      requiredProductIds: ["medicine-a", "medicine-b"],
    });
    expect(usage.usable).toBe(false);
  });
});

describe("prescription review status", () => {
  it("allows a newly uploaded pending prescription on its first order", () => {
    const usage = evaluatePrescriptionUsage({ ...base, status: "pending" });
    expect(usage.usable).toBe(true);
    expect(usage.reason).toMatch(/pharmacist approval/);
  });

  it("does not reuse a pending prescription that is already linked to an order", () => {
    const usage = evaluatePrescriptionUsage({
      ...base,
      status: "under_review",
      linkedProductIds: ["medicine-a"],
    });
    expect(usage.usable).toBe(false);
    expect(usage.reason).toMatch(/already linked/);
  });

  it("never allows a rejected prescription", () => {
    const usage = evaluatePrescriptionUsage({ ...base, status: "rejected" });
    expect(usage.usable).toBe(false);
    expect(usage.reason).toMatch(/rejected/);
  });

  it("never allows a prescription needing clarification", () => {
    const usage = evaluatePrescriptionUsage({
      ...base,
      status: "needs_clarification",
    });
    expect(usage.usable).toBe(false);
    expect(usage.reason).toMatch(/clarification/);
  });
});
