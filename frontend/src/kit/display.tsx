import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "brand" | "good" | "warn" | "bad" | "note" | "neutral";

export const SOFT: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  note: "bg-note-soft text-note",
  neutral: "bg-subtle text-dim",
};
export const DOT: Record<Tone, string> = {
  brand: "bg-brand-bright",
  good: "bg-good",
  warn: "bg-warn",
  bad: "bg-bad",
  note: "bg-note",
  neutral: "bg-dim/50",
};

export function Chip({
  tone = "neutral",
  dot = false,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap",
        SOFT[tone],
        className,
      )}
    >
      {dot ? <span className={cn("size-1.5 rounded-full", DOT[tone])} aria-hidden /> : null}
      {children}
    </span>
  );
}

export function Banner({
  tone = "neutral",
  action,
  children,
}: {
  tone?: Tone;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-md px-3.5 py-2.5 text-sm text-ink",
        SOFT[tone].split(" ")[0],
      )}
    >
      <div className="min-w-0">{children}</div>
      {action}
    </div>
  );
}

export function Card({
  label,
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className={cn("rounded-lg border border-line bg-surface shadow-soft", className)}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  count,
  aside,
  description,
}: {
  title: ReactNode;
  count?: number | string;
  aside?: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-ink">
          {title}
          {count !== undefined ? (
            <span className="ml-1.5 font-mono text-xs font-medium text-dim">{count}</span>
          ) : null}
        </h2>
        {description ? <p className="mt-0.5 text-xs text-dim">{description}</p> : null}
      </div>
      {aside ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-dim">{aside}</div>
      ) : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-dim">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface px-6 py-10 text-center">
      <p className="font-semibold text-ink">{title}</p>
      {children ? <p className="mx-auto mt-1 max-w-md text-sm text-dim">{children}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Loading({ children = "Loading…" }: { children?: ReactNode }) {
  return (
    <p role="status" className="px-4 py-6 text-sm text-dim">
      {children}
    </p>
  );
}

export function ErrorText({
  children,
  onRetry,
  retrying = false,
}: {
  children?: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  if (!children) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 px-4 py-4 text-sm text-bad">
      <span>{children}</span>
      {onRetry ? (
        <button
          type="button"
          disabled={retrying}
          onClick={onRetry}
          className="font-semibold underline disabled:opacity-60"
        >
          {retrying ? "Retrying…" : "Retry"}
        </button>
      ) : null}
    </div>
  );
}

export function Avatar({ name, className }: { name?: string | null; className?: string }) {
  const parts = String(name ?? "?")
    .split(/\s+/)
    .filter(Boolean);
  const text = ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand",
        className,
      )}
    >
      {text}
    </span>
  );
}

/** Label / value pairs in a tidy two-column list. */
export function Facts({ items }: { items: Array<[ReactNode, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-2 text-sm">
      {items.map(([label, value], index) => (
        <div key={index} className="contents">
          <dt className="text-dim">{label}</dt>
          <dd className="min-w-0 font-medium break-words text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
