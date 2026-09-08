import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import ProductCard from "@/components/ProductCard";

/* ─── New Arrivals ───
 * Dynamic horizontal carousel of products added to the EXISTING product
 * catalog within the last ~30 days (driven by the real product `createdAt`
 * field), newest first. Exactly 4 cards are visible per row on desktop;
 * arrows page through the rest. Clicking a card opens the EXISTING product
 * details route via the shared ProductCard — no duplicate product system.
 */
export default function NewArrivals() {
  const products = useQuery(api.publicProducts.newArrivals, {});

  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () => {
      setCanPrev(el.scrollLeft > 4);
      setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [products]);

  if (!products || products.length === 0) return null;

  const pageScroll = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  const arrowClass =
    "flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card text-foreground shadow-sm transition-all duration-300 hover:border-primary/30 hover:text-primary active:scale-95 disabled:opacity-35 disabled:pointer-events-none cursor-pointer";

  return (
    <section className="bg-background">
      {/* Scoped compact-card styles: shrink ONLY the cards rendered inside
          this New Arrivals carousel (tighter image band, content padding and
          vertical rhythm). The shared ProductCard and every other section
          stay untouched. */}
      <style>{`
        .kc-new-arrival .h-44 { height: 7rem; }
        .kc-new-arrival .p-4 { padding: 0.625rem 1rem; }
        .kc-new-arrival .space-y-2\.5 > :not([hidden]) ~ :not([hidden]) {
          margin-top: 0.5rem;
          margin-bottom: 0rem;
        }
      `}</style>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-1 sm:pt-2 pb-8 sm:pb-12">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
              <Sparkles className="size-3" />
              Just In
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              New Arrivals
            </h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground">
              Explore what's new at Kalyan Chemist
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous new arrivals"
              className={arrowClass}
              disabled={!canPrev}
              onClick={() => pageScroll(-1)}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next new arrivals"
              className={arrowClass}
              disabled={!canNext}
              onClick={() => pageScroll(1)}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div
          ref={trackRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            setCanPrev(el.scrollLeft > 4);
            setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
          }}
          className="flex gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory -mx-4 sm:-mx-6 px-4 sm:px-6"
        >
          {products.map((product) => (
            <div
              key={product._id}
              className="kc-new-arrival min-w-[calc(50%-0.5rem)] snap-start md:min-w-[calc(33.333%-0.667rem)] lg:min-w-[calc(25%-0.75rem)]"
            >
              <ProductCard product={product} newArrival />
            </div>
          ))}
        </div>

        {/* Mobile arrows */}
        <div className="mt-5 flex items-center justify-center gap-3 sm:hidden">
          <button
            type="button"
            aria-label="Previous new arrivals"
            className={arrowClass}
            disabled={!canPrev}
            onClick={() => pageScroll(-1)}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next new arrivals"
            className={arrowClass}
            disabled={!canNext}
            onClick={() => pageScroll(1)}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </section>
  );
}