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
  Upload,
  ShoppingCart,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useLocation } from "react-router";
import { useRef, useState } from "react";
import { openWhatsApp, generateEnquiryMessage } from "@/lib/whatsapp";
import Navbar from "@/components/layout/Navbar";
import WhatsAppFloat from "@/components/WhatsAppFloat";
import WriteReview from "@/components/WriteReview";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { formatCurrency } from "@/lib/auth-utils";
import { toast } from "sonner";

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

// Map category slugs to icons and colors
const CATEGORY_STYLES: Record<string, { icon: typeof Pill; color: string; hoverBg: string; iconColor: string }> = {
  "pain-relief": { icon: Pill, color: "from-orange-500/15 to-red-500/15", hoverBg: "hover:from-orange-500/20 hover:to-red-500/20", iconColor: "text-orange-600" },
  "heart-cardio": { icon: HeartPulse, color: "from-rose-500/15 to-pink-500/15", hoverBg: "hover:from-rose-500/20 hover:to-pink-500/20", iconColor: "text-rose-600" },
  "diabetes-care": { icon: Stethoscope, color: "from-blue-500/15 to-cyan-500/15", hoverBg: "hover:from-blue-500/20 hover:to-cyan-500/20", iconColor: "text-blue-600" },
  "baby-mother": { icon: Baby, color: "from-violet-500/15 to-purple-500/15", hoverBg: "hover:from-violet-500/20 hover:to-purple-500/20", iconColor: "text-violet-600" },
  "vitamins-supplements": { icon: Leaf, color: "from-emerald-500/15 to-green-500/15", hoverBg: "hover:from-emerald-500/20 hover:to-green-500/20", iconColor: "text-emerald-600" },
  "skin-personal-care": { icon: Sparkles, color: "from-pink-500/15 to-fuchsia-500/15", hoverBg: "hover:from-pink-500/20 hover:to-fuchsia-500/20", iconColor: "text-pink-600" },
  "antibiotics": { icon: Shield, color: "from-teal-500/15 to-cyan-500/15", hoverBg: "hover:from-teal-500/20 hover:to-cyan-500/20", iconColor: "text-teal-600" },
  "digestive-health": { icon: Stethoscope, color: "from-amber-500/15 to-yellow-500/15", hoverBg: "hover:from-amber-500/20 hover:to-yellow-500/20", iconColor: "text-amber-600" },
};

const DEFAULT_STYLE = { icon: Pill, color: "from-primary/15 to-primary/10", hoverBg: "hover:from-primary/20 hover:to-primary/15", iconColor: "text-primary" };

const features = [
  { icon: ShieldCheck, title: "Genuine Medicines", description: "Every product sourced directly from licensed manufacturers and verified distributors." },
  { icon: Truck, title: "Prompt Delivery", description: "Orders dispatched within hours and delivered to your doorstep with care." },
  { icon: Clock3, title: "Always Open Online", description: "Browse and order anytime — our platform is available around the clock." },
  { icon: Pill, title: "Expert Guidance", description: "Our pharmacists are available to answer your questions about dosage and interactions." },
];



