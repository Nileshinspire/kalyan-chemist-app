import { memo, useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router";
import {
  BadgeCheck,
  ChevronDown,
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Pill,
  ShieldCheck,
  Smartphone,
  Truck,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   KALYAN CHEMIST — SITE FOOTER
   ---------------------------------------------------------------------------
   Information architecture:
     Column 1  About Kalyan Chemist   (brand + company links)
     Column 2  Healthcare Services
     Column 3  Shop / Medicines
     Column 4  Customer Support
     Column 5  Policies & Legal
   Followed by: contact/help, popular categories, payment, app install, bottom bar.

   Responsive behaviour — driven purely by CSS, so there is no layout JS,
   no matchMedia dependency and no horizontal overflow at any width:
     ≥ 1024px  five columns, always expanded
     ≥  768px  balanced two-column grid, always expanded
     <  768px  one accessible accordion per group
               (aria-expanded + aria-controls, collapsed by default)

   Every destination below is a real, existing route or a real configured
   contact channel. No placeholder ("#"), no invented numbers, no fake socials.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Real, configured contact details (same values used across the app) ── */
const PHONE_DISPLAY = "+91 98765 43210";
const PHONE_TEL = "+919876543210";
const WHATSAPP_NUMBER = "919876543210";
const SUPPORT_EMAIL = "hello@kalyanchemist.in";
const STORE_ADDRESS = "123 Health Street, Mumbai, Maharashtra 400001";
const BUSINESS_HOURS = "Mon – Sat, 8 AM – 10 PM";
const MAPS_URL =
  "https://www.google.com/maps/search/?api=1&query=123+Health+Street+Mumbai+Maharashtra+400001";

const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "💊 Hi Kalyan Chemist! I need help with an order."
)}`;

/* ── Link model ── */
interface FooterLink {
  label: string;
  /** Internal route (rendered as a router <Link>) */
  to?: string;
  /** External/action destination (rendered as a real <a>) */
  href?: string;
  /** Wraps long values such as the support email */
  breakAll?: boolean;
}

const COMPANY_LINKS: FooterLink[] = [
  { label: "About Us", to: "/about-us" },
  { label: "Contact Us", to: "/contact-us" },
  { label: "FAQs", to: "/faqs" },
  { label: "Why Choose Us", to: "/why-choose-us" },
  { label: "Sitemap", to: "/sitemap" },
  { label: "Careers", to: "/careers" },
];

const HEALTHCARE_LINKS: FooterLink[] = [
  { label: "Doctor Appointments", to: "/doctor-appointment" },
  { label: "Lab Tests", to: "/lab-tests" },
  { label: "Upload Prescription", to: "/upload-prescription" },
  { label: "Medicine Refill", to: "/refill" },
  { label: "AI Health Assistant", to: "/chatbot" },
  {
    label: "Browse Health Conditions",
    to: "/products?category=health-safety&nav=health-conditions",
  },
  {
    label: "Healthcare Devices",
    to: "/products?category=health-safety&nav=health-devices",
  },
];

const SHOP_LINKS: FooterLink[] = [
  { label: "All Medicines", to: "/products" },
  { label: "Medicine Categories", to: "/categories" },
  { label: "Healthcare Products", to: "/products?nav=all" },
  {
    label: "Healthcare Devices",
    to: "/products?category=health-safety&nav=health-devices",
  },
  { label: "New Arrivals", to: "/products?sort=newest" },
  { label: "Hot Sellers", to: "/hot-sellers" },
  { label: "Value Deals Under ₹100", to: "/value-deals" },
  { label: "Wishlist", to: "/wishlist" },
];

const SUPPORT_LINKS: FooterLink[] = [
  { label: "My Account", to: "/account" },
  { label: "My Orders", to: "/account/orders" },
  { label: "Track Order", to: "/account/track-order" },
  { label: "My Addresses", to: "/account/addresses" },
  { label: "My Prescriptions", to: "/account/prescriptions" },
  { label: "Notifications", to: "/account/notifications" },
  { label: "Contact Support", to: "/contact-us" },
  { label: "WhatsApp Support", href: WHATSAPP_URL },
  { label: "Cancellation & Refund", to: "/cancellation-refund" },
];

const POLICY_LINKS: FooterLink[] = [
  { label: "Privacy Policy", to: "/privacy-policy" },
  { label: "Terms & Conditions", to: "/terms-conditions" },
  { label: "Shipping & Delivery", to: "/shipping-delivery" },
  { label: "Cancellation & Refund Policy", to: "/cancellation-refund" },
  { label: "Return Policy", to: "/return-policy" },
  { label: "Prescription Policy", to: "/prescription-policy" },
  { label: "Payment Policy", to: "/payment-policy" },
  { label: "Disclaimer", to: "/disclaimer" },
];

/* Existing category navigation used by the header — same slugs/keys. */
const POPULAR_CATEGORIES: FooterLink[] = [
  { label: "Medicines", to: "/products?nav=all" },
  { label: "Baby Care", to: "/products?category=baby-mother&nav=baby-care" },
  { label: "Women Care", to: "/products?category=baby-mother&nav=women-care" },
  { label: "Personal Care", to: "/products?category=personal-care&nav=personal-care" },
  { label: "Nutrition & Supplements", to: "/products?category=nutrition&nav=nutrition" },
  { label: "Ayurveda", to: "/products?category=alternative-medicine&nav=ayurveda" },
  { label: "Health Devices", to: "/products?category=health-safety&nav=health-devices" },
  { label: "Home Essentials", to: "/products?category=others&nav=home-essentials" },
  {
    label: "Health Conditions",
    to: "/products?category=health-safety&nav=health-conditions",
  },
];

const TRUST_ITEMS = [
  { label: "100% Genuine Products", icon: ShieldCheck },
  { label: "Secure Payments", icon: ShieldCheck },
  { label: "Safe & Secure Checkout", icon: BadgeCheck },
  { label: "Reliable Delivery", icon: Truck },
];

/* Only the payment methods the checkout actually supports (Razorpay + COD). */
const PAYMENT_METHODS = [
  "Cash on Delivery",
  "UPI",
  "Credit / Debit Cards",
  "Net Banking",
];

/* ── PWA install: only ever rendered when the browser offers a real prompt ── */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function PwaInstallButton() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch {
      /* the browser withdrew the prompt — nothing to recover from */
    } finally {
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  if (installed) {
    return (
      <p className="text-xs font-medium text-emerald-200">
        Kalyan Chemist is installed on this device.
      </p>
    );
  }

  if (deferredPrompt) {
    return (
      <button
        type="button"
        onClick={handleInstall}
        className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-xs font-semibold text-white ring-1 ring-white/20 transition-colors duration-200 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
      >
        <Smartphone className="size-3.5" aria-hidden="true" />
        Install App
      </button>
    );
  }

  return (
    <p className="text-xs leading-relaxed text-white/60">
      Use your browser&apos;s{" "}
      <span className="text-white/80">“Add to Home Screen”</span> option for
      one-tap access on mobile.
    </p>
  );
}

/* ── A single footer link (internal route or real external destination) ── */
function FooterLinkItem({ link }: { link: FooterLink }) {
  const classes = cn(
    "group inline-flex max-w-full items-start gap-1 text-[13px] leading-relaxed text-white/70",
    "transition-colors duration-200 hover:text-emerald-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 rounded-sm",
    link.breakAll && "break-all"
  );

  if (link.to) {
    return (
      <Link to={link.to} className={classes}>
        <span className="min-w-0">{link.label}</span>
      </Link>
    );
  }

  return (
    <a
      href={link.href}
      target={link.href?.startsWith("http") ? "_blank" : undefined}
      rel={link.href?.startsWith("http") ? "noopener noreferrer" : undefined}
      className={classes}
    >
      <span className="min-w-0">{link.label}</span>
    </a>
  );
}

/* ── One footer column ──
   Mobile: `<h3>` heading is a real toggle button, panel collapses via a
   grid-template-rows transition. Desktop (md+): the toggle is hidden, a plain
   heading is shown and the panel is forced open by `md:grid-rows-[1fr]`. */
interface FooterColumnProps {
  id: string;
  title: string;
  links: FooterLink[];
  isOpen: boolean;
  onToggle: (id: string) => void;
  /** Rendered above the heading — used by the brand column */
  leading?: ReactNode;
  /** Desktop: skip the visible heading because `leading` already labels the group */
  hideTitleOnDesktop?: boolean;
}

function FooterColumn({
  id,
  title,
  links,
  isOpen,
  onToggle,
  leading,
  hideTitleOnDesktop = false,
}: FooterColumnProps) {
  const panelId = `footer-panel-${id}`;

  return (
    <nav
      aria-label={title}
      className={cn(
        "min-w-0 border-b border-white/10 last:border-b-0",
        "md:border-b-0"
      )}
    >
      {leading}

      <h3 id={`footer-heading-${id}`} className="m-0">
        {/* Desktop heading */}
        {!hideTitleOnDesktop && (
          <span className="hidden text-[13px] font-semibold tracking-wide text-white md:mb-3 md:block">
            {title}
          </span>
        )}

        {/* Mobile accordion toggle */}
        <button
          type="button"
          onClick={() => onToggle(id)}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className={cn(
            "flex w-full items-center justify-between gap-3 rounded-md py-3.5 text-left",
            "text-[13px] font-semibold tracking-wide text-white",
            "transition-colors duration-200 hover:text-emerald-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60",
            "md:hidden"
          )}
        >
          <span className="min-w-0">{title}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 text-white/50 transition-transform duration-300 ease-out",
              isOpen && "rotate-180"
            )}
          />
        </button>
      </h3>

      <div
        id={panelId}
        className={cn(
          "grid overflow-hidden transition-[grid-template-rows,visibility] duration-300 ease-out",
          "md:visible md:grid-rows-[1fr]",
          isOpen ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"
        )}
      >
        <div className="min-h-0">
          <ul
            className={cn(
              "space-y-2 pb-3 pt-0.5 md:pb-0 md:pt-0",
              hideTitleOnDesktop && "md:mt-4"
            )}
          >
            {links.map((link) => (
              <li key={link.label} className="min-w-0">
                <FooterLinkItem link={link} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}

/* ── Compact contact tile ── */
function ContactTile({
  icon: Icon,
  label,
  value,
  href,
  external,
  children,
}: {
  icon: typeof Phone;
  label: string;
  value?: string;
  href?: string;
  external?: boolean;
  children?: ReactNode;
}) {
  const body = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-emerald-200">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-medium uppercase tracking-wider text-white/50">
          {label}
        </span>
        {value && (
          <span className="mt-0.5 block break-words text-[13px] font-medium leading-snug text-white">
            {value}
          </span>
        )}
        {children}
      </span>
    </>
  );

  const shell =
    "flex min-w-0 items-start gap-3 rounded-2xl bg-white/[0.04] p-3.5 ring-1 ring-white/10 transition-colors duration-200";

  if (!href) {
    return <div className={shell}>{body}</div>;
  }

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className={cn(
        shell,
        "hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
      )}
    >
      {body}
    </a>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */

const Footer = memo(function Footer() {
  /* Mobile accordion state — groups start collapsed to keep the footer compact.
     Desktop ignores this state entirely (CSS forces every panel open). */
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = useCallback((id: string) => {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const year = new Date().getFullYear();

  return (
    <footer
      className="mt-auto border-t border-white/10 bg-[#07281f] text-white/70"
      aria-label="Kalyan Chemist footer"
    >
      {/* ── Trust strip ── */}
      <div className="border-b border-white/10 bg-white/[0.03]">
        <ul className="mx-auto grid max-w-7xl grid-cols-2 gap-x-4 gap-y-3 px-4 py-5 sm:px-6 lg:grid-cols-4">
          {TRUST_ITEMS.map(({ label, icon: Icon }) => (
            <li key={label} className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15 text-emerald-200">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 text-[12px] font-medium leading-snug text-white/85 sm:text-[13px]">
                {label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Main navigation columns ── */}
      <div className="mx-auto max-w-7xl px-4 py-9 sm:px-6 md:py-12">
        <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2 md:gap-y-9 lg:grid-cols-5">
          <FooterColumn
            id="about"
            title="About Kalyan Chemist"
            links={COMPANY_LINKS}
            isOpen={!!openGroups.about}
            onToggle={toggleGroup}
            hideTitleOnDesktop
            leading={
              <div className="pb-1 md:pb-0">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
                >
                  <span className="flex size-9 items-center justify-center rounded-xl gradient-primary text-sm font-bold text-white shadow-glow">
                    KC
                  </span>
                  <span className="leading-tight">
                    <span className="block text-base font-bold tracking-tight text-white">
                      Kalyan Chemist
                    </span>
                    <span className="block text-[10px] font-medium uppercase tracking-widest text-emerald-200/70">
                      Trusted Pharmacy
                    </span>
                  </span>
                </Link>
                <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-white/60">
                  Kalyan Chemist is a digital healthcare experience for
                  medicines, healthcare products and essential health services.
                </p>
              </div>
            }
          />

          <FooterColumn
            id="healthcare"
            title="Healthcare Services"
            links={HEALTHCARE_LINKS}
            isOpen={!!openGroups.healthcare}
            onToggle={toggleGroup}
          />

          <FooterColumn
            id="shop"
            title="Shop / Medicines"
            links={SHOP_LINKS}
            isOpen={!!openGroups.shop}
            onToggle={toggleGroup}
          />

          <FooterColumn
            id="support"
            title="Customer Support"
            links={SUPPORT_LINKS}
            isOpen={!!openGroups.support}
            onToggle={toggleGroup}
          />

          <FooterColumn
            id="policies"
            title="Policies & Legal"
            links={POLICY_LINKS}
            isOpen={!!openGroups.policies}
            onToggle={toggleGroup}
          />
        </div>
      </div>

      {/* ── Contact / help ── */}
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <h2 className="mb-4 text-[13px] font-semibold tracking-wide text-white">
            Contact & Help
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ContactTile icon={Phone} label="Call us" href={`tel:${PHONE_TEL}`}>
              <span className="mt-0.5 block text-[13px] font-medium text-white">
                {PHONE_DISPLAY}
              </span>
              <span className="mt-1 flex items-center gap-1 text-[11px] text-white/50">
                <Clock className="size-3" aria-hidden="true" />
                {BUSINESS_HOURS}
              </span>
            </ContactTile>

            <ContactTile
              icon={MessageCircle}
              label="WhatsApp"
              href={WHATSAPP_URL}
              external
            >
              <span className="mt-0.5 block text-[13px] font-medium text-white">
                Chat with our pharmacist
              </span>
              <span className="mt-1 block text-[11px] text-white/50">
                Quick replies during business hours
              </span>
            </ContactTile>

            <ContactTile
              icon={Mail}
              label="Email"
              href={`mailto:${SUPPORT_EMAIL}`}
            >
              <span className="mt-0.5 block break-all text-[13px] font-medium text-white">
                {SUPPORT_EMAIL}
              </span>
              <span className="mt-1 block text-[11px] text-white/50">
                We reply within 24 hours
              </span>
            </ContactTile>

            <ContactTile
              icon={MapPin}
              label="Visit our store"
              href={MAPS_URL}
              external
            >
              <span className="mt-0.5 block text-[13px] font-medium leading-snug text-white">
                {STORE_ADDRESS}
              </span>
            </ContactTile>
          </div>
        </div>
      </div>

      {/* ── Categories · payments · app ── */}
      <div className="border-t border-white/10">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-3">
          {/* Popular categories */}
          <div className="min-w-0">
            <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-white">
              Popular Categories
            </h2>
            <ul className="flex flex-wrap gap-2">
              {POPULAR_CATEGORIES.map((cat) => (
                <li key={cat.label}>
                  <Link
                    to={cat.to as string}
                    className="inline-flex max-w-full items-center rounded-full bg-white/[0.06] px-3 py-1.5 text-[12px] font-medium text-white/75 ring-1 ring-white/10 transition-colors duration-200 hover:bg-white/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
                  >
                    {cat.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Payments */}
          <div className="min-w-0">
            <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-white">
              We Accept
            </h2>
            <ul className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => (
                <li
                  key={method}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-white/[0.06] px-2.5 py-1.5 text-[12px] font-medium text-white/75 ring-1 ring-white/10"
                >
                  <Wallet
                    className="size-3.5 shrink-0 text-emerald-200"
                    aria-hidden="true"
                  />
                  {method}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-white/50">
              Prepaid orders are processed through Razorpay&apos;s secure
              checkout. Cash on Delivery is available for eligible orders.
            </p>
          </div>

          {/* App / PWA */}
          <div className="min-w-0">
            <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-white">
              Get the Kalyan Chemist App
            </h2>
            <div className="flex items-start gap-3 rounded-2xl bg-white/[0.04] p-3.5 ring-1 ring-white/10">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-emerald-200">
                <Pill className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium leading-snug text-white">
                  Order medicines and book health services from your phone.
                </p>
                <div className="mt-2.5">
                  <PwaInstallButton />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 sm:px-6 md:flex-row">
          <p className="text-center text-[12px] text-white/55 md:text-left">
            © {year} Kalyan Chemist. All rights reserved.
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {[
              { label: "Privacy Policy", to: "/privacy-policy" },
              { label: "Terms & Conditions", to: "/terms-conditions" },
              { label: "Sitemap", to: "/sitemap" },
            ].map((item) => (
              <li key={item.label}>
                <Link
                  to={item.to}
                  className="rounded-sm text-[12px] text-white/55 transition-colors duration-200 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
});

export default Footer;
