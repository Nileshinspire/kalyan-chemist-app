type RoutePreloader = () => Promise<unknown>;

const routePreloaders: Record<string, RoutePreloader> = {
  "/": () => import("@/pages/Landing"),
  "/products": () => import("@/pages/Products"),
  "/categories": () => import("@/pages/Categories"),
  "/cart": () => import("@/pages/Cart"),
  "/wishlist": () => import("@/pages/Wishlist"),
  "/checkout": () => import("@/pages/Checkout"),
  "/account": () => import("@/components/account/AccountLayout"),
  "/account/orders": () => import("@/pages/account/AccountOrders"),
  "/account/prescriptions": () => import("@/pages/account/AccountPrescriptions"),
  "/account/addresses": () => import("@/pages/account/AccountAddresses"),
  "/account/notifications": () => import("@/pages/account/AccountNotifications"),
  "/upload-prescription": () => import("@/pages/UploadPrescription"),
  "/doctor-appointment": () => import("@/pages/DoctorAppointment"),
  "/lab-tests": () => import("@/pages/LabTests"),
  "/refill": () => import("@/pages/MedicineRefill"),
  "/chatbot": () => import("@/pages/AIChatbot"),
};

const inFlightPreloads = new Map<string, Promise<unknown>>();

export function preloadProductDetail() {
  const key = "__product-detail__";
  if (inFlightPreloads.has(key)) return;
  inFlightPreloads.set(key, import("@/pages/ProductDetail").catch(() => undefined));
}

export function preloadRoute(pathname: string) {
  const path = pathname.split("?")[0].split("#")[0];
  const loader = routePreloaders[path] ?? routePreloaders[`/products${path}`];
  if (!loader) return;

  if (inFlightPreloads.has(path)) return;
  inFlightPreloads.set(path, loader().catch(() => undefined));
}
