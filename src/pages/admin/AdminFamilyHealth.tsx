import { useMemo, useState } from "react";
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
  ArrowLeft,
  BarChart3,
  CalendarDays,
  FileText,
  HeartHandshake,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type MeasurementType = {
  key: string;
  label: string;
  unit: string;
  secondaryLabel?: string;
  secondaryUnit?: string;
  min: number;
  max: number;
  isActive?: boolean;
};

type AdminView = "members" | "readings" | "reports" | "customers" | null;

type NewTypeForm = {
  label: string;
  unit: string;
  min: string;
  max: string;
  secondary: boolean;
  secondaryLabel: string;
  secondaryUnit: string;
};

const EMPTY_NEW_TYPE: NewTypeForm = {
  label: "",
  unit: "",
  min: "",
  max: "",
  secondary: false,
  secondaryLabel: "",
  secondaryUnit: "",
};

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatDate(ms: number | null | undefined) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function measurementKey(label: string, existing: MeasurementType[]) {
  const base =
    label
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 32) || "custom";
  const keys = new Set(existing.map((type) => type.key));
  if (!keys.has(base)) return base;
  let index = 2;
  while (keys.has(`${base}_${index}`)) index += 1;
  return `${base}_${index}`;
}

type AdminSettings = {
  familyHealthEnabled: boolean;
  enabled: boolean;
  measurementTypes: MeasurementType[];
  educationalContent: string;
  updatedAt: number | null;
};

export default function AdminFamilyHealth() {
  const settings = useQuery(api.adminHealthTracker.getSettings);
  if (settings === undefined) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }
  return <AdminFamilyHealthEditor settings={settings as AdminSettings} />;
}

