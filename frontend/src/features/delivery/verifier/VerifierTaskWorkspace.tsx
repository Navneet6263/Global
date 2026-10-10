import { useMutation, useQuery } from "@tanstack/react-query";
import { ReportPreviewButton } from "@/features/workflow-ui/ReportPreview";
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  ImagePlus,
  ListChecks,
  Loader2,
  Play,
  Send,
} from "lucide-react";
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
import { getColourMatrix } from "@/lib/backend-api/workflow";
import { formatDate, humanize } from "../utils";
import { FindingEditor } from "./FindingEditor";
import { CheckEvidencePanel } from "./CheckEvidencePanel";
import { VerifiedDetailsPanel } from "./VerifiedDetailsPanel";
import { ReviewChecklist, StepIntro, StepNav, type StepItem } from "./verification-steps";
import { MIN_SUMMARY, useCheckReadiness, type StepId } from "./verification-readiness";
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

/** How each team verifies, shown in step 1. */
const GUIDANCE: Record<string, string> = {
  DIGITAL:
    "Verify on the official portal or API (e.g. UIDAI, NSDL, eCourts, DigiLocker) and keep a screenshot of the result.",
  EMPLOYMENT:
    "Confirm with the employer's HR by email or phone, or through UAN / EPFO, and keep the reply.",
  EDUCATION:
    "Confirm with the university or board (email, portal or written response) and keep the response.",
  VENDOR:
    "Send the check to a vendor from the Vendor tab and approve the vendor's report when it comes back.",
  DEFAULT: "Confirm the details with the original source and keep a record of the response.",
};

const stepOrder: StepId[] = ["details", "proof", "outcome", "review"];

