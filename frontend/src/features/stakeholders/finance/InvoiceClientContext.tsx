import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Building2, CheckCircle2, FilePlus2, Plus, ReceiptText } from "lucide-react";
import { getBillingContext, type BillingContext } from "@/lib/backend-api/billing-context";
import { cn } from "@/lib/utils";
import { money } from "./finance-utils";

type Unbilled = BillingContext["unbilled"][number];

const shortDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      })
    : "—";

const validationLabel: Record<string, { text: string; tone: string }> = {
  PENDING: { text: "With the company to validate", tone: "bg-amber-50 text-amber-800" },
  VALIDATED: {
    text: "Validated · issue it from Monthly bills",
    tone: "bg-emerald-50 text-emerald-700",
  },
  QUERIED: { text: "Company raised a query", tone: "bg-red-50 text-red-700" },
};

/**
 * Everything Finance needs while writing a company's invoice: GST type, what the company
 * already owes, bills still with the company, and the released reports not yet billed,
 * each added to the invoice in one click at its booked price.
 */
export function InvoiceClientContext({
  clientId,
  added,
  onAdd,
}: {
  clientId: string;
  added: ReadonlySet<string>;
  onAdd: (items: Unbilled[]) => void;
}) {
  const context = useQuery({
    queryKey: ["finance", "billing-context", clientId],
    queryFn: () => getBillingContext(clientId),
    staleTime: 30_000,
  });
  if (context.isPending)
    return (
      <aside aria-label="Company billing details" className="space-y-3">
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </aside>
    );
  if (context.isError)
    return (
      <aside
        aria-label="Company billing details"
        className="rounded-2xl border border-red-200 bg-red-50 p-4 text-[13px] text-red-800"
      >
        Could not load this company's billing details. {context.error.message}
      </aside>
    );
  const { client, account, monthlyBills, unbilled } = context.data;
  const remaining = unbilled.filter((item) => !added.has(item.reportId));
  const overLimit = client.creditLimit !== null && account.outstanding > client.creditLimit;
  return (
    <aside aria-label="Company billing details" className="space-y-3 text-[13px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500">
            <Building2 className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-900">{client.legalName}</p>
            <p className="text-[12px] text-slate-500">
              {client.gstin ? `GSTIN ${client.gstin}` : "No GSTIN on record"} · {client.state}
            </p>
          </div>
        </div>
        <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-[12.5px] text-blue-800">
          {client.tax === "CGST_SGST"
            ? "Same state (Uttar Pradesh): GST is split as CGST + SGST."
            : `Other state (${client.state}): GST is charged as IGST.`}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-2">
          <Stat label="Outstanding" value={money(account.outstanding)} strong />
          <Stat
            label="Overdue"
            value={money(account.overdue)}
            hint={
              account.overdueInvoices ? `${account.overdueInvoices} invoice(s)` : "Nothing overdue"
            }
            alert={account.overdue > 0}
          />
          <Stat
            label="Billed so far"
            value={money(account.billed)}
            hint={`${account.invoices} invoices`}
          />
          <Stat label="Received" value={money(account.paid)} />
        </dl>
        {account.last ? (
          <p className="mt-3 text-[12px] text-slate-500">
            Last invoice <strong className="text-slate-700">{account.last.invoiceNumber}</strong> ·{" "}
            {shortDate(account.last.issuedAt)} · {money(account.last.total)} ·{" "}
            {account.last.status.toLowerCase().replaceAll("_", " ")}
          </p>
        ) : (
          <p className="mt-3 text-[12px] text-slate-500">No invoice issued to this company yet.</p>
        )}
        {client.creditHold || overLimit ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-[12.5px] text-red-700">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {client.creditHold
              ? "This company is on credit hold."
              : `Outstanding is above the credit limit of ${money(client.creditLimit ?? 0)}.`}
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <header className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-semibold text-slate-900">
            <ReceiptText className="size-4 text-blue-700" aria-hidden /> Ready to bill
          </h3>
          {remaining.length > 1 ? (
            <button
              type="button"
              onClick={() => onAdd(remaining)}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[12px] font-semibold text-white hover:bg-blue-700"
            >
              <FilePlus2 className="size-3.5" aria-hidden /> Add all {remaining.length}
            </button>
          ) : null}
        </header>
        <p className="mt-1 text-[12px] text-slate-500">
          Released reports not on any invoice or bill yet, at the price booked on the case.
        </p>
        {unbilled.length ? (
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {unbilled.map((item) => {
              const isAdded = added.has(item.reportId);
              const taxable = item.lines.reduce((sum, line) => sum + line.unitPrice, 0);
              return (
                <li
                  key={item.reportId}
                  className={cn(
                    "rounded-xl border px-3 py-2.5",
                    isAdded ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{item.candidateName}</p>
                      <p className="text-[12px] text-slate-500">
                        <span className="font-mono">{item.caseNumber}</span> · released{" "}
                        {shortDate(item.releasedAt)}
                      </p>
                      <p className="mt-0.5 truncate text-[12px] text-slate-600">
                        {item.lines.map((line) => line.description).join(", ") ||
                          "No price on the case"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="num font-semibold text-slate-900">{money(taxable)}</p>
                      {isAdded ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-700">
                          <CheckCircle2 className="size-3.5" aria-hidden /> Added
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onAdd([item])}
                          disabled={!item.lines.length}
                          aria-label={`Add ${item.caseNumber} to the invoice`}
                          className="mt-1 inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[12px] font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-40"
                        >
                          <Plus className="size-3.5" aria-hidden /> Add
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-3 text-center text-[12.5px] text-slate-500">
            Every released report of this company is already billed.
          </p>
        )}
        {unbilled.length ? (
          <p className="mt-3 flex justify-between border-t border-slate-100 pt-2 text-[12.5px] text-slate-600">
            <span>Not yet billed (before GST)</span>
            <strong className="num text-slate-900">{money(context.data.unbilledTaxable)}</strong>
          </p>
        ) : null}
      </section>

      {monthlyBills.length ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold text-slate-900">Monthly bills not yet invoiced</h3>
          <p className="mt-1 text-[12px] text-slate-500">
            Reports on these bills are already counted; don't bill them again here.
          </p>
          <ul className="mt-2 space-y-1.5">
            {monthlyBills.map((bill) => {
              const label =
                validationLabel[bill.validation ?? "PENDING"] ?? validationLabel["PENDING"]!;
              return (
                <li key={bill.invoiceNumber} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-slate-800">
                      {bill.invoiceNumber}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        label.tone,
                      )}
                    >
                      {label.text}
                    </span>
                  </span>
                  <span className="num shrink-0 font-semibold text-slate-900">
                    {money(bill.total)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}

function Stat({
  label,
  value,
  hint,
  strong,
  alert,
}: {
  label: string;
  value: string;
  hint?: string;
  strong?: boolean;
  alert?: boolean;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <dt className="text-[11.5px] text-slate-500">{label}</dt>
      <dd
        className={cn(
          "num text-[15px] font-semibold",
          alert ? "text-red-600" : strong ? "text-slate-900" : "text-slate-800",
        )}
      >
        {value}
      </dd>
      {hint ? <dd className="text-[11px] text-slate-400">{hint}</dd> : null}
    </div>
  );
}
