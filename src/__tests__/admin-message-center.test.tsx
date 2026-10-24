import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

const { queryData, mutate } = vi.hoisted(() => ({
  queryData: new Map<unknown, unknown>(),
  mutate: vi.fn().mockResolvedValue({ campaignId: "c1", status: "scheduled" }),
}));

const fnName = (reference: any) => reference?.[Symbol.for("functionName")];

vi.mock("convex/react", () => ({
  useQuery: (query: unknown, args: unknown) =>
    args === "skip" ? undefined : queryData.get(fnName(query)),
  useMutation: () => mutate,
  useAction: () => vi.fn().mockResolvedValue({}),
}));

vi.mock("@/components/admin/AdminLayout", () => ({
  default: ({ children }: { children: any }) => (
    <div data-testid="admin-layout">{children}</div>
  ),
}));

import AdminMessageCenter from "@/pages/admin/AdminMessageCenter";

const now = Date.now();

beforeEach(() => {
  mutate.mockClear();
  queryData.clear();
  queryData.set("messageCenter:listCampaigns", [
    {
      _id: "c1",
      title: "Diwali wishes from Kalyan Chemist",
      category: "festival",
      categoryLabel: "Festival Wishes",
      status: "completed",
      channels: { inApp: true, popup: true, whatsapp: false, email: false },
      audienceType: "all",
      audienceSize: 42,
      scheduledAt: null,
      createdAt: now - 86_400_000,
      expiresAt: null,
      stats: {
        inAppSent: 40,
        inAppRead: 12,
        popupSent: 40,
        popupSeen: 9,
        whatsappQueued: 0,
        whatsappSent: 0,
        whatsappDelivered: 0,
        whatsappFailed: 0,
        emailQueued: 0,
        emailSent: 0,
        emailDelivered: 0,
        emailFailed: 0,
      },
      errorSummary: null,
    },
    {
      _id: "c2",
      title: "Store timing update",
      category: "announcement",
      categoryLabel: "Important Announcement",
      status: "draft",
      channels: { inApp: true, popup: false, whatsapp: false, email: false },
      audienceType: "with_orders",
      audienceSize: 0,
      scheduledAt: null,
      createdAt: now,
      expiresAt: null,
      stats: null,
      errorSummary: null,
    },
  ]);
  queryData.set("messageCenter:integrationStatus", {
    website: { configured: true },
    popup: { configured: true },
    email: {
      configured: false,
      credential: "RESEND_API_KEY",
      from: "Kalyan Chemist <notifications@kalyanchemist.com>",
      note: "Setup required: add RESEND_API_KEY and verify a sending domain in Resend.",
    },
    whatsapp: {
      configured: false,
      credentialsPresent: false,
      templateConfigured: false,
      templateName: null,
      templateLanguage: "en",
      note: "Setup required: WhatsApp Business Platform credentials and an approved campaign template are needed.",
    },
    checkedAt: now,
  });
  queryData.set("messageCenter:audienceCounts", {
    all: 42,
    withOrders: 18,
    noOrders: 24,
    categories: [{ _id: "cat1", name: "Pain Relief", buyers: 8 }],
  });
  queryData.set("messageCenter:previewAudience", {
    recipients: 42,
    estimated: 42,
    perChannel: [
      { channel: "inApp", eligible: 40, ineligible: 2 },
      { channel: "popup", eligible: 38, ineligible: 4 },
    ],
    reasonBreakdown: {},
    contactCoverage: { withEmail: 0, withPhone: 0 },
    missingConfig: [],
  });
  queryData.set("messageCenter:renderPreview", {
    html: "<p>Preview</p>",
    text: "Preview",
  });
  queryData.set("messageCenter:customerOptions", []);
  queryData.set("messageCampaigns:listTemplates", []);
  queryData.set("messageCampaigns:listCampaignAudit", []);
  queryData.set("messageCampaigns:sendTimeRecommendation", {
    sufficient: false,
    slots: [],
    sample: { campaigns: 0, deliveries: 0 },
    reason: "Not enough completed campaigns with read tracking yet.",
    timeZone: "Asia/Kolkata (IST)",
  });
  queryData.set("messageCampaigns:campaignSuggestions", {
    suggestions: [],
    audienceSize: 42,
    settings: {
      quietHoursEnabled: true,
      quietStartHour: 21,
      quietEndHour: 9,
      maxPromotionalPerWeek: 3,
    },
    timeZone: "Asia/Kolkata (IST)",
  });
  queryData.set("messageCampaigns:getMessagingSettings", {
    quietHoursEnabled: true,
    quietStartHour: 21,
    quietEndHour: 9,
    maxPromotionalPerWeek: 3,
    timeZone: "Asia/Kolkata (IST)",
    updatedAt: now,
  });
  queryData.set("messageCampaigns:compareCampaigns", {
    from: now - 30 * 86_400_000,
    to: now,
    campaigns: [],
    aggregate: {
      targeted: 0,
      attempted: 0,
      queued: 0,
      accepted: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      skipped: 0,
      reached: 0,
      failureRate: null,
      readRate: null,
    },
    channels: [],
    readTrackingAvailable: false,
    unavailable: { opens: "Not tracked.", clicks: "Not tracked.", conversions: "Not tracked." },
    optOuts: { count: 0, note: "Account-level." },
    timeZone: "Asia/Kolkata (IST)",
  });
});

