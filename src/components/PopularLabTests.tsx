import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { FlaskConical, ChevronLeft, ChevronRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { formatCurrency } from "@/lib/auth-utils";

/* ─── Popular Lab Tests ───
 * Horizontal carousel of the REAL lab tests from the Convex `lab_tests`
 * table. Premium pencil-sketch medical icons, same family as other sections.
 */

/* ─── Blood Drop — CBC / Hemoglobin / Blood Count ─── */
function DropIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="size-8" aria-hidden="true">
      {/* Blood drop — teardrop shape */}
      <path d="M16 4c4.5 5 7 8.5 7 12a7 7 0 0 1-14 0c0-3.5 2.5-7 7-12z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Inner light reflection */}
      <path d="M13 14c.5 1.5 1.5 2.5 3 3" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.5" />
      {/* Highlight */}
      <path d="M14 10c.8 1.2 1.3 2.5 1.5 3.5" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.35" />
      {/* Surface tension detail */}
      <path d="M11.5 15c1 1.5 2.2 2.5 3.5 3" stroke="currentColor" strokeWidth="0.4" strokeLinecap="round" opacity="0.25" />
    </svg>
  );
}

/* ─── Test Tube — ESR / Sedimentation ─── */
function TestTubeIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="size-8" aria-hidden="true">
      {/* Tube rim */}
      <path d="M12 3h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12.5 3v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M19.5 3v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      {/* Tube body */}
      <path d="M12.5 4v8a3 3 0 0 0-.8 2l-2 5.5A3.5 3.5 0 0 0 14 26h4a3.5 3.5 0 0 0 4.3-6.5l-2-5.5a3 3 0 0 0-.8-2V4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* Liquid level */}
      <path d="M11 17h10" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      {/* Sediment layers */}
      <path d="M11.5 20h9" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.4" />
      <path d="M12 22h8" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.3" />
      {/* Bubbles in liquid */}
      <circle cx="14" cy="15" r="0.6" stroke="currentColor" strokeWidth="0.5" opacity="0.35" />
      <circle cx="17" cy="14" r="0.45" stroke="currentColor" strokeWidth="0.4" opacity="0.3" />
      <circle cx="15.5" cy="16" r="0.35" stroke="currentColor" strokeWidth="0.35" opacity="0.25" />
      {/* Meniscus curve */}
      <path d="M12 17c2 .8 6 .8 8 0" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}

/* ─── Lipid / Heart — Lipid Profile / Cholesterol ─── */
function LipidIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="size-8" aria-hidden="true">
      {/* Heart shape */}
      <path d="M16 27C10 22 5 18 5 12.5a5.5 5.5 0 0 1 10-3.2A5.5 5.5 0 0 1 27 12.5C27 18 22 22 16 27z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Inner heart detail — chambers */}
      <path d="M16 13c-1.5 2-2.5 4-2.8 6" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.4" />
      <path d="M16 13c1.5 2 2.5 4 2.8 6" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.4" />
      {/* Lipid drop inside heart */}
      <path d="M16 10c1.5 1.8 2.3 3 2.3 4a2.3 2.3 0 0 1-4.6 0c0-1 .8-2.2 2.3-4z" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      {/* Highlight */}
      <path d="M14.8 11.5c.5.8.8 1.5.8 2.2" stroke="currentColor" strokeWidth="0.4" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}

/* ─── Vitamin D / Sun — Vitamin Tests ─── */
function VitaminIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="size-8" aria-hidden="true">
      {/* Sun core */}
      <circle cx="16" cy="14" r="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* Inner ring */}
      <circle cx="16" cy="14" r="3" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.35" />
      {/* Sun rays */}
      <path d="M16 5v2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M16 20.5V23" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M7 14h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M22.5 14H25" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M9.6 7.6l1.8 1.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M20.6 18.6l1.8 1.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M22.4 7.6l-1.8 1.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M11.4 18.6l-1.8 1.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      {/* D3 label */}
      <path d="M14.5 26c.8-1 1.5-1.5 1.5-2.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
      <path d="M17.5 23.5v2.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

/* ─── Thyroid — TSH / Thyroid Profile ─── */
function ThyroidIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="size-8" aria-hidden="true">
      {/* Trachea */}
      <path d="M16 3v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M14.5 4h3" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
      <path d="M14.5 5.2h3" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
      {/* Left lobe */}
      <path d="M14 7c-4 0-7 3-7 7 0 4 2.5 6.5 5.5 6.5 1.5 0 2.5-.5 3.5-2V7z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* Right lobe */}
      <path d="M18 7c4 0 7 3 7 7 0 4-2.5 6.5-5.5 6.5-1.5 0-2.5-.5-3.5-2V7z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* Isthmus connection */}
      <path d="M14 12c.5 1 1 1.5 2 1.5s1.5-.5 2-1.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
      {/* Center line — trachea continuation */}
      <path d="M16 7v12" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.3" />
      {/* Lobe surface texture */}
      <path d="M10 11c.5 1.5 1.2 2.5 2.5 3" stroke="currentColor" strokeWidth="0.4" strokeLinecap="round" opacity="0.25" />
      <path d="M22 11c-.5 1.5-1.2 2.5-2.5 3" stroke="currentColor" strokeWidth="0.4" strokeLinecap="round" opacity="0.25" />
    </svg>
  );
}

