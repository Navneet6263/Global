import type { ComponentType, ReactNode } from "react";

import { Sidebar } from "@/components/ops/Sidebar";
import { Topbar } from "@/components/ops/Topbar";

export function DeliveryShell({
  children,
  onRefresh,
  refreshing,
}: {
  children: ReactNode;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <div className="min-h-screen bg-white text-foreground lg:pl-64">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onRefresh={onRefresh} isRefreshing={refreshing} />
        <main className="flex-1 px-4 pb-12 pt-5 sm:px-6">
          <div className="mx-auto max-w-[1500px] space-y-5">{children}</div>
        </main>
      </div>
    </div>
  );
}

export function DeliveryHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-orange-600">
          {eyebrow}
        </p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-500">{description}</p>
      </div>
      {aside}
    </header>
  );
}

type Tone = "blue" | "emerald" | "amber" | "red" | "violet";
const tones: Record<Tone, { card: string; icon: string; bar: string }> = {
  blue: {
    card: "border-blue-100 bg-blue-50/45",
    icon: "bg-blue-100 text-blue-700",
    bar: "bg-blue-500",
  },
  emerald: {
    card: "border-emerald-100 bg-emerald-50/45",
    icon: "bg-emerald-100 text-emerald-700",
    bar: "bg-emerald-500",
  },
  amber: {
    card: "border-amber-100 bg-amber-50/45",
    icon: "bg-amber-100 text-amber-700",
    bar: "bg-amber-500",
  },
  red: { card: "border-red-100 bg-red-50/45", icon: "bg-red-100 text-red-700", bar: "bg-red-500" },
  violet: {
    card: "border-violet-100 bg-violet-50/45",
    icon: "bg-violet-100 text-violet-700",
    bar: "bg-violet-500",
  },
};

export function DeliveryKpis({
  items,
}: {
  items: Array<{
    label: string;
    value: string | number;
    detail: string;
    icon: ComponentType<{ className?: string }>;
    tone: Tone;
    progress?: number;
  }>;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Workspace summary">
      {items.map(({ label, value, detail, icon: Icon, tone, progress }) => {
        const style = tones[tone];
        return (
          <article key={label} className={`rounded-2xl border p-4 shadow-sm ${style.card}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold text-slate-500">{label}</p>
                <p className="num mt-1 text-2xl font-bold text-slate-950">{value}</p>
              </div>
              <span className={`grid h-9 w-9 place-items-center rounded-xl ${style.icon}`}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-2 text-[10px] text-slate-500">{detail}</p>
            {progress !== undefined ? (
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/80">
                <div
                  className={`h-full rounded-full ${style.bar}`}
                  style={{ width: `${Math.max(3, Math.min(100, progress))}%` }}
                />
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
