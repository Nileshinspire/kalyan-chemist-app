import { memo, useCallback, useEffect, useRef, useState } from "react";
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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   KALYAN CHEMIST — "HOW IT WORKS" · CONTINUOUS 3D ORDER FILM
   ---------------------------------------------------------------------------
   Two strictly separated layers keep this smooth AND sharp:

   · FILM  — the 3D half: camera, lights, route and shape-only objects
             (blister strip, cart, parcel). Scaled/rotated freely, because
             it contains no readable text, so nothing can blur.
   · HUD   — the readable half: step chrome, scene copy, the order /
             verification panel and the step rail. Rendered at 1:1 device
             pixels with no scaling, no perspective and no blur — only
             opacity / small translate, so text stays pixel-crisp.

   Performance contract:
   · one scroll-driven spring for the entire sequence (scrub, never snap),
     with a fast spring so scroll response is immediate,
   · transforms + opacity only; no layout properties, no filters, no
     backdrop-blur inside the film,
   · the stage is memoised and receives no changing props, so scrolling
     never re-renders it (only the small chrome + rail re-render, 6 times
     across the whole journey),
   · off-scene objects are set to `visibility: hidden` so they stop being
     composited at all,
   · `will-change` is limited to the five elements that actually move.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── premium dark medical-tech palette: ink · ice · brass ── */
const ICE = "#8FD8FF";
const ICE_DEEP = "#4FA8D8";
const BRASS = "#D9B678";
const GLASS = "rgba(9,14,20,0.9)";
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface Scene {
  id: string;
  chip: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}

const SCENES: Scene[] = [
  { id: "select", chip: "Select", label: "Select medicine", hint: "Search for the medicine or device you need.", icon: Search },
  { id: "cart", chip: "Cart", label: "Add to cart", hint: "Your selection drops into the cart.", icon: ShoppingCart },
  { id: "order", chip: "Order", label: "Place order", hint: "Address, prescription and payment confirmed.", icon: ClipboardCheck },
  { id: "processing", chip: "Processing", label: "Order processing", hint: "Our pharmacist verifies dosage and batch.", icon: FlaskConical },
  { id: "packed", chip: "Packed", label: "Packed & dispatched", hint: "Sealed, labelled and out for delivery.", icon: Package },
  { id: "delivered", chip: "Delivered", label: "Delivered", hint: "Handed over at your doorstep.", icon: Home },
];

/* Scroll progress where each scene takes over the story */
const SCENE_AT = [0.24, 0.4, 0.52, 0.66, 0.86];
const SCENE_PROGRESS_IN = [0, ...SCENE_AT, 0.98];
const SCENE_PROGRESS_OUT = [0, 1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1];

function usePath(p: MotionValue<number>, input: number[], output: number[]) {
  return useTransform(p, input, output);
}
/* discrete visibility gate so off-scene objects are not composited */
function useGate(p: MotionValue<number>, from: number, to: number) {
  return useTransform(p, (v) => (v >= from && v <= to ? "visible" : "hidden"));
}

/* ═══════════════════════ FILM OBJECTS (shape only · no text) ═══════════════════════ */

/* Platinum blister strip — the product that starts the story */
function MedicineStrip() {
  return (
    <div className="relative" style={{ width: 120, height: 54 }}>
      <div
        className="absolute inset-0 rounded-lg"
        style={{
          background: "linear-gradient(142deg,#F4F8FD 0%,#CBD6E4 42%,#93A1B2 100%)",
          boxShadow: "0 14px 22px -14px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.9)",
        }}
      />
      <div
        className="absolute inset-x-1 top-0 h-1/2 rounded-t-lg"
        style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.8), rgba(255,255,255,0))" }}
      />
      <div className="absolute inset-0 flex items-center gap-1.5 px-2.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-6 w-4 shrink rounded ring-1 ring-slate-400/40"
            style={{ background: "radial-gradient(circle at 34% 26%, #FFFFFF, rgba(255,255,255,0.2))" }}
          />
        ))}
        <span
          className="h-4 w-7 shrink-0 rounded-full ring-1 ring-white/40"
          style={{ background: `linear-gradient(120deg, ${ICE}, ${ICE_DEEP})` }}
        />
      </div>
    </div>
  );
}

