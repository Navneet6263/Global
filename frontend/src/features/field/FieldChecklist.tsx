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
}: {
  draft: FieldDraft;
  onChange: (patch: Partial<FieldDraft>) => void;
}) {
  const toggle = (item: string) =>
    onChange({
      checklist: draft.checklist.includes(item)
        ? draft.checklist.filter((current) => current !== item)
        : [...draft.checklist, item],
    });

  return (
    <section className="surface rounded-3xl p-4">
      <h2 className="mb-3 text-sm font-semibold">Visit checklist</h2>
      <div className="space-y-2">
        {fieldChecklist.map((item) => {
          const done = draft.checklist.includes(item);
          return (
            <button
              key={item}
              type="button"
              onClick={() => toggle(item)}
              className="flex w-full items-center gap-2.5 rounded-2xl bg-secondary/60 px-3 py-2.5 text-left"
            >
              <CheckCircle2
                className={`h-4 w-4 shrink-0 ${done ? "text-accent-foreground" : "text-muted-foreground/40"}`}
              />
              <span className={`text-xs ${done ? "" : "text-muted-foreground"}`}>{item}</span>
            </button>
          );
        })}
      </div>
      <textarea
        value={draft.remarks}
        maxLength={2000}
        onChange={(event) => onChange({ remarks: event.target.value })}
        placeholder="Who confirmed the address? Add factual remarks only."
        className="mt-3 h-20 w-full resize-none rounded-2xl bg-secondary/60 px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring/25"
      />
      <p className="mt-2 text-[11px] text-muted-foreground">
        Stored in IndexedDB on this device · {draft.synced ? "synced" : "pending secure API sync"}.
      </p>
    </section>
  );
}
