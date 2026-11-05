import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Bell,
  CalendarDays,
  Check,
  Droplets,
  HeartPulse,
  Leaf,
  Package,
  Pill,
  ShieldCheck,
  Sparkles,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { categoryLabel } from "@/convex/messageCenterCore";
import {
  isLoadableImageUrl,
  resolveNotificationTemplate,
  type NotificationTemplateId,
} from "./notificationTemplate";

export interface NotificationMessageData {
  _id?: string;
  title: string;
  body: string;
  category?: string | null;
  type?: string | null;
  createdAt: number;
  imageUrl?: string | null;
  campaignId?: string | null;
}

interface TemplateStyle {
  /** Hero gradient — each festival has its own palette. */
  hero: string;
  /** True when the hero is light enough to need dark text. */
  lightHero?: boolean;
  /** Content alignment for the message block. */
  align: "center" | "left";
  titleClass: string;
  accent: string;
  /** Message panel look. */
  panel: CSSProperties;
  /** Divider ornament colour. */
  divider: string;
  icon: LucideIcon;
}

/** Festival palettes: deliberately distinct, not one gradient recoloured. */
const STYLES: Record<NotificationTemplateId, TemplateStyle> = {
  diwali: {
    hero: "radial-gradient(120% 130% at 12% 0%, #4c1d95 0%, #7c2d12 48%, #b45309 100%)",
    align: "center",
    titleClass: "font-serif text-[20px] leading-snug tracking-tight sm:text-[23px]",
    accent: "#b45309",
    panel: { background: "#fffbf2", borderColor: "#f3d9a4" },
    divider: "#d97706",
    icon: Sparkles,
  },
  holi: {
    hero: "linear-gradient(135deg, #db2777 0%, #f59e0b 42%, #10b981 72%, #3b82f6 100%)",
    align: "center",
    titleClass: "font-serif text-[21px] leading-snug tracking-tight sm:text-[24px]",
    accent: "#be185d",
    panel: { background: "#fff7fb", borderColor: "#fbcfe8" },
    divider: "#ec4899",
    icon: Sparkles,
  },
  christmas: {
    hero: "linear-gradient(135deg, #052e16 0%, #14532d 45%, #7f1d1d 100%)",
    align: "center",
    titleClass: "font-serif text-[20px] leading-snug tracking-tight sm:text-[23px]",
    accent: "#b91c1c",
    panel: { background: "#fff7f7", borderColor: "#fecaca" },
    divider: "#dc2626",
    icon: Sparkles,
  },
  ganesh: {
    hero: "linear-gradient(135deg, #7c2d12 0%, #b45309 52%, #ea580c 100%)",
    align: "center",
    titleClass: "font-serif text-[20px] leading-snug tracking-tight sm:text-[23px]",
    accent: "#b45309",
    panel: { background: "#fffaf0", borderColor: "#fcd9a4" },
    divider: "#d97706",
    icon: Sparkles,
  },
  eid: {
    hero: "linear-gradient(150deg, #0b132b 0%, #1c2e4a 55%, #0f766e 100%)",
    align: "center",
    titleClass: "font-serif text-[20px] leading-snug tracking-tight sm:text-[23px]",
    accent: "#0f766e",
    panel: { background: "#f7fdfb", borderColor: "#bfe9dd" },
    divider: "#14b8a6",
    icon: Sparkles,
  },
  newyear: {
    hero: "radial-gradient(130% 130% at 78% 8%, #a21caf 0%, #312e81 46%, #0b1026 100%)",
    align: "center",
    titleClass: "font-serif text-[20px] leading-snug tracking-tight sm:text-[23px]",
    accent: "#7c3aed",
    panel: { background: "#f8f7ff", borderColor: "#ddd6fe" },
    divider: "#8b5cf6",
    icon: Sparkles,
  },
  navratri: {
    hero: "linear-gradient(135deg, #831843 0%, #c2410c 55%, #f59e0b 100%)",
    align: "center",
    titleClass: "font-serif text-[20px] leading-snug tracking-tight sm:text-[23px]",
    accent: "#b45309",
    panel: { background: "#fff9f2", borderColor: "#fbd7ad" },
    divider: "#d97706",
    icon: Sparkles,
  },
  rakhi: {
    hero: "linear-gradient(135deg, #831843 0%, #be185d 55%, #f59e0b 100%)",
    align: "center",
    titleClass: "font-serif text-[20px] leading-snug tracking-tight sm:text-[23px]",
    accent: "#be185d",
    panel: { background: "#fff6fa", borderColor: "#fbcfe8" },
    divider: "#db2777",
    icon: Sparkles,
  },
  independence: {
    hero: "linear-gradient(180deg, #f97316 0%, #f97316 30%, #ffffff 30%, #ffffff 70%, #15803d 70%, #15803d 100%)",
    lightHero: true,
    align: "center",
    titleClass: "font-serif text-[20px] leading-snug tracking-tight sm:text-[23px]",
    accent: "#15803d",
    panel: { background: "#f8fafc", borderColor: "#cbd5e1" },
    divider: "#1d4ed8",
    icon: Sparkles,
  },
  republic: {
    hero: "linear-gradient(180deg, #f97316 0%, #f97316 26%, #ffffff 26%, #ffffff 74%, #15803d 74%, #15803d 100%)",
    lightHero: true,
    align: "center",
    titleClass: "font-serif text-[20px] leading-snug tracking-tight sm:text-[23px]",
    accent: "#1d4ed8",
    panel: { background: "#f8fafc", borderColor: "#cbd5e1" },
    divider: "#1d4ed8",
    icon: Sparkles,
  },
  sankranti: {
    hero: "linear-gradient(160deg, #0ea5e9 0%, #38bdf8 45%, #fde68a 100%)",
    lightHero: true,
    align: "center",
    titleClass: "font-serif text-[20px] leading-snug tracking-tight sm:text-[23px]",
    accent: "#0369a1",
    panel: { background: "#f6fcff", borderColor: "#bae6fd" },
    divider: "#0284c7",
    icon: Sparkles,
  },
  onam: {
    hero: "linear-gradient(140deg, #065f46 0%, #16a34a 52%, #facc15 100%)",
    align: "center",
    titleClass: "font-serif text-[20px] leading-snug tracking-tight sm:text-[23px]",
    accent: "#15803d",
    panel: { background: "#f7fdf6", borderColor: "#bbf7d0" },
    divider: "#16a34a",
    icon: Sparkles,
  },
  janmashtami: {
    hero: "radial-gradient(120% 130% at 20% 10%, #4c1d95 0%, #1e1b4b 52%, #0f172a 100%)",
    align: "center",
    titleClass: "font-serif text-[20px] leading-snug tracking-tight sm:text-[23px]",
    accent: "#6d28d9",
    panel: { background: "#f8f7ff", borderColor: "#ddd6fe" },
    divider: "#8b5cf6",
    icon: Sparkles,
  },
  gandhi: {
    hero: "linear-gradient(160deg, #f8fafc 0%, #e2e8f0 55%, #dbeafe 100%)",
    lightHero: true,
    align: "center",
    titleClass: "font-serif text-[20px] leading-snug tracking-tight sm:text-[23px]",
    accent: "#1e40af",
    panel: { background: "#fbfbf8", borderColor: "#e2e0d5" },
    divider: "#b45309",
    icon: Sparkles,
  },
  festival: {
    hero: "linear-gradient(135deg, #7c2d12 0%, #b45309 52%, #f59e0b 100%)",
    align: "center",
    titleClass: "font-serif text-[20px] leading-snug tracking-tight sm:text-[23px]",
    accent: "#b45309",
    panel: { background: "#fffbf3", borderColor: "#f7dfb4" },
    divider: "#d97706",
    icon: Sparkles,
  },
  health: {
    hero: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 52%, #a7f3d0 100%)",
    lightHero: true,
    align: "left",
    titleClass: "text-[19px] font-bold tracking-tight sm:text-[22px]",
    accent: "#047857",
    panel: { background: "#ffffff", borderColor: "#a7f3d0", borderLeft: "4px solid #059669" },
    divider: "#059669",
    icon: HeartPulse,
  },
  offer: {
    hero: "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 50%, #fed7aa 100%)",
    lightHero: true,
    align: "left",
    titleClass: "text-[19px] font-extrabold tracking-tight sm:text-[22px]",
    accent: "#be123c",
    panel: { background: "#fff8f8", borderColor: "#fda4af" },
    divider: "#e11d48",
    icon: Tag,
  },
  announcement: {
    hero: "linear-gradient(140deg, #0f172a 0%, #1e293b 58%, #334155 100%)",
    align: "left",
    titleClass: "font-serif text-[20px] leading-snug tracking-tight sm:text-[23px]",
    accent: "#1d4ed8",
    panel: { background: "#f8fafc", borderColor: "#cbd5e1", borderTop: "3px solid #1d4ed8" },
    divider: "#1d4ed8",
    icon: Bell,
  },
  wish: {
    hero: "linear-gradient(140deg, #fdf6e3 0%, #fbe8c4 55%, #f7d9a6 100%)",
    lightHero: true,
    align: "center",
    titleClass: "font-serif text-[21px] italic leading-snug tracking-tight sm:text-[24px]",
    accent: "#b45309",
    panel: { background: "#fffdf7", borderColor: "#efdcb8" },
    divider: "#d97706",
    icon: Sparkles,
  },
  order: {
    hero: "linear-gradient(140deg, #0f766e 0%, #115e59 60%, #134e4a 100%)",
    align: "left",
    titleClass: "text-[18px] font-semibold tracking-tight sm:text-[21px]",
    accent: "#0f766e",
    panel: { background: "#f8fafc", borderColor: "#cbd5e1" },
    divider: "#0d9488",
    icon: Package,
  },
  neutral: {
    hero: "linear-gradient(140deg, #064e3b 0%, #0f766e 55%, #134e4a 100%)",
    align: "center",
    titleClass: "font-serif text-[19px] leading-snug tracking-tight sm:text-[22px]",
    accent: "#0f766e",
    panel: { background: "#f8fafc", borderColor: "#e2e8f0" },
    divider: "#0f766e",
    icon: Bell,
  },
};

