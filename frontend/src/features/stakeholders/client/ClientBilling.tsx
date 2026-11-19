import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Button, Card, CardHeader, ErrorText, Loading, Segmented, Select, Th } from "@/kit";
import { getClientFinanceOverview, listClientInvoices } from "@/lib/backend-api/client-finance";
import { ClientWorkspaceHeader } from "./ClientWorkspaceHeader";
import { MonthlyStatement } from "../finance/MonthlyStatement";
import { ClientEmpty, ClientPager, ClientSearch, ClientSummary } from "./ClientPageParts";
import { ClientInvoiceRow } from "./ClientInvoiceRow";
import { invoiceMoney } from "./client-billing-format";

const QUICK_FILTERS = [
  ["", "All invoices"],
  ["OVERDUE", "Overdue"],
  ["PAID", "Paid"],
] as const;
const STATUSES = [
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CREDITED",
  "SETTLED",
  "CANCELLED",
];

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
        <Card label="Balance summary unavailable">
          <ErrorText onRetry={() => void overview.refetch()} retrying={overview.isFetching}>
            Balance summary unavailable: {overview.error.message}
          </ErrorText>
        </Card>
      )}
      {overview.isPending && <Loading>Loading balances…</Loading>}
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
      <Card label="Invoice register">
        <CardHeader
          title="Invoice register"
          description="Open a row for its payment and credit breakdown."
          aside={
            <Segmented<string>
              label="Quick invoice filters"
              className="max-w-full overflow-x-auto"
              value={status}
              onChange={changeStatus}
              options={QUICK_FILTERS}
            />
          }
        />
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <ClientSearch
            label="Search invoice number"
            value={input}
            onChange={setInput}
            onSubmit={() => {
              setSearch(input.trim());
              resetPage();
            }}
          />
          <Select
            aria-label="Invoice status"
            className="w-auto min-w-[160px]"
            value={status}
            onChange={(e) => changeStatus(e.target.value)}
          >
            <option value="">All statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
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
          <span role="status" className="ml-auto text-xs text-dim">
            {invoices.isFetching
              ? "Updating invoices…"
              : invoices.isError
                ? "Results unavailable"
                : `${invoices.data?.items.length ?? 0} on this page`}
          </span>
        </div>
        {invoices.isError && (
          <ErrorText onRetry={() => void invoices.refetch()} retrying={invoices.isFetching}>
            {invoices.error.message}
          </ErrorText>
        )}
        {invoices.isPending ? (
          <Loading>Loading invoices…</Loading>
        ) : invoices.data ? (
          <>
            <div className="overflow-x-auto" aria-busy={invoices.isFetching}>
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Your organisation's invoices</caption>
                <thead>
                  <tr>
                    <Th>Invoice</Th>
                    <Th>Due date</Th>
                    <Th align="right">Total</Th>
                    <Th align="right">Balance</Th>
                    <Th>Status</Th>
                    <Th align="right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.data.items.map((invoice) => (
                    <ClientInvoiceRow
                      key={invoice.id}
                      invoice={invoice}
                      stale={invoices.isPlaceholderData}
                      allowDownload
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
              : "Download any invoice as PDF here. Statements and exports are in Reports."
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
      </Card>
      {overview.data && (
        <Card label="Outstanding ageing">
          <CardHeader
            title="Outstanding by age"
            description="Recorded ledger balances across ageing buckets."
          />
          <dl className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-5">
            {overview.data.ageing.map((bucket) => (
              <div
                key={bucket.label}
                className="flex min-w-0 flex-col gap-1 rounded-md border border-line bg-subtle/50 px-3 py-2.5"
              >
                <dt className="truncate text-[11px] font-semibold tracking-wider text-dim uppercase">
                  {bucket.label}
                </dt>
                <dd className="font-mono text-base font-semibold text-ink tabular-nums">
                  {invoiceMoney(bucket.value)}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </>
  );
}
