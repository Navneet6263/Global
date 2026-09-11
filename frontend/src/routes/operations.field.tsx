import { createFileRoute } from "@tanstack/react-router";
import { MapPinned } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { StatusBadge } from "@/components/feedback/status-badge";
import { OPS_FIELD_STATUS_META } from "@/features/operations/contracts/case";
import { useOpsField } from "@/features/operations/hooks/use-operations";
import { formatDateTime } from "@/lib/formatting";

export const Route = createFileRoute("/operations/field")({
  head: () => ({
    meta: [
      { title: "Field Operations — Sapling Global Operations" },
      {
        name: "description",
        content:
          "Scheduled address visits, check-ins, geofence flags and evidence status across field executives.",
      },
      { property: "og:title", content: "Field Operations — Sapling Global Operations" },
      {
        property: "og:description",
        content: "Monitor address visits, geofence exceptions and evidence capture in real time.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FieldOperationsPage,
});

function FieldOperationsPage() {
  const { data, isPending, isError, isFetching, refetch } = useOpsField();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Field operations"
        description="Address visits in flight: who is on site, what evidence is pending and which visits need review."
      />

      {isError ? <ErrorState onRetry={() => void refetch()} retrying={isFetching} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Scheduled" value={data?.scheduled} />
        <Tile label="Activity today" value={data?.today} />
        <Tile label="Checked in" value={data?.checkedIn} />
        <Tile label="Evidence pending" value={data?.evidencePending} tone="warning" />
        <Tile label="Outside geofence" value={data?.outsideGeofence} tone="critical" />
        <Tile label="Exception review" value={data?.exceptionReview} tone="critical" />
        <Tile label="Evidence review" value={data?.reviewPending} tone="warning" />
        <Tile label="Completed" value={data?.completed} tone="success" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
        <Section
          title="Visit board"
          description="Recorded and in-progress visits with evidence status."
          padded={false}
        >
          {isPending ? (
            <div className="p-5">
              <ListSkeleton rows={6} />
            </div>
          ) : (data?.visits.length ?? 0) === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={MapPinned}
                title="No field visits scheduled"
                description="Address checks requiring a site visit will appear here."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data!.visits.map((visit) => {
                const meta = OPS_FIELD_STATUS_META[visit.status];
                return (
                  <li key={visit.id} className="space-y-1.5 px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge label={meta.label} tone={meta.tone} />
                      <span className="text-[13px] font-medium text-foreground">
                        {visit.candidateName}
                      </span>
                      <span className="num text-[11px] text-muted-foreground">
                        {visit.caseNumber}
                      </span>
                    </div>
                    <p className="text-[12px] text-foreground/85">{visit.address}</p>
                    <p className="num text-[11px] text-muted-foreground">
                      {visit.city} · {visit.fieldExecutive} · {formatDateTime(visit.scheduledAt)} ·{" "}
                      {visit.evidenceCount} evidence
                    </p>
                    {visit.note ? (
                      <p className="text-[11px] text-muted-foreground/85">{visit.note}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section
          title="Executive load"
          description="Visit activity recorded today and open follow-ups."
          padded={false}
        >
          {isPending ? (
            <div className="p-5">
              <ListSkeleton rows={5} />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data!.executiveLoad.map((row) => (
                <li key={row.name} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-foreground">{row.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{row.city}</p>
                  </div>
                  <p className="num shrink-0 text-[11px] text-muted-foreground">
                    {row.visitsToday} today · {row.open} open
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | undefined;
  tone?: "warning" | "critical" | "success";
}) {
  const toneClass =
    tone === "critical"
      ? "text-critical-foreground"
      : tone === "warning"
        ? "text-warning-foreground"
        : tone === "success"
          ? "text-success-foreground"
          : "text-foreground";
  return (
    <div className="surface px-4 py-3.5">
      <p className="text-[11px] tracking-[0.07em] text-muted-foreground uppercase">{label}</p>
      <p className={`num mt-1.5 text-[1.4rem] leading-none font-medium ${toneClass}`}>
        {value ?? "—"}
      </p>
    </div>
  );
}
