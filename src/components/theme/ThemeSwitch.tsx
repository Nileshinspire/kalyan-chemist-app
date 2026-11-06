import { Loader2, Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useThemeChoice } from "@/components/theme/useThemeChoice";

/**
 * Compact "Dark mode" row used in the account menu and profile. Shares the
 * same persistence logic as the Light/Dark segmented control.
 */
export function ThemeSwitch({
  scope = "customer",
  label = "Dark mode",
  className = "",
}: {
  scope?: "customer" | "admin";
  label?: string;
  className?: string;
}) {
  const { current, saving, choose } = useThemeChoice(scope);
  const dark = current === "dark";

  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <span className="flex items-center gap-2 text-sm text-foreground">
        {dark ? <Moon className="size-4" /> : <Sun className="size-4" />}
        {label}
      </span>
      {saving ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : (
        <Switch
          checked={dark}
          onCheckedChange={(checked) => choose(checked ? "dark" : "light")}
          aria-label={label}
        />
      )}
    </div>
  );
}
