import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { useQuery, useMutation } from "convex/react";
import AdminDiscountManager from "@/pages/admin/AdminDiscountManager";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
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
const mockSave = vi.fn();
vi.mocked(useMutation).mockImplementation(() => mockSave as never);

/** Config exactly as the engine's getConfig returns it. */
const config = {
  configured: true,
  discountPercent: 37,
  isActive: true,
  startsAt: null,
  endsAt: null,
  manualProductIds: ["p3"],
  excludedProductIds: ["p2"],
  productOverrides: [{ productId: "p4", discountPercent: 55 }],
  categoryRules: [{ categoryId: "c1", categoryName: "Wellness", discountPercent: 30 }],
  updatedAt: 1_700_000_000_000,
  lineCounts: { products: 4, auto: 1, manual: 1, droppedManualIds: [] },
  windowOpen: true,
  statusCounts: {
    auto: 1,
    override: 1,
    category: 1,
    "manual-price": 1,
    excluded: 1,
    ineligible: 1,
  },
  productStates: [
    {
      _id: "p1",
      name: "Auto-priced product",
      manufacturer: "Cipla",
      categoryName: "Wellness",
      isActive: true,
      price: 100,
      discountPrice: 63,
      discountSource: "rule",
      status: "auto",
      label: "Default rule: 37% off",
      effectivePercent: 37,
      effectivePrice: 63,
      listed: true,
      overriddenByOverride: false,
    },
    {
      _id: "p2",
      name: "Excluded product",
      manufacturer: "Cipla",
      categoryName: "Wellness",
      isActive: true,
      price: 100,
      discountPrice: 75,
      discountSource: null,
      status: "excluded",
      label: "Manually excluded from promotions",
      effectivePercent: 25,
      effectivePrice: 75,
      listed: false,
      overriddenByOverride: false,
    },
    {
      _id: "p3",
      name: "Pinned product",
      manufacturer: "Cipla",
      categoryName: "Wellness",
      isActive: true,
      price: 200,
      discountPrice: 100,
      discountSource: null,
      status: "manual-price",
      label: "Explicit selling price (preserved)",
      effectivePercent: 50,
      effectivePrice: 100,
      listed: true,
      overriddenByOverride: false,
    },
    {
      _id: "p4",
      name: "Overridden product",
      manufacturer: "Cipla",
      categoryName: "Wellness",
      isActive: true,
      price: 300,
      discountPrice: 135,
      discountSource: "rule",
      status: "override",
      label: "Product-specific override: 55% off",
      effectivePercent: 55,
      effectivePrice: 135,
      listed: true,
      overriddenByOverride: true,
    },
  ],
};

const categories = [{ _id: "c1", name: "Wellness" }];

function renderPage() {
  // The config query is the page's first and only data dependency the tests
  // need; the category list is optional and renders its fallback when absent.
  mockUseQuery.mockReturnValue(config as never);
  return render(
    <MemoryRouter>
      <AdminDiscountManager />
    </MemoryRouter>,
  );
}

describe("AdminDiscountManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSave.mockResolvedValue({ discountPercent: 37, manualCount: 1, sync: { priced: 0, cleaned: 0, skipped: 0 } });
  });

  it("loads the saved percentage into the input", () => {
    renderPage();
    expect(screen.getByText("Discount engine")).toBeInTheDocument();
    expect(screen.getByDisplayValue("37")).toBeInTheDocument();
    expect(screen.getByText(/Minimum 37% Off/)).toBeInTheDocument();
    expect(screen.getByText(/Last saved/)).toBeInTheDocument();
  });

  it("shows which rule prices each product and its effective price", () => {
    renderPage();
    // Status labels also appear in the priority card, so match them anywhere.
    for (const label of [/Selected · promotion rule/, /Override rule/, /Explicit price \(kept\)/, /Excluded/]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
    // Effective prices and percents are surfaced next to each row.
    expect(screen.getByText(/63/)).toBeInTheDocument();
    expect(screen.getByText(/135/)).toBeInTheDocument();
    expect(screen.getByText(/55% off/)).toBeInTheDocument();
  });

  it("surfaces the section counts and the exclusion state", () => {
    renderPage();
    expect(screen.getByText(/in the homepage section/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("55")).toBeInTheDocument(); // override percent input
  });

  it("sends the full normalized payload when saving", async () => {
    renderPage();
    const saveButtons = screen.getAllByText("Save configuration");
    fireEvent.click(saveButtons[0]!);
    await vi.waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
    });
    const args = mockSave.mock.calls[0]![0] as Record<string, unknown>;
    expect(args.discountPercent).toBe(37);
    expect(args.isActive).toBe(true);
    expect(args.manualProductIds).toEqual(["p3"]);
    expect(args.excludedProductIds).toEqual(["p2"]);
    expect(args.productOverrides).toEqual([{ productId: "p4", discountPercent: 55 }]);
    expect(args.categoryRules).toEqual([{ categoryId: "c1", discountPercent: 30 }]);
    // Auto-eligibility for new products is OFF unless the admin opts in.
    expect(args.autoEligible).toBe(false);
    expect(args.startsAt).toBeUndefined();
    expect(args.endsAt).toBeUndefined();
  });

  it("sends autoEligible=true when the admin switches it on", async () => {
    renderPage();
    fireEvent.click(screen.getByText(/Newly added products are auto-eligible/));
    fireEvent.click(screen.getAllByText("Save configuration")[0]!);
    await vi.waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
    });
    const args = mockSave.mock.calls[0]![0] as Record<string, unknown>;
    expect(args.autoEligible).toBe(true);
  });
});
