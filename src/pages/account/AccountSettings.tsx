import { useNavigate } from "react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useThemeChoice } from "@/components/theme/useThemeChoice";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  Check,
  ChevronRight,
  FileText,
  Globe2,
  Info,
  Loader2,
  LockKeyhole,
  Mail,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { toast } from "sonner";
import { type LanguageCode } from "@/lib/i18n";

function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description?: string;
  icon: typeof Globe2;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border-border/60">
      <CardContent className="p-0">
        <div className="flex items-start gap-3 px-4 py-4 sm:px-5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/[0.07] ring-1 ring-primary/10">
            <Icon className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {description && (
              <p className="mt-0.5 break-words text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                {description}
              </p>
            )}
          </div>
        </div>
        <div className="border-t border-border/50 bg-muted/[0.18] p-3 sm:p-4">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AccountSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language, setLanguage, languages, saving } = useLanguage();
  const { current, saving: savingTheme, choose } = useThemeChoice("customer");
  const [languageSaving, setLanguageSaving] = useState<string | null>(null);

  async function handleLanguage(next: LanguageCode) {
    if (next === language || languageSaving) return;
    setLanguageSaving(next);
    try {
      await setLanguage(next);
      toast.success(t("languageSaved"));
    } catch (error: any) {
      toast.error(error?.message || t("somethingWentWrong"));
    } finally {
      setLanguageSaving(null);
    }
  }

  const profile = useQuery(api.account.getProfile);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto w-full max-w-3xl space-y-4 sm:space-y-5"
    >
      <div className="overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/[0.09] via-primary/[0.035] to-background p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <Settings className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {t("settings")}
            </h1>
            <p className="mt-1 max-w-lg text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {t("settingsSubtitle")}
            </p>
          </div>
        </div>
      </div>

      <SettingsSection
        title={t("language")}
        description={t("languageHint")}
        icon={Globe2}
      >
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {languages.map((option) => {
            const active = option.code === language;
            return (
              <button
                key={option.code}
                type="button"
                onClick={() => handleLanguage(option.code as LanguageCode)}
                disabled={!!languageSaving || saving}
                aria-pressed={active}
                className={`relative flex min-h-[84px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border p-2.5 text-center transition-all ${
                  active
                    ? "border-primary/40 bg-background shadow-sm ring-1 ring-primary/20"
                    : "border-border/60 bg-background/60 hover:border-primary/20 hover:bg-background"
                } disabled:cursor-not-allowed disabled:opacity-70`}
              >
                <span className="absolute right-2 top-2 flex size-4 items-center justify-center">
                  {languageSaving === option.code ? (
                    <Loader2 className="size-3.5 animate-spin text-primary" />
                  ) : active ? (
                    <span className="flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-2.5" />
                    </span>
                  ) : null}
                </span>
                <span className="max-w-full break-words text-base font-semibold leading-tight text-foreground">
                  {option.nativeLabel}
                </span>
                <span className="text-[10px] leading-tight text-muted-foreground">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection
        title={t("appearance")}
        description={t("appearanceHint")}
        icon={Sun}
      >
        <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
          {[
            { value: "light" as const, label: t("lightMode"), icon: Sun },
            { value: "dark" as const, label: t("darkMode"), icon: Moon },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => choose(option.value)}
              disabled={!!savingTheme}
              aria-pressed={current === option.value}
              className={`flex min-h-[64px] min-w-0 items-center gap-2.5 rounded-xl border p-3 text-left text-xs font-medium transition-all ${
                current === option.value
                  ? "border-primary/40 bg-background text-foreground shadow-sm ring-1 ring-primary/20"
                  : "border-border/60 bg-background/60 text-muted-foreground hover:border-primary/20 hover:bg-background"
              } disabled:cursor-not-allowed disabled:opacity-70`}
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
                  current === option.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <option.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1 leading-snug">{option.label}</span>
              {current === option.value && <Check className="size-3.5 shrink-0 text-primary" />}
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection
        title={t("privacySecurity")}
        description={t("securityHint")}
        icon={ShieldCheck}
      >
        <div className="space-y-2">
          <div className="rounded-xl border border-border/60 bg-background/70 p-3">
            <div className="flex items-start gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Mail className="size-4 text-muted-foreground" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground">{t("signInMethod")}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{t("emailOtp")}</p>
                {(profile?.email || user?.email) && (
                  <p className="mt-1.5 truncate rounded-md bg-muted/60 px-2 py-1 text-[10px] text-muted-foreground">
                    {profile?.email || user?.email}
                  </p>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/privacy-policy")}
            className="flex w-full items-center gap-2.5 rounded-xl border border-border/60 bg-background/70 p-3 text-left transition-colors hover:border-primary/20 hover:bg-background"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
              <LockKeyhole className="size-4 text-muted-foreground" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-foreground">{t("privacyPolicy")}</span>
              <span className="block text-[11px] leading-relaxed text-muted-foreground">
                How your data is stored and protected
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </button>

          <div className="rounded-xl bg-muted/45 p-3">
            <p className="break-words text-[10px] leading-relaxed text-muted-foreground">
              {t("notificationLocationHint")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2 h-9 w-full rounded-lg bg-background/70 text-[11px] sm:w-auto"
              onClick={() => navigate("/account/notifications")}
            >
              <Bell className="size-3.5" /> {t("goToNotifications")}
            </Button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={t("about")} icon={Info}>
        <div className="space-y-3">
          <p className="break-words text-xs leading-relaxed text-muted-foreground sm:text-sm">
            {t("aboutText")}
          </p>
          <Separator />
          <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
            <span className="text-muted-foreground">{t("appVersion")}</span>
            <span className="rounded-md bg-background px-2 py-1 font-medium text-foreground ring-1 ring-border/50">
              1.0.0
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              className="h-10 min-w-0 justify-start rounded-xl bg-background/70 text-xs"
              onClick={() => navigate("/privacy-policy")}
            >
              <ShieldCheck className="size-4 shrink-0" />
              <span className="truncate">{t("privacyPolicy")}</span>
            </Button>
            <Button
              variant="outline"
              className="h-10 min-w-0 justify-start rounded-xl bg-background/70 text-xs"
              onClick={() => navigate("/terms-conditions")}
            >
              <FileText className="size-4 shrink-0" />
              <span className="truncate">{t("terms")}</span>
            </Button>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-background/60 p-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[10px] font-bold text-primary">
              KC
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-foreground">Kalyan Chemist</p>
              <p className="truncate text-[10px] text-muted-foreground">Trusted Pharmacy</p>
            </div>
          </div>
        </div>
      </SettingsSection>
    </motion.div>
  );
}
