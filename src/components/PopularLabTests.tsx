import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { FlaskConical, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { formatCurrency } from "@/lib/auth-utils";

/* ─── Popular Lab Tests ───
 * Horizontal carousel of the REAL lab tests from the Convex `lab_tests`
 * table (the same data the Lab Test Details page reads). Exactly 4 cards
 * are visible per row on desktop; arrows page through the rest. Clicking a
 * card opens the EXISTING lab test details route — no duplicate system.
 */

/* Minimal medical line-art icons (same style as Browse by Health Conditions) */
function DropIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
      <path d="M12 3.6c3.3 3.9 5.3 6.7 5.3 9.3a5.3 5.3 0 0 1-10.6 0c0-2.6 2-5.4 5.3-9.3z" />
      <path d="M9.4 13.7c.3 2 1.3 3.1 2.6 3.1" />
    </svg>
  );
}

function TestTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
      <path d="M10 3h4" />
      <path d="M11 3v7.2a2 2 0 0 1-.5 1.3L7.9 14.8a2.5 2.5 0 0 0 2 4.1h4.2a2.5 2.5 0 0 0 2-4.1l-2.6-3.3a2 2 0 0 1-.5-1.3V3" />
      <path d="M8.9 13.7h6.2" />
      <circle cx="12" cy="16.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function LipidIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
      <path d="M12 20.3C7.4 16 3.9 12.9 3.9 9.5a4.4 4.4 0 0 1 8.1-2.4 4.4 4.4 0 0 1 8.1 2.4c0 3.4-3.5 6.5-8.1 10.8z" />
      <path d="M12 9c1.2 1.4 2 2.5 2 3.5a2 2 0 0 1-4 0c0-1 .8-2.1 2-3.5z" />
    </svg>
  );
}

function VitaminIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 4.2v1.8" />
      <path d="M12 18v1.8" />
      <path d="M4.2 12H6" />
      <path d="M18 12h1.8" />
      <path d="M6.4 6.4l1.3 1.3" />
      <path d="M16.3 16.3l1.3 1.3" />
      <path d="M17.6 6.4l-1.3 1.3" />
      <path d="M7.7 16.3l-1.3 1.3" />
    </svg>
  );
}

function ThyroidIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
      <path d="M12 3.6v2.4" />
      <path d="M9 6.4C5.7 6.4 3.5 8.8 3.5 11.8c0 3.3 2.3 5.6 5.5 5.6 1 0 1.9-.3 3-1V6.4z" />
      <path d="M15 6.4c3.3 0 5.5 2.4 5.5 5.4 0 3.3-2.3 5.6-5.5 5.6-1.1 0-2-.3-3-1V6.4z" />
      <path d="M12 6.6v9" opacity="0.55" />
    </svg>
  );
}

function GlucometerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
      <rect x="3.8" y="6.5" width="11" height="13" rx="2.5" />
      <path d="M3.8 10.6h11" />
      <path d="M6.4 13.4h3.1" />
      <path d="M6.4 15.7h4.6" />
      <path d="M14.8 14.4l3.6-4.6" />
      <path d="M18.9 5.8c1.1 1.4 2 2.5 2 3.6a2 2 0 0 1-4 0c0-1.1.9-2.2 2-3.6z" />
    </svg>
  );
}

function LiverIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
      <path d="M12 5c3.6 0 6.3 2.5 6.3 5.9 0 3.6-2.7 6.8-6.3 6.8-3.4 0-6.1-3.1-6.1-6.8C5.9 7.5 8.5 5 12 5z" />
      <path d="M8.9 10.9c.4 2.1 1.2 3.3 2.5 3.3 1 0 1.8-.8 2.1-2.1" />
    </svg>
  );
}

function FlaskIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
      <path d="M10 3h4" />
      <path d="M11 3v6.5L6.9 16.4A2.6 2.6 0 0 0 9.2 20h5.6a2.6 2.6 0 0 0 2.3-3.6L13 9.5V3" />
      <path d="M8.6 14.6h6.8" />
      <circle cx="11" cy="17.2" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="13.6" cy="18.3" r="0.65" fill="currentColor" stroke="none" />
    </svg>
  );
}

function iconFor(name: string): ReactNode {
  const n = name.toLowerCase();
  if (n.includes("lipid") || n.includes("cholesterol")) return <LipidIcon />;
  if (n.includes("glucose") || n.includes("sugar") || n.includes("hba1c") || n.includes("diabetes")) return <GlucometerIcon />;
  if (n.includes("vitamin")) return <VitaminIcon />;
  if (n.includes("thyroid")) return <ThyroidIcon />;
  if (n.includes("esr") || n.includes("sedimentation")) return <TestTubeIcon />;
  if (n.includes("liver") || n.includes("sgpt") || n.includes("sgot")) return <LiverIcon />;
  if (n.includes("cbc") || n.includes("count") || n.includes("hemoglobin") || n.includes("blood")) return <DropIcon />;
  return <FlaskIcon />;
}

export default function PopularLabTests() {
  const navigate = useNavigate();
  const tests = useQuery(api.labTests.listActive);

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
  }, [tests]);

  if (!tests || tests.length === 0) return null;

  const pageScroll = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  };

  const arrowClass =
    "flex size-9 shrink-0 items-center justify-center rounded-full border border-border/70 bg-card text-foreground shadow-sm transition-all duration-300 hover:border-primary/30 hover:text-primary active:scale-95 disabled:opacity-35 disabled:pointer-events-none cursor-pointer";

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-1 sm:pt-2 pb-8 sm:pb-12">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
              <FlaskConical className="size-3" />
              Lab Diagnostics
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Popular Lab Tests
            </h2>
            <p className="mt-2 text-sm sm:text-base text-muted-foreground">
              Book diagnostic tests with home sample collection and quick reports
              from our trusted partner labs.
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous lab tests"
              className={arrowClass}
              disabled={!canPrev}
              onClick={() => pageScroll(-1)}
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next lab tests"
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
          {tests.map((test) => {
            const hasPrice = test.discountedPrice > 0;
            const showDiscount =
              hasPrice &&
              test.discountPercentage > 0 &&
              test.originalPrice > test.discountedPrice;
            return (
              <button
                key={test._id}
                type="button"
                onClick={() => navigate(`/lab-tests/test/${test._id}`)}
                className="group flex min-w-[calc(50%-0.5rem)] snap-start flex-col rounded-xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md cursor-pointer md:min-w-[calc(33.333%-0.667rem)] lg:min-w-[calc(25%-0.75rem)]"
              >
                <div className="flex items-center gap-3.5">
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors duration-300 group-hover:bg-primary/10 group-hover:text-primary">
                    {iconFor(test.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                      {test.name}
                    </h3>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground line-clamp-2">
                      {test.description}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-1.5 border-t border-border/50 pt-2.5">
                  {hasPrice ? (
                    <>
                      <span className="text-base font-extrabold text-foreground">
                        {formatCurrency(test.discountedPrice)}
                      </span>
                      {showDiscount && (
                        <span className="text-[11px] text-muted-foreground line-through">
                          {formatCurrency(test.originalPrice)}
                        </span>
                      )}
                      {showDiscount && (
                        <span className="ml-auto text-[10px] font-bold text-green-600">
                          {test.discountPercentage}% OFF
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-xs font-medium text-primary">
                      View details
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Mobile arrows */}
        <div className="mt-5 flex items-center justify-center gap-3 sm:hidden">
          <button
            type="button"
            aria-label="Previous lab tests"
            className={arrowClass}
            disabled={!canPrev}
            onClick={() => pageScroll(-1)}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next lab tests"
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