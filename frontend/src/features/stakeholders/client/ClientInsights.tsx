import { Activity, CheckCircle2, CircleAlert, MinusCircle, type LucideIcon } from "lucide-react";

import { Card, CardHeader, Chip, DOT, SOFT, type Tone } from "@/kit";
import type { OperationsDashboard } from "@/lib/api/dashboards";
import { cn } from "@/lib/utils";
import { humanize } from "./client-portal-utils";

export function ClientInsights({ data }: { data: OperationsDashboard | undefined }) {
  const trend = data?.trend ?? [];
  const created = trend.reduce((sum, point) => sum + point.created, 0);
  const completed = trend.reduce((sum, point) => sum + point.completed, 0);
  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
      <Card className="min-w-0">
        <CardHeader
          title="Monthly movement"
          description="New case intake compared with completed verifications"
          aside={
            <>
              <Chip tone="brand" className="font-mono">
                {created} received
              </Chip>
              <Chip tone="good" className="font-mono">
                {completed} completed
              </Chip>
            </>
          }
        />
        <div className="px-4 py-4">
          <div className="mb-4 flex items-center gap-4 text-xs text-dim">
            <Legend tone="brand" label="New cases" />
            <Legend tone="good" label="Completed" />
          </div>
          <MovementChart data={trend} />
        </div>
      </Card>
      <Card className="min-w-0">
        <CardHeader title="Outcome health" description="Results returned across completed checks" />
        <div className="px-4 py-4">
          <OutcomeMix values={data?.outcomeMix ?? {}} />
        </div>
      </Card>
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
          <div className="flex h-40 w-full items-end justify-center gap-1 rounded-md bg-subtle/60 px-1.5 pt-5 transition group-hover:bg-brand-soft sm:gap-1.5">
            <Bar
              value={item.created}
              max={max}
              label={`${item.created} new cases in ${item.month}`}
              tone="brand"
            />
            <Bar
              value={item.completed}
              max={max}
              label={`${item.completed} completed in ${item.month}`}
              tone="good"
            />
          </div>
          <span className="mt-2 truncate text-[11px] font-medium text-dim">{item.month}</span>
        </div>
      ))}
    </div>
  );
}

function Bar({
  value,
  max,
  label,
  tone,
}: {
  value: number;
  max: number;
  label: string;
  tone: Tone;
}) {
  return (
    <span
      title={label}
      className={cn("relative w-3 rounded-t-sm transition-all sm:w-5", DOT[tone])}
      style={{ height: `${(value / max) * 100}%` }}
    >
      <span className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 font-mono text-[10px] font-semibold text-ink opacity-0 transition group-hover:opacity-100">
        {value}
      </span>
    </span>
  );
}

function OutcomeMix({ values }: { values: Record<string, number> }) {
  const entries = Object.entries(values).filter(([, value]) => value > 0);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (!total) return <Empty text="Outcome health will appear after checks are completed." />;
  return (
    <div className="flex flex-col gap-4">
      <div aria-label={`${total} returned outcomes`}>
        <div className="flex items-baseline gap-2">
          <strong className="font-mono text-[26px] leading-none font-semibold text-ink tabular-nums">
            {total}
          </strong>
          <small className="text-xs text-dim">outcomes</small>
        </div>
        <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-subtle" aria-hidden>
          {entries.map(([label, value]) => (
            <div
              key={label}
              className={cn("h-full", DOT[outcomeTone(label).tone])}
              style={{ width: `${(value / total) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {entries.map(([label, value]) => {
          const tone = outcomeTone(label);
          const percent = Math.round((value / total) * 100);
          return (
            <div key={label} className="flex items-center gap-3">
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-md",
                  SOFT[tone.tone],
                )}
              >
                <tone.Icon className="size-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate font-semibold text-ink">{humanize(label)}</span>
                  <span className="font-mono font-semibold text-ink">{value}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-subtle" aria-hidden>
                  <div
                    className={cn("h-full rounded-full", DOT[tone.tone])}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-dim">{percent}% of returned outcomes</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function outcomeTone(value: string): { tone: Tone; Icon: LucideIcon } {
  if (value === "CLEAR") return { tone: "good", Icon: CheckCircle2 };
  if (["DISCREPANCY", "UNABLE_TO_VERIFY"].includes(value))
    return { tone: "bad", Icon: CircleAlert };
  if (value === "PENDING") return { tone: "neutral", Icon: MinusCircle };
  return { tone: "warn", Icon: Activity };
}

function Legend({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", DOT[tone])} aria-hidden />
      {label}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-md border border-dashed border-line bg-subtle/40 py-14 text-center text-xs text-dim">
      {text}
    </p>
  );
}
