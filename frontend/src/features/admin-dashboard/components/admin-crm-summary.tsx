"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { CrmAdminSummary } from "@/features/crm/contracts/crm";
import { crmAccent } from "@/features/crm/accents";
import { Sparkline } from "@/components/charts/sparkline";
import { formatDateTime } from "@/lib/formatting";
import { cn } from "@/lib/utils";

/**
 * Read-only CRM oversight strip for Platform Admin.
 * Deliberately compact: no deal records, no stage actions, no drill-in.
 */
export function AdminCrmSummary({
  summary,
  showHeader = true,
}: {
  summary: CrmAdminSummary;
  showHeader?: boolean;
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/80 bg-card/85 p-5 shadow-[var(--shadow-card)] backdrop-blur-sm">
      {showHeader ? (
        <header className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[1.05rem] font-semibold tracking-[-0.01em] text-foreground">
              Sales &amp; CRM oversight
            </h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Read-only revenue signals. Deal execution stays with the Sales &amp; CRM workspace.
            </p>
          </div>
          <p className="num text-[11px] text-muted-foreground">
            Updated {formatDateTime(summary.generatedAt)}
          </p>
        </header>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summary.metrics.slice(0, 4).map((metric) => {
          const accent = crmAccent(metric.id);
          const Icon =
            metric.direction === "up"
              ? ArrowUpRight
              : metric.direction === "down"
                ? ArrowDownRight
                : Minus;

          return (
            <article
              key={metric.id}
              className="rounded-[1.3rem] border border-border/60 bg-background/60 p-3.5"
              style={{ borderTop: `2px solid ${accent.edge}` }}
            >
              <p className="text-[10.5px] tracking-[0.07em] text-muted-foreground uppercase">
                {metric.label}
              </p>
              <p className="num mt-1.5 text-[1.3rem] leading-none font-medium tracking-[-0.03em] text-foreground">
                {metric.display}
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span
                  className={cn(
                    "num inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
                  )}
                  style={{ background: accent.fill, color: accent.colour }}
                >
                  <Icon className="size-3" aria-hidden />
                  {Math.abs(metric.deltaPercent).toFixed(1)}%
                </span>
                <div className="w-16">
                  <Sparkline
                    data={metric.series.map((value, index) => ({
                      label: `P${index + 1}`,
                      value,
                    }))}
                    tone={metric.tone}
                    accent={accent.colour}
                    height={28}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-3">
        <Chip label="Pending follow-ups" value={summary.pendingFollowUps} accentId="openPipeline" />
        <Chip
          label="Overdue follow-ups"
          value={summary.overdueFollowUps}
          accentId="overdueFollowUps"
        />
        <Chip
          label="Unassigned opportunities"
          value={summary.unassignedOpportunities}
          accentId="activeOwners"
        />
      </ul>
    </section>
  );
}

function Chip({ label, value, accentId }: { label: string; value: number; accentId: string }) {
  const accent = crmAccent(accentId);
  return (
    <li
      className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-[12px]"
      style={{ background: accent.fill }}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="num font-semibold" style={{ color: accent.colour }}>
        {value}
      </span>
    </li>
  );
}
