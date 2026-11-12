import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Circle, CircleAlert, CircleCheck, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { istDateTime } from "@/features/operations/workspace/ops-queue-model";
import type { CaseDetail } from "@/lib/api/cases";
import { markCaseReady, type QueueCase } from "@/lib/backend-api/workflow";
import { dueLabel, readableCheck } from "./flow-model";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";

export interface ReviewStep {
  label: string;
  done: boolean;
  detail: string;
}

export function DataEntryReviewSidebar({
  item,
  queueItem,
  steps,
  progress,
  blockers,
  waitingChecks,
  sentChecks,
  acceptedCount,
  rejectedCount,
  checkStatesLoaded,
  openChecksCount,
  onRefresh,
  onClose,
}: {
  item: CaseDetail;
  queueItem?: QueueCase;
  steps: ReviewStep[];
  progress: number;
  blockers: string[];
  waitingChecks: Array<{ type: string }>;
  sentChecks: Array<{ type: string }>;
  acceptedCount: number;
  rejectedCount: number;
  checkStatesLoaded: boolean;
  openChecksCount: number;
  onRefresh: () => Promise<unknown>;
  onClose: () => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const stage = item.workflow?.intakeStage;
  const due = dueLabel(item.dueAt ?? queueItem?.dueAt ?? null);
  const ready = useMutation({
    mutationFn: (processNow: boolean) =>
      markCaseReady(item.id, { version: item.version, ...(processNow ? { processNow } : {}) }),
    onSuccess: async (result) => {
      setChoosing(false);
      if (result.waiting?.length) {
        toast.success(`${result.sent ?? 0} check(s) sent to their teams`, {
          description: `${result.waiting.map(readableCheck).join(", ")} wait for the candidate. The case stays with you until they upload again.`,
        });
        await onRefresh();
        return;
      }
      if (result.routed) toast.success(`${item.caseNumber} sent to the verification teams`);
      else
        toast.success(`${item.caseNumber} is complete — with the RM to route`, {
          description: result.routeNote,
        });
      await onRefresh();
      onClose();
    },
    onError: (error: Error) => toast.error("Not completed", { description: error.message }),
  });

  return (
    <div className="dei-review-side">
      <header className="dei-panel-head">
        <span className="dei-avatar is-lg" aria-hidden>
          {initials(item.subject.fullName)}
        </span>
        <div className="min-w-0">
          <h2>{item.subject.fullName}</h2>
          <p>
            <span className="dei-id">{item.caseNumber}</span>
            <span>{item.client.displayName}</span>
            {item.assignedOpsUser ? <span>RM {item.assignedOpsUser.displayName}</span> : null}
          </p>
        </div>
      </header>
      <div className="dei-panel-tags">
        <span className={`rmo-pill ${stage === "CORRECTION" ? "is-warn" : "is-info"}`}>
          {stage === "CORRECTION" ? "Waiting on correction" : "To review"}
        </span>
        <span className={`rmo-pill is-${due.tone}`}>{due.text}</span>
        {item.checks.map((check) => (
          <span key={check.publicId} className="dei-tag">
            {readableCheck(check.type)}
          </span>
        ))}
      </div>
      <section className="dei-progress" aria-label="Readiness">
        <div className="dei-progress-head">
          <strong>Readiness</strong>
          <span>{progress}%</span>
        </div>
        <div
          className="dei-progress-bar"
          role="progressbar"
          aria-label="Readiness"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <ol className="dei-steps">
          {steps.map((step) => (
            <li key={step.label} className={step.done ? "is-done" : ""}>
              {step.done ? <CircleCheck aria-hidden /> : <Circle aria-hidden />}
              <span>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </span>
            </li>
          ))}
        </ol>
      </section>
      <footer className="dei-panel-foot" aria-label="Ready check">
        {blockers.length ? (
          <div className="flow-callout is-bad">
            <CircleAlert aria-hidden />
            <ul>
              {blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </div>
        ) : waitingChecks.length ? (
          <div className="flow-callout is-warn">
            <CircleAlert aria-hidden />
            <span>
              {waitingChecks.map((row) => readableCheck(row.type)).join(", ")}{" "}
              {waitingChecks.length === 1 ? "waits" : "wait"} for the candidate. The other checks
              are ready to send.
            </span>
          </div>
        ) : (
          <div className="flow-callout is-good">
            <ShieldCheck aria-hidden />
            <span>
              Consent accepted, checks initiated, required documents accepted and no open
              corrections.
            </span>
          </div>
        )}
        {choosing && waitingChecks.length ? (
          <div
            className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12.5px] text-amber-950"
            role="group"
            aria-label="Rejected documents"
          >
            <p className="font-semibold">
              You accepted {acceptedCount} document{acceptedCount === 1 ? "" : "s"} and rejected{" "}
              {rejectedCount}.
            </p>
            <p>
              {waitingChecks.map((row) => readableCheck(row.type)).join(", ")}{" "}
              {waitingChecks.length === 1 ? "waits" : "wait"} for the candidate. The candidate has
              been emailed to upload the rejected documents again.
            </p>
            <p>Process the accepted checks now, or wait for the candidate?</p>
            <div className="grid gap-2">
              <Button size="sm" onClick={() => ready.mutate(true)} loading={ready.isPending}>
                Process accepted checks now
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setChoosing(false);
                  toast.message("Waiting for the candidate", {
                    description:
                      "The case stays with you. Accept the new documents when they arrive, then complete the work.",
                  });
                }}
              >
                Wait for the candidate
              </Button>
            </div>
          </div>
        ) : null}
        <Button
          className="w-full"
          size="lg"
          onClick={() => (waitingChecks.length ? setChoosing(true) : ready.mutate(false))}
          disabled={
            Boolean(blockers.length) ||
            stage !== "DATA_ENTRY" ||
            Boolean(checkStatesLoaded && !openChecksCount)
          }
          loading={ready.isPending && !choosing}
        >
          <Send aria-hidden />
          Complete work
        </Button>
        {sentChecks.length ? (
          <p className="dei-foot-note">
            Already with their teams: {sentChecks.map((row) => readableCheck(row.type)).join(", ")}
          </p>
        ) : null}
        {queueItem?.dataEntryAssignedAt ? (
          <p className="dei-foot-note">Assigned {istDateTime(queueItem.dataEntryAssignedAt)}</p>
        ) : null}
      </footer>
    </div>
  );
}