describe("Admin Message Center", () => {
  it("renders campaigns and honest channel readiness", () => {
    render(<AdminMessageCenter />);

    expect(
      screen.getByRole("heading", { name: /message center/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Diwali wishes from Kalyan Chemist")).toBeInTheDocument();
    expect(screen.getByText("Store timing update")).toBeInTheDocument();
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);

    expect(screen.getByText("Website notifications")).toBeInTheDocument();
    expect(screen.getAllByText(/setup required/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/add resend_api_key/i)).toBeInTheDocument();
  });

  it("opens the composer, previews the audience and requires confirmation", () => {
    render(<AdminMessageCenter />);

    fireEvent.click(screen.getByRole("button", { name: /new message/i }));

    const title = screen.getByLabelText(/message title/i);
    fireEvent.change(title, {
      target: { value: "Health awareness week" },
    });
    fireEvent.change(screen.getByLabelText(/message body/i), {
      target: { value: "Book a free blood pressure check this week." },
    });

    expect(screen.getByText("Audience & delivery")).toBeInTheDocument();
    expect(screen.getByText("Eligible customers")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /review & send/i }));

    const dialogs = screen.getAllByRole("dialog");
    const dialog = dialogs[dialogs.length - 1];
    expect(within(dialog).getByText(/send this campaign/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/customers in audience/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /confirm & send/i })).toBeEnabled();

    // No mutation may happen until the administrator confirms.
    expect(mutate).not.toHaveBeenCalled();
  });

  it("blocks sending when a selected channel needs setup", () => {
    const preview = queryData.get("messageCenter:previewAudience") as any;
    queryData.set("messageCenter:previewAudience", {
      ...preview,
      missingConfig: ["Email: add RESEND_API_KEY (and verify the sending domain)."],
    });

    render(<AdminMessageCenter />);
    fireEvent.click(screen.getByRole("button", { name: /new message/i }));
    fireEvent.change(screen.getByLabelText(/message title/i), {
      target: { value: "Festival offer" },
    });
    fireEvent.change(screen.getByLabelText(/message body/i), {
      target: { value: "A message that would use email." },
    });
    fireEvent.click(screen.getByRole("switch", { name: /enable email/i }));
    fireEvent.click(screen.getByRole("button", { name: /review & send/i }));

    const dialogs = screen.getAllByRole("dialog");
    const dialog = dialogs[dialogs.length - 1];
    expect(within(dialog).getByText(/setup required/i)).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: /confirm & send/i })
    ).toBeDisabled();
  });

  it("renders the calendar, analytics, templates, audit and policy tabs", () => {
    render(<AdminMessageCenter />);

    // Radix tabs activate on mouse down, which is what a real click sends.
    const openTab = (name: RegExp) => {
      fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });
    };

    openTab(/calendar/i);
    expect(screen.getByText("Next scheduled executions")).toBeInTheDocument();

    openTab(/analytics/i);
    expect(screen.getByText("Campaign performance")).toBeInTheDocument();
    expect(screen.getByText("Campaign comparison")).toBeInTheDocument();

    openTab(/templates/i);
    expect(screen.getByText("Template library")).toBeInTheDocument();

    openTab(/audit/i);
    expect(screen.getByText("Campaign audit trail")).toBeInTheDocument();

    openTab(/settings/i);
    expect(screen.getByText("Messaging policy")).toBeInTheDocument();
    expect(screen.getByLabelText(/maximum campaigns per customer/i)).toBeInTheDocument();
  });

  it("supports A/B variations and blocks sending until variant B is valid", () => {
    render(<AdminMessageCenter />);
    fireEvent.click(screen.getByRole("button", { name: /new message/i }));

    fireEvent.change(screen.getByLabelText(/message title/i), {
      target: { value: "Festive offer" },
    });
    fireEvent.change(screen.getByLabelText(/message body/i), {
      target: { value: "Save 20% on all health essentials this week." },
    });

    const review = screen.getByRole("button", { name: /review & send/i });
    expect(review).toBeEnabled();

    fireEvent.click(screen.getByRole("switch", { name: /enable a\/b test/i }));
    expect(screen.getByLabelText(/variant b title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/variant b message/i)).toBeInTheDocument();
    expect(screen.getByText(/split — variant a 50% \/ variant b 50%/i)).toBeInTheDocument();
    expect(review).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/variant b title/i), {
      target: { value: "A festive thank-you" },
    });
    fireEvent.change(screen.getByLabelText(/variant b message/i), {
      target: { value: "Wishing you a healthy festive season from our family." },
    });
    expect(review).toBeEnabled();
  });

  it("treats the built-in email gateway as ready without extra setup", () => {
    const status = queryData.get("messageCenter:integrationStatus") as any;
    queryData.set("messageCenter:integrationStatus", {
      ...status,
      email: {
        configured: true,
        credential: "VLY_INTEGRATION_KEY",
        viaResend: false,
        viaGateway: true,
        from: "Managed by the email gateway",
        note: "Sending through the built-in email gateway — no further setup required.",
      },
    });

    render(<AdminMessageCenter />);
    expect(screen.getByText(/built-in email gateway/i)).toBeInTheDocument();
    expect(screen.queryByText(/add RESEND_API_KEY/i)).not.toBeInTheDocument();

    // Enabling email must not raise a setup block when the gateway is ready.
    fireEvent.click(screen.getByRole("button", { name: /new message/i }));
    fireEvent.change(screen.getByLabelText(/message title/i), {
      target: { value: "Festival offer" },
    });
    fireEvent.change(screen.getByLabelText(/message body/i), {
      target: { value: "A message that would use email." },
    });
    fireEvent.click(screen.getByRole("switch", { name: /enable email/i }));
    fireEvent.click(screen.getByRole("button", { name: /review & send/i }));

    const dialogs = screen.getAllByRole("dialog");
    const dialog = dialogs[dialogs.length - 1];
    expect(
      within(dialog).queryByText(/setup required/i)
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: /confirm & send/i })
    ).toBeEnabled();
  });
});
