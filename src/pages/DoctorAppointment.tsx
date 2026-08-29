import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  MapPin,
  Search,
  ChevronDown,
  Star,
  Clock,
  Loader2,
  User,
  Stethoscope,
} from "lucide-react";

/* ─── Shared Specialties Data (same as Admin) ─── */
const SPECIALTIES = [
  { key: "general-physician", label: "General Physician" },
  { key: "dermatology", label: "Dermatology" },
  { key: "obstetrics-gynaecology", label: "Obstetrics & Gynaecology" },
  { key: "orthopaedics", label: "Orthopaedics" },
  { key: "ent", label: "ENT" },
  { key: "neurology", label: "Neurology" },
  { key: "cardiology", label: "Cardiology" },
  { key: "urology", label: "Urology" },
  { key: "gastroenterology", label: "Gastroenterology/GI" },
  { key: "psychiatry", label: "Psychiatry" },
  { key: "paediatrics", label: "Paediatrics" },
  { key: "pulmonology", label: "Pulmonology" },
  { key: "endocrinology", label: "Endocrinology" },
  { key: "nephrology", label: "Nephrology" },
  { key: "neurosurgery", label: "Neurosurgery" },
  { key: "rheumatology", label: "Rheumatology" },
  { key: "ophthalmology", label: "Ophthalmology" },
  { key: "surgical-gastroenterology", label: "Surgical Gastroenterology" },
  { key: "infectious-disease", label: "Infectious Disease" },
  { key: "general-laparoscopic-surgery", label: "General & Laparoscopic Surgery" },
  { key: "psychology", label: "Psychology" },
  { key: "medical-oncology", label: "Medical Oncology" },
  { key: "diabetology", label: "Diabetology" },
  { key: "dentist", label: "Dentist" },
] as const;

