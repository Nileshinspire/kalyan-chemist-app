import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  HelpCircle,
  MessageCircle,
  Package,
  Pill,
  RefreshCw,
  Search,
  ShieldCheck,
  Stethoscope,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import InfoPage, { InfoSection } from "@/components/layout/InfoPage";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

/* ═══════════════════════════════════════════════════════════════════════════
   FAQs — dedicated footer-linked page.
   Every answer describes functionality that exists in this project: order
   tracking, prescription upload + pharmacist verification, Razorpay/COD
   checkout, lab tests, doctor appointments, medicine refill and account
   notifications. No capability is promised that the app does not have.
   ═══════════════════════════════════════════════════════════════════════════ */

const FAQ_GROUPS: {
  title: string;
  icon: LucideIcon;
  items: { q: string; a: string }[];
}[] = [
  {
    title: "Orders & Delivery",
    icon: Package,
    items: [
      {
        q: "How do I track my order?",
        a: "Sign in and open Account → Track Order to follow the live status of an active order. Past orders, invoices and their status are listed under Account → My Orders.",
      },
      {
        q: "How long does delivery take?",
        a: "An estimated delivery time is shown at checkout once you enter your pincode. Actual delivery can vary with your location, order volume and prescription verification for regulated medicines.",
      },
      {
        q: "Can I change my delivery address after ordering?",
        a: "Contact our support team as soon as possible. If the order has not been dispatched yet, we can usually update the address. Once it is out for delivery, the address cannot be changed.",
      },
      {
        q: "What are the delivery charges?",
        a: "Delivery fees and any free-delivery threshold are calculated for your pincode and shown on the checkout summary before you confirm the order.",
      },
      {
        q: "Why was my order cancelled?",
        a: "An order may be cancelled if an item went out of stock, if the delivery address is outside our serviceable pincodes, if a payment could not be confirmed, or if a prescription was rejected during verification. Any amount already paid is refunded.",
      },
    ],
  },
  {
    title: "Medicines & Prescriptions",
    icon: Pill,
    items: [
      {
        q: "What does “Rx Required” mean?",
        a: "It means the medicine is a prescription-only medicine. It is dispensed only against a valid prescription issued by a registered medical practitioner and verified by our pharmacy team.",
      },
      {
        q: "How do I upload my prescription?",
        a: "Use the Upload Prescription page, or sign in and go to Account → My Prescriptions. You can upload a clear photograph or a PDF. You can also share it on WhatsApp when ordering through our WhatsApp support.",
      },
      {
        q: "How long does prescription verification take?",
        a: "Our pharmacist reviews each prescription before dispensing. If any detail is unclear, we contact you using the phone number or email on your account, so processing can take a little longer than an over-the-counter order.",
      },
      {
        q: "Can I order medicines without a prescription?",
        a: "Yes — over-the-counter products and general healthcare items can be ordered freely. Prescription-only medicines cannot be dispensed without a valid, verified prescription.",
      },
      {
        q: "Will you substitute a medicine I ordered?",
        a: "No. Prescription medicines are dispensed exactly as prescribed. If an item is unavailable, our team contacts you with options before processing anything.",
      },
    ],
  },
  {
    title: "Payments & Refunds",
    icon: Wallet,
    items: [
      {
        q: "Which payment methods are accepted?",
        a: "You can pay online through our secure payment provider using UPI, credit cards, debit cards or net banking. Cash on Delivery is available for eligible pincodes and order values.",
      },
      {
        q: "My payment failed but the amount was debited. What now?",
        a: "A failed payment does not confirm the order. Failed attempts are reconciled and any debited amount is returned to the original payment method. If it does not reflect, contact support with your order reference.",
      },
      {
        q: "How long do refunds take?",
        a: "Refunds are issued to the original payment method through our payment provider. The time taken to reflect depends on your bank or payment provider. Cash on Delivery refunds are transferred to a bank account you provide.",
      },
      {
        q: "Can I cancel my order?",
        a: "Orders can be cancelled from Account → My Orders before they are dispatched. Prescription orders cannot be cancelled once the medicine has been dispensed and dispatched.",
      },
      {
        q: "Where can I find my invoice?",
        a: "Every confirmed order generates an invoice number with an itemised breakdown. Open the order from Account → My Orders to view it.",
      },
    ],
  },
  {
    title: "Lab Tests & Doctor Appointments",
    icon: Stethoscope,
    items: [
      {
        q: "How do I book a lab test?",
        a: "Open the Lab Tests section from the footer or the homepage, choose the test or category you need and follow the booking steps. Booked tests are listed under Account → My Lab Tests.",
      },
      {
        q: "Where do I find my lab reports?",
        a: "Reports are available under Account → Lab Reports once they are ready.",
      },
      {
        q: "How do I book a doctor appointment?",
        a: "Use the Doctor Appointments page to choose a doctor and a slot. Your bookings are listed under Account → My Appointments, where you can also view appointment details.",
      },
      {
        q: "Do lab tests and appointments need a prescription?",
        a: "Most lab tests can be booked directly. Some tests may need a doctor's advice, and a consultation can help you choose the right test.",
      },
    ],
  },
  {
    title: "Refills & Your Account",
    icon: RefreshCw,
    items: [
      {
        q: "What is Medicine Refill?",
        a: "Medicine Refill helps you reorder medicines you take regularly. Set up a refill from the Medicine Refill page and manage your refills any time from your account.",
      },
      {
        q: "How do I update my profile or addresses?",
        a: "Sign in and open My Account to update your profile details, and use My Addresses to add, edit or remove delivery addresses.",
      },
      {
        q: "How do I manage notifications?",
        a: "Your account notification preferences let you control alerts such as order updates and reminders. Recent alerts are available under Account → Notifications.",
      },
      {
        q: "I forgot my password. What should I do?",
        a: "Use the sign-in page and choose the password reset option, or sign in with an email OTP / phone OTP where available. If you still cannot get in, contact our support team.",
      },
    ],
  },
  {
    title: "Returns & Support",
    icon: ShieldCheck,
    items: [
      {
        q: "Can I return a product?",
        a: "Returns can be requested within 7 days of delivery for damaged, expired, incorrect or defective items with the original packaging intact. Opened medicines and temperature-sensitive products cannot be returned. See our Return Policy for full details.",
      },
      {
        q: "How do I contact Kalyan Chemist?",
        a: "You can call us, email us, or chat with our pharmacist on WhatsApp. Our Contact Us page lists every channel along with our support hours.",
      },
      {
        q: "Is my prescription information kept private?",
        a: "Yes. Prescriptions are used only to verify and dispense your medicines. See our Privacy Policy for details on what we collect and how it is handled.",
      },
      {
        q: "Do you deliver in my area?",
        a: "Enter your pincode at checkout to confirm serviceability, delivery charges and the estimated delivery time for your address.",
      },
    ],
  },
];

