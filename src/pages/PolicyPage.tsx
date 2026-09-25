import { Link } from "react-router";
import { CalendarDays, FileText, HelpCircle } from "lucide-react";
import InfoPage from "@/components/layout/InfoPage";
import { POLICIES, POLICY_LAST_UPDATED, type PolicyId } from "@/data/policies";

/* ═══════════════════════════════════════════════════════════════════════════
   Dedicated policy page. Each policy has its own route (e.g. /privacy-policy)
   but shares one readable, responsive layout so the legal pages stay
   consistent with the rest of the Kalyan Chemist design.
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
      title={policy.title}
      subtitle={policy.subtitle}
      heroExtra={
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          Last updated: {POLICY_LAST_UPDATED}
        </p>
      }
    >
      {/* On this page */}
      <nav
        aria-label={`Sections of ${policy.title}`}
        className="mb-8 rounded-2xl border border-border/60 bg-card p-5"
      >
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          On this page
        </h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {policy.sections.map((section) => (
            <li key={section.heading}>
              {/* This app uses hash routing, so in-page jumps scroll directly
                  instead of setting a hash (which would change the route). */}
              <button
                type="button"
                onClick={() =>
                  document
                    .getElementById(slugify(section.heading))
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="inline-flex max-w-full text-left text-[13px] leading-snug text-muted-foreground transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-sm"
              >
                {section.heading}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-8">
        {policy.sections.map((section) => (
          <section
            key={section.heading}
            id={slugify(section.heading)}
            className="scroll-mt-28"
          >
            <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {section.heading}
            </h2>

            {section.paragraphs?.map((paragraph) => (
              <p
                key={paragraph}
                className="mt-2.5 text-sm leading-relaxed text-muted-foreground"
              >
                {paragraph}
              </p>
            ))}

            {section.bullets && (
              <ul className="mt-3 space-y-2">
                {section.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground"
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
      <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-primary/15 bg-primary/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between">
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
