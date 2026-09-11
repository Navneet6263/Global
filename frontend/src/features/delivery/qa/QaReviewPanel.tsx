import { ArrowLeft, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { QaQueueItem } from "@/lib/api/qa";
import { humanize, qaChecklist } from "../utils";
import { QaEvidencePanel } from "./QaEvidencePanel";
import { QaClaimState } from "./QaDecisionParts";
import { QaDecisionForm } from "./QaDecisionForm";
import { QaReviewTabs, type QaReviewTab } from "./QaReviewTabs";
import { QaReservation } from "./QaReservation";
import { useQaClaim } from "./use-qa-claim";
import { useQaActions } from "./use-qa-actions";

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
  const [tab, setTab] = useState<QaReviewTab>("checks");
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
    ? ["checks", "documents", "field", "decision"]
    : ["checks", "documents", "decision"];
  const currentTab = tab === "field" && !hasField ? "documents" : tab;
  const step = steps.indexOf(currentTab);
  const changeTab = (value: QaReviewTab) => {
    setTab(value);
    content.current?.scrollTo({ top: 0 });
  };
  return (
    <section
      aria-label="Selected case review"
      className="min-w-0 overflow-hidden rounded-[1.65rem] border border-review/15 bg-white shadow-[var(--shadow-card)]"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-t-4 border-review/35 bg-gradient-to-r from-review-soft via-white to-mint-soft px-5 py-4">
        <div className="min-w-0">
          <h2 className="break-words text-lg font-semibold tracking-tight">
            {item.subject.fullName}
          </h2>
          <p className="mt-1 break-words text-xs text-muted-foreground">
            {item.caseNumber} · {item.client.displayName}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded-full border border-review/20 bg-review-soft px-2.5 py-1 text-review-foreground">
            {humanize(item.priority)} priority
          </span>
          <span className="text-muted-foreground">v{item.version}</span>
        </div>
      </header>
      <div className="px-4 pb-3">
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
        className="min-h-[18rem] max-h-[60vh] overflow-y-auto overscroll-y-auto p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-review/40"
      >
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
              onSelectChecks={() => changeTab("checks")}
            />
          ) : (
            <QaEvidencePanel
              item={item}
              view={currentTab}
              selectedChecks={reworkIds}
              onToggleCheck={(id) =>
                setReworkIds((current) =>
                  current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
                )
              }
            />
          )}
        </fieldset>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-background/40 px-4 py-3">
        <div className="flex items-center gap-3">
          {step > 0 ? (
            <button
              type="button"
              disabled={busy || refreshing}
              onClick={() => changeTab(steps[step - 1]!)}
              className="inline-flex items-center gap-1 rounded-full px-2 py-2 text-xs font-medium disabled:opacity-50"
            >
              <ArrowLeft className="size-3.5" />
              Back
            </button>
          ) : null}
          <span className="text-[11px] text-muted-foreground">
            Section {step + 1} of {steps.length}
          </span>
        </div>
        {currentTab === "decision" ? (
          <button
            type="button"
            onClick={() => decision.mutate()}
            disabled={!ready || busy || refreshing}
            aria-busy={decision.isPending}
            className="inline-flex items-center gap-2 rounded-full bg-mint-deep px-4 py-2.5 text-xs font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
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
            className="inline-flex items-center gap-2 rounded-full bg-mint-deep px-4 py-2.5 text-xs font-medium text-white disabled:opacity-50"
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
