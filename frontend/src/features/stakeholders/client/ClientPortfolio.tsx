import { useMutation } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Section } from "@/components/layout/section";
import { exportCases, type CaseListItem } from "@/lib/api/cases";
import { humanize } from "./client-portal-utils";
import { ClientPortfolioRow } from "./ClientPortfolioRow";

export function ClientPortfolio({
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
  items: CaseListItem[];
  search: string;
  status: string;
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onSearch: (value: string) => void;
  onStatus: (value: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onOpen: (id: string) => void;
}) {
  const exportMutation = useMutation({
    mutationFn: () => exportCases({ search: search.trim(), status }),
    onError: (error) => toast.error("Portfolio export failed", { description: error.message }),
  });
  return (
    <Section
      title="All verifications"
      description={`${items.length} cases on this secure client-scoped page`}
      actions={
        <button
          type="button"
          onClick={() => exportMutation.mutate()}
          disabled={!items.length || exportMutation.isPending}
          aria-busy={exportMutation.isPending}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3 text-[11px] font-medium text-muted-foreground shadow-[var(--shadow-card)] transition hover:border-border-strong hover:text-foreground disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" />
          {exportMutation.isPending ? "Preparing…" : "Export portfolio"}
        </button>
      }
      padded={false}
    >
      <div className="border-b border-border bg-card/45 p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search candidate or case number"
              className="h-10 w-full rounded-full border border-border bg-muted/45 pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/45 focus:bg-card focus:ring-4 focus:ring-primary/8"
            />
          </label>
          <select
            aria-label="Filter cases by status"
            value={status}
            onChange={(event) => onStatus(event.target.value)}
            className="h-10 rounded-full border border-border bg-card px-4 text-xs font-medium text-foreground outline-none focus:border-primary/45"
          >
            <option value="">All statuses</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-0.5">
          <SlidersHorizontal className="size-3.5 shrink-0 text-muted-foreground" />
          {quickFilters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => onStatus(filter.value)}
              className={`h-8 shrink-0 rounded-full px-3 text-[10px] font-medium transition ${status === filter.value ? "bg-mint-deep text-white shadow-[var(--shadow-card)]" : "bg-muted/55 text-muted-foreground hover:bg-mint-soft hover:text-mint-deep"}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left">
          <thead className="bg-muted/35 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              {["Candidate", "Case", "Current stage", "Progress", "SLA", "Last update", ""].map(
                (label, index) => (
                  <th key={`${label}-${index}`} className="px-5 py-3 font-semibold">
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/70">
            {items.map((item) => (
              <ClientPortfolioRow key={item.id} item={item} onOpen={() => onOpen(item.id)} />
            ))}
          </tbody>
        </table>
        {!items.length ? (
          <div className="m-5 rounded-2xl border border-dashed border-border-strong bg-muted/20 py-14 text-center">
            <p className="text-sm font-semibold text-foreground">No matching verification</p>
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
            label="Previous page"
            disabled={!hasPrevious}
            onClick={onPrevious}
            icon={ChevronLeft}
          />
          <PageButton label="Next page" disabled={!hasNext} onClick={onNext} icon={ChevronRight} />
        </div>
      </footer>
    </Section>
  );
}

const statuses = [
  "DRAFT",
  "CONSENT_PENDING",
  "DOCUMENT_PENDING",
  "IN_PROGRESS",
  "CLARIFICATION_PENDING",
  "QA_REVIEW",
  "MANAGER_REVIEW",
  "REPORT_PENDING",
  "PAYMENT_PENDING",
  "COMPLETED",
  "CLOSED",
  "CANCELLED",
];
const quickFilters = [
  { label: "All", value: "" },
  { label: "Clarifications", value: "CLARIFICATION_PENDING" },
  { label: "Documents", value: "DOCUMENT_PENDING" },
  { label: "In progress", value: "IN_PROGRESS" },
  { label: "Quality review", value: "QA_REVIEW" },
  { label: "Approval", value: "MANAGER_REVIEW" },
  { label: "Payment & release", value: "PAYMENT_PENDING" },
  { label: "Completed", value: "COMPLETED" },
];

function PageButton({
  label,
  disabled,
  onClick,
  icon: Icon,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  icon: typeof ChevronLeft;
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
