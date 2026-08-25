import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Banknote,
  CircleDollarSign,
  Download,
  FilePlus2,
  Plus,
  ReceiptIndianRupee,
  Trash2,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { KpiStrip, MeterRow, PageHeader, Panel } from "@/components/dashboards/ui";
import { Sidebar } from "@/components/ops/Sidebar";
import { Topbar } from "@/components/ops/Topbar";
import { listCases, listClients } from "@/lib/api/cases";
import {
  createInvoice,
  downloadInvoice,
  getFinanceOverview,
  listInvoices,
  recordPayment,
  type Invoice,
} from "@/lib/api/finance";

export const Route = createFileRoute("/finance")({
  head: () => ({ meta: [{ title: "Finance & Billing — Sapling Global" }] }),
  component: FinancePage,
});

function FinancePage() {
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [paymentFor, setPaymentFor] = useState<Invoice | null>(null);
  const overview = useQuery({ queryKey: ["finance", "overview"], queryFn: getFinanceOverview });
  const invoices = useQuery({
    queryKey: ["finance", "invoices", search],
    queryFn: () => listInvoices(search.trim() ? { search: search.trim() } : {}),
  });
  const data = overview.data;
  const rows = invoices.data?.items ?? [];
  const ageingTotal = (data?.ageing ?? []).reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="canvas-mesh min-h-screen bg-background text-foreground lg:pl-64">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          search={search}
          onSearchChange={setSearch}
          onRefresh={() => {
            void overview.refetch();
            void invoices.refetch();
          }}
          isRefreshing={overview.isFetching || invoices.isFetching}
        />
        <main className="flex-1 space-y-4 px-4 pb-10 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <PageHeader
              title="Finance & billing"
              subtitle="Invoice, receivable and payment control with audit history"
              chip={data ? `Live · ${formatDate(data.generatedAt)}` : "Loading live data"}
            />
            <button
              type="button"
              onClick={() => setShowCreate((value) => !value)}
              className="mb-4 inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground"
            >
              <FilePlus2 className="h-4 w-4" /> Issue invoice
            </button>
          </div>
          {overview.isError || invoices.isError ? (
            <div className="rounded-3xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">
              {overview.error?.message ?? invoices.error?.message}
            </div>
          ) : null}
          {showCreate ? <InvoiceForm onClose={() => setShowCreate(false)} /> : null}
          {paymentFor ? (
            <PaymentForm invoice={paymentFor} onClose={() => setPaymentFor(null)} />
          ) : null}
          <KpiStrip
            items={[
              {
                label: "Billed",
                value: money(data?.summary.billed ?? 0),
                delta: "issued invoices",
                tone: "info",
              },
              {
                label: "Collected",
                value: money(data?.summary.collected ?? 0),
                delta: data?.summary.billed
                  ? `${Math.round((data.summary.collected / data.summary.billed) * 100)}% realised`
                  : "no billing yet",
                tone: "success",
              },
              {
                label: "Outstanding",
                value: money(data?.summary.outstanding ?? 0),
                delta: `${rows.filter((item) => !["PAID", "CANCELLED"].includes(item.status)).length} invoices`,
                tone: "warning",
              },
              {
                label: "Overdue",
                value: money(data?.summary.overdueAmount ?? 0),
                delta: `${data?.summary.overdueCount ?? 0} invoices`,
                tone: data?.summary.overdueCount ? "destructive" : "success",
              },
            ]}
          />
          <div className="grid gap-4 xl:grid-cols-[1.5fr_0.7fr]">
            <Panel title="Invoice register" subtitle="Balances, due dates and collection status">
              <InvoiceTable items={rows} onPayment={setPaymentFor} />
            </Panel>
            <Panel title="Receivables ageing" subtitle="Outstanding balance by overdue band">
              <div className="space-y-4">
                {data?.ageing.map((item) => (
                  <MeterRow
                    key={item.label}
                    label={item.label}
                    hint={money(item.value)}
                    value={ageingTotal ? (item.value / ageingTotal) * 100 : 0}
                    tone={
                      item.label.startsWith("0")
                        ? "success"
                        : item.label.startsWith("31")
                          ? "warning"
                          : "destructive"
                    }
                  />
                ))}
                {!ageingTotal ? <Empty text="No outstanding receivables" /> : null}
              </div>
            </Panel>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Fact
              icon={ReceiptIndianRupee}
              title="Immutable invoice totals"
              text="Line values and tax are calculated server-side before issue."
            />
            <Fact
              icon={WalletCards}
              title="Payment controls"
              text="Overpayments and stale concurrent updates are rejected."
            />
            <Fact
              icon={AlertTriangle}
              title="Due-date visibility"
              text="Overdue state is derived from the live balance and due date."
            />
          </div>
        </main>
      </div>
    </div>
  );
}

