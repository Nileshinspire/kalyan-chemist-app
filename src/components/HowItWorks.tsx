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
  Home,
  Package,
  Pill,
  Search,
  ShoppingCart,
  Stethoscope,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   KALYAN CHEMIST — "HOW IT WORKS" · ONE CONTINUOUS 3D ORDER FILM
   ---------------------------------------------------------------------------
   The story, told with a single object chain:
   medicine box → into the cart → cart becomes the order → order wraps into
   the parcel → parcel rides the van to the doorstep → delivered.

   Two layers keep it smooth AND sharp:

   · FILM  — the 3D half: camera, key light, route, and shape-only objects
             (medicine box, cart, order slip, parcel + van, doorstep).
             No readable text lives here, so scaling/rotating can never blur.
   · HUD   — the readable half: step label, explanation, product cards and the
             per-step status chip, all at 1:1 device pixels (opacity +
             small translate only, never scaled, never tilted).

   Performance contract:
   · ONE scroll-driven spring for the whole sequence; a fast spring, so the
     scroll response is immediate while every value stays interpolated,
   · no nested 3D context and no per-object z — one tilted camera plane plus
     cheap per-object perspective, so the compositor never has to 3D-sort,
   · transforms + opacity only; no layout props, no filters, no backdrop
     blur, few and small shadows,
   · the film and HUD are memoised and receive only the stable MotionValue,
     so scrolling never re-renders them (5 tiny re-renders across the whole
     journey, for the label and status only),
   · off-scene objects are switched to `visibility: hidden`,
   · `will-change` on the five elements that actually move.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── premium green pharmacy palette ── */
const INK = "#03130D";
const GLASS = "rgba(6,25,18,0.9)";
const GREEN = "#1FA463";
const GREEN_BRIGHT = "#2FBF76";
const GREEN_DEEP = "#0C4A32";
const MINT = "#8FE3B8";
const MINT_SOFT = "#DFF7EA";
const TEXT_DIM = "#9DC7B4";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface Scene {
  id: string;
  chip: string;
  label: string;
  hint: string;
  status: string;
  detail: string;
  icon: LucideIcon;
}

const SCENES: Scene[] = [
  {
    id: "choose",
    chip: "Choose",
    label: "Choose Medicine",
    hint: "Pick the medicine or device you need.",
    status: "",
    detail: "",
    icon: Search,
  },
  {
    id: "cart",
    chip: "Cart",
    label: "Add to Cart",
    hint: "Your medicine drops straight into the cart.",
    status: "Added to your cart",
    detail: "2 items · ₹182",
    icon: ShoppingCart,
  },
  {
    id: "order",
    chip: "Order",
    label: "Place Your Order",
    hint: "Address, prescription and payment confirmed.",
    status: "Order Confirmed",
    detail: "#KC-8241 · ₹182",
    icon: ClipboardCheck,
  },
  {
    id: "packed",
    chip: "Packed",
    label: "Order Being Packed",
    hint: "Our pharmacist checks and packs your medicine.",
    status: "Order Being Packed",
    detail: "Pharmacist verified",
    icon: Package,
  },
  {
    id: "delivery",
    chip: "Delivery",
    label: "Out for Delivery",
    hint: "Your parcel is on the way to your door.",
    status: "Out for Delivery",
    detail: "Arriving in 12 min",
    icon: Truck,
  },
  {
    id: "delivered",
    chip: "Delivered",
    label: "Delivered Successfully",
    hint: "Handed over at your doorstep.",
    status: "Delivered Successfully",
    detail: "Thank you for choosing us",
    icon: Home,
  },
];

/* Progress where each scene takes over the story */
const SCENE_AT = [0.24, 0.4, 0.52, 0.66, 0.86];

const PRODUCTS = [
  { name: "Paracetamol 500mg", pack: "Strip of 15", price: "₹32", icon: Pill },
  { name: "Vitamin D3 60K", pack: "4 capsules", price: "₹118", icon: Pill },
  { name: "Digital BP Monitor", pack: "1 unit", price: "₹1,899", icon: Stethoscope },
];

function usePath(p: MotionValue<number>, input: number[], output: number[]) {
  return useTransform(p, input, output);
}

