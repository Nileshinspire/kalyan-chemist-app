import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { Activity } from "lucide-react";

/* ─── Healthcare Devices ───
 * Grid of 6 healthcare-device category cards with minimal medical line-art
 * icons. Every card navigates into the EXISTING product catalogue category
 * route (`/products?category=<slug>`), driven by the SAME category system the
 * Admin uses when adding products — no duplicate category/product system, no
 * invented data. Categories with no products yet simply show the existing
 * empty state on the product listing page.
 */
type DeviceCategory = {
  name: string;
  slug: string;
  icon: ReactNode;
};

const DEVICE_CATEGORIES: DeviceCategory[] = [
  {
    name: "BP Monitors",
    slug: "bp-monitors",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <circle cx="12" cy="8.2" r="4.9" />
        <polyline points="9.4 8.2 10.5 8.2 11.2 6.7 12.1 9.6 12.9 8.2 14.6 8.2" />
        <path d="M12 13.1c0 1.4-.3 2-1.9 2.5" />
        <rect x="7" y="15.6" width="10" height="4.3" rx="2.1" />
        <path d="M9.8 15.6v4.3" />
        <path d="M12 15.6v4.3" />
      </svg>
    ),
  },
  {
    name: "Glucometers",
    slug: "glucometers",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <rect x="4.5" y="3.5" width="11" height="16.5" rx="2.6" />
        <rect x="6.6" y="6" width="6.8" height="4.6" rx="1" />
        <path d="M8.2 8h3.6" />
        <path d="M8.2 9.6h2.2" />
        <circle cx="10" cy="14.6" r="1.2" />
        <path d="M8.3 17h3.4" />
        <path d="M18.4 10.6c1.2 1.5 2.3 2.7 2.3 3.9a2.3 2.3 0 0 1-4.6 0c0-1.2 1.1-2.4 2.3-3.9z" />
      </svg>
    ),
  },
  {
    name: "Pulse Oximeters",
    slug: "pulse-oximeters",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <path d="M8.4 7.2c0-2 1.6-3.4 3.6-3.4s3.6 1.4 3.6 3.4" />
        <path d="M8.4 7.2c0 2 1.6 3.4 3.6 3.4s3.6-1.4 3.6-3.4" />
        <rect x="9.2" y="8.6" width="5.6" height="1.7" rx="0.85" />
        <polyline points="8.8 14.2 10.1 14.2 10.9 12.8 11.9 15.5 12.7 14.2 15.2 14.2" />
      </svg>
    ),
  },
  {
    name: "Nebulizers",
    slug: "nebulizers",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <path d="M9.8 5h1.2" />
        <path d="M12.4 3.8h1.2" />
        <path d="M14.6 5h1" />
        <path d="M9 11.6c0-2.1 1.3-3.7 3-3.7s3 1.6 3 3.7" />
        <path d="M9 11.6h6" />
        <path d="M12 11.6v1.4" />
        <rect x="6.5" y="13" width="11" height="6" rx="2.5" />
        <path d="M12 14.2v3.6" />
        <path d="M10.2 16h3.6" />
      </svg>
    ),
  },
  {
    name: "Digital Thermometers",
    slug: "digital-thermometers",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <path d="M12 8.5V5.4" />
        <rect x="7.2" y="8.5" width="9.6" height="11.5" rx="2.7" />
        <rect x="9.4" y="11" width="5.2" height="4.2" rx="1.1" />
        <path d="M10.8 13.1h2.4" />
        <path d="M10.8 14.4h1.6" />
        <circle cx="12" cy="17.4" r="0.85" />
      </svg>
    ),
  },
  {
    name: "Weighing Scales",
    slug: "weighing-scales",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="size-8" aria-hidden="true">
        <rect x="3.8" y="8.5" width="16.4" height="11.5" rx="3" />
        <circle cx="12" cy="14.2" r="4" />
        <path d="M12 14.2l2.4-1.7" />
        <path d="M10.2 12l-.7-.9" />
        <path d="M13.9 16.4l.7.9" />
        <path d="M8.6 14.2h1" />
        <path d="M14.4 14.2h1" />
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

export default function HealthcareDevices() {
  const navigate = useNavigate();

  return (
    <section className="bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 pt-1 sm:pt-2 pb-8 sm:pb-12">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
            <Activity className="size-3" />
            Home Health Devices
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Healthcare Devices
          </h2>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground">
            Monitor your health at home with trusted devices — from blood
            pressure and glucose to oxygen, respiratory care and more.
          </p>
        </div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={{ visible: { transition: { staggerChildren: 0.06 } } }}
          className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6"
        >
          {DEVICE_CATEGORIES.map((c) => (
            <motion.button
              key={c.slug}
              type="button"
              variants={cardVariants}
              onClick={() => navigate(`/products?category=${c.slug}`)}
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