/* Glass cart the product drops into (slot bars read the count, no tiny text) */
function CartObject() {
  return (
    <div className="relative" style={{ width: 104, height: 94 }}>
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/20 to-white/[0.04] p-px">
        <div className="h-full w-full rounded-[15px]" style={{ background: GLASS }} />
      </div>
      <div
        className="absolute inset-px rounded-[15px]"
        style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.08), rgba(255,255,255,0))" }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <ShoppingCart className="h-6 w-6" style={{ color: ICE }} aria-hidden="true" />
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-4 rounded-full"
              style={{ background: i < 2 ? "rgba(143,216,255,0.75)" : "rgba(255,255,255,0.12)" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* Parcel the order wraps into — pure geometry, no text, no filters */
function ParcelObject({ p }: { p: MotionValue<number> }) {
  const badgeOpacity = usePath(p, [0.9, 0.99], [0, 1]);
  const badgeScale = usePath(p, [0.9, 1], [0.4, 1]);
  const lidRotate = usePath(p, [0.93, 1], [0, -24]);

  return (
    <div className="relative" style={{ width: 104, height: 92, transformStyle: "preserve-3d" }}>
      <svg viewBox="0 0 104 92" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="hiw-parcel-side" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1C2836" />
            <stop offset="1" stopColor="#0C131B" />
          </linearGradient>
        </defs>
        <polygon points="6,26 52,47 52,90 6,69" fill="url(#hiw-parcel-side)" />
        <polygon points="98,26 52,47 52,90 98,69" fill="#070C12" />
        <polygon points="6,26 26,35 26,78 6,69" fill={BRASS} opacity="0.8" />
        <circle cx="72" cy="64" r="10" fill="none" stroke={BRASS} strokeWidth="1.4" opacity="0.75" />
        <circle cx="72" cy="64" r="3" fill={BRASS} opacity="0.7" />
      </svg>

      {/* lid lifts slightly once delivered */}
      <motion.div
        style={{ rotateX: lidRotate, transformPerspective: 700, transformOrigin: "50% 100%" }}
        className="absolute top-0 left-0 h-[49px] w-full"
      >
        <svg viewBox="0 0 104 49" className="h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="hiw-parcel-top" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#EAF1F8" />
              <stop offset="1" stopColor="#95A5B8" />
            </linearGradient>
          </defs>
          <polygon points="52,3 98,24 52,45 6,24" fill="url(#hiw-parcel-top)" />
          <polygon points="6,24 52,45 52,49 6,28" fill="#6C7C90" />
        </svg>
      </motion.div>

      {/* delivered badge — final beat */}
      <motion.div
        style={{ opacity: badgeOpacity, scale: badgeScale }}
        className="absolute -top-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full"
      >
        <span
          className="absolute inset-0 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(143,216,255,0.4), transparent 70%)" }}
        />
        <span
          className="relative flex h-7 w-7 items-center justify-center rounded-full"
          style={{ background: ICE, boxShadow: "0 8px 16px -8px rgba(143,216,255,0.9)" }}
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
    <div className="relative flex h-10 w-10 items-center justify-center">
      <span
        className="absolute -inset-2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(143,216,255,0.22), transparent 70%)" }}
        aria-hidden="true"
      />
      <span className="relative flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-b from-white/22 to-white/[0.05] p-px">
        <span className="flex h-full w-full items-center justify-center rounded-[15px]" style={{ background: GLASS }}>
          <Home className="h-4 w-4" style={{ color: ICE }} aria-hidden="true" />
        </span>
      </span>
    </div>
  );
}

/* ═══════════════════════ FILM (memoised · never re-renders while scrolling) ═══════════════════════ */

