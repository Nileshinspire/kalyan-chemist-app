import { Link } from "react-router";
import {
  HeartPulse,
  Map as MapIcon,
  ShieldCheck,
  Stethoscope,
  Store,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import InfoPage, { InfoSection } from "@/components/layout/InfoPage";

/* ═══════════════════════════════════════════════════════════════════════════
   Sitemap — dedicated footer-linked page.

   Lists only public customer routes that exist in the router. Admin routes
   and internal tooling are intentionally excluded, and every entry below is
   a working destination.
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
      { label: "Contact Us", to: "/contact-us" },
      { label: "FAQs", to: "/faqs" },
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

export default function Sitemap() {
  return (
    <InfoPage
      badge="Sitemap"
      badgeIcon={<MapIcon className="size-3" aria-hidden="true" />}
      heroIcon={MapIcon}
      title="Sitemap"
      subtitle="Every customer-facing page on Kalyan Chemist, organised by section."
    >
      <div className="grid items-start gap-3.5 sm:grid-cols-2">
        {SECTIONS.map((section) => (
          <InfoSection
            key={section.title}
            icon={section.icon}
            title={section.title}
            description={section.note}
          >
            <ul className="grid grid-cols-1 gap-1.5">
              {section.links.map((link) => (
                <li key={link.label} className="min-w-0">
                  <Link
                    to={link.to}
                    className="inline-flex max-w-full rounded-sm text-[13px] leading-snug text-muted-foreground transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </InfoSection>
        ))}
      </div>
    </InfoPage>
  );
}
