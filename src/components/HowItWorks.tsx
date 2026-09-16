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
  Home as HomeIcon,
  Package,
  Search,
  ShoppingCart,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   KALYAN CHEMIST — "HOW IT WORKS" · A 3D JOURNEY THE CAMERA TRAVELS THROUGH
   ---------------------------------------------------------------------------
   Not a tilted dashboard. This is a small 3D WORLD laid out horizontally
   along a road, and the scroll scrubs a camera that flies from station to
   station while the same order object chain travels with it:

      medicine  →  cart  →  order card  →  parcel  →  van  →  doorstep

   Six stations 420 world-px apart. The camera holds on a station, then glides
   to the next, and every hero object makes the SAME journey at the SAME time,
   so the object that matters is always on screen and the world slides past it
   (road dashes + a slow parallax skyline sell the travel).

   Two layers keep it both smooth and sharp:

   · WORLD — the 3D half: road, objects and the camera. Shape-only: there is
             no readable text in here, so depth/rotation can never blur it.
   · HUD   — the readable half: step number, label, plain-language line and the
             01→06 rail, all at 1:1 device pixels. Never scaled, never tilted
             (opacity + a 4px translate at most), so it stays crisp.

   Performance contract:
   · ONE scroll spring drives the whole film — a fast spring, so the response
     to scrolling is immediate while every value stays interpolated,
   · flat compositing: no nested 3D context, no `preserve-3d`, no z-sorting;
     per-object `transformPerspective` gives cheap depth instead,
   · transforms + opacity only (no layout props, no filters, no backdrop blur),
   · the world and HUD are memoised and only receive the stable MotionValue, so
     scrolling never re-renders them (5 tiny re-renders for the label),
   · off-station objects are switched to `visibility: hidden`,
   · `will-change` only on the elements that actually move,
   · the one looping animation (van wheels) only runs while on screen.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── premium pharmacy palette: cream + white + rich emerald + mint ── */
const CREAM = "#F7F5EE";
const EMERALD = "#0F7A4F";
const EMERALD_DEEP = "#0A5638";
const EMERALD_BRIGHT = "#18A366";
const MINT = "#CFEBDC";
const MINT_SOFT = "#EAF7F1";
const INK = "#16241E";
const INK_SOFT = "#5F7167";
const INK_FAINT = "#93A69B";
const HAIRLINE = "rgba(15,122,79,0.12)";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ── the six beats, in plain language ── */
type Scene = { chip: string; label: string; sub: string; icon: LucideIcon };

const SCENES: Scene[] = [
  { chip: "01", label: "Choose medicine", sub: "Select your medicine", icon: Search },
  { chip: "02", label: "Add to cart", sub: "Add it to your cart", icon: ShoppingCart },
  { chip: "03", label: "Place order", sub: "Confirm your order", icon: ClipboardCheck },
  { chip: "04", label: "We pack it", sub: "We prepare your medicines", icon: Package },
  { chip: "05", label: "Out for delivery", sub: "Your order is on the way", icon: Truck },
  { chip: "06", label: "Delivered", sub: "Medicines delivered to your door", icon: HomeIcon },
];

/* scroll position (0–1) at which each beat takes over from the previous one */
const SCENE_AT = [0.14, 0.32, 0.47, 0.64, 0.87];

/* ── the world: six stations, and the camera holding at each one ── */
const S1 = 0;
const S2 = 420;
const S3 = 840;
const S4 = 1260;
const S5 = 1680;
const S6 = 2100;

/* camera (and hero objects) hold on a station, then glide to the next */
const CAM_IN = [0, 0.14, 0.24, 0.32, 0.42, 0.47, 0.57, 0.64, 0.74, 0.78, 0.88, 1];
const CAM_OUT = [S1, S1, S2, S2, S3, S3, S4, S4, S5, S5, S6, S6];

/* ground geometry (px, inside the stage) */
const BASELINE = 40;
const GROUND_H = 50;
const ROAD_W = 3000;
const ROAD_X = -440;

/* ═══════════════════════════ SHAPE-ONLY 3D OBJECTS ═══════════════════════════
   Nothing in here carries text — these are the things the camera flies past.
   ══════════════════════════════════════════════════════════════════════════ */

