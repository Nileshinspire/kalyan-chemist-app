import { ArrowLeft, Calendar, Clock, User, Phone, Mail, MapPin, ShieldCheck, Stethoscope } from "lucide-react";
import { useNavigate } from "react-router";

export default function DoctorAppointment() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 sm:py-12">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-8"
        >
          <ArrowLeft className="size-4" />
          Back to Home
        </button>

        <div className="max-w-2xl mx-auto text-center">
          <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Stethoscope className="size-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Doctor Appointment</h1>
          <p className="mt-3 text-muted-foreground">
            Book appointments with trusted healthcare professionals near you.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 text-left">
            {[
              { icon: Calendar, title: "Easy Scheduling", desc: "Pick a date and time that works for you." },
              { icon: User, title: "Verified Doctors", desc: "Connect with licensed and verified professionals." },
              { icon: Clock, title: "Quick Confirmation", desc: "Get instant confirmation of your booking." },
              { icon: ShieldCheck, title: "Secure & Private", desc: "Your health data is always protected." },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="size-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-8 text-sm text-muted-foreground">
            This feature will be available soon. Stay tuned!
          </p>
        </div>
      </div>
    </div>
  );
}
