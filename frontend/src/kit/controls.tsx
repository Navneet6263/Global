import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/** Underlined tab row. `tabs` is [value, label, badge?][]. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  aside,
}: {
  tabs: ReadonlyArray<readonly [T, ReactNode, ReactNode?]>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line">
      <div role="tablist" aria-label={label} className="-mb-px flex gap-1 overflow-x-auto">
        {tabs.map(([key, text, badge]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={value === key}
            onClick={() => onChange(key)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap",
              value === key
                ? "border-brand font-semibold text-ink"
                : "border-transparent font-medium text-dim hover:text-ink",
            )}
          >
            {text}
            {badge}
          </button>
        ))}
      </div>
      {aside ? <div className="flex flex-wrap gap-2 pb-1.5">{aside}</div> : null}
    </div>
  );
}

/** Compact button group for switching views. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: ReadonlyArray<readonly [T, ReactNode]>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("inline-flex rounded-md border border-line bg-subtle p-0.5", className)}
    >
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={cn(
            "rounded px-3 py-1 text-xs font-semibold whitespace-nowrap",
            value === key ? "bg-surface text-ink shadow-sm" : "text-dim hover:text-ink",
          )}
        >
          {text}
        </button>
      ))}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50",
        checked ? "bg-brand" : "bg-line",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] size-[18px] rounded-full bg-surface shadow transition-all",
          checked ? "left-[23px]" : "left-[3px]",
        )}
      />
    </button>
  );
}

const METER: Record<string, string> = {
  brand: "bg-brand-bright",
  good: "bg-good",
  warn: "bg-warn",
  bad: "bg-bad",
  note: "bg-note",
};

/** Thin horizontal meter. */
export function Meter({
  value,
  max = 100,
  tone = "brand",
  label,
}: {
  value: number;
  max?: number;
  tone?: "brand" | "good" | "warn" | "bad" | "note";
  label: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-subtle"
      role="meter"
      aria-label={label}
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={cn("h-full rounded-full", METER[tone])} style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Previous / Page x of y / Next under a list, with "Showing 26–50 of 103". */
export function Pager({
  page,
  pages,
  onChange,
  total,
  size,
  className,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
  total?: number;
  size?: number;
  className?: string;
}) {
  const from = size ? (page - 1) * size + 1 : 0;
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-2 text-sm", className)}>
      {total !== undefined && size ? (
        <span className="mr-auto text-xs text-dim">
          {total ? `Showing ${from}–${Math.min(total, from + size - 1)} of ${total}` : "No results"}
        </span>
      ) : null}
      {pages > 1 ? (
        <>
          <Button size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
            Previous
          </Button>
          <span className="text-dim">
            Page {page} of {pages}
          </span>
          <Button size="sm" disabled={page >= pages} onClick={() => onChange(page + 1)}>
            Next
          </Button>
        </>
      ) : null}
    </div>
  );
}
