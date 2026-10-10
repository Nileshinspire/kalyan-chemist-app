import { useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { preloadRoute } from "@/lib/route-preload";
import { BadgePercent, ArrowRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import ProductCard from "@/components/ProductCard";

/* ─── Value Deals Under ₹100 ───
 * Dynamic grid of the 4 most relevant EXISTING non-medicine products whose
 * current SELLING price (discountPrice ?? price) is ₹100 or less. Eligibility
 * and ranking come entirely from the existing catalog + order history via
 * `api.publicProducts.valueDeals` — no manual list, no separate system.
 * Exactly 4 cards on desktop, no carousel; "View All" opens the dedicated
 * listing page of every currently eligible product.
 */
export default function ValueDeals() {
  const navigate = useNavigate();
  const deals = useQuery(api.publicProducts.valueDeals, { limit: 4 });

  if (!deals || deals.length === 0) return null;

  return (
    <section className="bg-background">
      {/* Scoped compact-card styles: shrink ONLY the cards rendered inside
          this Value Deals grid (same treatment as the New Arrivals carousel
          above it). The shared ProductCard and every other section stay
          untouched. */}
      <style>{`
        .kc-value-deal .h-44, .kc-value-deal .sm\:h-44 { height: 5.5rem; }
        .kc-value-deal .size-20 { width: 4rem; height: 4rem; }
        .kc-value-deal .size-14 { width: 2.75rem; height: 2.75rem; }
        .kc-value-deal .p-4, .kc-value-deal .sm\:p-4 { padding: 0.5rem 0.75rem; }
        .kc-value-deal .space-y-2\\.5 > :not([hidden]) ~ :not([hidden]) {
          margin-top: 0.375rem;
        }
        .kc-value-deal .text-sm { font-size: 0.8125rem; line-height: 1.25rem; }
        .kc-value-deal .text-lg { font-size: 1rem; line-height: 1.5rem; }
        .kc-value-deal .h-9 { height: 2rem; }
      `}</style>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-1 sm:pt-2 pb-8 sm:pb-12">
        <div className="flex items-end justify-between gap-4 mb-5 sm:mb-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
              <BadgePercent className="size-3" />
              Pocket-Friendly
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Value Deals Under ₹100
            </h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground">
              Everyday essentials at pocket-friendly prices
            </p>
          </div>
          <button
            type="button"
            onMouseEnter={() => preloadRoute("/products")}
            onFocus={() => preloadRoute("/products")}
            onClick={() => navigate("/value-deals")}
            className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-semibold text-primary shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-glow active:scale-95 cursor-pointer"
          >
            View All
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Grid track system mirrors the "Browse by Health Conditions" section
            exactly (same container padding, same column count, same gaps), so
            each card renders at the SAME horizontal width as those tiles. Width
            only — the height rules in the scoped style block above stay as-is. */}
        {/* Mobile: swipeable row (two cards per view) so four deals occupy one
            compact band instead of two tall grid rows — the Apollo-style
            product carousel. From `sm` the original grid is restored exactly. */}
        <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x sm:grid sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 sm:overflow-visible">
          {deals.map((product) => (
            <div key={product._id} className="kc-value-deal min-w-[calc(50%-0.5rem)] shrink-0 snap-start sm:min-w-0">
              <ProductCard product={product as any} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}