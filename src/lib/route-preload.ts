/**
 * Route chunk prefetching.
 *
 * Every route in the app is code-split (see `src/main.tsx`), which keeps the
 * initial bundle small but means the first visit to a route has to download its
 * chunk. Because React Router wraps navigation in `startTransition`, the current
 * page simply stays on screen until that download finishes — that is the
 * "click → wait → page opens" delay this module removes.
 *
 * Two complementary strategies:
 *   1. Intent prefetch — warm the destination chunk as soon as a user hovers,
 *      focuses or taps a link. A single delegated listener covers every internal
 *      `<Link>` / anchor in the app, so no component needs to opt in.
 *   2. Idle prefetch — after the page has loaded, quietly warm the most common
 *      destinations one per idle tick, skipped entirely on slow / data-saver
 *      connections.
 *
 * All prefetching is best-effort: failures are swallowed and never surface, and
 * an already-loaded module resolves synchronously from the module cache.
 */

type RoutePreloader = () => Promise<unknown>;

/* ── Static route → chunk loaders (mirrors the route table in main.tsx) ── */
const routePreloaders: Record<string, RoutePreloader> = {
  "/": () => import("@/pages/Landing"),

  // Informational / marketing
  "/about-us": () => import("@/pages/AboutUs"),
  "/contact-us": () => import("@/pages/ContactUs"),
  "/faqs": () => import("@/pages/Faqs"),
  "/why-choose-us": () => import("@/pages/WhyChooseUs"),
  "/careers": () => import("@/pages/Careers"),
  "/sitemap": () => import("@/pages/Sitemap"),

  // Auth
  "/auth": () => import("@/pages/Auth"),
  "/login": () => import("@/pages/Login"),
  "/register": () => import("@/pages/Register"),
  "/admin/login": () => import("@/pages/AdminLogin"),
  "/dashboard": () => import("@/pages/Dashboard"),

  // Catalogue
  "/products": () => import("@/pages/Products"),
  "/categories": () => import("@/pages/Categories"),
  "/brands": () => import("@/pages/Brands"),
  "/value-deals": () => import("@/pages/ValueDeals"),
  "/hot-sellers": () => import("@/pages/HotSellers"),

  // Cart & commerce
  "/cart": () => import("@/pages/Cart"),
  "/wishlist": () => import("@/pages/Wishlist"),
  "/checkout": () => import("@/pages/Checkout"),
  "/orders": () => import("@/pages/Orders"),

  // Healthcare services
  "/upload-prescription": () => import("@/pages/UploadPrescription"),
  "/doctor-appointment": () => import("@/pages/DoctorAppointment"),
  "/refill": () => import("@/pages/MedicineRefill"),
  "/chatbot": () => import("@/pages/AIChatbot"),
  "/lab-tests": () => import("@/pages/LabTests"),

  // Account area
  "/account": () => import("@/components/account/AccountLayout"),
  "/account/profile": () => import("@/pages/account/AccountProfile"),
  "/account/addresses": () => import("@/pages/account/AccountAddresses"),
  "/account/orders": () => import("@/pages/account/AccountOrders"),
  "/account/prescriptions": () => import("@/pages/account/AccountPrescriptions"),
  "/account/appointments": () => import("@/pages/account/AccountAppointments"),
  "/account/wishlist": () => import("@/pages/Wishlist"),
  "/account/notifications": () => import("@/pages/account/AccountNotifications"),
  "/account/lab-reports": () => import("@/pages/account/AccountLabReports"),
  "/account/my-lab-tests": () => import("@/pages/account/AccountLabTests"),
  "/account/my-appointments": () => import("@/pages/account/AccountDoctorAppointments"),
  "/account/track-order": () => import("@/pages/account/AccountTrackOrder"),
  "/account/help-support": () => import("@/pages/account/AccountHelpSupport"),
  "/account/refill": () => import("@/pages/MedicineRefill"),

  // Admin area
  "/admin": () => import("@/pages/admin/AdminDashboard"),
  "/admin/products": () => import("@/pages/admin/AdminProducts"),
  "/admin/categories": () => import("@/pages/admin/AdminCategories"),
  "/admin/healthcare-devices": () => import("@/pages/admin/AdminHealthcareDevices"),
  "/admin/brands": () => import("@/pages/admin/AdminBrands"),
  "/admin/inventory": () => import("@/pages/admin/AdminInventory"),
  "/admin/orders": () => import("@/pages/admin/AdminOrders"),
  "/admin/reviews": () => import("@/pages/admin/AdminReviews"),
  "/admin/coupons": () => import("@/pages/admin/AdminCoupons"),
  "/admin/users": () => import("@/pages/admin/AdminUsers"),
  "/admin/reports": () => import("@/pages/admin/AdminReports"),
  "/admin/delivery": () => import("@/pages/admin/AdminDeliverySettings"),
  "/admin/prescriptions": () => import("@/pages/admin/AdminPrescriptions"),
  "/admin/whatsapp": () => import("@/pages/admin/AdminWhatsApp"),
  "/admin/expiring": () => import("@/pages/admin/AdminExpiringMedicines"),
  "/admin/settings": () => import("@/pages/admin/AdminSettings"),
  "/admin/doctors": () => import("@/pages/admin/AdminDoctors"),
  "/admin/lab-tests": () => import("@/pages/admin/AdminLabTests"),
  "/admin/refills": () => import("@/pages/admin/AdminRefills"),
  "/admin/campaigns": () => import("@/pages/admin/AdminCampaigns"),
  "/admin/chatbot": () => import("@/pages/admin/AdminChatbot"),
  "/admin/appointments": () => import("@/pages/admin/AdminAppointments"),
  "/admin/activity": () => import("@/pages/admin/AdminActivityLog"),

  // Policies & legal — all share one chunk
  "/privacy-policy": () => import("@/pages/PolicyPage"),
  "/terms-conditions": () => import("@/pages/PolicyPage"),
  "/shipping-delivery": () => import("@/pages/PolicyPage"),
  "/cancellation-refund": () => import("@/pages/PolicyPage"),
  "/return-policy": () => import("@/pages/PolicyPage"),
  "/prescription-policy": () => import("@/pages/PolicyPage"),
  "/payment-policy": () => import("@/pages/PolicyPage"),
  "/disclaimer": () => import("@/pages/PolicyPage"),
};

