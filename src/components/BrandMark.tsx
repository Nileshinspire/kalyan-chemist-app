import type { CSSProperties } from "react";

/**
 * The single canonical Kalyan Chemist brand symbol — the green hexagonal
 * pharmacy mark with the white medical cross (public/logo.svg).
 *
 * One source asset is reused everywhere (header, footer, auth, 404, about,
 * canvas scenes, favicon, notifications); only size/spacing adapt per
 * placement, never the artwork itself.
 */
export const BRAND_MARK_SRC = "/logo.svg";

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
      draggable={false}
      className={`shrink-0 object-contain ${className}`}
      style={style}
    />
  );
}
