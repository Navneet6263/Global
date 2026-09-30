import { Link } from "@tanstack/react-router";
import { Filter, RefreshCw, X } from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { Button } from "@/components/ui/button";
import {
  OversightEmpty,
  OversightPanel,
  OversightPill,
} from "@/features/admin-dashboard/components/oversight-ui";
import { oversightLabel } from "@/features/admin-dashboard/oversight-format";
import { formatDateTime } from "@/lib/formatting";
import { useVendorLogs } from "./use-vendor-logs";
import { vendorLogLabel, type VendorLogItem } from "./vendor-log-model";

/** Newest-first activity of the caller's own requests (and, for a Main Vendor, its team). */
export function VendorLogList({ requestId }: { requestId: string | undefined }) {
  const logs = useVendorLogs(requestId);
  const items = logs.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = requestId ? items.find((item) => item.request?.id === requestId) : undefined;

  return (
    <OversightPanel
      title={requestId ? "Request activity" : "All activity"}
      description="Assignments, decisions, reports and team changes. SPOC-RM downloads are shown as they happen."
      toolbar={
        <>
          {requestId ? (
            <Link
              to="/vendor/logs"
              className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-card px-3 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              {filtered?.request?.caseNumber ?? "One request"}
              <X className="size-3.5" aria-hidden />
              <span className="sr-only">Show all activity</span>
            </Link>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={logs.isFetching}
            onClick={() => void logs.refetch()}
          >
            <RefreshCw
              className={`size-3.5 ${logs.isFetching ? "animate-spin" : ""}`}
              aria-hidden
            />
            Refresh
          </Button>
        </>
      }
    >
      {logs.isError ? (
        <div className="p-4">
          <ErrorState
            description={logs.error.message}
            onRetry={() => void logs.refetch()}
            retrying={logs.isFetching}
          />
        </div>
      ) : logs.isPending ? (
        <div className="p-4">
          <ListSkeleton rows={6} />
        </div>
      ) : !items.length ? (
        <OversightEmpty
          title="No activity yet"
          detail="Assignments, decisions and reports appear here as they happen."
        />
      ) : (
        <ol className="divide-y divide-border/70">
          {items.map((item) => (
            <VendorLogRow key={item.id} item={item} filtered={Boolean(requestId)} />
          ))}
        </ol>
      )}
      {logs.hasNextPage ? (
        <div className="border-t border-border/70 px-4 py-3 text-center">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={logs.isFetchingNextPage}
            loading={logs.isFetchingNextPage}
            onClick={() => void logs.fetchNextPage()}
          >
            Load more
          </Button>
        </div>
      ) : null}
    </OversightPanel>
  );
}

function VendorLogRow({ item, filtered }: { item: VendorLogItem; filtered: boolean }) {
  const { label, tone } = vendorLogLabel(item);
  const request = item.request;
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-xs sm:px-5">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <OversightPill tone={tone}>{label}</OversightPill>
          {request ? (
            <Link
              to="/vendor"
              search={{ requestId: request.id }}
              className="font-medium text-primary hover:underline"
            >
              {request.caseNumber ?? "Request"}
              {request.documentType ? ` · ${oversightLabel(request.documentType)}` : ""}
            </Link>
          ) : null}
          {item.teamUser ? <span className="font-medium">{item.teamUser}</span> : null}
          {request && !filtered ? (
            <Link
              to="/vendor/logs"
              search={{ requestId: request.id }}
              title="Only this request"
              className="inline-grid size-6 place-items-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Filter className="size-3" aria-hidden />
              <span className="sr-only">Show only this request</span>
            </Link>
          ) : null}
        </div>
        <p className="text-[11px] text-muted-foreground">By {item.actorName}</p>
      </div>
      <time dateTime={item.createdAt} className="text-[11px] text-muted-foreground">
        {formatDateTime(item.createdAt)}
      </time>
    </li>
  );
}