function AdminFamilyHealthEditor({ settings }: { settings: AdminSettings }) {
  const stats = useQuery(api.adminHealthTracker.getUsageStats);
  const updateSettings = useMutation(api.adminHealthTracker.updateSettings);
  const deleteMeasurementType = useMutation(
    api.adminHealthTracker.deleteMeasurementType,
  );

  const [view, setView] = useState<AdminView>(null);
  const adminMembers = useQuery(
    api.adminHealthTracker.getMembers,
    view === "members" ? {} : "skip",
  );
  const adminReadings = useQuery(
    api.adminHealthTracker.getReadingsActivity,
    view === "readings" ? {} : "skip",
  );
  const adminReports = useQuery(
    api.adminHealthTracker.getReports,
    view === "reports" ? {} : "skip",
  );
  const adminCustomers = useQuery(
    api.adminHealthTracker.getActiveCustomers,
    view === "customers" ? {} : "skip",
  );

  const [familyHealthEnabled, setFamilyHealthEnabled] = useState(
    settings.familyHealthEnabled,
  );
  const [enabled, setEnabled] = useState(settings.enabled);
  const [types, setTypes] = useState<MeasurementType[]>(settings.measurementTypes);
  const [educationalContent, setEducationalContent] = useState(
    settings.educationalContent,
  );
  const [saving, setSaving] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [newType, setNewType] = useState<NewTypeForm>(EMPTY_NEW_TYPE);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MeasurementType | null>(null);
  const [deleting, setDeleting] = useState(false);

  const labelByKey = useMemo(
    () => new Map(types.map((type) => [type.key, type.label])),
    [types],
  );

  const typePayload = (rows: MeasurementType[]) =>
    rows.map((type) => ({
      key: type.key,
      label: type.label.trim(),
      unit: type.unit.trim(),
      secondaryLabel: type.secondaryLabel?.trim() || undefined,
      secondaryUnit: type.secondaryUnit?.trim() || undefined,
      min: type.min,
      max: type.max,
      isActive: type.isActive !== false,
    }));

  function updateType(index: number, patch: Partial<MeasurementType>) {
    setTypes((prev) =>
      prev.map((type, i) => (i === index ? { ...type, ...patch } : type)),
    );
  }

  function validateTypes(rows: MeasurementType[]) {
    if (rows.length === 0) return "Keep at least one measurement type.";
    const labels = new Set<string>();
    for (const type of rows) {
      if (type.label.trim().length < 2 || type.label.trim().length > 40) {
        return "Every measurement needs a label of 2–40 characters.";
      }
      const label = type.label.trim().toLowerCase();
      if (labels.has(label)) return "Measurement names must be unique.";
      labels.add(label);
      if (!type.unit.trim()) return `Enter a unit for ${type.label}.`;
      if (!Number.isFinite(type.min) || !Number.isFinite(type.max) || type.min >= type.max) {
        return `Enter a valid minimum and maximum for ${type.label}.`;
      }
      if (
        (type.secondaryLabel?.trim() && !type.secondaryUnit?.trim()) ||
        (!type.secondaryLabel?.trim() && type.secondaryUnit?.trim())
      ) {
        return "A second value needs both a label and a unit.";
      }
    }
    return null;
  }

  async function persistTypes(rows: MeasurementType[], successMessage: string) {
    const problem = validateTypes(rows);
    if (problem) {
      toast.error(problem);
      return false;
    }
    if (educationalContent.trim().length < 20) {
      toast.error("Educational information must be at least 20 characters.");
      return false;
    }
    setSaving(true);
    try {
      const result = await updateSettings({
        familyHealthEnabled,
        enabled,
        measurementTypes: typePayload(rows),
        educationalContent,
      });
      setTypes(result.measurementTypes as MeasurementType[]);
      toast.success(successMessage);
      return true;
    } catch (error: unknown) {
      toast.error(errorText(error, "Could not save settings"));
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    await persistTypes(types, "Family Health settings saved");
  }

  async function handleAddType() {
    const label = newType.label.trim();
    if (label.length < 2 || label.length > 40) {
      toast.error("Enter a measurement name of 2–40 characters.");
      return;
    }
    if (!newType.unit.trim()) {
      toast.error("Enter the unit for this measurement.");
      return;
    }
    const min = Number(newType.min);
    const max = Number(newType.max);
    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
      toast.error("Enter a valid minimum and maximum.");
      return;
    }
    if (
      types.some((type) => type.label.trim().toLowerCase() === label.toLowerCase())
    ) {
      toast.error("A measurement with this name already exists.");
      return;
    }
    if (
      newType.secondary &&
      (!newType.secondaryLabel.trim() || !newType.secondaryUnit.trim())
    ) {
      toast.error("Enter both a second-value label and unit.");
      return;
    }

    const candidate: MeasurementType = {
      key: measurementKey(label, types),
      label,
      unit: newType.unit.trim(),
      min,
      max,
      secondaryLabel: newType.secondary ? newType.secondaryLabel.trim() : undefined,
      secondaryUnit: newType.secondary ? newType.secondaryUnit.trim() : undefined,
      isActive: true,
    };
    setAdding(true);
    try {
      const result = await updateSettings({
        familyHealthEnabled,
        enabled,
        measurementTypes: typePayload([...types, candidate]),
        educationalContent,
      });
      setTypes(result.measurementTypes as MeasurementType[]);
      setNewType(EMPTY_NEW_TYPE);
      setAddOpen(false);
      toast.success(`${label} added to the Health Tracker`);
    } catch (error: unknown) {
      toast.error(errorText(error, "Could not add the measurement type"));
    } finally {
      setAdding(false);
    }
  }

  async function handleDeleteType() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteMeasurementType({ key: deleteTarget.key });
      setTypes(result.measurementTypes as MeasurementType[]);
      toast.success(
        result.archived
          ? `${deleteTarget.label} archived — ${result.readingCount} historical reading${result.readingCount === 1 ? "" : "s"} preserved`
          : `${deleteTarget.label} removed`,
      );
      setDeleteTarget(null);
    } catch (error: unknown) {
      toast.error(errorText(error, "Could not remove the measurement type"));
    } finally {
      setDeleting(false);
    }
  }

  const statCards = [
    {
      key: "members" as const,
      label: "Family members",
      value: stats?.totalMembers ?? 0,
      icon: Users,
      hint: "Profiles created",
    },
    {
      key: "readings" as const,
      label: "Readings recorded",
      value: stats?.totalReadings ?? 0,
      icon: Activity,
      hint: "Tracker activity",
    },
    {
      key: "reports" as const,
      label: "Reports uploaded",
      value: stats?.totalReports ?? 0,
      icon: FileText,
      hint: "Private files",
    },
    {
      key: "customers" as const,
      label: "Active customers",
      value: stats?.activeCustomers ?? 0,
      icon: BarChart3,
      hint: "Customers with readings",
    },
  ];

  const viewTitle =
    view === "members"
      ? "Family members"
      : view === "readings"
        ? "Recorded readings"
        : view === "reports"
          ? "Uploaded reports"
          : view === "customers"
            ? "Active customers"
            : "";

  return (
    <AdminLayout>
      <div className="space-y-5 sm:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
              <HeartHandshake className="size-6 text-primary" /> Family Health
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Feature availability, measurement configuration and privacy-safe usage
              oversight.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save settings
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 xl:grid-cols-4">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            const active = view === stat.key;
            return (
              <button
                key={stat.key}
                type="button"
                onClick={() => setView(stat.key)}
                className="min-w-0 text-left"
                aria-pressed={active}
              >
                <Card
                  className={`h-full transition-all ${
                    active
                      ? "border-primary/60 ring-1 ring-primary/20"
                      : "border-border/60 hover:-translate-y-0.5 hover:border-primary/30"
                  }`}
                >
                  <CardContent className="flex items-center gap-2.5 p-3 sm:gap-3 sm:p-4">
                    <div
                      className={`flex size-9 shrink-0 items-center justify-center rounded-xl sm:size-10 ${
                        active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="size-4 sm:size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl font-bold leading-none sm:text-2xl">{stat.value}</p>
                      <p className="mt-1 text-[10px] leading-tight text-muted-foreground sm:text-xs">
                        {stat.label}
                      </p>
                      <p className="mt-0.5 hidden text-[10px] text-muted-foreground lg:block">
                        {stat.hint}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>

        {view && (
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{viewTitle}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {view === "readings"
                      ? "Reading activity is shown without values or notes to protect customer health data."
                      : view === "reports"
                        ? "Report metadata only. Private report files are never exposed to administrators."
                        : "Live records from the Family Health database."}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setView(null)}>
                  <ArrowLeft className="size-3.5" /> Back
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {view === "members" &&
                (adminMembers === undefined ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="size-5 animate-spin text-primary" />
                  </div>
                ) : adminMembers.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No family member profiles have been created yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Customer</TableHead>
                          <TableHead>Readings</TableHead>
                          <TableHead>Reports</TableHead>
                          <TableHead>Last reading</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adminMembers.map((member) => (
                          <TableRow key={member._id}>
                            <TableCell>
                              <p className="text-sm font-medium">{member.name}</p>
                              <p className="text-[11px] capitalize text-muted-foreground">
                                {member.relationship}
                              </p>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{member.ownerName}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {member.ownerEmail || "—"}
                              </p>
                            </TableCell>
                            <TableCell>{member.readingsCount}</TableCell>
                            <TableCell>{member.reportsCount}</TableCell>
                            <TableCell className="text-sm">{formatDate(member.lastReadingAt)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}

              {view === "readings" &&
                (adminReadings === undefined ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="size-5 animate-spin text-primary" />
                  </div>
                ) : adminReadings.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No readings recorded yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Member</TableHead>
                          <TableHead>Measurement</TableHead>
                          <TableHead>Unit</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adminReadings.map((reading) => (
                          <TableRow key={reading._id}>
                            <TableCell className="text-sm">{formatDate(reading.recordedAt)}</TableCell>
                            <TableCell>
                              <p className="text-sm">{reading.memberName}</p>
                              <p className="text-[11px] capitalize text-muted-foreground">
                                {reading.relationship}
                              </p>
                            </TableCell>
                            <TableCell className="text-sm">{reading.typeLabel}</TableCell>
                            <TableCell className="text-sm">{reading.unit}</TableCell>
                            <TableCell>
                              <Badge variant={reading.hasNotes ? "secondary" : "outline"}>
                                {reading.hasNotes ? "Note attached" : "No note"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}

              {view === "reports" &&
                (adminReports === undefined ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="size-5 animate-spin text-primary" />
                  </div>
                ) : adminReports.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No reports uploaded yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Report</TableHead>
                          <TableHead>Member</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>File</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adminReports.map((report) => (
                          <TableRow key={report._id}>
                            <TableCell>
                              <p className="text-sm font-medium">{report.title}</p>
                              <p className="text-[11px] text-muted-foreground">{report.fileName}</p>
                            </TableCell>
                            <TableCell>
                              <p className="text-sm">{report.memberName}</p>
                              <p className="text-[11px] capitalize text-muted-foreground">
                                {report.relationship}
                              </p>
                            </TableCell>
                            <TableCell className="text-sm">{formatDate(report.recordedAt)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {report.fileType.split("/").pop()?.toUpperCase()} ·{" "}
                              {formatFileSize(report.fileSize)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}

              {view === "customers" &&
                (adminCustomers === undefined ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="size-5 animate-spin text-primary" />
                  </div>
                ) : adminCustomers.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No customer has recorded a reading yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Customer</TableHead>
                          <TableHead>Members</TableHead>
                          <TableHead>Readings</TableHead>
                          <TableHead>Reports</TableHead>
                          <TableHead>Last activity</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {adminCustomers.map((customer) => (
                          <TableRow key={customer.ownerId}>
                            <TableCell>
                              <p className="text-sm font-medium">{customer.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {customer.email || "—"}
                              </p>
                            </TableCell>
                            <TableCell>{customer.membersCount}</TableCell>
                            <TableCell>{customer.readingsCount}</TableCell>
                            <TableCell>{customer.reportsCount}</TableCell>
                            <TableCell className="text-sm">
                              {formatDate(customer.lastActivityAt)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ))}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Feature availability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium">Family Health</p>
                  <p className="text-xs text-muted-foreground">
                    Show Family Health and member profiles.
                  </p>
                </div>
                <Switch checked={familyHealthEnabled} onCheckedChange={setFamilyHealthEnabled} />
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium">Health Tracker</p>
                  <p className="text-xs text-muted-foreground">
                    Allow new readings. Existing history stays readable.
                  </p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
              <div className="flex items-start gap-2 rounded-xl bg-primary/[0.04] p-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  Admins can inspect counts and activity metadata, but no reading
                  values, notes, private report files or diagnoses are exposed.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Usage by measurement type</CardTitle>
            </CardHeader>
            <CardContent>
              {(stats?.byType ?? []).length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No readings recorded yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {(stats?.byType ?? []).map((row) => {
                    const max = Math.max(...(stats?.byType ?? []).map((r) => r.count), 1);
                    return (
                      <div key={row.typeKey} className="flex items-center gap-2 sm:gap-3">
                        <span className="w-28 shrink-0 truncate text-xs font-medium sm:w-40">
                          {labelByKey.get(row.typeKey) ?? row.typeKey}
                        </span>
                        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${(row.count / max) * 100}%` }}
                          />
                        </div>
                        <span className="w-8 text-right text-xs text-muted-foreground">
                          {row.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              <Separator className="my-4" />
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3.5 text-primary" />
                  {stats?.readingsLast30Days ?? 0} readings in the last 30 days
                </span>
                <Button variant="ghost" size="sm" onClick={() => setView("readings")}>
                  View activity
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border/60">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">Measurement types</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Configured types appear automatically in the customer Health Tracker.
                Supported formats include single values and two-value readings.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" /> Add type
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {types.map((type, index) => {
              const active = type.isActive !== false;
              return (
                <div
                  key={type.key}
                  className={`rounded-xl border p-3 ${
                    active ? "border-border/60" : "border-dashed border-border/70 bg-muted/20"
                  }`}
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Badge variant={active ? "default" : "secondary"}>
                        {active ? "Active" : "Archived"}
                      </Badge>
                      <code className="max-w-full truncate rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {type.key}
                      </code>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        {active ? "Available for new readings" : "History only"}
                      </span>
                      <Switch
                        checked={active}
                        onCheckedChange={(checked) =>
                          updateType(index, { isActive: checked })
                        }
                        aria-label={`${active ? "Archive" : "Activate"} ${type.label || "measurement type"}`}
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                    <div className="space-y-1.5 xl:col-span-2">
                      <Label className="text-[11px]">Label</Label>
                      <Input
                        value={type.label}
                        onChange={(e) => updateType(index, { label: e.target.value })}
                        placeholder="e.g. Blood pressure"
                        maxLength={40}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px]">Unit</Label>
                      <Input
                        value={type.unit}
                        onChange={(e) => updateType(index, { unit: e.target.value })}
                        placeholder="mmHg"
                        maxLength={20}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px]">Min</Label>
                      <Input
                        type="number"
                        value={Number.isFinite(type.min) ? type.min : ""}
                        onChange={(e) => updateType(index, { min: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px]">Max</Label>
                      <Input
                        type="number"
                        value={Number.isFinite(type.max) ? type.max : ""}
                        onChange={(e) => updateType(index, { max: Number(e.target.value) })}
                      />
                    </div>
                    <div className="flex items-end justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(type)}
                      >
                        <Trash2 className="size-4" /> Delete
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-[11px]">Second value label (optional)</Label>
                      <Input
                        value={type.secondaryLabel ?? ""}
                        onChange={(e) => updateType(index, { secondaryLabel: e.target.value })}
                        placeholder="e.g. Diastolic"
                        maxLength={40}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px]">Second value unit (optional)</Label>
                      <Input
                        value={type.secondaryUnit ?? ""}
                        onChange={(e) => updateType(index, { secondaryUnit: e.target.value })}
                        placeholder="mmHg"
                        maxLength={20}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
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
            <div className="mt-3 flex flex-wrap items-center gap-2">
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
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add measurement type</DialogTitle>
            <DialogDescription>
              The new type becomes available in the customer Health Tracker immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="new-type-label">Measurement name *</Label>
              <Input
                id="new-type-label"
                value={newType.label}
                onChange={(e) => setNewType({ ...newType, label: e.target.value })}
                placeholder="e.g. Blood pressure"
                maxLength={40}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="new-type-unit">Unit *</Label>
                <Input
                  id="new-type-unit"
                  value={newType.unit}
                  onChange={(e) => setNewType({ ...newType, unit: e.target.value })}
                  placeholder="mmHg"
                  maxLength={20}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-type-min">Minimum *</Label>
                <Input
                  id="new-type-min"
                  type="number"
                  value={newType.min}
                  onChange={(e) => setNewType({ ...newType, min: e.target.value })}
                  placeholder="40"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-type-max">Maximum *</Label>
                <Input
                  id="new-type-max"
                  type="number"
                  value={newType.max}
                  onChange={(e) => setNewType({ ...newType, max: e.target.value })}
                  placeholder="300"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 rounded-xl border p-3 text-sm">
              <input
                type="checkbox"
                checked={newType.secondary}
                onChange={(e) => setNewType({ ...newType, secondary: e.target.checked })}
                className="size-4 accent-[var(--primary)]"
              />
              This reading has two values (for example systolic and diastolic)
            </label>
            {newType.secondary && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="new-secondary-label">Second value label *</Label>
                  <Input
                    id="new-secondary-label"
                    value={newType.secondaryLabel}
                    onChange={(e) =>
                      setNewType({ ...newType, secondaryLabel: e.target.value })
                    }
                    placeholder="e.g. Diastolic"
                    maxLength={40}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-secondary-unit">Second value unit *</Label>
                  <Input
                    id="new-secondary-unit"
                    value={newType.secondaryUnit}
                    onChange={(e) =>
                      setNewType({ ...newType, secondaryUnit: e.target.value })
                    }
                    placeholder="mmHg"
                    maxLength={20}
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="h-10" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button className="h-10" onClick={handleAddType} disabled={adding}>
              {adding && <Loader2 className="size-4 animate-spin" />}
              Add type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              If this type has historical readings, it will be archived instead of
              deleted so the customer history and original units remain intact.
              Unused types are removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                handleDeleteType();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-1 size-4 animate-spin" />}
              Delete type
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
