import { useDeferredValue, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Download, ReceiptIndianRupee, Search } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/feedback/error-state";
import { ListSkeleton } from "@/components/feedback/skeletons";
import {
  downloadClientInvoice,
  getClientFinanceOverview,
  listClientInvoices,
} from "@/lib/backend-api/client-finance";
import { ClientWorkspaceHeader } from "./ClientWorkspaceHeader";
import { MonthlyStatement } from "../finance/MonthlyStatement";

const money = (value: number | string) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value));
const date = (value: string | null) => (value ? new Date(value).toLocaleDateString("en-IN") : "—");

export function ClientBilling() {
  const [search, setSearch] = useState("");
  const deferred = useDeferredValue(search.trim());
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [history, setHistory] = useState<Array<string | undefined>>([]);
  const overview = useQuery({
    queryKey: ["client-finance", "overview"],
    queryFn: getClientFinanceOverview,
  });
  const invoices = useQuery({
    queryKey: ["client-finance", "invoices", deferred, status, cursor],
    queryFn: () => listClientInvoices({ search: deferred, status, cursor }),
  });
  const download = useMutation({
    mutationFn: downloadClientInvoice,
    onError: (error) => toast.error(error.message),
  });
  const resetPage = () => {
    setCursor(undefined);
    setHistory([]);
  };
  const summary = overview.data?.summary;
  const error = invoices.error ?? overview.error;
  return (
    <>
      <ClientWorkspaceHeader
        title="Invoices & payments"
        description="Your organisation's invoices, recorded payments and outstanding balance."
      />
      <div className="flex justify-end">
        <MonthlyStatement ownClient />
      </div>
      {error ? (
        <ErrorState
          description={error.message}
          onRetry={() => {
            void invoices.refetch();
            void overview.refetch();
          }}
        />
      ) : null}
      {summary ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              title: "Total billed",
              value: summary.billed,
              tone: "from-info-soft/65 border-info/20",
            },
            {
              title: "Payments received",
              value: summary.collected,
              tone: "from-mint-soft/70 border-mint/25",
            },
            {
              title: "Outstanding",
              value: summary.outstanding,
              tone: "from-warning-soft/65 border-warning/20",
            },
            {
              title: "Overdue",
              value: summary.overdueAmount,
              tone: "from-critical-soft/55 border-critical/20",
            },
          ].map((metric) => (
            <div
              key={metric.title}
              className={`rounded-3xl border bg-gradient-to-br ${metric.tone} to-card p-5 shadow-[var(--shadow-card)]`}
            >
              <p className="text-xs text-muted-foreground">{metric.title}</p>
              <p className="num mt-3 text-2xl font-semibold tracking-tight">
                {money(metric.value)}
              </p>
            </div>
          ))}
        </div>
      ) : null}
      <section className="surface overflow-hidden rounded-3xl border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ReceiptIndianRupee className="size-4 text-primary" /> Invoice register
          </h2>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 rounded-full border border-border px-3">
              <Search className="size-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  resetPage();
                }}
                placeholder="Search invoice number"
                aria-label="Search invoice number"
                className="h-9 w-44 bg-transparent text-xs outline-none"
              />
            </label>
            <select
              aria-label="Invoice status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                resetPage();
              }}
              className="h-9 rounded-full border border-border bg-card px-3 text-xs"
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
          </div>
        </div>
        {invoices.isPending ? <ListSkeleton rows={4} /> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                {["Invoice", "Issued / due", "Total", "Balance", "Status", ""].map((label, i) => (
                  <th key={i} className="px-5 py-3 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {invoices.data?.items.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-muted/20">
                  <td className="px-5 py-4 font-medium">{invoice.invoiceNumber}</td>
                  <td className="px-5 py-4">
                    {date(invoice.issuedAt)}
                    <span className="mt-1 block text-muted-foreground">
                      Due {date(invoice.dueAt)}
                    </span>
                  </td>
                  <td className="num px-5 py-4">{money(invoice.totalAmount)}</td>
                  <td className="num px-5 py-4 font-semibold">{money(invoice.balance)}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] ${invoice.status === "OVERDUE" ? "bg-critical-soft text-critical" : invoice.balance === 0 ? "bg-mint-soft text-mint-deep" : "bg-warning-soft text-warning-foreground"}`}
                    >
                      {invoice.status.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => download.mutate(invoice)}
                      disabled={download.isPending}
                      aria-busy={download.isPending && download.variables?.id === invoice.id}
                      className="rounded-full border border-border p-2 hover:bg-muted disabled:opacity-40"
                      aria-label={`Download ${invoice.invoiceNumber}`}
                    >
                      <Download className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {invoices.data?.items.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No invoices match these filters.
          </p>
        ) : null}
        <footer className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground">
          <span>Page {history.length + 1} · Payments are confirmed by Finance.</span>
          <div className="flex gap-2">
            <button
              aria-label="Previous invoices"
              disabled={!history.length || invoices.isFetching}
              onClick={() => {
                const next = [...history];
                setCursor(next.pop());
                setHistory(next);
              }}
              className="rounded-full border border-border p-2 disabled:opacity-30"
            >
              <ArrowLeft className="size-4" />
            </button>
            <button
              aria-label="Next invoices"
              disabled={!invoices.data?.nextCursor || invoices.isFetching}
              onClick={() => {
                setHistory([...history, cursor]);
                setCursor(invoices.data?.nextCursor ?? undefined);
              }}
              className="rounded-full border border-border p-2 disabled:opacity-30"
            >
              <ArrowRight className="size-4" />
            </button>
          </div>
        </footer>
      </section>
    </>
  );
}
