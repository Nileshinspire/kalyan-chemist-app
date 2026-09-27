import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { useQuery } from "convex/react";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/layout/Navbar";

vi.mock("convex/react");
vi.mock("@/context/AuthContext");

const mockUseQuery = vi.mocked(useQuery);
const mockUseAuth = vi.mocked(useAuth);

function renderNavbar() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Navbar />
    </MemoryRouter>
  );
}

function badgeNodes(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[aria-hidden="true"][class*="E53935"]')
  );
}

describe("Navbar cart-count badge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      isAuthLoading: false,
      isLoading: false,
      isAuthenticated: false,
      isAdmin: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
  });

  it("hides the badge while the cart query is still loading", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderNavbar();
    expect(badgeNodes()).toHaveLength(0);
  });

  it("hides the badge (never shows 0) when the cart is empty", () => {
    mockUseQuery.mockReturnValue(0);
    renderNavbar();
    expect(badgeNodes()).toHaveLength(0);
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("shows the total quantity when the cart has items", () => {
    mockUseQuery.mockReturnValue(5);
    renderNavbar();
    const badges = badgeNodes();
    expect(badges.length).toBeGreaterThan(0);
    badges.forEach((badge) => expect(badge.textContent).toBe("5"));
  });

  it("caps the displayed count at 99+", () => {
    mockUseQuery.mockReturnValue(120);
    renderNavbar();
    const badges = badgeNodes();
    expect(badges.length).toBeGreaterThan(0);
    badges.forEach((badge) => expect(badge.textContent).toBe("99+"));
  });

  it("places the badge at the top-right of the cart icon", () => {
    mockUseQuery.mockReturnValue(2);
    renderNavbar();
    const badge = badgeNodes()[0];
    expect(badge).toBeDefined();
    expect(badge.className).toContain("absolute");
    expect(badge.className).toContain("-top-[6px]");
    expect(badge.className).toContain("-right-[6px]");
  });

  it("renders a compact badge that does not cover the cart icon", () => {
    mockUseQuery.mockReturnValue(1);
    renderNavbar();
    const badge = badgeNodes()[0];
    expect(badge).toBeDefined();
    // Compact e-commerce notification sizing: 16px box, 16px min width,
    // no padding, fully rounded, small semibold text on the #E53935 red.
    expect(badge.className).toContain("h-4");
    expect(badge.className).toContain("min-w-4");
    expect(badge.className).toContain("p-0");
    expect(badge.className).toContain("rounded-full");
    expect(badge.className).toContain("text-[9.5px]");
    expect(badge.className).toContain("font-semibold");
    expect(badge.className).toContain("leading-none");
    expect(badge.className).toContain("bg-[#E53935]");
    expect(badge.className).toContain("text-white");
  });
});
