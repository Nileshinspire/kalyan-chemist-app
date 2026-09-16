import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ShieldCheck, Truck, Clock3, Pill, Shield, Plus } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ── Existing trust points (content unchanged) ── */
const TRUST_POINTS = [
  {
    icon: ShieldCheck,
    title: "Genuine Medicines",
    description: "Every product sourced directly from licensed manufacturers and verified distributors.",
    iconAnim: "shield",
  },
  {
    icon: Truck,
    title: "Prompt Delivery",
    description: "Orders dispatched within hours and delivered to your doorstep with care.",
    iconAnim: "truck",
  },
  {
    icon: Clock3,
    title: "Always Open Online",
    description: "Browse and order anytime — our platform is available around the clock.",
    iconAnim: "clock",
  },
  {
    icon: Pill,
    title: "Expert Guidance",
    description: "Our pharmacists are available to answer your questions about dosage and interactions.",
    iconAnim: "pill",
  },
];

/* ── Ambient dust motes ── */
const PARTICLES = [
  { left: "12%", top: "26%", size: 3, delay: "0s", duration: "11s", color: "rgba(13,148,136,0.45)" },
  { left: "23%", top: "68%", size: 2, delay: "1.6s", duration: "13s", color: "rgba(15,118,110,0.35)" },
  { left: "41%", top: "18%", size: 2, delay: "3.1s", duration: "12s", color: "rgba(56,189,248,0.4)" },
  { left: "58%", top: "74%", size: 3, delay: "0.8s", duration: "14s", color: "rgba(20,184,166,0.4)" },
  { left: "72%", top: "22%", size: 2, delay: "2.4s", duration: "12.5s", color: "rgba(251,146,60,0.45)" },
  { left: "88%", top: "58%", size: 2, delay: "4.2s", duration: "13.5s", color: "rgba(15,118,110,0.35)" },
  { left: "50%", top: "42%", size: 2, delay: "3.8s", duration: "15s", color: "rgba(45,212,191,0.5)" },
  { left: "16%", top: "52%", size: 2, delay: "5.2s", duration: "14s", color: "rgba(129,140,248,0.35)" },
];

const svgAnim = (name: string, duration: string, delay = "0s"): CSSProperties => ({
  animation: `${name} ${duration} ease-in-out ${delay} infinite`,
  transformBox: "fill-box",
  transformOrigin: "center",
});

