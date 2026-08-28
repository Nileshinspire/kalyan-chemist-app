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
            <div className="hidden lg:flex items-end gap-4 shrink-0">
              {/* Doctor — taller figure with stethoscope */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="w-32 h-44 rounded-2xl bg-white/8 backdrop-blur-sm flex flex-col items-center justify-end border border-white/12 p-3 pb-2"
              >
                <svg viewBox="0 0 120 160" fill="none" className="w-24 h-32">
                  <defs>
                    <linearGradient id="skinL" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(255,220,190,0.95)" /><stop offset="100%" stopColor="rgba(235,195,160,0.95)" /></linearGradient>
                    <linearGradient id="coatW" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(255,255,255,0.88)" /><stop offset="100%" stopColor="rgba(230,235,240,0.82)" /></linearGradient>
                    <linearGradient id="hairDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(45,35,30,0.8)" /><stop offset="100%" stopColor="rgba(60,45,35,0.65)" /></linearGradient>
                  </defs>
                  {/* Neck */}
                  <rect x="52" y="38" width="16" height="14" rx="4" fill="url(#skinL)" />
                  {/* Body — white coat silhouette */}
                  <path d="M34 52 L30 56 L28 120 L92 120 L90 56 L86 52 Q86 46 72 44 L48 44 Q34 46 34 52 Z" fill="url(#coatW)" />
                  {/* Coat collar/lapels */}
                  <path d="M48 46 L56 62 L60 52" stroke="rgba(200,205,215,0.6)" strokeWidth="1.2" fill="none" />
                  <path d="M72 46 L64 62 L60 52" stroke="rgba(200,205,215,0.6)" strokeWidth="1.2" fill="none" />
                  {/* Shirt underneath */}
                  <path d="M52 48 L56 62 L60 52 L64 62 L68 48" fill="rgba(120,160,220,0.35)" />
                  {/* Stethoscope tubing */}
                  <path d="M50 60 Q44 64 44 74 Q44 82 50 84 Q56 82 56 74 Q56 64 50 60" stroke="rgba(80,150,200,0.7)" strokeWidth="2" fill="none" />
                  <path d="M44 66 L40 56 Q40 50 46 48" stroke="rgba(80,150,200,0.5)" strokeWidth="1.5" fill="none" />
                  <path d="M56 66 L60 56 Q60 50 54 48" stroke="rgba(80,150,200,0.5)" strokeWidth="1.5" fill="none" />
                  <circle cx="50" cy="84" r="5" stroke="rgba(80,150,200,0.8)" strokeWidth="2.5" fill="rgba(80,150,200,0.1)" />
                  {/* Left arm */}
                  <path d="M30 56 Q22 70 20 90 L24 90 Q28 74 32 60" fill="url(#coatW)" />
                  {/* Right arm */}
                  <path d="M90 56 Q98 70 100 90 L96 90 Q92 74 88 60" fill="url(#coatW)" />
                  {/* Hand — right, holding stethoscope end */}
                  <ellipse cx="100" cy="88" rx="4" ry="3" fill="url(#skinL)" />
                  {/* Head shape — slightly oval for realism */}
                  <ellipse cx="60" cy="22" rx="16" ry="18" fill="url(#skinL)" />
                  {/* Hair — styled side part */}
                  <path d="M44 18 Q44 6 60 4 Q76 6 76 18 L76 12 Q76 2 60 2 Q44 2 44 12 Z" fill="url(#hairDark)" />
                  <path d="M44 18 Q44 10 50 8" stroke="url(#hairDark)" strokeWidth="3" fill="none" />
                  {/* Ears */}
                  <ellipse cx="44" cy="22" rx="3" ry="4" fill="rgba(235,195,160,0.7)" />
                  <ellipse cx="76" cy="22" rx="3" ry="4" fill="rgba(235,195,160,0.7)" />
                  {/* Eyes — almond shaped */}
                  <path d="M52 20 Q54 18 56 20 Q54 22 52 20" fill="rgba(50,40,35,0.8)" />
                  <path d="M64 20 Q66 18 68 20 Q66 22 64 20" fill="rgba(50,40,35,0.8)" />
                  <circle cx="54" cy="20" r="0.8" fill="white" opacity="0.7" />
                  <circle cx="66" cy="20" r="0.8" fill="white" opacity="0.7" />
                  {/* Eyebrows */}
                  <path d="M51 17 Q54 15 57 17" stroke="rgba(50,35,25,0.5)" strokeWidth="1" fill="none" />
                  <path d="M63 17 Q66 15 69 17" stroke="rgba(50,35,25,0.5)" strokeWidth="1" fill="none" />
                  {/* Nose */}
                  <path d="M59 22 Q60 26 61 22" stroke="rgba(180,140,110,0.4)" strokeWidth="0.8" fill="none" />
                  {/* Smile */}
                  <path d="M55 28 Q60 31 65 28" stroke="rgba(160,110,90,0.45)" strokeWidth="1" fill="none" />
                  {/* Name badge on coat */}
                  <rect x="72" y="60" width="10" height="7" rx="1.5" fill="rgba(80,150,200,0.25)" />
                  <line x1="74" y1="62" x2="80" y2="62" stroke="rgba(80,150,200,0.4)" strokeWidth="0.6" />
                  <line x1="74" y1="64.5" x2="78" y2="64.5" stroke="rgba(80,150,200,0.3)" strokeWidth="0.5" />
                </svg>
                <span className="text-[10px] text-white/50 font-medium mt-1.5 tracking-wide">Doctor</span>
              </motion.div>
              {/* Pharmacist — shorter figure with clipboard */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="w-28 h-40 rounded-2xl bg-white/8 backdrop-blur-sm flex flex-col items-center justify-end border border-white/12 p-3 pb-2"
              >
                <svg viewBox="0 0 110 150" fill="none" className="w-20 h-28">
                  <defs>
                    <linearGradient id="scrubsG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(70,140,130,0.75)" /><stop offset="100%" stopColor="rgba(55,115,105,0.65)" /></linearGradient>
                    <linearGradient id="skinM" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(245,210,180,0.95)" /><stop offset="100%" stopColor="rgba(225,185,155,0.95)" /></linearGradient>
                    <linearGradient id="hairBr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(70,40,20,0.8)" /><stop offset="100%" stopColor="rgba(85,50,25,0.6)" /></linearGradient>
                  </defs>
                  {/* Neck */}
                  <rect x="46" y="36" width="14" height="12" rx="4" fill="url(#skinM)" />
                  {/* Scrubs top */}
                  <path d="M30 48 L28 52 L26 115 L84 115 L82 52 L80 48 Q80 42 68 40 L42 40 Q30 42 30 48 Z" fill="url(#scrubsG)" />
                  {/* V-neck detail */}
                  <path d="M48 42 L55 58 L60 48" stroke="rgba(255,255,255,0.35)" strokeWidth="1" fill="rgba(255,255,255,0.1)" />
                  {/* ID lanyard */}
                  <line x1="60" y1="42" x2="60" y2="68" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
                  <rect x="55" y="68" width="10" height="8" rx="1.5" fill="rgba(255,255,255,0.4)" />
                  {/* Left arm */}
                  <path d="M28 52 Q18 68 16 88 L20 88 Q24 72 30 56" fill="url(#scrubsG)" />
                  {/* Right arm — holding clipboard */}
                  <path d="M82 52 Q92 64 94 80 L90 80 Q88 66 80 56" fill="url(#scrubsG)" />
                  {/* Hand */}
                  <ellipse cx="94" cy="78" rx="3.5" ry="3" fill="url(#skinM)" />
                  {/* Clipboard */}
                  <rect x="88" y="64" width="16" height="22" rx="2" fill="rgba(255,255,255,0.65)" stroke="rgba(180,185,195,0.4)" strokeWidth="0.8" />
                  <line x1="91" y1="70" x2="101" y2="70" stroke="rgba(120,130,145,0.4)" strokeWidth="0.6" />
                  <line x1="91" y1="74" x2="99" y2="74" stroke="rgba(120,130,145,0.35)" strokeWidth="0.5" />
                  <line x1="91" y1="78" x2="100" y2="78" stroke="rgba(120,130,145,0.3)" strokeWidth="0.5" />
                  {/* Head */}
                  <ellipse cx="55" cy="20" rx="14" ry="16" fill="url(#skinM)" />
                  {/* Hair — pulled back */}
                  <path d="M41 16 Q41 4 55 3 Q69 4 69 16 L69 10 Q68 2 55 2 Q42 2 41 10 Z" fill="url(#hairBr)" />
                  <path d="M41 16 Q41 12 44 10" fill="url(#hairBr)" />
                  {/* Hair bun */}
                  <ellipse cx="55" cy="4" rx="8" ry="5" fill="url(#hairBr)" opacity="0.8" />
                  {/* Ears */}
                  <ellipse cx="41" cy="20" rx="2.5" ry="3.5" fill="rgba(225,185,155,0.6)" />
                  <ellipse cx="69" cy="20" rx="2.5" ry="3.5" fill="rgba(225,185,155,0.6)" />
                  {/* Eyes */}
                  <path d="M48 18 Q50 16.5 52 18 Q50 19.5 48 18" fill="rgba(45,35,30,0.8)" />
                  <path d="M58 18 Q60 16.5 62 18 Q60 19.5 58 18" fill="rgba(45,35,30,0.8)" />
                  <circle cx="50" cy="18" r="0.7" fill="white" opacity="0.6" />
                  <circle cx="60" cy="18" r="0.7" fill="white" opacity="0.6" />
                  {/* Eyebrows */}
                  <path d="M47 15 Q50 13.5 53 15" stroke="rgba(60,35,20,0.45)" strokeWidth="0.8" fill="none" />
                  <path d="M57 15 Q60 13.5 63 15" stroke="rgba(60,35,20,0.45)" strokeWidth="0.8" fill="none" />
                  {/* Nose */}
                  <path d="M54 20 Q55 23 56 20" stroke="rgba(180,140,110,0.35)" strokeWidth="0.7" fill="none" />
                  {/* Smile */}
                  <path d="M51 25 Q55 28 59 25" stroke="rgba(160,110,90,0.4)" strokeWidth="0.9" fill="none" />
                </svg>
                <span className="text-[10px] text-white/50 font-medium mt-1.5 tracking-wide">Pharmacist</span>
              </motion.div>
            </div>

            {/* Center: Heading + Search */}
            <div className="flex-1 text-center max-w-2xl mx-auto">
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
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
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.08 }}
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
                transition={{ duration: 0.4, delay: 0.15 }}
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
            <div className="hidden lg:flex items-end gap-4 shrink-0">
              {/* Mother holding baby */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="w-28 h-40 rounded-2xl bg-white/8 backdrop-blur-sm flex flex-col items-center justify-end border border-white/12 p-3 pb-2"
              >
                <svg viewBox="0 0 110 150" fill="none" className="w-20 h-28">
                  <defs>
                    <linearGradient id="skinF" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(250,218,190,0.95)" /><stop offset="100%" stopColor="rgba(230,192,162,0.95)" /></linearGradient>
                    <linearGradient id="dressP" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(200,110,140,0.65)" /><stop offset="100%" stopColor="rgba(170,90,120,0.55)" /></linearGradient>
                    <linearGradient id="hairW" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(55,35,25,0.8)" /><stop offset="100%" stopColor="rgba(70,42,28,0.6)" /></linearGradient>
                  </defs>
                  {/* Neck */}
                  <rect x="48" y="38" width="14" height="12" rx="4" fill="url(#skinF)" />
                  {/* Dress / top */}
                  <path d="M32 50 L30 54 L28 120 L82 120 L80 54 L78 50 Q78 44 66 42 L44 42 Q32 44 32 50 Z" fill="url(#dressP)" />
                  {/* Neckline */}
                  <path d="M46 44 Q55 54 64 44" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" fill="none" />
                  {/* Left arm — cradling baby */}
                  <path d="M30 54 Q20 66 18 82 L22 82 Q26 70 32 58" fill="url(#skinF)" />
                  {/* Right arm — supporting baby */}
                  <path d="M80 54 Q86 66 88 82 L84 82 Q82 70 78 58" fill="url(#skinF)" />
                  {/* Baby (held in arms) */}
                  <ellipse cx="55" cy="78" rx="18" ry="20" fill="rgba(255,255,255,0.55)" />
                  {/* Baby blanket wrap */}
                  <path d="M38 72 Q40 60 55 58 Q70 60 72 72 Q72 88 55 92 Q38 88 38 72 Z" fill="rgba(200,220,240,0.45)" />
                  {/* Baby head */}
                  <circle cx="55" cy="65" r="10" fill="url(#skinF)" />
                  {/* Baby hair wisps */}
                  <path d="M48 60 Q50 55 55 54 Q60 55 62 60" stroke="rgba(60,40,25,0.4)" strokeWidth="1.5" fill="none" />
                  {/* Baby eyes — closed (sleeping) */}
                  <path d="M51 64 Q53 63 55 64" stroke="rgba(60,40,30,0.5)" strokeWidth="0.7" fill="none" />
                  <path d="M55 64 Q57 63 59 64" stroke="rgba(60,40,30,0.5)" strokeWidth="0.7" fill="none" />
                  {/* Baby nose */}
                  <circle cx="55" cy="66.5" r="0.6" fill="rgba(200,150,130,0.4)" />
                  {/* Mother head */}
                  <ellipse cx="55" cy="22" rx="15" ry="17" fill="url(#skinF)" />
                  {/* Hair — flowing */}
                  <path d="M40 18 Q40 5 55 3 Q70 5 70 18 L70 10 Q70 2 55 2 Q40 2 40 10 Z" fill="url(#hairW)" />
                  <path d="M40 18 Q38 28 36 38" stroke="url(#hairW)" strokeWidth="3" fill="none" />
                  <path d="M70 18 Q72 28 73 35" stroke="url(#hairW)" strokeWidth="3" fill="none" />
                  {/* Ears */}
                  <ellipse cx="40" cy="22" rx="2.5" ry="3.5" fill="rgba(230,192,162,0.6)" />
                  {/* Eyes */}
                  <path d="M49 20 Q51 18.5 53 20 Q51 21.5 49 20" fill="rgba(50,35,25,0.8)" />
                  <path d="M57 20 Q59 18.5 61 20 Q59 21.5 57 20" fill="rgba(50,35,25,0.8)" />
                  <circle cx="51" cy="20" r="0.7" fill="white" opacity="0.6" />
                  <circle cx="59" cy="20" r="0.7" fill="white" opacity="0.6" />
                  {/* Eyebrows */}
                  <path d="M48 17 Q51 15.5 54 17" stroke="rgba(55,35,22,0.4)" strokeWidth="0.8" fill="none" />
                  <path d="M56 17 Q59 15.5 62 17" stroke="rgba(55,35,22,0.4)" strokeWidth="0.8" fill="none" />
                  {/* Nose */}
                  <path d="M54 22 Q55 25 56 22" stroke="rgba(180,140,110,0.35)" strokeWidth="0.7" fill="none" />
                  {/* Warm smile */}
                  <path d="M50 27 Q55 30 60 27" stroke="rgba(160,100,80,0.4)" strokeWidth="0.9" fill="none" />
                </svg>
                <span className="text-[10px] text-white/50 font-medium mt-1.5 tracking-wide">Mother & Baby</span>
              </motion.div>
              {/* Healthcare expert with medicine bottle */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="w-32 h-44 rounded-2xl bg-white/8 backdrop-blur-sm flex flex-col items-center justify-end border border-white/12 p-3 pb-2"
              >
                <svg viewBox="0 0 120 160" fill="none" className="w-24 h-32">
                  <defs>
                    <linearGradient id="skinE" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(240,205,175,0.95)" /><stop offset="100%" stopColor="rgba(220,182,152,0.95)" /></linearGradient>
                    <linearGradient id="coatE" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(255,255,255,0.88)" /><stop offset="100%" stopColor="rgba(232,237,242,0.82)" /></linearGradient>
                    <linearGradient id="hairBl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="rgba(40,30,25,0.82)" /><stop offset="100%" stopColor="rgba(55,40,32,0.65)" /></linearGradient>
                  </defs>
                  {/* Neck */}
                  <rect x="52" y="38" width="16" height="14" rx="4" fill="url(#skinE)" />
                  {/* White coat body */}
                  <path d="M34 52 L30 56 L28 120 L92 120 L90 56 L86 52 Q86 46 72 44 L48 44 Q34 46 34 52 Z" fill="url(#coatE)" />
                  {/* Coat lapels */}
                  <path d="M48 46 L56 62 L60 52" stroke="rgba(200,205,215,0.6)" strokeWidth="1.2" fill="none" />
                  <path d="M72 46 L64 62 L60 52" stroke="rgba(200,205,215,0.6)" strokeWidth="1.2" fill="none" />
                  {/* Red cross emblem on coat */}
                  <circle cx="60" cy="72" r="8" fill="rgba(220,65,65,0.15)" />
                  <rect x="58" y="66" width="4" height="12" rx="1" fill="rgba(220,65,65,0.5)" />
                  <rect x="54" y="70" width="12" height="4" rx="1" fill="rgba(220,65,65,0.5)" />
                  {/* Left arm */}
                  <path d="M30 56 Q22 70 20 90 L24 90 Q28 74 32 60" fill="url(#coatE)" />
                  {/* Right arm — extended holding bottle */}
                  <path d="M90 56 Q100 66 104 82 L100 82 Q96 68 88 60" fill="url(#coatE)" />
                  {/* Hand */}
                  <ellipse cx="104" cy="80" rx="4" ry="3" fill="url(#skinE)" />
                  {/* Medicine bottle in hand */}
                  <rect x="98" y="70" width="10" height="16" rx="2.5" fill="rgba(80,180,130,0.65)" />
                  <rect x="99" y="66" width="8" height="5" rx="1.5" fill="rgba(80,180,130,0.5)" />
                  <rect x="100" y="73" width="6" height="1" rx="0.5" fill="rgba(255,255,255,0.4)" />
                  {/* Head */}
                  <ellipse cx="60" cy="22" rx="16" ry="18" fill="url(#skinE)" />
                  {/* Hair — short professional */}
                  <path d="M44 18 Q44 6 60 4 Q76 6 76 18 L76 12 Q76 2 60 2 Q44 2 44 12 Z" fill="url(#hairBl)" />
                  {/* Ears */}
                  <ellipse cx="44" cy="22" rx="3" ry="4" fill="rgba(220,182,152,0.6)" />
                  <ellipse cx="76" cy="22" rx="3" ry="4" fill="rgba(220,182,152,0.6)" />
                  {/* Eyes */}
                  <path d="M52 20 Q54 18.5 56 20 Q54 21.5 52 20" fill="rgba(45,35,28,0.8)" />
                  <path d="M64 20 Q66 18.5 68 20 Q66 21.5 64 20" fill="rgba(45,35,28,0.8)" />
                  <circle cx="54" cy="20" r="0.8" fill="white" opacity="0.6" />
                  <circle cx="66" cy="20" r="0.8" fill="white" opacity="0.6" />
                  {/* Eyebrows */}
                  <path d="M51 17 Q54 15.5 57 17" stroke="rgba(45,30,20,0.5)" strokeWidth="1" fill="none" />
                  <path d="M63 17 Q66 15.5 69 17" stroke="rgba(45,30,20,0.5)" strokeWidth="1" fill="none" />
                  {/* Nose */}
                  <path d="M59 22 Q60 26 61 22" stroke="rgba(175,135,105,0.4)" strokeWidth="0.8" fill="none" />
                  {/* Smile */}
                  <path d="M55 28 Q60 31 65 28" stroke="rgba(155,105,85,0.4)" strokeWidth="1" fill="none" />
                </svg>
                <span className="text-[10px] text-white/50 font-medium mt-1.5 tracking-wide">Healthcare Expert</span>
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
