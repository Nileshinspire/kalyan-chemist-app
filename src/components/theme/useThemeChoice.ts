import { useCallback, useState } from "react";
import { useMutation } from "convex/react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/context/AuthContext";

export type ThemeChoice = "light" | "dark";

/**
 * Single source of truth for changing the theme.
 *
 * The class is applied immediately so the toggle always responds, then the
 * choice is saved to the signed-in user (storefront and admin preferences are
 * stored separately). A storage failure never blocks the visual change.
 */
export function useThemeChoice(scope: "customer" | "admin" = "customer") {
  const { resolvedTheme, setTheme } = useTheme();
  const { isAuthenticated } = useAuth();
  const saveTheme = useMutation(api.account.setTheme);
  const [saving, setSaving] = useState<ThemeChoice | null>(null);

  const current: ThemeChoice = resolvedTheme === "dark" ? "dark" : "light";

  const choose = useCallback(
    async (next: ThemeChoice) => {
      if (next === current || saving) return;
      setSaving(next);
      // Apply first — the toggle must work even if the save call is slow/fails.
      setTheme(next);
      try {
        if (isAuthenticated) {
          await saveTheme({ theme: next, scope });
        }
      } catch (error: any) {
        toast.error(error?.message ?? "Theme applied, but could not be saved to your account");
      } finally {
        setSaving(null);
      }
    },
    [current, saving, setTheme, saveTheme, isAuthenticated, scope],
  );

  return { current, saving, choose };
}
