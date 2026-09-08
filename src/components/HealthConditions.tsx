import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { HeartPulse } from "lucide-react";

/* ─── Browse by Health Conditions ───
 * Grid of 10 health-condition cards with minimalist medical line-art icons.
 * Every card navigates into the EXISTING product catalogue (category or
 * search routes) — no new category system, no invented data.
 */
type HealthCondition = {
  name: string;
  href: string;
  icon: ReactNode;
};

const CONDITIONS: HealthCondition[] = [
  {
    name: "Diabetes Care",
    href: "/products?category=diabetes-care",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <rect x="3" y="7" width="10.5" height="13" rx="2.5" />
        <path d="M3 11h10.5" />
        <path d="M5.8 14.2h4" />
        <path d="M5.8 16.6h2.4" />
        <path d="M17.5 3.8c1.2 1.5 2.3 2.7 2.3 3.9a2.3 2.3 0 0 1-4.6 0c0-1.2 1.1-2.4 2.3-3.9z" />
        <path d="M13.5 14h3" />
      </svg>
    ),
  },
  {
    name: "Cardiac Care",
    href: "/products?category=heart-cardio",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <path d="M12 20.4C7.3 16.1 3.6 13 3.6 9.3A4.6 4.6 0 0 1 12 7.1a4.6 4.6 0 0 1 8.4 2.2c0 3.7-3.7 6.8-8.4 11.1z" />
        <polyline points="6.2 11.3 9.3 11.3 10.9 8.7 13 13.5 14.4 11.3 17.8 11.3" />
      </svg>
    ),
  },
  {
    name: "Stomach Care",
    href: "/products?category=digestive-health",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <path d="M12 3v3.5" />
        <path d="M12 6.5C9.4 6.5 7 8.2 7 10.8c0 4.6 2.4 7.7 5 7.7s5-3.1 5-7.7c0-2.6-2.4-4.3-5-4.3z" />
        <path d="M9.6 10.2c.2 2.4 1.1 3.9 2.4 3.9 1.2 0 2-.9 2.2-2.3" />
      </svg>
    ),
  },
  {
    name: "Pain Relief",
    href: "/products?category=pain-relief",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <circle cx="12" cy="4.6" r="2" />
        <path d="M5.6 20.6c.5-4.1 2.8-6.2 6.4-6.2s5.9 2.1 6.4 6.2" />
        <circle cx="12" cy="13.4" r="1.9" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: "Liver Care",
    href: "/products?search=liver",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <path d="M11.8 4.4c3.5-.2 6.3 2.4 6.3 5.9 0 3.6-2.7 6.6-6.3 6.6-3.5 0-6.2-3-6.2-6.6 0-3.5 2.8-6.1 6.2-5.9z" />
        <path d="M8.4 10.2c.3 2 1.1 3.2 2.2 3.2 1 0 1.7-.7 2-1.7" />
      </svg>
    ),
  },
  {
    name: "Oral Care",
    href: "/products?category=personal-care",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <path d="M12 3.8c-1.8 0-2.6-1-4-1-2 0-3.2 1.5-3.2 3.6 0 2.6 1.6 3.8 2.1 7.8.3 2.1 1 4.2 2 4.2.9 0 1.3-1.4 2.1-1.4s1.2 1.4 2.1 1.4c1 0 1.7-2.1 2-4.2.5-4 2.1-5.2 2.1-7.8C20 4.3 18.8 2.8 16.8 2.8c-1.4 0-2.2 1-4 1z" />
      </svg>
    ),
  },
  {
    name: "Respiratory",
    href: "/products?search=respiratory",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <path d="M12 3.5v5" />
        <path d="M9 8.5C6.5 9.2 5 11.2 5 13.6c0 2.6 1.6 5.1 3.5 5.1s2.5-2.1 2.5-4.7V8.5H9z" />
        <path d="M15 8.5c2.5.7 4 2.7 4 5.1 0 2.6-1.6 5.1-3.5 5.1S13 16.6 13 13.9V8.5h2z" />
      </svg>
    ),
  },
  {
    name: "Sexual Health",
    href: "/products?category=sexual-wellness",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <circle cx="14.2" cy="7.6" r="2.5" />
        <path d="M17.8 3.2h3v3" />
        <path d="M20.8 3.2l-3.8 3.8" />
        <circle cx="9.8" cy="8.8" r="2.5" />
        <path d="M9.8 11.3v4.6" />
        <path d="M7.4 13.6h4.8" />
      </svg>
    ),
  },
  {
    name: "Elderly Care",
    href: "/products?search=elderly",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <circle cx="7.6" cy="5.8" r="1.9" />
        <path d="M4.4 16.6c.5-3.2 1.8-4.9 3.2-4.9s2.7 1.7 3.2 4.9" />
        <path d="M10.6 8.2l1.2 8.4" />
        <circle cx="16.4" cy="5.8" r="1.7" />
        <path d="M13.8 16.6c.3-2.7 1.2-4.2 2.6-4.2s2.3 1.5 2.6 4.2" />
      </svg>
    ),
  },
  {
    name: "Cold & Immunity",
    href: "/products?category=health-safety",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <path d="M12 3.5l6.6 2.3V11c0 4.3-2.8 7.4-6.6 9-3.8-1.6-6.6-4.7-6.6-9V5.8L12 3.5z" />
        <path d="M9 11.7l2 2 4.2-4.4" />
        <path d="M18.3 2.4l.6 1.3 1.3.6-1.3.6-.6 1.3-.6-1.3-1.3-.6 1.3-.6.6-1.3z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export default function HealthConditions() {
  const navigate = useNavigate();

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-3 sm:pt-5 pb-8 sm:pb-12">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
            <HeartPulse className="size-3" />
            Health Conditions
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Browse by Health Conditions
          </h2>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            Shop curated medicines and wellness products for the health conditions
            that matter most to you and your family.
          </p>
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
          className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5"
        >
          {CONDITIONS.map((c) => (
            <motion.button
              key={c.name}
              type="button"
              variants={cardVariants}
              onClick={() => navigate(c.href)}
              className="group flex flex-col items-center rounded-xl border border-border/60 bg-card p-4 sm:p-5 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-md cursor-pointer"
            >
              <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors duration-300 group-hover:bg-primary/10 group-hover:text-primary">
                {c.icon}
              </span>
              <span className="mt-3 text-xs sm:text-sm font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
                {c.name}
              </span>
            </motion.button>
          ))}
        </motion.div>
      </div>
    </section>
  );
}