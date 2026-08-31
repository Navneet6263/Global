import type { ComponentType, ReactNode } from "react";
import { AdminShell } from "@/components/shell/admin-shell";
import type { NavWorkspace } from "@/config/navigation";

interface DeliveryShellProps {
  children: ReactNode;
  workspace: Extract<NavWorkspace, "verifier" | "qa-reviewer">;
  onRefresh: () => void;
  refreshing: boolean;
}

export function DeliveryShell(props: DeliveryShellProps) {
  return (
    <AdminShell workspace={props.workspace}>
      <div aria-busy={props.refreshing} className="space-y-6">
        {props.children}
      </div>
    </AdminShell>
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
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold tracking-[0.14em] text-primary uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {aside}
    </header>
  );
}

type Tone = "blue" | "emerald" | "amber" | "red" | "violet";
const tones: Record<Tone, { icon: string; bar: string }> = {
  blue: { icon: "bg-info-soft text-info-foreground", bar: "bg-info" },
  emerald: { icon: "bg-success-soft text-success-foreground", bar: "bg-success" },
  amber: { icon: "bg-warning-soft text-warning-foreground", bar: "bg-warning" },
  red: { icon: "bg-critical-soft text-critical-foreground", bar: "bg-critical" },
  violet: { icon: "bg-review-soft text-review-foreground", bar: "bg-review" },
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
      {items.map(({ label, value, detail, icon: Icon, tone, progress }) => (
        <article key={label} className="surface p-4 transition-transform hover:-translate-y-0.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
              <p className="num mt-1 text-2xl font-semibold text-foreground">{value}</p>
            </div>
            <span className={`grid size-9 place-items-center rounded-xl ${tones[tone].icon}`}>
              <Icon className="size-4" />
            </span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{detail}</p>
          {progress !== undefined ? (
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full ${tones[tone].bar}`}
                style={{ width: `${Math.max(3, Math.min(100, progress))}%` }}
              />
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}
