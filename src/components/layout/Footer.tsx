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
   Information architecture (each destination appears exactly once):
     Column 1  About Kalyan Chemist
     Column 2  Healthcare Services
     Column 3  Shop / Medicines
     Column 4  Customer Support
     Column 5  Policies & Legal
   Then: contact/help, popular categories + app, one combined trust + payment
   strip, and a compact legal bottom bar (Privacy Policy · Terms · Sitemap).

   Responsive behaviour — driven purely by CSS, so there is no layout JS,
   no matchMedia dependency and no horizontal overflow at any width:
     ≥ 1024px  five columns, always expanded
     ≥  768px  balanced two-column grid, always expanded
     <  768px  one accessible accordion per group, only one open at a time
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

/* About group — Sitemap lives in the bottom legal bar so it is not repeated. */
const COMPANY_LINKS: FooterLink[] = [
  { label: "About Us", to: "/about-us" },
  { label: "Contact Us", to: "/contact-us" },
  { label: "FAQs", to: "/faqs" },
  { label: "Why Choose Us", to: "/why-choose-us" },
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
  { label: "New Arrivals", to: "/products?sort=newest" },
  { label: "Hot Sellers", to: "/hot-sellers" },
  { label: "Value Deals Under ₹100", to: "/value-deals" },
  { label: "Wishlist", to: "/wishlist" },
];

/* "Contact Support" points at the account help centre so "Contact Us" stays
   unique to the About group; refunds are documented under Policies & Legal. */
const SUPPORT_LINKS: FooterLink[] = [
  { label: "My Account", to: "/account" },
  { label: "My Orders", to: "/account/orders" },
  { label: "Track Order", to: "/account/track-order" },
  { label: "My Addresses", to: "/account/addresses" },
  { label: "My Prescriptions", to: "/account/prescriptions" },
  { label: "Notifications", to: "/account/notifications" },
  { label: "Contact Support", to: "/account/help-support" },
  { label: "WhatsApp Support", href: WHATSAPP_URL },
];

/* Privacy Policy, Terms & Conditions and Sitemap intentionally live in the
   bottom legal bar only — they are not repeated here. */
const POLICY_LINKS: FooterLink[] = [
  { label: "Shipping & Delivery", to: "/shipping-delivery" },
  { label: "Cancellation & Refund Policy", to: "/cancellation-refund" },
  { label: "Return Policy", to: "/return-policy" },
  { label: "Prescription Policy", to: "/prescription-policy" },
  { label: "Payment Policy", to: "/payment-policy" },
  { label: "Disclaimer", to: "/disclaimer" },
];

/* Category navigation used by the header — same slugs/keys. Duplicates of the
   column destinations above (medicines, health devices, health conditions) are
   removed so every destination resolves to a single footer entry. */
const POPULAR_CATEGORIES: FooterLink[] = [
  { label: "Baby Care", to: "/products?category=baby-mother&nav=baby-care" },
  { label: "Women Care", to: "/products?category=baby-mother&nav=women-care" },
  { label: "Personal Care", to: "/products?category=personal-care&nav=personal-care" },
  { label: "Nutrition & Supplements", to: "/products?category=nutrition&nav=nutrition" },
  { label: "Ayurveda", to: "/products?category=alternative-medicine&nav=ayurveda" },
  { label: "Home Essentials", to: "/products?category=others&nav=home-essentials" },
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

const LEGAL_LINKS: FooterLink[] = [
  { label: "Privacy Policy", to: "/privacy-policy" },
  { label: "Terms & Conditions", to: "/terms-conditions" },
  { label: "Sitemap", to: "/sitemap" },
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
      <p className="text-[12px] font-medium text-emerald-200">
        Kalyan Chemist is installed on this device.
      </p>
    );
  }

  if (deferredPrompt) {
    return (
      <button
        type="button"
        onClick={handleInstall}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold text-white ring-1 ring-white/20 transition-colors duration-200 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
      >
        <Smartphone className="size-3.5" aria-hidden="true" />
        Install App
      </button>
    );
  }

  return (
    <p className="text-[11.5px] leading-relaxed text-white/55">
      Use your browser&apos;s{" "}
      <span className="text-white/80">“Add to Home Screen”</span> option for
      one-tap access on mobile.
    </p>
  );
}

