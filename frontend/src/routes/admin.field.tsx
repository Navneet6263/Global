import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Camera, CircleAlert, MapPin, Navigation } from "lucide-react";
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
import type { OpsFieldVisit } from "@/features/operations/contracts/case";
import { useOpsField } from "@/features/operations/hooks/use-operations";
import { formatDateTime } from "@/lib/formatting";

const PAGE_SIZE = 7;

export const Route = createFileRoute("/admin/field")({
  head: () => ({
    meta: [
      { title: "Field Operations Oversight — Sapling Global" },
      { name: "description", content: "Live field-visit, geofence and evidence risk oversight." },
    ],
  }),
  component: FieldOversightPage,
});

function FieldOversightPage() {
  const query = useOpsField();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data?.visits ?? []).filter((visit) => {
      if (status !== "all" && visit.status !== status) return false;
      return `${visit.caseNumber} ${visit.candidateName} ${visit.clientName} ${visit.fieldExecutive} ${visit.address}`
        .toLowerCase()
        .includes(term);
    });
  }, [query.data?.visits, search, status]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Field operations oversight"
        description="GPS, evidence and visit-exception signals only. Field execution remains in each executive's mobile workspace."
      />

      {query.isError ? (
        <ErrorState
          title="Field oversight unavailable"
          onRetry={() => void query.refetch()}
          retrying={query.isFetching}
        />
      ) : null}
      {query.isPending ? <CardGridSkeleton count={4} /> : null}
      {query.data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <OversightMetric
              label="Activity today"
              value={query.data.today}
              detail="Visits with activity today"
              icon={Navigation}
              tone="blue"
            />
            <OversightMetric
              label="Evidence pending"
              value={query.data.evidencePending}
              detail="Visits awaiting proof"
              icon={Camera}
              tone="amber"
            />
            <OversightMetric
              label="Outside geofence"
              value={query.data.outsideGeofence}
              detail="GPS distance requires review"
              icon={MapPin}
              tone="rose"
            />
            <OversightMetric
              label="Exception review"
              value={query.data.exceptionReview}
              detail="Open field decisions"
              icon={CircleAlert}
              tone="violet"
            />
          </div>

          <OversightPanel
            title="Field attention queue"
            description="Visits surfaced by live field exception and geofence records."
            count={filtered.length}
            toolbar={
              <>
                <OversightSearch
                  value={search}
                  onChange={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  placeholder="Search visit or executive"
                />
                <select
                  aria-label="Filter by visit status"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                  className="h-9 rounded-full border border-border bg-neutral-soft/70 px-3 text-xs outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="all">All statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="checked_in">Checked in</option>
                  <option value="evidence_pending">Evidence pending</option>
                  <option value="outside_geofence">Outside geofence</option>
                  <option value="exception_review">Exception review</option>
                  <option value="completed">Completed</option>
                </select>
              </>
            }
          >
            {rows.length ? (
              <div className="divide-y divide-border/70 px-3 sm:px-5">
                {rows.map((visit) => (
                  <FieldRow key={visit.id} visit={visit} />
                ))}
              </div>
            ) : (
              <OversightEmpty
                title="No field visit matches"
                detail="The attention queue is clear, or no visit matches these filters."
              />
            )}
            <OversightPager
              page={safePage}
              canPrevious={safePage > 1}
              canNext={safePage < pages}
              onPrevious={() => setPage((value) => Math.max(1, value - 1))}
              onNext={() => setPage((value) => Math.min(pages, value + 1))}
            />
          </OversightPanel>
        </>
      ) : null}
    </div>
  );
}

function FieldRow({ visit }: { visit: OpsFieldVisit }) {
  return (
    <article className="grid gap-3 py-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(120px,.7fr)_minmax(150px,.8fr)_minmax(120px,.6fr)] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-semibold">{visit.candidateName}</p>
          <OversightPill tone={statusTone(visit.status)}>
            {oversightLabel(visit.status)}
          </OversightPill>
        </div>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {visit.caseNumber} · {visit.clientName}
        </p>
      </div>
      <Detail label="Field executive" value={visit.fieldExecutive} />
      <div className="min-w-0">
        <p className="text-[10px] tracking-[0.07em] text-muted-foreground uppercase">
          Visit location
        </p>
        <p className="mt-1 truncate text-xs font-medium">{visit.address}</p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {visit.note ||
            (visit.geofenceMetres === null
              ? "Location distance not recorded"
              : `${visit.geofenceMetres} m allowed radius`)}
        </p>
      </div>
      <Detail label="Recorded" value={formatDateTime(visit.scheduledAt)} />
    </article>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] tracking-[0.07em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 truncate text-xs font-medium">{value}</p>
    </div>
  );
}

function statusTone(value: OpsFieldVisit["status"]): OversightTone {
  if (value === "completed") return "mint";
  if (value === "checked_in") return "blue";
  if (value === "scheduled") return "neutral";
  if (value === "evidence_pending") return "amber";
  return "rose";
}
