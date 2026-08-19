import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@/context/AuthContext";
import Wishlist from "@/pages/Wishlist";

vi.mock("convex/react");
vi.mock("@/context/AuthContext");

const mockUseQuery = vi.mocked(useQuery);
const mockUseMutation = vi.mocked(useMutation);
const mockUseAuth = vi.mocked(useAuth);

function renderWishlist() {
  return render(
    <MemoryRouter initialEntries={["/wishlist"]}>
      <Wishlist />
    </MemoryRouter>
  );
}

function mockWishlistItem(overrides: any = {}) {
  return {
    _id: `wl_${Math.random().toString(36).slice(2)}`,
    userId: "user_123",
    productId: "prod_1",
    product: {
      _id: "prod_1",
      name: "Paracetamol 500mg",
      slug: "paracetamol-500mg",
      sellingPrice: 50,
      mrp: 60,
      stockQuantity: 10,
      isActive: true,
      prescriptionRequired: false,
      manufacturer: "Cipla",
      price: 60,
      discountPrice: 50,
    },
    ...overrides,
  };
}

describe("Wishlist component", () => {
  const mockToggle = vi.fn();
  const mockMoveToCart = vi.fn();
  const mockAddToCart = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: true,
      isAdmin: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
    (mockUseMutation as any)
      .mockReturnValueOnce(mockToggle)
      .mockReturnValueOnce(mockMoveToCart)
      .mockReturnValueOnce(mockAddToCart);
  });

  it("shows not authenticated state when user is logged out", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      isAdmin: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
    mockUseQuery.mockReturnValue([]);
    renderWishlist();
    // The heading says "Sign In to View Wishlist"
    expect(screen.getByText("Sign In to View Wishlist")).toBeInTheDocument();
  });

  it("renders empty wishlist state", () => {
    mockUseQuery.mockReturnValue([]);
    renderWishlist();
    expect(screen.getByText("Your Wishlist is Empty")).toBeInTheDocument();
  });

  it("renders wishlist items", () => {
    mockUseQuery.mockReturnValue([mockWishlistItem()]);
    renderWishlist();
    expect(screen.getByText("Paracetamol 500mg")).toBeInTheDocument();
  });

  it("renders multiple wishlist items", () => {
    mockUseQuery.mockReturnValue([
      mockWishlistItem({ _id: "wl_1", productId: "prod_1", product: { _id: "prod_1", name: "Product A", sellingPrice: 100, mrp: 120, stockQuantity: 5, isActive: true, prescriptionRequired: false, slug: "a", price: 120, discountPrice: 100, manufacturer: "X" } }),
      mockWishlistItem({ _id: "wl_2", productId: "prod_2", product: { _id: "prod_2", name: "Product B", sellingPrice: 200, mrp: 250, stockQuantity: 3, isActive: true, prescriptionRequired: false, slug: "b", price: 250, discountPrice: 200, manufacturer: "Y" } }),
    ]);
    renderWishlist();
    expect(screen.getByText("Product A")).toBeInTheDocument();
    expect(screen.getByText("Product B")).toBeInTheDocument();
  });

  it("shows product prices", () => {
    mockUseQuery.mockReturnValue([
      mockWishlistItem({ product: { _id: "prod_1", name: "Drug", sellingPrice: 75, mrp: 100, stockQuantity: 5, isActive: true, prescriptionRequired: false, slug: "drug", price: 100, discountPrice: 75, manufacturer: "Z" } }),
    ]);
    renderWishlist();
    // Price should be rendered — search via text content
    const priceElements = screen.getAllByText((content) => /\d/.test(content) && content.includes("₹"));
    expect(priceElements.length).toBeGreaterThanOrEqual(1);
  });

  it("shows out of stock badge for zero-stock products", () => {
    mockUseQuery.mockReturnValue([
      mockWishlistItem({ product: { _id: "prod_1", name: "Drug", sellingPrice: 50, mrp: 60, stockQuantity: 0, isActive: true, prescriptionRequired: false, slug: "drug", price: 60, manufacturer: "X" } }),
    ]);
    renderWishlist();
    // "Out of Stock" appears in the status badge and in the button text
    const oosElements = screen.getAllByText("Out of Stock");
    expect(oosElements.length).toBeGreaterThanOrEqual(1);
  });

  it("shows Rx Required badge for prescription items", () => {
    mockUseQuery.mockReturnValue([
      mockWishlistItem({ product: { _id: "prod_1", name: "Rx Drug", sellingPrice: 100, mrp: 120, stockQuantity: 5, isActive: true, prescriptionRequired: true, slug: "rx", price: 120, discountPrice: 100, manufacturer: "X" } }),
    ]);
    renderWishlist();
    // Wishlist uses "Rx Required" badge text
    expect(screen.getByText(/Rx Required/)).toBeInTheDocument();
  });

  it("shows item count in header", () => {
    mockUseQuery.mockReturnValue([mockWishlistItem(), mockWishlistItem()]);
    renderWishlist();
    expect(screen.getByText(/2 item/i)).toBeInTheDocument();
  });

  it("shows Move to Cart button for in-stock items", () => {
    mockUseQuery.mockReturnValue([mockWishlistItem()]);
    renderWishlist();
    expect(screen.getByText("Move to Cart")).toBeInTheDocument();
  });

  it("shows loading state when data is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderWishlist();
    expect(document.querySelector(".animate-spin")).toBeTruthy();
  });
});