/* ─── Hero ornaments ─────────────────────────────────────────────────────────
 * Every template gets its own artwork. Inline SVG only: no external images, no
 * emoji (which render as tofu on systems without the glyph).
 */

const svgProps = {
  viewBox: "0 0 400 180",
  preserveAspectRatio: "xMidYMid slice",
  className: "absolute inset-0 size-full",
  "aria-hidden": true as const,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function DiwaliOrnament() {
  return (
    <div className="absolute inset-0 text-amber-200">
      <svg {...svgProps}>
        <path d="M0 18 Q100 44 200 18 T400 18" opacity=".55" />
        {[40, 100, 160, 220, 280, 340].map((x, i) => (
          <g key={x}>
            <circle cx={x} cy={22 + (i % 3) * 6} r="3.5" fill="#fde68a" stroke="none" />
            <path d={`M${x} ${26 + (i % 3) * 6} v10`} opacity=".5" />
          </g>
        ))}
        {[80, 200, 320].map((x, i) => (
          <g key={x} transform={`translate(${x} ${138 - i * 4})`} opacity=".85">
            <path d="M-18 0 q18 12 36 0" stroke="#fcd34d" />
            <path d="M-24 0 h48" />
            <path d="M-6 0 c-2 -10 6 -16 6 -22 c0 8 8 12 6 22" fill="#fbbf24" stroke="none" opacity=".8" />
          </g>
        ))}
        <circle cx="200" cy="92" r="52" strokeDasharray="2 9" opacity=".35" />
        <circle cx="200" cy="92" r="68" strokeDasharray="1 14" opacity=".22" />
      </svg>
    </div>
  );
}

function HoliOrnament() {
  return (
    <div className="absolute inset-0">
      <svg {...svgProps} stroke="none">
        <circle cx="60" cy="60" r="52" fill="#fef08a" opacity=".55" />
        <circle cx="150" cy="120" r="60" fill="#f0abfc" opacity=".45" />
        <circle cx="300" cy="52" r="56" fill="#67e8f9" opacity=".45" />
        <circle cx="360" cy="130" r="46" fill="#fde68a" opacity=".5" />
        <circle cx="230" cy="30" r="34" fill="#bbf7d0" opacity=".5" />
        {[36, 92, 148, 208, 268, 330].map((x, i) => (
          <circle key={x} cx={x} cy={150 - (i % 3) * 26} r={3 + (i % 2)} fill="#ffffff" opacity=".7" />
        ))}
      </svg>
    </div>
  );
}

function ChristmasOrnament() {
  return (
    <div className="absolute inset-0 text-sky-100">
      <svg {...svgProps}>
        {[
          [60, 52, 12],
          [300, 44, 15],
          [350, 110, 10],
          [130, 128, 9],
        ].map(([x, y, r], i) => (
          <g key={i} transform={`translate(${x} ${y})`} opacity=".8">
            {[0, 60, 120].map((a) => (
              <g key={a} transform={`rotate(${a})`}>
                <path d={`M0 ${-r} V${r}`} />
                <path d={`M${-r * 0.35} ${-r * 0.75} L0 ${-r * 0.2} L${r * 0.35} ${-r * 0.75}`} />
              </g>
            ))}
          </g>
        ))}
        <path d="M200 34 l6 14 15 2 -11 11 3 15 -13 -7 -13 7 3 -15 -11 -11 15 -2z" fill="#fde68a" stroke="none" opacity=".9" />
        <g stroke="#bbf7d0" opacity=".7">
          <path d="M258 160 l-26 -44 h52z" />
          <path d="M262 140 l-22 -34 h44z" />
          <path d="M244 160 h36" />
        </g>
      </svg>
    </div>
  );
}

function GaneshOrnament() {
  return (
    <div className="absolute inset-0 text-amber-100">
      <svg {...svgProps}>
        <path d="M20 34 Q200 -6 380 34" opacity=".65" />
        <path d="M20 44 Q200 6 380 44" opacity=".35" />
        {Array.from({ length: 13 }).map((_, i) => {
          const x = 40 + i * 26.5;
          const y = 40 + Math.sin((i / 12) * Math.PI) * -4;
          return (
            <g key={i} opacity=".8">
              <path d={`M${x} ${y} v12`} />
              <ellipse cx={x} cy={y + 18} rx="4.5" ry="8" fill="#fcd34d" stroke="none" opacity=".75" />
            </g>
          );
        })}
        {[120, 280].map((x) => (
          <g key={x} transform={`translate(${x} 148)`} opacity=".85">
            <path d="M-14 0 q14 -18 28 0z" fill="#fbbf24" stroke="none" />
            <path d="M-16 2 h32" />
          </g>
        ))}
        <circle cx="200" cy="96" r="40" strokeDasharray="2 8" opacity=".4" />
      </svg>
    </div>
  );
}

function EidOrnament() {
  return (
    <div className="absolute inset-0 text-amber-200">
      <svg {...svgProps}>
        <path d="M300 38 a30 30 0 1 0 22 50 a24 24 0 1 1 -22 -50z" fill="#fde68a" stroke="none" opacity=".9" />
        {[70, 140].map((x) => (
          <g key={x} transform={`translate(${x} 62)`} opacity=".8">
            <path d="M0 -12 v10" />
            <path d="M-12 20 h24 l-4 -22 h-16z" fill="#fcd34d" stroke="none" opacity=".55" />
            <path d="M-16 22 h32" />
            <path d="M0 26 v8" />
          </g>
        ))}
        {[110, 185, 245, 355].map((x, i) => (
          <circle key={x} cx={x} cy={128 - i * 12} r="1.8" fill="#fef3c7" stroke="none" opacity=".9" />
        ))}
      </svg>
    </div>
  );
}

function NewYearOrnament() {
  return (
    <div className="absolute inset-0 text-fuchsia-200">
      <svg {...svgProps}>
        {[
          [90, 54, 26],
          [300, 60, 32],
          [210, 130, 22],
        ].map(([x, y, r], i) => (
          <g key={i} transform={`translate(${x} ${y})`} opacity=".85">
            {Array.from({ length: 12 }).map((_, k) => {
              const a = (k * 15 * Math.PI) / 180;
              return (
                <line
                  key={k}
                  x1={Math.cos(a) * r * 0.45}
                  y1={Math.sin(a) * r * 0.45}
                  x2={Math.cos(a) * r}
                  y2={Math.sin(a) * r}
                  stroke={["#f0abfc", "#fde68a", "#a5f3fc"][i]}
                />
              );
            })}
            <circle r="2.4" fill="#fff" stroke="none" />
          </g>
        ))}
        <circle cx="200" cy="90" r="54" strokeDasharray="3 10" opacity=".3" />
      </svg>
    </div>
  );
}

function NavratriOrnament() {
  return (
    <div className="absolute inset-0 text-amber-100">
      <svg {...svgProps}>
        <circle cx="200" cy="98" r="56" strokeDasharray="2 7" opacity=".45" />
        {Array.from({ length: 10 }).map((_, i) => {
          const a = (i / 10) * Math.PI * 2;
          return (
            <g key={i}>
              <circle cx={200 + Math.cos(a) * 74} cy={98 + Math.sin(a) * 40} r="4.5" fill="#fbbf24" stroke="none" opacity=".8" />
              <circle cx={200 + Math.cos(a) * 44} cy={98 + Math.sin(a) * 24} r="2.4" fill="#fef3c7" stroke="none" opacity=".8" />
            </g>
          );
        })}
        <path d="M0 150 q100 24 200 10 t200 12" opacity=".35" />
      </svg>
    </div>
  );
}

function RakhiOrnament() {
  return (
    <div className="absolute inset-0 text-rose-100">
      <svg {...svgProps}>
        <path d="M0 92 q80 -26 150 -2" opacity=".6" />
        <path d="M250 90 q80 -24 150 2" opacity=".6" />
        <g transform="translate(200 92)">
          {Array.from({ length: 8 }).map((_, i) => (
            <ellipse key={i} rx="7" ry="15" cy="-22" fill="#fda4af" stroke="none" opacity=".55" transform={`rotate(${i * 45})`} />
          ))}
          <circle r="14" fill="#fecdd3" stroke="#fb7185" opacity=".9" />
          <circle r="5" fill="#e11d48" stroke="none" opacity=".85" />
        </g>
      </svg>
    </div>
  );
}

function IndependenceOrnament() {
  return (
    <div className="absolute inset-0 text-slate-800">
      <svg {...svgProps} stroke="none">
        <circle cx="200" cy="90" r="34" fill="#ffffff" opacity=".92" />
        <g stroke="#1d4ed8" strokeWidth="1">
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (i / 24) * Math.PI * 2;
            return <line key={i} x1="200" y1="90" x2={200 + Math.cos(a) * 30} y2={90 + Math.sin(a) * 30} opacity=".8" />;
          })}
          <circle cx="200" cy="90" r="34" fill="none" />
        </g>
        {[70, 330].map((x) => (
          <g key={x} opacity=".45" stroke="#1d4ed8" fill="none">
            <path d={`M${x - 26} 52 q26 -18 52 0`} />
            <path d={`M${x - 26} 128 q26 18 52 0`} />
          </g>
        ))}
      </svg>
    </div>
  );
}

