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
  ChevronRight,
  HeartHandshake,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";

type Member = {
  _id: Id<"family_members">;
  name: string;
  relationship: string;
  dateOfBirth?: number;
  gender?: string;
  bloodGroup?: string;
  phone?: string;
  notes?: string;
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

export default function FamilyHealth() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const availability = useQuery(api.familyHealth.getAvailability);
  const members = useQuery(api.familyHealth.list);
  const summary = useQuery(api.familyHealth.summary);
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
      const payload = {
        name: form.name.trim(),
        relationship: form.relationship as (typeof RELATIONSHIPS)[number],
        dateOfBirth: fromInputDate(form.dateOfBirth),
        gender: form.gender
          ? (form.gender as "male" | "female" | "other")
          : undefined,
        bloodGroup: form.bloodGroup.trim() || undefined,
        phone: form.phone || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (editing) {
        await updateMember({ memberId: editing._id, ...payload });
      } else {
        await createMember(payload);
      }
      toast.success(t("memberSaved"));
      setDialogOpen(false);
    } catch (error: any) {
      toast.error(error?.message || t("somethingWentWrong"));
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
    } catch (error: any) {
      toast.error(error?.message || t("somethingWentWrong"));
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
        <div className="mx-auto max-w-5xl px-4 pb-12 pt-5 sm:px-6 lg:py-9">
          <div className="mb-5 flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("back")}
              className="rounded-xl lg:hidden"
              onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
            >
              <ArrowLeft className="size-5" />
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="flex items-center gap-2 text-xl font-bold text-foreground">
                <HeartHandshake className="size-5 text-primary" />
                {t("familyHealth")}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t("familyHealthSubtitle")}
              </p>
            </div>
            <Button
              size="sm"
              className="rounded-xl gradient-primary font-semibold text-white"
              onClick={openCreate}
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">{t("addFamilyMember")}</span>
              <span className="sm:hidden">{t("add")}</span>
            </Button>
          </div>

          <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
            {[
              { label: t("familyMembers"), value: summary?.members ?? memberList.length, icon: Users },
              { label: t("healthRecords"), value: summary?.readings ?? 0, icon: Activity },
              { label: t("reports"), value: summary?.reports ?? 0, icon: ShieldCheck },
            ].map((stat) => (
              <Card key={stat.label} className="border-border/60">
                <CardContent className="flex items-center gap-3 p-3.5 sm:p-4">
                  <div className="hidden size-9 shrink-0 items-center justify-center rounded-xl bg-primary/[0.07] sm:flex">
                    <stat.icon className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-lg font-bold leading-tight text-foreground">{stat.value}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {members === undefined ? (
            <div className="flex justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : memberList.length === 0 ? (
            <Card className="border-dashed border-border/70">
              <CardContent className="flex flex-col items-center px-6 py-14 text-center">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/[0.07]">
                  <Users className="size-7 text-primary" />
                </div>
                <h2 className="mt-4 text-base font-semibold">{t("familyMembers")}</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {t("noMembers")}
                </p>
                <Button className="mt-5 rounded-xl gradient-primary text-white" onClick={openCreate}>
                  <Plus className="size-4" /> {t("addFamilyMember")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {memberList.map((member, index) => {
                const Icon = RELATIONSHIP_ICON[member.relationship] ?? User;
                return (
                  <motion.div
                    key={member._id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.2) }}
                  >
                    <Card className="group h-full border-border/60 transition-all duration-200 hover:border-primary/25 hover:shadow-card-hover">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => navigate(`/family-health/${member._id}`)}
                            className="flex min-w-0 flex-1 items-start gap-3 text-left"
                          >
                            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/[0.07] text-primary">
                              <Icon className="size-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h2 className="truncate text-sm font-semibold text-foreground">
                                  {member.name}
                                </h2>
                                {member.relationship === "self" && (
                                  <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px]">
                                    {t("self")}
                                  </Badge>
                                )}
                              </div>
                              <p className="mt-0.5 text-xs capitalize text-muted-foreground">
                                {t(member.relationship)}
                                {member.bloodGroup ? ` · ${member.bloodGroup}` : ""}
                                {member.gender ? ` · ${t(member.gender)}` : ""}
                              </p>
                              <span className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                                {t("careOverview")} <ChevronRight className="size-3.5" />
                              </span>
                            </div>
                          </button>
                          <div className="flex shrink-0 gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={t("editFamilyMember")}
                              onClick={() => openEdit(member)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8 text-muted-foreground hover:text-destructive"
                              aria-label={t("remove")}
                              onClick={() => setDeleteTarget(member)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}

          <div className="mt-6 flex items-start gap-2 rounded-2xl border border-border/60 bg-muted/30 p-3.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t("privacyNotice")}
            </p>
          </div>
        </div>
      </main>
      <Footer />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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
                  max={toInputDate(Date.now())}
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
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              className="gradient-primary text-white"
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
    </div>
  );
}
