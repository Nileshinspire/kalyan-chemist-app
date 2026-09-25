import type { CSSProperties } from "react";
import kalyanChemistSymbol from "@/assets/kalyan-chemist-symbol.svg";

/**
 * The single canonical Kalyan Chemist brand symbol — the green hexagonal
 * pharmacy mark with the white medical cross.
 *
 * Vite fingerprints this local source asset so it cannot be replaced by a
 * platform-reserved root URL in preview or production.
 */
export const BRAND_MARK_SRC = kalyanChemistSymbol;

interface BrandMarkProps {
  /** Tailwind size classes — e.g. "size-7", "size-8", "size-9". */
  className?: string;
  /**
   * Alt text. Defaults to "" (decorative) because placements pair the mark
   * with the visible "Kalyan Chemist" wordmark text.
   */
  alt?: string;
  /** Optional presentation-only effects (e.g. a background-safe glow). */
  style?: CSSProperties;
}

export default function BrandMark({
  className = "size-9",
  alt = "",
  style,
}: BrandMarkProps) {
  return (
    <img
      src={BRAND_MARK_SRC}
      alt={alt}
      width={512}
      height={512}
      decoding="async"
      draggable={false}
      className={`shrink-0 object-contain ${className}`}
      style={style}
    />
  );
}
