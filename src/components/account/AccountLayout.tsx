import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  User,
  MapPin,
  ClipboardList,
  Pill,
  Bell,
  Heart,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

const NAV_ITEMS = [
  { to: "/account", label: "My Account", icon: User, end: true },
  { to: "/account/profile", label: "Profile", icon: User },
  { to: "/account/addresses", label: "Addresses", icon: MapPin },
  { to: "/account/orders", label: "My Orders", icon: ClipboardList },
  { to: "/account/prescriptions", label: "Prescriptions", icon: Pill },
  { to: "/account/wishlist", label: "Wishlist", icon: Heart },
  { to: "/account/notifications", label: "Notifications", icon: Bell },
];

export default function AccountLayout() {
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-foreground">My Account</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage your profile and orders
                </p>
              </div>
              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`
                    }
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </NavLink>
                ))}
                <button
                  onClick={() => logout()}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 w-full transition-all duration-200 mt-2"
                >
                  <LogOut className="size-4" />
                  Logout
                </button>
              </nav>
            </div>
          </aside>

          {/* Mobile Header */}
          <div className="lg:hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">My Account</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileOpen(!mobileOpen)}
                className="gap-2"
              >
                {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
                Menu
              </Button>
            </div>
            {mobileOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 bg-card border border-border/60 rounded-xl p-3"
              >
                <nav className="space-y-1">
                  {NAV_ITEMS.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setMobileOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        }`
                      }
                    >
                      <item.icon className="size-4" />
                      {item.label}
                    </NavLink>
                  ))}
                  <button
                    onClick={() => logout()}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 w-full transition-all duration-200"
                  >
                    <LogOut className="size-4" />
                    Logout
                  </button>
                </nav>
              </motion.div>
            )}
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            {location.pathname !== "/account" && (
              <Button
                variant="ghost"
                size="sm"
                className="mb-4 gap-1.5 text-muted-foreground rounded-xl"
                onClick={() => navigate("/account")}
              >
                <ArrowLeft className="size-4" /> Back to Account
              </Button>
            )}
            <Outlet />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
