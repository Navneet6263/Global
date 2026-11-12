import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, Eye, Hand } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AssignMemberDialog } from "@/features/workflow-ui/TeamQueueDialogs";
import { readableCheck } from "@/features/workflow-ui/flow-model";
import type { VerificationTask } from "@/lib/api/tasks";
import { assignTeamTask, getTeamQueue } from "@/lib/backend-api/workflow";

const MOVABLE = ["UNASSIGNED", "OPEN", "BLOCKED"];

/**
 * Shown in My Checks when a Team Leader or Supervisor views a check claimed by
 * another member/TL of the same department (Option A shared read-only visibility).
 */
export function PeerTaskBanner({
  task,
  me,
  canManage,
  onUpdated,
}: {
  task: VerificationTask;
  me?: string;
  canManage: boolean;
  onUpdated: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const [reassigning, setReassigning] = useState(false);
  const ownerName = task.assignee?.name ?? "another team member";
  const movable = canManage && MOVABLE.includes(task.status);
  const departmentId = task.check.department?.id;

  const roster = useQuery({
    queryKey: ["workflow", "team-queue", "members", departmentId ?? "all"],
    queryFn: () => getTeamQueue({ departmentId, view: "all", page: 1, pageSize: 1 }),
    enabled: reassigning && Boolean(departmentId),
    staleTime: 30_000,
  });

  const takeover = useMutation({
    mutationFn: () => assignTeamTask(task.id, { assigneeId: me!, version: task.version }),
    onSuccess: async () => {
      toast.success(`Took over ${readableCheck(task.check.type)} check`, {
        description: `Ownership moved from ${ownerName} to you.`,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks", "mine"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks", task.id, "context"] }),
        queryClient.invalidateQueries({ queryKey: ["verifier", "insights"] }),
        queryClient.invalidateQueries({ queryKey: ["workflow"] }),
      ]);
      await onUpdated();
    },
    onError: (error: Error) => toast.error("Could not take over", { description: error.message }),
  });

  return (
    <>
      <div
        role="status"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-[12.5px] text-slate-800"
      >
        <div className="flex min-w-0 items-start gap-2.5">
          <Eye className="mt-0.5 size-4 shrink-0 text-blue-700" aria-hidden />
          <div>
            <p className="font-semibold text-slate-900">Claimed by {ownerName} · Read-only view</p>
            <p className="text-[12px] text-slate-600">
              {task.status === "IN_PROGRESS"
                ? `${ownerName} is actively verifying this check. Ownership stays with ${ownerName}.`
                : `Original ownership stays with ${ownerName} until reassigned or taken over.`}
            </p>
          </div>
        </div>
        {movable && me ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => takeover.mutate()}
              loading={takeover.isPending}
            >
              <Hand aria-hidden /> Take over
            </Button>
            {departmentId ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReassigning(true)}
                disabled={takeover.isPending}
              >
                <ArrowRightLeft aria-hidden /> Reassign
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      {reassigning && roster.data && task.check.department?.id ? (
        <AssignMemberDialog
          task={{
            id: task.id,
            version: task.version,
            assignee: task.assignee ?? null,
            check: {
              type: task.check.type,
              department: {
                id: task.check.department.id,
                name: task.check.department.name,
              },
            },
            case: {
              candidateName: task.check.case.subject.fullName,
              caseNumber: task.check.case.caseNumber,
            },
          }}
          members={roster.data.members}
          me={me}
          title="Reassign check"
          onClose={() => setReassigning(false)}
          onAssigned={onUpdated}
        />
      ) : null}
    </>
  );
}
