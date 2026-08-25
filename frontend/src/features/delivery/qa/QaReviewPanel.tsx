import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  ExternalLink,
  FileSearch,
  Loader2,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
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
    onSuccess: async () => {
      toast.success("Case reserved for your independent review");
      await onRefresh();
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
    onSuccess: async () => {
      toast.success(
        mode === "APPROVED"
          ? "Case approved and report queued"
          : "New verifier rework task created",
      );
      await onRefresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const ready =
    claimedByMe &&
    checked.length === qaChecklist.length &&
    notes.trim().length >= 10 &&
    (mode === "APPROVED" || reworkIds.length > 0);
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[9px] font-bold text-violet-700">
              {humanize(item.priority)} priority
            </span>
            <span className="text-[10px] text-slate-400">v{item.version}</span>
          </div>
          <h2 className="mt-3 text-xl font-bold">{item.subject.fullName}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {item.caseNumber} · {item.client.displayName}
          </p>
        </div>
        <Link
          to="/cases/$caseId"
          params={{ caseId: item.id }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50"
        >
          Case 360 <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </header>
      {!claimedByMe ? (
        <QaClaimState
          owner={item.qaReviewer?.displayName}
          busy={claim.isPending}
          onClaim={() => claim.mutate()}
        />
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
          <ShieldCheck className="h-4 w-4" /> Reserved for your review. Claim expires after 30
          minutes of inactivity.
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
        <section className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">Controlled quality checklist</h3>
              <p className="text-[11px] text-slate-500">
                All controls are enforced again by the API.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {checked.length}/{qaChecklist.length}
            </span>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {qaChecklist.map((label) => {
              const active = checked.includes(label);
              return (
                <label
                  key={label}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-xs ${active ? "border-emerald-200 bg-emerald-50" : "border-slate-200"}`}
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
          <label className="text-xs font-semibold">
            Reviewer rationale
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={5}
              placeholder="Record the factual approval rationale or exact correction required"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-orange-300"
            />
            <span className="mt-1 block text-[9px] font-normal text-slate-400">
              Minimum 10 characters · retained in immutable QA history
            </span>
          </label>
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-blue-700">
              <FileSearch className="h-4 w-4" /> Report readiness
            </p>
            <div className="mt-3 space-y-2 text-xs text-slate-600">
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
        <div className="grid gap-2 sm:grid-cols-2">
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
          <p className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">
            Select at least one check above. A fresh verifier task will be created automatically.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => decision.mutate()}
          disabled={!ready || decision.isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
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
