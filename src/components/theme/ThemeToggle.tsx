import { useState } from "react";
import { useMutation } from "convex/react";
import { useTheme } from "next-themes";
import { Loader2, Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/context/AuthContext";

type ThemeChoice = "light" | "dark";

/**
 * Light/Dark switch. Writes the choice to the signed-in user's record (so it
 * survives logout/login on any device) and applies it immediately. Admins get
 * their own stored preference, independent of the storefront one.
 */
export function ThemeToggle({ scope = "customer" }: { scope?: "customer" | "admin" }) {
  const { resolvedTheme, setTheme } = useTheme();
  const { isAuthenticated } = useAuth();
  const saveTheme = useMutation(api.account.setTheme);
  const [saving, setSaving] = useState<ThemeChoice | null>(null);

  const current: ThemeChoice = resolvedTheme === "dark" ? "dark" : "light";

  async function choose(next: ThemeChoice) {
    if (next === current || saving) return;
    setSaving(next);
    try {
      if (isAuthenticated) {
        await saveTheme({ theme: next, scope });
      }
      setTheme(next);
    } catch (error: any) {
      toast.error(error?.message ?? "Could not save your theme preference");
    } finally {
      setSaving(null);
    }
  }

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
