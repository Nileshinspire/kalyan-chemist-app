import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Shield, FlaskConical, Truck, RefreshCw } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTANTS
   ═══════════════════════════════════════════════════════════════════════════ */
const EASE = [0.22, 1, 0.36, 1] as const;

interface CardData {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  glowColor: string;
  glowRgba: string;
}

const CARDS: CardData[] = [
  { title: "Authentic Medicines", subtitle: "100% Verified Pharmacy Stock.", icon: Shield, glowColor: "#06b6d4", glowRgba: "rgba(6,182,212,0.35)" },
  { title: "Expert Pharmacists", subtitle: "24/7 Professional Consultations.", icon: FlaskConical, glowColor: "#10b981", glowRgba: "rgba(16,185,129,0.35)" },
  { title: "Fast Home Delivery", subtitle: "Quick, Reliable Doorstep Service.", icon: Truck, glowColor: "#22d3ee", glowRgba: "rgba(34,211,238,0.30)" },
  { title: "Seamless Refills", subtitle: "Easy Online Subscription & Management.", icon: RefreshCw, glowColor: "#34d399", glowRgba: "rgba(52,211,153,0.30)" },
];

/* ─── Orbiting 3D objects ─── */
interface OrbitObj {
  label: string;
  orbitRadius: number;
  orbitTilt: number;
  orbitSpeed: number;
  selfRotSpeed: number;
  startAngle: number;
  size: number;
  glow: string;
}

const ORBIT_OBJECTS: OrbitObj[] = [
  { label: "capsule", orbitRadius: 155, orbitTilt: 18, orbitSpeed: 28, selfRotSpeed: 9, startAngle: 0, size: 36, glow: "rgba(6,182,212,0.4)" },
  { label: "shield", orbitRadius: 140, orbitTilt: -12, orbitSpeed: 34, selfRotSpeed: 12, startAngle: 90, size: 30, glow: "rgba(16,185,129,0.35)" },
  { label: "cross", orbitRadius: 165, orbitTilt: 8, orbitSpeed: 22, selfRotSpeed: 7, startAngle: 180, size: 26, glow: "rgba(34,211,238,0.3)" },
  { label: "bottle", orbitRadius: 130, orbitTilt: -20, orbitSpeed: 38, selfRotSpeed: 14, startAngle: 270, size: 32, glow: "rgba(52,211,153,0.35)" },
  { label: "plus", orbitRadius: 175, orbitTilt: 5, orbitSpeed: 26, selfRotSpeed: 11, startAngle: 45, size: 22, glow: "rgba(6,182,212,0.25)" },
  { label: "pill", orbitRadius: 148, orbitTilt: -8, orbitSpeed: 32, selfRotSpeed: 10, startAngle: 135, size: 28, glow: "rgba(251,146,60,0.25)" },
];

/* ═══════════════════════════════════════════════════════════════════════════
   3D ORBITING OBJECT SVGs
   ═══════════════════════════════════════════════════════════════════════════ */
