import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarClock,
  CalendarDays,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Eye,
  FileText,
  FlaskConical,
  Globe,
  Image as ImageIcon,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  Megaphone,
  Plus,
  RefreshCw,
  ScrollText,
  Send,
  Settings2,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  AUDIENCES,
  CHANNELS,
  MESSAGE_CATEGORIES,
  TITLE_MAX,
  BODY_MAX,
  audienceLabel,
  categoryEmoji,
  categoryLabel,
  statusLabel,
  validateCampaignInput,
  type AudienceType,
  type MessageCategory,
} from "@/convex/messageCenterCore";
import { cn } from "@/lib/utils";
import CampaignCalendar from "@/components/admin/message-center/CampaignCalendar";
import CampaignAnalytics from "@/components/admin/message-center/CampaignAnalytics";
import CampaignTemplates from "@/components/admin/message-center/CampaignTemplates";
import CampaignAuditLog from "@/components/admin/message-center/CampaignAuditLog";
import CampaignHealth from "@/components/admin/message-center/CampaignHealth";
import MessagingSettings from "@/components/admin/message-center/MessagingSettings";

const IST_OFFSET_MS = 330 * 60_000;

// ── Formatting helpers ──────────────────────────────────────────────
/** Scheduled times are always shown in the store's time zone (IST). */
function formatDateTime(ts?: number | null) {
  if (!ts) return "—";
  return `${new Date(ts).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })} IST`;
}

/** datetime-local value representing an IST wall-clock time. */
function toLocalInput(ts?: number) {
  const date = new Date((ts ?? Date.now() + 60 * 60 * 1000) + IST_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(
    date.getUTCDate()
  )}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

/** Interpret an admin-entered datetime as IST, not the browser's time zone. */
function fromLocalInput(value: string): number | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return undefined;
  const [, year, month, day, hour, minute] = match;
  const ts =
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute)
    ) - IST_OFFSET_MS;
  return Number.isFinite(ts) ? ts : undefined;
}

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  processing: "bg-amber-50 text-amber-700 border-amber-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  partially_failed: "bg-orange-50 text-orange-700 border-orange-200",
  failed: "bg-red-50 text-red-700 border-red-200",
  cancelled: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

const CATEGORY_STYLE: Record<string, string> = {
  festival: "bg-amber-50 text-amber-700",
  announcement: "bg-teal-50 text-teal-700",
  health: "bg-emerald-50 text-emerald-700",
  offer: "bg-rose-50 text-rose-700",
};

const CHANNEL_ICONS: Record<string, typeof Globe> = {
  inApp: Globe,
  popup: MessageSquare,
  whatsapp: MessageCircle,
  email: Mail,
};

type ChannelKey = "inApp" | "popup" | "whatsapp" | "email";

const EMPTY_CHANNELS: Record<ChannelKey, boolean> = {
  inApp: true,
  popup: false,
  whatsapp: false,
  email: false,
};

/** Stable default expiry input for a new campaign (computed once per load). */
const DEFAULT_EXPIRY_INPUT = toLocalInput(Date.now() + 7 * 24 * 60 * 60 * 1000);

// ══════════════════════════════════════════════════════════════════
//  PAGE
// ══════════════════════════════════════════════════════════════════

type CampaignTab =
  | "campaigns"
  | "calendar"
  | "analytics"
  | "templates"
  | "audit"
  | "settings";

type CampaignFilters = {
  search: string;
  status: string;
  channel: "" | ChannelKey;
  category: "" | MessageCategory;
  from: string;
  to: string;
};

const EMPTY_FILTERS: CampaignFilters = {
  search: "",
  status: "",
  channel: "",
  category: "",
  from: "",
  to: "",
};