/* ─── Premium Medical Specialty Icons ─── */
function SpecialtyIcon({ specialtyKey, className = "" }: { specialtyKey: string; className?: string }) {
  /* All icons: viewBox 0 0 48 48, flat fills, ONE obvious main object per specialty */
  const icons: Record<string, React.ReactNode> = {
    /* 1. General Physician — stethoscope */
    "general-physician": (
      <svg viewBox="0 0 48 48" className={className}>
        {/* ear pieces */}
        <circle cx="14" cy="10" r="3" fill="#4A8FD9" />
        <circle cx="34" cy="10" r="3" fill="#4A8FD9" />
        {/* tubing */}
        <path d="M14 13v4c0 4 4 8 10 8s10-4 10-8v-4" fill="none" stroke="#4A8FD9" strokeWidth="3" strokeLinecap="round" />
        {/* chest piece */}
        <circle cx="24" cy="28" r="5" fill="#3A7BC8" />
        <circle cx="24" cy="28" r="2.5" fill="#5BA0E8" />
        {/* tube to chest piece */}
        <line x1="24" y1="22" x2="24" y2="23" stroke="#4A8FD9" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),

    /* 2. Dermatology — face/skin profile */
    dermatology: (
      <svg viewBox="0 0 48 48" className={className}>
        {/* face shape */}
        <ellipse cx="24" cy="22" rx="14" ry="16" fill="#F2C9A3" />
        {/* cheek glow */}
        <ellipse cx="16" cy="26" rx="3" ry="2" fill="#F0B890" opacity="0.6" />
        <ellipse cx="32" cy="26" rx="3" ry="2" fill="#F0B890" opacity="0.6" />
        {/* eye */}
        <ellipse cx="19" cy="20" rx="2" ry="1.2" fill="#504040" />
        <ellipse cx="29" cy="20" rx="2" ry="1.2" fill="#504040" />
        {/* lips */}
        <path d="M21 30c1.5 1 4.5 1 6 0" fill="none" stroke="#D08868" strokeWidth="1.5" strokeLinecap="round" />
        {/* small sparkle on skin */}
        <circle cx="33" cy="16" r="1.5" fill="#FFF" opacity="0.7" />
        <circle cx="35" cy="14" r="0.8" fill="#FFF" opacity="0.5" />
      </svg>
    ),

    /* 3. Obstetrics & Gynaecology — uterus/maternal */
    "obstetrics-gynaecology": (
      <svg viewBox="0 0 48 48" className={className}>
        {/* uterus body */}
        <path d="M14 10v12c0 6 4 10 10 14 6-4 10-8 10-14V10" fill="none" stroke="#D88098" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {/* fallopian tubes */}
        <path d="M14 10c-4-1-8 0-10 3" fill="none" stroke="#D88098" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M34 10c4-1 8 0 10 3" fill="none" stroke="#D88098" strokeWidth="2.5" strokeLinecap="round" />
        {/* small baby silhouette inside */}
        <circle cx="24" cy="26" r="3" fill="#E8A0B8" />
        <path d="M21 30c0 0 1 4 3 5s3-5 3-5" fill="#E8A0B8" />
        {/* heart accent */}
        <path d="M23 14l-1.5-1.5a1.2 1.2 0 0 1 2 0 1.2 1.2 0 0 1 2 0L24 14.5" fill="#E86888" />
      </svg>
    ),

    /* 4. Orthopaedics — single bone */
    orthopaedics: (
      <svg viewBox="0 0 48 48" className={className}>
        {/* bone shaft */}
        <rect x="18" y="14" width="12" height="20" rx="5" fill="#F0E8D8" />
        {/* top knobs */}
        <ellipse cx="16" cy="14" rx="6" ry="5" fill="#F0E8D8" />
        <ellipse cx="32" cy="14" rx="6" ry="5" fill="#E8DCC8" />
        {/* bottom knobs */}
        <ellipse cx="16" cy="34" rx="6" ry="5" fill="#F0E8D8" />
        <ellipse cx="32" cy="34" rx="6" ry="5" fill="#E8DCC8" />
        {/* subtle highlight */}
        <ellipse cx="22" cy="20" rx="2" ry="6" fill="#FFF" opacity="0.3" />
      </svg>
    ),

    /* 5. ENT — ear */
    ent: (
      <svg viewBox="0 0 48 48" className={className}>
        {/* outer ear shape */}
        <path d="M30 8c8 0 12 6 12 14s-4 14-8 16c-2 1-4 2-4 4" fill="#F0C8A0" />
        <path d="M30 8c-6 0-10 6-10 14v4c0 4 2 6 5 6" fill="#E8B888" />
        {/* inner ear detail */}
        <path d="M24 18c2 0 4 2 4 4s-2 4-4 4" fill="none" stroke="#D49868" strokeWidth="2" strokeLinecap="round" />
        <path d="M28 18c3 2 5 6 5 10" fill="none" stroke="#D49868" strokeWidth="2" strokeLinecap="round" />
        {/* ear canal hint */}
        <path d="M26 24c1 1 1.5 2.5 1.5 4" fill="none" stroke="#C08050" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),

    /* 6. Neurology — brain */
    neurology: (
      <svg viewBox="0 0 48 48" className={className}>
        {/* brain shape */}
        <path d="M24 8C17 8 12 13 12 20c0 3 1 6 3 8 1 1 1.5 2 1.5 3.5v3c0 1 .8 1.5 1.5 1.5h12c.7 0 1.5-.5 1.5-1.5v-3c0-1.5.5-2.5 1.5-3.5 2-2 3-5 3-8C36 13 31 8 24 8z" fill="#F0A8B0" />
        {/* midline */}
        <path d="M24 8v34" fill="none" stroke="#D88898" strokeWidth="1.5" strokeLinecap="round" />
        {/* left fold */}
        <path d="M16 14c-2 3-3 6-3.5 9" fill="none" stroke="#D88898" strokeWidth="1.5" strokeLinecap="round" />
        {/* right fold */}
        <path d="M32 14c2 3 3 6 3.5 9" fill="none" stroke="#D88898" strokeWidth="1.5" strokeLinecap="round" />
        {/* horizontal fold */}
        <path d="M14 20c3 2 7 3 10 3s7-1 10-3" fill="none" stroke="#C87888" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),

    /* 7. Cardiology — anatomical heart */
    cardiology: (
      <svg viewBox="0 0 48 48" className={className}>
        {/* heart shape — anatomical not love-heart */}
        <path d="M24 42S10 34 10 22c0-6 4-10 8-10 2.5 0 4.5 1.5 6 4 1.5-2.5 3.5-4 6-4 4 0 8 4 8 10 0 12-14 20-14 20z" fill="#E84040" />
        {/* darker left half */}
        <path d="M24 42S10 34 10 22c0-6 4-10 8-10 2.5 0 4.5 1.5 6 4" fill="#D03030" />
        {/* aorta vessel at top */}
        <path d="M22 12c-3-1-6-1-8 1" fill="none" stroke="#C02020" strokeWidth="2" strokeLinecap="round" />
        <path d="M26 12c3-1 6-1 8 1" fill="none" stroke="#C02020" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 12V8" stroke="#C02020" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),

    /* 8. Urology — bladder */
    urology: (
      <svg viewBox="0 0 48 48" className={className}>
        {/* ureters coming in */}
        <path d="M16 8c2 4 4 8 6 14" fill="none" stroke="#6A9FD8" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M32 8c-2 4-4 8-6 14" fill="none" stroke="#6A9FD8" strokeWidth="2.5" strokeLinecap="round" />
        {/* bladder body */}
        <ellipse cx="24" cy="28" rx="12" ry="10" fill="#6A9FD8" />
        <ellipse cx="24" cy="28" rx="8" ry="6" fill="#5890C8" />
        {/* urethra */}
        <line x1="24" y1="38" x2="24" y2="44" stroke="#6A9FD8" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    ),

    /* 9. Gastroenterology — stomach */
    gastroenterology: (
      <svg viewBox="0 0 48 48" className={className}>
        {/* esophagus */}
        <path d="M20 6v6" stroke="#E09060" strokeWidth="3" strokeLinecap="round" />
        {/* stomach body — natural curved sac shape */}
        <path d="M20 12c-8 1-14 7-14 16s4 10 8 12c2 1 3 3 3 5" fill="#F0C090" />
        <path d="M20 12c0 0 2 4 4 8 2-4 4-8 4-8 8-1 14 5 14 16s-4 10-8 12c-2 1-3 3-3 5" fill="#E8B080" />
        {/* stomach fold lines */}
        <path d="M14 24c4 1 8 1 12 0" fill="none" stroke="#D89868" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M16 30c3 1 6 1 10 0" fill="none" stroke="#D89868" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),

    /* 10. Psychiatry — head with brain */
    psychiatry: (
      <svg viewBox="0 0 48 48" className={className}>
        {/* head silhouette */}
        <circle cx="24" cy="18" r="12" fill="#D8A8C8" />
        {/* brain visible inside head */}
        <path d="M18 12c-2 1-4 4-4 6" fill="none" stroke="#B888A8" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M30 12c2 1 4 4 4 6" fill="none" stroke="#B888A8" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M24 10v2" stroke="#B888A8" strokeWidth="1" strokeLinecap="round" />
        {/* calm expression */}
        <path d="M20 20c1 1 3 1 4 1s3 0 4-1" fill="none" stroke="#A07090" strokeWidth="1.5" strokeLinecap="round" />
        {/* thought bubbles */}
        <circle cx="16" cy="32" r="1.5" fill="#D8A8C8" opacity="0.5" />
        <circle cx="12" cy="36" r="2" fill="#D8A8C8" opacity="0.4" />
        <circle cx="10" cy="41" r="2.5" fill="#D8A8C8" opacity="0.3" />
      </svg>
    ),

    /* 11. Paediatrics — child */
    paediatrics: (
      <svg viewBox="0 0 48 48" className={className}>
        {/* head */}
        <circle cx="24" cy="12" r="7" fill="#F0C8A0" />
        {/* body */}
        <path d="M17 22c0 0-1 12 7 14s7-14 7-14" fill="#58B0E8" />
        {/* arms */}
        <path d="M17 24c-3 2-5 6-5 8" fill="none" stroke="#F0C8A0" strokeWidth="3" strokeLinecap="round" />
        <path d="M31 24c3 2 5 6 5 8" fill="none" stroke="#F0C8A0" strokeWidth="3" strokeLinecap="round" />
        {/* legs */}
        <path d="M21 36l-1 8" stroke="#F0C8A0" strokeWidth="3" strokeLinecap="round" />
        <path d="M27 36l1 8" stroke="#F0C8A0" strokeWidth="3" strokeLinecap="round" />
        {/* eyes */}
        <circle cx="21" cy="11" r="1" fill="#404040" />
        <circle cx="27" cy="11" r="1" fill="#404040" />
        {/* smile */}
        <path d="M22 15c.5 1 1.5 1.5 2 1.5s1.5-.5 2-1.5" fill="none" stroke="#D08868" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),

    /* 12. Pulmonology — lungs */
    pulmonology: (
      <svg viewBox="0 0 48 48" className={className}>
        {/* trachea */}
        <rect x="22" y="6" width="4" height="16" rx="2" fill="#70B8D8" />
        {/* left lung */}
        <path d="M22 16c-8 0-14 6-14 14 0 4 2 8 5 10 2 1 4 3 4 5" fill="#80C8E8" />
        {/* right lung */}
        <path d="M26 16c8 0 14 6 14 14 0 4-2 8-5 10-2 1-4 3-4 5" fill="#70B8D8" />
        {/* bronchi inside lungs */}
        <path d="M22 22l-6 6" fill="none" stroke="#58A0C8" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M26 22l6 6" fill="none" stroke="#58A0C8" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),

    /* 13. Endocrinology — thyroid */
    endocrinology: (
      <svg viewBox="0 0 48 48" className={className}>
        {/* trachea */}
        <rect x="22" y="6" width="4" height="10" rx="2" fill="#D0A868" />
        {/* thyroid butterfly shape */}
        <path d="M24 16c-2 0-4 2-4 6 0 4 3 8 4 10 1-2 4-6 4-10 0-4-2-6-4-6z" fill="#E8B870" />
        {/* left lobe */}
        <path d="M20 16c-4 0-8 4-8 8s4 6 8 8" fill="#E8B870" />
        {/* right lobe */}
        <path d="M28 16c4 0 8 4 8 8s-4 6-8 8" fill="#D8A858" />
        {/* isthmus connection */}
        <path d="M20 20h8" fill="none" stroke="#C89848" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),

    /* 14. Nephrology — two kidneys */
    nephrology: (
      <svg viewBox="0 0 48 48" className={className}>
        {/* left kidney */}
        <path d="M14 14c-6 0-10 5-10 12s4 10 8 12" fill="#C04858" />
        <path d="M14 14c2 3 3 8 4 14" fill="#D86070" />
        {/* right kidney */}
        <path d="M34 14c6 0 10 5 10 12s-4 10-8 12" fill="#A83848" />
        <path d="M34 14c-2 3-3 8-4 14" fill="#C05060" />
        {/* connecting vessels */}
        <path d="M18 20h12" stroke="#883040" strokeWidth="2" strokeLinecap="round" />
        <path d="M18 26h12" stroke="#883040" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),

    /* 15. Neurosurgery — brain + crosshair */
    neurosurgery: (
      <svg viewBox="0 0 48 48" className={className}>
        {/* brain */}
        <path d="M24 8C17 8 12 13 12 20c0 3 1 6 3 8 1 1 1.5 2 1.5 3.5v3c0 1 .8 1.5 1.5 1.5h12c.7 0 1.5-.5 1.5-1.5v-3c0-1.5.5-2.5 1.5-3.5 2-2 3-5 3-8C36 13 31 8 24 8z" fill="#F0A8B0" />
        <path d="M24 8v34" fill="none" stroke="#D88898" strokeWidth="1" strokeLinecap="round" />
        {/* surgical crosshair target */}
        <circle cx="24" cy="20" r="5" fill="none" stroke="#E84040" strokeWidth="2" />
        <line x1="24" y1="13" x2="24" y2="27" stroke="#E84040" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="17" y1="20" x2="31" y2="20" stroke="#E84040" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),

    /* 16. Rheumatology — joint with inflammation */
    rheumatology: (
      <svg viewBox="0 0 48 48" className={className}>
        {/* upper bone */}
        <rect x="19" y="4" width="10" height="14" rx="5" fill="#F0E8D8" />
        {/* lower bone */}
        <rect x="19" y="30" width="10" height="14" rx="5" fill="#F0E8D8" />
        {/* joint area */}
        <ellipse cx="24" cy="24" rx="10" ry="7" fill="#E8DCC8" />
        {/* inflammation points (red spots) */}
        <circle cx="20" cy="22" r="2.5" fill="#E85050" opacity="0.6" />
        <circle cx="28" cy="26" r="2.5" fill="#E85050" opacity="0.6" />
        <circle cx="24" cy="20" r="1.5" fill="#E86060" opacity="0.4" />
      </svg>
    ),

    /* 17. Ophthalmology — eye */
    ophthalmology: (
      <svg viewBox="0 0 48 48" className={className}>
        {/* eye white */}
        <path d="M4 24s8-14 20-14 20 14 20 14-8 14-20 14S4 24 4 24z" fill="#F8F8F8" />
        {/* iris */}
        <circle cx="24" cy="24" r="9" fill="#4A90D9" />
        {/* pupil */}
        <circle cx="24" cy="24" r="5" fill="#1A1A2E" />
        {/* light reflection */}
        <circle cx="21" cy="21" r="1.5" fill="#FFF" />
        {/* eyelid lines */}
        <path d="M4 24c4-8 12-14 20-14" fill="none" stroke="#C8B8A0" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M4 24c4 8 12 14 20 14" fill="none" stroke="#C8B8A0" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),

    /* 18. Surgical Gastroenterology — stomach + scalpel */
    "surgical-gastroenterology": (
      <svg viewBox="0 0 48 48" className={className}>
        {/* stomach */}
        <path d="M20 12c-8 1-14 7-14 16s4 10 8 12c2 1 3 3 3 5" fill="#F0C090" />
        <path d="M20 12c0 0 2 4 4 8 2-4 4-8 4-8 8-1 14 5 14 16s-4 10-8 12c-2 1-3 3-3 5" fill="#E8B080" />
        <path d="M14 24c4 1 8 1 12 0" fill="none" stroke="#D89868" strokeWidth="1.5" strokeLinecap="round" />
        {/* scalpel overlay */}
        <path d="M36 8l-6 8" stroke="#888898" strokeWidth="3" strokeLinecap="round" />
        <path d="M30 16l-2 3" stroke="#888898" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),

    /* 19. Infectious Disease — virus */
    "infectious-disease": (
      <svg viewBox="0 0 48 48" className={className}>
        {/* virus body */}
        <circle cx="24" cy="24" r="10" fill="#60A850" />
        <circle cx="24" cy="24" r="5" fill="#488838" />
        {/* surface proteins (spikes) */}
        <circle cx="24" cy="10" r="2.5" fill="#60A850" />
        <circle cx="24" cy="38" r="2.5" fill="#60A850" />
        <circle cx="10" cy="24" r="2.5" fill="#60A850" />
        <circle cx="38" cy="24" r="2.5" fill="#60A850" />
        <circle cx="14" cy="14" r="2" fill="#60A850" />
        <circle cx="34" cy="34" r="2" fill="#60A850" />
        <circle cx="14" cy="34" r="2" fill="#60A850" />
        <circle cx="34" cy="14" r="2" fill="#60A850" />
        {/* spike stems */}
        <line x1="24" y1="12" x2="24" y2="14" stroke="#60A850" strokeWidth="2" strokeLinecap="round" />
        <line x1="24" y1="34" x2="24" y2="36" stroke="#60A850" strokeWidth="2" strokeLinecap="round" />
        <line x1="12" y1="24" x2="14" y2="24" stroke="#60A850" strokeWidth="2" strokeLinecap="round" />
        <line x1="34" y1="24" x2="36" y2="24" stroke="#60A850" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),

    /* 20. General & Laparoscopic Surgery — scalpel */
    "general-laparoscopic-surgery": (
      <svg viewBox="0 0 48 48" className={className}>
        {/* scalpel blade */}
        <path d="M8 8l24 24" stroke="#9098A8" strokeWidth="4" strokeLinecap="round" />
        <path d="M32 32l4 4" stroke="#9098A8" strokeWidth="3" strokeLinecap="round" />
        {/* blade tip */}
        <path d="M6 6l4 2-2 4" fill="#B0B8C8" stroke="#9098A8" strokeWidth="1.5" strokeLinejoin="round" />
        {/* handle grip lines */}
        <path d="M14 14l2 2" stroke="#606878" strokeWidth="2" strokeLinecap="round" />
        <path d="M17 17l2 2" stroke="#606878" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 20l2 2" stroke="#606878" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),

    /* 21. Psychology — brain with thought bubbles */
    psychology: (
      <svg viewBox="0 0 48 48" className={className}>
        {/* brain */}
        <path d="M24 10C18 10 14 14 14 20c0 2.5 1 5 2.5 7 1 1 1.5 2 1.5 3v2.5c0 .8.7 1.5 1.5 1.5h12c.8 0 1.5-.7 1.5-1.5V30c0-1 .5-2 1.5-3 1.5-2 2.5-4.5 2.5-7C34 14 30 10 24 10z" fill="#88B8E0" />
        {/* midline */}
        <path d="M24 10v25" fill="none" stroke="#6898C8" strokeWidth="1" strokeLinecap="round" />
        {/* thought bubbles */}
        <circle cx="14" cy="38" r="2" fill="#88B8E0" opacity="0.6" />
        <circle cx="10" cy="42" r="2.5" fill="#88B8E0" opacity="0.4" />
        <circle cx="6" cy="46" r="1.5" fill="#88B8E0" opacity="0.2" />
      </svg>
    ),

    /* 22. Medical Oncology — cancer ribbon */
    "medical-oncology": (
      <svg viewBox="0 0 48 48" className={className}>
        {/* awareness ribbon */}
        <path d="M16 18l8-10 8 10" fill="none" stroke="#E88898" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M16 18c-2 4-4 8-4 12 0 4 4 6 8 4l4-4" fill="none" stroke="#E88898" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M32 18c2 4 4 8 4 12 0 4-4 6-8 4l-4-4" fill="none" stroke="#D06878" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {/* medical cross inside */}
        <path d="M22 28h4" stroke="#FFF" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 26v4" stroke="#FFF" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),

    /* 23. Diabetology — glucometer */
    diabetology: (
      <svg viewBox="0 0 48 48" className={className}>
        {/* meter body */}
        <rect x="14" y="10" width="20" height="28" rx="4" fill="#5088C8" />
        <rect x="14" y="10" width="10" height="28" rx="4" fill="#4078B8" />
        {/* screen */}
        <rect x="18" y="14" width="12" height="10" rx="2" fill="#C8E8D8" />
        {/* glucose reading */}
        <text x="24" y="22" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#2A6838">120</text>
        {/* test strip slot */}
        <rect x="21" y="38" width="6" height="4" rx="1" fill="#F0C8A0" />
        {/* test strip */}
        <rect x="22" y="42" width="4" height="4" fill="#E8B888" />
      </svg>
    ),

    /* 24. Dentist — tooth */
    dentist: (
      <svg viewBox="0 0 48 48" className={className}>
        {/* tooth crown */}
        <path d="M16 8c-6 0-10 4-10 10 0 4 2 8 4 12 1 2 2 5 2 8 0 1.5 1.5 2.5 3 1.5 1-.7 2.5-3 3-5 .5-1.5 1.5-2 3-2s2.5.5 3 2c.5 2 2 4.3 3 5 1.5 1 3 .5 3-1.5 0-3 1-6 2-8 2-4 4-8 4-12 0-6-4-10-10-10" fill="#F0F0E8" />
        {/* root left */}
        <path d="M18 32c0 3-1 6-2 9" fill="none" stroke="#E0D8C8" strokeWidth="2" strokeLinecap="round" />
        {/* root right */}
        <path d="M30 32c0 3 1 6 2 9" fill="none" stroke="#E0D8C8" strokeWidth="2" strokeLinecap="round" />
        {/* gum line */}
        <path d="M14 20c3 0 6 1 10 1s7-1 10-1" fill="none" stroke="#E8B0B0" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  };

  return icons[specialtyKey] || (
    <svg viewBox="0 0 48 48" className={className}>
      <circle cx="24" cy="24" r="18" fill="#E8E8F0" />
      <circle cx="24" cy="20" r="6" fill="#B0B8C8" />
      <rect x="14" y="30" width="20" height="10" rx="4" fill="#B0B8C8" />
    </svg>
  );
}

/* ─── Doctor Card ─── */
function DoctorCard({ doctor, onClick }: { doctor: any; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left rounded-xl border border-border/60 bg-card p-4 transition-all duration-300 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary/70 overflow-hidden">
          {doctor.profilePhoto ? (
            <img src={doctor.profilePhoto} alt={doctor.name} className="size-full object-cover" />
          ) : (
            <User className="size-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
            {doctor.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{doctor.qualification || ""}</p>
          {doctor.experience && (
            <p className="text-xs text-muted-foreground">{doctor.experience} experience</p>
          )}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs font-semibold text-primary">₹{doctor.consultationFee}</span>
            {doctor.clinicName && (
              <span className="text-[10px] text-muted-foreground truncate">at {doctor.clinicName}</span>
            )}
          </div>
          {doctor.city && (
            <div className="flex items-center gap-1 mt-1">
              <MapPin className="size-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">{doctor.city}</span>
            </div>
          )}
        </div>
        <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0 mt-1" />
      </div>
    </button>
  );
}

/* ─── Helper: format date as YYYY-MM-DD ─── */
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ─── Main Component ─── */
export default function DoctorAppointment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeSpecialty = searchParams.get("specialty") || "";
  const activeView = searchParams.get("view") || "specialties"; // "specialties" or "doctors"

  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedDate, setSelectedDate] = useState(toDateStr(today));
  const [location, setLocation] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [doctorSearch, setDoctorSearch] = useState("");

  const doctors = useQuery(api.doctors.listDoctors, {
    specialty: activeView === "doctors" ? activeSpecialty : undefined,
    search: doctorSearch || undefined,
  });

  const handleSpecialtyClick = (key: string) => {
    navigate(`/doctor-appointment?specialty=${encodeURIComponent(key)}&view=doctors`);
    setDoctorSearch("");
  };

  const handleDoctorClick = (doctorId: string) => {
    navigate(`/doctors/${doctorId}`);
  };

  const handleBackToSpecialties = () => {
    navigate("/doctor-appointment");
    setDoctorSearch("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!selectedSpecialty) newErrors.specialty = "Please select a speciality";
    if (!selectedDate) newErrors.date = "Please select a date";
    if (!location.trim()) newErrors.location = "Please enter a location or pincode";
    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) {
      navigate(
        `/doctor-appointment?specialty=${encodeURIComponent(selectedSpecialty)}&view=doctors`
      );
    }
  };

  // ── Doctor List View ──
  if (activeView === "doctors" && activeSpecialty) {
    const specialtyLabel = SPECIALTIES.find((s) => s.key === activeSpecialty)?.label || activeSpecialty;
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
          <button
            onClick={handleBackToSpecialties}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6 cursor-pointer"
          >
            <ArrowLeft className="size-4" />
            Back to Specialties
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground">{specialtyLabel}</h2>
              <p className="text-sm text-muted-foreground">
                {doctors?.length ?? 0} doctor(s) available
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search doctors..."
                value={doctorSearch}
                onChange={(e) => setDoctorSearch(e.target.value)}
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-border/60 bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {doctors === undefined ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : doctors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Stethoscope className="size-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">No doctors available in this specialty yet.</h3>
              <p className="text-sm text-muted-foreground mt-1">Check back later or try another specialty.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {doctors.map((doctor) => (
                <DoctorCard
                  key={doctor._id}
                  doctor={doctor}
                  onClick={() => handleDoctorClick(doctor._id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Specialties Grid + Form View (default) ──
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8 cursor-pointer"
        >
          <ArrowLeft className="size-4" />
          Back to Home
        </button>

        {/* Browse by Specialties */}
        <section>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1">
            Browse by Specialties
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Choose a speciality to find the right doctor
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {SPECIALTIES.map((spec) => (
              <button
                key={spec.key}
                type="button"
                onClick={() => handleSpecialtyClick(spec.key)}
                className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-3.5 text-left transition-all duration-300 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 cursor-pointer"
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/80 border border-border/30 group-hover:bg-white group-hover:shadow-sm transition-all duration-300 overflow-hidden">
                  <SpecialtyIcon specialtyKey={spec.key} className="size-8" />
                </div>
                <span className="text-xs sm:text-sm font-medium text-foreground group-hover:text-primary transition-colors leading-tight line-clamp-2">
                  {spec.label}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Find a Doctor in 3 Easy Steps */}
        <section className="mt-14">
          <div className="rounded-2xl bg-muted/40 border border-border/50 p-6 sm:p-8">
            <h2 className="text-lg sm:text-xl font-bold text-foreground mb-6">
              Find a Doctor in 3 easy steps
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Select Speciality<span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <select
                    value={selectedSpecialty}
                    onChange={(e) => {
                      setSelectedSpecialty(e.target.value);
                      if (errors.specialty) setErrors((prev) => { const n = { ...prev }; delete n.specialty; return n; });
                    }}
                    className={`w-full h-11 pl-9 pr-9 rounded-lg border bg-card text-sm text-foreground appearance-none cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.specialty ? "border-red-400" : "border-border/60"}`}
                  >
                    <option value="">Enter Speciality</option>
                    {SPECIALTIES.map((spec) => (
                      <option key={spec.key} value={spec.key}>{spec.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                </div>
                {errors.specialty && <p className="mt-1 text-xs text-red-500">{errors.specialty}</p>}
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Select Date<span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="date"
                    value={selectedDate}
                    min={toDateStr(today)}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      if (errors.date) setErrors((prev) => { const n = { ...prev }; delete n.date; return n; });
                    }}
                    className={`w-full h-11 pl-9 pr-3 rounded-lg border bg-card text-sm text-foreground cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.date ? "border-red-400" : "border-border/60"}`}
                  />
                </div>
                {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date}</p>}
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Preferred Location/Pincode<span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => {
                      setLocation(e.target.value);
                      if (errors.location) setErrors((prev) => { const n = { ...prev }; delete n.location; return n; });
                    }}
                    placeholder="Search location"
                    className={`w-full h-11 pl-9 pr-3 rounded-lg border bg-card text-sm text-foreground placeholder-muted-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.location ? "border-red-400" : "border-border/60"}`}
                  />
                </div>
                {errors.location && <p className="mt-1 text-xs text-red-500">{errors.location}</p>}
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="h-11 px-8 rounded-lg gradient-primary text-white text-sm font-semibold hover:opacity-90 transition-all flex items-center gap-2 shrink-0 cursor-pointer"
                >
                  Submit
                  <ArrowRight className="size-4" />
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
