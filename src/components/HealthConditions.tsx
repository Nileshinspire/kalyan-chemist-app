import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router";
import { HeartPulse } from "lucide-react";

/* ─── Browse by Health Conditions ───
 * Grid of 10 health-condition cards with premium hand-drawn pencil-sketch
 * medical illustrations with subtle 3D depth.
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
      <svg viewBox="0 0 36 36" fill="none" className="size-10" aria-hidden="true">
        {/* Hand-drawn glucose meter body */}
        <path d="M7 8c.1-.3.3-.5.6-.5h11.8c.4 0 .7.3.7.7v18c0 .4-.3.7-.7.7H7.6c-.3 0-.5-.2-.6-.5V8z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        {/* Screen bezel */}
        <rect x="9.5" y="10.5" width="10" height="6.5" rx="1.2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        {/* Screen readout: "108" with sketch feel */}
        <path d="M12 13v2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M11.2 14h1.8" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
        <path d="M14.2 12.5v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M14.2 15.5h.8" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
        <path d="M16 12.5c.5 1 .8 2 .8 3s-.3 2-.8 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <path d="M16 12.5h.8" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
        <path d="M16 15.5h.8" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
        {/* Button */}
        <circle cx="13.5" cy="21.5" r="1.6" stroke="currentColor" strokeWidth="0.9" />
        <path d="M12.8 21.5h1.4" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" />
        {/* Test strip inserted */}
        <path d="M20.5 14.5h3a1 1 0 0 1 1 1v1.5a1 1 0 0 1-1 1h-3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
        {/* Blood drop on strip */}
        <path d="M25.5 14.8c.9 1.3 1.5 2.4 1.5 3.2a1.5 1.5 0 0 1-3 0c0-.8.6-1.9 1.5-3.2z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Drop inner highlight — sketch-style */}
        <path d="M25.5 16.2c.35.5.6 1 .6 1.5a.6.6 0 0 1-1.2 0c0-.5.25-1 .6-1.5" stroke="currentColor" strokeWidth="0.55" strokeLinecap="round" opacity="0.45" />
        {/* Slight hatching on meter body for sketch feel */}
        <path d="M8.2 24l.8-.5" stroke="currentColor" strokeWidth="0.35" strokeLinecap="round" opacity="0.25" />
        <path d="M8.2 25.5l.6-.3" stroke="currentColor" strokeWidth="0.3" strokeLinecap="round" opacity="0.2" />
        {/* Meter edge highlight */}
        <path d="M7.5 8.5v17" stroke="currentColor" strokeWidth="0.35" strokeLinecap="round" opacity="0.2" />
      </svg>
    ),
  },
  {
    name: "Cardiac Care",
    href: "/products?category=heart-cardio",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" className="size-10" aria-hidden="true">
        {/* Anatomical heart — outer wall */}
        <path d="M18 30C11 24 5 19.5 5 13a6.5 6.5 0 0 1 11.5-4A6.5 6.5 0 0 1 31 13c0 6.5-6 11-13 17z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        {/* Aortic arch */}
        <path d="M16 9c-.8-2-.3-4 1.2-5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M18.5 9.5c.2-1.8.8-3.2 2-4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <path d="M20.5 8.5c1-.5 2.2-.3 2.8.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
        {/* Right ventricle division line */}
        <path d="M18 12c-2 4-3.5 7-4 10" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" opacity="0.55" />
        {/* Coronary detail lines */}
        <path d="M12 14c.5 1.5 1 3 1.5 4.5" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.4" />
        <path d="M23 14c-.8 2-1.5 3.5-2 5" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.4" />
        {/* ECG pulse — bold, flowing through the heart */}
        <path d="M3 18h5l1.8-4 2.5 7 2.2-5 2 3h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* ECG peak detail */}
        <path d="M12.3 18l1.2-5.5 2.5 7 1.5-3.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round" opacity="0.45" />
        {/* Subtle ventricle texture */}
        <path d="M14 19c.5 1.2 1 2.2 1.8 3" stroke="currentColor" strokeWidth="0.45" strokeLinecap="round" opacity="0.3" />
        <path d="M22 17c-.5 1.5-1.2 2.8-2 4" stroke="currentColor" strokeWidth="0.45" strokeLinecap="round" opacity="0.3" />
      </svg>
    ),
  },
  {
    name: "Stomach Care",
    href: "/products?category=digestive-health",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" className="size-10" aria-hidden="true">
        {/* Esophagus — top */}
        <path d="M18 2.5v3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M17 6c-1.2.8-2.5 2-2.5 3.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        {/* Stomach — cardiac entrance curve */}
        <path d="M14.5 9.5c-2 .8-3.8 2.5-4.5 5-.8 3 0 6.2 2 8.5 1.5 1.8 3.5 3 5.5 3s4-1 5.5-3c2-2.3 2.8-5.5 2-8.5-.7-2.5-2.5-4.2-4.5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        {/* Greater curvature detail */}
        <path d="M10 16c.5 2.5 1.5 4.5 3 6" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.4" />
        {/* Inner rugae folds */}
        <path d="M13 14c.8 2 2 3 3.5 3 1.2 0 2.2-.8 2.8-2.2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        <path d="M15 12c.5 1.5 1.2 2.5 2 3" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.5" />
        {/* Pyloric canal exit */}
        <path d="M22 18c1.5 0 2.8-.5 3.5-1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M25.5 16.5c.8-.5 1.2-1.2 1.2-2" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
        {/* Subtle sketch shading at bottom */}
        <path d="M15 24c.8.5 1.8 1 3 1s2.2-.5 3-1" stroke="currentColor" strokeWidth="0.4" strokeLinecap="round" opacity="0.25" />
        <path d="M16 25.5c.5.3 1.2.5 2 .5s1.5-.2 2-.5" stroke="currentColor" strokeWidth="0.35" strokeLinecap="round" opacity="0.2" />
      </svg>
    ),
  },
  {
    name: "Pain Relief",
    href: "/products?category=pain-relief",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" className="size-10" aria-hidden="true">
        {/* Human figure — head */}
        <circle cx="17" cy="5.5" r="3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        {/* Neck */}
        <path d="M17 8.5v1.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        {/* Shoulders */}
        <path d="M17 10.3l-5 1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M17 10.3l5 1.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        {/* Torso */}
        <path d="M12 11.5v8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M22 11.5v8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        {/* Legs */}
        <path d="M14 19.5l-2.5 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M20 19.5l2.5 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        {/* Arms */}
        <path d="M12 12.5l-3 4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M22 12.5l3 4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        {/* Pain lightning bolt at left shoulder — bold and dramatic */}
        <path d="M8 10l2-2.5-.6 1.6 2-.2-2 2 .6-1.5-2 .1z" fill="currentColor" stroke="none" opacity="0.85" />
        {/* Pain radiating lines — concentric arcs */}
        <path d="M6.5 11.5a4 4 0 0 1 1.5-2.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.6" />
        <path d="M5 12.5a5.5 5.5 0 0 1 2.5-4" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.45" />
        <path d="M4 13.5a7 7 0 0 1 3-4.5" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.3" />
        {/* Pain at right knee too */}
        <path d="M23 18l1.5-1.5-.5 1.3 1.5-.2-1.5 1.5.5-1.3-1.5.2z" fill="currentColor" stroke="none" opacity="0.6" />
        <circle cx="23.5" cy="18.5" r="1.8" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" strokeDasharray="1 1.8" opacity="0.35" />
      </svg>
    ),
  },
  {
    name: "Liver Care",
    href: "/products?search=liver",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" className="size-10" aria-hidden="true">
        {/* Liver — right lobe (larger) */}
        <path d="M8 18c0-7 5-12 11-12 5.5 0 10 4 10 9.5 0 5.5-4 10.5-9 10.5-4.5 0-8-3-10.5-6C9 20 8 19 8 18z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        {/* Falciform ligament — anatomical division */}
        <path d="M17 6.5c-1.2 3.5-1.8 7-1.8 10.5 0 3.5.6 7 1.8 10" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.6" />
        {/* Left lobe detail */}
        <path d="M17 9c-1.5.5-3 2-3.5 4" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.35" />
        {/* Gallbladder — pear-shaped, anatomically placed */}
        <path d="M11.5 19.5c-.3-1.5-.2-3 .5-4.2.7-1 1.8-1.2 2.5-.5.7.7.5 2-.2 3.5-.5 1-1.3 1.5-2 1.5s-1-.3-1.5-.8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12.3 15.3v-1.5" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
        {/* Hepatic veins — subtle interior detail */}
        <path d="M20 9c-1 2-1.5 4-1.5 6.5" stroke="currentColor" strokeWidth="0.55" strokeLinecap="round" opacity="0.35" />
        <path d="M24 11c-1.5 2-2.5 4-3 6" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.3" />
        <path d="M27 13c-1 1.5-2 3-2.5 4.5" stroke="currentColor" strokeWidth="0.45" strokeLinecap="round" opacity="0.25" />
        {/* Sketch shading at bottom edge */}
        <path d="M12 25.5c1.5 1 3 1.5 4.5 1.5" stroke="currentColor" strokeWidth="0.4" strokeLinecap="round" opacity="0.2" />
      </svg>
    ),
  },
  {
    name: "Oral Care",
    href: "/products?category=personal-care",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" className="size-10" aria-hidden="true">
        {/* Tooth crown — detailed anatomy */}
        <path d="M9 7c-2.5 0-4 2-4 4.2 0 2.8 1.5 4.5 2 7 .6 3 1.2 5.8 2.2 5.8s1.3-2 2.2-2 1.3 2 2.2 2 1.6-2.8 2.2-5.8c.5-2.5 2-4.2 2-7 0-2.2-1.5-4.2-4-4.2-1.8 0-3 1.2-4.2 1.2C11.5 8.2 10.5 7 9 7z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        {/* Root bifurcation — two clear roots */}
        <path d="M11.5 18.5c-.5 2-1 4-1.8 5.5-.5 1-1 1.8-1.5 2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M18.5 18.5c.5 2 1 4 1.8 5.5.5 1 1 1.8 1.5 2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        {/* Root tips */}
        <path d="M8 26c-.3.5-.5 1-.5 1.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
        <path d="M20 26c.3.5.5 1 .5 1.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
        {/* Crown surface detail — cusps */}
        <path d="M10 9c1-.8 2.2-1.2 3.5-1.2" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.5" />
        <path d="M15 8c.8-.5 1.8-.8 2.5-.8" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.5" />
        {/* Enamel shine line */}
        <path d="M11 10c.8 1.5 1.2 3.5 1.5 5" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.35" />
        <path d="M16 9.5c.3 1.5.6 3.5.8 5" stroke="currentColor" strokeWidth="0.45" strokeLinecap="round" opacity="0.3" />
        {/* Sketch shading on crown */}
        <path d="M12.5 12c.3 1 .5 2 .6 3" stroke="currentColor" strokeWidth="0.35" strokeLinecap="round" opacity="0.2" />
        {/* Toothbrush — diagonal, behind tooth */}
        <path d="M23 4l-7 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        {/* Brush head */}
        <rect x="22" y="3" width="5" height="3.5" rx="1.2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" transform="rotate(45 24.5 4.75)" />
        {/* Bristle lines */}
        <path d="M21.5 7.5l-1.2 1.2" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
        <path d="M22.5 6.5l-.8.8" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" opacity="0.6" />
        <path d="M23.2 7.8l-.5.5" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.5" />
        {/* Mint sparkle */}
        <path d="M27 8.5l.4.8.8.4-.8.4-.4.8-.4-.8-.8-.4.8-.4.4-.8z" fill="currentColor" stroke="none" opacity="0.4" />
      </svg>
    ),
  },
  {
    name: "Respiratory",
    href: "/products?search=respiratory",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" className="size-10" aria-hidden="true">
        {/* Trachea — main airway with cartilage rings */}
        <path d="M18 2v5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M16.2 3.2h3.6" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
        <path d="M16.2 4.5h3.6" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
        <path d="M16.2 5.8h3.6" stroke="currentColor" strokeWidth="0.7" strokeLinecap="round" />
        {/* Bronchial split */}
        <path d="M18 7.5l-3 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M18 7.5l3 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        {/* Left bronchus branches */}
        <path d="M15 9.5l-2.5 1.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
        <path d="M15 9.5l-1 2.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
        {/* Right bronchus branches */}
        <path d="M21 9.5l2.5 1.5" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" />
        <path d="M21 9.5l1 2.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
        {/* Left lung — full shape with costal curves */}
        <path d="M15 8c-4 .5-7.5 3.5-7.5 8 0 5 3.5 9 7.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        {/* Right lung — full shape */}
        <path d="M21 8c4 .5 7.5 3.5 7.5 8 0 5-3.5 9-7.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        {/* Lung surface texture — rib impressions */}
        <path d="M10.5 13c1.5 1 3 2 4.5 3" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.35" />
        <path d="M10 16c1 1.2 2.5 2.5 4 3.5" stroke="currentColor" strokeWidth="0.45" strokeLinecap="round" opacity="0.3" />
        <path d="M10.5 19c.8 1 2 2 3.5 3" stroke="currentColor" strokeWidth="0.4" strokeLinecap="round" opacity="0.25" />
        <path d="M25.5 13c-1.5 1-3 2-4.5 3" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.35" />
        <path d="M26 16c-1 1.2-2.5 2.5-4 3.5" stroke="currentColor" strokeWidth="0.45" strokeLinecap="round" opacity="0.3" />
        <path d="M25.5 19c-.8 1-2 2-3.5 3" stroke="currentColor" strokeWidth="0.4" strokeLinecap="round" opacity="0.25" />
        {/* Alveoli suggestion at bottom */}
        <circle cx="13" cy="24.5" r="1" stroke="currentColor" strokeWidth="0.4" opacity="0.25" />
        <circle cx="15" cy="25.5" r="0.8" stroke="currentColor" strokeWidth="0.35" opacity="0.2" />
        <circle cx="23" cy="24.5" r="1" stroke="currentColor" strokeWidth="0.4" opacity="0.25" />
        <circle cx="21" cy="25.5" r="0.8" stroke="currentColor" strokeWidth="0.35" opacity="0.2" />
      </svg>
    ),
  },
  {
    name: "Sexual Health",
    href: "/products?category=sexual-wellness",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" className="size-10" aria-hidden="true">
        {/* Male symbol — Mars */}
        <circle cx="13" cy="11" r="4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M16.2 8.2l4.5-4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M16.8 3.7h3.9v3.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        {/* Male symbol interior detail */}
        <path d="M11 11h4" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.3" />
        <path d="M13 9v4" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.3" />
        {/* Female symbol — Venus */}
        <circle cx="23" cy="23" r="4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M23 18.5v-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M20.5 18.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        {/* Female symbol interior detail */}
        <path d="M21 23h4" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.3" />
        <path d="M23 21v4" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.3" />
        {/* Connecting heart — centered between symbols */}
        <path d="M18 14.5c.8-1.2 2-1.8 3-1.8 1.2 0 2.2.7 2.5 1.8.3-1.1 1.3-1.8 2.5-1.8 1 0 2.2.6 3 1.8 1.2 1.8 1.2 4 0 5.8-1.5 2.2-3.2 3.5-5 4.5-1.8-1-3.5-2.3-5-4.5-1.2-1.8-1.2-4 0-5.8z" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
        {/* Heart inner highlight */}
        <path d="M19.5 15.5c.5-.8 1.2-1.2 2-1.2.8 0 1.5.5 1.8 1.2" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.25" />
      </svg>
    ),
  },
  {
    name: "Elderly Care",
    href: "/products?search=elderly",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" className="size-10" aria-hidden="true">
        {/* Elderly person */}
        {/* Head — slightly tilted forward */}
        <circle cx="11" cy="6" r="2.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        {/* Glasses — distinctive elderly marker */}
        <circle cx="10" cy="6" r="1.1" stroke="currentColor" strokeWidth="0.7" />
        <circle cx="12.2" cy="6" r="1.1" stroke="currentColor" strokeWidth="0.7" />
        <path d="M11.1 6h0" stroke="currentColor" strokeWidth="0.5" />
        {/* Body — slightly stooped posture */}
        <path d="M11 8.8v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M11 12.8l-2 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M11 12.8l1.5 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        {/* Walking cane — curved handle */}
        <path d="M8.5 14l-1.5 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M7 14c-1 0-1.8.3-2 1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
        {/* Elderly person legs */}
        <path d="M12.5 18.3l2 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        {/* Caregiver — taller, upright, supportive */}
        {/* Head */}
        <circle cx="22" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        {/* Body */}
        <path d="M22 7.5v3.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M22 11.3l-2.2 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M22 11.3l2.2 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        {/* Caregiver reaching toward elderly — supportive gesture */}
        <path d="M19.8 13.5l-5.5 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        {/* Caregiver hand */}
        <path d="M14 15.5l-.5.5" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" />
        {/* Caregiver other arm */}
        <path d="M24.2 12l1 3" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
        {/* Caregiver legs */}
        <path d="M24.2 16.8l1.2 5.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        {/* Small heart between them — warmth */}
        <path d="M16.5 11c.4-.7 1.2-1 1.8-1 .7 0 1.2.4 1.4 1 .2-.6.7-1 1.4-1 .6 0 1.4.3 1.8 1 .7 1 .7 2.5 0 3.5-1 1.3-2 2-3.2 2.8-1.2-.8-2.2-1.5-3.2-2.8-.7-1-.7-2.5 0-3.5z" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.4" />
      </svg>
    ),
  },
  {
    name: "Cold & Immunity",
    href: "/products?category=health-safety",
    icon: (
      <svg viewBox="0 0 36 36" fill="none" className="size-10" aria-hidden="true">
        {/* Shield — bold, confident shape */}
        <path d="M18 3L6 8.5v8c0 7 5 13.5 12 15 7-1.5 12-8 12-15v-8L18 3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Shield inner bevel — dimensional depth */}
        <path d="M18 5.5l9 4v6.5c0 5.5-4 10.5-9 12-5-1.5-9-6.5-9-12v-6.5l9-4z" stroke="currentColor" strokeWidth="0.65" strokeLinecap="round" strokeLinejoin="round" opacity="0.35" />
        {/* Shield surface highlight — top left */}
        <path d="M18 5.5L9 9.5v2" stroke="currentColor" strokeWidth="0.4" strokeLinecap="round" opacity="0.2" />
        {/* Cross / plus — medical symbol */}
        <path d="M18 11v12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M12 17h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        {/* Cross inner detail — sketch lines */}
        <path d="M17.2 12v10" stroke="currentColor" strokeWidth="0.35" strokeLinecap="round" opacity="0.2" />
        <path d="M13 17.8h10" stroke="currentColor" strokeWidth="0.35" strokeLinecap="round" opacity="0.2" />
        {/* Sparkle — immunity indicator top-right */}
        <path d="M27 5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5.5-1.3z" fill="currentColor" stroke="none" opacity="0.5" />
        {/* Small sparkle — bottom-left */}
        <path d="M7 5.5l.3.9.9.3-.9.3-.3.9-.3-.9-.9-.3.9-.3.3-.9z" fill="currentColor" stroke="none" opacity="0.35" />
        {/* Shield shadow underneath */}
        <path d="M10 31c2 1 5 1.5 8 1.5s6-.5 8-1.5" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.15" />
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
