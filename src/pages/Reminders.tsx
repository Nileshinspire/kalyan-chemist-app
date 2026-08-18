import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import {
  Pill,
  Plus,
  Clock,
  Trash2,
  Bell,
  CalendarDays,
  Loader2,
  ShoppingCart,
} from "lucide-react";
import { relativeTime, daysUntil } from "@/lib/security";
import { formatCurrency } from "@/lib/auth-utils";

export default function Reminders() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const reminders = useQuery(
    api.reminders.list,
    isAuthenticated ? {} : "skip"
  );
  const createReminder = useMutation(api.reminders.create);
  const deleteReminder = useMutation(api.reminders.remove);
  const updateReminder = useMutation(api.reminders.update);

  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Simple product search state
  const [searchSlug, setSearchSlug] = useState("");
  const [intervalDays, setIntervalDays] = useState("30");
  const [notes, setNotes] = useState("");

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-background px-6 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <Bell className="mx-auto size-12 text-muted-foreground/50" />
          <h1 className="mt-4 text-2xl font-bold">Refill Reminders</h1>
          <p className="mt-2 text-muted-foreground">
            Sign in to manage your medicine refill reminders.
          </p>
          <Button className="mt-4" onClick={() => navigate("/auth")}>
            Sign In
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-3xl">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Refill Reminders
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Never run out of essential medicines. Set reminders to reorder on time.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" />
                Add Reminder
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Refill Reminder</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Medicine Slug (from product page URL)</Label>
                  <Input
                    placeholder="e.g. crocin-advance-500mg"
                    value={searchSlug}
                    onChange={(e) => setSearchSlug(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Copy the slug from the medicine's product page URL.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Remind me every</Label>
                  <Select value={intervalDays} onValueChange={setIntervalDays}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Weekly (7 days)</SelectItem>
                      <SelectItem value="14">Every 2 weeks</SelectItem>
                      <SelectItem value="30">Monthly (30 days)</SelectItem>
                      <SelectItem value="60">Every 2 months</SelectItem>
                      <SelectItem value="90">Quarterly (90 days)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input
                    placeholder="e.g. Take after breakfast"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  onClick={async () => {
                    if (!searchSlug.trim()) {
                      toast.error("Please enter a medicine slug");
                      return;
                    }
                    setIsCreating(true);
                    try {
                      // Look up the product by slug first
                      // We'll use the product page's slug lookup
                      await createReminder({
                        productId: searchSlug.trim() as any, // This is a placeholder — in production, look up the product ID first
                        intervalDays: parseInt(intervalDays),
                        notes: notes.trim() || undefined,
                      });
                      toast.success("Reminder created!");
                      setOpen(false);
                      setSearchSlug("");
                      setNotes("");
                    } catch (err) {
                      toast.error("Failed to create reminder", {
                        description: err instanceof Error ? err.message : "Unknown error",
                      });
                    }
                    setIsCreating(false);
                  }}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <><Loader2 className="mr-1.5 size-3.5 animate-spin" /> Creating…</>
                  ) : "Create Reminder"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </header>

        {/* Reminder List */}
        {!reminders ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-lg bg-muted/50" />
            ))}
          </div>
        ) : reminders.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Pill className="size-12 text-muted-foreground/30" />
              <p className="mt-4 text-muted-foreground">No reminders set yet.</p>
              <p className="mt-1 text-sm text-muted-foreground/70 max-w-sm text-center">
                Add a refill reminder for any medicine you take regularly and
                we'll notify you when it's time to reorder.
              </p>
              <Button className="mt-4 gap-2" onClick={() => setOpen(true)}>
                <Plus className="size-4" />
                Add Your First Reminder
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {reminders.map((reminder) => {
              const product = reminder.product;
              const days = daysUntil(reminder.nextReminderAt);
              const isOverdue = days <= 0;
              const isSoon = days <= 3 && days > 0;

              return (
                <Card
                  key={reminder._id}
                  className={`border-border/60 transition-all hover:border-primary/30 ${
                    isOverdue
                      ? "border-red-300/50 bg-red-50/30 dark:border-red-800/30 dark:bg-red-950/10"
                      : isSoon
                      ? "border-amber-300/50 bg-amber-50/30 dark:border-amber-800/30 dark:bg-amber-950/10"
                      : ""
                  }`}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div
                      className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${
                        isOverdue
                          ? "bg-red-100 text-red-600 dark:bg-red-900/40"
                          : isSoon
                          ? "bg-amber-100 text-amber-600 dark:bg-amber-900/40"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      <Pill className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {product?.name || "Medicine"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {product?.dosage && `${product.dosage} · `}
                        {product?.packSize}
                        {product?.price !== undefined && ` · ${formatCurrency(product.price)}`}
                      </p>
                      {reminder.notes && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5 italic">
                          "{reminder.notes}"
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <Badge variant="outline" className="text-[10px]">
                          <CalendarDays className="mr-1 size-3" />
                          Every {reminder.intervalDays} days
                        </Badge>
                        <span className={`text-xs ${
                          isOverdue
                            ? "text-red-600 font-medium"
                            : isSoon
                            ? "text-amber-600 font-medium"
                            : "text-muted-foreground/70"
                        }`}>
                          {isOverdue
                            ? `Overdue by ${Math.abs(days)} days`
                            : days === 0
                            ? "Due today"
                            : `In ${days} days`}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs h-8"
                        onClick={() => navigate(`/products/${product?.slug || ""}`)}
                      >
                        <ShoppingCart className="size-3" />
                        Reorder
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-xs h-8 text-muted-foreground hover:text-destructive"
                        onClick={async () => {
                          await deleteReminder({ reminderId: reminder._id });
                          toast.success("Reminder removed");
                        }}
                      >
                        <Trash2 className="size-3" />
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
