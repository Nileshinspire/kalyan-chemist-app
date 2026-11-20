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
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-4 sm:px-6 sm:pt-5 lg:py-9">
          <div className="mb-5 overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/[0.09] via-primary/[0.035] to-background">
            <div className="flex items-start gap-2 p-4 sm:gap-3 sm:p-6">
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("back")}
                className="-ml-1 size-9 shrink-0 rounded-xl"
                onClick={() => navigate("/family-health")}
              >
                <ArrowLeft className="size-5" />
              </Button>
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-sm font-bold text-primary-foreground shadow-sm sm:size-14 sm:text-base">
                {member.name
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0]?.toUpperCase())
                  .join("")}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/80">
                  {t("familyHealth")}
                </p>
                <h1 className="break-words text-xl font-bold leading-tight text-foreground sm:text-2xl">
                  {member.name}
                </h1>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground ring-1 ring-border/60">
                    {t(member.relationship)}
                  </span>
                  {member.bloodGroup && (
                    <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border/60">
                      {member.bloodGroup}
                    </span>
                  )}
                  {member.phone && (
                    <span className="max-w-full truncate rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-border/60">
                      {member.phone}
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-0.5 hidden shrink-0 rounded-xl bg-background/70 sm:inline-flex"
                onClick={() => navigate("/family-health")}
              >
                <Pencil className="size-3.5" /> {t("manageProfile")}
              </Button>
            </div>
            <div className="border-t border-primary/10 bg-background/45 px-4 py-2.5 sm:hidden">
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-full rounded-lg bg-background/70 text-[11px]"
                onClick={() => navigate("/family-health")}
              >
                <Pencil className="size-3.5" /> {t("manageProfile")}
              </Button>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            {[
              { label: t("healthRecords"), count: allReadings.length, icon: Activity },
              { label: t("reports"), count: (reports ?? []).length, icon: FileText },
              { label: t("prescriptions"), count: memberPrescriptions.length, icon: Pill },
              { label: t("orders"), count: memberOrders.length, icon: Package },
            ].map((item) => (
              <Card key={item.label} className="border-border/60">
                <CardContent className="flex items-center gap-2.5 p-3 sm:p-3.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/[0.07]">
                    <item.icon className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold leading-none tracking-tight">{item.count}</p>
                    <p className="mt-1 truncate text-[10px] text-muted-foreground sm:text-[11px]">
                      {item.label}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(280px,1fr)] lg:gap-5">
            <div className="space-y-5">
              {/* Health Tracker */}
              <Card className="border-border/60">
                <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                      <span className="flex size-8 items-center justify-center rounded-xl bg-primary/[0.08]">
                        <Activity className="size-4 text-primary" />
                      </span>
                      {t("healthTracker")}
                    </CardTitle>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                      {t("trackerSubtitle")}
                    </p>
                  </div>
                  {config?.enabled !== false && (
                    <Button
                      size="sm"
                      aria-label={t("addReading")}
                      className="h-10 w-full shrink-0 rounded-xl sm:w-auto"
                      onClick={openAddReading}
                    >
                      <Plus className="size-4" />
                      {t("addReading")}
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
                      <div className="-mx-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        <div className="flex w-max min-w-full gap-1 rounded-xl bg-muted/60 p-1">
                          {types.map((type) => (
                            <button
                              key={type.key}
                              type="button"
                              onClick={() => setSelectedType(type.key)}
                              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                                activeType === type.key
                                  ? "bg-background text-primary shadow-sm ring-1 ring-border/60"
                                  : "text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {type.label}
                            </button>
                          ))}
                        </div>
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
                          <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
                            <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-primary/[0.055] p-4">
                              <div className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-lg bg-primary/10">
                                <Activity className="size-4 text-primary" />
                              </div>
                              <p className="pr-10 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/80">
                                {t("latestReading")}
                              </p>
                              <p className="mt-1 break-words text-2xl font-bold leading-tight tracking-tight text-foreground">
                                {readingLabel(latest!, types)}
                              </p>
                              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                                {formatDateTime(latest!.recordedAt)}
                              </p>
                            </div>
                            <div className="rounded-2xl border border-border/60 bg-muted/35 p-4">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                {t("comparison")}
                              </p>
                              {comparison === null ? (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {t("noData")}
                                </p>
                              ) : (
                                <p
                                  className={`mt-1 flex flex-wrap items-center gap-1 text-xl font-bold leading-tight ${
                                    comparison > 0
                                      ? "text-amber-600 dark:text-amber-400"
                                      : comparison < 0
                                        ? "text-emerald-600 dark:text-emerald-400"
                                        : "text-foreground"
                                  }`}
                                >
                                  {comparison > 0 ? (
                                    <TrendingUp className="size-4 shrink-0" />
                                  ) : comparison < 0 ? (
                                    <TrendingDown className="size-4 shrink-0" />
                                  ) : null}
                                  <span className="break-words">
                                    {comparison > 0 ? "+" : ""}
                                    {comparison} {latest!.unit}
                                  </span>
                                </p>
                              )}
                              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                                {t("previousReading")}:{" "}
                                {previous ? readingLabel(previous, types) : "—"}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-border/60 p-3 sm:p-4">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                {t("chart")}
                              </p>
                              <span className="text-[10px] text-muted-foreground">
                                {typeReadings.length} {t("healthRecords")}
                              </span>
                            </div>
                            <TrendChart readings={typeReadings} />
                          </div>

                          <div>
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                {t("readingHistory")}
                              </p>
                              <span className="text-[10px] text-muted-foreground">
                                {Math.min(typeReadings.length, 20)} / {typeReadings.length}
                              </span>
                            </div>
                            <div className="divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/60">
                              {typeReadings.slice(0, 20).map((reading) => (
                                <div
                                  key={reading._id}
                                  className="flex items-start gap-2 px-3 py-3"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="break-words text-sm font-semibold leading-snug text-foreground">
                                      {readingLabel(reading, types)}
                                    </p>
                                    <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
                                      {formatDateTime(reading.recordedAt)}
                                    </p>
                                    {reading.notes && (
                                      <p className="mt-1 break-words text-[11px] leading-relaxed text-muted-foreground">
                                        {reading.notes}
                                      </p>
                                    )}
                                  </div>
                                  <div className="flex shrink-0 gap-0.5">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-9"
                                      aria-label={t("editReading")}
                                      onClick={() => openEditReading(reading)}
                                    >
                                      <Pencil className="size-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-9 text-muted-foreground hover:text-destructive"
                                      aria-label={t("delete")}
                                      onClick={() => setDeleteReading(reading)}
                                    >
                                      <Trash2 className="size-3.5" />
                                    </Button>
                                  </div>
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
                <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span className="flex size-8 items-center justify-center rounded-xl bg-primary/[0.08]">
                      <FileText className="size-4 text-primary" />
                    </span>
                    {t("reports")}
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 w-full rounded-xl sm:w-auto"
                    onClick={() => setReportOpen(true)}
                  >
                    <Upload className="size-3.5" /> {t("uploadReport")}
                  </Button>
                </CardHeader>
                <CardContent>
                  {(reports ?? []).length === 0 ? (
                    <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-sm leading-relaxed text-muted-foreground">
                      {t("noReports")}
                    </p>
                  ) : (
                    <div className="divide-y divide-border/50 overflow-hidden rounded-xl border border-border/60">
                      {(reports as Report[]).map((report) => (
                        <div key={report._id} className="flex items-center gap-2 px-3 py-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.07]">
                            <FileText className="size-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-sm font-medium leading-snug">
                              {report.title}
                            </p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {report.fileName} · {formatDate(report.recordedAt)}
                            </p>
                          </div>
                          {report.url && (
                            <Button asChild variant="ghost" size="sm" className="h-9 shrink-0 rounded-lg px-2 text-[11px]">
                              <a href={report.url} target="_blank" rel="noreferrer">
                                {t("viewReport")}
                              </a>
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
                            aria-label={t("delete")}
                            onClick={() => removeReport({ reportId: report._id })}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
                    <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-primary" /> {t("reportPrivacy")}
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              {/* Prescriptions */}
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-primary/[0.08]">
                      <Pill className="size-3.5 text-primary" />
                    </span>
                    {t("prescriptions")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {memberPrescriptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("noPrescriptions")}</p>
                  ) : (
                    <div className="space-y-2">
                      {memberPrescriptions.slice(0, 4).map((rx: any) => (
                        <div key={rx._id} className="rounded-xl border border-border/60 p-3">
                          <p className="break-words text-xs font-medium leading-snug">{rx.fileName}</p>
                          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                            <Badge variant="secondary" className="text-[10px] capitalize">
                              {String(rx.status).replace(/_/g, " ")}
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
                    className="h-10 w-full rounded-xl"
                    disabled={uploadingPrescription || uploadingRx}
                    onClick={() => prescriptionInput.current?.click()}
                  >
                    {(uploadingPrescription || uploadingRx) ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Upload className="size-3.5" />
                    )}
                    {t("uploadPrescription")}
                  </Button>
                </CardContent>
              </Card>

              {/* Reminders */}
              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <span className="flex size-7 items-center justify-center rounded-lg bg-primary/[0.08]">
                      <Pill className="size-3.5 text-primary" />
                    </span>
                    {t("reminders")}
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
                          className="flex items-center justify-between gap-2 rounded-xl border border-border/60 p-3"
                        >
                          <div className="min-w-0">
                            <p className="break-words text-xs font-medium leading-snug">
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
                    className="h-10 w-full rounded-xl"
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
                    <span className="flex size-7 items-center justify-center rounded-lg bg-primary/[0.08]">
                      <ShoppingBag className="size-3.5 text-primary" />
                    </span>
                    {t("orders")}
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
                              {String(order.status).replace(/_/g, " ")} ·{" "}
                              {formatDate(order.createdAt)}
                            </p>
                          </div>
                          <ChevronRight className="size-3.5 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" size="sm" className="h-10 min-w-0 rounded-xl px-2 text-[11px]" onClick={() => navigate("/products")}>
                      <ShoppingBag className="size-3.5 shrink-0" /> <span className="truncate">{t("shop")}</span>
                    </Button>
                    <Button variant="outline" size="sm" className="h-10 min-w-0 rounded-xl px-2 text-[11px]" onClick={() => navigate("/account/orders")}>
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
                    <p className="whitespace-pre-line break-words text-xs leading-relaxed text-muted-foreground">
                      {config.educationalContent}
                    </p>
                  </CardContent>
                </Card>
              )}

              <div className="flex items-start gap-2.5 rounded-2xl border border-primary/10 bg-primary/[0.03] p-4">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
                <p className="break-words text-[10px] leading-relaxed text-muted-foreground sm:text-[11px]">
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
            <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2">
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
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="h-10 w-full sm:w-auto" onClick={() => setDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              className="h-10 w-full gradient-primary text-white sm:w-auto"
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
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="h-10 w-full sm:w-auto" onClick={() => setReportOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              className="h-10 w-full gradient-primary text-white sm:w-auto"
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