const Film = memo(function Film({ p, reduce }: { p: MotionValue<number>; reduce: boolean }) {
  /* camera: one continuous drift across the whole sequence */
  const camRotX = usePath(p, [0, 0.55, 1], reduce ? [0, 0, 0] : [7, 2, 0]);
  const camRotY = usePath(p, [0, 0.35, 0.7, 1], reduce ? [0, 0, 0, 0] : [11, 3, -2.5, 0]);
  const camScale = usePath(p, [0, 0.5, 1], reduce ? [1, 1, 1] : [0.96, 0.99, 1]);
  const camX = usePath(p, [0, 0.3, 0.6, 1], reduce ? [0, 0, 0, 0] : [-10, -3, 7, 3]);
  const camY = usePath(p, [0, 1], reduce ? [0, 0] : [10, -8]);

  /* key light follows the action */
  const glowX = usePath(p, [0, 0.35, 0.7, 1], [-90, -16, 70, 96]);
  const glowOpacity = usePath(p, [0, 0.4, 0.8, 1], [0.45, 0.75, 0.55, 0.85]);

  /* product → drops into the cart */
  const prodX = usePath(p, [0.02, 0.3], [0, 88]);
  const prodY = usePath(p, [0.02, 0.3], [-28, 20]);
  const prodScale = usePath(p, [0.02, 0.3], [1, 0.52]);
  const prodRotZ = usePath(p, [0, 0.3], [-5, 12]);
  const prodRotY = usePath(p, [0, 0.3], [10, -30]);
  const prodOpacity = usePath(p, [0, 0.24, 0.36], [1, 1, 0]);
  const prodVisible = useGate(p, 0, 0.42);

  /* cart → receives, then tips the order out */
  const cartX = usePath(p, [0.08, 0.26, 0.38, 0.48], [108, 92, 110, 138]);
  const cartY = usePath(p, [0.08, 0.26, 0.38, 0.48], [78, 10, 14, 70]);
  const cartScale = usePath(p, [0.08, 0.26, 0.38, 0.48], [0.74, 1, 1, 0.72]);
  const cartRotX = usePath(p, [0.08, 0.26, 0.38, 0.48], [14, 0, -7, -22]);
  const cartRotY = usePath(p, [0.08, 0.26, 0.48], [-18, 0, 14]);
  const cartOpacity = usePath(p, [0.08, 0.2, 0.38, 0.48], [0, 1, 1, 0]);
  const cartVisible = useGate(p, 0.05, 0.52);

  /* parcel → wraps the order, travels right, arrives */
  const parcX = usePath(p, [0.68, 0.78, 0.94, 1], [0, 0, 150, 150]);
  const parcY = usePath(p, [0.68, 0.78, 0.88, 1], [14, 6, -18, -10]);
  const parcScale = usePath(p, [0.68, 0.78, 0.9, 1], [0.42, 1, 0.94, 0.9]);
  const parcRotY = usePath(p, [0.68, 0.78, 0.94, 1], [24, 0, 180, 180]);
  const parcRotZ = usePath(p, [0.68, 0.78, 0.94, 1], [0, 0, -3, -2]);
  const parcOpacity = usePath(p, [0.68, 0.76], [0, 1]);
  const parcVisible = useGate(p, 0.64, 1.1);

  /* route + doorstep */
  const routeScale = usePath(p, [0.6, 0.94], [0, 1]);
  const routeOpacity = usePath(p, [0.58, 0.66], [0, 0.9]);
  const doorOpacity = usePath(p, [0.62, 0.74], [0, 1]);
  const doorScale = usePath(p, [0.62, 0.76], [0.85, 1]);

  return (
    <div className="absolute inset-0 z-10" style={{ perspective: "1100px" }}>
      {/* one static responsive fit — identical choreography on every screen */}
      <div
        className="absolute top-1/2 left-1/2 h-[230px] w-[600px] -translate-x-1/2 -translate-y-1/2 scale-[0.48] min-[400px]:scale-[0.56] sm:scale-[0.62] md:scale-[0.7] lg:scale-[0.78] xl:scale-[0.84]"
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
            willChange: "transform",
          }}
          className="relative h-full w-full"
        >
          {/* key light — opacity/translate only, breathing handled by CSS on the child */}
          <motion.div
            style={{ x: glowX, opacity: glowOpacity, z: -60 }}
            className="absolute top-1/2 left-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2"
            aria-hidden="true"
          >
            <div
              className="hiw-breathe h-full w-full rounded-full"
              style={{ background: "radial-gradient(circle, rgba(143,216,255,0.18), transparent 68%)" }}
            />
          </motion.div>

          {/* floor hairline — static depth anchor */}
          <div
            className="absolute bottom-8 left-1/2 h-px w-[440px] -translate-x-1/2"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)" }}
            aria-hidden="true"
          />

          {/* delivery route */}
          <motion.div
            style={{ opacity: routeOpacity, z: -20, y: 58 }}
            className="absolute top-1/2 left-1/2 h-5 w-[250px]"
            aria-hidden="true"
          >
            <div className="absolute top-1/2 right-0 left-0 h-0.5 -translate-y-1/2 rounded-full bg-white/[0.09]" />
            <motion.div
              style={{ scaleX: routeScale, background: `linear-gradient(90deg, rgba(143,216,255,0), ${ICE})` }}
              className="absolute top-1/2 right-0 left-0 h-0.5 origin-left -translate-y-1/2 rounded-full"
            />
            <div className="absolute top-0 right-0 left-0 flex justify-between">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span key={i} className="h-1 w-1 rounded-full bg-white/15" />
              ))}
            </div>
          </motion.div>

          {/* doorstep */}
          <motion.div
            style={{ opacity: doorOpacity, scale: doorScale, x: 252, y: 28, z: 0 }}
            className="absolute top-1/2 left-1/2 -mt-[20px] -ml-[20px]"
          >
            <DoorstepMarker />
          </motion.div>

          {/* cart */}
          <motion.div
            style={{
              visibility: cartVisible,
              opacity: cartOpacity,
              x: cartX,
              y: cartY,
              scale: cartScale,
              rotateX: cartRotX,
              rotateY: cartRotY,
              z: 20,
              willChange: "transform, opacity",
            }}
            className="absolute top-1/2 left-1/2 -mt-[47px] -ml-[52px]"
          >
            <CartObject />
          </motion.div>

          {/* product */}
          <motion.div
            style={{
              visibility: prodVisible,
              opacity: prodOpacity,
              x: prodX,
              y: prodY,
              scale: prodScale,
              rotateZ: prodRotZ,
              rotateY: prodRotY,
              z: 40,
              willChange: "transform, opacity",
            }}
            className="absolute top-1/2 left-1/2 -mt-[27px] -ml-[60px]"
          >
            <MedicineStrip />
          </motion.div>

          {/* parcel */}
          <motion.div
            style={{
              visibility: parcVisible,
              opacity: parcOpacity,
              x: parcX,
              y: parcY,
              scale: parcScale,
              rotateY: parcRotY,
              rotateZ: parcRotZ,
              z: 30,
              willChange: "transform, opacity",
            }}
            className="absolute top-1/2 left-1/2 -mt-[46px] -ml-[52px]"
          >
            <ParcelObject p={p} />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
});

