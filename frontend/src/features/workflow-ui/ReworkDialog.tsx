import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { reworkCheck, type ReworkMode } from "@/lib/backend-api/rework";

const COPY: Record<ReworkMode, { title: string; description: string; action: string }> = {
  REOPEN: {
    title: "Re-open this check",
    description: "It goes back to the same verifier with your note. The case stays in progress.",
    action: "Re-open check",
  },
  REINITIATE: {
    title: "Re-initiate this check",
    description:
      "It goes back to the allocation pool so a new verifier can pick it up with fresh details.",
    action: "Re-initiate check",
  },
  REJECT: {
    title: "Send back to the verifier",
    description: "The finished check is re-opened for the same verifier with your reason.",
    action: "Send back",
  },
};

export type ReworkTarget = {
  checkId: string;
  label: string;
  mode: ReworkMode;
};

/** Reason dialog for UTV re-open / re-initiate and Team Leader send-back. Audited. */
export function ReworkDialog({
  target,
  onClose,
  onDone,
}: {
  target: ReworkTarget | null;
  onClose: () => void;
  onDone: () => Promise<unknown>;
}) {
  const [reason, setReason] = useState("");
  const copy = target ? COPY[target.mode] : COPY.REOPEN;
  const send = useMutation({
    mutationFn: () => reworkCheck(target!.checkId, target!.mode, reason.trim()),
    onSuccess: async (result) => {
      toast.success(copy.action === "Send back" ? "Sent back" : "Done", {
        description: result.assigned
          ? "The verifier has it in their queue again."
          : "It is waiting in the allocation pool.",
      });
      setReason("");
      onClose();
      await onDone();
    },
    onError: (error: Error) => toast.error("Not changed", { description: error.message }),
  });
  return (
    <Dialog open={Boolean(target)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            {target?.label}. {copy.description}
          </DialogDescription>
        </DialogHeader>
        <label className="ops-field">
          <span>Reason *</span>
          <textarea
            rows={4}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="What changed or what should be done differently (at least 10 characters)"
            aria-label="Rework reason"
          />
          <small className="text-slate-500">Recorded in the audit trail.</small>
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={reason.trim().length < 10}
            loading={send.isPending}
            onClick={() => send.mutate()}
          >
            {copy.action}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
