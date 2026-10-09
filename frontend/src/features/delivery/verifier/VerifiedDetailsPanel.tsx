import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, CircleAlert, ClipboardCopy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WorkspaceError, WorkspaceLoading } from "@/features/delivery/WorkspaceStates";
import { Field } from "@/features/workflow-ui/CheckInitiation";
import {
  getVerifiedDetails,
  saveVerifiedDetails,
  type DetailEntry,
  type VerifiedDetails,
} from "@/lib/backend-api/verified-details";
import { formatDateTime } from "@/lib/formatting";

const readable = (type: string) =>
  type
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());

const same = (a?: string, b?: string) =>
  (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();

/**
 * LHS vs RHS (BGV process): what the candidate / Data Entry gave on the left, what the
 * source confirmed on the right. Feeds the report's "As provided / As verified" table.
 */
export function VerifiedDetailsPanel({
  checkId,
  readOnly,
}: {
  checkId: string;
  readOnly: boolean;
}) {
  const details = useQuery({
    queryKey: ["checks", checkId, "verified-details"],
    queryFn: () => getVerifiedDetails(checkId),
  });
  if (details.isPending) return <WorkspaceLoading label="Loading verified details" />;
  if (details.isError)
    return (
      <WorkspaceError message={details.error.message} onRetry={() => void details.refetch()} />
    );
  return (
    <DetailsForm
      key={details.data.rhs.verifiedAt ?? "new"}
      data={details.data}
      readOnly={readOnly}
    />
  );
}

function DetailsForm({ data, readOnly }: { data: VerifiedDetails; readOnly: boolean }) {
  const queryClient = useQueryClient();
  const lhsEntries = data.lhs.entries;
  const blank = data.rhs.form.repeatable && lhsEntries.length ? lhsEntries.map(() => ({})) : [{}];
  const [entries, setEntries] = useState<DetailEntry[]>(
    data.rhs.entries.length ? data.rhs.entries : blank,
  );
  const rhsKeys = new Set(data.rhs.form.fields.map((field) => field.key));
  const save = useMutation({
    mutationFn: () => saveVerifiedDetails(data.checkId, entries),
    onSuccess: async () => {
      toast.success("Verified details saved", {
        description: "They appear in the report next to what was provided.",
      });
      await queryClient.invalidateQueries({
        queryKey: ["checks", data.checkId, "verified-details"],
      });
    },
    onError: (error: Error) => toast.error("Not saved", { description: error.message }),
  });
  const set = (index: number, key: string, value: string) =>
    setEntries((current) =>
      current.map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)),
    );
  const copyProvided = (index: number) =>
    setEntries((current) =>
      current.map((entry, i) => {
        if (i !== index) return entry;
        const provided = Object.entries(lhsEntries[index] ?? {}).filter(
          ([key, value]) => rhsKeys.has(key) && value,
        );
        const typed = Object.entries(entry).filter(([, value]) => value);
        return { ...Object.fromEntries(provided), ...Object.fromEntries(typed) };
      }),
    );
  const missing = entries.some((entry) =>
    data.rhs.form.fields.some((field) => field.required && !entry[field.key]?.trim()),
  );
  const label = readable(data.type);
  const compared = (data.lhs.form?.fields ?? []).filter((field) => rhsKeys.has(field.key));
  return (
    <section className="vd-panel" aria-label="Verified details">
      <header className="vd-head">
        <div>
          <h2>Verified details · {label}</h2>
          <p>
            Record what the source confirmed. Anything that differs from what was provided is
            flagged so you can mark a discrepancy.
          </p>
        </div>
        <div className="vd-status">
          <span className="vd-chip">{data.statusLabel}</span>
          <small>
            {data.rhs.verifiedAt
              ? `Saved ${formatDateTime(data.rhs.verifiedAt)}`
              : "Not recorded yet"}
          </small>
        </div>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        {entries.map((entry, index) => {
          const lhs = lhsEntries[index] ?? {};
          const differences = compared.filter(
            (field) =>
              lhs[field.key] && entry[field.key] && !same(lhs[field.key], entry[field.key]),
          );
          const matched = compared.some((field) => lhs[field.key] && entry[field.key]);
          return (
            <div key={index} className="vd-entry">
              <aside className="vd-lhs" aria-label={`Provided details ${index + 1}`}>
                <h3>As provided</h3>
                {data.lhs.form && Object.keys(lhs).length ? (
                  <dl>
                    {data.lhs.form.fields
                      .filter((field) => lhs[field.key])
                      .map((field) => (
                        <div key={field.key}>
                          <dt>{field.label}</dt>
                          <dd>{lhs[field.key]}</dd>
                        </div>
                      ))}
                  </dl>
                ) : (
                  <p className="vd-empty">Nothing was recorded at initiation for this entry.</p>
                )}
                {!readOnly && compared.some((field) => lhs[field.key]) ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyProvided(index)}
                  >
                    <ClipboardCopy aria-hidden /> Copy to verified
                  </Button>
                ) : null}
              </aside>
              <fieldset className="vd-rhs" disabled={readOnly || save.isPending}>
                <legend>
                  <span>
                    As verified{data.rhs.form.repeatable ? ` · ${label} ${index + 1}` : ""}
                  </span>
                  {!readOnly && entries.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Remove verified entry ${index + 1}`}
                      onClick={() => setEntries((current) => current.filter((_, i) => i !== index))}
                    >
                      <Trash2 aria-hidden />
                    </button>
                  ) : null}
                </legend>
                {differences.length ? (
                  <p className="vd-diff" role="status">
                    <CircleAlert aria-hidden /> Differs from provided:{" "}
                    {differences.map((field) => field.label).join(", ")}
                  </p>
                ) : matched ? (
                  <p className="vd-match">
                    <BadgeCheck aria-hidden /> Matches what was provided
                  </p>
                ) : null}
                <div className="cki-grid">
                  {data.rhs.form.fields.map((field) => (
                    <Field
                      key={field.key}
                      field={field}
                      value={entry[field.key] ?? ""}
                      onChange={(value) => set(index, field.key, value)}
                      label={`Verified ${index + 1} ${field.label}`}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          );
        })}
        {!readOnly ? (
          <div className="vd-actions">
            {data.rhs.form.repeatable && entries.length < 10 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEntries((current) => [...current, {}])}
              >
                <Plus aria-hidden /> Add entry
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" size="sm" disabled={missing} loading={save.isPending}>
              Save verified details
            </Button>
          </div>
        ) : null}
      </form>
    </section>
  );
}
