import { motion, useScroll, useTransform, type Variants } from "framer-motion";
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
  Phone,
  MapPin,
  Star,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  Mail,
  Heart,
  CheckCircle,
  Zap,
  Shield,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { useRef } from "react";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

const fadeUpDelay: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 },
  },
};

const stagger: Variants = {
  visible: { transition: { staggerChildren: 0.1 } },
};

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

const categories = [
  { name: "Pain & Relief", slug: "pain-relief", icon: Pill, description: "Analgesics, anti-inflammatory, and muscle relaxants", color: "from-orange-500/15 to-red-500/15", iconColor: "text-orange-600", hoverBg: "hover:from-orange-500/20 hover:to-red-500/20" },
  { name: "Heart & Cardio", slug: "heart-cardio", icon: HeartPulse, description: "Cardiac care, blood pressure, and cholesterol management", color: "from-rose-500/15 to-pink-500/15", iconColor: "text-rose-600", hoverBg: "hover:from-rose-500/20 hover:to-pink-500/20" },
  { name: "Diabetes Care", slug: "diabetes-care", icon: Stethoscope, description: "Insulin, oral hypoglycaemics, and glucose monitoring", color: "from-blue-500/15 to-cyan-500/15", iconColor: "text-blue-600", hoverBg: "hover:from-blue-500/20 hover:to-cyan-500/20" },
  { name: "Baby & Mother", slug: "baby-mother", icon: Baby, description: "Infant nutrition, prenatal vitamins, and maternal care", color: "from-violet-500/15 to-purple-500/15", iconColor: "text-violet-600", hoverBg: "hover:from-violet-500/20 hover:to-purple-500/20" },
  { name: "Vitamins & Supplements", slug: "vitamins-supplements", icon: Leaf, description: "Daily wellness, immunity boosters, and nutrition", color: "from-emerald-500/15 to-green-500/15", iconColor: "text-emerald-600", hoverBg: "hover:from-emerald-500/20 hover:to-green-500/20" },
  { name: "Mind & Neurology", slug: "mind-neurology", icon: Brain, description: "Neurological care, sleep aids, and cognitive health", color: "from-teal-500/15 to-cyan-500/15", iconColor: "text-teal-600", hoverBg: "hover:from-teal-500/20 hover:to-cyan-500/20" },
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
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

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
            <Button className="text-sm font-semibold px-5 gradient-primary text-white shadow-glow hover:shadow-card-hover transition-all hover:scale-[1.02] active:scale-[0.98]" onClick={() => navigate("/auth")}>
              Get Started
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section ref={heroRef} className="relative overflow-hidden">
        {/* Animated background gradient orbs */}
        <div className="absolute inset-0 gradient-primary opacity-[0.03]" />
        <div className="pointer-events-none absolute -right-32 top-0 h-[700px] w-[700px] rounded-full bg-primary/[0.1] blur-[120px] animate-float" />
        <div className="pointer-events-none absolute -left-32 top-40 h-[500px] w-[500px] rounded-full bg-primary/[0.06] blur-[100px] animate-float-delayed" />
        <div className="pointer-events-none absolute right-1/4 bottom-0 h-[400px] w-[400px] rounded-full bg-emerald-500/[0.05] blur-[80px]" />

        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: "radial-gradient(circle, oklch(0.42 0.09 170) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="relative mx-auto max-w-7xl px-6 pb-24 pt-20 sm:pt-28 lg:pt-36"
        >
          <div className="max-w-3xl">
            <motion.div variants={fadeUp} className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-semibold text-primary backdrop-blur-sm">
              <Sparkles className="size-3.5" />
              Licensed and Verified Online Pharmacy
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            </motion.div>
            <motion.h1
              variants={fadeUpDelay}
              className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-7xl"
            >
              Your Health,
              <br className="hidden sm:block" />
              <span className="text-gradient">Delivered with Care</span>
            </motion.h1>
            <motion.p
              variants={fadeUpDelay}
              className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl"
            >
              Order genuine medicines, wellness products, and healthcare essentials
              from a pharmacy you can trust. Fast delivery, fair prices, and
              pharmacist-backed guidance — all from one place.
            </motion.p>
            <motion.div variants={fadeUpDelay} className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" className="text-sm font-semibold px-8 h-12 gradient-primary text-white shadow-glow hover:shadow-card-hover transition-all hover:scale-[1.02] active:scale-[0.98] rounded-xl" onClick={() => navigate("/products")}>
                Browse Medicines
                <ArrowRight className="ml-1.5 size-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="text-sm font-semibold px-8 h-12 border-border/60 hover:border-primary/30 hover:bg-primary/[0.03] transition-all rounded-xl"
                onClick={() => navigate("/auth")}
              >
                Create Account
              </Button>
            </motion.div>

            {/* Trust indicators */}
            <motion.div variants={fadeUpDelay} className="mt-12 flex flex-wrap items-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1">
                  {["bg-primary/20", "bg-primary/30", "bg-primary/40"].map((bg, i) => (
                    <div key={i} className={`size-6 rounded-full ${bg} border-2 border-background`} />
                  ))}
                </div>
                <span className="ml-1 font-medium">10,000+ happy customers</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" />
                ))}
                <span className="ml-1 font-medium">4.9/5 rating</span>
              </div>
              <div className="h-4 w-px bg-border" />
              <div className="flex items-center gap-1.5">
                <Shield className="size-3.5 text-primary" />
                <span className="font-medium">100% Genuine</span>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ── Trust bar ── */}
      <section className="border-y border-border/50 bg-card/60 backdrop-blur-sm">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-6 py-12 sm:grid-cols-4">
          {[
            { value: "10,000+", label: "Orders Delivered", icon: Truck },
            { value: "5,000+", label: "Products Available", icon: Pill },
            { value: "100%", label: "Genuine Medicines", icon: ShieldCheck },
            { value: "4.9 ★", label: "Customer Rating", icon: Star },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="text-center group"
            >
              <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                <stat.icon className="size-5" />
              </div>
              <p className="text-2xl font-extrabold text-gradient sm:text-3xl">{stat.value}</p>
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
        className="mx-auto max-w-7xl px-6 py-24"
      >
        <motion.div variants={fadeUp} className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
            <Sparkles className="size-3" />
            Browse by Category
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Find What You Need
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed text-lg">
            Find exactly what you need across our carefully organised medicine
            and wellness categories.
          </p>
        </motion.div>
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((cat) => (
            <motion.div
              key={cat.name}
              variants={scaleIn}
              className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-6 transition-all duration-500 hover:shadow-card-hover hover:border-primary/20 cursor-pointer hover:-translate-y-1"
              onClick={() => navigate(`/products?category=${cat.slug}`)}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${cat.color} ${cat.hoverBg} opacity-0 group-hover:opacity-100 transition-all duration-500`} />
              <div className="relative flex items-start gap-4">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-500 group-hover:bg-primary group-hover:text-white group-hover:scale-110 group-hover:shadow-glow">
                  <cat.icon className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors duration-300">{cat.name}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {cat.description}
                  </p>
                </div>
              </div>
              <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                <ArrowUpRight className="size-4 text-primary/60" />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── How It Works ── */}
      <section className="border-y border-border/50 bg-gradient-to-b from-card/50 to-background">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
              <Zap className="size-3" />
              Simple Process
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
              How It Works
            </h2>
            <p className="mt-3 text-muted-foreground leading-relaxed text-lg">
              Three straightforward steps from browsing to your doorstep.
            </p>
          </div>
          <div className="mt-14 grid gap-8 sm:grid-cols-3">
            {[
              {
                step: "01",
                title: "Search & Select",
                description: "Browse our catalogue or search for specific medicines. Each product includes dosage information, manufacturer details, and pricing.",
                icon: Search,
              },
              {
                step: "02",
                title: "Place Your Order",
                description: "Add items to your cart, confirm your delivery address, and check out. We accept online payments and cash on delivery.",
                icon: CheckCircle,
              },
              {
                step: "03",
                title: "Receive at Your Door",
                description: "Your order is packed securely and delivered promptly. Track your order status from your personal dashboard.",
                icon: Truck,
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="relative group"
              >
                <div className="mb-5 inline-flex size-14 items-center justify-center rounded-2xl gradient-primary text-white text-base font-bold shadow-glow group-hover:scale-110 transition-transform duration-300">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
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
        className="mx-auto max-w-7xl px-6 py-24"
      >
        <motion.div variants={fadeUp} className="max-w-xl">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
            <Shield className="size-3" />
            Why Choose Us
          </div>
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Why Kalyan Chemist
          </h2>
          <p className="mt-3 text-muted-foreground leading-relaxed text-lg">
            We are committed to making quality healthcare accessible, reliable,
            and convenient for every household.
          </p>
        </motion.div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              variants={fadeUp}
              className="group flex items-start gap-5 rounded-2xl border border-border/70 bg-card p-7 transition-all duration-500 hover:shadow-card-hover hover:border-primary/20 hover:-translate-y-0.5"
            >
              <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-all duration-500 group-hover:bg-primary group-hover:text-white group-hover:shadow-glow group-hover:scale-110">
                <f.icon className="size-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── Testimonials ── */}
      <section className="border-y border-border/50 bg-gradient-to-b from-card/50 to-background">
        <div className="mx-auto max-w-7xl px-6 py-24">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
              <Star className="size-3" />
              Testimonials
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
              What Our Customers Say
            </h2>
            <p className="mt-3 text-muted-foreground leading-relaxed text-lg">
              Trusted by thousands of families across India for their everyday
              healthcare needs.
            </p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-3">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-7 transition-all duration-500 hover:shadow-card-hover hover:border-primary/20 hover:-translate-y-0.5"
              >
                <div>
                  <div className="mb-4 flex gap-0.5 text-amber-400">
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
      <section className="mx-auto max-w-7xl px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl gradient-hero px-8 py-20 text-center sm:px-16 shadow-glow">
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-white/5 blur-3xl" />
          <div className="relative">
            <h2 className="text-3xl font-bold text-white sm:text-5xl">
              Ready to Take Charge<br className="hidden sm:block" /> of Your Health?
            </h2>
            <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-white/75 text-lg">
              Create your account in under a minute and start ordering genuine
              medicines delivered straight to your door.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Button
                size="lg"
                variant="secondary"
                className="font-semibold px-10 h-12 bg-white text-primary hover:bg-white/90 shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] rounded-xl"
                onClick={() => navigate("/auth")}
              >
                Create Free Account
                <ArrowRight className="ml-1.5 size-4" />
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="font-semibold px-10 h-12 text-white hover:bg-white/10 transition-all rounded-xl"
                onClick={() => navigate("/products")}
              >
                Browse Medicines
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/40 bg-card/60 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl gradient-primary text-white font-bold text-sm shadow-glow">
                  KC
                </div>
                <div className="leading-tight">
                  <span className="text-base font-bold tracking-tight">Kalyan Chemist</span>
                  <span className="block text-[10px] font-medium uppercase tracking-widest text-primary/60">Trusted Pharmacy</span>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Your trusted neighbourhood pharmacy, now available online. Genuine
                medicines, delivered with care to your doorstep.
              </p>
              <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock3 className="size-3" />
                <span>Mon – Sat, 8 AM – 10 PM</span>
              </div>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-bold text-foreground">Quick Links</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                {[
                  { label: "Home", to: "/" },
                  { label: "All Medicines", to: "/products" },
                  { label: "Shopping Cart", to: "/cart" },
                  { label: "Sign In", to: "/auth" },
                  { label: "Create Account", to: "/auth" },
                ].map((link) => (
                  <li key={link.label}>
                    <button
                      className="flex items-center gap-1 hover:text-primary transition-colors duration-200 group cursor-pointer"
                      onClick={() => navigate(link.to)}
                    >
                      {link.label}
                      <ArrowUpRight className="size-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-bold text-foreground">Categories</h4>
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                {[
                  { name: "Pain & Relief", slug: "pain-relief" },
                  { name: "Heart & Cardio", slug: "heart-cardio" },
                  { name: "Diabetes Care", slug: "diabetes-care" },
                  { name: "Vitamins & Supplements", slug: "vitamins-supplements" },
                  { name: "Baby & Mother", slug: "baby-mother" },
                  { name: "Mind & Neurology", slug: "mind-neurology" },
                ].map((cat) => (
                  <li key={cat.slug}>
                    <button
                      className="flex items-center gap-1 hover:text-primary transition-colors duration-200 group cursor-pointer"
                      onClick={() => navigate(`/products?category=${cat.slug}`)}
                    >
                      {cat.name}
                      <ArrowUpRight className="size-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="mb-4 text-sm font-bold text-foreground">Contact Us</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-center gap-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Phone className="size-3.5" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">+91 98765 43210</p>
                    <p className="text-xs text-muted-foreground/70">Mon – Sat, 8 AM – 10 PM</p>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                    <MapPin className="size-3.5" />
                  </div>
                  <p className="leading-relaxed">
                    123 Health Street,<br />
                    Mumbai, Maharashtra 400001
                  </p>
                </li>
                <li className="flex items-center gap-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Mail className="size-3.5" />
                  </div>
                  <p>hello@kalyanchemist.in</p>
                </li>
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-border/40">
          <div className="mx-auto max-w-7xl px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Kalyan Chemist. All rights reserved. Licensed Pharmacy.
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              Made with <Heart className="size-3 fill-red-400 text-red-400" /> for better healthcare
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
