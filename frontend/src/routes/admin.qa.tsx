import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CircleAlert, Clock3, FileCheck2, ShieldCheck } from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { CardGridSkeleton } from "@/components/feedback/skeletons";
import { PageHeader } from "@/components/layout/page-header";
import {
  OversightEmpty,
  OversightMetric,
  OversightPager,
  OversightPanel,
  OversightPill,
  OversightSearch,
  type OversightTone,
} from "@/features/admin-dashboard/components/oversight-ui";
import { oversightLabel } from "@/features/admin-dashboard/oversight-format";
import { formatDateTime } from "@/lib/formatting";
import { getQaQueue, type QaQueueItem } from "@/lib/backend-api/qa";

const PAGE_SIZE = 8;

export const Route = createFileRoute("/admin/qa")({
  head: () => ({
    meta: [
      { title: "QA Review Oversight — Sapling Global" },
      { name: "description", content: "Live QA backlog, risk and reviewer-claim oversight." },
    ],
  }),
  component: QaOversightPage,
});

function QaOversightPage() {
  const [search, setSearch] = useState("");
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined]);
  const cursor = cursors.at(-1);
  const query = useQuery({
    queryKey: ["admin", "qa-oversight", search, cursor],
    queryFn: () => getQaQueue({ search: search.trim() || undefined, cursor, limit: PAGE_SIZE }),
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
  const page = cursors.length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="QA review oversight"
        description="Queue health, review risk and ownership only. Approval and rework decisions stay inside the reviewer workspace."
      />

      {query.isError ? (
        <ErrorState
          title="QA oversight unavailable"
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : null}
      {query.isPending ? <CardGridSkeleton count={4} /> : null}
      {query.data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OversightMetric
              label="Awaiting review"
              value={query.data.summary.awaiting}
              detail="Cases at the QA gate"
              icon={FileCheck2}
              tone="violet"
            />
            <OversightMetric
              label="Claimed"
              value={query.data.summary.claimed}
              detail="Owned by a reviewer"
              icon={ShieldCheck}
              tone="mint"
            />
            <OversightMetric
              label="High risk"
              value={query.data.summary.highRisk}
              detail="Needs careful sign-off"
              icon={CircleAlert}
              tone="amber"
            />
            <OversightMetric
              label="Overdue"
              value={query.data.summary.overdue}
              detail="Past committed due date"
              icon={Clock3}
              tone="rose"
            />
          </div>

          <OversightPanel
            title="Review queue"
            description="Read-only platform view, ordered by backend review priority."
            count={query.data.summary.awaiting}
            toolbar={
              <OversightSearch
                value={search}
                onChange={(value) => {
                  setSearch(value);
                  setCursors([undefined]);
                }}
                placeholder="Search case or candidate"
              />
            }
          >
            {query.data.items.length ? (
              <div className="divide-y divide-border/70 px-3 sm:px-5">
                {query.data.items.map((item) => (
                  <QaRow key={item.id} item={item} />
                ))}
              </div>
            ) : (
              <OversightEmpty
                title="No QA work found"
                detail="The queue is clear, or no case matches this search."
              />
            )}
            <OversightPager
              page={page}
              canPrevious={page > 1}
              canNext={Boolean(query.data.nextCursor)}
              onPrevious={() => setCursors((value) => value.slice(0, -1))}
              onNext={() => {
                if (query.data.nextCursor)
                  setCursors((value) => [...value, query.data.nextCursor!]);
              }}
            />
          </OversightPanel>
        </>
      ) : null}
    </div>
  );
}

function QaRow({ item }: { item: QaQueueItem }) {
  const risk = highestRisk(item);
  const overdue = Boolean(item.dueAt && Date.parse(item.dueAt) < Date.now());
  return (
    <article className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(110px,.7fr)_repeat(2,minmax(70px,.35fr))_minmax(145px,.8fr)] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold">{item.subject.fullName}</p>
          <OversightPill tone={priorityTone(item.priority)}>
            {oversightLabel(item.priority)}
          </OversightPill>
          {risk ? (
            <OversightPill tone={risk === "critical" ? "rose" : "amber"}>{risk} risk</OversightPill>
          ) : null}
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {item.caseNumber} · {item.client.displayName}
        </p>
      </div>
      <div>
        <p className="text-[10px] tracking-[0.07em] text-muted-foreground uppercase">Due</p>
        <p className={`mt-1 text-xs font-medium ${overdue ? "text-critical-foreground" : ""}`}>
          {item.dueAt ? formatDateTime(item.dueAt) : "Not committed"}
        </p>
      </div>
      <Datum label="Checks" value={item.checks.length} />
      <Datum label="Documents" value={item.documents.length} />
      <div>
        <p className="text-[10px] tracking-[0.07em] text-muted-foreground uppercase">
          Review owner
        </p>
        <p className="mt-1 truncate text-xs font-medium">
          {item.qaReviewer?.displayName ?? "Unclaimed"}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {item.qaClaimedAt
            ? `Claimed ${formatDateTime(item.qaClaimedAt)}`
            : "Available to reviewers"}
        </p>
      </div>
    </article>
  );
}

function Datum({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.07em] text-muted-foreground uppercase">{label}</p>
      <p className="num mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
}

function highestRisk(item: QaQueueItem) {
  const levels = item.checks.map((check) => check.riskLevel?.toLowerCase());
  if (levels.includes("critical")) return "critical";
  if (levels.includes("high")) return "high";
  return null;
}

function priorityTone(value: string): OversightTone {
  if (value === "URGENT" || value === "CRITICAL") return "rose";
  if (value === "HIGH") return "amber";
  return "neutral";
}