/** soft contact shadow, so every object reads as standing on the ground */
const Bounce = memo(function Bounce({ w = 44 }: { w?: number }) {
  return (
    <span
      className="absolute left-1/2 -translate-x-1/2 rounded-full"
      style={{
        bottom: -3,
        width: w,
        height: 7,
        background: "radial-gradient(ellipse at center, rgba(12,60,40,0.20), rgba(12,60,40,0) 72%)",
      }}
      aria-hidden="true"
    />
  );
});

/** the pharmacy cross, used as a small branded detail on objects */
const Cross = memo(function Cross({ size = 20, color = "#FFFFFF", thickness = 6 }: { size?: number; color?: string; thickness?: number }) {
  return (
    <span className="relative block" style={{ width: size, height: size }} aria-hidden="true">
      <span
        className="absolute top-1/2 left-0 -translate-y-1/2 rounded-[2px]"
        style={{ width: size, height: thickness, background: color }}
      />
      <span
        className="absolute top-0 left-1/2 -translate-x-1/2 rounded-[2px]"
        style={{ width: thickness, height: size, background: color }}
      />
    </span>
  );
});

/** 01 — a medicine box with a bottle beside it */
const MedicineProduct = memo(function MedicineProduct() {
  return (
    <div className="relative" style={{ width: 70, height: 48 }}>
      <Bounce w={52} />
      {/* bottle */}
      <div className="absolute right-0 bottom-0" style={{ width: 18 }}>
        <div className="mx-auto rounded-[2px]" style={{ width: 9, height: 6, background: EMERALD_DEEP }} />
        <div
          className="relative rounded-[4px]"
          style={{
            height: 34,
            background: "linear-gradient(180deg,#FFFFFF,#EFF7F2)",
            border: `1px solid ${MINT}`,
            boxShadow: "0 6px 14px -10px rgba(12,60,40,0.45)",
          }}
        >
          <span className="absolute inset-x-[3px] top-[9px] h-[11px] rounded-[2px]" style={{ background: MINT_SOFT }} />
          <span className="absolute inset-x-[3px] top-[24px] h-[2px] rounded-full" style={{ background: MINT }} />
        </div>
      </div>
      {/* box */}
      <div
        className="absolute bottom-0 left-0 overflow-hidden rounded-[6px]"
        style={{
          width: 48,
          height: 44,
          background: "linear-gradient(158deg,#FFFFFF 0%,#F5FBF7 58%,#E6F4EC 100%)",
          border: `1px solid ${MINT}`,
          boxShadow: "0 8px 18px -12px rgba(12,60,40,0.5)",
        }}
      >
        <span
          className="absolute inset-x-0 top-0 h-[9px]"
          style={{ background: "linear-gradient(180deg, rgba(207,235,220,0.9), rgba(207,235,220,0.08))" }}
        />
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <Cross size={22} color={EMERALD} thickness={7} />
        </span>
      </div>
    </div>
  );
});

/** 02 — the cart the medicine drops into */
const CartObject = memo(function CartObject() {
  return (
    <div className="relative" style={{ width: 60, height: 50 }}>
      <Bounce w={40} />
      <svg width="60" height="50" viewBox="0 0 60 50" fill="none" aria-hidden="true">
        <path
          d="M4 3h7l6.5 26h26.5L52 10H14"
          stroke={EMERALD}
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="rgba(255,255,255,0.92)"
        />
        <path d="M20.5 10v18M31 10v18M41.5 10v18" stroke={MINT} strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="21" cy="41" r="3.6" fill={INK} />
        <circle cx="41" cy="41" r="3.6" fill={INK} />
        <circle cx="21" cy="41" r="1.4" fill="#FFFFFF" />
        <circle cx="41" cy="41" r="1.4" fill="#FFFFFF" />
      </svg>
    </div>
  );
});

