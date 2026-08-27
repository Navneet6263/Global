import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { StatusBadge } from "@/components/feedback/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { OPS_PRIORITY_META, OPS_SLA_META } from "@/features/operations/contracts/case";
import { OpsCapacityList } from "@/features/operations/components/ops-capacity-list";
import { useAssignChecks, useOpsAssignments } from "@/features/operations/hooks/use-operations";
import { formatDuration } from "@/lib/formatting";

export const Route = createFileRoute("/operations/assignments")({
  head: () => ({
    meta: [
      { title: "Assignment Workbench — Sapling Global Operations" },
      {
        name: "description",
        content:
          "Allocate unassigned verification checks to verifiers using live capacity, skill and branch signals.",
      },
      { property: "og:title", content: "Assignment Workbench — Sapling Global Operations" },
      {
        property: "og:description",
        content: "Match unassigned checks to the right verifier with capacity-aware allocation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssignmentsPage,
});

function AssignmentsPage() {
  const { data, isPending, isError, isFetching, refetch } = useOpsAssignments();
  const assign = useAssignChecks();
  const [selected, setSelected] = useState<string[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    );

  const submit = () => {
    if (!memberId || selected.length === 0) return;
    assign.mutate({ itemIds: selected, memberId });
    setSelected([]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignment workbench"
        description="Pick the unassigned checks on the left, then allocate them to a verifier with the right skills and headroom."
        actions={
          <Button
            disabled={!memberId || selected.length === 0 || assign.isPending}
            onClick={submit}
          >
            Assign {selected.length > 0 ? `${selected.length} checks` : "selection"}
          </Button>
        }
      />

      {isError ? <ErrorState onRetry={() => void refetch()} retrying={isFetching} /> : null}

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Section
          title="Unassigned checks"
          description="Sorted by urgency; branch and skill mismatches are flagged when you assign."
          padded={false}
        >
          {isPending ? (
            <div className="p-5">
              <ListSkeleton rows={6} />
            </div>
          ) : (data?.items.length ?? 0) === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Inbox}
                title="Nothing waiting for allocation"
                description="Every open check currently has an owner."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {data!.items.map((item) => (
                <li key={item.id} className="flex items-start gap-3 px-5 py-3">
                  <Checkbox
                    checked={selected.includes(item.id)}
                    onCheckedChange={() => toggle(item.id)}
                    aria-label={`Select ${item.checkLabel} for ${item.candidateName}`}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium text-foreground">
                        {item.candidateName}
                      </span>
                      <span className="num text-[11px] text-muted-foreground">
                        {item.caseNumber}
                      </span>
                      <StatusBadge
                        label={OPS_PRIORITY_META[item.priority].label}
                        tone={OPS_PRIORITY_META[item.priority].tone}
                        withDot={false}
                      />
                      <StatusBadge
                        label={OPS_SLA_META[item.slaState].label}
                        tone={OPS_SLA_META[item.slaState].tone}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {item.checkLabel} · {item.clientName} · {item.branch} ({item.city})
                    </p>
                  </div>
                  <span className="num shrink-0 text-[11px] text-muted-foreground">
                    {item.slaMinutesRemaining <= 0
                      ? `overdue ${formatDuration(-item.slaMinutesRemaining)}`
                      : `${formatDuration(item.slaMinutesRemaining)} left`}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <OpsCapacityList
          members={data?.members ?? []}
          loading={isPending}
          selectedId={memberId}
          onSelect={setMemberId}
        />
      </div>
    </div>
  );
}
