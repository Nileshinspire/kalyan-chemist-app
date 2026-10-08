import { useState, useEffect, memo, useCallback } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router";
import SubNav from "@/components/layout/SubNav";

import { preloadRoute } from "@/lib/route-preload";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import BrandMark from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Search,
  ShoppingCart,
  User,
  Menu,
  LogOut,
  Home,
  Package,
  ClipboardList,
  Shield,
  X,
} from "lucide-react";

/* ─── Global Category Navigation Items ─── */
const CATEGORY_NAV_ITEMS = [
  { label: "Kalyan Chemist Products", slug: "", key: "all" },
  { label: "Baby Care", slug: "baby-mother", key: "baby-care" },
  { label: "Nutritional Drinks & Supplements", slug: "nutrition", key: "nutrition" },
  { label: "Women Care", slug: "baby-mother", key: "women-care" },
  { label: "Personal Care", slug: "personal-care", key: "personal-care" },
  { label: "Ayurveda", slug: "alternative-medicine", key: "ayurveda" },
  { label: "Health Devices", slug: "health-safety", key: "health-devices" },
  { label: "Home Essentials", slug: "others", key: "home-essentials" },
  { label: "Health Conditions", slug: "health-safety", key: "health-conditions" },
] as const;

/* Live cart-count badge for the header cart icon. Reads the existing reactive
   cart query so it stays in sync on add / remove / quantity change / clear with
   no refresh, and is completely hidden when the cart is empty (never shows 0). */