function RepublicOrnament() {
  return (
    <div className="absolute inset-0 text-slate-800">
      <svg {...svgProps} stroke="none">
        <circle cx="200" cy="88" r="40" fill="#f8fafc" opacity=".95" />
        <g stroke="#1d4ed8">
          {Array.from({ length: 24 }).map((_, i) => {
            const a = (i / 24) * Math.PI * 2;
            return <line key={i} x1="200" y1="88" x2={200 + Math.cos(a) * 35} y2={88 + Math.sin(a) * 35} />;
          })}
          <circle cx="200" cy="88" r="40" fill="none" />
        </g>
        <path d="M160 148 h80 l-8 -14 h-64z" fill="#e2e8f0" opacity=".8" />
        <path d="M120 40 h160" stroke="#f97316" strokeWidth="3" opacity=".6" />
        <path d="M120 132 h160" stroke="#15803d" strokeWidth="3" opacity=".6" />
      </svg>
    </div>
  );
}

function SankrantiOrnament() {
  return (
    <div className="absolute inset-0 text-sky-100">
      <svg {...svgProps}>
        <circle cx="330" cy="46" r="18" fill="#fef08a" stroke="none" opacity=".8" />
        <g opacity=".9">
          <path d="M96 62 l26 26 -26 26 -26 -26z" fill="#f97316" stroke="#fff7ed" opacity=".85" />
          <path d="M96 114 q22 18 4 34 q-10 10 -18 -2" opacity=".7" />
          <path d="M168 44 l18 18 -18 18 -18 -18z" fill="#a5f3fc" stroke="#0e7490" opacity=".85" />
          <path d="M168 80 q14 14 2 26" opacity=".7" />
        </g>
        <path d="M0 152 q100 18 200 6 t200 14" opacity=".35" />
      </svg>
    </div>
  );
}

