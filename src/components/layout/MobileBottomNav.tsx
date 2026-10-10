import { useNavigate, useLocation } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/context/AuthContext";
import { Home, LayoutGrid, ShoppingCart, User } from "lucide-react";
import { preloadRoute } from "@/lib/route-preload";

/**
 * Mobile-only bottom navigation bar (Home · Categories · Cart · Account).
 *
 * A single instance is mounted at the app root. It is `md:hidden`, so desktop
 * and laptop screens are byte-for-byte unchanged. All four destinations reuse
 * the EXISTING routes, the reactive cart query (same source as the header
 * badge) and the existing auth state — no new navigation or business logic.
 *
 * Hidden on the admin area (which has its own layout) and on the full-screen
 * chatbot, matching the existing floating-button visibility rules.
 */
export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  // Same reactive source as the header cart badge — stays in sync with no refresh.
  const cartCountQuery = useQuery(api.cart.getCount);
  const cartCount = typeof cartCountQuery === "number" ? cartCountQuery : 0;

  const pathname = location.pathname;
  if (pathname.startsWith("/admin") || pathname === "/chatbot") return null;

  const isActive = (key: string) => {
    switch (key) {
      case "home":
        return pathname === "/";
      case "categories":
        return pathname.startsWith("/categories");
      case "cart":
        return pathname === "/cart";
      case "account":
        return pathname.startsWith("/account");
      default:
        return false;
    }
  };

  const items = [
    { key: "home", label: "Home", icon: Home, to: "/" },
    { key: "categories", label: "Categories", icon: LayoutGrid, to: "/categories" },
    { key: "cart", label: "Cart", icon: ShoppingCart, to: "/cart" },
    {
      key: "account",
      label: "Account",
      icon: User,
      to: isAuthenticated ? "/account" : "/login",
    },
  ] as const;

  return (
    <>
      {/* In-flow spacer so the fixed bar never covers the end of the page
          (footer, checkout controls). Desktop/laptop: `md:hidden`, no height. */}
      <div
        aria-hidden="true"
        className="h-[calc(3.5rem+env(safe-area-inset-bottom))] md:hidden"
      />
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden"
      >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {items.map((item) => {
          const active = isActive(item.key);
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              type="button"
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              onMouseEnter={() => preloadRoute(item.to)}
              onFocus={() => preloadRoute(item.to)}
              onClick={() => navigate(item.to)}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors duration-200 ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className="relative inline-flex">
                <Icon className="size-5" />
                {item.key === "cart" && cartCount > 0 && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E53935] px-0.5 text-[9.5px] font-semibold leading-none text-white shadow-sm ring-[1.5px] ring-background"
                  >
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
    </>
  );
}
