import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Pill, PackageSearch, FileText, Stethoscope } from "lucide-react";
import { openStoreWhatsApp } from "@/lib/whatsappConfig";
import {
  WHATSAPP_ASSISTANCE_OPTIONS,
  generateAssistanceMessage,
  type WhatsAppAssistanceOptionId,
} from "@/lib/whatsapp";

/** Icon per assistance option — the option copy itself lives in the lib. */
const OPTION_ICONS: Record<WhatsAppAssistanceOptionId, typeof Pill> = {
  medicine_enquiry: Pill,
  order_support: PackageSearch,
  prescription_help: FileText,
  pharmacist: Stethoscope,
};

/**
 * Floating WhatsApp button for customer-facing pages.
 * Shows a recognizable green WhatsApp icon with pulse animation.
 * Clicking it opens a small assistance panel; choosing an option opens
 * WhatsApp (Click-to-Chat) with a pre-filled message. Nothing is auto-sent.
 */
export default function WhatsAppFloat() {
  const [showTooltip, setShowTooltip] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [details, setDetails] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Show tooltip after 3 seconds on page load
  useEffect(() => {
    const timer = setTimeout(() => setShowTooltip(true), 3000);
    const hideTimer = setTimeout(() => setShowTooltip(false), 8000);
    return () => {
      clearTimeout(timer);
      clearTimeout(hideTimer);
    };
  }, []);

  // Close the panel on Escape or on a click outside it
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPanelOpen(false);
    };
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setPanelOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [panelOpen]);

  const handleSelect = (option: WhatsAppAssistanceOptionId) => {
    openStoreWhatsApp(generateAssistanceMessage(option, details));
    setPanelOpen(false);
    setShowTooltip(false);
  };

  // Mobile lifts the button above the app's bottom navigation (below `md`);
  // from `md` up the original desktop position is restored exactly.
  return (
    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-50 flex flex-col items-end gap-3 md:bottom-[max(1.5rem,env(safe-area-inset-bottom))] sm:right-[max(1.5rem,env(safe-area-inset-right))]">
      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && !panelOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="relative hidden md:block bg-white rounded-2xl shadow-xl border border-gray-100 px-3.5 py-2.5 max-w-[200px] sm:px-4 sm:py-3 sm:max-w-[220px]"
          >
            <button
              onClick={() => setShowTooltip(false)}
              className="absolute -top-2 -right-2 size-5 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <X className="size-3 text-gray-500" />
            </button>
            <p className="text-sm font-medium text-gray-800">
              💊 Order medicines on WhatsApp!
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Chat with our pharmacist for quick assistance
            </p>
            {/* Tooltip arrow */}
            <div className="absolute -bottom-2 right-6 w-4 h-4 bg-white border-r border-b border-gray-100 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assistance panel */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-gray-100 bg-white shadow-2xl overflow-hidden"
            role="dialog"
            aria-label="WhatsApp assistance"
          >
            <div className="flex items-start justify-between gap-2 bg-[#25D366] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-white">How can we help?</p>
                <p className="text-[11px] text-white/90">
                  Choose an option to chat with our pharmacist
                </p>
              </div>
              <button
                onClick={() => setPanelOpen(false)}
                aria-label="Close WhatsApp assistance"
                className="rounded-full p-1 text-white/90 hover:bg-white/20 transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="p-3 space-y-1.5">
              {WHATSAPP_ASSISTANCE_OPTIONS.map((option) => {
                const Icon = OPTION_ICONS[option.id];
                return (
                  <button
                    key={option.id}
                    onClick={() => handleSelect(option.id)}
                    className="flex w-full items-start gap-2.5 rounded-xl border border-gray-100 px-3 py-2 text-left transition-colors hover:border-[#25D366]/40 hover:bg-[#25D366]/5"
                  >
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-[#25D366]/10 text-[#128C4A]">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-gray-800">
                        {option.label}
                      </span>
                      <span className="block text-[11px] leading-snug text-gray-500">
                        {option.description}
                      </span>
                    </span>
                  </button>
                );
              })}

              <label className="block pt-1">
                <span className="mb-1 block text-[11px] font-medium text-gray-600">
                  Your question or order number (optional)
                </span>
                <input
                  value={details}
                  onChange={(event) => setDetails(event.target.value)}
                  placeholder="e.g. Dolo 650 availability"
                  className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-800 outline-none focus:border-[#25D366]"
                />
              </label>

              <p className="pt-1 text-center text-[10px] leading-snug text-gray-400">
                Opens WhatsApp with a ready message — you press Send.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WhatsApp Button */}
      <motion.button
        onClick={() => {
          setPanelOpen((open) => !open);
          setShowTooltip(false);
        }}
        className="relative group"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Chat on WhatsApp"
        aria-expanded={panelOpen}
      >
        {/* Pulse animation ring */}
        <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20" />

        {/* Main button */}
        <div className="relative size-12 rounded-full bg-[#25D366] hover:bg-[#20BA5C] shadow-lg shadow-[#25D366]/30 flex items-center justify-center transition-all duration-200 group-hover:shadow-xl group-hover:shadow-[#25D366]/40 sm:size-14">
          {/* WhatsApp SVG Icon */}
          <svg
            viewBox="0 0 32 32"
            fill="white"
            className="size-6 sm:size-7"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16c0 3.5 1.132 6.744 3.058 9.374L1.054 31.25l6.118-1.97C9.82 30.86 12.828 32 16.004 32 24.83 32 32 24.822 32 16S24.83 0 16.004 0zm9.378 22.608c-.39 1.1-1.932 2.014-3.156 2.28-.84.18-1.938.322-5.624-1.206-4.72-1.952-7.758-6.73-7.992-7.042-.226-.312-1.896-2.524-1.896-4.814s1.2-3.412 1.626-3.88c.39-.428.922-.56 1.226-.56.3 0 .596.004.856.016.276.01.648-.104 1.012.772.39.95 1.298 3.326 1.41 3.566.11.24.186.52.038.832-.148.312-.278.506-.518.782-.24.276-.468.49-.71.786-.216.256-.456.532-.188.984.268.452 1.192 1.968 2.556 3.19 1.756 1.574 3.162 2.06 3.704 2.286.412.17.852.128 1.15-.234.38-.464.85-1.218 1.33-1.956.34-.526.776-.59 1.25-.398.48.192 3.042 1.434 3.564 1.696.522.262.87.394 1 .612.128.22.128 1.256-.262 2.356z" />
          </svg>
        </div>
      </motion.button>
    </div>
  );
}