/** 03 — the confirmed order that rises out of the cart */
const OrderCard = memo(function OrderCard() {
  return (
    <div
      className="relative rounded-[7px]"
      style={{
        width: 52,
        height: 60,
        background: "#FFFFFF",
        border: `1px solid ${MINT}`,
        boxShadow: "0 12px 22px -14px rgba(12,60,40,0.55)",
      }}
    >
      <span className="absolute top-[9px] left-[9px] h-[6px] w-[24px] rounded-[2px]" style={{ background: EMERALD, opacity: 0.85 }} />
      <span className="absolute top-[20px] left-[9px] h-[4px] w-[34px] rounded-[2px]" style={{ background: MINT }} />
      <span className="absolute top-[28px] left-[9px] h-[4px] w-[26px] rounded-[2px]" style={{ background: MINT_SOFT }} />
      <span className="absolute top-[36px] left-[9px] h-[4px] w-[30px] rounded-[2px]" style={{ background: MINT_SOFT }} />
      <span
        className="absolute -right-2 -bottom-2 grid h-7 w-7 place-items-center rounded-full"
        style={{ background: EMERALD, border: "2px solid #FFFFFF" }}
      >
        <Check size={14} strokeWidth={3.6} color="#FFFFFF" />
      </span>
    </div>
  );
});

/** 04 — the sealed pharmacy parcel (lid swings open while packing) */
const ParcelBox = memo(function ParcelBox({ lidRotX }: { lidRotX: MotionValue<number> }) {
  return (
    <div className="relative" style={{ width: 60, height: 52 }}>
      <Bounce w={48} />
      {/* interior, revealed while the lid is open */}
      <span className="absolute left-[3px] rounded-[3px]" style={{ bottom: 26, width: 54, height: 7, background: "#D9EDE3" }} />
      {/* body */}
      <div
        className="absolute bottom-0 left-0 overflow-hidden rounded-[6px]"
        style={{
          width: 60,
          height: 36,
          background: "linear-gradient(168deg,#FFFFFF,#EEF7F2)",
          border: `1px solid ${MINT}`,
          boxShadow: "0 10px 20px -14px rgba(12,60,40,0.55)",
        }}
      >
        <span
          className="absolute inset-y-0 left-1/2 w-[11px] -translate-x-1/2"
          style={{ background: `linear-gradient(180deg, ${EMERALD_BRIGHT}, ${EMERALD_DEEP})`, opacity: 0.9 }}
        />
        <span className="absolute top-1/2 left-[7px] -translate-y-1/2">
          <Cross size={14} color="#FFFFFF" thickness={5} />
        </span>
      </div>
      {/* lid */}
      <motion.div
        className="absolute left-0"
        style={{
          bottom: 23,
          width: 60,
          height: 22,
          rotateX: lidRotX,
          transformPerspective: 520,
          transformOrigin: "center top",
          borderRadius: "6px 6px 4px 4px",
          background: "linear-gradient(180deg,#FFFFFF,#E7F4ED)",
          border: `1px solid ${MINT}`,
        }}
      />
    </div>
  );
});

/** 04 — the strips being dropped into the parcel */
const MedicineStrips = memo(function MedicineStrips() {
  return (
    <div className="flex gap-[6px]">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="relative rounded-[3px]"
          style={{ width: 24, height: 16, background: "linear-gradient(180deg,#FFFFFF,#EAF6F0)", border: `1px solid ${MINT}` }}
        >
          <span className="absolute inset-x-[3px] top-[3px] h-[3px] rounded-[2px]" style={{ background: EMERALD_BRIGHT, opacity: 0.5 }} />
          <span className="absolute inset-x-[3px] top-[9px] h-[3px] rounded-[2px]" style={{ background: EMERALD_BRIGHT, opacity: 0.28 }} />
        </div>
      ))}
    </div>
  );
});

/** 05 — the delivery van (wheels spin only while the section is on screen) */
const DeliveryVan = memo(function DeliveryVan() {
  return (
    <div className="relative" style={{ width: 120, height: 52 }}>
      <Bounce w={96} />
      <svg width="120" height="52" viewBox="0 0 120 52" fill="none" aria-hidden="true">
        {/* cargo body */}
        <rect x="3" y="8" width="60" height="30" rx="5" fill="#FFFFFF" stroke={MINT} strokeWidth="1.6" />
        {/* cab */}
        <path d="M63 16h16l14 9v13H63z" fill="#FFFFFF" stroke={MINT} strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M67 19.5h10l7 6H67z" fill="#DCEFE4" />
        {/* emerald brand stripe */}
        <rect x="6" y="30" width="84" height="6" rx="2" fill={EMERALD} opacity="0.9" />
        {/* brand mark */}
        <g transform="translate(24 14)">
          <rect x="0" y="4" width="14" height="5" rx="1.5" fill={EMERALD} />
          <rect x="4.5" y="0" width="5" height="13" rx="1.5" fill={EMERALD} />
        </g>
        {/* wheels */}
        {[
          { x: 24, y: 40 },
          { x: 82, y: 40 },
        ].map((w) => (
          <g key={w.x} className="hiw-wheel" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
            <circle cx={w.x} cy={w.y} r="5.4" fill={INK} />
            <circle cx={w.x} cy={w.y} r="2.2" fill="#FFFFFF" />
            <rect x={w.x - 0.8} y={w.y - 4.6} width="1.6" height="9.2" fill={INK} opacity="0.5" />
          </g>
        ))}
      </svg>
    </div>
  );
});

