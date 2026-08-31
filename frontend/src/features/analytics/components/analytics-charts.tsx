"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DistributionSlice, ExecutiveAnalytics } from "@/lib/contracts/analytics";
import { Section } from "@/components/layout/section";

const AXIS = {
  stroke: "var(--color-border-strong)",
  fontSize: 11,
  tick: { fill: "var(--color-muted-foreground)" },
} as const;

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-card)",
  fontSize: 12,
  color: "var(--color-foreground)",
} as const;

const SLICE_COLOR: Record<DistributionSlice["tone"], string> = {
  success: "var(--color-success)",
  info: "var(--color-info)",
  warning: "var(--color-warning)",
  critical: "var(--color-critical)",
  review: "var(--color-review)",
  neutral: "var(--color-border-strong)",
};

export function PortfolioTrendChart({ data }: { data: ExecutiveAnalytics["portfolioTrend"] }) {
  return (
    <Section
      title="Intake vs completions"
      description="Case intake against completions across the selected time window."
    >
      {data.length ? (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={[...data]} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="intake" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="label" {...AXIS} />
            <YAxis {...AXIS} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Area
              type="monotone"
              dataKey="value"
              name="Intake"
              stroke="var(--color-primary)"
              fill="url(#intake)"
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="secondary"
              name="Completions"
              stroke="var(--color-success)"
              strokeWidth={2}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart label="No case movement in this window" />
      )}
    </Section>
  );
}

export function SlaTrendChart({ data }: { data: ExecutiveAnalytics["slaTrend"] }) {
  return (
    <Section
      title="SLA attainment"
      description="Share of cases delivered inside the client commitment."
    >
      {data.length ? (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={[...data]} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="label" {...AXIS} />
            <YAxis domain={[80, 100]} {...AXIS} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Line
              type="monotone"
              dataKey="value"
              name="Attainment %"
              stroke="var(--color-info)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart label="No completed cases with an SLA denominator" />
      )}
    </Section>
  );
}

export function TurnaroundChart({ data }: { data: ExecutiveAnalytics["turnaroundTrend"] }) {
  return (
    <Section title="Average turnaround" description="Mean hours from intake to report delivery.">
      {data.length ? (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={[...data]} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="label" {...AXIS} />
            <YAxis {...AXIS} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="value" name="Hours" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart label="No completed cases in this window" />
      )}
    </Section>
  );
}

export function RiskDistributionChart({ data }: { data: ExecutiveAnalytics["riskDistribution"] }) {
  return (
    <Section title="Outcome mix" description="Distribution of verification outcomes this window.">
      {data.length ? (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Pie data={[...data]} dataKey="value" nameKey="label" innerRadius={55} outerRadius={90}>
              {data.map((slice) => (
                <Cell key={slice.label} fill={SLICE_COLOR[slice.tone]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChart label="No classified outcomes in this window" />
      )}
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {data.map((slice) => (
          <li
            key={slice.label}
            className="flex items-center gap-2 text-[12px] text-muted-foreground"
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: SLICE_COLOR[slice.tone] }}
              aria-hidden
            />
            {slice.label}
            <span className="num ml-auto font-medium text-foreground">{slice.value}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center text-xs text-muted-foreground">
      {label}
    </div>
  );
}