/* ═════════════════ FILM OBJECTS (geometry only · no text) ═════════════════ */

/* Medicine box — the product the whole story follows */
function MedicineBox() {
  return (
    <div className="relative" style={{ width: 76, height: 66 }}>
      <svg viewBox="0 0 76 66" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="hiw-med-top" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#CBE9DA" />
          </linearGradient>
          <linearGradient id="hiw-med-left" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#12684A" />
            <stop offset="1" stopColor="#093A28" />
          </linearGradient>
        </defs>
        <polygon points="38,3 73,21 38,39 3,21" fill="url(#hiw-med-top)" />
        <polygon points="3,21 38,39 38,63 3,45" fill="url(#hiw-med-left)" />
        <polygon points="73,21 38,39 38,63 73,45" fill="#062A1D" />
        <polygon points="38,3 44,6 9,24 3,21" fill="#FFFFFF" opacity="0.55" />
      </svg>
      {/* pharmacy cross badge — instant "medicine" read, vector only */}
      <span
        className="absolute top-1/2 left-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md"
        style={{ background: GREEN, boxShadow: `0 6px 12px -6px ${GREEN}` }}
      >
        <span className="h-3 w-[3px] rounded-full bg-white" />
        <span className="absolute h-[3px] w-3 rounded-full bg-white" />
      </span>
    </div>
  );
}

