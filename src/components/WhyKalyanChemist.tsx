import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Shield, FlaskConical, Truck, RefreshCw } from "lucide-react";

/* ─── constants ─── */
const EASE = [0.22, 1, 0.36, 1] as const;

interface CardData {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  glowColor: string;
  glowRgba: string;
  accentColor: string;
  active: boolean;
}

const CARDS: CardData[] = [
  {
    title: "Authentic Medicines",
    subtitle: "100% Verified Pharmacy Stock.",
    icon: Shield,
    glowColor: "#06b6d4",
    glowRgba: "rgba(6,182,212,0.35)",
    accentColor: "from-cyan-400 to-teal-500",
    active: false,
  },
  {
    title: "Expert Pharmacists",
    subtitle: "24/7 Professional Consultations.",
    icon: FlaskConical,
    glowColor: "#10b981",
    glowRgba: "rgba(16,185,129,0.35)",
    accentColor: "from-emerald-400 to-teal-400",
    active: true,
  },
  {
    title: "Fast Home Delivery",
    subtitle: "Quick, Reliable Doorstep Service.",
    icon: Truck,
    glowColor: "#22d3ee",
    glowRgba: "rgba(34,211,238,0.30)",
    accentColor: "from-cyan-300 to-blue-400",
    active: false,
  },
  {
    title: "Seamless Refills",
    subtitle: "Easy Online Subscription & Management.",
    icon: RefreshCw,
    glowColor: "#34d399",
    glowRgba: "rgba(52,211,153,0.30)",
    accentColor: "from-emerald-300 to-cyan-400",
    active: false,
  },
];

/* ─── floating decorative SVG elements ─── */
const FLOAT_ITEMS = [
  { x: "6%", y: "12%", size: 22, anim: "kcw-float1", delay: "0s", dur: "7s" },
  { x: "92%", y: "18%", size: 18, anim: "kcw-float2", delay: "1.2s", dur: "8s" },
  { x: "8%", y: "78%", size: 16, anim: "kcw-float3", delay: "2.1s", dur: "9s" },
  { x: "90%", y: "72%", size: 20, anim: "kcw-float1", delay: "0.8s", dur: "7.5s" },
  { x: "14%", y: "44%", size: 14, anim: "kcw-float2", delay: "3s", dur: "8.5s" },
  { x: "86%", y: "46%", size: 15, anim: "kcw-float3", delay: "1.8s", dur: "7.8s" },
  { x: "50%", y: "6%", size: 12, anim: "kcw-float1", delay: "2.5s", dur: "9.2s" },
  { x: "50%", y: "92%", size: 13, anim: "kcw-float2", delay: "0.4s", dur: "8.2s" },
];

