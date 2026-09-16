import { useCallback, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import {
  BadgeCheck,
  Check,
  ClipboardCheck,
  CreditCard,
  FileText,
  FlaskConical,
  Home,
  MapPin,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Star,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   KALYAN CHEMIST — "HOW IT WORKS" · 3D ORDER-JOURNEY SHOWCASE
   ---------------------------------------------------------------------------
   Scroll-driven isometric viewport that straightens as the section enters,
   with the seven steps of a Kalyan Chemist order sliding through it
   (browse → cart → order → processing → packed → out for delivery →
   delivered). Motion is driven by framer-motion's scroll engine with a
   spring-damped progress value, so every transition is interpolated and
   seamless — no snapping, no jumps, nothing orbits the layout.
   ═══════════════════════════════════════════════════════════════════════════ */

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/* ── Brand accents (Kalyan Chemist teal / emerald family) ── */
interface Accent {
  chip: string;
  glow: string;
  text: string;
  dot: string;
}

const ACCENTS: Record<string, Accent> = {
  emerald: {
    chip: "from-emerald-400 to-emerald-600",
    glow: "shadow-emerald-500/30",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
  },
  teal: {
    chip: "from-teal-400 to-teal-600",
    glow: "shadow-teal-500/30",
    text: "text-teal-300",
    dot: "bg-teal-400",
  },
  cyan: {
    chip: "from-cyan-400 to-teal-600",
    glow: "shadow-cyan-500/30",
    text: "text-cyan-300",
    dot: "bg-cyan-400",
  },
  amber: {
    chip: "from-amber-300 to-orange-500",
    glow: "shadow-amber-500/25",
    text: "text-amber-200",
    dot: "bg-amber-300",
  },
  sky: {
    chip: "from-sky-400 to-blue-600",
    glow: "shadow-sky-500/30",
    text: "text-sky-300",
    dot: "bg-sky-400",
  },
};

interface JourneyStep {
  id: "browse" | "cart" | "order" | "processing" | "packed" | "shipping" | "delivered";
  label: string;
  hint: string;
  icon: LucideIcon;
  accent: keyof typeof ACCENTS;
}

const JOURNEY: JourneyStep[] = [
  { id: "browse", label: "Browse & Select", hint: "Find the medicine or product you need", icon: Search, accent: "emerald" },
  { id: "cart", label: "Add to Cart", hint: "Build your basket in a couple of taps", icon: ShoppingCart, accent: "teal" },
  { id: "order", label: "Place Order", hint: "Address, payment and prescription", icon: ClipboardCheck, accent: "cyan" },
  { id: "processing", label: "Order Processing", hint: "Pharmacist verification before dispatch", icon: FlaskConical, accent: "amber" },
  { id: "packed", label: "Medicine Packed", hint: "Sealed, labelled and invoice attached", icon: Package, accent: "teal" },
  { id: "shipping", label: "Out for Delivery", hint: "Follow your order in real time", icon: Truck, accent: "sky" },
  { id: "delivered", label: "Delivered", hint: "Handed over at your doorstep", icon: Home, accent: "emerald" },
];

const TOTAL = JOURNEY.length;
const SEG = 1 / (TOTAL - 1);
const MOVE_START = 0.15; // portion of a segment spent holding
const MOVE_END = 0.75; // portion of a segment spent sliding

/* Filmstrip keyframes: each panel holds, then slides one full width.
   `PROGRESS_OUTPUT` mirrors the same timing for the rail fill, while
   `ACTIVE_AT` / `CLICK_AT` map scroll progress back onto step indexes. */
const FILMSTRIP_INPUT: number[] = [0];
const FILMSTRIP_OUTPUT: string[] = ["0%"];
const PROGRESS_OUTPUT: number[] = [0];
const ACTIVE_AT: number[] = [0];
const CLICK_AT: number[] = [0];

for (let i = 0; i < TOTAL - 1; i++) {
  const start = i * SEG;
  FILMSTRIP_INPUT.push(start + SEG * MOVE_START, start + SEG * MOVE_END);
  FILMSTRIP_OUTPUT.push(`${-(i * 100)}%`, `${-((i + 1) * 100)}%`);
  PROGRESS_OUTPUT.push(i / (TOTAL - 1), (i + 1) / (TOTAL - 1));
  ACTIVE_AT.push(start + SEG * 0.45);
  CLICK_AT.push(start + SEG * 0.95);
}
FILMSTRIP_INPUT.push(1);
FILMSTRIP_OUTPUT.push(`${-((TOTAL - 1) * 100)}%`);
PROGRESS_OUTPUT.push(1);

/* ═══════════════════════ STEP MOCK VISUALS ═══════════════════════ */

const CART_ITEMS = [
  { name: "Paracetamol 500mg", qty: 2, price: "₹64" },
  { name: "Vitamin D3 60K", qty: 1, price: "₹118" },
];

const BROWSE_PRODUCTS = [
  { name: "Paracetamol 500mg", pack: "Strip of 15 tablets", price: "₹32" },
  { name: "Vitamin D3 60K", pack: "4 capsules", price: "₹118" },
  { name: "Digital BP Monitor", pack: "1 unit · with cuff", price: "₹1,899" },
];

function BrowseVisual() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
      <div className="flex items-center gap-2 rounded-lg border border-emerald-400/25 bg-black/25 px-2.5 py-1.5">
        <Search className="size-3.5 shrink-0 text-emerald-300" aria-hidden="true" />
        <span className="truncate text-[11px] text-slate-200">Search medicines, devices &amp; wellness…</span>
        <span className="ml-auto h-3.5 w-[1.5px] animate-pulse bg-emerald-300" aria-hidden="true" />
      </div>
      <div className="mt-2 space-y-1.5">
        {BROWSE_PRODUCTS.map((p, i) => (
          <div
            key={p.name}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 transition-colors",
              i === 0 ? "border-emerald-400/30 bg-emerald-400/[0.07]" : "border-white/5 bg-white/[0.02]",
            )}
          >
            <span
              className="size-6 shrink-0 rounded-md border border-white/10 bg-gradient-to-br from-emerald-400/25 to-teal-500/20"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-white">{p.name}</p>
              <p className="truncate text-[9.5px] text-slate-400">{p.pack}</p>
            </div>
            <span className="text-[11px] font-bold text-white">{p.price}</span>
            <span className="rounded-md bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300">
              Add
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CartVisual() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
      <div className="space-y-1.5">
        {CART_ITEMS.map((it) => (
          <div key={it.name} className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-teal-300/25 bg-teal-400/10 text-[10px] font-bold text-teal-200">
              {it.qty}
            </span>
            <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-white">{it.name}</p>
            <div className="flex items-center gap-1.5 text-slate-300" aria-hidden="true">
              <Minus className="size-3" />
              <span className="text-[10px] font-bold tabular-nums">{it.qty}</span>
              <Plus className="size-3" />
            </div>
            <span className="w-11 text-right text-[11px] font-bold text-white">{it.price}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Cart total</span>
        <span className="text-[12px] font-extrabold text-white">₹182</span>
      </div>
      <div className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-500 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-white">
        <ShoppingCart className="size-3.5" aria-hidden="true" /> Proceed to checkout
      </div>
    </div>
  );
}

function OrderVisual() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
      <div className="flex items-start gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2">
        <MapPin className="mt-0.5 size-3.5 shrink-0 text-cyan-300" aria-hidden="true" />
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-white">Home · 123 Health Street</p>
          <p className="truncate text-[9.5px] text-slate-400">Mumbai, Maharashtra 400001</p>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2">
        <CreditCard className="size-3.5 shrink-0 text-cyan-300" aria-hidden="true" />
        <p className="flex-1 text-[11px] font-semibold text-white">UPI · Google Pay</p>
        <span className="size-3.5 rounded-full border-2 border-cyan-300 bg-cyan-300/30" aria-hidden="true" />
      </div>
      <div className="mt-1.5 flex items-center gap-2 rounded-lg border border-amber-300/20 bg-amber-300/[0.07] px-2.5 py-1.5">
        <FileText className="size-3.5 shrink-0 text-amber-200" aria-hidden="true" />
        <p className="truncate text-[10px] font-semibold text-amber-100">Prescription attached · dr-mehta-rx.pdf</p>
        <BadgeCheck className="ml-auto size-3.5 shrink-0 text-amber-200" aria-hidden="true" />
      </div>
      <div className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 py-1.5 text-[10.5px] font-bold uppercase tracking-wide text-white">
        <ClipboardCheck className="size-3.5" aria-hidden="true" /> Place order · ₹182
      </div>
    </div>
  );
}

function ProcessingVisual() {
  const checks = ["Prescription verified", "Pharmacist review complete", "Dosage & batch matched"];
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wide text-amber-200">Verifying your order</span>
        <span className="ml-auto text-[10px] font-bold tabular-nums text-slate-400">2 / 3</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className="khi-progress h-full w-full origin-left rounded-full bg-gradient-to-r from-amber-300 to-emerald-400" />
      </div>
      <div className="mt-2 space-y-1.5">
        {checks.map((c, i) => (
          <div key={c} className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
            <span
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full",
                i < 2 ? "bg-emerald-400/20 text-emerald-300" : "border border-white/15 text-transparent",
              )}
            >
              <Check className="size-2.5" aria-hidden="true" />
            </span>
            <p className={cn("truncate text-[10.5px] font-medium", i < 2 ? "text-white" : "text-slate-400")}>{c}</p>
            {i === 1 && (
              <span className="ml-auto shrink-0 text-[9px] font-bold uppercase tracking-wide text-emerald-300">done</span>
            )}
            {i === 2 && (
              <span className="ml-auto shrink-0 text-[9px] font-bold uppercase tracking-wide text-amber-200">in progress</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PackedVisual() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
      <div className="flex items-center gap-3">
        <svg viewBox="0 0 64 56" className="khi-float h-11 w-12 shrink-0" aria-hidden="true">
          <defs>
            <linearGradient id="khi-box-top" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#34D399" />
              <stop offset="1" stopColor="#10B981" />
            </linearGradient>
          </defs>
          <path d="M32 3 58 16 32 29 6 16Z" fill="url(#khi-box-top)" />
          <path d="M6 16 32 29v24L6 40Z" fill="#0F766E" />
          <path d="M58 16 32 29v24l26-13Z" fill="#115E59" />
          <path d="M32 3 45 9.5 19 22.5 6 16Z" fill="#A7F3D0" opacity="0.5" />
        </svg>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-white">Order #KC-8241 sealed</p>
          <p className="truncate text-[9.5px] text-slate-400">Sealed pack · invoice inside</p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {["Sealed pack", "Invoice attached", "Rx label verified"].map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full border border-teal-300/20 bg-teal-400/10 px-2 py-0.5 text-[9.5px] font-semibold text-teal-200"
          >
            <Check className="size-2.5" aria-hidden="true" /> {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function ShippingVisual() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/25">
          <Truck className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-white">Out for delivery</p>
          <p className="truncate text-[9.5px] text-slate-400">Rider assigned · 2.4 km away</p>
        </div>
        <span className="ml-auto flex shrink-0 items-center gap-1 rounded-full border border-sky-300/25 bg-sky-400/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sky-200">
          <span className="size-1.5 animate-pulse rounded-full bg-sky-300" aria-hidden="true" /> Live
        </span>
      </div>
      <svg viewBox="0 0 220 22" className="mt-2 h-4 w-full" aria-hidden="true">
        <path
          d="M3 18C45 4 95 6 130 12s60 6 87-6"
          fill="none"
          stroke="rgba(148,163,184,0.28)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          className="khi-dash"
          d="M3 18C45 4 95 6 130 12s60 6 87-6"
          fill="none"
          stroke="#38BDF8"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="5 9"
        />
      </svg>
      <div className="mt-1 flex items-center justify-between text-[9.5px] font-semibold text-slate-400">
        <span>Packed 10:12</span>
        <span className="text-sky-200">Arriving in 12 min</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div className="khi-progress-slow h-full w-full origin-left rounded-full bg-gradient-to-r from-sky-400 to-teal-400" />
      </div>
    </div>
  );
}

function DeliveredVisual() {
  const [rating, setRating] = useState(0);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
      <div className="flex items-center gap-3">
        <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
          <Check className="size-5" aria-hidden="true" />
          <span className="khi-ring absolute inset-0 rounded-xl ring-2 ring-emerald-300/50" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[11.5px] font-bold text-white">Delivered to your doorstep</p>
          <p className="truncate text-[9.5px] text-slate-400">Order #KC-8241 · handed over to you</p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Rate your experience</span>
        <div className="ml-auto flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              className="p-0.5 transition-transform duration-200 hover:scale-125"
            >
              <Star
                className={cn("size-3.5 transition-colors", n <= rating ? "fill-amber-300 text-amber-300" : "text-slate-600")}
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
        {rating > 0 && <span className="shrink-0 text-[9.5px] font-bold text-amber-200">{rating}.0</span>}
      </div>
    </div>
  );
}

function StepVisual({ step }: { step: JourneyStep }) {
  switch (step.id) {
    case "browse":
      return <BrowseVisual />;
    case "cart":
      return <CartVisual />;
    case "order":
      return <OrderVisual />;
    case "processing":
      return <ProcessingVisual />;
    case "packed":
      return <PackedVisual />;
    case "shipping":
      return <ShippingVisual />;
    case "delivered":
      return <DeliveredVisual />;
    default:
      return null;
  }
}

/* ═══════════════════════ JOURNEY PANEL ═══════════════════════ */

function JourneyPanel({
  step,
  index,
  settled,
  reduce,
}: {
  step: JourneyStep;
  index: number;
  /* Stepped scroll progress — holds exactly on each step while parked */
  settled: MotionValue<number>;
  reduce: boolean;
}) {
  const accent = ACCENTS[step.accent];
  const Icon = step.icon;

  /* How focused this panel is (1 when parked in the viewport, 0 off-screen) */
  const focus = useTransform(settled, (v) => {
    const centre = index / (TOTAL - 1);
    const distance = Math.abs(v - centre) * (TOTAL - 1);
    return Math.max(0, 1 - distance);
  });

  const scale = useTransform(focus, [0, 1], reduce ? [1, 1] : [0.94, 1]);
  const opacity = useTransform(focus, [0, 0.45, 1], reduce ? [1, 1, 1] : [0.25, 0.7, 1]);
  const y = useTransform(focus, [0, 1], reduce ? [0, 0] : [12, 0]);
  const rotateY = useTransform(focus, [0, 1], reduce ? [0, 0] : [index % 2 === 0 ? 8 : -8, 0]);

  return (
    <motion.div
      style={{ scale, opacity, y, rotateY, transformPerspective: 1200 }}
      className="relative flex h-full w-full shrink-0 items-center justify-center overflow-hidden px-4 sm:px-8 [backface-visibility:hidden] [will-change:transform,opacity]"
    >
      {/* oversized step watermark (depth layer, not content) */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[110px] leading-none font-black tracking-tighter text-white/[0.035] select-none sm:right-6 sm:text-[150px]"
      >
        {String(index + 1).padStart(2, "0")}
      </span>
      <div className="relative w-full max-w-md lg:max-w-lg">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-lg",
              accent.chip,
              accent.glow,
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className={cn("text-[9.5px] font-bold uppercase tracking-[0.2em]", accent.text)}>
              Step {String(index + 1).padStart(2, "0")}
            </p>
            <h3 className="truncate text-[13px] font-bold text-white sm:text-sm">{step.label}</h3>
          </div>
          <p className="ml-auto hidden max-w-[15rem] text-right text-[10.5px] leading-snug text-slate-400 sm:block">
            {step.hint}
          </p>
        </div>
        <div className="mt-3">
          <StepVisual step={step} />
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════ FLOATING 3D DECOR ═══════════════════════ */

function FloatingDecor({
  className,
  delay,
  anim,
  children,
}: {
  className: string;
  delay: number;
  anim: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.7, ease: EASE, delay }}
      className={cn("pointer-events-none absolute", className)}
      aria-hidden="true"
    >
      <div className="khi-decor" style={{ animationName: anim, animationDelay: `${delay}s` }}>
        {children}
      </div>
    </motion.div>
  );
}

function CapsuleSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 32" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="khi-cap-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#A7F3D0" />
          <stop offset="1" stopColor="#10B981" />
        </linearGradient>
        <linearGradient id="khi-cap-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
      </defs>
      <rect x="4" y="6" width="30" height="20" rx="10" fill="url(#khi-cap-a)" />
      <rect x="30" y="6" width="30" height="20" rx="10" fill="url(#khi-cap-b)" />
      <rect x="9" y="9" width="9" height="5" rx="2.5" fill="#FFFFFF" opacity="0.5" />
      <rect x="40" y="9" width="10" height="4" rx="2" fill="#FFFFFF" opacity="0.45" />
    </svg>
  );
}

function BottleSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 44 64" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="khi-bottle" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6EE7B7" />
          <stop offset="1" stopColor="#0F766E" />
        </linearGradient>
      </defs>
      <rect x="14" y="2" width="16" height="9" rx="3" fill="#0D9488" />
      <rect x="10" y="10" width="24" height="50" rx="8" fill="url(#khi-bottle)" />
      <rect x="14" y="24" width="16" height="19" rx="3" fill="#FFFFFF" opacity="0.9" />
      <rect x="16.5" y="28" width="11" height="2.4" rx="1.2" fill="#0F766E" opacity="0.75" />
      <rect x="16.5" y="33" width="7" height="2.4" rx="1.2" fill="#10B981" />
      <rect x="12" y="14" width="4" height="40" rx="2" fill="#FFFFFF" opacity="0.3" />
    </svg>
  );
}

function CrossSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="khi-cross" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5EEAD4" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
      </defs>
      <rect x="10" y="2" width="12" height="28" rx="5" fill="url(#khi-cross)" />
      <rect x="2" y="10" width="28" height="12" rx="5" fill="url(#khi-cross)" />
      <rect x="13" y="5" width="5" height="22" rx="2.5" fill="#FFFFFF" opacity="0.35" />
    </svg>
  );
}

