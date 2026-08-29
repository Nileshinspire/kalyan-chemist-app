import { useState, memo } from "react";
import { useLocation, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Pill,
  Tag,
  ClipboardList,
  Star,
  Ticket,
  Users,
  BarChart3,
  Menu,
  X,
  LogOut,
  ArrowLeft,
  Settings,
  Building2,
  Warehouse,
  Truck,
  MessageCircle,
  FileCheck2,
  Stethoscope,
  CalendarClock,
  History,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { label: "Products", path: "/admin/products", icon: Pill },
  { label: "Categories", path: "/admin/categories", icon: Tag },
  { label: "Brands", path: "/admin/brands", icon: Building2 },
  { label: "Inventory", path: "/admin/inventory", icon: Warehouse },
  { label: "Orders", path: "/admin/orders", icon: ClipboardList },
  { label: "Prescriptions", path: "/admin/prescriptions", icon: FileCheck2 },
  { label: "Expiring Medicines", path: "/admin/expiring", icon: CalendarClock },
  { label: "Customers", path: "/admin/users", icon: Users },
  { label: "Coupons", path: "/admin/coupons", icon: Ticket },
  { label: "Reviews", path: "/admin/reviews", icon: Star },
  { label: "Reports", path: "/admin/reports", icon: BarChart3 },
  { label: "Delivery Settings", path: "/admin/delivery", icon: Truck },
  { label: "WhatsApp Enquiries", path: "/admin/whatsapp", icon: MessageCircle },
  { label: "Doctors", path: "/admin/doctors", icon: Stethoscope },
  { label: "Appointments", path: "/admin/appointments", icon: CalendarClock },
  { label: "Settings", path: "/admin/settings", icon: Settings },
  { label: "Activity Log", path: "/admin/activity", icon: History },
];

const AdminLayout = memo(function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const expiringCount = useQuery(api.adminProducts.getExpiringMedicinesCount);

  const isActive = (path: string) =>
    path === "/admin"
      ? location.pathname === "/admin"
      : location.pathname.startsWith(path);

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl gradient-primary text-white font-bold text-xs shadow-glow">
            KC
          </div>
          <div>
            <span className="text-sm font-bold tracking-tight text-foreground">
              Kalyan Chemist
            </span>
            <p className="text-[10px] font-medium uppercase tracking-widest text-primary/60">
              Admin Panel
            </p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const badgeCount =
            item.path === "/admin/expiring" && expiringCount?.total
              ? expiringCount.total
              : 0;
          return (
            <button
              key={item.label}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                isActive(item.path)
                  ? "bg-primary/10 text-primary font-medium shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              onClick={() => {
                navigate(item.path);
                setSidebarOpen(false);
              }}
            >
              <item.icon className="size-4 shrink-0" />
              {item.label}
              {badgeCount > 0 && (
                <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                  {badgeCount > 99 ? "99+" : badgeCount}
                </span>
              )}
              {isActive(item.path) && badgeCount === 0 && (
                <motion.div
                  layoutId="admin-active"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border/40 space-y-1">
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="size-4 shrink-0" />
          Back to Store
        </button>
        <button
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors"
          onClick={async () => {
            await logout();
            navigate("/");
          }}
        >
          <LogOut className="size-4 shrink-0" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="hidden lg:block w-64 shrink-0 border-r border-border/40 bg-card sticky top-0 h-screen">
        <SidebarContent />
      </aside>
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild className="lg:hidden fixed top-3 left-3 z-50">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl">
            <Menu className="size-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 border-border/30">
          <div className="flex items-center justify-end p-2">
            <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => setSidebarOpen(false)}>
              <X className="size-4" />
            </Button>
          </div>
          <SidebarContent />
        </SheetContent>
      </Sheet>
      <main className="flex-1 min-w-0">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
});

export default AdminLayout;
