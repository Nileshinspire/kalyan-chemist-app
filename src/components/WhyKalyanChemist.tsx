import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ShieldCheck, Truck, Clock3, Pill, Shield, Plus } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ── Existing trust points (content unchanged) ──
   iconAnim selects that point's signature hover motion in the stylesheet below. */
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

/* ── Ambient dust motes for the middle depth layer (pure CSS, transform/opacity only) ── */
const PARTICLES = [
  { left: "12%", top: "26%", size: 3, delay: "0s", duration: "11s", color: "rgba(153,246,228,0.75)" },
  { left: "23%", top: "68%", size: 2, delay: "1.6s", duration: "13s", color: "rgba(255,255,255,0.55)" },
  { left: "41%", top: "18%", size: 2, delay: "3.1s", duration: "12s", color: "rgba(147,197,253,0.6)" },
  { left: "58%", top: "74%", size: 3, delay: "0.8s", duration: "14s", color: "rgba(153,246,228,0.6)" },
  { left: "72%", top: "22%", size: 2, delay: "2.4s", duration: "12.5s", color: "rgba(253,186,116,0.6)" },
  { left: "88%", top: "58%", size: 2, delay: "4.2s", duration: "13.5s", color: "rgba(255,255,255,0.5)" },
];

/* ── Premium soft-3D trust illustration (Kalyan Chemist palette) ──
   Every symbol keeps a FIXED position — only small local motion is applied,
   so the cluster stays anchored inside one designated visual area. ── */
const svgAnim = (name: string, duration: string, delay = "0s"): CSSProperties => ({
  animation: `${name} ${duration} ease-in-out ${delay} infinite`,
  transformBox: "fill-box",
  transformOrigin: "center",
});

