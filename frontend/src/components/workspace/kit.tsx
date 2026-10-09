import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Inbox, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { BAR, ICON_TILE, PILL, initials, type Tone } from "./tones";

type Icon = ComponentType<{ className?: string }>;

/** One headline number: tinted icon tile, label, value and a short hint. */
export function StatCard({
  icon: IconCmp,
  label,
  value,
  hint,
  tone = "neutral",
  to,
  onClick,
  active,
  share,
}: {
  icon: Icon;
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
  /** Makes the whole card a link. */
  to?: string;
  /** Makes the whole card a filter button. */
  onClick?: () => void;
  active?: boolean;
  /** 0–100: thin progress line under the hint. */
  share?: number;
}) {
  const body = (
    <>
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", ICON_TILE[tone])}>
        <IconCmp className="size-5" aria-hidden />
      </span>
      <span className="grid min-w-0 flex-1">
        <small className="text-xs font-medium text-slate-500">{label}</small>
        <strong
          className={cn(
            "text-[26px] font-bold leading-8 tracking-tight tabular-nums",
            tone === "bad" ? "text-red-600" : "text-slate-900",
          )}
        >
          {value}
        </strong>
        {hint ? <span className="truncate text-[11.5px] text-slate-400">{hint}</span> : null}
        {share !== undefined ? (
          <span className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            <span
              className={cn("block h-full rounded-full", BAR[tone])}
              style={{ width: `${Math.max(share ? 4 : 0, Math.min(100, share))}%` }}
            />
          </span>
        ) : null}
      </span>
    </>
  );
  const base =
    "flex min-w-0 items-start gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition";
  const interactive =
    "hover:-translate-y-px hover:border-blue-200 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40";
  const border = active ? "border-blue-300 ring-2 ring-blue-500/20" : "border-slate-200";
  if (to)
    return (
      <Link to={to} className={cn(base, border, interactive)}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={cn(base, border, interactive)}
      >
        {body}
      </button>
    );
  return <div className={cn(base, border)}>{body}</div>;
}

export function StatGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {children}
    </section>
  );
}

/** White card with an optional header row (title, count, description, actions). */
export function Panel({
  title,
  description,
  count,
  actions,
  label,
  className,
  bodyClassName,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  count?: number;
  actions?: ReactNode;
  /** Accessible name when the panel has no visible title. */
  label?: string;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        "min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      {title || actions ? (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-4">
          <div className="min-w-0">
            {title ? (
              <h2 className="flex items-center gap-2 text-[17px] font-bold text-slate-900">
                {title}
                {count !== undefined ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] font-semibold text-slate-600">
                    {count}
                  </span>
                ) : null}
              </h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-[12.5px] text-slate-500">{description}</p>
            ) : null}
          </div>
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </header>
      ) : null}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}

export function Pill({
  tone = "neutral",
  dot = true,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold",
        PILL[tone],
        className,
      )}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden /> : null}
      {children}
    </span>
  );
}

/** Neutral outline tag, e.g. "2 checks". */
export function Tag({ icon: IconCmp, children }: { icon?: Icon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11.5px] font-medium text-slate-600">
      {IconCmp ? <IconCmp className="size-3" aria-hidden /> : null}
      {children}
    </span>
  );
}

export function Avatar({
  name,
  size = "md",
  tone = "info",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  tone?: "info" | "warn" | "neutral";
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-bold",
        size === "sm"
          ? "size-7 text-[11px]"
          : size === "lg"
            ? "size-12 text-[15px]"
            : "size-9 text-[12.5px]",
        tone === "warn"
          ? "bg-amber-100 text-amber-700"
          : tone === "neutral"
            ? "bg-slate-100 text-slate-500"
            : "bg-blue-100 text-blue-800",
      )}
    >
      {initials(name)}
    </span>
  );
}

export function EmptyState({
  icon: IconCmp = Inbox,
  title,
  detail,
  tone = "good",
  action,
}: {
  icon?: Icon;
  title: string;
  detail?: ReactNode;
  tone?: Tone;
  action?: ReactNode;
}) {
  return (
    <div className="grid justify-items-center gap-1 px-5 py-12 text-center">
      <span className={cn("mb-2 grid size-12 place-items-center rounded-2xl", ICON_TILE[tone])}>
        <IconCmp className="size-6" aria-hidden />
      </span>
      <strong className="text-[15px] text-slate-900">{title}</strong>
      {detail ? <span className="max-w-sm text-[13px] text-slate-500">{detail}</span> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="grid min-h-48 place-items-center text-[13px] text-slate-500" role="status">
      <span className="flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        {label}
      </span>
    </div>
  );
}

/** Pill tabs with optional counts; `label` names the group for assistive tech. */
export function SegmentTabs<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ id: T; label: string; count?: number }>;
  onChange: (value: T) => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition",
            value === option.id
              ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
              : "text-slate-600 hover:bg-white/70 hover:text-slate-900",
          )}
        >
          {option.label}
          {option.count !== undefined ? (
            <span
              className={cn(
                "min-w-5 rounded-md px-1.5 text-center text-[11px]",
                value === option.id ? "bg-blue-50 text-blue-700" : "bg-slate-200/70 text-slate-600",
              )}
            >
              {option.count}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/** Search box; submit-on-enter when `onSubmit` is given, otherwise live. */
export function SearchField({
  value,
  onChange,
  onSubmit,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <form
      role="search"
      className={cn(
        "flex h-10 min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 pl-3 pr-1 transition focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100",
        className,
      )}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
      <input
        type="search"
        value={value}
        maxLength={120}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-slate-400"
      />
      {onSubmit ? (
        <button
          type="submit"
          aria-label="Search"
          className="h-8 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Search
        </button>
      ) : null}
    </form>
  );
}

export function PagerFooter({
  summary,
  page,
  pages,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  previousLabel = "Previous page",
  nextLabel = "Next page",
}: {
  summary: ReactNode;
  page?: number;
  pages?: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  previousLabel?: string;
  nextLabel?: string;
}) {
  const button =
    "grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-[12.5px] text-slate-500">
      <span>{summary}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={previousLabel}
          disabled={!hasPrevious}
          onClick={onPrevious}
          className={button}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
        {page !== undefined ? (
          <span className="tabular-nums">
            Page {page}
            {pages ? ` / ${pages}` : ""}
          </span>
        ) : null}
        <button
          type="button"
          aria-label={nextLabel}
          disabled={!hasNext}
          onClick={onNext}
          className={button}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </footer>
  );
}
