import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  Check,
  Globe2,
  Languages,
  Loader2,
  Pencil,
  Save,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { INTERFACE_KEYS } from "@/lib/i18n";

type LanguageRow = {
  code: string;
  label: string;
  nativeLabel: string;
  isActive: boolean;
  sortOrder: number;
  overrideCount: number;
  missingCount: number;
};

type TranslationRow = {
  _id: Id<"app_translations">;
  languageCode: string;
  key: string;
  value: string;
  updatedAt: number;
};

export default function AdminLanguages() {
  const settings = useQuery(api.localization.adminGetSettings);
  const usage = useQuery(api.localization.adminUsage);
  const updateLanguages = useMutation(api.localization.adminUpdateLanguages);
  const upsertTranslation = useMutation(api.localization.adminUpsertTranslation);
  const deleteTranslation = useMutation(api.localization.adminDeleteTranslation);

  const [rows, setRows] = useState<LanguageRow[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [language, setLanguage] = useState("hi");
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [savingTranslation, setSavingTranslation] = useState(false);
  const [editingId, setEditingId] = useState<Id<"app_translations"> | null>(null);

  const translations = useQuery(api.localization.adminListTranslations, { language });

  useEffect(() => {
    if (settings && !initialized) {
      setRows(settings.languages as LanguageRow[]);
      setInitialized(true);
    }
  }, [settings, initialized]);

  const missingKeys = useMemo(() => {
    const overridden = new Set((translations ?? []).map((row) => row.key));
    return INTERFACE_KEYS.filter((sourceKey) => !overridden.has(sourceKey));
  }, [translations]);

  async function handleSaveLanguages() {
    setSaving(true);
    try {
      await updateLanguages({
        languages: rows.map((row) => ({
          code: row.code,
          label: row.label,
          nativeLabel: row.nativeLabel,
          isActive: row.isActive,
          sortOrder: row.sortOrder,
        })),
      });
      toast.success("Language availability saved");
    } catch (error: any) {
      toast.error(error?.message || "Could not save language settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTranslation() {
    if (!key.trim() || !value.trim()) {
      toast.error("Choose a key and enter the translated text.");
      return;
    }
    setSavingTranslation(true);
    try {
      await upsertTranslation({ language, key: key.trim(), value: value.trim() });
      toast.success("Translation saved");
      setKey("");
      setValue("");
      setEditingId(null);
    } catch (error: any) {
      toast.error(error?.message || "Could not save the translation");
    } finally {
      setSavingTranslation(false);
    }
  }

  function beginEdit(row: TranslationRow) {
    setEditingId(row._id);
    setKey(row.key);
    setValue(row.value);
  }

  async function handleDeleteTranslation(id: Id<"app_translations">) {
    try {
      await deleteTranslation({ translationId: id });
      toast.success("Translation removed");
      if (editingId === id) {
        setEditingId(null);
        setKey("");
        setValue("");
      }
    } catch (error: any) {
      toast.error(error?.message || "Could not remove the translation");
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Languages className="size-6 text-primary" /> Language & Translations
          </h1>
          <p className="text-sm text-muted-foreground">
            Enable languages, review missing labels and manage reviewed interface translations.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Supported languages</p>
              <p className="text-2xl font-bold">{rows.filter((r) => r.isActive).length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Interface keys</p>
              <p className="text-2xl font-bold">{settings?.totalInterfaceKeys ?? 0}</p>
            </CardContent>
          </Card>
          {(["hi", "mr"] as const).map((code) => (
            <Card key={code}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">
                  {code === "hi" ? "Hindi" : "Marathi"} overrides
                </p>
                <p className="text-2xl font-bold">
                  {rows.find((r) => r.code === code)?.overrideCount ?? 0}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Language availability</CardTitle>
            <Button size="sm" onClick={handleSaveLanguages} disabled={saving}>
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Save
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {rows.map((row, index) => (
              <div
                key={row.code}
                className="flex flex-col gap-3 rounded-xl border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-primary/[0.07]">
                    <Globe2 className="size-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {row.nativeLabel}{" "}
                      <span className="text-xs font-normal text-muted-foreground">
                        ({row.label})
                      </span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {row.code === "en"
                        ? "Source language · always enabled"
                        : `${row.overrideCount} custom overrides · all interface labels available`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    className="h-8 w-16"
                    value={row.sortOrder}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((item, i) =>
                          i === index
                            ? { ...item, sortOrder: Number(e.target.value) || 0 }
                            : item,
                        ),
                      )
                    }
                    aria-label="Display order"
                  />
                  <span className="text-[11px] text-muted-foreground">Active</span>
                  <Switch
                    checked={row.isActive}
                    disabled={row.code === "en"}
                    onCheckedChange={(checked) =>
                      setRows((prev) =>
                        prev.map((item, i) =>
                          i === index ? { ...item, isActive: checked } : item,
                        ),
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Translation editor</CardTitle>
              <p className="text-xs text-muted-foreground">
                English is the source. Add reviewed Hindi or Marathi text that overrides the
                built-in interface label.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Language</Label>
                  <Select
                    value={language}
                    onValueChange={(next) => {
                      setLanguage(next);
                      setEditingId(null);
                      setKey("");
                      setValue("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hi">Hindi</SelectItem>
                      <SelectItem value="mr">Marathi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Interface key</Label>
                  <Select value={key || "unset"} onValueChange={setKey}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a missing key" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="unset">Choose a key…</SelectItem>
                      {missingKeys.map((missingKey) => (
                        <SelectItem key={missingKey} value={missingKey}>
                          {missingKey}
                        </SelectItem>
                      ))}
                      {(translations ?? [])
                        .filter((row) => !missingKeys.includes(row.key))
                        .map((row) => (
                          <SelectItem key={row._id} value={row.key}>
                            {row.key} (overridden)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="translation-value">Translated label</Label>
                <Input
                  id="translation-value"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Reviewed translation"
                  maxLength={500}
                />
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={handleSaveTranslation} disabled={savingTranslation}>
                  {savingTranslation ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  {editingId ? "Update translation" : "Add translation"}
                </Button>
                {editingId && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setKey("");
                      setValue("");
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
              {editingId && (
                <p className="text-[11px] text-muted-foreground">
                  This key is from a server override. The API will update it in place.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Not yet customized</CardTitle>
              <p className="text-xs text-muted-foreground">
                {missingKeys.length} interface labels use the reviewed built-in{" "}
                {language === "hi" ? "Hindi" : "Marathi"} text. Add an override only when your
                pharmacy needs different wording.
              </p>
            </CardHeader>
            <CardContent>
              <div className="flex max-h-56 flex-wrap gap-1.5 overflow-y-auto">
                {missingKeys.slice(0, 80).map((missingKey) => (
                  <button
                    key={missingKey}
                    type="button"
                    onClick={() => setKey(missingKey)}
                    className="rounded-md border border-amber-300/50 bg-amber-500/[0.06] px-2 py-1 text-[10px] text-amber-800 hover:bg-amber-500/10 dark:text-amber-300"
                  >
                    {missingKey}
                  </button>
                ))}
              </div>
              {missingKeys.length > 80 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  +{missingKeys.length - 80} more
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Saved overrides</CardTitle>
            </CardHeader>
            <CardContent>
              {translations === undefined ? (
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              ) : translations.length === 0 ? (
                <p className="text-sm text-muted-foreground">No overrides for this language yet.</p>
              ) : (
                <div className="max-h-[420px] divide-y divide-border/50 overflow-y-auto">
                  {(translations as TranslationRow[])
                    .slice()
                    .sort((a, b) => a.key.localeCompare(b.key))
                    .map((row) => (
                      <div key={row._id} className="flex items-start gap-2 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[11px] text-muted-foreground">{row.key}</p>
                          <p className="text-sm">{row.value}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          aria-label="Edit translation"
                          onClick={() => beginEdit(row)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          aria-label="Delete translation"
                          onClick={() => handleDeleteTranslation(row._id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4 text-primary" /> Language usage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {usage === undefined ? (
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    {usage.totalUsers} customer accounts. Signed-out visitors use English.
                  </p>
                  {["en", "hi", "mr"].map((code) => {
                    const count = usage.counts[code] ?? 0;
                    const total = Math.max(usage.totalUsers, 1);
                    return (
                      <div key={code}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="font-medium">
                            {code === "en" ? "English" : code === "hi" ? "Hindi" : "Marathi"}
                          </span>
                          <span className="text-muted-foreground">{count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${(count / total) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted/40 p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Medicine names, strengths, dosages, prescription content and medical
                  instructions are never translated automatically. Only interface labels change.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
