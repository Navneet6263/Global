import type { ReactNode } from "react";

export type Tone = "success" | "warning" | "destructive" | "info";

export const tonePill: Record<Tone, string> = {
  success: "bg-success text-success-foreground",
  warning: "bg-warning/25 text-warning-foreground",
  destructive: "bg-destructive/12 text-destructive",
  info: "bg-info/12 text-info",
};

export const barTone: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
};

export function PageHeader({
  title,
  subtitle,
  chip,
}: {
  title: string;
  subtitle: string;
  chip: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <span className="rounded-full bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
        {chip}
      </span>
    </div>
  );
}

export function KpiStrip({
  items,
}: {
  items: Array<{ label: string; value: string; delta: string; tone: Tone }>;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map((k) => (
        <div key={k.label} className="surface rounded-3xl p-5">
          <p className="text-xs text-muted-foreground">{k.label}</p>
          <div className="mt-2 flex items-end justify-between gap-2">
            <p className="text-3xl font-semibold tabular-nums tracking-tight">{k.value}</p>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${tonePill[k.tone]}`}
            >
              {k.delta}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`surface rounded-3xl p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function MeterRow({
  label,
  hint,
  value,
  tone = "info",
}: {
  label: string;
  hint?: string;
  value: number;
  tone?: Tone;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{hint ?? `${value}%`}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full ${barTone[tone]}`}
          style={{ width: `${Math.min(100, value)}%` }}
        />
      </div>
    </div>
  );
}

export function ColumnChart({
  data,
  suffix = "",
}: {
  data: Array<{ label: string; value: number; tone?: Tone }>;
  suffix?: string;
}) {
  const max = Math.max(...data.map((d) => d.value)) || 1;
  return (
    <div className="flex h-52 items-stretch gap-2">
      {data.map((d) => (
        <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {d.value}
            {suffix}
          </span>
          <div className="flex min-h-0 w-full flex-1 items-end">
            <div
              className={`w-full rounded-t-xl rounded-b-md ${barTone[d.tone ?? "info"]}`}
              style={{ height: `${(d.value / max) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