/* Cart the medicine drops into */
function CartObject() {
  return (
    <div className="relative" style={{ width: 92, height: 84 }}>
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.18] to-white/[0.04] p-px">
        <div className="h-full w-full rounded-[15px]" style={{ background: GLASS }} />
      </div>
      <div
        className="absolute inset-px rounded-[15px]"
        style={{ background: "linear-gradient(to bottom, rgba(255,255,255,0.07), rgba(255,255,255,0))" }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <ShoppingCart className="h-6 w-6" style={{ color: MINT }} aria-hidden="true" />
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-4 rounded-full"
              style={{ background: i < 2 ? "rgba(143,227,184,0.8)" : "rgba(255,255,255,0.14)" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* Order slip — the cart becomes this, then wraps into the parcel */
function OrderSlip() {
  return (
    <div className="relative" style={{ width: 132, height: 92 }}>
      <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/[0.22] to-white/[0.05] p-px">
        <div className="h-full w-full rounded-[11px]" style={{ background: GLASS }} />
      </div>
      <span className="absolute top-3 bottom-3 left-0 w-[3px] rounded-r-full" style={{ background: GREEN_BRIGHT }} />
      <div className="absolute inset-0 flex flex-col justify-center gap-2 px-4">
        <span className="h-1.5 w-3/5 rounded-full" style={{ background: "rgba(223,247,234,0.8)" }} />
        <span className="h-1.5 w-4/5 rounded-full" style={{ background: "rgba(223,247,234,0.35)" }} />
        <span className="h-1.5 w-2/5 rounded-full" style={{ background: "rgba(223,247,234,0.25)" }} />
      </div>
      <span
        className="absolute -right-1.5 -bottom-1.5 flex h-6 w-6 items-center justify-center rounded-full"
        style={{ background: GREEN, boxShadow: `0 6px 12px -6px ${GREEN}` }}
      >
        <Check className="h-3.5 w-3.5" style={{ color: "#04150E" }} aria-hidden="true" />
      </span>
    </div>
  );
}

/* Parcel — the order wraps into this and rides the van to the door */
function ParcelObject({ p }: { p: MotionValue<number> }) {
  const lidRotate = usePath(p, [0.56, 0.64, 0.7, 0.95, 1], [-68, -68, 0, 0, -12]);
  const vanOpacity = usePath(p, [0.7, 0.76, 0.9, 0.95], [0, 1, 1, 0]);
  const badgeOpacity = usePath(p, [0.9, 0.99], [0, 1]);
  const badgeScale = usePath(p, [0.9, 1], [0.4, 1]);

  return (
    <div className="relative" style={{ width: 92, height: 82 }}>
      {/* delivery van rides underneath the parcel */}
      <motion.svg
        viewBox="0 0 168 62"
        style={{ opacity: vanOpacity }}
        className="absolute bottom-0 left-1/2 h-[62px] w-[168px] -translate-x-1/2"
        aria-hidden="true"
      >
        <rect x="4" y="14" width="106" height="30" rx="7" fill={GREEN_DEEP} />
        <path d="M110 22h30l16 14v8h-46z" fill="#0E5A3F" />
        <rect x="4" y="30" width="106" height="7" fill={GREEN} opacity="0.85" />
        <rect x="118" y="26" width="20" height="11" rx="2" fill="#BEEFD7" opacity="0.85" />
        <circle cx="34" cy="47" r="9" fill="#02100A" />
        <circle cx="34" cy="47" r="3.5" fill={MINT} />
        <circle cx="122" cy="47" r="9" fill="#02100A" />
        <circle cx="122" cy="47" r="3.5" fill={MINT} />
      </motion.svg>

      {/* parcel box (separate svg so the lid can open independently) */}
      <svg viewBox="0 0 92 82" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="hiw-parcel-side" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#12684A" />
            <stop offset="1" stopColor="#093A28" />
          </linearGradient>
        </defs>
        <polygon points="5,22 46,41 46,78 5,59" fill="url(#hiw-parcel-side)" />
        <polygon points="87,22 46,41 46,78 87,59" fill="#062A1D" />
        <polygon points="5,22 22,30 22,67 5,59" fill={MINT} opacity="0.65" />
        <circle cx="66" cy="58" r="8" fill="none" stroke={MINT} strokeWidth="1.4" opacity="0.7" />
        <circle cx="66" cy="58" r="2.5" fill={MINT} opacity="0.6" />
      </svg>

      {/* lid lifts while the medicine is packed, then closes */}
      <motion.div
        style={{ rotateX: lidRotate, transformPerspective: 700, transformOrigin: "50% 100%" }}
        className="absolute top-0 left-0 h-[40px] w-full"
      >
        <svg viewBox="0 0 92 40" className="h-full w-full" aria-hidden="true">
          <polygon points="46,3 87,21 46,39 5,21" fill="#EAF7F0" />
          <polygon points="5,21 46,39 46,40 5,22" fill="#7FBFA2" />
          <polygon points="46,3 53,6 12,24 5,21" fill="#FFFFFF" opacity="0.7" />
        </svg>
      </motion.div>

      {/* delivered badge */}
      <motion.div
        style={{ opacity: badgeOpacity, scale: badgeScale }}
        className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full"
        aria-hidden="true"
      >
        <span className="absolute inset-0 rounded-full" style={{ background: "rgba(47,191,118,0.35)" }} />
        <span
          className="relative flex h-7 w-7 items-center justify-center rounded-full"
          style={{ background: GREEN_BRIGHT, boxShadow: `0 8px 14px -8px ${GREEN_BRIGHT}` }}
        >
          <Check className="h-4 w-4" style={{ color: "#04150E" }} />
        </span>
      </motion.div>
    </div>
  );
}

/* Doorstep the parcel is delivered to */
function DoorstepMarker() {
  return (
    <div className="relative flex h-10 w-10 items-center justify-center">
      <span
        className="absolute -inset-2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(47,191,118,0.28), transparent 70%)" }}
        aria-hidden="true"
      />
      <span className="relative flex h-full w-full items-center justify-center rounded-2xl bg-gradient-to-b from-white/[0.22] to-white/[0.05] p-px">
        <span className="flex h-full w-full items-center justify-center rounded-[15px]" style={{ background: GLASS }}>
          <Home className="h-4 w-4" style={{ color: MINT }} aria-hidden="true" />
        </span>
      </span>
    </div>
  );
}

/* ══════════════════════════ FILM (memoised) ══════════════════════════ */

const Film = memo(function Film({ p, reduce }: { p: MotionValue<number>; reduce: boolean }) {
  /* camera: one continuous drift; rendered as a single tilted plane */
  const camRotX = usePath(p, [0, 0.55, 1], reduce ? [0, 0, 0] : [6, 2, 0]);
  const camRotY = usePath(p, [0, 0.35, 0.7, 1], reduce ? [0, 0, 0, 0] : [10, 3, -2, 0]);
  const camScale = usePath(p, [0, 0.5, 1], reduce ? [1, 1, 1] : [0.97, 0.99, 1]);
  const camX = usePath(p, [0, 0.3, 0.6, 1], reduce ? [0, 0, 0, 0] : [-8, -3, 6, 3]);

  /* key light follows the action */
  const glowX = usePath(p, [0, 0.35, 0.7, 1], [-60, -10, 50, 70]);
  const glowOpacity = usePath(p, [0, 0.5, 1], [0.5, 0.85, 0.95]);

  /* 1–2 · medicine box: chosen, then into the cart, reused when packing */
  const medX = usePath(p, [0.02, 0.3, 0.5, 0.56, 0.66], [68, 96, 0, 0, 0]);
  const medY = usePath(p, [0.02, 0.3, 0.5, 0.56, 0.66], [-8, 14, -44, -26, 10]);
  const medScale = usePath(p, [0.02, 0.3, 0.5, 0.56, 0.66], [1, 0.55, 0.9, 0.78, 0.35]);
  const medRotY = usePath(p, [0, 0.3, 0.5, 0.56, 0.66], [10, -28, 0, -8, 10]);
  const medOpacity = usePath(p, [0, 0.24, 0.34, 0.5, 0.54, 0.62, 0.68], [1, 1, 0, 0, 1, 1, 0]);
  const medVisible = useTransform(p, (v) => (v <= 0.36 || (v >= 0.48 && v <= 0.7) ? "visible" : "hidden"));

  /* 2–3 · cart: receives the box, then tips the order out */
  const cartX = usePath(p, [0.1, 0.26, 0.38, 0.48], [86, 74, 90, 116]);
  const cartY = usePath(p, [0.1, 0.26, 0.38, 0.48], [52, 4, 8, 50]);
  const cartScale = usePath(p, [0.1, 0.26, 0.38, 0.48], [0.76, 1, 1, 0.7]);
  const cartRotX = usePath(p, [0.1, 0.26, 0.38, 0.48], [12, 0, -6, -20]);
  const cartRotY = usePath(p, [0.1, 0.26, 0.48], [-16, 0, 12]);
  const cartOpacity = usePath(p, [0.1, 0.2, 0.38, 0.48], [0, 1, 1, 0]);
  const cartVisible = useTransform(p, (v) => (v >= 0.07 && v <= 0.52 ? "visible" : "hidden"));

  /* 3–4 · order slip: appears from the cart, wraps into the parcel */
  const slipX = usePath(p, [0.42, 0.54], [80, 0]);
  const slipY = usePath(p, [0.42, 0.54, 0.62, 0.68], [8, -2, -2, 6]);
  const slipScale = usePath(p, [0.42, 0.54, 0.62, 0.68], [0.6, 1, 1, 0.42]);
  const slipRotY = usePath(p, [0.42, 0.54, 0.64, 0.68], [-22, 0, 0, 20]);
  const slipOpacity = usePath(p, [0.4, 0.48, 0.62, 0.68], [0, 1, 1, 0]);
  const slipVisible = useTransform(p, (v) => (v >= 0.38 && v <= 0.72 ? "visible" : "hidden"));

  /* 4–6 · parcel: packed, loaded, delivered */
  const parcX = usePath(p, [0.7, 0.78, 0.92, 1], [0, 0, 132, 132]);
  const parcY = usePath(p, [0.58, 0.7, 0.86, 1], [8, 0, -14, -8]);
  const parcScale = usePath(p, [0.58, 0.66, 0.9, 1], [0.45, 1, 0.95, 0.92]);
  const parcRotY = usePath(p, [0.58, 0.7, 0.92, 1], [18, 0, 180, 180]);
  const parcOpacity = usePath(p, [0.58, 0.64], [0, 1]);
  const parcVisible = useTransform(p, (v) => (v >= 0.56 ? "visible" : "hidden"));

  /* route + doorstep */
  const routeScale = usePath(p, [0.62, 0.92], [0, 1]);
  const routeOpacity = usePath(p, [0.6, 0.68], [0, 0.85]);
  const doorOpacity = usePath(p, [0.6, 0.72], [0, 1]);
  const doorScale = usePath(p, [0.6, 0.74], [0.8, 1]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10">
      {/* one static responsive fit — identical choreography everywhere */}
      <div
        className="absolute top-[42%] left-1/2 h-[220px] w-[560px] -translate-x-1/2 -translate-y-1/2 scale-[0.5] min-[400px]:scale-[0.56] sm:scale-[0.64] md:scale-[0.72] lg:scale-[0.78] xl:scale-[0.82]"
        style={{ perspective: "900px" }}
      >
        <motion.div
          style={{
            rotateX: camRotX,
            rotateY: camRotY,
            scale: camScale,
            x: camX,
            willChange: "transform",
          }}
          className="relative h-full w-full"
        >
          {/* key light */}
          <motion.div
            style={{ x: glowX, opacity: glowOpacity }}
            className="absolute top-1/2 left-1/2 h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2"
            aria-hidden="true"
          >
            <div
              className="hiw-breathe h-full w-full rounded-full"
              style={{ background: "radial-gradient(circle, rgba(47,191,118,0.16), transparent 68%)" }}
            />
          </motion.div>

          {/* delivery route */}
          <motion.div
            style={{ opacity: routeOpacity, y: 50 }}
            className="absolute top-1/2 left-1/2 h-4 w-[240px]"
            aria-hidden="true"
          >
            <div className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-white/[0.08]" />
            <motion.div
              style={{ scaleX: routeScale, background: `linear-gradient(90deg, rgba(47,191,118,0), ${GREEN_BRIGHT})` }}
              className="absolute top-1/2 right-0 left-0 h-px origin-left -translate-y-1/2"
            />
          </motion.div>

          {/* doorstep */}
          <motion.div
            style={{ opacity: doorOpacity, scale: doorScale, x: 208, y: 20 }}
            className="absolute top-1/2 left-1/2 -mt-5 -ml-5"
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
              transformPerspective: 900,
              willChange: "transform, opacity",
            }}
            className="absolute top-1/2 left-1/2 -mt-[42px] -ml-[46px]"
          >
            <CartObject />
          </motion.div>

          {/* order slip */}
          <motion.div
            style={{
              visibility: slipVisible,
              opacity: slipOpacity,
              x: slipX,
              y: slipY,
              scale: slipScale,
              rotateY: slipRotY,
              transformPerspective: 900,
              willChange: "transform, opacity",
            }}
            className="absolute top-1/2 left-1/2 -mt-[46px] -ml-[66px]"
          >
            <OrderSlip />
          </motion.div>

          {/* medicine box (chosen → packed) */}
          <motion.div
            style={{
              visibility: medVisible,
              opacity: medOpacity,
              x: medX,
              y: medY,
              scale: medScale,
              rotateY: medRotY,
              transformPerspective: 900,
              willChange: "transform, opacity",
            }}
            className="absolute top-1/2 left-1/2 -mt-[33px] -ml-[38px]"
          >
            <MedicineBox />
          </motion.div>

          {/* parcel + delivery van */}
          <motion.div
            style={{
              visibility: parcVisible,
              opacity: parcOpacity,
              x: parcX,
              y: parcY,
              scale: parcScale,
              rotateY: parcRotY,
              transformPerspective: 900,
              willChange: "transform, opacity",
            }}
            className="absolute top-1/2 left-1/2 -mt-[41px] -ml-[46px]"
          >
            <ParcelObject p={p} />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
});

/* ═════════════════════ HUD · STEP CHROME (crisp) ═════════════════════ */

const StageChrome = memo(function StageChrome({ active }: { active: number }) {
  const scene = SCENES[active];
  const ActiveIcon = scene.icon;
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 px-3.5 pt-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold tracking-[0.18em] tabular-nums" style={{ color: MINT }}>
            {String(active + 1).padStart(2, "0")}
            <span className="text-white/25">/{String(SCENES.length).padStart(2, "0")}</span>
          </span>
          <span className="h-3.5 w-px bg-white/15" aria-hidden="true" />
          <ActiveIcon className="h-3.5 w-3.5 shrink-0" style={{ color: MINT }} aria-hidden="true" />
          <span className="truncate text-[12px] font-bold tracking-[0.06em] text-white uppercase">{scene.label}</span>
        </div>
        <p className="mt-0.5 hidden text-[10.5px] leading-snug sm:block" style={{ color: TEXT_DIM }}>
          {scene.hint}
        </p>
      </div>
      <span
        className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1"
        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: GREEN_BRIGHT }} aria-hidden="true" />
        <span className="text-[8.5px] font-bold tracking-[0.2em] text-white/80 uppercase">Kalyan Chemist</span>
      </span>
    </div>
  );
});

