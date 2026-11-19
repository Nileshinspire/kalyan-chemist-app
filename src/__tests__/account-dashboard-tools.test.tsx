import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const { setTheme } = vi.hoisted(() => ({ setTheme: vi.fn() }));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme }),
}));

vi.mock("convex/react", () => ({
  useQuery: () => [],
  useMutation: () => vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { name: "Asha", email: "asha@example.com" }, isAuthenticated: true }),
}));

vi.mock("@/components/account/WalletReferSection", () => ({
  default: () => <div>Wallet and refer</div>,
}));

import AccountOverview from "@/pages/account/AccountOverview";

function renderDashboard() {
  return render(
    <MemoryRouter>
      <AccountOverview />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  setTheme.mockClear();
});

describe("customer dashboard care tools", () => {
  it("shows restock alerts but leaves refill reminders to the Medicine Refill page", () => {
    renderDashboard();

    expect(screen.getByText("Your care tools")).toBeTruthy();
    expect(screen.getByText("Restock alerts")).toBeTruthy();
    expect(screen.getByText(/not waiting on any medicines/i)).toBeTruthy();

    // Proactive refill reminders appear only on the Medicine Refill page.
    expect(screen.queryByText("Proactive Refill Reminders")).toBeNull();
    expect(screen.queryByRole("button", { name: /open medicine refill/i })).toBeNull();
  });

  it("no longer offers a second dark mode control — that stays in the profile menu", () => {
    renderDashboard();

    expect(screen.queryByText("Appearance")).toBeNull();
    expect(screen.queryByRole("switch", { name: /dark mode/i })).toBeNull();
    expect(setTheme).not.toHaveBeenCalled();
  });

  it("lists all account options above Wallet & Refer", () => {
    renderDashboard();

    const options = [
      "Profile",
      "Addresses",
      "My Orders",
      "Track Order",
      "My Prescriptions",
      "My Lab Tests",
      "My Appointments",
      "Medicine Refill",
      "Pill Reminders",
      "My Coupons",
      "Wishlist",
      "Notifications",
      "Help & Support",
      "Logout",
    ];
    // Mobile options render before the (desktop-only) quick links, so the
    // first match for each label is the option card in the new list.
    const nodes = options.map((label) => screen.getAllByText(label)[0]);
    expect(nodes).toHaveLength(14);

    const wallet = screen.getByText("Wallet and refer");
    // Every option sits above the untouched Wallet & Refer section.
    for (const node of nodes) {
      expect(
        node.compareDocumentPosition(wallet) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("keeps the existing dashboard sections in place", () => {
    renderDashboard();

    expect(screen.getByText("Wallet and refer")).toBeTruthy();
    expect(screen.getByText("Edit Profile")).toBeTruthy();
    expect(screen.getByText("View Orders")).toBeTruthy();
    expect(screen.getByText("Account Details")).toBeTruthy();
  });
});
