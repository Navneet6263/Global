import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Loader2,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ReportPreviewButton } from "@/features/workflow-ui/ReportPreview";
import { CaseReportView } from "@/features/workflow-ui/ReportView";

import type { QaQueueItem } from "@/lib/api/qa";
import { cn } from "@/lib/utils";
import { formatDate, humanize, qaChecklist } from "../utils";
import { QaEvidencePanel } from "./QaEvidencePanel";
import { QaClaimState } from "./QaDecisionParts";
import { QaDecisionForm } from "./QaDecisionForm";
import { QaReviewTabs, type QaReviewTab } from "./QaReviewTabs";
import { QaReservation } from "./QaReservation";
import { useQaClaim } from "./use-qa-claim";
import { useQaActions } from "./use-qa-actions";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

/**
 * QA review of one case, report first: QA reads the full internal report (every
 * annexure, stated vs verified, proof), marks checks that need rework, checks the
 * documents and records the decision.
 */
export function QaReviewPanel({
  item,
  reviewerId,
  onRefresh,
  refreshing = false,
}: {
  item: QaQueueItem;
  reviewerId?: string | undefined;
  onRefresh: () => Promise<void>;
  refreshing?: boolean;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [reworkIds, setReworkIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"APPROVED" | "REWORK">("APPROVED");
  const [tab, setTab] = useState<QaReviewTab>("report");
  const content = useRef<HTMLDivElement>(null);
  const reservation = useQaClaim(item, reviewerId);
  const claimedByMe = reservation.mine;
  useEffect(() => {
    setChecked([]);
    setReworkIds([]);
  }, [item.version]);
  const {
    claim,
    decision,
    reservation: reservationAction,
    busy,
  } = useQaActions(
    item,
    {
      decision: mode,
      caseVersion: item.version,
      checklist: checked,
      notes: notes.trim(),
      reworkCheckIds: mode === "REWORK" ? reworkIds : [],
    },
    onRefresh,
  );
  const ready =
    claimedByMe &&
    checked.length === qaChecklist.length &&
    notes.trim().length >= 10 &&
    (mode === "APPROVED" || reworkIds.length > 0);
  const hasField = item.fieldVisits.length > 0;
  const steps: QaReviewTab[] = hasField
    ? ["report", "documents", "field", "decision"]
    : ["report", "documents", "decision"];
  const currentTab = tab === "field" && !hasField ? "documents" : tab;
  const step = steps.indexOf(currentTab);
  const changeTab = (value: QaReviewTab) => {
    setTab(value);
    content.current?.scrollTo({ top: 0 });
  };
  const toggleRework = (id: string) =>
    setReworkIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  const overdue = Boolean(item.dueAt && new Date(item.dueAt).getTime() < Date.now());
  return (
    <section
      aria-label="Selected case review"
      className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 px-5 pb-4 pt-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-violet-100 text-[14px] font-semibold text-violet-700">
            {initials(item.subject.fullName)}
          </span>
          <div className="min-w-0">
            <h2 className="break-words text-[18px] font-semibold tracking-tight text-slate-900">
              {item.subject.fullName}
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-slate-500">
              <span className="font-medium text-slate-700">{item.caseNumber}</span>
              <span>{item.client.displayName}</span>
              <span>
                {item.checks.length} check{item.checks.length === 1 ? "" : "s"}
              </span>
              {item.dueAt ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1",
                    overdue && "font-medium text-red-600",
                  )}
                >
                  <CalendarClock className="size-3.5" aria-hidden />
                  Due {formatDate(item.dueAt)}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[12px] font-semibold ring-1",
              ["URGENT", "CRITICAL", "HIGH"].includes(item.priority)
                ? "bg-red-50 text-red-700 ring-red-200"
                : "bg-slate-50 text-slate-600 ring-slate-200",
            )}
          >
            {humanize(item.priority)} priority
          </span>
          <ReportPreviewButton
            caseId={item.id}
            caseNumber={item.caseNumber}
            candidateName={item.subject.fullName}
            audiences={["internal", "client"]}
            label="Full report"
          />
          <span className="text-[12px] text-slate-400">v{item.version}</span>
        </div>
      </header>
      <div className="px-5 pb-4">
        {!claimedByMe ? (
          <QaClaimState
            owner={reservation.active ? item.qaReviewer?.displayName : undefined}
            busy={busy || refreshing}
            loading={claim.isPending}
            onClaim={() => claim.mutate()}
          />
        ) : (
          <QaReservation
            minutes={reservation.minutes}
            onChange={(action) => reservationAction.mutate(action)}
            disabled={busy || refreshing}
            pendingAction={reservationAction.isPending ? reservationAction.variables : undefined}
          />
        )}
      </div>
      <QaReviewTabs
        value={currentTab}
        onChange={changeTab}
        checks={item.checks.length}
        documents={item.documents.length}
        fieldVisits={item.fieldVisits.length}
        checked={checked.length}
        checklistTotal={qaChecklist.length}
        disabled={busy || refreshing}
      />
      <div
        ref={content}
        id="qa-review-content"
        role="region"
        aria-label="Review section content"
        tabIndex={0}
        className="min-h-[18rem] max-h-[min(70vh,46rem)] overflow-y-auto overscroll-y-auto bg-slate-50/60 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400 sm:p-5"
      >
        {/* Reading the report needs no claim; rework marks and the decision do. */}
        {currentTab === "report" ? (
          <div className="grid gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[12.5px] text-slate-600">
                <strong className="block text-[13px] text-slate-900">Read the full report</strong>
                Every check as the client will see it, with who verified it. Tick{" "}
                <span className="font-medium">Needs rework</span> on any check that must go back.
              </p>
              {reworkIds.length ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[12px] font-semibold text-amber-800 ring-1 ring-amber-200">
                  <RotateCcw className="size-3.5" aria-hidden />
                  {reworkIds.length} marked for rework
                </span>
              ) : null}
            </div>
            <CaseReportView
              caseId={item.id}
              audience="internal"
              itemAction={(entry) =>
                entry.checkId ? (
                  <label
                    className={cn(
                      "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium transition",
                      reworkIds.includes(entry.checkId)
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="size-3.5 accent-amber-600"
                      checked={reworkIds.includes(entry.checkId)}
                      disabled={!claimedByMe || busy || refreshing}
                      onChange={() => toggleRework(entry.checkId!)}
                      aria-label={`Return ${entry.label} for rework`}
                    />
                    Needs rework
                  </label>
                ) : null
              }
            />
          </div>
        ) : (
          <fieldset disabled={!claimedByMe || busy || refreshing} className="min-w-0">
            <legend className="sr-only">
              Independent review controls; an active reservation is required
            </legend>
            {currentTab === "decision" ? (
              <QaDecisionForm
                checked={checked}
                onChecked={setChecked}
                notes={notes}
                onNotes={setNotes}
                mode={mode}
                onMode={setMode}
                reworkCount={reworkIds.length}
                onSelectChecks={() => changeTab("report")}
              />
            ) : (
              <QaEvidencePanel item={item} view={currentTab} />
            )}
          </fieldset>
        )}
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          {step > 0 ? (
            <button
              type="button"
              disabled={busy || refreshing}
              onClick={() => changeTab(steps[step - 1]!)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-[12.5px] font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </button>
          ) : null}
          <span
            className="flex items-center gap-1.5"
            aria-label={`Section ${step + 1} of ${steps.length}`}
          >
            {steps.map((value, index) => (
              <span
                key={value}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  index === step
                    ? "w-5 bg-blue-600"
                    : index < step
                      ? "w-1.5 bg-blue-300"
                      : "w-1.5 bg-slate-200",
                )}
              />
            ))}
            <span className="ml-1 text-[12px] text-slate-500">
              Section {step + 1} of {steps.length}
            </span>
          </span>
        </div>
        {currentTab === "decision" ? (
          <button
            type="button"
            onClick={() => decision.mutate()}
            disabled={!ready || busy || refreshing}
            aria-busy={decision.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {decision.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            Submit controlled decision
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || refreshing}
            onClick={() => changeTab(steps[step + 1]!)}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
          >
            {steps[step + 1] === "decision"
              ? "Continue to decision"
              : steps[step + 1] === "field"
                ? "Review field evidence"
                : "Review documents"}
            <ArrowRight className="size-3.5" />
          </button>
        )}
      </footer>
    </section>
  );
}
