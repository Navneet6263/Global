import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, CalendarClock, CircleCheck, UserRoundX } from "lucide-react";

import type { ExecutiveDashboard } from "@/lib/api/dashboards";

export function ExecutiveAttention({ data }: { data: ExecutiveDashboard }) {
  return (
    <section className="surface rounded-2xl p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-50 text-red-700">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold">Executive attention</h2>
            <p className="text-[10px] text-muted-foreground">
              Prioritised by severity and stalled time
            </p>
          </div>
        </div>
        <span className="rounded-full bg-red-50 px-2.5 py-1 text-[9px] font-bold text-red-700">
          {data.attentionQueue.length} flagged
        </span>
      </div>
      {data.attentionQueue.length ? (
        <div className="mt-3 max-h-[258px] space-y-1.5 overflow-y-auto pr-1">
          {data.attentionQueue.slice(0, 7).map((item) => (
            <Link
              key={item.id}
              to="/cases/$caseId"
              params={{ caseId: item.id }}
              className="group flex items-center gap-3 rounded-xl border border-transparent bg-secondary/45 px-3 py-2.5 transition hover:border-orange-100 hover:bg-orange-50/50"
            >
              <span
                className={`h-8 w-1 rounded-full ${item.severity === 3 ? "bg-red-500" : item.severity === 2 ? "bg-amber-500" : "bg-blue-500"}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <strong className="truncate text-[11px]">{item.caseNumber}</strong>
                  <span className="truncate text-[9px] text-muted-foreground">
                    {item.client.displayName}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[9px] text-muted-foreground">
                  {item.reasons.join(" · ")} · {item.ageHours}h since movement
                </p>
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition group-hover:text-orange-700" />
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-4 grid h-[235px] place-items-center rounded-xl bg-emerald-50/40 text-center">
          <div>
            <CircleCheck className="mx-auto h-6 w-6 text-emerald-600" />
            <p className="mt-2 text-xs font-semibold">No leadership exception</p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Nothing is overdue, critical or stalled in this view.
            </p>
          </div>
        </div>
      )}
      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3">
        <Forecast
          icon={CalendarClock}
          label="Due in 7 days"
          value={data.forecast.dueNext7Days}
          tone="text-blue-700 bg-blue-50"
        />
        <Forecast
          icon={AlertTriangle}
          label="At risk"
          value={data.forecast.atRiskNext7Days}
          tone="text-red-700 bg-red-50"
        />
        <Forecast
          icon={UserRoundX}
          label="Unassigned"
          value={data.forecast.unassignedActive}
          tone="text-amber-700 bg-amber-50"
        />
      </div>
    </section>
  );
}

function Forecast({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CalendarClock;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="min-w-0">
      <span className={`grid h-6 w-6 place-items-center rounded-md ${tone}`}>
        <Icon className="h-3 w-3" />
      </span>
      <strong className="num mt-1 block text-sm">{value}</strong>
      <span className="block truncate text-[8px] text-muted-foreground">{label}</span>
    </div>
  );
}
