import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  Baby,
  Camera,
  ChevronRight,
  FileText,
  HeartHandshake,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { MemberAvatar, MemberPhotoDialog } from "@/components/family/MemberPhoto";

type Member = {
  _id: Id<"family_members">;
  name: string;
  relationship: string;
  dateOfBirth?: number;
  gender?: string;
  bloodGroup?: string;
  phone?: string;
  notes?: string;
  photoUrl?: string | null;
  createdAt: number;
};

const RELATIONSHIPS = ["self", "father", "mother", "child", "spouse", "other"] as const;

const RELATIONSHIP_ICON: Record<string, typeof User> = {
  self: User,
  father: User,
  mother: User,
  child: Baby,
  spouse: HeartHandshake,
  other: Users,
};

type FormState = {
  name: string;
  relationship: string;
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  phone: string;
  notes: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  relationship: "father",
  dateOfBirth: "",
  gender: "",
  bloodGroup: "",
  phone: "",
  notes: "",
};

function toInputDate(value?: number) {
  if (!value) return "";
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function fromInputDate(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function FamilyHealth() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const availability = useQuery(api.familyHealth.getAvailability);
  const members = useQuery(api.familyHealth.list);
  const summary = useQuery(api.familyHealth.summary);
  const config = useQuery(api.healthTracker.getConfig);
  const [activeStat, setActiveStat] = useState<"members" | "records" | "reports" | null>(null);
  const familyReadings = useQuery(
    api.familyHealth.listFamilyReadings,
    activeStat === "records" ? {} : "skip",
  );
  const familyReports = useQuery(
    api.familyHealth.listFamilyReports,
    activeStat === "reports" ? {} : "skip",
  );
  const ensureSelf = useMutation(api.familyHealth.ensureSelf);
  const createMember = useMutation(api.familyHealth.create);
  const updateMember = useMutation(api.familyHealth.update);
  const removeMember = useMutation(api.familyHealth.remove);

  const ensured = useRef(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [photoMember, setPhotoMember] = useState<Member | null>(null);
  const [todayInput] = useState(() => toInputDate(Date.now()));

  useEffect(() => {
    if (ensured.current || members === undefined) return;
    ensured.current = true;
    if (!members.some((m) => m.relationship === "self")) {
      ensureSelf({}).catch(() => {
        // A profile will be created next visit; the page stays usable.
      });
    }
  }, [members, ensureSelf]);

  const memberList = useMemo(() => (members ?? []) as Member[], [members]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      relationship: memberList.some((m) => m.relationship === "self") ? "father" : "self",
    });
    setDialogOpen(true);
  }

  function openEdit(member: Member) {
    setEditing(member);
    setForm({
      name: member.name,
      relationship: member.relationship,
      dateOfBirth: toInputDate(member.dateOfBirth),
      gender: member.gender ?? "",
      bloodGroup: member.bloodGroup ?? "",
      phone: member.phone ?? "",
      notes: member.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (form.name.trim().length < 2) {
      toast.error("Enter the member's name.");
      return;
    }
    if (form.phone && !/^[6-9]\d{9}$/.test(form.phone)) {
      toast.error("Enter a 10-digit mobile number starting with 6-9.");
      return;
    }
    setSaving(true);
    try {
      const base = {
        name: form.name.trim(),
        relationship: form.relationship as (typeof RELATIONSHIPS)[number],
      };
      if (editing) {
        await updateMember({
          memberId: editing._id,
          ...base,
          dateOfBirth: form.dateOfBirth ? fromInputDate(form.dateOfBirth) : null,
          gender: form.gender
            ? (form.gender as "male" | "female" | "other")
            : null,
          bloodGroup: form.bloodGroup.trim(),
          phone: form.phone,
          notes: form.notes.trim(),
        });
      } else {
        await createMember({
          ...base,
          dateOfBirth: form.dateOfBirth ? fromInputDate(form.dateOfBirth) : undefined,
          gender: form.gender
            ? (form.gender as "male" | "female" | "other")
            : undefined,
          bloodGroup: form.bloodGroup.trim() || undefined,
          phone: form.phone || undefined,
          notes: form.notes.trim() || undefined,
        });
      }
      toast.success(t("memberSaved"));
      setDialogOpen(false);
    } catch (error: unknown) {
      toast.error(errorText(error, t("somethingWentWrong")));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await removeMember({ memberId: deleteTarget._id });
      toast.success(t("memberRemoved"));
      setDeleteTarget(null);
    } catch (error: unknown) {
      toast.error(errorText(error, t("somethingWentWrong")));
    } finally {
      setDeleting(false);
    }
  }

  if (availability && !availability.familyHealthEnabled) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Navbar />
        <main className="flex-1 mx-auto flex max-w-2xl flex-col items-center justify-center px-4 py-24 text-center">
          <HeartHandshake className="size-12 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-bold">{t("familyHealth")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("familyHealthDisabled")}
          </p>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 pb-12 pt-4 sm:px-6 sm:pt-5 lg:py-9">
          <div className="mb-4 overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/[0.07] via-primary/[0.025] to-background">
            <div className="flex items-start gap-2.5 p-4 sm:gap-3 sm:p-5">
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("back")}
                className="-ml-1 size-9 shrink-0 rounded-lg lg:hidden"
                onClick={() => navigate(-1)}
              >
                <ArrowLeft className="size-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
                  <HeartHandshake className="size-4" />
                </div>
                <h1 className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                  {t("familyHealth")}
                </h1>
                <p className="mt-0.5 max-w-md text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {t("familyHealthSubtitle")}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-primary/10 bg-background/30 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                <ShieldCheck className="size-3 shrink-0 text-primary" />
                {t("privacySecurity")}
              </p>
              <Button
                size="sm"
                aria-label={t("addFamilyMember")}
                className="h-9 w-full shrink-0 rounded-lg gradient-primary px-3.5 font-semibold text-white sm:w-auto text-xs"
                onClick={openCreate}
              >
                <Plus className="size-3.5" />
                {t("addFamilyMember")}
              </Button>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-2 sm:mb-5 sm:gap-3">
            {[
              {
                key: "members" as const,
                label: t("familyMembers"),
                value: summary?.members ?? memberList.length,
                icon: Users,
              },
              {
                key: "records" as const,
                label: t("healthRecords"),
                value: summary?.readings ?? 0,
                icon: Activity,
              },
              {
                key: "reports" as const,
                label: t("reports"),
                value: summary?.reports ?? 0,
                icon: FileText,
              },
            ].map((stat) => {
              const active = activeStat === stat.key;
              return (
                <button
                  key={stat.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setActiveStat((current) => (current === stat.key ? null : stat.key))
                  }
                  className={`group min-w-0 rounded-xl border bg-card p-2.5 text-left transition-all duration-200 sm:p-3 ${
                    active
                      ? "border-primary/50 ring-1 ring-primary/15"
                      : "border-border/60 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm"
                  }`}
                >
                  <div className="mb-1.5 flex items-center justify-between gap-1">
                    <span
                      className={`flex size-7 items-center justify-center rounded-lg ${
                        active ? "bg-primary text-primary-foreground" : "bg-primary/[0.07] text-primary"
                      }`}
                    >
                      <stat.icon className="size-3.5" />
                    </span>
                    <ChevronRight
                      className={`size-3 transition-transform ${
                        active ? "rotate-90 text-primary" : "text-muted-foreground/50 group-hover:translate-x-0.5"
                      }`}
                    />
                  </div>
                  <p className="text-lg font-bold leading-none tracking-tight text-foreground sm:text-xl">
                    {stat.value}
                  </p>
                  <p className="mt-0.5 break-words text-[9px] leading-tight text-muted-foreground sm:text-[10px]">
                    {stat.label}
                  </p>
                </button>
              );
            })}
          </div>

          {activeStat && (
            <Card className="mb-5 border-primary/20 sm:mb-6">
              <CardContent className="p-3.5 sm:p-5">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold sm:text-base">
                      {activeStat === "members"
                        ? t("familyMembers")
                        : activeStat === "records"
                          ? t("healthRecords")
                          : t("reports")}
                    </h2>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                      {activeStat === "members"
                        ? "Every profile in your family, with separate private records."
                        : activeStat === "records"
                          ? "All saved readings across your family. Open a member to add or edit."
                          : "Reports uploaded for your family. Files stay private to your account."}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    aria-label={t("cancel")}
                    onClick={() => setActiveStat(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>

                {activeStat === "members" &&
                  (memberList.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center">
                      <p className="text-sm text-muted-foreground">{t("noMembers")}</p>
                      <Button className="mt-2.5 h-9" onClick={openCreate}>
                        <Plus className="size-4" /> {t("addFamilyMember")}
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {memberList.map((member) => (
                        <button
                          key={member._id}
                          type="button"
                          onClick={() => navigate(`/family-health/${member._id}`)}
                          className="flex min-w-0 items-center gap-2.5 rounded-lg border border-border/60 p-2 text-left transition-colors hover:bg-muted/40"
                        >
                          <MemberAvatar
                            name={member.name}
                            photoUrl={member.photoUrl}
                            className="size-9 rounded-lg text-[10px]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium">{member.name}</span>
                            <span className="block text-[9px] capitalize text-muted-foreground">
                              {t(member.relationship)}
                            </span>
                          </span>
                          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  ))}

                {activeStat === "records" &&
                  (familyReadings === undefined ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="size-5 animate-spin text-primary" />
                    </div>
                  ) : familyReadings.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center">
                      <Activity className="mx-auto size-7 text-muted-foreground/70" />
                      <p className="mt-2 text-sm font-medium">No health records yet</p>
                      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                        Add height, weight, blood pressure or another configured measurement for a family member.
                      </p>
                      <Button
                        className="mt-3 h-10"
                        onClick={() =>
                          memberList.length > 0
                            ? navigate(`/family-health/${memberList[0]._id}`)
                            : openCreate()
                        }
                      >
                        <Plus className="size-4" />
                        {memberList.length > 0 ? t("addReading") : t("addFamilyMember")}
                      </Button>
                    </div>
                  ) : (
                    <div className="max-h-80 divide-y divide-border/50 overflow-y-auto rounded-xl border border-border/60">
                      {familyReadings.map((reading) => {
                        const type = (config?.measurementTypes ?? []).find(
                          (item: { key: string }) => item.key === reading.typeKey,
                        );
                        return (
                          <button
                            key={reading._id}
                            type="button"
                            onClick={() => navigate(`/family-health/${reading.memberId}`)}
                            className="flex w-full min-w-0 items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted/40"
                          >
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.07] text-primary">
                              <Activity className="size-3.5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium sm:text-sm">
                                {reading.memberName} · {type?.label ?? reading.typeKey}
                              </span>
                              <span className="block text-[10px] text-muted-foreground">
                                {new Date(reading.recordedAt).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </span>
                            <span className="max-w-[45%] shrink-0 truncate text-xs font-semibold sm:text-sm">
                              {reading.secondaryValue !== undefined
                                ? `${reading.value}/${reading.secondaryValue}`
                                : reading.value}{" "}
                              {reading.unit}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ))}

                {activeStat === "reports" &&
                  (familyReports === undefined ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="size-5 animate-spin text-primary" />
                    </div>
                  ) : familyReports.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/70 px-4 py-8 text-center">
                      <FileText className="mx-auto size-7 text-muted-foreground/70" />
                      <p className="mt-2 text-sm font-medium">No reports uploaded yet</p>
                      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                        Upload lab reports or prescriptions to keep them with the right family member.
                      </p>
                      <Button
                        className="mt-3 h-10"
                        onClick={() =>
                          memberList.length > 0
                            ? navigate(`/family-health/${memberList[0]._id}`)
                            : openCreate()
                        }
                      >
                        <Plus className="size-4" />
                        {memberList.length > 0 ? t("uploadReport") : t("addFamilyMember")}
                      </Button>
                    </div>
                  ) : (
                    <div className="max-h-80 divide-y divide-border/50 overflow-y-auto rounded-xl border border-border/60">
                      {familyReports.map((report) => (
                        <div
                          key={report._id}
                          className="flex min-w-0 items-center gap-2.5 px-3 py-2.5"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.07] text-primary">
                            <FileText className="size-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium sm:text-sm">{report.title}</p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {report.memberName} ·{" "}
                              {new Date(report.recordedAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </p>
                          </div>
                          {report.url && (
                            <Button asChild variant="outline" size="sm" className="h-8 shrink-0 text-[11px]">
                              <a href={report.url} target="_blank" rel="noreferrer">
                                {t("viewReport")}
                              </a>
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          {members === undefined ? (
            <div className="flex justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : memberList.length === 0 ? (
            <Card className="border-dashed border-border/70">
              <CardContent className="flex flex-col items-center px-4 py-8 text-center sm:py-10">
                <div className="flex size-12 items-center justify-center rounded-xl bg-primary/[0.07]">
                  <Users className="size-6 text-primary" />
                </div>
                <h2 className="mt-3 text-sm font-semibold">{t("familyMembers")}</h2>
                <p className="mt-0.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
                  {t("noMembers")}
                </p>
                <Button className="mt-4 h-9 rounded-lg gradient-primary px-4 text-white text-xs" onClick={openCreate}>
                  <Plus className="size-3.5" /> {t("addFamilyMember")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-3 px-0.5">
                <h2 className="text-sm font-semibold text-foreground">{t("familyMembers")}</h2>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {memberList.length}
                </span>
              </div>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {memberList.map((member, index) => {
                  const Icon = RELATIONSHIP_ICON[member.relationship] ?? User;
                  return (
                    <motion.div
                      key={member._id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.025, 0.15) }}
                      className="min-w-0"
                    >
                      <Card className="group flex h-full flex-col border-border/60 transition-all duration-200 hover:border-primary/25 hover:shadow-card-hover">
                        <CardContent className="flex flex-1 flex-col p-3">
                          <div className="flex items-start gap-2.5">
                            <button
                              type="button"
                              className="group/photo relative shrink-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                              aria-label={`Change photo for ${member.name}`}
                              onClick={() => setPhotoMember(member)}
                            >
                              <MemberAvatar
                                name={member.name}
                                photoUrl={member.photoUrl}
                                className="size-10 rounded-xl text-xs"
                              />
                              <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground shadow-sm">
                                <Camera className="size-2" />
                              </span>
                            </button>
                            <div className="min-w-0 flex-1 pt-0">
                              <div className="flex min-w-0 flex-wrap items-center gap-1">
                                <h3 className="min-w-0 break-words text-sm font-semibold leading-tight text-foreground">
                                  {member.name}
                                </h3>
                                <Badge
                                  variant="secondary"
                                  className="shrink-0 rounded text-[9px] capitalize"
                                >
                                  {t(member.relationship)}
                                </Badge>
                              </div>
                              <p className="mt-0.5 text-[10px] capitalize text-muted-foreground">
                                {[member.gender ? t(member.gender) : null, member.bloodGroup]
                                  .filter(Boolean)
                                  .join(" · ") || t("memberProfile")}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                              aria-label={t("remove")}
                              onClick={() => setDeleteTarget(member)}
                            >
                              <Trash2 className="size-3" />
                            </Button>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-1">
                            {member.phone && (
                              <span className="max-w-full truncate rounded-md bg-muted/60 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                                {member.phone}
                              </span>
                            )}
                            {member.dateOfBirth && (
                              <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                                {new Date(member.dateOfBirth).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            )}
                            {member.notes && (
                              <span className="line-clamp-1 max-w-full rounded-md bg-muted/60 px-1.5 py-0.5 text-[9px] text-muted-foreground">
                                {member.notes}
                              </span>
                            )}
                          </div>

                          <div className="mt-auto space-y-1 pt-3">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 w-full min-w-0 justify-between rounded-lg border-primary/20 bg-primary/[0.035] px-2.5 text-[10px] font-semibold text-primary hover:bg-primary/[0.07]"
                              onClick={() => navigate(`/family-health/${member._id}`)}
                            >
                              <span className="flex min-w-0 items-center gap-1">
                                <Activity className="size-3 shrink-0" />
                                <span className="truncate">{t("healthTracker")}</span>
                              </span>
                              <ChevronRight className="size-3 shrink-0" />
                            </Button>
                            <div className="grid grid-cols-3 gap-0.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 min-w-0 rounded-lg px-1 text-[9px] text-muted-foreground"
                                onClick={() => navigate(`/family-health/${member._id}`)}
                              >
                                <Icon className="size-3 shrink-0" />
                                <span className="truncate">{t("profile")}</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 min-w-0 rounded-lg px-1 text-[9px] text-muted-foreground"
                                onClick={() => setPhotoMember(member)}
                              >
                                <Camera className="size-3 shrink-0" />
                                <span className="truncate">Photo</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 min-w-0 rounded-lg px-1 text-[9px] text-muted-foreground"
                                onClick={() => openEdit(member)}
                              >
                                <Pencil className="size-3 shrink-0" />
                                <span className="truncate">{t("edit")}</span>
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-primary/10 bg-primary/[0.035] p-3">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <ShieldCheck className="size-3.5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-foreground">{t("privacySecurity")}</p>
              <p className="mt-0.5 break-words text-[10px] leading-relaxed text-muted-foreground">
                {t("privacyNotice")}
              </p>
            </div>
          </div>
        </div>
      </main>
      <Footer />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl p-5 sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle>
              {editing ? t("editFamilyMember") : t("addFamilyMember")}
            </DialogTitle>
            <DialogDescription>
              Each member has a separate profile and private health records.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="member-name">{t("memberProfile")} *</Label>
              <Input
                id="member-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Full name"
                maxLength={60}
              />
            </div>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>{t("relationship")}</Label>
                <Select
                  value={form.relationship}
                  onValueChange={(value) => setForm({ ...form, relationship: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONSHIPS.map((rel) => (
                      <SelectItem key={rel} value={rel}>
                        {t(rel)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="member-dob">{t("dateOfBirth")}</Label>
                <Input
                  id="member-dob"
                  type="date"
                  value={form.dateOfBirth}
                  max={todayInput}
                  onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t("gender")}</Label>
                <Select
                  value={form.gender || "unset"}
                  onValueChange={(value) =>
                    setForm({ ...form, gender: value === "unset" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("selectPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">{t("none")}</SelectItem>
                    <SelectItem value="male">{t("male")}</SelectItem>
                    <SelectItem value="female">{t("female")}</SelectItem>
                    <SelectItem value="other">{t("other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="member-blood">{t("bloodGroup")}</Label>
                <Input
                  id="member-blood"
                  value={form.bloodGroup}
                  onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                  placeholder="e.g. B+"
                  maxLength={8}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-phone">{t("phone")}</Label>
              <Input
                id="member-phone"
                inputMode="numeric"
                value={form.phone}
                onChange={(e) =>
                  setForm({ ...form, phone: e.target.value.replace(/\D/g, "").slice(0, 10) })
                }
                placeholder="10-digit mobile number"
                maxLength={10}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="member-notes">{t("memberNotes")}</Label>
              <Textarea
                id="member-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                maxLength={300}
                placeholder="Allergies, ongoing care or anything the family should remember"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="h-10 w-full sm:w-auto" onClick={() => setDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              className="h-10 w-full gradient-primary text-white sm:w-auto"
              onClick={handleSave}
              disabled={saving}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("remove")} {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Health records, prescriptions and reminders must be removed or reassigned first,
              so nothing is deleted by accident.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-1 size-4 animate-spin" />}
              {t("remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {photoMember && (
        <MemberPhotoDialog
          open={!!photoMember}
          onOpenChange={(open) => !open && setPhotoMember(null)}
          memberId={photoMember._id}
          name={photoMember.name}
          photoUrl={photoMember.photoUrl}
        />
      )}
    </div>
  );
}
