import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Shield, FlaskConical, Truck, RefreshCw } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   WHY CHOOSE US — premium healthcare-tech presentation
   ---------------------------------------------------------------------------
   Palette: deep midnight navy base → indigo/blue atmosphere → cyan highlights
   → restrained violet depth. The 3D shield is rebuilt with layered rim light,
   bevels, specular sweeps and a floor reflection; every moving thing is
   driven by ONE rAF loop (single playback controller) that PAUSES entirely
   while the section is off-screen. Particles are few, tiny and GPU-cheap.
   No animated blur/filters/box-shadows — transforms + opacity only.
   ═══════════════════════════════════════════════════════════════════════════ */

const EASE = [0.22, 1, 0.36, 1] as const;

/* ── palette ── */
const NAVY = "#070A12";
const NAVY_2 = "#0A0F1E";
const CYAN = "#22D3EE";
const CYAN_SOFT = "rgba(34,211,238,";
const VIOLET = "rgba(139,92,246,";

interface CardData {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  glowColor: string;
  glowRgba: string;
}

const CARDS: CardData[] = [
  { title: "Authentic Medicines", subtitle: "100% Verified Pharmacy Stock.", icon: Shield, glowColor: "#22d3ee", glowRgba: "rgba(34,211,238,0.22)" },
  { title: "Expert Pharmacists", subtitle: "24/7 Professional Consultations.", icon: FlaskConical, glowColor: "#38bdf8", glowRgba: "rgba(56,189,248,0.22)" },
  { title: "Fast Home Delivery", subtitle: "Quick, Reliable Doorstep Service.", icon: Truck, glowColor: "#2dd4bf", glowRgba: "rgba(45,212,191,0.20)" },
  { title: "Seamless Refills", subtitle: "Easy Online Subscription & Management.", icon: RefreshCw, glowColor: "#818cf8", glowRgba: "rgba(129,140,248,0.20)" },
];

/* ─── orbiting 3D objects (recoloured cyan/indigo) ─── */
interface OrbitObj {
  label: string;
  orbitRadius: number;
  orbitSpeed: number;
  selfRotSpeed: number;
  size: number;
  glow: string;
}

const ORBIT_OBJECTS: OrbitObj[] = [
  { label: "capsule", orbitRadius: 155, orbitSpeed: 30, selfRotSpeed: 10, size: 36, glow: CYAN_SOFT + "0.4)" },
  { label: "shield", orbitRadius: 140, orbitSpeed: 36, selfRotSpeed: 12, size: 30, glow: "rgba(56,189,248,0.35)" },
  { label: "cross", orbitRadius: 165, orbitSpeed: 24, selfRotSpeed: 8, size: 26, glow: "rgba(45,212,191,0.32)" },
  { label: "bottle", orbitRadius: 130, orbitSpeed: 40, selfRotSpeed: 14, size: 32, glow: "rgba(129,140,248,0.32)" },
  { label: "plus", orbitRadius: 175, orbitSpeed: 28, selfRotSpeed: 11, size: 22, glow: CYAN_SOFT + "0.28)" },
  { label: "pill", orbitRadius: 148, orbitSpeed: 34, selfRotSpeed: 10, size: 28, glow: VIOLET + "0.30)" },
];

/* per-orbit start angles (deg) — used in the single dynamic orbit transform */
const ORBIT_PHASE = [0, 90, 180, 270, 45, 135];

/* ═══════════════════════════════════════════════════════════════════════════
   3D ORBIT OBJECT SVGs — richer materials, cyan/indigo, specular edge
   ═══════════════════════════════════════════════════════════════════════════ */
