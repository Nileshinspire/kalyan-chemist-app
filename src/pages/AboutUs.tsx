import { useRef, useState, useEffect, useCallback } from "react";
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
  ArrowUpRight,
  Star,
  BadgeCheck,
  Volume2,
  VolumeX,
  Clock,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { useNavigate } from "react-router";

/* ─── Shared easing ─── */
const EASE = [0.22, 1, 0.36, 1] as const;

/* ═══════════════════════════════════════════════════════════════════
   AMBIENT AUDIO — Programmatic Web Audio API pad
   ═══════════════════════════════════════════════════════════════════ */

/** Creates a soft, warm ambient pad using multiple detuned oscillators */
function createAmbientPad(ctx: AudioContext) {
  const masterGain = ctx.createGain();
  masterGain.gain.value = 0;
  masterGain.connect(ctx.destination);

  // Low-pass filter for warmth
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 400;
  filter.Q.value = 0.7;
  filter.connect(masterGain);

  // Notes: a soft D-minor pad spread across octaves
  const notes = [
    { freq: 73.42, gain: 0.12 }, // D2
    { freq: 110, gain: 0.1 },    // A2
    { freq: 146.83, gain: 0.08 }, // D3
    { freq: 174.61, gain: 0.06 }, // F3
    { freq: 220, gain: 0.05 },   // A3
    { freq: 293.66, gain: 0.04 }, // D4
  ];

  const oscillators = notes.map(({ freq, gain }) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    // Subtle detune for richness
    osc.detune.value = (Math.random() - 0.5) * 8;

    const oscGain = ctx.createGain();
    oscGain.gain.value = gain;

    // Gentle LFO for organic movement
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.05 + Math.random() * 0.1;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.015;
    lfo.connect(lfoGain);
    lfoGain.connect(oscGain.gain);
    lfo.start();

    osc.connect(oscGain);
    oscGain.connect(filter);
    osc.start();

    return { osc, lfo, oscGain };
  });

  return {
    masterGain,
    oscillators,
    fadeIn(duration = 3) {
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + duration);
    },
    fadeOut(duration = 2) {
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
    },
    destroy() {
      this.fadeOut(0.5);
      setTimeout(() => {
        oscillators.forEach(({ osc, lfo }) => {
          osc.stop();
          lfo.stop();
        });
      }, 600);
    },
  };
}

/* ═══════════════════════════════════════════════════════════════════
   SMOKE / ATMOSPHERIC PARTICLES
   ═══════════════════════════════════════════════════════════════════ */

