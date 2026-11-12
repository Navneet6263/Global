import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { humanize } from "@/features/cases/case-detail-formatting";
import { Field } from "@/features/workflow-ui/CheckInitiation";
import { fieldShown, type InitiationForm } from "@/lib/backend-api/workflow";

export function DataEntryL2EntriesForm({
  checkType,
  form,
  entries,
  busy,
  onChange,
}: {
  checkType: string;
  form: InitiationForm;
  entries: Array<Record<string, string>>;
  busy: boolean;
  onChange: (next: Array<Record<string, string>>) => void;
}) {
  const setField = (index: number, key: string, value: string) =>
    onChange(entries.map((entry, idx) => (idx === index ? { ...entry, [key]: value } : entry)));

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-slate-900">
          Re-enter corrected {humanize(checkType)} details
        </h3>
        {form.repeatable && entries.length < 10 ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onChange([...entries, {}])}
          >
            <Plus className="mr-1 size-3.5" /> Add entry
          </Button>
        ) : null}
      </div>
      {entries.map((entry, idx) => (
        <fieldset key={idx} className="space-y-2 rounded-xl bg-slate-50 p-3" disabled={busy}>
          {form.repeatable ? (
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Entry {idx + 1}</span>
              {entries.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onChange(entries.filter((_, i) => i !== idx))}
                  aria-label={`Remove entry ${idx + 1}`}
                  className="text-rose-600 hover:text-rose-800"
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="cki-grid">
            {form.fields
              .filter((field) => fieldShown(field, entry))
              .map((field) => (
                <Field
                  key={field.key}
                  field={field}
                  value={entry[field.key] ?? ""}
                  onChange={(value) => setField(idx, field.key, value)}
                  label={`${humanize(checkType)} ${idx + 1} ${field.label}`}
                />
              ))}
          </div>
        </fieldset>
      ))}
    </section>
  );
}