function OrbitSvg({ label }: { label: string }) {
  switch (label) {
    case "capsule":
      return (
        <svg viewBox="0 0 40 20" fill="none" className="size-full">
          <defs>
            <linearGradient id="orbCapsuleA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#E0F2FE" />
              <stop offset="1" stopColor="#7DD3FC" />
            </linearGradient>
            <linearGradient id="orbCapsuleB" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#22D3EE" />
              <stop offset="1" stopColor="#0E7490" />
            </linearGradient>
          </defs>
          <rect x="1" y="1" width="18" height="18" rx="9" fill="url(#orbCapsuleA)" />
          <rect x="19" y="1" width="18" height="18" rx="9" fill="url(#orbCapsuleB)" />
          <rect x="8" y="5" width="6" height="3" rx="1.5" fill="#fff" opacity="0.85" />
          <rect x="25" y="5" width="6" height="2.4" rx="1.2" fill="#A5F3FC" opacity="0.7" />
        </svg>
      );
    case "shield":
      return (
        <svg viewBox="0 0 32 36" fill="none" className="size-full">
          <defs>
            <linearGradient id="orbShield" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#67E8F9" />
              <stop offset="1" stopColor="#0E7490" />
            </linearGradient>
          </defs>
          <path d="M16 2L30 8V18C30 26 24 32 16 34C8 32 2 26 2 18V8L16 2Z" fill="url(#orbShield)" stroke="#A5F3FC" strokeWidth="1.1" strokeOpacity="0.8" />
          <path d="M16 2L30 8V11L16 6L2 11V8L16 2Z" fill="#fff" opacity="0.35" />
          <path d="M12 17l3 3 6-7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "cross":
      return (
        <svg viewBox="0 0 28 28" fill="none" className="size-full">
          <defs>
            <linearGradient id="orbCross" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#38BDF8" />
              <stop offset="1" stopColor="#155E75" />
            </linearGradient>
          </defs>
          <rect x="9" y="2" width="10" height="24" rx="4" fill="url(#orbCross)" />
          <rect x="2" y="9" width="24" height="10" rx="4" fill="url(#orbCross)" />
          <rect x="11.5" y="5" width="5" height="18" rx="2.5" fill="#CFFAFE" opacity="0.55" />
        </svg>
      );
    case "bottle":
      return (
        <svg viewBox="0 0 24 36" fill="none" className="size-full">
          <defs>
            <linearGradient id="orbBottle" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#E0F2FE" />
              <stop offset="1" stopColor="#93C5FD" />
            </linearGradient>
          </defs>
          <rect x="7" y="0" width="10" height="6" rx="3" fill="#1D4ED8" />
          <rect x="3" y="6" width="18" height="28" rx="5" fill="url(#orbBottle)" stroke="#BFDBFE" strokeWidth="0.9" strokeOpacity="0.7" />
          <path d="M12 16v6M9 19h6" stroke="#1E40AF" strokeWidth="2" strokeLinecap="round" />
          <rect x="6" y="9" width="3" height="20" rx="1.5" fill="#fff" opacity="0.5" />
        </svg>
      );
    case "plus":
      return (
        <svg viewBox="0 0 24 24" fill="none" className="size-full">
          <defs>
            <linearGradient id="orbPlus" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#22D3EE" />
              <stop offset="1" stopColor="#0E7490" />
            </linearGradient>
          </defs>
          <rect x="8" y="2" width="8" height="20" rx="4" fill="url(#orbPlus)" opacity="0.8" />
          <rect x="2" y="8" width="20" height="8" rx="4" fill="url(#orbPlus)" opacity="0.8" />
          <rect x="10" y="4" width="3" height="16" rx="1.5" fill="#fff" opacity="0.35" />
        </svg>
      );
    case "pill":
      return (
        <svg viewBox="0 0 32 18" fill="none" className="size-full">
          <defs>
            <linearGradient id="orbPillA" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#C7D2FE" />
              <stop offset="1" stopColor="#818CF8" />
            </linearGradient>
            <linearGradient id="orbPillB" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#5EEAD4" />
              <stop offset="1" stopColor="#0F766E" />
            </linearGradient>
          </defs>
          <rect x="1" y="1" width="14" height="16" rx="7" fill="url(#orbPillA)" />
          <rect x="15" y="1" width="16" height="16" rx="7" fill="url(#orbPillB)" />
          <rect x="4" y="4" width="4" height="2" rx="1" fill="#fff" opacity="0.7" />
        </svg>
      );
    default:
      return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   KC SHIELD — cinematic materials: rim light, bevel, specular, reflection
   ═══════════════════════════════════════════════════════════════════════════ */
function KCShield() {
  return (
    <svg viewBox="0 0 200 230" fill="none" className="size-full" aria-label="Kalyan Chemist Logo">
      <defs>
        {/* front face: deep indigo-teal metal */}
        <linearGradient id="kcFaceA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0E7490" />
          <stop offset="0.45" stopColor="#155E75" />
          <stop offset="0.8" stopColor="#134E4A" />
          <stop offset="1" stopColor="#1E1B4B" />
        </linearGradient>
        {/* inner face: glass with cyan light */}
        <linearGradient id="kcFaceInner" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#0B1226" />
          <stop offset="0.55" stopColor="#0E1A36" />
          <stop offset="1" stopColor="#132A45" />
        </linearGradient>
        {/* cross: luminous cyan core */}
        <linearGradient id="kcCross" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7DEBFA" />
          <stop offset="0.5" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#0E7490" />
        </linearGradient>
        {/* rim edge */}
        <linearGradient id="kcEdge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A5F3FC" />
          <stop offset="0.5" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#312E81" />
        </linearGradient>
        <radialGradient id="kcHalo" cx="0.5" cy="0.42" r="0.62">
          <stop offset="0" stopColor="#22D3EE" stopOpacity="0.22" />
          <stop offset="0.6" stopColor="#22D3EE" stopOpacity="0.06" />
          <stop offset="1" stopColor="#22D3EE" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="kcSpec" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* volumetric halo inside the shield silhouette */}
      <ellipse cx="100" cy="115" rx="88" ry="100" fill="url(#kcHalo)" />

      {/* shield body */}
      <path d="M100 8 L185 48 V130 C185 185 150 215 100 228 C50 215 15 185 15 130 V48 Z" fill="url(#kcFaceA)" />
      {/* outer rim stroke */}
      <path d="M100 8 L185 48 V130 C185 185 150 215 100 228 C50 215 15 185 15 130 V48 Z" fill="none" stroke="url(#kcEdge)" strokeWidth="1.4" strokeOpacity="0.9" />

      {/* top bevel highlight */}
      <path d="M100 8 L185 48 V56 L100 22 L15 56 V48 Z" fill="#CFFAFE" opacity="0.5" />
      {/* left rim light */}
      <path d="M18 52 V130 C18 178 46 208 85 220" stroke="#E0F7FF" strokeOpacity="0.65" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* right violet counter-light */}
      <path d="M182 52 V130 C182 178 154 208 115 220" stroke={VIOLET + "0.5)"} strokeWidth="2" strokeLinecap="round" fill="none" />

      {/* inner face */}
      <path d="M100 32 L165 60 V130 C165 172 138 198 100 210 C62 198 35 172 35 130 V60 Z" fill="url(#kcFaceInner)" />
      <path d="M100 32 L165 60 V130 C165 172 138 198 100 210 C62 198 35 172 35 130 V60 Z" fill="none" stroke="#67E8F9" strokeOpacity="0.22" strokeWidth="1.2" />
      {/* inner top glass sheen */}
      <path d="M100 36 L160 62 V84 L100 60 L40 84 V62 Z" fill="#fff" opacity="0.06" />

      {/* medical cross with glow core */}
      <rect x="86" y="72" width="28" height="80" rx="9" fill="url(#kcCross)" />
      <rect x="66" y="96" width="68" height="28" rx="9" fill="url(#kcCross)" />
      <rect x="90" y="78" width="8" height="68" rx="4" fill="#CFFAFE" opacity="0.55" />
      <rect x="70" y="100" width="60" height="8" rx="4" fill="#CFFAFE" opacity="0.4" />

      {/* KC wordmark on the face */}
      <text x="100" y="162" textAnchor="middle" fontSize="26" fontWeight="900" fontFamily="system-ui, sans-serif" fill="#A5F3FC" opacity="0.95" letterSpacing="3">KC</text>
      <text x="100" y="176" textAnchor="middle" fontSize="8" fontWeight="600" fontFamily="system-ui, sans-serif" fill="#67E8F9" opacity="0.55" letterSpacing="6">PHARMACY</text>

      {/* specular sweep across the upper face */}
      <path d="M40 60 L100 34 L160 60 L100 88 Z" fill="url(#kcSpec)" opacity="0.14" />

      {/* floor contact glow */}
      <ellipse cx="100" cy="221" rx="46" ry="5" fill="#22D3EE" opacity="0.14" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function WhyKalyanChemist() {
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobileMax720();
  const [activeIdx, setActiveIdx] = useState(1);
  const [revealed, setRevealed] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  /* ── viewport reveal (runs once) ── */
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

  /* ────────────────────────────────────────────────────────────────────────
     SINGLE ANIMATION CONTROLLER
     One rAF loop drives: scene parallax (lerped), logo slow spin, and orbit
     transforms — all GPU transforms, zero React re-renders. The loop exists
     only while the section is on screen; it fully pauses otherwise. Card
     tilt uses its own short-lived rAF per hover (self-cancelling).
     ──────────────────────────────────────────────────────────────────────── */
  const parallaxTarget = useRef({ nx: 0, ny: 0 });
  const parallaxCur = useRef({ nx: 0, ny: 0 });
  const liveRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const spinRef = useRef(0);      /* logo rotation accumulator (deg) */
  const lastTRef = useRef<number | null>(null);
  const orbitsRef = useRef<(HTMLDivElement | null)[]>([]);
  const pointerInRef = useRef(false);

  /* eased-start factor so the loop spins up / down gently, no jumps */
  const energyRef = useRef(0);

  const tick = useCallback((t: number) => {
    rafRef.current = null;
    if (!liveRef.current) return;

    const dt = lastTRef.current === null ? 16.7 : Math.min(64, t - lastTRef.current);
    lastTRef.current = t;

    /* energy eases toward 1 when hovered/pointer-in, toward 0.55 otherwise */
    const goal = pointerInRef.current ? 1 : 0.55;
    energyRef.current += (goal - energyRef.current) * Math.min(1, dt / 900);
    const e = energyRef.current;

    /* 1) scene parallax lerp */
    const s = sceneRef.current;
    if (s) {
      parallaxCur.current.nx += (parallaxTarget.current.nx - parallaxCur.current.nx) * 0.075;
      parallaxCur.current.ny += (parallaxTarget.current.ny - parallaxCur.current.ny) * 0.075;
      const { nx, ny } = parallaxCur.current;
      s.style.transform = `translate3d(${(nx * 16).toFixed(2)}px, ${(ny * 12).toFixed(2)}px, 0) rotateX(${(ny * -3.5).toFixed(2)}deg) rotateY(${(nx * 4.5).toFixed(2)}deg)`;
    }

    /* 2) logo continuous Y-spin — slower, cinematic (≈26s per revolution) */
    const logo = logoRef.current;
    if (logo) {
      spinRef.current = (spinRef.current + dt * 0.0138 * e) % 360;
      logo.style.transform = `rotateY(${spinRef.current.toFixed(2)}deg) rotateX(7deg)`;
    }

    /* 3) orbits: gentle float + slow revolution (depth-corrected) */
    for (let i = 0; i < ORBIT_OBJECTS.length; i++) {
      const el = orbitsRef.current[i];
      if (!el) continue;
      const o = ORBIT_OBJECTS[i];
      const phase = ORBIT_PHASE[i];
      const rev = (spinRef.current * (o.orbitSpeed / 26)) + phase; /* deg */
      const rad = (rev * Math.PI) / 180;
      const depth = Math.cos(rad); /* -1 back … +1 front */
      const x = Math.sin(rad) * o.orbitRadius * e;
      const scale = 0.86 + depth * 0.16;
      const opacity = 0.55 + (depth * 0.5 + 0.5) * 0.45;
      const floatY = Math.sin(t / 1400 + i * 1.7) * 6 * e;
      el.style.transform =
        `translate3d(${x.toFixed(1)}px, ${floatY.toFixed(1)}px, ${(-depth * 60).toFixed(1)}px) scale(${scale.toFixed(3)})`;
      el.style.opacity = opacity.toFixed(3);
      el.style.zIndex = depth > 0 ? "3" : "0";
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startLoop = useCallback(() => {
    if (rafRef.current === null && liveRef.current && !prefersReducedMotion && !isMobile) {
      lastTRef.current = null;
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [tick, prefersReducedMotion, isMobile]);

  /* viewport gate: run the loop only while visible */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || prefersReducedMotion) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        const wasLive = liveRef.current;
        liveRef.current = entry.isIntersecting;
        if (entry.isIntersecting && !wasLive) {
          if (!isMobile) startLoop();
        }
        if (!entry.isIntersecting && rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      },
      { rootMargin: "120px 0px 120px 0px" }
    );
    obs.observe(el);
    return () => {
      obs.disconnect();
      liveRef.current = false;
      if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [prefersReducedMotion, isMobile, startLoop]);

  /* CSS-only fallbacks for mobile + reduced motion: gentle keyframes */
  const useCssAnim = prefersReducedMotion ? false : isMobile;

  /* pointer handlers feed the loop (desktop only) */
  const onSectionPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isMobile || prefersReducedMotion) return;
      const r = e.currentTarget.getBoundingClientRect();
      parallaxTarget.current = {
        nx: (e.clientX - r.left) / r.width - 0.5,
        ny: (e.clientY - r.top) / r.height - 0.5,
      };
      pointerInRef.current = true;
    },
    [isMobile, prefersReducedMotion]
  );

  const onSectionPointerLeave = useCallback(() => {
    parallaxTarget.current = { nx: 0, ny: 0 };
    pointerInRef.current = false;
  }, []);

  /* ── card 3D tilt — per-card short-lived rAF, self-cancelling ── */
  const tiltRaf = useRef<number | null>(null);
  const tiltData = useRef<{ el: HTMLDivElement; nx: number; ny: number } | null>(null);

  const flushTilt = useCallback(() => {
    tiltRaf.current = null;
    const d = tiltData.current;
    if (!d) return;
    d.el.style.transform = `perspective(900px) rotateX(${(d.ny * -7).toFixed(2)}deg) rotateY(${(d.nx * 7).toFixed(2)}deg) translate3d(0,-6px,0) scale(1.03)`;
  }, []);

  const onCardPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (isMobile || prefersReducedMotion) return;
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      tiltData.current = { el, nx: (e.clientX - r.left) / r.width - 0.5, ny: (e.clientY - r.top) / r.height - 0.5 };
      if (tiltRaf.current === null) tiltRaf.current = requestAnimationFrame(flushTilt);
    },
    [flushTilt, isMobile, prefersReducedMotion]
  );

  const onCardPointerLeave = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    tiltData.current = null;
    e.currentTarget.style.transform = "";
  }, []);

  useEffect(() => () => {
    if (tiltRaf.current !== null) cancelAnimationFrame(tiltRaf.current);
  }, []);

  /* ── variants (enter once) ── */
  const headV: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 50, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.9, ease: EASE } },
  };
  const sceneV: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.82, y: 30 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 1.1, delay: 0.15, ease: EASE } },
  };
  const cardV: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 56, scale: 0.92 },
    visible: (i: number) => ({
      opacity: 1, y: 0, scale: 1,
      transition: { duration: 0.8, delay: 0.3 + i * 0.12, ease: EASE },
    }),
  };
  const footV: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.8, delay: 0.85, ease: EASE } },
  };

  /* ── particles: few, small, static-position, GPU-cheap ── */
  const particles = useMemo(
    () =>
      Array.from({ length: isMobile ? 10 : 16 }, (_, i) => ({
        x: (Math.sin(i * 1.7) * 0.5 + 0.5) * 100,
        y: (Math.cos(i * 2.1) * 0.5 + 0.5) * 100,
        size: 1.4 + (i % 3) * 0.8,
        delay: (i * 0.2) % 2.4,
        dur: 3 + (i % 4) * 0.6,
        dx: Math.sin(i * 2.8) * 26,
        dy: -(14 + (i % 5) * 6),
      })),
    [isMobile]
  );

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden py-20 sm:py-28 lg:py-36"
      style={{ background: NAVY }}
      onPointerMove={!prefersReducedMotion ? onSectionPointerMove : undefined}
      onPointerLeave={!prefersReducedMotion ? onSectionPointerLeave : undefined}
    >
      {/* ════ KEYFRAMES ════ */}
      <style>{`
        /* CSS fallback animations (mobile / reduced-motion only) */
        @keyframes kcw-spin-css{from{transform:rotateY(0deg) rotateX(7deg)}to{transform:rotateY(360deg) rotateX(7deg)}}
        @keyframes kcw-orbit-css{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes kcw-deco-f1{0%,100%{transform:translateY(0) rotate3d(1,1,0,0deg)}50%{transform:translateY(-9px) rotate3d(1,1,0,7deg)}}
        @keyframes kcw-deco-f2{0%,100%{transform:translateY(0) rotate3d(0,1,1,0deg)}50%{transform:translateY(7px) rotate3d(0,1,1,-5deg)}}
        @keyframes kcw-deco-f3{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-5px) scale(1.06)}}
        @keyframes kcw-drift{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(22px,-14px,0)}}
        @keyframes kcw-pulse{0%,100%{opacity:.28;transform:scale(.94)}50%{opacity:.55;transform:scale(1.06)}}
        @keyframes kcw-particle{0%{opacity:0;transform:translate3d(0,10px,0) scale(.5)}22%{opacity:.85}100%{opacity:0;transform:translate3d(var(--px,20px),var(--py,-40px),0) scale(.2)}}
        @keyframes kcw-iglow{0%,100%{filter:drop-shadow(0 0 7px var(--gc))}50%{filter:drop-shadow(0 0 15px var(--gc))}}
        @keyframes kcw-ring{0%,100%{transform:scale(1);opacity:.12}50%{transform:scale(1.05);opacity:.26}}
        @keyframes kcw-beam{0%,100%{opacity:.5;transform:translateY(0) scaleY(1)}50%{opacity:.85;transform:translateY(-4px) scaleY(1.06)}}
        @keyframes kcw-sheen{0%{transform:translateX(-130%) skewX(-18deg)}100%{transform:translateX(240%) skewX(-18deg)}}
        @media(prefers-reduced-motion:reduce){
          [data-kcw-anim]{animation:none!important}
          .kcw-particles{display:none!important}
        }
      `}</style>

      {/* ════ LAYER 1 — BACKGROUND: layered lighting, no flat fills ════ */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${NAVY} 0%, ${NAVY_2} 45%, ${NAVY} 100%)` }} />
        {/* deep indigo atmosphere top-left */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 55% at 12% 18%, rgba(49,46,129,0.42), transparent 68%)" }} />
        {/* electric blue wash top-right */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 55% 45% at 88% 12%, rgba(29,78,216,0.26), transparent 62%)" }} />
        {/* cyan core glow center */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 48% 42% at 50% 46%, rgba(34,211,238,0.10), transparent 58%)" }} />
        {/* teal undertone bottom */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 40% at 50% 105%, rgba(19,78,74,0.30), transparent 60%)" }} />
        {/* restrained violet accents */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 82% 72%, " + VIOLET + "0.10), transparent 40%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 16% 66%, " + VIOLET + "0.06), transparent 36%)" }} />
        {/* drifting atmospheric orbs (opacity only) */}
        <div data-kcw-anim className="absolute -top-28 left-[18%] h-[380px] w-[44%] rounded-full bg-blue-600/10 blur-[110px]" style={{ animation: "kcw-drift 26s ease-in-out infinite" }} />
        <div data-kcw-anim className="absolute -bottom-32 right-[20%] h-[340px] w-[40%] rounded-full bg-cyan-500/9 blur-[100px]" style={{ animation: "kcw-drift 32s ease-in-out 6s infinite" }} />
        <div data-kcw-anim className="absolute top-1/3 -left-24 h-[280px] w-[32%] rounded-full bg-indigo-500/9 blur-[90px]" style={{ animation: "kcw-drift 28s ease-in-out 3s infinite" }} />
        {/* fine grid */}
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "linear-gradient(rgba(148,197,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(148,197,255,.5) 1px, transparent 1px)", backgroundSize: "72px 72px" }} />
        {/* cinematic vignette */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 78% 68% at 50% 46%, transparent 55%, rgba(3,5,10,0.55) 100%)" }} />
      </div>

      {/* ════ LAYER 2 — DECORATIVE FLOATING OBJECTS (sparse, off on mobile) ════ */}
      {!prefersReducedMotion && !isMobile && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {[
            { x: "5%", y: "10%", size: 19, anim: "kcw-deco-f1", delay: "0s", dur: "8.5s", kind: 0 },
            { x: "93%", y: "15%", size: 16, anim: "kcw-deco-f2", delay: "1.4s", dur: "9.2s", kind: 1 },
            { x: "7%", y: "80%", size: 14, anim: "kcw-deco-f3", delay: "2.6s", dur: "10s", kind: 2 },
            { x: "91%", y: "75%", size: 18, anim: "kcw-deco-f1", delay: "0.8s", dur: "8.8s", kind: 3 },
          ].map((d, i) => (
            <div
              key={i}
              data-kcw-anim
              className="absolute opacity-40"
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
            <span className="bg-gradient-to-b from-white via-white/90 to-white/45 bg-clip-text text-transparent" style={{ WebkitTextFillColor: "transparent" }}>
              Why Choose Us?
            </span>
          </h2>
          <div className="mx-auto mt-5 h-px w-28 bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
        </motion.div>

        {/* ── MAIN: 3D SCENE + CARDS ── */}
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.3fr] lg:gap-16">

          {/* ── 3D SCENE ── */}
          <motion.div initial="hidden" animate={revealed ? "visible" : "hidden"} variants={sceneV} className="relative flex items-center justify-center">
            {/* stage backdrop: layered light pools behind the logo */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden="true">
              {/* wide indigo pool */}
              <div className="absolute h-[360px] w-[360px] sm:h-[420px] sm:w-[420px] rounded-full" style={{ background: "radial-gradient(circle, rgba(49,46,129,0.35), transparent 68%)" }} />
              {/* cyan core */}
              <div data-kcw-anim className="h-[280px] w-[280px] sm:h-[340px] sm:w-[340px] rounded-full" style={{ background: "radial-gradient(circle, rgba(34,211,238,0.20), transparent 62%)", animation: "kcw-pulse 5s ease-in-out infinite" }} />
              {/* teal under-glow */}
              <div data-kcw-anim className="absolute bottom-[6%] h-[180px] w-[70%] rounded-full" style={{ background: "radial-gradient(ellipse, rgba(45,212,191,0.16), transparent 65%)", animation: "kcw-pulse 6s ease-in-out 1.2s infinite" }} />
              {/* volumetric light beams (static gradient, opacity-animated) */}
              <div data-kcw-anim className="absolute -top-6 left-1/2 h-[240px] w-[120px] -translate-x-1/2" style={{ background: "linear-gradient(180deg, rgba(165,243,252,0.14), transparent 78%)", clipPath: "polygon(38% 0, 62% 0, 100% 100%, 0 100%)", animation: "kcw-beam 7s ease-in-out infinite" }} />
            </div>

            {/* orbit ring guides (static transforms, gentle opacity pulse) */}
            <div className="pointer-events-none absolute" style={{ perspective: "900px" }} aria-hidden="true">
              {[155, 140, 165, 130].map((r, i) => (
                <div
                  key={i}
                  data-kcw-anim
                  className="absolute rounded-full"
                  style={{
                    width: r * 2,
                    height: r * 2,
                    left: `calc(50% - ${r}px)`,
                    top: `calc(50% - ${r}px)`,
                    border: "1px solid rgba(165,243,252,0.07)",
                    transform: `rotateX(${68 + i * 4}deg) rotateZ(${i * 18}deg)`,
                    animation: `kcw-ring ${7 + i}s ease-in-out ${i * 0.6}s infinite`,
                  }}
                />
              ))}
            </div>

            {/* ── 3D SCENE CONTAINER ── */}
            <div ref={sceneRef} className="relative h-[300px] w-[300px] sm:h-[380px] sm:w-[380px]" style={{ perspective: "1100px", transformStyle: "preserve-3d" }}>

              {/* ── ROTATING KC LOGO ── */}
              <div
                ref={logoRef}
                className="absolute inset-[15%]"
                style={{
                  transformStyle: "preserve-3d",
                  transform: "rotateY(0deg) rotateX(7deg)",
                  animation: useCssAnim ? "kcw-spin-css 30s linear infinite" : undefined,
                }}
              >
                {/* front face */}
                <div className="absolute inset-0" style={{ transform: "translateZ(9px)" }}>
                  <KCShield />
                </div>
                {/* back face (mirrored) */}
                <div className="absolute inset-0" style={{ transform: "rotateY(180deg) translateZ(9px)" }}>
                  <KCShield />
                </div>
                {/* edge light between the two faces */}
                <div className="absolute -inset-1 rounded-full" style={{ transform: "translateZ(0)", background: "radial-gradient(circle, rgba(34,211,238,0.16), transparent 65%)" }} />
              </div>

              {/* floor reflection of the logo */}
              <div
                className="pointer-events-none absolute inset-x-[18%] bottom-[4%] h-16 opacity-25"
                aria-hidden="true"
                style={{
                  transform: "rotateX(78deg)",
                  background: "radial-gradient(ellipse at 50% 0%, rgba(34,211,238,0.28), transparent 70%)",
                }}
              />

              {/* ── ORBITING 3D OBJECTS (single rAF-driven, desktop) ── */}
              {ORBIT_OBJECTS.map((obj, i) => (
                <div
                  key={obj.label}
                  ref={(el) => { orbitsRef.current[i] = el; }}
                  className="absolute left-1/2 top-1/2 will-change-transform"
                  style={{
                    width: obj.size,
                    height: obj.size,
                    marginLeft: -obj.size / 2,
                    marginTop: -obj.size / 2,
                    transformStyle: "preserve-3d",
                    animation: useCssAnim ? `kcw-orbit-css ${obj.orbitSpeed}s linear infinite` : undefined,
                  }}
                >
                  <div
                    data-kcw-anim
                    style={{
                      width: "100%",
                      height: "100%",
                      animation: useCssAnim ? `kcw-deco-f${(i % 3) + 1} ${obj.selfRotSpeed}s ease-in-out infinite` : undefined,
                      filter: `drop-shadow(0 0 9px ${obj.glow})`,
                    }}
                  >
                    <OrbitSvg label={obj.label} />
                  </div>
                </div>
              ))}

              {/* ── PARTICLE ATMOSPHERE (sparse) ── */}
              <div className="kcw-particles pointer-events-none absolute -inset-12" aria-hidden="true">
                {particles.slice(0, isMobile ? 6 : 10).map((p, pi) => (
                  <span
                    key={pi}
                    className="absolute rounded-full"
                    style={{
                      left: `${p.x}%`,
                      top: `${p.y}%`,
                      width: p.size,
                      height: p.size,
                      background: pi % 3 === 0 ? "rgba(34,211,238,0.8)" : pi % 3 === 1 ? "rgba(165,243,252,0.55)" : VIOLET + "0.45)",
                      "--px": `${p.dx}px`,
                      "--py": `${p.dy}px`,
                      animation: `kcw-particle ${p.dur}s ease-out ${p.delay}s infinite`,
                    } as CSSProperties}
                  />
                ))}
              </div>
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
                    {/* energy field behind the active card */}
                    {isActive && (
                      <div className="kcw-particles pointer-events-none absolute -inset-8 z-0" aria-hidden="true">
                        <div className="absolute inset-0 rounded-2xl" style={{ background: `radial-gradient(ellipse at 50% 60%, ${card.glowRgba}, transparent 70%)`, animation: "kcw-pulse 3.4s ease-in-out infinite" }} />
                        {particles.slice(0, isMobile ? 6 : 12).map((p, pi) => (
                          <span
                            key={pi}
                            className="absolute rounded-full"
                            style={{
                              left: `${p.x}%`,
                              top: `${p.y}%`,
                              width: p.size + 0.7,
                              height: p.size + 0.7,
                              background: pi % 3 === 0 ? card.glowColor : pi % 3 === 1 ? "rgba(165,243,252,0.55)" : VIOLET + "0.4)",
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
                      ref={(el) => { cardRefs.current[i] = el; }}
                      className={`group relative z-10 overflow-hidden rounded-2xl border transition-[transform,border-color] duration-[260ms] ease-out will-change-transform ${
                        isActive ? "border-cyan-300/25" : "border-white/[0.06]"
                      }`}
                      style={{
                        background: isActive
                          ? "linear-gradient(155deg, rgba(148,197,255,0.075) 0%, rgba(255,255,255,0.02) 100%)"
                          : "linear-gradient(155deg, rgba(255,255,255,0.035) 0%, rgba(255,255,255,0.01) 100%)",
                        boxShadow: isActive
                          ? "0 10px 40px -12px rgba(34,211,238,0.30), inset 0 1px 0 rgba(255,255,255,0.06)"
                          : "0 4px 18px -8px rgba(0,0,0,0.55)",
                      }}
                      onPointerMove={!prefersReducedMotion ? onCardPointerMove : undefined}
                      onPointerLeave={!prefersReducedMotion ? onCardPointerLeave : undefined}
                    >
                      {/* top edge light */}
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: isActive ? "linear-gradient(90deg, transparent, rgba(165,243,252,0.5), transparent)" : "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)" }} />
                      {/* glass sheen sweep on hover (transform-only, masked) */}
                      <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        <div className="absolute inset-y-0 w-1/2 opacity-0 group-hover:opacity-100 group-hover:[animation:kcw-sheen_1.1s_ease-out] h-full" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)" }} />
                      </div>

                      {/* icon */}
                      <div
                        className={`relative mb-4 flex size-12 items-center justify-center rounded-xl border transition-colors duration-300 ${
                          isActive ? "border-cyan-300/25 bg-cyan-400/10" : "border-white/[0.06] bg-white/[0.04] group-hover:bg-white/[0.07]"
                        }`}
                        style={isActive ? { ["--gc" as string]: card.glowColor, animation: "kcw-iglow 4s ease-in-out infinite" } : undefined}
                      >
                        <Icon className={`size-6 transition-colors duration-300 ${isActive ? "text-cyan-100" : "text-white/55 group-hover:text-white/80"}`} strokeWidth={1.6} />
                      </div>

                      {/* text */}
                      <h3 className={`text-sm font-bold uppercase tracking-wide transition-colors duration-300 ${isActive ? "text-white" : "text-white/65 group-hover:text-white/85"}`}>
                        {card.title}
                      </h3>
                      <p className={`mt-1.5 text-[13px] leading-relaxed transition-colors duration-300 ${isActive ? "text-cyan-50/60" : "text-white/30 group-hover:text-white/45"}`}>
                        {card.subtitle}
                      </p>

                      {/* active bar */}
                      <div className={`absolute bottom-0 left-0 h-[2px] transition-[width] duration-500 ease-out ${isActive ? "w-full" : "w-0"}`} style={{ background: `linear-gradient(90deg, transparent, ${card.glowColor}, transparent)` }} />
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
            <span className="bg-gradient-to-r from-cyan-300 via-sky-200 to-indigo-300 bg-clip-text text-transparent" style={{ WebkitTextFillColor: "transparent" }}>
              Your Health, Our Priority
            </span>
          </h2>
        </motion.div>
      </div>
    </section>
  );
}

/* ── tiny media-query hook (no external deps) ── */
function useIsMobileMax720() {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(max-width: 720px)").matches : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const fn = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return mobile;
}