type DraftLine = {
  description: string;
  quantity: number;
  unitPrice: string;
  taxRate: string;
  caseId: string;
};
function InvoiceForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([
    { description: "", quantity: 1, unitPrice: "", taxRate: "18", caseId: "" },
  ]);
  const clients = useQuery({ queryKey: ["clients", "invoice"], queryFn: listClients });
  const cases = useQuery({
    queryKey: ["cases", "invoice", clientId],
    queryFn: () => listCases({ clientId, limit: 100 }),
    enabled: Boolean(clientId),
  });
  const mutation = useMutation({
    mutationFn: () =>
      createInvoice({
        clientId,
        dueAt,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        lines: lines.map((line) => ({
          ...(line.caseId ? { caseId: line.caseId } : {}),
          description: line.description.trim(),
          quantity: line.quantity,
          unitPrice: Number(line.unitPrice),
          taxRate: Number(line.taxRate),
        })),
      }),
    onSuccess: async () => {
      toast.success("Invoice issued");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance", "overview"] }),
        queryClient.invalidateQueries({ queryKey: ["finance", "invoices"] }),
      ]);
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const valid =
    clientId &&
    dueAt &&
    lines.length &&
    lines.every(
      (line) =>
        line.description.trim().length >= 2 && Number(line.unitPrice) >= 0 && line.quantity > 0,
    );
  const updateLine = (index: number, patch: Partial<DraftLine>) =>
    setLines((current) =>
      current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) mutation.mutate();
      }}
      className="surface-float rounded-3xl p-5"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Issue invoice</h2>
          <p className="text-xs text-muted-foreground">
            All totals and taxes are recalculated by the server.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-muted-foreground"
        >
          Close
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <select
          value={clientId}
          onChange={(event) => setClientId(event.target.value)}
          className="h-11 rounded-2xl border border-border bg-background px-3 text-sm"
        >
          <option value="">Select client</option>
          {clients.data?.items.map((client) => (
            <option key={client.publicId} value={client.publicId}>
              {client.displayName}
            </option>
          ))}
        </select>
        <label className="rounded-2xl border border-border bg-background px-3 py-1 text-[10px] text-muted-foreground">
          Payment due
          <input
            type="date"
            value={dueAt}
            onChange={(event) => setDueAt(event.target.value)}
            className="block h-7 w-full bg-transparent text-sm text-foreground outline-none"
          />
        </label>
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Invoice note (optional)"
          className="h-11 rounded-2xl border border-border bg-background px-3 text-sm outline-none"
        />
      </div>
      <div className="mt-4 space-y-2">
        {lines.map((line, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-2xl bg-secondary/40 p-3 md:grid-cols-[minmax(12rem,1fr)_8rem_6rem_6rem_10rem_auto]"
          >
            <input
              value={line.description}
              onChange={(event) => updateLine(index, { description: event.target.value })}
              placeholder="Line description"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            />
            <select
              value={line.caseId}
              onChange={(event) => updateLine(index, { caseId: event.target.value })}
              className="h-10 rounded-xl border border-border bg-background px-2 text-xs"
            >
              <option value="">No case link</option>
              {cases.data?.items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.caseNumber}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={line.quantity}
              onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })}
              aria-label="Quantity"
              className="h-10 rounded-xl border border-border bg-background px-2 text-sm"
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={line.unitPrice}
              onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
              placeholder="Rate"
              className="h-10 rounded-xl border border-border bg-background px-2 text-sm"
            />
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={line.taxRate}
              onChange={(event) => updateLine(index, { taxRate: event.target.value })}
              placeholder="Tax %"
              className="h-10 rounded-xl border border-border bg-background px-2 text-sm"
            />
            <button
              type="button"
              onClick={() =>
                setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))
              }
              disabled={lines.length === 1}
              aria-label="Remove invoice line"
              className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap justify-between gap-3">
        <button
          type="button"
          onClick={() =>
            setLines((current) => [
              ...current,
              { description: "", quantity: 1, unitPrice: "", taxRate: "18", caseId: "" },
            ])
          }
          className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-semibold"
        >
          <Plus className="h-3.5 w-3.5" /> Add line
        </button>
        <button
          disabled={!valid || mutation.isPending}
          className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          {mutation.isPending ? "Issuing…" : "Issue invoice"}
        </button>
      </div>
    </form>
  );
}

