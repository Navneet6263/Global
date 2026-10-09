import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CirclePause, CirclePlay } from "lucide-react";
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
import { resumeCase, stopCase } from "@/lib/backend-api/workflow";
import { canStop } from "./flow-model";

/**
 * STOP on client instruction (with a reason) or resume to the same step.
 * The API checks that the actor is Operations or the case's RM, and audits both.
 */
export function StopResumeButton({
  item,
  size = "default",
  open: controlledOpen,
  onOpenChange,
}: {
  item: { id: string; caseNumber: string; status: string; version: number; candidateName: string };
  size?: "default" | "sm";
  /** Controlled from a menu: no trigger button is drawn, only the dialog. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const controlled = controlledOpen !== undefined;
  const open = controlled ? controlledOpen : ownOpen;
  const setOpen = (value: boolean) => (controlled ? onOpenChange?.(value) : setOwnOpen(value));
  const [text, setText] = useState("");
  const queryClient = useQueryClient();
  const stopped = item.status === "STOPPED";
  const mutation = useMutation({
    mutationFn: () =>
      stopped
        ? resumeCase(item.id, { version: item.version, note: text.trim() || undefined })
        : stopCase(item.id, { version: item.version, reason: text.trim() }),
    onSuccess: async () => {
      toast.success(stopped ? `${item.caseNumber} resumed` : `${item.caseNumber} stopped`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["case"] }),
        queryClient.invalidateQueries({ queryKey: ["cases"] }),
        queryClient.invalidateQueries({ queryKey: ["workflow"] }),
        queryClient.invalidateQueries({ queryKey: ["navigation-counts"] }),
      ]);
      setOpen(false);
      setText("");
    },
    onError: (error: Error) =>
      toast.error(stopped ? "Not resumed" : "Not stopped", { description: error.message }),
  });
  if (!stopped && !canStop(item.status)) return null;
  const invalid = stopped ? Boolean(text.trim()) && text.trim().length < 3 : text.trim().length < 3;
  return (
    <>
      {controlled ? null : (
        <Button
          size={size}
          variant="outline"
          className={stopped ? "flow-resume" : "flow-stop"}
          onClick={() => setOpen(true)}
        >
          {stopped ? <CirclePlay aria-hidden /> : <CirclePause aria-hidden />}
          {stopped ? "Resume" : "Stop"}
        </Button>
      )}
      {open ? (
        <Dialog
          open
          onOpenChange={(value) => (!value && !mutation.isPending ? setOpen(false) : undefined)}
        >
          <DialogContent className="ops-dialog sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle>{stopped ? "Resume verification" : "Stop verification"}</DialogTitle>
              <DialogDescription>
                {item.candidateName} · {item.caseNumber}
              </DialogDescription>
            </DialogHeader>
            <div className={`flow-callout ${stopped ? "is-info" : "is-warn"}`}>
              {stopped ? <CirclePlay aria-hidden /> : <CirclePause aria-hidden />}
              <span>
                {stopped
                  ? "The case returns to the step it was stopped at. The client and RM are notified."
                  : "Use only on the client's instruction. Work pauses, SLA counting stops and the client and RM are notified."}
              </span>
            </div>
            <label className="ops-field">
              <span>{stopped ? "Note (optional)" : "Client instruction / reason"}</span>
              <textarea
                rows={3}
                maxLength={1000}
                value={text}
                onChange={(event) => setText(event.target.value)}
                aria-invalid={invalid && Boolean(text)}
              />
            </label>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => mutation.mutate()}
                disabled={invalid}
                loading={mutation.isPending}
              >
                {stopped ? "Resume" : "Stop case"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}
