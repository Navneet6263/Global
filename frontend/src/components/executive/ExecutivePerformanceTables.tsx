import { Building2, GitBranch, Trophy } from "lucide-react";
import { useState } from "react";

import type { ExecutiveDashboard, ExecutivePerformanceRow } from "@/lib/api/dashboards";

export function ExecutivePerformanceTables({
  data,
  onSelect,
}: {
  data: ExecutiveDashboard;
  onSelect: (kind: "client" | "branch", id: string, name: string) => void;
}) {
  const [lens, setLens] = useState<"client" | "branch">("client");
  const rows = lens === "client" ? data.clientPerformance : data.branchPerformance;
  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet-50 text-violet-700">
            <Trophy className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold">Performance leaderboard</h2>
            <p className="text-[10px] text-muted-foreground">
              Volume, delivery and SLA by operating lens
            </p>
          </div>
        </div>
        <div className="flex rounded-lg bg-secondary/70 p-1">
          <LensButton
            active={lens === "client"}
            onClick={() => setLens("client")}
            icon={Building2}
            label="Client"
          />
          <LensButton
            active={lens === "branch"}
            onClick={() => setLens("branch")}
            icon={GitBranch}
            label="Branch"
          />
        </div>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[610px] text-left">
            <thead className="bg-secondary/35 text-[9px] uppercase tracking-[.1em] text-muted-foreground">
              <tr>
                <th className="px-5 py-2.5">{lens}</th>
                <th className="px-3 py-2.5">Portfolio</th>
                <th className="px-3 py-2.5">Active</th>
                <th className="px-3 py-2.5">Overdue</th>
                <th className="px-3 py-2.5">SLA</th>
                <th className="px-5 py-2.5">TAT</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((row) => (
                <PerformanceRow
                  key={row.id}
                  row={row}
                  onClick={() => onSelect(lens, row.id, row.name)}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty />
      )}
    </section>
  );
}

function PerformanceRow({ row, onClick }: { row: ExecutivePerformanceRow; onClick: () => void }) {
  return (
    <tr
      onClick={onClick}
      className="cursor-pointer border-t border-border/60 text-[11px] transition hover:bg-orange-50/35"
    >
      <td className="px-5 py-3 font-semibold">{row.name}</td>
      <td className="num px-3 py-3">{row.total}</td>
      <td className="num px-3 py-3">{row.active}</td>
      <td
        className={`num px-3 py-3 ${row.overdue ? "font-bold text-red-700" : "text-muted-foreground"}`}
      >
        {row.overdue}
      </td>
      <td className="px-3 py-3">
        <span
          className={`rounded-full px-2 py-1 text-[9px] font-bold ${row.slaPercentage === null ? "bg-stone-100 text-stone-500" : row.slaPercentage >= 90 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
        >
          {row.slaPercentage === null ? "—" : `${row.slaPercentage}%`}
        </span>
      </td>
      <td className="num px-5 py-3 text-muted-foreground">
        {row.averageTatHours === null ? "—" : `${row.averageTatHours}h`}
      </td>
    </tr>
  );
}

function LensButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Building2;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[9px] font-semibold ${active ? "bg-white shadow-sm" : "text-muted-foreground"}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}

function Empty() {
  return (
    <div className="grid h-40 place-items-center text-xs text-muted-foreground">
      No performance data for this filter.
    </div>
  );
}
