import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedToggleProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group, e.g. "Sign-in method". */
  label: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Roving-tabindex segmented control (WAI-ARIA "tabs" pattern, arrow-key
 * navigation) used to pick a sign-in method. Only the selected tab is in the
 * tab order, so keyboard users never have to tab through both options.
 */
export function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  label,
  disabled,
  className,
}: SegmentedToggleProps<T>) {
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = options.findIndex((option) => option.value === value);
    if (index === -1) return;
    const delta = event.key === "ArrowRight" ? 1 : -1;
    // Wrap around so arrow navigation never dead-ends.
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].value);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        "grid gap-1 rounded-xl border border-white/10 bg-black/25 p-1",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            id={`segmented-${option.value}`}
            aria-selected={selected}
            // Only the active tab is reachable via Tab; arrows move between.
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 py-2.5",
              "text-sm font-medium transition-all duration-200 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-950",
              "disabled:cursor-not-allowed disabled:opacity-60",
              selected
                ? "bg-emerald-500 text-white shadow-sm"
                : "text-emerald-100/70 hover:bg-white/5 hover:text-emerald-50",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
