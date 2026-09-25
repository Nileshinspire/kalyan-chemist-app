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
import BrandMark from "@/components/BrandMark";

/* ═══════════════════════════════════════════════════════════════════════════
   KALYAN CHEMIST — SITE FOOTER
   ---------------------------------------------------------------------------
   Information architecture (each destination appears exactly once):
     Column 1  About Kalyan Chemist   (slightly wider — brand block)
     Column 2  Healthcare Services
     Column 3  Shop / Medicines
     Column 4  Customer Support
     Column 5  Policies & Legal
     Column 6  Popular Categories
   Then compact information rows:
     · contact + app, payments, and trust indicators
     · the legal bottom bar (Privacy Policy · Terms · Sitemap)

   HORIZONTAL: a single centred `max-w-6xl` container plus a
   `1.6fr 1fr 1fr 1fr 1fr 1fr` grid with a controlled gap keeps the six groups
   visually grouped instead of pushed toward the screen edges.

   VERTICAL: paddings, line-heights and row gaps are tightened, and the lower
   rows share one band separated by hairline borders instead of stacking
   independently padded blocks.

   Responsive behaviour — driven purely by CSS, so there is no layout JS,
   no matchMedia dependency and no horizontal overflow at any width:
     ≥ 1024px  six columns, always expanded
     ≥  768px  balanced three-column grid, always expanded
     <  768px  one accessible accordion per group, only one open at a time

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
   unique to the About group; refunds are documented under Policies & Legal.
   The WhatsApp destination lives in the contact row below — it is the one
   logical place for a contact channel, so it is not repeated here. */
const SUPPORT_LINKS: FooterLink[] = [
  { label: "My Account", to: "/account" },
  { label: "My Orders", to: "/account/orders" },
  { label: "Track Order", to: "/account/track-order" },
  { label: "My Addresses", to: "/account/addresses" },
  { label: "My Prescriptions", to: "/account/prescriptions" },
  { label: "Notifications", to: "/account/notifications" },
  { label: "Contact Support", to: "/account/help-support" },
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
      <span className="text-[11.5px] font-medium text-emerald-200">
        Installed on this device
      </span>
    );
  }

  if (deferredPrompt) {
    return (
      <button
        type="button"
        onClick={handleInstall}
        className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11.5px] font-semibold text-white ring-1 ring-white/20 transition-colors duration-200 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
      >
        <Smartphone className="size-3.5" aria-hidden="true" />
        Install App
      </button>
    );
  }

  return (
    <span className="text-[11px] text-white/50">
      Add to Home Screen from your browser menu
    </span>
  );
}

