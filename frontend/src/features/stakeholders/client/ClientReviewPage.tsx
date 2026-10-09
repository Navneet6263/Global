import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Eye, FileText, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import {
  approveClientReview,
  listClientReviews,
  returnClientReview,
  type ClientReviewItem,
} from "@/lib/backend-api/client-review";
import { previewDocument } from "@/lib/backend-api/documents";
import { formatDateTime } from "@/lib/formatting";

const docLabel = (type: string) =>
  type
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^\w/, (letter) => letter.toUpperCase());

/**
 * Route A (BGV process): this company reviews what its candidate submitted before
 * Sapling starts. Approve sends it on; Return asks the candidate to fix it.
 */
export function ClientReviewPage() {
  const queryClient = useQueryClient();
  const [returning, setReturning] = useState<ClientReviewItem>();
  const reviews = useQuery({ queryKey: ["client-review"], queryFn: listClientReviews });
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["client-review"] }),
      queryClient.invalidateQueries({ queryKey: ["navigation-counts"] }),
    ]);
  const approve = useMutation({
    mutationFn: (item: ClientReviewItem) => approveClientReview(item.id, item.version),
    onSuccess: async (_result, item) => {
      toast.success(`${item.candidateName} approved`, {
        description: "Sapling has started the verification.",
      });
      await refresh();
    },
    onError: (error: Error) => toast.error("Not approved", { description: error.message }),
  });
  const items = reviews.data?.items ?? [];
  const toReview = items.filter((item) => item.state === "TO_REVIEW");
  const waiting = items.filter((item) => item.state === "WITH_CANDIDATE");

  return (
    <div className="crv">
      {reviews.isError ? (
        <ErrorState
          description={reviews.error.message}
          onRetry={() => void reviews.refetch()}
          retrying={reviews.isFetching}
        />
      ) : null}
      {reviews.isPending ? <ListSkeleton rows={3} /> : null}
      {reviews.data ? (
        <>
          <section className="client-panel" aria-labelledby="crv-todo">
            <header className="client-panel-head">
              <h2 id="crv-todo">
                Waiting for your review <small>({toReview.length})</small>
              </h2>
              <p>Open each document, then approve or send it back to the candidate.</p>
            </header>
            {toReview.length ? (
              <ul className="crv-list">
                {toReview.map((item) => (
                  <li key={item.id}>
                    <div className="crv-head">
                      <span className="min-w-0">
                        <strong>{item.candidateName}</strong>
                        <small>
                          {item.caseNumber} · submitted {formatDateTime(item.since)}
                        </small>
                      </span>
                      <span className="crv-actions">
                        <Button variant="outline" size="sm" onClick={() => setReturning(item)}>
                          <Undo2 aria-hidden /> Return to candidate
                        </Button>
                        <Button
                          size="sm"
                          loading={approve.isPending && approve.variables?.id === item.id}
                          onClick={() => approve.mutate(item)}
                        >
                          <CircleCheck aria-hidden /> Approve
                        </Button>
                      </span>
                    </div>
                    <ul className="crv-docs" aria-label={`Documents from ${item.candidateName}`}>
                      {item.documents.length ? (
                        item.documents.map((document) => (
                          <li key={document.id}>
                            <FileText aria-hidden />
                            <span>{docLabel(document.type)}</span>
                            <button
                              type="button"
                              onClick={() =>
                                void previewDocument(document.id).catch((error: Error) =>
                                  toast.error("Could not open", { description: error.message }),
                                )
                              }
                            >
                              <Eye aria-hidden /> Open
                            </button>
                          </li>
                        ))
                      ) : (
                        <li className="crv-empty">No documents uploaded.</li>
                      )}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="crv-none">Nothing to review right now.</p>
            )}
          </section>
          {waiting.length ? (
            <section className="client-panel" aria-labelledby="crv-waiting">
              <header className="client-panel-head">
                <h2 id="crv-waiting">
                  Returned to the candidate <small>({waiting.length})</small>
                </h2>
                <p>They have a new link. It comes back here when they finish.</p>
              </header>
              <ul className="crv-list is-compact">
                {waiting.map((item) => (
                  <li key={item.id}>
                    <div className="crv-head">
                      <span>
                        <strong>{item.candidateName}</strong>
                        <small>
                          {item.caseNumber} · returned {formatDateTime(item.since)}
                        </small>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
      {returning ? (
        <ReturnDialog item={returning} onClose={() => setReturning(undefined)} onDone={refresh} />
      ) : null}
    </div>
  );
}

function ReturnDialog({
  item,
  onClose,
  onDone,
}: {
  item: ClientReviewItem;
  onClose: () => void;
  onDone: () => Promise<unknown>;
}) {
  const [reason, setReason] = useState("");
  const send = useMutation({
    mutationFn: () => returnClientReview(item.id, item.version, reason.trim()),
    onSuccess: async (result) => {
      toast.success("Sent back to the candidate", {
        description: result.candidateNotified
          ? "They got a new link by email with your reason."
          : "No candidate contact on file; share the reason with them directly.",
      });
      await onDone();
      onClose();
    },
    onError: (error: Error) => toast.error("Not sent", { description: error.message }),
  });
  return (
    <Dialog open onOpenChange={(open) => (!open && !send.isPending ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Return to {item.candidateName}</DialogTitle>
          <DialogDescription>
            {item.caseNumber}. The candidate gets a new secure link with your reason.
          </DialogDescription>
        </DialogHeader>
        <label className="grid gap-1.5 text-sm">
          <span className="font-medium">What should they fix?</span>
          <textarea
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. The PAN card photo is cut off. Please upload a clear full copy."
            className="rounded-lg border border-slate-200 p-2.5 text-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
          />
          <small className="text-xs text-slate-500">At least 10 characters.</small>
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={send.isPending}>
            Cancel
          </Button>
          <Button
            disabled={reason.trim().length < 10}
            loading={send.isPending}
            onClick={() => send.mutate()}
          >
            Send back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