function OrbitSvg({ label }: { label: string }) {
  switch (label) {
    case "capsule":
      return (
        <svg viewBox="0 0 40 20" fill="none" className="size-full">
          <rect x="1" y="1" width="18" height="18" rx="9" fill="url(#orbCapsuleA)" />
          <rect x="19" y="1" width="18" height="18" rx="9" fill="url(#orbCapsuleB)" />
          <rect x="8" y="6" width="6" height="3" rx="1.5" fill="#fff" opacity="0.6" />
          <defs>
            <linearGradient id="orbCapsuleA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FBBF24" />
              <stop offset="1" stopColor="#F59E0B" />
            </linearGradient>
            <linearGradient id="orbCapsuleB" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#22D3EE" />
              <stop offset="1" stopColor="#0D9488" />
            </linearGradient>
          </defs>
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 32 36" fill="none" className="size-full">
          <path d="M16 2L30 8V18C30 26 24 32 16 34C8 32 2 26 2 18V8L16 2Z" fill="url(#orbShield)" stroke="#A7F3D0" strokeWidth="1.2" />
          <path d="M12 17l3 3 6-7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <defs>
            <linearGradient id="orbShield" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#34D399" />
              <stop offset="1" stopColor="#0D9488" />
            </linearGradient>
          </defs>
        </svg>
      );
    case "cross":
      return (
        <svg viewBox="0 0 28 28" fill="none" className="size-full">
          <rect x="9" y="2" width="10" height="24" rx="4" fill="url(#orbCross)" />
          <rect x="2" y="9" width="24" height="10" rx="4" fill="url(#orbCross)" />
          <rect x="11.5" y="5" width="5" height="18" rx="2.5" fill="#A7F3D0" opacity="0.4" />
          <defs>
            <linearGradient id="orbCross" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#06B6D4" />
              <stop offset="1" stopColor="#0891B2" />
            </linearGradient>
          </defs>
        </svg>
      );
    case "bottle":
      return (
        <svg viewBox="0 0 24 36" fill="none" className="size-full">
          <rect x="7" y="0" width="10" height="6" rx="3" fill="#0D9488" />
          <rect x="3" y="6" width="18" height="28" rx="5" fill="url(#orbBottle)" stroke="#A7F3D0" strokeWidth="1" />
          <path d="M12 16v6M9 19h6" stroke="#0D9488" strokeWidth="2" strokeLinecap="round" />
          <defs>
            <linearGradient id="orbBottle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="1" stopColor="#D1FAE5" />
            </linearGradient>
          </defs>
        </svg>
      );
    case "plus":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="size-full">
          <rect x="8" y="2" width="8" height="20" rx="4" fill="url(#orbPlus)" opacity="0.7" />
          <rect x="2" y="8" width="20" height="8" rx="4" fill="url(#orbPlus)" opacity="0.7" />
          <defs>
            <linearGradient id="orbPlus" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#22D3EE" />
              <stop offset="1" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
        </svg>
      );
    case "pill":
      return (
        <svg viewBox="0 0 32 18" fill="none" className="size-full">
          <rect x="1" y="1" width="14" height="16" rx="7" fill="url(#orbPillA)" />
          <rect x="15" y="1" width="16" height="16" rx="7" fill="url(#orbPillB)" />
          <defs>
            <linearGradient id="orbPillA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FB923C" />
              <stop offset="1" stopColor="#F97316" />
            </linearGradient>
            <linearGradient id="orbPillB" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#34D399" />
              <stop offset="1" stopColor="#10B981" />
            </linearGradient>
          </defs>
        </svg>
      );
    default:
      return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   KC SHIELD SVG (the rotating 3D logo)
   ═══════════════════════════════════════════════════════════════════════════ */
function KCShield() {
  return (
    <svg viewBox="0 0 200 230" fill="none" className="size-full" aria-label="Kalyan Chemist Logo">
      <defs>
        <linearGradient id="kcFaceA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34D399" />
          <stop offset="0.5" stopColor="#10B981" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
        <linearGradient id="kcFaceInner" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.5" stopColor="#ECFDF5" />
          <stop offset="1" stopColor="#D1FAE5" />
        </linearGradient>
        <linearGradient id="kcCross" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0D9488" />
          <stop offset="1" stopColor="#065F46" />
        </linearGradient>
        <linearGradient id="kcEdge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5EEAD4" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
      </defs>

      {/* outer glow */}
      <ellipse cx="100" cy="115" rx="88" ry="100" fill="#2DD4BF" opacity="0.08" />

      {/* shield body */}
      <path d="M100 8 L185 48 V130 C185 185 150 215 100 228 C50 215 15 185 15 130 V48 Z" fill="url(#kcFaceA)" />

      {/* top bevel highlight */}
      <path d="M100 8 L185 48 V56 L100 22 L15 56 V48 Z" fill="#A7F3D0" opacity="0.4" />

      {/* left rim */}
      <path d="M18 52 V130 C18 178 46 208 85 220" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* inner face */}
      <path d="M100 32 L165 60 V130 C165 172 138 198 100 210 C62 198 35 172 35 130 V60 Z" fill="url(#kcFaceInner)" />
      <path d="M100 32 L165 60 V130 C165 172 138 198 100 210 C62 198 35 172 35 130 V60 Z" fill="none" stroke="#0D9488" strokeOpacity="0.18" strokeWidth="1.2" />

      {/* medical cross */}
      <rect x="86" y="72" width="28" height="80" rx="9" fill="url(#kcCross)" />
      <rect x="66" y="96" width="68" height="28" rx="9" fill="url(#kcCross)" />
      <rect x="90" y="78" width="8" height="68" rx="4" fill="#5EEAD4" opacity="0.5" />
      <rect x="70" y="100" width="60" height="8" rx="4" fill="#5EEAD4" opacity="0.35" />

      {/* KC text */}
      <text x="100" y="158" textAnchor="middle" fontSize="28" fontWeight="900" fontFamily="system-ui, sans-serif" fill="#0D9488" opacity="0.85" letterSpacing="2">KC</text>

      {/* subtle reflection */}
      <ellipse cx="100" cy="185" rx="40" ry="6" fill="#0D9488" opacity="0.1" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function WhyKalyanChemist() {
  const prefersReducedMotion = useReducedMotion();
  const [activeIdx, setActiveIdx] = useState(1);
  const [revealed, setRevealed] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const tiltRaf = useRef<number | null>(null);
  const tiltData = useRef<{ el: HTMLDivElement; nx: number; ny: number } | null>(null);
  const parallaxRaf = useRef<number | null>(null);
  const parallaxTarget = useRef({ nx: 0, ny: 0 });
  const parallaxCurrent = useRef({ nx: 0, ny: 0 });

  /* ── viewport reveal ── */
  useEffect(() => {
    if (prefersReducedMotion) { setRevealed(true); return; }
    const el = sectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setRevealed(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [prefersReducedMotion]);

  /* ── scene parallax (smooth lerp) ── */
  const flushParallax = useCallback(() => {
    parallaxRaf.current = null;
    const s = sceneRef.current;
    if (!s) return;
    parallaxCurrent.current.nx += (parallaxTarget.current.nx - parallaxCurrent.current.nx) * 0.08;
    parallaxCurrent.current.ny += (parallaxTarget.current.ny - parallaxCurrent.current.ny) * 0.08;
    const { nx, ny } = parallaxCurrent.current;
    s.style.transform = `translate3d(${nx * 18}px, ${ny * 14}px, 0) rotateX(${ny * -4}deg) rotateY(${nx * 5}deg)`;
    if (Math.abs(parallaxTarget.current.nx - nx) > 0.001 || Math.abs(parallaxTarget.current.ny - ny) > 0.001) {
      parallaxRaf.current = requestAnimationFrame(flushParallax);
    }
  }, []);

  const queueParallax = useCallback(() => {
    if (parallaxRaf.current !== null) return;
    parallaxRaf.current = requestAnimationFrame(flushParallax);
  }, [flushParallax]);

  const onSectionPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (prefersReducedMotion) return;
      const r = e.currentTarget.getBoundingClientRect();
      parallaxTarget.current = {
        nx: (e.clientX - r.left) / r.width - 0.5,
        ny: (e.clientY - r.top) / r.height - 0.5,
      };
      queueParallax();
    },
    [prefersReducedMotion, queueParallax]
  );

  const onSectionPointerLeave = useCallback(() => {
    parallaxTarget.current = { nx: 0, ny: 0 };
    queueParallax();
  }, [queueParallax]);

  /* ── card 3D tilt ── */
  const flushTilt = useCallback(() => {
    tiltRaf.current = null;
    const d = tiltData.current;
    if (!d) return;
    const r = d.el.getBoundingClientRect();
    if (!r.width) return;
    d.el.style.transform = `perspective(800px) rotateX(${(d.ny * -10).toFixed(2)}deg) rotateY(${(d.nx * 10).toFixed(2)}deg) translate3d(0,-8px,0) scale(1.04)`;
  }, []);

  const onCardPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      tiltData.current = { el, nx: (e.clientX - r.left) / r.width - 0.5, ny: (e.clientY - r.top) / r.height - 0.5 };
      if (tiltRaf.current === null) tiltRaf.current = requestAnimationFrame(flushTilt);
    },
    [flushTilt]
  );

  const onCardPointerLeave = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    tiltData.current = null;
    e.currentTarget.style.transform = "";
  }, []);

  useEffect(() => () => {
    if (tiltRaf.current !== null) cancelAnimationFrame(tiltRaf.current);
    if (parallaxRaf.current !== null) cancelAnimationFrame(parallaxRaf.current);
  }, []);

  /* ── variants ── */
  const headV: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 50, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.8, ease: EASE } },
  };
  const sceneV: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.8, rotateY: -15 },
    visible: { opacity: 1, scale: 1, rotateY: 0, transition: { duration: 1, delay: 0.15, ease: EASE } },
  };
  const cardV: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 60, scale: 0.9 },
    visible: (i: number) => ({
      opacity: 1, y: 0, scale: 1,
      transition: { duration: 0.7, delay: 0.35 + i * 0.12, ease: EASE },
    }),
  };
  const footV: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, delay: 0.9, ease: EASE } },
  };

  /* ── particle data (memoised) ── */
  const particles = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        x: (Math.sin(i * 1.7) * 0.5 + 0.5) * 100,
        y: (Math.cos(i * 2.1) * 0.5 + 0.5) * 100,
        size: 1.5 + (i % 4) * 0.9,
        delay: (i * 0.15) % 2,
        dur: 2.4 + (i % 5) * 0.5,
        dx: Math.sin(i * 2.8) * 35,
        dy: -(18 + (i % 6) * 7),
      })),
    []
  );

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-20 sm:py-28 lg:py-36"
      style={{ background: "#06060A" }}
      onPointerMove={!prefersReducedMotion ? onSectionPointerMove : undefined}
      onPointerLeave={!prefersReducedMotion ? onSectionPointerLeave : undefined}
    >
      {/* ════ KEYFRAMES ════ */}
      <style>{`
        /* 3D logo rotation */
        @keyframes kcw-logo-spin{from{transform:rotateY(0deg) rotateX(6deg)}to{transform:rotateY(360deg) rotateX(6deg)}}
        /* orbit path animations */
        @keyframes kcw-orbit-0{from{transform:rotateY(0deg) translateX(155px) rotateY(0deg)}to{transform:rotateY(360deg) translateX(155px) rotateY(-360deg)}}
        @keyframes kcw-orbit-1{from{transform:rotateY(90deg) translateX(140px) rotateY(-90deg)}to{transform:rotateY(450deg) translateX(140px) rotateY(-450deg)}}
        @keyframes kcw-orbit-2{from{transform:rotateY(180deg) translateX(165px) rotateY(-180deg)}to{transform:rotateY(540deg) translateX(165px) rotateY(-540deg)}}
        @keyframes kcw-orbit-3{from{transform:rotateY(270deg) translateX(130px) rotateY(-270deg)}to{transform:rotateY(630deg) translateX(130px) rotateY(-630deg)}}
        @keyframes kcw-orbit-4{from{transform:rotateY(45deg) translateX(175px) rotateY(-45deg)}to{transform:rotateY(405deg) translateX(175px) rotateY(-405deg)}}
        @keyframes kcw-orbit-5{from{transform:rotateY(135deg) translateX(148px) rotateY(-135deg)}to{transform:rotateY(495deg) translateX(148px) rotateY(-495deg)}}
        /* object self-rotation */
        @keyframes kcw-obj-rot{from{transform:rotateY(0deg) rotateX(15deg)}to{transform:rotateY(360deg) rotateX(15deg)}}
        /* floating ambient objects */
        @keyframes kcw-deco-f1{0%,100%{transform:translateY(0) rotate3d(1,1,0,0deg)}50%{transform:translateY(-10px) rotate3d(1,1,0,8deg)}}
        @keyframes kcw-deco-f2{0%,100%{transform:translateY(0) rotate3d(0,1,1,0deg)}50%{transform:translateY(8px) rotate3d(0,1,1,-6deg)}}
        @keyframes kcw-deco-f3{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-6px) scale(1.08)}}
        /* ambient drift */
        @keyframes kcw-drift{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(24px,-16px,0)}}
        /* pulse glow */
        @keyframes kcw-pulse{0%,100%{opacity:.25;transform:scale(.92)}50%{opacity:.6;transform:scale(1.08)}}
        /* particle float */
        @keyframes kcw-particle{0%{opacity:0;transform:translate3d(0,10px,0) scale(.5)}20%{opacity:.9}100%{opacity:0;transform:translate3d(var(--px,20px),var(--py,-40px),0) scale(.2)}}
        /* icon glow */
        @keyframes kcw-iglow{0%,100%{filter:drop-shadow(0 0 8px var(--gc)) brightness(1)}50%{filter:drop-shadow(0 0 18px var(--gc)) brightness(1.2)}}
        /* ring pulse */
        @keyframes kcw-ring{0%,100%{transform:scale(1);opacity:.15}50%{transform:scale(1.06);opacity:.3}}
        @media(prefers-reduced-motion:reduce){
          [data-kcw-anim]{animation:none!important}
          .kcw-particles{display:none!important}
        }
      `}</style>

      {/* ════ LAYER 1 — BACKGROUND ════ */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0" style={{ background: "#06060A" }} />
        {/* blue-indigo */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 75% 55% at 15% 20%, rgba(30,58,138,0.5), transparent 70%)" }} />
        {/* purple */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 50% at 85% 75%, rgba(88,28,135,0.3), transparent 60%)" }} />
        {/* teal center */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 55% 45% at 50% 50%, rgba(16,185,129,0.14), transparent 55%)" }} />
        {/* cyan spill */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 30% 55%, rgba(6,182,212,0.1), transparent 45%)" }} />
        {/* coral accent */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 80% 25%, rgba(251,146,60,0.06), transparent 35%)" }} />
        {/* drifting orbs */}
        <div data-kcw-anim className="absolute -top-28 left-[20%] h-[380px] w-[42%] rounded-full bg-emerald-500/8 blur-[110px]" style={{ animation: "kcw-drift 24s ease-in-out infinite" }} />
        <div data-kcw-anim className="absolute -bottom-32 right-[22%] h-[340px] w-[38%] rounded-full bg-cyan-500/7 blur-[100px]" style={{ animation: "kcw-drift 30s ease-in-out 5s infinite" }} />
        <div data-kcw-anim className="absolute top-1/3 -left-20 h-[260px] w-[30%] rounded-full bg-indigo-500/6 blur-[90px]" style={{ animation: "kcw-drift 26s ease-in-out 2s infinite" }} />
        {/* grid */}
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)", backgroundSize: "64px 64px" }} />
      </div>

      {/* ════ LAYER 2 — DECORATIVE FLOATING OBJECTS ════ */}
      {!prefersReducedMotion && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {[
            { x: "5%", y: "10%", size: 20, anim: "kcw-deco-f1", delay: "0s", dur: "7.5s", kind: 0 },
            { x: "93%", y: "15%", size: 17, anim: "kcw-deco-f2", delay: "1.1s", dur: "8.2s", kind: 1 },
            { x: "7%", y: "80%", size: 15, anim: "kcw-deco-f3", delay: "2.3s", dur: "9s", kind: 2 },
            { x: "91%", y: "75%", size: 19, anim: "kcw-deco-f1", delay: "0.6s", dur: "7.8s", kind: 3 },
            { x: "15%", y: "45%", size: 13, anim: "kcw-deco-f2", delay: "3.2s", dur: "8.6s", kind: 4 },
            { x: "85%", y: "48%", size: 14, anim: "kcw-deco-f3", delay: "1.5s", dur: "8s", kind: 5 },
          ].map((d, i) => (
            <div
              key={i}
              data-kcw-anim
              className="absolute"
              style={{ left: d.x, top: d.y, width: d.size, height: d.size, animation: `${d.anim} ${d.dur} ease-in-out ${d.delay} infinite` }}
            >
              <OrbitSvg label={ORBIT_OBJECTS[d.kind].label} />
            </div>
          ))}
        </div>
      )}

      {/* ════ LAYER 3 — CONTENT ════ */}
      <div className="relative z-10 mx-auto max-w-7xl px-5 sm:px-8">
        {/* ── TOP HEADING ── */}
        <motion.div initial="hidden" animate={revealed ? "visible" : "hidden"} variants={headV} className="text-center mb-12 sm:mb-16">
          <h2 className="text-[clamp(2.6rem,7vw,6rem)] font-black uppercase leading-[0.92] tracking-tight">
            <span className="bg-gradient-to-b from-white via-white/90 to-white/50 bg-clip-text text-transparent" style={{ WebkitTextFillColor: "transparent" }}>
              Why Choose Us?
            </span>
          </h2>
          <div className="mx-auto mt-5 h-px w-28 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
        </motion.div>

        {/* ── MAIN: 3D SCENE + CARDS ── */}
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16">

          {/* ── 3D ROTATING SCENE ── */}
          <motion.div initial="hidden" animate={revealed ? "visible" : "hidden"} variants={sceneV} className="relative flex items-center justify-center">
            {/* ambient glow behind scene */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
              <div data-kcw-anim className="h-[280px] w-[280px] sm:h-[340px] sm:w-[340px] rounded-full bg-emerald-500/15 blur-[80px]" style={{ animation: "kcw-pulse 4s ease-in-out infinite" }} />
              <div data-kcw-anim className="absolute h-[220px] w-[220px] rounded-full bg-cyan-400/10 blur-[60px]" style={{ animation: "kcw-pulse 5s ease-in-out 1s infinite" }} />
            </div>

            {/* orbit rings (decorative) */}
            <div className="pointer-events-none absolute" style={{ perspective: "800px" }} aria-hidden="true">
              {[155, 140, 165, 130].map((r, i) => (
                <div
                  key={i}
                  data-kcw-anim
                  className="absolute rounded-full border border-white/[0.04]"
                  style={{
                    width: r * 2,
                    height: r * 2,
                    left: `calc(50% - ${r}px)`,
                    top: `calc(50% - ${r}px)`,
                    transform: `rotateX(${65 + i * 5}deg) rotateZ(${i * 15}deg)`,
                    animation: `kcw-ring ${6 + i}s ease-in-out ${i * 0.5}s infinite`,
                  }}
                />
              ))}
            </div>

            {/* ── 3D SCENE CONTAINER ── */}
            <div ref={sceneRef} className="relative h-[300px] w-[300px] sm:h-[380px] sm:w-[380px]" style={{ perspective: "1000px", transformStyle: "preserve-3d" }}>

              {/* ── ROTATING KC LOGO ── */}
              <div
                data-kcw-anim
                className="absolute inset-[15%]"
                style={{ transformStyle: "preserve-3d", animation: "kcw-logo-spin 14s linear infinite" }}
              >
                {/* front face */}
                <div className="absolute inset-0" style={{ transform: "translateZ(8px)" }}>
                  <KCShield />
                </div>
                {/* back face (mirrored) */}
                <div className="absolute inset-0" style={{ transform: "rotateY(180deg) translateZ(8px)" }}>
                  <KCShield />
                </div>
                {/* edge glow */}
                <div className="absolute -inset-1 rounded-full bg-gradient-to-br from-emerald-400/20 to-cyan-400/15 blur-md" style={{ transform: "translateZ(0)" }} />
              </div>

              {/* ── ORBITING 3D OBJECTS ── */}
              {ORBIT_OBJECTS.map((obj, i) => (
                <div
                  key={obj.label}
                  data-kcw-anim
                  className="absolute"
                  style={{
                    left: "50%",
                    top: "50%",
                    width: 0,
                    height: 0,
                    transformStyle: "preserve-3d",
                    animation: `kcw-orbit-${i} ${obj.orbitSpeed}s linear infinite`,
                  }}
                >
                  <div
                    data-kcw-anim
                    style={{
                      width: obj.size,
                      height: obj.size,
                      marginLeft: -obj.size / 2,
                      marginTop: -obj.size / 2,
                      transformStyle: "preserve-3d",
                      animation: `kcw-obj-rot ${obj.selfRotSpeed}s ease-in-out infinite`,
                      filter: `drop-shadow(0 0 10px ${obj.glow})`,
                    }}
                  >
                    <OrbitSvg label={obj.label} />
                  </div>
                </div>
              ))}

              {/* ── PARTICLE ATMOSPHERE ── */}
              {!prefersReducedMotion && (
                <div className="kcw-particles pointer-events-none absolute -inset-12" aria-hidden="true">
                  {particles.map((p, pi) => (
                    <span
                      key={pi}
                      className="absolute rounded-full"
                      style={{
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        width: p.size,
                        height: p.size,
                        background: pi % 3 === 0 ? "#06b6d4" : pi % 3 === 1 ? "rgba(34,211,238,0.5)" : "rgba(52,211,153,0.45)",
                        "--px": `${p.dx}px`,
                        "--py": `${p.dy}px`,
                        animation: `kcw-particle ${p.dur}s ease-out ${p.delay}s infinite`,
                      } as CSSProperties}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* ── CARDS COLUMN ── */}
          <div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              {CARDS.map((card, i) => {
                const isActive = activeIdx === i;
                const Icon = card.icon;
                return (
                  <motion.div
                    key={card.title}
                    custom={i}
                    initial="hidden"
                    animate={revealed ? "visible" : "hidden"}
                    variants={cardV}
                    className="relative [perspective:900px]"
                    onMouseEnter={() => setActiveIdx(i)}
                  >
                    {/* powder-smoke behind active card */}
                    {isActive && !prefersReducedMotion && (
                      <div className="kcw-particles pointer-events-none absolute -inset-8 z-0" aria-hidden="true">
                        <div className="absolute inset-0 rounded-2xl" style={{ background: `radial-gradient(ellipse at 50% 60%, ${card.glowRgba}, transparent 70%)`, animation: "kcw-pulse 3s ease-in-out infinite" }} />
                        {particles.slice(0, 14).map((p, pi) => (
                          <span
                            key={pi}
                            className="absolute rounded-full"
                            style={{
                              left: `${p.x}%`,
                              top: `${p.y}%`,
                              width: p.size + 0.8,
                              height: p.size + 0.8,
                              background: pi % 3 === 0 ? card.glowColor : pi % 3 === 1 ? "rgba(34,211,238,0.5)" : "rgba(52,211,153,0.45)",
                              "--px": `${p.dx}px`,
                              "--py": `${p.dy}px`,
                              animation: `kcw-particle ${p.dur}s ease-out ${p.delay}s infinite`,
                            } as CSSProperties}
                          />
                        ))}
                      </div>
                    )}

                    {/* card body */}
                    <div
                      className={`group relative z-10 overflow-hidden rounded-2xl border p-5 sm:p-6 transition-[transform,box-shadow,border-color] duration-[280ms] ease-out will-change-transform ${
                        isActive
                          ? "border-white/15 shadow-[0_8px_44px_-8px_rgba(6,182,212,0.35)]"
                          : "border-white/[0.06] shadow-[0_4px_20px_-6px_rgba(0,0,0,0.5)]"
                      }`}
                      style={{
                        background: isActive
                          ? "linear-gradient(155deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.025) 100%)"
                          : "linear-gradient(155deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.012) 100%)",
                        backdropFilter: "blur(20px) saturate(1.5)",
                        WebkitBackdropFilter: "blur(20px) saturate(1.5)",
                      }}
                      onPointerMove={!prefersReducedMotion ? onCardPointerMove : undefined}
                      onPointerLeave={!prefersReducedMotion ? onCardPointerLeave : undefined}
                    >
                      {/* highlight edge */}
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: isActive ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)" : "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }} />
                      {/* glass sheen */}
                      <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, transparent 50%, rgba(255,255,255,0.02) 100%)" }} />

                      {/* icon */}
                      <div
                        className={`relative mb-4 flex size-12 items-center justify-center rounded-xl transition-all duration-300 ${
                          isActive ? "bg-white/10" : "bg-white/[0.05] group-hover:bg-white/[0.08]"
                        }`}
                        style={isActive ? { ["--gc" as string]: card.glowColor, animation: "kcw-iglow 3.5s ease-in-out infinite" } : undefined}
                      >
                        <Icon className={`size-6 transition-all duration-300 ${isActive ? "text-white" : "text-white/55 group-hover:text-white/80"}`} strokeWidth={1.6} />
                      </div>

                      {/* text */}
                      <h3 className={`text-sm font-bold uppercase tracking-wide transition-colors duration-300 ${isActive ? "text-white" : "text-white/65 group-hover:text-white/85"}`}>
                        {card.title}
                      </h3>
                      <p className={`mt-1.5 text-[13px] leading-relaxed transition-colors duration-300 ${isActive ? "text-white/50" : "text-white/30 group-hover:text-white/45"}`}>
                        {card.subtitle}
                      </p>

                      {/* active bar */}
                      <div className={`absolute bottom-0 left-0 h-[2px] transition-all duration-500 ${isActive ? "w-full" : "w-0"}`} style={{ background: `linear-gradient(90deg, transparent, ${card.glowColor}, transparent)` }} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── BOTTOM HEADING ── */}
        <motion.div initial="hidden" animate={revealed ? "visible" : "hidden"} variants={footV} className="mt-14 sm:mt-20 text-center">
          <h2 className="text-[clamp(1.5rem,4vw,3.2rem)] font-black uppercase leading-[1.08] tracking-tight">
            <span className="bg-gradient-to-r from-emerald-400 via-cyan-300 to-teal-400 bg-clip-text text-transparent" style={{ WebkitTextFillColor: "transparent" }}>
              Your Health, Our Priority
            </span>
          </h2>
        </motion.div>
      </div>
    </section>
  );
}
