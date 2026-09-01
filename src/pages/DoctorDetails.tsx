import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import {
  MapPin,
  Clock,
  Calendar,
  IndianRupee,
  Languages,
  BadgeCheck,
  Loader2,
  User,
  Stethoscope,
  CalendarCheck,
} from "lucide-react";

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DoctorDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [consultType, setConsultType] = useState("");
  const [notes, setNotes] = useState("");
  const [bookingDialogOpen, setBookingDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [booking, setBooking] = useState(false);

  const doctor = useQuery(api.doctors.getDoctor, id ? { doctorId: id as any } : "skip");
  const slots = useQuery(
    api.doctors.getAvailableSlots,
    id ? { doctorId: id as any, date: toDateStr(selectedDate) } : "skip"
  );

  const bookAppointment = useMutation(api.appointments.bookAppointment);

  if (doctor === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <Stethoscope className="size-12 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-bold">Doctor not found</h2>
        <p className="text-sm text-muted-foreground mt-2">The doctor you're looking for doesn't exist.</p>
        <Button className="mt-4" onClick={() => navigate("/doctor-appointment")}>
          Back to Find Doctors
        </Button>
      </div>
    );
  }

  const handleBookAppointment = () => {
    if (!selectedSlot) {
      toast.error("Please select a time slot");
      return;
    }
    setConfirmDialogOpen(true);
  };

  const confirmBooking = async () => {
    setBooking(true);
    try {
      await bookAppointment({
        doctorId: id as any,
        appointmentDate: toDateStr(selectedDate),
        appointmentTime: selectedSlot,
        consultationType: consultType || undefined,
        notes: notes || undefined,
      });
      toast.success("Appointment booked successfully!");
      setConfirmDialogOpen(false);
      setBookingDialogOpen(false);
      setSelectedSlot("");
      setNotes("");
      setConsultType("");
    } catch (error: any) {
      toast.error(error.message || "Failed to book appointment");
    } finally {
      setBooking(false);
    }
  };

  const selectDateStr = toDateStr(selectedDate);

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-12">
        <Breadcrumb items={[
          { label: "Find Doctors", href: "/doctor-appointment" },
          { label: doctor.name },
        ]} />

        {/* Doctor Profile Card */}
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex flex-col sm:flex-row">
              {/* Photo */}
              <div className="sm:w-48 h-48 sm:h-auto bg-gradient-to-br from-primary/8 to-primary/3 flex items-center justify-center shrink-0">
                {doctor.profilePhoto ? (
                  <img src={doctor.profilePhoto} alt={doctor.name} className="w-full h-full object-cover" />
                ) : (
                  <User className="size-16 text-primary/30" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-foreground">{doctor.name}</h1>
                    <p className="text-sm text-primary font-medium mt-0.5">{doctor.qualification || ""}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-700 shrink-0">
                    <BadgeCheck className="size-3 mr-1" /> Verified
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-3 mt-4 text-sm text-muted-foreground">
                  {doctor.experience && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5" /> {doctor.experience}
                    </span>
                  )}
                  {doctor.city && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5" /> {doctor.city}{doctor.state ? `, ${doctor.state}` : ""}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <IndianRupee className="size-3.5" /> ₹{doctor.consultationFee}
                  </span>
                </div>

                {doctor.aboutDoctor && (
                  <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                    {doctor.aboutDoctor}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 mt-4">
                  {doctor.languagesSpoken?.map((lang) => (
                    <Badge key={lang} variant="secondary" className="text-xs">
                      <Languages className="size-3 mr-1" /> {lang}
                    </Badge>
                  ))}
                </div>

                {doctor.clinicName && (
                  <div className="mt-4 p-3 rounded-lg bg-muted/40 border border-border/40">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Clinic</p>
                    <p className="text-sm font-medium">{doctor.clinicName}</p>
                    {doctor.clinicAddress && (
                      <p className="text-xs text-muted-foreground mt-0.5">{doctor.clinicAddress}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Consultation Details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          {doctor.consultationType && doctor.consultationType.length > 0 && (
            <Card className="border-border/60">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Consultation Types</p>
                <div className="flex flex-wrap gap-1.5">
                  {doctor.consultationType.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {doctor.availableDays && doctor.availableDays.length > 0 && (
            <Card className="border-border/60">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Available Days</p>
                <div className="flex flex-wrap gap-1.5">
                  {doctor.availableDays.map((d) => (
                    <Badge key={d} variant="secondary" className="text-xs capitalize">{d}</Badge>
                  ))}
                </div>
                {doctor.availableTimeFrom && doctor.availableTimeTo && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {doctor.availableTimeFrom} — {doctor.availableTimeTo}
                    {doctor.appointmentDuration && ` · ${doctor.appointmentDuration} min slots`}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Book Appointment Section */}
        <Card className="border-border/60 mt-6">
          <CardContent className="p-5 sm:p-6">
            <h2 className="text-lg font-bold text-foreground mb-4">Book Appointment</h2>

            {/* Date Picker */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Select Date
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <input
                  type="date"
                  value={selectDateStr}
                  min={toDateStr(today)}
                  onChange={(e) => {
                    const d = new Date(e.target.value + "T00:00:00");
                    setSelectedDate(d);
                    setSelectedSlot("");
                  }}
                  className="w-full h-11 pl-9 pr-3 rounded-lg border border-border/60 bg-card text-sm text-foreground cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* Time Slots */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-foreground mb-2">
                Available Time Slots
              </label>
              {slots === undefined ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Loading slots...</span>
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No slots available for this date.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={!slot.available}
                      onClick={() => setSelectedSlot(slot.time)}
                      className={`px-3 py-2 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                        !slot.available
                          ? "border-border/30 text-muted-foreground/40 cursor-not-allowed bg-muted/30"
                          : selectedSlot === slot.time
                          ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30"
                          : "border-border/60 text-foreground hover:border-primary/30 hover:bg-accent/40"
                      }`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Consultation Type */}
            {doctor.consultationType && doctor.consultationType.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Consultation Type
                </label>
                <div className="flex flex-wrap gap-2">
                  {doctor.consultationType.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setConsultType(consultType === t ? "" : t)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                        consultType === t
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/60 text-muted-foreground hover:border-primary/30"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any specific concerns or symptoms..."
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-border/60 bg-card text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <Button
              onClick={handleBookAppointment}
              disabled={!selectedSlot}
              className="w-full sm:w-auto gradient-primary text-white h-11 px-8"
            >
              <CalendarCheck className="size-4 mr-2" />
              Book Appointment — ₹{doctor.consultationFee}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Appointment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Doctor</span>
              <span className="font-medium">{doctor.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Specialty</span>
              <span className="font-medium">{doctor.specialty}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Date</span>
              <span className="font-medium">{toDateStr(selectedDate)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Time</span>
              <span className="font-medium">{selectedSlot}</span>
            </div>
            {consultType && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{consultType}</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t pt-3">
              <span className="text-muted-foreground">Fee</span>
              <span className="font-bold text-primary">₹{doctor.consultationFee}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>Cancel</Button>
            <Button onClick={confirmBooking} disabled={booking} className="gradient-primary text-white">
              {booking ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Confirm Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
