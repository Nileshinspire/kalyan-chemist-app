import "@vly-ai/integrations";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Route, Routes, useLocation } from "react-router";
import ScrollRestorer from "@/components/ScrollRestorer";
import { useProductTransitionVeil } from "@/lib/product-transition";
import { installRoutePrefetch } from "@/lib/route-preload";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import AIChatbotFloat from "@/components/AIChatbotFloat";
import RouteLoading from "@/components/RouteLoading";
import "./index.css";

const convex = new ConvexReactClient(
  import.meta.env.VITE_CONVEX_URL as string
);

// Warm route chunks from link intent + idle time so navigation feels instant.
installRoutePrefetch();

// ── Customer routes are bundled eagerly ──
// A click must never wait on a route-chunk download. These are the paths real
// shoppers use constantly, so they are ready the moment the app boots. Only
// the heavy/rare admin screens below stay lazy-loaded.
import AboutUs from "./pages/AboutUs.tsx";
import Landing from "./pages/Landing.tsx";
import Auth from "./pages/Auth.tsx";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Products from "./pages/Products.tsx";
import ProductDetail from "./pages/ProductDetail.tsx";
import ValueDealsPage from "./pages/ValueDeals.tsx";
import Cart from "./pages/Cart.tsx";
import Wishlist from "./pages/Wishlist.tsx";
import Checkout from "./pages/Checkout.tsx";
import Orders from "./pages/Orders.tsx";
import OrderDetail from "./pages/OrderDetail.tsx";