/* ── Dynamic (parameterised) routes, matched in order ── */
const dynamicPreloaders: Array<{ key: string; pattern: RegExp; load: RoutePreloader }> = [
  { key: "/products/:slug", pattern: /^\/products\/[^/]+$/, load: () => import("@/pages/ProductDetail") },
  { key: "/orders/:id", pattern: /^\/orders\/[^/]+$/, load: () => import("@/pages/OrderDetail") },
  { key: "/account/orders/:id", pattern: /^\/account\/orders\/[^/]+$/, load: () => import("@/pages/OrderDetail") },
  { key: "/doctors/:id", pattern: /^\/doctors\/[^/]+$/, load: () => import("@/pages/DoctorDetails") },
  { key: "/lab-tests/test/:id", pattern: /^\/lab-tests\/test\/[^/]+$/, load: () => import("@/pages/LabTestDetail") },
  { key: "/lab-tests/:category", pattern: /^\/lab-tests\/[^/]+$/, load: () => import("@/pages/LabTestCategory") },
];

const inFlightPreloads = new Map<string, Promise<unknown>>();

/** Strip query/hash, force a leading slash and drop a trailing slash. */
function normalizePath(raw: string): string {
  let path = raw;

  const hashIndex = path.indexOf("#");
  if (hashIndex >= 0) path = path.slice(hashIndex + 1);

  const queryIndex = path.indexOf("?");
  if (queryIndex >= 0) path = path.slice(0, queryIndex);

  if (!path.startsWith("/")) path = `/${path}`;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

  return path;
}

