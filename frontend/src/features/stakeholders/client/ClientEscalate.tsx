import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Siren } from "lucide-react";
import { toast } from "sonner";
import { Button, Textarea } from "@/kit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { escalateCaseAsClient, type CaseDetail } from "@/lib/api/cases";

const CLOSED = ["COMPLETED", "CLOSED", "CANCELLED"];

/** Escalate a delayed case to its RM; once escalated it shows the state instead. */
export function ClientEscalate({ item }: { item: CaseDetail }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const queryClient = useQueryClient();
  const escalate = useMutation({
    mutationFn: () =>
      escalateCaseAsClient(item.id, { version: item.version, reason: reason.trim() }),
    onSuccess: async () => {
      toast.success("Case escalated", {
        description: "Your RM has been told and will handle it on priority.",
      });
      setOpen(false);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
    },
    onError: (error: Error) => toast.error("Not escalated", { description: error.message }),
  });
  if (item.clientEscalation)
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-bad-soft px-3 py-1 text-xs font-semibold text-bad"
        title={item.clientEscalation.reason}
      >
        <Siren className="size-3.5" aria-hidden /> Escalated · RM handling on priority
      </span>
    );
  if (CLOSED.includes(item.status)) return null;
  const valid = reason.trim().length >= 10;
  return (
    <>
      <Button
        size="sm"
        className="border-bad/30 text-bad hover:bg-bad-soft"
        onClick={() => setOpen(true)}
      >
        <Siren aria-hidden /> Escalate
      </Button>
      {open ? (
        <Dialog
          open
          onOpenChange={(value) => (!value && !escalate.isPending ? setOpen(false) : undefined)}
        >
          <DialogContent className="sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle>Escalate this case</DialogTitle>
              <DialogDescription>
                {item.subject.fullName} · {item.caseNumber}. Your RM and Sapling Operations are told
                at once and the case moves to high priority.
              </DialogDescription>
            </DialogHeader>
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-ink">Why is this urgent?</span>
              <Textarea
                rows={3}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. The candidate joins on Monday and we need the report by Friday."
              />
              <small className="text-xs text-dim">At least 10 characters.</small>
            </label>
            <DialogFooter>
              <Button onClick={() => setOpen(false)} disabled={escalate.isPending}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="border-bad bg-bad"
                disabled={!valid}
                loading={escalate.isPending}
                onClick={() => escalate.mutate()}
              >
                Escalate case
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
