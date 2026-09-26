import { useLayoutEffect, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { HeartPulse } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   Shared visual system for every footer-linked informational page.

   One coherent design, reused everywhere:
     · premium hero — eyebrow badge → large title → supporting line → meta
       chips, with soft emerald ambience, a very light dot pattern, a
       layered emblem mark and a faint watermark of the page icon
     · readable max-width content column
     · premium `InfoSection` cards with a hairline accent, hover lift and a
       one-shot scroll reveal

   Motion is limited to a single subtle fade-up per hero, one GPU-friendly
   reveal per section (opacity + transform, fired once) and hover
   transitions. There are no scroll listeners, canvases, particle systems or
   continuous animations, so these pages stay fast.
   ═══════════════════════════════════════════════════════════════════════════ */

interface InfoPageProps {
  badge?: string;
  badgeIcon?: ReactNode;
  title: string;
  subtitle?: string;
  /** Optional content rendered under the hero text (e.g. meta chips) */
  heroExtra?: ReactNode;
  /** Decorative hero mark shown beside the heading on larger screens */
  heroIcon?: LucideIcon;
  children: ReactNode;
}

export default function InfoPage({
  badge,
  badgeIcon,
  title,
  subtitle,
  heroExtra,
  heroIcon: HeroIcon = HeartPulse,
  children,
}: InfoPageProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />

      <main className="relative flex-1 overflow-hidden">
        {/* Subtle page background — soft off-white base with a very light
            emerald ambience, so no informational page renders as plain white.
            Static gradients only: no blur, no loops, no animation cost. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(55% 35% at 12% 4%, rgba(16,185,129,0.055), transparent 70%), radial-gradient(45% 40% at 88% 72%, rgba(16,185,129,0.05), transparent 70%), radial-gradient(40% 30% at 50% 100%, rgba(16,185,129,0.035), transparent 70%)",
          }}
        />

        <section className="relative isolate overflow-hidden border-b border-border/40">
          {/* Ambient healthcare light */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.07] via-primary/[0.02] to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-24 -top-28 size-72 rounded-full bg-primary/[0.10] blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-16 size-64 rounded-full bg-emerald-400/[0.10] blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 left-1/3 size-56 rounded-full bg-amber-300/[0.07] blur-3xl"
          />
          {/* Very light dot pattern */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 text-primary/20 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(currentColor 1px, transparent 1px)",
              backgroundSize: "18px 18px",
            }}
          />
          {/* Faint oversized page icon, layered behind the emblem */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-8 top-1/2 hidden -translate-y-1/2 text-primary/[0.055] lg:block"
          >
            <HeroIcon className="size-56" strokeWidth={1} />
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent"
          />

          <div className="relative mx-auto max-w-5xl px-4 py-9 sm:px-6 sm:py-12 lg:py-14">
            <div className="flex items-start justify-between gap-6">
              <motion.div
                className="min-w-0 flex-1"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                {badge && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/[0.08] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary shadow-sm">
                    {badgeIcon}
                    {badge}
                  </span>
                )}
                <h1 className="mt-3.5 max-w-3xl text-[1.7rem] font-bold leading-[1.12] tracking-[-0.02em] text-foreground sm:text-4xl lg:text-[2.5rem]">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[15px] lg:text-base">
                    {subtitle}
                  </p>
                )}
                {heroExtra && (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {heroExtra}
                  </div>
                )}
              </motion.div>

              {/* Layered emblem — outer rings + accent tile */}
              <motion.div
                aria-hidden="true"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.55,
                  delay: 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="relative hidden size-24 shrink-0 items-center justify-center sm:flex lg:size-28"
              >
                <span className="absolute inset-0 rounded-full border border-dashed border-primary/20" />
                <span className="absolute -inset-2.5 rounded-full border border-primary/10" />
                <span className="absolute inset-3 rounded-full bg-primary/[0.06] blur-md" />
                <span className="relative flex size-16 items-center justify-center rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.14] to-primary/[0.04] text-primary shadow-sm lg:size-[4.5rem]">
                  <HeroIcon className="size-7 lg:size-8" />
                </span>
              </motion.div>
            </div>
          </div>
        </section>

        <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}

/* ── Lightweight scroll reveal ──────────────────────────────────────────────
   One IntersectionObserver per element, fired once, animating opacity and
   transform only (compositor-friendly). Reduced-motion visitors and
   environments without IntersectionObserver (unit tests) never receive
   hidden content — nothing can get stuck invisible. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  /* Progressive enhancement: the node renders visible, then this layout
     effect (before paint, so nothing flickers) hides it until it enters the
     viewport — but only when IntersectionObserver exists and the visitor is
     fine with motion. The observer fires once and hands control back to the
     element's own CSS transition. */
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion || typeof IntersectionObserver === "undefined") {
      return;
    }

    const show = () => {
      node.style.opacity = "";
      node.style.transform = "";
    };

    node.style.opacity = "0";
    node.style.transform = "translate3d(0, 16px, 0)";

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          show();
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -40px 0px", threshold: 0 }
    );
    observer.observe(node);

    return () => {
      observer.disconnect();
      show();
    };
  }, []);

  return ref;
}

/** One-shot fade/slide-up wrapper for grids, cards and standalone blocks. */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  /** Optional stagger delay in seconds */
  delay?: number;
  className?: string;
}) {
  const ref = useReveal<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={cn(
        "transition-[opacity,transform] duration-[560ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        className
      )}
      style={delay > 0 ? { transitionDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}

/* ── Premium, consistently styled content section ── */
interface InfoSectionProps {
  id?: string;
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Optional element aligned to the right of the heading */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function InfoSection({
  id,
  icon: Icon,
  title,
  description,
  action,
  className,
  children,
}: InfoSectionProps) {
  const ref = useReveal<HTMLElement>();

  return (
    <section
      id={id}
      ref={ref}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm",
        "transition-[opacity,transform,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        "hover:-translate-y-0.5 hover:shadow-card-hover motion-reduce:transition-none sm:p-5",
        className
      )}
    >
      {/* Hairline accent */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent"
      />

      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary ring-1 ring-primary/10 transition-colors duration-300 group-hover:bg-primary/[0.14]">
              <Icon className="size-4" aria-hidden="true" />
            </span>
          )}
          <h2 className="min-w-0 text-[15px] font-semibold tracking-tight text-foreground sm:text-base">
            {title}
          </h2>
        </div>
        {action}
      </header>

      {description && (
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}

      <div className="mt-3.5">{children}</div>
    </section>
  );
}

/* ── Small accent bullet list used by several info pages ── */
export function InfoBullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li
          key={item}
          className="flex gap-2.5 text-[13px] leading-relaxed text-muted-foreground"
        >
          <span
            aria-hidden="true"
            className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/50"
          />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}