function CartCountBadge({ count }: { count: number | undefined }) {
  if (count === undefined || count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -right-[6px] -top-[6px] z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E53935] p-0 text-[9.5px] font-semibold leading-none text-white shadow-sm ring-[1.5px] ring-background"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

const Navbar = memo(function Navbar() {
  const { isAuthenticated, isAdmin, user, logout } = useAuth();
  // Reactive total quantity in the user's cart (0 when signed out · empty).
  // Coerce to a number so the badge can only ever render a count.
  const cartCountQuery = useQuery(api.cart.getCount);
  const cartCount = typeof cartCountQuery === "number" ? cartCountQuery : 0;
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Track scroll for navbar background enhancement. The listener is throttled to
  // one read per animation frame: a raw scroll handler runs on every event the
  // browser emits (often several per frame) and each `setScrolled` re-renders
  // the entire header stack. The value is a boolean, so it only re-renders when
  // the customer actually crosses the 10px threshold.
  useEffect(() => {
    let frame = 0;
    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        setScrolled(window.scrollY > 10);
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  }, [searchQuery, navigate]);

  const handleSignOut = useCallback(async () => {
    await logout();
    navigate("/");
  }, [logout, navigate]);

  const handleCategoryNav = useCallback((slug: string, key: string) => {
    if (slug) {
      navigate(`/products?category=${slug}&nav=${key}`);
    } else {
      navigate(`/products?nav=all`);
    }
  }, [navigate]);

  const isActive = useCallback((path: string) => location.pathname === path, [location.pathname]);

  const isHomePage = location.pathname === "/";

  return (
    <>
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "glass-strong shadow-md shadow-primary/[0.03]"
          : "glass-strong shadow-sm"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 sm:px-6 py-2.5 sm:gap-4 sm:py-3">
        {/* Logo */}
        <div
          className="flex items-center gap-2.5 cursor-pointer shrink-0 group"
          onClick={() => navigate("/")}
        >
          <BrandMark className="size-9 transition-all duration-300 group-hover:scale-105" />
          <div className="hidden sm:block leading-tight">
            <span className="text-base font-bold tracking-tight text-foreground">
              Kalyan Chemist
            </span>
            <span className="block text-[10px] font-medium uppercase tracking-widest text-primary/60">
              Trusted Pharmacy
            </span>
          </div>
        </div>

        {/* Search — desktop (hidden on homepage where hero has its own search) */}
        {!isHomePage && (
        <form
          onSubmit={handleSearch}
          className="hidden md:flex flex-1 max-w-md ml-4"
        >
          <div
            className={`relative w-full transition-all duration-300 ${
              searchFocused ? "scale-[1.02]" : ""
            }`}
          >
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search medicines, brands…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className={`pl-9 h-10 rounded-xl border transition-all duration-300 ${
                searchFocused
                  ? "bg-background border-primary/30 shadow-glow"
                  : "bg-muted/40 border-border/40 hover:border-border/70"
              }`}
            />
          </div>
        </form>
        )}

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 ml-auto">
          <Button
            variant={isActive("/products") ? "secondary" : "ghost"}
            size="sm"
            className="text-sm font-medium rounded-xl hover:bg-primary/5"
            onMouseEnter={() => preloadRoute("/products")}
            onFocus={() => preloadRoute("/products")}
            onClick={() => navigate("/products")}
          >
            <Package className="mr-1.5 size-3.5" />
            Medicines
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-xl hover:bg-primary/5"
            aria-label={
              cartCount
                ? `Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`
                : "Cart"
            }
            onMouseEnter={() => preloadRoute("/cart")}
            onFocus={() => preloadRoute("/cart")}
            onClick={() => navigate("/cart")}
          >
            <span className="relative inline-flex">
              <ShoppingCart className="size-4" />
              <CartCountBadge count={cartCount} />
            </span>
          </Button>

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-1 rounded-xl hover:bg-primary/5"
                >
                  <User className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-52 rounded-xl border-border/60 shadow-lg"
              >
                <DropdownMenuItem
                  onMouseEnter={() => preloadRoute("/account")}
                  onFocus={() => preloadRoute("/account")}
                  onClick={() => navigate("/account")}
                  className="rounded-lg cursor-pointer"
                >
                  <User className="mr-2 size-4" />
                  My Account
                </DropdownMenuItem>
                <DropdownMenuItem
                  onMouseEnter={() => preloadRoute("/account/orders")}
                  onFocus={() => preloadRoute("/account/orders")}
                  onClick={() => navigate("/account/orders")}
                  className="rounded-lg cursor-pointer"
                >
                  <ClipboardList className="mr-2 size-4" />
                  My Orders
                </DropdownMenuItem>
                <DropdownMenuItem
                  onMouseEnter={() => preloadRoute("/cart")}
                  onFocus={() => preloadRoute("/cart")}
                  onClick={() => navigate("/cart")}
                  className="rounded-lg cursor-pointer"
                >
                  <ShoppingCart className="mr-2 size-4" />
                  Cart
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => navigate("/admin")}
                      className="rounded-lg cursor-pointer"
                    >
                      <Shield className="mr-2 size-4" />
                      Admin Panel
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-destructive focus:text-destructive rounded-lg cursor-pointer"
                >
                  <LogOut className="mr-2 size-4" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              size="sm"
              className="text-sm font-semibold ml-1 rounded-xl gradient-primary text-white shadow-glow hover:shadow-card-hover transition-all"
              onClick={() =>
                navigate(
                  `/login?returnTo=${encodeURIComponent(location.pathname)}`
                )
              }
            >
              Sign In
            </Button>
          )}
        </nav>

        {/* Mobile menu button */}
        <div className="flex md:hidden items-center gap-2 ml-auto">
          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-xl"
            aria-label={
              cartCount
                ? `Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`
                : "Cart"
            }
            onMouseEnter={() => preloadRoute("/cart")}
            onFocus={() => preloadRoute("/cart")}
            onClick={() => navigate("/cart")}
          >
            <span className="relative inline-flex">
              <ShoppingCart className="size-4" />
              <CartCountBadge count={cartCount} />
            </span>
          </Button>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-xl">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 p-0 border-border/30">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-4 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <BrandMark className="size-7" />
                    <span className="font-bold text-sm">Menu</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-xl"
                    onClick={() => setMobileOpen(false)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                <div className="p-4 flex-1 overflow-y-auto">
                  <form onSubmit={handleSearch} className="mb-4">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        placeholder="Search medicines…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-10 rounded-xl"
                      />
                    </div>
                  </form>
                  <nav className="flex flex-col gap-1">
                    <Button
                      variant="ghost"
                      className="justify-start rounded-xl h-10"
                      onClick={() => {
                        navigate("/");
                        setMobileOpen(false);
                      }}
                    >
                      <Home className="mr-2 size-4" />
                      Home
                    </Button>
                    <Button
                      variant="ghost"
                      className="justify-start rounded-xl h-10"
                      onMouseEnter={() => preloadRoute("/products")}
                      onFocus={() => preloadRoute("/products")}
                      onClick={() => {
                        navigate("/products");
                        setMobileOpen(false);
                      }}
                    >
                      <Package className="mr-2 size-4" />
                      Browse Medicines
                    </Button>
                    {/* Mobile category links */}
                    <div className="mt-2 mb-2 px-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        Categories
                      </p>
                    </div>
                    {CATEGORY_NAV_ITEMS.map((cat) => (
                      <Button
                        key={cat.key}
                        variant="ghost"
                        className="justify-start rounded-xl h-9 text-xs"
                        onMouseEnter={() => preloadRoute("/products")}
                        onFocus={() => preloadRoute("/products")}
                        onClick={() => {
                          handleCategoryNav(cat.slug, cat.key);
                          setMobileOpen(false);
                        }}
                      >
                        {cat.label}
                      </Button>
                    ))}
                    {isAuthenticated && (
                      <>
                        <div className="my-2 border-t border-border/40" />
                        <Button
                          variant="ghost"
                          className="justify-start rounded-xl h-10"
                          onMouseEnter={() => preloadRoute("/account")}
                          onFocus={() => preloadRoute("/account")}
                          onClick={() => {
                            navigate("/account");
                            setMobileOpen(false);
                          }}
                        >
                          <User className="mr-2 size-4" />
                          My Account
                        </Button>
                        <Button
                          variant="ghost"
                          className="justify-start rounded-xl h-10"
                          onMouseEnter={() => preloadRoute("/account/orders")}
                          onFocus={() => preloadRoute("/account/orders")}
                          onClick={() => {
                            navigate("/account/orders");
                            setMobileOpen(false);
                          }}
                        >
                          <ClipboardList className="mr-2 size-4" />
                          My Orders
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      className="justify-start rounded-xl h-10"
                      onMouseEnter={() => preloadRoute("/cart")}
                      onFocus={() => preloadRoute("/cart")}
                      onClick={() => {
                        navigate("/cart");
                        setMobileOpen(false);
                      }}
                    >
                      <ShoppingCart className="mr-2 size-4" />
                      Cart
                    </Button>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        className="justify-start rounded-xl h-10"
                        onClick={() => {
                          navigate("/admin");
                          setMobileOpen(false);
                        }}
                      >
                        <Shield className="mr-2 size-4" />
                        Admin Panel
                      </Button>
                    )}
                  </nav>
                </div>
                <div className="mt-auto p-4 border-t border-border/40">
                  {isAuthenticated ? (
                    <div className="space-y-2">
                      <div className="px-3 py-2">
                        <p className="text-sm font-medium text-foreground">
                          {user?.name || "User"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {user?.email}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full rounded-xl h-10"
                        onClick={() => {
                          handleSignOut();
                          setMobileOpen(false);
                        }}
                      >
                        <LogOut className="mr-2 size-4" />
                        Sign Out
                      </Button>
                    </div>
                  ) : (
                    <Button
                      className="w-full font-semibold rounded-xl h-10 gradient-primary text-white"
                      onClick={() => {
                        navigate(
                          `/login?returnTo=${encodeURIComponent(
                            location.pathname
                          )}`
                        );
                        setMobileOpen(false);
                      }}
                    >
                      Sign In
                    </Button>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Search — mobile row (Apollo-style full-width search under the header
          row). Below `md` Row 1 only carries the logo / cart / menu, so without
          this row phones had no visible search outside the menu sheet. Hidden
          from `md` up, where Row 1 already carries the desktop search, so the
          laptop/desktop header is byte-for-byte unchanged. Skipped on the
          homepage, whose hero already owns the primary search (same rule the
          desktop search follows above). */}
      {!isHomePage && (
        <form
          onSubmit={handleSearch}
          role="search"
          aria-label="Search medicines"
          className="md:hidden mx-auto max-w-7xl px-4 sm:px-6 pb-2.5 sm:pb-3"
        >
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search medicines, brands…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-muted/40 border-border/40 hover:border-border/70"
            />
          </div>
        </form>
      )}

      {/* ═══════════════════════════════════════════════════════
          GLOBAL CATEGORY NAVIGATION BAR
          Only render on homepage — inner pages get it via SubNav
          ═══════════════════════════════════════════════════════ */}
      {isHomePage && (
      <nav className="hidden md:block" style={{ background: '#0a3d2e' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-none pr-6">
            {CATEGORY_NAV_ITEMS.map((cat) => {
              const currentNavKey = searchParams.get("nav") || "";
              const isCurrentCategory = currentNavKey === cat.key;
              return (
                <button
                  type="button"
                  key={cat.key}
                  onMouseEnter={() => preloadRoute("/products")}
                  onFocus={() => preloadRoute("/products")}
                  onClick={() => handleCategoryNav(cat.slug, cat.key)}
                  className="relative px-3 lg:px-4 py-2.5 text-xs lg:text-sm font-medium whitespace-nowrap transition-all duration-200 shrink-0 cursor-pointer"
                  style={{ color: '#FFFFFF' }}
                >
                  {cat.label}
                  {isCurrentCategory && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-white rounded-full" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>
      )}
      {/* SubNav carries Row 2 (quick actions) and Row 3 (green category nav) on
          inner pages. It lives INSIDE the sticky <header> so the whole existing
          stack (Row 1 → 2 → 3) sticks as one block. On the homepage Row 3 is
          already rendered above and SubNav is not used. */}
      {!isHomePage && <SubNav />}
    </header>
    </>);
});

export default Navbar;
