import { useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  MapPin,
  Search,
  ChevronDown,
} from "lucide-react";

/* ─── Specialty Data ─── */
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

/* ─── Specialty Icons ─── */
function SpecialtyIcon({ specialtyKey, className = "" }: { specialtyKey: string; className?: string }) {
  const s = "none";
  const sw = 1.5;
  const cap = "round";
  const join = "round";

  const icons: Record<string, React.ReactNode> = {
    "general-physician": (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <path d="M4.8 2.6a1.5 1.5 0 0 1 2.1 0l.5.6a1 1 0 0 0 .7.3h.6a1.5 1.5 0 0 1 1.5 1.5v.6a1 1 0 0 0 .3.7l.6.5a1.5 1.5 0 0 1 0 2.1l-.6.5a1 1 0 0 0-.3.7v.6a1.5 1.5 0 0 1-1.5 1.5h-.6a1 1 0 0 0-.7.3l-.5.6a1.5 1.5 0 0 1-2.1 0l-.5-.6a1 1 0 0 0-.7-.3h-.6A1.5 1.5 0 0 1 3 10.7v-.6a1 1 0 0 0-.3-.7l-.6-.5a1.5 1.5 0 0 1 0-2.1l.6-.5A1 1 0 0 0 3 6.1v-.6A1.5 1.5 0 0 1 4.5 4h.6a1 1 0 0 0 .7-.3l.5-.6" />
        <path d="M12 12h7m-3.5-3.5V16" />
        <circle cx="15.5" cy="14" r="4.5" />
      </svg>
    ),
    dermatology: (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <circle cx="12" cy="10" r="7" />
        <path d="M9 10c0-1.7 1.3-3 3-3s3 1.3 3 3" />
        <path d="M12 17v4" />
        <path d="M10 21h4" />
        <path d="M8 6.5c1-1 2.5-1.5 4-1.5s3 .5 4 1.5" />
      </svg>
    ),
    "obstetrics-gynaecology": (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <circle cx="12" cy="6" r="3" />
        <path d="M12 9v3" />
        <path d="M9 12c-2 0-4 1.5-4 4v1h14v-1c0-2.5-2-4-4-4" />
        <path d="M15 15c1.5 0 3 1 3 2.5V19H9v-1.5c0-1.5 1.5-2.5 3-2.5" />
      </svg>
    ),
    orthopaedics: (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <path d="M7 4v16" />
        <path d="M17 4v16" />
        <path d="M5 8h4" />
        <path d="M15 8h4" />
        <path d="M5 16h4" />
        <path d="M15 16h4" />
        <circle cx="9" cy="12" r="0.5" fill="currentColor" />
        <circle cx="15" cy="12" r="0.5" fill="currentColor" />
      </svg>
    ),
    ent: (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <path d="M16 12a4 4 0 0 1-8 0" />
        <path d="M12 16v2" />
        <path d="M10 18h4" />
        <path d="M8 8c0-2.2 1.8-4 4-4s4 1.8 4 4c0 1.5-.8 2.8-2 3.5L12 12l-2-.5C8.8 10.8 8 9.5 8 8" />
      </svg>
    ),
    neurology: (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <path d="M12 2C8 2 5 5 5 8.5c0 2 .8 3.5 2 4.5.5.4.8 1 .8 1.5v2a2 2 0 0 0 2 2h2.4a2 2 0 0 0 2-2v-2c0-.5.3-1.1.8-1.5 1.2-1 2-2.5 2-4.5C19 5 16 2 12 2" />
        <path d="M10 19h4" />
        <path d="M12 2v5" />
        <path d="M9 5l3 3 3-3" />
      </svg>
    ),
    cardiology: (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <path d="M12 21C12 21 4 15 4 9.5C4 6.5 6.5 4 9 4c1.5 0 2.5.8 3 2 .5-1.2 1.5-2 3-2 2.5 0 5 2.5 5 5.5C20 15 12 21 12 21z" />
        <path d="M8 10h2.5l1.5 2 2.5-4L16 10h2" />
      </svg>
    ),
    urology: (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <path d="M12 4c-2 0-4 2-4 5 0 2 1 3 2 4l2 3h0l2-3c1-1 2-2 2-4 0-3-2-5-4-5" />
        <path d="M9 17h6" />
        <path d="M12 17v3" />
        <path d="M10 20h4" />
      </svg>
    ),
    gastroenterology: (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <path d="M8 4c0 0 1-1 4-1s4 1 4 1" />
        <path d="M7 6c0 3 1 5 2 6.5C10 14 11 16 11 18v3" />
        <path d="M17 6c0 3-1 5-2 6.5-1 1.5-2 3.5-2 5.5v3" />
        <path d="M9 21h6" />
        <path d="M10 14c2 0 4 0 5-1.5" />
      </svg>
    ),
    psychiatry: (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <circle cx="12" cy="10" r="6" />
        <path d="M12 16v4" />
        <path d="M9 20h6" />
        <path d="M10 9c0-1.1.9-2 2-2s2 .9 2 2c0 1-.8 1.5-1.5 2h-1c-.7-.5-1.5-1-1.5-2" />
        <circle cx="12" cy="13" r="0.5" fill="currentColor" />
      </svg>
    ),
    paediatrics: (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <circle cx="12" cy="7" r="4" />
        <path d="M12 11v2" />
        <path d="M9 15c-1.5 0-3 1-3 3v1h12v-1c0-2-1.5-3-3-3" />
        <path d="M15 5c1 0 2 .5 2.5 1.5" />
        <path d="M9 5c-1 0-2 .5-2.5 1.5" />
      </svg>
    ),
    pulmonology: (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <path d="M12 3v12" />
        <path d="M12 15c-3 0-5 2-5 5s2 1 4 0c1-.5 1-1 1-1" />
        <path d="M12 15c3 0 5 2 5 5s-2 1-4 0c-1-.5-1-1-1-1" />
        <path d="M12 8c-2 0-3.5 1.5-3.5 3.5S10 15 12 15" />
        <path d="M12 8c2 0 3.5 1.5 3.5 3.5S14 15 12 15" />
      </svg>
    ),
    endocrinology: (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <path d="M12 4c-1 0-2 .5-2 2v4c0 1.5 1 2 2 2s2-.5 2-2V6c0-1.5-1-2-2-2" />
        <path d="M12 12v4" />
        <path d="M8 18h8" />
        <path d="M10 16v2" />
        <path d="M14 16v2" />
        <path d="M12 12c-2 0-4 1-4 3h8c0-2-2-3-4-3" />
      </svg>
    ),
    nephrology: (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <path d="M8 6c-2 0-4 2-4 5s1 4 3 5l1 1c1 1 2 3 2 5h2c0-2 1-4 2-5l1-1c2-1 3-3 3-5s-2-5-4-5" />
        <path d="M12 4v3" />
        <path d="M10 5h4" />
      </svg>
    ),
    neurosurgery: (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <path d="M12 2C8.5 2 5.5 5 5.5 8c0 1.8.8 3.2 1.8 4.2.4.4.7 1 .7 1.5v2.8a2 2 0 0 0 2 2h3.4a2 2 0 0 0 2-2v-2.8c0-.5.3-1.1.7-1.5 1-1 1.8-2.4 1.8-4.2C18.5 5 15.5 2 12 2" />
        <path d="M15 18h3" />
        <path d="M16.5 16.5v3" />
        <path d="M10 19h4" />
      </svg>
    ),
    rheumatology: (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <path d="M12 4c-3 0-5 2-5 5 0 2 1 3 2 4l3 4 3-4c1-1 2-2 2-4 0-3-2-5-5-5" />
        <path d="M12 9v3" />
        <path d="M10 11h4" />
        <path d="M8 20h8" />
      </svg>
    ),
    ophthalmology: (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12" />
        <circle cx="12" cy="12" r="3" />
        <circle cx="12" cy="12" r="1" fill="currentColor" />
      </svg>
    ),
    "surgical-gastroenterology": (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <path d="M8 4c0 0 1-1 4-1s4 1 4 1" />
        <path d="M7 6c0 3 1 5 2 6.5C10 14 11 16 11 18v3" />
        <path d="M17 6c0 3-1 5-2 6.5-1 1.5-2 3.5-2 5.5v3" />
        <path d="M9 21h6" />
        <path d="M18 4l-4 8" />
        <path d="M17 4h1v1" />
      </svg>
    ),
    "infectious-disease": (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v4" />
        <path d="M12 18v4" />
        <path d="M2 12h4" />
        <path d="M18 12h4" />
        <path d="M4.9 4.9l2.8 2.8" />
        <path d="M16.3 16.3l2.8 2.8" />
        <path d="M4.9 19.1l2.8-2.8" />
        <path d="M16.3 7.7l2.8-2.8" />
      </svg>
    ),
    "general-laparoscopic-surgery": (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <path d="M14.5 3.5l6 6-10 10H4.5v-6l10-10" />
        <path d="M12 5.5l6 6" />
        <path d="M4.5 19.5h15" />
      </svg>
    ),
    psychology: (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <circle cx="12" cy="8" r="5" />
        <path d="M12 13v3" />
        <path d="M9 17h6" />
        <path d="M10 8c0-1 .8-1.8 1.8-1.8h.4c1 0 1.8.8 1.8 1.8 0 .8-.6 1.3-1.2 1.5h-.8c-.6-.2-1.2-.7-1.2-1.5" />
        <circle cx="12" cy="10" r="0.4" fill="currentColor" />
      </svg>
    ),
    "medical-oncology": (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <path d="M12 3l2.5 5.5L20 9.5l-4 4 1 5.5L12 16.5 7 19l1-5.5-4-4 5.5-1z" />
        <path d="M12 10v3" />
        <path d="M10.5 11.5h3" />
      </svg>
    ),
    diabetology: (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <path d="M12 3c-1.5 0-3 1.5-3 4 0 2 1 3.5 3 6 2-2.5 3-4 3-6 0-2.5-1.5-4-3-4" />
        <path d="M12 17v4" />
        <path d="M10 21h4" />
        <path d="M9 13l-2 2" />
        <path d="M15 13l2 2" />
      </svg>
    ),
    dentist: (
      <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
        <path d="M8 3c-2 0-3.5 1-3.5 3 0 2 1 3.5 1.5 5.5.5 2.5.5 4.5 0 7-.3 1.5 1 2.5 2 1.5.8-.8 1.5-2.5 2-4.5.3-1 .7-1.5 1-1.5s.7.5 1 1.5c.5 2 1.2 3.7 2 4.5 1 1 2.3 0 2-1.5-.5-2.5-.5-4.5 0-7 .5-2 1.5-3.5 1.5-5.5 0-2-1.5-3-3.5-3" />
      </svg>
    ),
  };

  return icons[specialtyKey] || (
    <svg viewBox="0 0 24 24" fill={s} stroke="currentColor" strokeWidth={sw} strokeLinecap={cap} strokeLinejoin={join} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4l2 2" />
    </svg>
  );
}