export function VerifierTaskWorkspace({
  task,
  onUpdated,
  onOpenTab,
  quickTabs = [],
  vendorApproved = false,
}: {
  task: VerificationTask;
  onUpdated: () => Promise<void>;
  /** Opens another tab of the task desk (documents, source email, vendor). */
  onOpenTab?: (tab: string) => void;
  quickTabs?: Array<{ id: string; label: string }>;
  vendorApproved?: boolean;
}) {
  const team = task.check.department?.teamType;
  const draftKey = `verifier-draft:${task.id}`;
  const deviceDataScope = cachedIdentity()?.deviceDataScope;
  const [result, setResult] = useState<VerifierResult>("CLEAR");
  const [disposition, setDisposition] = useState<Disposition | null>(null);
  const colourOptions = ALLOWED_BY_RESULT[result] ?? [];
  const matrix = useQuery({
    queryKey: ["workflow", "colour-matrix"],
    queryFn: getColourMatrix,
    staleTime: Infinity,
    enabled: task.status === "IN_PROGRESS",
  });
  const scenarios = matrix.data?.matrix[task.check.type.toUpperCase()] ?? [];
  const [scenarioId, setScenarioId] = useState("");
  const scenario = scenarios.find((item) => item.id === scenarioId);
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
  const readiness = useCheckReadiness(
    task.check.publicId,
    vendorApproved,
    task.status === "IN_PROGRESS",
  );
  const summaryDone = sourceSummary.trim().length >= MIN_SUMMARY;
  const outcomeDone =
    summaryDone && findingsValid && (result !== "DISCREPANCY" || findings.length > 0);
  // Completion needs every step: verified details, proof, outcome and summary.
  const ready = readiness.detailsDone && readiness.proofDone && outcomeDone;
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
      done: outcomeDone,
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
  // Until the verifier picks a step, open the first one still to do.
  const step: StepId =
    chosenStep ??
    (readiness.loading
      ? "details"
      : !readiness.detailsDone
        ? "details"
        : !readiness.proofDone
          ? "proof"
          : !outcomeDone
            ? "outcome"
            : "review");
  const stepIndex = stepOrder.indexOf(step);
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
        {["OPEN", "UNASSIGNED"].includes(task.status) ? (
          <div className="mt-5 rounded-2xl border border-slate-200 bg-blue-50 p-4 shadow-sm">
            <p className="text-[12px] font-medium text-foreground">
              Ready to begin this source check?
            </p>
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
          // minmax(0,1fr): long matrix options must not widen the steps past the card.
          <div className="mt-5 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
            <StepNav steps={steps} current={step} onSelect={goTo} />
            {step === "details" ? (
              <>
                <StepIntro number={1} title="Verify at the source and record what it confirmed">
                  {GUIDANCE[team ?? ""] ?? GUIDANCE["DEFAULT"]} Then fill the verified details
                  below; they print in the report next to what the candidate stated.
                  {quickTabs.length ? (
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {quickTabs.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onOpenTab?.(item.id)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          {item.label}
                        </button>
                      ))}
                    </span>
                  ) : null}
                </StepIntro>
                <VerifiedDetailsPanel checkId={task.check.publicId} readOnly={false} />
              </>
            ) : null}
            {step === "proof" ? (
              <>
                <StepIntro number={2} title="Add proof of where you verified">
                  Upload screenshots of the portal result, the HR / university email reply, photos
                  or the lab report. At least one file is required; each appears as a figure in the
                  report.
                  {readiness.vendorApproved ? (
                    <span className="mt-1 block font-medium text-emerald-700">
                      The approved vendor report counts as proof for this check.
                    </span>
                  ) : null}
                </StepIntro>
                <CheckEvidencePanel checkId={task.check.publicId} />
              </>
            ) : null}
            {step === "outcome" ? (
              <>
                <StepIntro number={3} title="Choose the outcome and write the summary">
                  Pick what you found from the colour matrix, confirm the colour and describe the
                  source, method, date and response in your own words.
                </StepIntro>
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-semibold text-slate-900">
                        Verification outcome
                      </p>
                      <p className="mt-0.5 text-[12px] text-slate-500">
                        Choose the defensible result supported by your source record.
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                      Required
                    </span>
                  </div>
                  {scenarios.length ? (
                    <label className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-1 text-[12.5px]">
                      <span className="font-semibold text-slate-800">
                        What did you find?{" "}
                        <small className="font-normal text-slate-500">
                          (standard colour matrix)
                        </small>
                      </span>
                      <select
                        value={scenarioId}
                        aria-label="What did you find"
                        onChange={(event) => {
                          const picked = scenarios.find((item) => item.id === event.target.value);
                          setScenarioId(event.target.value);
                          if (!picked || !matrix.data) return;
                          setResult(matrix.data.resultFor[picked.colour] as VerifierResult);
                          setDisposition(picked.colour as Disposition);
                        }}
                        className="h-10 w-full min-w-0 truncate rounded-xl border border-slate-200 bg-white px-3 pr-8 text-[13px] font-normal text-slate-800"
                      >
                        <option value="">Choose the situation…</option>
                        {(["GREEN", "YELLOW", "AMBER", "RED"] as const).map((colour) =>
                          scenarios.some((item) => item.colour === colour) ? (
                            <optgroup key={colour} label={dispositionMeta[colour].name}>
                              {scenarios
                                .filter((item) => item.colour === colour)
                                .map((item) => (
                                  <option key={item.id} value={item.id}>
                                    {item.text}
                                  </option>
                                ))}
                            </optgroup>
                          ) : null,
                        )}
                      </select>
                      {scenario ? (
                        <span className="text-[12px] font-normal text-slate-500">
                          Colour set to {dispositionMeta[scenario.colour as Disposition].name} as
                          per the matrix. You can still adjust below.
                        </span>
                      ) : null}
                    </label>
                  ) : null}
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    {(["CLEAR", "DISCREPANCY", "UNABLE_TO_VERIFY"] as VerifierResult[]).map(
                      (value) => (
                        <button
                          type="button"
                          key={value}
                          onClick={() => {
                            setResult(value);
                            setDisposition(null);
                          }}
                          aria-pressed={result === value}
                          className={`rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold transition ${result === value ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50"}`}
                        >
                          {humanize(value)}
                        </button>
                      ),
                    )}
                  </div>
                  <div className="mt-3" role="radiogroup" aria-label="Outcome">
                    <p className="text-[12.5px] font-semibold text-slate-800">
                      Outcome for the report
                    </p>
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
                          {value === "CLIENT_REVIEW"
                            ? dispositionMeta[value].label
                            : `${dispositionMeta[value].name} · ${dispositionMeta[value].label}`}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
                <label className="block rounded-2xl border border-slate-200 bg-white p-4 text-[13px] font-semibold text-slate-900 shadow-sm">
                  <span className="flex items-center justify-between gap-2">
                    Source summary
                    <span
                      className={`text-[11.5px] font-medium ${summaryDone ? "text-emerald-700" : "text-slate-500"}`}
                    >
                      {sourceSummary.trim().length}/{MIN_SUMMARY} characters minimum
                    </span>
                  </span>
                  <textarea
                    value={sourceSummary}
                    onChange={(event) => setSourceSummary(event.target.value)}
                    rows={4}
                    placeholder="Source, verification method, dates and response received"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[12.5px] font-normal leading-relaxed outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                  {scenario && !sourceSummary.trim() ? (
                    <button
                      type="button"
                      onClick={() => setSourceSummary(`${scenario.text}. `)}
                      className="mt-1 text-[12px] font-medium text-blue-700 hover:underline"
                    >
                      Start from “{scenario.text}”
                    </button>
                  ) : null}
                </label>
                <FindingEditor value={findings} onChange={setFindings} />
              </>
            ) : null}
            {step === "review" ? (
              <>
                <StepIntro number={4} title="Review and complete">
                  Everything below must be done. After you complete, the check goes to your Team
                  Leader for review, then QA, then the RM&apos;s final review and the client report.
                </StepIntro>
                <ReviewChecklist
                  onFix={goTo}
                  items={[
                    {
                      id: "details",
                      label: "Verified details saved",
                      done: readiness.detailsDone,
                      detail: readiness.detailsHint,
                    },
                    {
                      id: "proof",
                      label: "Proof attached",
                      done: readiness.proofDone,
                      detail: readiness.proofCount
                        ? `${readiness.proofCount} file${readiness.proofCount === 1 ? "" : "s"}`
                        : readiness.vendorApproved
                          ? "Approved vendor report"
                          : "No file yet",
                    },
                    {
                      id: "outcome",
                      label: "Outcome and summary",
                      done: outcomeDone,
                      detail: !summaryDone
                        ? `Summary needs at least ${MIN_SUMMARY} characters`
                        : result === "DISCREPANCY" && !findings.length
                          ? "A discrepancy needs at least one finding"
                          : `${humanize(result)}${chosenColour ? ` · ${dispositionMeta[chosenColour].name}` : ""}`,
                    },
                  ]}
                />
              </>
            ) : null}
            <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
              {stepIndex > 0 ? (
                <SecondaryButton onClick={() => goTo(stepOrder[stepIndex - 1]!)}>
                  Back
                </SecondaryButton>
              ) : null}
              {stepIndex < stepOrder.length - 1 ? (
                <SecondaryButton onClick={() => goTo(stepOrder[stepIndex + 1]!)}>
                  Next step
                </SecondaryButton>
              ) : null}
              <SecondaryButton disabled={mutation.isPending} onClick={() => setShowBlock(true)}>
                <Ban className="h-4 w-4" /> Block
              </SecondaryButton>
              <span className="ml-auto hidden text-[12px] text-slate-500 sm:inline">
                {ready
                  ? "All steps done"
                  : `${steps.filter((item) => !item.done).length} step${steps.filter((item) => !item.done).length === 1 ? "" : "s"} left`}
              </span>
              <PrimaryButton
                disabled={!ready || mutation.isPending}
                loading={mutation.isPending && mutation.variables?.status === "COMPLETED"}
                onClick={complete}
              >
                {mutation.isPending && mutation.variables?.status === "COMPLETED" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}{" "}
                Complete check
              </PrimaryButton>
            </div>
          </div>
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
        {task.status === "COMPLETED" ? (
          <>
            <CompletedTask task={task} />
            <div className="mt-5 grid gap-4">
              <VerifiedDetailsPanel checkId={task.check.publicId} readOnly />
              <CheckEvidencePanel checkId={task.check.publicId} />
            </div>
          </>
        ) : null}
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
