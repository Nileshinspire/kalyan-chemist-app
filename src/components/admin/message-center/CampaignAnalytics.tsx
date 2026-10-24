import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart3, Info, Loader2 } from "lucide-react";
import {
  categoryEmoji,
  formatStoreDateTime,
  statusLabel,
} from "@/convex/messageCenterCore";
import { cn } from "@/lib/utils";

const PERIODS = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  partially_failed: "bg-orange-50 text-orange-700 border-orange-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  processing: "bg-amber-50 text-amber-700 border-amber-200",
};

function percent(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 100)}%`;
}

/**
 * Comparison of campaigns over a period. Every figure comes from
 * campaign_deliveries; metrics the providers do not report are labelled as
 * unavailable instead of being estimated.
 */
export default function CampaignAnalytics({
  onOpen,
}: {
  onOpen: (id: any) => void;
}) {
  const [days, setDays] = useState(30);
  const range = useMemo(() => {
    const to = Date.now();
    return { from: to - days * 86_400_000, to };
  }, [days]);
  const comparison = useQuery(api.messageCampaigns.compareCampaigns, range);

  const campaigns = useMemo(() => {
    const list = [...(comparison?.campaigns ?? [])];
    return list.sort((a: any, b: any) => {
      const aRead = a.readRate ?? -1;
      const bRead = b.readRate ?? -1;
      if (bRead !== aRead) return bRead - aRead;
      return b.reached - a.reached;
    });
  }, [comparison]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <BarChart3 className="size-4 text-primary" />
            Campaign performance
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Recorded delivery outcomes for campaigns created in the selected period.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-border/60 p-1">
          {PERIODS.map((period) => (
            <button
              key={period.days}
              type="button"
              onClick={() => setDays(period.days)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                days === period.days
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {period.label}
            </button>
          ))}
        </div>
      </div>

      {comparison === undefined ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Campaigns", value: campaigns.length },
              { label: "Targeted deliveries", value: comparison.aggregate.targeted },
              { label: "Reached", value: comparison.aggregate.reached },
              { label: "Failed", value: comparison.aggregate.failed },
              {
                label: "Read rate (web/popup)",
                value: comparison.readTrackingAvailable
                  ? percent(comparison.aggregate.readRate)
                  : "—",
              },
            ].map((stat) => (
              <Card key={stat.label} className="border-border/60">
                <CardContent className="p-3">
                  <p className="text-lg font-bold leading-none">{stat.value}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Campaign comparison</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              {campaigns.length === 0 ? (
                <p className="px-4 py-10 text-center text-xs text-muted-foreground">
                  No completed campaigns in this period yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead>
                      <tr className="border-y border-border/60 text-[10px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2 font-semibold">Campaign</th>
                        <th className="px-3 py-2 font-semibold">Sent</th>
                        <th className="px-3 py-2 font-semibold">Targeted</th>
                        <th className="px-3 py-2 font-semibold">Reached</th>
                        <th className="px-3 py-2 font-semibold">Failed</th>
                        <th className="px-3 py-2 font-semibold">Read (web)</th>
                        <th className="px-3 py-2 font-semibold">Failure rate</th>
                        <th className="px-3 py-2 font-semibold" />
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((campaign: any) => (
                        <tr
                          key={campaign.campaignId}
                          className="border-b border-border/40 last:border-0"
                        >
                          <td className="max-w-[260px] px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span aria-hidden="true">
                                {categoryEmoji(campaign.category)}
                              </span>
                              <span className="truncate font-medium">
                                {campaign.title}
                              </span>
                              {campaign.abTest && (
                                <Badge variant="outline" className="text-[9px]">
                                  A/B
                                </Badge>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "border text-[9px]",
                                  STATUS_STYLE[campaign.status]
                                )}
                              >
                                {statusLabel(campaign.status)}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">
                                {formatStoreDateTime(campaign.sentAt)}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-muted-foreground">
                            {campaign.accepted + campaign.delivered + campaign.read}
                          </td>
                          <td className="px-3 py-2.5">{campaign.targeted}</td>
                          <td className="px-3 py-2.5">{campaign.reached}</td>
                          <td className="px-3 py-2.5 text-red-600">{campaign.failed}</td>
                          <td className="px-3 py-2.5">
                            {campaign.read}
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              ({percent(campaign.readRate)})
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {percent(campaign.failureRate)}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={() => onOpen(campaign.campaignId)}
                            >
                              Open
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">By channel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {comparison.channels.map((channel: any) => (
                  <div key={channel.channel} className="rounded-xl border border-border/60 p-3">
                    <p className="text-xs font-semibold">{channel.label}</p>
                    <div className="mt-2 space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Targeted</span>
                        <span>{channel.targeted}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sent</span>
                        <span>{channel.accepted}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Delivered</span>
                        <span>{channel.delivered}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Read</span>
                        <span>
                          {channel.read}{" "}
                          <span className="text-[10px] text-muted-foreground">
                            ({percent(channel.readRate)})
                          </span>
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Failed</span>
                        <span className="text-red-600">{channel.failed}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/30 p-3 text-[10px] leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            <span>
              “Sent” means the provider accepted the request. Reads are recorded only
              for website notifications and popups. {comparison.unavailable.opens}{" "}
              {comparison.unavailable.clicks} {comparison.unavailable.conversions}{" "}
              {comparison.optOuts.count} account-level email unsubscribe
              {comparison.optOuts.count === 1 ? "" : "s"} in this period — not
              attributed to a specific campaign.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
