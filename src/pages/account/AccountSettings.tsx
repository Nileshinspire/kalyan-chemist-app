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
import { Badge } from "@/components/ui/badge";
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
  ShieldCheck,
  Sun,
} from "lucide-react";
import { toast } from "sonner";
import { type LanguageCode } from "@/lib/i18n";

function Section({
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
    <Card className="border-border/60">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/[0.07]">
            <Icon className="size-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {description && (
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
            <div className="mt-4">{children}</div>
          </div>
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
      className="space-y-5"
    >
      <div>
        <h1 className="text-xl font-bold text-foreground">{t("settings")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("settingsSubtitle")}</p>
      </div>

      <Section
        title={t("language")}
        description={t("languageHint")}
        icon={Globe2}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {languages.map((option) => {
            const active = option.code === language;
            return (
              <button
                key={option.code}
                type="button"
                onClick={() => handleLanguage(option.code as LanguageCode)}
                disabled={!!languageSaving || saving}
                className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? "border-primary/40 bg-primary/[0.05]"
                    : "border-border/60 hover:bg-muted/40"
                }`}
              >
                <div>
                  <p className="text-sm font-semibold">{option.nativeLabel}</p>
                  <p className="text-[11px] text-muted-foreground">{option.label}</p>
                </div>
                {languageSaving === option.code ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : active ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t("languageHint")}
        </p>
      </Section>

      <Section
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
              className={`flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition-colors ${
                current === option.value
                  ? "border-primary/40 bg-primary/[0.05] text-foreground"
                  : "border-border/60 text-muted-foreground hover:bg-muted/40"
              }`}
            >
              <option.icon className="size-4" />
              {option.label}
              {current === option.value && <Check className="ml-auto size-3.5 text-primary" />}
            </button>
          ))}
        </div>
      </Section>

      <Section
        title={t("privacySecurity")}
        description={t("securityHint")}
        icon={ShieldCheck}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
            <div className="flex items-center gap-2.5">
              <Mail className="size-4 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium">{t("signInMethod")}</p>
                <p className="text-[11px] text-muted-foreground">{t("emailOtp")}</p>
              </div>
            </div>
            <span className="max-w-[45%] truncate text-[11px] text-muted-foreground">
              {profile?.email || user?.email || ""}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
            <div className="flex items-center gap-2.5">
              <LockKeyhole className="size-4 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium">{t("privacyPolicy")}</p>
                <p className="text-[11px] text-muted-foreground">
                  How your data is stored and protected
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" className="rounded-lg" onClick={() => navigate("/privacy-policy")}>
              {t("viewAll")} <ChevronRight className="size-3.5" />
            </Button>
          </div>
          <p className="rounded-xl bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
            {t("notificationLocationHint")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() => navigate("/account/notifications")}
          >
            <Bell className="size-3.5" /> {t("goToNotifications")}
          </Button>
        </div>
      </Section>

      <Section title={t("about")} icon={Info}>
        <div className="space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("aboutText")}
          </p>
          <Separator />
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("appVersion")}</span>
            <span className="font-medium text-foreground">1.0.0</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              className="justify-start rounded-xl"
              onClick={() => navigate("/privacy-policy")}
            >
              <ShieldCheck className="size-4" /> {t("privacyPolicy")}
            </Button>
            <Button
              variant="outline"
              className="justify-start rounded-xl"
              onClick={() => navigate("/terms-conditions")}
            >
              <FileText className="size-4" /> {t("terms")}
            </Button>
          </div>
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Mail className="size-3.5" /> Kalyan Chemist · Trusted Pharmacy
          </p>
        </div>
      </Section>
    </motion.div>
  );
}
