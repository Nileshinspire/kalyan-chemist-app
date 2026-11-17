import { useNavigate, useLocation } from "react-router";
import { useAuth } from "@/context/AuthContext";
import { Home, LayoutGrid, Tags, User } from "lucide-react";
import { preloadRoute } from "@/lib/route-preload";

/**
 * Mobile-only bottom navigation bar (Home · Categories · Offers · Account).
 *
 * A single instance is mounted at the app root. It is `md:hidden`, so desktop
 * and laptop screens are byte-for-byte unchanged. All four destinations reuse
 * EXISTING routes and the existing auth state — no new navigation or business
 * logic. "Offers" opens the existing Value Deals Under ₹100 page, which is
 * driven by the same deals/discount data the homepage section uses. The cart
 * stays in the top mobile header with its badge and full functionality.
 *
 * Hidden on the admin area (which has its own layout) and on the full-screen
 * chatbot, matching the existing floating-button visibility rules.
 */
export default function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  const pathname = location.pathname;
  if (pathname.startsWith("/admin") || pathname === "/chatbot") return null;

  const isActive = (key: string) => {
    switch (key) {
      case "home":
        return pathname === "/";
      case "categories":
        return pathname.startsWith("/categories");
      case "offers":
        return pathname === "/value-deals";
      case "account":
        return pathname.startsWith("/account");
      default:
        return false;
    }
  };

  const items = [
    { key: "home", label: "Home", icon: Home, to: "/" },
    { key: "categories", label: "Categories", icon: LayoutGrid, to: "/categories" },
    { key: "offers", label: "Offers", icon: Tags, to: "/value-deals" },
    {
      key: "account",
      label: "Account",
      icon: User,
      // Guests get the sign-in flow and land on My Account afterwards.
      to: isAuthenticated ? "/account" : `/login?returnTo=${encodeURIComponent("/account")}`,
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
