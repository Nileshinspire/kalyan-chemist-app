import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const { queryData, mutationRegistry, markSeen, dismiss } = vi.hoisted(() => ({
  queryData: new Map<unknown, unknown>(),
  mutationRegistry: new Map<unknown, unknown>(),
  markSeen: vi.fn().mockResolvedValue({ success: true }),
  dismiss: vi.fn().mockResolvedValue({ success: true }),
}));

const fnName = (reference: any) => reference?.[Symbol.for("functionName")];

vi.mock("convex/react", () => ({
  useQuery: (query: unknown, args: unknown) =>
    args === "skip" ? undefined : queryData.get(fnName(query)),
  useMutation: (mutation: unknown) => mutationRegistry.get(fnName(mutation)) ?? vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    isAuthenticated: true,
    isAuthLoading: false,
    isAdmin: false,
    user: { _id: "u1", role: "customer" },
  }),
}));

import LoginMessagePopup from "@/components/LoginMessagePopup";

const campaign = {
  campaignId: "campaign1",
  title: "Festive health check week",
  body: "Book a free blood pressure check at Kalyan Chemist this week.",
  category: "health",
  imageUrl: null,
  expiresAt: Date.now() + 86_400_000,
  seen: false,
};

beforeEach(() => {
  sessionStorage.clear();
  markSeen.mockClear();
  dismiss.mockClear();
  queryData.clear();
  mutationRegistry.clear();
  mutationRegistry.set("messageCenter:markPopupSeen", markSeen);
  mutationRegistry.set("messageCenter:dismissPopup", dismiss);
  queryData.set("messageCenter:activePopup", campaign);
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LoginMessagePopup />
    </MemoryRouter>
  );
}

describe("LoginMessagePopup", () => {
  it("shows an eligible campaign, records seen state and dismisses it", async () => {
    renderAt("/account");

    const title = await screen.findByText("Festive health check week", {}, { timeout: 2500 });
    expect(title).toBeInTheDocument();
    expect(markSeen).toHaveBeenCalledWith({ campaignId: "campaign1" });

    fireEvent.click(screen.getByRole("button", { name: /got it/i }));
    await waitFor(() => expect(dismiss).toHaveBeenCalledWith({ campaignId: "campaign1" }));
  });

  it("does not open on checkout or other critical flows", async () => {
    renderAt("/checkout");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });
    expect(screen.queryByText("Festive health check week")).not.toBeInTheDocument();
    expect(markSeen).not.toHaveBeenCalled();
  });

  it("does not show the same campaign twice in one browser session", async () => {
    sessionStorage.setItem("kc_popup_campaign1", "1");
    renderAt("/account");

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
    });
    expect(screen.queryByText("Festive health check week")).not.toBeInTheDocument();
  });
});
