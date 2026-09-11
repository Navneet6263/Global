import { useMutation } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, Eye, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

import { Section } from "@/components/layout/section";
import { exportFinanceLedger, type Invoice } from "@/lib/api/finance";
import { formatDate, humanize, money } from "./finance-utils";

export function InvoiceRegister({
  items,
  pending = false,
  unavailable = false,
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
  pending?: boolean;
  unavailable?: boolean;
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
    <Section
      title="Invoice register"
      description={`${items.length} invoices on this server page`}
      actions={
        <button
          type="button"
          onClick={() => exportMutation.mutate()}
          disabled={pending || !items.length || exportMutation.isPending}
          aria-busy={exportMutation.isPending}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-[10px] font-medium text-muted-foreground shadow-[var(--shadow-card)] transition hover:border-border-strong hover:text-foreground disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" />
          {exportMutation.isPending ? "Preparing…" : "Export full ledger"}
        </button>
      }
      padded={false}
    >
      <div className="flex flex-col gap-2 border-b border-border bg-card/45 p-4 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search invoice or client"
            aria-label="Search invoices"
            className="h-10 w-full rounded-full border border-border bg-muted/45 pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/45 focus:bg-card focus:ring-4 focus:ring-primary/8"
          />
        </label>
        <select
          aria-label="Filter invoices by status"
          value={status}
          onChange={(event) => onStatus(event.target.value)}
          className="h-10 rounded-full border border-border bg-card px-4 text-xs font-medium text-foreground outline-none focus:border-primary/45"
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
      {pending ? (
        <p
          className="flex items-center gap-2 px-5 py-2 text-xs text-muted-foreground"
          role="status"
        >
          <Loader2 className="size-3 animate-spin" />
          Updating invoices
        </p>
      ) : null}
      <div className="min-h-48 overflow-x-auto" inert={pending || unavailable} aria-busy={pending}>
        <table className="w-full min-w-[820px] text-left">
          <thead className="bg-muted/35 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
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
          <tbody className="divide-y divide-border/70">
            {items.map((item) => {
              const balance =
                Number(item.totalAmount) - Number(item.paidAmount) - Number(item.creditedAmount);
              return (
                <tr key={item.id} className="group text-sm transition hover:bg-mint-soft/30">
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => onOpen(item)}
                      className="num font-semibold text-foreground hover:text-primary"
                    >
                      {item.invoiceNumber}
                    </button>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {item.lines.length} line items
                    </p>
                  </td>
                  <td className="px-5 py-4 text-xs text-foreground">{item.client.displayName}</td>
                  <td className="num px-5 py-4 font-semibold text-foreground">
                    {money(Number(item.totalAmount))}
                  </td>
                  <td className="num px-5 py-4 text-xs text-foreground">{money(balance)}</td>
                  <td className="px-5 py-4 text-xs text-muted-foreground">
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
                      className="grid size-8 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-[var(--shadow-card)] transition group-hover:border-primary/30 group-hover:text-primary"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {unavailable ? (
          <p className="p-5 text-sm text-muted-foreground">
            Invoice list unavailable. Retry using the message above.
          </p>
        ) : !items.length && !pending ? (
          <div className="m-5 rounded-2xl border border-dashed border-border-strong bg-muted/20 py-14 text-center">
            <p className="text-sm font-semibold text-foreground">No matching invoice</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Try another search or status filter.
            </p>
          </div>
        ) : null}
      </div>
      <footer className="flex items-center justify-between border-t border-border px-5 py-3">
        <span className="num text-[11px] text-muted-foreground">Page {page}</span>
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
    </Section>
  );
}
function Status({ value }: { value: string }) {
  const tone = ["PAID", "CREDITED", "SETTLED"].includes(value)
    ? "bg-success-soft text-success-foreground ring-success/20"
    : value === "OVERDUE"
      ? "bg-critical-soft text-critical-foreground ring-critical/20"
      : value === "CANCELLED"
        ? "bg-neutral-soft text-neutral-foreground ring-neutral/20"
        : "bg-warning-soft text-warning-foreground ring-warning/20";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset ${tone}`}
    >
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
      className="grid size-8 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-[var(--shadow-card)] hover:border-border-strong hover:text-foreground disabled:opacity-35"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