/* ── Premium 3D healthcare illustration — fixed cluster with local motion ── */
function TrustIllustration() {
  return (
    <svg viewBox="0 0 260 200" fill="none" className="size-full" aria-hidden="true">
      <defs>
        <radialGradient id="wkcGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#2DD4BF" stopOpacity="0.32" />
          <stop offset="1" stopColor="#2DD4BF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="wkcShield" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#5EEAD4" />
          <stop offset="0.35" stopColor="#34D399" />
          <stop offset="0.7" stopColor="#10B981" />
          <stop offset="1" stopColor="#0F766E" />
        </linearGradient>
        <linearGradient id="wkcShieldIn" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.5" stopColor="#F0FDFA" />
          <stop offset="1" stopColor="#CCFBF1" />
        </linearGradient>
        <linearGradient id="wkcCross" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0D9488" />
          <stop offset="1" stopColor="#0F766E" />
        </linearGradient>
        <linearGradient id="wkcBadge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34D399" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
        <linearGradient id="wkcCard" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F0FDFA" />
        </linearGradient>
        <linearGradient id="wkcCapA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FDBA74" />
          <stop offset="1" stopColor="#F97316" />
        </linearGradient>
        <linearGradient id="wkcCapB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
        <radialGradient id="wkcArea" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#0FA3A3" stopOpacity="0.14" />
          <stop offset="0.65" stopColor="#0FA3A3" stopOpacity="0.05" />
          <stop offset="1" stopColor="#0FA3A3" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="wkcBox" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F0FDFA" />
        </linearGradient>
        <linearGradient id="wkcBoxSide" x1="0" y1="0" x2="1" y2="0.5">
          <stop offset="0" stopColor="#CCFBF1" />
          <stop offset="1" stopColor="#99F6E4" />
        </linearGradient>
      </defs>

      {/* ambient glow marks the fixed visual zone */}
      <circle cx="130" cy="100" r="90" fill="url(#wkcGlow)" />
      <circle cx="130" cy="100" r="80" fill="url(#wkcArea)" />

      {/* ground shadows — contact depth for each object */}
      <ellipse cx="130" cy="186" rx="58" ry="7" fill="#0F766E" opacity="0.16" />
      <ellipse cx="130" cy="186" rx="36" ry="4" fill="#0F766E" opacity="0.1" />
      <ellipse cx="70" cy="160" rx="22" ry="3.5" fill="#0F766E" opacity="0.1" />
      <ellipse cx="228" cy="162" rx="18" ry="3" fill="#0F766E" opacity="0.1" />

      {/* ══ MAIN TRUST SHIELD — center, largest ══ */}
      <g data-kc-why-anim style={svgAnim("kc-why-shield", "7s")}>
        {/* outer glow behind shield */}
        <ellipse cx="130" cy="98" rx="52" ry="62" fill="#2DD4BF" opacity="0.1" />
        {/* shield body */}
        <path d="M130 18 L208 47 V100 C208 147 175 179 130 194 C85 179 52 147 52 100 V47 Z" fill="url(#wkcShield)" />
        {/* top bevel */}
        <path d="M130 18 L208 47 V58 L130 28 L52 58 V47 Z" fill="#A7F3D0" opacity="0.5" />
        {/* left rim light */}
        <path d="M55 50 V100 C55 138 80 167 116 183" stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        {/* right rim light */}
        <path d="M205 50 V100 C205 138 180 167 144 183" stroke="#6EE7B7" strokeOpacity="0.28" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        {/* recessed face */}
        <path d="M130 38 L189 61 V100 C189 135 163 160 130 172 C97 160 71 135 71 100 V61 Z" fill="url(#wkcShieldIn)" />
        <path d="M130 38 L189 61 V100 C189 135 163 160 130 172 C97 160 71 135 71 100 V61 Z" fill="none" stroke="#0D9488" strokeOpacity="0.25" strokeWidth="1.2" />
        {/* medical cross */}
        <g data-kc-why-anim style={svgAnim("kc-why-plus", "5.4s", "0.6s")}>
          <rect x="118" y="70" width="24" height="64" rx="8" fill="url(#wkcCross)" />
          <rect x="100" y="90" width="60" height="24" rx="8" fill="url(#wkcCross)" />
          <rect x="122" y="74" width="6" height="56" rx="3" fill="#5EEAD4" opacity="0.6" />
          <rect x="104" y="94" width="52" height="6" rx="3" fill="#5EEAD4" opacity="0.45" />
        </g>
        {/* inner cast shadow */}
        <ellipse cx="130" cy="150" rx="28" ry="5" fill="#0D9488" opacity="0.14" />
      </g>

      {/* ══ VERIFIED BADGE — lower-right ══ */}
      <g data-kc-why-anim style={svgAnim("kc-why-badge", "5.2s", "0.4s")}>
        <circle cx="188" cy="146" r="20" fill="#0D9488" opacity="0.18" />
        <circle cx="186" cy="143" r="19" fill="url(#wkcBadge)" stroke="#FFFFFF" strokeWidth="2.5" />
        <path d="M178 143 l5.5 5.5 l11 -12" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* ══ BLISTER STRIP — left, tilted ══ */}
      <g data-kc-why-anim style={svgAnim("kc-why-strip", "5.6s")}>
        <g transform="rotate(-11 49 132)">
          <rect x="20" y="112" width="58" height="40" rx="9" fill="url(#wkcCard)" stroke="#99F6E4" strokeWidth="1.6" />
          <rect x="20" y="112" width="58" height="8" rx="4" fill="#34D399" opacity="0.38" />
          <circle cx="33" cy="131" r="5.5" fill="#D1FAE5" stroke="#0D9488" strokeWidth="1.3" />
          <circle cx="49" cy="131" r="5.5" fill="#D1FAE5" stroke="#0D9488" strokeWidth="1.3" />
          <circle cx="65" cy="131" r="5.5" fill="#D1FAE5" stroke="#0D9488" strokeWidth="1.3" />
          <rect x="28" y="141" width="26" height="3" rx="1.5" fill="#2DD4BF" />
          <rect x="28" y="146" width="16" height="2.6" rx="1.3" fill="#99F6E4" />
        </g>
      </g>

      {/* ══ CAPSULE — upper-right ══ */}
      <g data-kc-why-anim style={svgAnim("kc-why-capsule", "6.2s", "0.8s")}>
        <g transform="rotate(-28 214 74)">
          <rect x="196" y="66" width="20" height="17" rx="8.5" fill="url(#wkcCapA)" />
          <rect x="214" y="66" width="20" height="17" rx="8.5" fill="url(#wkcCapB)" />
          <rect x="199" y="71" width="6" height="3" rx="1.5" fill="#FFFFFF" opacity="0.8" />
        </g>
      </g>

      {/* ══ DELIVERY PACKAGE — upper-left (NEW) ══ */}
      <g data-kc-why-anim style={svgAnim("kc-why-package", "7.2s", "1.2s")}>
        <g transform="translate(52, 4) rotate(-3 18 16)">
          {/* box shadow */}
          <ellipse cx="18" cy="36" rx="16" ry="3.5" fill="#0F766E" opacity="0.1" />
          {/* side panel (3D depth) */}
          <path d="M32 8 L40 2 L40 28 L32 34 Z" fill="url(#wkcBoxSide)" stroke="#99F6E4" strokeWidth="0.8" />
          {/* box body */}
          <rect x="0" y="8" width="32" height="26" rx="4" fill="url(#wkcBox)" stroke="#99F6E4" strokeWidth="1.5" />
          {/* box top flap */}
          <path d="M0 8 L8 1 L40 1 L32 8 Z" fill="#F0FDFA" stroke="#99F6E4" strokeWidth="1" />
          {/* tape */}
          <line x1="16" y1="8" x2="16" y2="34" stroke="#34D399" strokeWidth="2.2" strokeLinecap="round" opacity="0.55" />
          <line x1="2" y1="21" x2="30" y2="21" stroke="#34D399" strokeWidth="2" strokeLinecap="round" opacity="0.42" />
          {/* handle */}
          <path d="M11 1 Q16 -5 21 1" stroke="#0D9488" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        </g>
      </g>

      {/* ══ MEDICINE BOTTLE — right ══ */}
      <g data-kc-why-anim style={svgAnim("kc-why-bottle", "5.9s", "1.4s")}>
        <rect x="220" y="92" width="16" height="10" rx="3" fill="#0D9488" />
        <rect x="223" y="101" width="10" height="7" fill="#0F766E" />
        <rect x="212" y="107" width="32" height="46" rx="7" fill="url(#wkcCard)" stroke="#99F6E4" strokeWidth="1.6" />
        <rect x="216" y="120" width="24" height="22" rx="4" fill="#2DD4BF" opacity="0.2" />
        <path d="M228 125 v12 M222 131 h12" stroke="#0F766E" strokeWidth="3" strokeLinecap="round" opacity="0.72" />
        <rect x="217" y="110" width="7" height="32" rx="3.5" fill="#FFFFFF" opacity="0.55" />
      </g>

      {/* ══ PHARMACY CROSS — upper-left ══ */}
      <g data-kc-why-anim style={svgAnim("kc-why-cross-rot", "6.8s", "1.1s")}>
        <rect x="36" y="20" width="11" height="30" rx="4.5" fill="url(#wkcCross)" opacity="0.85" />
        <rect x="26.5" y="30" width="30" height="11" rx="4.5" fill="url(#wkcCross)" opacity="0.85" />
      </g>

      {/* ══ HEART — left, breathing ══ */}
      <g data-kc-why-anim style={svgAnim("kc-why-heart", "4.8s", "0.3s")}>
        <path
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
          transform="translate(20 86) scale(0.85)"
          fill="url(#wkcCapA)"
        />
      </g>

      {/* ══ PLUS MARKS ══ */}
      <g data-kc-why-anim style={svgAnim("kc-why-plus", "6.4s", "1.8s")}>
        <path d="M44 150 v11 M38.5 155.5 h11" stroke="#0E7490" strokeOpacity="0.4" strokeWidth="2.6" strokeLinecap="round" />
      </g>
      <g data-kc-why-anim style={svgAnim("kc-why-plus", "7.2s", "2.3s")}>
        <path d="M212 172 v9 M207.5 176.5 h9" stroke="#FB923C" strokeOpacity="0.55" strokeWidth="2.4" strokeLinecap="round" />
      </g>
      <g data-kc-why-anim style={svgAnim("kc-why-plus", "6s", "3s")}>
        <path d="M150 186 v8 M146 190 h8" stroke="#2DD4BF" strokeOpacity="0.4" strokeWidth="2.2" strokeLinecap="round" />
      </g>

      {/* ══ PARTICLES (fixed anchors) ══ */}
      <circle cx="86" cy="26" r="2.2" fill="#10B981" data-kc-why-anim style={svgAnim("kc-why-mote", "4.6s", "0.2s")} />
      <circle cx="200" cy="22" r="1.8" fill="#0D9488" data-kc-why-anim style={svgAnim("kc-why-mote", "5.4s", "1.1s")} />
      <circle cx="26" cy="126" r="2" fill="#38BDF8" data-kc-why-anim style={svgAnim("kc-why-mote", "5s", "1.9s")} />
      <circle cx="106" cy="180" r="1.9" fill="#FB923C" data-kc-why-anim style={svgAnim("kc-why-mote", "4.4s", "0.7s")} />
      <circle cx="190" cy="180" r="1.7" fill="#14B8A6" data-kc-why-anim style={svgAnim("kc-why-mote", "5.8s", "2.6s")} />
      <circle cx="155" cy="10" r="1.6" fill="#818CF8" data-kc-why-anim style={svgAnim("kc-why-mote", "6s", "3.2s")} />

      {/* ══ SPARKLES ══ */}
      <g data-kc-why-anim style={svgAnim("kc-why-twinkle", "3.8s", "0.4s")}>
        <path d="M216 28 l2 4.8 4.8 2 -4.8 2 -2 4.8 -2 -4.8 -4.8 -2 4.8 -2 Z" fill="#14B8A6" />
      </g>
      <g data-kc-why-anim style={svgAnim("kc-why-twinkle", "4.6s", "1.6s")}>
        <path d="M38 162 l1.6 3.8 3.8 1.6 -3.8 1.6 -1.6 3.8 -1.6 -3.8 -3.8 -1.6 3.8 -1.6 Z" fill="#FB923C" />
      </g>
      <g data-kc-why-anim style={svgAnim("kc-why-twinkle", "5.2s", "2.2s")}>
        <path d="M250 72 l1.3 3 3 1.3 -3 1.3 -1.3 3 -1.3 -3 -3 -1.3 3 -1.3 Z" fill="#818CF8" />
      </g>
      <g data-kc-why-anim style={svgAnim("kc-why-twinkle", "4.2s", "0.8s")}>
        <path d="M90 8 l1.4 3.2 3.2 1.4 -3.2 1.4 -1.4 3.2 -1.4 -3.2 -3.2 -1.4 3.2 -1.4 Z" fill="#5EEAD4" />
      </g>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function WhyKalyanChemist() {
  const prefersReducedMotion = useReducedMotion();
  const frameRef = useRef<HTMLDivElement | null>(null);

  /* ── rAF refs — pointer, scroll, card light; never in React state ── */
  const frameRafRef = useRef<number | null>(null);
  const pointerRef = useRef({ clientX: 0, clientY: 0, active: false });
  const scrollRafRef = useRef<number | null>(null);
  const cardRafRef = useRef<number | null>(null);
  const cardRef = useRef<{ el: HTMLDivElement; clientX: number; clientY: number } | null>(null);
  const [interactive, setInteractive] = useState(false);

  /* ── enable pointer depth on desktop with fine pointer, no reduced-motion ── */
  useEffect(() => {
    if (prefersReducedMotion) {
      setInteractive(false);
      return;
    }
    const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1024px)");
    const sync = () => setInteractive(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [prefersReducedMotion]);

  /* ── single cleanup for all rAF handles ── */
  useEffect(
    () => () => {
      if (frameRafRef.current !== null) cancelAnimationFrame(frameRafRef.current);
      if (cardRafRef.current !== null) cancelAnimationFrame(cardRafRef.current);
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    },
    [],
  );

  /* ══ POINTER DEPTH (mouse → CSS vars, one rAF/frame) ══ */
  const flushFrame = useCallback(() => {
    frameRafRef.current = null;
    const node = frameRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const { clientX, clientY, active } = pointerRef.current;
    const nx = active ? ((clientX - rect.left) / rect.width - 0.5) * 2 : 0;
    const ny = active ? ((clientY - rect.top) / rect.height - 0.5) * 2 : 0;
    node.style.setProperty("--wkc-px", nx.toFixed(3));
    node.style.setProperty("--wkc-py", ny.toFixed(3));
  }, []);

  const queueFlush = useCallback(() => {
    if (frameRafRef.current !== null) return;
    frameRafRef.current = requestAnimationFrame(flushFrame);
  }, [flushFrame]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      pointerRef.current = { clientX: e.clientX, clientY: e.clientY, active: true };
      queueFlush();
    },
    [queueFlush],
  );

  const handlePointerLeave = useCallback(() => {
    pointerRef.current = { clientX: 0, clientY: 0, active: false };
    queueFlush();
  }, [queueFlush]);

  /* ══ SCROLL DEPTH (scroll → CSS var, one rAF/frame) ══
     --wkc-scroll: 0 (section entering viewport from bottom) → 1 (section above viewport)
     Different layers use different multipliers to create parallax depth. */
  const flushScroll = useCallback(() => {
    scrollRafRef.current = null;
    const node = frameRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const vh = window.innerHeight;
    const progress = Math.max(0, Math.min(1, (vh - rect.top) / (vh + rect.height)));
    node.style.setProperty("--wkc-scroll", progress.toFixed(4));
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const onScroll = () => {
      if (scrollRafRef.current !== null) return;
      scrollRafRef.current = requestAnimationFrame(flushScroll);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    flushScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [prefersReducedMotion, flushScroll]);

  /* ══ CARD LIGHT (cursor position → CSS vars) ══ */
  const flushCard = useCallback(() => {
    cardRafRef.current = null;
    const p = cardRef.current;
    if (!p) return;
    const rect = p.el.getBoundingClientRect();
    p.el.style.setProperty("--wkc-mx", `${(p.clientX - rect.left).toFixed(1)}px`);
    p.el.style.setProperty("--wkc-my", `${(p.clientY - rect.top).toFixed(1)}px`);
  }, []);

  const handleCardPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      cardRef.current = { el: e.currentTarget, clientX: e.clientX, clientY: e.clientY };
      if (cardRafRef.current !== null) return;
      cardRafRef.current = requestAnimationFrame(flushCard);
    },
    [flushCard],
  );

  /* ══ SCROLL-REVEAL VARIANTS ══ */
  const reveal = (delay: number, y = 18): Variants => ({
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y },
    visible: { opacity: 1, y: 0, transition: { duration: 0.55, delay, ease: EASE } },
  });

  const atmosphere: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 1.03 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.8, ease: EASE } },
  };

  const visualReveal: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 30, scale: 0.95, rotateX: 10 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      rotateX: 0,
      transition: { duration: 0.75, delay: 0.24, ease: EASE },
    },
  };

  /* ══ DEPTH PARALLAX TRANSFORMS ══ */
  const parallax = (x: number, y: number) => ({
    transform: `translate3d(calc(var(--wkc-px, 0) * ${x}px), calc(var(--wkc-py, 0) * ${y}px), 0)`,
  });

  const scrollDepth = (factor: number) => ({
    transform: `translate3d(0, calc(var(--wkc-scroll, 0.5) * ${factor}px), 0)`,
  });

  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <style>{`
        /* ── Multi-property floating motions for natural, premium feel ── */
        @keyframes kc-why-floatA {
          0%, 100% { transform: translateY(0) scale(1) rotate(0deg); }
          25% { transform: translateY(-5px) scale(1.012) rotate(0.4deg); }
          50% { transform: translateY(-3px) scale(1.006) rotate(-0.2deg); }
          75% { transform: translateY(-7px) scale(1.015) rotate(0.3deg); }
        }
        @keyframes kc-why-shield {
          0%, 100% { transform: translateY(0) scale(1) rotate(0deg); }
          20% { transform: translateY(-4px) scale(1.01) rotate(0.3deg); }
          50% { transform: translateY(-7px) scale(1.02) rotate(0deg); }
          80% { transform: translateY(-3px) scale(1.006) rotate(-0.2deg); }
        }
        @keyframes kc-why-strip {
          0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
          30% { transform: translateY(-4px) rotate(-2deg) scale(1.01); }
          70% { transform: translateY(-2px) rotate(1deg) scale(1.004); }
        }
        @keyframes kc-why-capsule {
          0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
          35% { transform: translateY(-8px) rotate(5deg) scale(1.04); }
          65% { transform: translateY(-4px) rotate(-2deg) scale(1.015); }
        }
        @keyframes kc-why-bottle {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          30% { transform: translateY(3px) rotate(-1.5deg); }
          70% { transform: translateY(-4px) rotate(1deg); }
        }
        @keyframes kc-why-package {
          0%, 100% { transform: translateY(0) rotate(0deg) scale(1); }
          25% { transform: translateY(-6px) rotate(-3deg) scale(1.015); }
          55% { transform: translateY(-3px) rotate(1.5deg) scale(1.005); }
          80% { transform: translateY(-7px) rotate(-1deg) scale(1.012); }
        }
        @keyframes kc-why-cross-rot {
          0%, 100% { transform: rotate(-5deg) translateY(0); }
          50% { transform: rotate(5deg) translateY(-2px); }
        }
        @keyframes kc-why-heart {
          0%, 100% { transform: scale(1) translateX(0); opacity: 0.78; }
          50% { transform: scale(1.08) translateX(1px); opacity: 1; }
        }
        @keyframes kc-why-badge {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.07); }
        }
        @keyframes kc-why-plus {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(0, -1.8px); }
        }
        @keyframes kc-why-mote {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-5px) scale(1.15); opacity: 0.85; }
        }
        @keyframes kc-why-twinkle {
          0%, 100% { opacity: 0.35; transform: scale(0.85); }
          50% { opacity: 1; transform: scale(1.1); }
        }
        @keyframes kc-why-orb-a {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(28px, -20px); }
        }
        @keyframes kc-why-orb-b {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-24px, 18px); }
        }
        @keyframes kc-why-orb-c {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(16px, 14px); }
        }
        @keyframes kc-why-light-drift {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.55; }
          50% { transform: translate3d(16px, -12px, 0) scale(1.08); opacity: 0.85; }
        }
        @keyframes kc-why-dust {
          0% { opacity: 0; transform: translate3d(0, 6px, 0) scale(0.7); }
          40% { opacity: 0.8; transform: translate3d(0, -6px, 0) scale(1); }
          100% { opacity: 0; transform: translate3d(0, -24px, 0) scale(0.7); }
        }
        @keyframes kc-why-halo {
          0%, 100% { opacity: 0.18; transform: scale(0.95); }
          50% { opacity: 0.42; transform: scale(1.08); }
        }
        /* Per-card hover icon motions */
        @keyframes kc-why-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.16); }
        }
        @keyframes kc-why-drive {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(4px); }
        }
        @keyframes kc-why-tick {
          0%, 100% { transform: rotate(0deg); }
          30% { transform: rotate(12deg); }
          65% { transform: rotate(-8deg); }
        }
        @keyframes kc-why-tilt {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-12deg); }
        }
        .kc-why-card:hover [data-kc-icon="shield"] { animation: kc-why-pulse 2.4s ease-in-out infinite; }
        .kc-why-card:hover [data-kc-icon="truck"] { animation: kc-why-drive 1.8s ease-in-out infinite; }
        .kc-why-card:hover [data-kc-icon="clock"] { animation: kc-why-tick 2.6s ease-in-out infinite; }
        .kc-why-card:hover [data-kc-icon="pill"] { animation: kc-why-tilt 2.4s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          [data-kc-why-anim] { animation: none !important; }
          .kc-why-card:hover [data-kc-icon] { animation: none !important; }
        }
      `}</style>

      <motion.div
        ref={frameRef}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        onPointerMove={interactive ? handlePointerMove : undefined}
        onPointerLeave={interactive ? handlePointerLeave : undefined}
        className="relative overflow-hidden rounded-[28px] border border-white/90 bg-white/40 shadow-[0_34px_90px_-40px_rgba(13,59,56,0.4)] ring-1 ring-teal-900/5"
      >
        {/* ═══ LAYER 1 — BACKGROUND ATMOSPHERE ═══ */}
        <motion.div
          aria-hidden
          variants={atmosphere}
          className="pointer-events-none absolute inset-0 overflow-hidden will-change-transform"
          style={!prefersReducedMotion ? scrollDepth(28) : undefined}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-[#F6FCFA] via-[#E8F5F0] to-[#DFF1F6]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(52,211,153,0.28),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(56,189,248,0.22),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(253,186,116,0.14),transparent_52%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(45,212,191,0.2),transparent_50%)]" />
          {/* moving light zones */}
          <div
            data-kc-why-anim
            className="absolute -top-24 left-1/4 h-72 w-[46%] rounded-full bg-emerald-200/60 blur-3xl"
            style={{ animation: "kc-why-light-drift 22s ease-in-out infinite" }}
          />
          <div
            data-kc-why-anim
            className="absolute -bottom-28 right-1/4 h-72 w-[42%] rounded-full bg-sky-200/60 blur-3xl"
            style={{ animation: "kc-why-light-drift 27s ease-in-out 2s infinite" }}
          />
          {/* daylight wash */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,white_0%,transparent_46%)]" />
          {/* dot grid */}
          <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(13,148,136,0.12)_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black_28%,transparent_78%)]" />
          {/* drifting orbs — deepest layer */}
          <div
            className="absolute -inset-14 transition-transform duration-200 ease-out"
            style={interactive ? parallax(-7, -4) : undefined}
          >
            <div data-kc-why-anim className="absolute -left-10 top-0 size-72 rounded-full bg-emerald-200/70 blur-3xl" style={{ animation: "kc-why-orb-a 24s ease-in-out infinite" }} />
            <div data-kc-why-anim className="absolute -right-16 bottom-0 size-80 rounded-full bg-teal-200/70 blur-3xl" style={{ animation: "kc-why-orb-b 28s ease-in-out infinite" }} />
            <div data-kc-why-anim className="absolute -right-6 top-1/4 size-56 rounded-full bg-cyan-200/70 blur-3xl" style={{ animation: "kc-why-orb-c 22s ease-in-out infinite" }} />
            <div data-kc-why-anim className="absolute bottom-0 left-1/3 size-56 rounded-full bg-orange-200/60 blur-3xl" style={{ animation: "kc-why-orb-a 30s ease-in-out infinite" }} />
          </div>
        </motion.div>

        {/* ═══ LAYER 2 — MIDDLE: translucent shapes + dust ═══ */}
        <motion.div
          aria-hidden
          variants={reveal(0.46, 10)}
          className="pointer-events-none absolute inset-0 overflow-hidden will-change-transform"
          style={!prefersReducedMotion ? scrollDepth(14) : undefined}
        >
          <div
            className="absolute inset-0 transition-transform duration-200 ease-out"
            style={interactive ? parallax(13, 8) : undefined}
          >
            <div className="absolute right-10 top-8 size-28 rounded-full border border-teal-900/10 bg-white/50 shadow-[0_16px_30px_-22px_rgba(13,59,56,0.3)]" />
            <div className="absolute -left-10 bottom-16 size-40 rotate-12 rounded-[2.5rem] border border-teal-900/10 bg-white/40 shadow-[0_18px_34px_-24px_rgba(13,59,56,0.3)]" />
            <div className="absolute -bottom-6 right-1/3 size-24 rounded-full border border-dashed border-teal-700/12" />
            <Plus className="absolute left-[8%] top-6 size-4 rotate-12 text-teal-600/28 drop-shadow-[0_6px_10px_rgba(13,59,56,0.16)]" />
            <Plus className="absolute bottom-8 left-[46%] size-3.5 rotate-45 text-indigo-400/28" />
            <Plus className="absolute bottom-10 right-[6%] size-4 -rotate-12 text-orange-500/30" />
            {PARTICLES.map((p, i) => (
              <span
                key={i}
                data-kc-why-anim
                className="absolute rounded-full"
                style={{
                  left: p.left,
                  top: p.top,
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  animation: `kc-why-dust ${p.duration} ease-in-out ${p.delay} infinite`,
                }}
              />
            ))}
          </div>
        </motion.div>

        {/* ═══ LAYER 3 — FOREGROUND: heading, 3D visual, trust points ═══ */}
        <div className="relative grid items-center gap-8 px-6 pb-2 pt-10 [perspective:1000px] sm:px-10 sm:pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-4">
          {/* ── LEFT: Heading + text ── */}
          <div>
            <motion.div variants={reveal(0.04, 14)}>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/20 bg-emerald-50 px-3.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-800 shadow-[0_10px_22px_-16px_rgba(16,185,129,0.65)]">
                <Shield className="size-3" />
                Why Choose Us
              </div>
            </motion.div>
            <motion.h2
              variants={reveal(0.1, 22)}
              className="mt-4 bg-gradient-to-br from-[#0B3B36] via-[#065F46] to-[#0FA3A3] bg-clip-text text-[34px] font-extrabold leading-[1.06] tracking-tight text-transparent sm:text-5xl lg:text-[56px]"
            >
              Why Kalyan Chemist
            </motion.h2>
            <div className="mt-4 max-w-lg space-y-1 text-[15px] leading-relaxed text-teal-950/70 sm:text-base lg:text-lg">
              <motion.p variants={reveal(0.17, 12)}>
                We are committed to making quality healthcare accessible, reliable,
              </motion.p>
              <motion.p variants={reveal(0.22, 12)}>
                and convenient for every household.
              </motion.p>
            </div>
          </div>

          {/* ── RIGHT: Main 3D visual ── */}
          <motion.div
            variants={visualReveal}
            className="group/visual relative mx-auto w-full max-w-[320px] lg:max-w-none"
          >
            <div
              className="relative transition-transform duration-200 ease-out will-change-transform"
              style={interactive ? parallax(22, 14) : undefined}
            >
              {/* ground glow */}
              <div className="absolute inset-x-6 bottom-4 top-10 rounded-full bg-emerald-300/50 blur-2xl transition-[transform,background-color] duration-300 ease-out group-hover/visual:scale-105 group-hover/visual:bg-emerald-200/75" />
              <div className="relative h-48 [perspective:900px] sm:h-52 lg:h-64">
                <div
                  data-kc-why-anim
                  className="size-full"
                  style={{ animation: "kc-why-floatA 6.5s ease-in-out infinite" }}
                >
                  <div className="size-full will-change-transform transition-transform duration-300 ease-out group-hover/visual:[transform:translate3d(0,-10px,0)_scale(1.05)_rotateX(6deg)_rotateY(-5deg)]">
                    <TrustIllustration />
                  </div>
                </div>
                {/* hover lighting */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-out group-hover/visual:opacity-100"
                  style={{ background: "radial-gradient(ellipse at 32% 22%, rgba(255,255,255,0.65), transparent 60%)" }}
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* ═══ TRUST CARDS — cursor light on inner element to avoid Framer Motion inline-transform conflict ═══ */}
        <motion.div className="relative grid gap-3 border-t border-teal-900/10 bg-white/50 px-6 py-7 [perspective:1200px] sm:grid-cols-2 sm:px-10 lg:grid-cols-4 lg:py-8">
          {TRUST_POINTS.map((point, i) => (
            <motion.div
              key={point.title}
              variants={reveal(0.32 + i * 0.07)}
              onPointerMove={interactive ? handleCardPointerMove : undefined}
              className="relative [perspective:1200px]"
            >
              <div className="kc-why-card group relative isolate h-full overflow-hidden rounded-2xl border border-white/80 bg-white/75 p-5 shadow-[0_14px_34px_-24px_rgba(13,59,56,0.35)] transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out will-change-transform [perspective:600px] hover:[transform:translate3d(0,-8px,0)_rotateX(4deg)_rotateY(-3deg)] hover:border-emerald-200 hover:bg-white hover:shadow-[0_32px_60px_-28px_rgba(13,148,136,0.48)]">
                {/* cursor light */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
                  style={{ background: "radial-gradient(240px circle at var(--wkc-mx, 50%) var(--wkc-my, 50%), rgba(16,185,129,0.14), transparent 68%)" }}
                />
                {/* top edge highlight */}
                <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/60 to-transparent" />

                <div className="relative flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_10px_22px_-12px_rgba(13,148,136,0.7)] ring-1 ring-inset ring-white/25 transition-[transform,box-shadow,background-color,color] duration-200 ease-out will-change-transform group-hover:from-emerald-600 group-hover:to-teal-700 group-hover:shadow-[0_16px_28px,-12px_rgba(13,148,136,0.6)] group-hover:[transform:translate3d(0,-4px,0)_scale(1.07)_rotateX(10deg)_rotateY(-7deg)]">
                  <span
                    aria-hidden
                    data-kc-why-anim
                    className="absolute inset-0 rounded-xl bg-emerald-400/40 blur-[7px]"
                    style={{ animation: `kc-why-halo 4.6s ease-in-out ${(i * 0.5).toFixed(1)}s infinite` }}
                  />
                  <span data-kc-why-anim data-kc-icon={point.iconAnim} className="relative block">
                    <point.icon className="size-5.5" strokeWidth={1.8} />
                  </span>
                </div>

                <h3 className="relative mt-3.5 text-[15px] font-semibold text-teal-950 transition-colors duration-200 ease-out group-hover:text-emerald-700">
                  {point.title}
                </h3>
                <p className="relative mt-1.5 text-[13px] leading-relaxed text-slate-600 transition-colors duration-200 ease-out group-hover:text-slate-700">
                  {point.description}
                </p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}