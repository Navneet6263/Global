import { ChevronLeft, ChevronRight, Search, ShieldCheck } from "lucide-react";
import { useState } from "react";

import type { QaQueueItem } from "@/lib/api/qa";
import { formatDate } from "../utils";

export function QaQueue({
  items,
  selectedId,
  search,
  onSearch,
  onSelect,
}: {
  items: QaQueueItem[];
  selectedId?: string | undefined;
  search: string;
  onSearch: (value: string) => void;
  onSelect: (id: string) => void;
}) {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, pages);
  const visibleItems = items.slice((safePage - 1) * pageSize, safePage * pageSize);
  const goToPage = (target: number) => {
    const nextPage = Math.max(1, Math.min(pages, target));
    setPage(nextPage);
    const firstItem = items[(nextPage - 1) * pageSize];
    if (firstItem) onSelect(firstItem.id);
  };
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => {
              onSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search candidate, case or client"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-orange-300"
          />
        </div>
      </div>
      <div className="max-h-[720px] divide-y divide-slate-100 overflow-y-auto">
        {visibleItems.map((item) => {
          const highRisk = item.checks.some((check) =>
            ["HIGH", "CRITICAL"].includes(check.riskLevel ?? ""),
          );
          const overdue = Boolean(item.dueAt && new Date(item.dueAt).getTime() < Date.now());
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`w-full p-4 text-left transition ${selectedId === item.id ? "bg-orange-50" : "hover:bg-slate-50"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{item.subject.fullName}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {item.caseNumber} · {item.client.displayName}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${highRisk ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}
                >
                  {highRisk ? "High risk" : "Review"}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
                <span>{item.checks.length} completed checks</span>
                <span className={overdue ? "font-semibold text-red-600" : ""}>
                  {item.dueAt ? formatDate(item.dueAt) : "No due date"}
                </span>
              </div>
              {item.qaReviewer ? (
                <p className="mt-2 flex items-center gap-1 text-[10px] font-semibold text-violet-700">
                  <ShieldCheck className="h-3 w-3" /> Claimed by {item.qaReviewer.displayName}
                </p>
              ) : null}
            </button>
          );
        })}
        {!items.length ? (
          <p className="px-5 py-14 text-center text-sm text-slate-500">
            No cases match this review view.
          </p>
        ) : null}
      </div>
      <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
        <span className="text-[11px] font-medium text-slate-500">
          Page {safePage} of {pages} Â· {items.length} cases
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => goToPage(safePage - 1)}
            disabled={safePage === 1}
            aria-label="Previous review page"
            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => goToPage(safePage + 1)}
            disabled={safePage === pages}
            aria-label="Next review page"
            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </section>
  );
}