function loadOnce(key: string, load: RoutePreloader): void {
  if (inFlightPreloads.has(key)) return;
  inFlightPreloads.set(
    key,
    load().catch(() => undefined)
  );
}

/** Prefetch the chunk for a pathname. Safe to call repeatedly. */
export function preloadRoute(pathname: string): void {
  const path = normalizePath(pathname);

  const staticLoader = routePreloaders[path];
  if (staticLoader) {
    loadOnce(path, staticLoader);
    return;
  }

  for (const entry of dynamicPreloaders) {
    if (entry.pattern.test(path)) {
      loadOnce(entry.key, entry.load);
      return;
    }
  }
}

/** Prefetch the product-detail chunk without knowing the slug yet. */
export function preloadProductDetail(): void {
  loadOnce("__product-detail__", () => import("@/pages/ProductDetail"));
}

/* ── Idle prefetch ──
   Warm the destinations users reach most, one per idle tick so the work never
   competes with rendering or interaction. */
const IDLE_ROUTES = [
  "/products",
  "/cart",
  "/categories",
  "/lab-tests",
  "/account",
  "/doctor-appointment",
  "/chatbot",
  "/upload-prescription",
  "/refill",
  "/wishlist",
  "/checkout",
  "/hot-sellers",
  "/value-deals",
  "/contact-us",
  "/faqs",
  "/about-us",
  "/privacy-policy",
];

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

/** Respect data-saver mode and genuinely slow connections. */
function isSlowConnection(): boolean {
  if (typeof navigator === "undefined") return true;
  const connection = (navigator as Navigator & { connection?: NetworkInformationLike })
    .connection;
  if (!connection) return false;
  if (connection.saveData) return true;
  const type = connection.effectiveType;
  return type === "slow-2g" || type === "2g";
}

function scheduleIdle(callback: () => void): void {
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(callback, { timeout: 2500 });
  } else {
    window.setTimeout(callback, 600);
  }
}

function runIdlePrefetch(): void {
  // -1 warms the product-detail chunk (the most common deep destination)
  // before we start walking the common route list.
  let index = -1;

  const step = () => {
    if (isSlowConnection()) return;

    if (index === -1) {
      preloadProductDetail();
      index = 0;
      scheduleIdle(step);
      return;
    }

    if (index >= IDLE_ROUTES.length) return;
    preloadRoute(IDLE_ROUTES[index]);
    index += 1;
    scheduleIdle(step);
  };

  scheduleIdle(step);
}

/* ── Intent prefetch ── */

/** Extract an internal path from an anchor href (`#/path`, `/path`, …). */
function pathFromHref(href: string | null): string | null {
  if (!href) return null;
  if (href.startsWith("#")) return normalizePath(href);
  if (href.startsWith("/")) return normalizePath(href);
  // Absolute URLs, mailto:, tel:, http(s): — not internal navigation.
  return null;
}

function handleIntent(event: Event): void {
  if (isSlowConnection()) return;
  const target = event.target as Element | null;
  const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!anchor) return;

  const path = pathFromHref(anchor.getAttribute("href"));
  if (!path || path === "/") return;

  preloadRoute(path);
}

let installed = false;

/**
 * Install the global intent-prefetch listener and the idle prefetch queue.
 * Idempotent — safe to call more than once.
 */
export function installRoutePrefetch(): void {
  if (installed || typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  installed = true;

  document.addEventListener("pointerover", handleIntent, { passive: true });
  document.addEventListener("pointerdown", handleIntent, { passive: true });
  document.addEventListener("focusin", handleIntent, { passive: true });
  document.addEventListener("touchstart", handleIntent, { passive: true });

  if (document.readyState === "complete") {
    runIdlePrefetch();
  } else {
    window.addEventListener("load", runIdlePrefetch, { once: true });
  }
}