export default function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const [reviewOpen, setReviewOpen] = useState(false);
  const dbTestimonials = useQuery(api.testimonials.listFeatured, { limit: 6 });
  const logWhatsApp = useMutation(api.whatsappEnquiries.log);
  const deliveryConfig = useQuery(api.deliveryConfig.getPublic);

  const addToCart = useMutation(api.cart.addItem);

  // Real data from Convex
  const categories = useQuery(api.categories.list);
  const popularProducts = useQuery(api.publicProducts.popular, { limit: 8 });
  const featuredProducts = useQuery(api.publicProducts.featured, { limit: 4 });

  const handleAddToCart = async (productId: string) => {
    try {
      await addToCart({ productId: productId as any, quantity: 1 });
      toast.success("Added to cart");
    } catch (error: any) {
      if (error.message === "Not authenticated") {
        toast.error("Please sign in to add items to cart");
        navigate("/auth");
      } else {
        toast.error(error.message || "Failed to add to cart");
      }
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* ── Global Navigation ── */}
      <Navbar />

      {/* ── Hero: Buy Medicines and Essentials ── */}
      <section ref={heroRef} className="relative overflow-hidden" style={{ background: 'linear-gradient(160deg, oklch(0.42 0.09 170) 0%, oklch(0.38 0.10 168) 40%, oklch(0.35 0.08 172) 100%)' }}>
        {/* Decorative background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white/8 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-white/8 rounded-full blur-3xl translate-x-1/4 translate-y-1/4" />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }} />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-10 md:py-16">
          <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
            {/* Left illustrations */}
            <div className="hidden lg:flex items-end gap-3 shrink-0">
              {/* Doctor with stethoscope */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="w-28 h-36 rounded-2xl bg-white/10 backdrop-blur-sm flex flex-col items-center justify-end border border-white/15 p-3 pb-2"
              >
                <svg viewBox="0 0 100 120" fill="none" className="w-20 h-24">
                  {/* Head */}
                  <circle cx="50" cy="22" r="14" fill="rgba(255,255,255,0.85)" />
                  {/* Hair */}
                  <path d="M36 18 Q36 8 50 8 Q64 8 64 18" fill="rgba(60,60,60,0.5)" />
                  {/* Eyes */}
                  <circle cx="44" cy="22" r="1.5" fill="rgba(60,60,60,0.7)" />
                  <circle cx="56" cy="22" r="1.5" fill="rgba(60,60,60,0.7)" />
                  {/* Smile */}
                  <path d="M44 28 Q50 32 56 28" stroke="rgba(60,60,60,0.4)" strokeWidth="1" fill="none" />
                  {/* White coat / body */}
                  <path d="M32 40 L32 85 C32 90 68 90 68 85 L68 40 C68 35 32 35 32 40 Z" fill="rgba(255,255,255,0.75)" />
                  {/* Coat lapels */}
                  <path d="M42 38 L50 55 L58 38" stroke="rgba(200,200,200,0.5)" strokeWidth="1" fill="none" />
                  {/* Stethoscope */}
                  <circle cx="50" cy="65" r="5" stroke="rgba(100,180,220,0.8)" strokeWidth="2" fill="none" />
                  <path d="M45 65 L45 55 Q45 50 50 50 Q55 50 55 55 L55 65" stroke="rgba(100,180,220,0.8)" strokeWidth="1.5" fill="none" />
                  <path d="M45 55 L42 42" stroke="rgba(100,180,220,0.7)" strokeWidth="1.5" fill="none" />
                  <path d="M55 55 L58 42" stroke="rgba(100,180,220,0.7)" strokeWidth="1.5" fill="none" />
                  {/* Name badge */}
                  <rect x="55" y="48" width="10" height="7" rx="1" fill="rgba(100,180,220,0.3)" />
                </svg>
                <span className="text-[10px] text-white/60 font-medium mt-1">Doctor</span>
              </motion.div>
              {/* Nurse/Pharmacist */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.35 }}
                className="w-24 h-32 rounded-2xl bg-white/10 backdrop-blur-sm flex flex-col items-center justify-end border border-white/15 p-3 pb-2"
              >
                <svg viewBox="0 0 80 100" fill="none" className="w-16 h-20">
                  {/* Head */}
                  <circle cx="40" cy="18" r="12" fill="rgba(255,255,255,0.85)" />
                  {/* Hair */}
                  <path d="M28 15 Q28 5 40 5 Q52 5 52 15" fill="rgba(80,50,30,0.5)" />
                  {/* Nurse cap */}
                  <rect x="30" y="2" width="20" height="8" rx="2" fill="rgba(255,255,255,0.9)" stroke="rgba(200,200,200,0.4)" strokeWidth="0.5" />
                  <path d="M37 3 L40 0 L43 3 L43 8 L37 8 Z" fill="rgba(220,60,60,0.6)" />
                  {/* Eyes */}
                  <circle cx="35" cy="18" r="1.2" fill="rgba(60,60,60,0.7)" />
                  <circle cx="45" cy="18" r="1.2" fill="rgba(60,60,60,0.7)" />
                  {/* Body (scrubs) */}
                  <path d="M26 32 L26 75 C26 78 54 78 54 75 L54 32 C54 28 26 28 26 32 Z" fill="rgba(100,180,220,0.6)" />
                  {/* Collar */}
                  <path d="M34 30 L40 40 L46 30" stroke="rgba(255,255,255,0.5)" strokeWidth="1" fill="none" />
                  {/* Clipboard */}
                  <rect x="56" y="45" width="12" height="16" rx="1" fill="rgba(255,255,255,0.6)" stroke="rgba(200,200,200,0.5)" strokeWidth="0.5" />
                  <line x1="58" y1="50" x2="66" y2="50" stroke="rgba(150,150,150,0.5)" strokeWidth="0.5" />
                  <line x1="58" y1="53" x2="64" y2="53" stroke="rgba(150,150,150,0.5)" strokeWidth="0.5" />
                  <line x1="58" y1="56" x2="65" y2="56" stroke="rgba(150,150,150,0.5)" strokeWidth="0.5" />
                </svg>
                <span className="text-[10px] text-white/60 font-medium mt-1">Pharmacist</span>
              </motion.div>
            </div>

            {/* Center: Heading + Search */}
            <div className="flex-1 text-center max-w-2xl mx-auto">
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight mb-4"
              >
                Buy Medicines and Essentials
              </motion.h1>

              <motion.form
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = (e.target as HTMLFormElement).querySelector("input")?.value;
                  if (q?.trim()) navigate(`/products?search=${encodeURIComponent(q.trim())}`);
                }}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="relative max-w-xl mx-auto"
              >
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search Medicines"
                    className="w-full h-12 sm:h-14 pl-12 pr-32 sm:pr-36 rounded-xl bg-white text-gray-900 placeholder-gray-400 text-base sm:text-lg font-medium shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
                  />
                  <button
                    type="submit"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 sm:h-10 px-5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Search
                  </button>
                </div>
              </motion.form>

              {/* Quick search tags */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-wrap justify-center gap-2 mt-4"
              >
                {["Paracetamol", "Vitamin C", "Cough Syrup", "Diabetes", "Skin Care"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => navigate(`/products?search=${encodeURIComponent(tag)}`)}
                    className="px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium hover:bg-white/20 transition-colors border border-white/10"
                  >
                    {tag}
                  </button>
                ))}
              </motion.div>
            </div>

            {/* Right illustrations */}
            <div className="hidden lg:flex items-end gap-3 shrink-0">
              {/* Mother & child */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.35 }}
                className="w-24 h-32 rounded-2xl bg-white/10 backdrop-blur-sm flex flex-col items-center justify-end border border-white/15 p-3 pb-2"
              >
                <svg viewBox="0 0 80 100" fill="none" className="w-16 h-20">
                  {/* Mother head */}
                  <circle cx="35" cy="16" r="11" fill="rgba(255,255,255,0.85)" />
                  {/* Hair */}
                  <path d="M24 14 Q24 4 35 4 Q46 4 46 14 L46 20 Q46 14 35 14 Q24 14 24 20 Z" fill="rgba(80,50,30,0.5)" />
                  {/* Eyes */}
                  <circle cx="31" cy="16" r="1.2" fill="rgba(60,60,60,0.7)" />
                  <circle cx="39" cy="16" r="1.2" fill="rgba(60,60,60,0.7)" />
                  {/* Mother body */}
                  <path d="M22 30 L22 70 C22 74 48 74 48 70 L48 30 C48 26 22 26 22 30 Z" fill="rgba(220,130,160,0.55)" />
                  {/* Baby head */}
                  <circle cx="56" cy="35" r="8" fill="rgba(255,255,255,0.8)" />
                  {/* Baby eyes */}
                  <circle cx="53" cy="35" r="1" fill="rgba(60,60,60,0.6)" />
                  <circle cx="59" cy="35" r="1" fill="rgba(60,60,60,0.6)" />
                  {/* Baby body */}
                  <path d="M48 45 L48 65 C48 68 64 68 64 65 L64 45 C64 42 48 42 48 45 Z" fill="rgba(255,255,255,0.5)" />
                </svg>
                <span className="text-[10px] text-white/60 font-medium mt-1">Mother & Baby</span>
              </motion.div>
              {/* Health worker with medicine */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="w-28 h-36 rounded-2xl bg-white/10 backdrop-blur-sm flex flex-col items-center justify-end border border-white/15 p-3 pb-2"
              >
                <svg viewBox="0 0 100 120" fill="none" className="w-20 h-24">
                  {/* Head */}
                  <circle cx="50" cy="22" r="14" fill="rgba(255,255,255,0.85)" />
                  {/* Hair */}
                  <path d="M36 18 Q36 6 50 6 Q64 6 64 18" fill="rgba(50,50,50,0.5)" />
                  {/* Eyes */}
                  <circle cx="44" cy="22" r="1.5" fill="rgba(60,60,60,0.7)" />
                  <circle cx="56" cy="22" r="1.5" fill="rgba(60,60,60,0.7)" />
                  {/* Smile */}
                  <path d="M44 28 Q50 32 56 28" stroke="rgba(60,60,60,0.4)" strokeWidth="1" fill="none" />
                  {/* Lab coat */}
                  <path d="M32 40 L32 85 C32 90 68 90 68 85 L68 40 C68 35 32 35 32 40 Z" fill="rgba(255,255,255,0.75)" />
                  {/* Cross emblem */}
                  <rect x="45" y="52" width="10" height="10" rx="2" fill="rgba(220,70,70,0.35)" />
                  <rect x="48" y="54" width="4" height="6" rx="0.5" fill="rgba(220,70,70,0.6)" />
                  <rect x="46" y="56" width="8" height="2" rx="0.5" fill="rgba(220,70,70,0.6)" />
                  {/* Medicine bottle in hand */}
                  <rect x="70" y="55" width="8" height="14" rx="2" fill="rgba(100,200,150,0.6)" />
                  <rect x="71" y="52" width="6" height="4" rx="1" fill="rgba(100,200,150,0.4)" />
                </svg>
                <span className="text-[10px] text-white/60 font-medium mt-1">Healthcare Expert</span>
              </motion.div>
            </div>
          </div>
        </div>
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

      {/* ── Categories (from DB) ── */}
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
          {(categories ?? []).map((cat) => {
            const style = CATEGORY_STYLES[cat.slug] ?? DEFAULT_STYLE;
            return (
              <motion.div
                key={cat._id}
                variants={scaleIn}
                className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-6 transition-all duration-500 hover:shadow-card-hover hover:border-primary/20 cursor-pointer hover:-translate-y-1"
                onClick={() => navigate(`/products?category=${cat.slug}`)}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${style.color} ${style.hoverBg} opacity-0 group-hover:opacity-100 transition-all duration-500`} />
                <div className="relative flex items-start gap-4">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-all duration-500 group-hover:bg-primary group-hover:text-white group-hover:scale-110 group-hover:shadow-glow">
                    <style.icon className="size-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors duration-300">{cat.name}</h3>
                      <Badge variant="secondary" className="text-[10px]">{cat.productCount}</Badge>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {cat.description}
                    </p>
                  </div>
                </div>
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0">
                  <ArrowUpRight className="size-4 text-primary/60" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.section>

      {/* ── Popular Medicines (from DB) ── */}
      {popularProducts && popularProducts.length > 0 && (
        <section className="border-y border-border/50 bg-gradient-to-b from-card/50 to-background">
          <div className="mx-auto max-w-7xl px-6 py-24">
            <div className="flex items-end justify-between mb-10">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
                  <Pill className="size-3" />
                  Most Ordered
                </div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
                  Popular Medicines
                </h2>
                <p className="mt-3 text-muted-foreground text-lg">
                  Trusted by thousands of customers across India.
                </p>
              </div>
              <Button variant="outline" className="hidden sm:flex rounded-xl" onClick={() => navigate("/products")}>
                View All <ArrowRight className="ml-1.5 size-3.5" />
              </Button>
            </div>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {popularProducts.map((product) => {
                const hasDiscount = product.discountPrice && product.discountPrice < product.price;
                const discountPct = hasDiscount ? Math.round(((product.price - product.discountPrice!) / product.price) * 100) : 0;
                return (
                  <motion.div
                    key={product._id}
                    initial={{ opacity: 0, y: 16 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="group rounded-2xl border border-border/70 bg-card p-4 cursor-pointer transition-all duration-500 hover:shadow-card-hover hover:border-primary/20 hover:-translate-y-1"
                    onClick={() => navigate(`/products/${product.slug}`, { state: { from: location.pathname + location.search } })}
                  >
                    <div className="relative flex items-center justify-center bg-gradient-to-br from-primary/[0.04] to-primary/[0.01] h-32 rounded-xl mb-3 overflow-hidden">
                      <Pill className="size-10 text-primary/20 group-hover:text-primary/30 transition-all duration-500" />
                      {hasDiscount && (
                        <Badge className="absolute top-2 left-2 text-[10px] font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">
                          {discountPct}% OFF
                        </Badge>
                      )}
                      {product.prescriptionRequired && (
                        <Badge variant="secondary" className="absolute top-2 right-2 text-[10px] bg-red-50 text-red-700">Rx</Badge>
                      )}
                    </div>
                    <h3 className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors">{product.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{product.manufacturer}</p>
                    <div className="flex items-baseline gap-1.5 mt-2">
                      <span className="text-base font-extrabold">{formatCurrency(hasDiscount ? product.discountPrice! : product.price)}</span>
                      {hasDiscount && (
                        <span className="text-xs text-muted-foreground line-through">{formatCurrency(product.price)}</span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="w-full mt-3 h-8 text-xs font-semibold gradient-primary text-white rounded-lg"
                      onClick={(e) => { e.stopPropagation(); handleAddToCart(product._id); }}
                      disabled={product.stockQuantity === 0}
                    >
                      <ShoppingCart className="size-3 mr-1" />
                      {product.stockQuantity === 0 ? "Out of Stock" : "Add to Cart"}
                    </Button>
                  </motion.div>
                );
              })}
            </div>
            <div className="mt-6 text-center sm:hidden">
              <Button variant="outline" className="rounded-xl" onClick={() => navigate("/products")}>
                View All Medicines <ArrowRight className="ml-1.5 size-3.5" />
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* ── Best Deals / Featured (from DB) ── */}
      {featuredProducts && featuredProducts.length > 0 && (
        <section className="mx-auto max-w-7xl px-6 py-24">
          <div className="mb-10">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/5 border border-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
              <Zap className="size-3" />
              Limited Offers
            </div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Best Deals Right Now
            </h2>
            <p className="mt-3 text-muted-foreground text-lg">
              Save more on your healthcare essentials with our top discounts.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product) => (
              <motion.div
                key={product._id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="group rounded-2xl border border-border/70 bg-card overflow-hidden cursor-pointer transition-all duration-500 hover:shadow-card-hover hover:border-primary/20 hover:-translate-y-1"
                onClick={() => navigate(`/products/${product.slug}`, { state: { from: location.pathname + location.search } })}
              >
                <div className="relative flex items-center justify-center bg-gradient-to-br from-green-500/[0.06] to-emerald-500/[0.03] h-40">
                  <Pill className="size-12 text-primary/20 group-hover:scale-110 transition-all duration-500" />
                  <div className="absolute top-3 left-3">
                    <Badge className="text-xs font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-md">
                      {product.discountPercent}% OFF
                    </Badge>
                  </div>
                  {product.prescriptionRequired && (
                    <Badge variant="secondary" className="absolute top-3 right-2 text-[10px] bg-red-50 text-red-700">Rx</Badge>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-semibold line-clamp-2 group-hover:text-primary transition-colors">{product.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{product.manufacturer}</p>
                  <div className="flex items-baseline gap-1.5 mt-2">
                    <span className="text-lg font-extrabold">{formatCurrency(product.discountPrice!)}</span>
                    <span className="text-xs text-muted-foreground line-through">{formatCurrency(product.price)}</span>
                  </div>
                  <Button
                    size="sm"
                    className="w-full mt-3 h-8 text-xs font-semibold gradient-primary text-white rounded-lg"
                    onClick={(e) => { e.stopPropagation(); handleAddToCart(product._id); }}
                    disabled={product.stockQuantity === 0}
                  >
                    <ShoppingCart className="size-3 mr-1" />
                    Add to Cart
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

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
          <div className="flex items-end justify-between">
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
            <Button
              variant="outline"
              className="hidden sm:flex rounded-xl gap-2"
              onClick={() => setReviewOpen(true)}
            >
              <Star className="size-3.5" />
              Write a Review
            </Button>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-3">
            {(dbTestimonials && dbTestimonials.length > 0 ? dbTestimonials : []).map((t, i) => (
              <motion.div
                key={t._id}
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
                  {t.title && (
                    <p className="text-sm font-semibold text-foreground mb-1">{t.title}</p>
                  )}
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    &ldquo;{t.message}&rdquo;
                  </p>
                </div>
                <div className="mt-6 border-t border-border/60 pt-4">
                  <p className="text-sm font-semibold text-foreground">{t.displayName}</p>
                  {t.featured && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary mt-0.5">
                      <Star className="size-2.5 fill-primary" /> Featured
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
            {dbTestimonials && dbTestimonials.length === 0 && (
              <div className="col-span-full text-center py-12">
                <Star className="size-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Be the first to share your experience!</p>
                <Button
                  variant="outline"
                  className="mt-4 rounded-xl gap-2"
                  onClick={() => setReviewOpen(true)}
                >
                  <Star className="size-3.5" />
                  Write a Review
                </Button>
              </div>
            )}
          </div>
          <div className="mt-8 text-center sm:hidden">
            <Button
              variant="outline"
              className="rounded-xl gap-2"
              onClick={() => setReviewOpen(true)}
            >
              <Star className="size-3.5" />
              Write a Review
            </Button>
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
                  { label: "Categories", to: "/categories" },
                  { label: "Shopping Cart", to: "/cart" },
                  { label: "Sign In", to: "/auth" },
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
                {(categories ?? []).slice(0, 6).map((cat) => (
                  <li key={cat._id}>
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

      {/* Floating WhatsApp Button */}
      <WhatsAppFloat />
      <WriteReview open={reviewOpen} onOpenChange={setReviewOpen} />
    </div>
  );
}
