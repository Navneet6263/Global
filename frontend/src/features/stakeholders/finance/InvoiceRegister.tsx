import { useMutation } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, Eye, Search } from "lucide-react";
import { toast } from "sonner";

import { exportFinanceLedger, type Invoice } from "@/lib/api/finance";
import { StakeholderPanel } from "../StakeholderShell";
import { formatDate, humanize, money } from "./finance-utils";

export function InvoiceRegister({
  items,
  search,
  status,
  page,
  hasPrevious,
  hasNext,
  onSearch,
  onStatus,
  onPrevious,
  onNext,
  onOpen,
}: {
  items: Invoice[];
  search: string;
  status: string;
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onSearch: (value: string) => void;
  onStatus: (value: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onOpen: (invoice: Invoice) => void;
}) {
  const exportMutation = useMutation({
    mutationFn: () => exportFinanceLedger({ search: search.trim(), status }),
    onError: (error) => toast.error("Ledger export failed", { description: error.message }),
  });
  return (
    <StakeholderPanel
      title="Invoice register"
      detail={`${items.length} invoices on this server page`}
      className="xl:col-span-2"
      action={
        <button
          type="button"
          onClick={() => exportMutation.mutate()}
          disabled={!items.length || exportMutation.isPending}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-[10px] font-semibold text-slate-600 disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" />
          {exportMutation.isPending ? "Preparing…" : "Export full ledger"}
        </button>
      }
    >
      <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search invoice or client"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-orange-300"
          />
        </label>
        <select
          aria-label="Filter invoices by status"
          value={status}
          onChange={(event) => onStatus(event.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold"
        >
          <option value="">All statuses</option>
          {[
            "ISSUED",
            "PARTIALLY_PAID",
            "PARTIALLY_CREDITED",
            "PAID",
            "CREDITED",
            "SETTLED",
            "OVERDUE",
            "CANCELLED",
          ].map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              {["Invoice", "Client", "Total", "Balance", "Due", "Status", ""].map(
                (label, index) => (
                  <th key={`${label}-${index}`} className="px-5 py-3 font-semibold">
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => {
              const balance =
                Number(item.totalAmount) - Number(item.paidAmount) - Number(item.creditedAmount);
              return (
                <tr key={item.id} className="text-sm hover:bg-slate-50/70">
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => onOpen(item)}
                      className="font-semibold hover:text-orange-600"
                    >
                      {item.invoiceNumber}
                    </button>
                    <p className="mt-0.5 text-[10px] text-slate-500">
                      {item.lines.length} line items
                    </p>
                  </td>
                  <td className="px-5 py-4 text-xs">{item.client.displayName}</td>
                  <td className="px-5 py-4 font-semibold">{money(Number(item.totalAmount))}</td>
                  <td className="px-5 py-4 text-xs">{money(balance)}</td>
                  <td className="px-5 py-4 text-xs text-slate-500">
                    {item.dueAt ? formatDate(item.dueAt) : "Not set"}
                  </td>
                  <td className="px-5 py-4">
                    <Status value={item.status} />
                  </td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => onOpen(item)}
                      aria-label={`View ${item.invoiceNumber}`}
                      className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!items.length ? (
          <p className="py-14 text-center text-sm text-slate-500">No invoices match this view.</p>
        ) : null}
      </div>
      <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
        <span className="text-[11px] text-slate-500">Server page {page}</span>
        <div className="flex gap-2">
          <PageButton
            icon={ChevronLeft}
            label="Previous invoice page"
            disabled={!hasPrevious}
            onClick={onPrevious}
          />
          <PageButton
            icon={ChevronRight}
            label="Next invoice page"
            disabled={!hasNext}
            onClick={onNext}
          />
        </div>
      </footer>
    </StakeholderPanel>
  );
}
function Status({ value }: { value: string }) {
  const tone = ["PAID", "CREDITED", "SETTLED"].includes(value)
    ? "bg-emerald-100 text-emerald-700"
    : value === "OVERDUE"
      ? "bg-red-100 text-red-700"
      : value === "CANCELLED"
        ? "bg-slate-100 text-slate-600"
        : "bg-amber-100 text-amber-700";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${tone}`}>
      {humanize(value)}
    </span>
  );
}
function PageButton({
  icon: Icon,
  label,
  disabled,
  onClick,
}: {
  icon: typeof ChevronLeft;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-35"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
