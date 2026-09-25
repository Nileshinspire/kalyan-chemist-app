import { Link } from "react-router";
import {
  ArrowUpRight,
  Clock,
  FileText,
  HelpCircle,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  RotateCcw,
} from "lucide-react";
import InfoPage from "@/components/layout/InfoPage";

/* ═══════════════════════════════════════════════════════════════════════════
   Contact Us — dedicated footer-linked page.
   Only real, configured contact channels are shown (the same phone number,
   WhatsApp line, support email and store address already used across the
   app). No invented numbers, hours or addresses.

   There is intentionally no contact form: the platform has no contact-form
   backend, and the WhatsApp / phone / email / account support channels are
   the real, working ways to reach the team.
   ═══════════════════════════════════════════════════════════════════════════ */

const PHONE_DISPLAY = "+91 98765 43210";
const PHONE_TEL = "+919876543210";
const SUPPORT_EMAIL = "hello@kalyanchemist.in";
const BUSINESS_HOURS = "Mon – Sat, 8 AM – 10 PM";
const STORE_ADDRESS = "123 Health Street, Mumbai, Maharashtra 400001";
const WHATSAPP_URL = `https://wa.me/919876543210?text=${encodeURIComponent(
  "💊 Hi Kalyan Chemist! I have a question."
)}`;
const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=123+Health+Street+Mumbai+Maharashtra+400001";

const CHANNELS = [
  {
    icon: MessageCircle,
    label: "WhatsApp",
    value: "Chat with our pharmacist",
    hint: "Fastest way to confirm medicine availability",
    href: WHATSAPP_URL,
    external: true,
  },
  {
    icon: Phone,
    label: "Call us",
    value: PHONE_DISPLAY,
    hint: BUSINESS_HOURS,
    href: `tel:${PHONE_TEL}`,
    external: false,
  },
  {
    icon: Mail,
    label: "Email",
    value: SUPPORT_EMAIL,
    hint: "We reply within 24 hours",
    href: `mailto:${SUPPORT_EMAIL}`,
    external: false,
  },
  {
    icon: MapPin,
    label: "Visit our store",
    value: STORE_ADDRESS,
    hint: `${BUSINESS_HOURS} · Open in Maps`,
    href: MAPS_URL,
    external: true,
  },
];

const QUICK_HELP = [
  {
    icon: Package,
    label: "My Orders",
    description: "Review past orders and invoices",
    to: "/account/orders",
  },
  {
    icon: ArrowUpRight,
    label: "Track Order",
    description: "See live status of an active order",
    to: "/account/track-order",
  },
  {
    icon: FileText,
    label: "My Prescriptions",
    description: "Upload or review prescriptions",
    to: "/account/prescriptions",
  },
  {
    icon: RotateCcw,
    label: "Cancellation & Refund",
    description: "What happens after a cancellation",
    to: "/cancellation-refund",
  },
];

export default function ContactUs() {
  return (
    <InfoPage
      badge="We're here to help"
      badgeIcon={<HelpCircle className="size-3" aria-hidden="true" />}
      title="Contact Kalyan Chemist"
      subtitle="Questions about an order, a prescription, a lab test or a delivery? Reach our team through any of the channels below — or use the quick links to manage it yourself."
    >
      {/* Contact channels */}
      <div className="grid gap-4 sm:grid-cols-2">
        {CHANNELS.map((channel) => (
          <a
            key={channel.label}
            href={channel.href}
            target={channel.external ? "_blank" : undefined}
            rel={channel.external ? "noopener noreferrer" : undefined}
            className="group flex min-w-0 items-start gap-3.5 rounded-2xl border border-border/60 bg-card p-5 transition-all duration-300 hover:border-primary/25 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/[0.07] text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
              <channel.icon className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {channel.label}
              </span>
              <span className="mt-0.5 block break-words text-sm font-semibold text-foreground">
                {channel.value}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {channel.hint}
              </span>
            </span>
          </a>
        ))}
      </div>

      {/* Business hours */}
      <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-border/60 bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <Clock className="size-4 text-primary" aria-hidden="true" />
          <p className="text-sm font-semibold text-foreground">
            Support hours
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {BUSINESS_HOURS} · Orders can be placed online at any time
        </p>
      </div>

      {/* Quick self-service */}
      <section className="mt-10">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
          Manage it yourself
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Most order and prescription requests can be handled directly from your
          account. You will be asked to sign in first.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {QUICK_HELP.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="group flex min-w-0 items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 transition-all duration-300 hover:border-primary/25 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/[0.07] text-primary">
                <item.icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">
                  {item.label}
                </span>
                <span className="block text-xs leading-relaxed text-muted-foreground">
                  {item.description}
                </span>
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground/50 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
              />
            </Link>
          ))}
        </div>
      </section>

      {/* Before you write */}
      <section className="mt-10 rounded-2xl border border-border/60 bg-muted/30 p-5">
        <h2 className="text-sm font-semibold text-foreground">
          To help us resolve it faster
        </h2>
        <ul className="mt-3 space-y-2">
          {[
            "Keep your order or invoice number ready (found under My Orders).",
            "For a return or quality issue, share photos of the product and packaging.",
            "For prescription queries, mention the medicine and the prescribing doctor's reference.",
          ].map((tip) => (
            <li
              key={tip}
              className="flex gap-2.5 text-[13px] leading-relaxed text-muted-foreground"
            >
              <span
                aria-hidden="true"
                className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/50"
              />
              <span className="min-w-0">{tip}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-[13px] text-muted-foreground">
          You may also find an instant answer in our{" "}
          <Link
            to="/faqs"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            FAQs
          </Link>
          .
        </p>
      </section>
    </InfoPage>
  );
}
