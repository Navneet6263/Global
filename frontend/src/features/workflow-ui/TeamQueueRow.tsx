import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, Hand, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, Pill, Tag } from "@/components/workspace/kit";
import { assignTeamTask, type TeamTask } from "@/lib/backend-api/workflow";
import { dueLabel, readableCheck, sinceLabel } from "./flow-model";

const REASSIGNABLE = ["UNASSIGNED", "OPEN", "BLOCKED"];

export function TeamQueueRow({
  task,
  me,
  canTake,
  departmentId,
  onAssign,
  onReview,
}: {
  task: TeamTask;
  me?: string;
  canTake: boolean;
  departmentId?: string;
  onAssign: () => void;
  onReview: () => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const due = dueLabel(task.dueAt);
  const mine = Boolean(me && task.assignee?.id === me);
  const movable = REASSIGNABLE.includes(task.status);
  const targetDepartment = departmentId ?? task.check.department?.id;
  const take = useMutation({
    mutationFn: () => assignTeamTask(task.id, { assigneeId: me!, version: task.version }),
    onSuccess: async () => {
      toast.success(`${readableCheck(task.check.type)} check is yours`, {
        description: "It is now in your Active queue.",
        action: {
          label: "Open",
          onClick: () =>
            void navigate({
              to: "/verifier/queue",
              search: {
                taskId: task.id,
                status: undefined,
                ...(targetDepartment ? { department: targetDepartment } : {}),
              },
            }),
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workflow"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks", "mine"] }),
        queryClient.invalidateQueries({ queryKey: ["verifier", "insights"] }),
      ]);
    },
    onError: (error: Error) => toast.error("Not taken", { description: error.message }),
  });

  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 transition hover:bg-slate-50 xl:grid-cols-[minmax(0,1fr)_170px_110px_200px]">
      <div className="flex min-w-0 items-start gap-3">
        <Avatar name={task.case.candidateName} tone={task.status === "BLOCKED" ? "warn" : "info"} />
        <div className="min-w-0 flex-1">
          <strong className="block truncate text-[13.5px] font-semibold text-slate-900">
            {task.case.candidateName}
          </strong>
          <small className="block truncate text-[11.5px] text-slate-500">
            {task.case.clientName} ·{" "}
            <span className="font-mono text-slate-600">{task.case.caseNumber}</span>
          </small>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1">
            <Pill tone="info">{readableCheck(task.check.type)}</Pill>
            {task.check.department ? (
              <Tag icon={ListChecks}>{task.check.department.name}</Tag>
            ) : null}
            {task.status === "BLOCKED" ? <Pill tone="warn">Blocked</Pill> : null}
          </div>
          {task.blockerReason ? (
            <p className="mt-1 truncate text-[11.5px] text-amber-700">{task.blockerReason}</p>
          ) : null}
        </div>
      </div>
      <div className="hidden min-w-0 items-center gap-2 xl:flex">
        {task.assignee ? (
          <>
            <Avatar name={task.assignee.name} size="sm" tone="neutral" />
            <span className="min-w-0">
              <span className="block truncate text-[12.5px] font-medium text-slate-700">
                {mine ? "You" : task.assignee.name}
              </span>
              <small className="block truncate text-[11px] text-slate-400">
                routed {sinceLabel(task.check.routedAt)} ago
              </small>
            </span>
          </>
        ) : (
          <span className="min-w-0">
            <span className="block text-[12.5px] font-medium text-slate-400">Unassigned</span>
            <small className="block truncate text-[11px] text-slate-400">
              routed {sinceLabel(task.check.routedAt)} ago
            </small>
          </span>
        )}
      </div>
      <Pill
        tone={due.tone}
        className="col-start-2 row-start-1 self-start justify-self-end xl:col-start-auto xl:row-start-auto xl:self-center xl:justify-self-start"
      >
        {due.text}
      </Pill>
      <div className="col-span-2 flex flex-wrap justify-end gap-2 xl:col-span-1">
        {task.review ? (
          <Button size="sm" onClick={onReview}>
            <ClipboardCheck aria-hidden /> Review
          </Button>
        ) : null}
        {task.review ? null : mine ? (
          <Button size="sm" asChild>
            <Link
              to="/verifier/queue"
              search={{
                taskId: task.id,
                status: undefined,
                ...(targetDepartment ? { department: targetDepartment } : {}),
              }}
            >
              Open
            </Link>
          </Button>
        ) : null}
        {!task.review && movable && canTake && !mine ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => take.mutate()}
            loading={take.isPending}
            aria-label={`Take ${readableCheck(task.check.type)} check for ${task.case.candidateName}`}
          >
            <Hand aria-hidden /> Take it
          </Button>
        ) : null}
        {task.review ? null : movable ? (
          <Button size="sm" variant={task.assignee ? "outline" : "default"} onClick={onAssign}>
            {task.assignee ? "Reassign" : "Assign"}
          </Button>
        ) : !mine ? (
          <Pill tone="good">In progress</Pill>
        ) : null}
      </div>
    </li>
  );
}