function SmokeParticles({ opacity = 1 }: { opacity?: number }) {
  const particles = useRef(
    Array.from({ length: 30 }, (_, i) => ({
      x: (Math.sin(i * 1.7 + i * i * 0.03) * 0.5 + 0.5) * 100,
      y: (Math.cos(i * 2.3) * 0.5 + 0.5) * 100,
      size: 60 + (i % 5) * 40,
      dur: 8 + (i % 4) * 3,
      delay: (i * 0.7) % 5,
      drift: ((i % 2 === 0 ? 1 : -1) * (10 + (i % 3) * 8)),
    }))
  ).current;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" style={{ opacity }}>
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: `radial-gradient(circle, ${i % 3 === 0 ? "rgba(22,163,106,0.06)" : i % 3 === 1 ? "rgba(216,184,120,0.04)" : "rgba(245,243,236,0.03)"}, transparent 70%)`,
            animation: `kc-smoke ${p.dur}s ease-in-out ${p.delay}s infinite alternate`,
            filter: "blur(30px)",
            transform: `translateX(${p.drift}px)`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Light rays ─── */
function LightRays({ opacity = 1 }: { opacity?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" style={{ opacity }}>
      <div
        className="absolute"
        style={{
          top: "-20%",
          left: "30%",
          width: "40%",
          height: "120%",
          background: "linear-gradient(180deg, rgba(22,163,106,0.08) 0%, transparent 60%)",
          transform: "rotate(-15deg) scaleX(0.6)",
          filter: "blur(40px)",
        }}
      />
      <div
        className="absolute"
        style={{
          top: "-10%",
          right: "20%",
          width: "30%",
          height: "100%",
          background: "linear-gradient(180deg, rgba(216,184,120,0.05) 0%, transparent 50%)",
          transform: "rotate(10deg) scaleX(0.5)",
          filter: "blur(50px)",
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   FLOATING HEALTHCARE ELEMENTS
   ═══════════════════════════════════════════════════════════════════ */

function FloatingHealthcare({ progress }: { progress: ReturnType<typeof useScroll>["scrollYProgress"] }) {
  const items = [
    { x: 8, y: 20, icon: "💊", size: 28, speed: 0.3 },
    { x: 88, y: 15, icon: "🩺", size: 24, speed: 0.5 },
    { x: 5, y: 65, icon: "💉", size: 22, speed: 0.4 },
    { x: 92, y: 60, icon: "🧬", size: 26, speed: 0.6 },
    { x: 15, y: 85, icon: "🏥", size: 20, speed: 0.35 },
    { x: 80, y: 80, icon: "⚕️", size: 22, speed: 0.45 },
  ];

  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      {items.map((item, i) => {
        const y = useTransform(progress, [0, 1], [0, -100 * item.speed]);
        return (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              fontSize: item.size,
              opacity: 0.08,
              y,
            }}
          >
            {item.icon}
          </motion.div>
        );
      })}
    </div>
  );
}

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
   MUSIC CONTROL — Floating button
   ═══════════════════════════════════════════════════════════════════ */

function MusicControl() {
  const [playing, setPlaying] = useState(false);
  const padRef = useRef<ReturnType<typeof createAmbientPad> | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const autoStartedRef = useRef(false);

  const startMusic = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") ctx.resume();
    if (!padRef.current) padRef.current = createAmbientPad(ctx);
    padRef.current.fadeIn(3);
    setPlaying(true);
  }, []);

  const stopMusic = useCallback(() => {
    padRef.current?.fadeOut(2);
    setPlaying(false);
  }, []);

  // Auto-start on first user interaction (scroll, click, touch)
  useEffect(() => {
    if (autoStartedRef.current) return;
    const handler = () => {
      if (autoStartedRef.current) return;
      autoStartedRef.current = true;
      startMusic();
      // Remove all listeners after first interaction
      window.removeEventListener("scroll", handler);
      window.removeEventListener("click", handler);
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("pointerdown", handler);
    };
    window.addEventListener("scroll", handler, { passive: true, once: false });
    window.addEventListener("click", handler, { once: true });
    window.addEventListener("touchstart", handler, { passive: true, once: true });
    window.addEventListener("pointerdown", handler, { once: true });
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("click", handler);
      window.removeEventListener("touchstart", handler);
      window.removeEventListener("pointerdown", handler);
    };
  }, [startMusic]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      padRef.current?.destroy();
      ctxRef.current?.close();
    };
  }, []);

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1, duration: 0.6, ease: EASE }}
      onClick={() => (playing ? stopMusic() : startMusic())}
      className="fixed bottom-6 right-6 z-50 flex size-11 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white/60 backdrop-blur-md transition-all duration-300 hover:border-[#16A36A]/30 hover:text-[#16A36A] hover:shadow-lg hover:shadow-[#16A36A]/10 cursor-pointer"
      aria-label={playing ? "Mute background music" : "Play background music"}
      title={playing ? "Mute" : "Play ambient music"}
    >
      {playing ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 1 — CINEMATIC INTRO
   Hero visual + giant typography visible from FIRST FRAME,
   transforming together as user scrolls.
   ═══════════════════════════════════════════════════════════════════ */

function CinematicIntro() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  // Hero image zooms as user scrolls
  const heroScale = useTransform(scrollYProgress, [0, 0.6], [1, 1.25]);

  // Smoke starts visible, shifts and fades
  const smokeOpacity = useTransform(scrollYProgress, [0, 0.5, 0.8], [0.7, 0.4, 0]);

  // Light rays
  const rayOpacity = useTransform(scrollYProgress, [0, 0.3, 0.6], [0.5, 0.7, 0]);

  // Word 1: EXPLORE — visible from frame 1, transforms out
  const w1Opacity = useTransform(scrollYProgress, [0, 0.18, 0.28], [1, 1, 0]);
  const w1Y = useTransform(scrollYProgress, [0, 0.28], [0, -80]);
  const w1Scale = useTransform(scrollYProgress, [0, 0.15, 0.28], [1, 1.08, 1.15]);

  // Word 2: KALYAN CHEMIST — appears mid-scroll
  const w2Opacity = useTransform(scrollYProgress, [0.2, 0.3, 0.52, 0.62], [0, 1, 1, 0]);
  const w2Y = useTransform(scrollYProgress, [0.2, 0.62], [60, -50]);
  const w2Scale = useTransform(scrollYProgress, [0.2, 0.4, 0.62], [0.9, 1, 1.08]);

  // Word 3: HEALTHCARE SIMPLIFIED — late in sequence
  const w3Opacity = useTransform(scrollYProgress, [0.55, 0.63, 0.82, 0.92], [0, 1, 1, 0]);
  const w3Y = useTransform(scrollYProgress, [0.55, 0.92], [50, -30]);
  const w3Scale = useTransform(scrollYProgress, [0.55, 0.72, 0.92], [0.92, 1, 1.05]);

  // KC Shield — appears at end
  const shieldOpacity = useTransform(scrollYProgress, [0.82, 0.92], [0, 1]);
  const shieldScale = useTransform(scrollYProgress, [0.82, 0.95], [0.8, 1]);

  // Scroll hint fade
  const hintOpacity = useTransform(scrollYProgress, [0, 0.04], [1, 0]);

  return (
    <div ref={containerRef} className="relative" style={{ height: "300vh" }}>
      <div className="sticky top-0 h-screen overflow-hidden" style={{ background: "#060808" }}>
        {/* ── DEEP BACKGROUND ── */}
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 80% 60% at 50% 40%, #0a2e1f 0%, #060808 70%)" }}
        />

        {/* ── HERO VISUAL COMPOSITION — visible from FIRST FRAME ── */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          style={{ scale: heroScale }}
        >
          {/* Main rounded visual container */}
          <div
            className="relative w-[85vw] max-w-[700px] aspect-[4/3] overflow-hidden rounded-3xl"
            style={{
              background: "linear-gradient(135deg, #0a3d2e 0%, #0B0D0C 40%, #111614 70%, #0a2e1f 100%)",
              boxShadow: "0 0 120px rgba(22,163,106,0.15), 0 0 60px rgba(0,0,0,0.5)",
            }}
          >
            {/* Healthcare environment layers */}
            <div className="absolute inset-0" aria-hidden="true">
              {/* Background: pharmacy shelves pattern */}
              <div className="absolute inset-0" style={{ background: "repeating-linear-gradient(90deg, transparent, transparent 60px, rgba(22,163,106,0.03) 60px, rgba(22,163,106,0.03) 61px), repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(22,163,106,0.02) 40px, rgba(22,163,106,0.02) 41px)" }} />
              {/* Mid: glowing emerald atmosphere */}
              <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(22,163,106,0.2), transparent 65%)" }} />
              <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 40% 35% at 30% 60%, rgba(216,184,120,0.08), transparent 55%)" }} />
              {/* KC Shield as central visual element */}
              <div className="absolute inset-0 flex items-center justify-center">
                <KCShield size={220} opacity={0.5} />
              </div>
              {/* Foreground: floating healthcare elements */}
              {[
                { x: "10%", y: "18%", icon: "💊", size: 32, op: 0.18 },
                { x: "82%", y: "15%", icon: "🩺", size: 28, op: 0.14 },
                { x: "7%", y: "72%", icon: "💉", size: 26, op: 0.12 },
                { x: "88%", y: "68%", icon: "🏥", size: 24, op: 0.14 },
                { x: "50%", y: "8%", icon: "⚕️", size: 22, op: 0.1 },
                { x: "45%", y: "85%", icon: "🧬", size: 20, op: 0.1 },
              ].map((el, i) => (
                <div key={i} className="absolute" style={{ left: el.x, top: el.y, fontSize: el.size, opacity: el.op }}>
                  {el.icon}
                </div>
              ))}
            </div>

            {/* Inner vignette */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 45%, transparent 30%, rgba(4,6,5,0.6) 100%)" }} />

            {/* Subtle border glow */}
            <div className="absolute inset-0 pointer-events-none rounded-[inherit]" style={{ boxShadow: "inset 0 0 40px rgba(22,163,106,0.08)" }} />
          </div>
        </motion.div>

        {/* ── SMOKE PARTICLES — visible from frame 1 ── */}
        <motion.div className="absolute inset-0" style={{ opacity: smokeOpacity }}>
          <SmokeParticles />
        </motion.div>

        {/* ── LIGHT RAYS ── */}
        <motion.div className="absolute inset-0" style={{ opacity: rayOpacity }}>
          <LightRays />
        </motion.div>

        {/* ── WORD 1: EXPLORE — visible immediately ── */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center px-6 z-10"
          style={{ opacity: w1Opacity, y: w1Y, scale: w1Scale }}
        >
          <span
            className="text-[clamp(4rem,14vw,12rem)] font-black uppercase tracking-tight leading-none select-none"
            style={{
              background: "linear-gradient(180deg, rgba(245,243,236,0.95) 0%, rgba(245,243,236,0.4) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: "none",
              filter: "drop-shadow(0 4px 30px rgba(0,0,0,0.5))",
            }}
          >
            Explore
          </span>
        </motion.div>

        {/* ── WORD 2: KALYAN CHEMIST ── */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center px-6 z-10"
          style={{ opacity: w2Opacity, y: w2Y, scale: w2Scale }}
        >
          <div className="text-center select-none">
            <span
              className="block text-[clamp(2.5rem,8vw,7rem)] font-black uppercase tracking-tight leading-[0.9]"
              style={{
                background: "linear-gradient(135deg, #16A36A 0%, #F0D9A3 50%, #16A36A 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 4px 30px rgba(0,0,0,0.5))",
              }}
            >
              Kalyan
            </span>
            <span
              className="block text-[clamp(2.5rem,8vw,7rem)] font-black uppercase tracking-tight leading-[0.9]"
              style={{
                background: "linear-gradient(135deg, #F0D9A3 0%, #16A36A 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 4px 30px rgba(0,0,0,0.5))",
              }}
            >
              Chemist
            </span>
          </div>
        </motion.div>

        {/* ── WORD 3: HEALTHCARE, SIMPLIFIED ── */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center px-6 z-10"
          style={{ opacity: w3Opacity, y: w3Y, scale: w3Scale }}
        >
          <div className="text-center select-none">
            <span className="block text-[clamp(2rem,6vw,5rem)] font-light uppercase tracking-[0.15em] text-white/60">
              Healthcare
            </span>
            <span
              className="block text-[clamp(3rem,10vw,9rem)] font-black uppercase tracking-tight leading-[0.85]"
              style={{
                background: "linear-gradient(180deg, #F0D9A3 0%, #16A36A 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 4px 30px rgba(0,0,0,0.5))",
              }}
            >
              Simplified
            </span>
          </div>
        </motion.div>

        {/* ── KC SHIELD final reveal ── */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center z-10"
          style={{ opacity: shieldOpacity, scale: shieldScale }}
        >
          <KCShield size={180} />
        </motion.div>

        {/* ── Outer vignette ── */}
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{ background: "radial-gradient(ellipse 65% 55% at 50% 45%, transparent 30%, rgba(4,6,5,0.75) 100%)" }}
        />

        {/* ── Scroll hint ── */}
        <motion.div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-20"
          style={{ opacity: hintOpacity }}
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
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SCROLL-TRIGGERED REVEAL WRAPPER
   ═══════════════════════════════════════════════════════════════════ */

function RevealOnScroll({
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
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.9, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 3 — WHO WE ARE (editorial story)
   ═══════════════════════════════════════════════════════════════════ */

function WhoWeAre() {
  return (
    <section
      className="relative overflow-hidden py-28 sm:py-36"
      style={{ background: "linear-gradient(180deg, #0B0D0C, #111614, #0B0D0C)" }}
    >
      <SmokeParticles opacity={0.3} />

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <RevealOnScroll className="text-center mb-20">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#D8B878] mb-6">
            Who We Are
          </p>
          <h2 className="text-4xl sm:text-5xl md:text-7xl font-black leading-[0.95] tracking-tight">
            <span className="text-white/90">Healthcare</span>
            <br />
            <span
              style={{
                background: "linear-gradient(90deg, #16A36A, #F0D9A3, #16A36A)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Simplified
            </span>
          </h2>
        </RevealOnScroll>

        <div className="grid gap-16 lg:gap-24 items-center">
          <RevealOnScroll className="order-2 lg:order-1">
            <div className="space-y-6">
              <p className="text-lg sm:text-xl md:text-2xl font-light leading-relaxed text-white/70">
                Kalyan Chemist brings everyday healthcare closer through a
                <span className="font-semibold text-white/90"> convenient digital experience </span>
                for medicines, healthcare products and essential health services.
              </p>
              <p className="text-base sm:text-lg leading-relaxed text-white/50">
                Born from the belief that accessing healthcare should be as simple as a few taps on
                your phone, we built a platform that connects you to genuine medicines, professional
                pharmacist support, and reliable doorstep delivery — all in one place.
              </p>
              <p className="text-base sm:text-lg leading-relaxed text-white/50">
                Whether it is your daily wellness essentials, prescription medicines, lab tests, or a
                quick doctor consultation, Kalyan Chemist is designed to make your healthcare journey
                seamless, safe and convenient.
              </p>
            </div>
          </RevealOnScroll>

          <RevealOnScroll className="order-1 lg:order-2" delay={0.15}>
            <div
              className="relative rounded-3xl overflow-hidden aspect-[4/3]"
              style={{ background: "linear-gradient(135deg, rgba(22,163,106,0.08), rgba(17,22,20,0.9))" }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  {/* Pulse rings */}
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="absolute rounded-full border"
                      style={{
                        inset: `${-48 - i * 32}px`,
                        borderColor: i % 2 === 0 ? "rgba(22,163,106,0.1)" : "rgba(216,184,120,0.06)",
                        animation: `kc-pulse-ring ${5 + i * 2}s ease-in-out ${i}s infinite`,
                      }}
                    />
                  ))}
                  <div className="relative flex items-center gap-4 p-8">
                    <Stethoscope className="size-12 sm:size-16 text-[#16A36A]/40" strokeWidth={1.2} />
                    <Pill className="size-10 sm:size-14 text-[#F0D9A3]/30" strokeWidth={1.2} />
                    <HeartPulse className="size-12 sm:size-16 text-[#16A36A]/35" strokeWidth={1.2} />
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

/* ── HeartPulse icon (not in lucide, quick inline) ── */
function HeartPulse({ className, strokeWidth = 1.5 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19.5 12.572l-7.5 7.428l-7.5 -7.428a5 5 0 1 1 7.5 -6.566a5 5 0 1 1 7.5 6.572" />
      <path d="M3 12h3l2 -3l3 6l2 -3h3" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 4 — BRAND STORY (cinematic statements)
   ═══════════════════════════════════════════════════════════════════ */

function BrandStory() {
  const statements = [
    "Healthcare should feel simpler.",
    "Finding what you need should take less effort.",
    "From medicines to everyday healthcare needs.",
    "From discovery to doorstep.",
    "Everything connected through one experience.",
  ];

  return (
    <section className="relative overflow-hidden py-28 sm:py-36" style={{ background: "#0B0D0C" }}>
      <div className="relative z-10 mx-auto max-w-4xl px-6">
        <RevealOnScroll className="text-center mb-16">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#16A36A] mb-4">
            Our Philosophy
          </p>
          <h2 className="text-3xl sm:text-5xl font-black leading-[0.95] tracking-tight text-white/90">
            Why{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #16A36A, #F0D9A3)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Kalyan Chemist
            </span>{" "}
            Exists
          </h2>
        </RevealOnScroll>

        <div className="space-y-12 sm:space-y-16">
          {statements.map((text, i) => (
            <RevealOnScroll key={i} delay={i * 0.08}>
              <div className="flex items-center gap-6 sm:gap-8">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-[#16A36A]/20 text-[#16A36A]/60 text-xs font-bold">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <p
                  className="text-2xl sm:text-3xl md:text-4xl font-light leading-tight text-white/60"
                  style={{ letterSpacing: "-0.01em" }}
                >
                  {text}
                </p>
              </div>
              {i < statements.length - 1 && (
                <div className="mt-12 sm:mt-16 ml-5 h-px w-px bg-gradient-to-b from-[#16A36A]/20 to-transparent" />
              )}
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 5 — HEALTHCARE ECOSYSTEM (connected journey)
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
    <section
      className="relative overflow-hidden py-24 sm:py-32"
      style={{ background: "linear-gradient(180deg, #0B0D0C 0%, #0a2e1f 50%, #0B0D0C 100%)" }}
    >
      <SmokeParticles opacity={0.2} />

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <RevealOnScroll className="text-center mb-16">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#D8B878] mb-4">
            The Ecosystem
          </p>
          <h2 className="text-3xl sm:text-5xl font-black leading-[0.95] tracking-tight text-white/90">
            One connected{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #F0D9A3, #16A36A)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              healthcare journey
            </span>
          </h2>
        </RevealOnScroll>

        {/* Vertical connected journey */}
        <div className="relative mx-auto max-w-lg">
          {/* Connecting line */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-gradient-to-b from-[#16A36A]/30 via-[#F0D9A3]/20 to-[#16A36A]/30" />

          <div className="space-y-1">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <RevealOnScroll key={step.label} delay={i * 0.06}>
                  <div className="flex items-center gap-5 py-4">
                    {/* Node */}
                    <div
                      className="relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border"
                      style={{
                        borderColor: `${step.color}30`,
                        background: `${step.color}10`,
                      }}
                    >
                      <Icon className="size-4" style={{ color: step.color }} strokeWidth={1.5} />
                    </div>
                    {/* Label */}
                    <p className="text-base sm:text-lg font-medium text-white/70">{step.label}</p>
                    {/* Arrow */}
                    {i < steps.length - 1 && (
                      <ArrowUpRight className="size-3 text-white/15 ml-auto" />
                    )}
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
    {
      title: "Medicines & Products",
      desc: "Genuine medicines and healthcare products from trusted brands, delivered with care.",
      accent: "#16A36A",
      icon: Pill,
      gradient: "from-[#16A36A]/8 to-[#16A36A]/2",
    },
    {
      title: "Lab Tests & Doctors",
      desc: "Book lab tests and doctor consultations from the comfort of your home.",
      accent: "#F0D9A3",
      icon: Stethoscope,
      gradient: "from-[#F0D9A3]/8 to-[#F0D9A3]/2",
    },
    {
      title: "Prescriptions & Refills",
      desc: "Upload prescriptions easily and set up convenient medicine refill schedules.",
      accent: "#16A36A",
      icon: Upload,
      gradient: "from-[#16A36A]/8 to-[#16A36A]/2",
    },
    {
      title: "Home Delivery",
      desc: "Fast, reliable doorstep delivery so you never miss your healthcare essentials.",
      accent: "#D8B878",
      icon: Truck,
      gradient: "from-[#D8B878]/8 to-[#D8B878]/2",
    },
  ];

  const containerVariants: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12 } },
  };

  const cardVariants: Variants = {
    hidden: { opacity: 0, y: 40, scale: 0.96 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.7, ease: EASE },
    },
  };

  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden py-24 sm:py-32" style={{ background: "#0B0D0C" }}>
      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <RevealOnScroll className="text-center mb-16">
          <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#16A36A] mb-4">
            The Experience
          </p>
          <h2 className="text-3xl sm:text-5xl font-black leading-[0.95] tracking-tight text-white/90">
            Everything you need,{" "}
            <span
              style={{
                background: "linear-gradient(90deg, #F0D9A3, #16A36A)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              in one place
            </span>
          </h2>
        </RevealOnScroll>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                variants={cardVariants}
                className="group relative rounded-3xl border border-white/[0.06] p-6 sm:p-7 transition-all duration-500 hover:border-[#16A36A]/20 hover:shadow-lg hover:shadow-[#16A36A]/5 hover:-translate-y-1 cursor-pointer"
                style={{ background: "linear-gradient(160deg, rgba(245,243,236,0.03), rgba(245,243,236,0.01))" }}
                onClick={() => navigate("/products")}
              >
                {/* Top hover glow */}
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

                {/* Bottom accent */}
                <div className="absolute bottom-0 left-6 right-6 h-[2px] rounded-full bg-gradient-to-r from-transparent via-transparent to-transparent group-hover:via-[#16A36A]/30 transition-all duration-700" />
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 7 — TRUST + STATS
   ═══════════════════════════════════════════════════════════════════ */

function TrustSection() {
  return (
    <section
      className="relative overflow-hidden py-24 sm:py-32"
      style={{ background: "linear-gradient(180deg, #0B0D0C, #0f1a15, #0B0D0C)" }}
    >
      <SmokeParticles opacity={0.2} />

      <div className="relative z-10 mx-auto max-w-6xl px-6">
        <div className="grid gap-16 lg:gap-24 items-center">
          <RevealOnScroll className="order-2 lg:order-1">
            <div className="space-y-8">
              <div>
                <p className="text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-[#D8B878] mb-4">
                  Built on Trust
                </p>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black leading-[0.95] tracking-tight text-white/90">
                  Your health deserves
                  <br />
                  <span
                    style={{
                      background: "linear-gradient(90deg, #16A36A, #F0D9A3)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
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
                  <RevealOnScroll key={i} delay={i * 0.08}>
                    <div className="flex items-start gap-4 group">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#16A36A]/10 text-[#16A36A] group-hover:bg-[#16A36A]/15 transition-colors">
                        <item.icon className="size-[18px]" strokeWidth={1.6} />
                      </div>
                      <p className="text-base leading-relaxed text-white/55 group-hover:text-white/70 transition-colors pt-2">
                        {item.text}
                      </p>
                    </div>
                  </RevealOnScroll>
                ))}
              </div>
            </div>
          </RevealOnScroll>

          <RevealOnScroll className="order-1 lg:order-2" delay={0.1}>
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
                    <stat.icon className="size-[18px]" strokeWidth={1.5} />
                  </div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-white/90">{stat.value}</p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-wider text-white/35">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </RevealOnScroll>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SECTION 8 — FINAL BRAND STATEMENT (visual climax)
   ═══════════════════════════════════════════════════════════════════ */

function FinalStatement() {
  const navigate = useNavigate();

  return (
    <section
      className="relative overflow-hidden py-32 sm:py-44"
      style={{ background: "linear-gradient(180deg, #0B0D0C 0%, #0a3d2e 50%, #0B0D0C 100%)" }}
    >
      {/* Atmospheric backdrop */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 50% 40% at 50% 50%, rgba(22,163,106,0.12), transparent 65%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 30% 25% at 50% 50%, rgba(216,184,120,0.06), transparent 55%)" }} />
      </div>
      <SmokeParticles opacity={0.3} />

      <div className="relative z-10 mx-auto max-w-5xl px-6 text-center">
        <RevealOnScroll>
          {/* Decorative divider */}
          <div className="mx-auto mb-10 h-px w-20 bg-gradient-to-r from-transparent via-[#16A36A]/50 to-transparent" />

          <h2 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black uppercase leading-[0.88] tracking-tight">
            <span
              style={{
                background: "linear-gradient(90deg, #F0D9A3, white, #16A36A)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Your Health,
            </span>
            <br />
            <span
              style={{
                background: "linear-gradient(90deg, #16A36A, #F0D9A3, white)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Our Priority
            </span>
          </h2>

          <p className="mt-8 text-lg sm:text-xl md:text-2xl font-light leading-relaxed text-white/45 max-w-2xl mx-auto">
            Making everyday healthcare simpler, more convenient and accessible
            through Kalyan Chemist.
          </p>

          {/* Decorative divider */}
          <div className="mx-auto mt-10 h-px w-20 bg-gradient-to-r from-transparent via-[#D8B878]/40 to-transparent" />
        </RevealOnScroll>

        {/* CTA */}
        <RevealOnScroll delay={0.2} className="mt-14">
          <button
            onClick={() => navigate("/products")}
            className="group inline-flex items-center gap-3 rounded-full bg-[#16A36A] px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-[#16A36A]/20 hover:bg-[#128a55] transition-all duration-300 hover:shadow-xl hover:shadow-[#16A36A]/30 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          >
            Explore Kalyan Chemist
            <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </RevealOnScroll>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE — Assembles the cinematic scroll story
   ═══════════════════════════════════════════════════════════════════ */

export default function AboutUs() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />

      {/* Global keyframes */}
      <style>{`
        @keyframes kc-smoke {
          0% { transform: translateY(0) translateX(0) scale(1); }
          100% { transform: translateY(-30px) translateX(15px) scale(1.1); }
        }
        @keyframes kc-pulse-ring {
          0% { transform: scale(1); opacity: 0.12; }
          50% { transform: scale(1.06); opacity: 0.22; }
          100% { transform: scale(1); opacity: 0.12; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>

      {/* 1. Cinematic Intro — hero visual + giant typography cycle + shield reveal */}
      <CinematicIntro />

      {/* 2. Who We Are — editorial story reveal */}
      <WhoWeAre />

      {/* 3. Brand Story — cinematic philosophy statements */}
      <BrandStory />

      {/* 4. Healthcare Ecosystem — connected journey */}
      <EcosystemJourney />

      {/* 5. Premium Cards */}
      <PremiumCards />

      {/* 6. Trust + Stats */}
      <TrustSection />

      {/* 7. Final Statement — visual climax */}
      <FinalStatement />

      {/* Footer */}
      <Footer />

      {/* Music Control — floating ON/OFF button */}
      <MusicControl />
    </div>
  );
}
