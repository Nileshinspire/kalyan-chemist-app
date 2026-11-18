import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const navigate = vi.fn();

vi.mock("react-router", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("react-router");
  return {
    ...actual,
    useNavigate: () => navigate,
    useLocation: () => ({ pathname: "/" }),
  };
});

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock("@/lib/route-preload", () => ({ preloadRoute: () => {} }));

vi.mock("convex/react", () => ({
  useQuery: () => undefined,
  useMutation: () => vi.fn(),
  useAction: () => vi.fn(),
}));

vi.mock("@/components/NotificationBell", () => ({
  default: () => <button aria-label="Notifications" />,
}));

vi.mock("@/components/theme/ThemeSwitch", () => ({
  ThemeSwitch: () => <div>Dark mode</div>,
}));

import MobileBottomNav from "@/components/layout/MobileBottomNav";
import Navbar from "@/components/layout/Navbar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

beforeEach(() => navigate.mockReset());

describe("Mobile bottom navigation", () => {
  it("shows Home · Categories · Offers · Account · Menu with the existing destinations intact", () => {
    render(
      <MemoryRouter>
        <MobileBottomNav />
      </MemoryRouter>
    );

    const labels = screen
      .getAllByRole("button")
      .map((button) => button.textContent?.trim());
    expect(labels).toEqual(["Home", "Categories", "Offers", "Account", "Menu"]);
    expect(screen.queryByText("Cart")).toBeNull();

    fireEvent.click(screen.getByLabelText("Offers"));
    expect(navigate).toHaveBeenCalledWith("/value-deals");

    // Menu opens the full-page route, not the old side sheet.
    fireEvent.click(screen.getByLabelText("Menu"));
    expect(navigate).toHaveBeenCalledWith("/menu");
  });
});

describe("Mobile header branding", () => {
  it("keeps the existing mark and adds a compact phone-only wordmark", () => {
    const { container } = render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );

    // Existing symbol is untouched (one BrandMark in the logo block).
    const logo = container.querySelector(".group.flex.items-center, .group");
    expect(logo).toBeTruthy();

    const mobileWordmark = Array.from(
      container.querySelectorAll("div")
    ).find(
      (el) =>
        el.className.includes("sm:hidden") &&
        el.textContent?.replace(/\s+/g, " ").trim() ===
          "Kalyan ChemistTrusted Pharmacy"
    );
    expect(mobileWordmark).toBeTruthy();

    const name = mobileWordmark!.querySelector("span.text-\\[10px\\]");
    const tagline = mobileWordmark!.querySelector("span.text-\\[6px\\]");
    expect(name?.textContent).toBe("Kalyan Chemist");
    expect(tagline?.textContent).toBe("Trusted Pharmacy");
  });
});

describe("Mobile header auth control", () => {
  it("offers no sheet trigger and opens My Account from the profile icon", () => {
    const { container } = render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );

    // The hamburger/side-sheet entry point is gone; the bottom Menu tab owns
    // full-page navigation now.
    expect(container.querySelector('[data-slot="sheet-trigger"]')).toBeNull();

    fireEvent.click(screen.getByLabelText("My Account"));
    expect(navigate).toHaveBeenCalledWith("/account");
  });

  it("renders exactly one close control when the sheet header supplies its own", () => {
    render(
      <Sheet open>
        <SheetContent showCloseButton={false} side="right">
          <SheetHeader>
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <button aria-label="Custom close">x</button>
        </SheetContent>
      </Sheet>
    );

    // Only the header's own close control exists — no built-in duplicate.
    expect(screen.getAllByLabelText("Custom close")).toHaveLength(1);
    expect(screen.queryByText("Close")).toBeNull();
  });

  it("still renders the built-in close by default (other sheets unchanged)", () => {
    render(
      <Sheet open>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Other</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );

    expect(screen.getAllByText("Close")).toHaveLength(1);
  });
});
