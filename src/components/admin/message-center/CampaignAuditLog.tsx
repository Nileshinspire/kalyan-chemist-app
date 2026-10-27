import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ScrollText, Search } from "lucide-react";
import { formatStoreDateTime } from "@/convex/messageCenterCore";

const ACTION_LABELS: Record<string, string> = {
  campaign_created: "Campaign created",
  campaign_updated: "Campaign edited",
  campaign_scheduled: "Campaign scheduled",
  campaign_rescheduled: "Campaign rescheduled",
  campaign_send_requested: "Send requested",
  campaign_cancelled: "Campaign cancelled",
  campaign_deleted: "Campaign deleted",
  campaign_deferred: "Deferred by quiet hours",
  campaign_dispatch_started: "Dispatch started",
  campaign_completed: "Campaign completed",
  campaign_partially_failed: "Campaign partially failed",
  campaign_failed: "Campaign failed",
  campaign_recovery_requested: "Recovery requested",
  deliveries_retried: "Failed deliveries retried",
  ab_winner_selected: "A/B winner selected",
  test_send: "Test message sent",
  template_created: "Template created",
  template_updated: "Template updated",
  template_deleted: "Template deleted",
  template_duplicated: "Template duplicated",
  messaging_settings_updated: "Messaging settings changed",
};

function toStartOfDay(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T00:00:00`).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toEndOfDay(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = new Date(`${value}T23:59:59.999`).getTime();
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Admin-only activity trail. Contains no customer contact details. */
export default function CampaignAuditLog() {
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const args = useMemo(
    () => ({
      search: search.trim() || undefined,
      action: action || undefined,
      from: toStartOfDay(from),
      to: toEndOfDay(to),
      limit: 120,
    }),
    [search, action, from, to]
  );
  const entries = useQuery(api.messageCampaigns.listCampaignAudit, args);

  const hasFilters = Boolean(search || action || from || to);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ScrollText className="size-4 text-primary" />
          Campaign audit trail
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Who created, edited, scheduled, sent, retried or cancelled campaigns. Times
          are IST. Recipient contact details and message bodies are never logged.
        </p>
      </div>

      <Card className="border-border/60">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="audit-search">Search</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="audit-search"
                value={search}
                placeholder="Campaign, admin or detail"
                className="pl-8"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-action">Action</Label>
            <select
              id="audit-action"
              value={action}
              onChange={(event) => setAction(event.target.value)}
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm"
            >
              <option value="">All actions</option>
              {Object.entries(ACTION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-from">From</Label>
            <Input
              id="audit-from"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="audit-to">To</Label>
            <Input
              id="audit-to"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
          {hasFilters && (
            <div className="sm:col-span-2 lg:col-span-5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setAction("");
                  setFrom("");
                  setTo("");
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {entries === undefined ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 py-16 text-center">
          <ScrollText className="mx-auto size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">No audit entries match</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Campaign actions appear here as soon as an administrator performs them.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {entries.map((entry: any) => (
            <div
              key={entry._id}
              className="flex flex-col gap-1 rounded-lg border border-border/60 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                  {ACTION_LABELS[entry.action] ?? entry.action}
                  {entry.campaignTitle && (
                    <span className="font-normal text-muted-foreground">
                      · {entry.campaignTitle}
                    </span>
                  )}
                </p>
                {entry.detail && (
                  <p className="mt-0.5 break-words text-[10px] leading-relaxed text-muted-foreground">
                    {entry.detail}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-left text-[10px] text-muted-foreground sm:text-right">
                <p className="font-medium text-foreground">{entry.actorName}</p>
                <p>{formatStoreDateTime(entry.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
