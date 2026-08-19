import { useState, useEffect, memo } from "react";
import { useNavigate, useLocation } from "react-router";
import { useAuth } from "@/context/AuthContext";
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
import { motion } from "framer-motion";
import {
  Search,
  ShoppingCart,
  Heart,
  User,
  Menu,
  LogOut,
  Home,
  Package,
  ClipboardList,
  Shield,
  X,
} from "lucide-react";

const Navbar = memo(function Navbar() {
  const { isAuthenticated, isAdmin, user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Track scroll for navbar background enhancement
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
    }
  };

  const handleSignOut = async () => {
    await logout();
    navigate("/");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-all duration-300 ${
        scrolled
          ? "glass-strong border-border/20 shadow-md shadow-primary/[0.03]"
          : "glass-strong border-border/30 shadow-sm"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 sm:px-6 py-3">
        {/* Logo */}
        <div
          className="flex items-center gap-2.5 cursor-pointer shrink-0 group"
          onClick={() => navigate("/")}
        >
          <div className="flex size-9 items-center justify-center rounded-xl gradient-primary text-white font-bold text-sm shadow-glow group-hover:shadow-card-hover group-hover:scale-105 transition-all duration-300">
            KC
          </div>
          <div className="hidden sm:block leading-tight">
            <span className="text-base font-bold tracking-tight text-foreground">
              Kalyan Chemist
            </span>
            <span className="block text-[10px] font-medium uppercase tracking-widest text-primary/60">
              Trusted Pharmacy
            </span>
          </div>
        </div>

        {/* Search — desktop */}
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

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 ml-auto">
          <Button
            variant={isActive("/products") ? "secondary" : "ghost"}
            size="sm"
            className="text-sm font-medium rounded-xl hover:bg-primary/5"
            onClick={() => navigate("/products")}
          >
            <Package className="mr-1.5 size-3.5" />
            Medicines
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="relative rounded-xl hover:bg-primary/5"
            onClick={() => navigate("/cart")}
          >
            <ShoppingCart className="size-4" />
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
                  onClick={() => navigate("/dashboard")}
                  className="rounded-lg cursor-pointer"
                >
                  <Home className="mr-2 size-4" />
                  Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate("/orders")}
                  className="rounded-lg cursor-pointer"
                >
                  <ClipboardList className="mr-2 size-4" />
                  My Orders
                </DropdownMenuItem>
                <DropdownMenuItem
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
            onClick={() => navigate("/cart")}
          >
            <ShoppingCart className="size-4" />
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
                    <div className="flex size-7 items-center justify-center rounded-lg gradient-primary text-white font-bold text-[10px]">
                      KC
                    </div>
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
                <div className="p-4 flex-1">
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
                      onClick={() => {
                        navigate("/products");
                        setMobileOpen(false);
                      }}
                    >
                      <Package className="mr-2 size-4" />
                      Browse Medicines
                    </Button>
                    {isAuthenticated && (
                      <>
                        <Button
                          variant="ghost"
                          className="justify-start rounded-xl h-10"
                          onClick={() => {
                            navigate("/orders");
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
    </header>
  );
});

export default Navbar;
