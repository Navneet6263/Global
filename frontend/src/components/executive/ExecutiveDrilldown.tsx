import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { ExecutiveCase } from "@/lib/api/dashboards";

export type ExecutiveDrilldownSelection = {
  kind: "all" | "overdue" | "sla" | "tat" | "status" | "client" | "branch" | "owner";
  value?: string;
  label: string;
};

export function ExecutiveDrilldown({
  selection,
  rows,
  onClose,
}: {
  selection: ExecutiveDrilldownSelection | null;
  rows: ExecutiveCase[];
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const visible = useMemo(
    () =>
      selection
        ? filterRows(rows, selection).filter((row) => {
            const haystack =
              `${row.caseNumber} ${row.subject.fullName} ${row.client.displayName}`.toLowerCase();
            return haystack.includes(search.toLowerCase());
          })
        : [],
    [rows, search, selection],
  );
  if (!selection) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-stone-950/20 backdrop-blur-[1px]"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <aside className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[.12em] text-orange-700">
              Portfolio drill-down
            </p>
            <h2 className="mt-1 text-lg font-bold">{selection.label}</h2>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {visible.length} matching cases · current filters retained
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl bg-secondary hover:bg-stone-200"
            aria-label="Close drill-down"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="border-b border-border px-5 py-3">
          <label className="flex h-9 items-center gap-2 rounded-xl bg-secondary/70 px-3">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search case, candidate or client"
              className="w-full bg-transparent text-xs outline-none"
            />
          </label>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {visible.length ? (
            <div className="space-y-2">
              {visible.map((row) => (
                <Link
                  key={row.id}
                  to="/cases/$caseId"
                  params={{ caseId: row.id }}
                  className="group flex items-center gap-3 rounded-xl border border-border/70 p-3 transition hover:border-orange-200 hover:bg-orange-50/35"
                >
                  <span className={`h-9 w-1 rounded-full ${riskTone(row.riskLevel)}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <strong className="text-[11px]">{row.caseNumber}</strong>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[8px] font-bold">
                        {humanize(row.status)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-[10px] text-muted-foreground">
                      {row.subject.fullName} · {row.client.displayName} ·{" "}
                      {row.owner?.displayName ?? "Unassigned"}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="block text-[9px] font-semibold">{humanize(row.priority)}</span>
                    <span className="mt-1 block text-[8px] text-muted-foreground">
                      {dueLabel(row.dueAt)}
                    </span>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-orange-700" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="grid h-64 place-items-center text-center">
              <div>
                <p className="text-sm font-semibold">No matching cases</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Try a different search or portfolio filter.
                </p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function filterRows(rows: ExecutiveCase[], selection: ExecutiveDrilldownSelection) {
  const now = Date.now();
  if (selection.kind === "all") return rows;
  if (selection.kind === "overdue")
    return rows.filter(
      (row) =>
        row.dueAt &&
        new Date(row.dueAt).getTime() < now &&
        !["COMPLETED", "CLOSED", "CANCELLED"].includes(row.status),
    );
  if (selection.kind === "sla") return rows.filter((row) => row.completedAt && row.dueAt);
  if (selection.kind === "tat") return rows.filter((row) => row.completedAt);
  if (selection.kind === "status") return rows.filter((row) => row.status === selection.value);
  if (selection.kind === "client")
    return rows.filter((row) => row.client.publicId === selection.value);
  if (selection.kind === "branch")
    return rows.filter(
      (row) =>
        row.branch?.publicId === selection.value ||
        (selection.value === "unassigned" && !row.branch),
    );
  return rows.filter(
    (row) =>
      row.owner?.publicId === selection.value || (selection.value === "unassigned" && !row.owner),
  );
}

function dueLabel(value: string | null) {
  if (!value) return "No due date";
  return `Due ${new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`;
}
function riskTone(value: string) {
  return ["HIGH", "CRITICAL"].includes(value)
    ? "bg-red-500"
    : value === "MEDIUM"
      ? "bg-amber-500"
      : "bg-emerald-500";
}
function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
