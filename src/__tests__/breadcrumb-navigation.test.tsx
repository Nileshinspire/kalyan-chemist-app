import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { resolve } from "path";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";
import { usePageBreadcrumbs, type BreadcrumbData } from "@/hooks/usePageBreadcrumbs";

const read = (p: string) =>
  readFileSync(resolve(__dirname, "../", p), "utf-8");

const mainSrc = read("main.tsx");
const breadcrumbSrc = read("components/ui/breadcrumb.tsx");

/* ═══════════════════════════════════════════════════════════════════════════
   Test harness — drives the real resolver at a real URL
   ═══════════════════════════════════════════════════════════════════════════ */

function Probe({ data }: { data?: BreadcrumbData }) {
  const items = usePageBreadcrumbs(data);
  return <Breadcrumb items={items} />;
}

/**
 * Renders the resolver at `path`. Repeated calls in one test simulate SPA
 * navigation between pages: the previous render is unmounted first so the DOM
 * reflects ONLY the newly active route (exactly what a real page swap does).
 */
function renderAt(path: string, data?: BreadcrumbData) {
  cleanup();
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Probe data={data} />
    </MemoryRouter>
  );
}

/** The visible trail as plain labels, e.g. ["Home","Pain Relief"]. */
function trailLabels(): string[] {
  const nav = screen.getByLabelText("Breadcrumb");
  return Array.from(nav.querySelectorAll("li")).map(
    (li) => li.textContent?.trim() ?? ""
  );
}

/** The hrefs of the clickable parent items. */
function parentHrefs(): (string | null)[] {
  const nav = screen.getByLabelText("Breadcrumb");
  return Array.from(nav.querySelectorAll("li")).map(
    (li) => li.querySelector("a")?.getAttribute("href") ?? null
  );
}

/* Real catalogue fixtures mirroring the nested-category schema. */
const CATEGORIES = [
  { _id: "cat_med", name: "Medicines", slug: "medicines", parentId: null },
  { _id: "cat_pain", name: "Pain Relief", slug: "pain-relief", parentId: "cat_med" },
  { _id: "cat_diab", name: "Diabetes Care", slug: "diabetes-care", parentId: null },
  { _id: "cat_gluc", name: "Blood Glucose", slug: "blood-glucose", parentId: "cat_diab" },
];
const BRANDS = [
  { name: "Cipla", slug: "cipla" },
  { name: "Sun Pharma", slug: "sun-pharma" },
];

const DOLO = {
  name: "Dolo 650",
  category: CATEGORIES[1],
};
const GLUCOMETER = {
  name: "Glucometer",
  category: CATEGORIES[3],
};

/* ═══════════════════════════════════════════════════════════════════════════
   The presentational component
   ═══════════════════════════════════════════════════════════════════════════ */
