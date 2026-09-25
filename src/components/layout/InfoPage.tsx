import type { ReactNode } from "react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { HeartPulse } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   Shared shell for the informational pages linked from the footer
   (About/Contact/FAQs/Why Choose Us/Careers/Sitemap and every policy page).

   Keeps the existing Kalyan Chemist page conventions — Navbar, a compact
   premium hero band, a readable max-width content column, then the Footer —
   so all footer-linked pages stay visually consistent and responsive without
   touching the global design system. Motion is limited to a single subtle
   fade-up; there are no scroll listeners, canvases or particle effects.
   ═══════════════════════════════════════════════════════════════════════════ */

interface InfoPageProps {
  badge?: string;
  badgeIcon?: ReactNode;
  title: string;
  subtitle?: string;
  /** Optional content rendered on the hero band (e.g. CTAs) */
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

      <main className="flex-1">
        <section className="relative isolate overflow-hidden border-b border-border/40">
          {/* Subtle background treatment */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.07] via-primary/[0.02] to-transparent"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-primary/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent"
          />

          <div className="relative mx-auto flex max-w-5xl items-start gap-6 px-4 py-8 sm:px-6 sm:py-11">
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
              {heroExtra && <div className="mt-4">{heroExtra}</div>}
            </motion.div>

            <motion.span
              aria-hidden="true"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="hidden size-14 shrink-0 items-center justify-center rounded-2xl border border-primary/10 bg-primary/[0.06] text-primary sm:flex"
            >
              <HeroIcon className="size-7" />
            </motion.span>
          </div>
        </section>

        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-11">
          {children}
        </div>
      </main>

      <Footer />
    </div>
  );
}

/* ── Reusable, consistently styled content section ── */
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
        "rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5",
        className
      )}
    >
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary">
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
