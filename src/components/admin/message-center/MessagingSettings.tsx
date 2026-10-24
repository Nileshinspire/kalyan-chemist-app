import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Moon, Settings2 } from "lucide-react";
import { STORE_TIME_ZONE } from "@/convex/messageCenterCore";

function hourOptions() {
  return Array.from({ length: 24 }, (_, hour) => ({
    value: hour,
    label: `${String(hour).padStart(2, "0")}:00`,
  }));
}

export default function MessagingSettings() {
  const settings = useQuery(api.messageCampaigns.getMessagingSettings, {});
  const update = useMutation(api.messageCampaigns.updateMessagingSettings);

  const [enabled, setEnabled] = useState(true);
  const [startHour, setStartHour] = useState(21);
  const [endHour, setEndHour] = useState(9);
  const [cap, setCap] = useState(3);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!settings || hydrated) return;
    setEnabled(settings.quietHoursEnabled);
    setStartHour(settings.quietStartHour);
    setEndHour(settings.quietEndHour);
    setCap(settings.maxPromotionalPerWeek);
    setHydrated(true);
  }, [settings, hydrated]);

  async function handleSave() {
    setSaving(true);
    try {
      await update({
        quietHoursEnabled: enabled,
        quietStartHour: startHour,
        quietEndHour: endHour,
        maxPromotionalPerWeek: cap,
      });
      toast.success("Messaging settings saved");
    } catch (error: any) {
      toast.error(error?.message ?? "Could not save messaging settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Settings2 className="size-4 text-primary" />
          Messaging policy
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Applies to promotional Message Center campaigns only. Order, payment and
          account notifications are transactional and are never blocked by these
          settings.
        </p>
      </div>

      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Moon className="size-3.5" />
            Quiet hours
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold">Pause promotional sends overnight</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                A campaign due inside this window stays scheduled and resumes at the
                first allowed minute. Times are {STORE_TIME_ZONE}.
              </p>
            </div>
            <Switch
              checked={enabled}
              onCheckedChange={setEnabled}
              aria-label="Enable quiet hours"
            />
          </div>

          {enabled && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="quiet-start">Quiet hours start</Label>
                <select
                  id="quiet-start"
                  value={startHour}
                  onChange={(event) => setStartHour(Number(event.target.value))}
                  className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm"
                >
                  {hourOptions().map((hour) => (
                    <option key={hour.value} value={hour.value}>
                      {hour.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="quiet-end">Resume at</Label>
                <select
                  id="quiet-end"
                  value={endHour}
                  onChange={(event) => setEndHour(Number(event.target.value))}
                  className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm"
                >
                  {hourOptions().map((hour) => (
                    <option key={hour.value} value={hour.value}>
                      {hour.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Promotional frequency limit</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5 sm:max-w-xs">
            <Label htmlFor="frequency-cap">Maximum campaigns per customer per week</Label>
            <Input
              id="frequency-cap"
              type="number"
              min={0}
              max={14}
              value={cap}
              onChange={(event) => setCap(Number(event.target.value))}
            />
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Counts real deliveries from the last 7 days. Customers at the limit are
              skipped when a campaign runs. Set 0 to disable the limit.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !settings}>
          {saving && <Loader2 className="size-4 animate-spin" />}
          Save settings
        </Button>
      </div>
    </div>
  );
}
