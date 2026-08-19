import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@/context/AuthContext";
import Cart from "@/pages/Cart";

vi.mock("convex/react");
vi.mock("@/context/AuthContext");

const mockUseQuery = vi.mocked(useQuery);
const mockUseMutation = vi.mocked(useMutation);
const mockUseAuth = vi.mocked(useAuth);

function renderCart() {
  return render(
    <MemoryRouter initialEntries={["/cart"]}>
      <Cart />
    </MemoryRouter>
  );
}

function mockCartItem(overrides: any = {}) {
  return {
    _id: `cart_${Math.random().toString(36).slice(2)}`,
    userId: "user_123",
    productId: "prod_1",
    quantity: 1,
    product: {
      _id: "prod_1",
      name: "Paracetamol 500mg",
      slug: "paracetamol-500mg",
      sellingPrice: 50,
      mrp: 60,
      stockQuantity: 10,
      isActive: true,
      prescriptionRequired: false,
    },
    ...overrides,
  };
}

describe("Cart component", () => {
  const mockUpdateQuantity = vi.fn();
  const mockRemoveItem = vi.fn();
  const mockClearCart = vi.fn();

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
      .mockReturnValueOnce(mockUpdateQuantity)
      .mockReturnValueOnce(mockRemoveItem)
      .mockReturnValueOnce(mockClearCart);
  });

  it("renders empty cart state when no items", () => {
    mockUseQuery.mockReturnValue([]);
    renderCart();
    expect(screen.getByText(/your cart is empty/i)).toBeInTheDocument();
  });

  it("renders cart items when items exist", () => {
    mockUseQuery.mockReturnValue([mockCartItem()]);
    renderCart();
    expect(screen.getByText("Paracetamol 500mg")).toBeInTheDocument();
  });

  it("renders multiple cart items", () => {
    const items = [
      mockCartItem({ _id: "cart_1", product: { _id: "prod_1", name: "Product A", sellingPrice: 100, mrp: 120, stockQuantity: 10, isActive: true, prescriptionRequired: false, slug: "a" } }),
      mockCartItem({ _id: "cart_2", product: { _id: "prod_2", name: "Product B", sellingPrice: 200, mrp: 250, stockQuantity: 5, isActive: true, prescriptionRequired: false, slug: "b" } }),
    ];
    mockUseQuery.mockReturnValue(items);
    renderCart();
    expect(screen.getByText("Product A")).toBeInTheDocument();
    expect(screen.getByText("Product B")).toBeInTheDocument();
  });

  it("shows quantity controls", () => {
    mockUseQuery.mockReturnValue([mockCartItem({ quantity: 2 })]);
    renderCart();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows order summary with subtotal", () => {
    mockUseQuery.mockReturnValue([
      mockCartItem({ quantity: 2, product: { _id: "prod_1", name: "Product", sellingPrice: 50, mrp: 60, stockQuantity: 10, isActive: true, prescriptionRequired: false, slug: "p" } }),
    ]);
    renderCart();
    expect(screen.getByText(/subtotal/i)).toBeInTheDocument();
  });

  it("shows prescription warning for Rx items", () => {
    mockUseQuery.mockReturnValue([
      mockCartItem({ product: { _id: "prod_1", name: "Rx Drug", sellingPrice: 100, mrp: 120, stockQuantity: 5, isActive: true, prescriptionRequired: true, slug: "rx" } }),
    ]);
    renderCart();
    const rxTexts = screen.getAllByText(/prescription/i);
    expect(rxTexts.length).toBeGreaterThanOrEqual(1);
  });

  it("shows checkout button when items exist", () => {
    mockUseQuery.mockReturnValue([mockCartItem()]);
    renderCart();
    expect(screen.getByText(/proceed to checkout/i)).toBeInTheDocument();
  });

  it("shows loading state when data is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    renderCart();
    // Should show a loader (Loader2 icon) or some loading indicator
    expect(document.querySelector(".animate-spin") || screen.queryByText(/loading/i)).toBeTruthy();
  });
});
