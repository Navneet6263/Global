import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, ExternalLink, RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import type { ExceptionsDashboard } from "@/lib/api/dashboards";
import { reviewFieldException } from "@/lib/api/field-visits";
import { resolveClarification } from "@/lib/api/clarifications";
import { humanize } from "../utils";
import { ExceptionAction } from "./ExceptionAction";
import {
  ageLabel,
  buildExceptionItems,
  severityTone,
  type ExceptionQueueItem,
} from "./exception-model";

export function ExceptionQueue({
  data,
  onRefresh,
}: {
  data: ExceptionsDashboard;
  onRefresh: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [page, setPage] = useState(1);
  const items = useMemo(() => buildExceptionItems(data), [data]);
  const filtered = items.filter(
    (item) =>
      (category === "ALL" || item.category === category) &&
      `${item.title} ${item.detail}`.toLowerCase().includes(search.toLowerCase()),
  );
  const pageSize = 10;
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice(
    (Math.min(page, pages) - 1) * pageSize,
    Math.min(page, pages) * pageSize,
  );
  const fieldAction = useMutation({
    mutationFn: ({ item, decision }: { item: ExceptionQueueItem; decision: "APPROVE" | "RETRY" }) =>
      reviewFieldException(item.id, {
        decision,
        version: item.version!,
        note:
          decision === "APPROVE"
            ? "Approved from exception triage"
            : "Fresh field capture requested from exception triage",
      }),
    onSuccess: async () => {
      toast.success("Field exception updated");
      await onRefresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const clarify = useMutation({
    mutationFn: (item: ExceptionQueueItem) =>
      resolveClarification(
        item.caseId,
        item.id,
        "Candidate response reviewed from exception triage",
      ),
    onSuccess: async () => {
      toast.success("Clarification resolved");
      await onRefresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
        <div className="relative min-w-[16rem] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search candidate, case or client"
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-orange-300"
          />
        </div>
        <select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setPage(1);
          }}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold"
        >
          <option value="ALL">All exception types</option>
          <option value="OVERDUE">SLA overdue</option>
          <option value="CLARIFICATION">Clarifications</option>
          <option value="FIELD">Field geofence</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left">
          <thead className="bg-slate-50 text-[9px] font-bold uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-4 py-3">Priority / type</th>
              <th className="px-4 py-3">Affected work</th>
              <th className="px-4 py-3">Age</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((item) => (
              <tr key={`${item.category}-${item.id}`} className="hover:bg-slate-50/70">
                <td className="px-4 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${severityTone(item.severity)}`}
                  >
                    {item.severity}
                  </span>
                  <p className="mt-2 text-[10px] font-semibold text-slate-500">
                    {humanize(item.category)}
                  </p>
                </td>
                <td className="px-4 py-4">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                </td>
                <td className="px-4 py-4 text-xs font-semibold">{ageLabel(item.age)}</td>
                <td className="px-4 py-4">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold text-slate-600">
                    {humanize(item.status)}
                  </span>
                </td>
                <td className="px-4 py-4">
                  <div className="flex justify-end gap-2">
                    {item.category === "FIELD" ? (
                      <>
                        <ExceptionAction
                          title="Approve exception"
                          onClick={() => fieldAction.mutate({ item, decision: "APPROVE" })}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </ExceptionAction>
                        <ExceptionAction
                          title="Request retry"
                          onClick={() => fieldAction.mutate({ item, decision: "RETRY" })}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </ExceptionAction>
                      </>
                    ) : null}
                    {item.category === "CLARIFICATION" && item.status === "RESPONDED" ? (
                      <button
                        onClick={() => clarify.mutate(item)}
                        className="rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-semibold text-white"
                      >
                        Resolve
                      </button>
                    ) : null}
                    <Link
                      to="/cases/$caseId"
                      params={{ caseId: item.caseId }}
                      className="rounded-lg border border-slate-200 bg-white p-2 hover:bg-slate-50"
                      title="Open Case 360"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!visible.length ? (
        <p className="px-5 py-14 text-center text-sm text-slate-500">
          No exceptions match this triage view.
        </p>
      ) : null}
      <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-500">
        <span>
          Showing {visible.length ? (Math.min(page, pages) - 1) * pageSize + 1 : 0}–
          {Math.min(Math.min(page, pages) * pageSize, filtered.length)} of {filtered.length}
        </span>
        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
            className="rounded-lg border p-2 disabled:opacity-30"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span>
            Page {Math.min(page, pages)} of {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => setPage((value) => value + 1)}
            className="rounded-lg border p-2 disabled:opacity-30"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </footer>
    </section>
  );
}
