import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeIndianRupee, X } from "lucide-react";
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
    onSuccess: (created) => {
      toast.success(`${created.noteNumber} issued`);
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
      aria-label="Issue credit note"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close credit note form"
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-review">
              Commercial adjustment
            </p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
              Issue credit note
            </h2>
            <p className="num mt-1 text-xs text-muted-foreground">{invoice.invoiceNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close credit note form"
            className="grid size-9 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-[var(--shadow-card)]"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-review-soft p-4 text-review-foreground">
          <span className="grid size-9 place-items-center rounded-xl bg-card/80">
            <BadgeIndianRupee className="size-4" />
          </span>
          <div>
            <p className="text-[10px] uppercase tracking-wider opacity-75">Available balance</p>
            <p className="num mt-0.5 text-lg font-semibold">{money(balance)}</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[0.75fr_1.5fr]">
          <label>
            <span className="mb-1.5 block text-xs font-semibold text-foreground">
              Credit amount
            </span>
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
          </label>
          <label>
            <span className="mb-1.5 block text-xs font-semibold text-foreground">Reason</span>
            <input
              aria-label="Credit reason"
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Reason for the commercial adjustment"
              className={fieldClass}
            />
          </label>
        </div>
        <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
          This adjustment is immutable after issue and remains visible in the invoice audit history.
        </p>
        <footer className="mt-5 flex justify-end">
          <button
            disabled={!valid || mutation.isPending}
            aria-busy={mutation.isPending}
            className="h-10 rounded-full bg-review px-5 text-xs font-semibold text-white shadow-[var(--shadow-card)] disabled:opacity-40"
          >
            {mutation.isPending ? "Issuing…" : "Issue credit note"}
          </button>
        </footer>
      </form>
    </div>
  );
}

const fieldClass =
  "h-11 w-full rounded-xl border border-border bg-card px-3 text-sm text-foreground outline-none focus:border-review/45 focus:ring-4 focus:ring-review/8";