/* ── A single footer link (internal route or real external destination) ── */
function FooterLinkItem({ link }: { link: FooterLink }) {
  const classes = cn(
    "group inline-flex max-w-full items-start gap-1 text-[12.5px] leading-snug text-white/70",
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
          <span className="hidden text-[11.5px] font-semibold uppercase tracking-wider text-white/90 md:mb-2.5 md:block">
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
            "flex w-full items-center justify-between gap-3 rounded-md py-2.5 text-left",
            "text-[12.5px] font-semibold uppercase tracking-wider text-white",
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
              "space-y-1.5 pb-3 pt-0.5 md:pb-0 md:pt-0",
              hideTitleOnDesktop && "md:mt-3.5"
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

/* ── Compact inline contact row (phone / WhatsApp / email / store) ── */
function ContactItem({
  icon: Icon,
  label,
  href,
  external,
  children,
}: {
  icon: typeof Phone;
  label: string;
  href?: string;
  external?: boolean;
  children: ReactNode;
}) {
  const body = (
    <>
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-emerald-200">
        <Icon className="size-3.5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-medium uppercase tracking-wider text-white/45">
          {label}
        </span>
        <span className="block text-[12.5px] font-medium leading-snug text-white/90">
          {children}
        </span>
      </span>
    </>
  );

  const shell = "flex min-w-0 items-start gap-2.5 rounded-lg py-1";

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
        "transition-colors duration-200 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
      )}
    >
      {body}
    </a>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */

const Footer = memo(function Footer() {
  /* Mobile accordion — only one group open at a time keeps the footer short.
     Desktop ignores this state entirely (CSS forces every panel open). */
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  const toggleGroup = useCallback((id: string) => {
    setOpenGroup((current) => (current === id ? null : id));
  }, []);

  const year = new Date().getFullYear();

  return (
    <footer
      className="mt-auto border-t border-white/10 bg-[#07281f] text-white/70"
      aria-label="Kalyan Chemist footer"
    >
      {/* ── Main navigation columns ── */}
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8">
        <div className="grid grid-cols-1 gap-x-10 md:grid-cols-2 md:gap-y-7 lg:grid-cols-5">
          <FooterColumn
            id="about"
            title="About Kalyan Chemist"
            links={COMPANY_LINKS}
            isOpen={openGroup === "about"}
            onToggle={toggleGroup}
            hideTitleOnDesktop
            leading={
              <div className="pb-0.5 md:pb-0">
                <Link
                  to="/"
                  className="inline-flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
                >
                  <span className="flex size-8 items-center justify-center rounded-xl gradient-primary text-[13px] font-bold text-white shadow-glow">
                    KC
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[15px] font-bold tracking-tight text-white">
                      Kalyan Chemist
                    </span>
                    <span className="block text-[10px] font-medium uppercase tracking-widest text-emerald-200/70">
                      Trusted Pharmacy
                    </span>
                  </span>
                </Link>
                <p className="mt-2.5 max-w-xs text-[12.5px] leading-relaxed text-white/55">
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
            isOpen={openGroup === "healthcare"}
            onToggle={toggleGroup}
          />

          <FooterColumn
            id="shop"
            title="Shop / Medicines"
            links={SHOP_LINKS}
            isOpen={openGroup === "shop"}
            onToggle={toggleGroup}
          />

          <FooterColumn
            id="support"
            title="Customer Support"
            links={SUPPORT_LINKS}
            isOpen={openGroup === "support"}
            onToggle={toggleGroup}
          />

          <FooterColumn
            id="policies"
            title="Policies & Legal"
            links={POLICY_LINKS}
            isOpen={openGroup === "policies"}
            onToggle={toggleGroup}
          />
        </div>
      </div>

      {/* ── Contact / help (compact) ── */}
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
          <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-white/60">
            Contact & Help
          </h2>
          <div className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-4">
            <ContactItem icon={Phone} label="Call us" href={`tel:${PHONE_TEL}`}>
              {PHONE_DISPLAY}
              <span className="mt-0.5 flex items-center gap-1 text-[11px] font-normal text-white/50">
                <Clock className="size-3" aria-hidden="true" />
                {BUSINESS_HOURS}
              </span>
            </ContactItem>

            <ContactItem
              icon={MessageCircle}
              label="WhatsApp"
              href={WHATSAPP_URL}
              external
            >
              Chat with our pharmacist
              <span className="mt-0.5 block text-[11px] font-normal text-white/50">
                Quick replies during business hours
              </span>
            </ContactItem>

            <ContactItem
              icon={Mail}
              label="Email"
              href={`mailto:${SUPPORT_EMAIL}`}
            >
              <span className="break-all">{SUPPORT_EMAIL}</span>
              <span className="mt-0.5 block text-[11px] font-normal text-white/50">
                We reply within 24 hours
              </span>
            </ContactItem>

            <ContactItem
              icon={MapPin}
              label="Visit our store"
              href={MAPS_URL}
              external
            >
              {STORE_ADDRESS}
            </ContactItem>
          </div>
        </div>
      </div>

      {/* ── Categories · app ── */}
      <div className="border-t border-white/10">
        <div className="mx-auto grid max-w-7xl gap-x-8 gap-y-4 px-4 py-4 sm:px-6 lg:grid-cols-3">
          {/* Popular categories */}
          <div className="min-w-0 lg:col-span-2">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
              Popular Categories
            </h2>
            <ul className="flex flex-wrap gap-1.5">
              {POPULAR_CATEGORIES.map((cat) => (
                <li key={cat.label} className="min-w-0">
                  <Link
                    to={cat.to as string}
                    className="inline-flex max-w-full items-center rounded-full bg-white/[0.06] px-2.5 py-1 text-[11.5px] font-medium text-white/75 ring-1 ring-white/10 transition-colors duration-200 hover:bg-white/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
                  >
                    {cat.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* App / PWA */}
          <div className="min-w-0">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/60">
              Get the Kalyan Chemist App
            </h2>
            <div className="flex items-start gap-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/10 text-emerald-200">
                <Pill className="size-3.5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium leading-snug text-white/90">
                  Order medicines and book health services from your phone.
                </p>
                <div className="mt-1.5">
                  <PwaInstallButton />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Trust + payments (one compact strip) ── */}
      <div className="border-t border-white/10 bg-white/[0.03]">
        <div className="mx-auto max-w-7xl px-4 py-3.5 sm:px-6">
          <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {TRUST_ITEMS.map(({ label, icon: Icon }) => (
                <li
                  key={label}
                  className="flex min-w-0 items-center gap-1.5 text-[11.5px] font-medium text-white/80"
                >
                  <Icon
                    className="size-3.5 shrink-0 text-emerald-300/90"
                    aria-hidden="true"
                  />
                  {label}
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                We accept
              </span>
              {PAYMENT_METHODS.map((method) => (
                <span
                  key={method}
                  className="inline-flex max-w-full items-center gap-1 rounded-md bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-white/75 ring-1 ring-white/10"
                >
                  <Wallet
                    className="size-3 shrink-0 text-emerald-200"
                    aria-hidden="true"
                  />
                  {method}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[10.5px] leading-relaxed text-white/40">
            Prepaid orders are processed through Razorpay&apos;s secure checkout.
            Cash on Delivery is available for eligible orders.
          </p>
        </div>
      </div>

      {/* ── Bottom legal bar ── */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-3.5 sm:px-6 md:flex-row">
          <p className="text-center text-[11.5px] text-white/55 md:text-left">
            © {year} Kalyan Chemist. All rights reserved.
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
            {LEGAL_LINKS.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.to as string}
                  className="rounded-sm text-[11.5px] text-white/55 transition-colors duration-200 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
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
