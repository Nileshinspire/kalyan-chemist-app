import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { HeartPulse } from "lucide-react";

/* ─── Browse by Health Conditions ───
 * Grid of 10 health-condition cards with premium pencil-sketch + 3D medical icons.
 * Every card navigates into the EXISTING product catalogue — no new data.
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
      <svg viewBox="0 0 32 32" fill="none" className="size-10" aria-hidden="true">
        {/* Glucose meter body */}
        <rect x="5" y="6" width="14" height="18" rx="3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 11h14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        {/* Screen */}
        <rect x="7.5" y="13" width="9" height="5" rx="1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        {/* Buttons */}
        <circle cx="9.5" cy="20.5" r="1" stroke="currentColor" strokeWidth="1" />
        <circle cx="13.5" cy="20.5" r="1" stroke="currentColor" strokeWidth="1" />
        {/* Test strip slot */}
        <path d="M19 14h3.5a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H19" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Blood glucose drop on strip */}
        <path d="M23.5 14.2c.8 1.2 1.4 2.2 1.4 3a1.4 1.4 0 0 1-2.8 0c0-.8.6-1.8 1.4-3z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Drop highlight */}
        <path d="M23.5 15.5c.4.5.7 1 .7 1.5a.7.7 0 0 1-1.4 0c0-.5.3-1 .7-1.5" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.5" />
      </svg>
    ),
  },
  {
    name: "Cardiac Care",
    href: "/products?category=heart-cardio",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="size-10" aria-hidden="true">
        {/* Anatomical heart outline */}
        <path d="M16 27C10 22 5 18 5 12.5a5.5 5.5 0 0 1 10-3.2A5.5 5.5 0 0 1 27 12.5C27 18 22 22 16 27z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        {/* Aorta arch detail */}
        <path d="M14 9.5c-1-2.5-.5-4.5 1-5.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <path d="M16 10c0-2 .5-3.5 1.5-4.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        {/* ECG pulse line across the heart */}
        <path d="M4 17.5h4l1.5-3 2 5.5 2-4 1.5 2h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        {/* ECG peak detail */}
        <path d="M14 17l1-4.5 2 6 1.5-3.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      </svg>
    ),
  },
  {
    name: "Stomach Care",
    href: "/products?category=digestive-health",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="size-10" aria-hidden="true">
        {/* Esophagus */}
        <path d="M16 3v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M14.5 7c-1 .5-2 1.5-2 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        {/* Stomach organ - main body */}
        <path d="M12.5 10c-3.5 0-6 2.5-6 6 0 4.5 3 8 6.5 8s6-2 7.5-5c1-2 1.5-4 1.5-5.5 0-2-1.5-3.5-3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        {/* Inner fold lines */}
        <path d="M10 15c.5 1.5 1.5 2.5 3 2.5 1.2 0 2-.7 2.5-2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <path d="M14 13c.3 1 .8 1.8 1.5 1.8.6 0 1-.5 1.3-1.3" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
      </svg>
    ),
  },
  {
    name: "Pain Relief",
    href: "/products?category=pain-relief",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="size-10" aria-hidden="true">
        {/* Head */}
        <circle cx="16" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        {/* Neck */}
        <path d="M16 8v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        {/* Body / torso */}
        <path d="M12 10h8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M16 10v8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        {/* Legs */}
        <path d="M16 18l-3 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M16 18l3 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        {/* Pain lightning bolt at shoulder */}
        <path d="M22 10l1.5-1.5-.8 1.8 1.5-.3-1.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Pain radiating rings */}
        <circle cx="22.5" cy="11.5" r="2.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeDasharray="1.5 2" opacity="0.6" />
        <circle cx="22.5" cy="11.5" r="4" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" strokeDasharray="1 2.5" opacity="0.4" />
      </svg>
    ),
  },
  {
    name: "Liver Care",
    href: "/products?search=liver",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="size-10" aria-hidden="true">
        {/* Liver organ - larger lobe */}
        <path d="M6 16c0-6 4.5-10 10-10 5 0 9 3.5 9 8.5 0 5-3.5 9.5-8 9.5-4 0-7-2.5-9.5-5.5C7.2 17.5 6 16.8 6 16z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        {/* Falciform ligament / division line */}
        <path d="M15 6.5c-1 3-1.5 6-1.5 9.5 0 3 .5 5.5 1.5 8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
        {/* Gallbladder */}
        <ellipse cx="11" cy="18" rx="1.8" ry="2.8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <path d="M11 15.2v-2" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
        {/* Hepatic vein detail */}
        <path d="M18 8c-1 1.5-1.5 3-1.5 5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
        <path d="M22 10c-1.5 1.5-2.5 3-2.5 4.5" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.4" />
      </svg>
    ),
  },
  {
    name: "Oral Care",
    href: "/products?category=personal-care",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="size-10" aria-hidden="true">
        {/* Tooth crown */}
        <path d="M8 6c-2 0-3.5 1.5-3.5 3.5 0 2.5 1.5 4 2 6.5.5 2.5 1 5 2 5s1.3-1.8 2-1.8 1.2 1.8 2 1.8 1.5-2.5 2-5c.5-2.5 2-4 2-6.5C20 7.5 18.5 6 16.5 6c-1.5 0-2.5 1-3.5 1S10 6 8 6z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        {/* Crown shine line */}
        <path d="M10 8c.5 1.5 1 3 1.5 4.5" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.5" />
        <path d="M15 7.5c.3 1.5.7 3 1 4.5" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.4" />
        {/* Toothbrush */}
        <path d="M21 5l-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <rect x="20" y="3" width="5" height="3" rx="1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" transform="rotate(45 22.5 4.5)" />
        {/* Brush bristles */}
        <path d="M19.5 8.5l-1 1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <path d="M20.5 7.5l-.8.8" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
      </svg>
    ),
  },
  {
    name: "Respiratory",
    href: "/products?search=respiratory",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="size-10" aria-hidden="true">
        {/* Trachea */}
        <path d="M16 3v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        {/* Trachea rings */}
        <path d="M14.5 4.5h3" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
        <path d="M14.5 6h3" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
        <path d="M14.5 7.5h3" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
        {/* Left lung */}
        <path d="M14 8c-3 .5-6 3-6 7.5 0 4.5 3 8 6 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 12c0 3 2 5.5 4 7" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.5" />
        <path d="M9 15c.5 2 1.5 3.5 3 4.5" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.4" />
        {/* Right lung */}
        <path d="M18 8c3 .5 6 3 6 7.5 0 4.5-3 8-6 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M24 12c0 3-2 5.5-4 7" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.5" />
        <path d="M23 15c-.5 2-1.5 3.5-3 4.5" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.4" />
        {/* Bronchi detail */}
        <path d="M14 8l-2 3" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
        <path d="M18 8l2 3" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
      </svg>
    ),
  },
  {
    name: "Sexual Health",
    href: "/products?category=sexual-wellness",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="size-10" aria-hidden="true">
        {/* Male symbol */}
        <circle cx="12" cy="10" r="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M15 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M15.5 4h3.5v3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Female symbol */}
        <circle cx="20" cy="21" r="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M20 17v-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M17.5 17.5h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        {/* Connecting heart between symbols */}
        <path d="M16 13.5c.6-1 1.5-1.5 2.3-1.5.9 0 1.6.6 1.7 1.4.1.8-.6 1.6-1.7 2.6-1.1-1-1.8-1.8-1.7-2.6.1-.8.8-1.4 1.7-1.4" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      </svg>
    ),
  },
  {
    name: "Elderly Care",
    href: "/products?search=elderly",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="size-10" aria-hidden="true">
        {/* Elderly person - head */}
        <circle cx="10" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        {/* Elderly body */}
        <path d="M10 8v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M10 12l-2.5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M10 12l2 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        {/* Walking cane */}
        <path d="M7.5 16.5l-.5 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M7 22.5c-1 0-1.5-.5-1.5-1.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        {/* Legs */}
        <path d="M12 17l1.5 5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        {/* Caregiver person - head */}
        <circle cx="21" cy="6" r="2.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        {/* Caregiver body */}
        <path d="M21 8.2v3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M21 11.7l-2 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M21 11.7l2 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        {/* Caregiver reaching toward elderly */}
        <path d="M19 13l-4 1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
        {/* Caregiver legs */}
        <path d="M23 16.7l1 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        {/* Heart between them */}
        <path d="M15.5 12c.3-.6.9-.9 1.4-.9.6 0 1 .4 1.1.9.1.5-.4 1-1.1 1.6-.7-.6-1.2-1.1-1.1-1.6.1-.5.5-.9 1.1-.9" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      </svg>
    ),
  },
  {
    name: "Cold & Immunity",
    href: "/products?category=health-safety",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="size-10" aria-hidden="true">
        {/* Shield shape */}
        <path d="M16 3L5 8v7c0 6.5 4.7 12.5 11 14 6.3-1.5 11-7.5 11-14V8L16 3z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        {/* Shield inner edge */}
        <path d="M16 5.5l8 3.5v5.5c0 5-3.5 9.5-8 11-4.5-1.5-8-6-8-11V9l8-3.5z" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
        {/* Cross / plus inside shield */}
        <path d="M16 11v10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M11 16h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        {/* Sparkle / immunity indicator */}
        <path d="M24 5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2L22.1 7.2l1.2-.5.5-1.2z" fill="currentColor" stroke="none" opacity="0.5" />
        <path d="M7 4.5l.3.8.8.3-.8.3-.3.8-.3-.8L5.9 5.6l.8-.3.3-.8z" fill="currentColor" stroke="none" opacity="0.4" />
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
              <span
                className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-all duration-300 group-hover:bg-primary/10 group-hover:text-primary group-hover:shadow-[0_2px_12px_rgba(16,185,129,0.15)]"
                style={{
                  filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.06)) drop-shadow(0 1px 2px rgba(0,0,0,0.08))",
                  transform: "perspective(200px) rotateX(0deg)",
                  transition: "transform 280ms ease, filter 280ms ease",
                }}
              >
                <span
                  className="block transition-transform duration-280 ease-out group-hover:scale-105"
                  style={{ transform: "perspective(200px) rotateX(2deg)" }}
                >
                  {c.icon}
                </span>
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
