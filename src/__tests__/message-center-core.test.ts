import { describe, expect, it } from "vitest";
import {
  buildCampaignEmailHtml,
  campaignOutcome,
  channelEligibility,
  isAdminRole,
  isRegisteredCustomer,
  isValidEmail,
  maskEmail,
  maskPhone,
  normalizePhone,
  statusLabel,
  validateCampaignInput,
  whatsappTemplateParams,
} from "@/convex/messageCenterCore";

const NOW = new Date("2026-10-20T10:00:00Z").getTime();

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Diwali wishes",
    body: "Warm wishes from the Kalyan Chemist family.",
    category: "festival" as const,
    channels: { inApp: true, popup: false, whatsapp: false, email: false },
    audience: { type: "all" as const },
    ...overrides,
  };
}

describe("campaign validation", () => {
  it("accepts a valid website notification", () => {
    const result = validateCampaignInput(baseInput(), NOW);
    expect(result.valid).toBe(true);
    expect(result.normalized.title).toBe("Diwali wishes");
  });

  it("trims copy and collapses CRLF line endings", () => {
    const result = validateCampaignInput(
      baseInput({ title: "  Health tip  ", body: "Line one\r\nLine two" }),
      NOW
    );
    expect(result.normalized.title).toBe("Health tip");
    expect(result.normalized.body).toBe("Line one\nLine two");
  });

  it("requires at least one channel", () => {
    const result = validateCampaignInput(
      baseInput({
        channels: { inApp: false, popup: false, whatsapp: false, email: false },
      }),
      NOW
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/at least one delivery channel/i);
  });

  it("requires at least one customer for a selected audience", () => {
    const result = validateCampaignInput(
      baseInput({ audience: { type: "selected", userIds: [] } }),
      NOW
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/at least one customer/i);
  });

  it("requires a category for category buyers", () => {
    const result = validateCampaignInput(
      baseInput({ audience: { type: "category_buyers" } }),
      NOW
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/category/i);
  });

  it("rejects a schedule in the past", () => {
    const result = validateCampaignInput(
      baseInput({ scheduledAt: NOW - 5 * 60_000 }),
      NOW
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/future/i);
  });

  it("rejects an expiry before the send time", () => {
    const result = validateCampaignInput(
      baseInput({
        scheduledAt: NOW + 60 * 60_000,
        expiresAt: NOW + 30 * 60_000,
      }),
      NOW
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/after the scheduled send time/i);
  });

  it("rejects an expiry that is already in the past", () => {
    const result = validateCampaignInput(
      baseInput({ expiresAt: NOW - 1 }),
      NOW
    );
    expect(result.valid).toBe(false);
  });

  it("rejects non-http image URLs", () => {
    const result = validateCampaignInput(
      baseInput({ imageUrl: "javascript:alert(1)" }),
      NOW
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/http/i);
  });

  it("rejects control characters in the message", () => {
    const result = validateCampaignInput(
      baseInput({ body: "Hello\u0007world, this should fail" }),
      NOW
    );
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/control characters/i);
  });

  it("enforces length limits", () => {
    const result = validateCampaignInput(
      baseInput({ title: "x".repeat(121), body: "y".repeat(2001) }),
      NOW
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });
});

