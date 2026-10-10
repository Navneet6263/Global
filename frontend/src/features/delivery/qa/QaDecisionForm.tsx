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
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[13.5px] font-semibold text-slate-900">Quality checklist</h3>
          <span className="num rounded-full bg-slate-100 px-2 py-0.5 text-[12px] font-semibold text-slate-600">
            {checked.length}/{qaChecklist.length} confirmed
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${(checked.length / qaChecklist.length) * 100}%` }}
          />
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {qaChecklist.map((label) => {
            const active = checked.includes(label);
            return (
              <label
                key={label}
                className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-[12.5px] leading-relaxed transition ${active ? "border-emerald-200 bg-emerald-50/70 text-emerald-900" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
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
