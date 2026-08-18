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
  Sparkles,
  ArrowRight,
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

const fadeUpDelay: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: "easeOut", delay: 0.15 },
  },
};

const stagger: Variants = {
  visible: { transition: { staggerChildren: 0.08 } },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: "easeOut" },
  },
};

const categories = [
  { name: "Pain & Relief", icon: Pill, description: "Analgesics, anti-inflammatory, and muscle relaxants", color: "from-orange-500/10 to-red-500/10", iconColor: "text-orange-600" },
  { name: "Heart & Cardio", icon: HeartPulse, description: "Cardiac care, blood pressure, and cholesterol management", color: "from-rose-500/10 to-pink-500/10", iconColor: "text-rose-600" },
  { name: "Diabetes Care", icon: Stethoscope, description: "Insulin, oral hypoglycaemics, and glucose monitoring", color: "from-blue-500/10 to-cyan-500/10", iconColor: "text-blue-600" },
  { name: "Baby & Mother", icon: Baby, description: "Infant nutrition, prenatal vitamins, and maternal care", color: "from-violet-500/10 to-purple-500/10", iconColor: "text-violet-600" },
  { name: "Vitamins & Supplements", icon: Leaf, description: "Daily wellness, immunity boosters, and nutrition", color: "from-emerald-500/10 to-green-500/10", iconColor: "text-emerald-600" },
  { name: "Mind & Neurology", icon: Brain, description: "Neurological care, sleep aids, and cognitive health", color: "from-teal-500/10 to-cyan-500/10", iconColor: "text-teal-600" },
];

const features = [
  { icon: ShieldCheck, title: "Genuine Medicines", description: "Every product sourced directly from licensed manufacturers and verified distributors." },
  { icon: Truck, title: "Prompt Delivery", description: "Orders dispatched within hours and delivered to your doorstep with care." },
  { icon: Clock3, title: "Always Open Online", description: "Browse and order anytime — our platform is available around the clock." },
  { icon: Pill, title: "Expert Guidance", description: "Our pharmacists are available to answer your questions about dosage and interactions." },
];

