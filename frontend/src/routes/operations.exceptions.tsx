import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import type {
  OpsException,
  OpsExceptionQuery,
  OpsExceptionSeverity,
  OpsExceptionType,
} from "@/features/operations/contracts/operations";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useExceptionAction, useOpsExceptions } from "@/features/operations/hooks/use-operations";
import { formatDuration, formatDateTime } from "@/lib/formatting";

export const Route = createFileRoute("/operations/exceptions")({
  head: () => ({
    meta: [
      { title: "Exception Queue — Sapling Global Operations" },
      {
        name: "description",
        content:
          "Single queue for stuck verifications: breaches, rejected documents, blockers, field and QA exceptions.",
      },
      { property: "og:title", content: "Exception Queue — Sapling Global Operations" },
      {
        property: "og:description",
        content: "Triage everything blocking delivery with owner, age and recommended action.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ExceptionsPage,
});

const TYPE_LABELS: Record<OpsExceptionType, string> = {
  sla_overdue: "SLA overdue",
  candidate_clarification: "Candidate clarification",
  client_clarification: "Client clarification",
  document_rejected: "Document rejected",
  consent_problem: "Consent problem",
  verifier_blocker: "Verifier blocker",
  field_visit: "Field visit",
  geofence: "Geofence",
  evidence_quality: "Evidence quality",
  qa_return: "QA return",
  system: "System",
};

const SEVERITY_TONE: Record<OpsExceptionSeverity, "critical" | "warning" | "info"> = {
  critical: "critical",
  high: "warning",
  medium: "info",
};

const FILTER_TYPES: OpsExceptionType[] = ["sla_overdue", "client_clarification", "field_visit"];

const PAGE_SIZE = 8;

function ExceptionsPage() {
  const [query, setQuery] = useState<OpsExceptionQuery>({
    status: "open",
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const { data, isPending, isError, isFetching, refetch } = useOpsExceptions(query);
  const action = useExceptionAction();

  const patch = (next: Partial<OpsExceptionQuery>) =>
    setQuery((current) => ({ ...current, page: 1, ...next }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exception queue"
        description="Every blocked case in one triage list — resolve, escalate or hand it to the right owner."
        meta={
          data ? `${data.openCount} open · ${data.resolvedCount} resolved this period` : undefined
        }
      />

      {isError ? <ErrorState onRetry={() => void refetch()} retrying={isFetching} /> : null}

      <div className="surface overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3.5">
          <Input
            placeholder="Search case, candidate or client"
            value={query.search ?? ""}
            onChange={(event) => patch({ search: event.target.value || undefined })}
            className="h-9 w-full sm:w-64"
          />
          <Select
            value={query.type ?? "all"}
            onValueChange={(value) => patch({ type: value as OpsExceptionQuery["type"] })}
          >
            <SelectTrigger className="h-9 w-[190px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {FILTER_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {TYPE_LABELS[type]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={query.severity ?? "all"}
            onValueChange={(value) => patch({ severity: value as OpsExceptionQuery["severity"] })}
          >
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={query.ageBucket ?? "all"}
            onValueChange={(value) => patch({ ageBucket: value as OpsExceptionQuery["ageBucket"] })}
          >
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue placeholder="Age" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any age</SelectItem>
              <SelectItem value="under_24h">Under 24h</SelectItem>
              <SelectItem value="1_3d">1–3 days</SelectItem>
              <SelectItem value="over_3d">Over 3 days</SelectItem>
            </SelectContent>
          </Select>
          <p className="ml-auto text-xs text-muted-foreground">
            {data ? `${data.resolvedCount} resolved today` : "Live open queue"}
          </p>
        </div>

        {isPending ? (
          <div className="p-5">
            <ListSkeleton rows={6} />
          </div>
        ) : (data?.rows.length ?? 0) === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={ShieldCheck}
              title="No exceptions in this view"
              description="Nothing is blocked with the current filters. Try a wider severity or age range."
            />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {data!.rows.map((row) => (
                <ExceptionRow
                  key={row.id}
                  row={row}
                  busy={action.isPending}
                  pendingAction={
                    action.isPending && action.variables?.id === row.id
                      ? action.variables.action
                      : undefined
                  }
                  onResolve={
                    row.type === "client_clarification" || row.type === "field_visit"
                      ? () =>
                          action.mutate({
                            id: row.id,
                            action: "resolve",
                            value: "Resolved from exception queue",
                          })
                      : undefined
                  }
                  onEscalate={() =>
                    action.mutate({ id: row.id, action: "escalate", value: "Escalated to lead" })
                  }
                />
              ))}
            </ul>
            <PaginationBar
              page={data?.page ?? 1}
              pageSize={PAGE_SIZE}
              total={data?.total ?? 0}
              onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
              label="exceptions"
            />
          </>
        )}
      </div>
    </div>
  );
}

function ExceptionRow({
  row,
  busy,
  pendingAction,
  onResolve,
  onEscalate,
}: {
  row: OpsException;
  busy: boolean;
  pendingAction: string | undefined;
  onResolve?: () => void;
  onEscalate: () => void;
}) {
  return (
    <li className="space-y-2 px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge label={row.severity} tone={SEVERITY_TONE[row.severity]} withDot={false} />
        <span className="text-[13px] font-medium text-foreground">{row.candidateName}</span>
        <span className="num text-[11px] text-muted-foreground">{row.caseNumber}</span>
        <span className="rounded-md border border-border bg-muted px-1.5 py-px text-[10px] tracking-wide text-muted-foreground uppercase">
          {TYPE_LABELS[row.type]}
        </span>
        {row.status === "resolved" ? <StatusBadge label="Resolved" tone="success" /> : null}
      </div>
      <p className="text-[12.5px] text-foreground/90">{row.reason}</p>
      <p className="text-[11px] text-muted-foreground">
        {row.clientName} · owner {row.owner} · open {formatDuration(row.ageMinutes)} · raised{" "}
        {formatDateTime(row.raisedAt)}
      </p>
      <p className="text-[11px] text-muted-foreground/85">
        SLA impact: {row.slaImpact} · Next: {row.recommendedAction}
      </p>
      {row.status === "open" ? (
        <div className="flex flex-wrap gap-2 pt-0.5">
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            loading={pendingAction === "escalate"}
            onClick={onEscalate}
          >
            Escalate
          </Button>
          {onResolve ? (
            <Button
              size="sm"
              disabled={busy}
              loading={pendingAction === "resolve"}
              onClick={onResolve}
            >
              Resolve
            </Button>
          ) : null}
        </div>
      ) : row.resolutionNote ? (
        <p className="text-[11px] text-success-foreground">{row.resolutionNote}</p>
      ) : null}
    </li>
  );
}
