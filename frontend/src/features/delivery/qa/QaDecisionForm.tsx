import { CheckCircle2, RotateCcw } from "lucide-react";
import { qaChecklist } from "../utils";
import { QaDecisionButton } from "./QaDecisionParts";

export function QaDecisionForm({
  checked,
  onChecked,
  notes,
  onNotes,
  mode,
  onMode,
  reworkCount,
  onSelectChecks,
}: {
  checked: string[];
  onChecked: (value: string[]) => void;
  notes: string;
  onNotes: (value: string) => void;
  mode: "APPROVED" | "REWORK";
  onMode: (value: "APPROVED" | "REWORK") => void;
  reworkCount: number;
  onSelectChecks: () => void;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-review/30 bg-gradient-to-br from-review-soft to-review-soft/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">Quality checklist</h3>
          <span className="num text-xs font-medium text-review-foreground">
            {checked.length}/{qaChecklist.length} confirmed
          </span>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {qaChecklist.map((label) => {
            const active = checked.includes(label);
            return (
              <label
                key={label}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-xs leading-relaxed transition ${active ? "border-success/25 bg-success-soft/70" : "border-border/70 bg-white/80"}`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() =>
                    onChecked(
                      active ? checked.filter((value) => value !== label) : [...checked, label],
                    )
                  }
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                />
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </section>
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
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning/25 bg-warning-soft/60 p-3 text-xs text-warning-foreground">
          <span>
            {reworkCount
              ? `${reworkCount} checks selected for correction`
              : "Select at least one check to return."}
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
      <label className="block text-xs font-semibold">
        Reviewer rationale
        <textarea
          value={notes}
          onChange={(event) => onNotes(event.target.value)}
          rows={3}
          placeholder="Explain your approval or the exact correction needed"
          className="mt-2 block w-full rounded-2xl border border-border bg-white px-3 py-3 text-sm font-normal outline-none focus:border-review/40 focus:ring-2 focus:ring-review/10"
        />
        <span className="mt-1.5 block text-[11px] font-normal text-muted-foreground">
          Minimum 10 characters · saved in the decision history
        </span>
      </label>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Approval sends the case to independent Manager Review. Report preparation and payment-based
        release happen afterwards.
      </p>
    </div>
  );
}
