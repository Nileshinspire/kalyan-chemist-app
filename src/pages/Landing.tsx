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
import { useNavigate, useLocation, useSearchParams } from "react-router";
import { useRef, useState, useMemo } from "react";
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

/* ─── Category Navigation inside Hero Banner ─── */
const HERO_CATEGORIES = [
  { label: "Kalyan Chemist Products", slug: "", key: "all" },
  { label: "Baby Care", slug: "baby-mother", key: "baby-care" },
  { label: "Nutritional Drinks & Supplements", slug: "nutrition", key: "nutrition" },
  { label: "Women Care", slug: "baby-mother", key: "women-care" },
  { label: "Personal Care", slug: "personal-care", key: "personal-care" },
  { label: "Ayurveda", slug: "alternative-medicine", key: "ayurveda" },
  { label: "Health Devices", slug: "health-safety", key: "health-devices" },
  { label: "Home Essentials", slug: "others", key: "home-essentials" },
  { label: "Health Conditions", slug: "health-safety", key: "health-conditions" },
] as const;

function HeroCategoryNav() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentNavKey = useMemo(() => searchParams.get("nav") || "", [searchParams.get("nav")]);

  return (
    <div className="relative" style={{ background: '#0a3d2e' }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-center gap-0 overflow-x-auto scrollbar-none">
          {HERO_CATEGORIES.map((cat) => {
            const isActive = currentNavKey === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => {
                  if (cat.slug) {
                    navigate(`/products?category=${cat.slug}&nav=${cat.key}`);
                  } else {
                    navigate(`/products?nav=all`);
                  }
                }}
                className="relative px-3 lg:px-4 py-2.5 text-xs lg:text-sm font-medium whitespace-nowrap transition-all duration-200 shrink-0 text-white hover:text-white" style={{ color: '#FFFFFF' }}
              >
                {cat.label}
                {isActive && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-white rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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
        {/* Category Navigation Strip — integrated at top of hero */}
        <HeroCategoryNav />
        {/* Decorative background elements */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white/8 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-white/8 rounded-full blur-3xl translate-x-1/4 translate-y-1/4" />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }} />
        </div>

        {/* Half-body healthcare figures emerging from bottom */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* ─── LEFT SIDE: Doctor (outer) + Pharmacist (inner) ─── */}
          {/* Doctor — tall, outer-left, half-body from bottom */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute bottom-0 left-[1%] xl:left-[3%]"
          >
            <svg viewBox="0 0 160 280" fill="none" className="w-[100px] h-[175px] md:w-[120px] md:h-[210px]">
              <defs>
                <linearGradient id="hDocSkin" x1="0.3" y1="0" x2="0.7" y2="1"><stop offset="0%" stopColor="#f5d4b8" /><stop offset="100%" stopColor="#e2b494" /></linearGradient>
                <linearGradient id="hDocCoat" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffffff" /><stop offset="50%" stopColor="#f2f4f7" /><stop offset="100%" stopColor="#e6eaf0" /></linearGradient>
                <linearGradient id="hDocHair" x1="0.5" y1="0" x2="0.5" y2="1"><stop offset="0%" stopColor="#2a1c14" /><stop offset="100%" stopColor="#3a281e" /></linearGradient>
                <linearGradient id="hDocShirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4a90b8" /><stop offset="100%" stopColor="#3a7aa0" /></linearGradient>
                <filter id="hDocShadow"><feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0a1f18" floodOpacity="0.25" /></filter>
                <radialGradient id="hDocCheekL" cx="0.3" cy="0.5" r="0.35"><stop offset="0%" stopColor="#e8a0a0" stopOpacity="0.3" /><stop offset="100%" stopColor="transparent" /></radialGradient>
                <radialGradient id="hDocCheekR" cx="0.7" cy="0.5" r="0.35"><stop offset="0%" stopColor="#e8a0a0" stopOpacity="0.3" /><stop offset="100%" stopColor="transparent" /></radialGradient>
              </defs>
              <g filter="url(#hDocShadow)">
                {/* White coat — upper torso, fading at bottom */}
                <path d="M42 100 L38 106 L36 280 L124 280 L122 106 L118 100 Q118 92 100 88 L60 88 Q42 92 42 100 Z" fill="url(#hDocCoat)" />
                {/* Lapels */}
                <path d="M60 90 L72 114 L78 98" fill="url(#hDocShirt)" opacity="0.12" />
                <path d="M100 90 L88 114 L78 98" fill="url(#hDocShirt)" opacity="0.12" />
                {/* Shirt V */}
                <path d="M66 94 L78 118 L90 94" fill="url(#hDocShirt)" opacity="0.5" />
                {/* Coat buttons */}
                <circle cx="78" cy="140" r="2" fill="rgba(100,110,125,0.25)" />
                <circle cx="78" cy="160" r="2" fill="rgba(100,110,125,0.25)" />
                <circle cx="78" cy="180" r="2" fill="rgba(100,110,125,0.25)" />
                {/* Stethoscope */}
                <path d="M68 112 Q60 118 60 132 Q60 144 68 146 Q76 144 76 132 Q76 118 68 112" stroke="#5aafcc" strokeWidth="2.8" fill="none" />
                <path d="M60 122 L52 110 Q52 100 62 96" stroke="#5aafcc" strokeWidth="2" fill="none" opacity="0.65" />
                <path d="M76 122 L84 110 Q84 100 74 96" stroke="#5aafcc" strokeWidth="2" fill="none" opacity="0.65" />
                <circle cx="68" cy="146" r="7" stroke="#5aafcc" strokeWidth="3.5" fill="rgba(90,175,204,0.12)" />
                {/* Left arm */}
                <path d="M38 106 Q26 128 24 160 L32 160 Q36 134 42 112" fill="url(#hDocCoat)" />
                <ellipse cx="24" cy="158" rx="5" ry="4" fill="url(#hDocSkin)" />
                {/* Right arm */}
                <path d="M122 106 Q134 128 136 160 L128 160 Q124 134 118 112" fill="url(#hDocCoat)" />
                <ellipse cx="136" cy="158" rx="5" ry="4" fill="url(#hDocSkin)" />
              </g>
              {/* Neck */}
              <rect x="70" y="82" width="16" height="14" rx="5" fill="url(#hDocSkin)" />
              {/* Head */}
              <ellipse cx="78" cy="56" rx="22" ry="26" fill="url(#hDocSkin)" />
              <ellipse cx="66" cy="62" rx="7" ry="5" fill="url(#hDocCheekL)" />
              <ellipse cx="90" cy="62" rx="7" ry="5" fill="url(#hDocCheekR)" />
              {/* Hair */}
              <path d="M56 48 Q56 26 78 24 Q100 26 100 48 L100 38 Q100 22 78 20 Q56 22 56 38 Z" fill="url(#hDocHair)" />
              <path d="M56 48 Q56 38 64 34" stroke="url(#hDocHair)" strokeWidth="5" fill="none" />
              {/* Ears */}
              <ellipse cx="56" cy="56" rx="4.5" ry="6" fill="#ddb090" />
              <ellipse cx="100" cy="56" rx="4.5" ry="6" fill="#ddb090" />
              {/* Eyes */}
              <path d="M68 54 Q72 50 76 54 Q72 57 68 54" fill="#2a1c14" />
              <path d="M80 54 Q84 50 88 54 Q84 57 80 54" fill="#2a1c14" />
              <circle cx="72" cy="53" r="1.2" fill="white" opacity="0.8" />
              <circle cx="84" cy="53" r="1.2" fill="white" opacity="0.8" />
              {/* Eyebrows */}
              <path d="M67 49 Q72 46 77 49" stroke="#3a281e" strokeWidth="1.4" fill="none" opacity="0.55" />
              <path d="M79 49 Q84 46 89 49" stroke="#3a281e" strokeWidth="1.4" fill="none" opacity="0.55" />
              {/* Nose */}
              <path d="M76 56 Q78 62 80 56" stroke="#c49a78" strokeWidth="1.1" fill="none" opacity="0.45" />
              {/* Smile */}
              <path d="M72 64 Q78 68 84 64" stroke="#c48a72" strokeWidth="1.3" fill="none" opacity="0.45" />
              {/* Name badge */}
              <rect x="96" y="120" width="14" height="10" rx="2" fill="rgba(90,175,204,0.18)" />
              <line x1="98" y1="124" x2="108" y2="124" stroke="rgba(90,175,204,0.3)" strokeWidth="0.8" />
              <line x1="98" y1="127" x2="105" y2="127" stroke="rgba(90,175,204,0.2)" strokeWidth="0.6" />
            </svg>
          </motion.div>

          {/* Pharmacist — shorter, inner-left, half-body from bottom */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="absolute bottom-0 left-[9%] xl:left-[11%]"
          >
            <svg viewBox="0 0 150 260" fill="none" className="w-[85px] h-[150px] md:w-[100px] md:h-[175px]">
              <defs>
                <linearGradient id="hPharmSkin" x1="0.3" y1="0" x2="0.7" y2="1"><stop offset="0%" stopColor="#f0d0b0" /><stop offset="100%" stopColor="#ddb494" /></linearGradient>
                <linearGradient id="hPharmScrub" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3d9e8e" /><stop offset="100%" stopColor="#2d7e70" /></linearGradient>
                <linearGradient id="hPharmHair" x1="0.5" y1="0" x2="0.5" y2="1"><stop offset="0%" stopColor="#3a2010" /><stop offset="100%" stopColor="#503018" /></linearGradient>
                <filter id="hPharmShadow"><feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0a1f18" floodOpacity="0.2" /></filter>
                <radialGradient id="hPharmCheek"><stop offset="0%" stopColor="#dda0a0" stopOpacity="0.25" /><stop offset="100%" stopColor="transparent" /></radialGradient>
              </defs>
              <g filter="url(#hPharmShadow)">
                {/* Scrubs body */}
                <path d="M40 90 L36 96 L34 260 L116 260 L114 96 L110 90 Q110 84 96 82 L54 82 Q40 84 40 90 Z" fill="url(#hPharmScrub)" />
                {/* V-neck */}
                <path d="M64 84 L74 106 L82 94" stroke="rgba(255,255,255,0.28)" strokeWidth="1.3" fill="rgba(255,255,255,0.07)" />
                {/* ID lanyard */}
                <line x1="78" y1="84" x2="78" y2="120" stroke="rgba(255,255,255,0.22)" strokeWidth="1" />
                <rect x="72" y="120" width="12" height="10" rx="2" fill="rgba(255,255,255,0.3)" />
                {/* Left arm */}
                <path d="M36 96 Q24 116 22 148 L30 148 Q34 122 40 102" fill="url(#hPharmScrub)" />
                <ellipse cx="22" cy="146" rx="4.5" ry="4" fill="url(#hPharmSkin)" />
                {/* Right arm — holding clipboard */}
                <path d="M114 96 Q126 116 128 145 L120 145 Q116 120 112 102" fill="url(#hPharmScrub)" />
                <ellipse cx="128" cy="143" rx="4.5" ry="4" fill="url(#hPharmSkin)" />
                {/* Clipboard */}
                <rect x="120" y="124" width="22" height="30" rx="3" fill="rgba(255,255,255,0.65)" stroke="rgba(170,180,195,0.3)" strokeWidth="1" />
                <line x1="124" y1="132" x2="138" y2="132" stroke="rgba(100,115,135,0.3)" strokeWidth="0.8" />
                <line x1="124" y1="138" x2="136" y2="138" stroke="rgba(100,115,135,0.25)" strokeWidth="0.7" />
                <line x1="124" y1="144" x2="137" y2="144" stroke="rgba(100,115,135,0.2)" strokeWidth="0.6" />
              </g>
              {/* Neck */}
              <rect x="68" y="74" width="16" height="14" rx="5" fill="url(#hPharmSkin)" />
              {/* Head */}
              <ellipse cx="76" cy="48" rx="20" ry="24" fill="url(#hPharmSkin)" />
              <ellipse cx="64" cy="54" rx="6" ry="4.5" fill="url(#hPharmCheek)" />
              <ellipse cx="88" cy="54" rx="6" ry="4.5" fill="url(#hPharmCheek)" />
              {/* Hair — bun */}
              <path d="M56 42 Q56 22 76 20 Q96 22 96 42 L96 32 Q96 18 76 16 Q56 18 56 32 Z" fill="url(#hPharmHair)" />
              <ellipse cx="76" cy="20" rx="12" ry="7" fill="url(#hPharmHair)" opacity="0.85" />
              {/* Ears */}
              <ellipse cx="56" cy="48" rx="4" ry="5.5" fill="#d8aa8a" />
              <ellipse cx="96" cy="48" rx="4" ry="5.5" fill="#d8aa8a" />
              {/* Eyes */}
              <path d="M68 46 Q72 42.5 76 46 Q72 49 68 46" fill="#2a1c14" />
              <path d="M76 46 Q80 42.5 84 46 Q80 49 76 46" fill="#2a1c14" />
              <circle cx="72" cy="45" r="1" fill="white" opacity="0.7" />
              <circle cx="80" cy="45" r="1" fill="white" opacity="0.7" />
              {/* Eyebrows */}
              <path d="M67 42 Q72 39 77 42" stroke="#3a2010" strokeWidth="1.2" fill="none" opacity="0.5" />
              <path d="M75 42 Q80 39 85 42" stroke="#3a2010" strokeWidth="1.2" fill="none" opacity="0.5" />
              {/* Nose */}
              <path d="M74 48 Q76 53 78 48" stroke="#c49a78" strokeWidth="1" fill="none" opacity="0.4" />
              {/* Smile */}
              <path d="M71 56 Q76 59 81 56" stroke="#c08a70" strokeWidth="1.1" fill="none" opacity="0.4" />
            </svg>
          </motion.div>

          {/* ─── RIGHT SIDE: Mother & Baby (inner) + Expert (outer) ─── */}
          {/* Mother & Baby — inner-right, half-body from bottom */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08 }}
            className="absolute bottom-0 right-[9%] xl:right-[11%]"
          >
            <svg viewBox="0 0 150 260" fill="none" className="w-[85px] h-[150px] md:w-[100px] md:h-[175px]">
              <defs>
                <linearGradient id="hMomSkin" x1="0.3" y1="0" x2="0.7" y2="1"><stop offset="0%" stopColor="#f2d4b6" /><stop offset="100%" stopColor="#deb696" /></linearGradient>
                <linearGradient id="hMomDress" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c8688a" /><stop offset="100%" stopColor="#a85070" /></linearGradient>
                <linearGradient id="hMomHair" x1="0.5" y1="0" x2="0.5" y2="1"><stop offset="0%" stopColor="#2a1810" /><stop offset="100%" stopColor="#3c2518" /></linearGradient>
                <linearGradient id="hBabySkin" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f8dcc4" /><stop offset="100%" stopColor="#f0c8a8" /></linearGradient>
                <linearGradient id="hBabyBlanket" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#c8ddf0" /><stop offset="100%" stopColor="#a8c0dc" /></linearGradient>
                <filter id="hMomShadow"><feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#0a1f18" floodOpacity="0.2" /></filter>
                <radialGradient id="hMomCheek"><stop offset="0%" stopColor="#dda0a0" stopOpacity="0.25" /><stop offset="100%" stopColor="transparent" /></radialGradient>
              </defs>
              <g filter="url(#hMomShadow)">
                {/* Dress body */}
                <path d="M40 90 L36 96 L34 260 L116 260 L114 96 L110 90 Q110 84 96 82 L54 82 Q40 84 40 90 Z" fill="url(#hMomDress)" />
                {/* Neckline */}
                <path d="M62 84 L78 102 L94 84" stroke="rgba(255,255,255,0.22)" strokeWidth="1" fill="none" />
                {/* Left arm — cradling */}
                <path d="M36 96 Q24 114 22 142 L30 142 Q34 120 40 102" fill="url(#hMomSkin)" />
                {/* Right arm — supporting */}
                <path d="M114 96 Q126 114 128 142 L120 142 Q116 120 112 102" fill="url(#hMomSkin)" />
                {/* Baby blanket */}
                <path d="M48 136 Q50 118 75 115 Q100 118 102 136 Q102 160 75 165 Q48 160 48 136 Z" fill="url(#hBabyBlanket)" opacity="0.65" />
                <ellipse cx="75" cy="142" rx="24" ry="26" fill="url(#hBabyBlanket)" opacity="0.4" />
              </g>
              {/* Baby head */}
              <circle cx="75" cy="122" r="13" fill="url(#hBabySkin)" />
              <path d="M64 116 Q66 108 75 107 Q84 108 86 116" stroke="#4a3020" strokeWidth="2" fill="none" opacity="0.35" />
              {/* Baby eyes — closed */}
              <path d="M69 121 Q72 120 74 121" stroke="#4a3020" strokeWidth="1" fill="none" opacity="0.45" />
              <path d="M76 121 Q78 120 81 121" stroke="#4a3020" strokeWidth="1" fill="none" opacity="0.45" />
              <circle cx="75" cy="124" r="0.9" fill="#d8a090" opacity="0.45" />
              {/* Mother neck */}
              <rect x="66" y="74" width="14" height="14" rx="5" fill="url(#hMomSkin)" />
              {/* Mother head */}
              <ellipse cx="73" cy="48" rx="20" ry="24" fill="url(#hMomSkin)" />
              <ellipse cx="61" cy="54" rx="6" ry="4.5" fill="url(#hMomCheek)" />
              <ellipse cx="85" cy="54" rx="6" ry="4.5" fill="url(#hMomCheek)" />
              {/* Hair */}
              <path d="M53 42 Q53 22 73 20 Q93 22 93 42 L93 32 Q93 18 73 16 Q53 18 53 32 Z" fill="url(#hMomHair)" />
              <path d="M53 42 Q50 56 48 72" stroke="url(#hMomHair)" strokeWidth="4" fill="none" opacity="0.65" />
              <path d="M93 42 Q96 56 97 70" stroke="url(#hMomHair)" strokeWidth="4" fill="none" opacity="0.65" />
              {/* Ears */}
              <ellipse cx="53" cy="48" rx="4" ry="5.5" fill="#d8aa8a" />
              {/* Eyes */}
              <path d="M65 46 Q69 42.5 73 46 Q69 49 65 46" fill="#2a1c14" />
              <path d="M73 46 Q77 42.5 81 46 Q77 49 73 46" fill="#2a1c14" />
              <circle cx="69" cy="45" r="1" fill="white" opacity="0.7" />
              <circle cx="77" cy="45" r="1" fill="white" opacity="0.7" />
              {/* Eyebrows */}
              <path d="M64 42 Q69 39 74 42" stroke="#3c2518" strokeWidth="1.2" fill="none" opacity="0.5" />
              <path d="M72 42 Q77 39 82 42" stroke="#3c2518" strokeWidth="1.2" fill="none" opacity="0.5" />
              {/* Nose */}
              <path d="M71 48 Q73 53 75 48" stroke="#c49a78" strokeWidth="1" fill="none" opacity="0.4" />
              {/* Warm smile */}
              <path d="M68 56 Q73 60 78 56" stroke="#c08a70" strokeWidth="1.1" fill="none" opacity="0.4" />
            </svg>
          </motion.div>

          {/* Healthcare Expert — tall, outer-right, half-body from bottom */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute bottom-0 right-[1%] xl:right-[3%]"
          >
            <svg viewBox="0 0 160 280" fill="none" className="w-[100px] h-[175px] md:w-[120px] md:h-[210px]">
              <defs>
                <linearGradient id="hExpSkin" x1="0.3" y1="0" x2="0.7" y2="1"><stop offset="0%" stopColor="#f0d2b4" /><stop offset="100%" stopColor="#dcb494" /></linearGradient>
                <linearGradient id="hExpCoat" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ffffff" /><stop offset="50%" stopColor="#f2f4f7" /><stop offset="100%" stopColor="#e6eaf0" /></linearGradient>
                <linearGradient id="hExpHair" x1="0.5" y1="0" x2="0.5" y2="1"><stop offset="0%" stopColor="#1e1410" /><stop offset="100%" stopColor="#302018" /></linearGradient>
                <linearGradient id="hExpBottle" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4db87a" /><stop offset="100%" stopColor="#3a9a62" /></linearGradient>
                <filter id="hExpShadow"><feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0a1f18" floodOpacity="0.25" /></filter>
                <radialGradient id="hExpCheek"><stop offset="0%" stopColor="#e0a0a0" stopOpacity="0.25" /><stop offset="100%" stopColor="transparent" /></radialGradient>
              </defs>
              <g filter="url(#hExpShadow)">
                {/* White coat */}
                <path d="M42 100 L38 106 L36 280 L124 280 L122 106 L118 100 Q118 92 100 88 L60 88 Q42 92 42 100 Z" fill="url(#hExpCoat)" />
                {/* Lapels */}
                <path d="M60 90 L72 114 L78 98" fill="rgba(200,205,215,0.1)" />
                <path d="M100 90 L88 114 L78 98" fill="rgba(200,205,215,0.1)" />
                {/* Red cross emblem */}
                <circle cx="78" cy="132" r="11" fill="rgba(220,60,60,0.08)" />
                <rect x="76" y="122" width="4" height="20" rx="1.5" fill="rgba(220,60,60,0.4)" />
                <rect x="70" y="128" width="16" height="4" rx="1.5" fill="rgba(220,60,60,0.4)" />
                {/* Coat buttons */}
                <circle cx="78" cy="160" r="2" fill="rgba(100,110,125,0.25)" />
                <circle cx="78" cy="180" r="2" fill="rgba(100,110,125,0.25)" />
                {/* Left arm */}
                <path d="M38 106 Q26 128 24 160 L32 160 Q36 134 42 112" fill="url(#hExpCoat)" />
                <ellipse cx="24" cy="158" rx="5" ry="4" fill="url(#hExpSkin)" />
                {/* Right arm — holding medicine */}
                <path d="M122 106 Q134 128 138 158 L130 158 Q126 132 118 112" fill="url(#hExpCoat)" />
                <ellipse cx="138" cy="156" rx="5" ry="4" fill="url(#hExpSkin)" />
                {/* Medicine bottle */}
                <rect x="130" y="138" width="14" height="22" rx="3" fill="url(#hExpBottle)" opacity="0.7" />
                <rect x="131" y="132" width="12" height="7" rx="2" fill="url(#hExpBottle)" opacity="0.5" />
                <rect x="132" y="143" width="10" height="1.5" rx="0.5" fill="rgba(255,255,255,0.4)" />
              </g>
              {/* Neck */}
              <rect x="70" y="82" width="16" height="14" rx="5" fill="url(#hExpSkin)" />
              {/* Head */}
              <ellipse cx="78" cy="56" rx="22" ry="26" fill="url(#hExpSkin)" />
              <ellipse cx="66" cy="62" rx="7" ry="5" fill="url(#hExpCheek)" />
              <ellipse cx="90" cy="62" rx="7" ry="5" fill="url(#hExpCheek)" />
              {/* Hair */}
              <path d="M56 48 Q56 26 78 24 Q100 26 100 48 L100 38 Q100 22 78 20 Q56 22 56 38 Z" fill="url(#hExpHair)" />
              {/* Ears */}
              <ellipse cx="56" cy="56" rx="4.5" ry="6" fill="#d8a888" />
              <ellipse cx="100" cy="56" rx="4.5" ry="6" fill="#d8a888" />
              {/* Eyes */}
              <path d="M68 54 Q72 50 76 54 Q72 57 68 54" fill="#1e1410" />
              <path d="M80 54 Q84 50 88 54 Q84 57 80 54" fill="#1e1410" />
              <circle cx="72" cy="53" r="1.2" fill="white" opacity="0.8" />
              <circle cx="84" cy="53" r="1.2" fill="white" opacity="0.8" />
              {/* Eyebrows */}
              <path d="M67 49 Q72 46 77 49" stroke="#302018" strokeWidth="1.4" fill="none" opacity="0.55" />
              <path d="M79 49 Q84 46 89 49" stroke="#302018" strokeWidth="1.4" fill="none" opacity="0.55" />
              {/* Nose */}
              <path d="M76 56 Q78 62 80 56" stroke="#c49a78" strokeWidth="1.1" fill="none" opacity="0.45" />
              {/* Smile */}
              <path d="M72 64 Q78 68 84 64" stroke="#c08a70" strokeWidth="1.3" fill="none" opacity="0.45" />
            </svg>
          </motion.div>
        </div>

        {/* Center: Heading + Search */}
        <div className="relative z-20 mx-auto max-w-7xl px-4 sm:px-6 pt-10 md:pt-16 pb-12 md:pb-20">
          <div className="flex flex-col items-center text-center max-w-2xl mx-auto">
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
              className="relative w-full max-w-xl mx-auto"
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