function PaymentForm({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const queryClient = useQueryClient();
  const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount);
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      recordPayment(invoice.id, {
        amount: Number(amount),
        method,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        receivedAt: new Date().toISOString(),
        version: invoice.version,
      }),
    onSuccess: async () => {
      toast.success("Payment recorded");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance", "overview"] }),
        queryClient.invalidateQueries({ queryKey: ["finance", "invoices"] }),
      ]);
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (Number(amount) > 0 && Number(amount) <= balance) mutation.mutate();
      }}
      className="rounded-3xl border border-accent/30 bg-accent/10 p-5"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Record payment · {invoice.invoiceNumber}</h2>
          <p className="text-xs text-muted-foreground">Current balance {money(balance)}</p>
        </div>
        <button type="button" onClick={onClose} className="text-xs font-semibold">
          Close
        </button>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <input
          type="number"
          min="0.01"
          max={balance}
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
        />
        <select
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
        >
          {["BANK_TRANSFER", "UPI", "CHEQUE", "CARD", "OTHER"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="Reference (optional)"
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
        />
        <button
          disabled={mutation.isPending || Number(amount) <= 0 || Number(amount) > balance}
          className="rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {mutation.isPending ? "Recording…" : "Record payment"}
        </button>
      </div>
    </form>
  );
}

function InvoiceTable({
  items,
  onPayment,
}: {
  items: Invoice[];
  onPayment: (invoice: Invoice) => void;
}) {
  const [downloadingId, setDownloadingId] = useState<string>();
  if (!items.length) return <Empty text="No invoices match the current search" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="text-[11px] uppercase tracking-wide text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Invoice</th>
            <th className="py-2 pr-3 font-medium">Client</th>
            <th className="py-2 pr-3 font-medium">Total</th>
            <th className="py-2 pr-3 font-medium">Balance</th>
            <th className="py-2 pr-3 font-medium">Due</th>
            <th className="py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const balance = Number(item.totalAmount) - Number(item.paidAmount);
            return (
              <tr key={item.id} className="border-t border-border/60">
                <td className="py-3 pr-3 font-semibold">{item.invoiceNumber}</td>
                <td className="py-3 pr-3">{item.client.displayName}</td>
                <td className="py-3 pr-3 font-semibold">{money(Number(item.totalAmount))}</td>
                <td className="py-3 pr-3">{money(balance)}</td>
                <td className="py-3 pr-3 text-xs text-muted-foreground">
                  {item.dueAt ? formatDate(item.dueAt) : "Not set"}
                </td>
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.status === "PAID" ? "bg-success text-success-foreground" : item.status === "OVERDUE" ? "bg-destructive/10 text-destructive" : "bg-warning/20 text-warning-foreground"}`}
                    >
                      {humanize(item.status)}
                    </span>
                    {balance > 0 && !["CANCELLED"].includes(item.status) ? (
                      <button
                        type="button"
                        onClick={() => onPayment(item)}
                        className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold"
                      >
                        Add payment
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={async () => {
                        setDownloadingId(item.id);
                        try {
                          await downloadInvoice(item.id, item.invoiceNumber);
                        } catch (error) {
                          toast.error(
                            error instanceof Error ? error.message : "Invoice download failed",
                          );
                        } finally {
                          setDownloadingId(undefined);
                        }
                      }}
                      disabled={downloadingId === item.id}
                      aria-label={`Download invoice ${item.invoiceNumber}`}
                      className="grid h-7 w-7 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Fact({ icon: Icon, title, text }: { icon: typeof Banknote; title: string; text: string }) {
  return (
    <div className="surface rounded-3xl p-5">
      <Icon className="h-5 w-5 text-accent-foreground" />
      <h2 className="mt-3 text-sm font-semibold">{title}</h2>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border py-10 text-center">
      <CircleDollarSign className="mx-auto h-5 w-5 text-muted-foreground" />
      <p className="mt-2 text-xs text-muted-foreground">{text}</p>
    </div>
  );
}
function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}
function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}
