import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { ErrorState } from "@/components/feedback/error-state";
import { ChartSkeleton } from "@/components/feedback/skeletons";
import { StatusBadge } from "@/components/feedback/status-badge";
import { OPS_SLA_META, OPS_STAGE_META } from "@/features/operations/contracts/case";
import { useOpsSla } from "@/features/operations/hooks/use-operations";
import { formatDuration, formatPercent } from "@/lib/formatting";

export const Route = createFileRoute("/operations/sla")({
  head: () => ({
    meta: [
      { title: "SLA Monitor — Sapling Global Operations" },
      {
        name: "description",
        content:
          "Breach risk, stage ageing, client and package on-time performance with root-cause breach reasons.",
      },
      { property: "og:title", content: "SLA Monitor — Sapling Global Operations" },
      {
        property: "og:description",
        content: "Track SLA health, ageing and breach causes across the verification portfolio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SlaMonitorPage,
});

function SlaMonitorPage() {
  const { data, isPending, isError, isFetching, refetch } = useOpsSla({});

  return (
    <div className="space-y-6">
      <PageHeader
        title="SLA monitor"
        description="Where commitments are slipping, how old work is by stage, and which reasons drive breaches."
      />

      {isError ? <ErrorState onRetry={() => void refetch()} retrying={isFetching} /> : null}

      {isPending || !data ? (
        <ChartSkeleton height={320} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Kpi label="SLA health" value={formatPercent(data.healthPercent)} />
            <Kpi label="Due today" value={String(data.dueToday)} />
            <Kpi label="Due tomorrow" value={String(data.dueTomorrow)} />
            <Kpi label="Overdue" value={String(data.overdue)} tone="critical" />
            <Kpi label="Avg turnaround" value={formatDuration(data.averageTurnaroundMinutes)} />
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Section
              title="On-time trend"
              description="Weekly on-time percentage and breach count."
            >
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={[...data.weeklyTrend]} margin={{ left: -18, right: 8, top: 8 }}>
                    <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      domain={[75, 100]}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 14,
                        border: "1px solid var(--border)",
                        fontSize: 12,
                        background: "var(--card)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="onTimePercent"
                      name="On time %"
                      stroke="var(--success)"
                      strokeWidth={1.75}
                      dot={{ r: 2.5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Section>

            <Section title="Breach reasons" description="Root causes behind missed commitments.">
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[...data.breachReasons]}
                    layout="vertical"
                    margin={{ left: 24, right: 12 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 6"
                      stroke="var(--border)"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="reason"
                      width={168}
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 14,
                        border: "1px solid var(--border)",
                        fontSize: 12,
                        background: "var(--card)",
                      }}
                    />
                    <Bar
                      dataKey="count"
                      name="Breaches"
                      fill="var(--warning)"
                      radius={[0, 6, 6, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Section
              title="Stage ageing"
              description="Average and oldest age of work sitting at each stage."
            >
              <ul className="space-y-2.5">
                {data.stageAgeing.map((row) => (
                  <li key={row.stage} className="space-y-1">
                    <div className="flex justify-between text-[12px]">
                      <span className="text-foreground">{OPS_STAGE_META[row.stage].label}</span>
                      <span className="num text-muted-foreground">
                        avg {formatDuration(row.averageAgeMinutes)} · oldest{" "}
                        {formatDuration(row.oldestAgeMinutes)}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary/70"
                        style={{ width: `${Math.min(100, (row.averageAgeMinutes / 4320) * 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Section>

            <Section
              title="Cases at risk"
              description="Open cases with the least buffer remaining."
            >
              <ul className="divide-y divide-border">
                {data.atRisk.slice(0, 8).map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[13px] text-foreground">{row.candidateName}</p>
                      <p className="num truncate text-[11px] text-muted-foreground">
                        {row.caseNumber} · {row.clientName}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="num text-[11px] text-muted-foreground">
                        {row.slaMinutesRemaining <= 0
                          ? `overdue ${formatDuration(-row.slaMinutesRemaining)}`
                          : `${formatDuration(row.slaMinutesRemaining)} left`}
                      </span>
                      <StatusBadge
                        label={OPS_SLA_META[row.slaState].label}
                        tone={OPS_SLA_META[row.slaState].tone}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <PerformanceTable title="On-time by client" rows={data.byClient} />
            <PerformanceTable title="On-time by package" rows={data.byPackage} />
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "critical" }) {
  return (
    <div className="surface px-4 py-3.5">
      <p className="text-[11px] tracking-[0.07em] text-muted-foreground uppercase">{label}</p>
      <p
        className={
          tone === "critical"
            ? "num mt-1.5 text-[1.4rem] leading-none font-medium text-critical-foreground"
            : "num mt-1.5 text-[1.4rem] leading-none font-medium text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}

function PerformanceTable({
  title,
  rows,
}: {
  title: string;
  rows: readonly { name: string; onTimePercent: number; volume: number }[];
}) {
  return (
    <Section title={title} description="Volume-weighted on-time delivery for the last 30 days.">
      <ul className="space-y-2.5">
        {rows.map((row) => (
          <li key={row.name} className="space-y-1">
            <div className="flex justify-between text-[12px]">
              <span className="text-foreground">{row.name}</span>
              <span className="num text-muted-foreground">
                {formatPercent(row.onTimePercent)} · {row.volume} cases
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <span
                className={
                  row.onTimePercent >= 92
                    ? "block h-full rounded-full bg-success"
                    : row.onTimePercent >= 87
                      ? "block h-full rounded-full bg-warning"
                      : "block h-full rounded-full bg-critical"
                }
                style={{ width: `${row.onTimePercent}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}
