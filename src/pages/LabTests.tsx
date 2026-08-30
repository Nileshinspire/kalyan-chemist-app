import { FlaskConical, ArrowLeft, ShieldCheck, Clock, Microscope, FileText } from "lucide-react";
import { useNavigate } from "react-router";

export default function LabTests() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16">
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-8"
        >
          <ArrowLeft className="size-4" />
          Back to Home
        </button>

        <div className="text-center mb-12">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <FlaskConical className="size-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Lab Tests</h1>
          <p className="mt-3 text-muted-foreground text-lg max-w-lg mx-auto">
            Book diagnostic lab tests from the comfort of your home. Accurate results, certified labs.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {[
            { icon: ShieldCheck, title: "Certified Labs", desc: "NABL-accredited labs with quality-assured testing processes." },
            { icon: Clock, title: "Quick Results", desc: "Get your test reports within 24–48 hours of sample collection." },
            { icon: Microscope, title: "Wide Test Range", desc: "Blood tests, urine analysis, imaging, and more available." },
            { icon: FileText, title: "Digital Reports", desc: "Access and download your lab reports anytime from your account." },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-border/60 bg-card p-6 transition-all hover:shadow-md hover:border-primary/20"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-3">
                <item.icon className="size-5" />
              </div>
              <h3 className="font-semibold text-foreground">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-dashed border-border/80 bg-card/60 p-10 text-center">
          <FlaskConical className="size-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Lab test booking will be available soon. Stay tuned!
          </p>
        </div>
      </div>
    </div>
  );
}
