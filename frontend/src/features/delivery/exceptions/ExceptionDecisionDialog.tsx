import { Loader2, X } from "lucide-react";
import { useState } from "react";

import { humanize } from "../utils";
import type { ExceptionQueueItem } from "./exception-model";

export type ExceptionDecision = "APPROVE" | "RETRY" | "RESOLVE";

export function ExceptionDecisionDialog({
  item,
  decision,
  busy,
  onClose,
  onConfirm,
}: {
  item: ExceptionQueueItem;
  decision: ExceptionDecision;
  busy: boolean;
  onClose: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <button className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close" />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (note.trim().length >= 5) onConfirm(note.trim());
        }}
        className="relative w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
      >
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-orange-600">
              {humanize(decision)} exception
            </p>
            <h2 className="mt-1 text-base font-semibold">{item.title}</h2>
            <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border p-2">
            <X className="h-4 w-4" />
          </button>
        </header>
        <label className="mt-5 block text-xs font-semibold">
          Decision note
          <textarea
            autoFocus
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1000}
            rows={4}
            placeholder="Record the evidence reviewed and the reason for this decision"
            className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-orange-300"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border px-4 py-2 text-xs">
            Cancel
          </button>
          <button
            disabled={note.trim().length < 5 || busy}
            aria-busy={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Confirm {humanize(decision)}
          </button>
        </div>
      </form>
    </div>
  );
}
