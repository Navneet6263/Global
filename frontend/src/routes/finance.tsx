import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FilePlus2 } from "lucide-react";
import { useEffect, useState } from "react";

import { ErrorState } from "@/components/feedback/error-state";
import { CardGridSkeleton, TableSkeleton } from "@/components/feedback/skeletons";
import { FinanceInsights } from "@/features/stakeholders/finance/FinanceInsights";
import { FinanceSummary } from "@/features/stakeholders/finance/FinanceSummary";
import { CreditNoteForm } from "@/features/stakeholders/finance/CreditNoteForm";
import { InvoiceDetailDrawer } from "@/features/stakeholders/finance/InvoiceDetailDrawer";
import { InvoiceForm } from "@/features/stakeholders/finance/InvoiceForm";
import { InvoiceRegister } from "@/features/stakeholders/finance/InvoiceRegister";
import { PaymentForm } from "@/features/stakeholders/finance/PaymentForm";
import { StakeholderHeader, StakeholderShell } from "@/features/stakeholders/StakeholderShell";
import { getSession } from "@/lib/api/auth";
import { getFinanceOverview, listInvoices, type Invoice } from "@/lib/api/finance";
import { requireRoleWorkspace } from "@/lib/auth/route-guard";

export const Route = createFileRoute("/finance")({
  head: () => ({ meta: [{ title: "Finance & Billing — Sapling Global" }] }),
  beforeLoad: () => requireRoleWorkspace(["FINANCE_MANAGER"]),
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
  const [creditFor, setCreditFor] = useState<Invoice | null>(null);
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
  const canWrite = Boolean(
    session.data?.permissions.includes("*") || session.data?.permissions.includes("finance:write"),
  );
  const hasError = overview.isError || invoices.isError;
  const isPending = overview.isPending || invoices.isPending;
  return (
    <StakeholderShell
      workspace="finance"
      onRefresh={() => {
        void overview.refetch();
        void invoices.refetch();
      }}
      refreshing={overview.isFetching || invoices.isFetching}
    >
      <StakeholderHeader
        eyebrow="Finance · Billing workspace"
        title="Revenue control"
        description="Issue invoices, reconcile collections and act on ageing receivables with a complete server-validated trail."
        action={
          canWrite ? (
            <button
              type="button"
              onClick={() => setShowCreate((value) => !value)}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-card)] transition hover:-translate-y-px hover:shadow-[var(--shadow-raise)]"
            >
              <FilePlus2 className="size-4" /> Issue invoice
            </button>
          ) : null
        }
      />
      {hasError ? (
        <ErrorState
          description={
            overview.error?.message ?? invoices.error?.message ?? "Finance data failed to load."
          }
          onRetry={() => {
            void overview.refetch();
            void invoices.refetch();
          }}
          retrying={overview.isFetching || invoices.isFetching}
        />
      ) : null}
      {showCreate ? <InvoiceForm onClose={() => setShowCreate(false)} /> : null}
      {paymentFor ? <PaymentForm invoice={paymentFor} onClose={() => setPaymentFor(null)} /> : null}
      {creditFor ? <CreditNoteForm invoice={creditFor} onClose={() => setCreditFor(null)} /> : null}
      {selectedInvoice ? (
        <InvoiceDetailDrawer
          invoice={selectedInvoice}
          canWrite={canWrite}
          onClose={() => setSelectedInvoice(null)}
          onPayment={() => {
            setPaymentFor(selectedInvoice);
            setSelectedInvoice(null);
          }}
          onCredit={() => {
            setCreditFor(selectedInvoice);
            setSelectedInvoice(null);
          }}
        />
      ) : null}
      {isPending ? (
        <div className="space-y-5" aria-label="Loading finance workspace">
          <CardGridSkeleton count={4} />
          <TableSkeleton rows={7} />
        </div>
      ) : (
        <>
          <FinanceSummary data={data} />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.45fr)]">
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
        </>
      )}
    </StakeholderShell>
  );
}
