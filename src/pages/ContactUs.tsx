import { Link } from "react-router";
import {
  ArrowUpRight,
  Clock,
  FileText,
  Headset,
  HelpCircle,
  Lightbulb,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import InfoPage, { InfoBullets, InfoSection } from "@/components/layout/InfoPage";

/* ═══════════════════════════════════════════════════════════════════════════
   Contact Us — dedicated footer-linked page.

   Only real, configured contact channels are shown (the same phone number,
   WhatsApp line, support email and store address already used across the
   app). No invented numbers, hours or addresses.

   There is intentionally no contact form: the platform has no contact-form
   backend, so the right-hand column offers the real support actions instead
   (self-service account tools, preparation tips and the FAQs).
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
    hint: "Open in Maps",
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
      badge="Customer Support"
      badgeIcon={<HelpCircle className="size-3" aria-hidden="true" />}
      heroIcon={Headset}
      title="Contact Kalyan Chemist"
      subtitle="Questions about an order, a prescription, a lab test or a delivery? Reach our team through any of the channels below — or use the quick actions to manage it yourself."
    >
      <div className="grid items-start gap-3.5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-5">
        {/* ── Left: support channels ── */}
        <div className="space-y-3.5">
          <InfoSection
            icon={Headset}
            title="Reach our team"
            description="Every channel below connects to the same support team."
          >
            <ul className="divide-y divide-border/50">
              {CHANNELS.map((channel) => (
                <li key={channel.label} className="min-w-0">
                  <a
                    href={channel.href}
                    target={channel.external ? "_blank" : undefined}
                    rel={channel.external ? "noopener noreferrer" : undefined}
                    className="group flex min-w-0 items-start gap-3 rounded-xl px-1 py-2.5 transition-colors duration-200 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/[0.08] text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                      <channel.icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {channel.label}
                      </span>
                      <span className="mt-0.5 block break-words text-[13.5px] font-semibold leading-snug text-foreground">
                        {channel.value}
                      </span>
                      <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
                        {channel.hint}
                      </span>
                    </span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="mt-1 size-4 shrink-0 text-muted-foreground/40 transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </InfoSection>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <InfoSection icon={Clock} title="Support hours">
              <p className="text-[13px] font-medium text-foreground">
                {BUSINESS_HOURS}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                Orders and refill requests can be placed online at any time.
              </p>
            </InfoSection>

            <InfoSection icon={MapPin} title="Our store">
              <p className="text-[13px] font-medium leading-snug text-foreground">
                {STORE_ADDRESS}
              </p>
              <a
                href={MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-primary underline-offset-4 hover:underline"
              >
                Open in Maps
                <ArrowUpRight className="size-3" aria-hidden="true" />
              </a>
            </InfoSection>
          </div>
        </div>

        {/* ── Right: support actions ── */}
        <div className="space-y-3.5">
          <InfoSection
            icon={Sparkles}
            title="Manage it yourself"
            description="Most order and prescription requests can be handled from your account. You will be asked to sign in first."
          >
            <ul className="grid gap-1.5">
              {QUICK_HELP.map((item) => (
                <li key={item.label} className="min-w-0">
                  <Link
                    to={item.to}
                    className="group flex min-w-0 items-center gap-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 transition-all duration-200 hover:border-primary/25 hover:bg-primary/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-card text-primary ring-1 ring-border/60">
                      <item.icon className="size-3.5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold text-foreground">
                        {item.label}
                      </span>
                      <span className="block text-[11.5px] leading-snug text-muted-foreground">
                        {item.description}
                      </span>
                    </span>
                    <ArrowUpRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground/40 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </InfoSection>

          <InfoSection icon={Lightbulb} title="To help us resolve it faster">
            <InfoBullets
              items={[
                "Keep your order or invoice number ready (found under My Orders).",
                "For a return or quality issue, share photos of the product and packaging.",
                "For prescription queries, mention the medicine and the prescribing doctor's reference.",
              ]}
            />
          </InfoSection>

          <div className="flex flex-col gap-3 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] to-primary/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-foreground">
                Looking for an instant answer?
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                Our FAQs cover orders, prescriptions, payments and refunds.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/faqs"
                className="inline-flex items-center rounded-xl bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                Read FAQs
              </Link>
              <Link
                to="/account/help-support"
                className="inline-flex items-center rounded-xl border border-border/70 bg-card px-3.5 py-2 text-[12.5px] font-semibold text-foreground transition-colors duration-200 hover:border-primary/30 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                Help &amp; Support
              </Link>
            </div>
          </div>
        </div>
      </div>
    </InfoPage>
  );
}
