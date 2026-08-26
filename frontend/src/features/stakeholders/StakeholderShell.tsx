import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Sidebar } from "@/components/ops/Sidebar";
import { Topbar } from "@/components/ops/Topbar";

export function StakeholderShell({
  children,
  onRefresh,
  refreshing,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <div className="min-h-screen bg-white text-slate-950 lg:pl-64">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          {...(onRefresh ? { onRefresh } : {})}
          {...(refreshing !== undefined ? { isRefreshing: refreshing } : {})}
        />
        <main className="flex-1 space-y-5 px-4 pb-10 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

export function StakeholderHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 pt-2 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-700">
          {eyebrow}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

const tones = {
  orange: "bg-orange-50 text-orange-700",
  blue: "bg-blue-50 text-blue-700",
  emerald: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
  violet: "bg-violet-50 text-violet-700",
} as const;
const bars: Record<keyof typeof tones, string> = {
  orange: "bg-orange-400",
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  red: "bg-red-500",
  violet: "bg-violet-500",
};

export function StakeholderKpis({
  items,
}: {
  items: Array<{
    label: string;
    value: string | number;
    detail: string;
    icon: LucideIcon;
    tone: keyof typeof tones;
    progress?: number;
  }>;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <article
          key={item.label}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{item.value}</p>
            </div>
            <span className={`grid h-9 w-9 place-items-center rounded-xl ${tones[item.tone]}`}>
              <item.icon className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${bars[item.tone]}`}
              style={{ width: `${Math.max(0, Math.min(100, item.progress ?? 0))}%` }}
            />
          </div>
        </article>
      ))}
    </section>
  );
}

export function StakeholderPanel({
  title,
  detail,
  action,
  children,
  className = "",
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {detail ? <p className="mt-0.5 text-xs text-slate-500">{detail}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
