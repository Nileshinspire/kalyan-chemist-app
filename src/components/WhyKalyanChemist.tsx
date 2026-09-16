import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ShieldCheck, Truck, Clock3, Pill, Shield, Plus } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

const TRUST_POINTS = [
  { icon: ShieldCheck, title: "Genuine Medicines", description: "Every product sourced directly from licensed manufacturers and verified distributors.", iconAnim: "shield" },
  { icon: Truck, title: "Prompt Delivery", description: "Orders dispatched within hours and delivered to your doorstep with care.", iconAnim: "truck" },
  { icon: Clock3, title: "Always Open Online", description: "Browse and order anytime — our platform is available around the clock.", iconAnim: "clock" },
  { icon: Pill, title: "Expert Guidance", description: "Our pharmacists are available to answer your questions about dosage and interactions.", iconAnim: "pill" },
];

const PARTICLES = [
  { left: "10%", top: "20%", size: 2.5, delay: "0s", dur: "11s", color: "rgba(255,255,255,0.3)" },
  { left: "25%", top: "70%", size: 2, delay: "1.4s", dur: "13s", color: "rgba(110,231,183,0.4)" },
  { left: "40%", top: "12%", size: 2, delay: "2.8s", dur: "12s", color: "rgba(56,189,248,0.35)" },
  { left: "58%", top: "80%", size: 2.5, delay: "0.6s", dur: "14s", color: "rgba(255,255,255,0.25)" },
  { left: "72%", top: "18%", size: 2, delay: "2s", dur: "12.5s", color: "rgba(167,243,208,0.35)" },
  { left: "88%", top: "58%", size: 2, delay: "3.6s", dur: "13.5s", color: "rgba(255,255,255,0.28)" },
  { left: "48%", top: "42%", size: 2, delay: "4.2s", dur: "15s", color: "rgba(45,212,191,0.4)" },
  { left: "14%", top: "52%", size: 2, delay: "5s", dur: "14s", color: "rgba(94,234,212,0.35)" },
];

const svgAnim = (n: string, d: string, dl = "0s"): CSSProperties => ({
  animation: `${n} ${d} ease-in-out ${dl} infinite`,
  transformBox: "fill-box",
  transformOrigin: "center",
});

/* ══════════════════════════════════════════════════════════════════════════
   LARGE 3D HEALTHCARE ILLUSTRATION — dark-background optimised
   viewBox 380×300, shield dominant, 7 floating objects + particles
   ══════════════════════════════════════════════════════════════════════════ */
