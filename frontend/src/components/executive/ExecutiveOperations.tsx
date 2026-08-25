import { Activity, Clock4, UsersRound } from "lucide-react";

import type { ExecutiveDashboard } from "@/lib/api/dashboards";

export function StageAgeing({
  data,
  onSelect,
}: {
  data: ExecutiveDashboard;
  onSelect: (status: string) => void;
}) {
  const max = Math.max(...data.stageAgeing.map((item) => item.count), 1);
  return (
    <section className="surface rounded-2xl p-4 sm:p-5">
      <Heading
        icon={Clock4}
        title="Stage ageing"
        subtitle="Where work is accumulating"
        tone="bg-amber-50 text-amber-700"
      />
      <div className="mt-4 space-y-3">
        {data.stageAgeing.length ? (
          data.stageAgeing.slice(0, 7).map((item) => (
            <button
              key={item.status}
              type="button"
              onClick={() => onSelect(item.status)}
              className="group block w-full text-left"
            >
              <div className="flex items-center justify-between gap-2 text-[10px]">
                <span className="font-semibold">{humanize(item.status)}</span>
                <span className="num text-muted-foreground">
                  {item.count} cases · {item.averageAgeHours}h avg
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full ${item.atRisk ? "bg-amber-500" : "bg-blue-500"}`}
                  style={{ width: `${Math.max(5, (item.count / max) * 100)}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[8px] text-muted-foreground">
                <span>{item.atRisk} at risk</span>
                <span>oldest {item.oldestAgeHours}h</span>
              </div>
            </button>
          ))
        ) : (
          <Empty label="No active stages in this view" />
        )}
      </div>
    </section>
  );
}

export function TeamCapacity({
  data,
  onSelect,
}: {
  data: ExecutiveDashboard;
  onSelect: (ownerId: string, name: string) => void;
}) {
  return (
    <section className="surface rounded-2xl p-4 sm:p-5">
      <Heading
        icon={UsersRound}
        title="Team capacity"
        subtitle="Active ownership and throughput"
        tone="bg-blue-50 text-blue-700"
      />
      <div className="mt-3 divide-y divide-border/60">
        {data.teamCapacity.length ? (
          data.teamCapacity.slice(0, 7).map((item) => {
            const load = item.active >= 12 ? "High" : item.active >= 6 ? "Balanced" : "Available";
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id, item.name)}
                className="flex w-full items-center gap-3 py-2.5 text-left first:pt-0 last:pb-0 hover:text-orange-700"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary text-[9px] font-bold">
                  {initials(item.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-[10px]">{item.name}</strong>
                  <span className="text-[8px] text-muted-foreground">
                    {item.completed} completed · {item.overdue} overdue
                  </span>
                </span>
                <span className="text-right">
                  <strong className="num block text-xs">{item.active}</strong>
                  <span
                    className={`text-[8px] ${load === "High" ? "text-red-700" : load === "Balanced" ? "text-amber-700" : "text-emerald-700"}`}
                  >
                    {load}
                  </span>
                </span>
              </button>
            );
          })
        ) : (
          <Empty label="No owner workload in this view" />
        )}
      </div>
    </section>
  );
}

export function OutcomeAndChecks({ data }: { data: ExecutiveDashboard }) {
  const outcomes = Object.entries(data.outcomeMix).sort((a, b) => b[1] - a[1]);
  return (
    <section className="surface overflow-hidden rounded-2xl">
      <div className="border-b border-border/70 px-4 py-3.5 sm:px-5">
        <Heading
          icon={Activity}
          title="Verification quality"
          subtitle="Result mix and check-type execution"
          tone="bg-emerald-50 text-emerald-700"
        />
      </div>
      <div className="grid gap-0 lg:grid-cols-[.75fr_1.25fr]">
        <div className="border-b border-border/60 p-4 lg:border-b-0 lg:border-r sm:p-5">
          <p className="text-[9px] font-bold uppercase tracking-[.1em] text-muted-foreground">
            Outcome mix
          </p>
          <div className="mt-3 space-y-2.5">
            {outcomes.length ? (
              outcomes.map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-lg bg-secondary/45 px-3 py-2"
                >
                  <span className="text-[10px] font-medium">{humanize(label)}</span>
                  <strong className="num text-xs">{value}</strong>
                </div>
              ))
            ) : (
              <Empty label="No check outcomes yet" />
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left">
            <thead className="bg-secondary/35 text-[8px] uppercase tracking-[.1em] text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Check</th>
                <th className="px-3 py-2.5">Total</th>
                <th className="px-3 py-2.5">Done</th>
                <th className="px-3 py-2.5">Pending</th>
                <th className="px-3 py-2.5">Exceptions</th>
                <th className="px-4 py-2.5">TAT</th>
              </tr>
            </thead>
            <tbody>
              {data.checkPerformance.map((item) => (
                <tr key={item.type} className="border-t border-border/60 text-[10px]">
                  <td className="px-4 py-3 font-semibold">{humanize(item.type)}</td>
                  <td className="num px-3 py-3">{item.total}</td>
                  <td className="num px-3 py-3 text-emerald-700">{item.completed}</td>
                  <td className="num px-3 py-3 text-muted-foreground">{item.pending}</td>
                  <td className="num px-3 py-3 text-red-700">
                    {item.discrepancies + item.unableToVerify}
                  </td>
                  <td className="num px-4 py-3 text-muted-foreground">
                    {item.averageTatHours === null ? "—" : `${item.averageTatHours}h`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Heading({
  icon: Icon,
  title,
  subtitle,
  tone,
}: {
  icon: typeof Activity;
  title: string;
  subtitle: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`grid h-8 w-8 place-items-center rounded-lg ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h2 className="text-sm font-bold">{title}</h2>
        <p className="text-[10px] text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}
function Empty({ label }: { label: string }) {
  return (
    <div className="grid min-h-24 place-items-center text-[10px] text-muted-foreground">
      {label}
    </div>
  );
}
function humanize(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function initials(value: string) {
  return value
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