// /admin/login is a rare entry point — keep it lazy, but with its own boundary
// so its loader can never take over the whole application.
const LazyAdminLogin = lazy(() => import("./pages/AdminLogin.tsx"));
const AdminLogin = () => (
  <Suspense fallback={<RouteLoading />}>
    <LazyAdminLogin />
  </Suspense>
);
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
const AdminHealthcareDevices = lazy(() => import("./pages/admin/AdminHealthcareDevices"));
const AdminBrands = lazy(() => import("./pages/admin/AdminBrands"));
const AdminInventory = lazy(() => import("./pages/admin/AdminInventory"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons"));
const AdminReviews = lazy(() => import("./pages/admin/AdminReviews"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminReports = lazy(() => import("./pages/admin/AdminReports"));
const AdminDeliverySettings = lazy(() => import("./pages/admin/AdminDeliverySettings"));
const AdminWhatsApp = lazy(() => import("./pages/admin/AdminWhatsApp"));
const AdminPrescriptions = lazy(() => import("./pages/admin/AdminPrescriptions"));
const AdminExpiringMedicines = lazy(() => import("./pages/admin/AdminExpiringMedicines"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminActivityLog = lazy(() => import("./pages/admin/AdminActivityLog"));
const AdminReferralWallet = lazy(() => import("./pages/admin/AdminReferralWalletPage"));
import CategoriesPage from "./pages/Categories.tsx";
import BrandsPage from "./pages/Brands.tsx";
import NotFound from "./pages/NotFound.tsx";
import AccountLayout from "./components/account/AccountLayout";
import AccountOverview from "./pages/account/AccountOverview";
import AccountProfile from "./pages/account/AccountProfile";
import AccountAddresses from "./pages/account/AccountAddresses";
import AccountOrders from "./pages/account/AccountOrders";
import AccountPrescriptions from "./pages/account/AccountPrescriptions";
import AccountNotifications from "./pages/account/AccountNotifications";
import AccountLabReports from "./pages/account/AccountLabReports";
import AccountLabTests from "./pages/account/AccountLabTests";
import AccountDoctorAppointments from "./pages/account/AccountDoctorAppointments";

// /account/wishlist renders the same page as /wishlist.
const AccountWishlist = Wishlist;
import UploadPrescription from "./pages/UploadPrescription";
import DoctorAppointment from "./pages/DoctorAppointment";
import DoctorDetails from "./pages/DoctorDetails";
const AdminDoctors = lazy(() => import("./pages/admin/AdminDoctors"));
const AdminAppointments = lazy(() => import("./pages/admin/AdminAppointments"));
import AccountAppointments from "./pages/account/AccountAppointments";
import LabTests from "./pages/LabTests";
import AccountTrackOrder from "./pages/account/AccountTrackOrder";
import LabTestCategory from "./pages/LabTestCategory";
import LabTestDetail from "./pages/LabTestDetail";
const AdminLabTests = lazy(() => import("./pages/admin/AdminLabTests"));
import AccountHelpSupport from "./pages/account/AccountHelpSupport";
import MedicineRefill from "./pages/MedicineRefill";
import AIChatbot from "./pages/AIChatbot";
const AdminRefills = lazy(() => import("./pages/admin/AdminRefills"));
const AdminChatbot = lazy(() => import("./pages/admin/AdminChatbot"));
const AdminCampaigns = lazy(() => import("./pages/admin/AdminCampaigns"));
// Footer-linked informational pages — lightweight, always immediately available.
import ContactUs from "./pages/ContactUs";
import Faqs from "./pages/Faqs";
import WhyChooseUs from "./pages/WhyChooseUs";
import Careers from "./pages/Careers";
import SitemapPage from "./pages/Sitemap";
import HotSellers from "./pages/HotSellers";
import PolicyPage from "./pages/PolicyPage";

/** Silent error boundary — if VlyToolbar crashes it renders nothing */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[WebContainer preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-6">
          <div className="max-w-lg text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
              <svg
                className="size-8 text-destructive"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-foreground">
              Something went wrong
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {this.state.message}
            </p>
            <button
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function RouteSyncer() {
  const location = useLocation();

  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*"
    );
  }, [location.pathname]);

  // NOTE: Intentionally removed the "navigate" back/forward postMessage handler.
  // It caused duplicate browser-history entries in SPA routing, creating navigation
  // loops where the Back button would return to the same page.

  return null;
}

/** Lifts the product-transition veil once the new route commits. */
function ProductTransitionVeil() {
  useProductTransitionVeil();
  return null;
}

/** Routes with page transitions */
function AnimatedRoutes() {
  const location = useLocation();

  return (
      <Routes location={location}>
        <Route
          path="/about-us"
          element={
            <AboutUs />
          }
        />
        <Route
          path="/"
          element={
            <Landing />
            
          }
        />
        <Route
          path="/auth"
          element={
            <Auth />
            
          }
        />
        <Route
          path="/login"
          element={
            <Login />
            
          }
        />
        <Route
          path="/register"
          element={
            <Register />
            
          }
        />
        <Route
          path="/admin/login"
          element={
            <AdminLogin />
            
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
                <Dashboard />
              </RequireAuth>
            
          }
        />
        <Route
          path="/products"
          element={
            <Products />
            
          }
        />
        <Route
          path="/value-deals"
          element={
            <ValueDealsPage />
            
          }
        />
        <Route
          path="/categories"
          element={
            <CategoriesPage />
            
          }
        />
        <Route
          path="/brands"
          element={
            <BrandsPage />
            
          }
        />
        <Route
          path="/products/:slug"
          element={
            <ProductDetail />
            
          }
        />
        <Route
          path="/cart"
          element={
            <Cart />
            
          }
        />
        <Route
          path="/wishlist"
          element={
            <RequireAuth>
                <Wishlist />
              </RequireAuth>
            
          }
        />
        <Route
          path="/checkout"
          element={
            <RequireAuth>
                <Checkout />
              </RequireAuth>
            
          }
        />
        <Route
          path="/orders"
          element={
            <RequireAuth>
                <Orders />
              </RequireAuth>
            
          }
        />
        <Route
          path="/orders/:id"
          element={
            <RequireAuth>
                <OrderDetail />
              </RequireAuth>
            
          }
        />
        <Route
          path="/upload-prescription"
          element={
            <RequireAuth>
                <UploadPrescription />
              </RequireAuth>
            
          }
        />
        <Route
          path="/doctor-appointment"
          element={
            <DoctorAppointment />
            
          }
        />
        <Route
          path="/refill"
          element={
            <RequireAuth>
                <MedicineRefill />
              </RequireAuth>
            
          }
        />
        <Route
          path="/chatbot"
          element={
            <RequireAuth>
                <AIChatbot />
              </RequireAuth>
            
          }
        />
        <Route
          path="/lab-tests"
          element={
            <RequireAuth>
                <LabTests />
              </RequireAuth>
            
          }
        />
        <Route
          path="/lab-tests/test/:testId"
          element={
            <RequireAuth>
                <LabTestDetail />
              </RequireAuth>
            
          }
        />
        <Route
          path="/lab-tests/:category"
          element={
            <RequireAuth>
                <LabTestCategory />
              </RequireAuth>
            
          }
        />
        <Route
          path="/doctors/:id"
          element={
            <DoctorDetails />
            
          }
        />
        <Route
          path="/account"
          element={
            <RequireAuth>
                <Suspense fallback={<RouteLoading />}>
                  <AccountLayout />
                </Suspense>
              </RequireAuth>
            
          }
        >
          <Route index element={<Suspense fallback={<RouteLoading />}><AccountOverview /></Suspense>} />
          <Route path="profile" element={<Suspense fallback={<RouteLoading />}><AccountProfile /></Suspense>} />
          <Route path="addresses" element={<Suspense fallback={<RouteLoading />}><AccountAddresses /></Suspense>} />
          <Route path="orders" element={<Suspense fallback={<RouteLoading />}><AccountOrders /></Suspense>} />
          <Route path="orders/:id" element={<Suspense fallback={<RouteLoading />}><OrderDetail /></Suspense>} />
          <Route path="prescriptions" element={<Suspense fallback={<RouteLoading />}><AccountPrescriptions /></Suspense>} />
          <Route path="appointments" element={<Suspense fallback={<RouteLoading />}><AccountAppointments /></Suspense>} />
          <Route path="wishlist" element={<Suspense fallback={<RouteLoading />}><AccountWishlist /></Suspense>} />
          <Route path="notifications" element={<Suspense fallback={<RouteLoading />}><AccountNotifications /></Suspense>} />
          <Route path="lab-reports" element={<Suspense fallback={<RouteLoading />}><AccountLabReports /></Suspense>} />
          <Route path="my-lab-tests" element={<Suspense fallback={<RouteLoading />}><AccountLabTests /></Suspense>} />
          <Route path="my-appointments" element={<Suspense fallback={<RouteLoading />}><AccountDoctorAppointments /></Suspense>} />
          <Route path="track-order" element={<Suspense fallback={<RouteLoading />}><AccountTrackOrder /></Suspense>} />
          <Route path="help-support" element={<Suspense fallback={<RouteLoading />}><AccountHelpSupport /></Suspense>} />
          <Route path="refill" element={<Suspense fallback={<RouteLoading />}><MedicineRefill /></Suspense>} />
        </Route>
        <Route
          path="/admin"
          element={
            <RequireAuth adminOnly>
                <AdminDashboard />
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/products"
          element={
            <RequireAuth adminOnly>
                <AdminProducts />
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/categories"
          element={
            <RequireAuth adminOnly>
                <AdminCategories />
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/healthcare-devices"
          element={
            <RequireAuth adminOnly>
                <AdminHealthcareDevices />
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/brands"
          element={
            <RequireAuth adminOnly>
                <AdminBrands />
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/inventory"
          element={
            <RequireAuth adminOnly>
                <AdminInventory />
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/orders"
          element={
            <RequireAuth adminOnly>
                <AdminOrders />
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/reviews"
          element={
            <RequireAuth adminOnly>
                <AdminReviews />
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/coupons"
          element={
            <RequireAuth adminOnly>
                <AdminCoupons />
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireAuth adminOnly>
                <AdminUsers />
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/reports"
          element={
            <RequireAuth adminOnly>
                <AdminReports />
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/delivery"
          element={
            <RequireAuth adminOnly>
                <AdminDeliverySettings />
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/prescriptions"
          element={
            <RequireAuth adminOnly>
                <AdminPrescriptions />
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/whatsapp"
          element={
            <RequireAuth adminOnly>
                <AdminWhatsApp />
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/expiring"
          element={
            <RequireAuth adminOnly>
                <AdminExpiringMedicines />
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/settings"
          element={
            <RequireAuth adminOnly>
                <Suspense fallback={<RouteLoading />}>
                  <AdminSettings />
                </Suspense>
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/doctors"
          element={
            <RequireAuth adminOnly>
                <AdminDoctors />
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/lab-tests"
          element={
            <RequireAuth adminOnly>
                <AdminLabTests />
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/refills"
          element={
            <RequireAuth adminOnly>
                <AdminRefills />
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/campaigns"
          element={
            <RequireAuth adminOnly>
              <Suspense fallback={<RouteLoading />}>
                <AdminCampaigns />
              </Suspense>
            </RequireAuth>
          }
        />
        <Route
          path="/admin/chatbot"
          element={
            <RequireAuth adminOnly>
                <AdminChatbot />
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/appointments"
          element={
            <RequireAuth adminOnly>
                <AdminAppointments />
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/activity"
          element={
            <RequireAuth adminOnly>
                <Suspense fallback={<RouteLoading />}>
                  <AdminActivityLog />
                </Suspense>
              </RequireAuth>
            
          }
        />
        <Route
          path="/admin/referral-wallet"
          element={
            <RequireAuth adminOnly>
                <Suspense fallback={<RouteLoading />}>
                  <AdminReferralWallet />
                </Suspense>
              </RequireAuth>
            
          }
        />
        {/* ── Footer-linked informational pages ── */}
        <Route
          path="/contact-us"
          element={
            <ContactUs />
            
          }
        />
        <Route
          path="/faqs"
          element={
            <Faqs />
            
          }
        />
        <Route
          path="/why-choose-us"
          element={
            <WhyChooseUs />
            
          }
        />
        <Route
          path="/careers"
          element={
            <Careers />
            
          }
        />
        <Route
          path="/sitemap"
          element={
            <SitemapPage />
            
          }
        />
        <Route
          path="/hot-sellers"
          element={
            <HotSellers />
            
          }
        />
        <Route
          path="/privacy-policy"
          element={
            <PolicyPage policyId="privacy" />
            
          }
        />
        <Route
          path="/terms-conditions"
          element={
            <PolicyPage policyId="terms" />
            
          }
        />
        <Route
          path="/shipping-delivery"
          element={
            <PolicyPage policyId="shipping" />
            
          }
        />
        <Route
          path="/cancellation-refund"
          element={
            <PolicyPage policyId="cancellation" />
            
          }
        />
        <Route
          path="/return-policy"
          element={
            <PolicyPage policyId="returns" />
            
          }
        />
        <Route
          path="/prescription-policy"
          element={
            <PolicyPage policyId="prescription" />
            
          }
        />
        <Route
          path="/payment-policy"
          element={
            <PolicyPage policyId="payment" />
            
          }
        />
        <Route
          path="/disclaimer"
          element={
            <PolicyPage policyId="disclaimer" />
            
          }
        />
        <Route
          path="*"
          element={
            <NotFound />
            
          }
        />
      </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
      <AuthProvider>
        <HashRouter>
          <ScrollRestorer />
          <ProductTransitionVeil />
          <RouteSyncer />
          <PageErrorBoundary>
            <AnimatedRoutes />
          </PageErrorBoundary>
          {/* Global floating AI assistant — one instance, customer side only */}
          <AIChatbotFloat />
        </HashRouter>
        <Toaster />
      </AuthProvider>
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>
);
