import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { Button } from "@/components/ui/button";
import { getCase } from "@/lib/api/cases";
import { invalidateWorkflow } from "@/lib/api/invalidate-workflow";
import type { UnifiedQueueCase } from "@/lib/backend-api/data-entry-queue";
import { DataEntryL2ReentryDrawer } from "./DataEntryL2ReentryDrawer";
import { DataEntryReviewBody } from "./DataEntryReviewBody";
import { readableCheck } from "./flow-model";

export function DataEntryIntakeReview({
  caseId,
  clarificationId,
  queueItem,
  onSelectClarification,
  onClose,
}: {
  caseId?: string;
  clarificationId?: string;
  queueItem?: UnifiedQueueCase;
  onSelectClarification: (id: string) => void;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const l2List = queueItem?.l2Reentries ?? [];
  const resolvedClarId = clarificationId ?? (l2List.length ? l2List[0]?.id : undefined);
  const isOpen = Boolean(caseId || resolvedClarId);
  const [shownCaseId, setShownCaseId] = useState(caseId);
  const [shownClarId, setShownClarId] = useState(resolvedClarId);
  const [dualMode, setDualMode] = useState<"l2" | "intake">("l2");

  useEffect(() => {
    if (caseId) setShownCaseId(caseId);
    else if (!resolvedClarId) setShownCaseId(undefined);
  }, [caseId, resolvedClarId]);

  useEffect(() => {
    if (resolvedClarId) {
      setShownClarId(resolvedClarId);
      setDualMode("l2");
    } else if (!caseId) {
      setShownClarId(undefined);
    }
  }, [resolvedClarId, caseId]);

  const activeCaseId = caseId ?? shownCaseId;
  const activeClarId = resolvedClarId ?? shownClarId;
  const hasNormalIntake = Boolean(
    activeCaseId &&
    (!activeClarId || ["DATA_ENTRY", "CORRECTION"].includes(queueItem?.intakeStage ?? "")),
  );
  const showL2 = Boolean(activeClarId && (!hasNormalIntake || dualMode === "l2"));
  const showIntake = Boolean(activeCaseId && !showL2);

  const detail = useQuery({
    queryKey: ["case", activeCaseId],
    queryFn: () => getCase(activeCaseId!),
    enabled: showIntake,
  });

  return (
    <DialogPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dei-sheet-overlay" />
        <DialogPrimitive.Content
          className="dei-sheet"
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">
            {showL2
              ? `L2 clarification review${queueItem ? ` for ${queueItem.candidateName}` : ""}`
              : detail.data
                ? `Review ${detail.data.subject.fullName}`
                : "Case review"}
          </DialogPrimitive.Title>
          <aside className="dei-review-wrap" aria-label="Intake review">
            <Button
              variant="ghost"
              size="icon"
              className="dei-sheet-close"
              aria-label="Close review"
              onClick={onClose}
            >
              <X aria-hidden />
            </Button>

            {showL2 && activeClarId ? (
              <div className="h-full space-y-3 overflow-y-auto p-5 pr-14">
                {hasNormalIntake || l2List.length > 1 ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {l2List.length > 1 ? (
                      <div
                        className="flex flex-wrap gap-1.5"
                        role="group"
                        aria-label="Pending L2 checks"
                      >
                        {l2List.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => onSelectClarification(entry.id)}
                            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                              activeClarId === entry.id
                                ? "bg-indigo-600 text-white"
                                : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {entry.checkType ? readableCheck(entry.checkType) : "Clarification"} · v
                            {entry.submittedDocumentVersion ?? "?"}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span />
                    )}
                    {hasNormalIntake ? (
                      <div className="ops-segment" role="group" aria-label="Review mode">
                        <button type="button" aria-pressed onClick={() => setDualMode("l2")}>
                          L2 Re-entry
                        </button>
                        <button
                          type="button"
                          aria-pressed={false}
                          onClick={() => setDualMode("intake")}
                        >
                          Intake review
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <DataEntryL2ReentryDrawer
                  clarificationId={activeClarId}
                  hideHeaderClose
                  onClose={onClose}
                  onCompleted={async () => {
                    await invalidateWorkflow(queryClient);
                    onClose();
                  }}
                />
              </div>
            ) : (
              <>
                {activeClarId && hasNormalIntake ? (
                  <div className="border-b border-slate-200 bg-slate-50 px-5 py-2 pr-14">
                    <div className="ops-segment" role="group" aria-label="Review mode">
                      <button type="button" aria-pressed={false} onClick={() => setDualMode("l2")}>
                        L2 Re-entry ({l2List.length})
                      </button>
                      <button type="button" aria-pressed onClick={() => setDualMode("intake")}>
                        Intake review
                      </button>
                    </div>
                  </div>
                ) : null}
                {detail.isPending ? (
                  <div className="dei-panel-pad">
                    <ListSkeleton rows={8} />
                  </div>
                ) : null}
                {detail.isError ? (
                  <div className="dei-panel-pad">
                    <ErrorState
                      description={detail.error.message}
                      onRetry={() => void detail.refetch()}
                      retrying={detail.isFetching}
                    />
                  </div>
                ) : null}
                {detail.data ? (
                  <DataEntryReviewBody item={detail.data} queueItem={queueItem} onClose={onClose} />
                ) : null}
              </>
            )}
          </aside>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
