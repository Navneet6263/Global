import { useMutation } from "@tanstack/react-query";
import { ClipboardCheck, ImagePlus, ListChecks, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ReportPreviewButton } from "@/features/workflow-ui/ReportPreview";
import type { Disposition } from "@/features/workflow-ui/colour-codes";
import { updateTask, type VerificationTask } from "@/lib/api/tasks";
import { humanize } from "../utils";
import { CheckEvidencePanel } from "./CheckEvidencePanel";
import { VerifiedDetailsPanel } from "./VerifiedDetailsPanel";
import { VerifierStepsFlow } from "./VerifierStepsFlow";
import { BlockedTaskCard, ForwardToQaDialog, StartVerificationCard } from "./VerifierTaskPanels";
import { Status } from "./VerifierQueue";
import { BlockerEditor, CompletedTask, WorkspaceNotice } from "./VerifierWorkspaceParts";
import { useVerifierTaskDraft } from "./useVerifierTaskDraft";
import { resolveInitialStep, useCheckReadiness, type StepId } from "./verification-readiness";
import type { StepItem } from "./verification-steps";
import type { VerifierResult } from "./verifier-draft";

/** Guided 4-step verification workbench for an assigned verifier task. */
export function VerifierTaskWorkspace({
  task: loaded,
  readOnly = false,
  onUpdated,
  onOpenTab,
  quickTabs = [],
  vendorApproved = false,
}: {
  task: VerificationTask;
  readOnly?: boolean;
  onUpdated: () => Promise<void>;
  /** Opens another tab of the task desk (documents, source email, vendor). */
  onOpenTab?: (tab: string) => void;
  quickTabs?: Array<{ id: string; label: string }>;
  vendorApproved?: boolean;
}) {
  // Started (or resumed) on the server: open the steps at once instead of waiting for
  // the whole task to reload; the reloaded task takes over when it is newer.
  const [started, setStarted] = useState<number | null>(null);
  const task: VerificationTask =
    started !== null && started > loaded.version
      ? { ...loaded, status: "IN_PROGRESS", version: started }
      : loaded;
  const inProgress = !readOnly && task.status === "IN_PROGRESS";
  const draft = useVerifierTaskDraft({
    taskId: task.id,
    checkType: task.check.type,
    inProgress,
  });
  const [blockReason, setBlockReason] = useState("");
  const [showBlock, setShowBlock] = useState(false);
  const [forwardPrompt, setForwardPrompt] = useState(false);

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof updateTask>[1]) => updateTask(task.id, input),
    onSuccess: (saved, input) => {
      if (input.status === "IN_PROGRESS") setStarted(saved.version);
      if (input.status === "COMPLETED") draft.clearDraft();
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

  const readiness = useCheckReadiness(task.check.publicId, vendorApproved, inProgress);
  const ready = readiness.detailsDone && readiness.proofDone && draft.outcomeDone;
  const steps: StepItem[] = [
    {
      id: "details",
      label: "Verified details",
      hint: readiness.detailsHint,
      done: readiness.detailsDone,
      icon: ClipboardCheck,
    },
    {
      id: "proof",
      label: "Proof",
      hint: "At least one file",
      done: readiness.proofDone,
      icon: ImagePlus,
    },
    {
      id: "outcome",
      label: "Outcome & summary",
      hint: "Matrix, colour, summary",
      done: draft.outcomeDone,
      icon: ListChecks,
    },
    {
      id: "review",
      label: "Review & complete",
      hint: "Send to your Team Leader",
      done: false,
      icon: Send,
    },
  ];

  const [chosenStep, setChosenStep] = useState<StepId | null>(null);
  // Latch starting step once when readiness and draft hydrate so typing >= 20 chars never jumps away.
  useEffect(() => {
    if (!inProgress || chosenStep !== null || readiness.loading || !draft.draftReady) return;
    setChosenStep(
      resolveInitialStep({
        detailsDone: readiness.detailsDone,
        proofDone: readiness.proofDone,
        outcomeDone: draft.outcomeDone,
      }),
    );
  }, [
    inProgress,
    chosenStep,
    readiness.loading,
    readiness.detailsDone,
    readiness.proofDone,
    draft.draftReady,
    draft.outcomeDone,
  ]);

  const step: StepId = chosenStep ?? "details";
  const goTo = (next: StepId) => {
    setChosenStep(next);
    document
      .getElementById(`task-steps-${task.id}`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  };
  const complete = () =>
    mutation.mutate({
      status: "COMPLETED",
      version: task.version,
      result: draft.result,
      ...(draft.chosenColour ? { disposition: draft.chosenColour } : {}),
      sourceSummary: draft.sourceSummary.trim(),
      findings: draft.findings.map((item) => {
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
      <section
        id={`task-steps-${task.id}`}
        className="scroll-mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      >
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {humanize(task.check.type)} verification
            </h2>
            <p className="mt-0.5 text-[12.5px] text-slate-500">
              Priority {humanize(task.check.case.priority).toLowerCase()} · version {task.version}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ReportPreviewButton
              caseId={task.check.case.publicId}
              caseNumber={task.check.case.caseNumber}
              candidateName={task.check.case.subject.fullName}
              audiences={["internal"]}
              label="My report pages"
            />
            <Status status={task.status} />
          </div>
        </header>
        {task.instructions ? (
          <WorkspaceNotice title="Assignment instructions" detail={task.instructions} />
        ) : null}
        {!readOnly && ["OPEN", "UNASSIGNED"].includes(task.status) ? (
          <StartVerificationCard
            pending={mutation.isPending}
            starting={mutation.isPending && mutation.variables?.status === "IN_PROGRESS"}
            onStart={() =>
              mutation.mutate({ status: "IN_PROGRESS", version: task.version, findings: [] })
            }
            onBlock={() => setShowBlock(true)}
          />
        ) : null}
        {inProgress ? (
          <VerifierStepsFlow
            checkId={task.check.publicId}
            team={task.check.department?.teamType}
            step={step}
            steps={steps}
            onGoTo={goTo}
            onOpenTab={onOpenTab}
            quickTabs={quickTabs}
            readiness={readiness}
            scenarios={draft.scenarios}
            scenarioId={draft.scenarioId}
            scenario={draft.scenario}
            matrix={draft.matrix.data}
            result={draft.result}
            chosenColour={draft.chosenColour}
            sourceSummary={draft.sourceSummary}
            summaryDone={draft.summaryDone}
            outcomeDone={draft.outcomeDone}
            onSelectScenario={(nextId, picked, currentMatrix) => {
              draft.setScenarioId(nextId);
              if (!picked || !currentMatrix) return;
              draft.setResult(currentMatrix.resultFor[picked.colour] as VerifierResult);
              draft.setDisposition(picked.colour as Disposition);
            }}
            onChangeResult={(value) => {
              draft.setResult(value);
              draft.setDisposition(null);
            }}
            onSelectColour={draft.setDisposition}
            onChangeSummary={draft.setSourceSummary}
            ready={ready}
            mutationPending={mutation.isPending}
            completing={mutation.isPending && mutation.variables?.status === "COMPLETED"}
            onBlock={() => setShowBlock(true)}
            onComplete={complete}
          />
        ) : null}
        {!readOnly && showBlock && task.status !== "COMPLETED" ? (
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
        {task.status === "BLOCKED" && !readOnly ? (
          <BlockedTaskCard
            blockerReason={task.blockerReason}
            pending={mutation.isPending}
            resuming={mutation.isPending && mutation.variables?.status === "IN_PROGRESS"}
            onResume={() =>
              mutation.mutate({ status: "IN_PROGRESS", version: task.version, findings: [] })
            }
          />
        ) : null}
        {task.status === "COMPLETED" || readOnly ? (
          <>
            {task.status === "COMPLETED" ? <CompletedTask task={task} /> : null}
            {task.blockerReason && readOnly && task.status === "BLOCKED" ? (
              <WorkspaceNotice title="Blocker reason" detail={task.blockerReason} />
            ) : null}
            <div className="mt-5 grid gap-4">
              <VerifiedDetailsPanel checkId={task.check.publicId} readOnly />
              <CheckEvidencePanel
                checkId={task.check.publicId}
                readOnly={readOnly || task.status === "COMPLETED"}
              />
            </div>
          </>
        ) : null}
      </section>
    </>
  );
}
