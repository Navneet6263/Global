import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";

import type { ExceptionsDashboard, OperationsDashboard } from "@/lib/api/dashboards";

type Tone = "warning" | "success" | "info" | "critical";

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
  const clientActions = exceptions?.summary.clientActions ?? 0;
  const overdue = operations?.summary.overdue ?? 0;
  const slaHealth = active ? Math.max(0, Math.round(((active - overdue) / active) * 100)) : 100;
  const trend = operations?.trend ?? [];
  const cards = [
    {
      label: "Action required",
      value: clientActions,
      detail: clientActions ? "Your response is holding progress" : "Nothing waiting on your team",
      icon: AlertTriangle,
      tone: clientActions ? "warning" : "success",
      values: [],
    },
    {
      label: "SLA health",
      value: `${slaHealth}%`,
      detail: overdue ? `${overdue} cases need attention` : "Every active case is on track",
      icon: Clock3,
      tone: overdue ? "critical" : "success",
      values: [],
    },
    {
      label: "Completed",
      value: completed,
      detail: `${operations?.summary.completedToday ?? 0} completed today`,
      icon: CheckCircle2,
      tone: "info",
      values: trend.map((point) => point.completed),
    },
  ] satisfies Array<{
    label: string;
    value: string | number;
    detail: string;
    icon: typeof Clock3;
    tone: Tone;
    values: number[];
  }>;

  return (
    <section
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]"
      aria-label="Portfolio summary"
    >
      <article
        className="relative min-h-48 overflow-hidden rounded-[1.75rem] p-5 text-white shadow-[var(--shadow-raise)]"
        style={{
          background: "linear-gradient(145deg, oklch(0.43 0.07 168), oklch(0.29 0.045 172) 72%)",
        }}
      >
        <span aria-hidden className="absolute -right-10 -top-12 size-40 rounded-full bg-white/10" />
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">
                Active portfolio
              </p>
              <p className="num mt-5 text-[2.8rem] font-medium leading-none tracking-[-0.05em]">
                {active}
              </p>
            </div>
            <span className="grid size-10 place-items-center rounded-full bg-white/10 text-white/80">
              <ShieldCheck className="size-4.5" aria-hidden />
            </span>
          </div>
          <div className="mt-7 flex items-end justify-between gap-3">
            <p className="text-[11px] leading-4 text-white/65">
              cases currently in flight
              <br />
              in your organisation
            </p>
            <span className="text-right text-[9px] text-white/55">
              Monthly intake
              <MiniBars values={trend.map((point) => point.created)} colour="bg-amber-300/90" />
            </span>
          </div>
        </div>
        <span
          aria-hidden
          className="absolute inset-x-5 bottom-0 h-1.5 rounded-t-full bg-amber-300/90"
        />
      </article>

      {cards.map((card) => (
        <article
          key={card.label}
          className="group flex min-h-48 flex-col rounded-[1.75rem] border border-white/80 bg-card/85 p-4 shadow-[var(--shadow-card)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-raise)]"
          style={{
            borderTop: `2px solid ${tones[card.tone].edge}`,
            background: `linear-gradient(180deg, ${tones[card.tone].fill}, color-mix(in oklab, var(--card) 90%, transparent) 62%)`,
          }}
        >
          <div className="flex items-center gap-2.5">
            <span className={`grid size-9 place-items-center rounded-xl ${tones[card.tone].icon}`}>
              <card.icon className="size-4" aria-hidden />
            </span>
            <p className="min-w-0 flex-1 text-[13px] font-semibold text-foreground">{card.label}</p>
            <ArrowUpRight className="size-3.5 text-muted-foreground/50" aria-hidden />
          </div>
          <div className="mt-auto">
            {card.values.length ? (
              <MiniBars values={card.values} colour={tones[card.tone].bar} />
            ) : null}
            <p className="num mt-3 text-[1.8rem] font-medium leading-none tracking-[-0.04em] text-foreground">
              {card.value}
            </p>
            <p className="mt-2 text-[10px] leading-4 text-muted-foreground">{card.detail}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

function MiniBars({ values, colour }: { values: number[]; colour: string }) {
  const points = values.length ? values : [0];
  const max = Math.max(1, ...points);
  return (
    <span className="flex h-10 items-end gap-1" aria-hidden>
      {points.map((value, index) => (
        <span
          key={`${index}-${value}`}
          className={`w-1.5 rounded-full ${colour}`}
          style={{ height: `${Math.max(5, (value / max) * 38)}px` }}
        />
      ))}
    </span>
  );
}

const tones: Record<Tone, { edge: string; fill: string; icon: string; bar: string }> = {
  warning: {
    edge: "var(--warning)",
    fill: "var(--warning-soft)",
    icon: "bg-warning-soft text-warning-foreground",
    bar: "bg-warning",
  },
  success: {
    edge: "var(--success)",
    fill: "var(--success-soft)",
    icon: "bg-success-soft text-success-foreground",
    bar: "bg-success",
  },
  info: {
    edge: "var(--info)",
    fill: "var(--info-soft)",
    icon: "bg-info-soft text-info-foreground",
    bar: "bg-info",
  },
  critical: {
    edge: "var(--critical)",
    fill: "var(--critical-soft)",
    icon: "bg-critical-soft text-critical-foreground",
    bar: "bg-critical",
  },
};

export function PortfolioTrustNote() {
  return (
    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
      <ShieldCheck className="size-3.5 text-success" aria-hidden />
      Organisation-scoped access
    </div>
  );
}
