import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { useQuery, useMutation } from "convex/react";
import AdminDiscountManager from "@/pages/admin/AdminDiscountManager";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
  useConvex: vi.fn(() => ({ prewarmQuery: vi.fn() })),
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    user: { _id: "u1", name: "Admin", email: "a@b.c", role: "admin" },
    isLoading: false,
    isAuthenticated: true,
    isAdmin: true,
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockUseQuery = vi.mocked(useQuery);

/** The page reads the config first, then the product catalogue. */
const config = {
  configured: true,
  discountPercent: 37,
  manualProductIds: ["p3"],
  updatedAt: 1_700_000_000_000,
  matchCount: 1,
  autoCount: 1,
  manualCount: 0,
  droppedManualIds: [],
};

const catalogue = [
  {
    _id: "p1",
    name: "At 37 percent",
    price: 100,
    discountPrice: 63,
    isActive: true,
    manufacturer: "Cipla",
    categoryName: "Wellness",
  },
  {
    _id: "p2",
    name: "At 25 percent",
    price: 100,
    discountPrice: 75,
    isActive: true,
    manufacturer: "Cipla",
    categoryName: "Wellness",
  },
  {
    _id: "p3",
    name: "Picked by admin",
    price: 200,
    discountPrice: 100, // 50% — picked, but no longer matches 37%
    isActive: true,
    manufacturer: "Cipla",
    categoryName: "Wellness",
  },
  {
    _id: "p4",
    name: "No discount",
    price: 50,
    isActive: true,
    manufacturer: "Cipla",
    categoryName: "Wellness",
  },
];

function renderPage() {
  let call = 0;
  mockUseQuery.mockImplementation((() => (++call === 1 ? config : catalogue)) as never);
  return render(
    <MemoryRouter>
      <AdminDiscountManager />
    </MemoryRouter>,
  );
}

describe("AdminDiscountManager", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads the saved percentage into the input and the heading", () => {
    renderPage();
    expect(screen.getByText("Exact Discount Deals")).toBeInTheDocument();
    expect(screen.getByDisplayValue("37")).toBeInTheDocument();
    expect(screen.getByText(/Minimum 37% Off/)).toBeInTheDocument();
  });

  it("previews exactly the products whose own discount is the configured one", () => {
    renderPage();
    // The picker lists the whole catalogue on purpose; it is the preview card that
    // must hold only the exact matches.
    const preview = screen
      .getByText(/Products at exactly/)
      .closest('[data-slot="card"]') as HTMLElement;
    expect(preview).not.toBeNull();
    expect(within(preview).getByText("1 product will show")).toBeInTheDocument();
    expect(within(preview).getByText("At 37 percent")).toBeInTheDocument();
    // One product really is at 37%; the 25%, 50% and undiscounted ones are not.
    expect(within(preview).queryByText("At 25 percent")).not.toBeInTheDocument();
    expect(within(preview).queryByText("No discount")).not.toBeInTheDocument();
    expect(within(preview).queryByText("Picked by admin")).not.toBeInTheDocument();
  });

  it("shows a selected product as hidden when its real discount no longer matches", () => {
    renderPage();
    // "Picked by admin" is 50% off while the section advertises 37%, so it is
    // listed as hidden (in the chip and in the picker row) rather than counted.
    expect(screen.getAllByText(/50% off/).length).toBeGreaterThan(0);
    expect(screen.getByText(/1 of your selected product is hidden/)).toBeInTheDocument();
    expect(screen.getByText("Hidden at 37%")).toBeInTheDocument();
  });

  it("marks the matching product as qualifying in the picker", () => {
    renderPage();
    expect(screen.getByText("37% off")).toBeInTheDocument();
  });
});
