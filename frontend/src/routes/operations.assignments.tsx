import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ClipboardCheck, UserCheck } from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AssignmentSelectionPanel } from "@/features/operations/components/assignment-selection-panel";
import { OpsCapacityList } from "@/features/operations/components/ops-capacity-list";
import { useAssignChecks, useOpsAssignments } from "@/features/operations/hooks/use-operations";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/operations/assignments")({
  head: () => ({
    meta: [
      { title: "Assignment Workbench — Sapling Global Operations" },
      {
        name: "description",
        content: "Allocate unassigned checks with current verifier workload and SLA context.",
      },
    ],
  }),
  component: AssignmentsPage,
});

function AssignmentsPage() {
  const { data, isPending, isError, isFetching, refetch } = useOpsAssignments();
  const assign = useAssignChecks();
  const [selected, setSelected] = useState<string[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");

  useEffect(() => {
    if (!data) return;
    const available = new Set(data.items.map((item) => item.id));
    setSelected((current) => current.filter((id) => available.has(id)));
    if (memberId && !data.members.some((member) => member.id === memberId)) setMemberId(null);
  }, [data, memberId]);

  const recommendedId = useMemo(() => {
    const members = [...(data?.members ?? [])];
    members.sort(
      (left, right) =>
        left.overdue * 1_000 +
        left.dueToday * 50 +
        left.activeChecks -
        (right.overdue * 1_000 + right.dueToday * 50 + right.activeChecks),
    );
    return members[0]?.id ?? null;
  }, [data?.members]);

  const selectedMember = data?.members.find((member) => member.id === memberId);
  const canSubmit = selected.length > 0 && Boolean(selectedMember) && !assign.isPending;

  const submit = () => {
    if (!selectedMember || selected.length === 0) return;
    assign.mutate(
      {
        itemIds: selected,
        memberId: selectedMember.id,
        note: instructions.trim() || undefined,
      },
      {
        onSuccess: () => {
          setSelected([]);
          setMemberId(null);
          setInstructions("");
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignment workbench"
        description="Select checks, compare verifier capacity and review the complete allocation before committing it."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <WorkflowStep
          icon={Check}
          label="Select checks"
          value={selected.length > 0 ? `${selected.length} ready` : "Awaiting selection"}
          complete={selected.length > 0}
        />
        <WorkflowStep
          icon={UserCheck}
          label="Choose verifier"
          value={selectedMember?.name ?? "No verifier selected"}
          complete={Boolean(selectedMember)}
        />
        <WorkflowStep
          icon={ClipboardCheck}
          label="Review & assign"
          value={canSubmit ? "Ready to commit" : "Complete the first two steps"}
          complete={canSubmit}
        />
      </div>

      {isError ? <ErrorState onRetry={() => void refetch()} retrying={isFetching} /> : null}

      {isPending ? (
        <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
          <Section title="1. Select checks">
            <ListSkeleton rows={8} />
          </Section>
          <Section title="2. Choose verifier">
            <ListSkeleton rows={6} />
          </Section>
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[1.35fr_1fr]">
          <AssignmentSelectionPanel
            items={data?.items ?? []}
            selectedIds={selected}
            disabled={assign.isPending}
            onSelectionChange={setSelected}
          />
          <div className="space-y-4 xl:sticky xl:top-24">
            <OpsCapacityList
              members={data?.members ?? []}
              selectedId={memberId}
              recommendedId={recommendedId}
              onSelect={setMemberId}
            />
            <Section
              title="3. Review & assign"
              description="Nothing is allocated until you confirm this summary."
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/25 p-4">
                  <ReviewValue
                    label="Checks"
                    value={selected.length ? String(selected.length) : "—"}
                  />
                  <ReviewValue label="Verifier" value={selectedMember?.name ?? "—"} />
                </div>
                <label className="block space-y-2">
                  <span className="text-xs font-medium text-foreground">
                    Assignment instructions
                  </span>
                  <Textarea
                    value={instructions}
                    onChange={(event) => setInstructions(event.target.value)}
                    maxLength={500}
                    placeholder="Optional source, priority or handling notes for the verifier"
                    className="min-h-20 rounded-xl bg-background"
                  />
                </label>
                <Button
                  className="h-11 w-full"
                  disabled={!canSubmit}
                  loading={assign.isPending}
                  onClick={submit}
                >
                  {assign.isPending
                    ? "Assigning securely…"
                    : selectedMember && selected.length > 0
                      ? `Assign ${selected.length} checks to ${selectedMember.name}`
                      : "Select checks and a verifier"}
                </Button>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  The allocation is transactional: every selected check is assigned together or no
                  check changes. The action is recorded in the audit trail with your name and time.
                </p>
              </div>
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkflowStep({
  icon: Icon,
  label,
  value,
  complete,
}: {
  icon: typeof Check;
  label: string;
  value: string;
  complete: boolean;
}) {
  return (
    <div className="surface flex items-center gap-3 p-4">
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          complete ? "bg-mint text-forest" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-foreground">{label}</p>
        <p className="truncate text-[11px] text-muted-foreground">{value}</p>
      </div>
    </div>
  );
}

function ReviewValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
