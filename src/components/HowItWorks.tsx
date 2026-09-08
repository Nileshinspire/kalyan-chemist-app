import { motion } from "framer-motion";
import { ArrowRight, Zap } from "lucide-react";
import { Fragment } from "react";

/* ── Premium soft-3D step illustrations (Kalyan Chemist palette) ── */

function SearchIllustration() {
  return (
    <svg viewBox="0 0 220 150" fill="none" className="size-full" aria-hidden="true">
      <defs>
        <linearGradient id="siBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F2FCF9" />
          <stop offset="1" stopColor="#DFF7F0" />
        </linearGradient>
        <radialGradient id="siGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#2DD4BF" stopOpacity="0.24" />
          <stop offset="1" stopColor="#2DD4BF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="siBody" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#F6FEFC" />
          <stop offset="0.45" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#D8F5ED" />
        </linearGradient>
        <linearGradient id="siScreen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F0FCF9" />
          <stop offset="1" stopColor="#CCF3E7" />
        </linearGradient>
        <linearGradient id="siTeal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2DD4BF" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
        <linearGradient id="siOrange" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FDBA74" />
          <stop offset="1" stopColor="#F97316" />
        </linearGradient>
        <linearGradient id="siGlass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#F3FEFB" />
          <stop offset="1" stopColor="#D8F6EE" />
        </linearGradient>
      </defs>

      <rect x="1" y="1" width="218" height="148" rx="24" fill="url(#siBg)" stroke="#CCFBF1" strokeWidth="1.5" />
      <circle cx="126" cy="74" r="64" fill="url(#siGlow)" />

      <path d="M46 32 l1.7 4 4 1.7 -4 1.7 -1.7 4 -1.7 -4 -4 -1.7 4 -1.7 Z" fill="#2DD4BF" opacity="0.8" />
      <path d="M196 122 l1.4 3.3 3.3 1.4 -3.3 1.4 -1.4 3.3 -1.4 -3.3 -3.3 -1.4 3.3 -1.4 Z" fill="#FB923C" opacity="0.85" />
      <circle cx="192" cy="30" r="2.6" fill="#0D9488" opacity="0.45" />
      <circle cx="32" cy="118" r="2.2" fill="#0D9488" opacity="0.4" />

      <g opacity="0.55">
        <rect x="16" y="34" width="70" height="18" rx="9" fill="#FFFFFF" />
        <rect x="25" y="40" width="34" height="6" rx="3" fill="#CCFBF1" />
        <rect x="16" y="58" width="52" height="10" rx="5" fill="#FFFFFF" opacity="0.85" />
      </g>

      <ellipse cx="60" cy="133" rx="30" ry="6.5" fill="#0D9488" opacity="0.1" />
      <ellipse cx="156" cy="134" rx="42" ry="7" fill="#0D9488" opacity="0.12" />

      <rect x="46" y="58" width="28" height="16" rx="8" fill="url(#siOrange)" />
      <rect x="46" y="58" width="28" height="16" rx="8" fill="none" stroke="#F97316" strokeOpacity="0.4" strokeWidth="1.2" />
      <rect x="50" y="60" width="7" height="12" rx="3.5" fill="#FFFFFF" opacity="0.5" />
      <rect x="49" y="70" width="22" height="58" rx="11" fill="url(#siBody)" />
      <rect x="49" y="70" width="22" height="58" rx="11" fill="none" stroke="#99F6E4" strokeWidth="1.4" />
      <rect x="49" y="84" width="22" height="26" fill="#E6FCF6" />
      <path d="M60 87.5 v19 M50.5 97 h19" stroke="#0D9488" strokeWidth="2.6" strokeLinecap="round" />
      <rect x="49" y="110" width="22" height="4" rx="2" fill="#99F6E4" />
      <rect x="49" y="116" width="15" height="2.6" rx="1.3" fill="#CCFBF1" />
      <rect x="54" y="66" width="3" height="58" rx="1.5" fill="#FFFFFF" opacity="0.85" />

      <g transform="rotate(-12 34 127)">
        <rect x="24" y="122" width="15" height="10" rx="5" fill="#14B8A6" />
        <rect x="31" y="122" width="15" height="10" rx="5" fill="#5EEAD4" />
        <rect x="28" y="124" width="5" height="6" rx="2.5" fill="#FFFFFF" opacity="0.55" />
      </g>

      <g transform="rotate(-7 140 88)">
        <rect x="106" y="32" width="68" height="112" rx="17" fill="url(#siBody)" />
        <rect x="106" y="32" width="68" height="112" rx="17" fill="none" stroke="#0D9488" strokeWidth="2.2" />
        <rect x="112" y="38" width="56" height="100" rx="12" fill="url(#siScreen)" />
        <circle cx="119" cy="44.5" r="2.1" fill="#0D9488" opacity="0.55" />
        <rect x="160" y="43" width="5" height="3" rx="1.5" fill="#0D9488" opacity="0.5" />
        <rect x="116" y="50" width="48" height="14" rx="7" fill="#FFFFFF" />
        <rect x="116" y="50" width="48" height="14" rx="7" fill="none" stroke="#99F6E4" strokeWidth="1.2" />
        <circle cx="123" cy="57" r="3" fill="none" stroke="#0D9488" strokeWidth="1.9" />
        <path d="M125.4 59.4 l2.6 2.6" stroke="#0D9488" strokeWidth="1.9" strokeLinecap="round" />
        <rect x="132" y="55.5" width="27" height="2.4" rx="1.2" fill="#D3F6EC" />
        <rect x="116" y="70" width="48" height="30" rx="7" fill="#FFFFFF" />
        <rect x="119" y="73" width="13" height="24" rx="4" fill="#E6FCF6" />
        <rect x="124" y="78" width="3.5" height="14" rx="1.75" fill="#14B8A6" />
        <rect x="137" y="76.5" width="22" height="3.4" rx="1.7" fill="#0F766E" opacity="0.8" />
        <rect x="137" y="83" width="16" height="2.6" rx="1.3" fill="#99F6E4" />
        <rect x="137" y="89.5" width="14" height="6.5" rx="3.25" fill="#FFEAD8" />
        <rect x="116" y="106" width="48" height="22" rx="6" fill="#FFFFFF" opacity="0.95" />
        <rect x="119" y="109" width="10" height="16" rx="3" fill="#FFEAD8" />
        <rect x="133" y="112" width="20" height="3" rx="1.5" fill="#0F766E" opacity="0.55" />
        <rect x="133" y="118" width="13" height="2.4" rx="1.2" fill="#CCFBF1" />
        <rect x="150" y="112" width="10" height="6" rx="3" fill="#14B8A6" opacity="0.85" />
      </g>

      <motion.g animate={{ y: [0, -4, 0] }} transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}>
        <circle cx="182" cy="41" r="15" fill="url(#siGlass)" />
        <circle cx="182" cy="41" r="15" fill="none" stroke="#0D9488" strokeWidth="2.6" />
        <path d="M175 34.5 a10 10 0 0 1 6.5 -2.4" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.95" />
        <circle cx="177" cy="44" r="2.6" fill="#5EEAD4" opacity="0.9" />
        <path d="M186 46.5 l1.4 2.6 2.6 1.4 -2.6 1.4 -1.4 2.6 -1.4 -2.6 -2.6 -1.4 2.6 -1.4 Z" fill="#FB923C" opacity="0.9" />
        <line x1="194" y1="54" x2="202" y2="62" stroke="url(#siOrange)" strokeWidth="6" strokeLinecap="round" />
        <line x1="195" y1="54.5" x2="199" y2="58.5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />
      </motion.g>
    </svg>
  );
}

