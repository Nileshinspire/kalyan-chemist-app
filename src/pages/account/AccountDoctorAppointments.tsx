import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Stethoscope,
  Calendar,
  Clock,
  MapPin,
  User,
  CheckCircle2,
  Circle,
  XCircle,
  CreditCard,
  ChevronRight,
  Video,
  Building2,
  Award,
  Briefcase,
} from "lucide-react";

/* ── Status step definitions ── */
const APPOINTMENT_STEPS = [
  { key: "pending", label: "Booked" },
  { key: "confirmed", label: "Confirmed" },
  { key: "completed", label: "Completed" },
];

const CANCELLED_STATUSES = ["cancelled"];

function getStatusIndex(status: string): number {
  return APPOINTMENT_STEPS.findIndex((s) => s.key === status);
}

/* ── Status badge ── */
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    confirmed: "bg-blue-50 text-blue-700 border-blue-200",
    completed: "bg-green-50 text-green-700 border-green-200",
    cancelled: "bg-red-50 text-red-700 border-red-200",
  };
  const labels: Record<string, string> = {
    pending: "Pending",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${colors[status] || colors.pending}`}>
      {labels[status] || status}
    </span>
  );
}

/* ── Status Tracker ── */
function StatusTracker({ status }: { status: string }) {
  if (CANCELLED_STATUSES.includes(status)) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-4">
        <XCircle className="size-5 text-red-500 shrink-0" />
        <div>
          <p className="text-sm font-bold text-red-700">Appointment Cancelled</p>
          <p className="text-xs text-red-600">This appointment has been cancelled.</p>
        </div>
      </div>
    );
  }

  const currentIdx = getStatusIndex(status);

  return (
    <div className="space-y-0">
      {APPOINTMENT_STEPS.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture = idx > currentIdx;

        return (
          <div key={step.key} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              {isCompleted ? (
                <CheckCircle2 className="size-5 text-[#0a3d2e] shrink-0" />
              ) : isCurrent ? (
                <div className="size-5 rounded-full border-2 border-[#0a3d2e] bg-[#0a3d2e]/10 flex items-center justify-center shrink-0">
                  <div className="size-2 rounded-full bg-[#0a3d2e]" />
                </div>
              ) : (
                <Circle className="size-5 text-gray-300 shrink-0" />
              )}
              {idx < APPOINTMENT_STEPS.length - 1 && (
                <div className={`w-0.5 h-6 ${isCompleted ? "bg-[#0a3d2e]" : "bg-gray-200"}`} />
              )}
            </div>
            <div className={`pb-4 ${isFuture ? "text-gray-400" : "text-foreground"}`}>
              <p className={`text-sm ${isCurrent ? "font-bold" : isCompleted ? "font-medium" : "font-normal"}`}>
                {step.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══════════════════════════════════════════════════════ */
/* ── MAIN PAGE ── */
/* ══════════════════════════════════════════════════════ */

export default function AccountDoctorAppointments() {
  const navigate = useNavigate();
  const appointments = useQuery(api.appointments.myAppointments);
  const [selectedApt, setSelectedApt] = useState<any>(null);

  if (appointments === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">My Doctor Appointments</h1>
          <p className="text-sm text-muted-foreground mt-1">View and manage your doctor appointments</p>
        </div>
        <div className="rounded-xl border border-dashed border-border/60 bg-card p-12 text-center">
          <Stethoscope className="mx-auto size-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-1">No Doctor Appointments Yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Your doctor appointments will appear here.</p>
          <button onClick={() => navigate("/doctor-appointment")} className="rounded-xl bg-[#0a3d2e] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#082f23] transition-colors">
            Find a Doctor
          </button>
        </div>
      </div>
    );
  }

  const now = new Date().toISOString().split("T")[0];
  const upcoming = appointments.filter((a) => a.appointmentDate >= now && !CANCELLED_STATUSES.includes(a.status));
  const past = appointments.filter((a) => a.appointmentDate < now || CANCELLED_STATUSES.includes(a.status));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground">My Doctor Appointments</h1>
        <p className="text-sm text-muted-foreground mt-1">View and manage your doctor appointments</p>
      </div>

      {/* ── Detail View ── */}
      {selectedApt && (
        <AppointmentDetail appointment={selectedApt} onBack={() => setSelectedApt(null)} />
      )}

      {/* ── Upcoming ── */}
      {!selectedApt && upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-3">Upcoming</h2>
          <div className="space-y-3">
            {upcoming.map((a) => (
              <AppointmentCard key={a._id} appointment={a} onClick={() => setSelectedApt(a)} />
            ))}
          </div>
        </section>
      )}

      {/* ── Past & Completed ── */}
      {!selectedApt && past.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-foreground mb-3">Past & Completed</h2>
          <div className="space-y-3">
            {past.map((a) => (
              <AppointmentCard key={a._id} appointment={a} onClick={() => setSelectedApt(a)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ── Appointment Card ── */
function AppointmentCard({ appointment, onClick }: { appointment: any; onClick: () => void }) {
  const isCancelled = CANCELLED_STATUSES.includes(String(appointment.status));
  return (
    <div
      className={`rounded-xl border bg-card p-4 transition-all hover:shadow-sm cursor-pointer ${isCancelled ? "border-red-200 opacity-75" : "border-border/60"}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Doctor avatar */}
          <div className="size-12 rounded-xl bg-primary/8 flex items-center justify-center shrink-0 overflow-hidden">
            {appointment.profilePhoto ? (
              <img src={appointment.profilePhoto as string} alt={appointment.doctorName as string} className="size-full object-cover" />
            ) : (
              <User className="size-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <h3 className="text-sm font-semibold text-foreground truncate">{appointment.doctorName as string}</h3>
              <StatusBadge status={appointment.status as string} />
            </div>
            <p className="text-xs text-muted-foreground">{appointment.specialty as string}</p>
            {appointment.clinicName && <p className="text-xs text-muted-foreground">{appointment.clinicName as string}</p>}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Calendar className="size-3" />{appointment.appointmentDate as string}</span>
              <span className="flex items-center gap-1"><Clock className="size-3" />{appointment.appointmentTime as string}</span>
              {appointment.consultationType && <span className="flex items-center gap-1">{appointment.consultationType === "video" ? <Video className="size-3" /> : <Building2 className="size-3" />}{appointment.consultationType as string}</span>}
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-foreground">₹{(Number(appointment.consultationFee)).toLocaleString("en-IN")}</p>
          <div className="flex items-center gap-1 mt-1 justify-end">
            <CreditCard className="size-3 text-muted-foreground" />
            <span className={`text-[10px] font-medium ${appointment.paymentStatus === "paid" ? "text-green-600" : "text-yellow-600"}`}>
              {appointment.paymentStatus === "paid" ? "Paid" : "Pending"}
            </span>
          </div>
          <ChevronRight className="size-4 text-muted-foreground mt-2 ml-auto" />
        </div>
      </div>
    </div>
  );
}

