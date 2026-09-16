import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  Check,
  ClipboardCheck,
  FlaskConical,
  Home,
  Package,
  Search,
  ShoppingCart,
  ShieldCheck,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   KALYAN CHEMIST — "HOW IT WORKS" · CONTINUOUS 3D ORDER FILM
   ---------------------------------------------------------------------------
   One camera, one stage, one story. A single spring-damped scroll progress
   scrubs the whole sequence: the medicine is picked up, drops into the cart,
   the cart turns into the order, the order is verified, wraps into a parcel
   and travels to the doorstep. Object paths overlap, so nothing pops.

   Performance notes (this is a sequence, not a pile of animated cards):
   · exactly ONE scroll-driven spring; no per-element React state, no
     per-frame re-renders (only the scene label changes),
   · transforms + opacity only — no width/height, top/left, filter or
     backdrop-filter animation,
   · one static scaled wrapper handles the responsive fit, so the
     choreography is identical on every screen,
   · ambient CSS loops exist only while the stage is on screen and are
     disabled entirely under prefers-reduced-motion.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Premium dark medical-tech palette: ink · ice · brass · platinum ── */
const ICE = "#8FD8FF";
const ICE_DEEP = "#4FA8D8";
const BRASS = "#D9B678";
const INK_DEEP = "#0A0F16";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface Scene {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}

const SCENES: Scene[] = [
  { id: "select", label: "Select product", hint: "Find the medicine or device you need.", icon: Search },
  { id: "cart", label: "Add to cart", hint: "Your selection drops straight into the cart.", icon: ShoppingCart },
  { id: "order", label: "Place order", hint: "Address, payment and prescription confirmed.", icon: ClipboardCheck },
  { id: "processing", label: "Order processing", hint: "Our pharmacist verifies every order.", icon: FlaskConical },
  { id: "packed", label: "Packed & out for delivery", hint: "Sealed, labelled and on the way to you.", icon: Package },
  { id: "delivered", label: "Delivered", hint: "Handed over at your doorstep.", icon: Home },
];

/* Scroll progress where each scene takes over the story */
const SCENE_AT = [0.24, 0.4, 0.52, 0.66, 0.86];
const SCENE_PROGRESS_IN = [0, ...SCENE_AT, 0.98];
const SCENE_PROGRESS_OUT = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1];

/* Shared helper so the choreography stays readable */
function usePath(p: MotionValue<number>, input: number[], output: number[]) {
  return useTransform(p, input, output);
}

/* ═══════════════════ 3D OBJECTS (static geometry) ═══════════════════
   Every movement is applied by the stage rig; the objects themselves
   never re-render and carry no filters.
   ══════════════════════════════════════════════════════════════════ */

/* Platinum blister strip — the product that starts the story */
function MedicineStrip() {
  return (
    <div className="relative" style={{ width: 140, height: 62 }}>
      <div
        className="absolute inset-0 rounded-xl"
        style={{
          background: "linear-gradient(142deg,#F3F7FC 0%,#CBD6E4 40%,#8B99AB 100%)",
          boxShadow: "0 22px 34px -18px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.9)",
        }}
      />
      <div
        className="absolute inset-x-1 top-0 h-1/2 rounded-t-xl"
        style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.85), rgba(255,255,255,0))" }}
      />
      <div className="absolute inset-0 flex items-center gap-1.5 px-3">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-7 w-5 shrink rounded-md ring-1 ring-slate-400/40"
            style={{ background: "radial-gradient(circle at 34% 26%, #FFFFFF, rgba(255,255,255,0.22))" }}
          />
        ))}
        <span
          className="h-5 w-8 shrink-0 rounded-full ring-1 ring-white/40"
          style={{ background: `linear-gradient(120deg, ${ICE}, ${ICE_DEEP})` }}
        />
      </div>
    </div>
  );
}

