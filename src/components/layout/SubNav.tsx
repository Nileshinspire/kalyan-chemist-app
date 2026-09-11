import { memo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { MessageCircle, ArrowRight } from "lucide-react";

/* ─── Quick Functions ─── */
const QUICK_FUNCTIONS = [
  {
    label: "Upload Prescription",
    route: "/upload-prescription",
    subtitle: "Upload your prescription easily",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="2" width="12" height="20" rx="2.5" />
        <line x1="10" y1="5" x2="14" y2="5" />
        <rect x="8.5" y="9" width="7" height="8.5" rx="1" />
        <line x1="10" y1="11.5" x2="14" y2="11.5" />
        <line x1="10" y1="13.5" x2="13" y2="13.5" />
        <line x1="10" y1="15.5" x2="12" y2="15.5" />
        <line x1="10.5" y1="7" x2="13.5" y2="7" strokeWidth="1.25" />
      </svg>
    ),
  },
  {
    label: "Doctor Appointment",
    route: "/doctor-appointment",
    subtitle: "Book Now",
    subtitleStyle: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <circle cx="12" cy="15" r="2.5" />
      </svg>
    ),
  },
  {
    label: "Lab Tests",
    route: "/lab-tests",
    subtitle: "Book Now",
    subtitleStyle: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3h6" />
        <path d="M10 3v7.4a2 2 0 0 1-.4 1.2L5 17a2 2 0 0 0 1.6 3h10.8a2 2 0 0 0 1.6-3l-4.6-5.4a2 2 0 0 1-.4-1.2V3" />
        <path d="M8.5 14h7" />
        <circle cx="11" cy="17" r="1" fill="currentColor" stroke="none" />
        <circle cx="14" cy="18" r="0.75" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "Medicine Refill",
    route: "/refill",
    subtitle: "Refill your regular medicines",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="6" y="2" width="12" height="20" rx="2.5" />
        <line x1="10" y1="5" x2="14" y2="5" />
        <path d="M12 14a3 3 0 1 0 0-6" />
        <line x1="8" y1="9" x2="16" y2="9" />
      </svg>
    ),
  },
  {
    label: "AI Chatbot",
    route: "/chatbot",
    subtitle: "Chat for help & medicines",
    icon: <MessageCircle className="size-[18px]" />,
  },
];

/* ─── Category Navigation ─── */
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

const SubNav = memo(function SubNav() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleCategoryNav = useCallback(
    (slug: string, key: string) => {
      if (slug) {
        navigate(`/products?category=${slug}&nav=${key}`);
      } else {
        navigate(`/products?nav=all`);
      }
    },
    [navigate],
  );

  return (
    <>
      {/* ═══ Quick Functions ═══ */}
      <section className="bg-background border-b border-border/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-none">
            {QUICK_FUNCTIONS.map((fn) => (
              <button
                key={fn.label}
                type="button"
                onClick={() => navigate(fn.route)}
                className="inline-flex items-center gap-2.5 rounded-lg border border-border/60 bg-card hover:bg-accent/40 px-3 py-2.5 sm:px-4 sm:py-3 transition-all duration-300 group cursor-pointer shadow-sm hover:shadow-md shrink-0"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                  {fn.icon}
                </div>
                <div className="text-left">
                  <h3 className="text-sm sm:text-base font-semibold text-foreground group-hover:text-primary transition-colors whitespace-nowrap">
                    {fn.label}
                  </h3>
                  <p
                    className={
                      fn.subtitleStyle
                        ? "text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-primary/70 mt-0.5"
                        : "text-xs text-muted-foreground mt-0.5 whitespace-nowrap"
                    }
                  >
                    {fn.subtitle}
                  </p>
                </div>
                <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Category Navigation ═══ */}
      <nav className="hidden md:block" style={{ background: "#0a3d2e" }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-none pr-6">
            {CATEGORY_NAV_ITEMS.map((cat) => {
              const currentNavKey = searchParams.get("nav") || "";
              const isCurrentCategory = currentNavKey === cat.key;
              return (
                <button
                  key={cat.key}
                  type="button"
                  onClick={() => handleCategoryNav(cat.slug, cat.key)}
                  className="relative px-3 lg:px-4 py-2.5 text-xs lg:text-sm font-medium whitespace-nowrap transition-all duration-200 shrink-0 cursor-pointer"
                  style={{ color: "#FFFFFF" }}
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
    </>
  );
});

export default SubNav;