/* ─── Helper: format date as YYYY-MM-DD ─── */
function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/* ─── Main Component ─── */
export default function DoctorAppointment() {
  const navigate = useNavigate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [selectedSpecialty, setSelectedSpecialty] = useState("");
  const [selectedDate, setSelectedDate] = useState(toDateStr(today));
  const [location, setLocation] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const handleSpecialtyClick = (key: string) => {
    navigate(`/doctors?specialty=${encodeURIComponent(key)}`);
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
        `/doctors?specialty=${encodeURIComponent(selectedSpecialty)}&date=${selectedDate}&location=${encodeURIComponent(location.trim())}`
      );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
        {/* Back */}
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8 cursor-pointer"
        >
          <ArrowLeft className="size-4" />
          Back to Home
        </button>

        {/* ═══════════════════════════════════════════════════════
            SECTION 1 — Browse by Specialties
            ═══════════════════════════════════════════════════════ */}
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

        {/* ═══════════════════════════════════════════════════════
            SECTION 2 — Find a Doctor in 3 Easy Steps
            ═══════════════════════════════════════════════════════ */}
        <section className="mt-14">
          <div className="rounded-2xl bg-muted/40 border border-border/50 p-6 sm:p-8">
            <h2 className="text-lg sm:text-xl font-bold text-foreground mb-6">
              Find a Doctor in 3 easy steps
            </h2>

            <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-4">
              {/* Field 1 — Select Speciality */}
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
                      <option key={spec.key} value={spec.key}>
                        {spec.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                </div>
                {errors.specialty && (
                  <p className="mt-1 text-xs text-red-500">{errors.specialty}</p>
                )}
              </div>

              {/* Field 2 — Select Date */}
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
                {errors.date && (
                  <p className="mt-1 text-xs text-red-500">{errors.date}</p>
                )}
              </div>

              {/* Field 3 — Preferred Location / Pincode */}
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
                {errors.location && (
                  <p className="mt-1 text-xs text-red-500">{errors.location}</p>
                )}
              </div>

              {/* Submit */}
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
