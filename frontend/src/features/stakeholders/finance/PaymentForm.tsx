import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Landmark, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { recordPayment, type Invoice } from "@/lib/api/finance";
import { humanize, money } from "./finance-utils";

export function PaymentForm({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const queryClient = useQueryClient();
  const balance =
    Number(invoice.totalAmount) - Number(invoice.paidAmount) - Number(invoice.creditedAmount);
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const valid = Number(amount) > 0 && Number(amount) <= balance;
  const mutation = useMutation({
    mutationFn: () =>
      recordPayment(invoice.id, {
        amount: Number(amount),
        method,
        ...(reference.trim() ? { reference: reference.trim() } : {}),
        receivedAt: new Date().toISOString(),
        version: invoice.version,
      }),
    onSuccess: () => {
      toast.success("Payment recorded");
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ["finance", "overview"] }),
        queryClient.invalidateQueries({ queryKey: ["finance", "invoices"] }),
      ]);
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/20 p-3 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      aria-label="Record payment"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close payment form"
        className="absolute inset-0 cursor-default"
      />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) mutation.mutate();
        }}
        className="surface relative w-full max-w-2xl rounded-[2rem] p-5 shadow-[var(--shadow-float)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border pb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-success">
              Collection entry
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              Record payment
            </h2>
            <p className="num mt-1 text-xs text-muted-foreground">{invoice.invoiceNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close payment form"
            className="grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-[var(--shadow-card)]"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-success-soft p-4 text-success-foreground">
          <span className="grid size-9 place-items-center rounded-xl bg-card/80">
            <Landmark className="size-4" />
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-wider opacity-75">Open balance</p>
            <p className="num mt-0.5 text-lg font-semibold">{money(balance)}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Amount received">
            <input
              aria-label="Amount received"
              type="number"
              min="0.01"
              max={balance}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={fieldClass}
            />
          </Field>
          <Field label="Payment method">
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value)}
              className={fieldClass}
            >
              {["BANK_TRANSFER", "UPI", "CHEQUE", "CARD", "OTHER"].map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Payment reference">
            <input
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="UTR, cheque or receipt number"
              className={fieldClass}
            />
          </Field>
        </div>
        <footer className="mt-5 flex justify-end">
          <button
            disabled={!valid || mutation.isPending}
            aria-busy={mutation.isPending}
            className="h-10 rounded-full bg-mint-deep px-5 text-xs font-semibold text-white shadow-[var(--shadow-card)] disabled:opacity-40"
          >
            {mutation.isPending ? "Recording…" : "Record payment"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="last:sm:col-span-2">
      <span className="mb-1.5 block text-xs font-semibold text-foreground">{label}</span>
      {children}
    </label>
  );
}
const fieldClass =
  "h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-success/45 focus:ring-4 focus:ring-success/8";
