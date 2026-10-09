import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Ban, CheckCircle2, Loader2, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { forwardTask, updateTask, type FindingInput, type VerificationTask } from "@/lib/api/tasks";
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
import {
  ALLOWED_BY_RESULT,
  colourClass,
  dispositionMeta,
  type Disposition,
} from "@/features/workflow-ui/colour-codes";
import { cachedIdentity } from "@/lib/auth/platform-session";
import { formatDate, humanize } from "../utils";
import { FindingEditor } from "./FindingEditor";
import { Status } from "./VerifierQueue";
import {
  loadVerifierDraft,
  removeVerifierDraft,
  saveVerifierDraft,
  type VerifierResult,
} from "./verifier-draft";
import {
  BlockerEditor,
  CompletedTask,
  PrimaryButton,
  SecondaryButton,
  WorkspaceInfo,
  WorkspaceNotice,
} from "./VerifierWorkspaceParts";

export function VerifierTaskWorkspace({
  task,
  onUpdated,
}: {
  task: VerificationTask;
  onUpdated: () => Promise<void>;
}) {
  const draftKey = `verifier-draft:${task.id}`;
  const deviceDataScope = cachedIdentity()?.deviceDataScope;
  const [result, setResult] = useState<VerifierResult>("CLEAR");
  const [disposition, setDisposition] = useState<Disposition | null>(null);
  const colourOptions = ALLOWED_BY_RESULT[result] ?? [];
  const chosenColour =
    disposition && colourOptions.includes(disposition) ? disposition : (colourOptions[0] ?? null);
  const [sourceSummary, setSourceSummary] = useState("");
  const [findings, setFindings] = useState<FindingInput[]>([]);
  const [draftReady, setDraftReady] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [showBlock, setShowBlock] = useState(false);
  useEffect(() => {
    if (!deviceDataScope) {
      setDraftReady(true);
      return;
    }
    let active = true;
    void loadVerifierDraft(deviceDataScope, draftKey)
      .then((stored) => {
        if (!active || !stored) return;
        setResult(stored.result);
        setSourceSummary(stored.sourceSummary);
        setFindings(stored.findings);
      })
      .finally(() => {
        if (active) setDraftReady(true);
      });
    return () => {
      active = false;
    };
  }, [deviceDataScope, draftKey]);
  useEffect(() => {
    if (!deviceDataScope || !draftReady || task.status !== "IN_PROGRESS") return;
    const timer = window.setTimeout(() => {
      void saveVerifierDraft(deviceDataScope, {
        key: draftKey,
        result,
        sourceSummary,
        findings,
        savedAt: new Date().toISOString(),
      }).catch(() => toast.error("Secure working draft could not be saved"));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [deviceDataScope, draftKey, draftReady, findings, result, sourceSummary, task.status]);
  const [forwardPrompt, setForwardPrompt] = useState(false);
  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof updateTask>[1]) => updateTask(task.id, input),
    onSuccess: (saved, input) => {
      if (input.status === "COMPLETED" && deviceDataScope) {
        void removeVerifierDraft(deviceDataScope, draftKey);
      }
      if (input.status === "COMPLETED" && saved.canForward) {
        // The Team Leader's own check: ask before it goes on to QA (refresh afterwards).
        setForwardPrompt(true);
        return;
      }
      toast.success(
        input.status === "COMPLETED"
          ? saved.tlReview
            ? "Check completed — sent to your Team Leader for review"
            : "Check completed and sent forward"
          : input.status === "BLOCKED"
            ? "Blocker recorded"
            : "Verification started",
      );
      void onUpdated();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const findingsValid = findings.every(
    (item) =>
      item.title.trim().length >= 3 &&
      item.description.trim().length >= 3 &&
      (!item.source || item.source.trim().length >= 3),
  );
  const ready =
    sourceSummary.trim().length >= 3 &&
    findingsValid &&
    (result !== "DISCREPANCY" || findings.length > 0);
  const complete = () =>
    mutation.mutate({
      status: "COMPLETED",
      version: task.version,
      result,
      ...(chosenColour ? { disposition: chosenColour } : {}),
      sourceSummary: sourceSummary.trim(),
      findings: findings.map((item) => {
        const source = item.source?.trim();
        return {
          ...item,
          title: item.title.trim(),
          description: item.description.trim(),
          ...(source ? { source } : {}),
        };
      }),
    });
  return (
    <>
      <ForwardToQaDialog
        open={forwardPrompt}
        taskId={task.id}
        onDone={() => {
          setForwardPrompt(false);
          void onUpdated();
        }}
      />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {humanize(task.check.type)} verification
            </h2>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              Priority {humanize(task.check.case.priority).toLowerCase()} · version {task.version}
            </p>
          </div>
          <Status status={task.status} />
        </header>
        {task.instructions ? (
          <WorkspaceNotice title="Assignment instructions" detail={task.instructions} />
        ) : null}
        {["OPEN", "UNASSIGNED"].includes(task.status) ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-blue-50 p-4 shadow-sm">
            <p className="text-[12px] font-medium text-foreground">
              Ready to begin this source check?
            </p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Starting records ownership and opens a user-scoped working draft on this device.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <PrimaryButton
                disabled={mutation.isPending}
                loading={mutation.isPending && mutation.variables?.status === "IN_PROGRESS"}
                onClick={() =>
                  mutation.mutate({ status: "IN_PROGRESS", version: task.version, findings: [] })
                }
              >
                <Play className="h-4 w-4" /> Start verification
              </PrimaryButton>
              <SecondaryButton onClick={() => setShowBlock(true)}>
                <Ban className="h-4 w-4" /> Record blocker
              </SecondaryButton>
            </div>
          </div>
        ) : null}
        {task.status === "IN_PROGRESS" ? (
          <form
            className="mt-5 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (ready) complete();
            }}
          >
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[12px] font-semibold">Verification outcome</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Choose the defensible result supported by your source record.
                  </p>
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                  Required
                </span>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                {(["CLEAR", "DISCREPANCY", "UNABLE_TO_VERIFY"] as VerifierResult[]).map((value) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => {
                      setResult(value);
                      setDisposition(null);
                    }}
                    aria-pressed={result === value}
                    className={`rounded-xl border px-3 py-3 text-[12.5px] font-medium transition ${result === value ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-border bg-white text-muted-foreground hover:border-blue-200 hover:bg-blue-50"}`}
                  >
                    {humanize(value)}
                  </button>
                ))}
              </div>
              <div className="mt-3" role="radiogroup" aria-label="Outcome">
                <p className="text-[12.5px] font-semibold">Outcome for the report</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {colourOptions.map((value) => (
                    <button
                      type="button"
                      role="radio"
                      key={value}
                      aria-checked={chosenColour === value}
                      onClick={() => setDisposition(value)}
                      className={`colour-option ${colourClass(value)} ${chosenColour === value ? "is-selected" : ""}`}
                    >
                      <i aria-hidden />
                      {dispositionMeta[value].label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
            <label className="block rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[12.5px] font-semibold shadow-sm">
              Source summary
              <textarea
                value={sourceSummary}
                onChange={(event) => setSourceSummary(event.target.value)}
                rows={4}
                placeholder="Source, verification method, dates and response received"
                className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-3 text-[12px] leading-relaxed outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              />
            </label>
            <FindingEditor value={findings} onChange={setFindings} />
            <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <PrimaryButton
                disabled={!ready || mutation.isPending}
                loading={mutation.isPending && mutation.variables?.status === "COMPLETED"}
                type="submit"
              >
                {mutation.isPending && mutation.variables?.status === "COMPLETED" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}{" "}
                Complete check
              </PrimaryButton>
              <SecondaryButton disabled={mutation.isPending} onClick={() => setShowBlock(true)}>
                <Ban className="h-4 w-4" /> Block
              </SecondaryButton>
              <span className="ml-auto text-[11.5px] text-muted-foreground">
                Draft scoped to your signed-in user on this device
              </span>
            </div>
          </form>
        ) : null}
        {showBlock && task.status !== "COMPLETED" ? (
          <BlockerEditor
            value={blockReason}
            busy={mutation.isPending}
            loading={mutation.isPending && mutation.variables?.status === "BLOCKED"}
            onChange={setBlockReason}
            onClose={() => setShowBlock(false)}
            onSave={() =>
              mutation.mutate({
                status: "BLOCKED",
                version: task.version,
                sourceSummary: blockReason.trim(),
                findings: [],
              })
            }
          />
        ) : null}
        {task.status === "BLOCKED" ? (
          <div className="mt-5 rounded-xl border border-critical/20 bg-critical-soft/70 p-4">
            <p className="flex items-center gap-2 text-[12px] font-semibold text-critical-foreground">
              <AlertTriangle className="h-4 w-4" /> Work is blocked
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
              {task.blockerReason ?? "Dependency must be resolved before work resumes."}
            </p>
            <PrimaryButton
              onClick={() =>
                mutation.mutate({ status: "IN_PROGRESS", version: task.version, findings: [] })
              }
              disabled={mutation.isPending}
              loading={mutation.isPending && mutation.variables?.status === "IN_PROGRESS"}
              extra="mt-3"
            >
              <Play className="h-4 w-4" /> Resume work
            </PrimaryButton>
          </div>
        ) : null}
        {task.status === "COMPLETED" ? <CompletedTask task={task} /> : null}
      </section>
    </>
  );
}

/** Team Leader finished its own check: one click sends it on to QA. */
function ForwardToQaDialog({
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