function OrderIllustration() {
  return (
    <svg viewBox="0 0 220 150" fill="none" className="size-full" aria-hidden="true">
      <defs>
        <linearGradient id="oiBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F2FCF9" />
          <stop offset="1" stopColor="#DFF7F0" />
        </linearGradient>
        <radialGradient id="oiGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FDBA74" stopOpacity="0.18" />
          <stop offset="1" stopColor="#FDBA74" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="oiTeal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2DD4BF" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
        <linearGradient id="oiOrange" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FDBA74" />
          <stop offset="1" stopColor="#F97316" />
        </linearGradient>
        <linearGradient id="oiBasket" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#DCF6EE" />
        </linearGradient>
        <linearGradient id="oiGold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FDE68A" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id="oiCard" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#EAFBF6" />
        </linearGradient>
      </defs>

      <rect x="1" y="1" width="218" height="148" rx="24" fill="url(#oiBg)" stroke="#CCFBF1" strokeWidth="1.5" />
      <circle cx="110" cy="72" r="66" fill="url(#oiGlow)" />

      <path d="M196 30 l1.6 3.8 3.8 1.6 -3.8 1.6 -1.6 3.8 -1.6 -3.8 -3.8 -1.6 3.8 -1.6 Z" fill="#2DD4BF" opacity="0.85" />
      <path d="M34 66 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5 Z" fill="#FB923C" opacity="0.9" />
      <circle cx="34" cy="30" r="2.4" fill="#0D9488" opacity="0.45" />

      <path d="M38 100 A 62 62 0 0 1 156 36" stroke="#99F6E4" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.55" />
      <circle cx="38" cy="100" r="3" fill="#2DD4BF" opacity="0.6" />

      <ellipse cx="102" cy="124" rx="42" ry="7" fill="#0D9488" opacity="0.1" />
      <ellipse cx="178" cy="126" rx="30" ry="5.5" fill="#0D9488" opacity="0.08" />

      <g>
        <rect x="80" y="38" width="27" height="28" rx="6" fill="url(#oiTeal)" />
        <rect x="80" y="38" width="27" height="9" rx="4.5" fill="#FFFFFF" opacity="0.92" />
        <path d="M90.5 54 v10 M85.5 59 h10" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
        <rect x="103" y="47" width="22" height="20" rx="5" fill="url(#oiOrange)" />
        <rect x="108" y="52" width="12" height="3" rx="1.5" fill="#FFFFFF" opacity="0.85" />
        <rect x="108" y="58" width="8" height="2.4" rx="1.2" fill="#FFFFFF" opacity="0.55" />
        <path d="M80 62 C74 34 130 34 124 62" stroke="#0F766E" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <path
          d="M74 62 h56 l-7 46 a7 7 0 0 1 -7 7 H88 a7 7 0 0 1 -7 -7 Z"
          fill="url(#oiBasket)"
          stroke="#0D9488"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path d="M80 78 h44 M80 92 h44 M82 106 h40" stroke="#BDF3E6" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
        <circle cx="84" cy="120" r="7" fill="#0F766E" />
        <circle cx="120" cy="120" r="7" fill="#0F766E" />
        <circle cx="84" cy="120" r="2.6" fill="#CCFBF1" />
        <circle cx="120" cy="120" r="2.6" fill="#CCFBF1" />
      </g>

      <motion.g animate={{ y: [0, -3.5, 0] }} transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}>
        <rect x="24" y="24" width="64" height="24" rx="12" fill="#FFFFFF" stroke="#99F6E4" strokeWidth="1.5" />
        <circle cx="36" cy="36" r="8" fill="url(#oiTeal)" />
        <path d="M32.2 36 l2.6 2.6 5.4 -5.6" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="49" y="33" width="20" height="3" rx="1.5" fill="#0F766E" opacity="0.85" />
        <rect x="49" y="39" width="14" height="2.4" rx="1.2" fill="#99F6E4" />
      </motion.g>

      <g transform="rotate(-8 176 106)">
        <rect x="144" y="82" width="64" height="46" rx="10" fill="url(#oiCard)" />
        <rect x="144" y="82" width="64" height="46" rx="10" fill="none" stroke="#0D9488" strokeWidth="1.8" />
        <rect x="151" y="90" width="11" height="8" rx="2.2" fill="url(#oiGold)" />
        <rect x="151" y="90" width="11" height="8" rx="2.2" fill="none" stroke="#F59E0B" strokeOpacity="0.5" strokeWidth="1" />
        <path d="M167 92 a6 6 0 1 1 0.1 0" stroke="#99F6E4" strokeWidth="1.8" fill="none" />
        <path d="M171 96 a9 9 0 1 1 0.1 0" stroke="#5EEAD4" strokeWidth="1.6" fill="none" />
        <rect x="151" y="104" width="24" height="2.4" rx="1.2" fill="#D3F6EC" />
        <rect x="151" y="110" width="17" height="2.4" rx="1.2" fill="#E6FAF4" />
        <circle cx="200" cy="90" r="12" fill="url(#oiTeal)" stroke="#FFFFFF" strokeWidth="2.4" />
        <path d="M194.4 90 l4 4 l7.6 -8" stroke="#FFFFFF" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      <circle cx="52" cy="130" r="10" fill="url(#oiGold)" />
      <circle cx="52" cy="130" r="10" fill="none" stroke="#F59E0B" strokeOpacity="0.5" strokeWidth="1.2" />
      <text x="52" y="134.5" textAnchor="middle" fontSize="11" fontWeight="700" fill="#B45309" fontFamily="inherit">
        ₹
      </text>
      <g transform="rotate(10 188 112)">
        <rect x="182" y="108" width="12" height="8" rx="4" fill="#FB923C" />
        <rect x="189" y="108" width="12" height="8" rx="4" fill="#FDBA74" />
      </g>
    </svg>
  );
}

