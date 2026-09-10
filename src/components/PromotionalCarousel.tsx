import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import { motion } from "framer-motion";
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

/** Offer line built strictly from admin-configured data. Never invented. */
function getOfferLine(campaign: any): string {
  if (campaign.offerText && campaign.offerText.trim()) {
    return campaign.offerText.trim();
  }
  const v = campaign.offerValue;
  if (campaign.offerType === "percentage" && typeof v === "number" && v > 0) {
    return `${v}% OFF`;
  }
  if (campaign.offerType === "fixed" && typeof v === "number" && v > 0) {
    return `₹${v} OFF`;
  }
  return "";
}

function getValidityLine(campaign: any, now: number): string {
  const start = campaign.startDate as number;
  const end = campaign.endDate as number;
  const fmt = (ts: number) =>
    new Date(ts).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
    });
  if (Number.isFinite(start) && now < start) return `Starts ${fmt(start)}`;
  if (Number.isFinite(end) && now <= end) return `Valid until ${fmt(end)}`;
  return "";
}

function primaryImageOf(campaign: any): string {
  return (
    campaign.desktopBannerImage ||
    campaign.bannerImage ||
    campaign.publicUrl ||
    ""
  );
}

const AUTOPLAY_MS = 5000;
const FADE_DURATION = 0.55; // seconds — premium crossfade (400–700ms range)

