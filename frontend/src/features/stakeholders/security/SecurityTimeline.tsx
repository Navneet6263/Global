import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";

import type { SecurityEvent } from "@/lib/api/auth";
import { StakeholderPanel } from "../StakeholderShell";

export function SecurityTimeline({
  items,
  total,
  page,
  loading,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: {
  items: SecurityEvent[];
  total: number;
  page: number;
  loading: boolean;
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <StakeholderPanel
      title="Security timeline"
      detail={`${total} authentication and session events`}
    >
      <div className="p-4">
        {loading ? <div className="h-28 animate-pulse rounded-xl bg-slate-100" /> : null}
        <div className="grid gap-2 md:grid-cols-2">
          {items.map((item) => {
            const attention = item.risk === "ATTENTION";
            const Icon = attention ? AlertTriangle : CheckCircle2;
            return (
              <article
                key={item.id}
                className={`flex gap-3 rounded-xl border p-3 ${
                  attention ? "border-amber-200 bg-amber-50/50" : "border-slate-200"
                }`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                    attention ? "bg-amber-100 text-amber-700" : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div>
                  <p className="text-xs font-semibold">{humanize(item.action)}</p>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {formatDate(item.createdAt)}
                    {item.ipAddress ? ` · ${item.ipAddress}` : ""}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
        {!loading && !items.length ? (
          <p className="py-10 text-center text-xs text-slate-500">
            Security events will appear after the next authentication action.
          </p>
        ) : null}
      </div>
      <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
        <span className="text-[10px] font-medium text-slate-500">Page {page}</span>
        <div className="flex items-center gap-2">
          <PageButton
            label="Previous security events"
            disabled={!hasPrevious || loading}
            onClick={onPrevious}
            icon={ChevronLeft}
          />
          <PageButton
            label="Next security events"
            disabled={!hasNext || loading}
            onClick={onNext}
            icon={ChevronRight}
          />
        </div>
      </footer>
    </StakeholderPanel>
  );
}

function PageButton({
  label,
  disabled,
  onClick,
  icon: Icon,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  icon: typeof ChevronLeft;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-35"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function humanize(value: string) {
  return value
    .replaceAll(".", " · ")
    .replaceAll("-", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
