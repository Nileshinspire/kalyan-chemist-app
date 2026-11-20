import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  FileText,
  HeartHandshake,
  Info,
  Loader2,
  Package,
  Pencil,
  Pill,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  TrendingDown,
  TrendingUp,
  Upload,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { usePrescriptionUpload } from "@/hooks/usePrescriptionUpload";

type Reading = {
  _id: Id<"health_readings">;
  typeKey: string;
  value: number;
  secondaryValue?: number;
  unit: string;
  recordedAt: number;
  notes?: string;
};

type Report = {
  _id: Id<"health_reports">;
  title: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  recordedAt: number;
  url: string | null;
};

type MeasurementType = {
  key: string;
  label: string;
  unit: string;
  secondaryLabel?: string;
  secondaryUnit?: string;
  min: number;
  max: number;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateTimeInput(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function formatDateTime(ms: number) {
  return new Date(ms).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function readingLabel(reading: Reading, types: MeasurementType[]) {
  const type = types.find((t) => t.key === reading.typeKey);
  const unit = type?.unit ?? reading.unit;
  if (reading.secondaryValue !== undefined) {
    return `${reading.value}/${reading.secondaryValue} ${unit}`;
  }
  return `${reading.value} ${unit}`;
}

function TrendChart({ readings }: { readings: Reading[] }) {
  const points = useMemo(() => [...readings].reverse().slice(-14), [readings]);
  if (points.length === 0) return null;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const width = 340;
  const height = 120;
  const padX = 12;
  const padY = 14;
  const coords = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : padX + (index / (points.length - 1)) * (width - padX * 2);
    const y =
      height - padY - ((point.value - min) / span) * (height - padY * 2);
    return { x, y, point };
  });
  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-32 w-full overflow-visible"
        role="img"
        aria-label="Reading trend chart"
      >
        <defs>
          <linearGradient id="tracker-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2].map((line) => (
          <line
            key={line}
            x1={0}
            x2={width}
            y1={padY + (line * (height - padY * 2)) / 2}
            y2={padY + (line * (height - padY * 2)) / 2}
            stroke="hsl(var(--border))"
            strokeDasharray="3 4"
          />
        ))}
        {coords.length > 1 && (
          <path
            d={`${path} L${coords[coords.length - 1].x},${height} L${coords[0].x},${height} Z`}
            fill="url(#tracker-fill)"
          />
        )}
        {coords.length > 1 && (
          <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" />
        )}
        {coords.map((c) => (
          <circle
            key={c.point._id}
            cx={c.x}
            cy={c.y}
            r="3.5"
            fill="hsl(var(--background))"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
          />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{formatDate(points[0].recordedAt)}</span>
        {points.length > 1 && <span>{formatDate(points[points.length - 1].recordedAt)}</span>}
      </div>
    </div>
  );
}

export default function FamilyMemberHealth() {
  const { memberId } = useParams<{ memberId: string }>();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const members = useQuery(api.familyHealth.list);
  const config = useQuery(api.healthTracker.getConfig);
  const readings = useQuery(
    api.healthTracker.list,
    memberId ? { memberId: memberId as Id<"family_members"> } : "skip",
  );
  const reports = useQuery(
    api.healthTracker.listReports,
    memberId ? { memberId: memberId as Id<"family_members"> } : "skip",
  );
  const prescriptions = useQuery(api.prescriptions.list);
  const reminders = useQuery(api.pillReminders.list);
  const orders = useQuery(api.orders.list);

  const addReading = useMutation(api.healthTracker.addReading);
  const updateReading = useMutation(api.healthTracker.updateReading);
  const removeReading = useMutation(api.healthTracker.removeReading);
  const generateUploadUrl = useMutation(api.healthTracker.generateReportUploadUrl);
  const addReport = useMutation(api.healthTracker.addReport);
  const removeReport = useMutation(api.healthTracker.removeReport);
  const { uploadPrescription, uploading: uploadingPrescription } = usePrescriptionUpload();

  const member = (members ?? []).find((m) => m._id === memberId);
  const types = (config?.measurementTypes ?? []) as MeasurementType[];
  const [selectedType, setSelectedType] = useState<string>("");
  const activeType = selectedType || types[0]?.key || "";

  const allReadings = (readings ?? []) as Reading[];
  const typeReadings = allReadings.filter((r) => r.typeKey === activeType);
  const latest = typeReadings[0];
  const previous = typeReadings[1];

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Reading | null>(null);
  const [readingForm, setReadingForm] = useState({
    typeKey: "",
    value: "",
    secondaryValue: "",
    recordedAt: dateTimeInput(Date.now()),
    notes: "",
  });
  const [savingReading, setSavingReading] = useState(false);
  const [deleteReading, setDeleteReading] = useState<Reading | null>(null);
  const [deletingReading, setDeletingReading] = useState(false);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState("");
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [uploadingReport, setUploadingReport] = useState(false);
  const reportInput = useRef<HTMLInputElement>(null);
  const prescriptionInput = useRef<HTMLInputElement>(null);
  const [uploadingRx, setUploadingRx] = useState(false);

  const memberPrescriptions = (prescriptions ?? []).filter(
    (rx: any) => rx.memberId === memberId,
  );
  const memberReminders = (reminders ?? []).filter(
    (reminder: any) => reminder.memberId === memberId,
  );
  const memberOrders = (orders ?? []).filter(
    (order: any) => order.familyMemberId === memberId,
  );

  function openAddReading() {
    setEditing(null);
    const first = types[0];
    setReadingForm({
      typeKey: activeType || first?.key || "",
      value: "",
      secondaryValue: "",
      recordedAt: dateTimeInput(Date.now()),
      notes: "",
    });
    setDialogOpen(true);
  }

  function openEditReading(reading: Reading) {
    setEditing(reading);
    setReadingForm({
      typeKey: reading.typeKey,
      value: String(reading.value),
      secondaryValue:
        reading.secondaryValue !== undefined ? String(reading.secondaryValue) : "",
      recordedAt: dateTimeInput(reading.recordedAt),
      notes: reading.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSaveReading() {
    if (!memberId) return;
    const type = types.find((x) => x.key === readingForm.typeKey);
    if (!type) {
      toast.error(t("measurementType"));
      return;
    }
    const value = Number(readingForm.value);
    const secondaryValue = readingForm.secondaryValue
      ? Number(readingForm.secondaryValue)
      : undefined;
    if (!Number.isFinite(value)) {
      toast.error(t("invalidReading"));
      return;
    }
    if (type.secondaryLabel && (!Number.isFinite(secondaryValue) || secondaryValue === undefined)) {
      toast.error(`${type.secondaryLabel} is required.`);
      return;
    }
    const recordedAt = new Date(readingForm.recordedAt).getTime();
    if (!Number.isFinite(recordedAt)) {
      toast.error(t("dateTime"));
      return;
    }
    setSavingReading(true);
    try {
      if (editing) {
        await updateReading({
          readingId: editing._id,
          value,
          secondaryValue: secondaryValue ?? null,
          recordedAt,
          notes: readingForm.notes.trim() || undefined,
        });
        toast.success(t("readingUpdated"));
      } else {
        await addReading({
          memberId: memberId as Id<"family_members">,
          typeKey: type.key,
          value,
          secondaryValue,
          recordedAt,
          notes: readingForm.notes.trim() || undefined,
        });
        toast.success(t("readingAdded"));
      }
      setSelectedType(type.key);
      setDialogOpen(false);
    } catch (error: any) {
      toast.error(error?.message || t("somethingWentWrong"));
    } finally {
      setSavingReading(false);
    }
  }

  async function handleDeleteReading() {
    if (!deleteReading) return;
    setDeletingReading(true);
    try {
      await removeReading({ readingId: deleteReading._id });
      toast.success(t("readingDeleted"));
      setDeleteReading(null);
    } catch (error: any) {
      toast.error(error?.message || t("somethingWentWrong"));
    } finally {
      setDeletingReading(false);
    }
  }

  async function handleUploadReport() {
    if (!memberId) return;
    if (!reportFile) {
      toast.error(t("chooseFile"));
      return;
    }
    if (reportTitle.trim().length < 2) {
      toast.error(t("reportTitle"));
      return;
    }
    setUploadingReport(true);
    try {
      const uploadUrl = await generateUploadUrl({});
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": reportFile.type },
        body: reportFile,
      });
      if (!response.ok) throw new Error("Upload failed. Please try again.");
      const { storageId } = await response.json();
      await addReport({
        memberId: memberId as Id<"family_members">,
        title: reportTitle.trim(),
        fileId: storageId,
        fileName: reportFile.name,
        fileType: reportFile.type,
        fileSize: reportFile.size,
        recordedAt: new Date(`${reportDate}T12:00:00`).getTime(),
      });
      toast.success(t("reportAdded"));
      setReportOpen(false);
      setReportFile(null);
      setReportTitle("");
    } catch (error: any) {
      toast.error(error?.message || t("somethingWentWrong"));
    } finally {
      setUploadingReport(false);
    }
  }

  async function handlePrescriptionFile(file: File | null) {
    if (!file || !member) return;
    setUploadingRx(true);
    try {
      await uploadPrescription(file, {
        patientName: member.name,
        memberId: member._id,
      });
      toast.success("Prescription uploaded for review");
      if (prescriptionInput.current) prescriptionInput.current.value = "";
    } catch (error: any) {
      toast.error(error?.message || t("somethingWentWrong"));
    } finally {
      setUploadingRx(false);
    }
  }

  if (members === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex justify-center py-32">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
          <HeartHandshake className="size-12 text-muted-foreground" />
          <h1 className="mt-4 text-lg font-bold">{t("selectMember")}</h1>
          <Button className="mt-4 rounded-xl" onClick={() => navigate("/family-health")}>
            {t("back")}
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  const comparison =
    latest && previous
      ? Number((latest.value - previous.value).toFixed(1))
      : null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 pb-12 pt-5 sm:px-6 lg:py-9">
          <div className="mb-5 flex items-start gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("back")}
              className="mt-0.5 rounded-xl"
              onClick={() => navigate("/family-health")}
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {t("familyHealth")}
              </p>
              <h1 className="truncate text-xl font-bold text-foreground">{member.name}</h1>
              <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                {t(member.relationship)}
                {member.bloodGroup ? ` · ${member.bloodGroup}` : ""}
                {member.phone ? ` · ${member.phone}` : ""}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-1 rounded-xl"
              onClick={() => navigate("/family-health")}
            >
              <Pencil className="size-3.5" />
              <span className="hidden sm:inline">{t("manageProfile")}</span>
            </Button>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: t("healthRecords"), count: allReadings.length, icon: Activity },
              { label: t("reports"), count: (reports ?? []).length, icon: FileText },
              { label: t("prescriptions"), count: memberPrescriptions.length, icon: Pill },
              { label: t("orders"), count: memberOrders.length, icon: Package },
            ].map((item) => (
              <Card key={item.label} className="border-border/60">
                <CardContent className="flex items-center gap-2.5 p-3">
                  <item.icon className="size-4 text-primary" />
                  <div>
                    <p className="text-base font-bold leading-none">{item.count}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{item.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
            <div className="space-y-5">
              {/* Health Tracker */}
              <Card className="border-border/60">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Activity className="size-4 text-primary" /> {t("healthTracker")}
                    </CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("trackerSubtitle")}
                    </p>
                  </div>
                  {config?.enabled !== false && (
                    <Button size="sm" className="shrink-0 rounded-xl" onClick={openAddReading}>
                      <Plus className="size-4" />
                      <span className="hidden sm:inline">{t("addReading")}</span>
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {config?.enabled === false ? (
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                      {t("familyHealthDisabled")}
                    </div>
                  ) : (
                    <>
                      <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {types.map((type) => (
                          <button
                            key={type.key}
                            type="button"
                            onClick={() => setSelectedType(type.key)}
                            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                              activeType === type.key
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>

                      {typeReadings.length === 0 ? (
                        <div className="flex flex-col items-center rounded-xl border border-dashed border-border/70 px-4 py-8 text-center">
                          <Activity className="size-7 text-muted-foreground/70" />
                          <p className="mt-2 text-sm text-muted-foreground">{t("noReadings")}</p>
                          <Button variant="outline" size="sm" className="mt-3 rounded-xl" onClick={openAddReading}>
                            {t("addFirstReading")}
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-xl bg-primary/[0.05] p-3">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {t("latestReading")}
                              </p>
                              <p className="mt-0.5 text-lg font-bold text-foreground">
                                {readingLabel(latest!, types)}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {formatDateTime(latest!.recordedAt)}
                              </p>
                            </div>
                            <div className="rounded-xl bg-muted/40 p-3">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {t("comparison")}
                              </p>
                              {comparison === null ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {t("noData")}
                                </p>
                              ) : (
                                <p
                                  className={`mt-0.5 flex items-center gap-1 text-lg font-bold ${
                                    comparison > 0
                                      ? "text-amber-600 dark:text-amber-400"
                                      : comparison < 0
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-foreground"
                                  }`}
                                >
                                  {comparison > 0 ? (
                                    <TrendingUp className="size-4" />
                                  ) : comparison < 0 ? (
                                    <TrendingDown className="size-4" />
                                  ) : null}
                                  {comparison > 0 ? "+" : ""}
                                  {comparison} {latest!.unit}
                                </p>
                              )}
                              <p className="text-[10px] text-muted-foreground">
                                {t("previousReading")}:{" "}
                                {previous ? readingLabel(previous, types) : "—"}
                              </p>
                            </div>
                          </div>

                          <div>
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {t("chart")}
                            </p>
                            <TrendChart readings={typeReadings} />
                          </div>

                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {t("readingHistory")}
                            </p>
                            <div className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60">
                              {typeReadings.slice(0, 20).map((reading) => (
                                <div
                                  key={reading._id}
                                  className="flex items-start gap-2 px-3 py-2.5"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-foreground">
                                      {readingLabel(reading, types)}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground">
                                      {formatDateTime(reading.recordedAt)}
                                    </p>
                                    {reading.notes && (
                                      <p className="mt-0.5 text-xs text-muted-foreground">
                                        {reading.notes}
                                      </p>
                                    )}
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7"
                                    aria-label={t("editReading")}
                                    onClick={() => openEditReading(reading)}
                                  >
                                    <Pencil className="size-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-muted-foreground hover:text-destructive"
                                    aria-label={t("delete")}
                                    onClick={() => setDeleteReading(reading)}
                                  >
                                    <Trash2 className="size-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  <div className="flex items-start gap-2 rounded-xl bg-amber-500/[0.07] p-3 text-amber-800 dark:text-amber-300">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <p className="text-[11px] leading-relaxed">{t("disclaimer")}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Reports */}
              <Card className="border-border/60">
                <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="size-4 text-primary" /> {t("reports")}
                  </CardTitle>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setReportOpen(true)}>
                    <Upload className="size-3.5" /> {t("uploadReport")}
                  </Button>
                </CardHeader>
                <CardContent>
                  {(reports ?? []).length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
                      {t("noReports")}
                    </p>
                  ) : (
                    <div className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60">
                      {(reports as Report[]).map((report) => (
                        <div key={report._id} className="flex items-center gap-2 px-3 py-2.5">
                          <FileText className="size-4 shrink-0 text-primary" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{report.title}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {report.fileName} · {formatDate(report.recordedAt)}
                            </p>
                          </div>
                          {report.url && (
                            <Button asChild variant="ghost" size="sm" className="rounded-lg">
                              <a href={report.url} target="_blank" rel="noreferrer">
                                {t("viewReport")}
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            aria-label={t("delete")}
                            onClick={() => removeReport({ reportId: report._id })}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <ShieldCheck className="size-3.5 text-primary" /> {t("reportPrivacy")}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              {/* Prescriptions */}
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Pill className="size-4 text-primary" /> {t("prescriptions")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {memberPrescriptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("noPrescriptions")}</p>
                  ) : (
                    <div className="space-y-2">
                      {memberPrescriptions.slice(0, 4).map((rx: any) => (
                        <div key={rx._id} className="rounded-xl border border-border/60 p-2.5">
                          <p className="truncate text-xs font-medium">{rx.fileName}</p>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {String(rx.status).replaceAll("_", " ")}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground">
                              {formatDate(rx.createdAt)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <input
                    ref={prescriptionInput}
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    className="hidden"
                    onChange={(e) => handlePrescriptionFile(e.target.files?.[0] ?? null)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl"
                    disabled={uploadingPrescription || uploadingRx}
                    onClick={() => prescriptionInput.current?.click()}
                  >
                    {(uploadingPrescription || uploadingRx) ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Upload className="size-3.5" />
                    )}
                    {t("uploadReport")}
                  </Button>
                </CardContent>
              </Card>

              {/* Reminders */}
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Pill className="size-4 text-primary" /> {t("reminders")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {memberReminders.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("noReminders")}</p>
                  ) : (
                    <div className="space-y-2">
                      {memberReminders.slice(0, 3).map((reminder: any) => (
                        <div
                          key={reminder._id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-border/60 p-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">
                              {reminder.medicineName}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {reminder.times?.join(", ")}
                            </p>
                          </div>
                          <Badge variant={reminder.isActive ? "secondary" : "outline"} className="text-[10px]">
                            {reminder.isActive ? t("active") : t("inactive")}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl"
                    onClick={() =>
                      navigate(`/account/pill-reminders?member=${member._id}`)
                    }
                  >
                    <Plus className="size-3.5" /> {t("addReminder")}
                  </Button>
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    Uses the existing Pill Reminders system. Reminder times and dose history stay
                    in your account.
                  </p>
                </CardContent>
              </Card>

              {/* Orders */}
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <ShoppingBag className="size-4 text-primary" /> {t("orders")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {memberOrders.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No orders for this member yet. Choose this member at checkout.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {memberOrders.slice(0, 3).map((order: any) => (
                        <button
                          key={order._id}
                          type="button"
                          onClick={() => navigate(`/account/orders/${order._id}`)}
                          className="flex w-full items-center justify-between gap-2 rounded-xl border border-border/60 p-2.5 text-left hover:bg-muted/40"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-xs font-medium">
                              {order.invoiceNumber ?? "Order"}
                            </p>
                            <p className="text-[10px] capitalize text-muted-foreground">
                              {String(order.status).replaceAll("_", " ")} ·{" "}
                              {formatDate(order.createdAt)}
                            </p>
                          </div>
                          <ChevronRight className="size-3.5 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate("/products")}>
                      <ShoppingBag className="size-3.5" /> Shop
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate("/account/orders")}>
                      <ClipboardList className="size-3.5" /> {t("myOrders")}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {config?.educationalContent && (
                <Card className="border-primary/15 bg-primary/[0.03]">
                  <CardHeader className="pb-1">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Info className="size-4 text-primary" /> {t("educationalContent")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                      {config.educationalContent}
                    </p>
                  </CardContent>
                </Card>
              )}

              <div className="flex items-start gap-2 rounded-2xl border border-border/60 p-3.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  {t("privacyNotice")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? t("editReading") : t("addReading")}</DialogTitle>
            <DialogDescription>
              {member.name} · {t("memberProfile")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label>{t("measurementType")}</Label>
              <Select
                value={readingForm.typeKey}
                onValueChange={(value) =>
                  setReadingForm({ ...readingForm, typeKey: value, secondaryValue: "" })
                }
                disabled={!!editing}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {types.map((type) => (
                    <SelectItem key={type.key} value={type.key}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="reading-value">
                  {types.find((x) => x.key === readingForm.typeKey)?.label ?? t("value")}
                </Label>
                <Input
                  id="reading-value"
                  inputMode="decimal"
                  value={readingForm.value}
                  onChange={(e) => setReadingForm({ ...readingForm, value: e.target.value })}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("unit")}</Label>
                <Input
                  value={types.find((x) => x.key === readingForm.typeKey)?.unit ?? ""}
                  readOnly
                  className="bg-muted/40"
                />
              </div>
            </div>
            {types.find((x) => x.key === readingForm.typeKey)?.secondaryLabel && (
              <div className="space-y-1.5">
                <Label htmlFor="reading-secondary">
                  {types.find((x) => x.key === readingForm.typeKey)?.secondaryLabel}
                </Label>
                <Input
                  id="reading-secondary"
                  inputMode="decimal"
                  value={readingForm.secondaryValue}
                  onChange={(e) =>
                    setReadingForm({ ...readingForm, secondaryValue: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="reading-time">{t("dateTime")}</Label>
              <Input
                id="reading-time"
                type="datetime-local"
                max={dateTimeInput(Date.now())}
                value={readingForm.recordedAt}
                onChange={(e) => setReadingForm({ ...readingForm, recordedAt: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reading-notes">{t("notes")}</Label>
              <Textarea
                id="reading-notes"
                rows={2}
                maxLength={500}
                value={readingForm.notes}
                onChange={(e) => setReadingForm({ ...readingForm, notes: e.target.value })}
                placeholder="Optional context for your doctor"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              className="gradient-primary text-white"
              onClick={handleSaveReading}
              disabled={savingReading}
            >
              {savingReading && <Loader2 className="size-4 animate-spin" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("uploadReport")}</DialogTitle>
            <DialogDescription>{t("reportPrivacy")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="report-title">{t("reportTitle")}</Label>
              <Input
                id="report-title"
                value={reportTitle}
                maxLength={80}
                onChange={(e) => setReportTitle(e.target.value)}
                placeholder="e.g. Blood test — November"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-date">{t("date")}</Label>
              <Input
                id="report-date"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("chooseFile")}</Label>
              <input
                ref={reportInput}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="hidden"
                onChange={(e) => setReportFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start rounded-xl"
                onClick={() => reportInput.current?.click()}
              >
                <Upload className="size-4" />
                <span className="truncate">
                  {reportFile?.name ?? "JPG, PNG or PDF up to 10 MB"}
                </span>
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              className="gradient-primary text-white"
              onClick={handleUploadReport}
              disabled={uploadingReport}
            >
              {uploadingReport && <Loader2 className="size-4 animate-spin" />}
              {t("uploadReport")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteReading} onOpenChange={(open) => !open && setDeleteReading(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteReadingConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteReadingBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingReading}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingReading}
              onClick={(e) => {
                e.preventDefault();
                handleDeleteReading();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingReading && <Loader2 className="mr-1 size-4 animate-spin" />}
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
