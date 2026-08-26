import { useMutation } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, Eye, Search } from "lucide-react";
import { toast } from "sonner";

import { exportCases, type CaseListItem } from "@/lib/api/cases";
import { StakeholderPanel } from "../StakeholderShell";

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
    <StakeholderPanel
      title="Candidate portfolio"
      detail={`${items.length} authorised cases on this page`}
      action={
        <button
          type="button"
          onClick={() => exportMutation.mutate()}
          disabled={!items.length || exportMutation.isPending}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <Download className="h-3.5 w-3.5" />
          {exportMutation.isPending ? "Preparing…" : "Export portfolio"}
        </button>
      }
    >
      <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search candidate or case number"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-orange-300"
          />
        </label>
        <select
          aria-label="Filter cases by status"
          value={status}
          onChange={(event) => onStatus(event.target.value)}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold"
        >
          <option value="">All statuses</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {humanize(value)}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.1em] text-slate-500">
            <tr>
              {["Candidate", "Case", "Progress", "Due date", "Status", ""].map((label, index) => (
                <th key={`${label}-${index}`} className="px-5 py-3 font-semibold">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <PortfolioRow key={item.id} item={item} onOpen={() => onOpen(item.id)} />
            ))}
          </tbody>
        </table>
        {!items.length ? (
          <p className="py-14 text-center text-sm text-slate-500">No cases match this view.</p>
        ) : null}
      </div>
      <footer className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
        <span className="text-[11px] text-slate-500">Server page {page}</span>
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
    </StakeholderPanel>
  );
}
function PortfolioRow({ item, onOpen }: { item: CaseListItem; onOpen: () => void }) {
  const complete = item.checks.filter((check) => check.status === "COMPLETED").length;
  const progress = item.checks.length ? Math.round((complete / item.checks.length) * 100) : 0;
  return (
    <tr className="text-sm hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <button
          type="button"
          onClick={onOpen}
          className="text-left font-semibold hover:text-orange-600"
        >
          {item.subject.fullName}
        </button>
        <p className="mt-0.5 text-[10px] text-slate-500">
          {item.subject.employeeCode || "No employee code"}
        </p>
      </td>
      <td className="px-5 py-4 text-xs text-slate-600">{item.caseNumber}</td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-orange-400" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[10px] font-semibold">{progress}%</span>
        </div>
      </td>
      <td className="px-5 py-4 text-xs text-slate-500">
        {item.dueAt ? formatDate(item.dueAt) : "Not set"}
      </td>
      <td className="px-5 py-4">
        <Status value={item.status} />
      </td>
      <td className="px-5 py-4">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`View ${item.caseNumber}`}
          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-white"
        >
          <Eye className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
const statuses = [
  "CONSENT_PENDING",
  "READY",
  "IN_PROGRESS",
  "CLARIFICATION_PENDING",
  "QA_PENDING",
  "APPROVED",
  "COMPLETED",
  "CLOSED",
  "CANCELLED",
];
function Status({ value }: { value: string }) {
  const tone = ["COMPLETED", "CLOSED", "APPROVED"].includes(value)
    ? "bg-emerald-100 text-emerald-700"
    : ["CANCELLED", "REJECTED"].includes(value)
      ? "bg-red-100 text-red-700"
      : "bg-blue-100 text-blue-700";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${tone}`}>
      {humanize(value)}
    </span>
  );
}
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
      className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-35"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}