function OnamOrnament() {
  return (
    <div className="absolute inset-0 text-amber-100">
      <svg {...svgProps}>
        {[
          { r: 64, n: 18, s: 4.6, c: "#fde68a" },
          { r: 44, n: 14, s: 3.6, c: "#fca5a5" },
          { r: 26, n: 10, s: 3, c: "#fef3c7" },
        ].map((ring, i) => (
          <g key={i}>
            {Array.from({ length: ring.n }).map((_, k) => {
              const a = (k / ring.n) * Math.PI * 2;
              return (
                <circle
                  key={k}
                  cx={200 + Math.cos(a) * ring.r}
                  cy={96 + Math.sin(a) * ring.r * 0.62}
                  r={ring.s}
                  fill={ring.c}
                  stroke="none"
                  opacity=".8"
                />
              );
            })}
          </g>
        ))}
        <circle cx="200" cy="96" r="9" fill="#facc15" stroke="none" opacity=".9" />
      </svg>
    </div>
  );
}

function JanmashtamiOrnament() {
  return (
    <div className="absolute inset-0 text-violet-200">
      <svg {...svgProps}>
        <g transform="translate(96 84) rotate(-24)" opacity=".85">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <circle key={i} cx={i * 22} cy="0" r="2.6" fill="#c4b5fd" stroke="none" />
          ))}
          <path d="M-16 0 h150" strokeWidth="3" />
        </g>
        <g transform="translate(292 92)" opacity=".9">
          <path d="M0 -34 q-26 16 -14 44 q10 22 34 6 q-22 -6 -12 -28 q6 -14 -8 -22z" fill="#a5b4fc" stroke="none" opacity=".55" />
          <ellipse cx="-2" cy="6" rx="7" ry="10" fill="#e0e7ff" stroke="none" opacity=".9" />
          <circle cx="-2" cy="6" r="3" fill="#4338ca" stroke="none" />
        </g>
        {[60, 140, 210, 350].map((x, i) => (
          <circle key={x} cx={x} cy={40 + i * 14} r="1.8" fill="#f5f3ff" stroke="none" opacity=".8" />
        ))}
      </svg>
    </div>
  );
}

