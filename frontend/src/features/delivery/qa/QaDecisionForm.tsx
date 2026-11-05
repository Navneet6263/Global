import { CheckCircle2, RotateCcw } from "lucide-react";
import { QaDecisionButton } from "./QaDecisionParts";

export function QaDecisionForm({
  commented,
  toComment,
  onOpenDocuments,
  notes,
  onNotes,
  mode,
  onMode,
  reworkCount,
  onSelectChecks,
}: {
  /** Documents commented on, of those uploaded: every one is needed to approve. */
  commented: number;
  toComment: number;
  onOpenDocuments: () => void;
  notes: string;
  onNotes: (value: string) => void;
  mode: "APPROVED" | "REWORK";
  onMode: (value: "APPROVED" | "REWORK") => void;
  reworkCount: number;
  onSelectChecks: () => void;
}) {
  return (
    <div className="space-y-4">
      {toComment ? (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-[12.5px] ${commented === toComment ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}
        >
          <span>
            Document comments: {commented}/{toComment}
            {commented === toComment
              ? " · every document verified"
              : " · comment on every document to approve"}
          </span>
          <button
            type="button"
            onClick={onOpenDocuments}
            className="font-semibold underline underline-offset-4"
          >
            Open documents
          </button>
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <QaDecisionButton
          active={mode === "APPROVED"}
          tone="approve"
          onClick={() => onMode("APPROVED")}
          icon={CheckCircle2}
          label="Approve outcome"
        />
        <QaDecisionButton
          active={mode === "REWORK"}
          tone="rework"
          onClick={() => onMode("REWORK")}
          icon={RotateCcw}
          label="Return selected checks"
        />
      </div>
      {mode === "REWORK" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12.5px] text-amber-900">
          <span>
            {reworkCount
              ? `${reworkCount} ${reworkCount === 1 ? "check" : "checks"} selected for correction`
              : "Select at least one check to return: tick Needs rework in the report."}
          </span>
          <button
            type="button"
            onClick={onSelectChecks}
            className="font-semibold underline underline-offset-4"
          >
            Choose checks
          </button>
        </div>
      ) : null}
      <label className="block text-[13px] font-semibold text-slate-900">
        Reviewer rationale
        <textarea
          value={notes}
          onChange={(event) => onNotes(event.target.value)}
          rows={3}
          placeholder="Explain your approval or the exact correction needed"
          className="mt-2 block w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-[13px] font-normal outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
        />
        <span className="mt-1.5 block text-[12.5px] font-normal text-muted-foreground">
          Minimum 10 characters · saved in the decision history
        </span>
      </label>
      <p className="rounded-xl bg-slate-100/70 px-3 py-2.5 text-[12px] leading-relaxed text-slate-600">
        Approval sends the case to the RM for final review. Once the RM approves, the report is
        prepared and released to the client automatically.
      </p>
    </div>
  );
}
