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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-6 pb-6 sm:pt-2 sm:pb-12">
        <div className="flex items-end justify-between gap-4 mb-5 sm:mb-8">
          <div className="max-w-2xl">
            {/* Apollo-style compact heading on phones: pill + description
                render from `sm` up exactly as before. */}
            <div className="max-sm:hidden inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
              <BadgePercent className="size-3" />
              Pocket-Friendly
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground max-sm:text-base max-sm:font-semibold max-sm:tracking-normal">
              Value Deals Under ₹100
            </h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground max-sm:hidden">
              Everyday essentials at pocket-friendly prices
            </p>
          </div>
          <button
            type="button"
            onMouseEnter={() => preloadRoute("/products")}
            onFocus={() => preloadRoute("/products")}
            onClick={() => navigate("/value-deals")}
            className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-semibold text-primary shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-glow active:scale-95 cursor-pointer max-sm:rounded-none max-sm:border-0 max-sm:bg-transparent max-sm:px-0 max-sm:py-0 max-sm:shadow-none"
          >
            View All
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* Mobile: swipeable row (two cards per view) so four deals occupy one
            compact band instead of two tall grid rows — the Apollo-style
            product carousel. From `sm` up the cards sit on the shared
            `.kc-card-track`, i.e. exactly the Hot Sellers card size. */}
        <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory max-sm:overscroll-x-contain sm:grid sm:gap-4 kc-card-track sm:overflow-visible">
          {deals.map((product) => (
            <div key={product._id} className="min-w-[calc(50%-0.5rem)] shrink-0 snap-start sm:min-w-0 max-sm:min-w-[calc(42%-0.375rem)] max-sm:w-[calc(42%-0.375rem)]">
              <ProductCard product={product as any} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}