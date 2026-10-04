/**
 * Deterministic breadcrumb trail resolution.
 *
 * ── The one rule this module enforces ───────────────────────────────────────
 * A breadcrumb answers "WHERE AM I NOW?" — never "WHERE WAS I BEFORE?".
 *
 * Every function here is a PURE mapping from the CURRENT route (pathname +
 * search params + route params) and the CURRENT page data to a trail. There is
 * no cache, no history, no accumulated array and no storage. The same URL plus
 * the same data always produces the same trail, so a trail can never outlive
 * the page that produced it.
 *
 * The visual component (`components/ui/breadcrumb.tsx`) stays purely
 * presentational; this module is the single source of truth for trail content.
 */

import type { BreadcrumbItem } from "@/components/ui/breadcrumb";

/* ── Minimal structural shapes ─────────────────────────────────────────────
   Structural (not Convex-doc) types keep the builders testable in isolation
   and tolerant of a field being absent while a page's data is still loading. */

export interface BreadcrumbCategory {
  _id: string;
  name: string;
  slug: string;
  parentId?: string | null;
}

export interface BreadcrumbBrand {
  name: string;
  slug: string;
}

export interface BreadcrumbProduct {
  name: string;
  category?: BreadcrumbCategory | null;
}

export interface BreadcrumbLabTest {
  name: string;
  categoryName?: string | null;
  categorySlug?: string | null;
}

export interface BreadcrumbDoctor {
  name: string;
  specialty?: string | null;
}

/* ── Route constants (the real routes in main.tsx) ────────────────────────── */

export const HOME_HREF = "/";
export const PRODUCTS_HREF = "/products";
export const BRANDS_HREF = "/brands";
export const CATEGORIES_HREF = "/categories";
export const LAB_TESTS_HREF = "/lab-tests";
export const DOCTORS_HREF = "/doctor-appointment";

export const categoryHref = (slug: string) => `${PRODUCTS_HREF}?category=${slug}`;
export const labTestCategoryHref = (slug: string) => `${LAB_TESTS_HREF}/${slug}`;
export const specialtyHref = (specialty: string) =>
  `${DOCTORS_HREF}?specialty=${encodeURIComponent(specialty)}&view=doctors`;

export const home = (): BreadcrumbItem => ({ label: "Home", href: HOME_HREF });

