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
  const common = {
    fill: "none" as const,
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const svgProps = { ...common, viewBox: "0 0 24 24", className };

  const icons: Record<string, React.ReactNode> = {
    /* General Physician — stethoscope with person silhouette */
    "general-physician": (
      <svg {...svgProps}>
        <path d="M16 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
        <path d="M12.5 10c1.5.3 3 1.5 3 4v1c0 1.1.9 2 2 2h1" />
        <path d="M12 10c0 0-1.5-.5-3.5.5S7 14 7 16c0 2.5.9 4 2 5" />
        <path d="M14 21h-4" />
        <path d="M12 16v5" />
        <path d="M5.5 14a1.5 1.5 0 0 0-1.5 1.5v.5h2v-.5a1.5 1.5 0 0 0-1.5-1.5z" />
      </svg>
    ),
    /* Dermatology — skin cross-section layers */
    dermatology: (
      <svg {...svgProps}>
        <path d="M3 7h18" />
        <path d="M3 12h18" />
        <path d="M3 17h18" />
        <path d="M5 4c1 0 1.5 1 1.5 3" />
        <path d="M10 4c1 0 1.5 1 1.5 3" />
        <path d="M15 4c1 0 1.5 1 1.5 3" />
        <path d="M3 20c2 0 3-1 4.5-1s2.5 1 4.5 1 2.5-1 4.5-1 2.5 1 4.5 1" />
        <circle cx="7" cy="14.5" r="0.7" fill="currentColor" stroke="none" />
        <circle cx="12" cy="14.5" r="0.7" fill="currentColor" stroke="none" />
        <circle cx="17" cy="14.5" r="0.7" fill="currentColor" stroke="none" />
      </svg>
    ),
    /* Obstetrics & Gynaecology — pregnant silhouette with baby */
    "obstetrics-gynaecology": (
      <svg {...svgProps}>
        <circle cx="10" cy="4.5" r="2.5" />
        <path d="M10 7v2" />
        <path d="M7.5 9.5c-1 1-1.5 2.5-1.5 4v1.5c0 .8.7 1.5 1.5 1.5h4c.8 0 1.5-.7 1.5-1.5V13.5c0-1.5-.5-3-1.5-4" />
        <path d="M10 11.5c1.8 0 3 1 3.5 2" />
        <path d="M6 20h4" />
        <path d="M17 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
        <path d="M15.5 15c.5-1.5 1.5-2 2.5-1.5" />
      </svg>
    ),
    /* Orthopaedics — anatomical knee joint */
    orthopaedics: (
      <svg {...svgProps}>
        <path d="M9 2.5c0 2-1.5 3-1.5 5v1c0 1 1 2 2.5 2h4c1.5 0 2.5-1 2.5-2v-1c0-2-1.5-3-1.5-5" />
        <path d="M10 11.5v3.5" />
        <path d="M14 11.5v3.5" />
        <ellipse cx="12" cy="14" rx="3" ry="1.2" />
        <path d="M10 15.2v6.3" />
        <path d="M14 15.2v6.3" />
        <path d="M8.5 18h3" />
        <path d="M12.5 18h3" />
      </svg>
    ),
    /* ENT — ear with inner canal detail */
    ent: (
      <svg {...svgProps}>
        <path d="M15 4c3 0 5 2.5 5 6s-2 6-4 7.5c-1.2 1-2.5 2.5-2.5 4v1.5" />
        <path d="M15 4c-3 0-5 2.5-5 6v2c0 1.5 1 2.5 2 2.5" />
        <path d="M7 15c0 3 2 5 4 6.5" />
        <path d="M10 9c.8 0 1.5.7 1.5 1.5S10.8 12 10 12" />
        <path d="M13 10c1.5 1 2.5 3 2.5 5" />
      </svg>
    ),
    /* Neurology — anatomical brain with gyri */
    neurology: (
      <svg {...svgProps}>
        <path d="M12 3C8.5 3 6 5.5 6 8.5c0 1.5.6 2.8 1.6 3.7.4.4.6.9.6 1.4v2c0 1 .8 1.8 1.8 1.8h4c1 0 1.8-.8 1.8-1.8v-2c0-.5.2-1 .6-1.4 1-.9 1.6-2.2 1.6-3.7C18 5.5 15.5 3 12 3z" />
        <path d="M12 3v18" />
        <path d="M9 5.5c-1.5.5-3 2-3.5 3.5" />
        <path d="M15 5.5c1.5.5 3 2 3.5 3.5" />
        <path d="M8 12c1 .8 2 1 4 1s3-.2 4-1" />
      </svg>
    ),
    /* Cardiology — anatomical heart with vessels */
    cardiology: (
      <svg {...svgProps}>
        <path d="M12 21s-7-4.5-7-10c0-3 2.2-5.5 5-5.5 1.8 0 2.8 1 3.3 2" />
        <path d="M12 21s7-4.5 7-10c0-3-2.2-5.5-5-5.5-1.8 0-2.8 1-3.3 2" />
        <path d="M8.5 7.5L6 5" />
        <path d="M15.5 7.5L18 5" />
        <path d="M12 5V3" />
        <path d="M9 14l1.5 1.5L14 12" />
      </svg>
    ),
    /* Urology — kidney with ureter */
    urology: (
      <svg {...svgProps}>
        <path d="M8 5c-3.5.5-5 3-5 6.5 0 2.5 1 4 2.5 5C7 18 8 20 8 22" />
        <path d="M16 5c3.5.5 5 3 5 6.5 0 2.5-1 4-2.5 5C17 18 16 20 16 22" />
        <path d="M8 5c2 1 3 3 4 7 1-4 2-6 4-7" />
        <path d="M10 17c1-1 1-2 2-3.5 1 1.5 1 2.5 2 3.5" />
      </svg>
    ),
    /* Gastroenterology — stomach */
    gastroenterology: (
      <svg {...svgProps}>
        <path d="M9 3v2" />
        <path d="M15 3v2" />
        <path d="M9 5c-4 0-6 3-6 7s2 5 4 6c1 .5 2 1.5 2 3v1" />
        <path d="M15 5c4 0 6 3 6 7s-2 5-4 6c-1 .5-2 1.5-2 3v1" />
        <path d="M9 5h6" />
        <path d="M7 12h10" />
        <path d="M12 18v3" />
      </svg>
    ),
    /* Psychiatry — brain with calm/mind symbol */
    psychiatry: (
      <svg {...svgProps}>
        <path d="M12 3C8.5 3 6 5.5 6 8.5c0 1.5.6 2.8 1.6 3.7.4.4.6.9.6 1.4v2.4c0 1 .8 1.8 1.8 1.8h4c1 0 1.8-.8 1.8-1.8v-2.4c0-.5.2-1 .6-1.4 1-.9 1.6-2.2 1.6-3.7C18 5.5 15.5 3 12 3z" />
        <path d="M9.5 17.5c.5 1.5 1 2.5 2.5 3.5 1.5-1 2-2 2.5-3.5" />
        <path d="M8 8.5c1 .5 2.5.8 4 .8s3-.3 4-.8" />
        <path d="M10 11h4" />
      </svg>
    ),
    /* Paediatrics — small child with heart */
    paediatrics: (
      <svg {...svgProps}>
        <circle cx="12" cy="5.5" r="3" />
        <path d="M9 10c-1.5.5-2.5 2-2.5 4v1c0 .8.7 1.5 1.5 1.5h.5" />
        <path d="M15 10c1.5.5 2.5 2 2.5 4v1c0 .8-.7 1.5-1.5 1.5h-.5" />
        <path d="M12 10c-1 1.5-1.5 3-1.5 4v3.5h3V14c0-1-.5-2.5-1.5-4z" />
        <path d="M12 13.5l-.8.8a1.1 1.1 0 0 0 1.6 0l-.8-.8z" />
      </svg>
    ),
    /* Pulmonology — anatomical lungs */
    pulmonology: (
      <svg {...svgProps}>
        <path d="M12 3v12" />
        <path d="M12 3c-4 0-7 3-7 7 0 2 .5 3.5 2 5 1 .8 2 2.5 2 4.5v2" />
        <path d="M12 3c4 0 7 3 7 7 0 2-.5 3.5-2 5-1 .8-2 2.5-2 4.5v2" />
        <path d="M5 10c1 0 2 .5 3 2" />
        <path d="M19 10c-1 0-2 .5-3 2" />
        <path d="M9 15c1-.5 2-.5 3 0" />
        <path d="M12 15c1-.5 2-.5 3 0" />
      </svg>
    ),
    /* Endocrinology — thyroid butterfly gland */
    endocrinology: (
      <svg {...svgProps}>
        <path d="M9 3c-2 0-3.5 1.5-3.5 4 0 2 1 3 2 4 .5.5.5 1.5.5 2v2c0 1 .8 2 2 2h2c1.2 0 2-1 2-2v-2c0-.5 0-1.5.5-2 1-1 2-2 2-4 0-2.5-1.5-4-3.5-4" />
        <path d="M12 3v2" />
        <path d="M9 10h6" />
        <path d="M10 17h4" />
      </svg>
    ),
    /* Nephrology — kidney pair with ureters */
    nephrology: (
      <svg {...svgProps}>
        <path d="M7 6c-3 0-4.5 2.5-4.5 5.5S4 16 6 17.5c1 .8 1.5 2 1.5 3.5v1" />
        <path d="M17 6c3 0 4.5 2.5 4.5 5.5S20 16 18 17.5c-1 .8-1.5 2-1.5 3.5v1" />
        <path d="M7 6c2 .8 3 3 3 6" />
        <path d="M17 6c-2 .8-3 3-3 6" />
        <path d="M10 12c1 1.5 1 4 2 5.5" />
        <path d="M14 12c-1 1.5-1 4-2 5.5" />
        <path d="M9 22h6" />
      </svg>
    ),
    /* Neurosurgery — brain with surgical crosshair */
    neurosurgery: (
      <svg {...svgProps}>
        <path d="M12 3C8.5 3 6 5.5 6 8.5c0 1.5.6 2.8 1.6 3.7.4.4.6.9.6 1.4v2.4c0 1 .8 1.8 1.8 1.8h4c1 0 1.8-.8 1.8-1.8v-2.4c0-.5.2-1 .6-1.4 1-.9 1.6-2.2 1.6-3.7C18 5.5 15.5 3 12 3z" />
        <path d="M12 3v18" />
        <path d="M9 5.5c-1.5.5-3 2-3.5 3.5" />
        <path d="M15 5.5c1.5.5 3 2 3.5 3.5" />
        <circle cx="12" cy="10" r="1.5" />
      </svg>
    ),
    /* Rheumatology — hand joints / finger bones */
    rheumatology: (
      <svg {...svgProps}>
        <path d="M8 2v6" />
        <path d="M12 2v7" />
        <path d="M16 2v5" />
        <path d="M6 8h4v4H6z" />
        <path d="M10 9h4v4h-4z" />
        <path d="M14 7h4v5h-4z" />
        <path d="M8 12v4c0 1.5 1 3 2.5 4" />
        <path d="M12 13v3c0 1.5 1 3 2.5 4" />
        <path d="M16 12v2c0 1.5-1 3-2 4" />
        <circle cx="8" cy="5" r="0.7" fill="currentColor" stroke="none" />
        <circle cx="12" cy="5" r="0.7" fill="currentColor" stroke="none" />
        <circle cx="16" cy="4.5" r="0.7" fill="currentColor" stroke="none" />
      </svg>
    ),
    /* Ophthalmology — detailed eye with iris */
    ophthalmology: (
      <svg {...svgProps}>
        <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12z" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="2" />
        <circle cx="12" cy="12" r="0.8" fill="currentColor" stroke="none" />
        <path d="M4.5 9.5l2 1" />
        <path d="M17.5 9.5l2 1" />
        <path d="M4.5 14.5l2-1" />
        <path d="M17.5 14.5l2-1" />
      </svg>
    ),
    /* Surgical Gastroenterology — stomach with scalpel */
    "surgical-gastroenterology": (
      <svg {...svgProps}>
        <path d="M9 5c-3.5 0-5.5 2.5-5.5 6s2 4.5 4 5.5c1 .5 1.5 1.5 1.5 3v1" />
        <path d="M15 5c3.5 0 5.5 2.5 5.5 6s-2 4.5-4 5.5c-1 .5-1.5 1.5-1.5 3v1" />
        <path d="M9 5h6" />
        <path d="M7 11h10" />
        <path d="M18.5 2.5l-3 3" />
        <path d="M15.5 5.5l2-2 1.5 1.5-2 2" />
        <path d="M12 18v3" />
      </svg>
    ),
    /* Infectious Disease — virus/microorganism */
    "infectious-disease": (
      <svg {...svgProps}>
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 3v3" />
        <path d="M12 18v3" />
        <path d="M3 12h3" />
        <path d="M18 12h3" />
        <path d="M5.5 5.5l2 2" />
        <path d="M16.5 16.5l2 2" />
        <path d="M5.5 18.5l2-2" />
        <path d="M16.5 7.5l2-2" />
        <path d="M10 10.5c.5.8.5 1.7 0 2.5" />
        <path d="M14 10.5c-.5.8-.5 1.7 0 2.5" />
      </svg>
    ),
    /* General & Laparoscopic Surgery — surgical scissors + laparoscope */
    "general-laparoscopic-surgery": (
      <svg {...svgProps}>
        <path d="M4 4l5 8" />
        <path d="M4 12l5-4" />
        <circle cx="4" cy="3" r="1.5" />
        <circle cx="4" cy="13" r="1.5" />
        <path d="M20 4l-5 8" />
        <path d="M20 12l-5-4" />
        <circle cx="20" cy="3" r="1.5" />
        <circle cx="20" cy="13" r="1.5" />
        <path d="M12 7v10" />
        <circle cx="12" cy="6" r="1" />
        <path d="M10 6h4" />
      </svg>
    ),
    /* Psychology — brain with thought bubble */
    psychology: (
      <svg {...svgProps}>
        <path d="M12 3C8.5 3 6 5.5 6 8.5c0 1.5.6 2.8 1.6 3.7.4.4.6.9.6 1.4v2.4c0 1 .8 1.8 1.8 1.8h4c1 0 1.8-.8 1.8-1.8v-2.4c0-.5.2-1 .6-1.4 1-.9 1.6-2.2 1.6-3.7C18 5.5 15.5 3 12 3z" />
        <path d="M12 3v18" />
        <path d="M9 5c-1.5.5-2.5 1.5-3 3" />
        <path d="M15 5c1.5.5 2.5 1.5 3 3" />
        <circle cx="10" cy="18" r="0.7" fill="currentColor" stroke="none" />
        <circle cx="12.5" cy="19.5" r="0.5" fill="currentColor" stroke="none" />
        <circle cx="14" cy="21" r="0.3" fill="currentColor" stroke="none" />
      </svg>
    ),
    /* Medical Oncology — cancer ribbon with medical cross */
    "medical-oncology": (
      <svg {...svgProps}>
        <path d="M12 3l-5 9h3l-3 9 8-11h-3.5z" />
        <path d="M10 11h4" />
        <path d="M12 9v4" />
      </svg>
    ),
    /* Diabetology — blood drop with glucose */
    diabetology: (
      <svg {...svgProps}>
        <path d="M12 3c-3 3.5-5 6-5 9a5 5 0 0 0 10 0c0-3-2-5.5-5-9z" />
        <path d="M9 13.5c0 1.6 1.3 3 3 3s3-1.4 3-3" />
        <path d="M12 10v2.5" />
        <path d="M10.5 12h3" />
      </svg>
    ),
    /* Dentist — detailed tooth with roots */
    dentist: (
      <svg {...svgProps}>
        <path d="M8 2.5c-3 0-5 2-5 4.5 0 2 1 3.5 2 5.5.8 1.5 1 3.5.8 5.5-.1.8.5 1.5 1.2 1.2.6-.3 1.2-1.5 1.8-3 .5-1.2 1-2 1.2-2s.7.8 1.2 2c.6 1.5 1.2 2.7 1.8 3 .7.3 1.3-.4 1.2-1.2-.2-2 0-4 .8-5.5 1-2 2-3.5 2-5.5 0-2.5-2-4.5-5-4.5" />
        <path d="M8 8h8" />
      </svg>
    ),
  };

  return icons[specialtyKey] || (
    <svg {...svgProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4l2 2" />
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
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary/70 group-hover:bg-primary/15 group-hover:text-primary transition-all duration-300">
                  <SpecialtyIcon specialtyKey={spec.key} className="size-5" />
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
