import { useCallback, useEffect, useRef, useState } from "react";
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

  // `update` reads layout, so it is collapsed to one measurement per frame
  // instead of running on every resize/scroll event.
  const frameRef = useRef(0);
  const update = useCallback(() => {
    if (frameRef.current) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = 0;
      const el = trackRef.current;
      if (!el) return;
      setCanPrev(el.scrollLeft > 4);
      setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    });
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", update);
    };
  }, [products, update]);

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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-6 pb-6 sm:pt-2 sm:pb-12">
        <div className="flex items-end justify-between gap-4 mb-5 sm:mb-8">
          <div className="max-w-2xl">
            {/* Apollo-style compact heading on phones: pill + description
                render from `sm` up exactly as before. */}
            <div className="max-sm:hidden inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
              <Sparkles className="size-3" />
              Just In
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground max-sm:text-base max-sm:font-semibold max-sm:tracking-normal">
              New Arrivals
            </h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground max-sm:hidden">
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
        </div>          <div
            ref={trackRef}
            onScroll={update}
            className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory max-sm:overscroll-x-contain sm:-mx-6 sm:px-6 sm:gap-4"
          >
            {products.map((product) => (
              <div
                key={product._id}
                /* One carousel item per reference card width from `sm` up, so a
                   card here is the same size as the one in the Hot Sellers
                   grid; the phone widths are unchanged. */
                className="min-w-[calc(50%-0.5rem)] snap-start sm:min-w-[var(--kc-card-w)] sm:w-[var(--kc-card-w)] max-sm:min-w-[calc(42%-0.375rem)] max-sm:w-[calc(42%-0.375rem)]"
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