/* ─── Glucometer — Glucose / Sugar / HbA1c ─── */
function GlucometerIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="size-8" aria-hidden="true">
      {/* Meter body */}
      <path d="M6 7c-.1-.3-.3-.5-.6-.5H18c.4 0 .7.3.7.7v17c0 .4-.3.7-.7.7H5.6c-.3 0-.5-.2-.6-.5V7z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* Screen */}
      <rect x="8" y="9" width="9" height="6" rx="1.2" stroke="currentColor" strokeWidth="1" />
      {/* Reading */}
      <path d="M10 11.5v2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M9.3 12.5h1.4" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
      <path d="M12.5 11v2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M12.5 13.5h.5" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" />
      <path d="M14 11c.4.8.6 1.5.6 2.2" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
      {/* Button */}
      <circle cx="12.5" cy="18.5" r="1.5" stroke="currentColor" strokeWidth="0.9" />
      {/* Strip slot */}
      <path d="M18.7 12h2.8a.8.8 0 0 1 .8.8v1.2a.8.8 0 0 1-.8.8h-2.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
      {/* Blood drop */}
      <path d="M23.3 12.3c.8 1.1 1.3 2 1.3 2.7a1.3 1.3 0 0 1-2.6 0c0-.7.5-1.6 1.3-2.7z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M23.3 13.5c.3.4.5.8.5 1.2a.5.5 0 0 1-1 0c0-.4.2-.8.5-1.2" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

/* ─── Liver — SGPT / SGOT / Liver Function ─── */
function LiverIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="size-8" aria-hidden="true">
      {/* Liver — right lobe */}
      <path d="M8 17c0-7 5-12 11-12 5.5 0 10 4 10 9.5 0 5.5-4 10.5-9 10.5-4.5 0-8-3-10.5-6C9 19 8 18 8 17z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* Falciform ligament */}
      <path d="M17 5.5c-1.2 3.5-1.8 7-1.8 10.5 0 3.5.6 7 1.8 10" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.5" />
      {/* Gallbladder */}
      <path d="M11.5 18.5c-.3-1.5-.2-3 .5-4.2.7-1 1.8-1.2 2.5-.5.7.7.5 2-.2 3.5-.5 1-1.3 1.5-2 1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12.3 14.3v-1.5" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
      {/* Vein detail */}
      <path d="M20 8c-1 2-1.5 4-1.5 6.5" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.3" />
      <path d="M24 10c-1.5 2-2.5 4-3 6" stroke="currentColor" strokeWidth="0.45" strokeLinecap="round" opacity="0.25" />
    </svg>
  );
}

/* ─── Flask — Generic / Other Tests ─── */
function FlaskIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="size-8" aria-hidden="true">
      {/* Flask neck */}
      <path d="M13 3h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M13.5 3v7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M18.5 3v7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      {/* Flask body — conical */}
      <path d="M13.5 10L9 19a3.5 3.5 0 0 0 3 5.5h8a3.5 3.5 0 0 0 3-5.5l-4.5-9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* Liquid level */}
      <path d="M10 18h12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      {/* Bubbles in liquid */}
      <circle cx="13" cy="21" r="0.7" stroke="currentColor" strokeWidth="0.5" opacity="0.4" />
      <circle cx="16" cy="22" r="0.55" stroke="currentColor" strokeWidth="0.4" opacity="0.35" />
      <circle cx="18.5" cy="20.5" r="0.45" stroke="currentColor" strokeWidth="0.35" opacity="0.3" />
      {/* Meniscus */}
      <path d="M10.5 18c3 .8 7 .8 11 0" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.3" />
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
                  <span
                    className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted text-[#0D6B62] transition-all duration-300 group-hover:bg-primary/10 group-hover:text-primary group-hover:shadow-[0_2px_14px_rgba(16,185,129,0.18)]"
                    style={{
                      filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.07)) drop-shadow(0 2px 3px rgba(0,0,0,0.1))",
                      transform: "perspective(250px) rotateX(1.5deg)",
                      transition: "transform 280ms ease, filter 280ms ease",
                    }}
                  >
                    <span
                      className="block transition-transform duration-280 ease-out group-hover:scale-[1.07]"
                      style={{ transform: "perspective(250px) rotateX(2deg)" }}
                    >
                      {iconFor(test.name)}
                    </span>
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
