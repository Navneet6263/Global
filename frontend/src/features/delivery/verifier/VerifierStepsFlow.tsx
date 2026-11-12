import { Ban, CheckCircle2, Loader2 } from "lucide-react";

import { dispositionMeta, type Disposition } from "@/features/workflow-ui/colour-codes";
import type { ColourMatrix } from "@/lib/backend-api/workflow";
import { humanize } from "../utils";
import { CheckEvidencePanel } from "./CheckEvidencePanel";
import { VerifiedDetailsPanel } from "./VerifiedDetailsPanel";
import { VerifierOutcomeStep } from "./VerifierOutcomeStep";
import { PrimaryButton, SecondaryButton } from "./VerifierWorkspaceParts";
import { ReviewChecklist, StepIntro, StepNav, type StepItem } from "./verification-steps";
import { MIN_SUMMARY, STEP_ORDER, type StepId } from "./verification-readiness";
import type { VerifierResult } from "./verifier-draft";

type ScenarioItem = ColourMatrix["matrix"][string][number];

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

/** Four-step verification wizard body, insufficiency callout, and sticky action bar. */
export function VerifierStepsFlow({
  checkId,
  team,
  step,
  steps,
  onGoTo,
  onOpenTab,
  quickTabs,
  readiness,
  scenarios,
  scenarioId,
  scenario,
  matrix,
  result,
  chosenColour,
  sourceSummary,
  summaryDone,
  outcomeDone,
  onSelectScenario,
  onChangeResult,
  onSelectColour,
  onChangeSummary,
  ready,
  mutationPending,
  completing,
  onBlock,
  onComplete,
}: {
  checkId: string;
  team?: string | null;
  step: StepId;
  steps: StepItem[];
  onGoTo: (next: StepId) => void;
  onOpenTab?: (tab: string) => void;
  quickTabs: Array<{ id: string; label: string }>;
  readiness: {
    detailsDone: boolean;
    detailsHint: string;
    proofCount: number;
    proofDone: boolean;
    vendorApproved: boolean;
  };
  scenarios: ScenarioItem[];
  scenarioId: string;
  scenario: ScenarioItem | undefined;
  matrix: ColourMatrix | undefined;
  result: VerifierResult;
  chosenColour: Disposition | null;
  sourceSummary: string;
  summaryDone: boolean;
  outcomeDone: boolean;
  onSelectScenario: (id: string, picked?: ScenarioItem, currentMatrix?: ColourMatrix) => void;
  onChangeResult: (value: VerifierResult) => void;
  onSelectColour: (value: Disposition) => void;
  onChangeSummary: (value: string) => void;
  ready: boolean;
  mutationPending: boolean;
  completing: boolean;
  onBlock: () => void;
  onComplete: () => void;
}) {
  const stepIndex = STEP_ORDER.indexOf(step);

  return (
    // minmax(0,1fr): long matrix options must not widen the steps past the card.
    <div className="mt-5 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
      <StepNav steps={steps} current={step} onSelect={onGoTo} />
      {onOpenTab ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[12.5px] text-amber-950">
          <span>
            Missing a document or detail from the candidate? Raise insufficiency (L2): the candidate
            and the client are told what to supply.
          </span>
          <button
            type="button"
            onClick={() => onOpenTab("clarifications")}
            className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-amber-600"
          >
            Raise insufficiency
          </button>
        </div>
      ) : null}
      {step === "details" ? (
        <>
          <StepIntro number={1} title="Verify at the source and record what it confirmed">
            {GUIDANCE[team ?? ""] ?? GUIDANCE["DEFAULT"]} Then fill the verified details below; they
            print in the report next to what the candidate stated.
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
          <VerifiedDetailsPanel checkId={checkId} readOnly={false} />
        </>
      ) : null}
      {step === "proof" ? (
        <>
          <StepIntro number={2} title="Add proof of where you verified">
            Upload screenshots of the portal result, the HR / university email reply, photos or the
            lab report. At least one file is required; each appears as a figure in the report.
            {readiness.vendorApproved ? (
              <span className="mt-1 block font-medium text-emerald-700">
                The approved vendor report counts as proof for this check.
              </span>
            ) : null}
          </StepIntro>
          <CheckEvidencePanel checkId={checkId} />
        </>
      ) : null}
      {step === "outcome" ? (
        <VerifierOutcomeStep
          scenarios={scenarios}
          scenarioId={scenarioId}
          scenario={scenario}
          matrix={matrix}
          result={result}
          chosenColour={chosenColour}
          sourceSummary={sourceSummary}
          summaryDone={summaryDone}
          onSelectScenario={onSelectScenario}
          onChangeResult={onChangeResult}
          onSelectColour={onSelectColour}
          onChangeSummary={onChangeSummary}
        />
      ) : null}
      {step === "review" ? (
        <>
          <StepIntro number={4} title="Review and complete">
            Everything below must be done. After you complete, the check goes to your Team Leader
            for review, then QA, then the RM&apos;s final review and the client report.
          </StepIntro>
          <ReviewChecklist
            onFix={onGoTo}
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
                  : `${humanize(result)}${chosenColour ? ` · ${dispositionMeta[chosenColour].name}` : ""}`,
              },
            ]}
          />
        </>
      ) : null}
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur">
        {stepIndex > 0 ? (
          <SecondaryButton onClick={() => onGoTo(STEP_ORDER[stepIndex - 1]!)}>Back</SecondaryButton>
        ) : null}
        {stepIndex < STEP_ORDER.length - 1 ? (
          <SecondaryButton onClick={() => onGoTo(STEP_ORDER[stepIndex + 1]!)}>
            Next step
          </SecondaryButton>
        ) : null}
        <SecondaryButton disabled={mutationPending} onClick={onBlock}>
          <Ban className="h-4 w-4" /> Block
        </SecondaryButton>
        <span className="ml-auto hidden text-[12px] text-slate-500 sm:inline">
          {ready
            ? "All steps done"
            : `${steps.filter((item) => !item.done).length} step${steps.filter((item) => !item.done).length === 1 ? "" : "s"} left`}
        </span>
        <PrimaryButton
          disabled={!ready || mutationPending}
          loading={completing}
          onClick={onComplete}
        >
          {completing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}{" "}
          Complete check
        </PrimaryButton>
      </div>
    </div>
  );
}
