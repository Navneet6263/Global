import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DocumentFileActions } from "@/features/cases/document-file-actions";
import { istDateTime } from "@/features/operations/workspace/ops-queue-model";
import type { CaseDetail } from "@/lib/api/cases";
import { createClarification, resolveClarification } from "@/lib/backend-api/clarifications";
import { reviewDocument } from "@/lib/backend-api/documents";
import { readableCheck } from "./flow-model";

export function DataEntryDocumentRow({
  caseItem,
  document,
  onDone,
}: {
  caseItem: CaseDetail;
  document: CaseDetail["documents"][number];
  onDone: () => Promise<unknown>;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const latest = document.versions.at(-1);
  const queryClient = useQueryClient();
  const review = useMutation({
    mutationFn: (decision: "VERIFIED" | "REJECTED") =>
      reviewDocument(document.publicId, {
        version: document.version,
        documentVersion: document.currentVersion,
        decision,
        note:
          decision === "VERIFIED"
            ? note.trim() || "Checked at Data Entry: complete and readable"
            : note.trim(),
      }),
    onSuccess: (result, decision) => {
      toast.success(
        decision === "VERIFIED" ? "Document accepted" : "Document rejected — replacement requested",
      );
      // Show the decision at once; the rest of the case refreshes in the background
      // instead of keeping the button busy until every panel has reloaded.
      queryClient.setQueryData<CaseDetail>(["case", caseItem.id], (current) =>
        current
          ? {
              ...current,
              documents: current.documents.map((row) =>
                row.publicId === document.publicId
                  ? {
                      ...row,
                      status: result.status,
                      version: result.version,
                      reviewNote: result.reviewNote,
                    }
                  : row,
              ),
            }
          : current,
      );
      setRejecting(false);
      setNote("");
      void onDone();
    },
    onError: (error: Error) => toast.error("Review not saved", { description: error.message }),
  });
  const status = document.status;
  const tone = status === "VERIFIED" ? "is-good" : status === "REJECTED" ? "is-bad" : "is-warn";
  const locked = !["DATA_ENTRY", "CORRECTION"].includes(caseItem.workflow?.intakeStage ?? "");
  return (
    <div className={`dei-doc ${tone}`}>
      <span className="dei-doc-icon" aria-hidden>
        <FileText />
      </span>
      <span className="dei-doc-text">
        <strong>{readableCheck(document.type)}</strong>
        <small>
          {latest?.originalName ? `${latest.originalName} · ` : ""}v{document.currentVersion}
          {document.reviewNote ? ` · ${document.reviewNote}` : ""}
        </small>
      </span>
      <span className={`rmo-pill ${tone}`}>
        {status === "VERIFIED" ? "Accepted" : readableCheck(status)}
      </span>
      <span className="dei-doc-actions">
        {latest ? (
          <DocumentFileActions
            documentId={document.publicId}
            filename={latest.originalName}
            label={readableCheck(document.type)}
          />
        ) : null}
        {!locked && latest && status !== "VERIFIED" ? (
          <Button
            size="sm"
            onClick={() => review.mutate("VERIFIED")}
            loading={review.isPending && review.variables === "VERIFIED"}
            disabled={review.isPending}
          >
            Accept
          </Button>
        ) : null}
        {!locked && latest && status !== "REJECTED" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRejecting((value) => !value)}
            disabled={review.isPending}
          >
            Reject
          </Button>
        ) : null}
      </span>
      {rejecting ? (
        <form
          className="dei-doc-reject"
          onSubmit={(event) => {
            event.preventDefault();
            if (note.trim().length >= 5) review.mutate("REJECTED");
          }}
        >
          <input
            className="ops-text-input"
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Why? e.g. image unreadable, name mismatch"
            aria-label={`Reason to reject ${readableCheck(document.type)}`}
          />
          <Button
            type="submit"
            size="sm"
            variant="destructive"
            disabled={note.trim().length < 5}
            loading={review.isPending && review.variables === "REJECTED"}
          >
            Reject
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function DataEntryRequestRow({
  caseId,
  request,
  onDone,
}: {
  caseId: string;
  request: {
    id: string;
    status: string;
    subject: string;
    level?: string | null;
    createdAt: string;
    messages: Array<{ senderType: string; body: string }>;
  };
  onDone: () => Promise<unknown>;
}) {
  const resolve = useMutation({
    mutationFn: () => resolveClarification(caseId, request.id),
    onSuccess: async () => {
      toast.success("Correction resolved");
      await onDone();
    },
    onError: (error: Error) => toast.error("Not resolved", { description: error.message }),
  });
  const reply = [...request.messages].reverse().find((message) => message.senderType !== "TEAM");
  const tone =
    request.status === "RESOLVED"
      ? "is-good"
      : request.status === "RESPONDED"
        ? "is-info"
        : "is-warn";
  return (
    <div className="dei-request">
      <span className="min-w-0">
        <strong>{request.subject}</strong>
        <small>
          {request.level ?? "L1"} · raised {istDateTime(request.createdAt)}
        </small>
        {reply ? <q>{reply.body.slice(0, 160)}</q> : null}
      </span>
      <span className="dei-request-side">
        <span className={`rmo-pill ${tone}`}>
          {request.status === "RESPONDED" ? "Response received" : readableCheck(request.status)}
        </span>
        {request.status === "RESPONDED" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => resolve.mutate()}
            loading={resolve.isPending}
          >
            Mark resolved
          </Button>
        ) : null}
      </span>
    </div>
  );
}

export function DataEntryRaiseCorrection({
  caseId,
  disabled,
  onDone,
}: {
  caseId: string;
  disabled: boolean;
  onDone: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const create = useMutation({
    mutationFn: () =>
      createClarification(caseId, { subject: subject.trim(), message: message.trim() }),
    onSuccess: async () => {
      toast.success("Insufficiency (L1) raised", {
        description: "The candidate gets a fresh link and the client is told.",
      });
      setOpen(false);
      setSubject("");
      setMessage("");
      await onDone();
    },
    onError: (error: Error) =>
      toast.error("Insufficiency not raised", { description: error.message }),
  });
  if (!open)
    return (
      <Button
        className="mt-2"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <MessageSquareText aria-hidden />
        Raise insufficiency (L1)
      </Button>
    );
  return (
    <form
      className="dei-raise"
      onSubmit={(event) => {
        event.preventDefault();
        create.mutate();
      }}
    >
      <label className="ops-field">
        <span>What is missing or wrong?</span>
        <input
          value={subject}
          maxLength={180}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="e.g. Employment relieving letter missing"
        />
      </label>
      <label className="ops-field">
        <span>Message to the candidate / client</span>
        <textarea
          rows={3}
          maxLength={5000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={subject.trim().length < 3 || message.trim().length < 3}
          loading={create.isPending}
        >
          Send to candidate &amp; client
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={create.isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
