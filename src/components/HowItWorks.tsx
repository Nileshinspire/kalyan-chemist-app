import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useReducedMotion, useSpring, useInView, type MotionValue } from "framer-motion";
import type { ReactNode } from "react";
import { UploadCloud, RefreshCcw, PackageCheck, Bell, Check, Truck, FileText, Sparkles } from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   KALYAN CHEMIST — ISOMETRIC 3D SCROLL SHOWCASE
   Replaces the previous "How It Works" process banner.
   Isometric viewport (rotateX/rotateY/rotateZ) that straightens
   on scroll, frosted glass cards sliding into position, floating
   3D medicine cards popping out in layered depth.
   GSAP-free: uses framer-motion's scroll engine (already in project).
   ═══════════════════════════════════════════════════════════════ */

/* ── Scroll progress → 0..1 helper for staggered card pop-out ── */
function usePopOut(progress: MotionValue<number>, start: number, end: number) {
  return {
    opacity: useTransform(progress, [start, end], [0, 1]),
    translateY: useTransform(progress, [start, end], [110, 0]),
    translateZ: useTransform(progress, [start, end], [0, 120]),
    scale: useTransform(progress, [start, end], [0.72, 1]),
  };
}

/* ── Pill capsule (3D-look SVG) ── */
function CapsuleSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 32" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="iso-capA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A78BFA" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id="iso-capB" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#99F6E4" />
          <stop offset="1" stopColor="#14B8A6" />
        </linearGradient>
      </defs>
      <rect x="4" y="6" width="30" height="20" rx="10" fill="url(#iso-capA)" />
      <rect x="30" y="6" width="30" height="20" rx="10" fill="url(#iso-capB)" />
      <rect x="9" y="9" width="8" height="6" rx="3" fill="#FFFFFF" opacity="0.55" />
      <rect x="40" y="9" width="10" height="4" rx="2" fill="#FFFFFF" opacity="0.5" />
    </svg>
  );
}

/* ── Medicine bottle (3D-look SVG) ── */
function BottleSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 64" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="iso-botA" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#C4B5FD" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect x="14" y="2" width="16" height="9" rx="3" fill="#7C3AED" />
      <rect x="10" y="10" width="24" height="50" rx="8" fill="url(#iso-botA)" />
      <rect x="14" y="24" width="16" height="20" rx="3" fill="#FFFFFF" opacity="0.92" />
      <rect x="16" y="28" width="12" height="2.4" rx="1.2" fill="#7C3AED" opacity="0.8" />
      <rect x="16" y="33" width="9" height="2.4" rx="1.2" fill="#A78BFA" />
      <rect x="12" y="14" width="4" height="40" rx="2" fill="#FFFFFF" opacity="0.35" />
    </svg>
  );
}

/* ── Floating 3D decorative objects pinned to fixed local zones ── */
function FloatingObject({
  progress,
  start,
  end,
  className,
  children,
  floatDelay,
  popZ,
}: {
  progress: MotionValue<number>;
  start: number;
  end: number;
  className: string;
  children: ReactNode;
  floatDelay: string;
  popZ: number;
}) {
  const reduce = useReducedMotion();
  const opacity = useTransform(progress, [start, end], [0, 1]);
  const z = useTransform(progress, [start, end], [0, popZ]);
  const y = useTransform(progress, [start, end], [60, 0]);
  const scale = useTransform(progress, [start, end], [0.6, 1]);
  return (
    <motion.div
      style={{ opacity, translateZ: z, y, scale }}
      className={`pointer-events-none absolute ${className}`}
    >
      <div
        className="iso-float"
        style={reduce ? { animation: "none" } : { animationDelay: floatDelay }}
      >
        {children}
      </div>
    </motion.div>
  );
}

/* ═══════════════ INTERACTIVE CARDS ═══════════════ */