/* Glass cart the product drops into */
function CartObject() {
  return (
    <div className="relative" style={{ width: 116, height: 106 }}>
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/20 to-white/[0.04] p-px">
        <div className="h-full w-full rounded-[15px]" style={{ background: INK_DEEP }} />
      </div>
      <div
        className="absolute inset-px rounded-[15px]"
        style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.07), rgba(255,255,255,0))" }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <ShoppingCart className="h-6 w-6" style={{ color: ICE }} aria-hidden="true" />
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-5 rounded-full"
              style={{ background: i < 2 ? "rgba(143,216,255,0.7)" : "rgba(255,255,255,0.12)" }}
            />
          ))}
        </div>
      </div>
      <span
        className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
        style={{ background: BRASS, color: "#1A1408", boxShadow: `0 8px 16px -8px ${BRASS}` }}
      >
        2
      </span>
    </div>
  );
}

/* Order card — becomes the pharmacist-verification panel in place */
function OrderObject({ p }: { p: MotionValue<number> }) {
  const summaryOpacity = usePath(p, [0.5, 0.56], [1, 0]);
  const verifyOpacity = usePath(p, [0.54, 0.6], [0, 1]);

  const fillA = usePath(p, [0.51, 0.56], [0, 1]);
  const fillB = usePath(p, [0.58, 0.63], [0, 1]);
  const fillC = usePath(p, [0.65, 0.7], [0, 1]);
  const fills = [fillA, fillB, fillC];

  const rows = [
    { label: "Paracetamol 500mg ×2", value: "₹64" },
    { label: "Vitamin D3 60K ×1", value: "₹118" },
    { label: "Prescription attached", value: "Rx" },
  ];

  return (
    <div className="relative" style={{ width: 240, height: 142 }}>
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/20 to-white/[0.04] p-px">
        <div className="h-full w-full rounded-[15px]" style={{ background: "#0A0F16" }} />
      </div>
      <div
        className="absolute inset-px rounded-[15px]"
        style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.06), rgba(255,255,255,0))" }}
      />
      <span className="absolute top-4 bottom-4 left-0 w-[3px] rounded-full" style={{ background: ICE }} />

      <div className="relative flex h-full flex-col px-4 py-2.5">
        {/* header cross-fades from summary into verification */}
        <div className="relative h-4">
          <motion.span
            style={{ opacity: summaryOpacity }}
            className="absolute inset-0 text-[10.5px] font-bold tracking-[0.16em] text-slate-300 uppercase"
          >
            Order summary
          </motion.span>
          <motion.span
            style={{ opacity: verifyOpacity }}
            className="absolute inset-0 text-[10.5px] font-bold tracking-[0.16em] uppercase"
          >
            <span style={{ color: ICE }}>Pharmacist verification</span>
          </motion.span>
        </div>

        <div className="mt-3 space-y-2">
          {rows.map((row, i) => (
            <div key={row.label} className="flex items-center gap-2.5">
              <span className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1 ring-white/15">
                <motion.span
                  style={{ opacity: fills[i], scale: fills[i], background: ICE }}
                  className="absolute inset-0 flex items-center justify-center rounded-full"
                >
                  <Check className="h-2.5 w-2.5" style={{ color: "#062430" }} aria-hidden="true" />
                </motion.span>
              </span>
              <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-slate-200">{row.label}</span>
              <span className="shrink-0 text-[11.5px] font-bold text-white">{row.value}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-2.5">
          <span className="text-[10px] font-semibold tracking-[0.16em] text-slate-400 uppercase">Total paid</span>
          <span className="text-[14px] font-extrabold" style={{ color: BRASS }}>
            ₹182
          </span>
        </div>
      </div>
    </div>
  );
}

/* Parcel the order wraps into — carries the story to the door */
function ParcelObject({ p }: { p: MotionValue<number> }) {
  const badgeOpacity = usePath(p, [0.9, 0.99], [0, 1]);
  const badgeScale = usePath(p, [0.9, 1], [0.4, 1]);
  const lidRotate = usePath(p, [0.93, 1], [0, -26]);

  return (
    <div className="relative" style={{ width: 118, height: 108, transformStyle: "preserve-3d" }}>
      {/* box body */}
      <svg viewBox="0 0 118 108" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="hiw-parcel-left" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1B2735" />
            <stop offset="1" stopColor="#0C131B" />
          </linearGradient>
        </defs>
        <polygon points="7,30 59,54 59,104 7,80" fill="url(#hiw-parcel-left)" />
        <polygon points="111,30 59,54 59,104 111,80" fill="#070C12" />
        <polygon points="7,30 30,41 30,88 7,77" fill={BRASS} opacity="0.8" />
        <circle cx="82" cy="74" r="12" fill="none" stroke={BRASS} strokeWidth="1.4" opacity="0.75" />
        <text x="82" y="78" textAnchor="middle" fontSize="9" fontWeight="700" fill={BRASS} opacity="0.95">
          KC
        </text>
      </svg>

      {/* lid — lifts slightly once delivered */}
      <motion.div
        style={{ rotateX: lidRotate, transformPerspective: 700, transformOrigin: "50% 100%" }}
        className="absolute top-0 left-0 h-[58px] w-full"
      >
        <svg viewBox="0 0 118 58" className="h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="hiw-parcel-top" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#E8EFF7" />
              <stop offset="1" stopColor="#93A3B6" />
            </linearGradient>
          </defs>
          <polygon points="59,4 111,28 59,52 7,28" fill="url(#hiw-parcel-top)" />
          <polygon points="7,28 59,52 59,58 7,34" fill="#6C7C90" />
        </svg>
      </motion.div>

      {/* delivered badge — the final beat */}
      <motion.div
        style={{ opacity: badgeOpacity, scale: badgeScale }}
        className="absolute -top-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full"
      >
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(circle, rgba(143,216,255,0.4), transparent 70%)` }}
        />
        <span
          className="relative flex h-7 w-7 items-center justify-center rounded-full"
          style={{ background: ICE, boxShadow: "0 10px 20px -10px rgba(143,216,255,0.9)" }}
        >
          <Check className="h-4 w-4" style={{ color: "#062430" }} aria-hidden="true" />
        </span>
      </motion.div>
    </div>
  );
}

/* Doorstep the parcel travels to */
function DoorstepMarker() {
  return (
    <div className="relative flex flex-col items-center gap-1.5">
      <div className="relative">
        <span
          className="absolute -inset-3 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(143,216,255,0.2), transparent 70%)" }}
          aria-hidden="true"
        />
        <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-b from-white/20 to-white/[0.04] p-px">
          <span
            className="flex h-full w-full items-center justify-center rounded-[15px]"
            style={{ background: INK_DEEP }}
          >
            <Home className="h-4 w-4" style={{ color: ICE }} aria-hidden="true" />
          </span>
        </span>
      </div>
      <span className="text-[9px] font-bold tracking-[0.18em] text-slate-500 uppercase">Your door</span>
    </div>
  );
}

/* Ambient stage decoration — one local float, paused when off screen */
function Ambient({ className, delay, children }: { className: string; delay: string; children: ReactNode }) {
  return (
    <div
      className={cn("hiw-float pointer-events-none absolute", className)}
      style={{ animationDelay: delay }}
      aria-hidden="true"
    >
      {children}
    </div>
  );
}

/* ═══════════════════════════ 3D STAGE ═══════════════════════════ */

function JourneyStage({ p, active, reduce }: { p: MotionValue<number>; active: number; reduce: boolean }) {
  /* ── camera: one slow, continuous drift across the whole sequence ── */
  const camRotX = usePath(p, [0, 0.5, 1], reduce ? [0, 0, 0] : [8, 2.5, 0]);
  const camRotY = usePath(p, [0, 0.35, 0.7, 1], reduce ? [0, 0, 0, 0] : [13, 4, -3, 0]);
  const camScale = usePath(p, [0, 0.5, 1], reduce ? [1, 1, 1] : [0.95, 0.99, 1]);
  const camX = usePath(p, [0, 0.3, 0.6, 1], reduce ? [0, 0, 0, 0] : [-12, -4, 8, 4]);
  const camY = usePath(p, [0, 1], reduce ? [0, 0] : [12, -10]);

  /* ── key light follows the action ── */
  const glowX = usePath(p, [0, 0.35, 0.7, 1], [-110, -20, 90, 120]);
  const glowOpacity = usePath(p, [0, 0.4, 0.8, 1], [0.45, 0.7, 0.55, 0.85]);
  const warmOpacity = usePath(p, [0.72, 0.9], [0, 0.75]);

  /* ── product: selected, then drops into the cart ── */
  const prodX = usePath(p, [0.02, 0.3], [0, 96]);
  const prodY = usePath(p, [0.02, 0.3], [-38, 26]);
  const prodScale = usePath(p, [0.02, 0.3], [1, 0.5]);
  const prodRotZ = usePath(p, [0, 0.3], [-6, 14]);
  const prodRotY = usePath(p, [0, 0.3], [12, -34]);
  const prodOpacity = usePath(p, [0, 0.26, 0.4], [1, 1, 0]);

  /* ── cart: swings in, receives the product, then tips the order out ── */
  const cartX = usePath(p, [0.08, 0.26, 0.38, 0.48], [124, 104, 122, 150]);
  const cartY = usePath(p, [0.08, 0.26, 0.38, 0.48], [96, 26, 30, 88]);
  const cartScale = usePath(p, [0.08, 0.26, 0.38, 0.48], [0.72, 1, 1, 0.7]);
  const cartRotX = usePath(p, [0.08, 0.26, 0.38, 0.48], [16, 0, -8, -26]);
  const cartRotY = usePath(p, [0.08, 0.26, 0.48], [-20, 0, 16]);
  const cartOpacity = usePath(p, [0.08, 0.2, 0.38, 0.48], [0, 1, 1, 0]);

  /* ── order card: takes the stage, verifies, wraps into the parcel ── */
  const orderX = usePath(p, [0.4, 0.54, 0.62, 0.72], [132, 0, 0, 0]);
  const orderY = usePath(p, [0.4, 0.54, 0.68, 0.76], [14, 0, 0, 16]);
  const orderScale = usePath(p, [0.4, 0.54, 0.68, 0.76], [0.64, 1, 1, 0.4]);
  const orderRotY = usePath(p, [0.4, 0.54, 0.7, 0.76], [-28, 0, 0, 26]);
  const orderRotX = usePath(p, [0.4, 0.54, 0.76], [12, 0, -8]);
  const orderOpacity = usePath(p, [0.38, 0.48, 0.68, 0.76], [0, 1, 1, 0]);

  /* ── parcel: wraps, travels right, arrives at the door ── */
  const parcX = usePath(p, [0.68, 0.78, 0.94, 1], [0, 0, 140, 140]);
  const parcY = usePath(p, [0.68, 0.78, 0.88, 1], [4, -4, -26, -16]);
  const parcScale = usePath(p, [0.68, 0.78, 0.9, 1], [0.4, 1, 0.94, 0.9]);
  const parcRotY = usePath(p, [0.68, 0.78, 0.94, 1], [26, 0, 158, 172]);
  const parcRotZ = usePath(p, [0.68, 0.78, 0.94, 1], [0, 0, -4, -2]);
  const parcOpacity = usePath(p, [0.68, 0.76], [0, 1]);

  /* ── route + doorstep ── */
  const routeScale = usePath(p, [0.6, 0.94], [0, 1]);
  const routeOpacity = usePath(p, [0.58, 0.66], [0, 1]);
  const doorOpacity = usePath(p, [0.62, 0.74], [0, 1]);
  const doorScale = usePath(p, [0.62, 0.76], [0.72, 1]);
  const doorY = usePath(p, [0.62, 0.76], [16, 0]);

  const stepProgress = useTransform(p, SCENE_PROGRESS_IN, SCENE_PROGRESS_OUT);
  const scene = SCENES[active];

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[22px]" style={{ background: "#060A0F" }}>
      {/* stage chrome — deliberately outside the scaled film so it stays crisp */}
      <div className="absolute inset-0 z-20 flex flex-col justify-between">
        <div className="flex items-start justify-between gap-3 px-4 pt-3.5">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] font-bold tracking-[0.2em] tabular-nums" style={{ color: BRASS }}>
                {String(active + 1).padStart(2, "0")}
                <span className="text-white/25">/{String(SCENES.length).padStart(2, "0")}</span>
              </span>
              <span className="truncate text-[12px] font-semibold tracking-[0.08em] text-white uppercase">
                {scene.label}
              </span>
            </div>
            <p className="mt-1 hidden max-w-[17rem] text-[10.5px] leading-snug text-slate-400 sm:block">{scene.hint}</p>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
            <ShieldCheck className="h-3 w-3" style={{ color: ICE }} aria-hidden="true" />
            <span className="text-[8.5px] font-bold tracking-[0.2em] text-slate-300 uppercase">Kalyan Chemist</span>
          </span>
        </div>
        <div className="px-4 pb-3">
          <span className="text-[9px] font-semibold tracking-[0.22em] text-slate-500 uppercase">Order journey</span>
        </div>
      </div>

      {/* ── the film ── */}
      <div className="absolute inset-0 z-10" style={{ perspective: "1150px" }}>
        {/* one static responsive fit — choreography is identical on every screen */}
        <div
          className="absolute top-1/2 left-1/2 h-[290px] w-[620px] -translate-x-1/2 -translate-y-1/2 scale-[0.5] sm:scale-[0.64] md:scale-[0.76] lg:scale-[0.82] xl:scale-100"
          style={{ transformStyle: "preserve-3d" }}
        >
          <motion.div
            style={{
              rotateX: camRotX,
              rotateY: camRotY,
              scale: camScale,
              x: camX,
              y: camY,
              transformStyle: "preserve-3d",
            }}
            className="relative h-full w-full"
          >
            {/* key light */}
            <motion.div
              style={{ x: glowX, opacity: glowOpacity, z: -80 }}
              className="absolute top-1/2 left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2"
              aria-hidden="true"
            >
              <div
                className="h-full w-full rounded-full"
                style={{ background: "radial-gradient(circle, rgba(143,216,255,0.17), transparent 68%)" }}
              />
            </motion.div>
            {/* warm arrival light */}
            <motion.div
              style={{ opacity: warmOpacity, x: 150, y: 26, z: -60 }}
              className="absolute top-1/2 left-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2"
              aria-hidden="true"
            >
              <div
                className="h-full w-full rounded-full"
                style={{ background: "radial-gradient(circle, rgba(217,182,120,0.16), transparent 70%)" }}
              />
            </motion.div>

            {/* floor hairline — static depth anchor */}
            <div
              className="absolute bottom-14 left-1/2 h-px w-[520px] -translate-x-1/2"
              style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)" }}
              aria-hidden="true"
            />

            {/* delivery route: dim base + scroll-fed bright fill */}
            <motion.div
              style={{ opacity: routeOpacity, z: -20, x: 0, y: 62 }}
              className="absolute top-1/2 left-1/2 h-6 w-[214px]"
              aria-hidden="true"
            >
              <div className="absolute top-1/2 right-0 left-0 h-0.5 -translate-y-1/2 rounded-full bg-white/[0.09]" />
              <motion.div
                style={{ scaleX: routeScale, background: `linear-gradient(90deg, rgba(143,216,255,0), ${ICE})` }}
                className="absolute top-1/2 right-0 left-0 h-0.5 origin-left -translate-y-1/2 rounded-full"
              />
              <div className="absolute top-0.5 right-0 left-0 flex justify-between">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className="h-1 w-1 rounded-full bg-white/15" />
                ))}
              </div>
            </motion.div>

            {/* doorstep */}
            <motion.div
              style={{ opacity: doorOpacity, scale: doorScale, y: doorY, x: 168, z: 0 }}
              className="absolute top-1/2 left-1/2 -mt-[34px] -ml-[22px]"
            >
              <DoorstepMarker />
            </motion.div>

            {/* cart */}
            <motion.div
              style={{
                opacity: cartOpacity,
                x: cartX,
                y: cartY,
                scale: cartScale,
                rotateX: cartRotX,
                rotateY: cartRotY,
                z: 20,
              }}
              className="absolute top-1/2 left-1/2 -mt-[53px] -ml-[58px]"
            >
              <CartObject />
            </motion.div>

            {/* product */}
            <motion.div
              style={{
                opacity: prodOpacity,
                x: prodX,
                y: prodY,
                scale: prodScale,
                rotateZ: prodRotZ,
                rotateY: prodRotY,
                z: 44,
              }}
              className="absolute top-1/2 left-1/2 -mt-[31px] -ml-[70px]"
            >
              <MedicineStrip />
            </motion.div>

            {/* order → verification panel */}
            <motion.div
              style={{
                opacity: orderOpacity,
                x: orderX,
                y: orderY,
                scale: orderScale,
                rotateX: orderRotX,
                rotateY: orderRotY,
                z: 30,
              }}
              className="absolute top-1/2 left-1/2 -mt-[71px] -ml-[120px]"
            >
              <OrderObject p={p} />
            </motion.div>

            {/* parcel */}
            <motion.div
              style={{
                opacity: parcOpacity,
                x: parcX,
                y: parcY,
                scale: parcScale,
                rotateY: parcRotY,
                rotateZ: parcRotZ,
                z: 32,
              }}
              className="absolute top-1/2 left-1/2 -mt-[54px] -ml-[59px]"
            >
              <ParcelObject p={p} />
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* ambient decorations — local float, only while on screen */}
      <Ambient className="top-[42%] left-4 hidden sm:block" delay="0s">
        <svg viewBox="0 0 40 20" className="h-4 w-8">
          <rect x="1" y="1" width="19" height="18" rx="9" fill={ICE} opacity="0.5" />
          <rect x="20" y="1" width="19" height="18" rx="9" fill={BRASS} opacity="0.45" />
        </svg>
      </Ambient>
      <Ambient className="right-5 bottom-[28%] hidden sm:block" delay="1.4s">
        <svg viewBox="0 0 24 24" className="h-4 w-4">
          <rect x="8" y="2" width="8" height="20" rx="3" fill={ICE} opacity="0.35" />
          <rect x="2" y="8" width="20" height="8" rx="3" fill={ICE} opacity="0.35" />
        </svg>
      </Ambient>

      {/* scene progress */}
      <div className="absolute inset-x-0 bottom-0 z-20 h-0.5 bg-white/[0.07]">
        <motion.div
          style={{ scaleX: stepProgress, background: `linear-gradient(90deg, ${ICE_DEEP}, ${ICE})` }}
          className="h-full origin-left"
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════ SECTION ═══════════════════════════ */

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);

  /* ambient CSS loops exist only while the stage is on screen */
  const inView = useInView(sectionRef, { margin: "220px 0px 220px 0px" });

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start 0.88", "end 0.42"] });
  /* one spring scrubs the entire sequence — smooth, never snapping */
  const p = useSpring(scrollYProgress, { stiffness: 95, damping: 30, mass: 0.5 });

  useMotionValueEvent(p, "change", (v) => {
    let idx = 0;
    for (let i = 0; i < SCENE_AT.length; i++) if (v >= SCENE_AT[i]) idx = i + 1;
    setActive((prev) => (prev === idx ? prev : idx));
  });

  /* Jump straight to the scroll position where a scene is parked */
  const goToScene = useCallback((index: number) => {
    const el = sectionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const travel = vh * 0.46 + rect.height;
    const target = index === 0 ? 0 : SCENE_AT[index - 1];
    window.scrollTo({ top: window.scrollY + rect.top - (vh * 0.88 - travel * target), behavior: "smooth" });
  }, []);

  return (
    <section
      ref={sectionRef}
      className={cn("relative isolate overflow-hidden", inView && "hiw-live")}
      style={{ background: "linear-gradient(180deg, #04070B 0%, #070B12 52%, #04070B 100%)" }}
    >
      <style>{`
        @keyframes hiw-float { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(0,-6px,0)} }
        /* the loop only exists while the section is on screen */
        .hiw-live .hiw-float { animation: hiw-float 7s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .hiw-live .hiw-float { animation: none !important; }
        }
      `}</style>

      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 60% 45% at 62% 8%, rgba(79,168,216,0.16), transparent 70%)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 45% 40% at 12% 88%, rgba(217,182,120,0.07), transparent 70%)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)",
            backgroundSize: "64px 64px",
          }}
        />
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)" }}
        />
      </div>

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-7 px-5 py-9 sm:px-8 sm:py-11 lg:grid-cols-[minmax(0,0.86fr)_minmax(0,1.14fr)] lg:gap-12">
        {/* story column */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.5 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div className="flex items-center gap-2.5">
              <span className="h-px w-7" style={{ background: `linear-gradient(90deg, ${ICE}, transparent)` }} />
              <span className="text-[10px] font-bold tracking-[0.3em] text-slate-400 uppercase">How it works</span>
            </div>
            <h2 className="mt-3 text-[clamp(1.25rem,2.4vw,1.9rem)] leading-[1.08] font-black tracking-tight text-white uppercase">
              Order medicines,{" "}
              <span
                style={{
                  background: "linear-gradient(96deg, #FFFFFF 12%, #8FD8FF 62%, #D9B678 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                track to your doorstep
              </span>
            </h2>
          </motion.div>

          <ol className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-1">
            {SCENES.map((scene, i) => {
              const Icon = scene.icon;
              const isActive = i === active;
              return (
                <li key={scene.id}>
                  <button
                    type="button"
                    onClick={() => goToScene(i)}
                    aria-current={isActive ? "step" : undefined}
                    aria-label={`Step ${i + 1}: ${scene.label}`}
                    className={cn(
                      "group flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-all duration-300 sm:px-3",
                      isActive
                        ? "border-[#8FD8FF]/25 bg-[#8FD8FF]/[0.06]"
                        : "border-white/[0.06] hover:border-white/15 hover:bg-white/[0.03]",
                    )}
                  >
                    <span
                      className="w-5 shrink-0 text-[10px] font-bold tabular-nums"
                      style={{ color: isActive ? BRASS : "rgba(148,163,184,0.45)" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Icon
                      className="h-3.5 w-3.5 shrink-0"
                      style={{ color: isActive ? ICE : "rgba(148,163,184,0.6)" }}
                      aria-hidden="true"
                    />
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate text-[12px] font-semibold transition-colors",
                        isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200",
                      )}
                    >
                      {scene.label}
                    </span>
                    {isActive && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: ICE }} aria-hidden="true" />
                    )}
                  </button>
                </li>
              );
            })}
          </ol>

          <p className="mt-3.5 hidden items-center gap-2 text-[11px] text-slate-500 sm:flex">
            <Truck className="h-3.5 w-3.5" style={{ color: ICE }} aria-hidden="true" />
            Scroll to play the journey — or tap a step to jump to it.
          </p>
        </div>

        {/* 3D stage */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="mx-auto w-full max-w-[660px]"
        >
          <div
            className="rounded-[23px] p-px"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.03))" }}
          >
            <div className="h-[200px] w-full sm:h-[240px] lg:h-[310px]">
              <JourneyStage p={p} active={active} reduce={reduce} />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
