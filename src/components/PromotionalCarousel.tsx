import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

function getCTANavigation(campaign: any) {
  switch (campaign.targetType) {
    case "category":
      return `/products?category=${campaign.targetId || campaign.ctaDestination}`;
    case "product":
      return `/products/${campaign.targetId || campaign.ctaDestination}`;
    case "page":
      return campaign.ctaDestination || "/";
    case "external":
      return null; // handled separately
    default:
      return campaign.ctaDestination || "/products";
  }
}

export default function PromotionalCarousel() {
  const campaigns = useQuery(api.campaigns.active);
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const slides = campaigns ?? [];
  const hasMultiple = slides.length > 1;

  const goTo = useCallback(
    (idx: number) => {
      if (slides.length === 0) return;
      setCurrent(((idx % slides.length) + slides.length) % slides.length);
    },
    [slides.length]
  );

  const next = useCallback(() => goTo(current + 1), [goTo, current]);
  const prev = useCallback(() => goTo(current - 1), [goTo, current]);

  // Auto-rotation
  useEffect(() => {
    if (!hasMultiple || paused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(next, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [hasMultiple, paused, next]);

  // Touch/swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? next() : prev();
    }
    touchStart.current = null;
  };

  // Keyboard
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  };

  if (slides.length === 0) return null;

  const slide = slides[current];
  const ctaPath = getCTANavigation(slide);

  const handleCTA = () => {
    if (slide.targetType === "external" && slide.ctaDestination) {
      window.open(slide.ctaDestination, "_blank", "noopener,noreferrer");
    } else if (ctaPath) {
      navigate(ctaPath);
    }
  };

  return (
    <section
      className="mx-auto max-w-7xl px-4 sm:px-6"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      tabIndex={0}
      role="region"
      aria-label="Promotional campaigns"
    >
      <div className="relative overflow-hidden rounded-2xl bg-card border border-border/40 shadow-sm">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={slide._id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* Banner image */}
            <div className="relative aspect-[21/9] sm:aspect-[21/8] overflow-hidden">
              {/* Mobile image (shown on small screens if available) */}
              {slide.mobileBannerImage && (
                <img
                  src={slide.mobileBannerImage}
                  alt={slide.title}
                  className="absolute inset-0 w-full h-full object-cover sm:hidden"
                  loading="lazy"
                />
              )}
              {/* Desktop / fallback image */}
              <img
                src={slide.desktopBannerImage || slide.bannerImage}
                alt={slide.title}
                className={`w-full h-full object-cover ${slide.mobileBannerImage ? "hidden sm:block" : ""}`}
                loading="lazy"
              />

              {/* Text overlay */}
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
              <div className="absolute inset-0 flex items-center">
                <div className="px-6 sm:px-10 md:px-14 max-w-xl">
                  {slide.subtitle && (
                    <p className="text-xs sm:text-sm font-medium text-white/80 uppercase tracking-wider mb-1.5">
                      {slide.subtitle}
                    </p>
                  )}
                  <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-tight">
                    {slide.title}
                  </h2>
                  {slide.ctaText && ctaPath !== null && (
                    <button
                      onClick={handleCTA}
                      className="mt-3 sm:mt-4 inline-flex items-center gap-2 rounded-full bg-white text-foreground px-5 py-2.5 text-sm font-semibold shadow-lg hover:bg-white/90 transition-colors cursor-pointer"
                    >
                      {slide.ctaText}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation arrows */}
        {hasMultiple && (
          <>
            <button
              onClick={prev}
              className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 flex size-8 sm:size-9 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm text-foreground shadow-md hover:bg-white transition-colors cursor-pointer"
              aria-label="Previous campaign"
            >
              <ChevronLeft className="size-4 sm:size-5" />
            </button>
            <button
              onClick={next}
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 flex size-8 sm:size-9 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm text-foreground shadow-md hover:bg-white transition-colors cursor-pointer"
              aria-label="Next campaign"
            >
              <ChevronRight className="size-4 sm:size-5" />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {hasMultiple && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
            {slides.map((_: any, i: number) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`rounded-full transition-all duration-300 cursor-pointer ${
                  i === current
                    ? "w-5 h-1.5 bg-white"
                    : "w-1.5 h-1.5 bg-white/50 hover:bg-white/80"
                }`}
                aria-label={`Go to slide ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
