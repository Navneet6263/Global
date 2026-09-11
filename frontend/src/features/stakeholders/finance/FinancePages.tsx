import { FileCheck2, ReceiptIndianRupee, WalletCards } from "lucide-react";
import { WorkspaceLinks } from "@/features/delivery/shared/WorkspaceLinks";
import { MonthlyStatement } from "./MonthlyStatement";

export function FinanceOverviewLinks({ canWrite }: { canWrite: boolean }) {
  return (
    <WorkspaceLinks
      items={[
        ...(canWrite
          ? [
              {
                title: "Prepare billing",
                detail: "Start with approved reports and their contracted charges.",
                to: "/finance/billing",
                icon: FileCheck2,
                tone: "mint" as const,
              },
            ]
          : []),
        {
          title: "Open invoice register",
          detail: "Search invoices, view originals and record a payment from the invoice detail.",
          to: "/finance/invoices",
          icon: ReceiptIndianRupee,
          tone: "blue",
        },
        {
          title: "Follow up overdue balances",
          detail: "Prioritise overdue invoices before reviewing other payment statuses.",
          to: "/finance/collections",
          icon: WalletCards,
          tone: "amber",
        },
      ]}
    />
  );
}

export function FinanceStatements() {
  return (
    <section className="rounded-3xl border border-info/20 bg-gradient-to-br from-info-soft/35 to-card p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-base font-semibold">Monthly client ledger</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Choose the client and month to download opening balance, invoices, payments, credit notes
        and closing balance as a CSV.
      </p>
      <div className="mt-5">
        <MonthlyStatement />
      </div>
      <p className="mt-5 border-t border-border/60 pt-4 text-xs text-muted-foreground">
        Uses Indian calendar months and recorded ledger entries. This is a current ledger export,
        not a frozen month-end snapshot.
      </p>
    </section>
  );
}
