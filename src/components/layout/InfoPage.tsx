import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { HeartPulse } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   Shared visual system for every footer-linked informational page.

   One coherent design, reused everywhere:
     · compact premium hero — eyebrow → title → supporting line → icon mark,
       with soft emerald ambience and a very light dot pattern
     · readable max-width content column
     · premium `InfoSection` cards with a hairline accent and hover lift

   Motion is limited to a single subtle fade-up per hero plus hover
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
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent"
          />

          <div className="relative mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
            <div className="flex items-start justify-between gap-6">
              <motion.div
                className="min-w-0 flex-1"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                {badge && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/[0.07] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
                    {badgeIcon}
                    {badge}
                  </span>
                )}
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-[2.1rem]">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                    {subtitle}
                  </p>
                )}
                {heroExtra && (
                  <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    {heroExtra}
                  </div>
                )}
              </motion.div>

              <motion.div
                aria-hidden="true"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.5,
                  delay: 0.06,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="hidden size-16 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.12] to-primary/[0.03] text-primary shadow-sm sm:flex"
              >
                <HeroIcon className="size-7" />
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
  return (
    <section
      id={id}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm",
        "transition-shadow duration-300 hover:shadow-card-hover sm:p-5",
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
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary ring-1 ring-primary/10 transition-colors duration-300 group-hover:bg-primary/[0.12]">
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
