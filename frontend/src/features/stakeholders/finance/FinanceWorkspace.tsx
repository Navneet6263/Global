import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { FilePlus2 } from "lucide-react";
import { useEffect, useState } from "react";

import { ErrorState } from "@/components/feedback/error-state";
import { CardGridSkeleton } from "@/components/feedback/skeletons";
import { FinanceInsights } from "@/features/stakeholders/finance/FinanceInsights";
import { FinanceSummary } from "@/features/stakeholders/finance/FinanceSummary";
import { FinanceOverviewLinks, FinanceStatements } from "./FinancePages";
import { financePages, type FinanceView } from "./finance-pages";
import { CreditNoteForm } from "@/features/stakeholders/finance/CreditNoteForm";
import { InvoiceDetailDrawer } from "@/features/stakeholders/finance/InvoiceDetailDrawer";
import { InvoiceForm } from "@/features/stakeholders/finance/InvoiceForm";
import { BillingReadyReports } from "@/features/stakeholders/finance/BillingReadyReports";
import { CreditControl } from "@/features/stakeholders/finance/CreditControl";
import type { BillingReadyReport } from "@/lib/backend-api/billing-ready";
import { InvoiceRegister } from "@/features/stakeholders/finance/InvoiceRegister";
import { PaymentForm } from "@/features/stakeholders/finance/PaymentForm";
import { StakeholderHeader, StakeholderShell } from "@/features/stakeholders/StakeholderShell";
import { getSession } from "@/lib/api/auth";
import { getFinanceOverview, listInvoices, type Invoice } from "@/lib/api/finance";
export function FinanceWorkspace({ view = "overview" }: { view?: FinanceView }) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(view === "collections" ? "OVERDUE" : "");
  const [cursor, setCursor] = useState<string>();
  const [cursorHistory, setCursorHistory] = useState<Array<string | undefined>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [preparedInvoice, setPreparedInvoice] = useState<BillingReadyReport>();
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
  const needsOverview = view === "overview" || view === "collections";
  const needsInvoices = view === "invoices" || view === "collections";
  const overview = useQuery({
    queryKey: ["finance", "overview"],
    queryFn: getFinanceOverview,
    enabled: needsOverview,
  });
  const invoices = useQuery({
    queryKey: ["finance", "invoices", search, status, cursor],
    queryFn: () => listInvoices({ search, status, limit: 25, ...(cursor ? { cursor } : {}) }),
    enabled: needsInvoices,
    placeholderData: keepPreviousData,
  });
  const data = overview.data;
  const rows = invoices.isError ? [] : (invoices.data?.items ?? []);
  const canWrite = Boolean(
    session.data?.permissions.includes("*") || session.data?.permissions.includes("finance:write"),
  );
  const hasError = (needsOverview && overview.isError) || (needsInvoices && invoices.isError);
  const pending = invoices.isLoading || invoices.isPlaceholderData || searchInput.trim() !== search;
  return (
    <StakeholderShell
      workspace="finance"
      onRefresh={() => {
        if (needsOverview) void overview.refetch();
        if (needsInvoices) void invoices.refetch();
      }}
      refreshing={overview.isFetching || invoices.isFetching}
    >
      <StakeholderHeader
        eyebrow="Finance · Billing workspace"
        title={financePages[view][0]}
        description={financePages[view][1]}
        action={
          canWrite && (view === "invoices" || view === "billing") ? (
            <button
              type="button"
              onClick={() => {
                setPreparedInvoice(undefined);
                setShowCreate((value) => !value);
              }}
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
            if (needsOverview) void overview.refetch();
            if (needsInvoices) void invoices.refetch();
          }}
          retrying={overview.isFetching || invoices.isFetching}
        />
      ) : null}
      {showCreate ? (
        <InvoiceForm
          key={preparedInvoice?.reportId ?? "manual"}
          prepared={preparedInvoice}
          onClose={() => setShowCreate(false)}
        />
      ) : null}
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
      {needsOverview ? (
        overview.isPending ? (
          <CardGridSkeleton count={4} />
        ) : !overview.isError ? (
          <FinanceSummary data={data} />
        ) : null
      ) : null}
      {view === "overview" ? (
        <>
          <FinanceOverviewLinks canWrite={canWrite} />
          {data && !overview.isError ? <FinanceInsights data={data} /> : null}
        </>
      ) : null}
      {view === "statements" ? <FinanceStatements /> : null}
      {view === "credit" ? <CreditControl canWrite={canWrite} expanded /> : null}
      {view === "billing" ? (
        canWrite ? (
          <BillingReadyReports
            onInvoice={(report) => {
              setPreparedInvoice(report);
              setShowCreate(true);
            }}
          />
        ) : (
          <p className="rounded-2xl border bg-card p-5 text-sm">
            Preparing an invoice requires Finance write access.
          </p>
        )
      ) : null}
      {needsInvoices ? (
        <div className="min-w-0 space-y-4">
          <InvoiceRegister
            items={rows}
            pending={pending}
            unavailable={invoices.isError}
            search={searchInput}
            status={status}
            page={cursorHistory.length + 1}
            hasPrevious={!pending && cursorHistory.length > 0}
            hasNext={!pending && Boolean(invoices.data?.nextCursor)}
            onSearch={setSearchInput}
            onStatus={(value) => {
              setStatus(value);
              setCursor(undefined);
              setCursorHistory([]);
            }}
            onPrevious={() => {
              if (pending || !cursorHistory.length) return;
              const history = [...cursorHistory];
              setCursor(history.pop());
              setCursorHistory(history);
            }}
            onNext={() => {
              const next = invoices.data?.nextCursor;
              if (pending || !next) return;
              setCursorHistory((current) => [...current, cursor]);
              setCursor(next);
            }}
            onOpen={setSelectedInvoice}
          />
        </div>
      ) : null}
    </StakeholderShell>
  );
}
