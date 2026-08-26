import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { createCreditNote, type Invoice } from "@/lib/api/finance";
import { money } from "./finance-utils";

export function CreditNoteForm({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const queryClient = useQueryClient();
  const balance =
    Number(invoice.totalAmount) - Number(invoice.paidAmount) - Number(invoice.creditedAmount);
  const [amount, setAmount] = useState(String(balance));
  const [reason, setReason] = useState("");
  const valid = Number(amount) > 0 && Number(amount) <= balance && reason.trim().length >= 5;
  const mutation = useMutation({
    mutationFn: () =>
      createCreditNote(invoice.id, {
        amount: Number(amount),
        reason: reason.trim(),
        version: invoice.version,
      }),
    onSuccess: async (created) => {
      toast.success(`${created.noteNumber} issued`);
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
      className="rounded-2xl border border-violet-200 bg-violet-50/50 p-5 shadow-sm"
    >
      <header className="flex items-start justify-between">
        <div>
          <h2 className="text-sm font-semibold">Issue credit note · {invoice.invoiceNumber}</h2>
          <p className="mt-1 text-xs text-slate-500">
            Available balance {money(balance)} · permanently audited
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close credit note form"
          className="grid h-8 w-8 place-items-center rounded-lg bg-white text-slate-500"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="mt-4 grid gap-3 md:grid-cols-[0.8fr_2fr_auto]">
        <input
          aria-label="Credit amount"
          type="number"
          min="0.01"
          max={balance}
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          className={fieldClass}
        />
        <input
          aria-label="Credit reason"
          value={reason}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason for the commercial adjustment"
          className={fieldClass}
        />
        <button
          disabled={!valid || mutation.isPending}
          className="h-11 rounded-xl bg-violet-700 px-5 text-xs font-semibold text-white disabled:opacity-40"
        >
          {mutation.isPending ? "Issuing…" : "Issue credit note"}
        </button>
      </div>
    </form>
  );
}

const fieldClass =
  "h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-violet-300";
