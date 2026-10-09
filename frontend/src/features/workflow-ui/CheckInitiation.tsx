import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronDown, CircleCheck, CircleDashed, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { CaseDetail } from "@/lib/api/cases";
import {
  getInitiationForms,
  initiateCheck,
  type InitiationField,
  type InitiationForm,
} from "@/lib/backend-api/workflow";

type Entry = Record<string, string>;

const readable = (type: string) =>
  type
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());

function savedEntries(json?: string | null): Entry[] {
  try {
    const parsed = JSON.parse(json ?? "") as { entries?: Entry[] };
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

/**
 * Check-wise initiation (BGV process): Data Entry records the details each check needs
 * (addresses, employers, institutes, court years, ID numbers) before marking Ready.
 */
export function CheckInitiation({
  item,
  editable,
  onSaved,
}: {
  item: CaseDetail;
  editable: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const forms = useQuery({
    queryKey: ["workflow", "initiation-forms"],
    queryFn: getInitiationForms,
    staleTime: Infinity,
  });
  const checks = item.checks.filter((check) => forms.data?.forms[check.type.toUpperCase()]);
  const done = checks.filter((check) => check.initiatedAt).length;
  if (forms.isPending) return <p className="ops-subtle">Loading initiation forms…</p>;
  if (!checks.length) return null;
  return (
    <section className="flow-panel-section" aria-label="Check-wise initiation">
      <h3 className="ops-card-title">
        Check-wise initiation{" "}
        <span className={`flow-pill ${done === checks.length ? "is-good" : "is-warn"}`}>
          {done}/{checks.length} done
        </span>
      </h3>
      <p className="ops-subtle">
        Record what each check needs. Every check must be initiated before you mark Ready.
      </p>
      <div className="cki-list">
        {checks.map((check) => (
          <CheckForm
            key={check.publicId}
            caseId={item.id}
            check={check}
            form={forms.data!.forms[check.type.toUpperCase()]!}
            editable={editable}
            onSaved={onSaved}
          />
        ))}
      </div>
    </section>
  );
}

function CheckForm({
  caseId,
  check,
  form,
  editable,
  onSaved,
}: {
  caseId: string;
  check: CaseDetail["checks"][number];
  form: InitiationForm;
  editable: boolean;
  onSaved: () => Promise<unknown>;
}) {
  const saved = savedEntries(check.initiationJson);
  const [open, setOpen] = useState(!check.initiatedAt && editable);
  const [entries, setEntries] = useState<Entry[]>(saved.length ? saved : [{}]);
  const save = useMutation({
    mutationFn: () => initiateCheck(caseId, check.publicId, entries),
    onSuccess: async () => {
      toast.success(`${readable(check.type)} initiated`);
      setOpen(false);
      await onSaved();
    },
    onError: (error: Error) => toast.error("Not saved", { description: error.message }),
  });
  const set = (index: number, key: string, value: string) =>
    setEntries((current) =>
      current.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)),
    );
  const missing = entries.some((entry) =>
    form.fields.some((field) => field.required && !entry[field.key]?.trim()),
  );
  return (
    <div className={`cki-item ${check.initiatedAt ? "is-done" : ""}`}>
      <button
        type="button"
        className="cki-head"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {check.initiatedAt ? <CircleCheck aria-hidden /> : <CircleDashed aria-hidden />}
        <span>
          <strong>{readable(check.type)}</strong>
          <small>
            {check.initiatedAt
              ? `Initiated · ${saved.length} ${saved.length === 1 ? "entry" : "entries"}`
              : "Details needed"}
          </small>
        </span>
        <ChevronDown aria-hidden className={open ? "rotate-180" : ""} />
      </button>
      {open ? (
        <form
          className="cki-form"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          {entries.map((entry, index) => (
            <fieldset key={index} className="cki-entry" disabled={!editable || save.isPending}>
              {form.repeatable ? (
                <legend>
                  {readable(check.type)} {index + 1}
                  {entries.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Remove entry ${index + 1}`}
                      onClick={() => setEntries((current) => current.filter((_, i) => i !== index))}
                    >
                      <Trash2 aria-hidden />
                    </button>
                  ) : null}
                </legend>
              ) : null}
              <div className="cki-grid">
                {form.fields.map((field) => (
                  <Field
                    key={field.key}
                    field={field}
                    value={entry[field.key] ?? ""}
                    onChange={(value) => set(index, field.key, value)}
                    label={`${readable(check.type)} ${index + 1} ${field.label}`}
                  />
                ))}
              </div>
            </fieldset>
          ))}
          {editable ? (
            <div className="cki-actions">
              {form.repeatable && entries.length < 10 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEntries((current) => [...current, {}])}
                >
                  <Plus aria-hidden /> Add another
                </Button>
              ) : (
                <span />
              )}
              <Button type="submit" size="sm" disabled={missing} loading={save.isPending}>
                Save initiation
              </Button>
            </div>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

export function Field({
  field,
  value,
  onChange,
  label,
}: {
  field: InitiationField;
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  const text = `${field.label}${field.required ? " *" : ""}`;
  return (
    <label className="ops-field">
      <span>{text}</span>
      {field.kind === "select" ? (
        <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
          <option value="">Choose…</option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={
            field.kind === "date"
              ? "date"
              : field.kind === "email"
                ? "email"
                : field.kind === "phone"
                  ? "tel"
                  : "text"
          }
          inputMode={
            field.kind === "pincode" || field.kind === "year" || field.kind === "phone"
              ? "numeric"
              : undefined
          }
          maxLength={field.kind === "pincode" ? 6 : field.kind === "year" ? 4 : 300}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
        />
      )}
    </label>
  );
}