const floatSvg = (kind: number) => {
  const c = "rgba(6,182,212,0.25)";
  const c2 = "rgba(16,185,129,0.22)";
  switch (kind) {
    case 0:
      return (
        <svg viewBox="0 0 24 24" fill="none" className="size-full">
          <rect x="6" y="3" width="12" height="18" rx="3" stroke={c} strokeWidth="1.4" />
          <rect x="8" y="6" width="8" height="5" rx="1.5" fill={c2} />
          <circle cx="12" cy="15.5" r="2.2" stroke={c} strokeWidth="1.2" />
        </svg>
      );
    case 1:
      return (
        <svg viewBox="0 0 24 24" fill="none" className="size-full">
          <path d="M12 2L4 7v5c0 5.5 3.4 9.7 8 11 4.6-1.3 8-5.5 8-11V7l-8-5z" stroke={c} strokeWidth="1.4" />
          <path d="M9 12l2 2 4-4" stroke={c2} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 2:
      return (
        <svg viewBox="0 0 24 24" fill="none" className="size-full">
          <rect x="4" y="2" width="16" height="20" rx="2" stroke={c} strokeWidth="1.4" />
          <line x1="12" y1="8" x2="12" y2="16" stroke={c2} strokeWidth="1.8" strokeLinecap="round" />
          <line x1="8" y1="12" x2="16" y2="12" stroke={c2} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 3:
      return (
        <svg viewBox="0 0 24 24" fill="none" className="size-full">
          <circle cx="12" cy="12" r="9" stroke={c} strokeWidth="1.4" />
          <circle cx="12" cy="12" r="4" stroke={c2} strokeWidth="1.2" />
          <line x1="12" y1="3" x2="12" y2="8" stroke={c} strokeWidth="1" />
          <line x1="12" y1="16" x2="12" y2="21" stroke={c} strokeWidth="1" />
          <line x1="3" y1="12" x2="8" y2="12" stroke={c} strokeWidth="1" />
          <line x1="16" y1="12" x2="21" y2="12" stroke={c} strokeWidth="1" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" className="size-full">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke={c} strokeWidth="1.4" />
        </svg>
      );
  }
};

/* ─── particle pool for powder-smoke effect ─── */
const PARTICLE_COUNT = 18;
const particleBase: Array<{
  x: number;
  y: number;
  size: number;
  delay: number;
  dur: number;
  dx: number;
  dy: number;
}> = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
  x: (Math.sin(i * 1.9) * 0.5 + 0.5) * 100,
  y: (Math.cos(i * 2.3) * 0.5 + 0.5) * 100,
  size: 2 + (i % 4) * 1.2,
  delay: (i * 0.12) % 1.5,
  dur: 2.2 + (i % 5) * 0.4,
  dx: (Math.sin(i * 3.1) * 40),
  dy: -(20 + (i % 6) * 8),
}));

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════ */
export default function WhyKalyanChemist() {
  const prefersReducedMotion = useReducedMotion();
  const [activeIdx, setActiveIdx] = useState(1);
  const [revealed, setRevealed] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tiltRaf = useRef<number | null>(null);
  const tiltData = useRef<{ el: HTMLDivElement; nx: number; ny: number } | null>(null);

  /* ── viewport reveal (once) ── */
  useEffect(() => {
    if (prefersReducedMotion) {
      setRevealed(true);
      return;
    }
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setRevealed(true);
          obs.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [prefersReducedMotion]);

  /* ── 3D tilt via pointer ── */
  const flushTilt = useCallback(() => {
    tiltRaf.current = null;
    const d = tiltData.current;
    if (!d) return;
    const r = d.el.getBoundingClientRect();
    if (!r.width) return;
    const rx = (d.ny * -8).toFixed(2);
    const ry = (d.nx * 8).toFixed(2);
    d.el.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translate3d(0,-6px,0) scale(1.03)`;
  }, []);

  const onCardPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      tiltData.current = { el, nx, ny };
      if (tiltRaf.current === null) {
        tiltRaf.current = requestAnimationFrame(flushTilt);
      }
    },
    [flushTilt]
  );

  const onCardPointerLeave = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      tiltData.current = null;
      e.currentTarget.style.transform = "";
    },
    []
  );

  useEffect(() => () => {
    if (tiltRaf.current !== null) cancelAnimationFrame(tiltRaf.current);
  }, []);

  /* ── stagger delays ── */
  const staggerDelay = useMemo(() => (i: number) => 0.15 + i * 0.12, []);

  /* ── reduced-motion fallback variants ── */
  const headVariants: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
  };
  const cardVariants: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 50, scale: 0.92 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.65, delay: staggerDelay(i), ease: EASE },
    }),
  };
  const footVariants: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, delay: 0.7, ease: EASE } },
  };

  return (
    <section ref={sectionRef} className="relative overflow-hidden py-20 sm:py-28 lg:py-32" style={{ background: "#08080C" }}>
      {/* ══════ INLINE KEYFRAMES ══════ */}
      <style>{`
        @keyframes kcw-float1{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-8px) rotate(3deg)}}
        @keyframes kcw-float2{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(6px) rotate(-2.5deg)}}
        @keyframes kcw-float3{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-5px) scale(1.06)}}
        @keyframes kcw-pulse{0%,100%{opacity:.3;transform:scale(.9)}50%{opacity:.7;transform:scale(1.1)}}
        @keyframes kcw-drift{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(20px,-14px,0)}}
        @keyframes kcw-particle{0%{opacity:0;transform:translate3d(0,8px,0) scale(.6)}25%{opacity:.85}100%{opacity:0;transform:translate3d(var(--px,20px),var(--py,-40px),0) scale(.3)}}
        @keyframes kcw-icon-glow{0%,100%{filter:drop-shadow(0 0 6px var(--gc)) brightness(1)}50%{filter:drop-shadow(0 0 14px var(--gc)) brightness(1.15)}}
        @media(prefers-reduced-motion:reduce){
          [data-kcw-float]{animation:none!important}
          .kcw-particle-wrap{display:none!important}
        }
      `}</style>

      {/* ══════ LAYER 1 — DEEP BACKGROUND ══════ */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {/* primary navy */}
        <div className="absolute inset-0" style={{ background: "#08080C" }} />
        {/* blue/purple radial zones */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 50% at 18% 25%, rgba(6,78,110,0.45), transparent 70%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 45% at 82% 70%, rgba(88,28,135,0.25), transparent 65%)" }} />
        {/* teal/emerald glow */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(16,185,129,0.12), transparent 60%)" }} />
        {/* cyan light spill */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 35% 60%, rgba(6,182,212,0.1), transparent 50%)" }} />
        {/* subtle warm accent */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 78% 30%, rgba(251,146,60,0.05), transparent 40%)" }} />
        {/* drifting ambient orbs */}
        <div data-kcw-float className="absolute -top-32 left-1/4 h-[340px] w-[45%] rounded-full bg-emerald-500/10 blur-[100px]" style={{ animation: "kcw-drift 22s ease-in-out infinite" }} />
        <div data-kcw-float className="absolute -bottom-36 right-1/3 h-[300px] w-[40%] rounded-full bg-cyan-500/8 blur-[90px]" style={{ animation: "kcw-drift 28s ease-in-out 4s infinite" }} />
        {/* subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* ══════ LAYER 2 — FLOATING HEALTHCARE ELEMENTS ══════ */}
      {!prefersReducedMotion && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {FLOAT_ITEMS.map((item, i) => (
            <div
              key={i}
              data-kcw-float
              className="absolute"
              style={{
                left: item.x,
                top: item.y,
                width: item.size,
                height: item.size,
                animation: `${item.anim} ${item.dur} ease-in-out ${item.delay} infinite`,
              }}
            >
              {floatSvg(i % 4)}
            </div>
          ))}
        </div>
      )}

      {/* ══════ LAYER 3 — CONTENT ══════ */}
      <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8">
        {/* ── TOP HEADING ── */}
        <motion.div
          initial="hidden"
          animate={revealed ? "visible" : "hidden"}
          variants={headVariants}
          className="text-center"
        >
          <h2 className="text-[clamp(2.4rem,6vw,5.5rem)] font-black uppercase leading-[0.95] tracking-tight text-white">
            <span className="bg-gradient-to-b from-white via-white/90 to-white/60 bg-clip-text text-transparent" style={{ WebkitTextFillColor: "transparent" }}>
              Why Choose Us?
            </span>
          </h2>
          <div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />
        </motion.div>

        {/* ── FOUR GLASS CARDS ── */}
        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {CARDS.map((card, i) => {
            const isActive = activeIdx === i;
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                custom={i}
                initial="hidden"
                animate={revealed ? "visible" : "hidden"}
                variants={cardVariants}
                ref={(el) => { cardRefs.current[i] = el; }}
                className="relative [perspective:900px]"
                onMouseEnter={() => setActiveIdx(i)}
              >
                {/* ── POWDER-SMOKE EFFECT (behind card) ── */}
                {isActive && !prefersReducedMotion && (
                  <div className="kcw-particle-wrap pointer-events-none absolute -inset-6 z-0 overflow-visible" aria-hidden="true">
                    {/* radial glow */}
                    <div
                      className="absolute inset-0 rounded-2xl"
                      style={{
                        background: `radial-gradient(ellipse at 50% 60%, ${card.glowRgba}, transparent 70%)`,
                        animation: "kcw-pulse 3s ease-in-out infinite",
                      }}
                    />
                    {/* particles */}
                    {particleBase.map((p, pi) => (
                      <span
                        key={pi}
                        className="absolute rounded-full"
                        style={{
                          left: `${p.x}%`,
                          top: `${p.y}%`,
                          width: p.size,
                          height: p.size,
                          background: pi % 3 === 0 ? card.glowColor : pi % 3 === 1 ? "rgba(34,211,238,0.6)" : "rgba(52,211,153,0.5)",
                          "--px": `${p.dx}px`,
                          "--py": `${p.dy}px`,
                          animation: `kcw-particle ${p.dur}s ease-out ${p.delay}s infinite`,
                        } as CSSProperties}
                      />
                    ))}
                  </div>
                )}

                {/* ── CARD BODY ── */}
                <div
                  className={`kcw-card group relative z-10 overflow-hidden rounded-2xl border p-6 transition-[transform,box-shadow,border-color] duration-[280ms] ease-out will-change-transform ${
                    isActive
                      ? "border-white/15 shadow-[0_8px_40px_-8px_rgba(6,182,212,0.3)]"
                      : "border-white/[0.07] shadow-[0_4px_24px_-6px_rgba(0,0,0,0.5)]"
                  }`}
                  style={{
                    background: isActive
                      ? "linear-gradient(160deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.03) 100%)"
                      : "linear-gradient(160deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)",
                    backdropFilter: "blur(18px) saturate(1.4)",
                    WebkitBackdropFilter: "blur(18px) saturate(1.4)",
                  }}
                  onPointerMove={!prefersReducedMotion ? onCardPointerMove : undefined}
                  onPointerLeave={!prefersReducedMotion ? onCardPointerLeave : undefined}
                >
                  {/* inner highlight edge */}
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px"
                    style={{
                      background: isActive
                        ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)"
                        : "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
                    }}
                  />
                  {/* glass sheen overlay on hover */}
                  <div
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    style={{
                      background: "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 50%, rgba(255,255,255,0.02) 100%)",
                    }}
                  />

                  {/* icon */}
                  <div
                    className={`relative mb-5 flex size-14 items-center justify-center rounded-xl transition-all duration-300 ${
                      isActive
                        ? "bg-gradient-to-br from-white/10 to-white/5 shadow-[0_0_28px_-4px_" + card.glowColor + "40]"
                        : "bg-white/[0.06] group-hover:bg-white/[0.09]"
                    }`}
                    style={
                      isActive
                        ? { ["--gc" as string]: card.glowColor, animation: "kcw-icon-glow 3.5s ease-in-out infinite" }
                        : undefined
                    }
                  >
                    <Icon
                      className={`size-7 transition-all duration-300 ${
                        isActive ? "text-white drop-shadow-lg" : "text-white/60 group-hover:text-white/85"
                      }`}
                      strokeWidth={1.6}
                    />
                  </div>

                  {/* text */}
                  <h3
                    className={`text-base font-bold uppercase tracking-wide transition-colors duration-300 ${
                      isActive ? "text-white" : "text-white/70 group-hover:text-white/90"
                    }`}
                  >
                    {card.title}
                  </h3>
                  <p
                    className={`mt-2 text-sm leading-relaxed transition-colors duration-300 ${
                      isActive ? "text-white/55" : "text-white/35 group-hover:text-white/50"
                    }`}
                  >
                    {card.subtitle}
                  </p>

                  {/* active indicator bar */}
                  <div
                    className={`absolute bottom-0 left-0 h-[2px] transition-all duration-500 ${
                      isActive ? "w-full" : "w-0"
                    }`}
                    style={{
                      background: `linear-gradient(90deg, transparent, ${card.glowColor}, transparent)`,
                    }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── BOTTOM HEADING ── */}
        <motion.div
          initial="hidden"
          animate={revealed ? "visible" : "hidden"}
          variants={footVariants}
          className="mt-14 text-center"
        >
          <h2 className="text-[clamp(1.6rem,4vw,3.5rem)] font-black uppercase leading-[1.05] tracking-tight">
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-300 to-teal-400 bg-clip-text text-transparent" style={{ WebkitTextFillColor: "transparent" }}>
              Your Health, Our Priority
            </span>
          </h2>
        </motion.div>
      </div>
    </section>
  );
}
