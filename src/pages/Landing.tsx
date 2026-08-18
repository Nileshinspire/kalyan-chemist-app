import { motion, type Variants } from "framer-motion";
import {
  ShieldCheck,
  Truck,
  Clock3,
  Pill,
  HeartPulse,
  Baby,
  Stethoscope,
  Leaf,
  Brain,
  ChevronRight,
  Phone,
  MapPin,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: "easeOut" },
  },
};

const stagger: Variants = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const categories = [
  { name: "Pain & Relief", icon: Pill, description: "Analgesics, anti-inflammatory, and muscle relaxants" },
  { name: "Heart & Cardio", icon: HeartPulse, description: "Cardiac care, blood pressure, and cholesterol management" },
  { name: "Diabetes Care", icon: Stethoscope, description: "Insulin, oral hypoglycaemics, and glucose monitoring" },
  { name: "Baby & Mother", icon: Baby, description: "Infant nutrition, prenatal vitamins, and maternal care" },
  { name: "Vitamins & Supplements", icon: Leaf, description: "Daily wellness, immunity boosters, and nutrition" },
  { name: "Mind & Neurology", icon: Brain, description: "Neurological care, sleep aids, and cognitive health" },
];

const features = [
  {
    icon: ShieldCheck,
    title: "Genuine Medicines",
    description: "Every product sourced directly from licensed manufacturers and verified distributors.",
  },
  {
    icon: Truck,
    title: "Prompt Delivery",
    description: "Orders dispatched within hours and delivered to your doorstep with care.",
  },
  {
    icon: Clock3,
    title: "Always Open Online",
    description: "Browse and order anytime — our platform is available around the clock.",
  },
  {
    icon: Pill,
    title: "Expert Guidance",
    description: "Our pharmacists are available to answer your questions about dosage and interactions.",
  },
];

