import { AlertCircle, ChevronLeft, ChevronRight, Clock3, Search } from "lucide-react";

import type { VerificationTask } from "@/lib/api/tasks";
import { cn } from "@/lib/utils";
import { formatDate, humanize } from "../utils";

export type VerifierQueueFilter = "ACTIVE" | "OPEN" | "IN_PROGRESS" | "BLOCKED" | "COMPLETED";

interface VerifierQueueProps {
  items: VerificationTask[];
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
    <section className="overflow-hidden rounded-[1.65rem] border border-white/80 bg-card/85 shadow-[var(--shadow-float)] backdrop-blur-sm xl:sticky xl:top-5 xl:self-start">
      <header className="border-b border-border/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Assigned checks</h2>
            <p className="mt-0.5 text-[10.5px] text-muted-foreground">
              Select a task to continue verification
            </p>
          </div>
          <span className="num rounded-full bg-mint-soft px-2.5 py-1 text-[10px] font-medium text-mint-deep">
            {props.items.length} shown
          </span>
        </div>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={props.search}
            onChange={(event) => props.onSearch(event.target.value)}
            placeholder="Search case, candidate or client"
            aria-label="Search assigned checks"
            className="h-10 w-full rounded-full border border-border bg-background/75 pl-9 pr-3 text-[12px] outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <div
          className="mt-3 flex gap-1 overflow-x-auto rounded-full bg-mint-soft/65 p-1"
          aria-label="Task status"
        >
          {props.filters.map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => props.onFilter(filter)}
              aria-pressed={props.activeFilter === filter}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-[10px] font-medium transition",
                props.activeFilter === filter
                  ? "bg-white text-foreground shadow-[var(--shadow-card)]"
                  : "text-mint-deep hover:bg-white/55",
              )}
            >
              {humanize(filter)}
            </button>
          ))}
        </div>
      </header>

      <div className="max-h-[690px] space-y-2 overflow-y-auto p-3">
        {props.items.map((task) => (
          <QueueItem
            key={task.id}
            task={task}
            active={props.selectedId === task.id}
            onSelect={() => props.onSelect(task.id)}
          />
        ))}
        {!props.items.length ? <QueueEmpty /> : null}
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
        "relative w-full overflow-hidden rounded-[1.15rem] border p-3.5 text-left transition duration-200",
        active
          ? "border-mint/30 bg-mint-soft/75 shadow-[var(--shadow-card)]"
          : "border-transparent bg-background/55 hover:border-white hover:bg-white/85",
      )}
    >
      {active ? <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-mint" /> : null}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-foreground">
            {task.check.case.subject.fullName}
          </p>
          <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
            {task.check.case.caseNumber} · {humanize(task.check.type)}
          </p>
        </div>
        <Status status={task.status} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-[9.5px] text-muted-foreground">
        <span className="truncate">{task.check.case.client.displayName}</span>
        <span
          className={cn(
            "flex shrink-0 items-center gap-1",
            overdue && "font-medium text-critical-foreground",
          )}
        >
          {overdue ? <AlertCircle className="size-3" /> : <Clock3 className="size-3" />}
          {task.dueAt ? formatDate(task.dueAt) : "No due date"}
        </span>
      </div>
    </button>
  );
}

function QueueEmpty() {
  return (
    <div className="px-5 py-14 text-center">
      <span className="mx-auto grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <Search className="size-4" />
      </span>
      <p className="mt-3 text-[12px] font-medium">No matching checks</p>
      <p className="mt-1 text-[10.5px] text-muted-foreground">Try another status or search.</p>
    </div>
  );
}

function QueuePagination(
  props: Pick<VerifierQueueProps, "items" | "hasPrevious" | "hasNext" | "onPrevious" | "onNext">,
) {
  return (
    <footer className="flex items-center justify-between border-t border-border/70 px-4 py-3">
      <span className="text-[10px] text-muted-foreground">
        Cursor pagination · {props.items.length} checks
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
      className="grid size-8 place-items-center rounded-full border border-border bg-white/70 text-muted-foreground transition hover:bg-mint-soft hover:text-mint-deep disabled:cursor-not-allowed disabled:opacity-35"
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
    <span className={cn("shrink-0 rounded-full border px-2 py-1 text-[8.5px] font-semibold", tone)}>
      {humanize(status)}
    </span>
  );
}
