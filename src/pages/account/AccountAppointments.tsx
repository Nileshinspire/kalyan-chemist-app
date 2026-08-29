import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Calendar, Stethoscope } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function AccountAppointments() {
  const appointments = useQuery(api.appointments.myAppointments);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground">My Appointments</h2>
        <p className="text-sm text-muted-foreground">View your doctor appointment history</p>
      </div>

      {appointments === undefined ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : appointments.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
              <Stethoscope className="size-6 text-primary" />
            </div>
            <h3 className="text-base font-semibold">No appointments yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Book your first doctor appointment to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {appointments.map((apt) => (
            <Card key={apt._id} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                      <Calendar className="size-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{apt.doctorName}</p>
                      <p className="text-xs text-muted-foreground">{apt.specialty}</p>
                      {apt.clinicName && (
                        <p className="text-xs text-muted-foreground">{apt.clinicName}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:text-right">
                    <div>
                      <p className="text-sm font-medium">{apt.appointmentDate}</p>
                      <p className="text-xs text-muted-foreground">{apt.appointmentTime}</p>
                    </div>
                    <div>
                      <Badge className={`text-xs ${STATUS_COLORS[apt.status] || ""}`}>
                        {apt.status}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">₹{apt.consultationFee}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
