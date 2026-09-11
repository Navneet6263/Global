import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { getPrivacyEvents, getPrivacyRecord, privacyLabel } from "@/lib/backend-api/privacy";
import { formatDateTime } from "@/lib/formatting";
import { PrivacyDecision } from "./PrivacyDecision";

export function PrivacyRecordDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const query = useQuery({ queryKey: ["privacy", id], queryFn: () => getPrivacyRecord(id) });
  const [page, setPage] = useState(1);
  const events = useQuery({
    queryKey: ["privacy", id, "events", page],
    queryFn: () => getPrivacyEvents(id, page),
  });
  const record = query.data;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle>{record?.title ?? "Privacy record"}</DialogTitle>
          <DialogDescription>
            Restricted admin record. Every decision is attributed and version controlled.
          </DialogDescription>
        </DialogHeader>
        {query.isPending ? <ListSkeleton rows={4} /> : null}
        {query.isError ? (
          <ErrorState description={query.error.message} onRetry={() => void query.refetch()} />
        ) : null}
        {record ? (
          <>
            <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
              <section className="space-y-4 rounded-2xl border border-border p-4">
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-info-soft px-3 py-1 text-info-foreground">
                    {privacyLabel(record.kind)}
                  </span>
                  <span className="rounded-full bg-review-soft px-3 py-1 text-review-foreground">
                    {privacyLabel(record.status)}
                  </span>
                  {record.severity ? (
                    <span className="rounded-full bg-warning-soft px-3 py-1 text-warning-foreground">
                      {privacyLabel(record.severity)}
                    </span>
                  ) : null}
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                  {record.description}
                </p>
                <dl className="grid gap-3 text-xs">
                  {record.subjectReference ? (
                    <div>
                      <dt className="text-muted-foreground">Subject / case reference</dt>
                      <dd className="mt-1 break-words">{record.subjectReference}</dd>
                    </div>
                  ) : null}
                  {record.requestType ? (
                    <div>
                      <dt className="text-muted-foreground">Request type</dt>
                      <dd className="mt-1">{privacyLabel(record.requestType)}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-muted-foreground">Recorded by</dt>
                    <dd className="mt-1">
                      {record.createdBy.displayName} · {formatDateTime(record.createdAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Latest decision by</dt>
                    <dd className="mt-1">
                      {record.updatedBy.displayName} · {formatDateTime(record.updatedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Review target</dt>
                    <dd className="mt-1">
                      {record.dueAt ? formatDateTime(record.dueAt) : "Not set"}
                    </dd>
                  </div>
                </dl>
                {record.resolutionNote ? (
                  <div className="rounded-xl bg-secondary/50 p-3 text-xs">
                    <p className="font-semibold">Latest rationale</p>
                    <p className="mt-1 whitespace-pre-wrap break-words">{record.resolutionNote}</p>
                    {record.evidenceReference ? (
                      <p className="mt-2 break-words">Reference: {record.evidenceReference}</p>
                    ) : null}
                  </div>
                ) : null}
              </section>
              <PrivacyDecision key={record.version} record={record} />
            </div>
            <section className="overflow-hidden rounded-2xl border border-border">
              <h3 className="px-4 pt-4 text-sm font-semibold">Decision timeline</h3>
              {events.isPending ? (
                <div className="p-4">
                  <ListSkeleton rows={3} />
                </div>
              ) : null}
              {events.isError ? (
                <div className="p-4">
                  <ErrorState
                    description={events.error.message}
                    onRetry={() => void events.refetch()}
                  />
                </div>
              ) : null}
              <ol className="divide-y divide-border px-4">
                {events.data?.items.map((event) => (
                  <li key={event.id} className="py-3 text-xs">
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="font-medium">
                        {event.actor?.displayName ?? "System"} ·{" "}
                        {event.after?.status ? privacyLabel(event.after.status) : "Recorded"}
                      </p>
                      <time className="text-muted-foreground">
                        {formatDateTime(event.createdAt)}
                      </time>
                    </div>
                    {event.before?.status ? (
                      <p className="mt-1 text-muted-foreground">
                        From {privacyLabel(event.before.status)}
                      </p>
                    ) : null}
                    <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">
                      {event.after?.note ?? event.after?.description}
                    </p>
                    {event.after?.evidenceReference ? (
                      <p className="mt-1 break-words">Reference: {event.after.evidenceReference}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
              {events.data ? (
                <PaginationBar
                  page={page}
                  pageSize={8}
                  total={events.data.total}
                  onPageChange={setPage}
                  label="decisions"
                />
              ) : null}
            </section>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