function TrustIllustration() {
  return (
    <svg viewBox="0 0 260 200" fill="none" className="size-full" aria-hidden="true">
      <defs>
        <radialGradient id="wkcGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#2DD4BF" stopOpacity="0.45" />
          <stop offset="1" stopColor="#2DD4BF" stopOpacity="0" />
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
        <radialGradient id="wkcArea" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#5EEAD4" stopOpacity="0.12" />
          <stop offset="0.68" stopColor="#5EEAD4" stopOpacity="0.05" />
          <stop offset="1" stopColor="#5EEAD4" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ambient glow marks the designated visual area — no orbit/ellipse paths */}
      <circle cx="130" cy="100" r="86" fill="url(#wkcGlow)" />
      <circle cx="130" cy="100" r="78" fill="url(#wkcArea)" />

      {/* ground shadow (static contact depth) */}
      <ellipse cx="130" cy="184" rx="62" ry="8.5" fill="#022C26" opacity="0.30" />
      <ellipse cx="130" cy="184" rx="38" ry="4.5" fill="#022C26" opacity="0.20" />

      {/* ── main trust shield ── */}
      <g data-kc-why-anim style={svgAnim("kc-why-shield", "7s")}>
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
        {/* medical cross — gently shifts */}
        <g data-kc-why-anim style={svgAnim("kc-why-plus", "5.4s", "0.6s")}>
          <rect x="118" y="72" width="24" height="60" rx="8" fill="url(#wkcCross)" />
          <rect x="100" y="90" width="60" height="24" rx="8" fill="url(#wkcCross)" />
          <rect x="122" y="76" width="6" height="52" rx="3" fill="#5EEAD4" opacity="0.55" />
          <rect x="104" y="94" width="52" height="6" rx="3" fill="#5EEAD4" opacity="0.4" />
        </g>
        {/* soft cast shadow inside the recess */}
        <ellipse cx="130" cy="150" rx="30" ry="6" fill="#0B7F72" opacity="0.14" />
      </g>

      {/* verified badge — soft pulse */}
      <g data-kc-why-anim style={svgAnim("kc-why-badge", "5.2s", "0.4s")}>
        <circle cx="188" cy="146" r="19" fill="#0B7F72" opacity="0.35" />
        <circle cx="186" cy="143" r="18" fill="url(#wkcBadge)" stroke="#FFFFFF" strokeWidth="2.4" />
        <path d="M178 143 l5.5 5.5 l11 -12" stroke="#FFFFFF" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* blister strip — fixed position, small local float */}
      <g data-kc-why-anim style={svgAnim("kc-why-strip", "5.6s")}>
        <g transform="rotate(-11 49 132)">
          <rect x="20" y="112" width="58" height="40" rx="9" fill="url(#wkcCard)" stroke="#99F6E4" strokeWidth="1.4" />
          <rect x="20" y="112" width="58" height="8" rx="4" fill="#14B8A6" opacity="0.5" />
          <circle cx="33" cy="131" r="5" fill="#D6F7ED" stroke="#0D9488" strokeWidth="1.2" />
          <circle cx="49" cy="131" r="5" fill="#D6F7ED" stroke="#0D9488" strokeWidth="1.2" />
          <circle cx="65" cy="131" r="5" fill="#D6F7ED" stroke="#0D9488" strokeWidth="1.2" />
          <rect x="28" y="141" width="26" height="3" rx="1.5" fill="#99F6E4" />
          <rect x="28" y="146" width="16" height="2.6" rx="1.3" fill="#CCFBF1" />
        </g>
      </g>

      {/* capsule — fixed position, small local float */}
      <g data-kc-why-anim style={svgAnim("kc-why-capsule", "6.2s", "0.8s")}>
        <g transform="rotate(-28 214 74)">
          <rect x="196" y="66" width="18" height="16" rx="8" fill="url(#wkcCapA)" />
          <rect x="212" y="66" width="18" height="16" rx="8" fill="url(#wkcCapB)" />
          <rect x="199" y="70" width="6" height="3" rx="1.5" fill="#FFFFFF" opacity="0.7" />
        </g>
      </g>

      {/* ══ fixed symbol cluster — all anchored, only local motion ══ */}

      {/* pharmacy cross — upper left, subtle rotation */}
      <g data-kc-why-anim style={svgAnim("kc-why-cross-rot", "6.8s", "1.1s")}>
        <rect x="37" y="22" width="10" height="28" rx="4" fill="url(#wkcCross)" opacity="0.9" />
        <rect x="28" y="31" width="28" height="10" rx="4" fill="url(#wkcCross)" opacity="0.9" />
      </g>

      {/* heart — left, breathing glow */}
      <g data-kc-why-anim style={svgAnim("kc-why-heart", "4.8s", "0.3s")}>
        <path
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
          transform="translate(22 84) scale(0.85)"
          fill="url(#wkcCapA)"
        />
      </g>

      {/* medicine bottle — right, gentle vertical drift */}
      <g data-kc-why-anim style={svgAnim("kc-why-bottle", "5.9s", "1.4s")}>
        <rect x="218" y="92" width="15" height="9" rx="2.5" fill="#0D9488" />
        <rect x="221" y="100" width="9" height="6" fill="#0F766E" />
        <rect x="210" y="105" width="31" height="44" rx="7" fill="url(#wkcCard)" stroke="#99F6E4" strokeWidth="1.4" />
        <rect x="214" y="118" width="23" height="21" rx="4" fill="#14B8A6" opacity="0.22" />
        <path d="M225.5 123 v11 M220 128.5 h11" stroke="#0D9488" strokeWidth="3" strokeLinecap="round" opacity="0.75" />
        <rect x="215" y="108" width="7" height="30" rx="3.5" fill="#FFFFFF" opacity="0.4" />
      </g>

      {/* small medical plus marks — lower corners, gently shift */}
      <g data-kc-why-anim style={svgAnim("kc-why-plus", "6.4s", "1.8s")}>
        <path d="M44 146 v11 M38.5 151.5 h11" stroke="#CCFBF1" strokeOpacity="0.55" strokeWidth="2.6" strokeLinecap="round" />
      </g>
      <g data-kc-why-anim style={svgAnim("kc-why-plus", "7.2s", "2.3s")}>
        <path d="M210 168 v9 M205.5 172.5 h9" stroke="#FDE68A" strokeOpacity="0.45" strokeWidth="2.4" strokeLinecap="round" />
      </g>

      {/* soft particles floating around the cluster (fixed anchors) */}
      <circle cx="84" cy="28" r="2" fill="#99F6E4" data-kc-why-anim style={svgAnim("kc-why-mote", "4.6s", "0.2s")} />
      <circle cx="198" cy="24" r="1.7" fill="#FFFFFF" data-kc-why-anim style={svgAnim("kc-why-mote", "5.4s", "1.1s")} />
      <circle cx="28" cy="124" r="1.9" fill="#93C5FD" data-kc-why-anim style={svgAnim("kc-why-mote", "5s", "1.9s")} />
      <circle cx="104" cy="178" r="1.8" fill="#FDBA74" data-kc-why-anim style={svgAnim("kc-why-mote", "4.4s", "0.7s")} />
      <circle cx="188" cy="178" r="1.6" fill="#99F6E4" data-kc-why-anim style={svgAnim("kc-why-mote", "5.8s", "2.6s")} />

      {/* sparkles — gentle twinkle */}
      <g data-kc-why-anim style={svgAnim("kc-why-twinkle", "3.8s", "0.4s")}>
        <path d="M214 30 l1.9 4.6 4.6 1.9 -4.6 1.9 -1.9 4.6 -1.9 -4.6 -4.6 -1.9 4.6 -1.9 Z" fill="#5EEAD4" />
      </g>
      <g data-kc-why-anim style={svgAnim("kc-why-twinkle", "4.6s", "1.6s")}>
        <path d="M40 160 l1.5 3.6 3.6 1.5 -3.6 1.5 -1.5 3.6 -1.5 -3.6 -3.6 -1.5 3.6 -1.5 Z" fill="#FB923C" />
      </g>
      <g data-kc-why-anim style={svgAnim("kc-why-twinkle", "5.2s", "2.2s")}>
        <path d="M248 74 l1.2 2.9 2.9 1.2 -2.9 1.2 -1.2 2.9 -1.2 -2.9 -2.9 -1.2 2.9 -1.2 Z" fill="#A78BFA" />
      </g>
    </svg>
  );
}

