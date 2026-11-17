import { Star } from "lucide-react";

/**
 * The customer rating summary, rendered in the two places the storefront shows
 * it: the compact pill beside a product card's name, and the badge in the
 * bottom-left corner of the Product Details packshot.
 *
 * Both appearances are fed by the SAME `reviews.getAverageRating` query, so
 * there is one rating definition in the app. With no saved reviews there is
 * nothing to show — the caller renders no badge at all rather than a
 * placeholder star or a zero count.
 */
export type RatingSummary = { average: number; count: number };

export function hasRatingSummary(
  summary: RatingSummary | null | undefined,
): summary is RatingSummary {
  return Boolean(
    summary &&
      Number.isFinite(summary.average) &&
      Number.isFinite(summary.count) &&
      summary.average > 0 &&
      summary.count > 0,
  );
}

export function ratingSummaryLabel({ average, count }: RatingSummary) {
  return {
    title: `${count} ${count === 1 ? "review" : "reviews"}`,
    ariaLabel: `Rated ${average.toFixed(1)} out of 5 by ${count} ${count === 1 ? "review" : "reviews"}`,
  };
}

export function RatingSummaryBadge({
  average,
  count,
  variant = "card",
  className = "",
}: {
  average: number;
  count: number;
  /** `card` = pill beside the product name, `plate` = overlay on the packshot. */
  variant?: "card" | "plate";
  className?: string;
}) {
  if (!hasRatingSummary({ average, count })) return null;
  const { title, ariaLabel } = ratingSummaryLabel({ average, count });

  if (variant === "plate") {
    return (
      <span
        title={title}
        aria-label={ariaLabel}
        data-slot="rating-badge"
        className={`pointer-events-none inline-flex items-center gap-1 rounded-md border border-border/70 bg-white px-1.5 py-0.5 text-[11px] leading-none font-bold text-foreground shadow-sm sm:text-xs ${className}`}
      >
        {average.toFixed(1)}
        <Star className="size-2.5 fill-emerald-600 text-emerald-600 sm:size-3" aria-hidden />
        <span className="h-2.5 w-px bg-border sm:h-3" aria-hidden />
        <span className="font-medium text-muted-foreground">{count}</span>
      </span>
    );
  }

  return (
    <span
      title={title}
      aria-label={ariaLabel}
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-600 px-1 py-0.5 text-[9px] leading-3 font-semibold text-white shadow-sm sm:gap-1 sm:px-1.5 sm:text-[10px] ${className}`}
    >
      <Star className="size-2 fill-white text-white sm:size-2.5" aria-hidden />
      {average.toFixed(1)}
      <span className="font-normal text-white/85">({count})</span>
    </span>
  );
}
