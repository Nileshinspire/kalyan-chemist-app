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
  it("shows restock alerts and proactive refills on the dashboard", () => {
    renderDashboard();

    expect(screen.getByText("Your care tools")).toBeTruthy();
    expect(screen.getByText("Restock alerts")).toBeTruthy();
    expect(screen.getByText(/not waiting on any medicines/i)).toBeTruthy();

    expect(screen.getByText("Proactive Refill Reminders")).toBeTruthy();
    expect(screen.getByText("No refill suggestions yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: /open medicine refill/i })).toBeTruthy();
  });

  it("no longer offers a second dark mode control — that stays in the profile menu", () => {
    renderDashboard();

    expect(screen.queryByText("Appearance")).toBeNull();
    expect(screen.queryByRole("switch", { name: /dark mode/i })).toBeNull();
    expect(setTheme).not.toHaveBeenCalled();
  });

  it("keeps the existing dashboard sections in place", () => {
    renderDashboard();

    expect(screen.getByText("Wallet and refer")).toBeTruthy();
    expect(screen.getByText("Edit Profile")).toBeTruthy();
    expect(screen.getByText("View Orders")).toBeTruthy();
    expect(screen.getByText("Account Details")).toBeTruthy();
  });
});
