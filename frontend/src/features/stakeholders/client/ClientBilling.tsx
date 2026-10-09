import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import { getClientFinanceOverview, listClientInvoices } from "@/lib/backend-api/client-finance";
import { ClientWorkspaceHeader } from "./ClientWorkspaceHeader";
import { MonthlyStatement } from "../finance/MonthlyStatement";
import { ClientEmpty, ClientPager, ClientSearch, ClientSummary } from "./ClientPageParts";
import { ClientInvoiceRow } from "./ClientInvoiceRow";
import { invoiceMoney } from "./client-billing-format";

export function ClientBilling({ reportMode = false }: { reportMode?: boolean }) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const overview = useQuery({
    queryKey: ["client-finance", "overview"],
    queryFn: getClientFinanceOverview,
  });
  const invoices = useQuery({
    queryKey: ["client-finance", "invoices", search, status, cursor, 8],
    queryFn: () => listClientInvoices({ search, status, cursor, limit: 8 }),
    placeholderData: keepPreviousData,
  });
  const resetPage = () => {
    setCursor(undefined);
    setHistory([]);
  };
  const changeStatus = (value: string) => {
    setStatus(value);
    resetPage();
  };
  const summary = overview.data?.summary;
  return (
    <>
      <ClientWorkspaceHeader
        title={reportMode ? "Invoice documents" : "Invoices & payments"}
        description="Reports reach you right after QC; billing is monthly. Track invoices, payments and balances here."
        actions={reportMode ? <MonthlyStatement ownClient /> : undefined}
      />
      {overview.isError && (
        <ErrorState
          title="Balance summary unavailable"
          description={overview.error.message}
          onRetry={() => void overview.refetch()}
          retrying={overview.isFetching}
        />
      )}
      {overview.isPending && <ListSkeleton rows={1} />}
      {summary && (
        <ClientSummary
          items={[
            {
              label: "Total billed",
              value: invoiceMoney(summary.billed),
              detail: `${summary.invoiceCount} invoices`,
            },
            {
              label: "Payments received",
              value: invoiceMoney(summary.collected),
              tone: "green",
              detail: "Recorded by Finance",
            },
            {
              label: "Outstanding",
              value: invoiceMoney(summary.outstanding),
              tone: "amber",
              detail: `${summary.openInvoiceCount} open invoices`,
            },
            {
              label: "Overdue balance",
              value: invoiceMoney(summary.overdueAmount),
              tone: "red",
              detail: `${summary.overdueCount} overdue invoices`,
            },
          ]}
        />
      )}
      <section className="client-register" aria-label="Invoice register">
        <div className="client-register-title">
          <div>
            <h2>Invoice register</h2>
            <p>Open a row for its payment and credit breakdown.</p>
          </div>
          <div className="client-segments" role="group" aria-label="Quick invoice filters">
            {[
              ["", "All invoices"],
              ["OVERDUE", "Overdue"],
              ["PAID", "Paid"],
            ].map(([value, label]) => (
              <button
                key={label}
                aria-pressed={status === value}
                onClick={() => changeStatus(value!)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="client-register-toolbar">
          <ClientSearch
            label="Search invoice number"
            value={input}
            onChange={setInput}
            onSubmit={() => {
              setSearch(input.trim());
              resetPage();
            }}
          />
          <select
            aria-label="Invoice status"
            value={status}
            onChange={(e) => changeStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {[
              "ISSUED",
              "PARTIALLY_PAID",
              "PAID",
              "OVERDUE",
              "CREDITED",
              "SETTLED",
              "CANCELLED",
            ].map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          {(search || status) && (
            <Button
              variant="ghost"
              onClick={() => {
                setInput("");
                setSearch("");
                changeStatus("");
              }}
            >
              Clear filters
            </Button>
          )}
          <span role="status" className="client-register-meta">
            {invoices.isFetching
              ? "Updating invoices…"
              : invoices.isError
                ? "Results unavailable"
                : `${invoices.data?.items.length ?? 0} on this page`}
          </span>
        </div>
        {invoices.isError && (
          <ErrorState
            description={invoices.error.message}
            onRetry={() => void invoices.refetch()}
            retrying={invoices.isFetching}
          />
        )}
        {invoices.isPending ? (
          <ListSkeleton rows={4} />
        ) : invoices.data ? (
          <>
            <div className="client-register-scroll" aria-busy={invoices.isFetching}>
              <table>
                <caption className="sr-only">Your organisation's invoices</caption>
                <thead>
                  <tr>
                    {["Invoice", "Due date", "Total", "Balance", "Status", "Actions"].map(
                      (label) => (
                        <th scope="col" key={label}>
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {invoices.data.items.map((invoice) => (
                    <ClientInvoiceRow
                      key={invoice.id}
                      invoice={invoice}
                      stale={invoices.isPlaceholderData}
                      allowDownload={reportMode}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            {!invoices.data.items.length && (
              <ClientEmpty title="No matching invoices">
                Try another invoice number or clear your filters.
              </ClientEmpty>
            )}
          </>
        ) : null}
        <ClientPager
          page={history.length + 1}
          previous={!!history.length}
          next={!!invoices.data?.nextCursor}
          busy={invoices.isFetching || invoices.isError}
          detail={
            reportMode
              ? "Download invoices or your monthly statement here."
              : "PDFs, statements and customised exports are available in Reports."
          }
          onPrevious={() => {
            const previous = [...history];
            setCursor(previous.pop());
            setHistory(previous);
          }}
          onNext={() => {
            if (!invoices.data?.nextCursor) return;
            setHistory([...history, cursor]);
            setCursor(invoices.data.nextCursor);
          }}
        />
      </section>
      {overview.data && (
        <section className="client-panel client-ageing" aria-label="Outstanding ageing">
          <div>
            <h2>Outstanding by age</h2>
            <p className="client-muted">Recorded ledger balances across ageing buckets.</p>
          </div>
          <dl>
            {overview.data.ageing.map((bucket) => (
              <div key={bucket.label}>
                <dt>{bucket.label}</dt>
                <dd>{invoiceMoney(bucket.value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </>
  );
}