export default function AdminMessageCenter() {
  const [tab, setTab] = useState<CampaignTab>("campaigns");
  const [filters, setFilters] = useState<CampaignFilters>(EMPTY_FILTERS);
  const listArgs = useMemo(
    () => ({
      search: filters.search.trim() || undefined,
      status: (filters.status || undefined) as any,
      channel: (filters.channel || undefined) as ChannelKey | undefined,
      category: (filters.category || undefined) as MessageCategory | undefined,
      // Date filters are interpreted as IST calendar days, like every other
      // campaign time shown in the admin.
      from: filters.from ? fromLocalInput(`${filters.from}T00:00`) : undefined,
      to: filters.to
        ? (fromLocalInput(`${filters.to}T23:59`) ?? 0) + 59_999
        : undefined,
    }),
    [filters]
  );
  const campaigns = useQuery(api.messageCenter.listCampaigns, listArgs);
  const status = useQuery(api.messageCenter.integrationStatus, {});
  const verifyIntegrations = useAction(api.messageDelivery.verifyIntegrations);
  const [filter, setFilter] = useState<"all" | "open" | "sent" | "failed">("all");
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"message_campaigns"> | null>(null);
  const [detailId, setDetailId] = useState<Id<"message_campaigns"> | null>(null);
  const [templateDefaults, setTemplateDefaults] = useState<any>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<Awaited<
    ReturnType<typeof verifyIntegrations>
  > | null>(null);
  const filtersActive = Object.values(filters).some(Boolean);

  const filtered = useMemo(() => {
    if (!campaigns) return [];
    switch (filter) {
      case "open":
        return campaigns.filter((c: any) =>
          ["draft", "scheduled", "processing"].includes(c.status)
        );
      case "sent":
        return campaigns.filter((c: any) =>
          ["completed", "partially_failed"].includes(c.status)
        );
      case "failed":
        return campaigns.filter((c: any) => ["failed", "cancelled"].includes(c.status));
      default:
        return campaigns;
    }
  }, [campaigns, filter]);

  const totals = useMemo(() => {
    const list = campaigns ?? [];
    const sentNotifications = list.reduce(
      (sum: number, c: any) => sum + (c.stats?.inAppSent ?? 0) + (c.stats?.popupSent ?? 0),
      0
    );
    return {
      campaigns: list.length,
      scheduled: list.filter((c: any) => c.status === "scheduled").length,
      completed: list.filter((c: any) => c.status === "completed").length,
      sentNotifications,
    };
  }, [campaigns]);

  async function handleVerify() {
    setVerifying(true);
    try {
      const result = await verifyIntegrations({});
      setVerifyResult(result);
      if (result.email.verified || result.whatsapp.verified) {
        toast.success("Connection check complete — at least one channel verified");
      } else {
        toast.message("Connection check complete — see channel status");
      }
    } catch (error: any) {
      toast.error(error?.message ?? "Could not check provider connections");
    } finally {
      setVerifying(false);
    }
  }

  const readiness = [
    {
      key: "website",
      label: "Website notifications",
      icon: Globe,
      ready: true,
      detail: "In-app notifications are built in and ready to send.",
    },
    {
      key: "popup",
      label: "Login popup",
      icon: MessageSquare,
      ready: true,
      detail: "Delivered to eligible signed-in customers after login.",
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      icon: MessageCircle,
      ready: Boolean(status?.whatsapp.configured),
      detail: status?.whatsapp.note ?? "Checking configuration…",
    },
    {
      key: "email",
      label: "Email",
      icon: Mail,
      ready: Boolean(status?.email.configured),
      detail: status?.email.note ?? "Checking configuration…",
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">
              Admin Panel
            </p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
              <Megaphone className="size-6 text-primary" />
              Message Center
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Create, schedule and track customer communications across website, popup,
              WhatsApp and email.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleVerify}
              disabled={verifying}
            >
              {verifying ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Check connections
            </Button>
            <Button
              className="gap-2 gradient-primary text-white"
              onClick={() => {
                setEditingId(null);
                setComposerOpen(true);
              }}
            >
              <Plus className="size-4" />
              New message
            </Button>
          </div>
        </div>

        {/* Channel readiness */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {readiness.map((channel) => {
            const verified =
              channel.key === "email"
                ? verifyResult?.email.verified
                : channel.key === "whatsapp"
                  ? verifyResult?.whatsapp.verified
                  : channel.ready;
            return (
              <Card key={channel.key} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={cn(
                          "flex size-9 items-center justify-center rounded-xl",
                          channel.ready
                            ? "bg-primary/10 text-primary"
                            : "bg-amber-50 text-amber-600"
                        )}
                      >
                        <channel.icon className="size-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{channel.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {channel.ready ? "Ready" : "Setup required"}
                        </p>
                      </div>
                    </div>
                    {channel.ready ? (
                      <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="size-4 shrink-0 text-amber-600" />
                    )}
                  </div>
                  <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-muted-foreground">
                    {channel.detail}
                  </p>
                  {verified !== undefined && verifyResult && channel.key !== "website" && channel.key !== "popup" && (
                    <p
                      className={cn(
                        "mt-2 text-[10px] font-medium",
                        verified ? "text-emerald-600" : "text-amber-600"
                      )}
                    >
                      {verified ? "Live connection verified" : "Not verified"}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Campaigns", value: totals.campaigns, icon: Megaphone },
            { label: "Scheduled", value: totals.scheduled, icon: CalendarClock },
            { label: "Completed", value: totals.completed, icon: CheckCircle2 },
            { label: "In-app delivered", value: totals.sentNotifications, icon: Bell },
          ].map((stat) => (
            <Card key={stat.label} className="border-border/60">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex size-10 items-center justify-center rounded-xl bg-muted text-foreground">
                  <stat.icon className="size-4" />
                </div>
                <div>
                  <p className="text-xl font-bold leading-none">{stat.value}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <CampaignHealth onOpen={setDetailId} />

        <Tabs value={tab} onValueChange={(value) => setTab(value as CampaignTab)}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="campaigns" className="gap-1.5">
              <Megaphone className="size-3.5" />
              Campaigns
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5">
              <CalendarDays className="size-3.5" />
              Calendar
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5">
              <BarChart3 className="size-3.5" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-1.5">
              <FileText className="size-3.5" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5">
              <ScrollText className="size-3.5" />
              Audit
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings2 className="size-3.5" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="mt-4">
        {/* Campaign history */}
        <Card className="border-border/60">
          <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">Campaign history</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Delivery counts come from the provider for WhatsApp and email. Read
                tracking is shown only for website notifications and popups.
              </p>
            </div>
            <Tabs
              value={filter}
              onValueChange={(v) => {
                setFilter(v as typeof filter);
                setFilters((current) => ({ ...current, status: "" }));
              }}
            >
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="open">Open</TabsTrigger>
                <TabsTrigger value="sent">Sent</TabsTrigger>
                <TabsTrigger value="failed">Failed</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
              <Input
                value={filters.search}
                placeholder="Search campaigns"
                aria-label="Search campaigns"
                className="lg:col-span-2"
                onChange={(event) =>
                  setFilters((current) => ({ ...current, search: event.target.value }))
                }
              />
              <select
                value={filters.status}
                aria-label="Filter by status"
                onChange={(event) => {
                  setFilter("all");
                  setFilters((current) => ({
                    ...current,
                    status: event.target.value,
                  }));
                }}
                className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm"
              >
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="partially_failed">Partially failed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={filters.channel}
                aria-label="Filter by channel"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    channel: event.target.value as CampaignFilters["channel"],
                  }))
                }
                className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm"
              >
                <option value="">All channels</option>
                {CHANNELS.map((channel) => (
                  <option key={channel.value} value={channel.value}>
                    {channel.label}
                  </option>
                ))}
              </select>
              <select
                value={filters.category}
                aria-label="Filter by category"
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    category: event.target.value as CampaignFilters["category"],
                  }))
                }
                className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm"
              >
                <option value="">All categories</option>
                {MESSAGE_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
              <Input
                type="date"
                value={filters.from}
                aria-label="Filter from date"
                onChange={(event) =>
                  setFilters((current) => ({ ...current, from: event.target.value }))
                }
              />
              <Input
                type="date"
                value={filters.to}
                aria-label="Filter to date"
                onChange={(event) =>
                  setFilters((current) => ({ ...current, to: event.target.value }))
                }
              />
              {filtersActive && (
                <div className="sm:col-span-2 lg:col-span-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setFilters(EMPTY_FILTERS)}
                  >
                    Clear filters
                  </Button>
                </div>
              )}
            </div>
            {campaigns === undefined ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 py-16 text-center">
                <Megaphone className="mx-auto size-8 text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium">No campaigns here yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create a message to reach your customers across one or more channels.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((campaign: any) => (
                  <button
                    key={campaign._id}
                    onClick={() => setDetailId(campaign._id)}
                    className="group flex w-full flex-col gap-3 rounded-xl border border-border/60 p-4 text-left transition-colors hover:border-primary/30 hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm">{categoryEmoji(campaign.category)}</span>
                        <p className="truncate text-sm font-semibold">{campaign.title}</p>
                        <Badge
                          variant="outline"
                          className={cn("border text-[10px]", STATUS_STYLE[campaign.status])}
                        >
                          {statusLabel(campaign.status)}
                        </Badge>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-medium",
                            CATEGORY_STYLE[campaign.category]
                          )}
                        >
                          {categoryLabel(campaign.category)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Users className="size-3" />
                          {audienceLabel(campaign.audienceType)} ·{" "}
                          {campaign.audienceSize.toLocaleString("en-IN")}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          {CHANNELS.filter((c) => campaign.channels[c.value]).map((c) => {
                            const Icon = CHANNEL_ICONS[c.value];
                            return <Icon key={c.value} className="size-3" />;
                          })}
                          {CHANNELS.filter((c) => campaign.channels[c.value])
                            .map((c) => c.label)
                            .join(", ")}
                        </span>
                        <span>
                          {campaign.status === "scheduled"
                            ? `Scheduled ${formatDateTime(campaign.scheduledAt)}`
                            : `Created ${formatDateTime(campaign.createdAt)}`}
                        </span>
                      </div>
                      {campaign.errorSummary && (
                        <p className="mt-1.5 line-clamp-1 text-[11px] text-amber-700">
                          {campaign.errorSummary}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {campaign.stats && (
                        <div className="hidden text-right text-[10px] text-muted-foreground sm:block">
                          <p>{campaign.stats.inAppSent} in-app</p>
                          <p>{campaign.stats.emailSent} email</p>
                          <p>{campaign.stats.whatsappSent} WhatsApp</p>
                        </div>
                      )}
                      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="calendar" className="mt-4">
            <CampaignCalendar campaigns={campaigns ?? []} onOpen={setDetailId} />
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            <CampaignAnalytics onOpen={setDetailId} />
          </TabsContent>

          <TabsContent value="templates" className="mt-4">
            <CampaignTemplates
              onUse={(template) => {
                setEditingId(null);
                setTemplateDefaults(template);
                setComposerOpen(true);
              }}
            />
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <CampaignAuditLog />
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <MessagingSettings />
          </TabsContent>
        </Tabs>
      </div>

      {composerOpen && (
        <CampaignComposer
          open={composerOpen}
          onOpenChange={(open) => {
            setComposerOpen(open);
            if (!open) {
              setEditingId(null);
              setTemplateDefaults(null);
            }
          }}
          editingId={editingId}
          templateDefaults={templateDefaults}
          onSaved={() => {
            setComposerOpen(false);
            setEditingId(null);
            setTemplateDefaults(null);
          }}
        />
      )}

      <CampaignDetail
        campaignId={detailId}
        onClose={() => setDetailId(null)}
        onEdit={(id) => {
          setDetailId(null);
          setEditingId(id);
          setComposerOpen(true);
        }}
      />
    </AdminLayout>
  );
}

// ══════════════════════════════════════════════════════════════════
//  DETAILS
// ══════════════════════════════════════════════════════════════════

function CampaignDetail({
  campaignId,
  onClose,
  onEdit,
}: {
  campaignId: Id<"message_campaigns"> | null;
  onClose: () => void;
  onEdit: (id: Id<"message_campaigns">) => void;
}) {
  const detail = useQuery(
    api.messageCenter.getCampaign,
    campaignId ? { campaignId } : "skip"
  );
  const cancelCampaign = useMutation(api.messageCenter.cancelCampaign);
  const deleteCampaign = useMutation(api.messageCenter.deleteCampaign);
  const retryDeliveries = useMutation(api.messageCampaigns.retryFailedDeliveries);
  const chooseWinner = useMutation(api.messageCampaigns.chooseAbWinner);
  const analytics = useQuery(
    api.messageCampaigns.campaignAnalytics,
    campaignId ? { campaignId } : "skip"
  );
  const activity = useQuery(
    api.messageCampaigns.listCampaignAudit,
    campaignId ? { campaignId, limit: 8 } : "skip"
  );
  const [busy, setBusy] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [choosingWinner, setChoosingWinner] = useState(false);

  const campaign: any = detail?.campaign;
  const abSummary: any = detail?.abSummary ?? null;

  async function handleRetry() {
    if (!campaignId) return;
    setRetrying(true);
    try {
      const result = await retryDeliveries({ campaignId });
      toast.success(
        result.retried > 0
          ? `${result.retried} failed ${
              result.retried === 1 ? "delivery" : "deliveries"
            } re-queued`
          : result.message ?? "No retryable failures"
      );
    } catch (error: any) {
      toast.error(error?.message ?? "Could not retry deliveries");
    } finally {
      setRetrying(false);
    }
  }

  async function handleWinner(winner: "A" | "B", source: "manual" | "rule") {
    if (!campaignId) return;
    setChoosingWinner(true);
    try {
      await chooseWinner({ campaignId, winner, source });
      toast.success(`Variant ${winner} saved as the winner`);
    } catch (error: any) {
      toast.error(error?.message ?? "Could not save the winner");
    } finally {
      setChoosingWinner(false);
    }
  }

  async function handleCancel() {
    if (!campaignId) return;
    setBusy(true);
    try {
      await cancelCampaign({ campaignId });
      toast.success("Campaign cancelled. Nothing further will be sent.");
    } catch (error: any) {
      toast.error(error?.message ?? "Could not cancel campaign");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!campaignId) return;
    setBusy(true);
    try {
      await deleteCampaign({ campaignId });
      toast.success("Campaign deleted");
      onClose();
    } catch (error: any) {
      toast.error(error?.message ?? "Could not delete campaign");
    } finally {
      setBusy(false);
    }
  }

  const channelRows = [
    { key: "inApp", label: "Website notification", counts: detail?.summary.inApp },
    { key: "popup", label: "Login popup", counts: detail?.summary.popup },
    { key: "whatsapp", label: "WhatsApp", counts: detail?.summary.whatsapp },
    { key: "email", label: "Email", counts: detail?.summary.email },
  ];

  return (
    <Dialog open={Boolean(campaignId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left">
            {campaign && <span>{categoryEmoji(campaign.category)}</span>}
            {campaign?.title ?? "Campaign"}
          </DialogTitle>
          <DialogDescription className="text-left">
            {campaign
              ? `${categoryLabel(campaign.category)} · ${audienceLabel(
                  campaign.audience.type
                )}`
              : "Loading campaign…"}
          </DialogDescription>
        </DialogHeader>

        {!detail ? (
          <div className="flex justify-center py-12">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn("border text-[10px]", STATUS_STYLE[campaign.status])}
              >
                {statusLabel(campaign.status)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Audience size: {campaign.audienceSize.toLocaleString("en-IN")}
              </span>
              {campaign.scheduledAt && (
                <span className="text-xs text-muted-foreground">
                  Send: {formatDateTime(campaign.scheduledAt)}
                </span>
              )}
              {campaign.expiresAt && (
                <span className="text-xs text-muted-foreground">
                  Expires: {formatDateTime(campaign.expiresAt)}
                </span>
              )}
              {detail.nextExecutionAt && (
                <span className="text-xs font-medium text-blue-700">
                  Next scheduled execution: {formatDateTime(detail.nextExecutionAt)}
                </span>
              )}
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {campaign.body}
              </p>
              {campaign.imageUrl && (
                <img
                  src={campaign.imageUrl}
                  alt=""
                  className="mt-3 max-h-44 w-full rounded-lg object-cover"
                />
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {channelRows.map((row) => {
                const enabled = campaign.channels[row.key as ChannelKey];
                return (
                  <div
                    key={row.key}
                    className={cn(
                      "rounded-xl border p-3",
                      enabled ? "border-border/70" : "border-dashed border-border/50 opacity-60"
                    )}
                  >
                    <p className="flex items-center justify-between text-xs font-semibold">
                      {row.label}
                      {!enabled && (
                        <span className="text-[10px] font-normal text-muted-foreground">
                          Not selected
                        </span>
                      )}
                    </p>
                    {enabled && row.counts ? (
                      <div className="mt-2 grid grid-cols-3 gap-1 text-[11px] text-muted-foreground">
                        <span>Queued {row.counts.queued + row.counts.sending}</span>
                        <span>Sent {row.counts.sent}</span>
                        <span className="text-emerald-700">Delivered {row.counts.delivered}</span>
                        {(row.key === "inApp" || row.key === "popup") && (
                          <span>Read {row.counts.read}</span>
                        )}
                        <span className="text-red-600">Failed {row.counts.failed}</span>
                        <span>Skipped {row.counts.skipped}</span>
                      </div>
                    ) : enabled ? (
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        No delivery attempts recorded yet.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {analytics && (
              <div className="rounded-xl border border-border/60 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  <BarChart3 className="size-3.5 text-primary" />
                  Performance (recorded data only)
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
                  <div className="rounded-lg bg-muted/40 p-2">
                    <p className="text-base font-bold leading-none">
                      {analytics.totals.targeted}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Targeted deliveries
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-2">
                    <p className="text-base font-bold leading-none">
                      {analytics.totals.reached}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Accepted / delivered
                    </p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-2">
                    <p className="text-base font-bold leading-none text-red-600">
                      {analytics.totals.failed}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">Failed</p>
                  </div>
                  <div className="rounded-lg bg-muted/40 p-2">
                    <p className="text-base font-bold leading-none">
                      {analytics.readTrackingAvailable
                        ? `${Math.round((analytics.totals.readRate ?? 0) * 100)}%`
                        : "—"}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Read rate (web/popup)
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                  Opens, link clicks and purchases cannot be attributed by the current
                  providers, so they are not shown.
                </p>
              </div>
            )}

            {abSummary && (
              <div className="rounded-xl border border-border/60 p-3">
                <p className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  A/B result
                  <Badge variant="outline" className="text-[9px]">
                    Split A {abSummary.splitPercent}% / B{" "}
                    {100 - abSummary.splitPercent}%
                  </Badge>
                  {abSummary.winner && (
                    <Badge className="border-emerald-200 bg-emerald-50 text-[9px] text-emerald-700" variant="outline">
                      Winner {abSummary.winner}
                      {abSummary.winnerDecidedBy === "rule"
                        ? " (suggested)"
                        : " (manual)"}
                    </Badge>
                  )}
                </p>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[340px] text-left text-[11px]">
                    <thead>
                      <tr className="text-[9px] uppercase tracking-wide text-muted-foreground">
                        <th className="py-1 pr-2 font-semibold">Variation</th>
                        <th className="px-1 py-1 font-semibold">Recipients</th>
                        <th className="px-1 py-1 font-semibold">Sent</th>
                        <th className="px-1 py-1 font-semibold">Read</th>
                        <th className="px-1 py-1 font-semibold">Failed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(["a", "b"] as const).map((key) => {
                        const counts = abSummary.evaluation[key];
                        return (
                          <tr key={key} className="border-t border-border/40">
                            <td className="py-1.5 pr-2 font-semibold uppercase">{key}</td>
                            <td className="px-1 py-1.5">{counts.targeted}</td>
                            <td className="px-1 py-1.5">{counts.accepted}</td>
                            <td className="px-1 py-1.5">{counts.read}</td>
                            <td className="px-1 py-1.5 text-red-600">{counts.failed}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                  {abSummary.evaluation.reason}
                </p>
                {(campaign?.status === "completed" ||
                  campaign?.status === "partially_failed") && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {abSummary.evaluation.leading && !abSummary.winner && (
                      <Button
                        size="sm"
                        className="h-7 text-[10px]"
                        disabled={choosingWinner}
                        onClick={() =>
                          handleWinner(abSummary.evaluation.leading, "rule")
                        }
                      >
                        Use suggested winner {abSummary.evaluation.leading}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px]"
                      disabled={choosingWinner}
                      onClick={() => handleWinner("A", "manual")}
                    >
                      Mark A as winner
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px]"
                      disabled={choosingWinner}
                      onClick={() => handleWinner("B", "manual")}
                    >
                      Mark B as winner
                    </Button>
                  </div>
                )}
              </div>
            )}

            <p className="text-[10px] leading-relaxed text-muted-foreground">
              For WhatsApp and email, “Sent” means the provider accepted the
              request. Delivery receipts are shown only when the provider reports
              them; read tracking is available for website notifications and popups
              only.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-xs font-semibold">Read tracking</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Website notifications read: {detail.notifications.read} of{" "}
                  {detail.notifications.total}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Popup seen: {detail.popup.seen} · dismissed: {detail.popup.dismissed}
                </p>
                <p className="mt-2 text-[10px] text-muted-foreground/80">
                  Read data is available for website and popup only. WhatsApp/email
                  read receipts are not claimed unless the provider supplies them.
                </p>
              </div>
              <div className="rounded-xl border border-border/60 p-3">
                <p className="text-xs font-semibold">Delivery issues</p>
                {detail.failures.length === 0 ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    No failed deliveries recorded.
                  </p>
                ) : (
                  <ul className="mt-1 space-y-1 text-[11px] text-muted-foreground">
                    {detail.failures.map((failure: any, index: number) => (
                      <li key={index} className="line-clamp-2">
                        <span className="font-medium text-foreground">
                          {failure.channel === "whatsapp"
                            ? "WhatsApp"
                            : failure.channel === "email"
                              ? "Email"
                              : failure.channel}
                          :
                        </span>{" "}
                        {failure.error}
                      </li>
                    ))}
                  </ul>
                )}
                {(detail.retryableFailures ?? 0) > 0 &&
                  ["completed", "partially_failed", "failed"].includes(
                    campaign?.status
                  ) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7 gap-1 text-[10px]"
                    disabled={retrying}
                    onClick={handleRetry}
                  >
                    {retrying ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3" />
                    )}
                    Retry {detail.retryableFailures} failed{" "}
                    {detail.retryableFailures === 1 ? "delivery" : "deliveries"}
                  </Button>
                )}
                <p className="mt-2 text-[9px] leading-relaxed text-muted-foreground">
                  Only temporary failures can be retried. Opt-outs, missing addresses
                  and configuration errors are never retried.
                </p>
              </div>
            </div>

            {campaign.errorSummary && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                {campaign.errorSummary}
              </div>
            )}

            {(activity?.length ?? 0) > 0 && (
              <div className="rounded-xl border border-border/60 p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold">
                  <ScrollText className="size-3.5 text-primary" />
                  Recent activity
                </p>
                <ul className="mt-1.5 space-y-1 text-[10px] text-muted-foreground">
                  {(activity ?? []).map((entry: any) => (
                    <li key={entry._id} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">
                        <span className="font-medium text-foreground">
                          {entry.action.replaceAll("_", " ")}
                        </span>
                        {entry.detail ? ` · ${entry.detail}` : ""}
                      </span>
                      <span className="shrink-0">
                        {entry.actorName} · {formatDateTime(entry.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-xl border border-border/60">
              <p className="border-b border-border/60 px-3 py-2 text-xs font-semibold">
                Email preview
              </p>
              <iframe
                title="Email preview"
                srcDoc={detail.previewHtml}
                className="h-64 w-full rounded-b-xl bg-white"
                sandbox=""
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            {(campaign?.status === "draft" || campaign?.status === "scheduled") && (
              <Button variant="outline" size="sm" onClick={() => onEdit(campaignId!)}>
                Edit
              </Button>
            )}
            {(campaign?.status === "draft" ||
              campaign?.status === "cancelled") && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={handleDelete}
                disabled={busy}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {(campaign?.status === "draft" || campaign?.status === "scheduled") && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={busy}
                className="text-amber-700"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
                Cancel campaign
              </Button>
            )}
            <Button size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ══════════════════════════════════════════════════════════════════
//  COMPOSER
// ══════════════════════════════════════════════════════════════════

type SendMode = "draft" | "schedule" | "send_now";

function CampaignComposer({
  open,
  onOpenChange,
  editingId,
  templateDefaults,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: Id<"message_campaigns"> | null;
  templateDefaults?: any;
  onSaved: () => void;
}) {
  const existing = useQuery(
    api.messageCenter.getCampaign,
    editingId ? { campaignId: editingId } : "skip"
  );
  const existingCampaign: any = existing?.campaign;
  const audienceCounts = useQuery(api.messageCenter.audienceCounts, {});
  const saveCampaign = useMutation(api.messageCenter.saveCampaign);
  const templates = useQuery(api.messageCampaigns.listTemplates, {});
  const saveTemplate = useMutation(api.messageCampaigns.saveTemplate);
  const recommendation = useQuery(api.messageCampaigns.sendTimeRecommendation, {});
  const sendTestMessage = useAction(api.messageDelivery.sendTestMessage);

  const [title, setTitle] = useState(
    existingCampaign?.title ?? templateDefaults?.title ?? ""
  );
  const [body, setBody] = useState(
    existingCampaign?.body ?? templateDefaults?.body ?? ""
  );
  const [category, setCategory] = useState<MessageCategory>(
    existingCampaign?.category ?? templateDefaults?.category ?? "announcement"
  );
  const [imageUrl, setImageUrl] = useState(
    existingCampaign?.imageUrl ?? templateDefaults?.imageUrl ?? ""
  );
  const [abEnabled, setAbEnabled] = useState(Boolean(existingCampaign?.variantB));
  const [variantBTitle, setVariantBTitle] = useState(
    existingCampaign?.variantB?.title ?? ""
  );
  const [variantBBody, setVariantBBody] = useState(
    existingCampaign?.variantB?.body ?? ""
  );
  const [abSplit, setAbSplit] = useState<number>(existingCampaign?.abSplit ?? 50);
  const [templateSaveOpen, setTemplateSaveOpen] = useState(false);
  const [templateName, setTemplateName] = useState(
    templateDefaults?.name ?? ""
  );
  const [testChannel, setTestChannel] = useState<"email" | "whatsapp">("email");
  const [testRecipient, setTestRecipient] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [previewVariant, setPreviewVariant] = useState<"A" | "B">("A");
  // Stable reference time for the "send now" quiet-hours check.
  const [quietCheckNow] = useState(() => Date.now());
  const [channels, setChannels] = useState<Record<ChannelKey, boolean>>(
    existingCampaign?.channels ?? EMPTY_CHANNELS
  );
  const [audienceType, setAudienceType] = useState<AudienceType>(
    existingCampaign?.audience?.type ?? "all"
  );
  const [categoryId, setCategoryId] = useState<string>(
    existingCampaign?.audience?.categoryId ?? ""
  );
  const [selectedUsers, setSelectedUsers] = useState<string[]>(
    (existingCampaign?.audience?.userIds ?? []).map(String)
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(
    existingCampaign?.status === "scheduled"
  );
  const [scheduledAt, setScheduledAt] = useState(
    toLocalInput(existingCampaign?.scheduledAt)
  );
  const [expiryEnabled, setExpiryEnabled] = useState(Boolean(existingCampaign?.expiresAt));
  const [expiresAt, setExpiresAt] = useState(
    existingCampaign?.expiresAt
      ? toLocalInput(existingCampaign.expiresAt)
      : DEFAULT_EXPIRY_INPUT
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<SendMode>("send_now");
  const [saving, setSaving] = useState(false);
  const [requestKey] = useState(() => `mc_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  // Editing opens with an async query. Hydrate the form exactly once when the
  // campaign arrives, without clobbering later edits.
  const hydrated = useRef(false);
  useEffect(() => {
    if (!existingCampaign || hydrated.current) return;
    hydrated.current = true;
    setTitle(existingCampaign.title ?? "");
    setBody(existingCampaign.body ?? "");
    setCategory(existingCampaign.category ?? "announcement");
    setImageUrl(existingCampaign.imageUrl ?? "");
    setAbEnabled(Boolean(existingCampaign.variantB));
    setVariantBTitle(existingCampaign.variantB?.title ?? "");
    setVariantBBody(existingCampaign.variantB?.body ?? "");
    setAbSplit(existingCampaign.abSplit ?? 50);
    setChannels({ ...EMPTY_CHANNELS, ...(existingCampaign.channels ?? {}) });
    setAudienceType(existingCampaign.audience?.type ?? "all");
    setCategoryId(existingCampaign.audience?.categoryId ?? "");
    setSelectedUsers((existingCampaign.audience?.userIds ?? []).map(String));
    setScheduleEnabled(existingCampaign.status === "scheduled");
    setScheduledAt(toLocalInput(existingCampaign.scheduledAt));
    setExpiryEnabled(Boolean(existingCampaign.expiresAt));
    if (existingCampaign.expiresAt) {
      setExpiresAt(toLocalInput(existingCampaign.expiresAt));
    }
  }, [existingCampaign]);

  const customerOptions = useQuery(
    api.messageCenter.customerOptions,
    audienceType === "selected" ? { search: customerSearch } : "skip"
  );

  const audienceArg = useMemo(
    () => ({
      type: audienceType,
      categoryId: categoryId ? (categoryId as Id<"categories">) : undefined,
      userIds:
        audienceType === "selected"
          ? (selectedUsers as Id<"users">[])
          : undefined,
    }),
    [audienceType, categoryId, selectedUsers]
  );

  const preview = useQuery(api.messageCenter.previewAudience, {
    audience: audienceArg,
    channels,
  });

  const scheduledAtValue = scheduleEnabled ? fromLocalInput(scheduledAt) : undefined;
  const suggestions = useQuery(api.messageCampaigns.campaignSuggestions, {
    audience: audienceArg,
    channels,
    // For an immediate send, check the current moment so a quiet-hours send is
    // flagged before the dispatcher defers it.
    scheduledAt: scheduledAtValue ?? quietCheckNow,
    category,
  });

  const previewContent =
    abEnabled && previewVariant === "B"
      ? { title: variantBTitle, body: variantBBody }
      : { title, body };

  const emailPreview = useQuery(
    api.messageCenter.renderPreview,
    previewContent.title.trim() && previewContent.body.trim()
      ? {
          title: previewContent.title,
          body: previewContent.body,
          category,
          imageUrl: imageUrl.trim() || undefined,
        }
      : "skip"
  );

  const validation = useMemo(
    () =>
      validateCampaignInput({
        title,
        body,
        category,
        imageUrl: imageUrl.trim() || undefined,
        channels,
        audience: {
          type: audienceType,
          categoryId: categoryId || undefined,
          userIds: audienceType === "selected" ? selectedUsers : undefined,
        },
        scheduledAt: scheduleEnabled ? fromLocalInput(scheduledAt) : undefined,
        expiresAt: expiryEnabled ? fromLocalInput(expiresAt) : undefined,
      }),
    [
      title,
      body,
      category,
      imageUrl,
      channels,
      audienceType,
      categoryId,
      selectedUsers,
      scheduleEnabled,
      scheduledAt,
      expiryEnabled,
      expiresAt,
    ]
  );

  const abError = useMemo(() => {
    if (!abEnabled) return null;
    const bTitle = variantBTitle.trim();
    const bBody = variantBBody.trim();
    if (bTitle.length < 3) return "Variant B needs a title of at least 3 characters.";
    if (bBody.length < 3) return "Variant B needs a message of at least 3 characters.";
    if (bTitle.length > TITLE_MAX) return `Variant B title must be at most ${TITLE_MAX} characters.`;
    if (bBody.length > BODY_MAX) return `Variant B message must be at most ${BODY_MAX} characters.`;
    if (bTitle === title.trim() && bBody === body.trim()) {
      return "Variant B must differ from variant A.";
    }
    return null;
  }, [abEnabled, variantBTitle, variantBBody, title, body]);

  const ready = validation.valid && !abError;
  const canPreview = Boolean(
    previewContent.title.trim() && previewContent.body.trim()
  );
  // A send is not useful when every chosen channel has zero eligible recipients.
  const noEligibleChannel =
    Boolean(preview) &&
    (preview?.perChannel.length ?? 0) > 0 &&
    preview!.perChannel.every((row: any) => row.eligible === 0);

  function toggleChannel(channel: ChannelKey, enabled: boolean) {
    setChannels((prev) => ({ ...prev, [channel]: enabled }));
  }

  function applyTemplate(templateId: string) {
    const template = (templates ?? []).find(
      (entry: any) => String(entry._id) === templateId
    );
    if (!template) return;
    setTitle(template.title);
    setBody(template.body);
    setCategory(template.category);
    setImageUrl(template.imageUrl ?? "");
    setTemplateName(template.name);
    toast.success(`Loaded template “${template.name}”`);
  }

  async function saveAsTemplate() {
    const name = (templateName || title).trim().slice(0, 80);
    if (!name) {
      toast.error("Give the template a name first.");
      return;
    }
    try {
      await saveTemplate({
        name,
        category,
        title,
        body,
        imageUrl: imageUrl.trim() || undefined,
      });
      toast.success("Saved to the template library");
      setTemplateSaveOpen(false);
    } catch (error: any) {
      toast.error(error?.message ?? "Could not save template");
    }
  }

  async function sendTest() {
    setTestSending(true);
    try {
      const result = await sendTestMessage({
        channel: testChannel,
        recipient: testRecipient,
        title: previewContent.title,
        body: previewContent.body,
        category,
        imageUrl: imageUrl.trim() || undefined,
      });
      if (result.success) {
        toast.success(
          `Test ${testChannel} accepted by the provider for ${testRecipient}.`
        );
      } else {
        toast.error(result.error ?? "Test send failed");
      }
    } catch (error: any) {
      toast.error(error?.message ?? "Test send failed");
    } finally {
      setTestSending(false);
    }
  }

  async function submit(mode: SendMode) {
    if (mode === "draft" && abError) {
      toast.error(abError);
      return;
    }
    if (mode !== "draft" && !ready) {
      toast.error(
        abError ?? validation.errors[0] ?? "Please complete the message first"
      );
      return;
    }
    if (mode !== "draft" && noEligibleChannel) {
      toast.error(
        "No customer in this audience is eligible for the selected channels."
      );
      return;
    }
    if (mode !== "draft" && (preview?.missingConfig.length ?? 0) > 0) {
      toast.error("This campaign uses a channel that is not configured yet.");
      return;
    }
    setSaving(true);
    try {
      const result = await saveCampaign({
        campaignId: editingId ?? undefined,
        requestKey: editingId ? undefined : requestKey,
        title,
        body,
        category,
        imageUrl: imageUrl.trim() || undefined,
        channels,
        audience: audienceArg,
        scheduledAt: mode === "schedule" ? scheduledAtValue : undefined,
        expiresAt: expiryEnabled ? fromLocalInput(expiresAt) : undefined,
        variantB: abEnabled
          ? { title: variantBTitle.trim(), body: variantBBody.trim() }
          : undefined,
        abSplit: abEnabled ? abSplit : undefined,
        mode,
        confirmed: mode !== "draft" ? true : undefined,
      });
      toast.success(
        mode === "draft"
          ? "Draft saved"
          : mode === "schedule"
            ? `Scheduled for ${formatDateTime(fromLocalInput(scheduledAt))}`
            : "Campaign queued for dispatch"
      );
      if (result.deduplicated) {
        toast.message("This campaign was already saved.");
      }
      onSaved();
    } catch (error: any) {
      toast.error(error?.message ?? "Could not save campaign");
    } finally {
      setSaving(false);
      setConfirmOpen(false);
    }
  }

  function requestSend(mode: SendMode) {
    if (mode !== "draft" && !ready) {
      toast.error(
        abError ?? validation.errors[0] ?? "Please complete the message first"
      );
      return;
    }
    if (mode !== "draft" && noEligibleChannel) {
      toast.error(
        "No customer in this audience is eligible for the selected channels."
      );
      return;
    }
    if (mode === "schedule" && !scheduleEnabled) {
      setScheduleEnabled(true);
      toast.message("Choose a date and time, then confirm.");
      return;
    }
    setPendingMode(mode);
    setConfirmOpen(true);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-1.5rem)] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {/* Fixed header: stays visible while the form below scrolls. */}
        <div className="shrink-0 border-b border-border/60 px-4 py-4 pr-12 sm:px-6 sm:pr-14">
          <DialogTitle className="flex items-center gap-2">
            <Send className="size-4 text-primary" />
            {editingId ? "Edit campaign" : "New message"}
          </DialogTitle>
          <DialogDescription>
            Compose once, then deliver through any combination of website, popup,
            WhatsApp and email.
          </DialogDescription>
        </div>

        {/* Only this region scrolls, so the header and the action bar stay put. */}
        {editingId && !existing ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="flex justify-center py-20">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto overscroll-contain px-4 py-5 pb-8 sm:px-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            {/* ── Left: fields ── */}
            <div className="min-w-0 space-y-5">
              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label
                    htmlFor="mc-template"
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <FileText className="size-3.5" />
                    Reusable template
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px]"
                    disabled={!title.trim() || !body.trim()}
                    onClick={() => {
                      setTemplateName(title.trim().slice(0, 80));
                      setTemplateSaveOpen(true);
                    }}
                  >
                    Save as template
                  </Button>
                </div>
                <select
                  id="mc-template"
                  value=""
                  onChange={(event) => applyTemplate(event.target.value)}
                  className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm"
                >
                  <option value="">Load a saved template…</option>
                  {(templates ?? []).map((template: any) => (
                    <option key={template._id} value={template._id}>
                      {template.name} · {categoryLabel(template.category)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mc-title">Message title</Label>
                <Input
                  id="mc-title"
                  value={title}
                  maxLength={TITLE_MAX}
                  placeholder="e.g. Diwali wishes from Kalyan Chemist"
                  onChange={(event) => setTitle(event.target.value)}
                />
                <p className="text-right text-[10px] text-muted-foreground">
                  {title.length}/{TITLE_MAX}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mc-body">Message body</Label>
                <Textarea
                  id="mc-body"
                  value={body}
                  rows={6}
                  maxLength={BODY_MAX}
                  placeholder="Write a clear, helpful message for your customers…"
                  onChange={(event) => setBody(event.target.value)}
                />
                <p className="text-right text-[10px] text-muted-foreground">
                  {body.length}/{BODY_MAX}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {MESSAGE_CATEGORIES.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={category === option.value}
                      onClick={() => setCategory(option.value)}
                      className={cn(
                        "flex w-full min-w-0 items-start gap-2 overflow-hidden rounded-xl border p-2.5 text-left transition-colors",
                        category === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border/60 hover:bg-muted/40"
                      )}
                    >
                      <span className="shrink-0 leading-none">{option.emoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-xs font-semibold leading-snug">
                          {option.label}
                        </span>
                        <span className="mt-0.5 block break-words text-[10px] leading-snug text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="mc-image" className="flex items-center gap-1.5">
                  <ImageIcon className="size-3.5" />
                  Banner image URL <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="mc-image"
                  value={imageUrl}
                  placeholder="https://…"
                  onChange={(event) => setImageUrl(event.target.value)}
                />
                <p className="text-[10px] text-muted-foreground">
                  Used in the email and notification detail. Only http(s) URLs are
                  accepted; unverified images are never uploaded.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Delivery channels</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {CHANNELS.map((channel) => {
                    const Icon = CHANNEL_ICONS[channel.value];
                    const setupRequired = (preview?.missingConfig ?? []).some((m) =>
                      m.startsWith(channel.value === "whatsapp" ? "WhatsApp" : "Email")
                    );
                    return (
                      <div
                        key={channel.value}
                        className={cn(
                          "flex items-start justify-between gap-2 rounded-xl border p-3",
                          channels[channel.value as ChannelKey]
                            ? "border-primary/40 bg-primary/[0.03]"
                            : "border-border/60"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <Icon className="mt-0.5 size-3.5 text-primary" />
                          <div>
                            <p className="text-xs font-semibold">{channel.label}</p>
                            {setupRequired ? (
                              <p className="text-[10px] text-amber-600">Setup required</p>
                            ) : (
                              <p className="text-[10px] text-muted-foreground">
                                {channel.value === "inApp"
                                  ? "Bell + account notifications"
                                  : channel.value === "popup"
                                    ? "Shown after login"
                                    : channel.value === "whatsapp"
                                      ? "Approved template only"
                                      : "Branded unsubscribe email"}
                              </p>
                            )}
                          </div>
                        </div>
                        <Switch
                          checked={channels[channel.value as ChannelKey]}
                          onCheckedChange={(checked) =>
                            toggleChannel(channel.value as ChannelKey, checked)
                          }
                          aria-label={`Enable ${channel.label}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>A/B test (optional)</Label>
                <div className="rounded-xl border border-border/60 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold">Test two variations</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Variant A is the message above. Recipients are split
                        deterministically and the same person always gets the same
                        variation, including on retries.
                      </p>
                    </div>
                    <Switch
                      checked={abEnabled}
                      onCheckedChange={setAbEnabled}
                      aria-label="Enable A/B test"
                    />
                  </div>
                  {abEnabled && (
                    <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="mc-variant-b-title">Variant B title</Label>
                        <Input
                          id="mc-variant-b-title"
                          value={variantBTitle}
                          maxLength={TITLE_MAX}
                          placeholder="Alternative subject or title"
                          onChange={(event) => setVariantBTitle(event.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="mc-variant-b-body">Variant B message</Label>
                        <Textarea
                          id="mc-variant-b-body"
                          value={variantBBody}
                          rows={4}
                          maxLength={BODY_MAX}
                          placeholder="Alternative wording for the second variation"
                          onChange={(event) => setVariantBBody(event.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="mc-ab-split">
                          Split — variant A {abSplit}% / variant B {100 - abSplit}%
                        </Label>
                        <input
                          id="mc-ab-split"
                          type="range"
                          min={10}
                          max={90}
                          step={5}
                          value={abSplit}
                          onChange={(event) => setAbSplit(Number(event.target.value))}
                          className="w-full accent-[var(--primary)]"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          A winner is suggested only when each variation has at least 30
                          recipients and read tracking is available. You can always choose
                          manually.
                        </p>
                      </div>
                      {abError && (
                        <p className="text-[10px] text-red-600">{abError}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Audience</Label>
                <div className="space-y-2">
                  {AUDIENCES.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border p-3",
                        audienceType === option.value
                          ? "border-primary bg-primary/5"
                          : "border-border/60 hover:bg-muted/30"
                      )}
                    >
                      <input
                        type="radio"
                        name="mc-audience"
                        className="mt-1 accent-[var(--primary)]"
                        checked={audienceType === option.value}
                        onChange={() => setAudienceType(option.value)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2 text-xs font-semibold">
                          {option.label}
                          <span className="text-[10px] font-normal text-muted-foreground">
                            {option.value === "all"
                              ? `${audienceCounts?.all ?? 0} customers`
                              : option.value === "with_orders"
                                ? `${audienceCounts?.withOrders ?? 0} customers`
                                : option.value === "no_orders"
                                  ? `${audienceCounts?.noOrders ?? 0} customers`
                                  : option.value === "new_users"
                                    ? `${audienceCounts?.newUsers ?? 0} customers`
                                    : option.value === "existing_users"
                                      ? `${audienceCounts?.existingUsers ?? 0} customers`
                                      : ""}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[10px] text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>

                {audienceType === "category_buyers" && (
                  <select
                    value={categoryId}
                    onChange={(event) => setCategoryId(event.target.value)}
                    className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Choose a category…</option>
                    {(audienceCounts?.categories ?? []).map((c: any) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.buyers} buyers)
                      </option>
                    ))}
                  </select>
                )}

                {audienceType === "selected" && (
                  <div className="rounded-xl border border-border/60 p-3">
                    <Input
                      value={customerSearch}
                      placeholder="Search by name, email or phone"
                      onChange={(event) => setCustomerSearch(event.target.value)}
                      className="mb-2"
                    />
                    <div className="max-h-48 space-y-1 overflow-y-auto">
                      {(customerOptions ?? []).map((customer: any) => {
                        const checked = selectedUsers.includes(String(customer.userId));
                        return (
                          <label
                            key={customer.userId}
                            className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(value) => {
                                setSelectedUsers((prev) =>
                                  value
                                    ? [...prev, String(customer.userId)]
                                    : prev.filter((id) => id !== String(customer.userId))
                                );
                              }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium">
                                {customer.name}
                              </span>
                              <span className="block truncate text-[10px] text-muted-foreground">
                                {customer.maskedEmail} · {customer.maskedPhone}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                      {customerOptions?.length === 0 && (
                        <p className="py-3 text-center text-[11px] text-muted-foreground">
                          No customers match this search.
                        </p>
                      )}
                    </div>
                    {selectedUsers.length > 0 && (
                      <p className="mt-2 text-[10px] text-muted-foreground">
                        {selectedUsers.length} selected
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Timing</Label>
                <div className="rounded-xl border border-border/60 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold">Schedule for later</p>
                      <p className="text-[10px] text-muted-foreground">
                        Off = send immediately after confirmation
                      </p>
                    </div>
                    <Switch
                      checked={scheduleEnabled}
                      onCheckedChange={setScheduleEnabled}
                    />
                  </div>
                  {scheduleEnabled && (
                    <div className="mt-3 space-y-1">
                      <Label htmlFor="mc-scheduled-at" className="text-[10px]">
                        Send time (IST)
                      </Label>
                      <Input
                        id="mc-scheduled-at"
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(event) => setScheduledAt(event.target.value)}
                      />
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                    <div>
                      <p className="text-xs font-semibold">Expiry date</p>
                      <p className="text-[10px] text-muted-foreground">
                        Hides notification and popup after this time
                      </p>
                    </div>
                    <Switch checked={expiryEnabled} onCheckedChange={setExpiryEnabled} />
                  </div>
                  {expiryEnabled && (
                    <div className="mt-3 space-y-1">
                      <Label htmlFor="mc-expires-at" className="text-[10px]">
                        Expiry time (IST)
                      </Label>
                      <Input
                        id="mc-expires-at"
                        type="datetime-local"
                        value={expiresAt}
                        onChange={(event) => setExpiresAt(event.target.value)}
                      />
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border/60 p-3">
                  <p className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
                    <CalendarClock className="size-3.5 text-primary" />
                    Suggested send time
                    <Badge variant="outline" className="text-[9px] font-normal">
                      estimate
                    </Badge>
                  </p>
                  {recommendation?.sufficient ? (
                    <div className="mt-2 space-y-2">
                      {recommendation.slots.map((slot: any) => (
                        <div
                          key={`${slot.weekday}-${slot.hour}`}
                          className="flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-[11px] font-medium">
                              {slot.weekdayLabel} · {slot.hourLabel}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {Math.round((slot.readRate ?? 0) * 100)}% read ·{" "}
                              {slot.deliveries} deliveries across {slot.campaigns}{" "}
                              campaigns
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 shrink-0 text-[10px]"
                            onClick={() => {
                              setScheduleEnabled(true);
                              setScheduledAt(toLocalInput(slot.nextOccurrence));
                            }}
                          >
                            Use
                          </Button>
                        </div>
                      ))}
                      <p className="text-[10px] text-muted-foreground">
                        {recommendation.reason}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                      {recommendation?.reason ?? "Checking past campaign data…"}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Right: live preview + summary ── */}
            <div className="min-w-0 space-y-4 lg:self-start">
              <Card className="border-border/60">
                <CardHeader className="pb-2">                    <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      Live preview
                    <span className="flex items-center gap-1">
                      {abEnabled && (
                        <span className="flex overflow-hidden rounded-md border border-border/60 text-[9px]">
                          {(["A", "B"] as const).map((variant) => (
                            <button
                              key={variant}
                              type="button"
                              aria-pressed={previewVariant === variant}
                              onClick={() => setPreviewVariant(variant)}
                              className={cn(
                                "px-1.5 py-0.5 font-semibold transition-colors",
                                previewVariant === variant
                                  ? "bg-primary text-primary-foreground"
                                  : "text-muted-foreground hover:bg-muted"
                              )}
                            >
                              {variant}
                            </button>
                          ))}
                        </span>
                      )}
                      <Badge variant="outline" className="text-[10px]">
                        {categoryLabel(category)}
                      </Badge>
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="rounded-xl border border-border/60 bg-white p-3 shadow-sm">
                    <div className="flex items-start gap-2">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Bell className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">
                          {previewContent.title.trim() ||
                            (previewVariant === "B"
                              ? "Variant B title"
                              : "Your message title")}
                        </p>
                        <p className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground">
                          {previewContent.body.trim() ||
                            (previewVariant === "B"
                              ? "Variant B message will appear here."
                              : "Your message body will appear here.")}
                        </p>
                        <p className="mt-1 text-[9px] uppercase tracking-wide text-muted-foreground/70">
                          Kalyan Chemist · Now
                        </p>
                      </div>
                    </div>
                  </div>
                  {imageUrl.trim() && (
                    <div className="overflow-hidden rounded-xl border border-border/60">
                      <img
                        src={imageUrl}
                        alt="Campaign banner preview"
                        className="max-h-40 w-full object-cover"
                        onError={(event) => {
                          (event.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Preview shows the in-app notification card. Popup uses the same
                    content in a centred dialog.
                  </p>
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-1.5 text-xs">
                    <Users className="size-3.5" />
                    Audience & delivery
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Audience</span>
                    <span className="font-medium">{audienceLabel(audienceType)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Eligible customers</span>
                    <span className="font-medium">{preview?.recipients ?? "…"}</span>
                  </div>
                  {(preview?.perChannel ?? []).map((row: any) => (
                    <div key={row.channel} className="flex justify-between">
                      <span className="text-muted-foreground">
                        {CHANNELS.find((c) => c.value === row.channel)?.label}
                      </span>
                      <span className="font-medium">
                        {row.eligible}
                        {row.ineligible > 0 && (
                          <span className="ml-1 text-[10px] font-normal text-amber-600">
                            ({row.ineligible} ineligible)
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                  {preview?.missingConfig.map((message: string) => (
                    <div
                      key={message}
                      className="flex items-start gap-1.5 rounded-lg bg-amber-50 p-2 text-[10px] text-amber-800"
                    >
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                      <span>{message}</span>
                    </div>
                  ))}
                  {validation.errors.length > 0 && (
                    <div className="rounded-lg bg-red-50 p-2 text-[10px] text-red-700">
                      {validation.errors[0]}
                    </div>
                  )}
                  {noEligibleChannel && (
                    <div className="rounded-lg bg-red-50 p-2 text-[10px] text-red-700">
                      No customer is eligible for any selected channel. Check contact
                      details, opt-outs and channel preferences.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-border/60">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-1.5 text-xs">
                    <AlertTriangle className="size-3.5 text-amber-600" />
                    Smart suggestions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(suggestions?.suggestions ?? []).length === 0 && (
                    <p className="text-[11px] text-muted-foreground">
                      No audience, timing or frequency concerns detected for this
                      draft.
                    </p>
                  )}
                  {(suggestions?.suggestions ?? []).map((suggestion: any) => (
                    <div
                      key={`${suggestion.level}-${suggestion.title}`}
                      className={cn(
                        "rounded-lg p-2 text-[10px] leading-relaxed",
                        suggestion.level === "warning"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-muted/50 text-muted-foreground"
                      )}
                    >
                      <p className="font-semibold">{suggestion.title}</p>
                      <p className="mt-0.5">{suggestion.detail}</p>
                    </div>
                  ))}
                  <p className="text-[9px] leading-relaxed text-muted-foreground/80">
                    Suggestions are optional guidance based on campaign history and
                    saved settings. Nothing is scheduled or sent automatically.
                  </p>
                </CardContent>
              </Card>

              <div className="rounded-xl border border-border/60 bg-muted/30 p-3 text-[10px] leading-relaxed text-muted-foreground">
                <p className="mb-1 flex items-center gap-1 font-semibold text-foreground">
                  <CheckCheck className="size-3" />
                  Before you send
                </p>
                Only registered customers in the selected audience receive this
                campaign. Customers who opted out of a channel are skipped
                automatically, and WhatsApp is sent only through an approved
                template.
              </div>
            </div>
          </div>
        )}

        {/* In-flow footer: it can never cover the form content. */}
        <DialogFooter className="shrink-0 flex-col gap-2 border-t border-border/60 bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => setPreviewOpen(true)}
            disabled={!canPreview}
          >
            <Eye className="size-3.5" />
            Preview email
          </Button>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => submit("draft")}
              disabled={saving || !ready}
            >
              {saving && pendingMode === "draft" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
              Save draft
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => requestSend("schedule")}
              disabled={saving || !ready}
            >
              <CalendarClock className="size-3.5" />
              Schedule
            </Button>
            <Button
              size="sm"
              className="gap-1.5 gradient-primary text-white"
              onClick={() => requestSend("send_now")}
              disabled={saving || !ready}
            >
              {saving && pendingMode === "send_now" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              Review & send
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Email preview */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email preview</DialogTitle>
            <DialogDescription>
              Rendered with the same template customers receive. The unsubscribe link
              is personalised per recipient.
            </DialogDescription>
          </DialogHeader>
          {abEnabled && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Variation</span>
              {(["A", "B"] as const).map((variant) => (
                <Button
                  key={variant}
                  type="button"
                  size="sm"
                  variant={previewVariant === variant ? "default" : "outline"}
                  className="h-7 px-2.5 text-[11px]"
                  aria-pressed={previewVariant === variant}
                  onClick={() => setPreviewVariant(variant)}
                >
                  {variant}
                </Button>
              ))}
              <span className="ml-auto text-[10px] text-muted-foreground">
                Test sends use the selected variation.
              </span>
            </div>
          )}
          {!canPreview ? (
            <div className="rounded-xl border border-dashed border-border/70 py-10 text-center">
              <p className="text-xs font-medium">Nothing to preview yet</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Add a title and message
                {abEnabled ? " (or complete the selected variation)" : ""} first.
              </p>
            </div>
          ) : emailPreview ? (
            <iframe
              title="Email preview"
              srcDoc={emailPreview.html}
              sandbox=""
              className="h-[55vh] w-full rounded-xl border border-border/60 bg-white"
            />
          ) : (
            <div className="flex justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          <div className="rounded-xl border border-border/60 p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold">
              <FlaskConical className="size-3.5 text-primary" />
              Send a test
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
              A test goes only to the address or number entered here — never to the
              campaign audience. Use your own contact details.
            </p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <select
                value={testChannel}
                aria-label="Test channel"
                onChange={(event) =>
                  setTestChannel(event.target.value as "email" | "whatsapp")
                }
                className="rounded-lg border border-border/70 bg-background px-3 py-2 text-sm sm:w-36"
              >
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
              <Input
                value={testRecipient}
                aria-label="Test recipient"
                placeholder={
                  testChannel === "email" ? "you@example.com" : "+91 98765 43210"
                }
                onChange={(event) => setTestRecipient(event.target.value)}
              />
              <Button
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={sendTest}
                disabled={
                  testSending || !testRecipient.trim() || !canPreview
                }
              >
                {testSending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                Send test
              </Button>
            </div>
            <p className="mt-2 text-[9px] text-muted-foreground">
              Limited to 5 tests per admin every 10 minutes. Test sends are recorded
              in the audit trail without the recipient's contact details.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Explicit confirmation */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {pendingMode === "schedule" ? "Schedule this campaign?" : "Send this campaign?"}
            </DialogTitle>
            <DialogDescription>
              Review exactly who will receive this message and through which channels.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
              <p className="text-xs font-semibold">{title || "Untitled message"}</p>
              <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-[11px] text-muted-foreground">
                {body}
              </p>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Audience</span>
                <span className="font-medium">{audienceLabel(audienceType)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customers in audience</span>
                <span className="font-medium">{preview?.recipients ?? 0}</span>
              </div>
              {pendingMode === "schedule" && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Send at</span>
                  <span className="font-medium">
                    {formatDateTime(fromLocalInput(scheduledAt))}
                  </span>
                </div>
              )}
              {expiryEnabled && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expires</span>
                  <span className="font-medium">
                    {formatDateTime(fromLocalInput(expiresAt))}
                  </span>
                </div>
              )}
              {abEnabled && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">A/B variation split</span>
                  <span className="font-medium">
                    A {abSplit}% / B {100 - abSplit}%
                  </span>
                </div>
              )}
              <div className="border-t border-border/60 pt-2">
                <p className="mb-1 text-muted-foreground">Estimated recipients per channel</p>
                {(preview?.perChannel ?? []).map((row: any) => (
                  <div key={row.channel} className="flex justify-between">
                    <span>
                      {CHANNELS.find((c) => c.value === row.channel)?.label}
                    </span>
                    <span className="font-medium">{row.eligible}</span>
                  </div>
                ))}
              </div>
            </div>
            {(preview?.missingConfig.length ?? 0) > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
                <p className="font-semibold">Setup required</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                  {preview?.missingConfig.map((message: string) => (
                    <li key={message}>{message}</li>
                  ))}
                </ul>
                <p className="mt-1">
                  You can still save this campaign as a draft, but it cannot be sent
                  until configuration is complete.
                </p>
              </div>
            )}
            <p className="rounded-lg bg-muted/50 p-2 text-[10px] text-muted-foreground">
              Sending is idempotent: retries will not create duplicate notifications or
              messages. WhatsApp and email recipients who opt out are skipped.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Go back
            </Button>              <Button
                className="gap-1.5 gradient-primary text-white"
                disabled={
                  saving ||
                  (preview?.missingConfig.length ?? 0) > 0 ||
                  noEligibleChannel
                }
                onClick={() => submit(pendingMode)}
              >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {pendingMode === "schedule" ? "Confirm & schedule" : "Confirm & send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save current copy to the template library */}
      <Dialog open={templateSaveOpen} onOpenChange={setTemplateSaveOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save as template</DialogTitle>
            <DialogDescription>
              Store this title and message for reuse. Templates never send anything
              on their own.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="mc-template-name">Template name</Label>
            <Input
              id="mc-template-name"
              value={templateName}
              maxLength={80}
              placeholder="e.g. Festival greeting"
              onChange={(event) => setTemplateName(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateSaveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveAsTemplate} disabled={!templateName.trim()}>
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