/** 06 — where the order lands */
const CustomerHome = memo(function CustomerHome() {
  return (
    <div className="relative" style={{ width: 92, height: 74 }}>
      {/* roof */}
      <span
        className="absolute top-0 left-1/2 -translate-x-1/2"
        style={{
          width: 0,
          height: 0,
          borderLeft: "46px solid transparent",
          borderRight: "46px solid transparent",
          borderBottom: `27px solid ${EMERALD}`,
        }}
      />
      {/* walls */}
      <div
        className="absolute bottom-0 left-1/2 h-[48px] w-[74px] -translate-x-1/2 overflow-hidden rounded-[5px]"
        style={{
          background: "linear-gradient(180deg,#FFFFFF,#EEF7F2)",
          border: `1px solid ${MINT}`,
          boxShadow: "0 12px 24px -16px rgba(12,60,40,0.5)",
        }}
      >
        <span
          className="absolute top-[7px] left-[8px] h-[15px] w-[19px] rounded-[3px]"
          style={{ background: MINT_SOFT, border: `1px solid ${MINT}` }}
        />
        <span className="absolute top-[9px] right-[10px]">
          <Cross size={12} color={EMERALD} thickness={4} />
        </span>
        <span className="absolute right-[11px] bottom-0 h-[30px] w-[19px] rounded-t-[3px]" style={{ background: EMERALD_DEEP, opacity: 0.88 }} />
      </div>
      {/* doormat */}
      <span className="absolute right-[6px] bottom-[-2px] h-[6px] w-[28px] rounded-full" style={{ background: MINT }} />
      <Bounce w={78} />
    </div>
  );
});

/** the slow parallax skyline — distant soft hills and tiny pharmacy signs */
const Skyline = memo(function Skyline() {
  return (
    <svg width="2400" height="126" viewBox="0 0 2400 126" fill="none" aria-hidden="true">
      <ellipse cx="240" cy="128" rx="230" ry="54" fill="rgba(207,235,220,0.55)" />
      <ellipse cx="780" cy="134" rx="270" ry="60" fill="rgba(199,230,213,0.45)" />
      <ellipse cx="1460" cy="130" rx="250" ry="56" fill="rgba(207,235,220,0.5)" />
      <ellipse cx="2060" cy="134" rx="290" ry="62" fill="rgba(199,230,213,0.42)" />
      {[330, 940, 1560, 2180].map((x) => (
        <g key={x} opacity="0.5">
          <rect x={x - 9} y={72} width="18" height="6" rx="2" fill={EMERALD} />
          <rect x={x - 3} y={66} width="6" height="18" rx="2" fill={EMERALD} />
        </g>
      ))}
    </svg>
  );
});

/* ═══════════════════════════ THE WORLD + THE CAMERA ═════════════════════════ */

