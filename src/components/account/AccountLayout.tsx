import { NavLink, Outlet } from "react-router";
import { useAuth } from "@/context/AuthContext";
import { AccountLayoutProvider } from "@/context/AccountLayoutContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  User,
  MapPin,
  ClipboardList,
  Pill,
  Bell,
  Heart,
  LogOut,
  Truck,
  Headphones,
  FlaskConical,
  Stethoscope,
  RefreshCw,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/account", label: "My Account", icon: User, end: true },
  { to: "/account/profile", label: "Profile", icon: User },
  { to: "/account/addresses", label: "Addresses", icon: MapPin },
  { to: "/account/orders", label: "My Orders", icon: ClipboardList },
  { to: "/account/track-order", label: "Track Order", icon: Truck },
  { to: "/account/prescriptions", label: "My Prescriptions", icon: Pill },
  { to: "/account/my-lab-tests", label: "My Lab Tests", icon: FlaskConical },
  { to: "/account/my-appointments", label: "My Appointments", icon: Stethoscope },
  { to: "/account/refill", label: "Medicine Refill", icon: RefreshCw },
  { to: "/account/pill-reminders", label: "Pill Reminders", icon: Pill },
  { to: "/account/wishlist", label: "Wishlist", icon: Heart },
  { to: "/account/notifications", label: "Notifications", icon: Bell },
  { to: "/account/help-support", label: "Help & Support", icon: Headphones },
];

export default function AccountLayout() {
  const { logout } = useAuth();

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

          {/* Mobile Header — heading only; account options live in the page body */}
          <div className="lg:hidden">
            <h2 className="text-lg font-bold text-foreground mb-4">My Account</h2>
          </div>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            <AccountLayoutProvider>
              <Outlet />
            </AccountLayoutProvider>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
