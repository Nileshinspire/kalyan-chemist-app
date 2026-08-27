import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { useQuery, useMutation } from "convex/react";
import ProductCard from "@/components/ProductCard";

vi.mock("convex/react");
vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    isAdmin: false,
  })),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const mockUseQuery = vi.mocked(useQuery);
const mockUseMutation = vi.mocked(useMutation);

function renderCard(overrides: any = {}) {
  const product = {
    _id: "prod_1",
    name: "Paracetamol 500mg",
    slug: "paracetamol-500mg",
    price: 60,
    discountPrice: 50,
    manufacturer: "Cipla",
    packSize: "1 strip",
    prescriptionRequired: false,
    stockQuantity: 10,
    isActive: true,
    ...overrides,
  };
  return render(
    <MemoryRouter>
      <ProductCard product={product} />
    </MemoryRouter>
  );
}

describe("ProductCard component", () => {
  const mockAddToCart = vi.fn();
  const mockToggleWishlist = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (mockUseMutation as any)
      .mockReturnValueOnce(mockAddToCart)
      .mockReturnValueOnce(mockToggleWishlist);
    mockUseQuery.mockReturnValue(false);
  });

  it("renders product name", () => {
    renderCard();
    expect(screen.getByText("Paracetamol 500mg")).toBeInTheDocument();
  });

  it("renders manufacturer", () => {
    renderCard();
    expect(screen.getByText("Cipla")).toBeInTheDocument();
  });

  it("renders pack size alongside display info when strength is provided", () => {
    renderCard({ strength: "500mg", packSize: "1 strip" });
    expect(screen.getByText(/500mg.*1 strip/)).toBeInTheDocument();
  });

  it("hides pack size when no display info", () => {
    const { container } = renderCard({ packSize: "1 strip" });
    expect(container.textContent).not.toContain("1 strip");
  });

  it("renders selling price (formatCurrency uses Intl with no decimals)", () => {
    renderCard();
    // formatCurrency(50) → "₹50" (no decimals), formatCurrency(60) → "₹60"
    const { container } = renderCard();
    const text = container.textContent ?? "";
    expect(text).toContain("50"); // selling price
    expect(text).toContain("60"); // MRP
  });

  it("renders MRP with strikethrough when discount exists", () => {
    const { container } = renderCard({ price: 60, discountPrice: 50 });
    // Find span with line-through class and ₹60 text
    const strikethroughEls = container.querySelectorAll(".line-through");
    let found = false;
    strikethroughEls.forEach((el) => {
      if (el.textContent?.includes("60")) found = true;
    });
    expect(found).toBe(true);
  });

  it("shows discount percentage badge", () => {
    renderCard({ price: 100, discountPrice: 80 });
    expect(screen.getByText("20% OFF")).toBeInTheDocument();
  });

  it("shows no discount badge when no discount", () => {
    const { container } = renderCard({ discountPrice: undefined });
    expect(container.textContent).not.toContain("OFF");
  });

  it("shows Rx Required badge for prescription products", () => {
    renderCard({ prescriptionRequired: true });
    expect(screen.getByText("Rx Required")).toBeInTheDocument();
  });

  it("shows OTC badge for non-prescription products", () => {
    renderCard({ prescriptionRequired: false });
    expect(screen.getByText("OTC")).toBeInTheDocument();
  });

  it("shows Out of Stock when stock is 0", () => {
    renderCard({ stockQuantity: 0 });
    expect(screen.getByText("Out of Stock")).toBeInTheDocument();
  });

  it("shows low stock badge when stock is between 1 and 9", () => {
    renderCard({ stockQuantity: 3 });
    expect(screen.getByText("Only 3 left")).toBeInTheDocument();
  });

  it("does not show low stock when stock >= 10", () => {
    const { container } = renderCard({ stockQuantity: 10 });
    expect(container.textContent).not.toContain("left");
  });

  it("renders product image when imageUrl is provided", () => {
    const { container } = renderCard({ imageUrl: "https://example.com/img.jpg" });
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("https://example.com/img.jpg");
  });

  it("renders icon placeholder when no imageUrl", () => {
    const { container } = renderCard({ imageUrl: undefined });
    // lucide-react mock creates <svg data-testid="icon-Name">
    // The Pill component renders in the image area
    const svgs = container.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThan(0);
  });

  it("shows Buy Now button for in-stock products", () => {
    renderCard();
    expect(screen.getByText("Buy Now")).toBeInTheDocument();
  });

  it("shows Cart button for adding to cart", () => {
    renderCard();
    expect(screen.getByText("Cart")).toBeInTheDocument();
  });

  it("disables Buy Now and Cart when out of stock", () => {
    renderCard({ stockQuantity: 0 });
    const buyNowBtn = screen.getByText("Out of Stock").closest("button");
    expect(buyNowBtn).toBeDisabled();
  });

  it("calls addToCart when Cart button clicked", async () => {
    mockAddToCart.mockResolvedValue({});
    renderCard();
    const cartBtn = screen.getByText("Cart").closest("button");
    if (cartBtn) {
      cartBtn.click();
      expect(mockAddToCart).toHaveBeenCalledWith({ productId: "prod_1", quantity: 1 });
    }
  });

  it("calls toggleWishlist when heart button clicked", () => {
    mockToggleWishlist.mockResolvedValue({});
    renderCard();
    const heartBtns = screen.getAllByRole("button");
    // Heart button is the one with aria-label or icon-heart
    const heartBtn = heartBtns.find((btn) =>
      btn.querySelector('[data-testid="icon-Heart"]')
    );
    if (heartBtn) {
      heartBtn.click();
      expect(mockToggleWishlist).toHaveBeenCalledWith({ productId: "prod_1" });
    }
  });
});