function GandhiOrnament() {
  return (
    <div className="absolute inset-0 text-slate-700">
      <svg {...svgProps}>
        <g transform="translate(200 88)" opacity=".85">
          <circle r="38" />
          <circle r="6" fill="#475569" stroke="none" />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return <line key={i} x1="0" y1="0" x2={Math.cos(a) * 36} y2={Math.sin(a) * 36} />;
          })}
          <path d="M-14 38 h28" />
          <path d="M0 44 v12" />
        </g>
        <path d="M0 148 q100 16 200 6 t200 12" stroke="#f97316" opacity=".55" />
        <path d="M0 154 q100 16 200 6 t200 12" stroke="#15803d" opacity=".45" />
      </svg>
    </div>
  );
}

function FestivalOrnament() {
  return (
    <div className="absolute inset-0 text-amber-100">
      <svg {...svgProps}>
        <path d="M0 26 Q100 52 200 26 T400 26" opacity=".5" />
        {[30, 80, 130, 180, 230, 280, 330, 380].map((x, i) => (
          <circle key={x} cx={x} cy={30 + (i % 3) * 5} r="3.4" fill={["#fde68a", "#fca5a5", "#bbf7d0"][i % 3]} stroke="none" />
        ))}
        {[70, 150, 250, 330].map((x, i) => (
          <rect key={x} x={x} y={104 + (i % 2) * 20} width="7" height="7" fill={["#fcd34d", "#f9a8d4", "#86efac"][i % 3]} stroke="none" opacity=".8" transform={`rotate(${i * 22} ${x} ${104 + (i % 2) * 20})`} />
        ))}
        <circle cx="200" cy="96" r="48" strokeDasharray="2 10" opacity=".3" />
      </svg>
    </div>
  );
}

