import "@vly-ai/integrations";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { motion } from "framer-motion";
import ScrollRestorer from "@/components/ScrollRestorer";
import { PageErrorBoundary } from "@/components/PageErrorBoundary";
import "./index.css";

const convex = new ConvexReactClient(
  import.meta.env.VITE_CONVEX_URL as string
);

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const Auth = lazy(() => import("./pages/Auth.tsx"));
const Login = lazy(() => import("./pages/Login.tsx"));
const Register = lazy(() => import("./pages/Register.tsx"));
const AdminLogin = lazy(() => import("./pages/AdminLogin.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const Products = lazy(() => import("./pages/Products.tsx"));
const ProductDetail = lazy(() => import("./pages/ProductDetail.tsx"));
const Cart = lazy(() => import("./pages/Cart.tsx"));
const Wishlist = lazy(() => import("./pages/Wishlist.tsx"));
const Checkout = lazy(() => import("./pages/Checkout.tsx"));
const Orders = lazy(() => import("./pages/Orders.tsx"));
const OrderDetail = lazy(() => import("./pages/OrderDetail.tsx"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminCategories = lazy(() => import("./pages/admin/AdminCategories"));
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
const CategoriesPage = lazy(() => import("./pages/Categories.tsx"));
const BrandsPage = lazy(() => import("./pages/Brands.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const AccountLayout = lazy(() => import("./components/account/AccountLayout"));
const AccountOverview = lazy(() => import("./pages/account/AccountOverview"));
const AccountProfile = lazy(() => import("./pages/account/AccountProfile"));
const AccountAddresses = lazy(() => import("./pages/account/AccountAddresses"));
const AccountOrders = lazy(() => import("./pages/account/AccountOrders"));
const AccountPrescriptions = lazy(() => import("./pages/account/AccountPrescriptions"));
const AccountWishlist = lazy(() => import("./pages/Wishlist"));
const AccountNotifications = lazy(() => import("./pages/account/AccountNotifications"));
const AccountTrackOrder = lazy(() => import("./pages/account/AccountTrackOrder"));
const AccountHelpSupport = lazy(() => import("./pages/account/AccountHelpSupport"));

/** Animated loading skeleton for route transitions */
function RouteLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="size-12 rounded-xl bg-primary/10 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        </div>
        <p className="text-sm font-medium text-muted-foreground animate-pulse">
          Loading…
        </p>
      </div>
    </div>
  );
}

/** Wrapper that adds a subtle fade-in animation to page transitions */
function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

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

/** Routes with page transitions */
function AnimatedRoutes() {
  const location = useLocation();

  return (
      <Routes location={location}>
        <Route
          path="/"
          element={
            <PageTransition>
              <Landing />
            </PageTransition>
          }
        />
        <Route
          path="/auth"
          element={
            <PageTransition>
              <Auth />
            </PageTransition>
          }
        />
        <Route
          path="/login"
          element={
            <PageTransition>
              <Login />
            </PageTransition>
          }
        />
        <Route
          path="/register"
          element={
            <PageTransition>
              <Register />
            </PageTransition>
          }
        />
        <Route
          path="/admin/login"
          element={
            <PageTransition>
              <AdminLogin />
            </PageTransition>
          }
        />
        <Route
          path="/dashboard"
          element={
            <PageTransition>
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            </PageTransition>
          }
        />
        <Route
          path="/products"
          element={
            <PageTransition>
              <Products />
            </PageTransition>
          }
        />
        <Route
          path="/categories"
          element={
            <PageTransition>
              <CategoriesPage />
            </PageTransition>
          }
        />
        <Route
          path="/brands"
          element={
            <PageTransition>
              <BrandsPage />
            </PageTransition>
          }
        />
        <Route
          path="/products/:slug"
          element={
            <PageTransition>
              <ProductDetail />
            </PageTransition>
          }
        />
        <Route
          path="/cart"
          element={
            <PageTransition>
              <Cart />
            </PageTransition>
          }
        />
        <Route
          path="/wishlist"
          element={
            <PageTransition>
              <RequireAuth>
                <Wishlist />
              </RequireAuth>
            </PageTransition>
          }
        />
        <Route
          path="/checkout"
          element={
            <PageTransition>
              <RequireAuth>
                <Checkout />
              </RequireAuth>
            </PageTransition>
          }
        />
        <Route
          path="/orders"
          element={
            <PageTransition>
              <RequireAuth>
                <Orders />
              </RequireAuth>
            </PageTransition>
          }
        />
        <Route
          path="/orders/:id"
          element={
            <PageTransition>
              <RequireAuth>
                <OrderDetail />
              </RequireAuth>
            </PageTransition>
          }
        />
        <Route
          path="/account"
          element={
            <PageTransition>
              <RequireAuth>
                <Suspense fallback={<RouteLoading />}>
                  <AccountLayout />
                </Suspense>
              </RequireAuth>
            </PageTransition>
          }
        >
          <Route index element={<Suspense fallback={<RouteLoading />}><AccountOverview /></Suspense>} />
          <Route path="profile" element={<Suspense fallback={<RouteLoading />}><AccountProfile /></Suspense>} />
          <Route path="addresses" element={<Suspense fallback={<RouteLoading />}><AccountAddresses /></Suspense>} />
          <Route path="orders" element={<Suspense fallback={<RouteLoading />}><AccountOrders /></Suspense>} />
          <Route path="orders/:id" element={<Suspense fallback={<RouteLoading />}><OrderDetail /></Suspense>} />
          <Route path="prescriptions" element={<Suspense fallback={<RouteLoading />}><AccountPrescriptions /></Suspense>} />
          <Route path="wishlist" element={<Suspense fallback={<RouteLoading />}><AccountWishlist /></Suspense>} />
          <Route path="notifications" element={<Suspense fallback={<RouteLoading />}><AccountNotifications /></Suspense>} />
          <Route path="track-order" element={<Suspense fallback={<RouteLoading />}><AccountTrackOrder /></Suspense>} />
          <Route path="help-support" element={<Suspense fallback={<RouteLoading />}><AccountHelpSupport /></Suspense>} />
        </Route>
        <Route
          path="/admin"
          element={
            <PageTransition>
              <RequireAuth adminOnly>
                <AdminDashboard />
              </RequireAuth>
            </PageTransition>
          }
        />
        <Route
          path="/admin/products"
          element={
            <PageTransition>
              <RequireAuth adminOnly>
                <AdminProducts />
              </RequireAuth>
            </PageTransition>
          }
        />
        <Route
          path="/admin/categories"
          element={
            <PageTransition>
              <RequireAuth adminOnly>
                <AdminCategories />
              </RequireAuth>
            </PageTransition>
          }
        />
        <Route
          path="/admin/brands"
          element={
            <PageTransition>
              <RequireAuth adminOnly>
                <AdminBrands />
              </RequireAuth>
            </PageTransition>
          }
        />
        <Route
          path="/admin/inventory"
          element={
            <PageTransition>
              <RequireAuth adminOnly>
                <AdminInventory />
              </RequireAuth>
            </PageTransition>
          }
        />
        <Route
          path="/admin/orders"
          element={
            <PageTransition>
              <RequireAuth adminOnly>
                <AdminOrders />
              </RequireAuth>
            </PageTransition>
          }
        />
        <Route
          path="/admin/reviews"
          element={
            <PageTransition>
              <RequireAuth adminOnly>
                <AdminReviews />
              </RequireAuth>
            </PageTransition>
          }
        />
        <Route
          path="/admin/coupons"
          element={
            <PageTransition>
              <RequireAuth adminOnly>
                <AdminCoupons />
              </RequireAuth>
            </PageTransition>
          }
        />
        <Route
          path="/admin/users"
          element={
            <PageTransition>
              <RequireAuth adminOnly>
                <AdminUsers />
              </RequireAuth>
            </PageTransition>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <PageTransition>
              <RequireAuth adminOnly>
                <AdminReports />
              </RequireAuth>
            </PageTransition>
          }
        />
        <Route
          path="/admin/delivery"
          element={
            <PageTransition>
              <RequireAuth adminOnly>
                <AdminDeliverySettings />
              </RequireAuth>
            </PageTransition>
          }
        />
        <Route
          path="/admin/prescriptions"
          element={
            <PageTransition>
              <RequireAuth adminOnly>
                <AdminPrescriptions />
              </RequireAuth>
            </PageTransition>
          }
        />
        <Route
          path="/admin/whatsapp"
          element={
            <PageTransition>
              <RequireAuth adminOnly>
                <AdminWhatsApp />
              </RequireAuth>
            </PageTransition>
          }
        />
        <Route
          path="/admin/expiring"
          element={
            <PageTransition>
              <RequireAuth adminOnly>
                <AdminExpiringMedicines />
              </RequireAuth>
            </PageTransition>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <PageTransition>
              <RequireAuth adminOnly>
                <Suspense fallback={<RouteLoading />}>
                  <AdminSettings />
                </Suspense>
              </RequireAuth>
            </PageTransition>
          }
        />
        <Route
          path="/admin/activity"
          element={
            <PageTransition>
              <RequireAuth adminOnly>
                <Suspense fallback={<RouteLoading />}>
                  <AdminActivityLog />
                </Suspense>
              </RequireAuth>
            </PageTransition>
          }
        />
        <Route
          path="*"
          element={
            <PageTransition>
              <NotFound />
            </PageTransition>
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
        <BrowserRouter>
          <ScrollRestorer />
          <RouteSyncer />
          <PageErrorBoundary>
            <Suspense fallback={<RouteLoading />}>
              <AnimatedRoutes />
            </Suspense>
          </PageErrorBoundary>
        </BrowserRouter>
        <Toaster />
      </AuthProvider>
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>
);
