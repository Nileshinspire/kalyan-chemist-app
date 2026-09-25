import { Link } from "react-router";
import {
  Briefcase,
  ClipboardCheck,
  Headset,
  Heart,
  Mail,
  MessageCircle,
  MonitorSmartphone,
  Sparkles,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import InfoPage from "@/components/layout/InfoPage";

/* ═══════════════════════════════════════════════════════════════════════════
   Careers — dedicated footer-linked page.

   Deliberately does NOT list job openings: the project has no recruitment
   backend or vacancy data, so no roles, counts or deadlines are invented.
   Applications go through the real configured support channels.
   ═══════════════════════════════════════════════════════════════════════════ */

const SUPPORT_EMAIL = "hello@kalyanchemist.in";
const WHATSAPP_URL = `https://wa.me/919876543210?text=${encodeURIComponent(
  "Hi Kalyan Chemist! I'd like to know about career opportunities."
)}`;

const WHY_JOIN = [
  {
    icon: Heart,
    title: "Work that helps people",
    description:
      "Every order you help fulfil reaches someone managing their health. The impact is immediate and real.",
  },
  {
    icon: Users,
    title: "Learn alongside pharmacists",
    description:
      "Work closely with our pharmacy team and understand how medicines are verified, stored and dispensed responsibly.",
  },
  {
    icon: Sparkles,
    title: "Grow with a digital pharmacy",
    description:
      "We are building the whole experience — ordering, prescriptions, lab tests, appointments and refills — so there is room to grow with it.",
  },
  {
    icon: Briefcase,
    title: "Own your work",
    description:
      "Small, focused teams where the person closest to the problem is trusted to solve it.",
  },
];

const AREAS: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: ClipboardCheck,
    title: "Pharmacy Operations",
    description:
      "Prescription verification, dispensing and inventory accuracy alongside our pharmacists.",
  },
  {
    icon: Headset,
    title: "Customer Support",
    description:
      "Helping customers with orders, prescriptions, refunds and account queries across phone, email and WhatsApp.",
  },
  {
    icon: Truck,
    title: "Delivery & Logistics",
    description:
      "Getting medicines to customers safely, on time and with the right handling.",
  },
  {
    icon: MonitorSmartphone,
    title: "Technology & Product",
    description:
      "Building and improving the ordering, prescriptions, lab tests and appointments experience.",
  },
];

export default function Careers() {
  return (
    <InfoPage
      badge="Careers"
      badgeIcon={<Briefcase className="size-3" aria-hidden="true" />}
      heroIcon={Briefcase}
      title="Careers at Kalyan Chemist"
      subtitle="We are a pharmacy first and a technology platform second. If you care about getting healthcare right for people, we would like to hear from you."
    >
      {/* Why work with us */}
      <section>
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground sm:text-base">
          Why work with us
        </h2>
        <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2">
          {WHY_JOIN.map((item) => (
            <div
              key={item.title}
              className="flex min-w-0 items-start gap-3.5 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/[0.07] text-primary">
                <item.icon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">
                  {item.title}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Areas of opportunity */}
      <section className="mt-8">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground sm:text-base">
          Areas of opportunity
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          These are the teams we hire into. They describe the kind of work we
          do, not a list of current vacancies.
        </p>
        <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
          {AREAS.map((area) => (
            <div
              key={area.title}
              className="flex min-w-0 items-start gap-3 rounded-2xl border border-border/60 bg-muted/25 p-4"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-card text-primary ring-1 ring-border/60">
                <area.icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">
                  {area.title}
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {area.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Openings + how to apply */}
      <section className="mt-8 rounded-2xl border border-border/60 bg-card p-4 shadow-sm sm:p-5">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground sm:text-base">
          Current openings
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          We do not have any positions listed at the moment. We keep
          applications on record, so if your experience fits any of the areas
          above you are welcome to introduce yourself — we will reach out when a
          matching role opens up.
        </p>

        <h3 className="mt-6 text-sm font-semibold text-foreground">
          How to apply
        </h3>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          Email us your resume with the area you are interested in, or message
          our team on WhatsApp. Please include your name, the role area and a
          short note about your experience.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <a
            href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
              "Career enquiry — Kalyan Chemist"
            )}`}
            className="inline-flex min-w-0 items-center gap-2.5 rounded-2xl border border-border/60 bg-background px-4 py-3 transition-all duration-300 hover:border-primary/25 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/[0.07] text-primary">
              <Mail className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Email
              </span>
              <span className="block break-all text-[13px] font-semibold text-foreground">
                {SUPPORT_EMAIL}
              </span>
            </span>
          </a>

          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center gap-2.5 rounded-2xl border border-border/60 bg-background px-4 py-3 transition-all duration-300 hover:border-primary/25 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/[0.07] text-primary">
              <MessageCircle className="size-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                WhatsApp
              </span>
              <span className="block text-[13px] font-semibold text-foreground">
                Message our team
              </span>
            </span>
          </a>
        </div>
      </section>

      <p className="mt-6 text-[13px] leading-relaxed text-muted-foreground">
        Looking for something else? Visit{" "}
        <Link
          to="/contact-us"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Contact Us
        </Link>{" "}
        or read more{" "}
        <Link
          to="/about-us"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          about Kalyan Chemist
        </Link>
        .
      </p>
    </InfoPage>
  );
}
