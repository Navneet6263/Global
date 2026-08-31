"use client";

import type { CapacityRow, ForecastSummary, PerformanceRow } from "@/lib/contracts/analytics";
import { Section } from "@/components/layout/section";
import { StatusBadge } from "@/components/feedback/status-badge";
import { formatNumber, formatPercent } from "@/lib/formatting";
import { cn } from "@/lib/utils";

export function PerformanceTable({
  title,
  description,
  rows,
  entityLabel,
  performanceLabel = "SLA",
  exceptionLabel = "Overdue",
}: {
  title: string;
  description: string;
  rows: readonly PerformanceRow[];
  entityLabel: string;
  performanceLabel?: string;
  exceptionLabel?: string;
}) {
  return (
    <Section title={title} description={description} padded={false}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[11px] tracking-wide text-muted-foreground uppercase">
              <th scope="col" className="px-5 py-2.5">
                {entityLabel}
              </th>
              <th scope="col" className="px-3 py-2.5">
                Volume
              </th>
              <th scope="col" className="px-3 py-2.5">
                {performanceLabel}
              </th>
              <th scope="col" className="px-3 py-2.5">
                Avg TAT
              </th>
              <th scope="col" className="px-3 py-2.5">
                {exceptionLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/70 last:border-0">
                <td className="px-5 py-3 text-[13px] text-foreground">{row.name}</td>
                <td className="num px-3 py-3 text-[13px] text-foreground">
                  {formatNumber(row.volume)}
                </td>
                <td className="px-3 py-3">
                  {row.performanceRate === null ? (
                    <span className="text-xs text-muted-foreground">Not available</span>
                  ) : (
                    <StatusBadge
                      label={formatPercent(row.performanceRate)}
                      tone={
                        row.performanceRate >= 95
                          ? "success"
                          : row.performanceRate >= 90
                            ? "warning"
                            : "critical"
                      }
                      withDot={false}
                    />
                  )}
                </td>
                <td className="num px-3 py-3 text-[13px] text-muted-foreground">
                  {row.averageTurnaroundHours === null
                    ? "Not available"
                    : `${row.averageTurnaroundHours}h`}
                </td>
                <td className="num px-3 py-3 text-[13px] text-muted-foreground">
                  {formatPercent(row.exceptionRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

export function CapacityPanel({ rows }: { rows: readonly CapacityRow[] }) {
  return (
    <Section
      title="Owner workload"
      description="Assigned open work, overdue pressure and measured completions in this window."
      padded={false}
    >
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.id} className="space-y-2 px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 text-[13px] font-medium text-foreground">{row.owner}</p>
              <span className="num text-[11px] text-muted-foreground">
                {formatNumber(row.openLoad)} open · {formatNumber(row.overdue)} overdue ·{" "}
                {formatNumber(row.completed)} completed
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <span
                className={cn(
                  "block h-full rounded-full",
                  row.overdue > 0 ? "bg-critical" : "bg-success",
                )}
                style={{ width: `${Math.min(100, row.relativeLoad)}%` }}
                aria-hidden
              />
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function ForecastPanel({ summary }: { summary: ForecastSummary }) {
  const metrics = [
    ["Due next 7 days", summary.dueNext7Days],
    ["At risk next 7 days", summary.atRiskNext7Days],
    ["Projected completions", summary.projectedCompletions7Days],
    ["Unassigned active", summary.unassignedActive],
  ] as const;
  return (
    <Section
      title="Seven-day delivery outlook"
      description="Due work, current risk and projected completions from measured throughput."
    >
      <dl className="grid grid-cols-2 gap-3">
        {metrics.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-muted/25 p-4">
            <dt className="text-[11px] text-muted-foreground">{label}</dt>
            <dd className="num mt-2 text-2xl font-semibold text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
