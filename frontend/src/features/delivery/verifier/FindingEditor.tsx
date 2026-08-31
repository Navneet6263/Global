import { Plus, Trash2 } from "lucide-react";

import type { FindingInput } from "@/lib/api/tasks";
import { humanize } from "../utils";

const blankFinding = (): FindingInput => ({
  kind: "OTHER",
  severity: "MEDIUM",
  title: "",
  description: "",
  source: "",
});

export function FindingEditor({
  value,
  onChange,
}: {
  value: FindingInput[];
  onChange: (value: FindingInput[]) => void;
}) {
  const update = (index: number, patch: Partial<FindingInput>) =>
    onChange(value.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  return (
    <section className="rounded-[1.35rem] border border-white/80 bg-warning-soft/35 p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[12px] font-semibold">Structured findings</h3>
          <p className="text-[10px] text-muted-foreground">
            Add every discrepancy separately with its evidence source.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...value, blankFinding()])}
          className="inline-flex items-center gap-1.5 rounded-full border border-white bg-white/85 px-3 py-2 text-[10px] font-medium text-warning-foreground shadow-[var(--shadow-card)] transition hover:bg-warning-soft"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      <div className="mt-3 space-y-3">
        {value.map((finding, index) => (
          <div
            key={index}
            className="rounded-[1.15rem] border border-white/90 bg-white/80 p-4 shadow-[var(--shadow-card)]"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Category"
                value={finding.kind}
                values={[
                  "IDENTITY_MISMATCH",
                  "DATE_MISMATCH",
                  "ADDRESS_MISMATCH",
                  "RECORD_FOUND",
                  "OTHER",
                ]}
                onChange={(kind) => update(index, { kind: kind as FindingInput["kind"] })}
              />
              <Select
                label="Severity"
                value={finding.severity}
                values={["LOW", "MEDIUM", "HIGH", "CRITICAL"]}
                onChange={(severity) =>
                  update(index, { severity: severity as FindingInput["severity"] })
                }
              />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field
                label="Finding title"
                value={finding.title}
                onChange={(title) => update(index, { title })}
              />
              <Field
                label="Evidence source"
                value={finding.source ?? ""}
                onChange={(source) => update(index, { source })}
              />
            </div>
            <label className="mt-3 block text-[10.5px] font-semibold">
              Description
              <textarea
                value={finding.description}
                onChange={(event) => update(index, { description: event.target.value })}
                rows={3}
                className="mt-1.5 w-full rounded-[0.9rem] border border-border bg-background/70 px-3 py-2 text-[12px] outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              />
            </label>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
              className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-critical-foreground"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove finding
            </button>
          </div>
        ))}
        {!value.length ? (
          <p className="rounded-[1rem] border border-dashed border-warning/30 bg-white/60 p-4 text-center text-[10.5px] text-muted-foreground">
            No discrepancy recorded. Clear outcomes can be submitted without a finding.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-[10.5px] font-semibold">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-10 w-full rounded-[0.9rem] border border-border bg-background/70 px-3 text-[12px] outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
      />
    </label>
  );
}
function Select({
  label,
  value,
  values,
  onChange,
}: {
  label: string;
  value: string;
  values: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-[10.5px] font-semibold">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-10 w-full rounded-[0.9rem] border border-border bg-background/70 px-3 text-[12px] outline-none focus:border-primary/40"
      >
        {values.map((item) => (
          <option key={item} value={item}>
            {humanize(item)}
          </option>
        ))}
      </select>
    </label>
  );
}
