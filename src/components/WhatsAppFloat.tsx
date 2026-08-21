import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const PHARMACY_PHONE = "919876543210"; // Default — override via delivery_config

/**
 * Floating WhatsApp button for customer-facing pages.
 * Shows a recognizable green WhatsApp icon with pulse animation.
 * Opens WhatsApp conversation with the pharmacy.
 */
export default function WhatsAppFloat() {
  const [showTooltip, setShowTooltip] = useState(false);

  // Show tooltip after 3 seconds on page load
  useEffect(() => {
    const timer = setTimeout(() => setShowTooltip(true), 3000);
    const hideTimer = setTimeout(() => setShowTooltip(false), 8000);
    return () => {
      clearTimeout(timer);
      clearTimeout(hideTimer);
    };
  }, []);

  const handleOpenChat = () => {
    const message = encodeURIComponent(
      "💊 Namaste! Welcome to Kalyan Chemist.\n\nI would like to enquire about medicines."
    );
    window.open(
      `https://wa.me/${PHARMACY_PHONE}?text=${message}`,
      "_blank",
      "noopener,noreferrer"
    );
    setShowTooltip(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Tooltip */}
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className="relative bg-white rounded-2xl shadow-xl border border-gray-100 px-4 py-3 max-w-[220px]"
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

      {/* WhatsApp Button */}
      <motion.button
        onClick={handleOpenChat}
        className="relative group"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Chat on WhatsApp"
      >
        {/* Pulse animation ring */}
        <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20" />

        {/* Main button */}
        <div className="relative size-14 rounded-full bg-[#25D366] hover:bg-[#20BA5C] shadow-lg shadow-[#25D366]/30 flex items-center justify-center transition-all duration-200 group-hover:shadow-xl group-hover:shadow-[#25D366]/40">
          {/* WhatsApp SVG Icon */}
          <svg
            viewBox="0 0 32 32"
            fill="white"
            className="size-7"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16c0 3.5 1.132 6.744 3.058 9.374L1.054 31.25l6.118-1.97C9.82 30.86 12.828 32 16.004 32 24.83 32 32 24.822 32 16S24.83 0 16.004 0zm9.378 22.608c-.39 1.1-1.932 2.014-3.156 2.28-.84.18-1.938.322-5.624-1.206-4.72-1.952-7.758-6.73-7.992-7.042-.226-.312-1.896-2.524-1.896-4.814s1.2-3.412 1.626-3.88c.39-.428.922-.56 1.226-.56.3 0 .596.004.856.016.276.01.648-.104 1.012.772.39.95 1.298 3.326 1.41 3.566.11.24.186.52.038.832-.148.312-.278.506-.518.782-.24.276-.468.49-.71.786-.216.256-.456.532-.188.984.268.452 1.192 1.968 2.556 3.19 1.756 1.574 3.162 2.06 3.704 2.286.412.17.852.128 1.15-.234.38-.464.85-1.218 1.33-1.956.34-.526.776-.59 1.25-.398.48.192 3.042 1.434 3.564 1.696.522.262.87.394 1 .612.128.22.128 1.256-.262 2.356z" />
          </svg>
        </div>
      </motion.button>
    </div>
  );
}
