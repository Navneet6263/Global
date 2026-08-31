import type { Invoice } from "@/lib/api/finance";
import { formatDate, money } from "./finance-utils";

export function CreditNoteHistory({ items }: { items: Invoice["creditNotes"] }) {
  return (
    <section className="surface overflow-hidden rounded-2xl">
      <header className="border-b border-border px-4 py-3">
        <h3 className="text-xs font-semibold text-foreground">Credit note register</h3>
        <p className="num text-[10px] text-muted-foreground">{items.length} audited adjustments</p>
      </header>
      <div className="divide-y divide-border/70">
        {items.map((credit) => (
          <div key={credit.publicId} className="flex items-start justify-between gap-4 px-4 py-3">
            <div>
              <p className="num text-xs font-semibold text-foreground">{credit.noteNumber}</p>
              <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">{credit.reason}</p>
              <p className="mt-1 text-[9px] text-muted-foreground">
                {credit.createdBy.displayName} · {formatDate(credit.createdAt)}
              </p>
            </div>
            <p className="num shrink-0 text-xs font-semibold text-review-foreground">
              {money(Number(credit.amount))}
            </p>
          </div>
        ))}
        {!items.length ? (
          <p className="py-8 text-center text-xs text-muted-foreground">No credit note issued.</p>
        ) : null}
      </div>
    </section>
  );
}
