import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  privacyLabel,
  privacyNext,
  updatePrivacyRecord,
  type PrivacyRecord,
} from "@/lib/backend-api/privacy";
import { privacyInput } from "./PrivacyCreateDialog";

export function PrivacyDecision({ record }: { record: PrivacyRecord }) {
  const cache = useQueryClient();
  const choices = privacyNext[record.status] ?? [];
  const [status, setStatus] = useState(choices[0] ?? "");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const terminal = ["FULFILLED", "CLOSED"].includes(status);
  const update = useMutation({
    mutationFn: () =>
      updatePrivacyRecord(record.id, {
        version: record.version,
        status,
        note: note.trim(),
        ...(reference.trim() ? { evidenceReference: reference.trim() } : {}),
      }),
    onSuccess: () => {
      toast.success("Human decision recorded", {
        description: "No automatic data deletion or external notification was performed.",
      });
      void cache.invalidateQueries({ queryKey: ["privacy"] });
    },
    onError: (error) => toast.error(error.message),
  });
  if (!choices.length)
    return (
      <p className="rounded-2xl bg-success-soft p-4 text-sm text-success-foreground">
        This tracking record is final. Its decision history remains available below.
      </p>
    );
  return (
    <form
      className="space-y-3 rounded-2xl border border-review/20 bg-review-soft/20 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate();
      }}
    >
      <h3 className="text-sm font-semibold">Record the next decision</h3>
      <label className="block space-y-1 text-xs">
        Next status
        <select className={privacyInput} value={status} onChange={(e) => setStatus(e.target.value)}>
          {choices.map((value) => (
            <option key={value} value={value}>
              {privacyLabel(value)}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 text-xs">
        Reviewer rationale
        <textarea
          className={`${privacyInput} min-h-24`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          required
          minLength={10}
          maxLength={2000}
          placeholder="What was reviewed, what was decided and why?"
        />
      </label>
      <label className="block space-y-1 text-xs">
        Evidence reference {terminal ? "(required)" : "(optional)"}
        <Input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          required={terminal}
          minLength={3}
          maxLength={300}
          placeholder="Approved ticket or secure repository record"
        />
      </label>
      {terminal ? (
        <p className="text-xs text-muted-foreground">
          Confirm that authorised work was completed outside this tracker. A status change itself
          performs no erasure or incident remediation.
        </p>
      ) : null}
      <Button
        size="sm"
        disabled={
          update.isPending || note.trim().length < 10 || (terminal && reference.trim().length < 3)
        }
        loading={update.isPending}
      >
        {update.isPending ? "Recording…" : "Record decision"}
      </Button>
    </form>
  );
}
