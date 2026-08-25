import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { listCases, listClients } from "@/lib/api/cases";
import { createInvoice } from "@/lib/api/finance";

type DraftLine = {
  description: string;
  quantity: number;
  unitPrice: string;
  taxRate: string;
  caseId: string;
};
const emptyLine = (): DraftLine => ({
  description: "",
  quantity: 1,
  unitPrice: "",
  taxRate: "18",
  caseId: "",
});

export function InvoiceForm({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [clientId, setClientId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const clients = useQuery({ queryKey: ["clients", "invoice"], queryFn: listClients });
  const cases = useQuery({
    queryKey: ["cases", "invoice", clientId],
    queryFn: () => listCases({ clientId, limit: 100 }),
    enabled: Boolean(clientId),
  });
  const valid = Boolean(
    clientId &&
    dueAt &&
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
      className="rounded-2xl border border-orange-200 bg-orange-50/45 p-5 shadow-sm"
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Issue a new invoice</h2>
          <p className="mt-1 text-xs text-slate-500">
            Totals and tax are validated by the server before issue.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close invoice form"
          className="grid h-8 w-8 place-items-center rounded-lg bg-white text-slate-500"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Field label="Client">
          <select
            value={clientId}
            onChange={(event) => setClientId(event.target.value)}
            className={inputClass}
          >
            <option value="">Select client</option>
            {clients.data?.items.map((client) => (
              <option key={client.publicId} value={client.publicId}>
                {client.displayName}
              </option>
            ))}
          </select>
        </Field>
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
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          Invoice lines
        </p>
        {lines.map((line, index) => (
          <div
            key={index}
            className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1.4fr_1fr_0.45fr_0.65fr_0.55fr_auto]"
          >
            <input
              value={line.description}
              onChange={(event) => updateLine(index, { description: event.target.value })}
              placeholder="Service description"
              className={lineClass}
            />
            <select
              value={line.caseId}
              onChange={(event) => updateLine(index, { caseId: event.target.value })}
              className={lineClass}
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
              aria-label="Quantity"
              onChange={(event) => updateLine(index, { quantity: Number(event.target.value) })}
              className={lineClass}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={line.unitPrice}
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
              onChange={(event) => updateLine(index, { taxRate: event.target.value })}
              placeholder="Tax %"
              className={lineClass}
            />
            <button
              type="button"
              onClick={() =>
                setLines((current) => current.filter((_, lineIndex) => lineIndex !== index))
              }
              disabled={lines.length === 1}
              aria-label="Remove line"
              className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <footer className="mt-4 flex flex-wrap justify-between gap-3">
        <button
          type="button"
          onClick={() => setLines((current) => [...current, emptyLine()])}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold"
        >
          <Plus className="h-4 w-4" /> Add line
        </button>
        <button
          disabled={!valid || mutation.isPending}
          className="h-10 rounded-xl bg-slate-950 px-5 text-xs font-semibold text-white disabled:opacity-40"
        >
          {mutation.isPending ? "Issuing…" : "Issue invoice"}
        </button>
      </footer>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      <span className="mb-1.5 block text-xs font-semibold">{label}</span>
      {children}
    </label>
  );
}
const inputClass =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-orange-300";
const lineClass =
  "h-10 min-w-0 rounded-lg border border-slate-200 bg-white px-2 text-xs outline-none focus:border-orange-300";
