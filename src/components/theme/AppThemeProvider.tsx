import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * Applies the existing `.dark` token block from index.css by toggling the class
 * on <html>. Uses next-themes (already a project dependency, also used by the
 * Toaster) so the stored device preference is applied before the first paint.
 *
 * Light is the default so a first-time visitor sees the storefront exactly as
 * it is today. System theme is intentionally not followed automatically — the
 * customer chooses.
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      storageKey="kc_theme"
    >
      {children}
    </NextThemesProvider>
  );
}
