import { useEffect, useState } from "react";
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
          "Allocate unassigned verification checks using live verifier workload and due-date pressure.",
      },
      { property: "og:title", content: "Assignment Workbench — Sapling Global Operations" },
      {
        property: "og:description",
        content: "Allocate unassigned checks with current workload and SLA context.",
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

  useEffect(() => {
    if (!data) return;
    const available = new Set(data.items.map((item) => item.id));
    setSelected((current) => current.filter((id) => available.has(id)));
  }, [data]);

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : current.length < 50
          ? [...current, id]
          : current,
    );

  const submit = () => {
    if (!memberId || selected.length === 0) return;
    assign.mutate({ itemIds: selected, memberId }, { onSuccess: () => setSelected([]) });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignment workbench"
        description="Pick unassigned checks, then compare each verifier's open load, due work and overdue pressure before allocation."
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
          description="Choose up to 50 checks. The whole selection commits together, or none changes."
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
                    disabled={
                      assign.isPending || (!selected.includes(item.id) && selected.length >= 50)
                    }
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
