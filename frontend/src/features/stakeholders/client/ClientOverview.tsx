import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Files,
  ShieldCheck,
} from "lucide-react";

import type { ExceptionsDashboard, OperationsDashboard } from "@/lib/api/dashboards";

export function ClientOverview({
  operations,
  exceptions,
}: {
  operations: OperationsDashboard | undefined;
  exceptions: ExceptionsDashboard | undefined;
}) {
  const total = operations?.summary.total ?? 0;
  const completed =
    (operations?.statusMix["COMPLETED"] ?? 0) + (operations?.statusMix["CLOSED"] ?? 0);
  const cancelled = operations?.statusMix["CANCELLED"] ?? 0;
  const active = Math.max(0, total - completed - cancelled);
  const clientActions =
    exceptions?.clarifications.filter((item) => item.status === "OPEN").length ?? 0;
  const overdue = operations?.summary.overdue ?? 0;
  const slaHealth = active ? Math.max(0, Math.round(((active - overdue) / active) * 100)) : 100;
  const trend = operations?.trend ?? [];

  const cards = [
    {
      label: "Active verifications",
      value: active,
      detail: `${operations?.summary.createdToday ?? 0} added today`,
      icon: Files,
      tone: "blue",
      values: trend.map((point) => point.created),
    },
    {
      label: "Action required",
      value: clientActions,
      detail: clientActions ? "Your response is holding progress" : "Nothing waiting on your team",
      icon: AlertTriangle,
      tone: clientActions ? "amber" : "emerald",
      values: trend.map(() => clientActions),
    },
    {
      label: "SLA health",
      value: `${slaHealth}%`,
      detail: overdue ? `${overdue} cases need attention` : "Every active case is on track",
      icon: Clock3,
      tone: overdue ? "red" : "emerald",
      values: trend.map((point) => Math.max(0, point.created - point.completed)),
    },
    {
      label: "Completed",
      value: completed,
      detail: `${operations?.summary.completedToday ?? 0} completed today`,
      icon: CheckCircle2,
      tone: "emerald",
      values: trend.map((point) => point.completed),
    },
  ] as const;

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Portfolio summary">
      {cards.map((card) => (
        <article
          key={card.label}
          className="group rounded-[1.4rem] border border-slate-200 bg-white p-4 shadow-[0_12px_36px_-28px_rgba(15,23,42,0.45)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_-26px_rgba(15,23,42,0.4)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-500">
                {card.label}
              </p>
              <p className="mt-2 text-[1.75rem] font-semibold tracking-tight text-slate-950">
                {card.value}
              </p>
            </div>
            <span className={`grid h-9 w-9 place-items-center rounded-xl ${iconTones[card.tone]}`}>
              <card.icon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-end justify-between gap-3">
            <p className="text-[11px] leading-4 text-slate-500">{card.detail}</p>
            <MiniBars values={card.values} tone={card.tone} />
          </div>
        </article>
      ))}
    </section>
  );
}

function MiniBars({ values, tone }: { values: number[]; tone: keyof typeof iconTones }) {
  const max = Math.max(1, ...values);
  return (
    <span className="flex h-7 shrink-0 items-end gap-1" aria-hidden="true">
      {(values.length ? values : [0, 0, 0, 0, 0, 0]).map((value, index) => (
        <span
          key={index}
          className={`w-1.5 rounded-full ${barTones[tone]}`}
          style={{ height: `${Math.max(4, (value / max) * 26)}px` }}
        />
      ))}
    </span>
  );
}

const iconTones = {
  blue: "bg-blue-50 text-blue-700",
  amber: "bg-amber-50 text-amber-700",
  emerald: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
} as const;

const barTones: Record<keyof typeof iconTones, string> = {
  blue: "bg-blue-400",
  amber: "bg-amber-400",
  emerald: "bg-emerald-400",
  red: "bg-red-400",
};

export function PortfolioTrustNote() {
  return (
    <div className="flex items-center gap-2 text-[11px] text-slate-500">
      <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
      Access is limited to your organisation
      <ArrowUpRight className="h-3 w-3" />
    </div>
  );
}
