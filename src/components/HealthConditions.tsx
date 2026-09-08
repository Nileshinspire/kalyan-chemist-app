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
        <rect x="3.5" y="6.5" width="11" height="13" rx="2.5" />
        <path d="M3.5 10.5h11" />
        <path d="M6 13.4h3.2" />
        <path d="M6 15.6h4.6" />
        <path d="M14.5 14.5l3.7-4.7" />
        <path d="M18.6 5.6c1.2 1.5 2.3 2.7 2.3 3.9a2.3 2.3 0 0 1-4.6 0c0-1.2 1.1-2.4 2.3-3.9z" />
      </svg>
    ),
  },
  {
    name: "Cardiac Care",
    href: "/products?category=heart-cardio",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <path d="M12 20.3C7.4 16.1 3.8 13 3.8 9.4a4.5 4.5 0 0 1 8.2-2.6 4.5 4.5 0 0 1 8.2 2.6c0 3.6-3.6 6.7-8.2 10.9z" />
        <polyline points="6.2 11.2 9.2 11.2 10.8 8.8 12.9 13.6 14.3 11.2 17.8 11.2" />
      </svg>
    ),
  },
  {
    name: "Stomach Care",
    href: "/products?category=digestive-health",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <path d="M12 3.2v3.3" />
        <path d="M12 6.5C8.9 6.5 6.9 8.6 6.9 11.3c0 4.6 2.3 7.5 5.1 7.5s5.1-2.9 5.1-7.5c0-2.7-2-4.8-5.1-4.8z" />
        <path d="M9.5 10.6c.3 2.3 1.2 3.7 2.5 3.7 1.1 0 1.9-.8 2.1-2" />
      </svg>
    ),
  },
  {
    name: "Pain Relief",
    href: "/products?category=pain-relief",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <circle cx="12" cy="4.4" r="1.9" />
        <path d="M5.4 20.6c.6-4.2 2.9-6.4 6.6-6.4s6 2.2 6.6 6.4" />
        <path d="M9.5 13.6l-2.8 1.3" />
        <path d="M14.5 13.6l2.8 1.3" />
        <circle cx="12" cy="13.6" r="1.8" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: "Liver Care",
    href: "/products?search=liver",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <path d="M12 4.8c3.7 0 6.6 2.6 6.6 6.1 0 3.7-2.9 6.9-6.6 6.9-3.6 0-6.4-3.2-6.4-6.9 0-3.5 2.8-6.1 6.4-6.1z" />
        <path d="M8.7 10.7c.4 2.2 1.3 3.5 2.7 3.5 1.1 0 1.9-.9 2.2-2.3" />
      </svg>
    ),
  },
  {
    name: "Oral Care",
    href: "/products?category=personal-care",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <path d="M10.6 3.9c-1.6 0-2.3-.9-3.6-.9-1.8 0-2.9 1.3-2.9 3.3 0 2.4 1.4 3.5 1.9 7.3.3 2 1 4 1.9 4s1.2-1.3 1.9-1.3 1.2 1.3 1.9 1.3c.9 0 1.6-2 1.9-4 .5-3.8 1.9-4.9 1.9-7.3 0-2-1.1-3.3-2.9-3.3-1.3 0-2 .9-3.6.9z" />
        <path d="M15.6 5.1c.4-1.7 1.1-2.8 2-3.3.9-.5 1.9-.4 2.6.3.7.7.6 1.9-.1 2.9-.7.9-1.7 1.6-3 2" />
        <path d="M16.7 6.2l2.8 2.8" />
      </svg>
    ),
  },
  {
    name: "Respiratory",
    href: "/products?search=respiratory",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <path d="M12 3.5v2.2" />
        <path d="M11.5 5.7C9.2 6.2 7.2 8.2 7.2 10.9 7.2 13.6 8.9 16.1 10.7 16.1 12.5 16.1 11.9 14.9 11.8 13.1 11.7 10.9 11.6 8.3 11.5 5.7Z" />
        <path d="M12.5 5.7C14.8 6.2 16.8 8.2 16.8 10.9 16.8 13.6 15.1 16.1 13.3 16.1 11.5 16.1 12.1 14.9 12.2 13.1 12.3 10.9 12.4 8.3 12.5 5.7Z" />
      </svg>
    ),
  },
  {
    name: "Sexual Health",
    href: "/products?category=sexual-wellness",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <circle cx="14" cy="8" r="2.6" />
        <path d="M17.4 3.6h2.8v2.8" />
        <path d="M20.2 3.6l-3.8 3.6" />
        <circle cx="10" cy="8.6" r="2.6" />
        <path d="M10 11.2v4.4" />
        <path d="M7.6 13.4h4.8" />
      </svg>
    ),
  },
  {
    name: "Elderly Care",
    href: "/products?search=elderly",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <circle cx="7.6" cy="5.6" r="1.8" />
        <path d="M4.8 16.6c.4-3 1.5-4.5 2.8-4.5s2.4 1.5 2.8 4.5" />
        <path d="M10.2 7.6l1 9" />
        <circle cx="15.9" cy="5.6" r="1.7" />
        <path d="M13.3 16.6c.3-2.6 1.2-4.1 2.6-4.1s2.3 1.5 2.6 4.1" />
      </svg>
    ),
  },
  {
    name: "Cold & Immunity",
    href: "/products?category=health-safety",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <path d="M12 3.2l6.8 2.4V11c0 4.4-2.9 7.5-6.8 9.1-3.9-1.6-6.8-4.7-6.8-9.1V5.6L12 3.2z" />
        <path d="M12 8.2v5.6" />
        <path d="M9.2 11h5.6" />
        <path d="M19.6 2.6l.6 1.3 1.3.6-1.3.6-.6 1.3-.6-1.3-1.3-.6 1.3-.6.6-1.3z" fill="currentColor" stroke="none" />
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