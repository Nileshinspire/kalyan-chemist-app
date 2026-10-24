import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import {
  categoryEmoji,
  formatStoreDateTime,
  statusLabel,
  storeTimeParts,
} from "@/convex/messageCenterCore";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const STATUS_DOT: Record<string, string> = {
  draft: "bg-zinc-400",
  scheduled: "bg-blue-500",
  processing: "bg-amber-500",
  completed: "bg-emerald-500",
  partially_failed: "bg-orange-500",
  failed: "bg-red-500",
  cancelled: "bg-zinc-300",
};

function istKey(ts: number): string {
  const parts = storeTimeParts(ts);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Month view of scheduled and completed campaigns. Times are IST throughout so
 * a campaign never appears on a different day than it actually sends.
 */
export default function CampaignCalendar({
  campaigns,
  onOpen,
}: {
  campaigns: any[];
  onOpen: (id: any) => void;
}) {
  const today = storeTimeParts(Date.now());
  const [monthOffset, setMonthOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const monthDate = new Date(Date.UTC(today.year, today.month + monthOffset, 1));
  const year = monthDate.getUTCFullYear();
  const month = monthDate.getUTCMonth();
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const byDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const campaign of campaigns) {
      const when = campaign.scheduledAt ?? campaign.createdAt;
      if (!when) continue;
      const key = istKey(when);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(campaign);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.scheduledAt ?? a.createdAt) - (b.scheduledAt ?? b.createdAt));
    }
    return map;
  }, [campaigns]);

  const selectedKey =
    selectedDay ?? (monthOffset === 0 ? istKey(Date.now()) : `${year}-${month}-1`);
  const selectedCampaigns = byDay.get(selectedKey) ?? [];

  const upcoming = campaigns
    .filter((c) => c.status === "scheduled" && c.scheduledAt)
    .sort((a, b) => a.scheduledAt - b.scheduledAt)
    .slice(0, 5);

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Card className="border-border/60">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="size-4 text-primary" />
            {MONTH_LABELS[month]} {year}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Previous month"
              onClick={() => {
                setMonthOffset((value) => value - 1);
                setSelectedDay(null);
              }}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setMonthOffset(0);
                setSelectedDay(null);
              }}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Next month"
              onClick={() => {
                setMonthOffset((value) => value + 1);
                setSelectedDay(null);
              }}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label} className="py-1">
                {label}
              </span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, index) => {
              if (day === null) return <div key={`blank-${index}`} />;
              const key = `${year}-${month}-${day}`;
              const dayCampaigns = byDay.get(key) ?? [];
              const isToday = key === istKey(Date.now());
              const isSelected = key === selectedKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(key)}
                  aria-label={`${day} ${MONTH_LABELS[month]} ${year}, ${dayCampaigns.length} campaigns`}
                  className={cn(
                    "flex min-h-16 flex-col items-start gap-1 rounded-lg border p-1.5 text-left transition-colors",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border/50 hover:bg-muted/40",
                    isToday && !isSelected && "border-primary/40"
                  )}
                >
                  <span
                    className={cn(
                      "text-[11px] font-semibold",
                      isToday ? "text-primary" : "text-foreground"
                    )}
                  >
                    {day}
                  </span>
                  <span className="flex flex-wrap gap-0.5">
                    {dayCampaigns.slice(0, 4).map((campaign: any) => (
                      <span
                        key={campaign._id}
                        title={campaign.title}
                        className={cn(
                          "size-1.5 rounded-full",
                          STATUS_DOT[campaign.status] ?? "bg-muted-foreground"
                        )}
                      />
                    ))}
                  </span>
                  {dayCampaigns.length > 0 && (
                    <span className="text-[9px] leading-tight text-muted-foreground">
                      {dayCampaigns.length} campaign{dayCampaigns.length === 1 ? "" : "s"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {selectedKey.split("-")[2]} {MONTH_LABELS[month]} · campaigns
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {selectedCampaigns.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No campaigns on this day.
              </p>
            ) : (
              selectedCampaigns.map((campaign: any) => (
                <button
                  key={campaign._id}
                  type="button"
                  onClick={() => onOpen(campaign._id)}
                  className="flex w-full items-start gap-2 rounded-lg border border-border/60 p-2.5 text-left transition-colors hover:bg-muted/40"
                >
                  <span aria-hidden="true">{categoryEmoji(campaign.category)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">
                      {campaign.title}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {campaign.scheduledAt
                        ? formatStoreDateTime(campaign.scheduledAt)
                        : formatStoreDateTime(campaign.createdAt)}
                    </span>
                  </span>
                  <Badge variant="outline" className="shrink-0 text-[9px]">
                    {statusLabel(campaign.status)}
                  </Badge>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Next scheduled executions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No scheduled campaigns. A scheduled campaign shows its exact next run here.
              </p>
            ) : (
              upcoming.map((campaign: any) => (
                <div key={campaign._id} className="rounded-lg border border-border/60 p-2.5">
                  <p className="truncate text-xs font-semibold">{campaign.title}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatStoreDateTime(campaign.scheduledAt)}
                  </p>
                </div>
              ))
            )}
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              All times are IST. Promotional campaigns inside quiet hours are moved
              to the first allowed minute by the dispatcher.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
