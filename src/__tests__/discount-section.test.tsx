import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { useQuery } from "convex/react";
import MinimumDiscount from "@/components/MinimumDiscount";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
  useConvex: vi.fn(() => ({ prewarmQuery: vi.fn() })),
}));
vi.mock("@/lib/product-transition", () => ({ beginProductTransition: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(() => ({ user: null, isLoading: false, isAuthenticated: false, isAdmin: false })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockUseQuery = vi.mocked(useQuery);

const product = {
  _id: "prod_1",
  name: "Lacto Calamine Sunscreen",
  slug: "lacto-calamine-sunscreen",
  price: 400,
  discountPrice: 200,
  manufacturer: "Piramal",
  packSize: "1 tube",
  prescriptionRequired: false,
  stockQuantity: 12,
  isActive: true,
  imageUrl: "https://example.convex.cloud/api/storage/abc",
};

function renderSection(section: unknown) {
  // The section's own query is the first `useQuery` in the tree, and the same
  // payload satisfies the card's wishlist lookup (a truthy value simply means
  // "saved"), so one return value covers the whole subtree.
  mockUseQuery.mockReturnValue(section as never);
  return render(
    <MemoryRouter>
      <MinimumDiscount />
    </MemoryRouter>,
  );
}

describe("MinimumDiscount section", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders nothing until the configuration is loaded", () => {
    const { container } = renderSection(undefined);
    expect(container.textContent).toBe("");
  });

  it("reflects the configured percentage in the heading", () => {
    renderSection({ configured: true, discountPercent: 37, products: [], autoCount: 0, manualCount: 0 });
    expect(screen.getByText("Minimum 37% Off")).toBeInTheDocument();
    expect(screen.getByText(/at least 37% below its MRP/)).toBeInTheDocument();
  });

  it("renders nothing when no admin has configured a rule", () => {
    const { container } = renderSection({ configured: false, discountPercent: 0, products: [], autoCount: 0, manualCount: 0 });
    expect(container.textContent).toBe("");
  });

  it("shows a clean empty state instead of unrelated products", () => {
    renderSection({ configured: true, discountPercent: 50, products: [], autoCount: 0, manualCount: 0 });
    expect(
      screen.getByText("No products are at 50% off or better right now."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Add to Cart")).not.toBeInTheDocument();
  });

  it("renders the matching products with the shared product card", () => {
    renderSection({
      configured: true,
      discountPercent: 50,
      products: [product],
      autoCount: 1,
      manualCount: 0,
    });
    expect(screen.getByText("Lacto Calamine Sunscreen")).toBeInTheDocument();
    expect(screen.getByText("Add to Cart")).toBeInTheDocument();
    expect(screen.getByText("50% OFF")).toBeInTheDocument();
    expect(screen.queryByText(/No products are at/)).not.toBeInTheDocument();
  });

  it("follows a changed percentage without a code change", () => {
    renderSection({
      configured: true,
      discountPercent: 63,
      products: [],
      autoCount: 0,
      manualCount: 0,
    });
    expect(screen.getByText("Minimum 63% Off")).toBeInTheDocument();
  });
});
