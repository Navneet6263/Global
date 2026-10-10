import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  Search,
  ShieldCheck,
} from "lucide-react";

import type { QaRegisterItem } from "@/lib/backend-api/qa-register";
import { cn } from "@/lib/utils";
import { formatDate, humanize } from "../utils";

interface QaQueueProps {
  items: QaRegisterItem[];
  total: number;
  pending?: boolean;
  unavailable?: boolean;
  availableOnly?: boolean;
  onAvailableChange?: (value: boolean) => void;
  corrections?: boolean;
  selectedId?: string;
  search: string;
  page: number;
  hasPrevious: boolean;
  hasNext: boolean;
  onSearch: (value: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (id: string) => void;
}

export function QaQueue(props: QaQueueProps) {
  return (
    <section
      aria-label="QA case list"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-5 xl:self-start"
    >
      <header className="border-b border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900">
              {props.corrections ? "Returned for correction" : "Quality review queue"}
            </h2>
            <p className="mt-0.5 text-[12px] text-slate-500">
              {props.corrections
                ? "Waiting on verification work before the next QA review"
                : "Claim one case before making a decision"}
            </p>
          </div>
          <span
            role="status"
            className="num flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-600"
          >
            {props.pending ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                Updating cases
              </>
            ) : (
              `${props.total} cases`
            )}
          </span>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={props.search}
            onChange={(event) => props.onSearch(event.target.value)}
            placeholder="Search candidate, case or client"
            aria-label="Search QA queue"
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-[12.5px] outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100"
          />
        </div>
        {props.availableOnly !== undefined ? (
          <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={props.availableOnly}
              onChange={(event) => props.onAvailableChange?.(event.target.checked)}
              className="size-4 accent-primary"
            />
            Available to claim only
          </label>
        ) : null}
      </header>

      <div
        aria-busy={props.pending}
        inert={props.pending || props.unavailable}
        className={cn(
          "min-h-40 max-h-[60vh] space-y-1.5 overflow-y-auto overscroll-y-auto p-2",
          props.pending && "opacity-60",
        )}
      >
        {props.items.map((item) => (
          <QaQueueCard
            key={item.id}
            item={item}
            active={props.selectedId === item.id}
            onSelect={() => props.onSelect(item.id)}
          />
        ))}
        {props.unavailable ? (
          <p className="p-5 text-xs text-muted-foreground">
            Queue unavailable. Retry using the message above.
          </p>
        ) : !props.items.length && !props.pending ? (
          <QaQueueEmpty />
        ) : null}
      </div>

      <footer className="flex items-center justify-between border-t border-slate-200 px-4 py-2.5">
        <span className="text-xs text-muted-foreground">
          Page {props.page} · {props.items.length} cases
        </span>
        <div className="flex gap-1.5">
          <PageButton
            label="Previous review page"
            disabled={!props.hasPrevious}
            onClick={props.onPrevious}
            icon={ChevronLeft}
          />
          <PageButton
            label="Next review page"
            disabled={!props.hasNext}
            onClick={props.onNext}
            icon={ChevronRight}
          />
        </div>
      </footer>
    </section>
  );
}

function QaQueueCard({
  item,
  active,
  onSelect,
}: {
  item: QaRegisterItem;
  active: boolean;
  onSelect: () => void;
}) {
  const highRisk = ["HIGH", "CRITICAL"].includes(item.highestRisk ?? "");
  const overdue = Boolean(item.dueAt && new Date(item.dueAt).getTime() < Date.now());
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "relative w-full overflow-hidden rounded-xl border p-3 text-left transition duration-150",
        active
          ? "border-blue-300 bg-blue-50/70 ring-2 ring-blue-500/15"
          : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50",
      )}
    >
      {active ? (
        <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-blue-600" />
      ) : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-slate-900">
            <span
              className={cn(
                "size-1.5 shrink-0 rounded-full",
                highRisk || overdue ? "bg-red-500" : "bg-emerald-500",
              )}
              aria-hidden
            />
            {item.subject.fullName}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-slate-500">
            {item.caseNumber} · {item.client.displayName}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1",
            highRisk || ["CRITICAL", "URGENT"].includes(item.priority)
              ? "bg-red-50 text-red-700 ring-red-200"
              : item.priority === "HIGH"
                ? "bg-amber-50 text-amber-800 ring-amber-200"
                : "bg-slate-50 text-slate-600 ring-slate-200",
          )}
        >
          {highRisk ? "High risk" : humanize(item.priority)}
        </span>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[11.5px] text-slate-500">
        <span>
          {item.completedCheckCount}/{item.checkCount} checks complete
        </span>
        <span
          className={cn(
            "flex items-center gap-1",
            overdue && "font-medium text-critical-foreground",
          )}
        >
          {overdue ? <AlertTriangle className="size-3" /> : <Clock3 className="size-3" />}
          {item.dueAt ? formatDate(item.dueAt) : "No due date"}
        </span>
      </div>
      {item.qaReviewer && item.claimActive ? (
        <p className="mt-2 flex items-center gap-1 text-[11.5px] font-medium text-review-foreground">
          <ShieldCheck className="size-3" /> Claimed by {item.qaReviewer.displayName}
        </p>
      ) : null}
    </button>
  );
}

function QaQueueEmpty() {
  return (
    <div className="px-5 py-14 text-center">
      <span className="mx-auto grid size-10 place-items-center rounded-full bg-review-soft text-review-foreground">
        <ShieldCheck className="size-4" />
      </span>
      <p className="mt-3 text-[12px] font-medium">Review queue is clear</p>
      <p className="mt-1 text-[12.5px] text-muted-foreground">No cases match this search.</p>
    </div>
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
      className="grid size-8 place-items-center rounded-full border border-border bg-white text-muted-foreground transition hover:bg-review-soft hover:text-review-foreground disabled:cursor-not-allowed disabled:opacity-35"
    >
      <Icon className="size-3.5" />
    </button>
  );
}