/* ═══════════════════ HUD: ORDER / VERIFICATION PANEL (crisp, 1:1, no 3D) ═══════════════════ */

const ORDER_ROWS = [
  { label: "Paracetamol 500mg ×2", value: "₹64" },
  { label: "Vitamin D3 60K ×1", value: "₹118" },
  { label: "Prescription attached", value: "Rx" },
];

const OrderPanel = memo(function OrderPanel({ p }: { p: MotionValue<number> }) {
  const x = usePath(p, [0.34, 0.5], [92, 0]);
  const y = usePath(p, [0.34, 0.5, 0.7], [10, 0, 8]);
  const scale = usePath(p, [0.34, 0.5, 0.7], [0.97, 1, 0.9]);
  const opacity = usePath(p, [0.32, 0.44, 0.68, 0.76], [0, 1, 1, 0]);
  const visible = useGate(p, 0.3, 0.8);

  const placedOpacity = usePath(p, [0.5, 0.56], [1, 0]);
  const verifyOpacity = usePath(p, [0.54, 0.6], [0, 1]);
  const fillA = usePath(p, [0.51, 0.56], [0, 1]);
  const fillB = usePath(p, [0.58, 0.63], [0, 1]);
  const fillC = usePath(p, [0.65, 0.7], [0, 1]);
  const fills = [fillA, fillB, fillC];

  return (
    <motion.div
      style={{ visibility: visible, opacity, x, y, scale, willChange: "transform, opacity" }}
      className="absolute top-[53%] left-1/2 z-20 w-[256px] -translate-x-1/2 -translate-y-1/2 sm:top-1/2 sm:w-[292px]"
    >
      <div className="rounded-2xl bg-gradient-to-b from-white/[0.18] to-white/[0.04] p-px">
        <div className="relative overflow-hidden rounded-[15px]" style={{ background: GLASS }}>
          <div
            className="absolute inset-x-0 top-0 h-16"
            style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.07), rgba(255,255,255,0))" }}
            aria-hidden="true"
          />
          <span className="absolute top-3 bottom-3 left-0 w-[3px] rounded-r-full" style={{ background: ICE }} />

          <div className="relative px-3.5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9.5px] font-bold tracking-[0.18em] text-slate-400 uppercase">
                Order #KC-8241
              </span>
              <span className="relative h-4 w-[74px]">
                <motion.span
                  style={{ opacity: placedOpacity }}
                  className="absolute inset-0 text-right text-[10px] font-bold tracking-[0.12em] uppercase"
                >
                  <span style={{ color: BRASS }}>Placed</span>
                </motion.span>
                <motion.span
                  style={{ opacity: verifyOpacity }}
                  className="absolute inset-0 text-right text-[10px] font-bold tracking-[0.12em] uppercase"
                >
                  <span style={{ color: ICE }}>Verifying</span>
                </motion.span>
              </span>
            </div>

            <div className="mt-2 space-y-1">
              {ORDER_ROWS.map((row, i) => (
                <div key={row.label} className="flex items-center gap-2.5">
                  <span className="relative flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1 ring-white/15">
                    <motion.span
                      style={{ opacity: fills[i], scale: fills[i], background: ICE }}
                      className="absolute inset-0 flex items-center justify-center rounded-full"
                    >
                      <Check className="h-2.5 w-2.5" style={{ color: "#062430" }} aria-hidden="true" />
                    </motion.span>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-200">{row.label}</span>
                  <span className="shrink-0 text-[11px] font-bold text-white">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-1.5">
              <span className="text-[10px] font-semibold tracking-[0.16em] text-slate-400 uppercase">Total paid</span>
              <span className="text-[13.5px] font-extrabold" style={{ color: BRASS }}>
                ₹182
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

/* ═══════════════════════ STAGE CHROME (crisp) ═══════════════════════ */

const StageChrome = memo(function StageChrome({ p, active }: { p: MotionValue<number>; active: number }) {
  const bar = useTransform(p, SCENE_PROGRESS_IN, SCENE_PROGRESS_OUT);
  const scene = SCENES[active];
  const ActiveIcon = scene.icon;

  return (
    <>
      {/* top row */}
      <div className="absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 px-3.5 pt-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-[0.2em] tabular-nums" style={{ color: BRASS }}>
              {String(active + 1).padStart(2, "0")}
              <span className="text-white/25">/{String(SCENES.length).padStart(2, "0")}</span>
            </span>
            <span className="h-3.5 w-px bg-white/15" aria-hidden="true" />
            <ActiveIcon className="h-3.5 w-3.5 shrink-0" style={{ color: ICE }} aria-hidden="true" />
            <span className="truncate text-[11.5px] font-semibold tracking-[0.1em] text-white uppercase">
              {scene.label}
            </span>
          </div>
          <p className="mt-0.5 hidden max-w-[19rem] text-[10.5px] leading-snug text-slate-400 sm:block">{scene.hint}</p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1">
          <ShieldCheck className="h-3 w-3" style={{ color: ICE }} aria-hidden="true" />
          <span className="text-[8.5px] font-bold tracking-[0.2em] text-slate-300 uppercase">Kalyan Chemist</span>
        </span>
      </div>

      {/* scroll progress */}
      <div className="absolute inset-x-0 bottom-0 z-30 h-0.5 bg-white/[0.07]">
        <motion.div
          style={{ scaleX: bar, background: `linear-gradient(90deg, ${ICE_DEEP}, ${ICE})` }}
          className="h-full origin-left"
        />
      </div>
    </>
  );
});

/* ═══════════════════════════ SECTION ═══════════════════════════ */

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);

  /* ambient CSS breathing exists only while the section is on screen */
  const inView = useInView(sectionRef, { margin: "200px 0px 200px 0px" });

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start 0.86", "end 0.46"] });
  /* fast spring: immediate scroll response, still fully interpolated */
  const p = useSpring(scrollYProgress, { stiffness: 170, damping: 30, mass: 0.35 });

  useMotionValueEvent(p, "change", (v) => {
    let idx = 0;
    for (let i = 0; i < SCENE_AT.length; i++) if (v >= SCENE_AT[i]) idx = i + 1;
    setActive((prev) => (prev === idx ? prev : idx));
  });

  /* keep the active chip centred in the (scrollable) step rail */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const chip = rail.querySelector<HTMLElement>(`[data-chip="${active}"]`);
    if (!chip) return;
    rail.scrollTo({ left: chip.offsetLeft - (rail.clientWidth - chip.clientWidth) / 2, behavior: "smooth" });
  }, [active]);

  /* jump the page to the scroll position where a scene is parked */
  const goToScene = useCallback((index: number) => {
    const el = sectionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const travel = vh * 0.4 + rect.height;
    const target = index === 0 ? 0 : SCENE_AT[index - 1];
    window.scrollTo({ top: window.scrollY + rect.top - (vh * 0.86 - travel * target), behavior: "smooth" });
  }, []);

  return (
    <section
      ref={sectionRef}
      className={cn("relative isolate overflow-hidden", inView && "hiw-live")}
      style={{ background: "linear-gradient(180deg, #04070B 0%, #070C13 55%, #04070B 100%)" }}
    >
      <style>{`
        @keyframes hiw-breathe { 0%,100%{opacity:.72} 50%{opacity:1} }
        /* the only looping animation, and it only exists while on screen */
        .hiw-live .hiw-breathe { animation: hiw-breathe 6.5s ease-in-out infinite; }
        .hiw-rail { scrollbar-width: none; -ms-overflow-style: none; }
        .hiw-rail::-webkit-scrollbar { display: none; }
        @media (prefers-reduced-motion: reduce) {
          .hiw-live .hiw-breathe { animation: none !important; }
        }
      `}</style>

      {/* ambient background (static gradients only) */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 55% 70% at 66% 0%, rgba(79,168,216,0.16), transparent 72%)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 40% 60% at 8% 100%, rgba(217,182,120,0.07), transparent 72%)" }}
        />
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)" }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-px"
          style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)" }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-5 sm:px-8 sm:py-6">
        {/* ── compact header ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
        >
          <div>
            <div className="flex items-center gap-2.5">
              <span className="h-px w-6" style={{ background: `linear-gradient(90deg, ${ICE}, transparent)` }} />
              <span className="text-[10px] font-bold tracking-[0.28em] text-slate-400 uppercase">How it works</span>
            </div>
            <h2 className="mt-1 text-[clamp(1.05rem,1.9vw,1.45rem)] leading-tight font-black tracking-tight text-white uppercase">
              Order medicines,{" "}
              <span
                style={{
                  background: "linear-gradient(96deg, #FFFFFF 10%, #8FD8FF 60%, #D9B678 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                track to your doorstep
              </span>
            </h2>
          </div>
          <p className="hidden max-w-xs text-[11.5px] leading-snug text-slate-400 sm:block sm:text-right">
            One continuous journey — scroll to play it, or tap any step below.
          </p>
        </motion.div>

        {/* ── stage ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mt-2.5 sm:mt-3"
        >
          <div
            className="mx-auto max-w-[680px] rounded-[20px] p-px"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.03))" }}
          >
            <div
              className="relative h-[150px] w-full overflow-hidden rounded-[19px] sm:h-[168px] md:h-[182px] lg:h-[196px]"
              style={{ background: "radial-gradient(ellipse 70% 90% at 50% 0%, #0B131C 0%, #060A0F 70%)" }}
            >
              <Film p={p} reduce={reduce} />
              <OrderPanel p={p} />
              <StageChrome p={p} active={active} />
            </div>
          </div>
        </motion.div>

        {/* ── step indicator 01 → 06 ── */}
        <div
          ref={railRef}
          className="hiw-rail -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:mt-2.5 sm:justify-center sm:px-0"
        >
          {SCENES.map((scene, i) => {
            const isActive = i === active;
            return (
              <button
                key={scene.id}
                type="button"
                data-chip={i}
                onClick={() => goToScene(i)}
                aria-current={isActive ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${scene.label}`}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors duration-300",
                  isActive
                    ? "border-[#8FD8FF]/30 bg-[#8FD8FF]/[0.08] text-white"
                    : "border-white/[0.07] text-slate-400 hover:border-white/15 hover:text-slate-200",
                )}
              >
                <span className="text-[9.5px] font-bold tabular-nums" style={{ color: isActive ? BRASS : "rgba(148,163,184,0.7)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {scene.chip}
                {isActive && <span className="h-1.5 w-1.5 rounded-full" style={{ background: ICE }} aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
