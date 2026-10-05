import { useState } from "react";
import { CheckCheck } from "lucide-react";
import type { CaseDetail } from "@/lib/api/cases";
import { humanize, statusTone } from "./client-portal-utils";
import { caseDate } from "./client-case-activity";

export function ClientCaseChecks({ checks }: { checks: CaseDetail["checks"] }) {
  const [filter, setFilter] = useState("All");
  const rows = checks.filter(
    (check) =>
      filter === "All" ||
      (filter === "Completed" ? check.status === "COMPLETED" : check.status !== "COMPLETED"),
  );
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/60 p-4">
        <h3 className="text-sm font-bold">Verification checks</h3>
        <div className="flex gap-1" aria-label="Check filters">
          {["All", "Pending", "Completed"].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${filter === value ? "bg-blue-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
            >
              {value}
            </button>
          ))}
        </div>
      </header>
      <div className="divide-y divide-slate-100">
        {rows.map((check) => (
          <details key={check.publicId} className="group">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-4 hover:bg-slate-50">
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-lg ${check.status === "COMPLETED" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}
              >
                <CheckCheck className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{humanize(check.type)}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  {check.result ? humanize(check.result) : "Outcome not recorded yet"} · View
                  details
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusTone(check.status)}`}
              >
                {humanize(check.status)}
              </span>
              <span className="text-slate-400 group-open:rotate-180" aria-hidden>
                ⌄
              </span>
            </summary>
            <dl className="grid gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-3 text-xs sm:grid-cols-2">
              <div>
                <dt className="text-[11px] text-slate-500">Expected by</dt>
                <dd className="mt-1 font-medium">{caseDate(check.dueAt)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-slate-500">Completed at</dt>
                <dd className="mt-1 font-medium">{caseDate(check.completedAt)}</dd>
              </div>
            </dl>
          </details>
        ))}
      </div>
      {!rows.length && (
        <p className="p-8 text-center text-xs text-slate-500">No checks in this view.</p>
      )}
      <p className="border-t border-slate-100 px-4 py-3 text-[11px] text-slate-500">
        Individual outcomes are not a released final report.
      </p>
    </section>
  );
}
