import { act } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { useQuery, useMutation } from "convex/react";
import ProductCard from "@/components/ProductCard";

vi.mock("convex/react");
vi.mock("@/lib/product-transition", () => ({
  beginProductTransition: vi.fn(),
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    user: {
      _id: "user_1",
      name: "QA User",
      email: "qa@example.com",
      role: "customer",
    },
    isLoading: false,
    isAuthenticated: true,
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
    // ProductCard calls useMutation in a fixed order every render: addToCart
    // first, then toggleWishlist. The component re-renders once the image band
    // is measured, so the mock must return a stable function on every call
    // rather than only the first two — otherwise later renders hand the
    // handlers `undefined` and the click assertions never fire.
    let mutationCall = 0;
    (mockUseMutation as any).mockImplementation(() =>
      ++mutationCall % 2 === 1 ? mockAddToCart : mockToggleWishlist
    );
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

  it("shows the saved pack size as a compact label even without dosage info", () => {
    // The card now carries the reference's attribute row: the saved pack size is
    // always labelled, regardless of whether a dosage/strength line exists.
    const { container } = renderCard({ packSize: "1 strip" });
    expect(container.textContent).toContain("1 strip");
    // The phone-only dosage line still needs display info, so it stays absent.
    expect(container.querySelector("p.sm\\:hidden")).toBeNull();
  });

  it("shows the packaging form label only when the product has one", () => {
    const withForm = renderCard({ form: "Tablet" });
    expect(withForm.container.textContent).toContain("Tablet");
    withForm.unmount();
    const withoutForm = renderCard({ form: undefined });
    expect(withoutForm.container.textContent).not.toContain("Tablet");
  });

  it("shows the real average rating and review count when reviews exist", () => {
    // The generated `api` is a proxy, so query identity cannot be compared;
    // this card's two queries are the wishlist flag and the rating summary.
    // A truthy wishlist flag is harmless here — the rating aggregate is what
    // this test asserts.
    mockUseQuery.mockImplementation((() => ({ average: 4.3, count: 12 })) as any);
    const { container } = renderCard();
    // Rendered on the desktop attribute row and in the phone price row.
    expect(screen.getAllByText("4.3").length).toBeGreaterThan(0);
    expect(screen.getAllByText("(12)").length).toBeGreaterThan(0);
    expect(
      container.querySelector('[aria-label="Rated 4.3 out of 5 by 12 reviews"]')
    ).toBeTruthy();
  });

  it("shows no stars, rating or review count when there are no reviews", () => {
    mockUseQuery.mockImplementation((() => ({ average: 0, count: 0 })) as any);
    const { container } = renderCard();
    expect(container.querySelector('[aria-label^="Rated"]')).toBeNull();
    expect(container.querySelector(".lucide-star")).toBeNull();
  });

  it("keeps the mobile-only dosage line off the desktop card", () => {
    // The Hot Sellers reference card shows name → manufacturer → price, so the
    // dosage/pack line is scoped to phones (`sm:hidden`).
    const { container } = renderCard({ strength: "500mg", packSize: "1 strip" });
    const line = screen.getByText(/500mg.*1 strip/);
    expect(line.className).toContain("sm:hidden");
    expect(container.textContent).toContain("500mg");
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
    expect(screen.getAllByText("Out of Stock").length).toBeGreaterThan(0);
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

  it("shows the mobile Buy Now and Cart buttons", () => {
    renderCard();
    expect(screen.getByText("Buy Now")).toBeInTheDocument();
    expect(screen.getByText("Cart")).toBeInTheDocument();
  });

  it("uses a single full-width Add to Cart from sm up, matching the reference", () => {
    renderCard();
    const addBtn = screen.getByText("Add to Cart").closest("button") as HTMLButtonElement;
    expect(addBtn).toBeTruthy();
    // Hidden on phones (which keep Buy Now + Cart) and full-width from sm up,
    // i.e. exactly the Hot Sellers reference button: 234 - 2*16 - 2 borders.
    expect(addBtn.className).toContain("hidden");
    expect(addBtn.className).toContain("sm:flex");
    expect(addBtn.className).toContain("w-full");
    expect(addBtn.className).toContain("h-8");
    expect(addBtn.className).toContain("sm:mt-3");
    // The mobile pair it replaces is hidden from sm up.
    expect((screen.getByText("Buy Now").closest("button") as HTMLElement).className).toContain("sm:hidden");
    expect((screen.getByText("Cart").closest("button") as HTMLElement).className).toContain("sm:hidden");
  });

  it("disables the mobile Buy Now and the desktop Add to Cart when out of stock", () => {
    renderCard({ stockQuantity: 0 });
    // Out of stock, so the mobile primary action reads "Out of Stock"; the
    // desktop button does too. Both, plus the Cart button, must be disabled.
    const disabled = screen
      .getAllByText("Out of Stock")
      .map((el) => el.closest("button"));
    expect(disabled.length).toBeGreaterThan(0);
    expect(disabled.every((btn) => btn?.hasAttribute("disabled"))).toBe(true);
    expect((screen.getByText("Cart").closest("button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("calls addToCart when Cart button clicked", async () => {
    mockAddToCart.mockResolvedValue({});
    renderCard();
    const cartBtn = screen.getByText("Cart").closest("button") as HTMLButtonElement | null;
    expect(cartBtn).toBeTruthy();
    cartBtn!.click();
    await vi.waitFor(() => expect(mockAddToCart).toHaveBeenCalled(), { timeout: 2000 });
    expect(mockAddToCart).toHaveBeenCalledWith({ productId: "prod_1", quantity: 1 });
  });

  it("calls addToCart when the desktop Add to Cart button clicked", async () => {
    mockAddToCart.mockResolvedValue({});
    renderCard();
    const addBtn = screen.getByText("Add to Cart").closest("button") as HTMLButtonElement | null;
    expect(addBtn).toBeTruthy();
    await act(async () => {
      addBtn!.click();
    });
    await vi.waitFor(() => expect(mockAddToCart).toHaveBeenCalled(), { timeout: 2000 });
    expect(mockAddToCart).toHaveBeenCalledWith({ productId: "prod_1", quantity: 1 });
  });

  it("calls toggleWishlist when heart button clicked", async () => {
    mockToggleWishlist.mockResolvedValue({});
    const { container } = renderCard();
    const heartIcon = container.querySelector("button .lucide-heart");
    expect(heartIcon).toBeTruthy();
    const btn = heartIcon!.closest("button") as HTMLButtonElement | null;
    expect(btn).toBeTruthy();
    btn!.click();
    await vi.waitFor(() => expect(mockToggleWishlist).toHaveBeenCalled(), { timeout: 2000 });
    expect(mockToggleWishlist).toHaveBeenCalledWith({ productId: "prod_1" });
  });
});

/* ─── The shared card box ───
 * Every product section renders this one card, so its box must be the Hot
 * Sellers reference box: `rounded-2xl border border-border/70 bg-card p-4`, a
 * 128px image band, one full-width Add to Cart, and a total height pinned to
 * `--kc-card-h` (288px) from `sm` up. Nothing about the product may change that
 * box — not a two-line name, not a missing manufacturer, not the packshot.
 */
describe("ProductCard reference box", () => {
  const CARD = '[data-slot="card"]';
  const CONTENT = '[data-slot="card-content"]';

  const cardClasses = (overrides: Record<string, unknown> = {}) => {
    const { container } = renderCard(overrides);
    return (container.querySelector(CARD) as HTMLElement).className;
  };

  it("uses the reference box: rounded-2xl, border-border/70, 16px padding", () => {
    const cls = cardClasses();
    expect(cls).toContain("rounded-2xl");
    expect(cls).toContain("border-border/70");
    expect(cls).toContain("bg-card");
    expect(cls).toContain("sm:p-4");
  });

  it("stretches to the track height and lays out as a flex column", () => {
    const { container } = renderCard();
    const card = container.querySelector(CARD) as HTMLElement;
    expect(card.className).toContain("h-full");
    expect(card.className).toContain("flex-col");
    // Height comes from the shared token, never from the content.
    expect(card.className).toContain("sm:min-h-[var(--kc-card-h)]");
  });

  it("keeps the image band square on phones and a fixed 128px strip from sm up", () => {
    const { container } = renderCard({ imageUrl: "https://example.com/img.jpg" });
    const band = container.querySelector('[class*="aspect-square"]') as HTMLElement;
    expect(band).toBeTruthy();
    expect(band.className).toContain("shrink-0");
    expect(band.className).toContain("sm:aspect-auto");
    expect(band.className).toContain("sm:h-32");
    // The packshot fills the band and is always contained, so a wide, square or
    // very tall package is shown whole and never cropped.
    const img = band.querySelector("img");
    expect(img?.className).toContain("object-contain");
    expect(img?.className).not.toContain("object-cover");
    expect(img?.className).toContain("inset-0");
    expect(img?.className).toContain("sm:p-1.5");
  });

  it("clamps name and manufacturer to one line from sm up", () => {
    const { container } = renderCard({
      name: "HealthKart HK Vitals Multivitamin",
      manufacturer: "Procter & Gamble Health Ltd",
    });
    const name = screen.getByText("HealthKart HK Vitals Multivitamin");
    const manu = screen.getByText("Procter & Gamble Health Ltd");
    expect(name.className).toContain("sm:truncate");
    expect(name.className).toContain("sm:line-clamp-none");
    expect(manu.className).toContain("sm:truncate");
    expect(manu.className).toContain("sm:line-clamp-none");
    expect(container.querySelector(CONTENT)).toBeTruthy();
  });

  it("anchors the action row to the bottom of the card", () => {
    const { container } = renderCard();
    const card = container.querySelector(CARD) as HTMLElement;
    const content = container.querySelector(CONTENT) as HTMLElement;
    const actions = screen.getByText("Add to Cart").closest("div") as HTMLElement;
    expect(actions.className).toContain("mt-auto");
    // A sibling of the details block, inside the content column, so the free
    // space of a shorter card is absorbed above the button instead of under it.
    expect(actions.parentElement).toBe(content);
    expect(content.parentElement).toBe(card);
    expect(content.className).toContain("flex-1");
    expect(content.className).toContain("flex-col");
  });

  it("keeps the phone card exactly as it was: full-bleed band + inner padding", () => {
    const { container } = renderCard();
    const card = container.querySelector(CARD) as HTMLElement;
    const content = container.querySelector(CONTENT) as HTMLElement;
    const band = container.querySelector('[class*="aspect-square"]') as HTMLElement;
    // The card carries no phone padding, so the square band stays full-bleed;
    // the 10px inset lives on the content block, and the phone-only chip row
    // and dosage line stay in place.
    expect(card.className).not.toMatch(/\bp-2\.5|\bmax-sm:p-/);
    expect(content.className).toContain("max-sm:p-2.5");
    expect(band.className).toContain("max-sm:border-b");
    expect((container.querySelector("div[class*='flex-wrap'][class*='sm:hidden']") as HTMLElement)).toBeTruthy();
    const chipRow = screen.getByText("OTC").parentElement as HTMLElement;
    expect(chipRow.className).toContain("sm:hidden");
  });

  it("uses identical outer-height classes for completely different products", () => {
    const tall = cardClasses({
      name: "Povidone Iodine Antiseptic Solution For Wounds And Cuts 500ml",
      manufacturer: "Procter & Gamble Health Ltd",
      form: "syrup",
      packSize: "1",
      imageUrl: "https://example.com/portrait.jpg",
    });
    const short = cardClasses({
      name: "nebulizers",
      manufacturer: "Auditech",
      packSize: "",
      imageUrl: "https://example.com/landscape.jpg",
    });
    expect(tall).toBe(short);
  });

  it("never derives width or height from the product image", () => {
    const portrait = cardClasses({ imageUrl: "https://example.com/portrait.jpg" });
    const landscape = cardClasses({ imageUrl: "https://example.com/landscape.jpg" });
    const none = cardClasses({ imageUrl: undefined });
    expect(portrait).toBe(landscape);
    expect(portrait).toBe(none);
  });
});
