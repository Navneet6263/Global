import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeIndianRupee, Download, ReceiptText, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { cancelInvoice, downloadInvoice, type Invoice } from "@/lib/api/finance";
import { CreditNoteHistory } from "./CreditNoteHistory";
import { formatDate, humanize, money } from "./finance-utils";

export function InvoiceDetailDrawer({
  invoice,
  canWrite,
  onClose,
  onPayment,
  onCredit,
}: {
  invoice: Invoice;
  canWrite: boolean;
  onClose: () => void;
  onPayment: () => void;
  onCredit: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const balance =
    Number(invoice.totalAmount) - Number(invoice.paidAmount) - Number(invoice.creditedAmount);
  const cancel = useMutation({
    mutationFn: () =>
      cancelInvoice(invoice.id, { version: invoice.version, reason: reason.trim() }),
    onSuccess: () => {
      toast.success("Invoice cancelled");
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance", "invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["finance", "overview"] }),
      ]);
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const cancellable =
    canWrite &&
    Number(invoice.paidAmount) === 0 &&
    Number(invoice.creditedAmount) === 0 &&
    !["PAID", "CANCELLED", "CREDITED", "SETTLED"].includes(invoice.status);
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-foreground/20 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close invoice"
        className="absolute inset-0 cursor-default"
      />
      <aside className="relative h-full w-full max-w-[48rem] overflow-y-auto rounded-l-[2rem] border-l border-white/80 bg-background/95 shadow-[var(--shadow-float)] backdrop-blur-xl">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-border bg-background/90 px-5 py-4 backdrop-blur-xl">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              Invoice record
            </p>
            <h2 className="num mt-1 text-lg font-semibold tracking-tight text-foreground">
              {invoice.invoiceNumber}
            </h2>
            <p className="text-xs text-muted-foreground">{invoice.client.displayName}</p>
          </div>
          <button
            type="button"
            aria-label="Close invoice"
            onClick={onClose}
            className="grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-[var(--shadow-card)] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-5 p-5">
          <section className="grid gap-3 sm:grid-cols-5">
            <Fact label="Status" value={humanize(invoice.status)} />
            <Fact label="Subtotal" value={money(Number(invoice.subtotal))} />
            <Fact label="Tax" value={money(Number(invoice.taxAmount))} />
            <Fact label="Credits" value={money(Number(invoice.creditedAmount))} />
            <Fact label="Balance" value={money(balance)} />
          </section>
          <CreditNoteHistory items={invoice.creditNotes} />
          <section className="surface overflow-hidden rounded-2xl">
            <Heading
              title="Tax and service breakdown"
              detail={`${invoice.lines.length} invoice lines`}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead className="bg-muted/35 text-[9px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    {["Description", "Case", "Qty", "Rate", "Tax", "Total"].map((label) => (
                      <th key={label} className="px-4 py-2.5">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {invoice.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {line.description}
                      </td>
                      <td className="num px-4 py-3 text-muted-foreground">
                        {line.case?.caseNumber ?? "—"}
                      </td>
                      <td className="px-4 py-3">{line.quantity}</td>
                      <td className="px-4 py-3">{money(Number(line.unitPrice))}</td>
                      <td className="px-4 py-3">{Number(line.taxRate)}%</td>
                      <td className="num px-4 py-3 font-semibold text-foreground">
                        {money(Number(line.lineTotal))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="surface overflow-hidden rounded-2xl">
            <Heading
              title="Payment reconciliation"
              detail={`${invoice.payments.length} recorded entries`}
            />
            <div className="divide-y divide-border/70">
              {invoice.payments.map((payment) => (
                <div key={payment.publicId} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {humanize(payment.method)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {payment.reference || "No reference"} · {formatDate(payment.receivedAt)}
                    </p>
                  </div>
                  <p className="num text-xs font-semibold text-success-foreground">
                    {money(Number(payment.amount))}
                  </p>
                </div>
              ))}
              {!invoice.payments.length ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No payment has been recorded.
                </p>
              ) : null}
            </div>
          </section>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                void downloadInvoice(invoice.id, invoice.invoiceNumber).catch((error: unknown) =>
                  toast.error("Invoice PDF could not be downloaded", {
                    description: error instanceof Error ? error.message : undefined,
                  }),
                )
              }
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-4 text-xs font-semibold text-foreground shadow-[var(--shadow-card)]"
            >
              <Download className="h-4 w-4" /> Download PDF
            </button>
            {canWrite && balance > 0 && invoice.status !== "CANCELLED" ? (
              <button
                type="button"
                onClick={onPayment}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-mint-deep px-4 text-xs font-semibold text-white shadow-[var(--shadow-card)]"
              >
                <ReceiptText className="h-4 w-4" /> Record payment
              </button>
            ) : null}
            {canWrite && balance > 0 && invoice.status !== "CANCELLED" ? (
              <button
                type="button"
                onClick={onCredit}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-review/20 bg-review-soft px-4 text-xs font-semibold text-review-foreground"
              >
                <BadgeIndianRupee className="h-4 w-4" /> Issue credit note
              </button>
            ) : null}
          </div>
          {cancellable ? (
            <section className="rounded-2xl border border-critical/20 bg-critical-soft/60 p-4">
              <p className="text-xs font-semibold text-critical-foreground">
                Cancel unpaid invoice
              </p>
              <p className="mt-1 text-[10px] text-critical-foreground/80">
                Cancellation is immutable and recorded in the audit trail.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Cancellation reason"
                  className="h-10 flex-1 rounded-xl border border-critical/25 bg-card px-3 text-xs text-foreground outline-none focus:ring-4 focus:ring-critical/8"
                />
                <button
                  type="button"
                  onClick={() => cancel.mutate()}
                  disabled={reason.trim().length < 5 || cancel.isPending}
                  aria-busy={cancel.isPending}
                  className="rounded-full bg-critical px-4 text-xs font-semibold text-white disabled:opacity-40"
                >
                  Cancel invoice
                </button>
              </div>
            </section>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
function Heading({ title, detail }: { title: string; detail: string }) {
  return (
    <header className="border-b border-border px-4 py-3">
      <h3 className="text-xs font-semibold text-foreground">{title}</h3>
      <p className="text-[10px] text-muted-foreground">{detail}</p>
    </header>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/80 bg-card/75 p-3 shadow-[var(--shadow-card)]">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="num mt-1 text-xs font-semibold text-foreground">{value}</p>
    </div>
  );
}
