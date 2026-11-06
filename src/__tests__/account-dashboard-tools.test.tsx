import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
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
  it("shows dark mode, restock alerts and proactive refills on the dashboard", () => {
    renderDashboard();

    expect(screen.getByText("Your care tools")).toBeTruthy();
    expect(screen.getByText("Appearance")).toBeTruthy();
    expect(screen.getByRole("switch", { name: /dark mode/i })).toBeTruthy();

    expect(screen.getByText("Restock alerts")).toBeTruthy();
    expect(screen.getByText(/not waiting on any medicines/i)).toBeTruthy();

    expect(screen.getByText("Proactive Refill Reminders")).toBeTruthy();
    expect(screen.getByText("No refill suggestions yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: /open medicine refill/i })).toBeTruthy();
  });

  it("switches the theme straight from the dashboard", async () => {
    renderDashboard();

    await act(async () => {
      fireEvent.click(screen.getByRole("switch", { name: /dark mode/i }));
    });

    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("keeps the existing dashboard sections in place", () => {
    renderDashboard();

    expect(screen.getByText("Wallet and refer")).toBeTruthy();
    expect(screen.getByText("Edit Profile")).toBeTruthy();
    expect(screen.getByText("View Orders")).toBeTruthy();
    expect(screen.getByText("Account Details")).toBeTruthy();
  });
});
