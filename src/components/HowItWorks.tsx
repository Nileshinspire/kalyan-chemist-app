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
   KALYAN CHEMIST — "HOW IT WORKS" · A CAMERA FLIES THROUGH A SMALL 3D WORLD
   ---------------------------------------------------------------------------
   Not a tilted card and not floating dashboard tiles. This is a real CSS-3D
   diorama: a stage with `perspective`, a world rig that the scroll drives
   sideways (the camera), and objects placed at true depth (far trees at
   translateZ(-240), foreground bushes at translateZ(110)) so parallax,
   convergence and scale come from the browser's perspective engine itself.

   ONE continuous hero object carries the whole story — the same parcel you
   see packed is the one the van carries and the one that reaches the door:

     medicine → flies into cart → order card pops out → drops into the
     parcel → lid closes → parcel hops into the van → van drives →
     parcel at the doorstep → Delivered ✓

   Two strict layers keep it smooth AND sharp:

   · WORLD — the 3D half. Shape-only: zero readable text, so perspective and
     rotation can never blur copy. Static props + MotionValue-driven heroes.
   · HUD   — the readable half. Step plaque, brand chip, counter, progress
     bar: rendered at 1:1 OUTSIDE the 3D context, never tilted or scaled.

   Performance contract:
   · ONE spring-smoothed scroll value drives the entire film;
   · transforms + opacity only — no layout props, no filters, no backdrop;
   · flat DOM inside the world (one preserve-3d chain, cheap z-sorting);
   · memoised World/HUD never re-render during scroll (6 tiny HUD swaps);
   · off-stage heroes switch to visibility:hidden; van wheels loop only
     while the section is on screen; everything cleans up on unmount.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── premium pharmacy palette: warm cream + rich emerald + soft mint ── */
const CREAM = "#F8F5EC";
const EMERALD = "#0E7A4E";
const EMERALD_DEEP = "#0A5A3A";
const EMERALD_BRIGHT = "#17A367";
const MINT = "#D3EADD";
const MINT_SOFT = "#EDF7F1";
const INK = "#1C2A24";
const INK_SOFT = "#55685E";
const INK_FAINT = "#93A69B";
const HAIRLINE = "rgba(14,122,78,0.14)";

const EASE = [0.22, 1, 0.36, 1] as const;

/* ── the six beats, in the simplest possible words ── */
type Scene = { chip: string; label: string; sub: string; icon: LucideIcon };

const SCENES: Scene[] = [
  { chip: "01", label: "Choose medicine", sub: "Select your medicine", icon: Search },
  { chip: "02", label: "Add to cart", sub: "Add it to your cart", icon: ShoppingCart },
  { chip: "03", label: "Place order", sub: "Confirm your order", icon: ClipboardCheck },
  { chip: "04", label: "We pack it", sub: "We prepare your medicines", icon: Package },
  { chip: "05", label: "Out for delivery", sub: "Your order is on the way", icon: Truck },
  { chip: "06", label: "Delivered", sub: "Medicines delivered to your door", icon: HomeIcon },
];

/* scroll progress (0–1) where each beat hands over to the next */
const SCENE_AT = [0.17, 0.33, 0.52, 0.71, 0.88];

/* ── world geometry: six stations along one road ── */
const SP = 520;
const S1 = 0;
const S2 = SP;
const S3 = SP * 2;
const S4 = SP * 3;
const S5 = SP * 4;
const S6 = SP * 5;

/* the camera: hold on a station → glide to the next → hold… (+ gentle dolly) */
const CAM_P = [0, 0.15, 0.23, 0.32, 0.4, 0.5, 0.58, 0.7, 0.79, 0.87, 0.95, 1];
const CAM_X = [S1, S1, S2, S2, S3, S3, S4, S4, S5, S5, S6, S6];
const CAM_Z = [0, 46, 0, 46, 0, 46, 0, 46, 0, 40, 0, 36];

/* where a clicked chip parks the film */
const PARK_P = [0.06, 0.27, 0.49, 0.63, 0.85, 0.985];

/* ground line inside the stage (px) */
const BASE = 34;
const GROUND_H = 58;

/* ── depth placement for the parallax layers ── */
const TREE_X = [260, 880, 1500, 2120, 2740, 3160];
const BUSH_X = [170, 830, 1460, 2060, 2630, 3150];

/* ═══════════════════════════ SHAPE-ONLY 3D OBJECTS ═══════════════════════════
   Nothing below carries text — these are the things the camera flies past.
   ══════════════════════════════════════════════════════════════════════════ */

/** soft contact shadow so every object reads as standing on the ground */
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

