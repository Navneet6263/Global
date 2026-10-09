import { AlertCircle, ChevronLeft, ChevronRight, Clock3, Loader2, Search } from "lucide-react";

import type { VerificationTask } from "@/lib/api/tasks";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/workspace/kit";
import { formatDate, humanize } from "../utils";

export type VerifierQueueFilter = "ACTIVE" | "OPEN" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED";

interface VerifierQueueProps {
  items: VerificationTask[];
  pending?: boolean;
  selectedId?: string;
  search: string;
  filters: readonly VerifierQueueFilter[];
  activeFilter: VerifierQueueFilter;
  hasPrevious: boolean;
  hasNext: boolean;
  onSearch: (value: string) => void;
  onFilter: (value: VerifierQueueFilter) => void;
  onPrevious: () => void;
  onNext: () => void;
  onSelect: (id: string) => void;
}

export function VerifierQueue(props: VerifierQueueProps) {
  return (
    <section
      aria-label="Assigned checks"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-5 xl:self-start"
    >
      <header className="grid gap-3 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-bold text-slate-900">My checks</h2>
          <span
            role="status"
            className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[11.5px] font-semibold text-slate-600"
          >
            {props.pending ? (
              <>
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                Updating checks
              </>
            ) : (
              `${props.items.length} shown`
            )}
          </span>
        </div>
        <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-100">
          <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
          <input
            value={props.search}
            onChange={(event) => props.onSearch(event.target.value)}
            placeholder="Search candidate, Sapling ID or company"
            aria-label="Search assigned checks"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-slate-400"
          />
        </label>
        <div
          className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1"
          aria-label="Task status"
          role="group"
        >
          {props.filters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => props.onFilter(filter)}
              aria-pressed={props.activeFilter === filter}
              className={cn(
                "min-w-0 flex-auto rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                props.activeFilter === filter
                  ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-600 hover:bg-white/70 hover:text-slate-900",
              )}
            >
              {humanize(filter)}
            </button>
          ))}
        </div>
      </header>

      <div
        aria-busy={props.pending}
        inert={props.pending}
        className={cn(
          "max-h-[640px] min-h-40 divide-y divide-slate-100 overflow-y-auto border-t border-slate-100",
          props.pending && "opacity-60",
        )}
      >
        {props.items.map((task) => (
          <QueueItem
            key={task.id}
            task={task}
            active={props.selectedId === task.id}
            onSelect={() => props.onSelect(task.id)}
          />
        ))}
        {!props.items.length && !props.pending ? <QueueEmpty /> : null}
      </div>

      <QueuePagination {...props} />
    </section>
  );
}

function QueueItem({
  task,
  active,
  onSelect,
}: {
  task: VerificationTask;
  active: boolean;
  onSelect: () => void;
}) {
  const overdue = Boolean(
    task.dueAt && new Date(task.dueAt).getTime() < Date.now() && task.status !== "COMPLETED",
  );
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "relative flex w-full items-start gap-3 px-4 py-3 text-left transition",
        active ? "bg-blue-50" : "hover:bg-slate-50",
      )}
    >
      {active ? <span className="absolute inset-y-0 left-0 w-[3px] bg-blue-600" /> : null}
      <Avatar
        name={task.check.case.subject.fullName}
        size="sm"
        tone={task.status === "BLOCKED" ? "warn" : "info"}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <strong className="truncate text-[13.5px] font-semibold text-slate-900">
            {task.check.case.subject.fullName}
          </strong>
          <Status status={task.status} />
        </span>
        <span className="block truncate font-mono text-[11.5px] text-slate-500">
          {task.check.case.caseNumber}
        </span>
        <span className="mt-1.5 flex items-center justify-between gap-2 text-[11.5px] text-slate-500">
          <span className="truncate">
            <span className="font-semibold text-blue-700">{humanize(task.check.type)}</span>
            {" · "}
            {task.check.case.client.displayName}
          </span>
          <span
            className={cn(
              "flex shrink-0 items-center gap-1",
              overdue && "font-semibold text-red-600",
            )}
          >
            {overdue ? <AlertCircle className="size-3" /> : <Clock3 className="size-3" />}
            {task.dueAt ? formatDate(task.dueAt) : "No due date"}
          </span>
        </span>
      </span>
    </button>
  );
}

function QueueEmpty() {
  return (
    <div className="px-5 py-14 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-500">
        <Search className="size-5" />
      </span>
      <p className="mt-3 text-[13.5px] font-semibold text-slate-900">No matching checks</p>
      <p className="mt-1 text-[12.5px] text-slate-500">Try another status or search.</p>
    </div>
  );
}

function QueuePagination(
  props: Pick<VerifierQueueProps, "items" | "hasPrevious" | "hasNext" | "onPrevious" | "onNext">,
) {
  return (
    <footer className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
      <span className="text-[12px] text-slate-500">
        {props.items.length} {props.items.length === 1 ? "check" : "checks"} on this page
      </span>
      <div className="flex gap-1.5">
        <PageButton
          label="Previous task page"
          disabled={!props.hasPrevious}
          onClick={props.onPrevious}
          icon={ChevronLeft}
        />
        <PageButton
          label="Next task page"
          disabled={!props.hasNext}
          onClick={props.onNext}
          icon={ChevronRight}
        />
      </div>
    </footer>
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
      className="grid size-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon className="size-3.5" />
    </button>
  );
}

export function Status({ status }: { status: string }) {
  const tone =
    status === "COMPLETED"
      ? "border-success/25 bg-success-soft text-success-foreground"
      : status === "BLOCKED"
        ? "border-critical/25 bg-critical-soft text-critical-foreground"
        : status === "IN_PROGRESS"
          ? "border-info/25 bg-info-soft text-info-foreground"
          : "border-warning/30 bg-warning-soft text-warning-foreground";
  return (
    <span
      className={cn(
        "w-fit shrink-0 justify-self-start rounded-full border px-2 py-1 text-[11px] font-semibold",
        tone,
      )}
    >
      {humanize(status)}
    </span>
  );
}