function DeliveryIllustration() {
  return (
    <svg viewBox="0 0 220 150" fill="none" className="size-full" aria-hidden="true">
      <defs>
        <linearGradient id="diBg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F2FCF9" />
          <stop offset="1" stopColor="#DFF7F0" />
        </linearGradient>
        <radialGradient id="diGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#2DD4BF" stopOpacity="0.2" />
          <stop offset="1" stopColor="#2DD4BF" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="diRoof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2DD4BF" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
        <linearGradient id="diWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#EAFBF6" />
        </linearGradient>
        <linearGradient id="diTeal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2DD4BF" />
          <stop offset="1" stopColor="#0D9488" />
        </linearGradient>
        <linearGradient id="diOrange" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FDBA74" />
          <stop offset="1" stopColor="#F97316" />
        </linearGradient>
      </defs>

      <rect x="1" y="1" width="218" height="148" rx="24" fill="url(#diBg)" stroke="#CCFBF1" strokeWidth="1.5" />
      <circle cx="124" cy="76" r="62" fill="url(#diGlow)" />

      <path d="M46 26 l1.6 3.8 3.8 1.6 -3.8 1.6 -1.6 3.8 -1.6 -3.8 -3.8 -1.6 3.8 -1.6 Z" fill="#FB923C" opacity="0.9" />
      <path d="M158 122 l1.4 3.3 3.3 1.4 -3.3 1.4 -1.4 3.3 -1.4 -3.3 -3.3 -1.4 3.3 -1.4 Z" fill="#2DD4BF" opacity="0.8" />
      <circle cx="30" cy="104" r="2.2" fill="#0D9488" opacity="0.4" />

      <path d="M92 104 C116 100 132 84 154 68" stroke="#99F6E4" strokeWidth="2.4" strokeDasharray="2.5 5.5" strokeLinecap="round" fill="none" />

      <ellipse cx="64" cy="124" rx="40" ry="6" fill="#0D9488" opacity="0.09" />
      <ellipse cx="158" cy="124" rx="24" ry="5.5" fill="#0D9488" opacity="0.1" />
      <ellipse cx="188" cy="60" rx="16" ry="4.5" fill="#0D9488" opacity="0.08" />

      <path d="M28 86 L63 56 L98 86 Z" fill="url(#diRoof)" stroke="#0D9488" strokeWidth="2" strokeLinejoin="round" />
      <path d="M40 79.5 L63 63.5 L86 79.5" stroke="#5EEAD4" strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.7" />
      <rect x="34" y="80" width="58" height="44" rx="7" fill="url(#diWall)" stroke="#99F6E4" strokeWidth="1.5" />
      <path d="M76 124 v-9 a7 7 0 0 1 14 0 v9 Z" fill="#E6FCF6" stroke="#0D9488" strokeWidth="1.8" />
      <circle cx="87.5" cy="118" r="1.7" fill="#F59E0B" />
      <rect x="43" y="92" width="14" height="14" rx="3.5" fill="#D6F7ED" stroke="#99F6E4" strokeWidth="1.8" />
      <path d="M50 94.5 v9 M45.5 99 h9" stroke="#0D9488" strokeWidth="1.6" strokeLinecap="round" opacity="0.55" />
      <rect x="34" y="80" width="58" height="7" rx="3.5" fill="#CCFBF1" opacity="0.55" />
      <rect x="94" y="108" width="20" height="16" rx="3.5" fill="#FFFFFF" stroke="#99F6E4" strokeWidth="1.4" />
      <rect x="94" y="114" width="20" height="3.5" fill="url(#diOrange)" />

      <g>
        <rect x="116" y="96" width="24" height="19" rx="4" fill="url(#diTeal)" />
        <rect x="116" y="96" width="24" height="6.5" rx="3" fill="#FFFFFF" opacity="0.9" />
        <path d="M124.5 108 v6.5 M121.2 111.2 h6.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
        <rect x="144" y="84" width="26" height="38" rx="11" fill="url(#diTeal)" />
        <rect x="144" y="84" width="26" height="38" rx="11" fill="none" stroke="#0D9488" strokeWidth="1.8" />
        <path d="M145 98 C136 100 130 100 123 101" stroke="#0F766E" strokeWidth="7" strokeLinecap="round" fill="none" />
        <path d="M155 100 V118" stroke="#0F766E" strokeWidth="7" strokeLinecap="round" />
        <circle cx="157" cy="70" r="10.5" fill="#FFE3C6" />
        <path d="M157 59.5 a10.5 10.5 0 0 1 10.5 10.5 h-21 a10.5 10.5 0 0 1 10.5 -10.5 Z" fill="#0F766E" />
        <path d="M146.5 70 a10.5 10.5 0 0 1 21 0" stroke="#0F766E" strokeWidth="2" fill="none" />
        <path d="M147 71 h20 l-2 3 h-16 Z" fill="#0D9488" />
        <path d="M146.5 76 a10.5 10.5 0 0 0 21 0" stroke="#0F766E" strokeWidth="2" fill="none" />
        <rect x="145" y="119" width="7" height="5" rx="2.5" fill="#0F766E" />
        <rect x="162" y="119" width="7" height="5" rx="2.5" fill="#0F766E" />
      </g>

      <motion.g animate={{ y: [0, -4, 0] }} transition={{ duration: 4.8, repeat: Infinity, ease: "easeInOut" }}>
        <path
          d="M188 26 c-11.5 0 -20.5 9 -20.5 20 c0 14.5 20.5 33 20.5 33 s20.5 -18.5 20.5 -33 c0 -11 -9 -20 -20.5 -20 Z"
          fill="url(#diTeal)"
          stroke="#0D9488"
          strokeWidth="1.8"
        />
        <circle cx="188" cy="45" r="8" fill="#FFFFFF" />
        <circle cx="188" cy="45" r="3.2" fill="#0D9488" />
        <path d="M181 22.5 a14 14 0 0 1 12 -3.5" stroke="#5EEAD4" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
        <circle cx="188" cy="45" r="16.5" stroke="#2DD4BF" strokeWidth="1.5" strokeDasharray="2 4" opacity="0.55" fill="none" />
      </motion.g>
    </svg>
  );
}

