import type { Invoice } from "@/lib/api/finance";
import { formatDate, money } from "./finance-utils";

export function CreditNoteHistory({ items }: { items: Invoice["creditNotes"] }) {
  return (
    <section className="rounded-2xl border border-slate-200">
      <header className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-xs font-semibold">Credit note register</h3>
        <p className="text-[10px] text-slate-500">{items.length} audited adjustments</p>
      </header>
      <div className="divide-y divide-slate-100">
        {items.map((credit) => (
          <div key={credit.publicId} className="flex items-start justify-between gap-4 px-4 py-3">
            <div>
              <p className="text-xs font-semibold">{credit.noteNumber}</p>
              <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{credit.reason}</p>
              <p className="mt-1 text-[9px] text-slate-400">
                {credit.createdBy.displayName} · {formatDate(credit.createdAt)}
              </p>
            </div>
            <p className="shrink-0 text-xs font-semibold text-violet-700">
              {money(Number(credit.amount))}
            </p>
          </div>
        ))}
        {!items.length ? (
          <p className="py-8 text-center text-xs text-slate-500">No credit note issued.</p>
        ) : null}
      </div>
    </section>
  );
}
