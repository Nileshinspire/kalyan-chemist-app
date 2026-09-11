import { memo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";

/* ─── Service Navigation Items (simple text links) ─── */
const SERVICE_NAV_ITEMS = [
  { label: "Upload Prescription", route: "/upload-prescription" },
  { label: "Doctor Appointment", route: "/doctor-appointment" },
  { label: "Lab Tests", route: "/lab-tests" },
  { label: "Medicine Refill", route: "/refill" },
  { label: "AI Chatbot", route: "/chatbot" },
];

/* ─── Category Navigation Items (existing — untouched) ─── */
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
      {/* ═══ Service Navigation — simple text links ═══ */}
      <nav className="border-b border-border/40 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-none">
            {SERVICE_NAV_ITEMS.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => navigate(item.route)}
                className="px-3 lg:px-4 py-2.5 text-xs lg:text-sm font-medium text-foreground/70 hover:text-primary transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* ═══ Category Navigation — existing row, completely untouched ═══ */}
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
