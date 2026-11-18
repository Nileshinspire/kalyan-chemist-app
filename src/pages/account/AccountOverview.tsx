import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import WalletReferSection from "@/components/account/WalletReferSection";
import { RestockAlertsCard } from "@/components/account/RestockAlertsCard";
import { motion } from "framer-motion";
import {
  User,
  MapPin,
  ClipboardList,
  Heart,
  Pill,
  Bell,
  ArrowRight,
  Shield,
  Truck,
  FlaskConical,
  Stethoscope,
  RefreshCw,
  Headphones,
  LogOut,
  type LucideIcon,
} from "lucide-react";

// Mobile-only account options, inserted above Wallet & Refer. Same routes,
// icons and ordering as the account sidebar.
const ACCOUNT_OPTIONS = [
  { to: "/account/profile", label: "Profile", icon: User, description: "Update your name, email, and phone" },
  { to: "/account/addresses", label: "Addresses", icon: MapPin, description: "Add or edit delivery addresses" },
  { to: "/account/orders", label: "My Orders", icon: ClipboardList, description: "Track your recent orders" },
  { to: "/account/track-order", label: "Track Order", icon: Truck, description: "Follow a delivery in progress" },
  { to: "/account/prescriptions", label: "My Prescriptions", icon: Pill, description: "Track, view and download prescriptions" },
  { to: "/account/my-lab-tests", label: "My Lab Tests", icon: FlaskConical, description: "View your lab test bookings" },
  { to: "/account/my-appointments", label: "My Appointments", icon: Stethoscope, description: "Manage doctor appointments" },
  { to: "/account/refill", label: "Medicine Refill", icon: RefreshCw, description: "Reorder your regular medicines" },
  { to: "/account/pill-reminders", label: "Pill Reminders", icon: Pill, description: "Set reminders for your medicines" },
  { to: "/account/wishlist", label: "Wishlist", icon: Heart, description: "Products you saved for later" },
  { to: "/account/notifications", label: "Notifications", icon: Bell, description: "Order updates and offers" },
  { to: "/account/help-support", label: "Help & Support", icon: Headphones, description: "Get help with your account and orders" },
];

const QUICK_LINKS = [
  { to: "/account/profile", label: "Edit Profile", icon: User, description: "Update your name, email, and phone" },
  { to: "/account/addresses", label: "Manage Addresses", icon: MapPin, description: "Add or edit delivery addresses" },
  { to: "/account/orders", label: "View Orders", icon: ClipboardList, description: "Track your recent orders" },
  { to: "/account/prescriptions", label: "My Prescriptions", icon: Pill, description: "Track, view and download prescriptions" },
  { to: "/account/wishlist", label: "Wishlist", icon: Heart, description: "Products you saved for later" },
  { to: "/account/notifications", label: "Notifications", icon: Bell, description: "Order updates and offers" },
];

function AccountOptionCard({
  label,
  description,
  icon: Icon,
  onClick,
}: {
  label: string;
  description: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  return (
    <Card
      className="group cursor-pointer border-border/60 hover:shadow-card-hover hover:border-primary/20 transition-all duration-300"
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
            <Icon className="size-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {label}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
          <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AccountOverview() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Welcome Banner */}
      <div className="bg-gradient-to-br from-primary/[0.08] to-primary/[0.02] border border-primary/10 rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <User className="size-7 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Welcome back, {user?.name || "User"}!
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {user?.email || "Manage your account settings"}
            </p>
          </div>
        </div>
      </div>

      {/* Account options — mobile only, above Wallet & Refer */}
      <div className="grid gap-3 lg:hidden">
        {ACCOUNT_OPTIONS.map((option) => (
          <AccountOptionCard
            key={option.to}
            label={option.label}
            description={option.description}
            icon={option.icon}
            onClick={() => navigate(option.to)}
          />
        ))}
        <AccountOptionCard
          label="Logout"
          description="Sign out of your account"
          icon={LogOut}
          onClick={() => logout()}
        />
      </div>

      {/* Wallet & Refer — part of the existing account dashboard */}
      <WalletReferSection />

      {/* Quick Links Grid — desktop/laptop only; mobile uses the options above */}
      <div className="hidden lg:grid gap-4 lg:grid-cols-3">
        {QUICK_LINKS.map((link) => (
          <AccountOptionCard
            key={link.to}
            label={link.label}
            description={link.description}
            icon={link.icon}
            onClick={() => navigate(link.to)}
          />
        ))}
      </div>

      {/* Care tools — restock alerts. Proactive refill reminders live only on
          the Medicine Refill page, so they are not repeated here. */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Your care tools</h2>
          <p className="text-sm text-muted-foreground">
            Track restock alerts without leaving your dashboard.
          </p>
        </div>
        <RestockAlertsCard />
      </div>

      {/* Account Info */}
      <Card className="border-border/60">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Account Details</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-sm">
              <User className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Name:</span>
              <span className="font-medium text-foreground">{user?.name || "Not set"}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Shield className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">Role:</span>
              <span className="font-medium text-foreground capitalize">{user?.role || "customer"}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
