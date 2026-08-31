import { Activity, CheckCircle2, CircleAlert, MinusCircle } from "lucide-react";

import { Section } from "@/components/layout/section";
import type { OperationsDashboard } from "@/lib/api/dashboards";
import { humanize } from "./client-portal-utils";

export function ClientInsights({ data }: { data: OperationsDashboard | undefined }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
      <Section
        title="Monthly movement"
        description="New case intake compared with completed verifications"
        bodyClassName="p-5"
      >
        <div className="p-5">
          <div className="mb-5 flex items-center gap-4 text-[10px] text-muted-foreground">
            <Legend color="bg-mint" label="New cases" />
            <Legend color="bg-primary" label="Completed" />
          </div>
          <MovementChart data={data?.trend ?? []} />
        </div>
      </Section>
      <Section
        title="Outcome health"
        description="Results returned across completed checks"
        bodyClassName="p-5"
      >
        <div className="p-5">
          <OutcomeMix values={data?.outcomeMix ?? {}} />
        </div>
      </Section>
    </div>
  );
}

function MovementChart({ data }: { data: OperationsDashboard["trend"] }) {
  const max = Math.max(1, ...data.flatMap((item) => [item.created, item.completed]));
  if (!data.length) return <Empty text="Monthly movement will appear after case intake." />;
  return (
    <div className="flex h-44 items-end gap-3 sm:gap-5">
      {data.map((item) => (
        <div key={item.month} className="flex min-w-0 flex-1 flex-col items-center">
          <div className="flex h-36 items-end gap-1.5">
            <span
              title={`${item.created} new`}
              className="w-3 rounded-t-lg bg-mint shadow-[0_6px_14px_-8px_var(--mint)] sm:w-5"
              style={{ height: `${Math.max(5, (item.created / max) * 136)}px` }}
            />
            <span
              title={`${item.completed} completed`}
              className="w-3 rounded-t-lg bg-primary shadow-[0_6px_14px_-8px_var(--primary)] sm:w-5"
              style={{ height: `${Math.max(5, (item.completed / max) * 136)}px` }}
            />
          </div>
          <span className="mt-2 text-[9px] font-medium text-muted-foreground">{item.month}</span>
        </div>
      ))}
    </div>
  );
}

function OutcomeMix({ values }: { values: Record<string, number> }) {
  const entries = Object.entries(values).filter(([, value]) => value > 0);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (!total) return <Empty text="Outcome health will appear after checks are completed." />;
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-full bg-muted">
        {entries.map(([label, value]) => (
          <span
            key={label}
            className={outcomeTone(label).bar}
            style={{ width: `${(value / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {entries.map(([label, value]) => {
          const tone = outcomeTone(label);
          return (
            <div key={label} className="flex items-center gap-3">
              <span className={`grid h-8 w-8 place-items-center rounded-xl ${tone.icon}`}>
                <tone.Icon className="h-3.5 w-3.5" />
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
      bar: "bg-success",
      icon: "bg-success-soft text-success-foreground",
      Icon: CheckCircle2,
    };
  if (["DISCREPANCY", "UNABLE_TO_VERIFY"].includes(value))
    return {
      bar: "bg-critical",
      icon: "bg-critical-soft text-critical-foreground",
      Icon: CircleAlert,
    };
  if (value === "PENDING")
    return {
      bar: "bg-neutral",
      icon: "bg-neutral-soft text-neutral-foreground",
      Icon: MinusCircle,
    };
  return { bar: "bg-warning", icon: "bg-warning-soft text-warning-foreground", Icon: Activity };
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${color}`} />
      {label}
    </span>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-2xl border border-dashed border-border-strong bg-muted/25 py-16 text-center text-xs text-muted-foreground">
      {text}
    </p>
  );
}
