/**
 * Master catalog browser — a read-only window into what Auto Fill can answer
 * with.
 *
 * Records are grouped by verification status (VERIFIED / NEEDS_IMAGE /
 * NEEDS_REVIEW) and each one shows the exact image that was stored for it —
 * or an honest "no verified image" placeholder, never a stand-in picture.
 * The section is collapsed by default and its queries are skipped while
 * closed, so opening the Products page costs nothing until the admin looks.
 */
import { useEffect, useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ChevronDown,
  ChevronUp,
  Database,
  ImageOff,
  Loader2,
  Search,
} from "lucide-react";

type StatusFilter = "all" | "VERIFIED" | "NEEDS_REVIEW" | "NEEDS_IMAGE";

const STATUS_TABS: Array<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "VERIFIED", label: "Verified" },
  { id: "NEEDS_IMAGE", label: "Needs image" },
  { id: "NEEDS_REVIEW", label: "Needs review" },
];

const STATUS_BADGE: Record<
  Exclude<StatusFilter, "all">,
  { label: string; className: string }
> = {
  VERIFIED: {
    label: "Verified",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  NEEDS_IMAGE: {
    label: "Needs image",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  NEEDS_REVIEW: {
    label: "Needs review",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

const PAGE_SIZE = 24;

export default function MasterCatalogBrowser() {
  const [open, setOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setSearchQuery(search.trim()), 250);
    return () => clearTimeout(handle);
  }, [search]);

  const stats = useQuery(api.masterCatalog.stats, open ? {} : "skip");
  const { results, status, loadMore } = usePaginatedQuery(
    api.masterCatalog.listRecords,
    open
      ? {
          status: statusFilter === "all" ? undefined : statusFilter,
          search: searchQuery || undefined,
        }
      : "skip",
    { initialNumItems: PAGE_SIZE },
  );

  const countFor = (tab: StatusFilter): number | null => {
    if (!stats) return null;
    if (tab === "all") return stats.total;
    return stats.byStatus[tab];
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <button
          type="button"
          onClick={() => setOpen((previous) => !previous)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            <Database className="size-4 text-primary" />
            Master product catalog
            <span className="text-xs font-normal text-muted-foreground">
              {open && stats
                ? `${stats.total} records · ${stats.byStatus.VERIFIED} verified · ${stats.byStatus.NEEDS_IMAGE} needing an image · ${stats.byStatus.NEEDS_REVIEW} needing review`
                : "what Auto Fill searches — open to browse"}
            </span>
          </CardTitle>
          {open ? (
            <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          )}
        </button>
      </CardHeader>

      {open && (
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_TABS.map((tab) => (
              <Button
                key={tab.id}
                type="button"
                size="sm"
                variant={statusFilter === tab.id ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setStatusFilter(tab.id)}
              >
                {tab.label}
                {countFor(tab.id) !== null && (
                  <span className="ml-1.5 text-[10px] opacity-70">
                    {countFor(tab.id)}
                  </span>
                )}
              </Button>
            ))}
            <div className="relative ml-auto w-full sm:w-56">
              <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search catalog by name"
                className="h-8 pl-7 text-xs"
              />
            </div>
          </div>

          {stats && stats.total === 0 && (
            <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
              The master catalog is empty. Use <strong>Import catalog</strong> to
              load the licensed dataset — Auto Fill searches it afterwards.
            </p>
          )}

          {results.length > 0 && (
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((row) => {
                const badge = STATUS_BADGE[row.verificationStatus];
                const details = [
                  row.brand,
                  row.strength,
                  row.dosageForm,
                  row.packSize,
                ]
                  .filter(Boolean)
                  .join(" · ");
                const extraViews = row.additionalImages?.length ?? 0;
                return (
                  <div
                    key={row._id}
                    className="flex gap-3 rounded-lg border border-border/60 bg-card p-2.5"
                  >
                    <div className="size-14 shrink-0 rounded-md border border-border/60 bg-muted/30 flex items-center justify-center overflow-hidden">
                      {row.primaryImage ? (
                        <img
                          src={row.primaryImage}
                          alt={row.canonicalProductName}
                          loading="lazy"
                          className="size-full object-contain p-1"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
                          <ImageOff className="size-4" />
                          <span className="text-[9px] leading-none">
                            No verified image
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-xs font-medium text-foreground">
                          {row.canonicalProductName}
                        </p>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-[10px] ${badge.className}`}
                        >
                          {badge.label}
                        </Badge>
                      </div>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {details || "No further variant details"}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {row.manufacturer ?? "Manufacturer not recorded"} ·{" "}
                        {row.catalogProductId}
                        {extraViews > 0
                          ? ` · ${extraViews} more view${extraViews === 1 ? "" : "s"}`
                          : ""}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {results.length === 0 &&
            stats !== undefined &&
            stats.total > 0 &&
            status !== "LoadingFirstPage" && (
              <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
                No catalog records match this filter
                {searchQuery ? ` for “${searchQuery}”` : ""}.
              </p>
            )}

          {status === "LoadingFirstPage" && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Reading the catalog…
            </p>
          )}

          {results.length > 0 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-muted-foreground">
                {results.length} record{results.length === 1 ? "" : "s"} shown
                {statusFilter !== "all"
                  ? ` · ${STATUS_BADGE[statusFilter].label.toLowerCase()}`
                  : ""}
                {searchQuery ? ` · matching “${searchQuery}”` : ""}
              </p>
              {status === "CanLoadMore" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => loadMore(PAGE_SIZE)}
                >
                  Load more
                </Button>
              )}
              {status === "LoadingMore" && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