export default function PromotionalCarousel() {
  const campaigns = useQuery(api.campaigns.active);
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStart = useRef<number | null>(null);

  // Single autoplay interval for the component's lifetime. Callbacks and the
  // paused flag are read through refs so the timer is never torn down and
  // recreated on every slide change (no duplicate timers, no unnecessary
  // restarts on rerender).
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);
  pausedRef.current = paused;

  const slides = campaigns ?? [];
  const hasMultiple = slides.length > 1;
  const countRef = useRef(0);
  countRef.current = slides.length;

  const nextRef = useRef<() => void>(() => {});
  nextRef.current = () => {
    setCurrent((c) => (countRef.current ? (c + 1) % countRef.current : 0));
  };

  // Track which slide images have been loaded/decoded by the browser so a
  // transition never starts before the next slide's image is available.
  const loadedRef = useRef<Record<string, boolean>>({});

  const currentRef = useRef(0);
  currentRef.current = current;
  const slidesRef = useRef<any[]>([]);
  slidesRef.current = slides;

  const next = useCallback(() => nextRef.current(), []);
  const prev = useCallback(
    () =>
      setCurrent((c) =>
        countRef.current ? (c - 1 + countRef.current) % countRef.current : 0
      ),
    []
  );

  useEffect(() => {
    if (!hasMultiple) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (pausedRef.current) return;
      // Defer the transition until the upcoming slide's image is loaded so
      // the outgoing banner stays fully visible (no blank frame).
      const nextIdx = countRef.current
        ? (currentRef.current + 1) % countRef.current
        : 0;
      const upcoming = slidesRef.current[nextIdx];
      const src = upcoming ? primaryImageOf(upcoming) : "";
      if (src && !loadedRef.current[src]) return; // try again next tick
      nextRef.current();
    }, AUTOPLAY_MS);
    const t = timerRef.current;
    return () => {
      clearInterval(t);
      timerRef.current = null;
    };
  }, [hasMultiple]);

  // Manual navigation (arrows, dots, swipe) uses the same smooth transition
  // and correctly resets the autoplay timer afterwards.
  const navigateTo = useCallback(
    (idx: number) => {
      if (countRef.current === 0) return;
      const wrapped = ((idx % countRef.current) + countRef.current) % countRef.current;
      setCurrent(wrapped);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
          if (pausedRef.current) return;
          nextRef.current();
        }, AUTOPLAY_MS);
      }
    },
    []
  );

  // Preload every campaign image (desktop, mobile and fallback variants) as
  // soon as campaigns are known, so slides are ready before they can be shown.
  useEffect(() => {
    slides.forEach((s: any) => {
      (
        [s.desktopBannerImage, s.mobileBannerImage, s.bannerImage, s.publicUrl] as (
          | string
          | undefined
        )[]
      ).forEach((url) => {
        if (!url || loadedRef.current[url]) return;
        loadedRef.current[url] = false;
        const img = new Image();
        img.onload = () => {
          loadedRef.current[url] = true;
        };
        img.onerror = () => {
          loadedRef.current[url] = true; // don't block on a broken variant
        };
        img.src = url;
      });
    });
  }, [slides]);

  // Touch/swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStart.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart.current === null) return;
    const diff = touchStart.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      diff > 0 ? navigateTo(currentRef.current + 1) : navigateTo(currentRef.current - 1);
    }
    touchStart.current = null;
  };

  // Keyboard
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") navigateTo(currentRef.current - 1);
    if (e.key === "ArrowRight") navigateTo(currentRef.current + 1);
  };

  if (slides.length === 0) return null;

  const now = Date.now();
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
        {/* All slides are stacked in the same grid cell. Outgoing slides stay
            fully rendered underneath while the incoming slide crossfades in —
            there is never a blank frame between campaigns. */}
        <div className="grid">
          {slides.map((s: any, i: number) => {
            const cta = getCTANavigation(s);
            const offerLine = getOfferLine(s);
            const validityLine = getValidityLine(s, now);
            const active = i === current;
            return (
              <motion.div
                key={s._id}
                initial={false}
                animate={{
                  opacity: active ? 1 : 0,
                  x: active ? 0 : 24,
                }}
                transition={{
                  duration: FADE_DURATION,
                  ease: [0.22, 1, 0.36, 1],
                }}
                style={{ gridArea: "1 / 1" }}
                className="relative pointer-events-none"
                aria-hidden={!active}
              >
                {/* Banner image */}
                <div className="relative aspect-[21/9] sm:aspect-[21/8] overflow-hidden">
                  {/* Mobile image (shown on small screens if available) */}
                  {s.mobileBannerImage && (
                    <img
                      src={s.mobileBannerImage}
                      alt={active ? s.title : ""}
                      className="absolute inset-0 w-full h-full object-cover sm:hidden"
                      loading="lazy"
                      onLoad={() => {
                        loadedRef.current[s.mobileBannerImage] = true;
                      }}
                      onError={(e) => {
                        const img = e.currentTarget as HTMLImageElement;
                        if (img.dataset.fallbackTried) return;
                        img.dataset.fallbackTried = "1";
                        const fallback = s.bannerImage || s.publicUrl;
                        if (fallback && fallback !== img.src) {
                          img.src = fallback;
                        }
                      }}
                    />
                  )}
                  {/* Desktop / fallback image */}
                  <img
                    src={s.desktopBannerImage || s.bannerImage}
                    alt={active ? s.title : ""}
                    className={`w-full h-full object-cover ${
                      s.mobileBannerImage ? "hidden sm:block" : ""
                    }`}
                    loading="lazy"
                    onLoad={() => {
                      loadedRef.current[
                        s.desktopBannerImage || s.bannerImage
                      ] = true;
                    }}
                    onError={(e) => {
                      const img = e.currentTarget as HTMLImageElement;
                      if (img.dataset.fallbackTried) return;
                      img.dataset.fallbackTried = "1";
                      // If the desktop asset failed, fall back to the primary public URL.
                      const fallback = s.bannerImage || s.publicUrl;
                      if (fallback && fallback !== img.src) {
                        img.src = fallback;
                      }
                    }}
                  />

                  {/* Text overlay — kept synchronized with the visible slide */}
                  <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
                  <div className="absolute inset-0 flex items-center">
                    <div className="px-6 sm:px-10 md:px-14 max-w-xl">
                      {offerLine && (
                        <p className="inline-block mb-1.5 rounded-full bg-white/95 text-foreground px-3 py-1 text-xs sm:text-sm font-bold shadow">
                          {offerLine}
                        </p>
                      )}
                      {s.subtitle && (
                        <p className="text-xs sm:text-sm font-medium text-white/80 uppercase tracking-wider mb-1.5">
                          {s.subtitle}
                        </p>
                      )}
                      <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white leading-tight">
                        {s.title}
                      </h2>
                      {validityLine && (
                        <p className="mt-1 text-xs sm:text-sm font-medium text-white/85">
                          {validityLine}
                        </p>
                      )}
                      {s.ctaText && cta !== null && (
                        <button
                          onClick={handleCTA}
                          tabIndex={active ? 0 : -1}
                          className={`mt-3 sm:mt-4 inline-flex items-center gap-2 rounded-full bg-white text-foreground px-5 py-2.5 text-sm font-semibold shadow-lg hover:bg-white/90 transition-colors cursor-pointer ${
                            active ? "pointer-events-auto" : "pointer-events-none"
                          }`}
                        >
                          {s.ctaText}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Navigation arrows */}
        {hasMultiple && (
          <>
            <button
              onClick={() => navigateTo(currentRef.current - 1)}
              className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 flex size-8 sm:size-9 items-center justify-center rounded-full bg-white/80 backdrop-blur-sm text-foreground shadow-md hover:bg-white transition-colors cursor-pointer"
              aria-label="Previous campaign"
            >
              <ChevronLeft className="size-4 sm:size-5" />
            </button>
            <button
              onClick={() => navigateTo(currentRef.current + 1)}
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
                onClick={() => navigateTo(i)}
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
