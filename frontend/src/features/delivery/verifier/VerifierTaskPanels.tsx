import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Ban, Play } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { forwardTask } from "@/lib/api/tasks";
import { PrimaryButton, SecondaryButton } from "./VerifierWorkspaceParts";

/** Opening card shown before a verifier starts work on an OPEN or UNASSIGNED check. */
export function StartVerificationCard({
  pending,
  starting,
  onStart,
  onBlock,
}: {
  pending: boolean;
  starting: boolean;
  onStart: () => void;
  onBlock: () => void;
}) {
  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-blue-50 p-4 shadow-sm">
      <p className="text-[12px] font-medium text-foreground">Ready to begin this source check?</p>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        Starting records ownership and opens a user-scoped working draft on this device.
      </p>
      <ol className="mt-3 grid gap-2 sm:grid-cols-4" aria-label="What happens next">
        {["Verified details", "Proof", "Outcome & summary", "Review & complete"].map(
          (label, index) => (
            <li
              key={label}
              className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-[12px] font-medium text-slate-700 ring-1 ring-slate-200"
            >
              <span className="grid size-5 shrink-0 place-items-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500">
                {index + 1}
              </span>
              {label}
            </li>
          ),
        )}
      </ol>
      <div className="mt-3 flex flex-wrap gap-2">
        <PrimaryButton disabled={pending} loading={starting} onClick={onStart}>
          <Play className="h-4 w-4" /> Start verification
        </PrimaryButton>
        <SecondaryButton onClick={onBlock}>
          <Ban className="h-4 w-4" /> Record blocker
        </SecondaryButton>
      </div>
    </div>
  );
}

/** Notice shown when verification is paused due to a recorded dependency blocker. */
export function BlockedTaskCard({
  blockerReason,
  pending,
  resuming,
  onResume,
}: {
  blockerReason: string | null | undefined;
  pending: boolean;
  resuming: boolean;
  onResume: () => void;
}) {
  return (
    <div className="mt-5 rounded-xl border border-critical/20 bg-critical-soft/70 p-4">
      <p className="flex items-center gap-2 text-[12px] font-semibold text-critical-foreground">
        <AlertTriangle className="h-4 w-4" /> Work is blocked
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        {blockerReason ?? "Dependency must be resolved before work resumes."}
      </p>
      <PrimaryButton onClick={onResume} disabled={pending} loading={resuming} extra="mt-3">
        <Play className="h-4 w-4" /> Resume work
      </PrimaryButton>
    </div>
  );
}

/** Team Leader finished its own check: one click sends it on to QA. */
export function ForwardToQaDialog({
  open,
  taskId,
  onDone,
}: {
  open: boolean;
  taskId: string;
  onDone: () => void;
}) {
  const forward = useMutation({
    mutationFn: () => forwardTask(taskId),
    onSuccess: (result) => {
      toast.success(
        result.caseToQa
          ? "Forwarded — the case is now with QA"
          : "Forwarded — the case goes to QA when its other checks are forwarded",
      );
      onDone();
    },
    onError: (error: Error) => toast.error("Not forwarded", { description: error.message }),
  });
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Forward this case to QA?</AlertDialogTitle>
          <AlertDialogDescription>
            Your check is complete. As Team Leader you can send it on to QA now. Choose “Not now” to
            review it later in Team queue → To review.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            disabled={forward.isPending}
            onClick={() => {
              toast.info("Waiting in Team queue → To review");
              onDone();
            }}
          >
            Not now
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={forward.isPending}
            onClick={(event) => {
              event.preventDefault();
              forward.mutate();
            }}
          >
            {forward.isPending ? "Forwarding…" : "OK, forward to QA"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
