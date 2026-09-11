import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { AdminShell } from "@/components/shell/admin-shell";
import type { NavWorkspace } from "@/config/navigation";
import { PageHeader } from "@/components/layout/page-header";

interface StakeholderShellProps {
  children: ReactNode;
  workspace: Extract<NavWorkspace, "client-admin" | "finance">;
  onRefresh?: () => void;
  refreshing?: boolean;
  hideGlobalCreate?: boolean;
}

export function StakeholderShell(props: StakeholderShellProps) {
  return (
    <AdminShell workspace={props.workspace}>
      <div aria-busy={props.refreshing} className="space-y-6">
        {props.children}
      </div>
    </AdminShell>
  );
}

export function StakeholderHeader({
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return <PageHeader title={title} description={description} actions={action} />;
}

const tones = {
  orange: { icon: "bg-primary/12 text-primary", bar: "bg-primary" },
  blue: { icon: "bg-info-soft text-info-foreground", bar: "bg-info" },
  emerald: { icon: "bg-success-soft text-success-foreground", bar: "bg-success" },
  red: { icon: "bg-critical-soft text-critical-foreground", bar: "bg-critical" },
  violet: { icon: "bg-review-soft text-review-foreground", bar: "bg-review" },
} as const;

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
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Workspace summary">
      {items.map((item) => (
        <article
          key={item.label}
          className="surface p-4 transition-transform hover:-translate-y-0.5"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">{item.label}</p>
              <p className="num mt-1 text-2xl font-semibold tracking-tight">{item.value}</p>
            </div>
            <span className={`grid size-9 place-items-center rounded-xl ${tones[item.tone].icon}`}>
              <item.icon className="size-4" />
            </span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{item.detail}</p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${tones[item.tone].bar}`}
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
    <section className={`surface overflow-hidden ${className}`}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {detail ? <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p> : null}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
