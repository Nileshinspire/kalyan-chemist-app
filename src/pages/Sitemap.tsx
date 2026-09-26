import { Link } from "react-router";
import {
  Headset,
  HeartPulse,
  Map as MapIcon,
  ShieldCheck,
  Stethoscope,
  Store,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import InfoPage, { InfoSection, Reveal } from "@/components/layout/InfoPage";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   Sitemap — dedicated footer-linked page.

   Lists only public customer routes that exist in the router, grouped into
   compact panels. Admin routes and internal tooling are intentionally
   excluded, and every entry below is a working destination.
   ═══════════════════════════════════════════════════════════════════════════ */

interface SitemapLink {
  label: string;
  to: string;
}

const SECTIONS: {
  title: string;
  icon: LucideIcon;
  note?: string;
  links: SitemapLink[];
}[] = [
  {
    title: "Kalyan Chemist",
    icon: HeartPulse,
    links: [
      { label: "Home", to: "/" },
      { label: "About Us", to: "/about-us" },
      { label: "Why Choose Us", to: "/why-choose-us" },
      { label: "Careers", to: "/careers" },
      { label: "Sitemap", to: "/sitemap" },
    ],
  },
  {
    title: "Shop",
    icon: Store,
    links: [
      { label: "All Medicines & Products", to: "/products" },
      { label: "Categories", to: "/categories" },
      { label: "Brands", to: "/brands" },
      { label: "New Arrivals", to: "/products?sort=newest" },
      { label: "Hot Sellers", to: "/hot-sellers" },
      { label: "Value Deals Under ₹100", to: "/value-deals" },
      {
        label: "Health Conditions",
        to: "/products?category=health-safety&nav=health-conditions",
      },
      { label: "Wishlist", to: "/wishlist" },
      { label: "Cart", to: "/cart" },
    ],
  },
  {
    title: "Healthcare Services",
    icon: Stethoscope,
    links: [
      { label: "Doctor Appointments", to: "/doctor-appointment" },
      { label: "Lab Tests", to: "/lab-tests" },
      { label: "Upload Prescription", to: "/upload-prescription" },
      { label: "Medicine Refill", to: "/refill" },
      { label: "AI Health Assistant", to: "/chatbot" },
    ],
  },
  {
    title: "My Account",
    icon: UserRound,
    note: "You'll be asked to sign in first.",
    links: [
      { label: "Account Overview", to: "/account" },
      { label: "Profile", to: "/account/profile" },
      { label: "My Orders", to: "/account/orders" },
      { label: "Track Order", to: "/account/track-order" },
      { label: "My Addresses", to: "/account/addresses" },
      { label: "My Prescriptions", to: "/account/prescriptions" },
      { label: "My Appointments", to: "/account/my-appointments" },
      { label: "My Lab Tests", to: "/account/my-lab-tests" },
      { label: "Lab Reports", to: "/account/lab-reports" },
      { label: "Medicine Refill", to: "/account/refill" },
      { label: "Notifications", to: "/account/notifications" },
    ],
  },
  {
    title: "Support",
    icon: Headset,
    note: "Call, email or WhatsApp us — Help & Support asks you to sign in first.",
    links: [
      { label: "Contact Us", to: "/contact-us" },
      { label: "FAQs", to: "/faqs" },
      { label: "Help & Support", to: "/account/help-support" },
    ],
  },
  {
    title: "Policies & Legal",
    icon: ShieldCheck,
    links: [
      { label: "Privacy Policy", to: "/privacy-policy" },
      { label: "Terms & Conditions", to: "/terms-conditions" },
      { label: "Shipping & Delivery", to: "/shipping-delivery" },
      { label: "Cancellation & Refund Policy", to: "/cancellation-refund" },
      { label: "Return Policy", to: "/return-policy" },
      { label: "Prescription Policy", to: "/prescription-policy" },
      { label: "Payment Policy", to: "/payment-policy" },
      { label: "Disclaimer", to: "/disclaimer" },
    ],
  },
];

const TOTAL_PAGES = SECTIONS.reduce(
  (total, section) => total + section.links.length,
  0
);

export default function Sitemap() {
  return (
    <InfoPage
      badge="Sitemap"
      badgeIcon={<MapIcon className="size-3" aria-hidden="true" />}
      heroIcon={MapIcon}
      title="Sitemap"
      subtitle="Every customer-facing page on Kalyan Chemist, organised by section."
      heroExtra={
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {SECTIONS.length} sections
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {TOTAL_PAGES} public pages
          </span>
        </>
      }
    >
      <Reveal className="grid items-start gap-3.5 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <InfoSection
            key={section.title}
            icon={section.icon}
            title={section.title}
            description={section.note}
            action={
              <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                {section.links.length}
              </span>
            }
          >
            <ul
              className={cn(
                "grid grid-cols-1 gap-1.5",
                section.links.length > 8 && "sm:grid-cols-2"
              )}
            >
              {section.links.map((link) => (
                <li key={link.label} className="min-w-0">
                  <Link
                    to={link.to}
                    className="group inline-flex max-w-full items-center gap-1.5 rounded-sm py-0.5 text-[12.5px] leading-snug text-muted-foreground transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <span
                      aria-hidden="true"
                      className="size-1 shrink-0 rounded-full bg-primary/40 transition-all duration-300 group-hover:scale-150 group-hover:bg-primary"
                    />
                    <span className="min-w-0 transition-transform duration-300 group-hover:translate-x-0.5">
                      {link.label}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </InfoSection>
        ))}
      </Reveal>

      <div className="mt-3.5 flex flex-col gap-3 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] to-primary/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-foreground">
            Can&apos;t find the page you need?
          </p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            Tell us what you were looking for and we&apos;ll point you to it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/contact-us"
            className="inline-flex items-center rounded-xl bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Contact Support
          </Link>
          <Link
            to="/faqs"
            className="inline-flex items-center rounded-xl border border-border/70 bg-card px-3.5 py-2 text-[12.5px] font-semibold text-foreground transition-colors duration-200 hover:border-primary/30 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Read FAQs
          </Link>
        </div>
      </div>
    </InfoPage>
  );
}