describe("Breadcrumb component", () => {
  it("renders parents as real links and the current page as plain text", () => {
    render(
      <MemoryRouter>
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Medicines", href: "/products?category=medicines" },
            { label: "Pain Relief", href: "/products?category=pain-relief" },
            { label: "Dolo 650" },
          ]}
        />
      </MemoryRouter>
    );

    expect(screen.getByText("Home").closest("a")).toHaveAttribute("href", "/");
    expect(screen.getByText("Medicines").closest("a")).toHaveAttribute(
      "href",
      "/products?category=medicines"
    );
    expect(screen.getByText("Pain Relief").closest("a")).toHaveAttribute(
      "href",
      "/products?category=pain-relief"
    );

    const current = screen.getByText("Dolo 650");
    expect(current.tagName).toBe("SPAN");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.closest("a")).toBeNull();
  });

  it("shows no trail when a page has no hierarchy (e.g. Home)", () => {
    const { container } = renderAt("/");
    expect(container).toBeEmptyDOMElement();
  });

  it("wraps instead of overflowing horizontally on mobile", () => {
    renderAt("/lab-tests", { labTestCategoryName: "A Very Long Category Name" });
    const list = screen.getByLabelText("Breadcrumb").querySelector("ol");
    expect(list?.className).toContain("flex-wrap");
    expect(list?.className).toContain("min-w-0");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Route hierarchy
   ═══════════════════════════════════════════════════════════════════════════ */
describe("route-based hierarchy", () => {
  const cases: [string, string[], (data?: BreadcrumbData) => void][] = [
    ["/products", ["Home", "Products"], () => {}],
    ["/categories", ["Home", "Categories"], () => {}],
    ["/brands", ["Home", "Brands"], () => {}],
    ["/upload-prescription", ["Home", "Upload Prescription"], () => {}],
    ["/refill", ["Home", "Medicine Refill"], () => {}],
    ["/lab-tests", ["Home", "Lab Tests"], () => {}],
    ["/doctor-appointment", ["Home", "Find Doctors"], () => {}],
    ["/value-deals", ["Home", "Value Deals"], () => {}],
    ["/hot-sellers", ["Home", "Hot Sellers"], () => {}],
  ];

  for (const [path, expected] of cases) {
    it(`${path} resolves to ${expected.join(" → ")}`, () => {
      renderAt(path);
      expect(trailLabels()).toEqual(expected);
    });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   Categories
   ═══════════════════════════════════════════════════════════════════════════ */
describe("category breadcrumbs come from the current URL", () => {
  it("top-level category → Home → Category", () => {
    renderAt("/products?category=medicines", { categories: CATEGORIES });
    expect(trailLabels()).toEqual(["Home", "Medicines"]);
  });

  it("child category → Home → Parent → Child", () => {
    renderAt("/products?category=pain-relief", { categories: CATEGORIES });
    expect(trailLabels()).toEqual(["Home", "Medicines", "Pain Relief"]);
  });

  it("the parent category is a real clickable link", () => {
    renderAt("/products?category=pain-relief", { categories: CATEGORIES });
    expect(parentHrefs()).toEqual(["/", "/products?category=medicines", null]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Brands and search
   ═══════════════════════════════════════════════════════════════════════════ */
describe("brand and search breadcrumbs", () => {
  it("brand → Home → Brands → Brand", () => {
    renderAt("/products?brand=cipla", { brands: BRANDS });
    expect(trailLabels()).toEqual(["Home", "Brands", "Cipla"]);
  });

  it("a different brand replaces the previous one (no stale brand)", () => {
    renderAt("/products?brand=sun-pharma", { brands: BRANDS });
    const labels = trailLabels();
    expect(labels).toEqual(["Home", "Brands", "Sun Pharma"]);
    expect(labels).not.toContain("Cipla");
  });

  it("free-text search invents no category hierarchy", () => {
    renderAt("/products?search=paracetamol", { categories: CATEGORIES, brands: BRANDS });
    const labels = trailLabels();
    expect(labels).toEqual(["Home", "Search"]);
    expect(labels.join(" ")).not.toContain("Pain Relief");
    expect(labels.join(" ")).not.toContain("Cipla");
  });

  it("a real category filter beats a stale brand/search param", () => {
    renderAt("/products?category=pain-relief&search=x&brand=cipla", {
      categories: CATEGORIES,
      brands: BRANDS,
    });
    const labels = trailLabels();
    expect(labels).toEqual(["Home", "Medicines", "Pain Relief"]);
    expect(labels.join(" ")).not.toContain("Cipla");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Products
   ═══════════════════════════════════════════════════════════════════════════ */
describe("product breadcrumbs are built from the current product", () => {
  it("child-category product → Home → Parent → Child → Product", () => {
    renderAt("/products/dolo-650", { categories: CATEGORIES, product: DOLO });
    expect(trailLabels()).toEqual([
      "Home",
      "Medicines",
      "Pain Relief",
      "Dolo 650",
    ]);
  });

  it("each category ancestor is a real link; the product is not", () => {
    renderAt("/products/dolo-650", { categories: CATEGORIES, product: DOLO });
    expect(parentHrefs()).toEqual([
      "/",
      "/products?category=medicines",
      "/products?category=pain-relief",
      null,
    ]);
  });

  it("a different product yields a completely different hierarchy (ACCEPTANCE 5)", () => {
    renderAt("/products/glucometer", {
      categories: CATEGORIES,
      product: GLUCOMETER,
    });
    const labels = trailLabels();
    expect(labels).toEqual([
      "Home",
      "Diabetes Care",
      "Blood Glucose",
      "Glucometer",
    ]);
    expect(labels.join(" ")).not.toContain("Dolo");
    expect(labels.join(" ")).not.toContain("Pain Relief");
  });

  it("a product with no category falls back to Home → Products → Name (no invented category)", () => {
    renderAt("/products/mystery", {
      categories: CATEGORIES,
      product: { name: "Mystery Item", category: null },
    });
    expect(trailLabels()).toEqual(["Home", "Products", "Mystery Item"]);
  });

  it("direct URL load with data not yet fetched never shows a stale hierarchy", () => {
    // Loading state: truthy fallback only, never another product's category.
    renderAt("/products/dolo-650", { categories: CATEGORIES, product: null });
    const labels = trailLabels();
    expect(labels).toEqual(["Home", "Products", "Product"]);
    expect(labels.join(" ")).not.toContain("Pain Relief");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Lab tests & doctors
   ═══════════════════════════════════════════════════════════════════════════ */
describe("lab test breadcrumbs", () => {
  it("test detail → Home → Lab Tests → Category → Test", () => {
    renderAt("/lab-tests/test/t1", {
      labTest: {
        name: "Full Body Checkup",
        categoryName: "Full Body",
        categorySlug: "full-body",
      },
    });
    expect(trailLabels()).toEqual([
      "Home",
      "Lab Tests",
      "Full Body",
      "Full Body Checkup",
    ]);
    expect(parentHrefs()).toEqual([
      "/",
      "/lab-tests",
      "/lab-tests/full-body",
      null,
    ]);
  });

  it("lab test category → Home → Lab Tests → Category", () => {
    renderAt("/lab-tests/diabetes", {
      labTestCategoryName: "Diabetes",
    });
    expect(trailLabels()).toEqual(["Home", "Lab Tests", "Diabetes"]);
  });
});

describe("doctor breadcrumbs", () => {
  it("doctor detail → Home → Find Doctors → Specialty → Doctor", () => {
    renderAt("/doctors/d1", {
      doctor: { name: "Dr. Asha Verma", specialty: "cardiology" },
    });
    expect(trailLabels()).toEqual([
      "Home",
      "Find Doctors",
      "Cardiology",
      "Dr. Asha Verma",
    ]);
  });

  it("the specialty links back to the real filtered doctor list", () => {
    renderAt("/doctors/d1", {
      doctor: { name: "Dr. Asha Verma", specialty: "cardiology" },
    });
    expect(parentHrefs()[2]).toBe(
      "/doctor-appointment?specialty=cardiology&view=doctors"
    );
  });

  it("specialty listing → Home → Find Doctors → Specialty", () => {
    renderAt("/doctor-appointment?specialty=cardiology&view=doctors");
    expect(trailLabels()).toEqual(["Home", "Find Doctors", "Cardiology"]);
  });

  it("uses the canonical specialty label instead of a mangled title-case", () => {
    // "ent" would title-case to "Ent"; the real label is "ENT".
    renderAt("/doctor-appointment?specialty=ent&view=doctors", {
      specialtyLabel: "ENT",
    });
    expect(trailLabels()).toEqual(["Home", "Find Doctors", "ENT"]);

    cleanup();
    renderAt("/doctor-appointment?specialty=obstetrics-gynaecology&view=doctors", {
      specialtyLabel: "Obstetrics & Gynaecology",
    });
    expect(trailLabels()).toEqual([
      "Home",
      "Find Doctors",
      "Obstetrics & Gynaecology",
    ]);
  });

  it("falls back to title-casing when no canonical label is supplied", () => {
    renderAt("/doctor-appointment?specialty=general-physician&view=doctors");
    expect(trailLabels()).toEqual([
      "Home",
      "Find Doctors",
      "General Physician",
    ]);
  });

  it("without view=doctors the specialty param alone does not add a level", () => {
    renderAt("/doctor-appointment?specialty=cardiology", {
      specialtyLabel: "Cardiology",
    });
    expect(trailLabels()).toEqual(["Home", "Find Doctors"]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Determinism — the core guarantee
   ═══════════════════════════════════════════════════════════════════════════ */
describe("trails are deterministic and history-free", () => {
  it("same URL + same data always yields the same trail", () => {
    for (let i = 0; i < 3; i++) {
      renderAt("/products/dolo-650", { categories: CATEGORIES, product: DOLO });
      expect(trailLabels()).toEqual([
        "Home",
        "Medicines",
        "Pain Relief",
        "Dolo 650",
      ]);
    }
  });

  it("a different route never reuses the previous page's trail", () => {
    // Product flow, then an unrelated inner page (ACCEPTANCE 3 & 4).
    renderAt("/products/dolo-650", { categories: CATEGORIES, product: DOLO });
    expect(trailLabels().join(" ")).toContain("Dolo 650");

    renderAt("/upload-prescription");
    const labels = trailLabels();
    expect(labels).toEqual(["Home", "Upload Prescription"]);
    expect(labels.join(" ")).not.toContain("Dolo");
    expect(labels.join(" ")).not.toContain("Pain Relief");
    expect(labels.join(" ")).not.toContain("Medicines");
  });

  it("ACCEPTANCE 2: product then back to category drops the product entirely", () => {
    renderAt("/products/dolo-650", { categories: CATEGORIES, product: DOLO });
    renderAt("/products?category=pain-relief", { categories: CATEGORIES });
    const labels = trailLabels();
    expect(labels).toEqual(["Home", "Medicines", "Pain Relief"]);
    expect(labels.join(" ")).not.toContain("Dolo");
  });

  it("ACCEPTANCE 6: switching categories leaves no trace of the old one", () => {
    renderAt("/products?category=pain-relief", { categories: CATEGORIES });
    renderAt("/products?category=blood-glucose", { categories: CATEGORIES });
    const labels = trailLabels();
    expect(labels).toEqual(["Home", "Diabetes Care", "Blood Glucose"]);
    expect(labels.join(" ")).not.toContain("Pain Relief");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   No persistent trail anywhere in the system
   ═══════════════════════════════════════════════════════════════════════════ */
describe("no persistent breadcrumb trail exists", () => {
  it("the component is purely presentational", () => {
    expect(breadcrumbSrc).not.toContain("useNavigation");
    expect(breadcrumbSrc).not.toContain("location.state");
    expect(breadcrumbSrc).not.toContain("trail.length");
  });

  it("no global breadcrumb context or history hook remains", () => {
    expect(existsSync(resolve(__dirname, "../context/NavigationContext.tsx"))).toBe(false);
    expect(existsSync(resolve(__dirname, "../hooks/useBreadcrumb.ts"))).toBe(false);
    expect(mainSrc).not.toContain("NavigationProvider");
  });

  it("no source pushes, appends or stores breadcrumb items", () => {
    const hits = execSync(
      `grep -rn "breadcrumbTrail\\|useSetBreadcrumb\\|getBreadcrumbState\\|pushItem\\|setTrail" src --include=*.ts --include=*.tsx || true`,
      { cwd: resolve(__dirname, ".."), encoding: "utf-8" }
    ).trim();
    expect(hits).toBe("");
  });

  it("no breadcrumb state is persisted to web storage", () => {
    const hits = execSync(
      `grep -rln "localStorage\\|sessionStorage" src/lib/breadcrumbs.ts src/hooks/usePageBreadcrumbs.ts src/components/ui/breadcrumb.tsx 2>/dev/null || true`,
      { cwd: resolve(__dirname, ".."), encoding: "utf-8" }
    ).trim();
    expect(hits).toBe("");
  });

  it("the resolver holds no state of its own", () => {
    const src = read("hooks/usePageBreadcrumbs.ts");
    expect(src).not.toContain("useState");
    expect(src).not.toContain("useRef");
    expect(src).not.toContain("useEffect");
  });

  it("the resolver memo is not invalidated by values rebuilt during render", () => {
    // The dependency list must contain only primitives/strings and
    // caller-provided arrays — never a segment array or fallback `[]` created
    // inside the hook, which would make the memo recompute on every render.
    const src = read("hooks/usePageBreadcrumbs.ts");
    const deps = src.slice(src.lastIndexOf("}, ["));
    expect(deps).toContain("pathname");
    expect(deps).toContain("search");
    // `segs` must be computed INSIDE the memo, not listed as a dependency.
    expect(deps).not.toMatch(/\bsegs\b/);
  });

  it("no page reloads the browser for navigation", () => {
    const hits = execSync(
      `grep -rn "window.location.reload\\|window.location.href" src/pages src/lib/breadcrumbs.ts src/hooks/usePageBreadcrumbs.ts 2>/dev/null || true`,
      { cwd: resolve(__dirname, ".."), encoding: "utf-8" }
    ).trim();
    expect(hits).toBe("");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Every customer page renders the resolver's output, not its own trail
   ═══════════════════════════════════════════════════════════════════════════ */
describe("pages consume the shared resolver", () => {
  const pages = [
    "ProductDetail",
    "Products",
    "Categories",
    "Brands",
    "ValueDeals",
    "HotSellers",
    "LabTests",
    "LabTestCategory",
    "LabTestDetail",
    "DoctorAppointment",
    "DoctorDetails",
    "MedicineRefill",
    "UploadPrescription",
  ];

  for (const page of pages) {
    it(`${page}.tsx renders <Breadcrumb items={breadcrumbItems} /> from the resolver`, () => {
      const src = read(`pages/${page}.tsx`);
      expect(src).toContain("usePageBreadcrumbs");
      expect(src).toContain("items={breadcrumbItems}");
      // No page may re-declare its own trail.
      expect(src).not.toMatch(/label:\s*"Home"/);
    });
  }
});
