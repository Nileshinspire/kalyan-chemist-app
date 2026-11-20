import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Activity,
  BarChart3,
  FileText,
  HeartHandshake,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type MeasurementType = {
  key: string;
  label: string;
  unit: string;
  secondaryLabel?: string;
  secondaryUnit?: string;
  min: number;
  max: number;
};

export default function AdminFamilyHealth() {
  const settings = useQuery(api.adminHealthTracker.getSettings);
  const stats = useQuery(api.adminHealthTracker.getUsageStats);
  const updateSettings = useMutation(api.adminHealthTracker.updateSettings);

  const [familyHealthEnabled, setFamilyHealthEnabled] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [types, setTypes] = useState<MeasurementType[]>([]);
  const [educationalContent, setEducationalContent] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings && !initialized) {
      setFamilyHealthEnabled(settings.familyHealthEnabled);
      setEnabled(settings.enabled);
      setTypes(settings.measurementTypes as MeasurementType[]);
      setEducationalContent(settings.educationalContent);
      setInitialized(true);
    }
  }, [settings, initialized]);

  const labelByKey = useMemo(
    () => new Map(types.map((type) => [type.key, type.label])),
    [types],
  );

  function updateType(index: number, patch: Partial<MeasurementType>) {
    setTypes((prev) =>
      prev.map((type, i) => (i === index ? { ...type, ...patch } : type)),
    );
  }

  function addType() {
    const key = `custom_${Date.now().toString(36)}`;
    setTypes((prev) => [
      ...prev,
      { key, label: "", unit: "", min: 0, max: 1000 },
    ]);
  }

  async function handleSave() {
    if (types.length === 0) {
      toast.error("Keep at least one measurement type.");
      return;
    }
    const invalid = types.find(
      (type) =>
        !type.label.trim() ||
        !type.unit.trim() ||
        !Number.isFinite(type.min) ||
        !Number.isFinite(type.max) ||
        type.min >= type.max,
    );
    if (invalid) {
      toast.error("Every measurement needs a label, unit and valid range.");
      return;
    }
    setSaving(true);
    try {
      await updateSettings({
        familyHealthEnabled,
        enabled,
        measurementTypes: types.map((type) => ({
          key: type.key,
          label: type.label.trim(),
          unit: type.unit.trim(),
          secondaryLabel: type.secondaryLabel?.trim() || undefined,
          secondaryUnit: type.secondaryUnit?.trim() || undefined,
          min: type.min,
          max: type.max,
        })),
        educationalContent,
      });
      toast.success("Family Health settings saved");
    } catch (error: any) {
      toast.error(error?.message || "Could not save settings");
    } finally {
      setSaving(false);
    }
  }

  if (settings === undefined) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <HeartHandshake className="size-6 text-primary" /> Family Health
            </h1>
            <p className="text-sm text-muted-foreground">
              Feature availability, tracker measurement types and aggregate usage.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save settings
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Family members", value: stats?.totalMembers ?? 0, icon: Users },
            { label: "Readings recorded", value: stats?.totalReadings ?? 0, icon: Activity },
            { label: "Reports uploaded", value: stats?.totalReports ?? 0, icon: FileText },
            { label: "Active customers", value: stats?.activeCustomers ?? 0, icon: BarChart3 },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/[0.07]">
                  <stat.icon className="size-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold leading-none">{stat.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Feature availability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">Family Health</p>
                <p className="text-xs text-muted-foreground">
                  Show the Family Health tab and family member profiles.
                </p>
              </div>
              <Switch checked={familyHealthEnabled} onCheckedChange={setFamilyHealthEnabled} />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 p-3">
              <div>
                <p className="text-sm font-medium">Health Tracker</p>
                <p className="text-xs text-muted-foreground">
                  Allow customers to record new readings. Existing history stays readable.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Measurement types</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Only these types can be recorded. Ranges are validated on the backend.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={addType}>
              <Plus className="size-4" /> Add type
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {types.map((type, index) => (
              <div key={type.key} className="rounded-xl border border-border/60 p-3">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <div className="space-y-1.5 lg:col-span-2">
                    <Label className="text-[11px]">Label</Label>
                    <Input
                      value={type.label}
                      onChange={(e) => updateType(index, { label: e.target.value })}
                      placeholder="e.g. Blood pressure"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Unit</Label>
                    <Input
                      value={type.unit}
                      onChange={(e) => updateType(index, { unit: e.target.value })}
                      placeholder="mmHg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Min</Label>
                    <Input
                      type="number"
                      value={type.min}
                      onChange={(e) => updateType(index, { min: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Max</Label>
                    <Input
                      type="number"
                      value={type.max}
                      onChange={(e) => updateType(index, { max: Number(e.target.value) })}
                    />
                  </div>
                  <div className="flex items-end justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Remove measurement type"
                      onClick={() => setTypes((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Second value label (optional)</Label>
                    <Input
                      value={type.secondaryLabel ?? ""}
                      onChange={(e) =>
                        updateType(index, { secondaryLabel: e.target.value })
                      }
                      placeholder="e.g. Diastolic"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Second value unit (optional)</Label>
                    <Input
                      value={type.secondaryUnit ?? ""}
                      onChange={(e) =>
                        updateType(index, { secondaryUnit: e.target.value })
                      }
                      placeholder="mmHg"
                    />
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Educational information</CardTitle>
            <p className="text-xs text-muted-foreground">
              Shown with the tracker. Do not include individual customer data.
            </p>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={6}
              maxLength={4000}
              value={educationalContent}
              onChange={(e) => setEducationalContent(e.target.value)}
              placeholder="General guidance about keeping measurements and talking to a doctor."
            />
            <div className="mt-3 flex items-center gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save settings
              </Button>
              <span className="text-xs text-muted-foreground">
                {educationalContent.length}/4000
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Usage by measurement type</CardTitle>
          </CardHeader>
          <CardContent>
            {(stats?.byType ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No readings recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {(stats?.byType ?? []).map((row) => {
                  const max = Math.max(...(stats?.byType ?? []).map((r) => r.count), 1);
                  return (
                    <div key={row.typeKey} className="flex items-center gap-3">
                      <span className="w-36 shrink-0 truncate text-xs font-medium">
                        {labelByKey.get(row.typeKey) ?? row.typeKey}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(row.count / max) * 100}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs text-muted-foreground">
                        {row.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <Separator className="my-4" />
            <div className="flex items-start gap-2 rounded-xl bg-primary/[0.04] p-3">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Privacy: this screen shows counts only. Customer readings, notes, member names
                and report files are not available to administrators.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
