import { Activity, CheckCircle2, CircleAlert, MinusCircle } from "lucide-react";

import { Section } from "@/components/layout/section";
import type { OperationsDashboard } from "@/lib/api/dashboards";
import { humanize } from "./client-portal-utils";

export function ClientInsights({ data }: { data: OperationsDashboard | undefined }) {
  const trend = data?.trend ?? [];
  const created = trend.reduce((sum, point) => sum + point.created, 0);
  const completed = trend.reduce((sum, point) => sum + point.completed, 0);
  return (
    <div className="grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
      <Section
        title="Monthly movement"
        description="New case intake compared with completed verifications"
        className="border-mint/20 bg-gradient-to-br from-mint-soft/35 via-card to-card"
        actions={
          <div className="flex items-center gap-2">
            <SummaryPill value={created} label="received" tone="bg-mint-soft text-mint-deep" />
            <SummaryPill
              value={completed}
              label="completed"
              tone="bg-info-soft text-info-foreground"
            />
          </div>
        }
      >
        <div className="rounded-2xl border border-white/80 bg-card/65 p-4 shadow-[var(--shadow-card)]">
          <div className="mb-4 flex items-center gap-4 text-[10px] text-muted-foreground">
            <Legend color="bg-mint-deep" label="New cases" />
            <Legend color="bg-info" label="Completed" />
          </div>
          <MovementChart data={trend} />
        </div>
      </Section>
      <Section
        title="Outcome health"
        description="Results returned across completed checks"
        className="border-review/15 bg-gradient-to-br from-review-soft/25 via-card to-card"
      >
        <OutcomeMix values={data?.outcomeMix ?? {}} />
      </Section>
    </div>
  );
}

function MovementChart({ data }: { data: OperationsDashboard["trend"] }) {
  const max = Math.max(1, ...data.flatMap((item) => [item.created, item.completed]));
  if (!data.length) return <Empty text="Monthly movement will appear after case intake." />;
  return (
    <div className="flex h-48 items-end gap-2 sm:gap-4">
      {data.map((item) => (
        <div key={item.month} className="group flex min-w-0 flex-1 flex-col items-center">
          <div className="flex h-40 w-full items-end justify-center gap-1 rounded-xl bg-muted/35 px-1.5 pt-3 transition group-hover:bg-mint-soft/55 sm:gap-1.5">
            <Bar
              value={item.created}
              max={max}
              label={`${item.created} new cases in ${item.month}`}
              className="bg-gradient-to-t from-mint-deep to-mint"
            />
            <Bar
              value={item.completed}
              max={max}
              label={`${item.completed} completed in ${item.month}`}
              className="bg-gradient-to-t from-info to-sky/70"
            />
          </div>
          <span className="mt-2 text-[9px] font-medium text-muted-foreground">{item.month}</span>
        </div>
      ))}
    </div>
  );
}

function Bar({
  value,
  max,
  label,
  className,
}: {
  value: number;
  max: number;
  label: string;
  className: string;
}) {
  return (
    <span
      title={label}
      className={`relative w-3 rounded-t-lg shadow-sm transition-all group-hover:brightness-95 sm:w-5 ${className}`}
      style={{ height: `${Math.max(6, (value / max) * 140)}px` }}
    >
      <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] font-semibold text-foreground opacity-0 transition group-hover:opacity-100">
        {value}
      </span>
    </span>
  );
}

function OutcomeMix({ values }: { values: Record<string, number> }) {
  const entries = Object.entries(values).filter(([, value]) => value > 0);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (!total) return <Empty text="Outcome health will appear after checks are completed." />;
  let offset = 0;
  const gradient = entries
    .map(([label, value]) => {
      const start = offset;
      offset += (value / total) * 100;
      return `${outcomeTone(label).colour} ${start}% ${offset}%`;
    })
    .join(", ");
  return (
    <div className="grid items-center gap-5 sm:grid-cols-[8rem_1fr] xl:grid-cols-1">
      <div
        className="relative mx-auto grid size-32 place-items-center rounded-full shadow-[var(--shadow-card)]"
        style={{ background: `conic-gradient(${gradient})` }}
        aria-label={`${total} returned outcomes`}
      >
        <span className="absolute inset-3 rounded-full bg-card" />
        <span className="relative text-center">
          <strong className="num block text-2xl font-semibold tracking-[-0.04em]">{total}</strong>
          <small className="text-[9px] text-muted-foreground">outcomes</small>
        </span>
      </div>
      <div className="space-y-2.5">
        {entries.map(([label, value]) => {
          const tone = outcomeTone(label);
          return (
            <div
              key={label}
              className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/65 p-2.5"
            >
              <span className={`grid size-8 place-items-center rounded-xl ${tone.icon}`}>
                <tone.Icon className="size-3.5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="truncate font-semibold text-foreground">{humanize(label)}</span>
                  <span className="num font-semibold text-foreground">{value}</span>
                </div>
                <p className="mt-0.5 text-[9px] text-muted-foreground">
                  {Math.round((value / total) * 100)}% of returned outcomes
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function outcomeTone(value: string) {
  if (value === "CLEAR")
    return {
      colour: "var(--success)",
      icon: "bg-success-soft text-success-foreground",
      Icon: CheckCircle2,
    };
  if (["DISCREPANCY", "UNABLE_TO_VERIFY"].includes(value))
    return {
      colour: "var(--critical)",
      icon: "bg-critical-soft text-critical-foreground",
      Icon: CircleAlert,
    };
  if (value === "PENDING")
    return {
      colour: "var(--neutral)",
      icon: "bg-neutral-soft text-neutral-foreground",
      Icon: MinusCircle,
    };
  return {
    colour: "var(--warning)",
    icon: "bg-warning-soft text-warning-foreground",
    Icon: Activity,
  };
}

function SummaryPill({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <span className={`num rounded-full px-2.5 py-1 text-[9px] font-semibold ${tone}`}>
      {value} {label}
    </span>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-mint/25 bg-mint-soft/25 py-14 text-center text-xs text-muted-foreground">
      {text}
    </p>
  );
}