const TOTAL_ANSWERS = FAQ_GROUPS.reduce(
  (total, group) => total + group.items.length,
  0
);

/* Shared chip styling for the topic filter row. */
function chipClass(active: boolean) {
  return [
    "inline-flex max-w-full items-center rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
    active
      ? "bg-primary text-primary-foreground"
      : "bg-muted/60 text-muted-foreground ring-1 ring-border/60 hover:bg-muted hover:text-foreground",
  ].join(" ");
}

export default function Faqs() {
  const [query, setQuery] = useState("");
  const [activeTopic, setActiveTopic] = useState<string | null>(null);
  const [openItems, setOpenItems] = useState<string[]>([]);

  const normalizedQuery = query.trim().toLowerCase();

  /* A topic chip narrows the list; the search box then matches against both
     the question and the answer text within that scope. */
  const filteredGroups = useMemo(() => {
    const scoped = activeTopic
      ? FAQ_GROUPS.filter((group) => group.title === activeTopic)
      : FAQ_GROUPS;

    if (!normalizedQuery) return scoped;

    return scoped
      .map((group) => ({
        ...group,
        items: group.items.filter((item) =>
          `${item.q} ${item.a}`.toLowerCase().includes(normalizedQuery)
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [activeTopic, normalizedQuery]);

  const matchCount = useMemo(
    () => filteredGroups.reduce((total, group) => total + group.items.length, 0),
    [filteredGroups]
  );

  /* While searching, matching answers open automatically so a result is
     readable without expanding every group by hand. */
  const openValues = normalizedQuery
    ? Array.from(
        new Set([
          ...openItems,
          ...filteredGroups.flatMap((group) =>
            group.items.map((item) => item.q)
          ),
        ])
      )
    : openItems;

  return (
    <InfoPage
      badge="Help Centre"
      badgeIcon={<HelpCircle className="size-3" aria-hidden="true" />}
      heroIcon={HelpCircle}
      title="Frequently Asked Questions"
      subtitle="Answers about orders, prescriptions, payments, lab tests, appointments, refills and returns at Kalyan Chemist."
    >
      {/* Search */}
      <div
        role="search"
        className="mb-3.5 rounded-2xl border border-border/60 bg-card p-3.5 shadow-sm sm:p-4"
      >
        <label htmlFor="faq-search" className="sr-only">
          Search frequently asked questions
        </label>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            id="faq-search"
            type="search"
            inputMode="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search orders, prescriptions, payments, refunds…"
            aria-describedby="faq-search-status"
            className="h-10 w-full min-w-0 rounded-xl border border-border/70 bg-background pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors duration-200 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/30 [&::-webkit-search-cancel-button]:appearance-none"
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <p
          id="faq-search-status"
          aria-live="polite"
          className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground"
        >
          {normalizedQuery
            ? `${matchCount} ${matchCount === 1 ? "answer" : "answers"} match “${query.trim()}”`
            : activeTopic
              ? `${filteredGroups.length} topic · ${matchCount} answers`
              : `${FAQ_GROUPS.length} topics · ${TOTAL_ANSWERS} answers`}
        </p>

        {/* Topic filter chips */}
        <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-border/50 pt-2.5">
          <button
            type="button"
            onClick={() => setActiveTopic(null)}
            aria-pressed={activeTopic === null}
            className={chipClass(activeTopic === null)}
          >
            All topics
          </button>
          {FAQ_GROUPS.map((group) => (
            <button
              key={group.title}
              type="button"
              onClick={() =>
                setActiveTopic((current) =>
                  current === group.title ? null : group.title
                )
              }
              aria-pressed={activeTopic === group.title}
              className={chipClass(activeTopic === group.title)}
            >
              {group.title}
            </button>
          ))}
        </div>
      </div>

      {filteredGroups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-card p-6 text-center">
          <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/[0.08] text-primary">
            <Search className="size-4" aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-semibold text-foreground">
            No answers match “{query.trim()}”
          </p>
          <p className="mx-auto mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">
            Try a shorter phrase, or reach our team directly — we can look into
            your specific order or account.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setQuery("")}
              className="inline-flex items-center rounded-xl border border-border/70 px-4 py-2 text-[13px] font-semibold text-foreground transition-colors duration-200 hover:border-primary/30 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              Clear search
            </button>
            <Link
              to="/contact-us"
              className="inline-flex items-center rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition-opacity duration-200 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              Contact Support
            </Link>
          </div>
        </div>
      ) : (
      <div className="space-y-3.5">
        {filteredGroups.map((group) => (
          <InfoSection
            key={group.title}
            icon={group.icon}
            title={group.title}
            action={
              <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.items.length} answers
              </span>
            }
          >
            <Accordion
              type="multiple"
              value={openValues}
              onValueChange={setOpenItems}
              className="-mx-1"
            >
              {group.items.map((item) => (
                <AccordionItem
                  key={item.q}
                  value={item.q}
                  className="border-border/50"
                >
                  <AccordionTrigger className="py-3 text-left text-[13px] font-semibold leading-snug hover:no-underline hover:text-primary sm:text-sm">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="pb-3 text-[13px] leading-relaxed text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </InfoSection>
        ))}
        </div>
      )}

      {/* Still need help */}
      <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-primary/15 bg-primary/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <MessageCircle className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Didn&apos;t find your answer?
            </p>
            <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
              Our support team can look into your specific order or account.
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
            to="/account/help-support"
            className="inline-flex items-center rounded-xl border border-border/70 px-4 py-2 text-[13px] font-semibold text-foreground transition-colors duration-200 hover:border-primary/30 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            Help & Support
          </Link>
        </div>
      </div>
    </InfoPage>
  );
}
