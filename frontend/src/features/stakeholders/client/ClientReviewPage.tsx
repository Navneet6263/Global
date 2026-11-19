import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Eye, FileText, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, CardHeader, ErrorText, Loading, Textarea } from "@/kit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
    <div className="flex flex-col gap-4">
      {reviews.isError ? (
        <ErrorText onRetry={() => void reviews.refetch()} retrying={reviews.isFetching}>
          {reviews.error.message}
        </ErrorText>
      ) : null}
      {reviews.isPending ? <Loading>Loading submissions…</Loading> : null}
      {reviews.data ? (
        <>
          <Card label="Waiting for your review">
            <CardHeader
              title="Waiting for your review"
              count={toReview.length}
              description="Open each document, then approve or send it back to the candidate."
            />
            {toReview.length ? (
              <ul className="divide-y divide-line">
                {toReview.map((item) => (
                  <li key={item.id} className="px-4 py-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="min-w-0">
                        <strong className="block font-semibold text-ink">
                          {item.candidateName}
                        </strong>
                        <small className="text-xs text-dim">
                          <span className="font-mono">{item.caseNumber}</span> · submitted{" "}
                          {formatDateTime(item.since)}
                        </small>
                      </span>
                      <span className="flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => setReturning(item)}>
                          <Undo2 aria-hidden /> Return to candidate
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          loading={approve.isPending && approve.variables?.id === item.id}
                          onClick={() => approve.mutate(item)}
                        >
                          <CircleCheck aria-hidden /> Approve
                        </Button>
                      </span>
                    </div>
                    <ul
                      className="mt-3 flex flex-wrap gap-2"
                      aria-label={`Documents from ${item.candidateName}`}
                    >
                      {item.documents.length ? (
                        item.documents.map((document) => (
                          <li
                            key={document.id}
                            className="flex items-center gap-2 rounded-md border border-line bg-subtle/50 py-1 pr-1 pl-2.5 text-sm text-ink"
                          >
                            <FileText className="size-4 text-brand" aria-hidden />
                            <span>{docLabel(document.type)}</span>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold text-brand hover:bg-brand-soft"
                              onClick={() =>
                                void previewDocument(document.id).catch((error: Error) =>
                                  toast.error("Could not open", { description: error.message }),
                                )
                              }
                            >
                              <Eye className="size-3.5" aria-hidden /> Open
                            </button>
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-dim">No documents uploaded.</li>
                      )}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-8 text-center text-sm text-dim">Nothing to review right now.</p>
            )}
          </Card>
          {waiting.length ? (
            <Card label="Returned to the candidate">
              <CardHeader
                title="Returned to the candidate"
                count={waiting.length}
                description="They have a new link. It comes back here when they finish."
              />
              <ul className="divide-y divide-line">
                {waiting.map((item) => (
                  <li key={item.id} className="px-4 py-3">
                    <strong className="block font-semibold text-ink">{item.candidateName}</strong>
                    <small className="text-xs text-dim">
                      <span className="font-mono">{item.caseNumber}</span> · returned{" "}
                      {formatDateTime(item.since)}
                    </small>
                  </li>
                ))}
              </ul>
            </Card>
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
          <span className="font-medium text-ink">What should they fix?</span>
          <Textarea
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. The PAN card photo is cut off. Please upload a clear full copy."
          />
          <small className="text-xs text-dim">At least 10 characters.</small>
        </label>
        <DialogFooter>
          <Button onClick={onClose} disabled={send.isPending}>
            Cancel
          </Button>
          <Button
            variant="primary"
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