export default function WhyKalyanChemist() {
  const prefersReducedMotion = useReducedMotion();
  const frameRef = useRef<HTMLDivElement | null>(null);

  /* Pointer-depth state lives in refs — never in React state — so mousemove
     never triggers a re-render. One rAF flush per frame writes CSS variables. */
  const frameRafRef = useRef<number | null>(null);
  const pointerRef = useRef({ clientX: 0, clientY: 0, active: false });
  const cardRafRef = useRef<number | null>(null);
  const cardRef = useRef<{ el: HTMLDivElement; clientX: number; clientY: number } | null>(null);
  const [interactive, setInteractive] = useState(false);

  /* Enable pointer depth only on desktop-class devices with a fine pointer
     and only when the user has not asked for reduced motion. */
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

  useEffect(
    () => () => {
      if (frameRafRef.current !== null) cancelAnimationFrame(frameRafRef.current);
      if (cardRafRef.current !== null) cancelAnimationFrame(cardRafRef.current);
    },
    [],
  );

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

  /* Per-card light follows the cursor via two CSS variables, also rAF-throttled. */
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

  /* Scroll-reveal: explicit short delays give a deterministic sequence
     (atmosphere → heading → text → visual → trust points → decorations). */
  const reveal = (delay: number, y = 18): Variants => ({
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.55, delay, ease: EASE },
    },
  });

  const atmosphere: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 1.03 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.8, ease: EASE } },
  };

  const visualReveal: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 26, scale: 0.96, rotateX: 8 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      rotateX: 0,
      transition: { duration: 0.7, delay: 0.24, ease: EASE },
    },
  };

  const parallax = (x: number, y: number) => ({
    transform: `translate3d(calc(var(--wkc-px, 0) * ${x}px), calc(var(--wkc-py, 0) * ${y}px), 0)`,
  });

  return (
    <section className="mx-auto max-w-7xl px-6 py-24">
      <style>{`
        /* ── cluster symbol motions: strictly local (a few px / degrees) ── */
        @keyframes kc-why-floatA {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-3px) scale(1.008); }
        }
        @keyframes kc-why-shield {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-2.5px) scale(1.012); }
        }
        @keyframes kc-why-strip {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-3px) rotate(-1.5deg); }
        }
        @keyframes kc-why-capsule {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-3px) rotate(3deg); }
        }
        @keyframes kc-why-bottle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(2.5px); }
        }
        @keyframes kc-why-cross-rot {
          0%, 100% { transform: rotate(-4deg); }
          50% { transform: rotate(4deg); }
        }
        @keyframes kc-why-heart {
          0%, 100% { transform: scale(1); opacity: 0.82; }
          50% { transform: scale(1.07); opacity: 1; }
        }
        @keyframes kc-why-badge {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes kc-why-plus {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(0, -1.6px); }
        }
        @keyframes kc-why-mote {
          0%, 100% { transform: translateY(0); opacity: 0.35; }
          50% { transform: translateY(-4px); opacity: 0.9; }
        }
        @keyframes kc-why-twinkle {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
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
        @keyframes kc-why-light-drift {
          0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.75; }
          50% { transform: translate3d(18px, -14px, 0) scale(1.08); opacity: 1; }
        }
        @keyframes kc-why-dust {
          0% { opacity: 0; transform: translate3d(0, 6px, 0) scale(0.7); }
          45% { opacity: 0.85; transform: translate3d(0, -8px, 0) scale(1); }
          100% { opacity: 0; transform: translate3d(0, -22px, 0) scale(0.7); }
        }
        @keyframes kc-why-halo {
          0%, 100% { opacity: 0.18; transform: scale(0.95); }
          50% { opacity: 0.4; transform: scale(1.06); }
        }
        /* signature per-trust-point motions — only run while their card is hovered */
        @keyframes kc-why-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.14); }
        }
        @keyframes kc-why-drive {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(3px); }
        }
        @keyframes kc-why-tick {
          0%, 100% { transform: rotate(0deg); }
          35% { transform: rotate(11deg); }
          70% { transform: rotate(-7deg); }
        }
        @keyframes kc-why-tilt {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-11deg); }
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
        className="relative overflow-hidden rounded-[28px] border border-emerald-300/20 shadow-[0_28px_70px_-28px_rgba(4,60,52,0.6)]"
      >
        {/* ═══ LAYER 1 — BACKGROUND ATMOSPHERE ═══ */}
        <motion.div
          aria-hidden
          variants={atmosphere}
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          {/* base colour wash + depth gradients */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#052e29] via-[#0a4a42] to-[#0d6b5f]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(45,212,191,0.40),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(96,165,250,0.26),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(251,146,60,0.20),transparent_52%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(139,92,246,0.16),transparent_50%)]" />
          {/* soft moving light zones */}
          <div
            data-kc-why-anim
            className="absolute -top-24 left-1/4 h-72 w-[46%] rounded-full bg-emerald-300/25 blur-3xl"
            style={{ animation: "kc-why-light-drift 22s ease-in-out infinite" }}
          />
          <div
            data-kc-why-anim
            className="absolute -bottom-28 right-1/4 h-72 w-[42%] rounded-full bg-sky-400/20 blur-3xl"
            style={{ animation: "kc-why-light-drift 27s ease-in-out 2s infinite" }}
          />
          {/* depth vignette keeps the text crisp */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(2,26,23,0.5))]" />
          {/* faint healthcare dot grid */}
          <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(204,251,241,0.16)_1px,transparent_1px)] bg-[size:20px_20px] [mask-image:radial-gradient(ellipse_at_center,black_28%,transparent_78%)]" />

          {/* slow drifting colour orbs — deepest depth, moves least */}
          <div
            className="absolute -inset-14 transition-transform duration-200 ease-out"
            style={interactive ? parallax(-7, -4) : undefined}
          >
            <div
              data-kc-why-anim
              className="absolute -left-10 top-0 size-72 rounded-full bg-teal-300/25 blur-3xl"
              style={{ animation: "kc-why-orb-a 24s ease-in-out infinite" }}
            />
            <div
              data-kc-why-anim
              className="absolute -right-16 bottom-0 size-80 rounded-full bg-sky-400/20 blur-3xl"
              style={{ animation: "kc-why-orb-b 28s ease-in-out infinite" }}
            />
            <div
              data-kc-why-anim
              className="absolute -right-6 top-1/4 size-56 rounded-full bg-emerald-300/20 blur-3xl"
              style={{ animation: "kc-why-orb-c 22s ease-in-out infinite" }}
            />
            <div
              data-kc-why-anim
              className="absolute bottom-0 left-1/3 size-56 rounded-full bg-orange-300/15 blur-3xl"
              style={{ animation: "kc-why-orb-a 30s ease-in-out infinite" }}
            />
          </div>
        </motion.div>

        {/* ═══ LAYER 2 — MIDDLE: floating healthcare forms + ambient dust ═══ */}
        <motion.div
          aria-hidden
          variants={reveal(0.46, 10)}
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div
            className="absolute inset-0 transition-transform duration-200 ease-out"
            style={interactive ? parallax(13, 8) : undefined}
          >
            {/* translucent abstract shapes — soft depth shadows */}
            <div className="absolute right-10 top-8 size-28 rounded-full border border-white/10 shadow-[0_16px_30px_-22px_rgba(0,0,0,0.7)]" />
            <div className="absolute -left-10 bottom-16 size-40 rotate-12 rounded-[2.5rem] border border-white/10 shadow-[0_18px_34px_-24px_rgba(0,0,0,0.7)]" />
            <div className="absolute -bottom-6 right-1/3 size-24 rounded-full border border-dashed border-teal-200/15" />
            <Plus className="absolute left-[8%] top-6 size-4 rotate-12 text-teal-200/25 drop-shadow-[0_6px_10px_rgba(2,26,23,0.5)]" />
            <Plus className="absolute bottom-8 left-[46%] size-3.5 rotate-45 text-sky-200/20" />
            <Plus className="absolute bottom-10 right-[6%] size-4 -rotate-12 text-orange-200/25" />

            {/* ambient dust motes */}
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

        {/* ═══ LAYER 3 — FOREGROUND: headline, 3D visual, trust points ═══ */}
        <div className="relative grid items-center gap-6 px-6 pb-2 pt-8 [perspective:1000px] sm:px-8 sm:pt-9 lg:grid-cols-[1.08fr_0.92fr] lg:gap-6 lg:pb-3">
          <div>
            <motion.div variants={reveal(0.04, 12)}>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100 shadow-[0_10px_22px_-18px_rgba(45,212,191,0.9)]">
                <Shield className="size-3" />
                Why Choose Us
              </div>
            </motion.div>
            <motion.h2
              variants={reveal(0.1, 20)}
              className="mt-3 bg-gradient-to-br from-white via-white to-emerald-200 bg-clip-text text-[28px] font-bold leading-[1.1] tracking-tight text-transparent sm:text-4xl lg:text-[42px]"
            >
              Why Kalyan Chemist
            </motion.h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-emerald-50/75 sm:text-[15px]">
              <motion.span variants={reveal(0.17, 12)} className="block">
                We are committed to making quality healthcare accessible, reliable,
              </motion.span>
              <motion.span variants={reveal(0.22, 12)} className="block">
                and convenient for every household.
              </motion.span>
            </p>
          </div>

          {/* Main 3D visual — hover lift/tilt, idle float, pointer parallax */}
          <motion.div
            variants={visualReveal}
            className="group/visual relative mx-auto w-full max-w-[300px] lg:max-w-none"
          >
            <div
              className="relative transition-transform duration-200 ease-out will-change-transform"
              style={interactive ? parallax(22, 14) : undefined}
            >
              {/* breathing ground glow doubles as the contact shadow */}
              <div className="absolute inset-x-6 bottom-6 top-10 rounded-full bg-teal-400/25 blur-2xl transition-[transform,background-color] duration-300 ease-out group-hover/visual:scale-105 group-hover/visual:bg-teal-300/40" />
              <div className="relative h-40 [perspective:900px] sm:h-44 lg:h-52">
                <div
                  data-kc-why-anim
                  className="size-full"
                  style={{ animation: "kc-why-floatA 6.5s ease-in-out infinite" }}
                >
                  <div className="size-full will-change-transform transition-transform duration-300 ease-out group-hover/visual:[transform:translate3d(0,-8px,0)_scale(1.04)_rotateX(5deg)_rotateY(-5deg)]">
                    <TrustIllustration />
                  </div>
                </div>
                {/* lighting shift on hover — integrated highlight, not neon */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-out group-hover/visual:opacity-100"
                  style={{
                    background: "radial-gradient(ellipse at 32% 22%, rgba(255,255,255,0.2), transparent 62%)",
                  }}
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Trust points — the reveal animates the outer wrapper while the hover depth
            lives on the inner surface, so the two transforms never fight. */}
        <motion.div className="relative grid gap-3 border-t border-white/10 px-6 py-6 [perspective:1200px] sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:py-7">
          {TRUST_POINTS.map((point, i) => (
            <motion.div
              key={point.title}
              variants={reveal(0.32 + i * 0.07)}
              onPointerMove={interactive ? handleCardPointerMove : undefined}
              className="relative [perspective:1200px]"
            >
              <div className="kc-why-card group relative isolate h-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-[0_10px_24px_-20px_rgba(2,26,23,0.9)] transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out will-change-transform [perspective:600px] hover:[transform:translate3d(0,-6px,0)_rotateX(3deg)_rotateY(-2deg)] hover:border-emerald-300/35 hover:bg-white/[0.11] hover:shadow-[0_28px_52px_-24px_rgba(45,212,191,0.6)]">
                {/* cursor-tracking interactive light */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
                  style={{
                    background:
                      "radial-gradient(220px circle at var(--wkc-mx, 50%) var(--wkc-my, 50%), rgba(45,212,191,0.18), transparent 68%)",
                  }}
                />
                {/* top edge highlight */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
                />

                <div className="relative flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-300/30 to-teal-500/20 text-emerald-50 ring-1 ring-inset ring-white/15 shadow-[0_10px_22px_-14px_rgba(45,212,191,0.9)] transition-[transform,box-shadow,background-color,color] duration-200 ease-out will-change-transform group-hover:from-emerald-300/55 group-hover:text-white group-hover:shadow-[0_14px_26px_-10px_rgba(45,212,191,0.85)] group-hover:[transform:translate3d(0,-3px,0)_scale(1.06)_rotateX(9deg)_rotateY(-6deg)]">
                  <span
                    aria-hidden
                    data-kc-why-anim
                    className="absolute inset-0 rounded-xl bg-emerald-300/25 blur-[6px]"
                    style={{ animation: `kc-why-halo 4.6s ease-in-out ${(i * 0.5).toFixed(1)}s infinite` }}
                  />
                  <span data-kc-why-anim data-kc-icon={point.iconAnim} className="relative block">
                    <point.icon className="size-5" strokeWidth={1.8} />
                  </span>
                </div>

                <h3 className="relative mt-3 text-sm font-semibold text-white transition-colors duration-200 ease-out group-hover:text-emerald-100">
                  {point.title}
                </h3>
                <p className="relative mt-1.5 text-[12px] leading-relaxed text-emerald-50/70 transition-colors duration-200 ease-out group-hover:text-emerald-50/85">
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
