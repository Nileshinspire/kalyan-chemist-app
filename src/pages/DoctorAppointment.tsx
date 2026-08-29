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
  const icons: Record<string, React.ReactNode> = {
    /* General Physician — stethoscope */
    "general-physician": (
      <svg viewBox="0 0 48 48" className={className}>
        <rect x="16" y="6" width="16" height="6" rx="3" fill="#4A90D9" />
        <rect x="22" y="12" width="4" height="10" fill="#5BA0E8" />
        <circle cx="24" cy="26" r="6" fill="#4A90D9" />
        <circle cx="24" cy="26" r="3" fill="#3A7BC8" />
        <rect x="23" y="32" width="2" height="8" fill="#5BA0E8" />
        <rect x="18" y="40" width="12" height="3" rx="1.5" fill="#4A90D9" />
        <circle cx="16" cy="9" r="2" fill="#6CB0F0" />
        <circle cx="32" cy="9" r="2" fill="#6CB0F0" />
      </svg>
    ),
    /* Dermatology — skin layers */
    dermatology: (
      <svg viewBox="0 0 48 48" className={className}>
        <rect x="6" y="6" width="36" height="8" rx="4" fill="#F5C6A0" />
        <rect x="6" y="14" width="36" height="8" rx="2" fill="#E8A882" />
        <rect x="6" y="22" width="36" height="8" rx="2" fill="#D4907A" />
        <rect x="6" y="30" width="36" height="8" rx="2" fill="#C47862" />
        <circle cx="14" cy="10" r="1.5" fill="#FFF5EE" />
        <circle cx="24" cy="10" r="1" fill="#FFF5EE" />
        <circle cx="34" cy="10" r="1.5" fill="#FFF5EE" />
        <circle cx="12" cy="18" r="1" fill="#E8C0A8" />
        <circle cx="24" cy="18" r="1.5" fill="#E8C0A8" />
        <circle cx="36" cy="18" r="1" fill="#E8C0A8" />
      </svg>
    ),
    /* Obstetrics & Gynaecology — mother and baby */
    "obstetrics-gynaecology": (
      <svg viewBox="0 0 48 48" className={className}>
        <circle cx="20" cy="10" r="5" fill="#E8A0B8" />
        <path d="M14 18c0 0 0 14 6 16h0c4-2 4-12 4-16" fill="#D4809E" />
        <path d="M12 18c-2 2-4 6-4 10 0 4 2 8 6 10l8-2" fill="#E8A0B8" />
        <path d="M24 18c-1 1-1.5 4 0 6" fill="none" stroke="#C06080" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M26 24c2 2 3 6 3 9" fill="none" stroke="#D4809E" strokeWidth="2" strokeLinecap="round" />
        <path d="M32 30c1.5 1.5 2 4 1 6" fill="none" stroke="#D4809E" strokeWidth="2" strokeLinecap="round" />
        <circle cx="32" cy="26" r="3" fill="#F0C8D8" />
        <path d="M29 30c-0.5 3-1 7 0 9" fill="none" stroke="#E8A0B8" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    /* Orthopaedics — bone joint */
    orthopaedics: (
      <svg viewBox="0 0 48 48" className={className}>
        <rect x="16" y="4" width="6" height="18" rx="3" fill="#F0E8D8" />
        <rect x="26" y="4" width="6" height="18" rx="3" fill="#E8DCC8" />
        <ellipse cx="21" cy="22" rx="8" ry="4" fill="#F0E8D8" />
        <ellipse cx="21" cy="24" rx="8" ry="4" fill="#E8DCC8" />
        <rect x="14" y="26" width="6" height="18" rx="3" fill="#F0E8D8" />
        <rect x="28" y="26" width="6" height="18" rx="3" fill="#E8DCC8" />
        <ellipse cx="17" cy="24" rx="4" ry="2" fill="#D8CCA0" />
        <ellipse cx="31" cy="24" rx="4" ry="2" fill="#D8CCA0" />
      </svg>
    ),
    /* ENT — ear */
    ent: (
      <svg viewBox="0 0 48 48" className={className}>
        <path d="M30 8c8 0 12 6 12 14s-4 14-8 16c-2 1-4 2-4 4" fill="#F0C8A0" />
        <path d="M30 8c-6 0-10 6-10 14v4c0 4 2 6 5 6" fill="#E8B888" />
        <path d="M20 26c0 6 4 12 10 16" fill="#F0C8A0" />
        <path d="M24 18c2 0 4 2 4 4s-2 4-4 4" fill="#D49868" />
        <path d="M28 18c3 2 5 6 5 10" fill="none" stroke="#D49868" strokeWidth="2" strokeLinecap="round" />
        <path d="M30 8c-4 2-6 8-6 14" fill="none" stroke="#D49868" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    /* Neurology — brain */
    neurology: (
      <svg viewBox="0 0 48 48" className={className}>
        <path d="M24 6C16 6 10 12 10 20c0 4 2 8 5 10 1 1 2 2 2 4v4h14v-4c0-2 1-3 2-4 3-2 5-6 5-10C38 12 32 6 24 6z" fill="#F0A8B0" />
        <path d="M24 6v38" fill="none" stroke="#D88898" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M18 10c-4 2-7 6-8 10" fill="none" stroke="#D88898" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M30 10c4 2 7 6 8 10" fill="none" stroke="#D88898" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 22c2 2 6 3 12 3s10-1 12-3" fill="none" stroke="#D88898" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14 16c3 1 6 1.5 10 1.5s7-.5 10-1.5" fill="none" stroke="#C87888" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
    /* Cardiology — anatomical heart */
    cardiology: (
      <svg viewBox="0 0 48 48" className={className}>
        <path d="M24 42s-14-8-14-20c0-6 4-10 8-10 3 0 5 2 6 5 1-3 3-5 6-5 4 0 8 4 8 10 0 12-14 20-14 20z" fill="#E84040" />
        <path d="M24 42s-14-8-14-20c0-6 4-10 8-10 3 0 5 2 6 5" fill="#D03030" />
        <path d="M18 18l-6-6" stroke="#C02020" strokeWidth="2" strokeLinecap="round" />
        <path d="M30 18l6-6" stroke="#C02020" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 18V12" stroke="#C02020" strokeWidth="2" strokeLinecap="round" />
        <path d="M18 28l4 4 6-6" stroke="#FFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    ),
    /* Urology — kidney */
    urology: (
      <svg viewBox="0 0 48 48" className={className}>
        <path d="M16 10c-8 1-12 8-12 16 0 6 2 10 6 12 2 1 3 3 3 5" fill="#C04050" />
        <path d="M32 10c8 1 12 8 12 16 0 6-2 10-6 12-2 1-3 3-3 5" fill="#A83848" />
        <path d="M16 10c4 2 6 8 8 16 2-8 4-14 8-16" fill="#D86070" />
        <path d="M20 32c2-2 3-5 4-8 1 3 2 6 4 8" fill="#B84050" />
        <path d="M18 42h12" fill="none" stroke="#A03040" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    /* Gastroenterology — stomach */
    gastroenterology: (
      <svg viewBox="0 0 48 48" className={className}>
        <path d="M20 6v4" stroke="#E89868" strokeWidth="2" strokeLinecap="round" />
        <path d="M28 6v4" stroke="#E89868" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 10c-8 0-14 6-14 16s4 10 8 12c2 1 4 3 4 6v2" fill="#F0C090" />
        <path d="M28 10c8 0 14 6 14 16s-4 10-8 12c-2 1-4 3-4 6v2" fill="#E8B080" />
        <path d="M20 10h8" fill="none" stroke="#D89868" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14 22h20" fill="none" stroke="#D89868" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M24 38v4" stroke="#D89868" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    /* Psychiatry — brain with peaceful expression */
    psychiatry: (
      <svg viewBox="0 0 48 48" className={className}>
        <path d="M24 6C16 6 10 12 10 20c0 4 2 8 5 10 1 1 2 2 2 4v4h14v-4c0-2 1-3 2-4 3-2 5-6 5-10C38 12 32 6 24 6z" fill="#D8A8C8" />
        <path d="M18 20c2 1 5 1.5 6 1.5s4-.5 6-1.5" fill="none" stroke="#B888A8" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M16 26h16" fill="none" stroke="#B888A8" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M20 32c1 3 2 5 4 7 2-2 3-4 4-7" fill="none" stroke="#B888A8" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M20 12c-3 2-5 5-6 8" fill="none" stroke="#B888A8" strokeWidth="1" strokeLinecap="round" />
        <path d="M28 12c3 2 5 5 6 8" fill="none" stroke="#B888A8" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
    /* Paediatrics — child figure */
    paediatrics: (
      <svg viewBox="0 0 48 48" className={className}>
        <circle cx="24" cy="12" r="6" fill="#F0C8A0" />
        <path d="M18 22c0 0-1 10 6 12h0c5-2 6-12 6-12" fill="#60B8F0" />
        <path d="M14 22c-2 3-4 8-4 12 0 3 2 6 4 7" fill="#60B8F0" />
        <path d="M34 22c2 3 4 8 4 12 0 3-2 6-4 7" fill="#58A8E0" />
        <path d="M18 38l-2 6" stroke="#F0C8A0" strokeWidth="3" strokeLinecap="round" />
        <path d="M30 38l2 6" stroke="#F0C8A0" strokeWidth="3" strokeLinecap="round" />
        <circle cx="21" cy="11" r="1" fill="#504040" />
        <circle cx="27" cy="11" r="1" fill="#504040" />
        <path d="M22 14c0.5 1 1.5 1.5 2 1.5s1.5-.5 2-1.5" fill="none" stroke="#D08868" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
    /* Pulmonology — lungs */
    pulmonology: (
      <svg viewBox="0 0 48 48" className={className}>
        <path d="M24 6v18" stroke="#58A8D0" strokeWidth="3" strokeLinecap="round" />
        <path d="M24 6c-8 0-14 6-14 14 0 4 1 7 4 10 2 2 4 5 4 10v4" fill="#80C8E8" />
        <path d="M24 6c8 0 14 6 14 14 0 4-1 7-4 10-2 2-4 5-4 10v4" fill="#70B8D8" />
        <path d="M10 18c2 0 4 1 6 4" fill="none" stroke="#58A8D0" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M38 18c-2 0-4 1-6 4" fill="none" stroke="#58A8D0" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M18 28c2-1 4-1 6 0" fill="none" stroke="#58A8D0" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M24 28c2-1 4-1 6 0" fill="none" stroke="#58A8D0" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    /* Endocrinology — thyroid gland */
    endocrinology: (
      <svg viewBox="0 0 48 48" className={className}>
        <path d="M18 8c-4 0-8 4-8 10s2 8 4 10c1 1 2 3 2 6v2h16v-2c0-3 1-5 2-6 2-2 4-6 4-10s-4-10-8-10" fill="#E8B870" />
        <path d="M24 8v4" stroke="#D0A060" strokeWidth="2" strokeLinecap="round" />
        <path d="M18 18h12" fill="none" stroke="#D0A060" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M20 30h8" fill="none" stroke="#D0A060" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="18" cy="14" r="2" fill="#D8A858" />
        <circle cx="30" cy="14" r="2" fill="#D8A858" />
      </svg>
    ),
    /* Nephrology — paired kidneys */
    nephrology: (
      <svg viewBox="0 0 48 48" className={className}>
        <path d="M14 12c-6 0-10 6-10 14s2 8 4 10c1 1 2 2 2 4" fill="#C04858" />
        <path d="M34 12c6 0 10 6 10 14s-2 8-4 10c-1 1-2 2-2 4" fill="#A83848" />
        <path d="M14 12c4 2 6 8 8 16 2-8 4-14 8-16" fill="#D86070" />
        <path d="M18 34c1-2 2-5 3-8 1 3 2 6 3 8" fill="#B84050" />
        <path d="M16 42h16" fill="none" stroke="#A03040" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    /* Neurosurgery — brain + surgical marker */
    neurosurgery: (
      <svg viewBox="0 0 48 48" className={className}>
        <path d="M24 6C16 6 10 12 10 20c0 4 2 8 5 10 1 1 2 2 2 4v4h14v-4c0-2 1-3 2-4 3-2 5-6 5-10C38 12 32 6 24 6z" fill="#F0A8B0" />
        <path d="M24 6v38" fill="none" stroke="#D88898" strokeWidth="1" strokeLinecap="round" />
        <circle cx="24" cy="20" r="3" fill="none" stroke="#E84040" strokeWidth="2" />
        <line x1="24" y1="15" x2="24" y2="25" stroke="#E84040" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="19" y1="20" x2="29" y2="20" stroke="#E84040" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    /* Rheumatology — joint / hand bones */
    rheumatology: (
      <svg viewBox="0 0 48 48" className={className}>
        <rect x="18" y="4" width="4" height="10" rx="2" fill="#F0E8D8" />
        <rect x="26" y="4" width="4" height="10" rx="2" fill="#E8DCC8" />
        <ellipse cx="24" cy="16" rx="8" ry="5" fill="#F0E8D8" />
        <circle cx="20" cy="14" r="2" fill="#E85050" />
        <circle cx="28" cy="18" r="2" fill="#E85050" />
        <rect x="16" y="22" width="5" height="14" rx="2.5" fill="#F0E8D8" />
        <rect x="27" y="22" width="5" height="14" rx="2.5" fill="#E8DCC8" />
        <circle cx="18" cy="16" r="1.5" fill="#E86060" opacity="0.5" />
        <circle cx="30" cy="14" r="1.5" fill="#E86060" opacity="0.5" />
      </svg>
    ),
    /* Ophthalmology — eye */
    ophthalmology: (
      <svg viewBox="0 0 48 48" className={className}>
        <path d="M4 24s8-16 20-16 20 16 20 16-8 16-20 16S4 24 4 24z" fill="#F8F8F8" />
        <circle cx="24" cy="24" r="8" fill="#4A90D9" />
        <circle cx="24" cy="24" r="5" fill="#2A60A0" />
        <circle cx="24" cy="24" r="2.5" fill="#1A1A2E" />
        <circle cx="22" cy="22" r="1" fill="#FFF" />
        <path d="M4 24c4-8 10-14 20-14" fill="none" stroke="#D8C8B0" strokeWidth="1" strokeLinecap="round" />
        <path d="M4 24c4 8 10 14 20 14" fill="none" stroke="#D8C8B0" strokeWidth="1" strokeLinecap="round" />
      </svg>
    ),
    /* Surgical Gastroenterology — stomach + scalpel */
    "surgical-gastroenterology": (
      <svg viewBox="0 0 48 48" className={className}>
        <path d="M20 10c-8 0-14 6-14 16s4 10 8 12c2 1 4 3 4 6v2" fill="#F0C090" />
        <path d="M28 10c8 0 14 6 14 16s-4 10-8 12c-2 1-4 3-4 6v2" fill="#E8B080" />
        <path d="M20 10h8" fill="none" stroke="#D89868" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M14 22h20" fill="none" stroke="#D89868" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="34" y="6" width="3" height="14" rx="1.5" fill="#808898" />
        <path d="M35.5 20l-4 6" stroke="#808898" strokeWidth="2" strokeLinecap="round" />
        <circle cx="30" cy="30" r="3" fill="none" stroke="#60A880" strokeWidth="1.5" />
        <path d="M28 28l4 4" stroke="#60A880" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    /* Infectious Disease — virus */
    "infectious-disease": (
      <svg viewBox="0 0 48 48" className={className}>
        <circle cx="24" cy="24" r="8" fill="#80C870" />
        <circle cx="24" cy="24" r="4" fill="#60A850" />
        <circle cx="22" cy="22" r="1" fill="#408830" />
        <circle cx="26" cy="22" r="1" fill="#408830" />
        <circle cx="24" cy="26" r="1" fill="#408830" />
        <path d="M24 8v5" stroke="#80C870" strokeWidth="3" strokeLinecap="round" />
        <path d="M24 35v5" stroke="#80C870" strokeWidth="3" strokeLinecap="round" />
        <path d="M8 24h5" stroke="#80C870" strokeWidth="3" strokeLinecap="round" />
        <path d="M35 24h5" stroke="#80C870" strokeWidth="3" strokeLinecap="round" />
        <path d="M12 12l4 4" stroke="#80C870" strokeWidth="3" strokeLinecap="round" />
        <path d="M32 32l4 4" stroke="#80C870" strokeWidth="3" strokeLinecap="round" />
        <path d="M12 36l4-4" stroke="#80C870" strokeWidth="3" strokeLinecap="round" />
        <path d="M32 16l4-4" stroke="#80C870" strokeWidth="3" strokeLinecap="round" />
      </svg>
    ),
    /* General & Laparoscopic Surgery — scalpel */
    "general-laparoscopic-surgery": (
      <svg viewBox="0 0 48 48" className={className}>
        <path d="M8 40l4-4" stroke="#888898" strokeWidth="3" strokeLinecap="round" />
        <rect x="10" y="16" width="4" height="22" rx="2" fill="#888898" />
        <path d="M12 16L36 4" stroke="#888898" strokeWidth="3" strokeLinecap="round" />
        <path d="M36 4l6 2-2 6" fill="#A0A8B8" stroke="#888898" strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx="10" cy="42" r="2" fill="#E84040" />
        <path d="M22 10l4 4" stroke="#60A880" strokeWidth="2" strokeLinecap="round" />
        <path d="M18 14l4 4" stroke="#60A880" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    /* Psychology — brain with thought */
    psychology: (
      <svg viewBox="0 0 48 48" className={className}>
        <path d="M24 6C16 6 10 12 10 20c0 4 2 8 5 10 1 1 2 2 2 4v4h14v-4c0-2 1-3 2-4 3-2 5-6 5-10C38 12 32 6 24 6z" fill="#B8D0E8" />
        <path d="M24 6v38" fill="none" stroke="#98B8D8" strokeWidth="1" strokeLinecap="round" />
        <path d="M16 12c-2 3-3 6-3 8" fill="none" stroke="#98B8D8" strokeWidth="1" strokeLinecap="round" />
        <path d="M32 12c2 3 3 6 3 8" fill="none" stroke="#98B8D8" strokeWidth="1" strokeLinecap="round" />
        <circle cx="18" cy="36" r="2" fill="#98B8D8" opacity="0.6" />
        <circle cx="24" cy="40" r="1.5" fill="#98B8D8" opacity="0.4" />
        <circle cx="28" cy="44" r="1" fill="#98B8D8" opacity="0.2" />
      </svg>
    ),
    /* Medical Oncology — ribbon + cross */
    "medical-oncology": (
      <svg viewBox="0 0 48 48" className={className}>
        <path d="M24 6l-10 20h6l-6 14 16-22h-6l8-12z" fill="#E88898" />
        <path d="M24 6l-10 20h6" fill="#D06878" />
        <path d="M22 24h4" stroke="#FFF" strokeWidth="2" strokeLinecap="round" />
        <path d="M24 22v4" stroke="#FFF" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    /* Diabetology — blood drop */
    diabetology: (
      <svg viewBox="0 0 48 48" className={className}>
        <path d="M24 6c-6 8-10 14-10 20a10 10 0 0 0 20 0c0-6-4-12-10-20z" fill="#E84040" />
        <path d="M24 6c-6 8-10 14-10 20a10 10 0 0 0 10 10" fill="#D03030" />
        <path d="M18 30c0 3.3 2.7 6 6 6" fill="none" stroke="#F08080" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M24 24v4" stroke="#FFF" strokeWidth="2" strokeLinecap="round" />
        <path d="M22 28h4" stroke="#FFF" strokeWidth="2" strokeLinecap="round" />
        <circle cx="20" cy="22" r="1.5" fill="#F08080" opacity="0.5" />
      </svg>
    ),
    /* Dentist — tooth */
    dentist: (
      <svg viewBox="0 0 48 48" className={className}>
        <path d="M16 6c-6 0-10 4-10 10 0 4 2 8 4 12 2 4 2 8 2 12 0 2 2 3 4 2 1-.5 3-3 4-6 1-2 2-3 4-3s3 1 4 3c1 3 3 5.5 4 6 2 1 4 0 4-2 0-4 0-8 2-12 2-4 4-8 4-12 0-6-4-10-10-10" fill="#F8F8F0" />
        <path d="M16 6c-6 0-10 4-10 10 0 4 2 8 4 12 2 4 2 8 2 12 0 2 2 3 4 2" fill="#E8E8E0" />
        <path d="M16 12h16" fill="none" stroke="#D8D0C0" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="20" cy="9" r="0.8" fill="#F0F0E8" />
        <circle cx="28" cy="9" r="0.8" fill="#F0F0E8" />
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
