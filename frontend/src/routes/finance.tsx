import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CircleDollarSign, FilePlus2, Landmark, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";

import { FinanceInsights } from "@/features/stakeholders/finance/FinanceInsights";
import { InvoiceDetailDrawer } from "@/features/stakeholders/finance/InvoiceDetailDrawer";
import { InvoiceForm } from "@/features/stakeholders/finance/InvoiceForm";
import { InvoiceRegister } from "@/features/stakeholders/finance/InvoiceRegister";
import { PaymentForm } from "@/features/stakeholders/finance/PaymentForm";
import { money } from "@/features/stakeholders/finance/finance-utils";
import {
  StakeholderHeader,
  StakeholderKpis,
  StakeholderShell,
} from "@/features/stakeholders/StakeholderShell";
import { getSession } from "@/lib/api/auth";
import { getFinanceOverview, listInvoices, type Invoice } from "@/lib/api/finance";

export const Route = createFileRoute("/finance")({
  head: () => ({ meta: [{ title: "Finance & Billing — Sapling Global" }] }),
  component: FinancePage,
});

function FinancePage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [cursor, setCursor] = useState<string>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [paymentFor, setPaymentFor] = useState<Invoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setCursor(undefined);
      setCursorHistory([]);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  const session = useQuery({ queryKey: ["session"], queryFn: getSession, staleTime: 60_000 });
  const overview = useQuery({ queryKey: ["finance", "overview"], queryFn: getFinanceOverview });
  const invoices = useQuery({
    queryKey: ["finance", "invoices", search, status, cursor],
    queryFn: () => listInvoices({ search, status, limit: 25, ...(cursor ? { cursor } : {}) }),
  });
  const data = overview.data;
  const rows = invoices.data?.items ?? [];
  const billed = data?.summary.billed ?? 0;
  const collected = data?.summary.collected ?? 0;
  return (
    <StakeholderShell
      onRefresh={() => {
        void overview.refetch();
        void invoices.refetch();
      }}
      refreshing={overview.isFetching || invoices.isFetching}
    >
      <StakeholderHeader
        eyebrow="Stakeholders / Finance"
        title="Revenue control"
        description="Issue invoices, monitor receivables and record collections with a complete server-validated trail."
        action={
          <button
            type="button"
            onClick={() => setShowCreate((value) => !value)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white shadow-sm"
          >
            <FilePlus2 className="h-4 w-4" /> Issue invoice
          </button>
        }
      />
      {overview.isError || invoices.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {overview.error?.message ?? invoices.error?.message}
        </div>
      ) : null}
      {showCreate ? <InvoiceForm onClose={() => setShowCreate(false)} /> : null}
      {paymentFor ? <PaymentForm invoice={paymentFor} onClose={() => setPaymentFor(null)} /> : null}
      {selectedInvoice ? (
        <InvoiceDetailDrawer
          invoice={selectedInvoice}
          canWrite={Boolean(
            session.data?.permissions.includes("*") ||
            session.data?.permissions.includes("finance:write"),
          )}
          onClose={() => setSelectedInvoice(null)}
          onPayment={() => {
            setPaymentFor(selectedInvoice);
            setSelectedInvoice(null);
          }}
        />
      ) : null}
      <StakeholderKpis
        items={[
          {
            label: "Billed",
            value: money(billed),
            detail: `${data?.summary.invoiceCount ?? 0} invoices in register`,
            icon: CircleDollarSign,
            tone: "blue",
            progress: billed ? 100 : 0,
          },
          {
            label: "Collected",
            value: money(collected),
            detail: billed
              ? `${Math.round((collected / billed) * 100)}% revenue realised`
              : "No collections recorded",
            icon: Landmark,
            tone: "emerald",
            progress: ratio(collected, billed),
          },
          {
            label: "Outstanding",
            value: money(data?.summary.outstanding ?? 0),
            detail: `${data?.summary.openInvoiceCount ?? 0} open invoices`,
            icon: WalletCards,
            tone: "orange",
            progress: ratio(data?.summary.outstanding ?? 0, billed),
          },
          {
            label: "Overdue",
            value: money(data?.summary.overdueAmount ?? 0),
            detail: `${data?.summary.overdueCount ?? 0} invoices beyond due date`,
            icon: AlertTriangle,
            tone: data?.summary.overdueCount ? "red" : "emerald",
            progress: ratio(data?.summary.overdueAmount ?? 0, billed),
          },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
        <InvoiceRegister
          items={rows}
          search={searchInput}
          status={status}
          page={cursorHistory.length + 1}
          hasPrevious={cursorHistory.length > 0}
          hasNext={Boolean(invoices.data?.nextCursor)}
          onSearch={setSearchInput}
          onStatus={(value) => {
            setStatus(value);
            setCursor(undefined);
            setCursorHistory([]);
          }}
          onPrevious={() => {
            const history = [...cursorHistory];
            setCursor(history.pop());
            setCursorHistory(history);
          }}
          onNext={() => {
            const next = invoices.data?.nextCursor;
            if (!next) return;
            setCursorHistory((current) => [...current, cursor]);
            setCursor(next);
          }}
          onOpen={setSelectedInvoice}
        />
        <FinanceInsights data={data} />
      </div>
    </StakeholderShell>
  );
}
function ratio(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}
