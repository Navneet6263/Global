import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, FileCheck2 } from "lucide-react";
import { listBillingReady, type BillingReadyReport } from "@/lib/backend-api/billing-ready";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";

const hasPositiveCharge = (report: BillingReadyReport) =>
  report.lines.some((line) => line.quantity > 0 && Number(line.unitPrice) > 0);

export function BillingReadyReports({
  onInvoice,
}: {
  onInvoice: (report: BillingReadyReport) => void;
}) {
  const [cursor, setCursor] = useState<string>();
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const query = useQuery({
    queryKey: ["finance", "billing-ready", cursor],
    queryFn: () => listBillingReady(cursor),
    placeholderData: keepPreviousData,
  });
  return (
    <section className="rounded-3xl border border-mint/25 bg-gradient-to-br from-mint-soft/30 to-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <FileCheck2 className="size-4 text-mint-deep" /> Reports ready for billing
      </h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Approved, prepared reports awaiting an invoice. Contracted case prices are prefilled.
      </p>
      {query.isPending ? (
        <ListSkeleton rows={2} />
      ) : query.isError ? (
        <ErrorState description={query.error.message} onRetry={() => void query.refetch()} />
      ) : (
        <div
          className="mt-4 min-h-32 space-y-2"
          inert={query.isPlaceholderData}
          aria-busy={query.isFetching}
        >
          {query.isFetching ? (
            <p role="status" className="text-xs text-muted-foreground">
              Updating reports…
            </p>
          ) : null}
          {query.data.items.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No prepared reports are awaiting billing.
            </p>
          ) : (
            query.data.items.map((report) => (
              <div
                key={report.reportId}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <div>
                  <p className="text-xs font-semibold">
                    {report.caseNumber} · {report.candidateName}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {report.client.displayName} · Report v{report.reportVersion}
                  </p>
                  {!hasPositiveCharge(report) && (
                    <p className="mt-2 max-w-lg text-[11px] text-warning-foreground">
                      No positive contracted charge. Finance must review the commercial terms before
                      billing.
                    </p>
                  )}
                </div>
                <button
                  onClick={() => onInvoice(report)}
                  disabled={!hasPositiveCharge(report)}
                  className="rounded-full bg-mint-soft px-4 py-2 text-xs font-semibold text-mint-deep disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Prepare invoice
                </button>
              </div>
            ))
          )}
        </div>
      )}
      <div className="mt-3 flex items-center justify-end gap-2 text-xs">
        <span className="mr-2 text-muted-foreground">Page {history.length + 1}</span>
        <button
          aria-label="Previous billing-ready page"
          disabled={!history.length || query.isFetching}
          onClick={() => {
            const past = [...history];
            setCursor(past.pop());
            setHistory(past);
          }}
          className="rounded-full border border-border bg-card p-2 disabled:opacity-30"
        >
          <ArrowLeft className="size-3.5" />
        </button>
        <button
          aria-label="Next billing-ready page"
          disabled={!query.data?.nextCursor || query.isFetching}
          onClick={() => {
            setHistory([...history, cursor]);
            setCursor(query.data?.nextCursor ?? undefined);
          }}
          className="rounded-full border border-border bg-card p-2 disabled:opacity-30"
        >
          <ArrowRight className="size-3.5" />
        </button>
      </div>
    </section>
  );
}