/* ═════════════════════ HUD · BOTTOM STORY STRIP (crisp) ═════════════════════ */

const HUDStrip = memo(function HUDStrip({ active }: { active: number }) {
  const scene = SCENES[active];

  if (active === 0) {
    /* step 1: real-looking medicine product cards, one being selected */
    return (
      <div key="choose" className="hiw-enter absolute inset-x-0 bottom-0 z-20 flex justify-center gap-1.5 px-3 pb-3">
        {PRODUCTS.map((product, i) => {
          const Icon = product.icon;
          const selected = i === 0;
          return (
            <div
              key={product.name}
              className={cn(
                "flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-1.5 sm:flex-none sm:basis-[168px]",
                i === 2 && "hidden min-[400px]:flex",
              )}
              style={{
                background: selected ? "rgba(31,164,99,0.16)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${selected ? "rgba(143,227,184,0.5)" : "rgba(255,255,255,0.08)"}`,
              }}
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                style={{ background: selected ? GREEN : "rgba(255,255,255,0.08)" }}
              >
                <Icon className="h-3.5 w-3.5" style={{ color: selected ? "#04150E" : MINT }} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[9.5px] font-bold text-white">{product.name}</span>
                <span className="flex items-center justify-between gap-1">
                  <span className="truncate text-[9px]" style={{ color: TEXT_DIM }}>
                    {product.pack}
                  </span>
                  <span className="shrink-0 text-[10px] font-extrabold text-white">{product.price}</span>
                </span>
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  /* steps 2–6: one status chip — the current state of the same order */
  const isPacking = scene.id === "packed";
  const isDelivered = scene.id === "delivered";
  const StatusIcon = scene.icon;
  return (
    <div key={scene.id} className="hiw-enter absolute inset-x-0 bottom-0 z-20 flex justify-center px-3 pb-3">
      <div
        className="flex items-center gap-2 rounded-full py-1.5 pr-3 pl-2"
        style={{
          background: "rgba(6,25,18,0.92)",
          border: `1px solid ${isDelivered ? "rgba(47,191,118,0.45)" : "rgba(255,255,255,0.1)"}`,
        }}
      >
        <span
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
          style={{ background: isDelivered ? GREEN_BRIGHT : "rgba(47,191,118,0.18)" }}
        >
          <StatusIcon className="h-3 w-3" style={{ color: isDelivered ? "#04150E" : MINT }} aria-hidden="true" />
        </span>
        <span className="text-[11px] font-bold tracking-[0.04em] text-white whitespace-nowrap">{scene.status}</span>
        <span className="hidden h-3 w-px bg-white/15 sm:block" aria-hidden="true" />
        <span className="hidden text-[10px] whitespace-nowrap sm:block" style={{ color: TEXT_DIM }}>
          {scene.detail}
        </span>
        {isPacking && (
          <span className="hidden h-1 w-14 overflow-hidden rounded-full bg-white/10 sm:block" aria-hidden="true">
            <span className="hiw-pack block h-full w-2/3 rounded-full" style={{ background: GREEN_BRIGHT }} />
          </span>
        )}
      </div>
    </div>
  );
});

/* ═══════════════════════════ SECTION ═══════════════════════════ */

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);

  /* the only looping animations, and only while the stage is on screen */
  const inView = useInView(sectionRef, { margin: "180px 0px 180px 0px" });

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start 0.85", "end 0.45"] });
  /* fast spring: immediate scroll response, still fully interpolated */
  const p = useSpring(scrollYProgress, { stiffness: 180, damping: 30, mass: 0.32 });

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
    window.scrollTo({ top: window.scrollY + rect.top - (vh * 0.85 - travel * target), behavior: "smooth" });
  }, []);

  return (
    <section
      ref={sectionRef}
      className={cn("relative isolate overflow-hidden", inView && "hiw-live")}
      style={{ background: "linear-gradient(180deg, #03120C 0%, #05190F 55%, #03120C 100%)" }}
    >
      <style>{`
        @keyframes hiw-breathe { 0%,100%{opacity:.7} 50%{opacity:1} }
        @keyframes hiw-enter { from{opacity:0;transform:translate3d(0,6px,0)} to{opacity:1;transform:none} }
        @keyframes hiw-pack { 0%{transform:translateX(-100%)} 100%{transform:translateX(60%)} }
        /* loops + entrances exist only while the section is on screen */
        .hiw-live .hiw-breathe { animation: hiw-breathe 6.5s ease-in-out infinite; }
        .hiw-live .hiw-pack { animation: hiw-pack 2.4s ease-in-out infinite; }
        .hiw-enter { animation: hiw-enter .32s cubic-bezier(.22,1,.36,1) both; }
        .hiw-rail { scrollbar-width: none; -ms-overflow-style: none; }
        .hiw-rail::-webkit-scrollbar { display: none; }
        @media (prefers-reduced-motion: reduce) {
          .hiw-live .hiw-breathe, .hiw-live .hiw-pack, .hiw-enter { animation: none !important; }
        }
      `}</style>

      {/* clean green ambient background (static gradients) */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 58% 70% at 62% 0%, rgba(31,164,99,0.18), transparent 72%)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 45% 55% at 6% 100%, rgba(12,74,50,0.5), transparent 72%)" }}
        />
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg,transparent,rgba(143,227,184,0.28),transparent)" }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-px"
          style={{ background: "linear-gradient(90deg,transparent,rgba(143,227,184,0.16),transparent)" }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-4 sm:px-8">
        {/* ── compact header + step indicator ── */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.45, ease: EASE }}
          className="flex flex-col gap-1"
        >
          <div>
            <div className="flex items-center gap-2">
              <span className="h-px w-6" style={{ background: `linear-gradient(90deg, ${MINT}, transparent)` }} />
              <span className="text-[10px] font-bold tracking-[0.28em] uppercase" style={{ color: MINT }}>
                How it works
              </span>
            </div>
            <h2 className="mt-1 text-[clamp(1rem,1.9vw,1.4rem)] leading-tight font-black tracking-tight text-white uppercase">
              Choose, order &amp; get it{" "}
              <span
                style={{
                  background: `linear-gradient(96deg, ${MINT_SOFT} 5%, ${MINT} 55%, ${GREEN_BRIGHT} 100%)`,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                delivered to your door
              </span>
            </h2>
          </div>
        </motion.div>

          {/* ── step indicator 01 → 06 ── */}
          <div
            ref={railRef}
            className="hiw-rail -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:shrink-0 sm:justify-end sm:px-0"
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
                  className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold whitespace-nowrap transition-colors duration-300"
                  style={{
                    background: isActive ? "rgba(31,164,99,0.16)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${isActive ? "rgba(143,227,184,0.45)" : "rgba(255,255,255,0.07)"}`,
                    color: isActive ? "#ffffff" : TEXT_DIM,
                  }}
                >
                  <span
                    className="text-[9px] font-bold tabular-nums"
                    style={{ color: isActive ? MINT : "rgba(157,199,180,0.75)" }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {scene.chip}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── stage ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.55, ease: EASE }}
          className="mt-2.5"
        >
          <div
            className="mx-auto max-w-[660px] rounded-[18px] p-px"
            style={{ background: "linear-gradient(180deg, rgba(143,227,184,0.22), rgba(255,255,255,0.03))" }}
          >
            <div
              className="relative h-[150px] w-full overflow-hidden rounded-[17px] sm:h-[168px] md:h-[180px] lg:h-[190px]"
              style={{ background: "radial-gradient(ellipse 75% 95% at 50% 0%, #0A2A1E 0%, #04150F 72%)" }}
            >
              <Film p={p} reduce={reduce} />
              <HUDStrip active={active} />
              <StageChrome active={active} />
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