const World = memo(function World({ p, reduce }: { p: MotionValue<number>; reduce: boolean }) {
  /* the camera itself, plus a slower skyline for depth */
  const camX = useTransform(p, CAM_IN, CAM_OUT.map((v) => -v));
  const farX = useTransform(camX, (v) => v * 0.34);

  /* 01 — medicine is picked out, then travels into the cart */
  const medX = useTransform(p, [0, 0.14, 0.24, 1], [S1, S1, S2, S2]);
  const medY = useTransform(p, [0, 0.05, 0.12, 0.24, 1], [0, -9, 0, -26, -26]);
  const medScale = useTransform(p, [0, 0.05, 0.12, 0.24, 1], [0.97, 1.04, 1, 0.55, 0.55]);
  const medRotY = useTransform(p, [0, 0.14, 0.24, 1], [-13, -13, 20, 20]);
  const medOpacity = useTransform(p, [0, 0.2, 0.26, 1], [1, 1, 0, 0]);
  const medVisible = useTransform(p, (v) => (v < 0.285 ? "visible" : "hidden"));

  /* the "selected" tick that says the customer chose this medicine */
  const selOpacity = useTransform(p, [0.03, 0.09, 0.16, 0.2, 1], [0, 1, 1, 0, 0]);
  const selScale = useTransform(p, [0.03, 0.1, 0.2, 1], [0.4, 1, 1, 1]);

  /* 02 — the cart holds the item, then tips the order out */
  const cartY = useTransform(p, [0, 0.3, 0.44, 1], [0, 0, 8, 8]);
  const cartRotX = useTransform(p, [0, 0.3, 0.44, 1], [0, 0, -28, -28]);
  const cartScale = useTransform(p, [0, 0.3, 0.44, 1], [1, 1, 0.84, 0.84]);
  const cartOpacity = useTransform(p, [0, 0.44, 0.52, 1], [1, 1, 0, 0]);
  const cartVisible = useTransform(p, (v) => (v < 0.545 ? "visible" : "hidden"));

  /* 03 — the order card rises from the cart and rides to the packing station */
  const cardX = useTransform(p, [0, 0.28, 0.32, 0.42, 0.47, 0.57, 1], [S2, S2, S2, S3, S3, S4, S4]);
  const cardY = useTransform(p, [0, 0.28, 0.3, 0.38, 0.57, 1], [44, 44, 44, -8, -8, -8]);
  const cardScale = useTransform(p, [0, 0.3, 0.38, 0.52, 0.58, 1], [0.5, 0.5, 1, 1, 0.55, 0.55]);
  const cardRotY = useTransform(p, [0, 0.3, 0.38, 0.54, 0.58, 1], [-20, -20, 0, 0, 26, 26]);
  const cardOpacity = useTransform(p, [0, 0.28, 0.34, 0.54, 0.6, 1], [0, 0, 1, 1, 0, 0]);
  const cardVisible = useTransform(p, (v) => (v > 0.265 && v < 0.63 ? "visible" : "hidden"));

  /* 04 — the strips drop in, the parcel appears and the lid swings */
  const stripY = useTransform(p, [0, 0.47, 0.55, 0.63, 1], [-30, -30, -16, -4, -4]);
  const stripOpacity = useTransform(p, [0, 0.47, 0.51, 0.63, 0.67, 1], [0, 0, 1, 1, 0, 0]);
  const stripVisible = useTransform(p, (v) => (v > 0.45 && v < 0.7 ? "visible" : "hidden"));

  const boxX = useTransform(p, [0, 0.64, 0.74, 0.78, 0.88, 0.92, 1], [S4, S4, S5, S5, S6, S6, S6 + 26]);
  const boxY = useTransform(p, [0, 0.64, 0.74, 0.92, 1], [0, 0, -46, -46, -2]);
  const boxScale = useTransform(p, [0, 0.44, 0.5, 1], [0.6, 0.6, 1, 1]);
  const boxRotY = useTransform(p, [0, 0.44, 0.52, 0.9, 1], [14, 14, 0, 0, 5]);
  const boxOpacity = useTransform(p, [0, 0.44, 0.5, 1], [0, 0, 1, 1]);
  const boxVisible = useTransform(p, (v) => (v > 0.42 ? "visible" : "hidden"));
  const lidRotX = useTransform(p, [0, 0.47, 0.53, 0.66, 0.96, 1], [-58, -58, -58, 0, 0, -16]);

  /* the delivered tick on the parcel */
  const doneOpacity = useTransform(p, [0, 0.88, 0.95, 1], [0, 0, 1, 1]);
  const doneScale = useTransform(p, [0, 0.88, 0.95, 1], [0.4, 0.4, 1, 1]);

  /* 05 — the van waits, takes the parcel, drives to the door and leaves */
  const vanX = useTransform(p, [0, 0.74, 0.78, 0.88, 0.93, 1], [S5, S5, S5, S6, S6 + 30, S6 + 340]);
  const vanY = useTransform(p, [0, 0.74, 0.78, 0.82, 0.86, 0.9, 1], [0, 0, 0, -3, 0, -2, -2]);
  const vanOpacity = useTransform(p, [0, 0.9, 0.97, 1], [1, 1, 0, 0]);

  return (
    <>
      {/* ── distant parallax layer: moves at ~1/3 of the camera speed ── */}
      <motion.div
        className="pointer-events-none absolute bottom-[40px] left-1/2"
        style={{ x: farX, willChange: "transform" }}
        aria-hidden="true"
      >
        <div style={{ marginLeft: -1200 }}>
          <Skyline />
        </div>
      </motion.div>

      {/* ── the world the camera travels through ── */}
      <motion.div className="absolute top-0 left-1/2 h-full w-0" style={{ x: camX, willChange: "transform" }}>
        {/* road markings: cheap static gradient, moved by the camera */}
        <div
          className="absolute"
          style={{
            left: ROAD_X,
            bottom: 28,
            width: ROAD_W,
            height: 4,
            background: "repeating-linear-gradient(90deg, rgba(15,122,79,0.42) 0 18px, rgba(15,122,79,0) 18px 44px)",
          }}
          aria-hidden="true"
        />

        {/* 01 medicine */}
        <motion.div
          className="absolute left-0"
          style={{
            bottom: BASELINE,
            x: medX,
            y: medY,
            scale: medScale,
            rotateY: reduce ? 0 : medRotY,
            opacity: medOpacity,
            visibility: medVisible,
            transformPerspective: 900,
            marginLeft: -35,
            willChange: "transform, opacity",
          }}
        >
          <MedicineProduct />
          <motion.span
            className="absolute -top-7 left-1/2 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full"
            style={{ background: EMERALD, opacity: selOpacity, scale: selScale, border: "2px solid #FFFFFF" }}
            aria-hidden="true"
          >
            <Check size={13} strokeWidth={3.6} color="#FFFFFF" />
          </motion.span>
        </motion.div>

        {/* 02 cart */}
        <motion.div
          className="absolute left-0"
          style={{
            bottom: BASELINE,
            x: S2,
            y: cartY,
            scale: cartScale,
            rotateX: reduce ? 0 : cartRotX,
            opacity: cartOpacity,
            visibility: cartVisible,
            transformPerspective: 900,
            marginLeft: -30,
            willChange: "transform, opacity",
          }}
        >
          <CartObject />
        </motion.div>

        {/* 03 order card */}
        <motion.div
          className="absolute left-0"
          style={{
            bottom: BASELINE,
            x: cardX,
            y: cardY,
            scale: cardScale,
            rotateY: reduce ? 0 : cardRotY,
            opacity: cardOpacity,
            visibility: cardVisible,
            transformPerspective: 900,
            marginLeft: -26,
            willChange: "transform, opacity",
          }}
        >
          <OrderCard />
        </motion.div>

        {/* 04 strips into the parcel */}
        <motion.div
          className="absolute left-0"
          style={{
            bottom: BASELINE + 26,
            x: S4,
            y: stripY,
            opacity: stripOpacity,
            visibility: stripVisible,
            marginLeft: -27,
          }}
        >
          <MedicineStrips />
        </motion.div>

        {/* 04 parcel */}
        <motion.div
          className="absolute left-0"
          style={{
            bottom: BASELINE,
            x: boxX,
            y: boxY,
            scale: boxScale,
            rotateY: reduce ? 0 : boxRotY,
            opacity: boxOpacity,
            visibility: boxVisible,
            transformPerspective: 900,
            marginLeft: -30,
            willChange: "transform, opacity",
          }}
        >
          <ParcelBox lidRotX={lidRotX} />
          <motion.span
            className="absolute -top-6 left-1/2 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full"
            style={{ background: EMERALD, opacity: doneOpacity, scale: doneScale, border: "2px solid #FFFFFF" }}
            aria-hidden="true"
          >
            <Check size={13} strokeWidth={3.6} color="#FFFFFF" />
          </motion.span>
        </motion.div>

        {/* 05 van */}
        <motion.div
          className="absolute left-0"
          style={{
            bottom: BASELINE,
            x: vanX,
            y: vanY,
            opacity: vanOpacity,
            marginLeft: -60,
            willChange: "transform, opacity",
          }}
        >
          <DeliveryVan />
        </motion.div>

        {/* 06 destination */}
        <motion.div className="absolute left-0" style={{ bottom: BASELINE, x: S6, marginLeft: -46 }}>
          <CustomerHome />
        </motion.div>
      </motion.div>
    </>
  );
});