/* Prescription Upload Card — with animated upload progress bar */
function PrescriptionUploadCard() {
  const [uploadPct, setUploadPct] = useState(0);
  const [state, setState] = useState<"uploading" | "done">("uploading");
  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(cardRef, { once: true, margin: "-60px" });

  // Replay the upload animation whenever the card (re)enters via scroll pop-out
  function replay() {
    setState("uploading");
    setUploadPct(0);
    const iv = setInterval(() => {
      setUploadPct((p) => {
        if (p >= 100) {
          clearInterval(iv);
          setState("done");
          return 100;
        }
        return Math.min(100, p + Math.random() * 9 + 4);
      });
    }, 220);
  }

  // auto-play once when the card scrolls into view; replay on hover
  useEffect(() => {
    if (inView) {
      const t = setTimeout(replay, 500);
      return () => clearTimeout(t);
    }
  }, [inView]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 90, scale: 0.8 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={replay}
    >
      <div ref={cardRef} className="iso-card group relative w-[264px] overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-4 shadow-[0_24px_60px_-18px_rgba(76,29,149,0.25)] backdrop-blur-xl">
        {/* hover sheen */}
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-400/0 via-violet-300/0 to-teal-200/0 transition-all duration-300 group-hover:from-violet-400/15 group-hover:via-transparent group-hover:to-teal-200/25" />
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-md shadow-violet-500/30 transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
            <UploadCloud className="size-5" />
          </div>
          <div>
            <p className="text-[13px] font-bold tracking-tight text-slate-800">Prescription Upload</p>
            <p className="text-[10px] font-medium text-slate-400">Rx · Dr. Mehta · TODAY</p>
          </div>
        </div>
        <div className="mt-3.5">
          <div className="flex items-center justify-between text-[10px] font-semibold">
            <span className="text-slate-500">{state === "done" ? "amoxicillin-500mg.pdf" : "Uploading prescription…"}</span>
            <span className={state === "done" ? "text-teal-600" : "text-violet-600"}>{Math.round(uploadPct)}%</span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200/80">
            <div
              className={`h-full rounded-full transition-[width] duration-200 ease-out ${
                state === "done" ? "bg-gradient-to-r from-teal-400 to-teal-600" : "bg-gradient-to-r from-violet-400 to-violet-600"
              }`}
              style={{ width: `${uploadPct}%` }}
            />
          </div>
          {state === "done" && (
            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-teal-600">
              <Check className="size-3" /> Verified by pharmacist
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* Refill Reminder Card — with animated dates */
function RefillReminderCard() {
  const dates = ["Mon 12", "Wed 14", "Fri 16", "Sun 18"];
  const [active, setActive] = useState(1);
  return (
    <motion.div
      initial={{ opacity: 0, y: 90, scale: 0.8 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="iso-card group relative w-[248px] overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-4 shadow-[0_24px_60px_-18px_rgba(13,148,136,0.25)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-teal-200/0 to-violet-200/0 transition-all duration-300 group-hover:from-teal-200/25 group-hover:to-violet-200/15" />
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-md shadow-teal-500/30 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
            <RefreshCcw className="size-5" />
          </div>
          <div>
            <p className="text-[13px] font-bold tracking-tight text-slate-800">Refill Reminder</p>
            <p className="text-[10px] font-medium text-slate-400">Metformin 500mg · every 12h</p>
          </div>
        </div>
        <div className="mt-3 flex justify-between gap-1.5">
          {dates.map((d, i) => (
            <button
              key={d}
              onClick={() => setActive(i)}
              className={`flex flex-1 cursor-pointer flex-col items-center gap-1 rounded-lg border px-1 py-1.5 transition-all duration-200 ${
                active === i
                  ? "border-teal-500/60 bg-teal-50 shadow-sm shadow-teal-500/20"
                  : "border-slate-200/70 bg-white/60 hover:border-teal-300"
              }`}
            >
              <span className={`text-[9px] font-bold uppercase ${active === i ? "text-teal-600" : "text-slate-400"}`}>
                {d.split(" ")[0]}
              </span>
              <span className={`text-[11px] font-extrabold ${active === i ? "text-slate-800" : "text-slate-500"}`}>
                {d.split(" ")[1]}
              </span>
              <span className={`size-1.5 rounded-full transition-all duration-300 ${active === i ? "bg-teal-500 shadow-[0_0_6px_rgba(20,184,166,0.8)]" : "bg-slate-300"}`} />
            </button>
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-teal-50/80 px-2 py-1.5">
          <Bell className="size-3 text-teal-600" />
          <span className="text-[9.5px] font-semibold text-teal-700">Refill scheduled · notify 2 days prior</span>
        </div>
      </div>
    </motion.div>
  );
}

/* Live Medicine Tracker — status timeline */
function MedicineTrackerCard() {
  const steps = [
    { label: "Order placed", done: true },
    { label: "Packed", done: true },
    { label: "Out for delivery", done: true },
    { label: "Delivered", done: false },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 90, scale: 0.8 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="iso-card group relative w-[252px] overflow-hidden rounded-2xl border border-white/70 bg-white/80 p-4 shadow-[0_24px_60px_-18px_rgba(56,189,248,0.28)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-200/0 to-teal-200/0 transition-all duration-300 group-hover:from-sky-200/25 group-hover:to-teal-200/20" />
        <div className="flex items-center gap-2.5">
          <div className="relative flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-md shadow-sky-500/30 transition-transform duration-300 group-hover:scale-110">
            <PackageCheck className="size-5" />
            {/* live pulse ring */}
            <span className="absolute inset-0 rounded-xl ring-2 ring-sky-400/50 animate-ping opacity-40 [animation-duration:2.2s]" />
          </div>
          <div>
            <p className="text-[13px] font-bold tracking-tight text-slate-800">Live Tracker</p>
            <p className="text-[10px] font-medium text-slate-400">Order #KC-8241 · arriving in 12 min</p>
          </div>
        </div>
        <div className="relative mt-3 pl-1">
          <div className="absolute top-2 bottom-2 left-[6px] w-0.5 rounded bg-slate-200" />
          <div className="absolute top-2 left-[6px] h-[58%] w-0.5 rounded bg-gradient-to-b from-sky-500 to-teal-400" />
          {steps.map((s, i) => (
            <div key={s.label} className="relative flex items-center gap-2.5 py-1.5">
              <span
                className={`relative z-10 flex size-3 items-center justify-center rounded-full border-2 transition-all ${
                  s.done ? "border-sky-500 bg-sky-500" : "border-slate-300 bg-white"
                }`}
              >
                {s.done && <Check className="size-2 text-white" strokeWidth={3.5} />}
              </span>
              <span className={`text-[10.5px] font-semibold ${s.done ? "text-slate-700" : "text-slate-400"}`}>
                {s.label}
              </span>
              {i === 2 && (
                <span className="ml-auto rounded-full bg-sky-100 px-1.5 py-0.5 text-[8.5px] font-bold text-sky-600">
                  LIVE
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50/80 px-2 py-1.5">
          <Truck className="size-3.5 text-teal-600" />
          <span className="text-[9.5px] font-semibold text-slate-600">Rider: Amit · 2.4 km away</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════ MAIN SECTION ═══════════════════════ */
export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();

  // Scroll progress across the section (0 at entry, 1 near exit)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const p = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.6 });

  /* Isometric pose → straightened pose, driven by scroll */
  const rotateX = useTransform(p, [0, 0.5, 1], [reduce ? 0 : 25, reduce ? 0 : 8, reduce ? 0 : 0]);
  const rotateY = useTransform(p, [0, 0.5, 1], [reduce ? 0 : -15, reduce ? 0 : -5, reduce ? 0 : 0]);
  const rotateZ = useTransform(p, [0, 0.5, 1], [reduce ? 0 : 10, reduce ? 0 : 3, reduce ? 0 : 0]);
  const sceneScale = useTransform(p, [0, 0.5, 1], [reduce ? 1 : 0.9, 0.98, 1]);
  const sceneOpacity = useTransform(p, [0, 0.14, 0.86, 1], [0, 1, 1, 0.92]);
  const sceneY = useTransform(p, [0, 1], [70, -50]);

  // per-card pop-outs (staggered)
  const c1 = usePopOut(p, 0.08, 0.34);
  const c2 = usePopOut(p, 0.16, 0.42);
  const c3 = usePopOut(p, 0.24, 0.5);

  // ambient glow follows scroll
  const glowA = useTransform(p, [0, 0.5, 1], ["-6%", "18%", "40%"]);
  const glowB = useTransform(p, [0, 0.5, 1], ["92%", "70%", "52%"]);

  // headline reveal
  const headY = useTransform(p, [0, 0.28], [44, 0]);
  const headOpacity = useTransform(p, [0, 0.22], [0, 1]);

  return (
    <section ref={sectionRef} className="relative overflow-hidden bg-[#F4F5F7] py-20 sm:py-24">
      {/* keyframes & reduced-motion guard */}
      <style>{`
        @keyframes iso-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-7px); }
        }
        @keyframes iso-drift {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(10px, -12px); }
        }
        @keyframes iso-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .iso-float { animation: iso-float 5.2s ease-in-out infinite; will-change: transform; }
        .iso-drift { animation: iso-drift 9s ease-in-out infinite; will-change: transform; }
        @media (prefers-reduced-motion: reduce) {
          .iso-float, .iso-drift { animation: none !important; }
        }
      `}</style>

      {/* ── Layered ambient background ── */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.9),transparent_55%)]" />
        <motion.div
          style={{ left: glowA }}
          className="absolute top-1/4 size-[420px] -translate-y-1/2 rounded-full bg-violet-300/35 blur-3xl"
        />
        <motion.div
          style={{ left: glowB }}
          className="absolute top-1/2 size-[460px] -translate-y-1/2 rounded-full bg-teal-300/35 blur-3xl"
        />
        <div className="absolute -bottom-24 right-1/4 size-80 rounded-full bg-sky-200/40 blur-3xl" />
        {/* faint isometric dot grid */}
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(124,58,237,0.09)_1px,transparent_1px)] bg-[size:26px_26px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_78%)]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
        {/* ── Oversized left-aligned headline ── */}
        <motion.h2
          style={reduce ? { opacity: 1, y: 0 } : { opacity: headOpacity, y: headY }}
          className="max-w-4xl text-left font-extrabold uppercase leading-[0.95] tracking-tight text-slate-900"
        >
          <span className="block text-[clamp(1.9rem,5.2vw,4.2rem)]">
            Order Medicines,
          </span>
          <span className="block bg-gradient-to-r from-violet-600 via-violet-500 to-teal-500 bg-clip-text text-[clamp(1.9rem,5.2vw,4.2rem)] text-transparent">
            Track Prescriptions,
          </span>
          <span className="block text-[clamp(1.9rem,5.2vw,4.2rem)]">
            Manage Health
          </span>
        </motion.h2>

        {/* ── Isometric 3D viewport ── */}
        <div className="relative mt-10 h-[560px] sm:mt-14 sm:h-[640px]" style={{ perspective: "1400px" }}>
          {/* perspective grid floor */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 mx-auto h-40 max-w-5xl opacity-60 [mask-image:linear-gradient(to_bottom,transparent,black_30%,black_70%,transparent)]"
            style={{ transform: "rotateX(62deg) scale(1.6)", transformOrigin: "bottom center" }}
          >
            <div className="size-full bg-[linear-gradient(rgba(124,58,237,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(20,184,166,0.12)_1px,transparent_1px)] bg-[size:52px_52px]" />
          </div>

          <motion.div
            style={
              reduce
                ? undefined
                : { rotateX, rotateY, rotateZ, scale: sceneScale, opacity: sceneOpacity, y: sceneY }
            }
            className="absolute inset-0 [transform-style:preserve-3d]"
          >
            {/* central order-tracker dashboard panel */}
            <div className="absolute top-1/2 left-1/2 h-[360px] w-[680px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 [transform-style:preserve-3d]">
              {/* dashboard base slab (isometric depth) */}
              <div
                aria-hidden
                className="absolute inset-0 translate-y-3 rounded-3xl bg-gradient-to-br from-violet-900/80 to-slate-900/80 blur-[2px]"
                style={{ transform: "translateZ(-46px)" }}
              />
              {/* dashboard glass face */}
              <div
                className="iso-card absolute inset-0 overflow-hidden rounded-3xl border border-white/80 bg-white/85 shadow-[0_50px_120px_-30px_rgba(76,29,149,0.35)] backdrop-blur-2xl"
                style={{ transform: "translateZ(0px)" }}
              >
                <div className="flex h-full flex-col p-5 sm:p-6">
                  {/* window chrome */}
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-violet-400" />
                    <span className="size-2.5 rounded-full bg-teal-400" />
                    <span className="size-2.5 rounded-full bg-sky-300" />
                    <span className="ml-3 text-[11px] font-bold tracking-widest text-slate-400 uppercase">
                      Kalyan Chemist · Order Dashboard
                    </span>
                    <Sparkles className="ml-auto size-3.5 text-violet-400" />
                  </div>

                  {/* dashboard content rows */}
                  <div className="mt-4 grid flex-1 grid-cols-3 gap-3 sm:gap-4">
                    {/* mini stat */}
                    <div className="rounded-2xl border border-slate-100 bg-white/90 p-3 shadow-sm">
                      <p className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">Today</p>
                      <p className="mt-1 text-xl font-extrabold text-slate-800">4</p>
                      <p className="text-[9.5px] font-medium text-slate-400">medicines due</p>
                      <div className="mt-2 flex gap-1">
                        {[...Array(4)].map((_, i) => (
                          <span key={i} className={`size-1.5 rounded-full ${i < 3 ? "bg-violet-400" : "bg-slate-200"}`} />
                        ))}
                      </div>
                    </div>
                    {/* mini chart */}
                    <div className="rounded-2xl border border-slate-100 bg-white/90 p-3 shadow-sm">
                      <p className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">Adherence</p>
                      <div className="mt-2 flex h-12 items-end gap-1">
                        {[40, 65, 50, 80, 62, 92, 74].map((h, i) => (
                          <div
                            key={i}
                            className="w-full rounded-t bg-gradient-to-t from-teal-500/80 to-teal-300"
                            style={{ height: `${h}%` }}
                          />
                        ))}
                      </div>
                    </div>
                    {/* mini delivery */}
                    <div className="rounded-2xl border border-slate-100 bg-white/90 p-3 shadow-sm">
                      <p className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">Delivery</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-md shadow-sky-500/30">
                          <Truck className="size-4" />
                        </span>
                        <div>
                          <p className="text-[11px] font-extrabold text-slate-800">12 min</p>
                          <p className="text-[9px] font-medium text-slate-400">eta</p>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-sky-400 to-teal-400" />
                      </div>
                    </div>
                  </div>

                  {/* bottom status strip */}
                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-900/95 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <FileText className="size-3.5 text-teal-300" />
                      <span className="text-[10px] font-semibold tracking-wide text-slate-300">
                        Prescription verified · 100% genuine stock
                      </span>
                    </div>
                    <span className="rounded-full bg-teal-400/20 px-2 py-0.5 text-[9px] font-bold tracking-wider text-teal-300 uppercase">
                      Live
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── Floating interactive cards popping out in 3D layers ── */}
            {/* Upload card — left */}
            <motion.div
              style={reduce ? { opacity: 1, y: 0, scale: 1 } : { opacity: c1.opacity, y: c1.translateY, scale: c1.scale, translateZ: c1.translateZ, x: "-140%" }}
              className="absolute top-[16%] left-1/2 -ml-32 hidden sm:block [transform-style:preserve-3d]"
            >
              <div className="iso-drift">
                <PrescriptionUploadCard />
              </div>
            </motion.div>

            {/* Refill card — right */}
            <motion.div
              style={reduce ? { opacity: 1, y: 0, scale: 1 } : { opacity: c2.opacity, y: c2.translateY, scale: c2.scale, translateZ: c2.translateZ, x: "185%" }}
              className="absolute top-[54%] left-1/2 hidden sm:block [transform-style:preserve-3d]"
            >
              <div className="iso-drift" style={{ animationDelay: "1.4s" }}>
                <RefillReminderCard />
              </div>
            </motion.div>

            {/* Tracker card — bottom-center (also visible on mobile) */}
            <motion.div
              style={reduce ? { opacity: 1, y: 0, scale: 1 } : { opacity: c3.opacity, y: c3.translateY, scale: c3.scale, translateZ: c3.translateZ, x: "-50%" }}
              className="absolute top-[88%] left-1/2 sm:top-[76%] [transform-style:preserve-3d]"
            >
              <div className="iso-drift" style={{ animationDelay: "2.6s" }}>
                <MedicineTrackerCard />
              </div>
            </motion.div>

            {/* ── Fixed-zone floating 3D medicine objects ── */}
            <FloatingObject progress={p} start={0.2} end={0.5} popZ={150} className="top-[10%] left-[12%] hidden md:block" floatDelay="0.3s">
              <CapsuleSvg className="h-9 w-18 max-w-none drop-shadow-[0_10px_18px_rgba(124,58,237,0.35)]" />
            </FloatingObject>
            <FloatingObject progress={p} start={0.3} end={0.6} popZ={110} className="top-[70%] left-[8%] hidden md:block" floatDelay="1.1s">
              <BottleSvg className="h-16 drop-shadow-[0_12px_20px_rgba(124,58,237,0.3)]" />
            </FloatingObject>
            <FloatingObject progress={p} start={0.28} end={0.58} popZ={140} className="top-[12%] right-[10%] hidden md:block" floatDelay="0.7s">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-lg shadow-teal-500/40">
                <Bell className="size-5" />
              </div>
            </FloatingObject>
            <FloatingObject progress={p} start={0.34} end={0.64} popZ={100} className="top-[72%] right-[8%] hidden md:block" floatDelay="1.8s">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-400 to-violet-600 text-white shadow-lg shadow-violet-500/40">
                <Check className="size-5" />
              </div>
            </FloatingObject>
          </motion.div>
        </div>

        {/* ── Scroll hint ── */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
          className="mt-6 flex justify-center"
        >
          <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 px-4 py-1.5 backdrop-blur">
            <Sparkles className="size-3.5 text-violet-500" />
            <span className="text-[10.5px] font-semibold tracking-wide text-slate-500 uppercase">
              Hover the cards — they're live
            </span>
          </div>
        </motion.div>
      </div>

    </section>
  );
}