/* ── How It Works: compact premium process banner ── */
export default function HowItWorks() {
  return (
    <section className="border-y border-border/50 bg-gradient-to-b from-card/50 to-background overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6">
        {/* Compact header — badge + title inline, subtitle beside on desktop */}
        <div className="flex flex-col items-center gap-1.5 text-center lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:text-left">
          <div className="flex items-center gap-2.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/5 border border-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
              <Zap className="size-3" />
              Simple Process
            </div>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              How It Works
            </h2>
          </div>
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
            One smooth journey from browsing to your doorstep — search, order, receive.
          </p>
        </div>

        {/* Process banner */}
        <div className="relative mt-4 overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-b from-teal-50/70 via-white to-emerald-50/50 shadow-glow sm:mt-5">
          <div className="pointer-events-none absolute -top-16 -right-16 size-52 rounded-full bg-teal-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -left-14 size-52 rounded-full bg-orange-400/10 blur-3xl" />

          <div className="relative grid grid-cols-1 gap-y-3 px-4 py-4 sm:px-6 lg:grid-cols-[1fr_auto_1fr_auto_1fr] lg:items-center lg:gap-x-1.5 lg:px-8 lg:py-4">
            {[
              {
                step: "01",
                title: "Search & Select",
                description:
                  "Browse the catalogue or search for your medicine — check dosage, manufacturer and price in seconds.",
                Illustration: SearchIllustration,
              },
              {
                step: "02",
                title: "Place Your Order",
                description:
                  "Add items to the cart, confirm your address and check out with online payment or cash on delivery.",
                Illustration: OrderIllustration,
              },
              {
                step: "03",
                title: "Receive at Your Door",
                description:
                  "Your order is packed securely and delivered to your doorstep — track it every step of the way.",
                Illustration: DeliveryIllustration,
              },
            ].map((item, i) => (
              <Fragment key={item.step}>
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ delay: i * 0.12, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                  className="group flex items-center gap-4 sm:gap-5 lg:flex-col lg:justify-start lg:gap-0 lg:px-1 lg:text-center"
                >
                  <div className="relative shrink-0 lg:mx-auto lg:w-full lg:max-w-[240px]">
                    <div className="relative flex h-20 w-32 items-center justify-center overflow-hidden rounded-2xl border border-teal-900/5 bg-white shadow-card-hover transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary/15 sm:h-24 sm:w-44 lg:h-24 lg:w-full">
                      <item.Illustration />
                    </div>
                    <div className="absolute -top-2 left-1/2 flex size-7 -translate-x-1/2 items-center justify-center rounded-xl gradient-primary text-white text-[10px] font-bold shadow-md ring-2 ring-white lg:-top-2.5 lg:size-8 lg:text-[11px]">
                      {item.step}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 text-left lg:mt-2 lg:flex-none lg:text-center">
                    <h3 className="text-[13px] font-semibold text-foreground sm:text-sm">
                      {item.title}
                    </h3>
                    <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground lg:mx-auto lg:mt-1 lg:max-w-[240px]">
                      {item.description}
                    </p>
                  </div>
                </motion.div>

                {/* Connector between steps */}
                {i < 2 && (
                  <div aria-hidden className="flex items-center justify-center py-1 lg:w-9 lg:shrink-0 lg:py-0 lg:-mt-8">
                    <div className="flex flex-col items-center gap-1 lg:flex-row lg:gap-0">
                      <span className="h-4 w-px border-l-2 border-dashed border-primary/25 lg:hidden" />
                      <span className="hidden h-px w-5 border-t-2 border-dashed border-primary/25 lg:block" />
                      <span className="flex size-6 items-center justify-center rounded-full border border-primary/15 bg-white text-primary shadow-sm lg:mx-1 lg:size-7">
                        <ArrowRight className="size-3 rotate-90 lg:rotate-0" />
                      </span>
                      <span className="hidden h-px w-5 border-t-2 border-dashed border-primary/25 lg:block" />
                    </div>
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