function HealthOrnament() {
  return (
    <div className="absolute inset-0 text-emerald-800">
      <svg {...svgProps}>
        <path
          d="M0 120 h58 l12 -34 16 62 14 -44 12 16 h56 l10 -22 14 40 12 -18 h76 l14 -28 16 56 14 -28 h64"
          stroke="#059669"
          strokeWidth="2.2"
          opacity=".75"
        />
        {[60, 140, 250, 340].map((x, i) => (
          <g key={x} transform={`translate(${x} ${44 + (i % 2) * 18})`} opacity=".38">
            <rect x="-7" y="-7" width="14" height="14" rx="3" />
            <path d="M0 -4 v8M-4 0 h8" stroke="#047857" />
          </g>
        ))}
        <path d="M300 142 q-16 -26 2 -38 q18 12 2 38z" fill="#34d399" stroke="none" opacity=".5" />
      </svg>
    </div>
  );
}

function OfferOrnament() {
  return (
    <div className="absolute inset-0 text-rose-300">
      <svg {...svgProps}>
        <g transform="translate(86 76) rotate(-14)" opacity=".85">
          <rect x="-30" y="-20" width="86" height="52" rx="10" fill="#fff1f2" stroke="#f43f5e" />
          <circle cx="-18" cy="6" r="4" stroke="#f43f5e" />
          <path d="M2 -2 h30M2 10 h22" stroke="#fb7185" />
        </g>
        <g transform="translate(300 96)" opacity=".7">
          <circle r="34" strokeDasharray="2 8" stroke="#fb7185" />
          <circle r="20" strokeDasharray="1 6" stroke="#fda4af" />
        </g>
        {[190, 220, 250].map((x, i) => (
          <circle key={x} cx={x} cy={38 + i * 10} r="2.4" fill="#fb7185" stroke="none" />
        ))}
        <path d="M0 150 q100 18 200 6 t200 10" stroke="#fb7185" opacity=".4" />
      </svg>
    </div>
  );
}

function AnnouncementOrnament() {
  return (
    <div className="absolute inset-0 text-slate-400">
      <svg {...svgProps}>
        <g transform="translate(310 86)" opacity=".75">
          <path d="M-34 10 l34 -22 v52 l-34 -18z" fill="#94a3b8" stroke="#e2e8f0" opacity=".55" />
          <path d="M-34 -10 v20" />
          <path d="M0 22 q22 14 0 28" stroke="#cbd5e1" />
          <path d="M8 8 q30 18 0 36" stroke="#cbd5e1" opacity=".7" />
        </g>
        {[0, 1, 2].map((i) => (
          <path key={i} d={`M40 ${58 + i * 18} h${120 - i * 28}`} stroke="#cbd5e1" opacity={0.5 - i * 0.1} />
        ))}
        <path d="M0 150 h400" stroke="#cbd5e1" opacity=".25" />
      </svg>
    </div>
  );
}

function WishOrnament() {
  return (
    <div className="absolute inset-0 text-amber-500">
      <svg {...svgProps}>
        {[
          [96, 58, 10],
          [300, 70, 13],
          [200, 132, 8],
          [252, 44, 6],
        ].map(([x, y, r], i) => (
          <g key={i} transform={`translate(${x} ${y})`} stroke="#d97706" opacity={0.75 - i * 0.08}>
            <path d={`M0 ${-r} V${r} M${-r} 0 H${r}`} />
            <path d={`M${-r * 0.5} ${-r * 0.5} L${r * 0.5} ${r * 0.5}`} opacity=".6" />
          </g>
        ))}
        <path d="M140 118 q60 -34 120 0" stroke="#d97706" opacity=".35" />
        <g transform="translate(200 118)" opacity=".5">
          <path d="M-16 0 q16 -14 16 4 q0 -18 16 -4" stroke="#d97706" />
        </g>
      </svg>
    </div>
  );
}