const testimonials = [
  {
    name: "Priya Sharma",
    location: "Mumbai",
    quote: "Kalyan Chemist has made managing my family's monthly prescriptions effortless. The medicines always arrive on time and in perfect condition.",
  },
  {
    name: "Rajesh Patel",
    location: "Ahmedabad",
    quote: "I was sceptical about ordering medicines online, but the quality and service here are unmatched. Highly recommended for anyone with regular medication needs.",
  },
  {
    name: "Ananya Gupta",
    location: "Delhi",
    quote: "The website is easy to navigate, prices are fair, and the delivery is always prompt. It has become my go-to pharmacy.",
  },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Navigation ── */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm tracking-tight">
              KC
            </div>
            <div className="leading-tight">
              <span className="text-lg font-bold tracking-tight text-foreground">Kalyan Chemist</span>
              <span className="hidden sm:block text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                Trusted Pharmacy
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="hidden sm:inline-flex text-sm" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button className="text-sm font-semibold" onClick={() => navigate("/auth")}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <motion.section
        initial="hidden"
        animate="visible"
        variants={stagger}
        className="relative overflow-hidden bg-gradient-to-b from-primary/[0.04] to-transparent"
      >
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-20 sm:pt-28 lg:pt-32">
          <div className="max-w-3xl">
            <motion.div variants={fadeUp} className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1 text-xs font-medium text-primary">
              <ShieldCheck className="size-3.5" />
              Licensed and Verified Online Pharmacy
            </motion.div>
            <motion.h1
              variants={fadeUp}
              className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
            >
              Your Health, <br className="hidden sm:block" />
              <span className="text-primary">Delivered with Care</span>
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
            >
              Order genuine medicines, wellness products, and healthcare essentials
              from a pharmacy you can trust. Fast delivery, fair prices, and
              pharmacist-backed guidance — all from one place.
            </motion.p>
            <motion.div variants={fadeUp} className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="text-sm font-semibold px-7" onClick={() => navigate("/auth")}>
                Start Shopping
                <ChevronRight className="ml-1.5 size-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-sm font-semibold px-7"
                onClick={() => navigate("/auth")}
              >
                Browse Medicines
              </Button>
            </motion.div>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-40 top-10 h-[500px] w-[500px] rounded-full bg-primary/[0.06] blur-3xl" />
      </motion.section>

      {/* ── Trust bar ── */}
      <section className="border-y border-border/60 bg-card">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-6 py-10 sm:grid-cols-4">
          {[
            { value: "10,000+", label: "Orders Delivered" },
            { value: "5,000+", label: "Products Available" },
            { value: "100%", label: "Genuine Medicines" },
            { value: "4.9 ★", label: "Customer Rating" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-bold text-primary">{stat.value}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Categories ── */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={stagger}
        className="mx-auto max-w-7xl px-6 py-20"
      >
        <motion.div variants={fadeUp} className="max-w-xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Browse by Category
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            Find exactly what you need across our carefully organised medicine
            and wellness categories.
          </p>
        </motion.div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <motion.div
              key={cat.name}
              variants={fadeUp}
              className="group flex items-start gap-4 rounded-xl border border-border/70 bg-card p-6 transition-all hover:border-primary/30 hover:shadow-md"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <cat.icon className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{cat.name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {cat.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── How It Works ── */}
      <section className="border-y border-border/60 bg-card/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="max-w-xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Three straightforward steps from browsing to your doorstep.
            </p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Search & Select",
                description:
                  "Browse our catalogue or search for specific medicines. Each product includes dosage information, manufacturer details, and pricing.",
              },
              {
                step: "02",
                title: "Place Your Order",
                description:
                  "Add items to your cart, confirm your delivery address, and check out. We accept cash on delivery for your convenience.",
              },
              {
                step: "03",
                title: "Receive at Your Door",
                description:
                  "Your order is packed securely and delivered promptly. Track your order status from your personal dashboard.",
              },
            ].map((item) => (
              <div key={item.step} className="relative">
                <span className="mb-4 inline-block text-4xl font-extrabold text-primary/20">
                  {item.step}
                </span>
                <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={stagger}
        className="mx-auto max-w-7xl px-6 py-20"
      >
        <motion.div variants={fadeUp} className="max-w-xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Why Kalyan Chemist
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed">
            We are committed to making quality healthcare accessible, reliable,
            and convenient for every household.
          </p>
        </motion.div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {features.map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              className="flex items-start gap-4 rounded-xl border border-border/70 bg-card p-6"
            >
              <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── Testimonials ── */}
      <section className="border-y border-border/60 bg-card/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="max-w-xl">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              What Our Customers Say
            </h2>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              Trusted by thousands of families across India for their everyday
              healthcare needs.
            </p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-6"
              >
                <div>
                  <div className="mb-3 flex gap-0.5 text-primary">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="size-4 fill-primary" />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>
                <div className="mt-6 border-t border-border/60 pt-4">
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.location}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="relative overflow-hidden rounded-2xl bg-primary px-8 py-16 text-center sm:px-16">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="relative">
            <h2 className="text-3xl font-bold text-primary-foreground sm:text-4xl">
              Ready to Take Charge of Your Health?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-primary-foreground/80">
              Create your account in under a minute and start ordering genuine
              medicines delivered straight to your door.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button
                size="lg"
                variant="secondary"
                className="font-semibold px-8"
                onClick={() => navigate("/auth")}
              >
                Create Free Account
                <ChevronRight className="ml-1.5 size-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/60 bg-card">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
                  KC
                </div>
                <span className="text-base font-bold tracking-tight">Kalyan Chemist</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Your trusted neighbourhood pharmacy, now available online. Genuine
                medicines, delivered with care.
              </p>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-semibold text-foreground">Quick Links</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="cursor-pointer hover:text-primary transition-colors" onClick={() => navigate("/")}>Home</li>
                <li className="cursor-pointer hover:text-primary transition-colors" onClick={() => navigate("/auth")}>Sign In</li>
                <li className="cursor-pointer hover:text-primary transition-colors" onClick={() => navigate("/auth")}>Create Account</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-semibold text-foreground">Categories</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Pain & Relief</li>
                <li>Heart & Cardio</li>
                <li>Diabetes Care</li>
                <li>Vitamins & Supplements</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-3 text-sm font-semibold text-foreground">Contact</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Phone className="size-4 shrink-0" />
                  +91 98765 43210
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="size-4 shrink-0 mt-0.5" />
                  <span>123 Health Street,<br />Mumbai, Maharashtra 400001</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-border/60">
          <div className="mx-auto max-w-7xl px-6 py-5 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Kalyan Chemist. All rights reserved. Licensed Pharmacy.
          </div>
        </div>
      </footer>
    </div>
  );
}
