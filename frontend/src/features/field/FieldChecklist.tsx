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
    <section className="surface rounded-[1.75rem] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Visit checklist</h2>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Record only what was observed on site
          </p>
        </div>
        <span className="num rounded-full bg-secondary px-2.5 py-1 text-[10px] text-muted-foreground">
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
              className={`flex min-h-11 w-full items-center gap-3 rounded-[1rem] border px-3 py-2.5 text-left transition-colors ${done ? "border-success/15 bg-success-soft" : "border-white/70 bg-secondary/45 hover:bg-secondary/70"} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <CheckCircle2
                className={`size-4 shrink-0 ${done ? "text-success" : "text-border-strong"}`}
              />
              <span
                className={`text-xs ${done ? "font-medium text-success-foreground" : "text-muted-foreground"}`}
              >
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
        className="mt-3 h-24 w-full resize-none rounded-[1rem] border border-input bg-white/80 px-3 py-2.5 text-xs leading-5 outline-none transition-shadow placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed"
      />
      <p className="mt-2 text-[10px] text-muted-foreground">
        Stored on this device until sync · {draft.synced ? "synced" : "pending secure API sync"}.
      </p>
    </section>
  );
}