function OrderOrnament() {
  return (
    <div className="absolute inset-0 text-teal-200">
      <svg {...svgProps}>
        <path d="M60 120 l70 -58 70 58 70 -58 70 58" strokeDasharray="3 9" opacity=".45" />
        {[60, 130, 200, 270, 340].map((x, i) => (
          <circle key={x} cx={x} cy={120 - (i % 2) * 58} r="4" fill="#5eead4" stroke="none" opacity=".8" />
        ))}
        <g transform="translate(330 56)" opacity=".8">
          <path d="M-18 -12 h36 v28 h-36z" />
          <path d="M-18 -12 l18 10 18 -10" />
        </g>
        <circle cx="200" cy="152" r="12" fill="#0d9488" stroke="none" opacity=".55" />
        <path d="M194 152 l4 5 8 -9" stroke="#ecfeff" strokeWidth="2" />
      </svg>
    </div>
  );
}

function NeutralOrnament() {
  return (
    <div className="absolute inset-0 text-emerald-200/70">
      <svg {...svgProps}>
        <circle cx="330" cy="30" r="88" opacity=".35" />
        <circle cx="330" cy="30" r="120" opacity=".2" />
        <circle cx="66" cy="158" r="64" opacity=".25" />
        <path d="M150 92 h100 M150 108 h70" opacity=".3" />
      </svg>
    </div>
  );
}

const ORNAMENTS: Record<NotificationTemplateId, () => ReactNode> = {
  diwali: DiwaliOrnament,
  holi: HoliOrnament,
  christmas: ChristmasOrnament,
  ganesh: GaneshOrnament,
  eid: EidOrnament,
  newyear: NewYearOrnament,
  navratri: NavratriOrnament,
  rakhi: RakhiOrnament,
  independence: IndependenceOrnament,
  republic: RepublicOrnament,
  sankranti: SankrantiOrnament,
  onam: OnamOrnament,
  janmashtami: JanmashtamiOrnament,
  gandhi: GandhiOrnament,
  festival: FestivalOrnament,
  health: HealthOrnament,
  offer: OfferOrnament,
  announcement: AnnouncementOrnament,
  wish: WishOrnament,
  order: OrderOrnament,
  neutral: NeutralOrnament,
};

/** Health icon by topic — still healthcare-specific, never generic celebration. */
function healthIcon(text: string): LucideIcon {
  if (/hydrat|water|monsoon|dengue|malaria|fever/i.test(text)) return Droplets;
  if (/immun|vitamin|nutrition|protein|calcium|iron|diet/i.test(text)) return ShieldCheck;
  if (/heart|bp|blood\s*pressure|cholesterol|cardiac/i.test(text)) return HeartPulse;
  if (/skin|hair|allergy|sunscreen/i.test(text)) return Leaf;
  if (/medicine|tablet|dose|prescription/i.test(text)) return Pill;
  return HeartPulse;
}

