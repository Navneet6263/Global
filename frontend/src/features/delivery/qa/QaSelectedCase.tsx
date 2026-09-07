import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { getQaDetail, type QaRegisterItem } from "@/lib/backend-api/qa-register";
import { QaReviewPanel } from "./QaReviewPanel";
import { WorkspaceEmpty, WorkspaceError, WorkspaceLoading } from "../WorkspaceStates";

export function QaSelectedCase({
  item,
  reviewerId,
  onRefresh,
}: {
  item: QaRegisterItem;
  reviewerId?: string | undefined;
  onRefresh: () => Promise<void>;
}) {
  const client = useQueryClient();
  const detail = useQuery({
    queryKey: ["qa", "detail", item.id],
    queryFn: ({ signal }) => getQaDetail(item.id, signal),
    enabled: item.status === "QA_REVIEW",
  });
  const detailVersion = detail.data?.version;
  useEffect(() => {
    if (
      item.status === "QA_REVIEW" &&
      detailVersion !== undefined &&
      item.version !== detailVersion
    ) {
      void client.invalidateQueries({
        queryKey: item.version > detailVersion ? ["qa", "detail", item.id] : ["qa", "register"],
      });
    }
  }, [client, item.id, item.status, item.version, detailVersion]);
  if (item.status !== "QA_REVIEW")
    return (
      <section className="rounded-3xl border bg-white/85 p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold">{item.subject.fullName}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {item.caseNumber} · Waiting on verification corrections
        </p>
        <p className="mt-5 text-xs font-medium text-amber-800">Latest return reason</p>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">
          {item.correctionReason || "No return reason recorded"}
        </p>
        <WorkspaceEmpty
          title="Verifier work is in progress"
          detail="This case will return to the review queue when its required checks are completed. A fresh QA claim will then be required."
        />
      </section>
    );
  return (
    <div className="min-w-0 space-y-3">
      {detail.isPending ? <WorkspaceLoading label="Opening selected case evidence" /> : null}
      {detail.isError ? (
        <WorkspaceError message={detail.error.message} onRetry={() => void onRefresh()} />
      ) : null}
      {detail.data ? (
        <QaReviewPanel
          item={detail.data}
          reviewerId={reviewerId}
          onRefresh={onRefresh}
          refreshing={detail.isFetching || detail.isError || item.version !== detail.data.version}
        />
      ) : null}
    </div>
  );
}