const testimonials = [
  { name: "Priya Sharma", location: "Mumbai", rating: 5, quote: "Kalyan Chemist has made managing my family's monthly prescriptions effortless. The medicines always arrive on time and in perfect condition." },
  { name: "Rajesh Patel", location: "Ahmedabad", rating: 5, quote: "I was sceptical about ordering medicines online, but the quality and service here are unmatched. Highly recommended for anyone with regular medication needs." },
  { name: "Ananya Gupta", location: "Delhi", rating: 5, quote: "The website is easy to navigate, prices are fair, and the delivery is always prompt. It has become my go-to pharmacy." },
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* ── Navigation ── */}
      <header className="sticky top-0 z-50 glass-strong border-b border-border/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl gradient-primary text-white font-bold text-sm tracking-tight shadow-glow">
              KC
            </div>
            <div className="leading-tight">
              <span className="text-lg font-bold tracking-tight text-foreground">Kalyan Chemist</span>
              <span className="hidden sm:block text-[11px] font-medium uppercase tracking-widest text-primary/70">
                Trusted Pharmacy
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" className="hidden sm:inline-flex text-sm font-medium" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button className="text-sm font-semibold px-5 gradient-primary text-white shadow-glow hover:shadow-card-hover transition-shadow" onClick={() => navigate("/auth")}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Background gradient orbs */}
        <div className="absolute inset-0 gradient-primary opacity-[0.03]" />
        <div className="pointer-events-none absolute -right-32 top-0 h-[600px] w-[600px] rounded-full bg-primary/[0.08] blur-[100px] animate-float" />
        <div className="pointer-events-none absolute -left-32 top-40 h-[400px] w-[400px] rounded-full bg-primary/[0.05] blur-[80px] animate-float-delayed" />
        <div className="pointer-events-none absolute right-1/4 bottom-0 h-[300px] w-[300px] rounded-full bg-emerald-500/[0.04] blur-[60px]" />

        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 sm:pt-28 lg:pt-32"
        >
          <div className="max-w-3xl">
            <motion.div variants={fadeUp} className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary backdrop-blur-sm">
              <Sparkles className="size-3.5" />
              Licensed and Verified Online Pharmacy
            </motion.div>
            <motion.h1
              variants={fadeUpDelay}
              className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl"
            >
              Your Health,
              <br className="hidden sm:block" />
              <span className="text-gradient">Delivered with Care</span>
            </motion.h1>
            <motion.p
              variants={fadeUpDelay}
              className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground"
            >
              Order genuine medicines, wellness products, and healthcare essentials
              from a pharmacy you can trust. Fast delivery, fair prices, and
              pharmacist-backed guidance — all from one place.
            </motion.p>
            <motion.div variants={fadeUpDelay} className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="text-sm font-semibold px-8 gradient-primary text-white shadow-glow hover:shadow-card-hover transition-all hover:scale-[1.02] active:scale-[0.98]" onClick={() => navigate("/auth")}>
                Start Shopping
                <ArrowRight className="ml-1.5 size-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-sm font-semibold px-8 border-border/60 hover:border-primary/30 hover:bg-primary/[0.03] transition-all"
                onClick={() => navigate("/auth")}
              >
                Browse Medicines
              </Button>
            </motion.div>

            {/* Trust indicators */}
            <motion.div variants={fadeUpDelay} className="mt-10 flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="flex -space-x-1">
                  {["bg-primary/20", "bg-primary/30", "bg-primary/40"].map((bg, i) => (
                    <div key={i} className={`size-5 rounded-full ${bg} border-2 border-background`} />
                  ))}
                </div>
                <span className="ml-1 font-medium">10,000+ happy customers</span>
              </div>
              <span className="hidden sm:inline text-border">|</span>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" />
                ))}
                <span className="ml-1 font-medium">4.9/5 rating</span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ── Trust bar ── */}
      <section className="border-y border-border/50 bg-card/60 backdrop-blur-sm">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-6 py-10 sm:grid-cols-4">
          {[
            { value: "10,000+", label: "Orders Delivered" },
            { value: "5,000+", label: "Products Available" },
            { value: "100%", label: "Genuine Medicines" },
            { value: "4.9 ★", label: "Customer Rating" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.5 }}
              className="text-center"
            >
              <p className="text-2xl font-extrabold text-gradient">{stat.value}</p>
              <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{stat.label}</p>
            </motion.div>
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
              variants={scaleIn}
              className="group relative overflow-hidden rounded-xl border border-border/70 bg-card p-6 transition-all duration-300 hover:shadow-card-hover hover:border-primary/20 cursor-pointer"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${cat.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              <div className="relative flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-white group-hover:scale-110 group-hover:shadow-glow">
                  <cat.icon className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">{cat.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {cat.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── How It Works ── */}
      <section className="border-y border-border/50 bg-gradient-to-b from-card/50 to-background">
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
                description: "Browse our catalogue or search for specific medicines. Each product includes dosage information, manufacturer details, and pricing.",
              },
              {
                step: "02",
                title: "Place Your Order",
                description: "Add items to your cart, confirm your delivery address, and check out. We accept cash on delivery for your convenience.",
              },
              {
                step: "03",
                title: "Receive at Your Door",
                description: "Your order is packed securely and delivered promptly. Track your order status from your personal dashboard.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.5 }}
                className="relative"
              >
                <div className="mb-4 inline-flex size-12 items-center justify-center rounded-xl gradient-primary text-white text-sm font-bold shadow-glow">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </motion.div>
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
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {features.map((f) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              className="group flex items-start gap-4 rounded-xl border border-border/70 bg-card p-6 transition-all duration-300 hover:shadow-card-hover hover:border-primary/20"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-white group-hover:shadow-glow">
                <f.icon className="size-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── Testimonials ── */}
      <section className="border-y border-border/50 bg-gradient-to-b from-card/50 to-background">
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
          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-6 transition-all duration-300 hover:shadow-card-hover hover:border-primary/20"
              >
                <div>
                  <div className="mb-3 flex gap-0.5 text-amber-400">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star key={i} className="size-4 fill-amber-400" />
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
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="relative overflow-hidden rounded-2xl gradient-hero px-8 py-16 text-center sm:px-16 shadow-glow">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-white/5 blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Ready to Take Charge of Your Health?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/75">
              Create your account in under a minute and start ordering genuine
              medicines delivered straight to your door.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button
                size="lg"
                variant="secondary"
                className="font-semibold px-8 bg-white text-primary hover:bg-white/90 shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                onClick={() => navigate("/auth")}
              >
                Create Free Account
                <ArrowRight className="ml-1.5 size-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/50 bg-card/60 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg gradient-primary text-white font-bold text-xs shadow-glow">
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
                  <Phone className="size-4 shrink-0 text-primary" />
                  +91 98765 43210
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="size-4 shrink-0 mt-0.5 text-primary" />
                  <span>123 Health Street,<br />Mumbai, Maharashtra 400001</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-border/50">
          <div className="mx-auto max-w-7xl px-6 py-5 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Kalyan Chemist. All rights reserved. Licensed Pharmacy.
          </div>
        </div>
      </footer>
    </div>
  );
}
