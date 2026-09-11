import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { toast } from "sonner";
import { reviewDocument } from "@/lib/backend-api/documents";

export function DocumentReviewControls({
  document,
}: {
  document: {
    id: string;
    revision: number;
    fileVersion: number;
    expiresAt?: string | null;
  };
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [decision, setDecision] = useState<"VERIFIED" | "REJECTED" | "REUPLOAD_REQUIRED">(
    "VERIFIED",
  );
  const [expiresAt, setExpiresAt] = useState(document.expiresAt?.slice(0, 10) ?? "");
  const client = useQueryClient();
  const review = useMutation({
    mutationFn: () =>
      reviewDocument(document.id, {
        version: document.revision,
        documentVersion: document.fileVersion,
        decision,
        note: note.trim(),
        expiresAt: expiresAt || undefined,
      }),
    onSuccess: () => {
      toast.success("Document review recorded");
      setOpen(false);
      setNote("");
      void client.invalidateQueries({
        predicate: (query) =>
          ["case", "cases", "operations", "evidence-readiness", "candidate-portal"].some((key) =>
            query.queryKey.some((part) => typeof part === "string" && part.includes(key)),
          ),
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className={open ? "w-full" : ""}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-white px-3 text-xs font-medium hover:bg-secondary"
      >
        <ClipboardCheck className="size-3.5" /> Review
      </button>
      {open ? (
        <div className="mt-3 grid gap-3 rounded-2xl border border-border bg-secondary/30 p-4 sm:grid-cols-2">
          <label className="text-xs">
            Decision
            <select
              value={decision}
              onChange={(e) => setDecision(e.target.value as typeof decision)}
              className="mt-1 h-10 w-full rounded-xl border border-input bg-white px-3"
            >
              <option value="VERIFIED">Accept this document</option>
              <option value="REUPLOAD_REQUIRED">Request corrected upload</option>
              <option value="REJECTED">Reject this document</option>
            </select>
          </label>
          <label className="text-xs">
            Expiry, if the document has one
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="mt-1 h-10 w-full rounded-xl border border-input bg-white px-3"
            />
          </label>
          <label className="text-xs sm:col-span-2">
            Review note
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="Describe what you checked or what must be corrected"
              className="mt-1 w-full rounded-xl border border-input bg-white p-3"
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Review applies to file version {document.fileVersion}. A new upload requires a new
            review.
          </p>
          <button
            type="button"
            disabled={review.isPending || note.trim().length < 5}
            aria-busy={review.isPending}
            onClick={() => review.mutate()}
            className="h-10 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {review.isPending ? "Recording review…" : "Save review"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