describe("channel eligibility", () => {
  const verifiedCustomer = {
    email: "priya@example.com",
    phone: "9876543210",
    phoneVerified: true,
    whatsappOptIn: true,
  };

  it("allows channels with valid contact details and consent", () => {
    const result = channelEligibility(verifiedCustomer, null);
    expect(result).toMatchObject({
      inApp: true,
      popup: true,
      email: true,
      whatsapp: true,
    });
  });

  it("never allows WhatsApp without opt-in", () => {
    const result = channelEligibility(
      { ...verifiedCustomer, whatsappOptIn: false },
      null
    );
    expect(result.whatsapp).toBe(false);
    expect(result.reasons.whatsapp).toMatch(/opted in/i);
  });

  it("respects explicit channel preferences", () => {
    const result = channelEligibility(verifiedCustomer, {
      inApp: false,
      popup: false,
      email: false,
      whatsapp: false,
    });
    expect(result.inApp).toBe(false);
    expect(result.popup).toBe(false);
    expect(result.email).toBe(false);
    expect(result.whatsapp).toBe(false);
  });

  it("blocks promotional email after unsubscribe", () => {
    const result = channelEligibility(verifiedCustomer, {
      email: true,
      promotional: false,
      unsubscribedAt: NOW,
    });
    expect(result.email).toBe(false);
  });

  it("blocks email for invalid addresses", () => {
    const result = channelEligibility(
      { email: "not-an-email", phone: "123" },
      null
    );
    expect(result.email).toBe(false);
    expect(result.whatsapp).toBe(false);
  });

  it("authorises only the admin role", () => {
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("customer")).toBe(false);
    expect(isAdminRole(undefined)).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });

  it("does not treat admin accounts as recipients", () => {
    expect(isRegisteredCustomer({ role: "admin" })).toBe(false);
    expect(isRegisteredCustomer({ role: "customer" })).toBe(true);
    expect(isRegisteredCustomer({ isAnonymous: true })).toBe(false);
  });
});

describe("contact normalisation and masking", () => {
  it("normalises Indian numbers", () => {
    expect(normalizePhone("98765 43210")).toBe("919876543210");
    expect(normalizePhone("+91 98765 43210")).toBe("919876543210");
    expect(normalizePhone("09876543210")).toBe("919876543210");
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });

  it("validates email shape", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
  });

  it("masks contact details for admin screens", () => {
    expect(maskEmail("priya@example.com")).toBe("pr•••@example.com");
    expect(maskEmail("not-an-email")).toBe("—");
    expect(maskPhone("9876543210")).toBe("••••••3210");
  });
});

describe("campaign outcome", () => {
  const empty = {
    queued: 0,
    sending: 0,
    sent: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    skipped: 0,
  };

  it("is completed when nothing failed", () => {
    expect(campaignOutcome({ ...empty, sent: 10, skipped: 2 })).toBe("completed");
  });

  it("is partially failed when some succeeded and some failed", () => {
    expect(campaignOutcome({ ...empty, sent: 8, failed: 2 })).toBe(
      "partially_failed"
    );
  });

  it("is failed when every attempt failed", () => {
    expect(campaignOutcome({ ...empty, failed: 5 })).toBe("failed");
  });

  it("labels statuses for the admin UI", () => {
    expect(statusLabel("partially_failed")).toBe("Partially Failed");
    expect(statusLabel("scheduled")).toBe("Scheduled");
  });
});

describe("email rendering", () => {
  it("escapes customer-visible copy and the image URL", () => {
    const html = buildCampaignEmailHtml({
      title: "<script>alert(1)</script>",
      body: "Hello <b>there</b> & welcome",
      category: "offer",
      imageUrl: 'https://example.com/a.png" onerror="alert(1)',
      unsubscribeUrl: "https://kalyanchemist.com/#/unsubscribe?token=abc",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp; welcome");
    expect(html).not.toContain('onerror="alert(1)"');
    expect(html).toContain("unsubscribe?token=abc");
    expect(html).toContain("Kalyan Chemist");
  });

  it("omits the image block when no image is provided", () => {
    const html = buildCampaignEmailHtml({
      title: "Health tip",
      body: "Stay hydrated",
      category: "health",
      unsubscribeUrl: "https://kalyanchemist.com/#/unsubscribe?token=abc",
    });
    expect(html).not.toContain("<img");
  });
});

describe("WhatsApp template parameters", () => {
  it("flattens newlines and bounds length", () => {
    const [title, body] = whatsappTemplateParams(
      "Festival\nwishes",
      "Line one\nLine two\tend"
    );
    expect(title).toBe("Festival wishes");
    expect(body).toBe("Line one Line two end");
    expect(whatsappTemplateParams("x".repeat(400), "y".repeat(2000))[0].length).toBe(120);
    expect(whatsappTemplateParams("x", "y".repeat(2000))[1].length).toBe(900);
  });
});
