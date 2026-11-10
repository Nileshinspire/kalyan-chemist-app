/**
 * Pure prescription-reuse rules.
 *
 * A prescription is a single record per uploaded document. It is linked to an
 * order through `orders.prescriptionId` — never copied. Reusing an existing
 * prescription is deliberately conservative:
 *
 *  - only approved prescriptions can be reused;
 *  - it must still be within its validity window;
 *  - once a prescription has been used on an order, it can only be reused for
 *    the same prescription-required medicines the pharmacist already approved
 *    it for. A fresh prescription can be used for its first order, where the
 *    pharmacist reviews it as usual.
 */

export const PRESCRIPTION_VALIDITY_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;

export type PrescriptionReviewStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "needs_clarification";

export type PrescriptionUsageInput = {
  status: PrescriptionReviewStatus;
  /** Date written on the prescription (optional — older records may lack it). */
  prescriptionDate?: number;
  /** Upload time, used as the start of the validity window when no date exists. */
  createdAt: number;
  /** Prescription-required product IDs already linked to this prescription. */
  linkedProductIds: string[];
  /** Prescription-required product IDs the customer is trying to buy now. */
  requiredProductIds: string[];
  now: number;
};

export type PrescriptionUsage = {
  /** Whether this prescription may be attached to the order being placed. */
  usable: boolean;
  /** True when the prescription has never been linked to an order. */
  firstUse: boolean;
  expired: boolean;
  /** End of the 180-day validity window (timestamp). */
  expiresAt: number;
  /** Customer-facing explanation when unusable, or context when usable. */
  reason?: string;
};

/** Validity starts from the date on the prescription, or upload time if absent. */
export function prescriptionExpiresAt(
  prescriptionDate: number | undefined,
  createdAt: number,
): number {
  const start =
    prescriptionDate && Number.isFinite(prescriptionDate) && prescriptionDate > 0
      ? prescriptionDate
      : createdAt;
  return start + PRESCRIPTION_VALIDITY_DAYS * DAY_MS;
}

export function evaluatePrescriptionUsage(
  input: PrescriptionUsageInput,
): PrescriptionUsage {
  const expiresAt = prescriptionExpiresAt(input.prescriptionDate, input.createdAt);
  const expired = input.now > expiresAt;
  const linked = new Set(input.linkedProductIds);
  const firstUse = linked.size === 0;
  const missing = [...new Set(input.requiredProductIds)].filter(
    (id) => !linked.has(id),
  );

  const base = { firstUse, expired, expiresAt };

  if (input.status === "rejected") {
    return {
      ...base,
      usable: false,
      reason:
        "This prescription was rejected. Upload a new prescription to order these medicines.",
    };
  }

  if (input.status === "needs_clarification") {
    return {
      ...base,
      usable: false,
      reason:
        "Our pharmacist needs clarification on this prescription before it can be used.",
    };
  }

  if (input.status === "pending" || input.status === "under_review") {
    if (!firstUse) {
      return {
        ...base,
        usable: false,
        reason:
          "This prescription is awaiting pharmacist approval and is already linked to another order.",
      };
    }
    return {
      ...base,
      usable: true,
      reason: "Awaiting pharmacist approval — your order is verified before dispatch.",
    };
  }

  // Approved from here on.
  if (expired) {
    return {
      ...base,
      usable: false,
      reason: `This prescription is more than ${PRESCRIPTION_VALIDITY_DAYS} days old. Please upload a recent prescription.`,
    };
  }

  if (!firstUse && missing.length > 0) {
    return {
      ...base,
      usable: false,
      reason:
        "This prescription was approved for different medicines. Upload a prescription for the medicines in this order.",
    };
  }

  return { ...base, usable: true };
}
