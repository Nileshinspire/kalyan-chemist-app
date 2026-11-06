import { Loader2, Moon, Sun } from "lucide-react";
import { useThemeChoice, type ThemeChoice } from "@/components/theme/useThemeChoice";

/**
 * Light/Dark segmented switch. Writes the choice to the signed-in user's record
 * (so it survives logout/login on any device) and applies it immediately.
 * Admins get their own stored preference, independent of the storefront one.
 */
export function ThemeToggle({ scope = "customer" }: { scope?: "customer" | "admin" }) {
  const { current, saving, choose } = useThemeChoice(scope);

  const options: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
  ];

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-muted/60 p-1"
    >
      {options.map((option) => {
        const active = current === option.value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => choose(option.value)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {saving === option.value ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Icon className="size-3.5" />
            )}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