/* ── Appointment Detail ── */
function AppointmentDetail({ appointment, onBack }: { appointment: any; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-4" /> Back to My Appointments
      </button>

      {/* Header */}
      <div className="rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-start gap-4 mb-4">
          <div className="size-14 rounded-xl bg-primary/8 flex items-center justify-center shrink-0 overflow-hidden">
            {appointment.profilePhoto ? (
              <img src={appointment.profilePhoto as string} alt={appointment.doctorName as string} className="size-full object-cover" />
            ) : (
              <User className="size-6 text-primary" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <h2 className="text-lg font-bold text-foreground">{appointment.doctorName as string}</h2>
              <StatusBadge status={appointment.status as string} />
            </div>
            <p className="text-sm text-muted-foreground">{appointment.specialty as string}</p>
            {appointment.clinicName && <p className="text-sm text-muted-foreground">{appointment.clinicName as string}</p>}
          </div>
        </div>
        <StatusTracker status={appointment.status as string} />
      </div>

      {/* Details Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Doctor Info */}
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Doctor Information</h3>
          <div className="space-y-2 text-sm">
            {appointment.qualification && (
              <div className="flex items-center gap-2">
                <Award className="size-3.5 text-muted-foreground shrink-0" />
                <span>{appointment.qualification as string}</span>
              </div>
            )}
            {appointment.experience && (
              <div className="flex items-center gap-2">
                <Briefcase className="size-3.5 text-muted-foreground shrink-0" />
                <span>{appointment.experience as string}</span>
              </div>
            )}
            {appointment.clinicAddress && (
              <div className="flex items-start gap-2 pt-2 border-t border-border/40">
                <MapPin className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <span>{appointment.clinicAddress as string}</span>
              </div>
            )}
          </div>
        </div>

        {/* Appointment Info */}
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Appointment Details</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Date</span><span className="font-medium">{appointment.appointmentDate as string}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Time</span><span className="font-medium">{appointment.appointmentTime as string}</span></div>
            {appointment.consultationType && <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span className="font-medium capitalize">{appointment.consultationType as string}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span className="font-bold">₹{(Number(appointment.consultationFee)).toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Payment</span>
              <span className={`font-medium ${appointment.paymentStatus === "paid" ? "text-green-600" : "text-yellow-600"}`}>
                {appointment.paymentStatus === "paid" ? "Paid" : "Pending"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