/* ═══════════════════════════ CRISP HUD (NEVER TILTED / SCALED) ═══════════════ */

const StageHUD = memo(function StageHUD({ active }: { active: number }) {
  const scene = SCENES[active];
  const Icon = scene.icon;
  return (
    <>
      {/* step label, top-left: a solid plaque, so it stays crisply readable over anything */}
      <div
        className="pointer-events-none absolute bottom-2 left-2 flex items-start gap-2 rounded-[10px] py-1.5 pr-2.5 pl-1.5 sm:top-2.5 sm:bottom-auto sm:left-2.5"
        style={{ background: "rgba(255,255,255,0.94)", border: `1px solid ${HAIRLINE}`, boxShadow: "0 10px 20px -18px rgba(10,60,40,0.7)" }}
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-[7px] text-[10px] font-black text-white" style={{ background: EMERALD }}>
          {scene.chip}
        </span>
        <span className="flex flex-col leading-none">
          <span className="flex items-center gap-1.5 text-[12.5px] font-black tracking-[0.02em] uppercase" style={{ color: INK }}>
            <Icon size={13} strokeWidth={2.6} color={EMERALD} aria-hidden="true" />
            {scene.label}
          </span>
          <span className="mt-[5px] text-[10px] font-semibold" style={{ color: INK_SOFT }}>
            {scene.sub}
          </span>
        </span>
      </div>

      {/* brand chip, top-right, on the sky */}
      <div className="pointer-events-none absolute top-2.5 right-2.5 hidden items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1.5 sm:flex" style={{ background: "rgba(255,255,255,0.9)", border: `1px solid ${HAIRLINE}` }}>
        <span className="grid h-4 w-4 place-items-center rounded-[5px]" style={{ background: EMERALD }}>
          <Cross size={8} color="#FFFFFF" thickness={3} />
        </span>
        <span className="text-[9.5px] font-bold tracking-[0.16em] uppercase" style={{ color: EMERALD }}>
          Kalyan Chemist
        </span>
      </div>

      {/* step counter, bottom-right (the rail carries it on small screens) */}
      <div className="pointer-events-none absolute bottom-2.5 right-2.5 hidden items-center gap-1.5 rounded-full px-2 py-1 sm:flex" style={{ background: "rgba(255,255,255,0.92)", border: `1px solid ${HAIRLINE}` }}>
        <span className="text-[9.5px] font-black tracking-[0.1em]" style={{ color: EMERALD }}>
          {scene.chip}
        </span>
        <span className="h-[9px] w-px" style={{ background: HAIRLINE }} />
        <span className="text-[9.5px] font-bold tracking-[0.1em]" style={{ color: INK_FAINT }}>
          {SCENES[SCENES.length - 1].chip}
        </span>
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

  /* the wheels are the only loop, and only while the section is on screen */
  const inView = useInView(sectionRef, { margin: "180px 0px 180px 0px" });

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start 0.85", "end 0.45"] });
  /* fast spring: immediate scroll response, still fully interpolated */
  const p = useSpring(scrollYProgress, { stiffness: 190, damping: 30, mass: 0.32 });

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

  /* jump the page to the scroll position where a beat is parked */
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
      style={{ background: `linear-gradient(180deg, ${CREAM} 0%, #FBF9F3 55%, ${CREAM} 100%)` }}
    >
      <style>{`
        @keyframes hiw-roll { to { transform: rotate(360deg); } }
        /* van wheels spin only while the section is on screen */
        .hiw-live .hiw-wheel { animation: hiw-roll 1.15s linear infinite; }
        .hiw-rail { scrollbar-width: none; -ms-overflow-style: none; }
        .hiw-rail::-webkit-scrollbar { display: none; }
        /* step chips (states live here so hover beats the base styles) */
        .hiw-chip {
          display: flex; align-items: center; gap: 6px; flex: 0 0 auto;
          padding: 6px 10px; border-radius: 999px; border: 1px solid #E1EBE4;
          background: #FFFFFF; color: ${INK_SOFT};
          font-size: 10.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
          transition: background-color .2s, border-color .2s, color .2s, box-shadow .2s;
        }
        .hiw-chip .hiw-chip-num { font-size: 9.5px; font-weight: 900; color: ${INK_FAINT}; }
        .hiw-chip-off:hover {
          background: #F1F8F4; border-color: #B7D9C6; color: ${EMERALD};
          box-shadow: 0 8px 16px -14px rgba(10,60,40,.6);
        }
        .hiw-chip-off:hover .hiw-chip-num { color: ${EMERALD}; }
        .hiw-chip-on, .hiw-chip-on:hover {
          background: ${EMERALD}; border-color: ${EMERALD}; color: #FFFFFF;
          box-shadow: 0 8px 18px -14px rgba(10,60,40,.9);
        }
        .hiw-chip-on .hiw-chip-num { color: rgba(255,255,255,.72); }
        @media (prefers-reduced-motion: reduce) {
          .hiw-live .hiw-wheel { animation: none !important; }
        }
      `}</style>

      {/* warm ambient wash (static gradients, no blur) */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 56% 62% at 84% -6%, rgba(207,235,220,0.6), transparent 70%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 48% 58% at 2% 104%, rgba(234,247,241,0.9), transparent 72%)" }} />
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${HAIRLINE},transparent)` }} />
        <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${HAIRLINE},transparent)` }} />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-2.5 sm:px-8">
        {/* ── compact header + 01 → 06 rail on one row ── */}
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1.5">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="flex flex-col"
          >
            <span className="text-[10px] font-bold tracking-[0.28em] uppercase" style={{ color: EMERALD }}>
              How it works
            </span>
            <h2 className="mt-0.5 text-[clamp(1.05rem,2.1vw,1.55rem)] leading-tight font-black tracking-tight" style={{ color: INK }}>
              Your order, from{" "}
              <span
                style={{
                  background: `linear-gradient(96deg, ${EMERALD_DEEP} 4%, ${EMERALD} 52%, ${EMERALD_BRIGHT} 100%)`,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                }}
              >
                cart to doorstep
              </span>
            </h2>
          </motion.div>

          {/* the rail is a full row on small screens and sits beside the heading on large */}
          <div ref={railRef} className="hiw-rail flex w-full gap-1.5 overflow-x-auto pb-0.5 lg:w-auto">
            {SCENES.map((s, i) => {
              const on = i === active;
              return (
                <button
                  key={s.chip}
                  type="button"
                  data-chip={i}
                  onClick={() => goToScene(i)}
                  aria-label={`Step ${s.chip}: ${s.label}`}
                  aria-current={on ? "step" : undefined}
                  className={cn("hiw-chip", on ? "hiw-chip-on" : "hiw-chip-off")}
                >
                  <span className="hiw-chip-num">{s.chip}</span>
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── the diorama window the camera flies through ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.04 }}
          className="mt-2"
        >
          <div className="rounded-[20px] p-px" style={{ background: "linear-gradient(180deg, rgba(15,122,79,0.22), rgba(15,122,79,0.05))" }}>
            <div
              className="relative h-[142px] w-full overflow-hidden rounded-[19px] sm:h-[156px] md:h-[168px]"
              style={{
                background: "linear-gradient(180deg,#FFFFFF 0%,#F9FCFA 54%,#EDF6F1 100%)",
                boxShadow: "0 20px 44px -32px rgba(10,60,40,0.55)",
              }}
            >
              {/* soft sunlight, static */}
              <div
                className="pointer-events-none absolute inset-0"
                aria-hidden="true"
                style={{ background: "radial-gradient(ellipse 34% 60% at 82% 2%, rgba(207,235,220,0.85), transparent 68%)" }}
              />
              {/* the ground the objects stand on */}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0"
                aria-hidden="true"
                style={{
                  height: GROUND_H,
                  background: "linear-gradient(180deg, rgba(207,235,220,0.42), rgba(238,247,242,0.95))",
                  borderTop: `1px solid ${HAIRLINE}`,
                }}
              />

              <World p={p} reduce={reduce} />
              <StageHUD active={active} />
            </div>
          </div>
        </motion.div>

      </div>
    </section>
  );
}
