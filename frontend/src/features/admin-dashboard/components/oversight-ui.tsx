import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight, Inbox, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type OversightTone = "mint" | "amber" | "rose" | "blue" | "violet" | "neutral";

const TONES: Record<OversightTone, { wash: string; icon: string; pill: string; bar: string }> = {
  mint: {
    wash: "border-mint/20 bg-gradient-to-br from-mint-soft/80 to-card/90",
    icon: "border-mint/20 bg-mint-soft text-mint-deep",
    pill: "border-mint/20 bg-mint-soft text-mint-deep",
    bar: "bg-mint",
  },
  amber: {
    wash: "border-warning/20 bg-gradient-to-br from-warning-soft/75 to-card/90",
    icon: "border-warning/20 bg-warning-soft text-warning-foreground",
    pill: "border-warning/25 bg-warning-soft text-warning-foreground",
    bar: "bg-warning",
  },
  rose: {
    wash: "border-critical/20 bg-gradient-to-br from-critical-soft/70 to-card/90",
    icon: "border-critical/20 bg-critical-soft text-critical-foreground",
    pill: "border-critical/20 bg-critical-soft text-critical-foreground",
    bar: "bg-critical",
  },
  blue: {
    wash: "border-info/20 bg-gradient-to-br from-info-soft/70 to-card/90",
    icon: "border-info/20 bg-info-soft text-info-foreground",
    pill: "border-info/20 bg-info-soft text-info-foreground",
    bar: "bg-info",
  },
  violet: {
    wash: "border-review/20 bg-gradient-to-br from-review-soft/70 to-card/90",
    icon: "border-review/20 bg-review-soft text-review-foreground",
    pill: "border-review/20 bg-review-soft text-review-foreground",
    bar: "bg-review",
  },
  neutral: {
    wash: "border-border bg-card/85",
    icon: "border-border bg-neutral-soft text-muted-foreground",
    pill: "border-border bg-neutral-soft text-muted-foreground",
    bar: "bg-muted-foreground",
  },
};

export function OversightMetric({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
  tone?: OversightTone;
}) {
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-[1.35rem] border p-4 shadow-[var(--shadow-card)]",
        TONES[tone].wash,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            {label}
          </p>
          <p className="num mt-2 text-[1.75rem] leading-none font-semibold tracking-[-0.04em]">
            {value}
          </p>
        </div>
        <span
          className={cn(
            "flex size-9 items-center justify-center rounded-xl border",
            TONES[tone].icon,
          )}
        >
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <p className="mt-3 truncate text-xs text-muted-foreground">{detail}</p>
    </article>
  );
}

export function OversightPanel({
  title,
  description,
  count,
  toolbar,
  children,
}: {
  title: string;
  description: string;
  count?: number;
  toolbar?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-[1.65rem] border border-white/80 bg-card/90 shadow-[var(--shadow-card)] backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
            {count !== undefined ? (
              <span className="num rounded-full border border-border bg-neutral-soft px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {count}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        {toolbar ? (
          <div className="flex flex-1 justify-end gap-2 sm:flex-none">{toolbar}</div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function OversightSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
      <Search
        className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <span className="sr-only">{placeholder}</span>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 rounded-full border-border bg-neutral-soft/70 pr-3 pl-9 shadow-none"
      />
    </label>
  );
}

export function OversightPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: OversightTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold",
        TONES[tone].pill,
      )}
    >
      {children}
    </span>
  );
}

export function CapacityBar({ value, tone = "mint" }: { value: number; tone?: OversightTone }) {
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-neutral-soft"
      aria-label={`${value}% capacity`}
    >
      <span
        className={cn("block h-full rounded-full", TONES[tone].bar)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function OversightPager({
  page,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
}: {
  page: number;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between border-t border-border/70 px-4 py-3 sm:px-5">
      <span className="num text-xs text-muted-foreground">Page {page}</span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="icon"
          className="size-8 rounded-full"
          onClick={onPrevious}
          disabled={!canPrevious}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-3.5" aria-hidden />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8 rounded-full"
          onClick={onNext}
          disabled={!canNext}
          aria-label="Next page"
        >
          <ChevronRight className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

export function OversightEmpty({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center px-5 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-2xl border border-mint/20 bg-mint-soft text-mint-deep">
        <Inbox className="size-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
