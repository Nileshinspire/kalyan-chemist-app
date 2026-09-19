import { useRef } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  type Variants,
} from "framer-motion";
import {
  ShieldCheck,
  Truck,
  Pill,
  Stethoscope,
  HeartPulse,
  Clock,
  RefreshCw,
  Upload,
  ArrowRight,
  Star,
  BadgeCheck,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useNavigate } from "react-router";

/* ─── Shared animation config ─── */
const EASE = [0.22, 1, 0.36, 1] as const;

/* ─── Premium SVG Healthcare Icons ─── */
function PharmacyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <rect x="8" y="16" width="48" height="40" rx="6" stroke="currentColor" strokeWidth="2" />
      <path d="M24 8h16v12H24z" stroke="currentColor" strokeWidth="2" rx="3" />
      <rect x="27" y="30" width="10" height="18" rx="2" fill="currentColor" opacity="0.2" />
      <rect x="22" y="35" width="20" height="8" rx="2" fill="currentColor" opacity="0.2" />
      <circle cx="32" cy="34" r="3" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

function DeliveryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <rect x="4" y="20" width="36" height="24" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M40 28h12l8 10v6a2 2 0 01-2 2h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="18" cy="46" r="5" stroke="currentColor" strokeWidth="2" />
      <circle cx="50" cy="46" r="5" stroke="currentColor" strokeWidth="2" />
      <path d="M23 46h22" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function LabTestIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <path d="M20 8v20l-12 24a4 4 0 004 4h40a4 4 0 004-4L44 28V8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M20 8h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 48c4-4 8 2 12-2s8 2 12-2s8 2 12-2" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <circle cx="28" cy="40" r="2" fill="currentColor" opacity="0.3" />
      <circle cx="36" cy="36" r="1.5" fill="currentColor" opacity="0.3" />
      <circle cx="32" cy="42" r="1" fill="currentColor" opacity="0.3" />
    </svg>
  );
}

function RefillIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" className={className}>
      <rect x="16" y="8" width="32" height="48" rx="6" stroke="currentColor" strokeWidth="2" />
      <rect x="22" y="4" width="20" height="8" rx="3" stroke="currentColor" strokeWidth="2" />
      <path d="M28 30a6 6 0 1112 0 6 6 0 01-12 0z" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <path d="M31 27v6m0 0v0m0 0h-3m3 0h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x="22" y="40" width="20" height="2" rx="1" fill="currentColor" opacity="0.2" />
      <rect x="22" y="46" width="14" height="2" rx="1" fill="currentColor" opacity="0.2" />
    </svg>
  );
}

