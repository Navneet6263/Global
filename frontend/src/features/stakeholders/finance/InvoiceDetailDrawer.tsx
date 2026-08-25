import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, ReceiptText, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { cancelInvoice, downloadInvoice, type Invoice } from "@/lib/api/finance";
import { formatDate, humanize, money } from "./finance-utils";

export function InvoiceDetailDrawer({
  invoice,
  canWrite,
  onClose,
  onPayment,
}: {
  invoice: Invoice;
  canWrite: boolean;
  onClose: () => void;
  onPayment: () => void;
}) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount);
  const cancel = useMutation({
    mutationFn: () =>
      cancelInvoice(invoice.id, { version: invoice.version, reason: reason.trim() }),
    onSuccess: async () => {
      toast.success("Invoice cancelled");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance", "invoices"] }),
        queryClient.invalidateQueries({ queryKey: ["finance", "overview"] }),
      ]);
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const cancellable =
    canWrite && Number(invoice.paidAmount) === 0 && !["PAID", "CANCELLED"].includes(invoice.status);
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/25 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close invoice"
        className="absolute inset-0 cursor-default"
      />
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
        <header className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
              Invoice record
            </p>
            <h2 className="mt-1 text-lg font-semibold">{invoice.invoiceNumber}</h2>
            <p className="text-xs text-slate-500">{invoice.client.displayName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-5 p-5">
          <section className="grid gap-3 sm:grid-cols-4">
            <Fact label="Status" value={humanize(invoice.status)} />
            <Fact label="Subtotal" value={money(Number(invoice.subtotal))} />
            <Fact label="Tax" value={money(Number(invoice.taxAmount))} />
            <Fact label="Balance" value={money(balance)} />
          </section>
          <section className="overflow-hidden rounded-2xl border border-slate-200">
            <Heading
              title="Tax and service breakdown"
              detail={`${invoice.lines.length} invoice lines`}
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-xs">
                <thead className="bg-slate-50 text-[9px] uppercase tracking-wider text-slate-500">
                  <tr>
                    {["Description", "Case", "Qty", "Rate", "Tax", "Total"].map((label) => (
                      <th key={label} className="px-4 py-2.5">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {invoice.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-4 py-3 font-semibold">{line.description}</td>
                      <td className="px-4 py-3 text-slate-500">{line.case?.caseNumber ?? "—"}</td>
                      <td className="px-4 py-3">{line.quantity}</td>
                      <td className="px-4 py-3">{money(Number(line.unitPrice))}</td>
                      <td className="px-4 py-3">{Number(line.taxRate)}%</td>
                      <td className="px-4 py-3 font-semibold">{money(Number(line.lineTotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="rounded-2xl border border-slate-200">
            <Heading
              title="Payment reconciliation"
              detail={`${invoice.payments.length} recorded entries`}
            />
            <div className="divide-y divide-slate-100">
              {invoice.payments.map((payment) => (
                <div key={payment.publicId} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-xs font-semibold">{humanize(payment.method)}</p>
                    <p className="text-[10px] text-slate-500">
                      {payment.reference || "No reference"} · {formatDate(payment.receivedAt)}
                    </p>
                  </div>
                  <p className="text-xs font-semibold text-emerald-700">
                    {money(Number(payment.amount))}
                  </p>
                </div>
              ))}
              {!invoice.payments.length ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  No payment has been recorded.
                </p>
              ) : null}
            </div>
          </section>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void downloadInvoice(invoice.id, invoice.invoiceNumber)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-semibold"
            >
              <Download className="h-4 w-4" /> Download PDF
            </button>
            {canWrite && balance > 0 && invoice.status !== "CANCELLED" ? (
              <button
                type="button"
                onClick={onPayment}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white"
              >
                <ReceiptText className="h-4 w-4" /> Record payment
              </button>
            ) : null}
          </div>
          {cancellable ? (
            <section className="rounded-2xl border border-red-200 bg-red-50/50 p-4">
              <p className="text-xs font-semibold text-red-800">Cancel unpaid invoice</p>
              <p className="mt-1 text-[10px] text-red-700">
                Cancellation is immutable and recorded in the audit trail.
              </p>
              <div className="mt-3 flex gap-2">
                <input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Cancellation reason"
                  className="h-10 flex-1 rounded-xl border border-red-200 bg-white px-3 text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={() => cancel.mutate()}
                  disabled={reason.trim().length < 5 || cancel.isPending}
                  className="rounded-xl bg-red-600 px-4 text-xs font-semibold text-white disabled:opacity-40"
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
    <header className="border-b border-slate-200 px-4 py-3">
      <h3 className="text-xs font-semibold">{title}</h3>
      <p className="text-[10px] text-slate-500">{detail}</p>
    </header>
  );
}
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-xs font-semibold">{value}</p>
    </div>
  );
}
