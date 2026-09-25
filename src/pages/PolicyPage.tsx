import { Link } from "react-router";
import { CalendarDays, FileText, HelpCircle, ListTree } from "lucide-react";
import InfoPage from "@/components/layout/InfoPage";
import { POLICIES, POLICY_LAST_UPDATED, type PolicyId } from "@/data/policies";

/* ═══════════════════════════════════════════════════════════════════════════
   Dedicated policy page. Each policy has its own route (e.g. /privacy-policy)
   but shares one readable, responsive layout so the legal pages stay
   consistent with the rest of the Kalyan Chemist design.

   Content is intentionally left exactly as authored — only the presentation
   (compact hero, section cards, anchored headings) is refined. Motion stays
   minimal so legal pages remain calm and fast to read.
   ═══════════════════════════════════════════════════════════════════════════ */

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function PolicyPage({ policyId }: { policyId: PolicyId }) {
  const policy = POLICIES[policyId];

  return (
    <InfoPage
      badge="Policies & Legal"
      badgeIcon={<FileText className="size-3" aria-hidden="true" />}
      heroIcon={FileText}
      title={policy.title}
      subtitle={policy.subtitle}
      heroExtra={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          Last updated: {POLICY_LAST_UPDATED}
        </span>
      }
    >
      {/* On this page */}
      <nav
        aria-label={`Sections of ${policy.title}`}
        className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5"
      >
        <header className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary">
            <ListTree className="size-4" aria-hidden="true" />
          </span>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            On this page
          </h2>
        </header>
        <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
          {policy.sections.map((section, index) => (
            <li key={section.heading} className="min-w-0">
              {/* This app uses hash routing, so in-page jumps scroll directly
                  instead of setting a hash (which would change the route). */}
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById(slugify(section.heading))
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="group flex w-full min-w-0 items-start gap-2 rounded-md px-1.5 py-1 text-left text-[13px] leading-snug text-muted-foreground transition-colors duration-200 hover:bg-primary/[0.05] hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span className="mt-px shrink-0 text-[11px] font-semibold tabular-nums text-primary/50 group-hover:text-primary">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">{section.heading}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-4 space-y-3.5">
        {policy.sections.map((section, index) => (
          <section
            key={section.heading}
            id={slugify(section.heading)}
            className="scroll-mt-24 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5"
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
        ))}
      </div>

      {/* Help */}
      <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-primary/15 bg-primary/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <HelpCircle className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Still have a question?
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
              Our support team can help with orders, prescriptions and refunds.
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
            className="inline-flex items-center rounded-xl border border-border/70 px-4 py-2 text-[13px] font-semibold text-foreground transition-colors duration-200 hover:border-primary/30 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Read FAQs
          </Link>
        </div>
      </div>
    </InfoPage>
  );
}
