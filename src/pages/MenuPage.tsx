import { useNavigate } from "react-router";
import { useAuth } from "@/context/AuthContext";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { CATEGORY_NAV_ITEMS, SERVICE_NAV_ITEMS } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ChevronRight,
  Home,
  Package,
  Shield,
} from "lucide-react";

/* ─── Full-page Menu ───
 * Opened by the "Menu" tab in the mobile bottom navigation. It is a normal
 * routed page inside the existing layout (Navbar + Footer + bottom nav) — not
 * the old side sheet. Guests and customers both see the public destinations;
 * personal account links stay in My Account so nothing is duplicated here.
 */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-4">
      <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="divide-y divide-border/40 overflow-hidden rounded-2xl border border-border/60 bg-card">
        {children}
      </div>
    </section>
  );
}

function MenuRow({
  label,
  icon: Icon,
  onClick,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted/50"
    >
      {Icon && <Icon className="size-4 text-primary" />}
      <span className="flex-1">{label}</span>
      <ChevronRight className="size-4 text-muted-foreground/60" />
    </button>
  );
}

export default function MenuPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useAuth();

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  const goCategory = (slug: string, key: string) => {
    if (slug) navigate(`/products?category=${slug}&nav=${key}`);
    else navigate(`/products?nav=all`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 py-5">
          <div className="mb-5 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Go back"
              className="rounded-xl"
              onClick={goBack}
            >
              <ArrowLeft className="size-5" />
            </Button>
            <h1 className="text-lg font-bold text-foreground">Menu</h1>
          </div>

          {!isAuthenticated && (
            <div className="mb-5 rounded-2xl border border-border/60 bg-card p-4">
              <p className="text-sm font-semibold text-foreground">
                Sign in to your account
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Track orders, prescriptions, lab tests and appointments in one place.
              </p>
              <div className="mt-3">
                {/* /auth signs in existing customers and creates the account
                    from the same email code, so one entry point covers both. */}
                <Button
                  size="sm"
                  className="rounded-xl font-semibold gradient-primary text-white"
                  onClick={() => navigate(`/login?returnTo=${encodeURIComponent("/menu")}`)}
                >
                  Sign In / Create Account
                </Button>
              </div>
            </div>
          )}

          <Section title="Shop">
            <MenuRow label="Home" icon={Home} onClick={() => navigate("/")} />
            <MenuRow
              label="Browse Medicines"
              icon={Package}
              onClick={() => navigate("/products")}
            />
          </Section>

          <Section title="Services">
            {SERVICE_NAV_ITEMS.filter(
              (item) => isAuthenticated || !item.accountOnly
            ).map((item) => (
              <MenuRow
                key={item.route}
                label={item.label}
                onClick={() => navigate(item.route)}
              />
            ))}
          </Section>

          <Section title="Categories">
            {CATEGORY_NAV_ITEMS.map((cat) => (
              <MenuRow
                key={cat.key}
                label={cat.label}
                onClick={() => goCategory(cat.slug, cat.key)}
              />
            ))}
          </Section>

          {isAdmin && (
            <Section title="Administration">
              <MenuRow
                label="Admin Panel"
                icon={Shield}
                onClick={() => navigate("/admin")}
              />
            </Section>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
