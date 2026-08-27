import { Eye } from "lucide-react";

import type { CaseListItem } from "@/lib/api/cases";
import {
  caseProgress,
  caseStatusLabel,
  formatDate,
  relativeTime,
  slaText,
  statusTone,
} from "./client-portal-utils";

export function ClientPortfolioRow({ item, onOpen }: { item: CaseListItem; onOpen: () => void }) {
  const complete = item.checks.filter((check) => check.status === "COMPLETED").length;
  const progress = caseProgress(item);
  const overdue =
    Boolean(item.dueAt && new Date(item.dueAt).getTime() < Date.now()) &&
    !["COMPLETED", "CLOSED", "CANCELLED"].includes(item.status);
  return (
    <tr className="group text-sm transition hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-orange-50 text-[10px] font-bold text-orange-700">
            {initials(item.subject.fullName)}
          </span>
          <div className="min-w-0">
            <button
              type="button"
              onClick={onOpen}
              className="block max-w-48 truncate text-left text-xs font-semibold hover:text-orange-700"
            >
              {item.subject.fullName}
            </button>
            <p className="mt-0.5 text-[10px] text-slate-500">
              {item.subject.employeeCode || "Candidate record"}
            </p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <p className="text-xs font-medium text-slate-700">{item.caseNumber}</p>
        <p className="mt-0.5 text-[10px] text-slate-400">Created {relativeTime(item.createdAt)}</p>
      </td>
      <td className="px-5 py-4">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-bold ring-1 ring-inset ${statusTone(item.status)}`}
        >
          {caseStatusLabel(item.status)}
        </span>
      </td>
      <td className="px-5 py-4">
        <div className="w-32">
          <div className="flex items-center justify-between text-[9px] font-semibold text-slate-500">
            <span>
              {complete}/{item.checks.length} checks
            </span>
            <span>{progress}%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${progress === 100 ? "bg-emerald-500" : "bg-orange-400"}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <p className={`text-[11px] font-semibold ${overdue ? "text-red-600" : "text-slate-700"}`}>
          {slaText(item.dueAt, item.status)}
        </p>
        <p className="mt-0.5 text-[9px] text-slate-400">
          {item.dueAt ? formatDate(item.dueAt) : "No committed date"}
        </p>
      </td>
      <td className="px-5 py-4 text-[11px] text-slate-500">{relativeTime(item.updatedAt)}</td>
      <td className="px-5 py-4">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`View ${item.caseNumber}`}
          className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 transition group-hover:border-orange-200 group-hover:bg-white group-hover:text-orange-700"
        >
          <Eye className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
