/**
 * The single customer-facing breadcrumb resolver.
 *
 * `usePageBreadcrumbs()` returns the correct trail for the CURRENT route,
 * recomputed from scratch on every render. It derives the trail from:
 *
 *   • the current pathname and route params
 *   • the current search params
 *   • the current page's fetched data (product / category / doctor / test)
 *
 * It NEVER reads navigation history, `location.state`, a global store, or any
 * browser storage, and it keeps no state of its own — so a trail can never be
 * carried over from a previously visited page.
 *
 * Pages call this hook and hand the result to the presentational
 * `<Breadcrumb items={...} />`. That keeps trail CONTENT in exactly one place
 * (lib/breadcrumbs.ts) instead of being re-declared per page.
 *
 * Data-dependent segments are supplied by the caller as `data`, because the
 * page already fetched that data; passing it in keeps a single source of truth
 * and avoids a second round-trip.
 */

import { useLocation } from "react-router";
import { useMemo } from "react";
import type { BreadcrumbItem } from "@/components/ui/breadcrumb";
import {
  doctorListingTrail,
  doctorTrail,
  labTestCategoryTrail,
  labTestTrail,
  productListingTrail,
  productTrail,
  simpleTrail,
  LAB_TESTS_HREF,
  type BreadcrumbBrand,
  type BreadcrumbCategory,
  type BreadcrumbDoctor,
  type BreadcrumbLabTest,
  type BreadcrumbProduct,
} from "@/lib/breadcrumbs";

export interface BreadcrumbData {
  /** Catalogue categories, used to resolve real parent chains. */
  categories?: readonly BreadcrumbCategory[];
  /** Real brand records, used to show the brand's actual name. */
  brands?: readonly BreadcrumbBrand[];
  /** The product currently rendered by /products/:slug */
  product?: BreadcrumbProduct | null;
  doctor?: BreadcrumbDoctor | null;
  labTest?: BreadcrumbLabTest | null;
  /** Real display name for the /lab-tests/:category slug on this page. */
  labTestCategoryName?: string | null;
  /**
   * Real display label for the current specialty, e.g. "ENT" or
   * "Obstetrics & Gynaecology". Specialty keys are not reliably
   * title-casable, so the owning page supplies the canonical label.
   */
  specialtyLabel?: string | null;
}

/** Stable empty array so the memo below is not invalidated every render. */
const EMPTY: readonly never[] = [];

/** Split a pathname into decoded, non-empty segments. */
function segments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean).map(decodeURIComponent);
}

/**
 * Resolve the breadcrumb trail for the current route.
 *
 * @param data Current page data for data-dependent routes (product, doctor,
 *             lab test) plus the category list used for real parent chains.
 */
export function usePageBreadcrumbs(data: BreadcrumbData = {}): BreadcrumbItem[] {
  const location = useLocation();
  const { pathname, search } = location;

  // Route params are read from the URL, which React Router keeps in sync on
  // every SPA navigation and on a direct load/refresh alike.
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const categorySlugParam = searchParams.get("category");
  const brandSlugParam = searchParams.get("brand");
  const searchQuery = searchParams.get("search");
  const specialtyParam = searchParams.get("specialty");

  const categories = data.categories ?? EMPTY;
  const brands = data.brands ?? EMPTY;

  // Memoised on primitives/strings only. Every dependency below is either a
  // string, a boolean or a caller-provided array reference — never a value
  // rebuilt during render — so the memo actually holds between renders.
  return useMemo(() => {
    const segs = segments(pathname);

    const byCategorySlug = (slug: string | null) =>
      slug ? categories.find((c) => c.slug === slug) ?? null : null;

    /* ── Home: the root has no parent, so it shows no breadcrumb ────────── */
    if (segs.length === 0) return [];

    const [first, second, third] = segs;

    /* ── Product listing: /products (with optional ?category/brand/search) ─ */
    if (first === "products" && second === undefined) {
      const category = byCategorySlug(categorySlugParam);
      const parent = category?.parentId
        ? categories.find((c) => c._id === category.parentId) ?? null
        : null;
      const brand = brandSlugParam
        ? brands.find((b) => b.slug === brandSlugParam) ?? null
        : null;

      return productListingTrail({
        category,
        parentCategory: parent,
        brand,
        search: searchQuery,
      });
    }

    /* ── Product detail: /products/:slug ──────────────────────────────────
       Built from THIS product's own category chain. Loading/unknown data
       yields the safe fallback, never a previous product's hierarchy. */
    if (first === "products" && second) {
      return productTrail(data.product ?? null, categories);
    }

    /* ── Category directory ─────────────────────────────────────────────── */
    if (first === "categories") return simpleTrail("Categories");

    /* ── Brand directory ────────────────────────────────────────────────── */
    if (first === "brands") return simpleTrail("Brands");

    /* ── Campaigns / offers / deals ─────────────────────────────────────── */
    if (first === "value-deals") return simpleTrail("Value Deals");
    if (first === "hot-sellers") return simpleTrail("Hot Sellers");

    /* ── Upload prescription ────────────────────────────────────────────── */
    if (first === "upload-prescription") return simpleTrail("Upload Prescription");

    /* ── Medicine refill ────────────────────────────────────────────────── */
    if (first === "refill") return simpleTrail("Medicine Refill");

    /* ── Lab tests: /lab-tests, /lab-tests/test/:id, /lab-tests/:category ── */
    if (first === "lab-tests") {
      if (second === undefined) return simpleTrail("Lab Tests");
      if (second === "test" && third) {
        return labTestTrail(data.labTest ?? null, third);
      }
      return labTestCategoryTrail(second, data.labTestCategoryName);
    }

    /* ── Doctors: /doctor-appointment and /doctors/:id ──────────────────── */
    if (first === "doctor-appointment") {
      // A specialty listing is a real child of Find Doctors.
      const isSpecialtyListing = searchParams.get("view") === "doctors";
      return doctorListingTrail(
        isSpecialtyListing && specialtyParam ? specialtyParam : null,
        isSpecialtyListing && specialtyParam ? data.specialtyLabel : null
      );
    }
    if (first === "doctors" && second) {
      return doctorTrail(data.doctor ?? null, data.specialtyLabel);
    }

    /* ── Informational / policy pages: single valid parent (Home) ───────── */
    return [];
  }, [
    pathname,
    search,
    categories,
    brands,
    data.product,
    data.doctor,
    data.labTest,
    data.labTestCategoryName,
    data.specialtyLabel,
  ]);
}

export { LAB_TESTS_HREF };
