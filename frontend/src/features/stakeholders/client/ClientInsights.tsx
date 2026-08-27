import { Activity, CheckCircle2, CircleAlert, MinusCircle } from "lucide-react";

import type { OperationsDashboard } from "@/lib/api/dashboards";
import { StakeholderPanel } from "../StakeholderShell";
import { humanize } from "./client-portal-utils";

export function ClientInsights({ data }: { data: OperationsDashboard | undefined }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
      <StakeholderPanel
        title="Monthly movement"
        detail="New case intake compared with completed verifications"
      >
        <div className="p-5">
          <div className="mb-5 flex items-center gap-4 text-[10px] text-slate-500">
            <Legend color="bg-slate-900" label="New cases" />
            <Legend color="bg-orange-400" label="Completed" />
          </div>
          <MovementChart data={data?.trend ?? []} />
        </div>
      </StakeholderPanel>
      <StakeholderPanel title="Outcome health" detail="Results returned across completed checks">
        <div className="p-5">
          <OutcomeMix values={data?.outcomeMix ?? {}} />
        </div>
      </StakeholderPanel>
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
              className="w-3 rounded-t-md bg-slate-900 sm:w-5"
              style={{ height: `${Math.max(5, (item.created / max) * 136)}px` }}
            />
            <span
              title={`${item.completed} completed`}
              className="w-3 rounded-t-md bg-orange-400 sm:w-5"
              style={{ height: `${Math.max(5, (item.completed / max) * 136)}px` }}
            />
          </div>
          <span className="mt-2 text-[9px] font-semibold text-slate-500">{item.month}</span>
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
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
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
                  <span className="truncate font-semibold">{humanize(label)}</span>
                  <span className="font-semibold">{value}</span>
                </div>
                <p className="mt-0.5 text-[9px] text-slate-400">
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
    return { bar: "bg-emerald-500", icon: "bg-emerald-50 text-emerald-700", Icon: CheckCircle2 };
  if (["DISCREPANCY", "UNABLE_TO_VERIFY"].includes(value))
    return { bar: "bg-red-400", icon: "bg-red-50 text-red-700", Icon: CircleAlert };
  if (value === "PENDING")
    return { bar: "bg-slate-300", icon: "bg-slate-100 text-slate-600", Icon: MinusCircle };
  return { bar: "bg-amber-400", icon: "bg-amber-50 text-amber-700", Icon: Activity };
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
  return <p className="py-16 text-center text-xs text-slate-500">{text}</p>;
}