function ParcelSvg({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 56" fill="none" className={className} aria-hidden="true">
      <path d="M32 3 58 16 32 29 6 16Z" fill="#34D399" />
      <path d="M6 16 32 29v24L6 40Z" fill="#0F766E" />
      <path d="M58 16 32 29v24l26-13Z" fill="#115E59" />
      <path d="M32 3 45 9.5 19 22.5 6 16Z" fill="#A7F3D0" opacity="0.5" />
    </svg>
  );
}

/* ═══════════════════════════ MAIN SECTION ═══════════════════════════ */

export default function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);
  const reduce = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);

  /* Progress runs from "section entering" to "section leaving". */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 0.9", "end 0.35"],
  });
  const progress = useSpring(scrollYProgress, { stiffness: 110, damping: 30, mass: 0.55 });

  /* Isometric pose → straight-on as the section scrolls through */
  const rotateX = useTransform(progress, [0, 0.55, 1], reduce ? [0, 0, 0] : [22, 6, 0]);
  const rotateY = useTransform(progress, [0, 0.55, 1], reduce ? [0, 0, 0] : [-12, -4, 0]);
  const rotateZ = useTransform(progress, [0, 0.55, 1], reduce ? [0, 0, 0] : [6, 2, 0]);
  const planeScale = useTransform(progress, [0, 0.5, 1], reduce ? [1, 1, 1] : [0.94, 0.98, 1]);
  const planeY = useTransform(progress, [0, 1], reduce ? [0, 0] : [24, -18]);

  /* Filmstrip slide, rail fill and per-panel focus all share one keyframe
     curve, so the deck holds on a step, then glides to the next. */
  const filmstripX = useTransform(progress, FILMSTRIP_INPUT, FILMSTRIP_OUTPUT);
  const stepProgress = useTransform(progress, FILMSTRIP_INPUT, PROGRESS_OUTPUT);

  useMotionValueEvent(progress, "change", (v) => {
    let idx = 0;
    for (let i = 1; i < TOTAL; i++) if (v >= ACTIVE_AT[i]) idx = i;
    setActive((prev) => (prev === idx ? prev : idx));
  });

  /* Clicking a step scrolls the page to the scroll position where that
     step is parked in the viewport — the same maths the offsets above use. */
  const goToStep = useCallback((index: number) => {
    const el = sectionRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const topAtStart = vh * 0.9;
    const travel = vh * 0.55 + rect.height;
    const target = CLICK_AT[index] ?? 0;
    window.scrollTo({ top: window.scrollY + rect.top - (topAtStart - travel * target), behavior: "smooth" });
  }, []);

  const activeStep = JOURNEY[active];

  return (
    <section
      ref={sectionRef}
      className="relative isolate overflow-hidden border-y border-emerald-400/10"
      style={{ background: "linear-gradient(180deg, #05100D 0%, #07161A 48%, #04100E 100%)" }}
    >
      <style>{`
        @keyframes khi-f1 { 0%,100%{transform:translate3d(0,0,0)} 50%{transform:translate3d(0,-8px,0)} }
        @keyframes khi-f2 { 0%,100%{transform:translate3d(0,0,0) rotate(-4deg)} 50%{transform:translate3d(0,7px,0) rotate(4deg)} }
        @keyframes khi-f3 { 0%,100%{transform:translate3d(0,0,0) scale(1)} 50%{transform:translate3d(0,-6px,0) scale(1.07)} }
        .khi-decor { animation-duration: 8s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; will-change: transform; }
        @keyframes khi-progress { 0%,100%{transform:scaleX(0.22)} 50%{transform:scaleX(0.78)} }
        .khi-progress { animation: khi-progress 5.5s ease-in-out infinite; will-change: transform; }
        .khi-progress-slow { animation: khi-progress 7s ease-in-out 0.6s infinite; will-change: transform; }
        @keyframes khi-dash { to { stroke-dashoffset: -28; } }
        .khi-dash { animation: khi-dash 1.6s linear infinite; }
        @keyframes khi-ring { 0%,100%{transform:scale(1);opacity:.55} 50%{transform:scale(1.14);opacity:0} }
        .khi-ring { animation: khi-ring 2.6s ease-out infinite; }
        @keyframes khi-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        .khi-float { animation: khi-float 5s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .khi-decor, .khi-progress, .khi-progress-slow, .khi-dash, .khi-ring, .khi-float { animation: none !important; }
        }
      `}</style>

      {/* ── Layered brand background ── */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 65% 45% at 50% 0%, rgba(13,148,136,0.28), transparent 70%)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 55% 45% at 16% 22%, rgba(16,185,129,0.16), transparent 70%)" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse 50% 45% at 86% 78%, rgba(34,211,238,0.12), transparent 68%)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
            backgroundSize: "58px 58px",
          }}
        />
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(ellipse at center, transparent 42%, rgba(2,8,7,0.72) 100%)" }}
        />
      </div>

      {/* ── Floating 3D healthcare objects (fixed zones, local motion only) ── */}
      <FloatingDecor className="left-[3%] top-[20%] hidden lg:block" delay={0} anim="khi-f1">
        <CapsuleSvg className="h-7 w-16 drop-shadow-[0_10px_18px_rgba(16,185,129,0.35)]" />
      </FloatingDecor>
      <FloatingDecor className="left-[6%] bottom-[14%] hidden lg:block" delay={1.4} anim="khi-f2">
        <BottleSvg className="h-14 drop-shadow-[0_12px_20px_rgba(13,148,136,0.4)]" />
      </FloatingDecor>
      <FloatingDecor className="right-[4%] top-[16%] hidden lg:block" delay={0.7} anim="khi-f3">
        <CrossSvg className="h-10 w-10 drop-shadow-[0_10px_18px_rgba(34,211,238,0.35)]" />
      </FloatingDecor>
      <FloatingDecor className="right-[7%] bottom-[13%] hidden lg:block" delay={2.1} anim="khi-f1">
        <ParcelSvg className="h-11 w-12 drop-shadow-[0_12px_20px_rgba(16,185,129,0.3)]" />
      </FloatingDecor>
      <FloatingDecor className="left-[16%] top-[9%] hidden xl:block" delay={1} anim="khi-f3">
        <CrossSvg className="h-6 w-6 opacity-70" />
      </FloatingDecor>
      <FloatingDecor className="right-[18%] top-[8%] hidden xl:block" delay={2.6} anim="khi-f2">
        <CapsuleSvg className="h-5 w-12 opacity-70" />
      </FloatingDecor>

      <div className="relative z-10 mx-auto max-w-7xl px-5 py-14 sm:px-8 sm:py-16">
        {/* ── Header ── */}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.65, ease: EASE }}
            className="max-w-3xl"
          >
            <div className="flex items-center gap-2.5">
              <span className="h-px w-8 bg-gradient-to-r from-emerald-400 to-transparent" />
              <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-emerald-300">How it works</span>
            </div>
            <h2 className="mt-3 text-[clamp(1.5rem,3.6vw,2.6rem)] font-black uppercase leading-[1.02] tracking-tight text-white">
              Order Medicines,{" "}
              <span className="bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-300 bg-clip-text text-transparent">
                Track Prescriptions,
              </span>{" "}
              Manage Health
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.65, ease: EASE, delay: 0.1 }}
            className="max-w-sm lg:text-right"
          >
            <p className="text-[13px] leading-relaxed text-slate-400">
              One journey, seven steps — scroll to follow your order from the shelf to your doorstep.
            </p>
            <p className="mt-2 text-[12px] font-semibold text-emerald-300">
              {activeStep.label} <span className="text-slate-500">·</span>{" "}
              <span className="font-medium text-slate-400">{activeStep.hint}</span>
            </p>
          </motion.div>
        </div>

        {/* ── 3D viewport ── */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.7, ease: EASE }}
          className="group relative mt-8 sm:mt-10"
        >
          <div className="relative mx-auto h-[300px] w-full max-w-5xl sm:h-[340px]" style={{ perspective: "1600px" }}>
            {/* ambient backlight */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-8 top-6 bottom-10 rounded-[40px] bg-emerald-400/10 blur-3xl"
            />
            {/* perspective floor grid */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-[-6%] mx-auto h-32 max-w-4xl opacity-50 [mask-image:linear-gradient(to_bottom,transparent,black_35%,black_70%,transparent)]"
              style={{ transform: "rotateX(64deg)", transformOrigin: "bottom center" }}
            >
              <div className="size-full bg-[linear-gradient(rgba(52,211,153,0.22)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.16)_1px,transparent_1px)] bg-[size:46px_46px]" />
            </div>

            <motion.div
              style={{ rotateX, rotateY, rotateZ, scale: planeScale, y: planeY, transformStyle: "preserve-3d" }}
              className="relative h-full w-full"
            >
              {/* depth slab behind the screen */}
              <div
                aria-hidden="true"
                className="absolute inset-0 rounded-[26px] bg-gradient-to-br from-emerald-900/70 to-teal-950/60 blur-[2px]"
                style={{ transform: "translateY(10px) translateZ(-40px)" }}
              />
              <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#071411]/75 shadow-[0_40px_120px_-32px_rgba(16,185,129,0.35)] backdrop-blur-xl transition-colors duration-500 group-hover:border-emerald-300/25">
                {/* window chrome */}
                <div className="flex shrink-0 items-center gap-2.5 border-b border-white/[0.06] px-4 py-3">
                  <span className="size-2.5 rounded-full bg-emerald-400/80" aria-hidden="true" />
                  <span className="size-2.5 rounded-full bg-teal-400/70" aria-hidden="true" />
                  <span className="size-2.5 rounded-full bg-cyan-400/60" aria-hidden="true" />
                  <span className="ml-2 hidden text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400 sm:block">
                    Kalyan Chemist · Order Journey
                  </span>
                  <span className="ml-auto flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5">
                    <span className="size-1.5 animate-pulse rounded-full bg-emerald-300" aria-hidden="true" />
                    <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-300">Live</span>
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9.5px] font-bold tabular-nums text-slate-300">
                    {String(active + 1).padStart(2, "0")} / {String(TOTAL).padStart(2, "0")}
                  </span>
                </div>

                {/* scroll-linked progress line */}
                <div className="relative h-[2px] w-full shrink-0 bg-white/[0.06]">
                  <motion.div
                    style={{ scaleX: stepProgress }}
                    className="h-full origin-left bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400"
                  />
                </div>

                {/* filmstrip of journey steps */}
                <div className="relative min-h-0 flex-1 overflow-hidden">
                  <motion.div style={{ x: filmstripX }} className="flex h-full w-full [will-change:transform]">
                    {JOURNEY.map((step, i) => (
                      <JourneyPanel key={step.id} step={step} index={i} settled={stepProgress} reduce={reduce} />
                    ))}
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* ── Step rail (click a step to scroll to it) ── */}
          <div className="relative mx-auto mt-6 max-w-5xl sm:mt-7">
            <div className="absolute top-4 right-4 left-4 h-px bg-white/10" aria-hidden="true" />
            <motion.div
              style={{ scaleX: stepProgress }}
              className="absolute top-4 right-4 left-4 h-px origin-left bg-gradient-to-r from-emerald-400 to-cyan-400"
              aria-hidden="true"
            />
            <ol className="relative flex items-start justify-between gap-1">
              {JOURNEY.map((step, i) => {
                const accent = ACCENTS[step.accent];
                const Icon = step.icon;
                const isActive = i === active;
                return (
                  <li key={step.id} className="flex min-w-0 flex-1 justify-center">
                    <button
                      type="button"
                      onClick={() => goToStep(i)}
                      aria-current={isActive ? "step" : undefined}
                      aria-label={`Step ${i + 1}: ${step.label}`}
                      title={step.label}
                      className="group/step flex w-full flex-col items-center gap-2 text-center"
                    >
                      <span
                        className={cn(
                          "relative flex size-8 items-center justify-center rounded-full border backdrop-blur-sm transition-all duration-300",
                          isActive
                            ? "scale-110 border-emerald-300/60 bg-emerald-400/15 text-emerald-200 shadow-lg shadow-emerald-500/25"
                            : "border-white/10 bg-white/[0.04] text-slate-400 group-hover/step:border-emerald-300/35 group-hover/step:text-emerald-200",
                        )}
                      >
                        <Icon className="size-3.5" aria-hidden="true" />
                        {isActive && <span className={cn("absolute -bottom-1 size-1.5 rounded-full", accent.dot)} aria-hidden="true" />}
                      </span>
                      <span
                        className={cn(
                          "hidden text-[10px] leading-tight font-semibold tracking-wide transition-colors sm:block",
                          isActive ? "text-white" : "text-slate-500 group-hover/step:text-slate-300",
                        )}
                      >
                        {step.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
