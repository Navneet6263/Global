import { CheckCircle2 } from "lucide-react";
import type { FieldDraft } from "./types";

const fieldChecklist = [
  "House / gate photo",
  "Name plate close-up",
  "Neighbour confirmation",
  "Executive selfie at site",
];

export function FieldChecklist({
  draft,
  onChange,
  disabled = false,
}: {
  draft: FieldDraft;
  onChange: (patch: Partial<FieldDraft>) => void;
  disabled?: boolean;
}) {
  const toggle = (item: string) =>
    onChange({
      checklist: draft.checklist.includes(item)
        ? draft.checklist.filter((current) => current !== item)
        : [...draft.checklist, item],
    });
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Visit checklist</h2>
        <span className="text-[10px] text-slate-400">
          {draft.checklist.length}/{fieldChecklist.length}
        </span>
      </div>
      <div className="space-y-2">
        {fieldChecklist.map((item) => {
          const done = draft.checklist.includes(item);
          return (
            <button
              key={item}
              type="button"
              disabled={disabled}
              onClick={() => toggle(item)}
              className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left ${done ? "border-emerald-100 bg-emerald-50" : "border-slate-200 bg-slate-50"} disabled:cursor-not-allowed`}
            >
              <CheckCircle2
                className={`h-4 w-4 shrink-0 ${done ? "text-emerald-600" : "text-slate-300"}`}
              />
              <span className={`text-xs ${done ? "text-slate-800" : "text-slate-500"}`}>
                {item}
              </span>
            </button>
          );
        })}
      </div>
      <textarea
        value={draft.remarks}
        maxLength={2000}
        disabled={disabled}
        onChange={(event) => onChange({ remarks: event.target.value })}
        placeholder="Who confirmed the address? Add factual remarks only."
        className="mt-3 h-20 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-orange-300 disabled:cursor-not-allowed"
      />
      <p className="mt-2 text-[10px] text-slate-400">
        Stored on this device until sync · {draft.synced ? "synced" : "pending secure API sync"}.
      </p>
    </section>
  );
}
