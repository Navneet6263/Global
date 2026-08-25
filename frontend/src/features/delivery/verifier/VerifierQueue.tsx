import { ChevronLeft, ChevronRight, Clock3, Search } from "lucide-react";

import { formatDate, humanize } from "../utils";
import type { VerificationTask } from "@/lib/api/tasks";

export function VerifierQueue({
  items,
  selectedId,
  search,
  hasPrevious,
  hasNext,
  onSearch,
  onPrevious,
  onNext,
  onSelect,
}: {
  items: VerificationTask[];
  selectedId?: string | undefined;
  search: string;
  hasPrevious: boolean;
  hasNext: boolean;
  onSearch: (value: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search case, candidate or client"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
          />
        </div>
      </div>
      <div className="max-h-[680px] divide-y divide-slate-100 overflow-y-auto">
        {items.map((task) => {
          const overdue = Boolean(
            task.dueAt &&
            new Date(task.dueAt).getTime() < Date.now() &&
            task.status !== "COMPLETED",
          );
          return (
            <button
              key={task.id}
              onClick={() => onSelect(task.id)}
              className={`w-full px-4 py-4 text-left transition ${selectedId === task.id ? "bg-orange-50" : "hover:bg-slate-50"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {task.check.case.subject.fullName}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {task.check.case.caseNumber} · {humanize(task.check.type)}
                  </p>
                </div>
                <Status status={task.status} />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-[10px] text-slate-500">
                <span className="truncate">{task.check.case.client.displayName}</span>
                <span
                  className={`flex shrink-0 items-center gap-1 ${overdue ? "font-semibold text-red-600" : ""}`}
                >
                  <Clock3 className="h-3 w-3" />
                  {task.dueAt ? formatDate(task.dueAt) : "No due date"}
                </span>
              </div>
            </button>
          );
        })}
        {!items.length ? (
          <p className="px-5 py-14 text-center text-sm text-slate-500">
            No tasks match these filters.
          </p>
        ) : null}
      </div>
      <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
        <span className="text-[11px] font-medium text-slate-500">
          {items.length} checks on this page
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPrevious}
            disabled={!hasPrevious}
            aria-label="Previous task page"
            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={!hasNext}
            aria-label="Next task page"
            className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </footer>
    </section>
  );
}

export function Status({ status }: { status: string }) {
  const tone =
    status === "COMPLETED"
      ? "bg-emerald-100 text-emerald-700"
      : status === "BLOCKED"
        ? "bg-red-100 text-red-700"
        : status === "IN_PROGRESS"
          ? "bg-blue-100 text-blue-700"
          : "bg-amber-100 text-amber-700";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${tone}`}>
      {humanize(status)}
    </span>
  );
}
