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
  Ticket,
  Settings,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

const NAV_ITEMS = [
  { to: "/account", labelKey: "myAccount", icon: User, end: true },
  { to: "/account/profile", labelKey: "profile", icon: User },
  { to: "/account/addresses", labelKey: "addresses", icon: MapPin },
  { to: "/account/orders", labelKey: "myOrders", icon: ClipboardList },
  { to: "/account/track-order", labelKey: "trackOrder", icon: Truck },
  { to: "/account/prescriptions", labelKey: "myPrescriptions", icon: Pill },
  { to: "/account/my-lab-tests", labelKey: "myLabTests", icon: FlaskConical },
  { to: "/account/my-appointments", labelKey: "myAppointments", icon: Stethoscope },
  { to: "/account/refill", labelKey: "medicineRefill", icon: RefreshCw },
  { to: "/account/pill-reminders", labelKey: "pillReminders", icon: Pill },
  { to: "/account/my-coupons", labelKey: "myCoupons", icon: Ticket },
  { to: "/account/wishlist", labelKey: "wishlist", icon: Heart },
  { to: "/account/notifications", labelKey: "notifications", icon: Bell },
  { to: "/account/settings", labelKey: "settings", icon: Settings },
  { to: "/account/help-support", labelKey: "helpSupport", icon: Headphones },
];

export default function AccountLayout() {
  const { logout } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 mx-auto max-w-7xl w-full px-4 sm:px-6 py-8">
        <div className="flex flex-col lg:flex-row gap-8 max-lg:gap-5">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div className="sticky top-24">
              <div className="mb-6">
                <h2 className="text-lg font-bold text-foreground">{t("myAccount")}</h2>
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
                    {t(item.labelKey)}
                  </NavLink>
                ))}
                <button
                  onClick={() => logout()}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/5 w-full transition-all duration-200 mt-2"
                >
                  <LogOut className="size-4" />
                  {t("logout")}
                </button>
              </nav>
            </div>
          </aside>

          {/* Mobile Header — heading only; spacing comes from the column gap */}
          <div className="lg:hidden">
            <h2 className="text-lg font-bold text-foreground">{t("myAccount")}</h2>
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
