import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, FileSearch, Loader2, RotateCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { claimQaCase, submitQaDecision, type QaQueueItem } from "@/lib/api/qa";
import { humanize, qaChecklist } from "../utils";
import { QaEvidencePanel } from "./QaEvidencePanel";
import { QaClaimState, QaDecisionButton } from "./QaDecisionParts";

export function QaReviewPanel({
  item,
  reviewerId,
  onRefresh,
}: {
  item: QaQueueItem;
  reviewerId?: string | undefined;
  onRefresh: () => Promise<void>;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [reworkIds, setReworkIds] = useState<string[]>([]);
  const [mode, setMode] = useState<"APPROVED" | "REWORK">("APPROVED");
  const claimedByMe = item.qaReviewer?.publicId === reviewerId;
  const claim = useMutation({
    mutationFn: () => claimQaCase(item.id, item.version),
    onSuccess: () => {
      toast.success("Case reserved for your independent review");
      void onRefresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const decision = useMutation({
    mutationFn: () =>
      submitQaDecision(item.id, {
        decision: mode,
        caseVersion: item.version,
        checklist: checked,
        notes: notes.trim(),
        reworkCheckIds: mode === "REWORK" ? reworkIds : [],
      }),
    onSuccess: () => {
      toast.success(
        mode === "APPROVED"
          ? "Case approved and report queued"
          : "New verifier rework task created",
      );
      void onRefresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const ready =
    claimedByMe &&
    checked.length === qaChecklist.length &&
    notes.trim().length >= 10 &&
    (mode === "APPROVED" || reworkIds.length > 0);
  return (
    <section className="relative overflow-hidden rounded-[1.65rem] border border-white/80 bg-card/85 p-5 shadow-[var(--shadow-float)] backdrop-blur-sm sm:p-6">
      <span className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-review via-mint to-warning" />
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border/70 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-review/20 bg-review-soft px-2.5 py-1 text-[9px] font-medium text-review-foreground">
              {humanize(item.priority)} priority
            </span>
            <span className="text-[9.5px] text-muted-foreground">Version {item.version}</span>
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-[-0.025em]">
            {item.subject.fullName}
          </h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {item.caseNumber} · {item.client.displayName}
          </p>
        </div>
      </header>
      {!claimedByMe ? (
        <QaClaimState
          owner={item.qaReviewer?.displayName}
          busy={claim.isPending}
          onClaim={() => claim.mutate()}
        />
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-[1.15rem] border border-success/20 bg-success-soft/65 px-4 py-3 text-[11px] font-medium text-success-foreground">
          <ShieldCheck className="h-4 w-4" /> Reserved for your review. It may be reassigned 30
          minutes after the initial claim, so submit or reclaim before continuing.
        </div>
      )}
      <div className={`mt-5 space-y-5 ${!claimedByMe ? "pointer-events-none opacity-55" : ""}`}>
        <QaEvidencePanel
          item={item}
          selectedChecks={reworkIds}
          onToggleCheck={(id) =>
            setReworkIds((current) =>
              current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
            )
          }
        />
        <section className="rounded-[1.35rem] border border-white/80 bg-background/60 p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[12px] font-semibold">Controlled quality checklist</h3>
              <p className="text-[10px] text-muted-foreground">
                All controls are enforced again by the API.
              </p>
            </div>
            <span className="num rounded-full bg-mint-soft px-2.5 py-1 text-[10px] font-medium text-mint-deep">
              {checked.length}/{qaChecklist.length}
            </span>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {qaChecklist.map((label) => {
              const active = checked.includes(label);
              return (
                <label
                  key={label}
                  className={`flex cursor-pointer items-start gap-3 rounded-[1rem] border p-3 text-[10.5px] leading-relaxed transition ${active ? "border-success/25 bg-success-soft/65" : "border-border bg-white/60 hover:border-mint/25"}`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() =>
                      setChecked((current) =>
                        active ? current.filter((value) => value !== label) : [...current, label],
                      )
                    }
                    className="mt-0.5 h-4 w-4"
                  />
                  <span>{label}</span>
                </label>
              );
            })}
          </div>
        </section>
        <section className="grid gap-4 lg:grid-cols-[1fr_0.7fr]">
          <label className="rounded-[1.3rem] border border-white/80 bg-background/60 p-4 text-[11px] font-semibold shadow-[var(--shadow-card)]">
            Reviewer rationale
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={5}
              placeholder="Record the factual approval rationale or exact correction required"
              className="mt-2 w-full rounded-[1rem] border border-border bg-white/80 px-3 py-3 text-[12px] leading-relaxed outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
            />
            <span className="mt-1 block text-[9px] font-normal text-muted-foreground">
              Minimum 10 characters · retained in immutable QA history
            </span>
          </label>
          <div className="rounded-[1.3rem] border border-info/20 bg-info-soft/55 p-4 shadow-[var(--shadow-card)]">
            <p className="flex items-center gap-2 text-[12px] font-semibold text-info-foreground">
              <FileSearch className="h-4 w-4" /> Report readiness
            </p>
            <div className="mt-3 space-y-2 text-[10.5px] text-muted-foreground">
              <p>{item.checks.length} check outcomes included</p>
              <p>{item.documents.length} controlled documents available</p>
              <p>
                {item.fieldVisits.reduce((total, visit) => total + visit.evidence.length, 0)} field
                evidence items linked
              </p>
              <p>Final signed report generates only after approval</p>
            </div>
          </div>
        </section>
        <div className="grid gap-2 rounded-[1.3rem] border border-white/80 bg-background/60 p-3 shadow-[var(--shadow-card)] sm:grid-cols-2">
          <QaDecisionButton
            active={mode === "APPROVED"}
            tone="approve"
            onClick={() => setMode("APPROVED")}
            icon={CheckCircle2}
            label="Approve outcome"
          />
          <QaDecisionButton
            active={mode === "REWORK"}
            tone="rework"
            onClick={() => setMode("REWORK")}
            icon={RotateCcw}
            label="Return selected checks"
          />
        </div>
        {mode === "REWORK" && !reworkIds.length ? (
          <p className="rounded-[1rem] border border-warning/25 bg-warning-soft/70 p-3 text-[10.5px] text-warning-foreground">
            Select at least one check above. A fresh verifier task will be created automatically.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => decision.mutate()}
          disabled={!ready || decision.isPending}
          className="sticky bottom-3 z-10 inline-flex items-center gap-2 rounded-full bg-mint-deep px-5 py-3 text-[11px] font-medium text-white shadow-[var(--shadow-float)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {decision.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )}{" "}
          Submit controlled decision
        </button>
      </div>
    </section>
  );
}
