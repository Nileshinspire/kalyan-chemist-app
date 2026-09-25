import { Link } from "react-router";
import {
  BadgeCheck,
  ClipboardCheck,
  CreditCard,
  FileText,
  FlaskConical,
  Package,
  RefreshCw,
  Shield,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Truck,
} from "lucide-react";
import InfoPage, { InfoSection } from "@/components/layout/InfoPage";

/* ═══════════════════════════════════════════════════════════════════════════
   Why Choose Us — dedicated footer-linked page.

   Expands only on messaging the platform already supports: authentic
   pharmacy stock, pharmacist review of prescriptions, delivery, refills,
   secure payments (Razorpay + Cash on Delivery), order tracking, lab tests
   and doctor appointments. The homepage "Why Kalyan Chemist" section is
   left completely untouched.
   ═══════════════════════════════════════════════════════════════════════════ */

const TRUST_CHIPS = [
  { label: "Verified pharmacy stock", icon: ShieldCheck },
  { label: "Pharmacist reviewed", icon: FlaskConical },
  { label: "Secure payments", icon: CreditCard },
  { label: "Trackable delivery", icon: Truck },
];

const REASONS = [
  {
    icon: Shield,
    title: "Authentic Medicines",
    description:
      "100% verified pharmacy stock sourced from licensed distributors, stored and handled as medicines should be.",
  },
  {
    icon: FlaskConical,
    title: "Expert Pharmacists",
    description:
      "Every prescription-only order is reviewed by our pharmacy team before it is dispensed — not just scanned and shipped.",
  },
  {
    icon: Truck,
    title: "Reliable Home Delivery",
    description:
      "Clear delivery charges and an estimated delivery time for your pincode, shown before you confirm your order.",
  },
  {
    icon: RefreshCw,
    title: "Seamless Refills",
    description:
      "Medicines you take regularly can be reordered with Medicine Refill, so you are never caught without them.",
  },
  {
    icon: FileText,
    title: "Digital Prescription Records",
    description:
      "Upload a prescription once and find it later under My Prescriptions, ready for your next order.",
  },
  {
    icon: ClipboardCheck,
    title: "Live Order Tracking",
    description:
      "Follow each order from confirmation to delivery, with invoices and order history in one place.",
  },
  {
    icon: ShieldCheck,
    title: "Safe & Secure Checkout",
    description:
      "Prepaid orders are completed on our payment provider's encrypted checkout, with Cash on Delivery for eligible orders.",
  },
  {
    icon: Stethoscope,
    title: "Health Services In One Place",
    description:
      "Book lab tests and doctor appointments alongside your medicines and healthcare products.",
  },
];

const STEPS = [
  {
    icon: Package,
    title: "Order",
    description: "Browse medicines and healthcare products, or upload a prescription.",
  },
  {
    icon: ClipboardCheck,
    title: "Verify",
    description: "Our pharmacist reviews prescription items before anything is dispensed.",
  },
  {
    icon: Truck,
    title: "Dispatch",
    description: "Your order is packed and handed over for delivery to your address.",
  },
  {
    icon: BadgeCheck,
    title: "Delivered",
    description: "Track it live, and keep the invoice and order history in your account.",
  },
];

export default function WhyChooseUs() {
  return (
    <InfoPage
      badge="Trust & Values"
      badgeIcon={<Sparkles className="size-3" aria-hidden="true" />}
      heroIcon={Sparkles}
      title="Healthcare you can rely on, delivered"
      subtitle="Kalyan Chemist brings your neighbourhood pharmacy online — genuine medicines, pharmacist-reviewed prescriptions and essential health services, with the same care you expect at the counter."
    >
      {/* ── Trust statement ── */}
      <section className="relative isolate overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.08] via-primary/[0.03] to-transparent p-5 shadow-sm sm:p-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-primary/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
        />
        <div className="relative">
          <p className="text-[10.5px] font-semibold uppercase tracking-wider text-primary">
            Our promise
          </p>
          <p className="mt-2.5 max-w-3xl text-lg font-semibold leading-snug tracking-tight text-foreground sm:text-xl lg:text-[1.6rem]">
            Genuine medicines, pharmacist-reviewed prescriptions and essential
            health services — with the same care you expect at the counter.
          </p>
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {TRUST_CHIPS.map(({ label, icon: Icon }) => (
              <li
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-card/80 px-2.5 py-1 text-[11.5px] font-medium text-foreground/80"
              >
                <Icon className="size-3.5 text-primary" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Reasons ── */}
      <section className="mt-6">
        <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold tracking-tight text-foreground sm:text-base">
              What you get with every order
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              The practical things that make an online pharmacy worth trusting.
            </p>
          </div>
          <span className="rounded-full bg-muted/60 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            {REASONS.length} reasons
          </span>
        </header>

        <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
          {REASONS.map((reason) => (
            <div
              key={reason.title}
              className="group relative flex min-w-0 items-start gap-3.5 overflow-hidden rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-all duration-300 hover:border-primary/25 hover:shadow-card-hover sm:p-5"
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent"
              />
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/[0.07] text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                <reason.icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">
                  {reason.title}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {reason.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── How an order works ── */}
      <section className="mt-8">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground sm:text-base">
          How your order reaches you
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          Four steps, with a pharmacist in the middle of them.
        </p>

        <div className="relative mt-4">
          {/* Connector rail (desktop only) */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 right-0 top-[1.4rem] hidden h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent lg:block"
          />
          <div className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, index) => (
              <div
                key={step.title}
                className="min-w-0 rounded-2xl border border-border/60 bg-muted/25 p-4"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-card text-primary shadow-sm">
                    <step.icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Step {index + 1}
                  </span>
                </div>
                <h3 className="mt-2.5 text-sm font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <InfoSection
        className="mt-6"
        icon={ShieldCheck}
        title="Our promise stays simple"
        description="Genuine products, verified prescriptions and support you can reach when you need it."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/products"
              className="inline-flex items-center rounded-xl bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              Browse Medicines
            </Link>
            <Link
              to="/about-us"
              className="inline-flex items-center rounded-xl border border-border/70 bg-card px-3.5 py-2 text-[12.5px] font-semibold text-foreground transition-colors duration-200 hover:border-primary/30 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              About Us
            </Link>
          </div>
        }
      >
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
          {[
            "Genuine products",
            "Verified prescriptions",
            "Reachable support",
          ].map((item) => (
            <li
              key={item}
              className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground"
            >
              <BadgeCheck className="size-3.5 text-primary" aria-hidden="true" />
              {item}
            </li>
          ))}
        </ul>
      </InfoSection>
    </InfoPage>
  );
}
