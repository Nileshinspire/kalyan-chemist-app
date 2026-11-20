import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/context/AuthContext";
import {
  SUPPORTED_LANGUAGES,
  isLanguageCode,
  translate,
  type LanguageCode,
} from "@/lib/i18n";

const STORAGE_KEY = "kc_language";

type LanguageContextValue = {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => Promise<void>;
  t: (key: string, fallback?: string) => string;
  languages: { code: string; label: string; nativeLabel: string; isActive: boolean }[];
  saving: boolean;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

function storedLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return isLanguageCode(saved) ? saved : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [language, setLanguageState] = useState<LanguageCode>(storedLanguage);
  const [saving, setSaving] = useState(false);

  const savedLanguage = useQuery(
    api.localization.getMyLanguage,
    isAuthenticated ? {} : "skip",
  );
  const config = useQuery(api.localization.getConfig, {});
  const overrides = useQuery(api.localization.getDictionary, { language });
  const saveLanguage = useMutation(api.localization.setMyLanguage);

  const languages = useMemo(() => {
    const rows = config?.languages ?? SUPPORTED_LANGUAGES.map((l) => ({ ...l, isActive: true }));
    return rows.filter((row: any) => row.isActive);
  }, [config]);

  // Account preference wins after sign-in; the device copy covers refresh and
  // signed-out screens.
  useEffect(() => {
    if (isLanguageCode(savedLanguage) && savedLanguage !== language) {
      setLanguageState(savedLanguage);
      window.localStorage.setItem(STORAGE_KEY, savedLanguage);
    }
  }, [savedLanguage, language]);

  // If an admin disables the selected language, fall back to English instead
  // of rendering a partial interface.
  useEffect(() => {
    if (!config) return;
    const active = config.languages.some(
      (row: any) => row.code === language && row.isActive,
    );
    if (!active && language !== "en") {
      setLanguageState("en");
      window.localStorage.setItem(STORAGE_KEY, "en");
    }
  }, [config, language]);

  const setLanguage = useCallback(
    async (next: LanguageCode) => {
      if (!isLanguageCode(next)) return;
      const previous = language;
      setLanguageState(next);
      window.localStorage.setItem(STORAGE_KEY, next);
      if (!isAuthenticated) return;
      setSaving(true);
      try {
        await saveLanguage({ language: next });
      } catch (error) {
        setLanguageState(previous);
        window.localStorage.setItem(STORAGE_KEY, previous);
        throw error;
      } finally {
        setSaving(false);
      }
    },
    [isAuthenticated, language, saveLanguage],
  );

  const t = useCallback(
    (key: string, fallback?: string) => {
      const value = translate(language, key, overrides ?? null);
      if (value === key && fallback) return fallback;
      return value;
    },
    [language, overrides],
  );

  const value = useMemo(
    () => ({ language, setLanguage, t, languages, saving }),
    [language, setLanguage, t, languages, saving],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
