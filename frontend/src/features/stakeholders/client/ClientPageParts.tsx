import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Inbox, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ClientSummary({
  items,
}: {
  items: Array<{ label: string; value: ReactNode; detail?: string; tone?: string }>;
}) {
  return (
    <section className="client-summary-strip" aria-label="Page summary">
      {items.map((item) => (
        <div key={item.label} data-tone={item.tone ?? "blue"}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.detail && <small>{item.detail}</small>}
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
      className="client-register-search"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <Search aria-hidden />
      <input
        aria-label={label}
        placeholder={placeholder ?? label}
        value={value}
        maxLength={120}
        onChange={(e) => onChange(e.target.value)}
        type="search"
      />
      <Button variant="ghost" size="sm" type="submit">
        Search
      </Button>
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
    <footer className="client-register-footer">
      <span>{detail}</span>
      <div>
        <span aria-live="polite">Page {page}</span>
        <Button
          size="icon"
          variant="outline"
          aria-label="Previous page"
          disabled={!previous || busy}
          onClick={onPrevious}
        >
          <ChevronLeft aria-hidden />
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label="Next page"
          disabled={!next || busy}
          onClick={onNext}
        >
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </footer>
  );
}

export function ClientEmpty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="client-register-empty">
      <Inbox aria-hidden />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

export function ClientPill({ children, tone = "blue" }: { children: ReactNode; tone?: string }) {
  return (
    <span className="client-state-pill" data-tone={tone}>
      {children}
    </span>
  );
}
