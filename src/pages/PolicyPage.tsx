import { Link } from "react-router";
import { motion, useScroll } from "framer-motion";
import {
  CalendarDays,
  ChevronUp,
  FileText,
  HelpCircle,
  LayoutList,
  ListTree,
} from "lucide-react";
import InfoPage, { Reveal } from "@/components/layout/InfoPage";
import { POLICIES, POLICY_LAST_UPDATED, type PolicyId } from "@/data/policies";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   Dedicated policy page. Each policy has its own route (e.g. /privacy-policy)
   but shares one readable, responsive layout so the legal pages stay
   consistent with the rest of the Kalyan Chemist design.

   Content is intentionally left exactly as authored. Presentation only:
   a compact premium hero, "at a glance" jump cards (mobile/tablet) that
   double as a visual summary of the sections, a sticky mini table of contents
   on desktop, and card-based sections. Motion stays minimal so legal pages
   remain calm and fast to read.
   ═══════════════════════════════════════════════════════════════════════════ */

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function scrollToSection(heading: string) {
  /* This app uses hash routing, so in-page jumps scroll directly instead of
     setting a hash (which would change the route). */
  document
    .getElementById(slugify(heading))
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function PolicyPage({ policyId }: { policyId: PolicyId }) {
  const policy = POLICIES[policyId];
  const totalSections = policy.sections.length;
  const { scrollYProgress } = useScroll();

  return (
    <>
      {/* Reading progress — a 3px line pinned to the very top of the
          viewport. Transform-only, driven by the page scroll position, so
          long legal documents always show how far along the reader is. */}
      <motion.div
        aria-hidden="true"
        style={{ scaleX: scrollYProgress }}
        className="fixed inset-x-0 top-0 z-[55] h-[3px] origin-left bg-gradient-to-r from-primary via-emerald-400 to-primary"
      />

    <InfoPage
      badge="Policies & Legal"
      badgeIcon={<FileText className="size-3" aria-hidden="true" />}
      heroIcon={FileText}
      title={policy.title}
      subtitle={policy.subtitle}
      heroExtra={
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            Last updated: {POLICY_LAST_UPDATED}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            <LayoutList className="size-3.5" aria-hidden="true" />
            {totalSections} sections
          </span>
        </>
      }
    >
      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start lg:gap-6">
        {/* ── Desktop: sticky mini table of contents ── */}
        <aside className="hidden lg:sticky lg:top-24 lg:block">
          <nav
            aria-label={`Sections of ${policy.title}`}
            className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent"
            />
            <header className="flex items-center gap-2">
              <ListTree
                className="size-3.5 text-primary"
                aria-hidden="true"
              />
              <h2 className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                On this page
              </h2>
            </header>
            <ul className="mt-2.5 space-y-0.5">
              {policy.sections.map((section, index) => (
                <li key={section.heading} className="min-w-0">
                  <button
                    type="button"
                    onClick={() => scrollToSection(section.heading)}
                    className="group flex w-full min-w-0 items-start gap-2 rounded-md px-1.5 py-1 text-left text-[12px] leading-snug text-muted-foreground transition-colors duration-200 hover:bg-primary/[0.05] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <span className="mt-px shrink-0 text-[10px] font-semibold tabular-nums text-primary/50 group-hover:text-primary">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">{section.heading}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0">
          {/* ── At-a-glance jump cards: the visual summary of this policy,
                shown above the detail at every breakpoint ── */}
          <section
            aria-label="At a glance"
            className="relative overflow-hidden rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent"
            />
            <header className="flex items-center gap-2">
              <ListTree className="size-3.5 text-primary" aria-hidden="true" />
              <h2 className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                At a glance
              </h2>
            </header>
            <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
              {policy.sections.map((section, index) => (
                <button
                  key={section.heading}
                  type="button"
                  onClick={() => scrollToSection(section.heading)}
                  className="flex w-full min-w-0 items-start gap-2.5 rounded-xl border border-border/50 bg-muted/20 px-3 py-2 text-left transition-colors duration-200 hover:border-primary/25 hover:bg-primary/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/[0.08] text-[10px] font-semibold tabular-nums text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12.5px] font-semibold leading-snug text-foreground">
                      {section.heading}
                    </span>
                    <span className="mt-0.5 block text-[10.5px] text-muted-foreground">
                      Section {index + 1} of {totalSections}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* ── Sections ── */}
          <div className="mt-3.5 space-y-3.5">
            {policy.sections.map((section, index) => (
              <Reveal key={section.heading}>
              <section
                id={slugify(section.heading)}
                className="scroll-mt-28 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5"
              >
                <header className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/[0.08] text-[10.5px] font-semibold tabular-nums text-primary"
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h2 className="min-w-0 text-[15px] font-semibold tracking-tight text-foreground sm:text-base">
                    {section.heading}
                  </h2>
                </header>

                {section.paragraphs?.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground"
                  >
                    {paragraph}
                  </p>
                ))}

                {section.bullets && (
                  <ul className="mt-3 space-y-1.5">
                    {section.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex gap-2.5 text-[13.5px] leading-relaxed text-muted-foreground"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/50"
                        />
                        <span className="min-w-0">{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              </Reveal>
            ))}
          </div>

          {/* ── Back to top ── */}
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() =>
                window.scrollTo({ top: 0, behavior: "smooth" })
              }
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3.5 py-1.5 text-[12px] font-semibold text-muted-foreground transition-colors duration-200 hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <ChevronUp className="size-3.5" aria-hidden="true" />
              Back to top
            </button>
          </div>

          {/* ── Help ── */}
          <div
            className={cn(
              "mt-3.5 flex flex-col gap-3.5 rounded-2xl border border-primary/15",
              "bg-gradient-to-br from-primary/[0.07] to-primary/[0.02] p-4 sm:flex-row",
              "sm:items-center sm:justify-between sm:p-5"
            )}
          >
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <HelpCircle className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Still have a question?
                </p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                  Our support team can help with orders, prescriptions and
                  refunds.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/contact-us"
                className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                Contact Support
              </Link>
              <Link
                to="/faqs"
                className="inline-flex items-center rounded-xl border border-border/70 bg-card px-4 py-2 text-[13px] font-semibold text-foreground transition-colors duration-200 hover:border-primary/30 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                Read FAQs
              </Link>
            </div>
          </div>
        </div>
      </div>
    </InfoPage>
    </>
  );
}
