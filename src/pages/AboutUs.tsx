import { useRef, useState, useEffect, useCallback, useMemo } from "react";
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
  Upload,
  ArrowRight,
  BadgeCheck,
  Volume2,
  VolumeX,
  Clock,
  Search,
  ShoppingBag,
  Package,
  Home,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useNavigate } from "react-router";

const EASE = [0.22, 1, 0.36, 1] as const;

const prefersReducedMotion =
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ═══════════════════════════════════════════════════════════════════
   KC SHIELD — Reusable brand visual
   ═══════════════════════════════════════════════════════════════════ */

function KCShield({ size = 200, opacity = 1 }: { size?: number; opacity?: number }) {
  return (
    <svg
      viewBox="0 0 200 230"
      fill="none"
      width={size}
      height={size * 1.15}
      style={{ opacity, filter: "drop-shadow(0 0 40px rgba(22,163,106,0.2))" }}
    >
      <defs>
        <linearGradient id="kc-face" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#11925E" stopOpacity="0.4" />
          <stop offset="1" stopColor="#09543A" stopOpacity="0.25" />
        </linearGradient>
        <linearGradient id="kc-edge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F0D9A3" stopOpacity="0.5" />
          <stop offset="1" stopColor="#16A36A" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <path d="M100 8 L185 48 V130 C185 185 150 215 100 228 C50 215 15 185 15 130 V48 Z" fill="url(#kc-face)" />
      <path d="M100 8 L185 48 V130 C185 185 150 215 100 228 C50 215 15 185 15 130 V48 Z" fill="none" stroke="url(#kc-edge)" strokeWidth="1.5" />
      <rect x="86" y="72" width="28" height="80" rx="9" fill="rgba(22,163,106,0.3)" />
      <rect x="66" y="96" width="68" height="28" rx="9" fill="rgba(22,163,106,0.3)" />
      <text x="100" y="165" textAnchor="middle" fontSize="33" fontWeight="900" fontFamily="system-ui, sans-serif" fill="rgba(245,243,236,0.4)" letterSpacing="2">KC</text>
      <text x="100" y="183" textAnchor="middle" fontSize="11" fontWeight="700" fontFamily="system-ui, sans-serif" fill="rgba(216,184,120,0.35)" letterSpacing="4">PHARMACY</text>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MUSIC — Real HTMLAudioElement with generated ambient pad
   ═══════════════════════════════════════════════════════════════════ */

async function renderAmbientLoop(): Promise<string> {
  const sampleRate = 22050;
  const duration = 10;
  const OfflineCtx: typeof OfflineAudioContext =
    window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (!OfflineCtx) throw new Error("OfflineAudioContext not supported");
  const ctx = new OfflineCtx(1, sampleRate * duration, sampleRate);

  /* D-minor ambient pad — richer voicing, higher gain for audibility */
  const notes = [
    { f: 73.42, g: 0.22 },  /* D2 */
    { f: 110.0, g: 0.18 },  /* A2 */
    { f: 146.83, g: 0.14 }, /* D3 */
    { f: 174.61, g: 0.12 }, /* F3 */
    { f: 220.0, g: 0.10 },  /* A3 */
    { f: 293.66, g: 0.08 }, /* D4 */
    { f: 349.23, g: 0.06 }, /* F4 */
  ];

  notes.forEach(({ f, g }) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = f;
    const gain = ctx.createGain();
    gain.gain.value = g;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
    osc.stop(duration);
  });

  /* Gentle LFO on a sub-oscillator for movement */
  const lfoOsc = ctx.createOscillator();
  lfoOsc.type = "sine";
  lfoOsc.frequency.value = 0.15;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.04;
  lfoOsc.connect(lfoGain);
  lfoGain.connect(ctx.destination);
  lfoOsc.start(0);
  lfoOsc.stop(duration);

  const buffer = await ctx.startRendering();
  const numCh = buffer.numberOfChannels;
  const len = buffer.length;
  const bytes = new ArrayBuffer(44 + len * numCh * 2);
  const view = new DataView(bytes);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + len * numCh * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numCh * 2, true);
  view.setUint16(32, numCh * 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, len * numCh * 2, true);

  let off = 44;
  const ch0 = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const s = Math.max(-1, Math.min(1, ch0[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }

  const blob = new Blob([bytes], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

function MusicControl() {
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const triedRef = useRef(false);
  const wantPlayRef = useRef(false);
  const fadeIvRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    renderAmbientLoop()
      .then((url) => {
        if (cancelled) { URL.revokeObjectURL(url); return; }
        urlRef.current = url;
        const audio = new Audio(url);
        audio.loop = true;
        audio.preload = "auto";
        audio.volume = 0;
        audioRef.current = audio;
        setReady(true);
        if (wantPlayRef.current) doPlay();
      })
      .catch((err) => console.error("[AboutUs Music] Failed:", err));
    return () => {
      cancelled = true;
      if (fadeIvRef.current) clearInterval(fadeIvRef.current);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ""; }
      audioRef.current = null;
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    };
  }, []);

  const fadeTo = useCallback((target: number, onDone?: () => void) => {
    if (fadeIvRef.current) clearInterval(fadeIvRef.current);
    const audio = audioRef.current;
    if (!audio) return;
    const step = target > audio.volume ? 0.015 : -0.012;
    fadeIvRef.current = setInterval(() => {
      if (!audioRef.current) { if (fadeIvRef.current) clearInterval(fadeIvRef.current); return; }
      const v = audio.volume + step;
      if ((step > 0 && v >= target) || (step < 0 && v <= target)) {
        audio.volume = target;
        if (fadeIvRef.current) clearInterval(fadeIvRef.current);
        onDone?.();
        return;
      }
      audio.volume = v;
    }, 40);
  }, []);

  const doPlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) { wantPlayRef.current = true; return; }
    wantPlayRef.current = true;
    audio.volume = 0;
    audio.play()
      .then(() => { if (!wantPlayRef.current) return; fadeTo(0.35); setPlaying(true); })
      .catch(() => { wantPlayRef.current = false; setPlaying(false); });
  }, [fadeTo]);

  const doPause = useCallback(() => {
    wantPlayRef.current = false;
    fadeTo(0, () => { audioRef.current?.pause(); });
    setPlaying(false);
  }, [fadeTo]);

  useEffect(() => {
    if (triedRef.current) return;
    const handler = () => {
      if (triedRef.current) return;
      triedRef.current = true;
      doPlay();
      window.removeEventListener("scroll", handler);
      window.removeEventListener("click", handler);
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("pointerdown", handler);
    };
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("click", handler);
    window.addEventListener("touchstart", handler, { passive: true });
    window.addEventListener("pointerdown", handler);
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("click", handler);
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("pointerdown", handler);
    };
  }, [doPlay]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  return (
    <button
      onClick={() => (playing ? doPause() : doPlay())}
      className="fixed bottom-6 right-6 z-50 flex size-11 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/60 backdrop-blur-md transition-colors duration-300 hover:border-[#16A36A]/30 hover:text-[#16A36A] cursor-pointer"
      aria-label={playing ? "Mute background music" : "Play background music"}
      title={playing ? "Mute" : ready ? "Play ambient music" : "Loading music…"}
    >
      {playing ? <Volume2 className="size-4" /> : <VolumeX className="size-4 opacity-60" />}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   REVEAL ON SCROLL
   ═══════════════════════════════════════════════════════════════════ */

function RevealOnScroll({ children, className = "", delay = 0 }: {
  children: React.ReactNode; className?: string; delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.7, delay: prefersReducedMotion ? 0 : delay, ease: EASE }}
      className={className}
    >{children}</motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 1 — CINEMATIC INTRO

   TWO SEPARATE PHASES (NO SCROLL LOCK):

   PHASE A (automatic, 0–2.8s): Pure CSS keyframes. No scroll.
     Dense smoke fills screen → smoke parts → EXPLORE emerges →
     KALYAN CHEMIST reveals → Phase A unmounts.

   PHASE B (scroll-driven): Framer Motion useScroll.
     Starts with KALYAN CHEMIST visible (matching Phase A end state).
     Hero zooms, text transitions, 3D depth, story progression.

   Phase A sits on top (z-30), Phase B underneath (z-10).
   When Phase A unmounts, Phase B takes over seamlessly.
   ═══════════════════════════════════════════════════════════════════ */

const INTRO_MS = 2800;

function CinematicIntro() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [introDone, setIntroDone] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion) { setIntroDone(true); return; }
    const t = setTimeout(() => setIntroDone(true), INTRO_MS);
    return () => clearTimeout(t);
  }, []);

  /* ── Phase B: scroll-driven transforms ── */
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  /* Hero image zooms continuously */
  const heroScale = useTransform(scrollYProgress, [0, 0.85], [1, 1.20]);

  /* Phase B smoke — always visible but fades as user scrolls */
  const smokeOp = useTransform(scrollYProgress, [0, 0.45], [0.55, 0]);

  /* Phase B starts with KALYAN CHEMIST visible (matches Phase A end).
     No EXPLORE in Phase B — it was shown in Phase A only. */
  const kalyanOp = useTransform(scrollYProgress, [0, 0.02, 0.30, 0.42], [1, 1, 1, 0]);
  const kalyanY = useTransform(scrollYProgress, [0, 0.42], [0, -60]);

  /* HEALTHCARE SIMPLIFIED — enters after KALYAN exits */
  const healthOp = useTransform(scrollYProgress, [0.32, 0.44, 0.62, 0.74], [0, 1, 1, 0]);
  const healthY = useTransform(scrollYProgress, [0.32, 0.74], [40, -30]);

  /* KC Shield finale */
  const shieldOp = useTransform(scrollYProgress, [0.68, 0.82], [0, 1]);
  const shieldSc = useTransform(scrollYProgress, [0.68, 0.88], [0.85, 1]);

  /* Scroll hint */
  const hintOp = useTransform(scrollYProgress, [0, 0.03], [1, 0]);

  const TEXT_GRADIENT = "linear-gradient(180deg, rgba(245,243,236,0.95) 0%, rgba(245,243,236,0.45) 100%)";
  const KC_GRADIENT_1 = "linear-gradient(135deg, #16A36A 0%, #F0D9A3 55%, #16A36A 100%)";
  const KC_GRADIENT_2 = "linear-gradient(135deg, #F0D9A3 0%, #16A36A 100%)";
  const HC_GRADIENT = "linear-gradient(180deg, #F0D9A3 0%, #16A36A 100%)";

  return (
    <div ref={containerRef} className="relative" style={{ height: "180vh" }}>
      <div className="sticky top-0 h-screen overflow-hidden" style={{ background: "#060808" }}>

        {/* ── Deep background ── */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 40%, #0a2e1f 0%, #060808 70%)" }} />

        {/* ── HERO VISUAL — always visible, zooms on scroll ── */}
        <motion.div className="absolute inset-0 flex items-center justify-center" style={{ scale: heroScale }}>
          <div
            className="relative w-[88vw] max-w-[740px] aspect-[4/3] overflow-hidden rounded-3xl"
            style={{
              background: "linear-gradient(135deg, #0a3d2e 0%, #0B0D0C 40%, #111614 70%, #0a2e1f 100%)",
              boxShadow: "0 0 100px rgba(22,163,106,0.14), 0 30px 60px rgba(0,0,0,0.5)",
            }}
          >
            {/* Background grid */}
            <div className="absolute inset-0" aria-hidden="true">
              <div className="absolute inset-0" style={{
                background: "repeating-linear-gradient(90deg, transparent, transparent 64px, rgba(22,163,106,0.035) 64px, rgba(22,163,106,0.035) 65px), repeating-linear-gradient(0deg, transparent, transparent 44px, rgba(22,163,106,0.02) 44px, rgba(22,163,106,0.02) 45px)",
              }} />
            </div>
            {/* Atmosphere glow */}
            <div className="absolute inset-0" aria-hidden="true">
              <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(22,163,106,0.22), transparent 68%)" }} />
              <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 40% 35% at 28% 62%, rgba(216,184,120,0.09), transparent 58%)" }} />
            </div>
            {/* KC Shield */}
            <div className="absolute inset-0 flex items-center justify-center">
              <KCShield size={220} opacity={0.55} />
            </div>
            {/* Foreground healthcare icons */}
            <div className="absolute inset-0" aria-hidden="true">
              {[
                { x: "10%", y: "18%", icon: "💊", size: 30, op: 0.22 },
                { x: "82%", y: "15%", icon: "🩺", size: 26, op: 0.18 },
                { x: "7%", y: "72%", icon: "💉", size: 24, op: 0.15 },
                { x: "88%", y: "68%", icon: "🏥", size: 22, op: 0.16 },
                { x: "50%", y: "8%", icon: "⚕️", size: 20, op: 0.12 },
                { x: "45%", y: "86%", icon: "🧬", size: 19, op: 0.12 },
              ].map((el, i) => (
                <span key={i} className="absolute" style={{ left: el.x, top: el.y, fontSize: el.size, opacity: el.op }}>{el.icon}</span>
              ))}
            </div>
            {/* Inner vignette */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 45%, transparent 30%, rgba(4,6,5,0.55) 100%)" }} />
          </div>
        </motion.div>

        {/* ════════════════════════════════════════════════
           PHASE A — AUTOMATIC INTRO (CSS keyframes only)
           Dense smoke → parts → EXPLORE emerges →
           KALYAN CHEMIST appears → unmounts at 2.8s.
           ════════════════════════════════════════════════ */}
        {!introDone && !prefersReducedMotion && (
          <div className="absolute inset-0 z-30 pointer-events-none">
            {/* Text BEHIND smoke — revealed as smoke drifts apart */}
            {/* EXPLORE — fades in while smoke still covers it, then becomes visible */}
            <div className="absolute inset-0 flex items-center justify-center px-6 kc-phase-a-explore">
              <span className="text-[clamp(4rem,13vw,11rem)] font-black uppercase tracking-tight leading-none select-none"
                style={{ background: TEXT_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", filter: "drop-shadow(0 0 30px rgba(22,163,106,0.35))" }}>
                Explore
              </span>
            </div>
            {/* KALYAN CHEMIST — appears after EXPLORE, revealed as smoke clears */}
            <div className="absolute inset-0 flex items-center justify-center px-6 kc-phase-a-kalyan">
              <div className="text-center select-none">
                <span className="block text-[clamp(2.4rem,7.5vw,6.5rem)] font-black uppercase tracking-tight leading-[0.92]"
                  style={{ background: KC_GRADIENT_1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Kalyan</span>
                <span className="block text-[clamp(2.4rem,7.5vw,6.5rem)] font-black uppercase tracking-tight leading-[0.92]"
                  style={{ background: KC_GRADIENT_2, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Chemist</span>
              </div>
            </div>
            {/* Dense smoke ON TOP — drifts apart to reveal text underneath */}
            <div className="absolute inset-0 kc-phase-a-smoke">
              <div className="absolute inset-[-25%] kc-smoke-layer-1" />
              <div className="absolute inset-[-25%] kc-smoke-layer-2" />
              <div className="absolute inset-[-20%] kc-smoke-layer-3" />
              <div className="absolute inset-[-20%] kc-smoke-layer-4" />
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
           PHASE B — SCROLL-DRIVEN (Framer Motion)
           Always mounted. Takes over after Phase A unmounts.
           Starts with KALYAN CHEMIST visible (matches Phase A end).
           ════════════════════════════════════════════════ */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          {/* Smoke — VISIBLE + MOVING, scroll fades it out */}
          <motion.div className="absolute inset-0" style={{ opacity: smokeOp }}>
            <div className="absolute inset-[-15%] kc-smoke-a" style={{ background: "radial-gradient(ellipse 70% 55% at 30% 40%, rgba(22,163,106,0.50), transparent 55%)" }} />
            <div className="absolute inset-[-15%] kc-smoke-b" style={{ background: "radial-gradient(ellipse 60% 50% at 75% 55%, rgba(216,184,120,0.32), transparent 50%)" }} />
            <div className="absolute inset-[-15%] kc-smoke-c" style={{ background: "radial-gradient(ellipse 75% 60% at 50% 65%, rgba(245,243,236,0.22), transparent 55%)" }} />
          </motion.div>

          {/* KALYAN CHEMIST — starts visible, fades on scroll */}
          <motion.div className="absolute inset-0 flex items-center justify-center px-6"
            style={{ opacity: kalyanOp, y: kalyanY }}>
            <div className="text-center select-none">
              <span className="block text-[clamp(2.4rem,7.5vw,6.5rem)] font-black uppercase tracking-tight leading-[0.92]"
                style={{ background: KC_GRADIENT_1, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Kalyan</span>
              <span className="block text-[clamp(2.4rem,7.5vw,6.5rem)] font-black uppercase tracking-tight leading-[0.92]"
                style={{ background: KC_GRADIENT_2, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Chemist</span>
            </div>
          </motion.div>

          {/* HEALTHCARE, SIMPLIFIED */}
          <motion.div className="absolute inset-0 flex items-center justify-center px-6"
            style={{ opacity: healthOp, y: healthY }}>
            <div className="text-center select-none">
              <span className="block text-[clamp(1.8rem,5vw,4rem)] font-light uppercase tracking-[0.18em] text-white/60">Healthcare</span>
              <span className="block text-[clamp(2.8rem,9vw,8rem)] font-black uppercase tracking-tight leading-[0.88]"
                style={{ background: HC_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Simplified</span>
            </div>
          </motion.div>

          {/* KC Shield finale */}
          <motion.div className="absolute inset-0 flex items-center justify-center"
            style={{ opacity: shieldOp, scale: shieldSc }}>
            <KCShield size={170} />
          </motion.div>
        </div>

        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none z-20" style={{ background: "radial-gradient(ellipse 65% 55% at 50% 45%, transparent 30%, rgba(4,6,5,0.72) 100%)" }} />

        {/* Scroll hint — only after intro */}
        {introDone && (
          <motion.div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20"
            style={{ opacity: hintOp }}>
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/30">Scroll to explore</span>
            <motion.div animate={prefersReducedMotion ? undefined : { y: [0, 8, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-5 h-8 rounded-full border border-white/20 flex items-start justify-center pt-1.5">
              <div className="w-1 h-2 rounded-full bg-white/40" />
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 2 — WHO WE ARE
   ═══════════════════════════════════════════════════════════════════ */

function WhoWeAre() {
  return (
    <section className="relative overflow-hidden py-20 sm:py-28" style={{ background: "linear-gradient(180deg, #0B0D0C, #111614, #0B0D0C)" }}>
      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <RevealOnScroll className="text-center mb-14">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#D8B878] mb-5">Who We Are</p>
          <h2 className="text-4xl sm:text-5xl md:text-7xl font-black leading-[0.95] tracking-tight">
            <span className="text-white/90">Healthcare</span><br />
            <span style={{ background: "linear-gradient(90deg, #16A36A, #F0D9A3, #16A36A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Simplified</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl font-light leading-relaxed text-white/60">
            Kalyan Chemist is a digital healthcare experience designed to make everyday healthcare easier to discover, manage and access.
          </p>
        </RevealOnScroll>
        <div className="grid gap-12 lg:gap-16 items-center">
          <RevealOnScroll className="order-2 lg:order-1">
            <div className="space-y-5">
              <p className="text-lg sm:text-xl md:text-2xl font-light leading-relaxed text-white/70">
                From everyday medicines and wellness essentials to prescription support, lab tests and doctor appointments —
                <span className="font-semibold text-white/90"> one platform, one experience.</span>
              </p>
              <p className="text-base sm:text-lg leading-relaxed text-white/50">
                We built Kalyan Chemist around a simple belief: accessing healthcare should be as effortless as a few taps.
                Genuine medicines, pharmacist guidance and reliable doorstep delivery — connected through a single, convenient digital experience.
              </p>
              <p className="text-base sm:text-lg leading-relaxed text-white/50">
                Whether it's your daily essentials, an ongoing prescription, or a quick consultation,
                your healthcare journey stays seamless, safe and close to home.
              </p>
            </div>
          </RevealOnScroll>
          <RevealOnScroll className="order-1 lg:order-2" delay={0.12}>
            <div className="relative rounded-3xl overflow-hidden aspect-[4/3]" style={{ background: "linear-gradient(135deg, rgba(22,163,106,0.08), rgba(17,22,20,0.9))" }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="absolute rounded-full border kc-pulse"
                      style={{ inset: `${-44 - i * 30}px`, borderColor: i % 2 === 0 ? "rgba(22,163,106,0.1)" : "rgba(216,184,120,0.07)", animationDelay: `${i}s` }} />
                  ))}
                  <div className="relative flex items-center gap-4 p-8">
                    <Stethoscope className="size-12 sm:size-16 text-[#16A36A]/40" strokeWidth={1.2} />
                    <Pill className="size-10 sm:size-14 text-[#F0D9A3]/30" strokeWidth={1.2} />
                    <ShieldCheck className="size-12 sm:size-16 text-[#16A36A]/35" strokeWidth={1.2} />
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#16A36A]/30 to-transparent" />
            </div>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 3 — BRAND STORY
   ═══════════════════════════════════════════════════════════════════ */

function BrandStory() {
  const statements = [
    "Healthcare should feel simpler.",
    "Finding what you need should take less effort.",
    "From medicines to everyday healthcare needs.",
    "Everything connected through one experience.",
  ];
  return (
    <section className="relative overflow-hidden py-20 sm:py-28" style={{ background: "#0B0D0C" }}>
      <div className="relative z-10 mx-auto max-w-4xl px-6">
        <RevealOnScroll className="text-center mb-12">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#16A36A] mb-4">Our Philosophy</p>
          <h2 className="text-3xl sm:text-5xl font-black leading-[0.95] tracking-tight text-white/90">
            Why <span style={{ background: "linear-gradient(90deg, #16A36A, #F0D9A3)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Kalyan Chemist</span> Exists
          </h2>
        </RevealOnScroll>
        <div className="space-y-8 sm:space-y-10">
          {statements.map((text, i) => (
            <RevealOnScroll key={i} delay={i * 0.06}>
              <div className="flex items-center gap-5 sm:gap-7">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#16A36A]/20 text-[#16A36A]/60 text-xs font-bold">{String(i + 1).padStart(2, "0")}</div>
                <p className="text-xl sm:text-2xl md:text-3xl font-light leading-tight text-white/60">{text}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 4 — FROM DISCOVERY TO DOORSTEP
   ═══════════════════════════════════════════════════════════════════ */

function DiscoveryToDoorstep() {
  const steps = [
    { icon: Search, title: "Search", desc: "Find medicines and health essentials instantly." },
    { icon: ShoppingBag, title: "Explore", desc: "Browse genuine products across every category." },
    { icon: Pill, title: "Select", desc: "Choose exactly what your health routine needs." },
    { icon: Package, title: "Order", desc: "Checkout securely with prescription support built in." },
    { icon: Home, title: "Receive", desc: "Carefully packed and delivered to your doorstep." },
  ];
  return (
    <section className="relative overflow-hidden py-20 sm:py-28" style={{ background: "linear-gradient(180deg, #0B0D0C 0%, #0a2e1f 55%, #0B0D0C 100%)" }}>
      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <RevealOnScroll className="text-center mb-14">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#D8B878] mb-5">The Journey</p>
          <h2 className="text-4xl sm:text-6xl md:text-7xl font-black uppercase leading-[0.92] tracking-tight">
            <span className="text-white/90">From Discovery</span><br />
            <span style={{ background: "linear-gradient(90deg, #16A36A, #F0D9A3)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>to Doorstep</span>
          </h2>
        </RevealOnScroll>
        <div className="relative">
          <div className="hidden lg:block absolute left-[10%] right-[10%] top-7 h-px bg-gradient-to-r from-[#16A36A]/10 via-[#F0D9A3]/25 to-[#16A36A]/10" />
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-4">
            {steps.map((step, i) => (
              <RevealOnScroll key={step.title} delay={i * 0.08}>
                <div className="flex flex-col items-center text-center lg:px-2">
                  <div className="relative z-10 mb-4 flex size-12 items-center justify-center rounded-2xl border border-[#16A36A]/20 bg-[#0d1712] shadow-lg shadow-black/30">
                    <step.icon className="size-5 text-[#16A36A]" strokeWidth={1.5} />
                  </div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-[#D8B878]/70">Step {String(i + 1).padStart(2, "0")}</p>
                  <h3 className="text-base font-bold text-white/90">{step.title}</h3>
                  <p className="mt-1 max-w-[220px] text-sm leading-relaxed text-white/45">{step.desc}</p>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 5 — ONE HEALTHCARE EXPERIENCE
   ═══════════════════════════════════════════════════════════════════ */

function EcosystemJourney() {
  const steps = [
    { icon: Pill, label: "Medicines", color: "#16A36A" },
    { icon: Upload, label: "Prescriptions", color: "#F0D9A3" },
    { icon: Stethoscope, label: "Lab Tests", color: "#16A36A" },
    { icon: BadgeCheck, label: "Doctor Support", color: "#D8B878" },
    { icon: ShieldCheck, label: "Health Devices", color: "#16A36A" },
    { icon: Clock, label: "Refills", color: "#F0D9A3" },
    { icon: Truck, label: "Delivery", color: "#16A36A" },
  ];
  return (
    <section className="relative overflow-hidden py-20 sm:py-28" style={{ background: "#0B0D0C" }}>
      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <RevealOnScroll className="text-center mb-12">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#D8B878] mb-5">One Healthcare Experience</p>
          <h2 className="text-3xl sm:text-5xl font-black leading-[0.95] tracking-tight text-white/90">
            Everything connected,{" "}
            <span style={{ background: "linear-gradient(90deg, #F0D9A3, #16A36A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>nothing missing</span>
          </h2>
        </RevealOnScroll>
        <div className="relative mx-auto max-w-lg">
          <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-[#16A36A]/25 via-[#F0D9A3]/20 to-[#16A36A]/25" />
          <div className="space-y-1">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <RevealOnScroll key={step.label} delay={0}>
                  <div className="flex items-center gap-5 py-3.5">
                    <div className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border"
                      style={{ borderColor: `${step.color}30`, background: `${step.color}10` }}>
                      <Icon className="size-4" style={{ color: step.color }} strokeWidth={1.5} />
                    </div>
                    <p className="text-base sm:text-lg font-medium text-white/70">{step.label}</p>
                  </div>
                </RevealOnScroll>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 6 — PREMIUM VISUAL CARDS
   ═══════════════════════════════════════════════════════════════════ */

function PremiumCards() {
  const cards = [
    { title: "Medicines & Products", desc: "Genuine medicines and healthcare products from trusted brands.", accent: "#16A36A", icon: Pill },
    { title: "Lab Tests & Doctors", desc: "Book lab tests and doctor consultations from home.", accent: "#F0D9A3", icon: Stethoscope },
    { title: "Healthcare Devices & Wellness", desc: "Everyday devices and wellness essentials for your family.", accent: "#16A36A", icon: ShieldCheck },
    { title: "Refills & Home Delivery", desc: "Convenient refill schedules and reliable doorstep delivery.", accent: "#D8B878", icon: Truck },
  ];
  const containerVariants: Variants = useMemo(() => ({ hidden: {}, visible: { transition: { staggerChildren: 0.1 } } }), []);
  const cardVariants: Variants = useMemo(() => ({
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  }), []);
  const navigate = useNavigate();
  return (
    <section className="relative overflow-hidden py-20 sm:py-28" style={{ background: "#0B0D0C" }}>
      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <RevealOnScroll className="text-center mb-12">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#16A36A] mb-4">The Experience</p>
          <h2 className="text-3xl sm:text-5xl font-black leading-[0.95] tracking-tight text-white/90">
            Everything you need,{" "}
            <span style={{ background: "linear-gradient(90deg, #F0D9A3, #16A36A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>in one place</span>
          </h2>
        </RevealOnScroll>
        <motion.div variants={containerVariants} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-60px" }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <motion.div key={card.title} variants={cardVariants}
                className="group relative rounded-3xl border border-white/[0.06] p-5 sm:p-6 transition-colors duration-300 hover:border-[#16A36A]/20 cursor-pointer"
                style={{ background: "linear-gradient(160deg, rgba(245,243,236,0.03), rgba(245,243,236,0.01))" }}
                onClick={() => navigate("/products")}>
                <div className="mb-3 flex size-10 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105"
                  style={{ background: `${card.accent}12`, border: `1px solid ${card.accent}20` }}>
                  <Icon className="size-5" style={{ color: card.accent }} strokeWidth={1.5} />
                </div>
                <h3 className="text-[14px] font-bold text-white/90 mb-1">{card.title}</h3>
                <p className="text-[12px] leading-relaxed text-white/40">{card.desc}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 7 — WHY KALYAN CHEMIST
   ═══════════════════════════════════════════════════════════════════ */

function TrustSection() {
  const points = [
    { icon: ShieldCheck, text: "Genuine medicines from trusted pharmaceutical sources" },
    { icon: BadgeCheck, text: "Professional pharmacist support whenever you need it" },
    { icon: Clock, text: "Convenient digital access, any hour of the day" },
    { icon: Upload, text: "Simple prescription upload and refill management" },
    { icon: Truck, text: "Careful packaging and dependable doorstep delivery" },
  ];
  return (
    <section className="relative overflow-hidden py-20 sm:py-28" style={{ background: "linear-gradient(180deg, #0B0D0C, #0f1a15, #0B0D0C)" }}>
      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <RevealOnScroll className="text-center mb-12">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#D8B878] mb-5">Why Kalyan Chemist</p>
          <h2 className="text-3xl sm:text-5xl font-black leading-[0.95] tracking-tight text-white/90">
            Healthcare should feel{" "}
            <span style={{ background: "linear-gradient(90deg, #16A36A, #F0D9A3)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>simpler</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-light leading-relaxed text-white/50">
            Built around convenience, trust and everyday healthcare support — a customer-focused experience designed for real life.
          </p>
        </RevealOnScroll>
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-start">
          <div className="space-y-4">
            {points.map((item, i) => (
              <RevealOnScroll key={i} delay={i * 0.06}>
                <div className="flex items-start gap-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#16A36A]/10 text-[#16A36A]">
                    <item.icon className="size-[18px]" strokeWidth={1.6} />
                  </div>
                  <p className="pt-2 text-base leading-relaxed text-white/55">{item.text}</p>
                </div>
              </RevealOnScroll>
            ))}
          </div>
          <RevealOnScroll delay={0.1}>
            <div className="grid grid-cols-2 gap-3">
              {[
                { title: "Discover", desc: "Medicines, devices & wellness", icon: Search },
                { title: "Order", desc: "Secure checkout with Rx support", icon: ShoppingBag },
                { title: "Consult", desc: "Lab tests & doctor appointments", icon: Stethoscope },
                { title: "Receive", desc: "Doorstep delivery & refills", icon: Truck },
              ].map((p) => (
                <div key={p.title} className="rounded-2xl border border-white/[0.06] p-4 sm:p-5"
                  style={{ background: "linear-gradient(160deg, rgba(245,243,236,0.025), rgba(245,243,236,0.008))" }}>
                  <div className="mb-3 flex size-9 items-center justify-center rounded-xl bg-[#16A36A]/10 text-[#16A36A]">
                    <p.icon className="size-4" strokeWidth={1.5} />
                  </div>
                  <p className="text-sm font-bold text-white/85">{p.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/40">{p.desc}</p>
                </div>
              ))}
            </div>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 8 — FINAL BRAND STATEMENT
   ═══════════════════════════════════════════════════════════════════ */

function FinalStatement() {
  const navigate = useNavigate();
  return (
    <section className="relative overflow-hidden py-24 sm:py-36" style={{ background: "linear-gradient(180deg, #0B0D0C 0%, #0a3d2e 50%, #0B0D0C 100%)" }}>
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(22,163,106,0.12), transparent 65%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 30% 25% at 50% 50%, rgba(216,184,120,0.06), transparent 55%)" }} />
      </div>
      <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
        <RevealOnScroll>
          <div className="mx-auto mb-8 h-px w-20 bg-gradient-to-r from-transparent via-[#16A36A]/50 to-transparent" />
          <h2 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black uppercase leading-[0.9] tracking-tight">
            <span style={{ background: "linear-gradient(90deg, #F0D9A3, white, #16A36A)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Your Health,</span><br />
            <span style={{ background: "linear-gradient(90deg, #16A36A, #F0D9A3, white)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Our Priority</span>
          </h2>
          <p className="mx-auto mt-7 max-w-2xl text-lg sm:text-xl md:text-2xl font-light leading-relaxed text-white/45">
            Making everyday healthcare simpler, more convenient and accessible through Kalyan Chemist.
          </p>
          <div className="mx-auto mt-8 h-px w-20 bg-gradient-to-r from-transparent via-[#D8B878]/40 to-transparent" />
        </RevealOnScroll>
        <RevealOnScroll delay={0.15} className="mt-10">
          <button onClick={() => navigate("/products")}
            className="group inline-flex items-center gap-3 rounded-full bg-[#16A36A] px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-[#16A36A]/20 transition-colors duration-300 hover:bg-[#128a55] cursor-pointer">
            Explore Kalyan Chemist
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </RevealOnScroll>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */

export default function AboutUs() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      <style>{`
        /* ═══ PHASE A — DENSE CINEMATIC SMOKE ═══
           Smoke layers ON TOP of text. They drift apart to REVEAL text.
           Wrapper holds opacity 1, then fades quickly at end (smooth unmount).
           Individual layers: NO opacity animation — ONLY transform (drift). */

        .kc-phase-a-smoke {
          animation: kc-smoke-parts 2.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes kc-smoke-parts {
          0%   { opacity: 1; }
          82%  { opacity: 1; }
          100% { opacity: 0; }
        }

        /* Smoke layers — GPU-only drift (no opacity, no filter). */
        .kc-smoke-layer-1 {
          background: radial-gradient(ellipse 80% 70% at 30% 35%, rgba(22,163,106,0.55), transparent 55%);
          animation: kc-drift-1 2.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes kc-drift-1 {
          0%   { transform: translate3d(0, 0, 0) scale(1); }
          100% { transform: translate3d(-28%, -20%, 0) scale(1.25); }
        }

        .kc-smoke-layer-2 {
          background: radial-gradient(ellipse 70% 65% at 70% 50%, rgba(216,184,120,0.40), transparent 50%);
          animation: kc-drift-2 2.5s cubic-bezier(0.22, 1, 0.36, 1) 0.05s forwards;
        }
        @keyframes kc-drift-2 {
          0%   { transform: translate3d(0, 0, 0) scale(1.05); }
          100% { transform: translate3d(25%, -22%, 0) scale(1.3); }
        }

        .kc-smoke-layer-3 {
          background: radial-gradient(ellipse 90% 75% at 50% 55%, rgba(245,243,236,0.24), transparent 55%);
          animation: kc-drift-3 2.5s cubic-bezier(0.22, 1, 0.36, 1) 0.1s forwards;
        }
        @keyframes kc-drift-3 {
          0%   { transform: translate3d(0, 0, 0) scale(1); }
          100% { transform: translate3d(8%, 25%, 0) scale(1.15); }
        }

        .kc-smoke-layer-4 {
          background: radial-gradient(ellipse 60% 55% at 45% 45%, rgba(22,163,106,0.32), transparent 50%);
          animation: kc-drift-4 2.5s cubic-bezier(0.22, 1, 0.36, 1) 0.08s forwards;
        }
        @keyframes kc-drift-4 {
          0%   { transform: translate3d(0, 0, 0) scale(0.95); }
          100% { transform: translate3d(-15%, 15%, 0) scale(1.2); }
        }

        /* EXPLORE — fades in while smoke still covers it (emerges through gaps). */
        .kc-phase-a-explore {
          opacity: 0;
          animation: kc-explore-auto 2.2s cubic-bezier(0.22, 1, 0.36, 1) 0.2s forwards;
        }
        @keyframes kc-explore-auto {
          0%   { opacity: 0; transform: translateY(20px) scale(0.94); }
          30%  { opacity: 0.8; }
          55%  { opacity: 1; transform: translateY(0) scale(1); }
          75%  { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-20px) scale(1.05); }
        }

        /* KALYAN CHEMIST — appears as smoke wrapper fades. */
        .kc-phase-a-kalyan {
          opacity: 0;
          animation: kc-kalyan-auto 1.5s cubic-bezier(0.22, 1, 0.36, 1) 1.4s forwards;
        }
        @keyframes kc-kalyan-auto {
          0%   { opacity: 0; transform: translateY(20px) scale(0.96); }
          55%  { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* ═══ AMBIENT SMOKE DRIFT (Phase B, CSS, transform-only) ═══ */
        .kc-smoke-a { animation: kc-amb-a 22s ease-in-out infinite alternate; }
        .kc-smoke-b { animation: kc-amb-b 30s ease-in-out infinite alternate; }
        .kc-smoke-c { animation: kc-amb-a 38s ease-in-out infinite alternate-reverse; }

        @keyframes kc-amb-a {
          0%   { transform: translate3d(-3%, 0, 0) scale(1); }
          100% { transform: translate3d(4%, -2%, 0) scale(1.08); }
        }
        @keyframes kc-amb-b {
          0%   { transform: translate3d(3%, 1%, 0) scale(1.05); }
          100% { transform: translate3d(-4%, -1%, 0) scale(1); }
        }

        /* ═══ PULSE RING (WhoWeAre section) ═══ */
        .kc-pulse { animation: kc-pulse-ring 6s ease-in-out infinite; }
        @keyframes kc-pulse-ring {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.05); opacity: 0.9; }
        }

        @media (prefers-reduced-motion: reduce) {
          .kc-phase-a-smoke,
          .kc-smoke-layer-1, .kc-smoke-layer-2,
          .kc-smoke-layer-3, .kc-smoke-layer-4,
          .kc-phase-a-explore, .kc-phase-a-kalyan {
            animation: none !important;
          }
          .kc-phase-a-smoke { opacity: 0 !important; }
          .kc-phase-a-explore { opacity: 1 !important; }
          .kc-phase-a-kalyan { opacity: 1 !important; }
          .kc-smoke-a, .kc-smoke-b, .kc-smoke-c, .kc-pulse {
            animation: none !important;
          }
        }
      `}</style>

      {/* 1. Cinematic intro — Phase A (auto) + Phase B (scroll) */}
      <CinematicIntro />
      {/* 2–8. Content sections */}
      <WhoWeAre />
      <BrandStory />
      <DiscoveryToDoorstep />
      <EcosystemJourney />
      <PremiumCards />
      <TrustSection />
      <FinalStatement />
      <Footer />
      <MusicControl />
    </div>
  );
}