/** "general-physician" → "General Physician" */
export function titleCaseSlug(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/* ═══════════════════════════════════════════════════════════════════════════
   Trail builders — one per kind of page
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Product trail built from THIS product's own category chain.
 *
 *   Home → Medicines → Pain Relief → Dolo 650
 *
 * When the product has no usable category we fall back to a safe, truthful
 * hierarchy rather than inventing a category:
 *
 *   Home → Products → Dolo 650
 */
export function productTrail(
  product: BreadcrumbProduct | null | undefined,
  categories: readonly BreadcrumbCategory[] = []
): BreadcrumbItem[] {
  const productsRoot: BreadcrumbItem = { label: "Products", href: PRODUCTS_HREF };

  if (!product?.name) {
    // Data not loaded yet (direct URL / first paint). Stay truthful: show the
    // generic parent, never a previous product's hierarchy.
    return [home(), productsRoot, { label: "Product" }];
  }

  const cat = product.category;
  if (!cat?.name || !cat.slug) {
    return [home(), productsRoot, { label: product.name }];
  }

  const byId = new Map(categories.map((c) => [c._id, c]));
  const chain: BreadcrumbCategory[] = [cat];
  const seen = new Set<string>([cat._id]);
  let parentId = cat.parentId;
  while (parentId && !seen.has(parentId)) {
    const parent = byId.get(parentId);
    if (!parent) break;
    seen.add(parentId);
    chain.unshift(parent);
    parentId = parent.parentId;
  }

  return [
    home(),
    ...chain.map((c) => ({ label: c.name, href: categoryHref(c.slug) }) as BreadcrumbItem),
    { label: product.name },
  ];
}

/**
 * Listing trail for /products, resolved purely from the current search params.
 *
 *   ?category=child   → Home → Parent → Child
 *   ?category=top     → Home → Top
 *   ?brand=cipla      → Home → Brands → Cipla
 *   ?search=paracetamol (no real parent) → Home → Search
 *   (none)            → Home → Products
 *
 * The previous category/brand can never linger: every branch is recomputed
 * from the params that are present right now.
 */
export function productListingTrail(params: {
  category?: BreadcrumbCategory | null;
  parentCategory?: BreadcrumbCategory | null;
  brand?: BreadcrumbBrand | null;
  search?: string | null;
}): BreadcrumbItem[] {
  const { category, parentCategory, brand, search } = params;

  if (category?.slug && category.name) {
    // A category always wins over a brand: it is the more specific hierarchy.
    return parentCategory?.slug
      ? [
          home(),
          { label: parentCategory.name, href: categoryHref(parentCategory.slug) },
          { label: category.name },
        ]
      : [home(), { label: category.name }];
  }

  if (brand?.slug && brand.name) {
    return [home(), { label: "Brands", href: BRANDS_HREF }, { label: brand.name }];
  }

  // Plain keyword search has no real parent — say "Search", invent nothing.
  if (search && search.trim()) {
    return [home(), { label: "Search" }];
  }

  return [home(), { label: "Products" }];
}

/** Home → Lab Tests → <Category>
 *  Pass the category's real display name when the page has it (the slug is
 *  only title-cased as a last resort, before its data has loaded). */
export function labTestCategoryTrail(
  categorySlug: string | null | undefined,
  categoryName?: string | null
): BreadcrumbItem[] {
  return [
    home(),
    { label: "Lab Tests", href: LAB_TESTS_HREF },
    {
      label: categoryName || (categorySlug ? titleCaseSlug(categorySlug) : "Category"),
    },
  ];
}

/**
 * Home → Lab Tests → <Category> → <Test Name>
 * The category link points at the real category route when it is known.
 */
export function labTestTrail(
  test: BreadcrumbLabTest | null | undefined,
  fallbackSlug?: string | null
): BreadcrumbItem[] {
  const slug = test?.categorySlug || fallbackSlug || null;
  const name = test?.name;

  if (!name) {
    return [
      home(),
      { label: "Lab Tests", href: LAB_TESTS_HREF },
      { label: slug ? titleCaseSlug(slug) : "Category", ...(slug ? { href: labTestCategoryHref(slug) } : {}) },
      { label: "Test Detail" },
    ];
  }

  const categoryItem: BreadcrumbItem = test?.categoryName
    ? { label: test.categoryName, ...(slug ? { href: labTestCategoryHref(slug) } : {}) }
    : { label: slug ? titleCaseSlug(slug) : "Category", ...(slug ? { href: labTestCategoryHref(slug) } : {}) };

  return [home(), { label: "Lab Tests", href: LAB_TESTS_HREF }, categoryItem, { label: name }];
}

/**
 * Home → Find Doctors → <Specialty> → <Doctor Name>
 *
 * `specialtyLabel` is the page's canonical specialty name ("ENT",
 * "Obstetrics & Gynaecology"). Keys are not reliably title-casable, so the
 * slug is only title-cased when no canonical label is supplied.
 */
export function doctorTrail(
  doctor: BreadcrumbDoctor | null | undefined,
  specialtyLabel?: string | null
): BreadcrumbItem[] {
  const specialty = doctor?.specialty;
  const specialtyItem: BreadcrumbItem | null = specialty
    ? {
        label: specialtyLabel || titleCaseSlug(specialty),
        href: specialtyHref(specialty),
      }
    : null;

  return [
    home(),
    { label: "Find Doctors", href: DOCTORS_HREF },
    ...(specialtyItem ? [specialtyItem] : []),
    { label: doctor?.name || "Doctor Details" },
  ];
}

/** Home → Find Doctors (optionally → the specialty currently being listed) */
export function doctorListingTrail(
  specialty?: string | null,
  specialtyLabel?: string | null
): BreadcrumbItem[] {
  return [
    home(),
    { label: "Find Doctors" },
    ...(specialty
      ? [{ label: specialtyLabel || titleCaseSlug(specialty) } as BreadcrumbItem]
      : []),
  ];
}

/** Home → <label> for a page whose only real parent is the home page. */
export function simpleTrail(label: string): BreadcrumbItem[] {
  return [home(), { label }];
}
