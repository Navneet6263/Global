import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { createInvoice } from "@/lib/api/finance";
import { InvoiceCaseSearch, InvoiceClientSearch } from "./InvoiceEntitySelectors";
import { InvoiceClientContext } from "./InvoiceClientContext";
import type { BillingContext } from "@/lib/backend-api/billing-context";
import { money } from "./finance-utils";
import type { BillingReadyReport } from "@/lib/backend-api/billing-ready";

type DraftLine = {
  description: string;
  quantity: number;
  unitPrice: string;
  taxRate: string;
  caseId: string;
  caseLabel: string;
  reportId?: string;
};
const emptyLine = (): DraftLine => ({
  description: "",
  quantity: 1,
  unitPrice: "",
  taxRate: "18",
  caseId: "",
  caseLabel: "",
});

export function InvoiceForm({
  onClose,
  prepared,
}: {
  onClose: () => void;
  prepared?: BillingReadyReport;
}) {
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState(prepared?.client.id ?? "");
  const [clientLabel, setClientLabel] = useState(prepared?.client.displayName ?? "");
  // Due 30 days from today by default, the same as monthly bills; Finance can change it.
  const [dueAt, setDueAt] = useState(() =>
    new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(
    prepared
      ? prepared.lines.map((line) => ({
          ...line,
          unitPrice: String(line.unitPrice),
          taxRate: String(line.taxRate),
          caseLabel: prepared.caseNumber,
        }))
      : [emptyLine()],
  );
  const valid = Boolean(
    clientId &&
    dueAt &&
    lines.length > 0 &&
    (!prepared || lines.some((line) => line.quantity > 0 && Number(line.unitPrice) > 0)) &&
    lines.every(
      (line) =>
        line.description.trim() &&
        Number(line.quantity) > 0 &&
        Number(line.unitPrice) >= 0 &&
        Number(line.taxRate) >= 0,
    ),
  );
  const mutation = useMutation({
    mutationFn: () =>
      createInvoice({
        clientId,
        dueAt,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        lines: lines.map((line) => ({
          ...(line.caseId ? { caseId: line.caseId } : {}),
          ...(line.reportId ? { reportId: line.reportId } : {}),
          description: line.description.trim(),
          quantity: line.quantity,
          unitPrice: Number(line.unitPrice),
          taxRate: Number(line.taxRate),
        })),
      }),
    onSuccess: () => {
      toast.success("Invoice issued");
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance", "overview"] }),
        queryClient.invalidateQueries({ queryKey: ["finance", "invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["finance", "billing-ready"] }),
      ]);
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const updateLine = (index: number, patch: Partial<DraftLine>) =>
    setLines((current) =>
      current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)),
    );
  const lineAmount = (line: DraftLine) => line.quantity * Number(line.unitPrice || 0);
  const subtotal = lines.reduce((sum, line) => sum + lineAmount(line), 0);
  const gst = lines.reduce(
    (sum, line) => sum + lineAmount(line) * (Number(line.taxRate || 0) / 100),
    0,
  );
  const estimatedTotal = subtotal + gst;
  const added = new Set(lines.flatMap((line) => (line.reportId ? [line.reportId] : [])));
  /** Released reports become lines at their booked price; a blank first line is replaced. */
  const addReports = (items: BillingContext["unbilled"]) =>
    setLines((current) => {
      const kept = current.filter(
        (line) => line.description.trim() || line.unitPrice || line.caseId,
      );
      const fresh = items
        .filter((item) => !added.has(item.reportId))
        .flatMap((item) =>
          item.lines.map((line) => ({
            description: line.description,
            quantity: 1,
            unitPrice: String(line.unitPrice),
            taxRate: String(line.taxRate),
            caseId: item.caseId,
            caseLabel: `${item.caseNumber} · ${item.candidateName}`,
            reportId: item.reportId,
          })),
        );
      return [...kept, ...fresh].length ? [...kept, ...fresh] : [emptyLine()];
    });
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 p-3 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Close invoice form"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) mutation.mutate();
        }}
        className="surface relative max-h-[92vh] w-full max-w-7xl overflow-y-auto rounded-[2rem] p-5 shadow-[var(--shadow-float)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              New billing record
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              Issue a new invoice
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose the company: what it owes and its reports ready to bill appear on the right.
              Totals and tax are checked again by the server before issue.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close invoice form"
            className="grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-[var(--shadow-card)] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className={clientId ? "mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]" : "mt-5"}>
          <div className="min-w-0">
            <div className="grid gap-3 md:grid-cols-3">
              {prepared ? (
                <Field label="Client">
                  <p className="rounded-xl bg-mint-soft/40 p-3 text-sm">{clientLabel}</p>
                </Field>
              ) : (
                <InvoiceClientSearch
                  value={clientId}
                  label={clientLabel}
                  onChange={(id, label) => {
                    setClientId(id);
                    setClientLabel(label);
                    setLines((current) =>
                      current.map((line) => ({ ...line, caseId: "", caseLabel: "" })),
                    );
                  }}
                />
              )}
              <Field label="Payment due date">
                <input
                  type="date"
                  value={dueAt}
                  onChange={(event) => setDueAt(event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Internal note">
                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Optional note"
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Invoice lines
                </p>
                <p className="num text-xs font-semibold text-mint-deep">
                  Estimated total {money(estimatedTotal)}
                </p>
              </div>
              <div
                aria-hidden
                className="hidden gap-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500 md:grid md:grid-cols-[1.4fr_1fr_0.45fr_0.65fr_0.55fr_0.7fr_auto]"
              >
                <span>Description</span>
                <span>Case</span>
                <span>Qty</span>
                <span>Rate (₹)</span>
                <span>GST %</span>
                <span className="text-right">Amount</span>
                <span className="w-10" />
              </div>
              {lines.map((line, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-2xl border border-border bg-card/80 p-3 shadow-[var(--shadow-card)] md:grid-cols-[1.4fr_1fr_0.45fr_0.65fr_0.55fr_0.7fr_auto]"
                >
                  <input
                    value={line.description}
                    readOnly={Boolean(prepared)}
                    onChange={(event) => updateLine(index, { description: event.target.value })}
                    placeholder="Service description"
                    className={lineClass}
                  />
                  {prepared ? (
                    <p className="self-center text-xs">
                      {prepared.caseNumber} · Report v{prepared.reportVersion}
                    </p>
                  ) : (
                    <InvoiceCaseSearch
                      clientId={clientId}
                      value={line.caseId}
                      label={line.caseLabel}
                      onChange={(caseId, caseLabel) => updateLine(index, { caseId, caseLabel })}
                    />
                  )}
                  <input
                    type="number"
                    min="1"
                    value={line.quantity}
                    readOnly={Boolean(prepared)}
                    aria-label="Quantity"
                    onChange={(event) =>
                      updateLine(index, { quantity: Number(event.target.value) })
                    }
                    className={lineClass}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    readOnly={Boolean(prepared)}
                    onChange={(event) => updateLine(index, { unitPrice: event.target.value })}
                    placeholder="Rate"
                    className={lineClass}
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={line.taxRate}
                    readOnly={Boolean(prepared)}
                    onChange={(event) => updateLine(index, { taxRate: event.target.value })}
                    placeholder="Tax %"
                    className={lineClass}
                  />
                  <p className="num self-center text-right text-[13px] font-semibold text-slate-900">
                    {money(lineAmount(line))}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))
                    }
                    disabled={Boolean(prepared) || lines.length === 1}
                    aria-label="Remove line"
                    className="grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-critical-soft hover:text-critical disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <dl className="mt-4 ml-auto grid w-full max-w-xs gap-1 rounded-xl bg-slate-50 p-3 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-slate-500">Subtotal (before GST)</dt>
                <dd className="num font-medium text-slate-900">{money(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">GST</dt>
                <dd className="num font-medium text-slate-900">{money(gst)}</dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1">
                <dt className="font-semibold text-slate-900">Invoice total</dt>
                <dd className="num font-semibold text-slate-900">{money(estimatedTotal)}</dd>
              </div>
            </dl>
            <footer className="mt-4 flex flex-wrap justify-between gap-3">
              <button
                type="button"
                onClick={() => setLines((current) => [...current, emptyLine()])}
                disabled={Boolean(prepared)}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-semibold text-foreground shadow-[var(--shadow-card)]"
              >
                <Plus className="h-4 w-4" /> Add line
              </button>
              <button
                disabled={!valid || mutation.isPending}
                aria-busy={mutation.isPending}
                className="h-10 rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-card)] disabled:opacity-40"
              >
                {mutation.isPending ? "Issuing…" : "Issue invoice"}
              </button>
            </footer>
          </div>
          {clientId ? (
            <InvoiceClientContext clientId={clientId} added={added} onAdd={addReports} />
          ) : null}
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-semibold text-foreground">{label}</span>
      {children}
    </label>
  );
}
const inputClass =
  "h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-primary/45 focus:ring-4 focus:ring-primary/8";
const lineClass =
  "h-10 min-w-0 rounded-xl border border-border bg-card px-2 text-xs text-foreground outline-none focus:border-primary/45 focus:ring-4 focus:ring-primary/8";