/* ─── Scroll-triggered section wrapper ─── */
function RevealSection({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 60 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 }}
      transition={{ duration: 0.9, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ─── Floating particles background ─── */
function FloatingParticles({ count = 20 }: { count?: number }) {
  const particles = useRef(
    Array.from({ length: count }, (_, i) => ({
      x: (Math.sin(i * 1.7) * 0.5 + 0.5) * 100,
      y: (Math.cos(i * 2.3) * 0.5 + 0.5) * 100,
      size: 1.5 + (i % 4) * 0.8,
      dur: 4 + (i % 5) * 1.2,
      delay: (i * 0.3) % 3,
      color: i % 3 === 0 ? "rgba(22,163,106,0.6)" : i % 3 === 1 ? "rgba(216,184,120,0.4)" : "rgba(245,243,236,0.3)",
    }))
  ).current;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: p.color,
            animation: `about-float ${p.dur}s ease-in-out ${p.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN ABOUT US PAGE
   ═══════════════════════════════════════════════════════════════════ */
export default function AboutUs() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: heroScroll } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroBgY = useTransform(heroScroll, [0, 1], [0, 120]);
  const heroMidY = useTransform(heroScroll, [0, 1], [0, 60]);
  const heroFgY = useTransform(heroScroll, [0, 1], [0, 30]);
  const heroScale = useTransform(heroScroll, [0, 0.6], [1, 1.15]);
  const heroOpacity = useTransform(heroScroll, [0, 0.8], [1, 0]);

  /* ecosystem cards stagger */
  const cardsV: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.15 } },
  };
  const cardItem: Variants = {
    hidden: { opacity: 0, y: 40, scale: 0.95 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.7, ease: EASE },
    },
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <style>{`
        @keyframes about-float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; }
          50% { transform: translateY(-18px) scale(1.15); opacity: 0.8; }
        }
        @keyframes about-pulse-ring {
          0% { transform: scale(1); opacity: 0.12; }
          50% { transform: scale(1.08); opacity: 0.25; }
          100% { transform: scale(1); opacity: 0.12; }
        }
        @keyframes about-glow {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.35; }
        }
        @keyframes about-shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-about-anim] { animation: none !important; }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 1 — CINEMATIC HERO WITH PARALLAX DEPTH
          ═══════════════════════════════════════════════════════════ */}
      <section ref={heroRef} className="relative h-[85vh] min-h-[600px] overflow-hidden">
        {/* ── Ambient background layers ── */}
        <motion.div
          className="absolute inset-0"
          style={{ y: heroBgY, scale: heroScale }}
          aria-hidden="true"
        >
          <div className="absolute inset-0" style={{ background: "linear-gradient(160deg, #0a3d2e 0%, #0B0D0C 40%, #111614 70%, #0a3d2e 100%)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 50% at 30% 20%, rgba(22,163,106,0.18), transparent 65%)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 40% 35% at 75% 70%, rgba(216,184,120,0.08), transparent 55%)" }} />
          {/* Grid overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(245,243,236,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(245,243,236,.4) 1px, transparent 1px)", backgroundSize: "80px 80px" }} />
        </motion.div>

        {/* ── Layer 2: Parallax pharmacy visual (SVG-based) ── */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          style={{ y: heroMidY }}
          aria-hidden="true"
        >
          {/* Large pharmacy shield silhouette */}
          <div className="relative" style={{ width: "min(420px, 60vw)", height: "min(420px, 60vw)" }}>
            {/* Glow ring */}
            <div
              data-about-anim
              className="absolute inset-[-15%] rounded-full"
              style={{ background: "radial-gradient(circle, rgba(22,163,106,0.15), transparent 65%)", animation: "about-glow 6s ease-in-out infinite" }}
            />
            {/* Shield */}
            <svg viewBox="0 0 200 230" fill="none" className="size-full" style={{ filter: "drop-shadow(0 0 40px rgba(22,163,106,0.2))" }}>
              <defs>
                <linearGradient id="ahFace" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#11925E" stopOpacity="0.35" />
                  <stop offset="1" stopColor="#09543A" stopOpacity="0.2" />
                </linearGradient>
                <linearGradient id="ahEdge" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#F0D9A3" stopOpacity="0.4" />
                  <stop offset="1" stopColor="#16A36A" stopOpacity="0.25" />
                </linearGradient>
              </defs>
              <path d="M100 8 L185 48 V130 C185 185 150 215 100 228 C50 215 15 185 15 130 V48 Z" fill="url(#ahFace)" />
              <path d="M100 8 L185 48 V130 C185 185 150 215 100 228 C50 215 15 185 15 130 V48 Z" fill="none" stroke="url(#ahEdge)" strokeWidth="1.5" />
              <rect x="86" y="72" width="28" height="80" rx="9" fill="rgba(22,163,106,0.25)" />
              <rect x="66" y="96" width="68" height="28" rx="9" fill="rgba(22,163,106,0.25)" />
              <text x="100" y="165" textAnchor="middle" fontSize="33" fontWeight="900" fontFamily="system-ui, sans-serif" fill="rgba(245,243,236,0.3)" letterSpacing="2">KC</text>
              <text x="100" y="183" textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="system-ui, sans-serif" fill="rgba(216,184,120,0.25)" letterSpacing="4">PHARMACY</text>
            </svg>
          </div>
        </motion.div>

        {/* ── Layer 3: Foreground elements (fastest parallax) ── */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ y: heroFgY }}
          aria-hidden="true"
        >
          {/* Floating medicine elements */}
          {[
            { x: "12%", y: "25%", size: 40, rot: 15, opacity: 0.12, icon: "💊" },
            { x: "85%", y: "20%", size: 36, rot: -20, opacity: 0.1, icon: "🩺" },
            { x: "8%", y: "70%", size: 32, rot: 30, opacity: 0.08, icon: "💉" },
            { x: "88%", y: "65%", size: 38, rot: -10, opacity: 0.1, icon: "🧬" },
          ].map((el, i) => (
            <div
              key={i}
              className="absolute"
              style={{ left: el.x, top: el.y, fontSize: el.size, opacity: el.opacity, transform: `rotate(${el.rot}deg)` }}
            >
              {el.icon}
            </div>
          ))}
        </motion.div>

        {/* ── Vignette ── */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 45%, transparent 40%, rgba(4,6,5,0.7) 100%)" }} aria-hidden="true" />

        {/* ── Content ── */}
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
          style={{ opacity: heroOpacity }}
        >
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
            className="mb-4 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#16A36A]"
          >
            Since Day One
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.4, ease: EASE }}
            className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black uppercase leading-[0.88] tracking-tight"
          >
            <span className="bg-gradient-to-b from-white via-white/90 to-white/30 bg-clip-text text-transparent" style={{ WebkitTextFillColor: "transparent" }}>
              About
            </span>
            <br />
            <span className="bg-gradient-to-r from-[#16A36A] via-[#F0D9A3] to-[#16A36A] bg-clip-text text-transparent" style={{ WebkitTextFillColor: "transparent" }}>
              Kalyan Chemist
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7, ease: EASE }}
            className="mt-6 max-w-xl text-base sm:text-lg text-white/50 leading-relaxed"
          >
            Healthcare, simplified. A modern pharmacy experience designed around you.
          </motion.p>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 1 }}
            className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          >
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/30">Scroll to explore</span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-5 h-8 rounded-full border border-white/20 flex items-start justify-center pt-1.5"
            >
              <div className="w-1 h-2 rounded-full bg-white/40" />
            </motion.div>
          </motion.div>
        </motion.div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 2 — LARGE EDITORIAL TYPOGRAPHY + STORY
          ═══════════════════════════════════════════════════════════ */}
      <section className="relative py-28 sm:py-36 overflow-hidden" style={{ background: "linear-gradient(180deg, #0B0D0C, #111614, #0B0D0C)" }}>
        <FloatingParticles count={14} />

        <div className="relative z-10 mx-auto max-w-6xl px-6">
          {/* Editorial statement */}
          <RevealSection className="text-center mb-20">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#16A36A] mb-6">
              Our Story
            </p>
            <h2 className="text-4xl sm:text-5xl md:text-7xl font-black leading-[0.95] tracking-tight">
              <span className="text-white/90">Healthcare</span>
              <br />
              <span className="bg-gradient-to-r from-[#16A36A] via-[#F0D9A3] to-[#16A36A] bg-clip-text text-transparent" style={{ WebkitTextFillColor: "transparent" }}>
                Simplified
              </span>
            </h2>
          </RevealSection>

          {/* Story content — two-column editorial */}
          <div className="grid gap-16 lg:gap-24 items-center">
            <RevealSection className="order-2 lg:order-1">
              <div className="space-y-6">
                <p className="text-lg sm:text-xl md:text-2xl font-light leading-relaxed text-white/70">
                  Kalyan Chemist brings everyday healthcare closer through a
                  <span className="font-semibold text-white/90"> convenient digital experience </span>
                  for medicines, healthcare products and essential health services.
                </p>
                <p className="text-base sm:text-lg leading-relaxed text-white/50">
                  Born from the belief that accessing healthcare should be as
                  simple as a few taps on your phone, we built a platform that
                  connects you to genuine medicines, professional pharmacist
                  support, and reliable doorstep delivery — all in one place.
                </p>
                <p className="text-base sm:text-lg leading-relaxed text-white/50">
                  Whether it is your daily wellness essentials, prescription
                  medicines, lab tests, or a quick doctor consultation,
                  Kalyan Chemist is designed to make your healthcare journey
                  seamless, safe and convenient.
                </p>
              </div>
            </RevealSection>

            <RevealSection className="order-1 lg:order-2" delay={0.15}>
              <div className="relative rounded-3xl overflow-hidden aspect-[4/3]" style={{ background: "linear-gradient(135deg, rgba(22,163,106,0.08), rgba(17,22,20,0.9))" }}>
                {/* Decorative healthcare visual */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="relative">
                    {/* Ambient rings */}
                    <div data-about-anim className="absolute -inset-12 rounded-full border border-[#16A36A]/10" style={{ animation: "about-pulse-ring 5s ease-in-out infinite" }} />
                    <div data-about-anim className="absolute -inset-20 rounded-full border border-[#D8B878]/8" style={{ animation: "about-pulse-ring 7s ease-in-out 1s infinite" }} />
                    <div data-about-anim className="absolute -inset-28 rounded-full border border-[#16A36A]/5" style={{ animation: "about-pulse-ring 9s ease-in-out 2s infinite" }} />

                    {/* Central icon cluster */}
                    <div className="relative flex items-center gap-4 p-8">
                      <Stethoscope className="size-12 sm:size-16 text-[#16A36A]/40" strokeWidth={1.2} />
                      <Pill className="size-10 sm:size-14 text-[#F0D9A3]/30" strokeWidth={1.2} />
                      <HeartPulse className="size-12 sm:size-16 text-[#16A36A]/35" strokeWidth={1.2} />
                    </div>
                  </div>
                </div>

                {/* Bottom accent line */}
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#16A36A]/30 to-transparent" />
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 3 — WHY KALYAN CHEMIST
          ═══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 overflow-hidden" style={{ background: "linear-gradient(180deg, #0B0D0C 0%, #0a2e1f 50%, #0B0D0C 100%)" }}>
        <FloatingParticles count={10} />

        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <RevealSection className="text-center mb-16">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#D8B878] mb-4">
              Our Purpose
            </p>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black leading-[0.95] tracking-tight text-white/90">
              Healthcare should feel
              <br />
              <span className="bg-gradient-to-r from-[#16A36A] to-[#F0D9A3] bg-clip-text text-transparent" style={{ WebkitTextFillColor: "transparent" }}>
                simpler and more accessible
              </span>
            </h2>
          </RevealSection>

          <RevealSection className="max-w-3xl mx-auto text-center" delay={0.1}>
            <p className="text-lg sm:text-xl leading-relaxed text-white/55">
              We believe everyone deserves easy access to genuine healthcare
              products and professional pharmacy support. That is why Kalyan
              Chemist was built — to bridge the gap between you and the
              healthcare essentials you need, with the convenience of digital
              ordering and the trust of a reliable pharmacy.
            </p>
          </RevealSection>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 4 — HEALTHCARE ECOSYSTEM CARDS
          ═══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32" style={{ background: "#0B0D0C" }}>
        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <RevealSection className="text-center mb-16">
            <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#16A36A] mb-4">
              The Kalyan Chemist Experience
            </p>
            <h2 className="text-3xl sm:text-5xl font-black leading-[0.95] tracking-tight text-white/90">
              Everything you need,
              <br />
              <span className="bg-gradient-to-r from-[#F0D9A3] to-[#16A36A] bg-clip-text text-transparent" style={{ WebkitTextFillColor: "transparent" }}>
                in one place
              </span>
            </h2>
          </RevealSection>

          <motion.div
            variants={cardsV}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-60px" }}
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
          >
            {[
              {
                icon: Pill,
                svgIcon: PharmacyIcon,
                title: "Medicines & Products",
                desc: "Genuine medicines and healthcare products from trusted brands, delivered with care.",
                accent: "#16A36A",
              },
              {
                icon: Stethoscope,
                svgIcon: LabTestIcon,
                title: "Lab Tests & Doctors",
                desc: "Book lab tests and doctor consultations from the comfort of your home.",
                accent: "#F0D9A3",
              },
              {
                icon: RefreshCw,
                svgIcon: RefillIcon,
                title: "Prescription & Refills",
                desc: "Upload prescriptions easily and set up convenient medicine refill schedules.",
                accent: "#16A36A",
              },
              {
                icon: Truck,
                svgIcon: DeliveryIcon,
                title: "Home Delivery",
                desc: "Fast, reliable doorstep delivery so you never miss your healthcare essentials.",
                accent: "#D8B878",
              },
            ].map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.title}
                  variants={cardItem}
                  className="group relative rounded-3xl border border-white/[0.06] p-6 sm:p-7 transition-all duration-500 hover:border-[#16A36A]/20 hover:shadow-lg hover:shadow-[#16A36A]/5 hover:-translate-y-1 cursor-pointer"
                  style={{ background: "linear-gradient(160deg, rgba(245,243,236,0.03), rgba(245,243,236,0.01))" }}
                  onClick={() => navigate("/products")}
                >
                  {/* Top glow on hover */}
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent group-hover:via-[#16A36A]/20 transition-all duration-500" />

                  {/* Icon */}
                  <div
                    className="mb-5 flex size-12 items-center justify-center rounded-2xl transition-all duration-500 group-hover:scale-110"
                    style={{ background: `${card.accent}12`, border: `1px solid ${card.accent}20` }}
                  >
                    <Icon className="size-5" style={{ color: card.accent }} strokeWidth={1.5} />
                  </div>

                  <h3 className="text-base font-bold text-white/90 mb-2 group-hover:text-white transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-white/40 group-hover:text-white/55 transition-colors">
                    {card.desc}
                  </p>

                  {/* Bottom accent bar */}
                  <div className="absolute bottom-0 left-6 right-6 h-[2px] rounded-full bg-gradient-to-r from-transparent via-transparent to-transparent group-hover:via-[#16A36A]/30 transition-all duration-700" />
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 5 — TRUST / CUSTOMER EXPERIENCE
          ═══════════════════════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 overflow-hidden" style={{ background: "linear-gradient(180deg, #0B0D0C, #0f1a15, #0B0D0C)" }}>
        <FloatingParticles count={12} />

        <div className="relative z-10 mx-auto max-w-6xl px-6">
          <div className="grid gap-16 lg:gap-24 items-center">
            <RevealSection className="order-2 lg:order-1">
              <div className="space-y-8">
                <div>
                  <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#D8B878] mb-4">
                    Built on Trust
                  </p>
                  <h2 className="text-3xl sm:text-4xl md:text-5xl font-black leading-[0.95] tracking-tight text-white/90">
                    Your health deserves
                    <br />
                    <span className="bg-gradient-to-r from-[#16A36A] to-[#F0D9A3] bg-clip-text text-transparent" style={{ WebkitTextFillColor: "transparent" }}>
                      nothing less
                    </span>
                  </h2>
                </div>

                <div className="space-y-5">
                  {[
                    { icon: ShieldCheck, text: "Genuine medicines from verified and trusted pharmaceutical sources" },
                    { icon: BadgeCheck, text: "Professional pharmacist consultations available around the clock" },
                    { icon: Clock, text: "Convenient digital access to healthcare whenever you need it" },
                    { icon: Truck, text: "Reliable doorstep delivery with secure and careful packaging" },
                    { icon: Upload, text: "Easy prescription upload and seamless refill management" },
                  ].map((item, i) => (
                    <RevealSection key={i} delay={i * 0.08}>
                      <div className="flex items-start gap-4 group">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#16A36A]/10 text-[#16A36A] group-hover:bg-[#16A36A]/15 transition-colors">
                          <item.icon className="size-4.5" strokeWidth={1.6} />
                        </div>
                        <p className="text-base leading-relaxed text-white/55 group-hover:text-white/70 transition-colors pt-2">
                          {item.text}
                        </p>
                      </div>
                    </RevealSection>
                  ))}
                </div>
              </div>
            </RevealSection>

            <RevealSection className="order-1 lg:order-2" delay={0.1}>
              <div className="relative">
                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-4">
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
                      transition={{ delay: i * 0.1, duration: 0.6, ease: EASE }}
                      className="group rounded-2xl border border-white/[0.06] p-5 sm:p-6 text-center hover:border-[#16A36A]/15 transition-all duration-500"
                      style={{ background: "linear-gradient(160deg, rgba(245,243,236,0.025), rgba(245,243,236,0.008))" }}
                    >
                      <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-xl bg-[#16A36A]/10 text-[#16A36A] group-hover:bg-[#16A36A]/15 transition-colors">
                        <stat.icon className="size-4.5" strokeWidth={1.5} />
                      </div>
                      <p className="text-2xl sm:text-3xl font-extrabold text-white/90">{stat.value}</p>
                      <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-white/35">{stat.label}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          SECTION 6 — MISSION / BRAND STATEMENT (VISUAL CLIMAX)
          ═══════════════════════════════════════════════════════════ */}
      <section className="relative py-32 sm:py-44 overflow-hidden" style={{ background: "linear-gradient(180deg, #0B0D0C 0%, #0a3d2e 50%, #0B0D0C 100%)" }}>
        {/* Atmospheric backdrop */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(22,163,106,0.12), transparent 65%)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 30% 25% at 50% 50%, rgba(216,184,120,0.06), transparent 55%)" }} />
        </div>
        <FloatingParticles count={16} />

        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
          <RevealSection>
            {/* Decorative divider */}
            <div className="mx-auto mb-10 h-px w-20 bg-gradient-to-r from-transparent via-[#16A36A]/50 to-transparent" />

            <h2 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black uppercase leading-[0.88] tracking-tight">
              <span className="bg-gradient-to-r from-[#F0D9A3] via-white to-[#16A36A] bg-clip-text text-transparent" style={{ WebkitTextFillColor: "transparent" }}>
                Your Health,
              </span>
              <br />
              <span className="bg-gradient-to-r from-[#16A36A] via-[#F0D9A3] to-white bg-clip-text text-transparent" style={{ WebkitTextFillColor: "transparent" }}>
                Our Priority
              </span>
            </h2>

            <p className="mt-8 text-lg sm:text-xl md:text-2xl font-light leading-relaxed text-white/45 max-w-2xl mx-auto">
              Making everyday healthcare simpler, more convenient and accessible
              through Kalyan Chemist.
            </p>

            {/* Decorative divider */}
            <div className="mx-auto mt-10 h-px w-20 bg-gradient-to-r from-transparent via-[#D8B878]/40 to-transparent" />
          </RevealSection>

          {/* CTA */}
          <RevealSection delay={0.2} className="mt-14">
            <button
              onClick={() => navigate("/products")}
              className="group inline-flex items-center gap-3 rounded-full bg-[#16A36A] px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-[#16A36A]/20 hover:bg-[#128a55] transition-all duration-300 hover:shadow-xl hover:shadow-[#16A36A]/30 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            >
              Explore Kalyan Chemist
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </RevealSection>
        </div>
      </section>

      <Footer />
    </div>
  );
}
