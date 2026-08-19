import { useAuth } from "@/context/AuthContext";
import { useNavigate } from "react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import {
  User,
  MapPin,
  ClipboardList,
  Heart,
  Pill,
  Bell,
  ArrowRight,
  Package,
  Shield,
} from "lucide-react";

const QUICK_LINKS = [
  { to: "/account/profile", label: "Edit Profile", icon: User, description: "Update your name, email, and phone" },
  { to: "/account/addresses", label: "Manage Addresses", icon: MapPin, description: "Add or edit delivery addresses" },
  { to: "/account/orders", label: "View Orders", icon: ClipboardList, description: "Track your recent orders" },
  { to: "/account/prescriptions", label: "Prescriptions", icon: Pill, description: "Upload and manage prescriptions" },
  { to: "/account/wishlist", label: "Wishlist", icon: Heart, description: "Products you saved for later" },
  { to: "/account/notifications", label: "Notifications", icon: Bell, description: "Order updates and offers" },
];

export default function AccountOverview() {
  const { user } = useAuth();
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

      {/* Quick Links Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_LINKS.map((link) => (
          <Card
            key={link.to}
            className="group cursor-pointer border-border/60 hover:shadow-card-hover hover:border-primary/20 transition-all duration-300"
            onClick={() => navigate(link.to)}
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                  <link.icon className="size-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {link.label}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {link.description}
                  </p>
                </div>
                <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
              </div>
            </CardContent>
          </Card>
        ))}
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
