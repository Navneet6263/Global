"use client";

import type { CapacityRow, ForecastPoint, PerformanceRow } from "@/lib/contracts/analytics";
import { Section } from "@/components/layout/section";
import { StatusBadge } from "@/components/feedback/status-badge";
import { formatNumber, formatPercent } from "@/lib/formatting";
import { cn } from "@/lib/utils";

export function PerformanceTable({
  title,
  description,
  rows,
  entityLabel,
}: {
  title: string;
  description: string;
  rows: readonly PerformanceRow[];
  entityLabel: string;
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
                SLA
              </th>
              <th scope="col" className="px-3 py-2.5">
                Avg TAT
              </th>
              <th scope="col" className="px-3 py-2.5">
                Discrepancy
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
                  <StatusBadge
                    label={formatPercent(row.slaAttainment)}
                    tone={
                      row.slaAttainment >= 95
                        ? "success"
                        : row.slaAttainment >= 90
                          ? "warning"
                          : "critical"
                    }
                    withDot={false}
                  />
                </td>
                <td className="num px-3 py-3 text-[13px] text-muted-foreground">
                  {row.averageTurnaroundHours}h
                </td>
                <td className="num px-3 py-3 text-[13px] text-muted-foreground">
                  {formatPercent(row.discrepancyRate)}
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
      title="Team capacity"
      description="Open load against sustainable capacity per operations team."
      padded={false}
    >
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.id} className="space-y-2 px-5 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 flex-1 text-[13px] font-medium text-foreground">{row.team}</p>
              <span className="num text-[11px] text-muted-foreground">
                {row.headcount} people · {formatNumber(row.openLoad)}/{formatNumber(row.capacity)}{" "}
                cases
              </span>
              <StatusBadge
                label={formatPercent(row.utilisation)}
                tone={
                  row.utilisation > 95 ? "critical" : row.utilisation > 85 ? "warning" : "success"
                }
                withDot={false}
              />
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <span
                className={cn(
                  "block h-full rounded-full",
                  row.utilisation > 95
                    ? "bg-critical"
                    : row.utilisation > 85
                      ? "bg-warning"
                      : "bg-success",
                )}
                style={{ width: `${Math.min(100, row.utilisation)}%` }}
                aria-hidden
              />
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function ForecastPanel({ rows }: { rows: readonly ForecastPoint[] }) {
  return (
    <Section
      title="Next-week forecast"
      description="Projected intake, completions and SLA risk based on current pipeline velocity."
      padded={false}
    >
      <ul className="divide-y divide-border">
        {rows.map((row) => (
          <li key={row.label} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <p className="min-w-0 flex-1 text-[13px] text-foreground">{row.label}</p>
            <span className="num text-[12px] text-muted-foreground">
              {row.expectedIntake} in · {row.expectedCompletions} out
            </span>
            <StatusBadge
              label={`${row.slaRisk} at risk`}
              tone={row.slaRisk > 10 ? "critical" : row.slaRisk > 5 ? "warning" : "success"}
            />
          </li>
        ))}
      </ul>
    </Section>
  );
}