function formatWhen(createdAt: number) {
  return new Date(createdAt).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationMessage({
  notification,
}: {
  notification: NotificationMessageData;
}) {
  const template = resolveNotificationTemplate(notification);
  const style = STYLES[template.id];
  const Ornament = ORNAMENTS[template.id];
  const reduceMotion = useReducedMotion();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [notification._id]);

  const heroImage =
    isLoadableImageUrl(notification.imageUrl) && !imageFailed
      ? notification.imageUrl
      : null;
  const Chip = template.id === "health" ? healthIcon(`${notification.title} ${notification.body}`) : style.icon;
  const alignCenter = style.align === "center";
  const lightHero = Boolean(style.lightHero) && !heroImage;
  const detailChipStyle: CSSProperties = {
    backgroundColor: `${style.accent}14`,
    color: style.accent,
  };

  return (
    <>
      {/* ── Hero: real uploaded image, otherwise this template's own artwork ── */}
      <div className="relative shrink-0">
        {heroImage ? (
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
            <img
              src={heroImage}
              alt={notification.title}
              className="size-full object-cover"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => setImageFailed(true)}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/30" />
          </div>
        ) : (
          <div
            className="relative flex h-36 items-center justify-center overflow-hidden sm:h-40"
            style={{ background: style.hero }}
            data-notification-hero={template.id}
          >
            <motion.div
              className="absolute inset-0"
              initial={reduceMotion ? false : { opacity: 0, scale: 1.04 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <Ornament />
            </motion.div>
            <motion.span
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className={`relative flex size-14 items-center justify-center rounded-full shadow-lg backdrop-blur-sm ${
                lightHero
                  ? "bg-white/80 text-slate-800 ring-1 ring-black/5"
                  : "bg-white/15 text-white ring-1 ring-white/30"
              }`}
            >
              <Chip className="size-6" strokeWidth={1.6} aria-hidden="true" />
            </motion.span>
          </div>
        )}

        {/* KC brand lock-up — readable over photo and every palette. */}
        <span
          className={`pointer-events-none absolute left-3.5 top-3 inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 backdrop-blur-sm ${
            heroImage || !lightHero ? "bg-black/30" : "bg-white/75 ring-1 ring-black/5"
          }`}
        >
          <span className="flex size-4 items-center justify-center rounded bg-white text-[7.5px] font-extrabold tracking-tight text-emerald-800">
            KC
          </span>
          <span
            className={`text-[8.5px] font-semibold uppercase tracking-[0.2em] ${
              heroImage || !lightHero ? "text-white/90" : "text-slate-700"
            }`}
          >
            Kalyan Chemist
          </span>
        </span>

        {/* Context badge — names the actual occasion the template is built for. */}
        <span
          className="pointer-events-none absolute right-3.5 top-3 rounded-full px-2.5 py-1 text-[8.5px] font-bold uppercase tracking-[0.14em] backdrop-blur-sm"
          style={
            heroImage || !lightHero
              ? { backgroundColor: "rgba(0,0,0,0.32)", color: "#ffffff" }
              : { backgroundColor: "rgba(255,255,255,0.82)", color: "#0f172a" }
          }
        >
          {template.label}
        </span>
      </div>

      {/* ── Scrollable message ── */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-5 text-center sm:px-7">
        {/* Offer is a coupon: title and message share one perforated card. */}
        {template.id === "offer" ? (
          <div
            className="rounded-2xl border-2 border-dashed px-4 pb-4 pt-4 text-left sm:px-5"
            style={{ borderColor: "#fda4af", background: "#fffbfb" }}
            data-notification-template={template.id}
          >
            <div className="flex items-start gap-2">
              <span
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
                style={detailChipStyle}
              >
                <Tag className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.16em]"
                  style={{ color: style.accent }}
                >
                  {template.label}
                </p>
                <h2 className={`mt-1 ${style.titleClass}`}>{notification.title}</h2>
              </div>
            </div>
            <div className="my-3 border-t border-dashed" style={{ borderColor: "#fecdd3" }} />
            <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-slate-700 [overflow-wrap:anywhere] sm:text-[15px]">
              {notification.body}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <MetaChips notification={notification} style={style} />
            </div>
          </div>
        ) : (
          <>
            <div
              className={alignCenter ? "flex flex-col items-center text-center" : "text-left"}
              data-notification-template={template.id}
            >
              {template.kind !== "festival" && (
                <span
                  className="mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em]"
                  style={detailChipStyle}
                >
                  <Chip className="size-3" aria-hidden="true" />
                  {template.label}
                </span>
              )}
              <h2 className={`${style.titleClass} max-w-full text-balance text-foreground [overflow-wrap:anywhere]`}>
                {notification.title}
              </h2>
              <div className={`mt-2 flex flex-wrap items-center gap-1.5 ${alignCenter ? "justify-center" : ""}`}>
                <MetaChips notification={notification} style={style} />
              </div>
            </div>

            <div className="my-4 flex items-center justify-center gap-2">
              <span className="h-px w-12" style={{ background: `linear-gradient(90deg, transparent, ${style.divider}55)` }} />
              <span className="text-[9px]" style={{ color: style.divider }} aria-hidden="true">
                {template.kind === "announcement" ? "◆" : template.kind === "health" ? "✚" : "✦"}
              </span>
              <span className="h-px w-12" style={{ background: `linear-gradient(270deg, transparent, ${style.divider}55)` }} />
            </div>

            <div
              className={`rounded-xl border px-4 py-4 [overflow-wrap:anywhere] sm:px-5 ${
                style.align === "left" ? "text-left" : "text-center"
              }`}
              style={style.panel}
            >
              <p
                className={`whitespace-pre-wrap text-[14.5px] leading-relaxed text-slate-800 sm:text-[15px] ${
                  notification.body.length > 140 && style.align === "center" ? "text-left" : ""
                }`}
              >
                {notification.body}
              </p>
            </div>
          </>
        )}

        <div className={`mt-5 flex items-center gap-2.5 ${alignCenter ? "justify-center" : "justify-start"}`}>
          <span
            className="flex size-7 items-center justify-center rounded-full text-[9px] font-extrabold tracking-tight ring-1"
            style={{ backgroundColor: `${style.accent}14`, color: style.accent, borderColor: `${style.accent}22` }}
          >
            KC
          </span>
          <div className="text-left leading-tight">
            <p className="text-[11.5px] font-semibold text-foreground/85">Team Kalyan Chemist</p>
            <p className="text-[10px] text-muted-foreground">Your health, our priority</p>
          </div>
        </div>
      </div>
    </>
  );
}

function MetaChips({
  notification,
  style,
}: {
  notification: NotificationMessageData;
  style: TemplateStyle;
}) {
  return (
    <>
      {notification.campaignId && notification.category && (
        <span
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em]"
          style={{ backgroundColor: `${style.accent}12`, color: style.accent }}
        >
          <Tag className="size-2.5" aria-hidden="true" />
          {categoryLabel(notification.category)}
        </span>
      )}
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] tracking-[0.02em] text-muted-foreground">
        <CalendarDays className="size-2.5" aria-hidden="true" />
        {formatWhen(notification.createdAt)}
      </span>
      {notification.type === "order_status" && (
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          <Check className="size-2.5" aria-hidden="true" />
          Account update
        </span>
      )}
    </>
  );
}
