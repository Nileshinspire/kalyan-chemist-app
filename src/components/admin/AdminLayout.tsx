import { useState, memo } from "react";
import { useLocation, useNavigate } from "react-router";
import { useAuth } from "@/hooks/use-auth";
import { isAdmin } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { motion, AnimatePresence } from "framer-motion";
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
  ShieldCheck,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", path: "/admin", icon: LayoutDashboard },
  { label: "Products", path: "/admin/products", icon: Pill },
  { label: "Categories", path: "/admin/categories", icon: Tag },
  { label: "Orders", path: "/admin/orders", icon: ClipboardList },
  { label: "Reviews", path: "/admin/reviews", icon: Star },
  { label: "Coupons", path: "/admin/coupons", icon: Ticket },
  { label: "Users", path: "/admin/users", icon: Users },
  { label: "Reports", path: "/admin/reports", icon: BarChart3 },
];

const AdminLayout = memo(function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!isAdmin(user)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
            <ShieldCheck className="size-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Access Denied</h1>
          <p className="text-sm text-muted-foreground mt-1">
            You do not have administrator privileges.
          </p>
          <Button className="mt-4" onClick={() => navigate("/")}>
            Return Home
          </Button>
        </motion.div>
      </div>
    );
  }

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
        {NAV_ITEMS.map((item) => (
          <button
            key={item.path}
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
            {isActive(item.path) && (
              <motion.div
                layoutId="admin-active"
                className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"
              />
            )}
          </button>
        ))}
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
            await signOut();
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
      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-border/40 bg-card sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar */}
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

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
});

export default AdminLayout;
