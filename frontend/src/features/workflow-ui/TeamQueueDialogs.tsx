import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, Pill, Tag } from "@/components/workspace/kit";
import { humanizeCode, istText } from "@/components/workspace/format";
import { cn } from "@/lib/utils";
import { forwardTask, sendBackTask } from "@/lib/api/tasks";
import { assignTeamTask, type TeamQueue, type TeamTask } from "@/lib/backend-api/workflow";
import { ReportPreviewButton } from "./ReportPreview";
import { readableCheck } from "./flow-model";

const RESULT_TONE: Record<string, "good" | "warn" | "bad"> = {
  CLEAR: "good",
  DISCREPANCY: "warn",
  UNABLE_TO_VERIFY: "bad",
};

export function AssignMemberDialog({
  task,
  members,
  me,
  title,
  onClose,
  onAssigned,
}: {
  task: {
    id: string;
    version: number;
    assignee: { id: string; name: string } | null;
    check: { type: string; department: { id: string; name: string } | null };
    case: { candidateName: string; caseNumber: string };
  };
  members: TeamQueue["members"];
  me?: string;
  title?: string;
  onClose: () => void;
  onAssigned?: () => Promise<void>;
}) {
  const [assigneeId, setAssigneeId] = useState("");
  const [note, setNote] = useState("");
  const queryClient = useQueryClient();
  const options = members
    .filter((member) => member.department.id === task.check.department?.id)
    .sort((a, b) => a.openWork - b.openWork);
  const lightest = options.find((member) => member.id !== task.assignee?.id)?.id;
  const mutation = useMutation({
    mutationFn: () =>
      assignTeamTask(task.id, {
        assigneeId,
        version: task.version,
        note: note.trim() || undefined,
      }),
    onSuccess: async () => {
      toast.success(`${readableCheck(task.check.type)} check assigned`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workflow"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks", "mine"] }),
        queryClient.invalidateQueries({ queryKey: ["verifier", "insights"] }),
      ]);
      if (onAssigned) await onAssigned();
      onClose();
    },
    onError: (error: Error) => toast.error("Not assigned", { description: error.message }),
  });
  const noteProblem = note.trim() && note.trim().length < 3;
  return (
    <Dialog open onOpenChange={(open) => (!open && !mutation.isPending ? onClose() : undefined)}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>{title ?? (task.assignee ? "Reassign check" : "Assign check")}</DialogTitle>
          <DialogDescription>
            {readableCheck(task.check.type)} · {task.case.candidateName} · {task.case.caseNumber}
          </DialogDescription>
        </DialogHeader>
        <div
          role="radiogroup"
          aria-label="Team members"
          className="grid max-h-80 gap-2 overflow-y-auto"
        >
          {options.map((member) => {
            const current = member.id === task.assignee?.id;
            const picked = assigneeId === member.id;
            return (
              <label
                key={member.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition",
                  picked
                    ? "border-blue-400 bg-blue-50 ring-2 ring-blue-500/20"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                  current && "cursor-not-allowed opacity-60",
                )}
              >
                <input
                  type="radio"
                  name="member"
                  className="sr-only"
                  value={member.id}
                  checked={picked}
                  disabled={current || mutation.isPending}
                  onChange={() => setAssigneeId(member.id)}
                />
                <Avatar name={member.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-[13.5px] text-slate-900">
                    {member.name}
                    {member.id === me ? " (you)" : ""}
                    {member.role === "LEAD" ? " · TL" : ""}
                  </strong>
                  <small className="text-[12px] text-slate-500">
                    {member.openWork} open check{member.openWork === 1 ? "" : "s"}
                  </small>
                </span>
                {current ? (
                  <Pill tone="neutral" dot={false}>
                    Current
                  </Pill>
                ) : member.id === lightest ? (
                  <Pill tone="good" dot={false}>
                    Least busy
                  </Pill>
                ) : null}
              </label>
            );
          })}
          {!options.length ? (
            <p className="text-[13px] text-slate-500">This department has no members yet.</p>
          ) : null}
        </div>
        <label className="grid gap-1 text-[13px]">
          <span className="font-medium text-slate-700">Instructions (optional)</span>
          <textarea
            rows={2}
            maxLength={1000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-invalid={Boolean(noteProblem)}
            className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
          />
          {noteProblem ? (
            <small className="text-red-600">Write at least 3 characters.</small>
          ) : null}
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!assigneeId || Boolean(noteProblem)}
            loading={mutation.isPending}
          >
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Team Leader reviews a member's finished check: forward to QA or send back. */
export function ReviewDialog({ task, onClose }: { task: TeamTask; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const review = task.review!;
  const done = async (message: string) => {
    toast.success(message);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["workflow"] }),
      queryClient.invalidateQueries({ queryKey: ["tasks", "mine"] }),
      queryClient.invalidateQueries({ queryKey: ["verifier", "insights"] }),
    ]);
    onClose();
  };
  const forward = useMutation({
    mutationFn: () => forwardTask(task.id, note.trim() || undefined),
    onSuccess: (result) =>
      done(
        result.caseToQa
          ? "Forwarded — the case is now with QA"
          : "Forwarded — the case goes to QA when its other checks are forwarded",
      ),
    onError: (error: Error) => toast.error("Not forwarded", { description: error.message }),
  });
  const sendBack = useMutation({
    mutationFn: () => sendBackTask(task.id, note.trim()),
    onSuccess: () => done(`Sent back to ${task.assignee?.name ?? "the verifier"}`),
    onError: (error: Error) => toast.error("Not sent back", { description: error.message }),
  });
  const busy = forward.isPending || sendBack.isPending;
  return (
    <Dialog open onOpenChange={(open) => (!open && !busy ? onClose() : undefined)}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>Review {readableCheck(task.check.type)} check</DialogTitle>
          <DialogDescription>
            {task.case.candidateName} · {task.case.caseNumber} · done by{" "}
            {task.assignee?.name ?? "—"}
            {review.completedAt ? ` · ${istText(review.completedAt)}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 text-[13px]">
          <ReportPreviewButton
            caseId={task.case.id}
            caseNumber={task.case.caseNumber}
            candidateName={task.case.candidateName}
            audiences={["internal"]}
            label="See it in the report"
            className="w-fit"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={RESULT_TONE[review.result ?? ""] ?? "neutral"}>
              {humanizeCode(review.result) || "No result"}
            </Pill>
            {review.disposition ? <Tag>{humanizeCode(review.disposition)}</Tag> : null}
            {review.riskLevel ? (
              <Tag>Risk {humanizeCode(review.riskLevel).toLowerCase()}</Tag>
            ) : null}
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-500">
              Source summary
            </p>
            <p className="mt-1 whitespace-pre-wrap text-slate-800">{review.sourceSummary || "—"}</p>
          </div>
          {review.findings.length ? (
            <ul className="grid gap-1.5">
              {review.findings.map((finding, index) => (
                <li
                  key={index}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"
                >
                  <Pill
                    tone={
                      finding.severity === "HIGH" || finding.severity === "CRITICAL"
                        ? "bad"
                        : "warn"
                    }
                    dot={false}
                  >
                    {humanizeCode(finding.severity)}
                  </Pill>
                  <span className="text-slate-800">{finding.title}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <label className="grid gap-1">
            <span className="font-medium text-slate-700">Note (required to send back)</span>
            <textarea
              rows={2}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              aria-label="Review note"
              placeholder="e.g. Add the HR email as the source before forwarding"
              className="rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />
          </label>
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            disabled={busy || note.trim().length < 10}
            loading={sendBack.isPending}
            onClick={() => sendBack.mutate()}
          >
            Send back
          </Button>
          <Button disabled={busy} loading={forward.isPending} onClick={() => forward.mutate()}>
            Forward to QA
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
