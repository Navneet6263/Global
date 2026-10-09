import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
import type { DirectoryUser } from "@/lib/backend-api/users";
import { assignCaseOwner, escalateCase } from "./ops-workspace-api";
import { eligibleRms, initials } from "./ops-queue-model";

export interface CaseTarget {
  id: string;
  caseNumber: string;
  candidate: string;
  clientId: string;
  clientName: string;
  version: number;
  ownerId?: string;
  ownerName?: string;
}

function useRefreshCase() {
  const queryClient = useQueryClient();
  return (caseId: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["cases"] }),
      queryClient.invalidateQueries({ queryKey: ["case", caseId] }),
      queryClient.invalidateQueries({ queryKey: ["case-activity", caseId] }),
      queryClient.invalidateQueries({ queryKey: ["navigation-counts"] }),
    ]);
}

function noteError(note: string) {
  const trimmed = note.trim();
  return trimmed && trimmed.length < 3
    ? "Write at least 3 characters, or leave the note empty."
    : "";
}

export function AssignRmDialog({
  target,
  users,
  loading,
  error,
  onClose,
}: {
  target: CaseTarget;
  users: readonly DirectoryUser[];
  loading: boolean;
  error?: string;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState("");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("");
  const refresh = useRefreshCase();
  const options = eligibleRms(users, target.clientId).filter((user) =>
    `${user.displayName} ${user.email}`.toLowerCase().includes(filter.trim().toLowerCase()),
  );
  const mutation = useMutation({
    mutationFn: () =>
      assignCaseOwner(target.id, {
        ownerId: selected,
        version: target.version,
        note: note.trim() || undefined,
      }),
    onSuccess: async (result) => {
      toast.success(
        `${result.owner.displayName} is now the responsible RM for ${target.caseNumber}`,
      );
      await refresh(target.id);
      onClose();
    },
    onError: (failure) =>
      toast.error("RM was not changed", {
        description: failure instanceof Error ? failure.message : "Refresh and try again.",
      }),
  });
  const invalidNote = noteError(note);
  const changing = Boolean(target.ownerId);
  return (
    <Dialog open onOpenChange={(open) => (!open && !mutation.isPending ? onClose() : undefined)}>
      <DialogContent className="ops-dialog sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{changing ? "Change responsible RM" : "Assign responsible RM"}</DialogTitle>
          <DialogDescription>
            {target.candidate} · {target.caseNumber} · {target.clientName}
          </DialogDescription>
        </DialogHeader>
        <p className="flow-callout is-info">
          <span>
            Tip: set a{" "}
            <Link to="/operations/clients" className="ops-link mt-0">
              company RM
            </Link>{" "}
            once, and every new case of {target.clientName} is assigned automatically.
          </span>
        </p>
        {changing ? (
          <p className="ops-dialog-note">
            Current RM: <strong>{target.ownerName}</strong>. Documents, work and history stay with
            the case.
          </p>
        ) : null}
        <label className="ops-field">
          <span>Find RM</span>
          <input
            type="search"
            value={filter}
            maxLength={80}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Name or email"
          />
        </label>
        <div className="ops-rm-list" role="radiogroup" aria-label="Eligible RMs">
          {loading ? <p className="ops-dialog-note">Loading RMs…</p> : null}
          {error ? <p className="ops-dialog-note is-error">{error}</p> : null}
          {!loading && !error && !options.length ? (
            <p className="ops-dialog-note">
              No active RM is linked to {target.clientName}. Link an RM to this client in user
              management first.
            </p>
          ) : null}
          {options.map((user) => {
            const current = user.id === target.ownerId;
            return (
              <label key={user.id} className={selected === user.id ? "is-selected" : undefined}>
                <input
                  type="radio"
                  name="rm"
                  value={user.id}
                  checked={selected === user.id}
                  disabled={current || mutation.isPending}
                  onChange={() => setSelected(user.id)}
                />
                <span className="ops-avatar" aria-hidden>
                  {initials(user.displayName)}
                </span>
                <span className="min-w-0 flex-1">
                  <strong>{user.displayName}</strong>
                  <small>
                    {user.email}
                    {user.branch ? ` · ${user.branch.name}` : ""}
                  </small>
                </span>
                {current ? <em>Current</em> : null}
              </label>
            );
          })}
        </div>
        <label className="ops-field">
          <span>Note for the audit trail (optional)</span>
          <textarea
            rows={2}
            maxLength={1000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Reason for this assignment"
            aria-invalid={Boolean(invalidNote)}
          />
          {invalidNote ? <small className="is-error">{invalidNote}</small> : null}
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!selected || Boolean(invalidNote)}
            loading={mutation.isPending}
          >
            {changing ? "Change RM" : "Assign RM"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EscalateDialog({
  target,
  onClose,
  internal = false,
}: {
  target: CaseTarget;
  onClose: () => void;
  /** Platform Admin oversight: Operations and the RM act; the client is not told. */
  internal?: boolean;
}) {
  const [note, setNote] = useState("");
  const refresh = useRefreshCase();
  const mutation = useMutation({
    mutationFn: () =>
      escalateCase(target.id, { version: target.version, note: note.trim() || undefined }),
    onSuccess: async () => {
      toast.success(`${target.caseNumber} escalated`);
      await refresh(target.id);
      onClose();
    },
    onError: (failure) =>
      toast.error("Case was not escalated", {
        description: failure instanceof Error ? failure.message : "Refresh and try again.",
      }),
  });
  const invalidNote = noteError(note);
  return (
    <Dialog open onOpenChange={(open) => (!open && !mutation.isPending ? onClose() : undefined)}>
      <DialogContent className="ops-dialog sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Escalate case</DialogTitle>
          <DialogDescription>
            {target.candidate} · {target.caseNumber} · {target.clientName}
          </DialogDescription>
        </DialogHeader>
        <p className="ops-dialog-note">
          {internal ? (
            <>
              The case becomes <strong>Urgent</strong> and moves to the top of the Operations queue.
              Operations and the RM are notified; the client is not.
            </>
          ) : (
            <>
              The case becomes <strong>Urgent</strong>, the client admins are notified and the
              escalation is recorded in the audit trail.
            </>
          )}
        </p>
        <label className="ops-field">
          <span>
            {internal
              ? "Why is this urgent? (shown to Operations)"
              : "Message to the client (optional)"}
          </span>
          <textarea
            rows={3}
            maxLength={1000}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What decision or action is needed"
            aria-invalid={Boolean(invalidNote)}
          />
          {invalidNote ? <small className="is-error">{invalidNote}</small> : null}
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={Boolean(invalidNote) || (internal && note.trim().length < 3)}
            loading={mutation.isPending}
          >
            Escalate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
