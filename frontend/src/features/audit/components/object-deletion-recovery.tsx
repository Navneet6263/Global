import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, DatabaseZap, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PaginationBar } from "@/components/layout/pagination-bar";
import { Button } from "@/components/ui/button";
import {
  listFailedObjectDeletions,
  requeueObjectDeletion,
} from "@/lib/backend-api/object-deletions";

const recoveryKey = ["object-deletion-recovery"] as const;

export function ObjectDeletionRecovery() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const failures = useQuery({
    queryKey: [...recoveryKey, page],
    queryFn: () => listFailedObjectDeletions(page),
    refetchInterval: 60_000,
  });
  const requeue = useMutation({
    mutationFn: requeueObjectDeletion,
    onSuccess: () => {
      toast.success("Secure object deletion requeued");
      void queryClient.invalidateQueries({ queryKey: recoveryKey });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Requeue failed"),
  });

  if (failures.isPending || (!failures.isError && !failures.data?.total)) return null;

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-rose-200 bg-rose-50/55 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-200/80 px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-rose-600 shadow-sm">
            <DatabaseZap className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-semibold text-foreground">Storage deletion recovery</h2>
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              Evidence retention jobs that exhausted automatic retries remain preserved here.
            </p>
          </div>
        </div>
        {failures.data?.total ? (
          <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
            {failures.data.total} need attention
          </span>
        ) : null}
      </div>

      {failures.isError ? (
        <div className="flex items-center gap-2 px-5 py-4 text-sm text-rose-700">
          <AlertTriangle className="size-4" aria-hidden /> Recovery queue could not be loaded.
          <Button variant="outline" size="sm" onClick={() => void failures.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="divide-y divide-rose-200/70">
            {(failures.data?.items ?? []).map((failure) => (
              <div key={failure.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {failure.objectKey ?? `Deletion job ${failure.id}`}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Job {failure.id} · {failure.attempts} attempts · failed{" "}
                    {formatDate(failure.processedAt)}
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={!failure.recoverable || requeue.isPending}
                  loading={requeue.isPending && requeue.variables === failure.id}
                  onClick={() => requeue.mutate(failure.id)}
                >
                  <RotateCcw className="size-3.5" aria-hidden /> Requeue safely
                </Button>
              </div>
            ))}
          </div>
          <PaginationBar
            page={page}
            pageSize={failures.data?.pageSize ?? 5}
            total={failures.data?.total ?? 0}
            onPageChange={setPage}
            label="failed deletion jobs"
          />
        </>
      )}
    </section>
  );
}

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      )
    : "recently";
}
