import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  AlertTriangle,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { formatStoreDateTime } from "@/convex/messageCenterCore";

const KIND_LABEL: Record<string, string> = {
  missed_schedule: "Missed schedule",
  stuck_processing: "Stuck in processing",
  retryable_failures: "Retryable failures",
  failed: "Recent failure",
  missing_send_time: "Missing send time",
};

/**
 * Shows only conditions derived from stored state. It stays out of the way when
 * every recent campaign is healthy.
 */
export default function CampaignHealth({
  onOpen,
}: {
  onOpen: (id: any) => void;
}) {
  const health = useQuery(api.messageCampaigns.campaignHealth, {});
  const runRecovery = useMutation(api.messageCampaigns.runCampaignRecovery);
  const [running, setRunning] = useState(false);

  async function handleRecovery() {
    setRunning(true);
    try {
      await runRecovery({});
      toast.success(
        "Recovery workers queued. Campaigns will update automatically if work was pending."
      );
    } catch (error: any) {
      toast.error(error?.message ?? "Could not queue campaign recovery");
    } finally {
      setRunning(false);
    }
  }

  if (!health || health.issues.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="flex flex-wrap items-center gap-2 text-sm">
          <AlertTriangle className="size-4 text-amber-600" />
          Campaign health
          <Badge
            variant="outline"
            className="border-amber-300 bg-white/70 text-[10px] text-amber-800"
          >
            {health.issues.length}{" "}
            {health.issues.length === 1 ? "issue" : "issues"}
          </Badge>
          <span className="text-[10px] font-normal text-amber-800/80">
            Checked {formatStoreDateTime(health.checkedAt)}
          </span>
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 border-amber-300 bg-white/70 text-[11px] text-amber-900 hover:bg-white"
          onClick={handleRecovery}
          disabled={running}
        >
          {running ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="size-3.5" />
          )}
          Run recovery now
        </Button>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {health.issues.map((issue: any) => (
          <button
            key={`${issue.campaignId}-${issue.kind}`}
            type="button"
            onClick={() => onOpen(issue.campaignId)}
            className="flex w-full items-start justify-between gap-3 rounded-lg border border-amber-200 bg-white/70 px-3 py-2 text-left transition-colors hover:bg-white"
          >
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-amber-950">
                {KIND_LABEL[issue.kind] ?? issue.kind}
                <span className="font-normal text-amber-800/80">
                  · {issue.title}
                </span>
              </p>
              <p className="mt-0.5 break-words text-[10px] leading-relaxed text-amber-800">
                {issue.detail}
              </p>
            </div>
            <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-amber-700" />
          </button>
        ))}
        <p className="flex items-center gap-1.5 pt-1 text-[9px] leading-relaxed text-amber-800/80">
          <Activity className="size-3" />
          Recovery re-runs the existing idempotent workers. It never resends a
          delivery that already settled.
        </p>
      </CardContent>
    </Card>
  );
}
