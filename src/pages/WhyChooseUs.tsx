import { Link } from "react-router";
import {
  BadgeCheck,
  ClipboardCheck,
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
import InfoPage from "@/components/layout/InfoPage";

/* ═══════════════════════════════════════════════════════════════════════════
   Why Choose Us — dedicated footer-linked page.

   Expands only on messaging the platform already supports: authentic
   pharmacy stock, pharmacist review of prescriptions, delivery, refills,
   secure payments (Razorpay + Cash on Delivery), order tracking, lab tests
   and doctor appointments. The homepage "Why Kalyan Chemist" section is
   left completely untouched.
   ═══════════════════════════════════════════════════════════════════════════ */

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
      badge="Why Kalyan Chemist"
      badgeIcon={<Sparkles className="size-3" aria-hidden="true" />}
      title="Healthcare you can rely on, delivered"
      subtitle="Kalyan Chemist brings your neighbourhood pharmacy online — genuine medicines, pharmacist-reviewed prescriptions and essential health services, with the same care you expect at the counter."
    >
      {/* Reasons */}
      <div className="grid gap-4 sm:grid-cols-2">
        {REASONS.map((reason) => (
          <div
            key={reason.title}
            className="group flex min-w-0 items-start gap-3.5 rounded-2xl border border-border/60 bg-card p-5 transition-all duration-300 hover:border-primary/25 hover:shadow-card-hover"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/[0.07] text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
              <reason.icon className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground">
                {reason.title}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {reason.description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* How an order works */}
      <section className="mt-12">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
          How your order reaches you
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <div
              key={step.title}
              className="min-w-0 rounded-2xl border border-border/60 bg-muted/25 p-5"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <step.icon className="size-4" aria-hidden="true" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Step {index + 1}
                </span>
              </div>
              <h3 className="mt-3 text-sm font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust note + CTA */}
      <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-primary/15 bg-primary/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Our promise stays simple
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
              Genuine products, verified prescriptions and support you can reach
              when you need it.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/products"
            className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Browse Medicines
          </Link>
          <Link
            to="/about-us"
            className="inline-flex items-center rounded-xl border border-border/70 px-4 py-2 text-[13px] font-semibold text-foreground transition-colors duration-200 hover:border-primary/30 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            About Us
          </Link>
        </div>
      </div>
    </InfoPage>
  );
}
