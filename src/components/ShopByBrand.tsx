import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { useNavigate } from "react-router";
import { preloadRoute } from "@/lib/route-preload";
import { api } from "@/convex/_generated/api";
import { ChevronLeft, ChevronRight, Store } from "lucide-react";

/**
 * A brand's real logo, with the generic Store icon as the only fallback — used
 * when no logo was stored, or if a stored URL ever stops resolving. The tile
 * markup, sizing and the brand name below it are untouched either way.
 */
function BrandLogo({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <Store className="size-5 text-muted-foreground/50" />;
  }

  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className="max-h-full max-w-full object-contain transition-transform duration-300 group-hover:scale-105"
    />
  );
}

/* ─── Shop By Brand ───
 * Horizontal logo carousel built from the EXISTING brands table. A brand
 * appears here only when the admin has made it Active and switched on
 * "Show on Homepage", ordered by the Homepage Display Order they set.
 *
 * Clicking a tile reuses the existing brand-filtered listing
 * (`/products?brand=<slug>`) — no duplicate product data or filtering logic.
 *
 * Layout follows the same track pattern as the New Arrivals carousel: a
 * scroll-snap rail that overflows into a carousel when there are more brands
 * than fit, with desktop arrows and native touch swipe on phones.
 */
export default function ShopByBrand() {
  const navigate = useNavigate();
  const brands = useQuery(api.publicBrands.homepage);
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  // Measured rather than hardcoded, so the arrows reflect the real overflow at
  // any viewport. Runs once the list has rendered and on every scroll/resize.
  useEffect(() => {
    if (!brands || brands.length === 0) return;
    const el = trackRef.current;
    if (!el) return;
    const measure = () => {
      setCanPrev(el.scrollLeft > 4);
      setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [brands]);

  if (!brands || brands.length === 0) return null;

  const updateArrows = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  /** Advance by exactly one tile so the row always lands on whole cards. */
  const scrollByTile = (direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const tile = el.querySelector<HTMLElement>("[data-brand-tile]");
    const step = tile ? tile.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  };

  const openBrand = (slug: string) => {
    preloadRoute(`/products?brand=${slug}`);
    navigate(`/products?brand=${slug}`);
  };

  const arrowClass =
    "flex size-9 items-center justify-center rounded-full border border-border/70 bg-card text-foreground shadow-sm transition-all duration-300 hover:border-primary/30 hover:shadow-glow active:scale-95 disabled:pointer-events-none disabled:opacity-40";

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-12 sm:py-16">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Shop By Brand
            </h2>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Genuine medicines from trusted pharmaceutical brands
            </p>
          </div>

          {/* Desktop arrows — only meaningful once the row overflows. */}
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <button
              type="button"
              aria-label="Previous brands"
              className={arrowClass}
              disabled={!canPrev}
              onClick={() => scrollByTile(-1)}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next brands"
              className={arrowClass}
              disabled={!canNext}
              onClick={() => scrollByTile(1)}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>

        <div
          ref={trackRef}
          onScroll={updateArrows}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {brands.map((brand) => (
            <button
              key={brand._id}
              type="button"
              data-brand-tile
              onClick={() => openBrand(brand.slug)}
              title={brand.description ?? brand.name}
              className="group flex w-[124px] shrink-0 snap-start flex-col items-center gap-2 rounded-2xl border border-border/70 bg-card px-3 py-4 transition-all duration-300 hover:border-primary/30 hover:shadow-glow active:scale-[0.97] sm:w-[136px] lg:w-[144px]"
            >
              <span className="flex h-12 w-full items-center justify-center rounded-xl border border-border/50 bg-white p-2">
                <BrandLogo src={brand.logoUrl} name={brand.name} />
              </span>
              <span className="line-clamp-2 text-center text-xs font-medium leading-snug text-foreground">
                {brand.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
