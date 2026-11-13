import { AlertCircle, ChevronLeft, ChevronRight, Clock3, Loader2, Search } from "lucide-react";

import type { VerificationTask } from "@/lib/api/tasks";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/workspace/kit";
import { humanize } from "../utils";
import { dueLabel, l2QueueLabel } from "./queue-labels";

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
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42/0.04)] xl:sticky xl:top-[76px] xl:self-start"
    >
      <header className="grid gap-3 border-b border-slate-100 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-slate-900">My checks</h2>
          <span
            role="status"
            className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[12px] font-medium text-slate-600"
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
        <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 transition focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100">
          <Search className="size-4 shrink-0 text-slate-400" aria-hidden />
          <input
            value={props.search}
            onChange={(event) => props.onSearch(event.target.value)}
            placeholder="Search candidate, Sapling ID or company"
            aria-label="Search assigned checks"
            className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-slate-400"
          />
        </label>
        <div
          className="flex gap-0.5 rounded-lg bg-slate-100 p-0.5"
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
                "min-w-0 flex-auto truncate rounded-md px-2 py-1.5 text-[12.5px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40",
                props.activeFilter === filter
                  ? "bg-white font-semibold text-slate-900 shadow-[0_1px_2px_rgb(15_23_42/0.08)]"
                  : "text-slate-500 hover:text-slate-900",
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
          "max-h-[640px] min-h-40 divide-y divide-slate-100 overflow-y-auto",
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
  const l2 = l2QueueLabel(task);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "relative flex w-full items-start gap-3 px-4 py-3.5 text-left transition",
        active ? "bg-blue-50/70" : "hover:bg-slate-50",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-[3px]",
          active
            ? "bg-blue-600"
            : overdue
              ? "bg-red-400"
              : task.status === "BLOCKED"
                ? "bg-amber-400"
                : "",
        )}
      />
      <Avatar
        name={task.check.case.subject.fullName}
        size="sm"
        tone={task.status === "BLOCKED" ? "warn" : "info"}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <strong className="truncate text-[14px] leading-5 font-semibold text-slate-900">
            {task.check.case.subject.fullName}
          </strong>
          <Status status={task.status} />
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-slate-500">
          <span className="font-mono">{task.check.case.caseNumber}</span>
          {" · "}
          {task.check.case.client.displayName}
        </span>
        <span className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11.5px] font-semibold text-slate-700">
              {humanize(task.check.type)}
            </span>
            {l2 ? (
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                  l2.resolved ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800",
                )}
              >
                {l2.label}
              </span>
            ) : null}
          </span>
          <span
            className={cn(
              "flex shrink-0 items-center gap-1 text-[12px]",
              overdue ? "font-semibold text-red-600" : "text-slate-500",
            )}
          >
            {overdue ? <AlertCircle className="size-3.5" /> : <Clock3 className="size-3.5" />}
            {task.dueAt
              ? `${overdue ? "Overdue · " : "Due "}${dueLabel(task.dueAt)}`
              : "No due date"}
          </span>
        </span>
        {task.assignee?.name ? (
          <span className="mt-1 block truncate text-[11.5px] text-slate-500">
            Claimed by <span className="font-medium text-slate-700">{task.assignee.name}</span>
          </span>
        ) : null}
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
