import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  Clock,
  Info,
  Loader2,
  Pencil,
  Pill,
  Plus,
  SkipForward,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  todayDoseSlots,
  nextDoseAfter,
  formatSlotTime,
  localDayStartMs,
} from "@/convex/pillScheduleCore";

const MAX_TIMES = 6;

type Reminder = {
  _id: Id<"pill_reminders">;
  medicineName: string;
  doctorSchedule?: string;
  times: string[];
  startDate: number;
  endDate?: number;
  timezoneOffsetMinutes: number;
  isActive: boolean;
  createdAt: number;
};

type EventRow = {
  _id: string;
  reminderId: string;
  scheduledFor: number;
  status: "taken" | "skipped";
  recordedAt: number;
  medicineName: string;
  timezoneOffsetMinutes: number;
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function todayInputValue() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** yyyy-mm-dd interpreted as local midnight in the reminder's UTC offset. */
function inputToTimestamp(value: string, offsetMinutes: number): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day) + offsetMinutes * 60 * 1000;
}

function timestampToInput(value: number, offsetMinutes: number): string {
  const d = new Date(value - offsetMinutes * 60 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function formatDate(value: number, offsetMinutes: number) {
  return new Date(value - offsetMinutes * 60 * 1000).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function to12Hour(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${pad(minute)} ${suffix}`;
}

type FormState = {
  medicineName: string;
  doctorSchedule: string;
  times: string[];
  startDate: string;
  endDate: string;
};

const EMPTY_FORM = (): FormState => ({
  medicineName: "",
  doctorSchedule: "",
  times: ["09:00"],
  startDate: todayInputValue(),
  endDate: "",
});

export default function AccountPillReminders() {
  const reminders = useQuery(api.pillReminders.list, {});
  const history = useQuery(api.pillReminders.history, {});
  const createReminder = useMutation(api.pillReminders.create);
  const updateReminder = useMutation(api.pillReminders.update);
  const removeReminder = useMutation(api.pillReminders.remove);
  const recordDose = useMutation(api.pillReminders.recordDose);

  const [now, setNow] = useState(() => Date.now());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Reminder | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Reminder | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [recordingKey, setRecordingKey] = useState<string | null>(null);

  // Keep "today" and due states current without refetching the schedule.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const eventMap = useMemo(() => {
    const map = new Map<string, EventRow>();
    for (const event of (history ?? []) as unknown as EventRow[]) {
      map.set(`${event.reminderId}:${event.scheduledFor}`, event);
    }
    return map;
  }, [history]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM());
    setDialogOpen(true);
  }

  function openEdit(reminder: Reminder) {
    setEditing(reminder);
    setForm({
      medicineName: reminder.medicineName,
      doctorSchedule: reminder.doctorSchedule ?? "",
      times: reminder.times.length > 0 ? reminder.times : ["09:00"],
      startDate: timestampToInput(reminder.startDate, reminder.timezoneOffsetMinutes),
      endDate:
        reminder.endDate !== undefined
          ? timestampToInput(reminder.endDate, reminder.timezoneOffsetMinutes)
          : "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (form.medicineName.trim().length < 2) {
      toast.error("Enter the medicine name as written on your prescription.");
      return;
    }
    if (form.times.length === 0) {
      toast.error("Add at least one reminder time.");
      return;
    }
    if (new Set(form.times).size !== form.times.length) {
      toast.error("Each reminder time must be different.");
      return;
    }
    if (form.endDate && form.endDate < form.startDate) {
      toast.error("End date cannot be before the start date.");
      return;
    }

    setSaving(true);
    try {
      // Editing keeps the reminder's original timezone so its existing slots do
      // not move if the customer is travelling.
      const offset = editing
        ? editing.timezoneOffsetMinutes
        : new Date().getTimezoneOffset();
      const startDate = inputToTimestamp(form.startDate, offset);
      const endDate = form.endDate ? inputToTimestamp(form.endDate, offset) : null;

      if (editing) {
        await updateReminder({
          reminderId: editing._id,
          medicineName: form.medicineName.trim(),
          doctorSchedule: form.doctorSchedule.trim(),
          times: form.times,
          startDate,
          endDate,
        });
        toast.success("Pill reminder updated");
      } else {
        await createReminder({
          medicineName: form.medicineName.trim(),
          doctorSchedule: form.doctorSchedule.trim() || undefined,
          times: form.times,
          startDate,
          endDate: endDate ?? undefined,
          timezoneOffsetMinutes: offset,
        });
        toast.success("Pill reminder created");
      }
      setDialogOpen(false);
    } catch (error: any) {
      toast.error(error?.message ?? "Could not save the reminder");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(reminder: Reminder, active: boolean) {
    setTogglingId(reminder._id);
    try {
      await updateReminder({ reminderId: reminder._id, isActive: active });
      toast.success(active ? "Reminder resumed" : "Reminder paused");
    } catch (error: any) {
      toast.error(error?.message ?? "Could not update the reminder");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await removeReminder({ reminderId: deleteTarget._id });
      toast.success("Pill reminder deleted");
      setDeleteTarget(null);
    } catch (error: any) {
      toast.error(error?.message ?? "Could not delete the reminder");
    } finally {
      setDeleting(false);
    }
  }

  async function handleDose(
    reminder: Reminder,
    scheduledFor: number,
    status: "taken" | "skipped",
  ) {
    const key = `${reminder._id}:${scheduledFor}:${status}`;
    setRecordingKey(key);
    try {
      await recordDose({ reminderId: reminder._id, scheduledFor, status });
      toast.success(status === "taken" ? "Marked as taken" : "Marked as skipped");
    } catch (error: any) {
      toast.error(error?.message ?? "Could not record this dose");
    } finally {
      setRecordingKey(null);
    }
  }

  if (reminders === undefined) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Pill Reminders</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Keep your medicine schedule in one place, private to your account.
          </p>
        </div>
        <Button className="gap-2 gradient-primary text-white" onClick={openCreate}>
          <Plus className="size-4" /> Add medicine
        </Button>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Enter the medicine and times exactly as your doctor prescribed them — we never
          suggest a medicine, dose or frequency. Reminders appear as website
          notifications; browser alerts are not guaranteed while the website is closed.
        </p>
      </div>

      {reminders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-14 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted/50">
              <Pill className="size-6 text-muted-foreground/50" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No pill reminders yet</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Add a medicine from your prescription and choose the times you were told
              to take it.
            </p>
            <Button className="mt-4 gap-2" variant="outline" onClick={openCreate}>
              <Plus className="size-4" /> Add your first medicine
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reminders.map((reminder) => {
            const doses = todayDoseSlots(reminder, now);
            const nextDose = nextDoseAfter(reminder, now);
            const todayStart = localDayStartMs(now, reminder.timezoneOffsetMinutes);
            const windowEnded =
              reminder.endDate !== undefined &&
              todayStart > localDayStartMs(reminder.endDate, reminder.timezoneOffsetMinutes);

            return (
              <Card key={reminder._id} className="border-border/60">
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                        {reminder.medicineName}
                        {!reminder.isActive && (
                          <Badge variant="secondary" className="text-[10px]">
                            Paused
                          </Badge>
                        )}
                        {windowEnded && (
                          <Badge variant="outline" className="text-[10px]">
                            Schedule ended
                          </Badge>
                        )}
                      </CardTitle>
                      {reminder.doctorSchedule ? (
                        <CardDescription className="mt-1">
                          {reminder.doctorSchedule}
                        </CardDescription>
                      ) : null}
                      <p className="mt-1 text-xs text-muted-foreground">
                        {formatDate(reminder.startDate, reminder.timezoneOffsetMinutes)} —{" "}
                        {reminder.endDate !== undefined
                          ? formatDate(reminder.endDate, reminder.timezoneOffsetMinutes)
                          : "Ongoing"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-muted-foreground">
                          {reminder.isActive ? "Active" : "Paused"}
                        </span>
                        {togglingId === reminder._id ? (
                          <Loader2 className="size-4 animate-spin text-muted-foreground" />
                        ) : (
                          <Switch
                            checked={reminder.isActive}
                            onCheckedChange={(checked) => handleToggle(reminder, checked)}
                            aria-label={`Pause ${reminder.medicineName}`}
                          />
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit reminder"
                        onClick={() => openEdit(reminder)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete reminder"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(reminder)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-1.5">
                    {reminder.times.map((time) => (
                      <span
                        key={time}
                        className="rounded-full bg-primary/[0.07] px-2.5 py-1 text-[11px] font-medium text-primary"
                      >
                        {to12Hour(time)}
                      </span>
                    ))}
                  </div>

                  {reminder.isActive && (
                    <div className="rounded-xl border border-border/50 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground">Today</p>
                        {nextDose && (
                          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Clock className="size-3" />
                            Next {formatSlotTime(nextDose, reminder.timezoneOffsetMinutes)}
                          </p>
                        )}
                      </div>
                      {doses.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          This schedule is not active today.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {doses.map((dose) => {
                            const event = eventMap.get(`${reminder._id}:${dose.scheduledFor}`);
                            return (
                              <div
                                key={dose.scheduledFor}
                                className="flex flex-wrap items-center justify-between gap-2"
                              >
                                <span className="text-sm text-foreground">
                                  {to12Hour(dose.time)}
                                </span>
                                {event ? (
                                  <Badge
                                    variant="secondary"
                                    className={`gap-1 text-[10px] ${
                                      event.status === "taken"
                                        ? "text-emerald-700"
                                        : "text-amber-700"
                                    }`}
                                  >
                                    {event.status === "taken" ? (
                                      <Check className="size-3" />
                                    ) : (
                                      <SkipForward className="size-3" />
                                    )}
                                    {event.status === "taken" ? "Taken" : "Skipped"}
                                  </Badge>
                                ) : dose.isPast ? (
                                  <div className="flex gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 gap-1 px-2 text-xs"
                                      disabled={recordingKey !== null}
                                      onClick={() =>
                                        handleDose(reminder, dose.scheduledFor, "taken")
                                      }
                                    >
                                      {recordingKey ===
                                      `${reminder._id}:${dose.scheduledFor}:taken` ? (
                                        <Loader2 className="size-3 animate-spin" />
                                      ) : (
                                        <Check className="size-3" />
                                      )}
                                      Taken
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                                      disabled={recordingKey !== null}
                                      onClick={() =>
                                        handleDose(reminder, dose.scheduledFor, "skipped")
                                      }
                                    >
                                      {recordingKey ===
                                      `${reminder._id}:${dose.scheduledFor}:skipped` ? (
                                        <Loader2 className="size-3 animate-spin" />
                                      ) : (
                                        <SkipForward className="size-3" />
                                      )}
                                      Skipped
                                    </Button>
                                  </div>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">
                                    Upcoming
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Private reminder history */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-bold">
            <Clock className="size-4" /> Reminder history
          </CardTitle>
          <CardDescription>
            Your recent Taken and Skipped actions. Only you can see this.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {history === undefined ? (
            <div className="flex justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">
              No doses recorded yet. Use Taken or Skipped on a due dose to build your
              history.
            </p>
          ) : (
            <div className="space-y-2">
              {(history as unknown as EventRow[]).slice(0, 25).map((event) => (
                <div
                  key={event._id}
                  className="flex items-center justify-between gap-3 border-b border-border/40 pb-2 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {event.medicineName}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(
                        event.scheduledFor - event.timezoneOffsetMinutes * 60 * 1000,
                      ).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "UTC",
                      })}
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`shrink-0 text-[10px] ${
                      event.status === "taken" ? "text-emerald-700" : "text-amber-700"
                    }`}
                  >
                    {event.status === "taken" ? "Taken" : "Skipped"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit pill reminder" : "Add pill reminder"}</DialogTitle>
            <DialogDescription>
              Use the medicine name and times exactly as written on your prescription.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pill-medicine">Medicine name</Label>
              <Input
                id="pill-medicine"
                value={form.medicineName}
                onChange={(e) => setForm((prev) => ({ ...prev, medicineName: e.target.value }))}
                placeholder="e.g. Metformin 500 mg"
                maxLength={80}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pill-schedule">Doctor-prescribed schedule (optional)</Label>
              <Input
                id="pill-schedule"
                value={form.doctorSchedule}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, doctorSchedule: e.target.value }))
                }
                placeholder="e.g. 1 tablet after breakfast"
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label>Reminder times</Label>
              <div className="space-y-2">
                {form.times.map((time, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={time}
                      onChange={(e) =>
                        setForm((prev) => {
                          const times = [...prev.times];
                          times[index] = e.target.value;
                          return { ...prev, times };
                        })
                      }
                      className="max-w-[160px]"
                    />
                    {form.times.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove time"
                        className="text-muted-foreground"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            times: prev.times.filter((_, i) => i !== index),
                          }))
                        }
                      >
                        <X className="size-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {form.times.length < MAX_TIMES && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() =>
                      setForm((prev) => ({ ...prev, times: [...prev.times, "21:00"] }))
                    }
                  >
                    <Plus className="size-3.5" /> Add time
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pill-start">Start date</Label>
                <Input
                  id="pill-start"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pill-end">End date (optional)</Label>
                <Input
                  id="pill-end"
                  type="date"
                  value={form.endDate}
                  min={form.startDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>

            {form.endDate && form.endDate < form.startDate && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="size-3.5" /> End date must be on or after the start
                date.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="gap-2 gradient-primary text-white"
            >
              {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              {editing ? "Save changes" : "Create reminder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this pill reminder?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.medicineName} and its Taken/Skipped history will be removed.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