/** the pharmacy cross — the one branded mark used on objects */
const Cross = memo(function Cross({
  size = 20,
  color = "#FFFFFF",
  thickness = 6,
}: {
  size?: number;
  color?: string;
  thickness?: number;
}) {
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

/** the hero medicine: a white box with an emerald cross + a bottle */
const MedicineProduct = memo(function MedicineProduct() {
  return (
    <div className="relative" style={{ width: 64, height: 54 }}>
      <Bounce w={48} />
      {/* bottle */}
      <div className="absolute right-0 bottom-0" style={{ width: 17 }}>
        <div className="mx-auto rounded-[2px]" style={{ width: 9, height: 6, background: EMERALD_DEEP }} />
        <div
          className="relative rounded-[4px]"
          style={{
            height: 32,
            background: "linear-gradient(180deg,#FFFFFF,#EFF7F2)",
            border: `1px solid ${MINT}`,
            boxShadow: "0 6px 12px -9px rgba(12,60,40,0.45)",
          }}
        >
          <span className="absolute inset-x-[3px] top-[8px] h-[10px] rounded-[2px]" style={{ background: MINT_SOFT }} />
          <span className="absolute inset-x-[3px] top-[22px] h-[2px] rounded-full" style={{ background: MINT }} />
        </div>
      </div>
      {/* box */}
      <div
        className="absolute bottom-0 left-0 overflow-hidden rounded-[6px]"
        style={{
          width: 44,
          height: 40,
          background: "linear-gradient(158deg,#FFFFFF 0%,#F5FBF7 58%,#E6F4EC 100%)",
          border: `1px solid ${MINT}`,
          boxShadow: "0 8px 16px -11px rgba(12,60,40,0.5)",
        }}
      >
        <span
          className="absolute inset-x-0 top-0 h-[8px]"
          style={{ background: "linear-gradient(180deg, rgba(211,234,221,0.9), rgba(211,234,221,0.08))" }}
        />
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <Cross size={20} color={EMERALD} thickness={6} />
        </span>
      </div>
    </div>
  );
});

/** 01 — the pharmacy shelf the medicine is picked from */
const ShelfProp = memo(function ShelfProp() {
  const board = (bottom: number) => (
    <span
      className="absolute rounded-[3px]"
      style={{ left: 6, bottom, width: 92, height: 6, background: "#FFFFFF", border: `1px solid ${MINT}` }}
    />
  );
  return (
    <div className="relative" style={{ width: 104, height: 92 }}>
      <Bounce w={84} />
      {/* posts */}
      <span className="absolute bottom-0 left-[10px] h-[86px] w-[5px] rounded-full" style={{ background: MINT }} />
      <span className="absolute bottom-0 right-[10px] h-[86px] w-[5px] rounded-full" style={{ background: MINT }} />
      {board(56)}
      {board(24)}
      {/* top-shelf items */}
      <span
        className="absolute rounded-[3px]"
        style={{ left: 14, bottom: 62, width: 20, height: 16, background: "#FFFFFF", border: `1px solid ${MINT}` }}
      >
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <Cross size={9} color={EMERALD} thickness={3} />
        </span>
      </span>
      <span
        className="absolute rounded-full"
        style={{ left: 42, bottom: 62, width: 11, height: 16, background: "#FFFFFF", border: `1px solid ${MINT}` }}
      />
      <span
        className="absolute rounded-[3px]"
        style={{ left: 60, bottom: 62, width: 24, height: 16, background: MINT_SOFT, border: `1px solid ${MINT}` }}
      />
      {/* lower-shelf items */}
      <span
        className="absolute rounded-[3px]"
        style={{ left: 18, bottom: 30, width: 24, height: 14, background: MINT_SOFT, border: `1px solid ${MINT}` }}
      />
      <span
        className="absolute rounded-[3px]"
        style={{ left: 50, bottom: 30, width: 20, height: 14, background: "#FFFFFF", border: `1px solid ${MINT}` }}
      />
    </div>
  );
});

/** 02 — the cart the medicine drops into (drawn AFTER the medicine so it occludes) */
const CartObject = memo(function CartObject() {
  return (
    <div className="relative" style={{ width: 88, height: 74 }}>
      <Bounce w={58} />
      <svg width="88" height="74" viewBox="0 0 88 74" fill="none" aria-hidden="true">
        {/* basket with a near-opaque fill so the medicine lands "inside" it */}
        <path
          d="M6 8h9l9 36h37l11-28H19"
          stroke={EMERALD}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="rgba(255,255,255,0.94)"
        />
        <path d="M28 16v22M42 16v22M56 16v22" stroke={MINT} strokeWidth="2" strokeLinecap="round" />
        {/* handle grip */}
        <rect x="3" y="4" width="12" height="5" rx="2.5" fill={EMERALD_DEEP} />
        {/* wheels */}
        <circle cx="31" cy="60" r="5" fill={INK} />
        <circle cx="31" cy="60" r="1.8" fill="#FFFFFF" />
        <circle cx="57" cy="60" r="5" fill={INK} />
        <circle cx="57" cy="60" r="1.8" fill="#FFFFFF" />
      </svg>
    </div>
  );
});

/** 03 — the pharmacy counter with a striped awning and a cross sign */
const CounterProp = memo(function CounterProp() {
  return (
    <div className="relative" style={{ width: 118, height: 98 }}>
      <Bounce w={92} />
      {/* sign post */}
      <span className="absolute bottom-[44px] left-[2px] h-[52px] w-[5px] rounded-full" style={{ background: MINT }} />
      <div
        className="absolute grid place-items-center rounded-[6px]"
        style={{ left: -6, bottom: 72, width: 34, height: 26, background: "#FFFFFF", border: `1px solid ${MINT}` }}
      >
        <Cross size={13} color={EMERALD} thickness={4.5} />
      </div>
      {/* awning */}
      <div
        className="absolute rounded-t-[7px]"
        style={{
          left: 12,
          bottom: 58,
          width: 102,
          height: 15,
          background: `repeating-linear-gradient(90deg, ${EMERALD} 0 12px, #FFFFFF 12px 24px)`,
          border: `1px solid ${HAIRLINE}`,
        }}
      />
      {/* counter body */}
      <div
        className="absolute bottom-0 overflow-hidden rounded-[6px]"
        style={{
          left: 18,
          width: 92,
          height: 46,
          background: "linear-gradient(180deg,#FFFFFF,#EDF6F1)",
          border: `1px solid ${MINT}`,
          boxShadow: "0 10px 18px -13px rgba(12,60,40,0.5)",
        }}
      >
        <span className="absolute inset-x-0 top-0 h-[6px]" style={{ background: MINT }} />
        <span className="absolute top-[14px] left-[10px] h-[5px] w-[40px] rounded-full" style={{ background: MINT_SOFT }} />
        <span className="absolute top-[24px] left-[10px] h-[5px] w-[28px] rounded-full" style={{ background: MINT_SOFT }} />
        <span className="absolute top-1/2 right-[10px] -translate-y-1/2">
          <Cross size={14} color={EMERALD} thickness={5} />
        </span>
      </div>
    </div>
  );
});

/** 04 — the packing bench the parcel sits on */
const BenchProp = memo(function BenchProp() {
  return (
    <div className="relative" style={{ width: 128, height: 40 }}>
      <Bounce w={104} />
      <span
        className="absolute top-0 left-0 rounded-[5px]"
        style={{ width: 124, height: 8, background: "linear-gradient(180deg,#FFFFFF,#EAF4EE)", border: `1px solid ${MINT}` }}
      />
      <span className="absolute bottom-0 left-[10px] h-[30px] w-[7px] rounded-[2px]" style={{ background: MINT }} />
      <span className="absolute bottom-0 right-[10px] h-[30px] w-[7px] rounded-[2px]" style={{ background: MINT }} />
      <span className="absolute bottom-[12px] left-1/2 h-[4px] w-[46px] -translate-x-1/2 rounded-full" style={{ background: MINT_SOFT }} />
    </div>
  );
});

/** 04 — the parcel: lid swings open while packing, sealed with the cross */
const ParcelObject = memo(function ParcelObject({ lidRotX }: { lidRotX: MotionValue<number> }) {
  return (
    <div className="relative" style={{ width: 76, height: 62 }}>
      <Bounce w={58} />
      {/* open interior line */}
      <span className="absolute left-[4px] rounded-[3px]" style={{ bottom: 34, width: 68, height: 7, background: "#D9EDE3" }} />
      {/* body */}
      <div
        className="absolute bottom-0 left-0 overflow-hidden rounded-[7px]"
        style={{
          width: 76,
          height: 46,
          background: "linear-gradient(168deg,#FFFFFF,#EEF7F2)",
          border: `1px solid ${MINT}`,
          boxShadow: "0 10px 20px -13px rgba(12,60,40,0.55)",
        }}
      >
        <span
          className="absolute inset-y-0 left-1/2 w-[13px] -translate-x-1/2"
          style={{ background: `linear-gradient(180deg, ${EMERALD_BRIGHT}, ${EMERALD_DEEP})`, opacity: 0.9 }}
        />
        <span className="absolute top-1/2 left-[9px] -translate-y-1/2">
          <Cross size={17} color={EMERALD} thickness={5.5} />
        </span>
        <span className="absolute right-[10px] top-[10px] h-[4px] w-[18px] rounded-full" style={{ background: MINT }} />
      </div>
      {/* lid (own cheap perspective — nothing nested needs preserve-3d) */}
      <motion.div
        className="absolute left-0"
        style={{
          bottom: 34,
          width: 76,
          height: 24,
          rotateX: lidRotX,
          transformPerspective: 420,
          transformOrigin: "center top",
          borderRadius: "7px 7px 4px 4px",
          background: "linear-gradient(180deg,#FFFFFF,#E7F4ED)",
          border: `1px solid ${MINT}`,
        }}
      />
    </div>
  );
});

/** 04 — blister strips that drop into the parcel */
const MedicineStrips = memo(function MedicineStrips() {
  const strip = (left: number) => (
    <span
      className="absolute rounded-[3px]"
      style={{
        left,
        width: 26,
        height: 17,
        background: "linear-gradient(180deg,#FFFFFF,#EAF6F0)",
        border: `1px solid ${MINT}`,
        backgroundImage:
          "radial-gradient(circle at 6px 6px, rgba(23,163,103,0.35) 1.6px, transparent 2px), radial-gradient(circle at 14px 6px, rgba(23,163,103,0.35) 1.6px, transparent 2px), radial-gradient(circle at 22px 6px, rgba(23,163,103,0.35) 1.6px, transparent 2px), radial-gradient(circle at 6px 12px, rgba(23,163,103,0.22) 1.6px, transparent 2px), radial-gradient(circle at 14px 12px, rgba(23,163,103,0.22) 1.6px, transparent 2px), radial-gradient(circle at 22px 12px, rgba(23,163,103,0.22) 1.6px, transparent 2px)",
      }}
    />
  );
  return (
    <div className="relative" style={{ width: 62, height: 17 }}>
      {strip(0)}
      {strip(36)}
    </div>
  );
});

/** 05 — the delivery van (wheels spin only while the section is on screen) */
const DeliveryVan = memo(function DeliveryVan() {
  return (
    <div className="relative" style={{ width: 178, height: 76 }}>
      <Bounce w={142} />
      <svg width="178" height="76" viewBox="0 0 178 76" fill="none" aria-hidden="true">
        {/* cargo body */}
        <rect x="4" y="10" width="94" height="44" rx="7" fill="#FFFFFF" stroke={MINT} strokeWidth="2" />
        {/* cab */}
        <path d="M98 26h24l20 14v14H98z" fill="#FFFFFF" stroke={MINT} strokeWidth="2" strokeLinejoin="round" />
        <path d="M104 30h15l11 9h-26z" fill="#DCEFE4" />
        {/* emerald brand stripe */}
        <rect x="8" y="44" width="128" height="8" rx="3" fill={EMERALD} opacity="0.92" />
        {/* brand mark: white tile + emerald cross */}
        <g transform="translate(34 18)">
          <rect x="0" y="0" width="30" height="24" rx="5" fill="#FFFFFF" stroke={MINT} strokeWidth="1.5" />
          <rect x="12" y="5" width="6" height="14" rx="2" fill={EMERALD} />
          <rect x="8" y="9" width="14" height="6" rx="2" fill={EMERALD} />
        </g>
        {/* wheels */}
        {[
          { x: 34, y: 58 },
          { x: 124, y: 58 },
        ].map((w) => (
          <g key={w.x} className="hiw-wheel" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
            <circle cx={w.x} cy={w.y} r="7.4" fill={INK} />
            <circle cx={w.x} cy={w.y} r="3" fill="#FFFFFF" />
            <rect x={w.x - 1} y={w.y - 6.4} width="2" height="12.8" fill={INK} opacity="0.5" />
          </g>
        ))}
      </svg>
    </div>
  );
});

/** 06 — where the order lands */
const CustomerHome = memo(function CustomerHome() {
  return (
    <div className="relative" style={{ width: 128, height: 102 }}>
      {/* roof */}
      <span
        className="absolute top-0 left-1/2 -translate-x-1/2"
        style={{
          width: 0,
          height: 0,
          borderLeft: "64px solid transparent",
          borderRight: "64px solid transparent",
          borderBottom: `36px solid ${EMERALD_DEEP}`,
        }}
      />
      {/* chimney */}
      <span className="absolute top-[8px] right-[26px] h-[16px] w-[9px] rounded-[2px]" style={{ background: EMERALD }} />
      {/* walls */}
      <div
        className="absolute bottom-0 left-1/2 h-[62px] w-[102px] -translate-x-1/2 overflow-hidden rounded-[5px]"
        style={{
          background: "linear-gradient(180deg,#FFFFFF,#EEF7F2)",
          border: `1px solid ${MINT}`,
          boxShadow: "0 12px 22px -15px rgba(12,60,40,0.5)",
        }}
      >
        <span className="absolute top-[9px] left-[10px] h-[19px] w-[26px] rounded-[3px]" style={{ background: MINT_SOFT, border: `1px solid ${MINT}` }} />
        <span className="absolute top-[34px] left-[14px] h-[3px] w-[18px] rounded-full" style={{ background: MINT }} />
        <span className="absolute top-[12px] left-[48px]">
          <Cross size={15} color={EMERALD} thickness={4.5} />
        </span>
        <span className="absolute right-[12px] bottom-0 h-[38px] w-[24px] rounded-t-[4px]" style={{ background: EMERALD_DEEP, opacity: 0.9 }} />
        <span className="absolute right-[21px] top-[20px] h-[5px] w-[5px] rounded-full" style={{ background: "#FFFFFF", opacity: 0.85 }} />
      </div>
      {/* doormat */}
      <span className="absolute right-[10px] bottom-[-3px] h-[6px] w-[34px] rounded-full" style={{ background: MINT }} />
      <Bounce w={104} />
    </div>
  );
});

/** far background tree (drawn 1.25× to compensate for its depth) */
const TreeProp = memo(function TreeProp({ tall = false }: { tall?: boolean }) {
  const h = tall ? 122 : 98;
  const w = tall ? 84 : 68;
  return (
    <div className="relative" style={{ width: w, height: h }}>
      <span className="absolute bottom-0 left-1/2 h-[38%] w-[7px] -translate-x-1/2 rounded-full" style={{ background: "#9CC7B0" }} />
      <span
        className="absolute rounded-[46%]"
        style={{ top: 0, left: "8%", width: "84%", height: "66%", background: "#BFE0CD" }}
      />
      <span
        className="absolute rounded-[48%]"
        style={{ top: "14%", left: 0, width: "58%", height: "48%", background: "#A9D4BE" }}
      />
    </div>
  );
});

/** near foreground bush (drawn slightly small — it passes close to the lens) */
const BushProp = memo(function BushProp() {
  return (
    <div className="relative" style={{ width: 88, height: 42 }}>
      <span className="absolute bottom-0 left-[6px] h-[26px] w-[26px] rounded-full" style={{ background: "#9CC7B0" }} />
      <span className="absolute bottom-0 left-[26px] h-[34px] w-[38px] rounded-full" style={{ background: "#B4DCC6" }} />
      <span className="absolute bottom-0 right-[4px] h-[24px] w-[24px] rounded-full" style={{ background: "#A9D4BE" }} />
    </div>
  );
});

/** distant hills strip (drawn 1.4× at translateZ(-440)) */
const HillsStrip = memo(function HillsStrip() {
  return (
    <svg width="4800" height="150" viewBox="0 0 4800 150" fill="none" aria-hidden="true">
      <ellipse cx="420" cy="156" rx="520" ry="96" fill="#E4F2E9" />
      <ellipse cx="1500" cy="164" rx="620" ry="110" fill="#DCEEE3" />
      <ellipse cx="2560" cy="158" rx="560" ry="100" fill="#E4F2E9" />
      <ellipse cx="3620" cy="166" rx="640" ry="112" fill="#DCEEE3" />
      <ellipse cx="4520" cy="160" rx="520" ry="98" fill="#E4F2E9" />
    </svg>
  );
});

/* ═══════════════════════════ THE WORLD + THE CAMERA ═════════════════════════ */

const World = memo(function World({ p, reduce }: { p: MotionValue<number>; reduce: boolean }) {
  /* the camera rig: sideways travel + a gentle dolly push-in on holds */
  const camX = useTransform(p, CAM_P, CAM_X.map((v) => -v));
  const camZ = useTransform(p, CAM_P, CAM_Z);

  /* ── 01·02 the hero medicine: chosen on the shelf, flies into the cart ── */
  const medX = useTransform(p, [0, 0.19, 0.27, 1], [S1, S1, S2, S2]);
  const medY = useTransform(p, [0, 0.16, 0.19, 0.235, 0.275, 1], [0, -8, -34, -84, -24, -24]);
  const medScale = useTransform(p, [0, 0.16, 0.235, 0.275, 1], [1, 1.05, 1.12, 0.92, 0.92]);
  const medRotY = useTransform(p, [0, 0.19, 0.26, 1], [-12, -12, 16, 16]);
  const medOpacity = useTransform(p, [0, 0.28, 0.33, 1], [1, 1, 0, 0]);
  const medVisible = useTransform(p, (v): "visible" | "hidden" => (v < 0.36 ? "visible" : "hidden"));

  /* the "selected" tick on the medicine */
  const selOpacity = useTransform(p, [0, 0.045, 0.08, 0.15, 0.19, 1], [0, 0, 1, 1, 0, 0]);
  const selScale = useTransform(p, [0, 0.045, 0.1, 1], [0.4, 0.4, 1, 1]);

  /* ── 02 the cart: catches the medicine, tips the order out, retires ── */
  const cartY = useTransform(p, [0, 0.3, 0.36, 1], [0, 0, 5, 5]);
  const cartRotX = useTransform(p, [0, 0.3, 0.37, 1], [0, 0, -14, -14]);
  const cartOpacity = useTransform(p, [0, 0.38, 0.46, 1], [1, 1, 0, 0]);
  const cartVisible = useTransform(p, (v): "visible" | "hidden" => (v < 0.49 ? "visible" : "hidden"));

  /* ── 03·04 the order card: pops out of the cart, rides to packing, drops in ── */
  const cardX = useTransform(p, [0, 0.42, 0.5, 0.52, 0.58, 1], [S2, S2, S3, S3, S4, S4]);
  const cardY = useTransform(p, [0, 0.33, 0.37, 0.42, 0.5, 0.56, 0.62, 0.67, 1], [0, -30, -58, -70, -70, -64, -46, -40, -40]);
  const cardScale = useTransform(p, [0, 0.33, 0.39, 0.62, 0.67, 1], [0.5, 0.5, 1, 1, 0.85, 0.85]);
  const cardRotY = useTransform(p, [0, 0.37, 0.46, 0.56, 0.62, 1], [22, 22, 0, 0, -12, -12]);
  const cardOpacity = useTransform(p, [0, 0.31, 0.36, 0.62, 0.67, 1], [0, 0, 1, 1, 0, 0]);
  const cardVisible = useTransform(p, (v): "visible" | "hidden" => (v > 0.26 && v < 0.7 ? "visible" : "hidden"));

  /* the "order confirmed" tick on the card */
  const okOpacity = useTransform(p, [0, 0.37, 0.41, 0.5, 0.54, 1], [0, 0, 1, 1, 0, 0]);
  const okScale = useTransform(p, [0, 0.37, 0.43, 1], [0.4, 0.4, 1, 1]);

  /* ── 04 blister strips fall into the parcel ── */
  const stripsY = useTransform(p, [0, 0.545, 0.615, 1], [-10, -10, 70, 70]);
  const stripsOpacity = useTransform(p, [0, 0.52, 0.55, 0.63, 0.67, 1], [0, 0, 1, 1, 0, 0]);
  const stripsVisible = useTransform(p, (v): "visible" | "hidden" => (v > 0.5 && v < 0.67 ? "visible" : "hidden"));

  /* ── 04·05·06 the parcel: packed → sealed → hops into the van → doorstep ── */
  const parcelX = useTransform(p, [0, 0.73, 0.79, 0.9, 1], [S4, S4, S5 - 20, S6 + 40, S6 + 40]);
  const parcelY = useTransform(p, [0, 0.72, 0.76, 0.8, 0.9, 0.94, 1], [0, 0, -40, -18, -18, 0, 0]);
  const parcelScale = useTransform(p, [0, 0.5, 0.54, 0.78, 0.82, 0.92, 0.95, 1], [0.55, 0.55, 1, 1, 0.6, 0.6, 1, 1]);
  const parcelRotY = useTransform(p, [0, 0.5, 0.56, 0.74, 0.8, 0.9, 1], [14, 14, 0, 0, 10, 6, 6]);
  const parcelOpacity = useTransform(p, [0, 0.5, 0.54, 0.77, 0.81, 0.9, 0.94, 1], [0, 0, 1, 1, 0, 0, 1, 1]);
  const parcelVisible = useTransform(p, (v): "visible" | "hidden" => (v > 0.47 ? "visible" : "hidden"));
  const lidRotX = useTransform(p, [0, 0.66, 0.72, 1], [-58, -58, 0, 0]);

  /* the delivered tick on the parcel */
  const doneOpacity = useTransform(p, [0.95, 0.97, 1], [0, 1, 1]);
  const doneScale = useTransform(p, [0.95, 0.97, 1], [0.4, 1.15, 1]);

  /* ── 05 the van: waits at its stop, takes the parcel, drives to the house ── */
  const vanX = useTransform(p, [0, 0.8, 0.92, 0.94, 1], [S5, S5, S6 + 190, S6 + 190, S6 + 700]);

  return (
    <>
      {/* ── the world rig: one preserve-3d chain under the stage perspective ── */}
      <motion.div
        className="absolute top-0 left-1/2 h-full w-0"
        style={{ x: camX, z: camZ, transformStyle: "preserve-3d", willChange: "transform" }}
        aria-hidden="true"
      >
        {/* distant hills, deep in the scene */}
        <div className="absolute" style={{ left: -700, bottom: 16, transform: "translateZ(-440px)" }}>
          <HillsStrip />
        </div>

        {/* far trees between the stations */}
        {TREE_X.map((x, i) => (
          <div key={x} className="absolute" style={{ left: x - 34, bottom: 8, transform: "translateZ(-240px)" }}>
            <TreeProp tall={i % 2 === 1} />
          </div>
        ))}

        {/* the road: edge lines + moving centre dashes */}
        <div
          className="absolute"
          style={{ left: -600, bottom: 40, width: 4200, height: 1, background: "rgba(14,122,78,0.28)" }}
        />
        <div
          className="absolute"
          style={{ left: -600, bottom: 24, width: 4200, height: 1, background: "rgba(14,122,78,0.2)" }}
        />
        <div
          className="absolute"
          style={{
            left: -600,
            bottom: 31,
            width: 4200,
            height: 4,
            background: "repeating-linear-gradient(90deg, rgba(14,122,78,0.42) 0 20px, rgba(14,122,78,0) 20px 48px)",
          }}
        />

        {/* landing pads under each station */}
        {[S1, S2, S3, S4, S5, S6].map((x) => (
          <span
            key={x}
            className="absolute rounded-full"
            style={{
              left: x,
              bottom: BASE - 6,
              width: 168,
              height: 15,
              marginLeft: -84,
              background: "radial-gradient(ellipse at center, rgba(207,234,221,0.85), rgba(207,234,221,0) 70%)",
            }}
          />
        ))}

        {/* 01 shelf (behind the hero medicine) */}
        <div className="absolute" style={{ left: S1 - 96, bottom: BASE }}>
          <ShelfProp />
        </div>

        {/* 06 the destination house */}
        <div className="absolute" style={{ left: S6 - 64, bottom: BASE }}>
          <CustomerHome />
        </div>

        {/* 04 packing bench (parcel sits on it) */}
        <div className="absolute" style={{ left: S4 - 64, bottom: BASE }}>
          <BenchProp />
        </div>

        {/* 03 pharmacy counter */}
        <div className="absolute" style={{ left: S3 - 30, bottom: BASE }}>
          <CounterProp />
        </div>

        {/* 01·02 the hero medicine — flies into the cart */}
        <motion.div
          className="absolute left-0"
          style={{
            bottom: BASE + 8,
            x: medX,
            y: medY,
            scale: medScale,
            rotateY: reduce ? 0 : medRotY,
            opacity: medOpacity,
            visibility: medVisible,
            marginLeft: -32,
            willChange: "transform, opacity",
          }}
        >
          <MedicineProduct />
          <motion.span
            className="absolute -top-7 left-1/2 grid h-6 w-6 -translate-x-1/2 place-items-center rounded-full"
            style={{ background: EMERALD, opacity: selOpacity, scale: selScale, border: "2px solid #FFFFFF" }}
          >
            <Check size={13} strokeWidth={3.6} color="#FFFFFF" />
          </motion.span>
        </motion.div>

        {/* 02 the cart — drawn after the medicine so items land "inside" it */}
        <motion.div
          className="absolute left-0"
          style={{
            bottom: BASE,
            x: S2,
            y: cartY,
            rotateX: reduce ? 0 : cartRotX,
            opacity: cartOpacity,
            visibility: cartVisible,
            marginLeft: -44,
            willChange: "transform, opacity",
          }}
        >
          <CartObject />
        </motion.div>

        {/* 04 blister strips dropping into the parcel */}
        <motion.div
          className="absolute left-0"
          style={{
            bottom: BASE + 118,
            x: S4,
            y: stripsY,
            opacity: stripsOpacity,
            visibility: stripsVisible,
            marginLeft: -34,
          }}
        >
          <MedicineStrips />
        </motion.div>

        {/* 04·05·06 THE parcel — one object for the rest of the journey */}
        <motion.div
          className="absolute left-0"
          style={{
            bottom: BASE + 8,
            x: parcelX,
            y: parcelY,
            scale: parcelScale,
            rotateY: reduce ? 0 : parcelRotY,
            opacity: parcelOpacity,
            visibility: parcelVisible,
            marginLeft: -38,
            willChange: "transform, opacity",
          }}
        >
          <ParcelObject lidRotX={lidRotX} />
          <motion.span
            className="absolute -top-7 left-1/2 grid h-7 w-7 -translate-x-1/2 place-items-center rounded-full"
            style={{ background: EMERALD, opacity: doneOpacity, scale: doneScale, border: "2px solid #FFFFFF" }}
          >
            <Check size={15} strokeWidth={3.6} color="#FFFFFF" />
          </motion.span>
        </motion.div>

        {/* 05 the van — drawn after the parcel, so the parcel vanishes into its cargo */}
        <motion.div
          className="absolute left-0"
          style={{ bottom: BASE, x: vanX, marginLeft: -89 }}
        >
          <DeliveryVan />
        </motion.div>

        {/* 03·04 the order card — floats above everything it touches */}
        <motion.div
          className="absolute left-0"
          style={{
            bottom: BASE + 40,
            x: cardX,
            y: cardY,
            scale: cardScale,
            rotateY: reduce ? 0 : cardRotY,
            opacity: cardOpacity,
            visibility: cardVisible,
            marginLeft: -26,
            willChange: "transform, opacity",
          }}
        >
          <div
            className="relative rounded-[7px]"
            style={{
              width: 52,
              height: 60,
              background: "#FFFFFF",
              border: `1px solid ${MINT}`,
              boxShadow: "0 12px 20px -13px rgba(12,60,40,0.55)",
            }}
          >
            <span className="absolute top-[9px] left-[9px] h-[6px] w-[24px] rounded-[2px]" style={{ background: EMERALD, opacity: 0.85 }} />
            <span className="absolute top-[20px] left-[9px] h-[4px] w-[34px] rounded-[2px]" style={{ background: MINT }} />
            <span className="absolute top-[28px] left-[9px] h-[4px] w-[26px] rounded-[2px]" style={{ background: MINT_SOFT }} />
            <span className="absolute top-[36px] left-[9px] h-[4px] w-[30px] rounded-[2px]" style={{ background: MINT_SOFT }} />
          </div>
          <motion.span
            className="absolute -top-6 -right-3 grid h-7 w-7 place-items-center rounded-full"
            style={{ background: EMERALD, opacity: okOpacity, scale: okScale, border: "2px solid #FFFFFF" }}
          >
            <Check size={14} strokeWidth={3.6} color="#FFFFFF" />
          </motion.span>
        </motion.div>

        {/* near bushes — the fastest layer, they whip past the lens */}
        {BUSH_X.map((x) => (
          <div key={x} className="absolute" style={{ left: x - 44, bottom: 26, transform: "translateZ(110px)" }}>
            <BushProp />
          </div>
        ))}
      </motion.div>
    </>
  );
});

/* ═══════════════════════════ CRISP HUD (NEVER IN THE 3D CONTEXT) ═══════════ */

const StageHUD = memo(function StageHUD({ active }: { active: number }) {
  const scene = SCENES[active];
  const Icon = scene.icon;
  return (
    <>
      {/* step plaque — solid, 1:1, crossfades per beat */}
      <div className="pointer-events-none absolute top-2.5 left-2.5 z-20 sm:top-3 sm:left-3">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE }}
          className="flex items-start gap-2 rounded-[11px] py-1.5 pr-3 pl-1.5"
          style={{ background: "rgba(255,255,255,0.95)", border: `1px solid ${HAIRLINE}`, boxShadow: "0 10px 22px -18px rgba(10,60,40,0.7)" }}
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
        </motion.div>
      </div>

      {/* brand chip on the sky */}
      <div
        className="pointer-events-none absolute top-2.5 right-2.5 z-20 hidden items-center gap-1.5 rounded-full py-1 pr-2.5 pl-1.5 sm:flex sm:top-3 sm:right-3"
        style={{ background: "rgba(255,255,255,0.92)", border: `1px solid ${HAIRLINE}` }}
      >
        <span className="grid h-4 w-4 place-items-center rounded-[5px]" style={{ background: EMERALD }}>
          <Cross size={8} color="#FFFFFF" thickness={3} />
        </span>
        <span className="text-[9.5px] font-bold tracking-[0.16em] uppercase" style={{ color: EMERALD }}>
          Kalyan Chemist
        </span>
      </div>

      {/* step counter */}
      <div
        className="pointer-events-none absolute right-2.5 bottom-2.5 z-20 hidden items-center gap-1.5 rounded-full px-2 py-1 sm:right-3 sm:bottom-3 sm:flex"
        style={{ background: "rgba(255,255,255,0.94)", border: `1px solid ${HAIRLINE}` }}
      >
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
  /* Calm cinematic follow: the camera catches up gradually instead of
     tracking each wheel/touch event 1:1. The natural page scroll remains
     untouched; only this section's derived progress is interpolated. */
  const p = useSpring(scrollYProgress, {
    stiffness: 58,
    damping: 26,
    mass: 0.95,
    restDelta: 0.0004,
  });

  useMotionValueEvent(p, "change", (v) => {
    let idx = 0;
    for (let i = 0; i < SCENE_AT.length; i++) if (v >= SCENE_AT[i]) idx = i + 1;
    setActive((prev) => (prev === idx ? prev : idx));
  });

  /* HUD bits driven directly by the MotionValue — zero re-renders */
  const progressO = useTransform(p, [0, 0.04, 0.1], [0, 1, 1]);
  const hintO = useTransform(p, [0, 0.035, 0.09], [1, 1, 0]);

  /* keep the active chip centred in the (scrollable) step rail */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const chip = rail.querySelector<HTMLElement>(`[data-chip="${active}"]`);
    if (!chip) return;
    rail.scrollTo({ left: chip.offsetLeft - (rail.clientWidth - chip.clientWidth) / 2, behavior: "smooth" });
  }, [active]);

  /* jump the page so the camera parks on the chosen station */
  const goToScene = useCallback((index: number) => {
    const el = sectionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const denom = vh * 0.4 + el.offsetHeight;
    const targetTop = vh * 0.85 - PARK_P[index] * denom;
    window.scrollTo({ top: window.scrollY + rect.top - targetTop, behavior: "smooth" });
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-label="How it works"
      className={cn("relative isolate overflow-hidden", inView && "hiw-live")}
      style={{ background: `linear-gradient(180deg, ${CREAM} 0%, #FAF6EC 52%, ${CREAM} 100%)` }}
    >
      <style>{`
        @keyframes hiw-roll { to { transform: rotate(360deg); } }
        /* van wheels spin only while the section is on screen */
        .hiw-live .hiw-wheel { animation: hiw-roll 1.15s linear infinite; }
        .hiw-rail { scrollbar-width: none; -ms-overflow-style: none; }
        .hiw-rail::-webkit-scrollbar { display: none; }
        /* the world scales down on small screens as one consistent 3D model */
        .hiw-scene { transform: scale(0.72); transform-origin: 50% 82%; }
        @media (min-width: 640px) { .hiw-scene { transform: scale(0.86); } }
        @media (min-width: 1024px) { .hiw-scene { transform: scale(1); } }
        /* step chips (states live here so hover beats the base styles) */
        .hiw-chip {
          display: flex; align-items: center; gap: 6px; flex: 0 0 auto;
          padding: 6px 10px; border-radius: 999px; border: 1px solid #E3ECE5;
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
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 54% 60% at 86% -8%, rgba(211,234,221,0.55), transparent 70%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 46% 56% at 0% 108%, rgba(237,247,241,0.9), transparent 72%)" }} />
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${HAIRLINE},transparent)` }} />
        <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: `linear-gradient(90deg,transparent,${HAIRLINE},transparent)` }} />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-4 sm:px-8 sm:py-5">
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

        {/* ── the 3D world the camera travels through ── */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.5, ease: EASE, delay: 0.04 }}
          className="mt-2.5"
        >
          <div className="rounded-[20px] p-px" style={{ background: "linear-gradient(180deg, rgba(14,122,78,0.24), rgba(14,122,78,0.06))" }}>
            <div
              className="relative h-[238px] w-full overflow-hidden rounded-[19px] sm:h-[276px] md:h-[312px]"
              style={{
                perspective: 1100,
                perspectiveOrigin: "50% 32%",
                background: "linear-gradient(180deg,#FDFBF5 0%,#F7F4E9 34%,#EDF6EF 58%,#E2F1E8 100%)",
                boxShadow: "0 22px 46px -34px rgba(10,60,40,0.55), inset 0 -34px 44px -36px rgba(10,60,40,0.28)",
              }}
            >
              {/* static sky dressing: sun + two clouds */}
              <div
                className="pointer-events-none absolute inset-0"
                aria-hidden="true"
                style={{ background: "radial-gradient(ellipse 30% 52% at 84% 0%, rgba(255,255,255,0.9), transparent 70%)" }}
              />
              <div className="pointer-events-none absolute top-[16%] left-[9%]" aria-hidden="true">
                <span className="absolute top-[7px] left-[16px] h-[13px] w-[46px] rounded-full bg-white/80" />
                <span className="absolute top-0 left-[30px] h-[15px] w-[30px] rounded-full bg-white/90" />
              </div>
              <div className="pointer-events-none absolute top-[9%] right-[24%] hidden sm:block" aria-hidden="true">
                <span className="absolute top-[5px] left-[12px] h-[10px] w-[34px] rounded-full bg-white/70" />
                <span className="absolute top-0 left-[22px] h-[12px] w-[22px] rounded-full bg-white/85" />
              </div>

              {/* the ground the world stands on (featureless, so it never needs to move) */}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0"
                aria-hidden="true"
                style={{
                  height: GROUND_H,
                  background: "linear-gradient(180deg, rgba(206,233,219,0.55), rgba(238,247,242,0.95))",
                  borderTop: `1px solid ${HAIRLINE}`,
                }}
              />

              {/* the 3D scene — one preserve-3d chain under the stage perspective */}
              <div className="hiw-scene absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
                <World p={p} reduce={reduce} />
              </div>

              {/* crisp 2D HUD above the world */}
              <StageHUD active={active} />

              {/* scroll hint + film progress, both driven by the MotionValue */}
              <motion.div
                className="pointer-events-none absolute bottom-3.5 left-1/2 z-20 -translate-x-1/2 sm:bottom-4"
                style={{ opacity: hintO }}
              >
                <span
                  className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9.5px] font-bold tracking-[0.14em] whitespace-nowrap uppercase"
                  style={{ background: "rgba(255,255,255,0.94)", border: `1px solid ${HAIRLINE}`, color: EMERALD }}
                >
                  Scroll to play
                  <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                    <path d="M5 1v8M1.8 5.8 5 9l3.2-3.2" stroke={EMERALD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </motion.div>
              <motion.div
                className="pointer-events-none absolute bottom-[9px] left-1/2 z-20 h-[3px] w-24 -translate-x-1/2 overflow-hidden rounded-full"
                style={{ background: "rgba(14,122,78,0.14)", opacity: progressO }}
                aria-hidden="true"
              >
                <motion.div
                  className="h-full w-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${EMERALD_DEEP}, ${EMERALD_BRIGHT})`, scaleX: p, originX: 0 }}
                />
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
