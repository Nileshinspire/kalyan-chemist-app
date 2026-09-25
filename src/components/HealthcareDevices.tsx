import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { preloadRoute } from "@/lib/route-preload";
import { Activity } from "lucide-react";

/* ─── Healthcare Devices ───
 * Grid of 6 healthcare-device category cards with premium pencil-sketch
 * medical device illustrations. Every card navigates into the EXISTING
 * product catalogue category route.
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
      <svg viewBox="0 0 32 32" fill="none" className="size-10" aria-hidden="true">
        {/* Cuff — wrap-around band */}
        <path d="M4 14c0-3.5 3.5-6.5 8-6.5h2c4.5 0 8 3 8 6.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M4 14v3c0 3.5 3.5 6.5 8 6.5h2c4.5 0 8-3 8-6.5v-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        {/* Tube from cuff to monitor */}
        <path d="M16 20.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M16 23.5c0 1.5-1 2.5-2.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        {/* Monitor body */}
        <rect x="5.5" y="5" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        {/* LCD screen */}
        <rect x="7" y="6.5" width="7" height="4" rx="0.8" stroke="currentColor" strokeWidth="0.9" />
        {/* BP reading "120/80" */}
        <path d="M8.5 8.5v1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <path d="M8 9.5h1" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
        <path d="M10.5 8v2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <path d="M10.5 10h.6" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
        <path d="M12 8.2v1.8" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
        {/* Pump button */}
        <circle cx="10.5" cy="11.8" r="0.8" stroke="currentColor" strokeWidth="0.7" />
        {/* Inner cuff texture lines */}
        <path d="M7 12.5h6" stroke="currentColor" strokeWidth="0.35" strokeLinecap="round" opacity="0.3" />
        <path d="M7 15.5h6" stroke="currentColor" strokeWidth="0.35" strokeLinecap="round" opacity="0.25" />
      </svg>
    ),
  },
  {
    name: "Glucometers",
    slug: "glucometers",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="size-10" aria-hidden="true">
        {/* Meter body */}
        <path d="M6 7c-.1-.3-.3-.5-.6-.5H18c.4 0 .7.3.7.7v17c0 .4-.3.7-.7.7H5.6c-.3 0-.5-.2-.6-.5V7z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Screen */}
        <rect x="8" y="9" width="9" height="6" rx="1.2" stroke="currentColor" strokeWidth="1" />
        {/* Blood glucose reading */}
        <path d="M10 11.5v2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M9.3 12.5h1.4" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
        <path d="M12.5 11v2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M12.5 13.5h.6" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
        <path d="M14 11c.5 1 .8 1.8.8 2.5s-.3 1.5-.8 2.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
        {/* Button */}
        <circle cx="12.5" cy="18.5" r="1.5" stroke="currentColor" strokeWidth="0.9" />
        <path d="M11.8 18.5h1.4" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" />
        {/* Test strip slot */}
        <path d="M18.7 12h2.8a.8.8 0 0 1 .8.8v1.2a.8.8 0 0 1-.8.8h-2.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        {/* Blood drop on strip */}
        <path d="M23.3 12.3c.8 1.1 1.3 2 1.3 2.7a1.3 1.3 0 0 1-2.6 0c0-.7.5-1.6 1.3-2.7z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        {/* Drop highlight */}
        <path d="M23.3 13.5c.3.4.5.9.5 1.3a.5.5 0 0 1-1 0c0-.4.2-.9.5-1.3" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.4" />
        {/* Sketch hatching */}
        <path d="M7 22l.8-.4" stroke="currentColor" strokeWidth="0.35" strokeLinecap="round" opacity="0.2" />
        <path d="M7 23.5l.5-.25" stroke="currentColor" strokeWidth="0.3" strokeLinecap="round" opacity="0.15" />
      </svg>
    ),
  },
  {
    name: "Pulse Oximeters",
    slug: "pulse-oximeters",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="size-10" aria-hidden="true">
        {/* Clip body — clamshell shape */}
        <path d="M7 10c0-3 3-5.5 7-5.5h2c4 0 7 2.5 7 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M7 10c0 3 3 5.5 7 5.5h2c4 0 7-2.5 7-5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        {/* Finger opening */}
        <path d="M9.5 10c0-1.8 1.8-3.2 4-3.2h1c2.2 0 4 1.4 4 3.2" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
        {/* Hinge detail */}
        <path d="M7 10h18" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
        {/* LCD screen area */}
        <rect x="10" y="7" width="6" height="3.5" rx="0.8" stroke="currentColor" strokeWidth="0.9" />
        {/* SpO2 reading */}
        <path d="M11.5 8v2" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
        <path d="M13 7.8v2.2" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
        <path d="M11.2 9.8h.6" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" />
        <path d="M13 9.8h.5" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" />
        <path d="M14.5 8.2v1.6" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
        {/* Pleth waveform inside screen */}
        <path d="M11 10.2h1l.5-1 1 2 .5-1h1" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
        {/* Finger insertion area */}
        <path d="M10 10.5h5" stroke="currentColor" strokeWidth="0.4" strokeLinecap="round" opacity="0.3" />
        {/* Clip depth shadow */}
        <path d="M8.5 10.8c1 1.5 2.5 2.5 4.5 2.5" stroke="currentColor" strokeWidth="0.4" strokeLinecap="round" opacity="0.2" />
      </svg>
    ),
  },
  {
    name: "Nebulizers",
    slug: "nebulizers",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="size-10" aria-hidden="true">
        {/* Nebulizer mask — face-fitting shape */}
        <path d="M10 10c-2 0-3.5 1.5-3.5 3.5 0 2.5 1.5 4 2 6.5.5 2.5 1 4.5 1.8 4.5s1.2-1.5 1.8-1.5 1 1.5 1.8 1.5 1.3-2 1.8-4.5c.5-2.5 2-4 2-6.5 0-2-1.5-3.5-3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Mask bridge */}
        <path d="M10 13h6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        {/* Mask inner — face contour */}
        <path d="M10.5 14c.5 1.5 1 2.8 2 3.5" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.4" />
        <path d="M15.5 14c-.5 1.5-1 2.8-2 3.5" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.4" />
        {/* Tubing from mask */}
        <path d="M13 10v-2.5c0-1.5 1.5-2.5 3-2.5h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Medicine chamber / cup */}
        <rect x="18" y="3.5" width="6" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        {/* Liquid level */}
        <path d="M19 7.5h4" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.5" />
        <path d="M19.5 9h3" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.35" />
        {/* Mist particles from mask */}
        <circle cx="7" cy="11" r="0.5" fill="currentColor" opacity="0.3" />
        <circle cx="5.5" cy="13" r="0.4" fill="currentColor" opacity="0.25" />
        <circle cx="6" cy="15" r="0.35" fill="currentColor" opacity="0.2" />
        <circle cx="8" cy="9.5" r="0.3" fill="currentColor" opacity="0.2" />
        {/* Tube connector detail */}
        <path d="M21 10.5v-1" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.4" />
      </svg>
    ),
  },
  {
    name: "Digital Thermometers",
    slug: "digital-thermometers",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="size-10" aria-hidden="true">
        {/* Probe tip */}
        <path d="M14.5 5c-.8.5-1.2 1.5-1.2 2.5v1.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        {/* Probe body — tapered */}
        <path d="M13.3 9c-.5 1-.8 2.2-.8 3.5v6c0 2 1.5 3.5 3.5 3.5h0c2 0 3.5-1.5 3.5-3.5v-6c0-1.3-.3-2.5-.8-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        {/* LCD screen */}
        <rect x="12" y="12" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1" />
        {/* Temperature reading "36.5" */}
        <path d="M13.5 14v2" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
        <path d="M13 15h1" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" />
        <path d="M15.5 13.5v2.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
        <path d="M15.5 15.8h.5" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" />
        <path d="M17 13.5c.4.8.6 1.5.6 2.2" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
        <path d="M18.5 13.8v1.8" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
        <path d="M18.5 15.8h.4" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" />
        {/* Button */}
        <circle cx="16" cy="19.5" r="1" stroke="currentColor" strokeWidth="0.8" />
        {/* Battery indicator */}
        <rect x="18" y="18.8" width="2" height="1.2" rx="0.3" stroke="currentColor" strokeWidth="0.6" />
        <path d="M20 19.2v.4" stroke="currentColor" strokeWidth="0.4" strokeLinecap="round" />
        {/* Sketch detail on body */}
        <path d="M13.8 21l.4-.2" stroke="currentColor" strokeWidth="0.3" strokeLinecap="round" opacity="0.2" />
        <path d="M14.5 22l.3-.15" stroke="currentColor" strokeWidth="0.25" strokeLinecap="round" opacity="0.15" />
      </svg>
    ),
  },
  {
    name: "Weighing Scales",
    slug: "weighing-scales",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" className="size-10" aria-hidden="true">
        {/* Platform — top surface */}
        <rect x="4" y="10" width="24" height="12" rx="3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        {/* Platform top edge highlight */}
        <path d="M7.5 10h17" stroke="currentColor" strokeWidth="0.4" strokeLinecap="round" opacity="0.2" />
        {/* Digital display window */}
        <rect x="9" y="12" width="10" height="5" rx="1.2" stroke="currentColor" strokeWidth="1" />
        {/* Weight reading */}
        <path d="M11 14.5v1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <path d="M10.3 15.3h1.4" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
        <path d="M13 14v2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <path d="M13 16h.5" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" />
        <path d="M14.5 14.2c.4.7.6 1.3.6 1.8" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
        <path d="M16 14.5v1.2" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
        <path d="M16 16h.4" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" />
        {/* Unit label "kg" */}
        <path d="M17.5 15v1.2" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" />
        <path d="M17.2 15.6l.5-.4.5.8" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Control buttons */}
        <circle cx="22" cy="14.5" r="0.9" stroke="currentColor" strokeWidth="0.7" />
        <circle cx="22" cy="16.5" r="0.9" stroke="currentColor" strokeWidth="0.7" />
        {/* Platform feet */}
        <path d="M7 22v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M25 22v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M5.5 24h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <path d="M23.5 24h3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        {/* Surface texture */}
        <path d="M8 18.5h4" stroke="currentColor" strokeWidth="0.3" strokeLinecap="round" opacity="0.15" />
        <path d="M20 18.5h4" stroke="currentColor" strokeWidth="0.3" strokeLinecap="round" opacity="0.15" />
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
              onMouseEnter={() => preloadRoute("/products")}
              onFocus={() => preloadRoute("/products")}
              onClick={() => navigate(`/products?category=${c.slug}`)}
              className="group flex flex-col items-center rounded-xl border border-border/60 bg-card p-4 sm:p-5 text-center shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-md cursor-pointer"
            >
              <span
                className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-muted text-[#0D6B62] transition-all duration-300 group-hover:bg-primary/10 group-hover:text-primary group-hover:shadow-[0_2px_14px_rgba(16,185,129,0.18)]"
                style={{
                  filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.07)) drop-shadow(0 2px 3px rgba(0,0,0,0.1))",
                  transform: "perspective(250px) rotateX(1.5deg)",
                  transition: "transform 280ms ease, filter 280ms ease",
                }}
              >
                <span
                  className="block transition-transform duration-280 ease-out group-hover:scale-[1.07]"
                  style={{ transform: "perspective(250px) rotateX(2deg)" }}
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
