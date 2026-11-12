import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, X } from "lucide-react";
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
import { cachedIdentity } from "@/lib/auth/platform-session";
import { listDepartments, type QueueCase } from "@/lib/backend-api/workflow";
import {
  bulkAssignDataEntry,
  type BulkAssignDataEntryResult,
} from "@/lib/backend-api/workflow-bulk";

const noteProblem = (note: string) =>
  note.trim() && note.trim().length < 3 ? "Write at least 3 characters." : "";

export function BulkAssignDataEntryDialog({
  items,
  onRemoveCase,
  onAssigned,
  onClose,
}: {
  items: QueueCase[];
  onRemoveCase: (caseId: string) => void;
  onAssigned: (assignedCaseIds: string[]) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const departments = useQuery({ queryKey: ["workflow", "departments"], queryFn: listDepartments });
  const [assigneeId, setAssigneeId] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<BulkAssignDataEntryResult | null>(null);

  const people = (departments.data?.items ?? [])
    .filter((department) => department.kind === "DATA_ENTRY" && department.status === "ACTIVE")
    .flatMap((department) => department.members.filter((member) => member.status === "ACTIVE"))
    .sort((a, b) => a.openWork - b.openWork);

  const me = cachedIdentity();
  const canDoMyself = Boolean(me?.roles.includes("DATA_ENTRY") && me.roles.includes("SPOC_RM"));
  const others = people.filter((person) => person.id !== me?.userId);
  const problem = noteProblem(note);

  const mutation = useMutation({
    mutationFn: () =>
      bulkAssignDataEntry({
        assigneeId,
        note: note.trim() || undefined,
        items: items.map((item) => ({ caseId: item.id, version: item.version })),
      }),
    onSuccess: async (res) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workflow"] }),
        queryClient.invalidateQueries({ queryKey: ["case"] }),
        queryClient.invalidateQueries({ queryKey: ["navigation-counts"] }),
      ]);
      if (res.assignedCount > 0) {
        onAssigned(res.assigned.map((entry) => entry.caseId));
      }
      if (res.failedCount === 0) {
        toast.success(
          res.assignee.id === me?.userId
            ? `${res.assignedCount} ${res.assignedCount === 1 ? "case" : "cases"} added to your Data Entry queue`
            : `${res.assignedCount} ${res.assignedCount === 1 ? "case" : "cases"} assigned to ${res.assignee.name}`,
          res.assignee.id === me?.userId
            ? { description: "Switch to “Working as: Data Entry” at the top to review them." }
            : undefined,
        );
        onClose();
        return;
      }
      setResult(res);
      if (res.assignedCount > 0) {
        toast.warning(
          `Assigned ${res.assignedCount} of ${res.assignedCount + res.failedCount} cases`,
          {
            description: `${res.failedCount} could not be assigned. See details in the dialog.`,
          },
        );
      } else {
        toast.error("Bulk assignment failed", {
          description: res.failed[0]?.reason ?? "None of the selected cases could be assigned.",
        });
      }
    },
    onError: (error: Error) =>
      toast.error("Bulk assignment failed", { description: error.message }),
  });

  return (
    <Dialog open onOpenChange={(open) => (!open && !mutation.isPending ? onClose() : undefined)}>
      <DialogContent className="ops-dialog sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Bulk Assign Data Entry</DialogTitle>
          <DialogDescription>
            {items.length} {items.length === 1 ? "case" : "cases"} selected for Data Entry review.
          </DialogDescription>
        </DialogHeader>

        {result && result.failedCount > 0 ? (
          <div
            className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950"
            role="alert"
          >
            <p className="flex items-center gap-1.5 font-semibold">
              <AlertCircle className="size-4 shrink-0 text-amber-700" aria-hidden />
              {result.assignedCount > 0
                ? `${result.assignedCount} assigned successfully, ${result.failedCount} failed:`
                : `${result.failedCount} ${result.failedCount === 1 ? "case" : "cases"} could not be assigned:`}
            </p>
            <ul className="mt-1.5 max-h-28 space-y-1 overflow-auto pl-5 list-disc">
              {result.failed.map((failure) => (
                <li key={failure.caseId}>
                  <strong>{failure.caseNumber ?? failure.caseId}</strong>: {failure.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-slate-700">Selected cases ({items.length})</p>
          <ul
            className="max-h-32 divide-y divide-slate-100 overflow-auto rounded-lg border border-slate-200 bg-slate-50/60"
            aria-label="Selected cases"
          >
            {items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs"
              >
                <span className="min-w-0 truncate">
                  <strong className="text-slate-900">{item.candidateName}</strong>{" "}
                  <span className="text-slate-500">
                    · {item.caseNumber} · {item.client.name}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={mutation.isPending || items.length <= 1}
                  onClick={() => onRemoveCase(item.id)}
                  aria-label={`Remove ${item.caseNumber} from selection`}
                  className="rounded p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 disabled:opacity-30"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="ops-rm-list" role="radiogroup" aria-label="Data Entry team">
          {departments.isPending ? (
            <p className="ops-dialog-note">Loading Data Entry team…</p>
          ) : null}
          {departments.isError ? (
            <p className="ops-dialog-note is-error">{departments.error.message}</p>
          ) : null}
          {canDoMyself && me ? (
            <label className={assigneeId === me.userId ? "is-selected" : undefined}>
              <input
                type="radio"
                name="bulk-data-entry"
                value={me.userId}
                checked={assigneeId === me.userId}
                disabled={mutation.isPending}
                onChange={() => setAssigneeId(me.userId)}
              />
              <span className="min-w-0 flex-1">
                <strong>Me ({me.fullName}) · I’ll do the data entry</strong>
                <small>Then switch to “Working as: Data Entry” at the top.</small>
              </span>
            </label>
          ) : null}
          {departments.data && !others.length && !canDoMyself ? (
            <p className="ops-dialog-note">
              The Data Entry team has no members yet. Ask Operations to add them in Departments &
              teams.
            </p>
          ) : null}
          {others.map((person) => (
            <label key={person.id} className={assigneeId === person.id ? "is-selected" : undefined}>
              <input
                type="radio"
                name="bulk-data-entry"
                value={person.id}
                checked={assigneeId === person.id}
                disabled={mutation.isPending}
                onChange={() => setAssigneeId(person.id)}
              />
              <span className="min-w-0 flex-1">
                <strong>
                  {person.displayName}
                  {person.role === "LEAD" ? " · TL" : ""}
                </strong>
                <small>
                  {person.openWork} open intake · {person.email}
                </small>
              </span>
            </label>
          ))}
        </div>

        <label className="ops-field">
          <span>Note for Data Entry (optional)</span>
          <textarea
            rows={2}
            maxLength={1000}
            value={note}
            disabled={mutation.isPending}
            onChange={(e) => setNote(e.target.value)}
            aria-invalid={Boolean(problem)}
          />
          {problem ? <small className="is-error">{problem}</small> : null}
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            {result?.failedCount ? "Close" : "Cancel"}
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!assigneeId || !items.length || Boolean(problem)}
            loading={mutation.isPending}
          >
            Assign {items.length} {items.length === 1 ? "case" : "cases"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
