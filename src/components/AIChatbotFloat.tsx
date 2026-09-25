import { useNavigate, useLocation } from "react-router";
import { Bot, Sparkles } from "lucide-react";
import { preloadRoute } from "@/lib/route-preload";

/**
 * Global floating AI assistant button (customer side).
 *
 * A single instance is mounted at the app root (inside the router), so it
 * stays available across every customer-facing page. It opens the SAME
 * existing /chatbot experience (the one the homepage Quick Function opens) —
 * no second chatbot, no duplicate logic.
 *
 * Positioned as a clean vertical stack ABOVE the existing WhatsApp float
 * (bottom-6): this button sits at bottom-24, and slightly higher on the
 * homepage so the WhatsApp welcome tooltip (shown ~3–8s after load) never
 * covers it.
 */
export default function AIChatbotFloat() {
  const navigate = useNavigate();
  const location = useLocation();

  // Customer-facing only: not on the chatbot page itself (you're already
  // there) and not on admin pages.
  if (location.pathname === "/chatbot" || location.pathname.startsWith("/admin")) {
    return null;
  }

  const isHome = location.pathname === "/";
  const verticalOffset = isHome ? "bottom-44" : "bottom-24";

  return (
    <div className={`group fixed ${verticalOffset} right-6 z-50 flex items-center gap-3`}>
      {/* Hover label (desktop only) */}
      <span className="pointer-events-none hidden translate-x-1 rounded-full border border-border/60 bg-white px-3 py-1.5 text-[11px] font-semibold text-foreground/80 opacity-0 shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 sm:block">
        Ask Kalyan Chemist AI
      </span>

      <button
        onMouseEnter={() => preloadRoute("/chatbot")}
        onFocus={() => preloadRoute("/chatbot")}
        onClick={() => navigate("/chatbot")}
        aria-label="Open Kalyan Chemist AI assistant"
        className="relative outline-none"
      >
        {/* Soft glow behind the button */}
        <span className="absolute inset-0 rounded-full bg-[oklch(0.45_0.12_170)]/25 opacity-60 blur-md transition-opacity duration-200 group-hover:opacity-90" />

        {/* Main button — teal brand gradient, premium finish */}
        <span className="relative flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-[oklch(0.42_0.09_170)] to-[oklch(0.36_0.09_173)] text-white shadow-lg shadow-[oklch(0.45_0.12_170)]/30 ring-1 ring-white/20 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-xl group-hover:shadow-[oklch(0.45_0.12_170)]/40 group-active:translate-y-0 group-active:scale-95">
          <Bot className="size-6" />
        </span>

        {/* AI sparkle badge */}
        <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-emerald-400 text-white shadow-sm ring-2 ring-white transition-transform duration-200 group-hover:scale-110">
          <Sparkles className="size-3" />
        </span>
      </button>
    </div>
  );
}