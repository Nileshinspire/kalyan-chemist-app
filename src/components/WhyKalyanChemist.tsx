import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck, Truck, Clock3, Pill, Shield, Plus } from "lucide-react";

/* ── Existing trust points (content unchanged) ── */
const TRUST_POINTS = [
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

/* ── Premium soft-3D trust illustration (Kalyan Chemist palette) ── */
function TrustIllustration() {
  return (
    <svg viewBox="0 0 260 200" fill="none" className="size-full" aria-hidden="true">
      <defs>
        <radialGradient id="wkcGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#2DD4BF" stopOpacity="0.45" />
          <stop offset="1" stopColor="#2DD4BF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="wkcSpot" cx="0.5" cy="0.05" r="0.9">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.28" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="wkcShield" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#5EEAD4" />
          <stop offset="0.5" stopColor="#22C7AE" />
          <stop offset="1" stopColor="#0B7F72" />
        </linearGradient>
        <linearGradient id="wkcShieldIn" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#F0FDFA" />
          <stop offset="1" stopColor="#C9F5EA" />
        </linearGradient>
        <linearGradient id="wkcCross" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14B8A6" />
          <stop offset="1" stopColor="#0B7F72" />
        </linearGradient>
        <linearGradient id="wkcBadge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34D399" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
        <linearGradient id="wkcCard" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E4FAF3" />
        </linearGradient>
        <linearGradient id="wkcCapA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FDBA74" />
          <stop offset="1" stopColor="#F97316" />
        </linearGradient>
        <linearGradient id="wkcCapB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5EEAD4" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
      </defs>

      {/* ambient light + depth rings */}
      <circle cx="130" cy="98" r="84" fill="url(#wkcGlow)" />
      <circle cx="130" cy="98" r="74" stroke="#5EEAD4" strokeOpacity="0.35" strokeWidth="1.4" strokeDasharray="3 7" fill="none" />
      <ellipse cx="130" cy="98" rx="104" ry="46" stroke="#99F6E4" strokeOpacity="0.16" strokeWidth="1.2" fill="none" />
      <ellipse cx="130" cy="98" rx="104" ry="46" fill="url(#wkcSpot)" />

      {/* ground shadow */}
      <ellipse cx="130" cy="184" rx="64" ry="9" fill="#022C26" opacity="0.32" />
      <ellipse cx="130" cy="184" rx="40" ry="5" fill="#022C26" opacity="0.22" />

      {/* ── main trust shield ── */}
      <g data-kc-why data-kc-why-anim style={{ animation: "kc-why-floatA 6s ease-in-out infinite" }}>
        <path
          d="M130 20 L206 48 V100 C206 145 174 177 130 192 C86 177 54 145 54 100 V48 Z"
          fill="url(#wkcShield)"
        />
        {/* raised top bevel */}
        <path d="M130 20 L206 48 V58 L130 30 L54 58 V48 Z" fill="#A7F3E2" opacity="0.4" />
        {/* rim light along the left edge */}
        <path d="M57 51 V100 C57 140 82 169 118 185" stroke="#FFFFFF" strokeOpacity="0.35" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        {/* recessed face */}
        <path
          d="M130 40 L187 62 V100 C187 134 162 159 130 170 C98 159 73 134 73 100 V62 Z"
          fill="url(#wkcShieldIn)"
        />
        <path
          d="M130 40 L187 62 V100 C187 134 162 159 130 170 C98 159 73 134 73 100 V62 Z"
          fill="none"
          stroke="#0D9488"
          strokeOpacity="0.35"
          strokeWidth="1.4"
        />
        {/* medical cross */}
        <rect x="118" y="72" width="24" height="60" rx="8" fill="url(#wkcCross)" />
        <rect x="100" y="90" width="60" height="24" rx="8" fill="url(#wkcCross)" />
        <rect x="122" y="76" width="6" height="52" rx="3" fill="#5EEAD4" opacity="0.55" />
        <rect x="104" y="94" width="52" height="6" rx="3" fill="#5EEAD4" opacity="0.4" />
        {/* soft cast shadow inside the recess */}
        <ellipse cx="130" cy="150" rx="30" ry="6" fill="#0B7F72" opacity="0.14" />
      </g>

      {/* verified badge */}
      <g>
        <circle cx="188" cy="146" r="19" fill="#0B7F72" opacity="0.35" />
        <circle cx="186" cy="143" r="18" fill="url(#wkcBadge)" stroke="#FFFFFF" strokeWidth="2.4" />
        <path d="M178 143 l5.5 5.5 l11 -12" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* floating medicine strip */}
      <g data-kc-why-anim style={{ animation: "kc-why-floatB 5.2s ease-in-out infinite" }}>
        <g transform="rotate(-11 49 132)">
          <rect x="20" y="112" width="58" height="40" rx="9" fill="url(#wkcCard)" stroke="#99F6E4" strokeWidth="1.4" />
          <rect x="20" y="112" width="58" height="8" rx="4" fill="#14B8A6" opacity="0.5" />
          <circle cx="33" cy="131" r="5" fill="#D6F7ED" stroke="#0D9488" strokeWidth="1.2" />
          <circle cx="49" cy="131" r="5" fill="#D6F7ED" stroke="#0D9488" strokeWidth="1.2" />
          <circle cx="65" cy="131" r="5" fill="#D6F7ED" stroke="#0D9488" strokeWidth="1.2" />
          <rect x="28" y="141" width="22" height="0" rx="1" fill="none" />
          <rect x="28" y="141" width="26" height="3" rx="1.5" fill="#99F6E4" />
          <rect x="28" y="146" width="16" height="2.6" rx="1.3" fill="#CCFBF1" />
        </g>
      </g>

      {/* floating capsule */}
      <g data-kc-why-anim style={{ animation: "kc-why-floatC 5.8s ease-in-out infinite" }}>
        <g transform="rotate(-28 214 74)">
          <rect x="196" y="66" width="18" height="16" rx="8" fill="url(#wkcCapA)" />
          <rect x="212" y="66" width="18" height="16" rx="8" fill="url(#wkcCapB)" />
          <rect x="199" y="70" width="6" height="3" rx="1.5" fill="#FFFFFF" opacity="0.7" />
        </g>
      </g>

      {/* translucent healthcare crosses */}
      <path d="M62 46 v14 M55 53 h14" stroke="#CCFBF1" strokeOpacity="0.5" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M210 156 v10 M205 161 h10" stroke="#FDE68A" strokeOpacity="0.45" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M36 78 v9 M31.5 82.5 h9" stroke="#93C5FD" strokeOpacity="0.4" strokeWidth="2.2" strokeLinecap="round" />

      {/* sparkles */}
      <path d="M214 32 l1.9 4.6 4.6 1.9 -4.6 1.9 -1.9 4.6 -1.9 -4.6 -4.6 -1.9 4.6 -1.9 Z" fill="#5EEAD4" opacity="0.85" />
      <path d="M44 158 l1.5 3.6 3.6 1.5 -3.6 1.5 -1.5 3.6 -1.5 -3.6 -3.6 -1.5 3.6 -1.5 Z" fill="#FB923C" opacity="0.8" />
      <path d="M228 104 l1.2 2.9 2.9 1.2 -2.9 1.2 -1.2 2.9 -1.2 -2.9 -2.9 -1.2 2.9 -1.2 Z" fill="#A78BFA" opacity="0.6" />
    </svg>
  );
}

