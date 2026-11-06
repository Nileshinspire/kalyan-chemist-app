import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { useQuery } from "convex/react";
import { useTheme } from "next-themes";
import { api } from "@/convex/_generated/api";

/**
 * Keeps the rendered theme in step with the signed-in account.
 *
 * A customer's storefront preference and an admin's panel preference are stored
 * separately, so switching between /admin and the store applies the right one.
 * Signed-out visitors keep their device-local choice (next-themes' storage).
 */
export function ThemePreferenceSync() {
  const { pathname } = useLocation();
  const preference = useQuery(api.account.getThemePreference);
  const { theme, setTheme } = useTheme();
  const lastAppliedRef = useRef<string | null>(null);

  const scope = pathname.startsWith("/admin") ? "admin" : "customer";
  const savedTheme = preference
    ? scope === "admin"
      ? preference.adminTheme
      : preference.theme
    : null;

  useEffect(() => {
    if (!savedTheme) {
      // Signed out (or still loading): leave the device preference alone.
      lastAppliedRef.current = null;
      return;
    }
    if (theme === savedTheme) {
      lastAppliedRef.current = savedTheme;
      return;
    }
    // Avoid re-applying the same account value on every render.
    if (lastAppliedRef.current === savedTheme) return;
    lastAppliedRef.current = savedTheme;
    setTheme(savedTheme);
  }, [savedTheme, theme, setTheme]);

  return null;
}
