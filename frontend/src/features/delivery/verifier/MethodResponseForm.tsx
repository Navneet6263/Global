import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  respondVerificationMethod,
  type MethodRun,
  type MethodEvidenceDocument,
} from "@/lib/backend-api/verification-methods";

export function MethodResponseForm({
  checkId,
  run,
  documents,
  onSaved,
}: {
  checkId: string;
  run: MethodRun;
  documents: MethodEvidenceDocument[];
  onSaved: () => void;
}) {
  const [result, setResult] = useState("CLEAR");
  const [summary, setSummary] = useState("");
  const [reference, setReference] = useState("");
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const mutation = useMutation({
    mutationFn: () =>
      respondVerificationMethod(checkId, run.id, {
        version: run.version,
        result,
        summary,
        reference: reference.trim() || undefined,
        evidenceIds,
        evidenceVersions: evidenceIds.map((id) => ({
          documentId: id,
          version: documents.find((doc) => doc.publicId === id)?.currentVersion ?? 0,
        })),
      }),
    onSuccess: () => {
      toast.success("Source response recorded in the case history");
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const reviewed = documents.filter((doc) => doc.status === "VERIFIED");
  const valid =
    summary.trim().length >= 10 &&
    (run.method === "MANUAL" || (reference.trim().length >= 2 && evidenceIds.length > 0));
  return (
    <form
      className="mt-3 space-y-3 border-t border-border pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) mutation.mutate();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs">
          Source outcome
          <select
            aria-label="Source outcome"
            value={result}
            onChange={(event) => setResult(event.target.value)}
            className="h-10 w-full rounded-xl border bg-card px-3 text-sm"
          >
            <option value="CLEAR">Clear</option>
            <option value="DISCREPANCY">Discrepancy</option>
            <option value="UNABLE_TO_VERIFY">Unable to verify</option>
          </select>
        </label>
        <label className="space-y-1 text-xs">
          Source reference
          <Input
            aria-label="Source reference"
            value={reference}
            maxLength={180}
            onChange={(event) => setReference(event.target.value)}
            placeholder="Request or response reference"
          />
        </label>
      </div>
      <label className="block space-y-1 text-xs">
        Factual response summary
        <Textarea
          value={summary}
          aria-label="Factual response summary"
          maxLength={2000}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="What did the source confirm? Record relevant limitations."
        />
      </label>
      <fieldset className="space-y-2">
        <legend className="mb-2 text-xs font-medium">Reviewed evidence</legend>
        {reviewed.length ? (
          reviewed.map((doc) => (
            <label key={doc.publicId} className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={evidenceIds.includes(doc.publicId)}
                onCheckedChange={() =>
                  setEvidenceIds(
                    evidenceIds.includes(doc.publicId)
                      ? evidenceIds.filter((id) => id !== doc.publicId)
                      : [...evidenceIds, doc.publicId],
                  )
                }
              />
              {doc.type.replaceAll("_", " ")} · v{doc.currentVersion}
            </label>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">
            Ask Operations to review the supporting document before recording an external-source
            response.
          </p>
        )}
      </fieldset>
      <Button
        type="submit"
        size="sm"
        disabled={!valid || mutation.isPending}
        loading={mutation.isPending}
      >
        {mutation.isPending ? "Recording…" : "Record response"}
      </Button>
    </form>
  );
}
