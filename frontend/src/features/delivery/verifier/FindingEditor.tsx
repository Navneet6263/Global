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
    <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Structured findings</h3>
          <p className="text-[11px] text-slate-500">
            Add every discrepancy separately with its evidence source.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onChange([...value, blankFinding()])}
          className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-2 text-xs font-semibold shadow-sm"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>
      <div className="mt-3 space-y-3">
        {value.map((finding, index) => (
          <div key={index} className="rounded-xl border border-amber-100 bg-white p-4">
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
            <label className="mt-3 block text-xs font-semibold">
              Description
              <textarea
                value={finding.description}
                onChange={(event) => update(index, { description: event.target.value })}
                rows={3}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-orange-300"
              />
            </label>
            <button
              type="button"
              onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-600"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove finding
            </button>
          </div>
        ))}
        {!value.length ? (
          <p className="rounded-xl border border-dashed border-amber-200 bg-white/70 p-4 text-center text-xs text-slate-500">
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
    <label className="text-xs font-semibold">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-orange-300"
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
    <label className="text-xs font-semibold">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
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
