import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUIET_HOURS,
  abVariantFor,
  evaluateAbTest,
  isQuietHours,
  nextAllowedSendTime,
  retryEligibility,
  storeTimeParts,
  validateCampaignInput,
  type QuietHoursSettings,
} from "@/convex/messageCenterCore";

const quiet: QuietHoursSettings = { ...DEFAULT_QUIET_HOURS, maxPromotionalPerWeek: 3 };

/** UTC instant for a given IST wall-clock time. */
function ist(year: number, month: number, day: number, hour: number, minute = 0) {
  return Date.UTC(year, month - 1, day, hour, minute) - 330 * 60_000;
}

describe("campaign quiet hours", () => {
  it("treats the overnight window as quiet and daytime as allowed", () => {
    expect(isQuietHours(ist(2026, 10, 24, 22, 30), quiet)).toBe(true);
    expect(isQuietHours(ist(2026, 10, 24, 8, 59), quiet)).toBe(true);
    expect(isQuietHours(ist(2026, 10, 24, 9, 0), quiet)).toBe(false);
    expect(isQuietHours(ist(2026, 10, 24, 12, 0), quiet)).toBe(false); // 12:00 IST
  });

  it("supports a daytime window and honours the disabled switch", () => {
    const daytime: QuietHoursSettings = {
      ...quiet,
      quietStartHour: 13,
      quietEndHour: 15,
    };
    expect(isQuietHours(ist(2026, 10, 24, 14, 0), daytime)).toBe(true);
    expect(isQuietHours(ist(2026, 10, 24, 15, 0), daytime)).toBe(false);
    expect(isQuietHours(ist(2026, 10, 24, 14, 0), { ...daytime, quietHoursEnabled: false })).toBe(
      false
    );
  });

  it("resumes at the first allowed minute without losing the minute offset", () => {
    const resume = nextAllowedSendTime(ist(2026, 10, 24, 22, 30), quiet);
    const parts = storeTimeParts(resume);
    expect(parts.hour).toBe(9);
    expect(parts.minute).toBe(30);
    expect(isQuietHours(resume, quiet)).toBe(false);
  });

  it("leaves an allowed timestamp untouched", () => {
    const allowed = ist(2026, 10, 24, 12, 0);
    expect(nextAllowedSendTime(allowed, quiet)).toBe(allowed);
  });
});

describe("A/B assignment", () => {
  it("is deterministic for the same campaign and customer", () => {
    const first = abVariantFor("campaign-1", "user-42", 50);
    const second = abVariantFor("campaign-1", "user-42", 50);
    expect(first).toBe(second);
    expect(["A", "B"]).toContain(first);
  });

  it("produces a roughly even split at 50 percent", () => {
    let a = 0;
    for (let i = 0; i < 2000; i++) {
      if (abVariantFor("campaign-1", `user-${i}`, 50) === "A") a += 1;
    }
    const share = a / 2000;
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.6);
  });

  it("still assigns both variants at an extreme split", () => {
    const variants = new Set(
      Array.from({ length: 500 }, (_, i) => abVariantFor("c", `u-${i}`, 90))
    );
    expect(variants.has("A")).toBe(true);
    expect(variants.has("B")).toBe(true);
  });
});

describe("A/B evaluation", () => {
  it("refuses to name a winner without enough recipients", () => {
    const result = evaluateAbTest(
      { targeted: 10, accepted: 10, delivered: 0, read: 4, failed: 0 },
      { targeted: 10, accepted: 10, delivered: 0, read: 1, failed: 0 }
    );
    expect(result.sufficient).toBe(false);
    expect(result.leading).toBeNull();
    expect(result.reason).toMatch(/at least 30/i);
  });

  it("suggests the variant with the clearly better read rate", () => {
    const result = evaluateAbTest(
      { targeted: 40, accepted: 40, delivered: 0, read: 16, failed: 0 },
      { targeted: 40, accepted: 40, delivered: 0, read: 4, failed: 0 }
    );
    expect(result.sufficient).toBe(true);
    expect(result.leading).toBe("A");
  });

  it("reports an inconclusive test when rates are close", () => {
    const result = evaluateAbTest(
      { targeted: 40, accepted: 40, delivered: 0, read: 10, failed: 0 },
      { targeted: 40, accepted: 40, delivered: 0, read: 11, failed: 0 }
    );
    expect(result.sufficient).toBe(true);
    expect(result.leading).toBeNull();
    expect(result.reason).toMatch(/inconclusive/i);
  });
});

describe("manual retry eligibility", () => {
  it("allows temporary provider failures", () => {
    expect(
      retryEligibility({
        channel: "email",
        status: "failed",
        attempts: 1,
        error: "Provider request failed (HTTP 503).",
      }).eligible
    ).toBe(true);
    expect(
      retryEligibility({
        channel: "whatsapp",
        status: "failed",
        attempts: 3,
        error: "Maximum delivery attempts reached.",
      }).eligible
    ).toBe(true);
  });

  it("never retries consent, configuration or address problems", () => {
    for (const error of [
      "Recipient opted out of email.",
      "Recipient unsubscribed.",
      "No email address on file.",
      "Customer has not opted in to WhatsApp.",
      "Email is not configured (set RESEND_API_KEY).",
      "Provider request failed (timeout). Not retried to avoid duplicates.",
      "Delivery attempt was interrupted. Not retried automatically to avoid sending twice.",
    ]) {
      expect(
        retryEligibility({ channel: "email", status: "failed", attempts: 1, error })
          .eligible
      ).toBe(false);
    }
  });

  it("does not offer built-in channels or non-failed rows", () => {
    expect(
      retryEligibility({ channel: "in_app", status: "failed", attempts: 1 }).eligible
    ).toBe(false);
    expect(
      retryEligibility({ channel: "email", status: "sent", attempts: 1 }).eligible
    ).toBe(false);
  });
});

describe("audience validation", () => {
  const base = {
    title: "Festive health reminder",
    body: "Book a free blood pressure check this week.",
    category: "health" as const,
    channels: { inApp: true, popup: false, whatsapp: false, email: false },
    audience: { type: "new_users" as const },
  };

  it("accepts the new and existing customer segments", () => {
    expect(validateCampaignInput(base).valid).toBe(true);
    expect(
      validateCampaignInput({ ...base, audience: { type: "existing_users" } }).valid
    ).toBe(true);
  });

  it("rejects an unknown audience", () => {
    const result = validateCampaignInput({
      ...base,
      audience: { type: "prescription_users" as any },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/valid audience/i);
  });
});