export default function WhyKalyanChemist() {
  const prefersReducedMotion = useReducedMotion();

  const container = {
    hidden: {},
    visible: { transition: { staggerChildren: prefersReducedMotion ? 0 : 0.08 } },
  };

  const item = {
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 14 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
  };

  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <style>{`
        @keyframes kc-why-floatA {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes kc-why-floatB {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes kc-why-floatC {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(1.5px, -4px); }
        }
        @keyframes kc-why-orb-a {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(30px, -22px); }
        }
        @keyframes kc-why-orb-b {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-26px, 20px); }
        }
        @keyframes kc-why-orb-c {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(18px, 16px); }
        }
        @media (prefers-reduced-motion: reduce) {
          [data-kc-why-anim] { animation: none !important; }
        }
      `}</style>

      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        variants={container}
        className="relative overflow-hidden rounded-[28px] border border-emerald-300/20 shadow-[0_28px_70px_-28px_rgba(4,60,52,0.6)]"
      >
        {/* ── Layered premium backdrop ── */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {/* base colour wash */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#052e29] via-[#0a4a42] to-[#0d6b5f]" />
          {/* radial light zones */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(45,212,191,0.40),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(96,165,250,0.26),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(251,146,60,0.20),transparent_52%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.16),transparent_50%)]" />
          {/* ambient top light */}
          <div className="absolute inset-x-0 -top-24 h-56 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.16),transparent_70%)]" />
          {/* depth vignette keeps text crisp */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(2,26,23,0.5))]" />

          {/* faint healthcare dot grid */}
          <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(204,251,241,0.16)_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black_28%,transparent_78%)]" />

          {/* slowly drifting colour orbs */}
          <div
            data-kc-why-anim
            className="absolute -top-24 -left-24 size-72 rounded-full bg-teal-300/25 blur-3xl"
            style={{ animation: "kc-why-orb-a 24s ease-in-out infinite" }}
          />
          <div
            data-kc-why-anim
            className="absolute -right-24 -bottom-28 size-80 rounded-full bg-sky-400/20 blur-3xl"
            style={{ animation: "kc-why-orb-b 28s ease-in-out infinite" }}
          />
          <div
            data-kc-why-anim
            className="absolute -right-10 top-1/4 size-56 rounded-full bg-emerald-300/20 blur-3xl"
            style={{ animation: "kc-why-orb-c 22s ease-in-out infinite" }}
          />
          <div
            data-kc-why-anim
            className="absolute -bottom-20 left-1/3 size-56 rounded-full bg-orange-300/15 blur-3xl"
            style={{ animation: "kc-why-orb-a 30s ease-in-out infinite" }}
          />

          {/* translucent abstract shapes for depth */}
          <div className="absolute right-10 top-8 size-28 rounded-full border border-white/10" />
          <div className="absolute -left-10 bottom-16 size-40 rotate-12 rounded-[2.5rem] border border-white/10" />
          <div className="absolute right-1/3 -bottom-6 size-24 rounded-full border border-dashed border-teal-200/15" />
          <Plus className="absolute left-[8%] top-6 size-4 rotate-12 text-teal-200/25" />
          <Plus className="absolute bottom-8 left-[46%] size-3.5 rotate-45 text-sky-200/20" />
          <Plus className="absolute right-[6%] bottom-10 size-4 -rotate-12 text-orange-200/25" />
        </div>

        {/* ── Headline + 3D visual ── */}
        <div className="relative grid items-center gap-6 px-6 pb-2 pt-8 sm:px-8 sm:pt-9 lg:grid-cols-[1.08fr_0.92fr] lg:gap-6 lg:pb-3">
          <motion.div variants={item}>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100">
              <Shield className="size-3" />
              Why Choose Us
            </div>
            <h2 className="mt-3 bg-gradient-to-br from-white via-white to-emerald-200 bg-clip-text text-[28px] font-bold leading-[1.1] tracking-tight text-transparent sm:text-4xl lg:text-[42px]">
              Why Kalyan Chemist
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-emerald-50/75 sm:text-[15px]">
              We are committed to making quality healthcare accessible, reliable,
              and convenient for every household.
            </p>
          </motion.div>

          <motion.div variants={item} className="relative mx-auto w-full max-w-[300px] lg:max-w-none">
            {/* soft ambient glow seating the illustration into the banner */}
            <div className="absolute inset-x-6 top-8 bottom-4 rounded-full bg-teal-400/20 blur-2xl" />
            <div className="relative h-40 sm:h-44 lg:h-52">
              <TrustIllustration />
            </div>
          </motion.div>
        </div>

        {/* ── Trust points ── */}
        <motion.div
          variants={container}
          className="relative grid gap-3 border-t border-white/10 px-6 py-6 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:py-7"
        >
          {TRUST_POINTS.map((point) => (
            <motion.div
              key={point.title}
              variants={item}
              className="group relative rounded-2xl border border-white/10 bg-white/[0.06] p-4 [perspective:500px] transition-[transform,box-shadow,border-color,background-color] duration-300 ease-out hover:-translate-y-1 hover:border-emerald-300/30 hover:bg-white/[0.1] hover:shadow-[0_18px_36px_-18px_rgba(45,212,191,0.55)]"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-300/30 to-teal-500/20 text-emerald-50 ring-1 ring-inset ring-white/15 transition-[transform,box-shadow,background-image,color] duration-300 ease-out will-change-transform group-hover:from-emerald-300/50 group-hover:text-white group-hover:shadow-[0_10px_22px_-8px_rgba(45,212,191,0.75)] group-hover:[transform:translateY(-3px)_scale(1.06)_rotateX(8deg)_rotateY(-5deg)]">
                <point.icon className="size-5" strokeWidth={1.8} />
              </div>
              <h3 className="mt-3 text-sm font-semibold text-white transition-colors duration-300 group-hover:text-emerald-100">
                {point.title}
              </h3>
              <p className="mt-1.5 text-[12px] leading-relaxed text-emerald-50/70">
                {point.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