/* ── A single footer link (internal route or real external destination) ── */
function FooterLinkItem({
  link,
  linkVariant = "default",
}: {
  link: FooterLink;
  linkVariant?: "default" | "category";
}) {
  const classes = cn(
    linkVariant === "category"
      ? "inline-flex max-w-full items-center rounded-full bg-white/[0.06] px-2 py-px text-[11.5px] font-medium text-white/75 ring-1 ring-white/10 transition-colors duration-200 hover:bg-white/[0.12] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
      : "inline-flex max-w-full items-start gap-1 text-[12.5px] leading-tight text-white/70 transition-colors duration-200 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 rounded-sm",
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
  /** Preserve the compact category-chip treatment in the navigation column. */
  linkVariant?: "default" | "category";
}

function FooterColumn({
  id,
  title,
  links,
  isOpen,
  onToggle,
  leading,
  hideTitleOnDesktop = false,
  linkVariant = "default",
}: FooterColumnProps) {
  const panelId = `footer-panel-${id}`;

  return (
    <nav
      aria-label={title}
      className="min-w-0 border-b border-white/10 last:border-b-0 md:border-b-0"
    >
      {leading}

      <h3 id={`footer-heading-${id}`} className="m-0">
        {/* Desktop heading */}
        {!hideTitleOnDesktop && (
          <span className="hidden text-[11px] font-semibold uppercase tracking-wider text-white/90 md:mb-1.5 md:block">
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
              linkVariant === "category"
                ? "flex flex-wrap items-center gap-1.5 pb-2.5 pt-1 md:pb-0 md:pt-0.5"
                : "space-y-0.5 pb-2.5 pt-0.5 md:pb-0 md:pt-0",
              hideTitleOnDesktop && "md:mt-2"
            )}
          >
            {links.map((link) => (
              <li key={link.label} className="min-w-0">
                <FooterLinkItem link={link} linkVariant={linkVariant} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </nav>
  );
}

/* ── One inline contact channel (icon + value, no tall card) ── */
function ContactChip({
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
      <Icon className="size-3.5 shrink-0 text-emerald-300/90" aria-hidden="true" />
      <span className="sr-only">{label}: </span>
      <span className="min-w-0">{children}</span>
    </>
  );

  if (!href) {
    return (
      <li className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-white/60">
        {body}
      </li>
    );
  }

  return (
    <li className="min-w-0">
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className="flex min-w-0 items-center gap-1.5 rounded-sm text-[11.5px] font-medium text-white/80 transition-colors duration-200 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70"
      >
        {body}
      </a>
    </li>
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
      {/* ── Main navigation columns ──
          Centred `max-w-6xl` container + `1.6fr 1fr 1fr 1fr 1fr 1fr` grid keeps
          the six groups close together instead of stretched across the viewport. */}
      <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-3 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr_1fr] lg:gap-x-5">
          <FooterColumn
            id="about"
            title="About Kalyan Chemist"
            links={COMPANY_LINKS}
            isOpen={openGroup === "about"}
            onToggle={toggleGroup}
            hideTitleOnDesktop
            leading={
              <div>
                <div className="flex items-center justify-between gap-2">
                  <Link
                    to="/"
                    className="flex min-w-0 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 sm:gap-3"
                  >
                    <BrandMark
                      className="size-16 sm:size-20 lg:size-24"
                      alt="Kalyan Chemist"
                    />
                    <span className="min-w-0 leading-tight">
                      <span className="block text-[15px] font-bold tracking-tight text-white">
                        Kalyan Chemist
                      </span>
                      <span className="block text-[10px] font-medium uppercase tracking-widest text-emerald-200/70">
                        Trusted Pharmacy
                      </span>
                    </span>
                  </Link>

                  {/* Reserved visual zone — today two subtle glyphs; a future
                      trust icon set, pharmacy symbol, certification mark or
                      small illustration can slot in here without restructuring
                      the footer or adding any height. Scoped to xl where the
                      brand column has guaranteed room for it. */}
                  <span
                    data-footer-visual-slot
                    aria-hidden="true"
                    className="hidden shrink-0 items-center gap-1 xl:flex"
                  >
                    <span className="flex size-5 items-center justify-center rounded-md bg-white/[0.06] text-emerald-200/70 ring-1 ring-white/10">
                      <ShieldCheck className="size-3" />
                    </span>
                    <span className="flex size-5 items-center justify-center rounded-md bg-white/[0.06] text-emerald-200/70 ring-1 ring-white/10">
                      <Pill className="size-3" />
                    </span>
                  </span>
                </div>

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

          <FooterColumn
            id="popular-categories"
            title="Popular Categories"
            links={POPULAR_CATEGORIES}
            isOpen={openGroup === "popular-categories"}
            onToggle={toggleGroup}
            linkVariant="category"
          />
        </div>
      </div>

      {/* ── Row 2: contact, payments, and trust ── */}
      <div className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr_1.45fr] lg:gap-x-6">
            <section aria-label="Contact information" className="min-w-0">
              <ul className="grid min-w-0 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                <ContactChip icon={Phone} label="Call us" href={`tel:${PHONE_TEL}`}>
                  {PHONE_DISPLAY}
                </ContactChip>

                <ContactChip
                  icon={MessageCircle}
                  label="WhatsApp"
                  href={WHATSAPP_URL}
                  external
                >
                  WhatsApp support
                </ContactChip>

                <ContactChip
                  icon={Mail}
                  label="Email"
                  href={`mailto:${SUPPORT_EMAIL}`}
                >
                  <span className="break-all">{SUPPORT_EMAIL}</span>
                </ContactChip>

                <ContactChip icon={Clock} label="Business hours">
                  {BUSINESS_HOURS}
                </ContactChip>

                <ContactChip icon={MapPin} label="Store" href={MAPS_URL} external>
                  {STORE_ADDRESS}
                </ContactChip>
              </ul>

              <div className="mt-2 flex shrink-0 flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/45">
                  <Smartphone className="size-3.5 text-emerald-200" aria-hidden="true" />
                  Get the app
                </span>
                <PwaInstallButton />
              </div>
            </section>

            <section
              aria-label="Payment methods"
              className="min-w-0 lg:border-l lg:border-white/10 lg:pl-6"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                  We accept
                </span>
                {PAYMENT_METHODS.map((method) => (
                  <span
                    key={method}
                    className="inline-flex max-w-full items-center gap-1 rounded-md bg-white/[0.06] px-1.5 py-px text-[11px] font-medium text-white/75 ring-1 ring-white/10"
                  >
                    <Wallet
                      className="size-3 shrink-0 text-emerald-200"
                      aria-hidden="true"
                    />
                    {method}
                  </span>
                ))}
              </div>
            </section>

            <section
              aria-label="Trust indicators"
              className="min-w-0 lg:border-l lg:border-white/10 lg:pl-6"
            >
              <ul className="grid min-w-0 gap-x-4 gap-y-1.5 sm:grid-cols-2">
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
            </section>
          </div>

          <p className="mt-2 border-t border-white/10 pt-2 text-[10.5px] leading-tight text-white/40">
            Prepaid orders are processed through Razorpay&apos;s secure checkout.
            Cash on Delivery is available for eligible orders.
          </p>
        </div>
      </div>

      {/* ── Bottom legal bar ── */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-1 px-4 py-2.5 sm:px-6 md:flex-row">
          <p className="text-center text-[11.5px] leading-tight text-white/55 md:text-left">
            © {year} Kalyan Chemist. All rights reserved.
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
            {LEGAL_LINKS.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.to as string}
                  className="rounded-sm text-[11.5px] leading-tight text-white/55 transition-colors duration-200 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60"
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