function TrustIllustration() {
  return (
    <svg viewBox="0 0 380 300" fill="none" className="size-full" aria-hidden="true">
      <defs>
        {/* ── Shield ── */}
        <linearGradient id="wkcs" x1="0.15" y1="0" x2="0.85" y2="1">
          <stop offset="0" stopColor="#5EEAD4" />
          <stop offset="0.4" stopColor="#34D399" />
          <stop offset="0.75" stopColor="#10B981" />
          <stop offset="1" stopColor="#0F766E" />
        </linearGradient>
        <linearGradient id="wkcsi" x1="0.2" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.6" stopColor="#F0FDFA" />
          <stop offset="1" stopColor="#D1FAE5" />
        </linearGradient>
        <linearGradient id="wkccr" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0D9488" />
          <stop offset="1" stopColor="#065F46" />
        </linearGradient>
        {/* ── Badge ── */}
        <linearGradient id="wkcbg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34D399" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
        {/* ── Card / light surfaces ── */}
        <linearGradient id="wkcc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F0FDFA" />
        </linearGradient>
        {/* ── Capsule halves ── */}
        <linearGradient id="wkcA" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FDBA74" />
          <stop offset="1" stopColor="#F97316" />
        </linearGradient>
        <linearGradient id="wkcB" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
        {/* ── Box ── */}
        <linearGradient id="wkbx" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F0FDFA" />
        </linearGradient>
        <linearGradient id="wkbs" x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0" stopColor="#CCFBF1" />
          <stop offset="1" stopColor="#99F6E4" />
        </linearGradient>
        {/* ── Bottle ── */}
        <linearGradient id="wkbtl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F0FDFA" />
        </linearGradient>
      </defs>

      {/* ── ambient glow zone ── */}
      <circle cx="190" cy="140" r="140" fill="#2DD4BF" opacity="0.06" />
      <circle cx="190" cy="140" r="110" fill="#10B981" opacity="0.04" />

      {/* ── ground contact shadows ── */}
      <ellipse cx="190" cy="268" rx="80" ry="8" fill="#0D9488" opacity="0.22" />
      <ellipse cx="190" cy="268" rx="50" ry="5" fill="#0D9488" opacity="0.12" />
      <ellipse cx="80" cy="238" rx="28" ry="4" fill="#0D9488" opacity="0.14" />
      <ellipse cx="310" cy="240" rx="24" ry="3.5" fill="#0D9488" opacity="0.12" />
      <ellipse cx="330" cy="210" rx="20" ry="3" fill="#0D9488" opacity="0.1" />

      {/* ══════ MAIN SHIELD — dominant, centre ══════ */}
      <g data-kc-why-anim style={svgAnim("kc-why-shield", "7s")}>
        <ellipse cx="190" cy="128" rx="72" ry="86" fill="#2DD4BF" opacity="0.1" />
        {/* body */}
        <path d="M190 22 L300 64 V142 C300 212 254 256 190 278 C126 256 80 212 80 142 V64 Z" fill="url(#wkcs)" />
        {/* top bevel */}
        <path d="M190 22 L300 64 V80 L190 38 L80 80 V64 Z" fill="#A7F3D0" opacity="0.45" />
        {/* left rim */}
        <path d="M83 68 V142 C83 198 118 236 170 260" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" fill="none" />
        {/* right rim */}
        <path d="M297 68 V142 C297 198 262 236 210 260" stroke="#6EE7B7" strokeOpacity="0.22" strokeWidth="2" strokeLinecap="round" fill="none" />
        {/* recessed face */}
        <path d="M190 46 L275 80 V142 C275 195 240 228 190 246 C140 228 105 195 105 142 V80 Z" fill="url(#wkcsi)" />
        <path d="M190 46 L275 80 V142 C275 195 240 228 190 246 C140 228 105 195 105 142 V80 Z" fill="none" stroke="#0D9488" strokeOpacity="0.22" strokeWidth="1.4" />
        {/* cross */}
        <g data-kc-why-anim style={svgAnim("kc-why-plus", "5.4s", "0.6s")}>
          <rect x="174" y="82" width="32" height="100" rx="10" fill="url(#wkccr)" />
          <rect x="148" y="114" width="84" height="32" rx="10" fill="url(#wkccr)" />
          <rect x="179" y="88" width="8" height="88" rx="4" fill="#5EEAD4" opacity="0.55" />
          <rect x="153" y="120" width="74" height="8" rx="4" fill="#5EEAD4" opacity="0.42" />
        </g>
        <ellipse cx="190" cy="215" rx="38" ry="6" fill="#0D9488" opacity="0.12" />
      </g>

      {/* ══════ VERIFIED BADGE — lower right ══════ */}
      <g data-kc-why-anim style={svgAnim("kc-why-badge", "5.2s", "0.4s")}>
        <circle cx="275" cy="205" r="26" fill="#0D9488" opacity="0.2" />
        <circle cx="273" cy="202" r="24" fill="url(#wkcbg)" stroke="#FFFFFF" strokeWidth="3" />
        <path d="M263 202 l7 7 l14 -15" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>

      {/* ══════ CAPSULE — upper right ══════ */}
      <g data-kc-why-anim style={svgAnim("kc-why-capsule", "6.2s", "0.8s")}>
        <g transform="rotate(-26 310 68)">
          <rect x="288" y="58" width="26" height="22" rx="10.5" fill="url(#wkcA)" />
          <rect x="312" y="58" width="26" height="22" rx="10.5" fill="url(#wkcB)" />
          <rect x="292" y="65" width="8" height="4" rx="2" fill="#FFFFFF" opacity="0.75" />
        </g>
      </g>

      {/* ══════ DELIVERY PACKAGE — upper left ══════ */}
      <g data-kc-why-anim style={svgAnim("kc-why-package", "7.2s", "1.2s")}>
        <g transform="translate(58, 6) rotate(-3 20 18)">
          <ellipse cx="20" cy="42" rx="18" ry="4" fill="#0D9488" opacity="0.12" />
          <path d="M36 10 L46 2 L46 32 L36 40 Z" fill="url(#wkbs)" stroke="#99F6E4" strokeWidth="1" />
          <rect x="0" y="10" width="36" height="30" rx="5" fill="url(#wkbx)" stroke="#99F6E4" strokeWidth="1.8" />
          <path d="M0 10 L9 2 L45 2 L36 10 Z" fill="#F0FDFA" stroke="#99F6E4" strokeWidth="1.2" />
          <line x1="18" y1="10" x2="18" y2="40" stroke="#34D399" strokeWidth="2.6" strokeLinecap="round" opacity="0.55" />
          <line x1="2" y1="25" x2="34" y2="25" stroke="#34D399" strokeWidth="2.2" strokeLinecap="round" opacity="0.42" />
          <path d="M12 2 Q18 -6 24 2" stroke="#0D9488" strokeWidth="2" fill="none" strokeLinecap="round" />
        </g>
      </g>

      {/* ══════ MEDICINE BOTTLE — right ══════ */}
      <g data-kc-why-anim style={svgAnim("kc-why-bottle", "5.9s", "1.4s")}>
        <rect x="322" y="126" width="18" height="12" rx="4" fill="#0D9488" />
        <rect x="326" y="137" width="10" height="8" fill="#065F46" />
        <rect x="312" y="144" width="38" height="56" rx="8" fill="url(#wkbtl)" stroke="#99F6E4" strokeWidth="1.8" />
        <rect x="317" y="160" width="28" height="26" rx="5" fill="#2DD4BF" opacity="0.18" />
        <path d="M331 166 v14 M324 173 h14" stroke="#0F766E" strokeWidth="3.5" strokeLinecap="round" opacity="0.65" />
        <rect x="318" y="148" width="8" height="38" rx="4" fill="#FFFFFF" opacity="0.5" />
      </g>

      {/* ══════ BLISTER STRIP — left ══════ */}
      <g data-kc-why-anim style={svgAnim("kc-why-strip", "5.6s")}>
        <g transform="rotate(-10 68 200)">
          <rect x="30" y="172" width="76" height="52" rx="11" fill="url(#wkcc)" stroke="#99F6E4" strokeWidth="1.8" />
          <rect x="30" y="172" width="76" height="10" rx="5" fill="#34D399" opacity="0.35" />
          <circle cx="48" cy="196" r="7" fill="#D1FAE5" stroke="#0D9488" strokeWidth="1.5" />
          <circle cx="68" cy="196" r="7" fill="#D1FAE5" stroke="#0D9488" strokeWidth="1.5" />
          <circle cx="88" cy="196" r="7" fill="#D1FAE5" stroke="#0D9488" strokeWidth="1.5" />
          <rect x="38" y="210" width="34" height="3.5" rx="1.8" fill="#2DD4BF" />
          <rect x="38" y="216" width="22" height="3" rx="1.5" fill="#99F6E4" />
        </g>
      </g>

      {/* ══════ PHARMACY CROSS — upper left ══════ */}
      <g data-kc-why-anim style={svgAnim("kc-why-cross-rot", "6.8s", "1.1s")}>
        <rect x="40" y="22" width="14" height="40" rx="6" fill="url(#wkccr)" opacity="0.8" />
        <rect x="28" y="34" width="38" height="14" rx="6" fill="url(#wkccr)" opacity="0.8" />
      </g>

      {/* ══════ HEART — left ══════ */}
      <g data-kc-why-anim style={svgAnim("kc-why-heart", "4.8s", "0.3s")}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" transform="translate(22 112) scale(1)" fill="url(#wkcA)" />
      </g>

      {/* ══════ PLUS MARKS ══════ */}
      <g data-kc-why-anim style={svgAnim("kc-why-plus", "6.4s", "1.8s")}>
        <path d="M52 218 v14 M45 225 h14" stroke="#22D3EE" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g data-kc-why-anim style={svgAnim("kc-why-plus", "7.2s", "2.3s")}>
        <path d="M308 250 v12 M302 256 h12" stroke="#FB923C" strokeOpacity="0.5" strokeWidth="2.8" strokeLinecap="round" />
      </g>
      <g data-kc-why-anim style={svgAnim("kc-why-plus", "6s", "3s")}>
        <path d="M170 278 v10 M165 283 h10" stroke="#5EEAD4" strokeOpacity="0.45" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* ══════ PARTICLES (bright on dark) ══════ */}
      <circle cx="100" cy="30" r="2.5" fill="#5EEAD4" data-kc-why-anim style={svgAnim("kc-why-mote", "4.6s", "0.2s")} />
      <circle cx="280" cy="26" r="2" fill="#6EE7B7" data-kc-why-anim style={svgAnim("kc-why-mote", "5.4s", "1.1s")} />
      <circle cx="32" cy="155" r="2.2" fill="#38BDF8" data-kc-why-anim style={svgAnim("kc-why-mote", "5s", "1.9s")} />
      <circle cx="140" cy="260" r="2" fill="#FB923C" data-kc-why-anim style={svgAnim("kc-why-mote", "4.4s", "0.7s")} />
      <circle cx="265" cy="258" r="1.9" fill="#A7F3D0" data-kc-why-anim style={svgAnim("kc-why-mote", "5.8s", "2.6s")} />
      <circle cx="210" cy="12" r="1.8" fill="#FFFFFF" data-kc-why-anim style={svgAnim("kc-why-mote", "6s", "3.2s")} />

      {/* ══════ SPARKLES ══════ */}
      <g data-kc-why-anim style={svgAnim("kc-why-twinkle", "3.8s", "0.4s")}>
        <path d="M308 32 l2.5 6 6 2.5 -6 2.5 -2.5 6 -2.5 -6 -6 -2.5 6 -2.5 Z" fill="#5EEAD4" />
      </g>
      <g data-kc-why-anim style={svgAnim("kc-why-twinkle", "4.6s", "1.6s")}>
        <path d="M46 235 l2 4.8 4.8 2 -4.8 2 -2 4.8 -2 -4.8 -4.8 -2 4.8 -2 Z" fill="#FB923C" />
      </g>
      <g data-kc-why-anim style={svgAnim("kc-why-twinkle", "5.2s", "2.2s")}>
        <path d="M350 110 l1.8 4 4 1.8 -4 1.8 -1.8 4 -1.8 -4 -4 -1.8 4 -1.8 Z" fill="#38BDF8" />
      </g>
      <g data-kc-why-anim style={svgAnim("kc-why-twinkle", "4.2s", "0.8s")}>
        <path d="M120 10 l1.6 3.6 3.6 1.6 -3.6 1.6 -1.6 3.6 -1.6 -3.6 -3.6 -1.6 3.6 -1.6 Z" fill="#FFFFFF" />
      </g>
    </svg>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function WhyKalyanChemist() {
  const prefersReducedMotion = useReducedMotion();
  const frameRef = useRef<HTMLDivElement | null>(null);

  const frameRafRef = useRef<number | null>(null);
  const pointerRef = useRef({ clientX: 0, clientY: 0, active: false });
  const scrollRafRef = useRef<number | null>(null);
  const cardRafRef = useRef<number | null>(null);
  const cardRef = useRef<{ el: HTMLDivElement; cx: number; cy: number } | null>(null);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) { setInteractive(false); return; }
    const mq = window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 1024px)");
    const s = () => setInteractive(mq.matches);
    s();
    mq.addEventListener("change", s);
    return () => mq.removeEventListener("change", s);
  }, [prefersReducedMotion]);

  useEffect(() => () => {
    if (frameRafRef.current !== null) cancelAnimationFrame(frameRafRef.current);
    if (cardRafRef.current !== null) cancelAnimationFrame(cardRafRef.current);
    if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
  }, []);

  /* ── Pointer depth ── */
  const flushFrame = useCallback(() => {
    frameRafRef.current = null;
    const n = frameRef.current;
    if (!n) return;
    const r = n.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const { clientX, clientY, active } = pointerRef.current;
    const nx = active ? ((clientX - r.left) / r.width - 0.5) * 2 : 0;
    const ny = active ? ((clientY - r.top) / r.height - 0.5) * 2 : 0;
    n.style.setProperty("--wkc-px", nx.toFixed(3));
    n.style.setProperty("--wkc-py", ny.toFixed(3));
  }, []);

  const queueFlush = useCallback(() => {
    if (frameRafRef.current !== null) return;
    frameRafRef.current = requestAnimationFrame(flushFrame);
  }, [flushFrame]);

  const onPtrMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pointerRef.current = { clientX: e.clientX, clientY: e.clientY, active: true };
    queueFlush();
  }, [queueFlush]);

  const onPtrLeave = useCallback(() => {
    pointerRef.current = { clientX: 0, clientY: 0, active: false };
    queueFlush();
  }, [queueFlush]);

  /* ── Scroll depth ── */
  const flushScroll = useCallback(() => {
    scrollRafRef.current = null;
    const n = frameRef.current;
    if (!n) return;
    const r = n.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
    n.style.setProperty("--wkc-scroll", p.toFixed(4));
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const fn = () => { if (scrollRafRef.current === null) scrollRafRef.current = requestAnimationFrame(flushScroll); };
    window.addEventListener("scroll", fn, { passive: true });
    flushScroll();
    return () => { window.removeEventListener("scroll", fn); if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current); };
  }, [prefersReducedMotion, flushScroll]);

  /* ── Card light ── */
  const flushCard = useCallback(() => {
    cardRafRef.current = null;
    const p = cardRef.current;
    if (!p) return;
    const r = p.el.getBoundingClientRect();
    p.el.style.setProperty("--wkc-mx", `${(p.cx - r.left).toFixed(1)}px`);
    p.el.style.setProperty("--wkc-my", `${(p.cy - r.top).toFixed(1)}px`);
  }, []);

  const onCardMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    cardRef.current = { el: e.currentTarget, cx: e.clientX, cy: e.clientY };
    if (cardRafRef.current !== null) return;
    cardRafRef.current = requestAnimationFrame(flushCard);
  }, [flushCard]);

  /* ── Variants ── */
  const reveal = (delay: number, y = 20): Variants => ({
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, delay, ease: EASE } },
  });

  const atmo: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 1.04 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.85, ease: EASE } },
  };

  const sceneReveal: Variants = {
    hidden: prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 40, scale: 0.94, rotateX: 12 },
    visible: { opacity: 1, y: 0, scale: 1, rotateX: 0, transition: { duration: 0.8, delay: 0.2, ease: EASE } },
  };

  const px = (x: number, y: number) => ({
    transform: `translate3d(calc(var(--wkc-px,0)*${x}px),calc(var(--wkc-py,0)*${y}px),0)`,
  });

  const sd = (f: number) => ({
    transform: `translate3d(0,calc(var(--wkc-scroll,0.5)*${f}px),0)`,
  });

  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:py-20">
      <style>{`
        @keyframes kc-why-floatA{0%,100%{transform:translateY(0) scale(1) rotate(0)}25%{transform:translateY(-5px) scale(1.012) rotate(.4deg)}50%{transform:translateY(-3px) scale(1.006) rotate(-.2deg)}75%{transform:translateY(-7px) scale(1.015) rotate(.3deg)}}
        @keyframes kc-why-shield{0%,100%{transform:translateY(0) scale(1) rotate(0)}20%{transform:translateY(-4px) scale(1.01) rotate(.3deg)}50%{transform:translateY(-7px) scale(1.02) rotate(0)}80%{transform:translateY(-3px) scale(1.006) rotate(-.2deg)}}
        @keyframes kc-why-strip{0%,100%{transform:translateY(0) rotate(0) scale(1)}30%{transform:translateY(-4px) rotate(-2deg) scale(1.01)}70%{transform:translateY(-2px) rotate(1deg) scale(1.004)}}
        @keyframes kc-why-capsule{0%,100%{transform:translateY(0) rotate(0) scale(1)}35%{transform:translateY(-8px) rotate(5deg) scale(1.04)}65%{transform:translateY(-4px) rotate(-2deg) scale(1.015)}}
        @keyframes kc-why-bottle{0%,100%{transform:translateY(0) rotate(0)}30%{transform:translateY(3px) rotate(-1.5deg)}70%{transform:translateY(-4px) rotate(1deg)}}
        @keyframes kc-why-package{0%,100%{transform:translateY(0) rotate(0) scale(1)}25%{transform:translateY(-6px) rotate(-3deg) scale(1.015)}55%{transform:translateY(-3px) rotate(1.5deg) scale(1.005)}80%{transform:translateY(-7px) rotate(-1deg) scale(1.012)}}
        @keyframes kc-why-cross-rot{0%,100%{transform:rotate(-5deg) translateY(0)}50%{transform:rotate(5deg) translateY(-2px)}}
        @keyframes kc-why-heart{0%,100%{transform:scale(1) translateX(0);opacity:.8}50%{transform:scale(1.1) translateX(1px);opacity:1}}
        @keyframes kc-why-badge{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
        @keyframes kc-why-plus{0%,100%{transform:translate(0,0)}50%{transform:translate(0,-1.8px)}}
        @keyframes kc-why-mote{0%,100%{transform:translateY(0) scale(1);opacity:.35}50%{transform:translateY(-5px) scale(1.15);opacity:.9}}
        @keyframes kc-why-twinkle{0%,100%{opacity:.4;transform:scale(.85)}50%{opacity:1;transform:scale(1.12)}}
        @keyframes kc-why-orb-a{0%,100%{transform:translate(0,0)}50%{transform:translate(28px,-20px)}}
        @keyframes kc-why-orb-b{0%,100%{transform:translate(0,0)}50%{transform:translate(-24px,18px)}}
        @keyframes kc-why-orb-c{0%,100%{transform:translate(0,0)}50%{transform:translate(16px,14px)}}
        @keyframes kc-why-ldrift{0%,100%{transform:translate3d(0,0,0) scale(1);opacity:.5}50%{transform:translate3d(16px,-12px,0) scale(1.08);opacity:.82}}
        @keyframes kc-why-dust{0%{opacity:0;transform:translate3d(0,6px,0) scale(.7)}40%{opacity:.85;transform:translate3d(0,-6px,0) scale(1)}100%{opacity:0;transform:translate3d(0,-24px,0) scale(.7)}}
        @keyframes kc-why-halo{0%,100%{opacity:.2;transform:scale(.95)}50%{opacity:.5;transform:scale(1.1)}}
        @keyframes kc-why-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
        @keyframes kc-why-drive{0%,100%{transform:translateX(0)}50%{transform:translateX(4px)}}
        @keyframes kc-why-tick{0%,100%{transform:rotate(0)}30%{transform:rotate(12deg)}65%{transform:rotate(-8deg)}}
        @keyframes kc-why-tilt{0%,100%{transform:rotate(0)}50%{transform:rotate(-12deg)}}
        .kc-why-card:hover [data-kc-icon="shield"]{animation:kc-why-pulse 2.4s ease-in-out infinite}
        .kc-why-card:hover [data-kc-icon="truck"]{animation:kc-why-drive 1.8s ease-in-out infinite}
        .kc-why-card:hover [data-kc-icon="clock"]{animation:kc-why-tick 2.6s ease-in-out infinite}
        .kc-why-card:hover [data-kc-icon="pill"]{animation:kc-why-tilt 2.4s ease-in-out infinite}
        @media(prefers-reduced-motion:reduce){[data-kc-why-anim]{animation:none!important}.kc-why-card:hover [data-kc-icon]{animation:none!important}}
      `}</style>

      <motion.div
        ref={frameRef}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        onPointerMove={interactive ? onPtrMove : undefined}
        onPointerLeave={interactive ? onPtrLeave : undefined}
        className="relative overflow-hidden rounded-[32px] border border-white/[0.07] shadow-[0_50px_120px_-40px_rgba(6,30,40,0.85)] ring-1 ring-white/[0.04]"
        style={{ background: "linear-gradient(145deg, #081C2B 0%, #0C3545 45%, #064E3B 100%)" }}
      >
        {/* ═══ LAYER 1 — DARK ATMOSPHERE ═══ */}
        <motion.div aria-hidden variants={atmo} className="pointer-events-none absolute inset-0 overflow-hidden will-change-transform" style={!prefersReducedMotion ? sd(30) : undefined}>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,rgba(16,185,129,0.22),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_75%,rgba(56,189,248,0.16),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_80%,rgba(251,146,60,0.1),transparent_48%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_85%_20%,rgba(45,212,191,0.14),transparent_50%)]" />
          <div data-kc-why-anim className="absolute -top-24 left-1/4 h-80 w-[48%] rounded-full bg-emerald-500/15 blur-3xl" style={{ animation: "kc-why-ldrift 24s ease-in-out infinite" }} />
          <div data-kc-why-anim className="absolute -bottom-28 right-1/4 h-80 w-[44%] rounded-full bg-cyan-500/12 blur-3xl" style={{ animation: "kc-why-ldrift 30s ease-in-out 3s infinite" }} />
          <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_24%,transparent_74%)]" />
          <div className="absolute -inset-16 transition-transform duration-200 ease-out" style={interactive ? px(-8, -5) : undefined}>
            <div data-kc-why-anim className="absolute -left-12 top-0 size-80 rounded-full bg-emerald-500/15 blur-3xl" style={{ animation: "kc-why-orb-a 26s ease-in-out infinite" }} />
            <div data-kc-why-anim className="absolute -right-16 bottom-0 size-96 rounded-full bg-teal-500/12 blur-3xl" style={{ animation: "kc-why-orb-b 30s ease-in-out infinite" }} />
            <div data-kc-why-anim className="absolute -right-8 top-1/4 size-64 rounded-full bg-cyan-400/12 blur-3xl" style={{ animation: "kc-why-orb-c 24s ease-in-out infinite" }} />
            <div data-kc-why-anim className="absolute bottom-0 left-1/3 size-64 rounded-full bg-orange-400/8 blur-3xl" style={{ animation: "kc-why-orb-a 32s ease-in-out infinite" }} />
          </div>
        </motion.div>

        {/* ═══ LAYER 2 — MIDDLE decorative ═══ */}
        <motion.div aria-hidden variants={reveal(0.4, 10)} className="pointer-events-none absolute inset-0 overflow-hidden will-change-transform" style={!prefersReducedMotion ? sd(14) : undefined}>
          <div className="absolute inset-0 transition-transform duration-200 ease-out" style={interactive ? px(14, 9) : undefined}>
            <div className="absolute right-12 top-10 size-32 rounded-full border border-white/[0.06] bg-white/[0.02] shadow-[0_16px_36px_-22px_rgba(0,0,0,0.5)]" />
            <div className="absolute -left-12 bottom-20 size-44 rotate-12 rounded-[2.8rem] border border-white/[0.05] bg-white/[0.02] shadow-[0_18px_38px,-24px_rgba(0,0,0,0.5)]" />
            <div className="absolute -bottom-8 right-1/3 size-28 rounded-full border border-dashed border-white/[0.06]" />
            <Plus className="absolute left-[8%] top-8 size-5 rotate-12 text-emerald-400/20" />
            <Plus className="absolute bottom-10 left-[46%] size-4 rotate-45 text-cyan-400/20" />
            <Plus className="absolute bottom-12 right-[6%] size-5 -rotate-12 text-orange-400/25" />
            {PARTICLES.map((p, i) => (
              <span key={i} data-kc-why-anim className="absolute rounded-full" style={{ left: p.left, top: p.top, width: p.size, height: p.size, backgroundColor: p.color, animation: `kc-why-dust ${p.dur} ease-in-out ${p.delay} infinite` }} />
            ))}
          </div>
        </motion.div>

        {/* ═══ LAYER 3 — CONTENT: two-column ═══ */}
        <div className="relative grid items-center gap-6 px-5 pb-8 pt-10 sm:px-8 sm:pt-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-14 lg:pb-6 lg:pt-14">

          {/* ── LEFT COLUMN: heading + trust cards ── */}
          <div>
            <motion.div variants={reveal(0.04, 14)}>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                <Shield className="size-3" />
                Why Choose Us
              </div>
            </motion.div>

            <motion.h2 variants={reveal(0.1, 24)} className="mt-5 bg-gradient-to-br from-white via-[#5EEAD4] to-[#34D399] bg-clip-text text-[38px] font-black leading-[1.02] tracking-tight text-transparent sm:text-6xl lg:text-[68px]">
              Kalyan Chemist
            </motion.h2>

            <div className="mt-5 max-w-lg space-y-0.5 text-[15px] leading-relaxed text-white/50 sm:text-base lg:text-lg">
              <motion.p variants={reveal(0.16, 12)}>
                We are committed to making quality healthcare accessible, reliable,
              </motion.p>
              <motion.p variants={reveal(0.21, 12)}>
                and convenient for every household.
              </motion.p>
            </div>

            {/* ── Trust cards: stacked glass panels ── */}
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:gap-3">
              {TRUST_POINTS.map((point, i) => (
                <motion.div key={point.title} variants={reveal(0.28 + i * 0.07)} onPointerMove={interactive ? onCardMove : undefined} className="relative [perspective:1200px]">
                  <div className="kc-why-card group relative isolate flex items-start gap-3.5 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out will-change-transform hover:border-emerald-400/20 hover:bg-white/[0.07] hover:shadow-[0_10px_36px_-12px_rgba(16,185,129,0.25)] hover:[transform:translate3d(0,-3px,0)]">
                    <span aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100" style={{ background: "radial-gradient(240px circle at var(--wkc-mx,50%) var(--wkc-my,50%), rgba(16,185,129,0.1), transparent 68%)" }} />
                    <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/30 to-transparent" />

                    <div className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400/20 to-teal-500/30 text-emerald-300 ring-1 ring-inset ring-white/10 transition-[transform,box-shadow] duration-200 ease-out will-change-transform group-hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] group-hover:[transform:translate3d(0,-3px,0)_scale(1.08)]">
                      <span data-kc-why-anim data-kc-icon={point.iconAnim} className="relative block">
                        <point.icon className="size-5" strokeWidth={1.8} />
                      </span>
                    </div>
                    <div className="relative z-10 min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-white/90 transition-colors duration-200 group-hover:text-emerald-300">{point.title}</h3>
                      <p className="mt-0.5 text-[12.5px] leading-relaxed text-white/45 transition-colors duration-200 group-hover:text-white/60">{point.description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ── RIGHT COLUMN: large 3D scene ── */}
          <motion.div variants={sceneReveal} className="group/vis relative mx-auto w-full max-w-[340px] lg:max-w-none">
            <div className="relative transition-transform duration-200 ease-out will-change-transform" style={interactive ? px(24, 16) : undefined}>
              <div className="absolute inset-x-8 bottom-6 top-12 rounded-full bg-emerald-400/8 blur-3xl transition-[transform,background-color] duration-300 ease-out group-hover/vis:scale-105 group-hover/vis:bg-emerald-400/15" />
              <div className="relative h-[300px] sm:h-[360px] [perspective:900px] lg:h-[460px]">
                <div data-kc-why-anim className="size-full" style={{ animation: "kc-why-floatA 6.5s ease-in-out infinite" }}>
                  <div className="size-full will-change-transform transition-transform duration-300 ease-out group-hover/vis:[transform:translate3d(0,-12px,0)_scale(1.04)_rotateX(6deg)_rotateY(-5deg)]">
                    <TrustIllustration />
                  </div>
                </div>
                <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 ease-out group-hover/vis:opacity-100" style={{ background: "radial-gradient(ellipse at 32% 22%, rgba(255,255,255,0.12), transparent 55%)" }} />
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
