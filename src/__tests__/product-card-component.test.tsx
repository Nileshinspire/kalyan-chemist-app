import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { useQuery, useMutation } from "convex/react";
import ProductCard from "@/components/ProductCard";

vi.mock("convex/react");
vi.mock("@/context/AuthContext");

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
    mockUseMutation
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
    // Both "500mg" and "1 strip" should be in the display info line
    const displayInfo = screen.getByText(/500mg.*1 strip/);
    expect(displayInfo).toBeInTheDocument();
  });

  it("hides pack size when no display info", () => {
    const { container } = renderCard({ packSize: "1 strip" });
    expect(container.textContent).not.toContain("1 strip");
  });

  it("renders selling price via formatCurrency", () => {
    renderCard();
    // formatCurrency mock returns ₹<amount>.toFixed(2)
    // Use getAllByText with text content matcher to handle Unicode ₹
    const priceElements = screen.getAllByText((content) => {
      return content.includes("50.00");
    });
    expect(priceElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders MRP with strikethrough when discount exists", () => {
    renderCard({ price: 60, discountPrice: 50 });
    const mrpElement = screen.getByText((content) => content.includes("60.00"));
    expect(mrpElement).toBeInTheDocument();
    expect(mrpElement.className).toContain("line-through");
  });

  it("shows discount percentage badge", () => {
    renderCard({ price: 100, discountPrice: 80 });
    expect(screen.getByText("20% OFF")).toBeInTheDocument();
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

  it("renders product image when imageUrl is provided", () => {
    const { container } = renderCard({ imageUrl: "https://example.com/img.jpg" });
    const img = container.querySelector("img");
    expect(img).toBeTruthy();
    expect(img?.getAttribute("src")).toBe("https://example.com/img.jpg");
  });

  it("renders Pill icon placeholder when no imageUrl", () => {
    const { container } = renderCard({ imageUrl: undefined });
    // lucide-react mock uses icon name as data-testid (capital P for Pill)
    const pillIcon = container.querySelector('[data-testid="icon-Pill"]');
    expect(pillIcon).toBeTruthy();
  });

  it("does not show discount badge when no discount", () => {
    const { container } = renderCard({ discountPrice: undefined });
    expect(container.textContent).not.toContain("OFF");
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
});
