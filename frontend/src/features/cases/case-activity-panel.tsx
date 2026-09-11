import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Fingerprint, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/api/auth";
import { listCaseActivity } from "@/lib/backend-api/case-activity";
import { formatDateTime, humanize } from "./case-detail-formatting";

const tones: Record<string, string> = {
  report: "bg-violet-100 text-violet-800",
  document: "bg-sky-100 text-sky-800",
  invoice: "bg-amber-100 text-amber-900",
  task: "bg-emerald-100 text-emerald-900",
};

export function CaseActivityPanel({ caseId }: { caseId: string }) {
  const [resource, setResource] = useState("");
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const allowed = Boolean(
    session.data?.roles.some((role) => ["PLATFORM_ADMIN", "OPS_MANAGER"].includes(role)),
  );
  const events = useQuery({
    queryKey: ["case-activity", caseId, resource, cursors.at(-1)],
    queryFn: () => listCaseActivity(caseId, { resource, cursor: cursors.at(-1) }),
    enabled: allowed,
  });
  if (!allowed) return null;

  return (
    <section className="surface rounded-3xl p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Case activity</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Who viewed evidence, made decisions and released reports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            aria-label="Filter case activity"
            value={resource}
            onChange={(event) => {
              setResource(event.target.value);
              setCursors([undefined]);
            }}
            className="h-9 rounded-full border border-border bg-background px-3 text-xs"
          >
            <option value="">All activity</option>
            <option value="case">Workflow</option>
            <option value="document">Documents</option>
            <option value="report">Reports</option>
            <option value="task">Assignments</option>
            <option value="field_visit">Field visits</option>
            <option value="invoice">Billing</option>
          </select>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh case activity"
            disabled={events.isFetching}
            onClick={() => void events.refetch()}
          >
            <RefreshCw className={`size-4 ${events.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>
      {events.isPending ? (
        <p className="py-8 text-center text-sm text-muted-foreground" role="status">
          Loading activity…
        </p>
      ) : null}
      {events.isError ? (
        <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-900" role="alert">
          <p>{events.error.message}</p>
          <Button
            className="mt-3"
            variant="outline"
            onClick={() => {
              if (cursors.length > 1) setCursors([undefined]);
              else void events.refetch();
            }}
          >
            Retry from first page
          </Button>
        </div>
      ) : null}
      {!events.isPending && !events.isError && !events.data?.items.length ? (
        <p className="rounded-2xl bg-secondary/40 px-4 py-8 text-center text-sm text-muted-foreground">
          No matching case activity recorded yet.
        </p>
      ) : null}
      <ol className="space-y-2">
        {events.data?.items.map((event) => (
          <li
            key={event.id}
            className="flex items-start gap-3 rounded-2xl bg-secondary/35 p-3 sm:p-4"
          >
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-background text-muted-foreground">
              <Fingerprint className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="break-words text-sm font-medium">
                  {humanize(event.action.replace(/[.-]/g, "_"))}
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tones[event.resourceType] ?? "bg-secondary text-muted-foreground"}`}
                >
                  {humanize(event.resourceType)}
                </span>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>{event.actorName}</span>
                <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/60 pt-4">
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Page {cursors.length} · {events.data?.items.length ?? 0} events
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={cursors.length === 1 || events.isFetching}
            onClick={() => setCursors((values) => values.slice(0, -1))}
          >
            <ChevronLeft className="mr-1 size-3.5" /> Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!events.data?.nextCursor || events.isFetching}
            onClick={() => {
              const next = events.data?.nextCursor;
              if (next) setCursors((values) => [...values, next]);
            }}
          >
            Next <ChevronRight className="ml-1 size-3.5" />
          </Button>
        </div>
      </div>
    </section>
  );
}
