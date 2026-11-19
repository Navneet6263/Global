import type { ReactNode } from "react";
import { Inbox, Search } from "lucide-react";
import { Button, Chip, Input, type Tone } from "@/kit";
import { cn } from "@/lib/utils";

/** Older pages pass colour words; map them to kit tones. */
const OLD_TONE: Record<string, Tone> = {
  blue: "brand",
  green: "good",
  amber: "warn",
  red: "bad",
  violet: "note",
  slate: "neutral",
};
const VALUE: Record<Tone, string> = {
  brand: "text-ink",
  good: "text-good",
  warn: "text-warn",
  bad: "text-bad",
  note: "text-note",
  neutral: "text-ink",
};

const kitTone = (tone?: string): Tone => OLD_TONE[tone ?? "blue"] ?? "neutral";

/** Headline numbers at the top of a page (Task stat tiles). */
export function ClientSummary({
  items,
}: {
  items: Array<{ label: string; value: ReactNode; detail?: string; tone?: string }>;
}) {
  return (
    <section aria-label="Page summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-line bg-surface shadow-soft px-4 py-3"
        >
          <span className="truncate text-[11px] font-semibold tracking-wider text-dim uppercase">
            {item.label}
          </span>
          <strong
            className={cn(
              "font-mono text-[24px] leading-none font-semibold tabular-nums",
              VALUE[kitTone(item.tone)],
            )}
          >
            {item.value}
          </strong>
          {item.detail ? <small className="truncate text-xs text-dim">{item.detail}</small> : null}
        </div>
      ))}
    </section>
  );
}

export function ClientSearch({
  value,
  onChange,
  onSubmit,
  label,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  label: string;
  placeholder?: string;
}) {
  return (
    <form
      className="flex w-full min-w-0 gap-2 sm:max-w-md"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-dim"
          aria-hidden
        />
        <Input
          aria-label={label}
          placeholder={placeholder ?? label}
          value={value}
          maxLength={120}
          onChange={(event) => onChange(event.target.value)}
          type="search"
          className="pl-9"
        />
      </div>
      <Button type="submit">Search</Button>
    </form>
  );
}

export function ClientPager({
  page,
  previous,
  next,
  busy,
  onPrevious,
  onNext,
  detail,
}: {
  page: number;
  previous: boolean;
  next: boolean;
  busy?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  detail?: ReactNode;
}) {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm">
      <span className="text-xs text-dim">{detail}</span>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          aria-label="Previous page"
          disabled={!previous || busy}
          onClick={onPrevious}
        >
          Previous
        </Button>
        <span aria-live="polite" className="text-dim">
          Page {page}
        </span>
        <Button size="sm" aria-label="Next page" disabled={!next || busy} onClick={onNext}>
          Next
        </Button>
      </div>
    </footer>
  );
}

export function ClientEmpty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="px-6 py-10 text-center">
      <Inbox className="mx-auto mb-2 size-6 text-dim/70" aria-hidden />
      <h3 className="font-semibold text-ink">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-dim">{children}</p>
    </div>
  );
}

export function ClientPill({ children, tone = "blue" }: { children: ReactNode; tone?: string }) {
  return <Chip tone={kitTone(tone)}>{children}</Chip>;
}
