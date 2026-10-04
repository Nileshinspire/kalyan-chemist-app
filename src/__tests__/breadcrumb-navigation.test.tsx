import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Breadcrumb } from "@/components/ui/breadcrumb";

const read = (p: string) =>
  readFileSync(resolve(__dirname, "../", p), "utf-8");

const breadcrumbSrc = read("components/ui/breadcrumb.tsx");
const mainSrc = read("main.tsx");
const productDetailSrc = read("pages/ProductDetail.tsx");
const productsSrc = read("pages/Products.tsx");
const uploadPrescriptionSrc = read("pages/UploadPrescription.tsx");

function renderBreadcrumb(items: { label: string; href?: string }[]) {
  return render(
    <MemoryRouter>
      <Breadcrumb items={items} />
    </MemoryRouter>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   The breadcrumb component itself
   ═══════════════════════════════════════════════════════════════════════════ */
describe("Breadcrumb component", () => {
  it("renders exactly the items it is given (no other source)", () => {
    renderBreadcrumb([
      { label: "Home", href: "/" },
      { label: "Medicines", href: "/products?category=medicines" },
      { label: "Dolo 650" },
    ]);

    const nav = screen.getByLabelText("Breadcrumb");
    expect(nav).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByText("Medicines")).toBeInTheDocument();
    expect(screen.getByText("Dolo 650")).toBeInTheDocument();
  });

  it("renders every parent as a real React Router link", () => {
    renderBreadcrumb([
      { label: "Home", href: "/" },
      { label: "Medicines", href: "/products?category=medicines" },
      { label: "Pain Relief", href: "/products?category=pain-relief" },
      { label: "Dolo 650" },
    ]);

    expect(screen.getByText("Home").closest("a")).toHaveAttribute("href", "/");
    expect(screen.getByText("Medicines").closest("a")).toHaveAttribute(
      "href",
      "/products?category=medicines"
    );
    expect(screen.getByText("Pain Relief").closest("a")).toHaveAttribute(
      "href",
      "/products?category=pain-relief"
    );
  });

  it("renders the current page as non-clickable text marked aria-current", () => {
    renderBreadcrumb([
      { label: "Home", href: "/" },
      { label: "Dolo 650" },
    ]);

    const current = screen.getByText("Dolo 650");
    expect(current.tagName).toBe("SPAN");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.closest("a")).toBeNull();
  });

  it("shows only the current page's trail — a different page's items never leak in", () => {
    // Simulates the "navigated somewhere unrelated" case: the new page renders
    // its own items, and nothing from the previous product flow survives.
    renderBreadcrumb([
      { label: "Home", href: "/" },
      { label: "Upload Prescription" },
    ]);

    expect(screen.getByText("Upload Prescription")).toBeInTheDocument();
    expect(screen.queryByText("Dolo 650")).not.toBeInTheDocument();
    expect(screen.queryByText("Pain Relief")).not.toBeInTheDocument();
    expect(screen.queryByText("Medicines")).not.toBeInTheDocument();
  });

  it("renders nothing when a page has no real hierarchy", () => {
    const { container } = renderBreadcrumb([]);
    expect(container).toBeEmptyDOMElement();
  });

  it("wraps on small screens instead of overflowing horizontally", () => {
    renderBreadcrumb([
      { label: "Home", href: "/" },
      { label: "Find Doctors", href: "/doctor-appointment" },
      { label: "Cardiology" },
    ]);

    const list = screen.getByLabelText("Breadcrumb").querySelector("ol");
    // flex-wrap + min-w-0 keeps long trails inside the viewport on mobile.
    expect(list?.className).toContain("flex-wrap");
    expect(list?.className).toContain("min-w-0");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   No history-based / global breadcrumb state may remain
   ═══════════════════════════════════════════════════════════════════════════ */
describe("Breadcrumbs are not history-based", () => {
  it("the component does not read any global trail", () => {
    expect(breadcrumbSrc).not.toContain("useNavigation");
    expect(breadcrumbSrc).not.toContain("NavigationContext");
    expect(breadcrumbSrc).not.toContain("trail.length");
    expect(breadcrumbSrc).not.toContain("location.state");
  });

  it("the global navigation context and breadcrumb-state hook are gone", () => {
    expect(existsSync(resolve(__dirname, "../context/NavigationContext.tsx"))).toBe(false);
    expect(existsSync(resolve(__dirname, "../hooks/useBreadcrumb.ts"))).toBe(false);
  });

  it("the app is no longer wrapped in a breadcrumb provider", () => {
    expect(mainSrc).not.toContain("NavigationProvider");
  });

  it("no page pushes or reads a breadcrumb trail through route state", () => {
    const { execSync } = require("child_process");
    const hits = execSync(
      `grep -rn "breadcrumbTrail\\|useSetBreadcrumb\\|getBreadcrumbState\\|pushItem\\|setTrail" src --include=*.ts --include=*.tsx || true`,
      { cwd: resolve(__dirname, ".."), encoding: "utf-8" }
    ).trim();
    expect(hits).toBe("");
  });

  it("breadcrumbs are never persisted to web storage", () => {
    const { execSync } = require("child_process");
    const hits = execSync(
      `grep -rln "localStorage\\|sessionStorage" src/pages src/components/ui/breadcrumb.tsx src/context 2>/dev/null || true`,
      { cwd: resolve(__dirname, ".."), encoding: "utf-8" }
    )
      .trim()
      .split("\n")
      .filter(Boolean);
    expect(hits).toEqual([]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Product hierarchy is derived from the current product's own data
   ═══════════════════════════════════════════════════════════════════════════ */
describe("Product Detail breadcrumb is derived from current product data", () => {
  it("uses the fetched product's own category and its parent", () => {
    expect(productDetailSrc).toContain("product?.category");
    expect(productDetailSrc).toContain("parentId");
    expect(productDetailSrc).toContain("<Breadcrumb items={productTrail} />");
  });

  it("recomputes the trail for each product instead of hardcoding one", () => {
    // The trail is built from the product's category, so navigating to a
    // different product necessarily produces a different trail.
    expect(productDetailSrc).toMatch(/const productTrail = product\b/);
    expect(productDetailSrc).toContain("{ label: product.name }");
  });

  it("does not render any trail captured from navigation history", () => {
    expect(productDetailSrc).not.toContain("breadcrumbTrail");
    expect(productDetailSrc).not.toContain("useSetBreadcrumb");
  });
});

describe("Category listing breadcrumb is derived from the current URL filter", () => {
  it("builds the category trail from the active category in the URL", () => {
    expect(productsSrc).toContain('searchParams.get("category")');
    expect(productsSrc).toContain("activeCategoryParent");
    expect(productsSrc).toContain("<Breadcrumb items={breadcrumbItems} />");
  });

  it("shows no breadcrumb for a free-text search with no real parent", () => {
    // The trail is `null` when neither a real category nor a real brand is
    // selected, and the render is guarded on it — so a plain keyword search
    // shows no breadcrumb rather than a fabricated one.
    expect(productsSrc).toMatch(/const breadcrumbItems[\s\S]*?: null;/);
    expect(productsSrc).toContain(
      "{breadcrumbItems && <Breadcrumb items={breadcrumbItems} />}"
    );
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Acceptance flows
   ═══════════════════════════════════════════════════════════════════════════ */
describe("Upload Prescription has a clear way back", () => {
  it("renders a Home → Upload Prescription breadcrumb", () => {
    expect(uploadPrescriptionSrc).toContain("<Breadcrumb");
    expect(uploadPrescriptionSrc).toContain('{ label: "Home", href: "/" }');
    expect(uploadPrescriptionSrc).toContain('{ label: "Upload Prescription" }');
  });

  it("does not reload the page or hard-redirect", () => {
    expect(uploadPrescriptionSrc).not.toContain("window.location.reload");
  });
});

describe("Every audited customer-facing inner page shows only its own trail", () => {
  const pagesWithTrail: Record<string, string[]> = {
    "pages/UploadPrescription.tsx": ["Upload Prescription"],
    "pages/MedicineRefill.tsx": ["Medicine Refill"],
    "pages/DoctorAppointment.tsx": ["Find Doctors"],
    "pages/LabTests.tsx": ["Lab Tests"],
    "pages/Products.tsx": ["Home"],
    "pages/ProductDetail.tsx": ["Home", "Products"],
    "pages/Categories.tsx": ["Categories"],
    "pages/Brands.tsx": ["Brands"],
    "pages/ValueDeals.tsx": ["Value Deals"],
    "pages/HotSellers.tsx": ["Hot Sellers"],
  };

  for (const [path, labels] of Object.entries(pagesWithTrail)) {
    it(`${path} renders a breadcrumb from its own page data`, () => {
      const src = read(path);
      expect(src).toContain("<Breadcrumb");
      for (const label of labels) {
        expect(src).toContain(`label: "${label}"`);
      }
    });
  }
});
