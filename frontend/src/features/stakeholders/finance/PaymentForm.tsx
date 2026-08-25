import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { recordPayment, type Invoice } from "@/lib/api/finance";
import { money } from "./finance-utils";

export function PaymentForm({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const queryClient = useQueryClient();
  const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount);
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
        if (valid) mutation.mutate();
      }}
      className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 shadow-sm"
    >
      <header className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold">Record payment · {invoice.invoiceNumber}</h2>
          <p className="mt-1 text-xs text-slate-500">Open balance {money(balance)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close payment form"
          className="grid h-8 w-8 place-items-center rounded-lg bg-white text-slate-500"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_1.2fr_auto]">
        <input
          type="number"
          min="0.01"
          max={balance}
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className={fieldClass}
        />
        <select
          value={method}
          onChange={(event) => setMethod(event.target.value)}
          className={fieldClass}
        >
          {["BANK_TRANSFER", "UPI", "CHEQUE", "CARD", "OTHER"].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="Payment reference"
          className={fieldClass}
        />
        <button
          disabled={!valid || mutation.isPending}
          className="h-11 rounded-xl bg-slate-950 px-5 text-xs font-semibold text-white disabled:opacity-40"
        >
          {mutation.isPending ? "Recording…" : "Record payment"}
        </button>
      </div>
    </form>
  );
}
const fieldClass =
  "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-300";
