import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { VendorDecision } from "./vendor-contracts";
import { decisionProblem, REASON_MAX } from "./vendor-request-model";

/** Approve (optional remark) or reject (mandatory reason) one assigned document. */
export function VendorDecisionDialog({
  decision,
  documentLabel,
  busy,
  onClose,
  onConfirm,
}: {
  decision: VendorDecision | null;
  documentLabel: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const reject = decision === "REJECTED";
  const problem = decision ? decisionProblem(decision, reason) : null;

  useEffect(() => {
    if (!decision) setReason("");
  }, [decision]);

  return (
    <Dialog open={decision !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{reject ? "Reject document" : "Approve document"}</DialogTitle>
          <DialogDescription>
            {documentLabel}. The SPOC-RM team is notified of your decision.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (decision && !problem) onConfirm(reason.trim());
          }}
        >
          <div>
            <Label className="mb-1.5 block text-xs">
              {reject ? "Rejection reason (required)" : "Remark (optional)"}
            </Label>
            <Textarea
              autoFocus
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              maxLength={REASON_MAX}
              rows={4}
              placeholder={
                reject
                  ? "Explain what is wrong so the SPOC-RM can get it fixed"
                  : "Anything the SPOC-RM should know"
              }
            />
            {reject && reason && problem ? (
              <p className="mt-1 text-[11px] text-critical-foreground">{problem}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={reject ? "destructive" : "default"}
              disabled={Boolean(problem) || busy}
              loading={busy}
            >
              {reject ? "Reject" : "Approve"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
